import { DomainException, type Database, type DatabaseTransaction } from '@educa/core'
import {
  ErrorCode,
  InvariantException,
  conteudoDeAtividadeSchema,
  duracaoDoAlunoEmMinutos,
  limiteBaseDaTentativa,
  limiteDaTentativa,
  atividadeEnviadaResponseSchema,
  meuDiagnosticoResponseSchema,
  minhasAtividadesResponseSchema,
  provaOnlineResponseSchema,
  questaoSalvaResponseSchema,
  questoesDaProva,
  tempoResponseSchema,
  type EnvioDaTentativa,
  type PaginationQuery,
  type ResponderQuestaoRequest,
  type AtividadeEnviadaResponse,
  type ConteudoDeAtividade,
  type MeuDiagnosticoResponse,
  type MinhasAtividadesResponse,
  type ProvaOnlineResponse,
  type QuestaoSalvaResponse,
  type SituacaoDaMinhaAtividade,
  type TempoResponse,
} from '@educa/shared'
import { paginar } from '../../http/pagination.js'
import { habilidadesDaAtividade } from '../correcao/lote.js'
import { QuedasDaApiRepository } from '../pulso/pulso.repository.js'
import { MinhaAtividadeRepository, type MinhaAtividadeLida, type TentativaLida } from './minha-atividade.repository.js'
import { SaidaDaAbaRepository } from './saida-da-aba.repository.js'
import { readOrdem, naOrdemDoAluno, sortearOrdem, type OrdemDaProva, type Sorteador } from './ordem-da-prova.js'

/**
 * O limite efetivo da tentativa do aluno da sessão (`limiteDaTentativa`, a função única da Tech Spec §5.4): o base mais as extensões dele e da turma e a queda do nosso sistema
 * dentro da prova, a fechada e a em curso. **Uma consulta** para o pulso e as indisponibilidades, na mesma transação. Sem limite base (atividade sem janela), `null`: não há prazo.
 */
async function limiteDaTentativaDoAluno(tx: DatabaseTransaction, atividadeAplicadaId: string, tentativa: TentativaLida): Promise<Date | null> {
  if (tentativa.limiteBaseEm === null) return null
  const extensoes = await new MinhaAtividadeRepository(tx).extensoes(atividadeAplicadaId)
  const { pulso, indisponibilidades } = await new QuedasDaApiRepository(tx).leituraDesde(tentativa.iniciadaEm)
  return limiteDaTentativa({ alunoId: tentativa.alunoId, iniciadaEm: tentativa.iniciadaEm, limiteBase: tentativa.limiteBaseEm, extensoes, indisponibilidades, pulso })
}

/** Passou do limite: `agora` é o `now()` do banco na mesma leitura, e o limite em si ainda vale (um minuto antes grava; depois, não). */
function venceu(limite: Date | null, agora: Date): boolean {
  return limite !== null && agora.getTime() > limite.getTime()
}

/**
 * O que a tentativa é para quem lê (Tech Spec §5.5): **vencida sem envio conta como enviada em toda leitura**, com o limite como hora, e `envio = 'limite'`; a rotina que a
 * grava de verdade é a 6.0. A enviada diz como (`aluno` quando a linha não tem outro); a atividade que o professor encerrou antes de ela enviar diz `encerramento`, sem
 * `enviadaEm`. A em andamento não diz nada.
 */
function envioDaTentativa(tentativa: Pick<TentativaLida, 'enviadaEm' | 'envio' | 'agora'>, estado: EstadoDaAplicacao, limite: Date | null): { enviadaEm: Date | null; envio: EnvioDaTentativa | null } {
  if (tentativa.enviadaEm !== null) return { enviadaEm: tentativa.enviadaEm, envio: tentativa.envio ?? 'aluno' }
  if (estado === 'encerrada') return { enviadaEm: null, envio: 'encerramento' }
  if (limite !== null && venceu(limite, tentativa.agora)) return { enviadaEm: limite, envio: 'limite' }
  return { enviadaEm: null, envio: null }
}

type EstadoDaAplicacao = MinhaAtividadeLida['estado']

