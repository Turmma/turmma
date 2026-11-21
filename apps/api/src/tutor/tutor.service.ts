import {
  isAssuntoDelicado,
  DomainException,
  LLMError,
  MODELO_DA_REGRA_FIXA,
  systemClock,
  requestSessao,
  turnoDoTutor,
  type Database,
  type OrcamentoDeIa,
  type Clock,
} from '@educa/core'
import {
  ErrorCode,
  citacaoSchema,
  conversaDoTutorResponseSchema,
  memoriaDoTutorResponseSchema,
  MAXIMO_DE_ITENS_NA_MEMORIA,
  type ConversaDoTutorQuery,
  type EstadoDoTutor,
  type MensagemAoTutorRequest,
  type ConversaDoTutorResponse,
  type ExecucaoAceitaResponse,
  type MemoriaDoTutorResponse,
} from '@educa/shared'
import { z } from 'zod'
import type { IaRequestRateLimit } from '../assistente/ai-request-rate-limit.js'
import type { ExecucaoScheduler } from '../ia/execucao.scheduler.js'
import { ConsumoRepository } from '../ia/consumo.repository.js'
import { ExecucaoDaSessaoRepository, ExecucaoRepository } from '../ia/execucao.repository.js'
import { OrcamentoRepository } from '../ia/orcamento.repository.js'
import { memoriaDoTrabalho, type Alcance, type AlcanceDoAluno } from './turno.command.js'
import { TutorDoAlunoRepository, type MensagemDaConversa, type ReferenciaDaPergunta } from './tutor.repository.js'

/** Quantas habilidades o aluno vê por atividade (o teto do contrato). */
const HABILIDADES_A_REFORCAR = 6
const FUNCAO_DO_TUTOR = 'tutor_com_o_aluno'

function paraATela(mensagem: MensagemDaConversa): unknown {
  const comum = { id: mensagem.id, criadaEm: mensagem.criadaEm.toISOString(), autor: mensagem.autor, texto: mensagem.texto }
  if (mensagem.autor === 'aluno') return { ...comum, tipo: 'texto' }
  // A mensagem fixa de assunto delicado não tem citação: a tela a mostra com o botão de avisar um adulto.
  if (mensagem.tipo === 'assunto_delicado') return { ...comum, tipo: 'assunto_delicado' }
  // As citações gravadas são validadas de novo na leitura (regra 30, item 7).
  return { ...comum, tipo: 'texto', citacoes: z.array(citacaoSchema).parse(mensagem.citacoes ?? []) }
}

/**
 * O Tutor do aluno (MVP, A4; D8, D36, D38, D47, D58, D66; regra 70, itens 3, 4, 4a, 4b e 4d).
 *
 * A resposta do Tutor é a única saída de IA que chega ao aluno sem aprovação prévia: é **supervisionada** (D47). Por
 * isso tudo que limita o Tutor é conferido aqui, no servidor, antes de a pergunta ser aceita, **nesta ordem** (a do item 3 se
 * repete depois do `202`, ao rodar e ao concluir):
 *
 * 1. **O aluno alcança o que referencia.** A atividade aplicada é da turma dele; o material é da escola, `pronto`, não
 *    excluído e de disciplina que a turma tem. O que não alcança responde como o inexistente.
 * 2. **Assunto pessoal delicado recebe a mensagem fixa** (D36), com o 188 em risco à vida, **antes de tudo o mais**: a
 *    avaliação aberta, o limite do dia, o pacote esgotado e a função suspensa não tiram do aluno o encaminhamento. A
 *    mensagem fixa não ajuda em prova nenhuma. Esse turno não chama modelo, não espera fila, e o professor recebe o
 *    sinal sem o conteúdo.
 * 3. **Atividade avaliativa aberta trava o Tutor** para a turma (`TUTOR_PAUSADO_EM_AVALIACAO`; regra 30, item 10). A
 *    conferência se repete em duas janelas, as do comando (`turno.command.ts`): ao rodar (`preparar`, antes de trechos,
 *    memória e modelo) e ao concluir (`concluir`, na transação que grava a resposta). A avaliação que abre depois do `202`
 *    faz a execução `falhar` com esse código: sem resposta, sem sinal e sem troca contada, com a pergunta só em
 *    `mensagem_tutor`. A exceção é a saída `assunto_delicado` do modelo, que grava a mensagem fixa e o sinal mesmo com a
 *    avaliação aberta, em transação própria (D36).
 * 4. **O freio do dia do aluno e o pacote do mês da turma** (D38), contados sob a trava do aluno, na mesma transação
 *    que grava a pergunta: dez envios ao mesmo tempo não passam do limite. A pergunta que o modelo não respondeu não
 *    conta.
 * 5. **Função suspensa pela escola** (`FUNCAO_SUSPENSA`; D60).
 *
 * **O texto do aluno mora só em `mensagem_tutor`.** Não vai para sinal, `execucao_agente.entrada`, `consumo_ia`,
 * auditoria nem log (regra 20, itens 9 e 14). **Nenhum nome vai ao modelo**: a entrada da tarefa é estrita e não tem
 * campo de pessoa (regra 20, item 12).
 *
 * **Nada aqui começa conversa, conta sequência de dias ou recompensa uso** (D59): o Tutor só responde ao que o aluno
 * mandou.
 */
