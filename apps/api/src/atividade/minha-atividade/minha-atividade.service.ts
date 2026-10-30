import { DomainException, type Database } from '@educa/nucleo'
import {
  ErrorCode,
  conteudoDeAtividadeSchema,
  atividadeEnviadaResponseSchema,
  meuDiagnosticoResponseSchema,
  minhasAtividadesResponseSchema,
  provaResponseSchema,
  questaoSalvaResponseSchema,
  questoesDaProva,
  type PaginationQuery,
  type ResponderQuestaoRequest,
  type AtividadeEnviadaResponse,
  type MeuDiagnosticoResponse,
  type MinhasAtividadesResponse,
  type ProvaResponse,
  type QuestaoSalvaResponse,
  type SituacaoDaMinhaAtividade,
} from '@educa/shared'
import { paginar } from '../../http/paginacao.js'
import { habilidadesDaAtividade } from '../correcao/lote.js'
import { MinhaAtividadeRepository, type MinhaAtividadeLida } from './minha-atividade.repository.js'

/** A situação da atividade para o aluno. `com_diagnostico` só com correção dele em lote aprovado; antes disso, nada diz como ele foi. */
function situacao(lida: MinhaAtividadeLida): SituacaoDaMinhaAtividade {
  if (lida.comDiagnostico) return 'com_diagnostico'
  if (lida.enviadaEm !== null) return 'enviada'
  if (lida.estado === 'encerrada') return 'encerrada'
  return lida.iniciadaEm === null ? 'para_fazer' : 'em_andamento'
}

/** A atividade na lista do aluno (DTO explícito; regra 20, item 4): sem acerto, sem gabarito, sem turma e sem colega. */
function paraATela(lida: MinhaAtividadeLida): unknown {
  return {
    id: lida.id,
    titulo: lida.titulo,
    disciplina: { id: lida.disciplinaId, nome: lida.disciplinaNome },
    avaliativa: lida.avaliativa,
    situacao: situacao(lida),
    questoes: lida.questoes,
    respondidas: lida.respondidas,
    aplicadaEm: lida.aplicadaEm.toISOString(),
    enviadaEm: lida.enviadaEm?.toISOString() ?? null,
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
  constructor(private readonly banco: Database) {}

  async listar(consulta: PaginationQuery): Promise<MinhasAtividadesResponse> {
    const linhas = await new MinhaAtividadeRepository(this.banco).listar(consulta)
    const { itens, proxima } = paginar(linhas, consulta.limite)
    return minhasAtividadesResponseSchema.parse({ itens: itens.map(paraATela), ...(proxima === undefined ? {} : { proxima }) })
  }

  /** Abrir a prova cria a tentativa do aluno, uma só, enquanto a atividade está aberta. Na encerrada, quem não abriu continua sem tentativa. */
  async prova(id: string): Promise<ProvaResponse> {
    const aberta = await this.banco.transaction(async (tx) => {
      const atividades = new MinhaAtividadeRepository(tx)
      const prova = await atividades.prova(id, true)
      if (prova === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const tentativa = prova.estado === 'aberta' ? await atividades.abrirTentativa(id) : await atividades.tentativa(id)
      const respostas = tentativa === undefined ? [] : await atividades.respostas(id)
      return { prova, tentativa, respostas }
    })
    const conteudo = conteudoDeAtividadeSchema.parse(aberta.prova.conteudo)
    return provaResponseSchema.parse({
      atividadeAplicadaId: aberta.prova.id,
      titulo: aberta.prova.titulo,
      avaliativa: aberta.prova.avaliativa,
      estado: aberta.prova.estado,
      // Só os tipos da adaptação, que valem para a turma inteira: nada sobre aluno (D35).
      adaptacao: conteudo.adaptacao ?? null,
      questoes: questoesDaProva(conteudo),
      respostas: aberta.respostas.map(({ questao, alternativa, sequencia }) => ({ questao, alternativa, sequencia })),
      enviadaEm: aberta.tentativa?.enviadaEm?.toISOString() ?? null,
    })
  }

  async responder(id: string, questao: number, { alternativa, sequencia }: ResponderQuestaoRequest): Promise<QuestaoSalvaResponse> {
    const salva = await this.banco.transaction(async (tx) => {
      const atividades = new MinhaAtividadeRepository(tx)
      const atividade = await atividades.travarParaGravar(id)
      if (atividade === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (atividade.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
      // A questão que a atividade não tem não existe.
      if (questao > atividade.questoes) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const tentativa = await atividades.abrirTentativa(id)
      if (tentativa.enviadaEm !== null) throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
      return atividades.responder(id, questao, alternativa, sequencia)
    })
    return questaoSalvaResponseSchema.parse({ questao: salva.questao, alternativa: salva.alternativa, sequencia: salva.sequencia, respondidaEm: salva.respondidaEm.toISOString() })
  }

  /** Enviar é uma vez só: enviar de novo devolve o mesmo, com a primeira hora, mesmo depois do encerramento. */
  async enviar(id: string): Promise<AtividadeEnviadaResponse> {
    const enviada = await this.banco.transaction(async (tx) => {
      const atividades = new MinhaAtividadeRepository(tx)
      const atividade = await atividades.travarParaGravar(id)
      if (atividade === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      let tentativa = await atividades.tentativa(id)
      if (tentativa === undefined || tentativa.enviadaEm === null) {
        if (atividade.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
        await atividades.abrirTentativa(id)
        await atividades.enviar(id)
        tentativa = await atividades.tentativa(id)
      }
      const respostas = await atividades.respostas(id)
      return { enviadaEm: tentativa?.enviadaEm ?? null, respondidas: respostas.length, questoes: atividade.questoes }
    })
    if (enviada.enviadaEm === null) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return atividadeEnviadaResponseSchema.parse({ ...enviada, enviadaEm: enviada.enviadaEm.toISOString() })
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