/** A situação da atividade para o aluno. `com_diagnostico` só com correção dele em lote aprovado; antes disso, nada diz como ele foi. */
function situacao(lida: MinhaAtividadeLida, venceu: boolean): SituacaoDaMinhaAtividade {
  if (lida.comDiagnostico) return 'com_diagnostico'
  if (lida.enviadaEm !== null || venceu) return 'enviada'
  if (lida.estado === 'encerrada') return 'encerrada'
  return lida.iniciadaEm === null ? 'para_fazer' : 'em_andamento'
}

/** A janela da aplicação como o contrato a diz: as duas pontas juntas, ou nada. */
function janelaDaProva(abreEm: Date | null, fechaEm: Date | null): { abreEm: string; fechaEm: string } | null {
  return abreEm === null || fechaEm === null ? null : { abreEm: abreEm.toISOString(), fechaEm: fechaEm.toISOString() }
}

/** A atividade na lista do aluno (DTO explícito; regra 20, item 4): sem acerto, sem gabarito, sem turma e sem colega, e a duração é a dele, sem dizer que há tempo adicional. */
function paraATela(lida: MinhaAtividadeLida, venceu: boolean, enviadaEm: Date | null): unknown {
  return {
    id: lida.id,
    titulo: lida.titulo,
    disciplina: { id: lida.disciplinaId, nome: lida.disciplinaNome },
    avaliativa: lida.avaliativa,
    situacao: situacao(lida, venceu),
    questoes: lida.questoes,
    respondidas: lida.respondidas,
    aplicadaEm: lida.aplicadaEm.toISOString(),
    enviadaEm: enviadaEm?.toISOString() ?? null,
    janela: janelaDaProva(lida.abreEm, lida.fechaEm),
    duracaoMin: lida.duracaoMin === null ? null : duracaoDoAlunoEmMinutos(lida.duracaoMin, lida.percentual),
  }
}

/**
 * O lado do aluno na atividade (MVP, A3; regra 70, item 3; regra 80, item 6). O aluno é o da sessão, e só alcança a
 * atividade de uma turma dele: a de outra turma, de outra escola, de outro ano e a inexistente respondem o mesmo
 * `NAO_ENCONTRADO`.
 *
 * - **A prova sai de `questoesDaProva`**: número, enunciado e alternativas. Gabarito, explicação, habilidade e citação
 *   não têm por onde ir.
 * - **Nenhuma resposta se perde nem se duplica**: a gravação é idempotente, e o relógio é o do banco. **E só a escolha mais
 *   nova vale**: o envio atrasado, o F5 e a outra aba não trocam a de `sequencia` maior, e quem perde recebe a gravada.
 * - **Depois do envio e do encerramento, a resposta é recusada** (`ATIVIDADE_ENCERRADA`), e a recusa é decidida com a
 *   aplicação travada: a resposta que chega junto com o encerramento ou é gravada antes da correção, ou é recusada.
 * - **O diagnóstico só existe com o lote aprovado.** Antes disso (lote pendente, rejeitado ou ainda não corrigido) a
 *   rota responde como inexistente, e nem a lista nem a prova dizem acerto, gabarito ou explicação.
 * - Nada daqui traz dado de colega, média da turma nem posição.
 *
 * **Lacuna desta fatia: o aluno transferido.** O alcance do aluno é pela turma em que ele está **agora**. Quem respondeu
 * na turma X e saiu dela (vínculo encerrado, ou movido para Y) continua no lote de X, que a professora de X corrige e
 * aprova (o trabalho é dele, e foi feito lá); mas, depois de sair, ele não lê o diagnóstico daquela atividade: a rota
 * responde como inexistente. Ler o próprio trabalho de uma turma antiga pede alcance pela tentativa, e não pelo vínculo,
 * e fica para depois do MVP de apresentação (decisão do pacote Z; teste em `correcao.int.test.ts`, "aluno transferido").
 */
export class MinhaAtividadeService {
  constructor(
    private readonly banco: Database,
    /** O sorteio da ordem de cada aluno (`crypto.randomInt` em produção); o teste injeta a sequência que quer. */
    private readonly sorteador: Sorteador,
  ) {}