export class TutorService {
  constructor(
    private readonly banco: Database,
    private readonly agendador: ExecucaoScheduler,
    private readonly limite: IaRequestRateLimit,
    private readonly orcamento: OrcamentoDeIa,
    private readonly alcanceDoAluno: AlcanceDoAluno,
    private readonly relogio: Clock = systemClock,
  ) {}

  /** `POST /v1/tutor/mensagens`: confere, grava a pergunta com a execução e responde o id dela. */
  async send(pedido: MensagemAoTutorRequest): Promise<ExecucaoAceitaResponse> {
    // A turma e a atividade primeiro: o material aberto só se confere depois da D36, para a mensagem fixa nunca depender dele.
    const daTurma = await this.alcanceDoAluno.alcance(pedido)
    const { turmaId } = daTurma.turma
    const { usuarioId: alunoId } = requestSessao()

    // O reenvio com a mesma chave devolve a mesma execução, mesmo que o freio tenha fechado ou a avaliação aberto depois.
    const jaAceita = await new ExecucaoDaSessaoRepository(this.banco).daChave(pedido.chaveEnvio)
    if (jaAceita !== undefined && jaAceita.tarefa !== turnoDoTutor.nome) throw new DomainException(ErrorCode.CONFLITO)

    // Antes de tudo, até da avaliação aberta: a trava existe para o Tutor não ajudar na prova, e a mensagem fixa não ajuda em prova nenhuma.
    if (isAssuntoDelicado(pedido.texto)) return jaAceita === undefined ? this.#encaminhar(pedido, daTurma) : { execucaoId: jaAceita.id }

    // Só depois da D36: o material aberto que saiu do alcance (edição substituída, licença vencida) responde como o inexistente, e a turma sem material da série é recusada, sem nada na conversa.
    // No reenvio da chave já aceita, não: o pedido existe, e o material que saiu do alcance depois do `202` falha a execução (o `preparar` do comando), não a resposta do reenvio.
    // O ramo do reenvio não pode passar a devolver nada do material do corpo (só o `execucaoId` que já era desta pessoa), para não virar oráculo do que existe; e o `onde` abaixo só vale para a execução nova, porque o `aoGravar` não roda no reenvio.
    const alcance = jaAceita === undefined ? await this.alcanceDoAluno.doMaterial(daTurma, pedido) : daTurma
    const onde: ReferenciaDaPergunta = { atividadeAplicadaId: alcance.atividade?.id ?? null, questao: pedido.questao ?? null, materialId: alcance.material?.id ?? null, pagina: pedido.pagina ?? null }

    // Por aluno e por escola, nunca por IP: a turma inteira sai pelo mesmo endereço (regra 80, item 1). Depois do assunto
    // delicado, e não antes: às 10h, com seis turmas, o teto da escola se esgota, e o aluno que escreve sobre se machucar
    // receberia "espere um minuto" no lugar do 188 (D36). O encaminhamento não chama modelo, então não há o que proteger.
    await this.limite.count()

    if (jaAceita === undefined && (await new TutorDoAlunoRepository(this.banco).avaliativaAberta(turmaId)) !== undefined) throw new DomainException(ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO)

    if (jaAceita === undefined) {
      // Sem a trava: recusa na hora quem já está no limite. A conta que vale é a de dentro da transação, abaixo.
      const decisao = await this.orcamento.check({ funcao: FUNCAO_DO_TUTOR, alunoId, turmaId })
      if (!decisao.permitido) throw new LLMError(decisao.codigo, decisao.tenteDeNovoEmSegundos)
    }

    return this.agendador.agendar({
      comando: turnoDoTutor.nome,
      chaveEnvio: pedido.chaveEnvio,
      // Só o nome da tarefa: o texto do aluno fica em `mensagem_tutor`, e o schema da entrada não tem onde guardá-lo.
      entradaDaExecucao: { tarefa: 'turno_do_tutor' },
      // Na requisição, na transação do `pendente`: o freio do dia, o pacote do mês e a pergunta do aluno. O resto é do comando.
      aoGravar: async (tx, execucaoId) => {
        const tutor = new TutorDoAlunoRepository(tx, this.relogio)
        await tutor.lockAluno()
        const decisao = await new OrcamentoRepository(tx, this.relogio).check({ funcao: FUNCAO_DO_TUTOR, alunoId, turmaId, execucaoId })
        // Recusar aqui desfaz a transação: nem a execução nem a pergunta ficam gravadas, e a troca não é contada.
        if (!decisao.permitido) throw new LLMError(decisao.codigo, decisao.tenteDeNovoEmSegundos)
        await tutor.savePergunta(execucaoId, turmaId, pedido.texto, onde)
      },
    })
  }