  async list(consulta: PaginationQuery): Promise<MinhasAtividadesResponse> {
    const linhas = await new MinhaAtividadeRepository(this.banco).list(consulta)
    const { itens, proxima } = paginar(linhas, consulta.limite)
    const vencidas = await this.#vencidasSemEnvio(itens)
    return minhasAtividadesResponseSchema.parse({
      itens: itens.map((lida) => {
        const limite = vencidas.get(lida.id)
        return paraATela(lida, limite !== undefined, limite ?? lida.enviadaEm)
      }),
      ...(proxima === undefined ? {} : { proxima }),
    })
  }

  /**
   * As tentativas da página que já passaram do limite sem envio, com o limite de cada uma (**vencida sem envio conta como enviada em toda leitura**, §5.5). Só entra na conta quem
   * pode ter vencido: em andamento, numa atividade aberta, com o limite **base** já no passado (a extensão e a queda só andam o limite para a frente, nunca para trás). Na maioria
   * das páginas ninguém entra, e nada além da lista é lido.
   */
  async #vencidasSemEnvio(itens: readonly MinhaAtividadeLida[]): Promise<Map<string, Date>> {
    const candidatas = itens.flatMap((lida) =>
      lida.alunoId !== null && lida.iniciadaEm !== null && lida.limiteBaseEm !== null && lida.enviadaEm === null && lida.estado === 'aberta' && venceu(lida.limiteBaseEm, lida.agora)
        ? [{ lida, alunoId: lida.alunoId, iniciadaEm: lida.iniciadaEm, limiteBase: lida.limiteBaseEm }]
        : [],
    )
    const vencidas = new Map<string, Date>()
    if (candidatas.length === 0) return vencidas
    await this.banco.transaction(async (tx) => {
      const extensoes = await new MinhaAtividadeRepository(tx).extensoesDas(candidatas.map(({ lida }) => lida.id))
      const { pulso, indisponibilidades } = await new QuedasDaApiRepository(tx).leituraDesde(new Date(Math.min(...candidatas.map(({ iniciadaEm }) => iniciadaEm.getTime()))))
      for (const { lida, alunoId, iniciadaEm, limiteBase } of candidatas) {
        const limite = limiteDaTentativa({ alunoId, iniciadaEm, limiteBase, extensoes: extensoes.get(lida.id) ?? [], indisponibilidades, pulso })
        if (limite !== null && venceu(limite, lida.agora)) vencidas.set(lida.id, limite)
      }
    })
    return vencidas
  }

  /** A prova em andamento como o aluno a lê: as questões, o que ele já salvou e o tempo dele. O `conteudo` já vem lido (`conteudoDeAtividadeSchema`) por quem chama, uma vez só. */
  #emAndamento(prova: NonNullable<Awaited<ReturnType<MinhaAtividadeRepository['prova']>>>, conteudo: ConteudoDeAtividade, tentativa: TentativaLida, respostas: readonly { questao: number; alternativa: number; sequencia: number }[], limite: Date | null): ProvaOnlineResponse {
    const { enviadaEm, envio } = envioDaTentativa(tentativa, prova.estado, limite)
    return provaOnlineResponseSchema.parse({
      comecou: true,
      atividadeAplicadaId: prova.id,
      titulo: prova.titulo,
      avaliativa: prova.avaliativa,
      estado: prova.estado,
      // Só os tipos da adaptação, que valem para a turma inteira: nada sobre aluno (D35).
      adaptacao: conteudo.adaptacao ?? null,
      // Na ordem do aluno, gravada no começo e a mesma em toda leitura; cada questão e cada alternativa leva o número e o índice originais.
      questoes: naOrdemDoAluno(questoesDaProva(conteudo), readOrdem(tentativa.ordem)),
      respostas: respostas.map(({ questao, alternativa, sequencia }) => ({ questao, alternativa, sequencia })),
      enviadaEm: enviadaEm?.toISOString() ?? null,
      tempo: { limiteEm: limite?.toISOString() ?? null, agora: tentativa.agora.toISOString(), envio },
    })
  }

  /**
   * **Ler a prova não grava nada** (Tech Spec §4; U05-15): antes de o aluno começar, a resposta é só o título, a janela e a duração dele, sem questão nenhuma; quem cria a
   * tentativa é `comecar`. Depois de começar, a prova na ordem dele e o tempo. A janela não é conferida aqui: quem confere é `comecar`.
   */
  async prova(id: string): Promise<ProvaOnlineResponse> {
    return this.banco.transaction(async (tx) => {
      const atividades = new MinhaAtividadeRepository(tx)
      const prova = await atividades.prova(id)
      if (prova === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const tentativa = await atividades.tentativa(id)
      if (tentativa === undefined) {
        const percentual = prova.duracaoMin === null ? null : await atividades.percentualDoAluno(id)
        return provaOnlineResponseSchema.parse({
          comecou: false,
          atividadeAplicadaId: prova.id,
          titulo: prova.titulo,
          janela: janelaDaProva(prova.abreEm, prova.fechaEm),
          duracaoMin: prova.duracaoMin === null ? null : duracaoDoAlunoEmMinutos(prova.duracaoMin, percentual),
        })
      }
      const respostas = await atividades.respostas(id)
      return this.#emAndamento(prova, conteudoDeAtividadeSchema.parse(prova.conteudo), tentativa, respostas, await limiteDaTentativaDoAluno(tx, id, tentativa))
    })
  }

  /**
   * A ordem de apresentação de quem começa agora (RF8), sorteada aqui, uma vez: nula quando a aplicação não embaralha, e então o sorteador nem é chamado. Só depois do alcance (`prova`).
   * **O `undefined` de `embaralhar(id)` não acontece**: `prova(id, true)` acabou de achar a aplicação e a travou em `for share` na mesma transação, e `embaralhar` usa o mesmo alcance;
   * a guarda só estreita o tipo. Se um dia acontecesse, o erro sairia como falha interna (`InvariantException`), e não como `NAO_ENCONTRADO`: por isso ela não pode virar resposta ao aluno.
   */
  async #ordemDeQuemComeca(atividades: MinhaAtividadeRepository, id: string, totalDeQuestoes: number): Promise<OrdemDaProva | null> {
    const embaralhar = await atividades.embaralhar(id)
    if (embaralhar === undefined) throw new InvariantException('aplicação sem as opções de embaralhar')
    return sortearOrdem(totalDeQuestoes, embaralhar, this.sorteador)
  }

  /**
   * Começa a prova, ou devolve a que já começou (Tech Spec §5.2 e §5.3). **Alcance, depois janela, depois o limite**: quem não é da turma recebe `NAO_ENCONTRADO` mesmo fora da
   * janela, e só então a janela (`PROVA_FORA_DA_JANELA`) e o estado (`ATIVIDADE_ENCERRADA`). A aplicação fica travada em `for share` até o fim da transação: a mudança da janela
   * (`for update`) espera o começo terminar e então vê a tentativa (`PROVA_JA_COMECOU`). A tentativa é uma só e o limite base é o da primeira chamada (`on conflict do nothing`):
   * quem perde a corrida, o clique duplo e a retomada leem a gravada, **com a ordem de apresentação da primeira** (sorteada só aqui, só quando a aplicação embaralha; RF8). Quem já começou volta a ela mesmo depois de a janela fechar (a extensão, a queda e a retomada valem).
   */
  async comecar(id: string): Promise<ProvaOnlineResponse> {
    return this.banco.transaction(async (tx) => {
      const atividades = new MinhaAtividadeRepository(tx)
      const prova = await atividades.prova(id, true)
      if (prova === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      // O conteúdo é lido uma vez: conta as questões do sorteio e vira a prova em andamento.
      const conteudo = conteudoDeAtividadeSchema.parse(prova.conteudo)
      let tentativa = await atividades.tentativa(id)
      if (tentativa === undefined) {
        if (prova.abreEm !== null && prova.fechaEm !== null && (prova.agora.getTime() < prova.abreEm.getTime() || prova.agora.getTime() >= prova.fechaEm.getTime())) {
          throw new DomainException(ErrorCode.PROVA_FORA_DA_JANELA)
        }
        if (prova.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
        const percentual = prova.duracaoMin === null ? null : await atividades.percentualDoAluno(id)
        const ordem = await this.#ordemDeQuemComeca(atividades, id, conteudo.questoes.length)
        await atividades.comecar(id, limiteBaseDaTentativa({ agora: prova.agora, fechaEm: prova.fechaEm, duracaoMin: prova.duracaoMin, percentual }), ordem)
        tentativa = await atividades.tentativa(id)
      }
      if (tentativa === undefined) throw new InvariantException('tentativa não começada')
      const respostas = await atividades.respostas(id)
      return this.#emAndamento(prova, conteudo, tentativa, respostas, await limiteDaTentativaDoAluno(tx, id, tentativa))
    })
  }

  /**
   * O tempo da prova, para a tela relê-lo a cada 30 s (Tech Spec §4): o `limiteEm` dele, o `agora` do servidor e como foi enviada. Só de quem já começou; é leitura, sem trava. O
   * tempo da queda e a extensão do professor entram aqui assim que existem.
   */
  async tempo(id: string): Promise<TempoResponse> {
    return this.banco.transaction(async (tx) => {
      const atividades = new MinhaAtividadeRepository(tx)
      const atividade = await atividades.leitura(id)
      if (atividade === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const tentativa = await atividades.tentativa(id)
      if (tentativa === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const limite = await limiteDaTentativaDoAluno(tx, id, tentativa)
      return tempoResponseSchema.parse({ limiteEm: limite?.toISOString() ?? null, agora: tentativa.agora.toISOString(), envio: envioDaTentativa(tentativa, atividade.estado, limite).envio })
    })
  }

  /**
   * Grava a resposta **dentro do limite**: o `now()` do banco contra `limiteDaTentativa`, na transação do PUT, com a aplicação e a tentativa travadas. Além dele,
   * `TEMPO_ESGOTADO`, sem gravar nada, e o aluno vê por quê (RF5). Sem tentativa o aluno não começou, e a resposta é a do inexistente: a tentativa nasce só em `comecar`.
   */
  async responder(id: string, questao: number, { alternativa, sequencia }: ResponderQuestaoRequest): Promise<QuestaoSalvaResponse> {
    const salva = await this.banco.transaction(async (tx) => {
      const atividades = new MinhaAtividadeRepository(tx)
      const atividade = await atividades.lockParaGravar(id)
      if (atividade === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (atividade.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
      // A questão que a atividade não tem não existe.
      if (questao > atividade.questoes) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const tentativa = await atividades.tentativaTravada(id)
      if (tentativa === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (tentativa.enviadaEm !== null) throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
      if (venceu(await limiteDaTentativaDoAluno(tx, id, tentativa), tentativa.agora)) throw new DomainException(ErrorCode.TEMPO_ESGOTADO)
      return atividades.responder(id, questao, alternativa, sequencia)
    })
    return questaoSalvaResponseSchema.parse({ questao: salva.questao, alternativa: salva.alternativa, sequencia: salva.sequencia, respondidaEm: salva.respondidaEm.toISOString() })
  }

  /** Enviar é uma vez só: enviar de novo devolve o mesmo, com a primeira hora, mesmo depois do encerramento. Depois do limite, o envio do aluno é recusado como a resposta (`TEMPO_ESGOTADO`). */
  async send(id: string): Promise<AtividadeEnviadaResponse> {
    const enviada = await this.banco.transaction(async (tx) => {
      const atividades = new MinhaAtividadeRepository(tx)
      const atividade = await atividades.lockParaGravar(id)
      if (atividade === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      let tentativa = await atividades.tentativaTravada(id)
      if (tentativa === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (tentativa.enviadaEm === null) {
        if (atividade.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
        if (venceu(await limiteDaTentativaDoAluno(tx, id, tentativa), tentativa.agora)) throw new DomainException(ErrorCode.TEMPO_ESGOTADO)
        await atividades.send(id)
        tentativa = await atividades.tentativa(id)
      }
      const respostas = await atividades.respostas(id)
      return { enviadaEm: tentativa?.enviadaEm ?? null, respondidas: respostas.length, questoes: atividade.questoes }
    })
    if (enviada.enviadaEm === null) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return atividadeEnviadaResponseSchema.parse({ ...enviada, enviadaEm: enviada.enviadaEm.toISOString() })
  }

  /**
   * Conta uma saída da aba **numa prova em andamento** (D70; Tech Spec §5.8): alcance primeiro, e depois o estado. Prova que não é avaliativa, aplicação encerrada, tentativa que não existe, já
   * enviada ou **vencida** (o limite é o `limiteDaTentativa`, com a extensão e a queda) respondem o mesmo `NAO_ENCONTRADO`, sem gravar nada: a saída não confirma que a prova existe nem em que estado
   * está. A aplicação **não é travada**: a saída não disputa nada com a resposta, e a soma é do banco (`SaidaDaAbaRepository.registrar`). **Por isso há uma janela**: o `enviadaEm` e o limite são
   * lidos sem trava, e a saída que passou da leitura pode somar 1 depois de o `enviar` gravar. O efeito é de uma contagem a mais, de uma saída que aconteceu durante a prova, e nada mais muda (a
   * correção, os destaques e a aprovação não leem a contagem); a validação decide se isso se fecha.
   */
  async registrarSaida(id: string, chave: string): Promise<void> {
    await this.banco.transaction(async (tx) => {
      const atividades = new MinhaAtividadeRepository(tx)
      const atividade = await atividades.leitura(id)
      if (atividade === undefined || !atividade.avaliativa || atividade.estado !== 'aberta') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const tentativa = await atividades.tentativa(id)
      if (tentativa === undefined || tentativa.enviadaEm !== null) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (venceu(await limiteDaTentativaDoAluno(tx, id, tentativa), tentativa.agora)) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      await new SaidaDaAbaRepository(tx).registrar(id, chave)
    })
  }

  async meuDiagnostico(id: string): Promise<MeuDiagnosticoResponse> {
    const atividades = new MinhaAtividadeRepository(this.banco)
    const diagnostico = await atividades.diagnostico(id)
    // Sem lote aprovado, a resposta é a do inexistente: nada confirma que há correção esperando.
    if (diagnostico === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const { questoes } = conteudoDeAtividadeSchema.parse(diagnostico.conteudo)
    const marcadas = new Map((await atividades.respostas(id)).map((resposta) => [resposta.questao, resposta.alternativa]))
    const habilidades = habilidadesDaAtividade(questoes)
    return meuDiagnosticoResponseSchema.parse({
      atividadeAplicadaId: id,
      titulo: diagnostico.titulo,
      acertos: diagnostico.acertos,
      total: diagnostico.total,
      porHabilidade: diagnostico.porHabilidade.flatMap((parte) => {
        // `codigo: null` é a questão sem habilidade: a linha vai com `habilidade: null`, sem código nem descrição inventados.
        // Isso vale porque `habilidadesDaAtividade` (`lote.ts`) guarda a chave `null` apontando para `null`: sem ela, o `flatMap` perderia a linha.
        const habilidade = habilidades.get(parte.codigo)
        return habilidade === undefined ? [] : [{ habilidade, acertos: parte.acertos, total: parte.total }]
      }),
      questoes: questoes.map((questao, indice) => {
        const alternativa = marcadas.get(indice + 1) ?? null
        return { numero: indice + 1, alternativa, gabarito: questao.gabarito, correta: alternativa === questao.gabarito, explicacao: questao.explicacao, citacao: questao.citacao }
      }),
      aprovadoPor: diagnostico.nomeDeQuemAprovou === null ? null : { nome: diagnostico.nomeDeQuemAprovou },
      aprovadoEm: diagnostico.aprovadoEm.toISOString(),
    })
  }
}