  /**
   * O turno de assunto delicado (D36), inteiro numa transação e sem fila: a pergunta, a mensagem fixa, o sinal
   * `atencao_humana` e a execução já `concluida`. Não passa pela trava da avaliação, pelo freio, pelo pacote
   * nem pela suspensão, e não chama modelo: quem decide o texto é a regra da tarefa (`semModelo`), com o 188 na frente quando há menção a risco à vida.
   *
   * A pergunta fica na conversa em que foi feita, **sem a questão, o material e a página**: não é referência a
   * trabalho. O consumo registra só a medição, como regra fixa, sem entrada nem saída.
   */
  async #encaminhar(pedido: MensagemAoTutorRequest, alcance: Alcance): Promise<ExecucaoAceitaResponse> {
    const inicio = performance.now()
    const { usuarioId: alunoId } = requestSessao()
    const fixa = turnoDoTutor.semModelo?.({ duvida: pedido.texto, contexto: await this.alcanceDoAluno.contexto(alcance), trechos: [], memoria: [], turnosAnteriores: [] })
    if (fixa === undefined || fixa.classificacao !== 'assunto_delicado') throw new LLMError('IA_SAIDA_INVALIDA')
    const execucaoId = await this.banco.transaction(async (tx) => {
      const execucoes = new ExecucaoDaSessaoRepository(tx)
      const nova = await execucoes.savePendente(turnoDoTutor.nome, pedido.chaveEnvio, { tarefa: 'turno_do_tutor' })
      if (nova === undefined) {
        // A chave entrou entre a consulta e a gravação: se foi este aluno, é o reenvio; se não, é como se não existisse.
        const existente = await execucoes.daChave(pedido.chaveEnvio)
        if (existente === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        if (existente.tarefa !== turnoDoTutor.nome) throw new DomainException(ErrorCode.CONFLITO)
        return existente.id
      }
      const tutor = new TutorDoAlunoRepository(tx, this.relogio)
      const naConversa = { execucaoId: nova, turmaId: alcance.turma.turmaId, atividadeAplicadaId: alcance.atividade?.id ?? null }
      await tutor.savePergunta(nova, naConversa.turmaId, pedido.texto, { atividadeAplicadaId: naConversa.atividadeAplicadaId, questao: null, materialId: null, pagina: null })
      const mensagemId = await tutor.saveResposta(naConversa, { tipo: 'assunto_delicado', texto: fixa.resposta })
      await tutor.saveSinal(nova, naConversa.turmaId, { tipo: 'atencao_humana' })
      const estados = new ExecucaoRepository(tx)
      if (!(await estados.marcarRodando(nova)) || !(await estados.concluirRodando(nova, { tipo: 'mensagem_do_tutor', mensagemId }))) throw new LLMError('IA_INDISPONIVEL')
      await new ConsumoRepository(tx).registrar({
        alunoId,
        execucaoId: nova,
        tarefa: turnoDoTutor.nome,
        funcao: turnoDoTutor.funcao,
        perfil: turnoDoTutor.perfil,
        origem: 'regra_fixa',
        modelo: MODELO_DA_REGRA_FIXA,
        promptVersao: turnoDoTutor.prompt.versao,
        tokensDeEntrada: 0,
        tokensDeSaida: 0,
        custoMicros: 0,
        duracaoMs: Math.round(performance.now() - inicio),
        envioExterno: false,
        provedorId: null,
        tentativas: 0,
        estado: 'concluida',
        em: this.relogio.agora(),
      })
      return nova
    })
    return { execucaoId }
  }

  /**
   * `GET /v1/tutor/conversa`: o estado do Tutor para este aluno agora, quanto do freio do dia ele já usou e uma página da
   * conversa dele, da mais antiga para a mais nova. Só a do próprio aluno: escola, ano e aluno vêm da sessão.
   *
   * O estado é decidido aqui, com as mesmas consultas do `POST`: `avaliacao` com atividade avaliativa aberta na turma;
   * `limite` com o freio do dia ou o pacote do mês atingido; senão, `ligado`. Nesta fatia não há política de Tutor por
   * turma (D19), e por isso `fora` não é devolvido.
   */
  async conversa({ atividadeAplicadaId, antes, limite }: ConversaDoTutorQuery): Promise<ConversaDoTutorResponse> {
    const tutor = new TutorDoAlunoRepository(this.banco, this.relogio)
    const alcance = await this.alcanceDoAluno.alcance(atividadeAplicadaId === undefined ? {} : { atividadeAplicadaId })
    const { turmaId } = alcance.turma
    const linhas = await tutor.conversa(alcance.atividade?.id ?? null, antes?.toLowerCase(), limite + 1)
    const pagina = linhas.slice(0, limite)
    const anterior = linhas.length > limite ? pagina.at(-1)?.id : undefined
    const avaliacaoAberta = (await tutor.avaliativaAberta(turmaId)) ?? null
    const { usuarioId: alunoId } = requestSessao()
    let estado: EstadoDoTutor = 'ligado'
    if (avaliacaoAberta !== null) estado = 'avaliacao'
    else if (!(await this.orcamento.check({ funcao: FUNCAO_DO_TUTOR, alunoId, turmaId })).permitido) estado = 'limite'
    return conversaDoTutorResponseSchema.parse({ estado, uso: await tutor.usoDeHoje(), avaliacaoAberta, mensagens: pagina.reverse().map(paraATela), ...(anterior === undefined ? {} : { anterior }) })
  }

  /**
   * `GET /v1/tutor/memoria`: o que o Tutor sabe do **trabalho** do aluno, para ele ver (D66; `docs/aia/tutor.md`, N14).
   * É a mesma leitura que alimenta a tarefa: as atividades que ele abriu, com o resultado **só de lote aprovado**, e os
   * sinais de trabalho (em que atividade e questão ele travou, pediu a resposta ou voltou). O `atencao_humana` não é
   * memória e não aparece. Não há texto sobre o aluno em campo nenhum.
   */
  async memoria(): Promise<MemoriaDoTutorResponse> {
    const tutor = new TutorDoAlunoRepository(this.banco, this.relogio)
    if ((await tutor.turmaDoAluno()) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const trabalhos = (await tutor.trabalhos(MAXIMO_DE_ITENS_NA_MEMORIA)).map((trabalho) => ({
      atividadeAplicadaId: trabalho.atividadeAplicadaId,
      titulo: trabalho.titulo,
      enviadaEm: trabalho.enviadaEm?.toISOString() ?? null,
      resultado:
        trabalho.acertos === null || trabalho.total === null
          ? null
          : {
              acertos: trabalho.acertos,
              total: trabalho.total,
              aReforcar: memoriaDoTrabalho([trabalho])
                .filter((item) => item.erros > 0)
                .slice(0, HABILIDADES_A_REFORCAR)
                .map((item) => item.habilidade),
            },
    }))
    const sinais = (await tutor.sinaisDeTrabalho(MAXIMO_DE_ITENS_NA_MEMORIA)).map((sinal) => ({ tipo: sinal.tipo, atividadeAplicadaId: sinal.atividadeAplicadaId, questao: sinal.questao, criadoEm: sinal.criadoEm.toISOString() }))
    return memoriaDoTutorResponseSchema.parse({ trabalhos, sinais })
  }
}
