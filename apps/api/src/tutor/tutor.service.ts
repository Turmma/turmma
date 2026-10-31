import {
  diaDeUso,
  ehAssuntoDelicado,
  DomainException,
  LLMError,
  MODELO_DA_REGRA_FIXA,
  systemClock,
  requestSessao,
  turnoDoTutor,
  type Database,
  type TutorInput,
  type OrcamentoDeIa,
  type Clock,
  type TutorOutput,
  type SuspensaoDeFuncao,
  type DatabaseTransaction,
} from '@educa/core'
import {
  ErrorCode,
  citacaoSchema,
  conteudoDeAtividadeSchema,
  diagnosticoGravadoSchema,
  conversaDoTutorResponseSchema,
  memoriaDoTutorResponseSchema,
  MAXIMO_DE_ITENS_NA_MEMORIA,
  nomeDaSerie,
  type ConversaDoTutorQuery,
  type EstadoDoTutor,
  type Habilidade,
  type MensagemAoTutorRequest,
  type ConversaDoTutorResponse,
  type ExecucaoAceitaResponse,
  type MemoriaDoTutorResponse,
} from '@educa/shared'
import { z } from 'zod'
import { exigirCitacoesEntregues } from '../assistente/citacoes.js'
import type { LimiteDePedidosDeIa } from '../assistente/ai-request-rate-limit.js'
import type { AgendadorDeExecucoes } from '../ia/execucao.scheduler.js'
import { ConsumoRepository } from '../ia/consumo.repository.js'
import { ExecucaoDaSessaoRepository, ExecucaoRepository } from '../ia/execucao.repository.js'
import { OrcamentoRepository } from '../ia/orcamento.repository.js'
import type { BuscaDeTrechos, TrechoDoMaterial } from '../material/trecho-search.js'
import { sinaisDeTrabalhoDoTurno, TURNOS_QUE_A_REGRA_OLHA } from './sinais-do-turno.js'
import { TutorDoAlunoRepository, type AtividadeDaTurma, type MaterialDaTurma, type MensagemDaConversa, type PerguntaGravada, type ReferenciaDaPergunta, type TrabalhoDoAluno, type TurmaDoAluno } from './tutor.repository.js'

/** Quantos trechos do material acompanham a dúvida, e quantos turnos anteriores (os tetos de `tutorInputSchema`). */
export const TRECHOS_NO_TURNO = 6
export const TURNOS_ANTERIORES_NO_TURNO = 8
/** Quantas habilidades a memória leva à tarefa (o teto de `tutorInputSchema`), e quantas o aluno vê por atividade (o do contrato). */
export const HABILIDADES_NA_MEMORIA_DA_TAREFA = 12
const HABILIDADES_A_REFORCAR = 6
const TAMANHO_MAXIMO_DO_TURNO = 2000
const TAMANHO_MAXIMO_DO_CONTEXTO = 60
const FUNCAO_DO_TUTOR = 'tutor_com_o_aluno'
const FUNCAO_DOS_SINAIS = 'sinais_para_o_professor'

/** O que o `POST` conferiu antes de aceitar a pergunta: a turma do aluno e o que ele referenciou, já alcançado. */
interface Alcance {
  readonly turma: TurmaDoAluno
  readonly atividade?: AtividadeDaTurma
  readonly material?: MaterialDaTurma
}

type MemoriaDoTrabalho = TutorInput['memoria']
type QuestaoEmAndamento = NonNullable<TutorInput['questao']>

const listaEmPortugues = new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' })

/** As habilidades das questões de uma atividade, pelo código: é de onde sai a descrição que a correção não guarda. */
function habilidadesDaAtividade(conteudo: unknown): Map<string, Habilidade> {
  const lido = conteudoDeAtividadeSchema.safeParse(conteudo)
  return new Map(lido.success ? lido.data.questoes.map((questao) => [questao.habilidade.codigo, questao.habilidade]) : [])
}

/**
 * A questão em que o aluno está, **campo a campo**: número, enunciado, alternativas e habilidade. O gabarito e a
 * explicação ficam no artefato, com a atividade aberta ou encerrada: o Tutor não tem como entregar o que não recebeu
 * (`docs/aia/tutor.md`, N4). Nunca espalhe a questão do artefato aqui.
 */
export function questaoSemGabarito(conteudo: unknown, numero: number): QuestaoEmAndamento | undefined {
  const lido = conteudoDeAtividadeSchema.safeParse(conteudo)
  const questao = lido.success ? lido.data.questoes[numero - 1] : undefined
  if (questao === undefined) return undefined
  return { numero, enunciado: questao.enunciado, alternativas: [...questao.alternativas], habilidade: { codigo: questao.habilidade.codigo, descricao: questao.habilidade.descricao } }
}

/**
 * A memória que vai à tarefa (D66): acertos e erros **por habilidade**, somados dos lotes aprovados. Só número e
 * habilidade do catálogo. O trabalho sem lote aprovado chega aqui com `porHabilidade` nulo e não entra na soma.
 */
export function memoriaDoTrabalho(trabalhos: readonly TrabalhoDoAluno[]): MemoriaDoTrabalho {
  const soma = new Map<string, { habilidade: Habilidade; acertos: number; erros: number }>()
  for (const trabalho of trabalhos) {
    if (trabalho.porHabilidade === null) continue
    const habilidades = habilidadesDaAtividade(trabalho.conteudo)
    for (const item of diagnosticoGravadoSchema.parse(trabalho.porHabilidade)) {
      const habilidade = habilidades.get(item.codigo)
      if (habilidade === undefined) continue
      const atual = soma.get(item.codigo) ?? { habilidade, acertos: 0, erros: 0 }
      soma.set(item.codigo, { habilidade, acertos: atual.acertos + item.acertos, erros: atual.erros + (item.total - item.acertos) })
    }
  }
  return [...soma.values()].sort((a, b) => b.erros - a.erros || a.habilidade.codigo.localeCompare(b.habilidade.codigo)).slice(0, HABILIDADES_NA_MEMORIA_DA_TAREFA)
}

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
 *    conferência se repete em duas janelas: ao rodar (`entrada`, antes de trechos, memória e modelo) e ao concluir
 *    (`aoConcluir`, na transação que grava a resposta). A avaliação que abre depois do `202` faz a execução `falhar` com
 *    esse código: sem resposta, sem sinal e sem troca contada, com a pergunta só em `mensagem_tutor`. A exceção é a saída
 *    `assunto_delicado` do modelo, que grava a mensagem fixa e o sinal mesmo com a avaliação aberta (D36).
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
    private readonly agendador: AgendadorDeExecucoes,
    private readonly limite: LimiteDePedidosDeIa,
    private readonly trechos: BuscaDeTrechos,
    private readonly orcamento: OrcamentoDeIa,
    private readonly suspensao: SuspensaoDeFuncao,
    private readonly relogio: Clock = systemClock,
  ) {}

  /** `POST /v1/tutor/mensagens`: confere, grava a pergunta com a execução e responde o id dela. */
  async enviar(pedido: MensagemAoTutorRequest): Promise<ExecucaoAceitaResponse> {
    const alcance = await this.#alcance(pedido)
    const onde: ReferenciaDaPergunta = { atividadeAplicadaId: alcance.atividade?.id ?? null, questao: pedido.questao ?? null, materialId: alcance.material?.id ?? null, pagina: pedido.pagina ?? null }
    const { turmaId } = alcance.turma
    const { usuarioId: alunoId } = requestSessao()

    // O reenvio com a mesma chave devolve a mesma execução, mesmo que o freio tenha fechado ou a avaliação aberto depois.
    const jaAceita = await new ExecucaoDaSessaoRepository(this.banco).daChave(pedido.chaveEnvio)
    if (jaAceita !== undefined && jaAceita.tarefa !== turnoDoTutor.nome) throw new DomainException(ErrorCode.CONFLITO)

    // Antes de tudo, até da avaliação aberta: a trava existe para o Tutor não ajudar na prova, e a mensagem fixa não ajuda em prova nenhuma.
    if (ehAssuntoDelicado(pedido.texto)) return jaAceita === undefined ? this.#encaminhar(pedido, alcance) : { execucaoId: jaAceita.id }

    // Por aluno e por escola, nunca por IP: a turma inteira sai pelo mesmo endereço (regra 80, item 1). Depois do assunto
    // delicado, e não antes: às 10h, com seis turmas, o teto da escola se esgota, e o aluno que escreve sobre se machucar
    // receberia "espere um minuto" no lugar do 188 (D36). O encaminhamento não chama modelo, então não há o que proteger.
    await this.limite.contar()

    if (jaAceita === undefined && (await new TutorDoAlunoRepository(this.banco).avaliativaAberta(turmaId)) !== undefined) throw new DomainException(ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO)

    if (jaAceita === undefined) {
      // Sem a trava: recusa na hora quem já está no limite. A conta que vale é a de dentro da transação, abaixo.
      const decisao = await this.orcamento.consultar({ funcao: FUNCAO_DO_TUTOR, alunoId, turmaId })
      if (!decisao.permitido) throw new LLMError(decisao.codigo, decisao.tenteDeNovoEmSegundos)
    }

    // O que a execução leu antes de chamar o modelo, e que a conclusão usa: só existe depois de `entrada` rodar.
    let lido: { pergunta: PerguntaGravada; entregues: readonly TrechoDoMaterial[] } | undefined
    return this.agendador.agendar({
      tarefa: turnoDoTutor,
      chaveEnvio: pedido.chaveEnvio,
      // Só o nome da tarefa: o texto do aluno fica em `mensagem_tutor`, e o schema da entrada não tem onde guardá-lo.
      entradaDaExecucao: { tarefa: 'turno_do_tutor' },
      alunoId,
      turmaId,
      aoGravar: async (tx, execucaoId) => {
        const tutor = new TutorDoAlunoRepository(tx, this.relogio)
        await tutor.travarAluno()
        const decisao = await new OrcamentoRepository(tx, this.relogio).consultar({ funcao: FUNCAO_DO_TUTOR, alunoId, turmaId, execucaoId })
        // Recusar aqui desfaz a transação: nem a execução nem a pergunta ficam gravadas, e a troca não é contada.
        if (!decisao.permitido) throw new LLMError(decisao.codigo, decisao.tenteDeNovoEmSegundos)
        await tutor.gravarPergunta(execucaoId, turmaId, pedido.texto, onde)
      },
      entrada: async () => {
        const tutor = new TutorDoAlunoRepository(this.banco, this.relogio)
        // A pergunta gravada, e não a do corpo: no reenvio com a mesma chave, vale a que entrou na conversa.
        const pergunta = await tutor.perguntaDaChave(pedido.chaveEnvio)
        if (pergunta === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        // O alcance é conferido de novo na hora de rodar: quem saiu da turma depois do `202` não recebe resposta sobre ela.
        const agora = await this.#alcance({ ...(pergunta.atividadeAplicadaId === null ? {} : { atividadeAplicadaId: pergunta.atividadeAplicadaId }), ...(pergunta.materialId === null ? {} : { materialId: pergunta.materialId }) })
        if (agora.turma.turmaId !== pergunta.turmaId) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        // A avaliação que abriu entre o `202` e agora trava o turno antes de qualquer trabalho: sem trecho, sem memória e sem
        // chamar o modelo. A execução falha com o código da pausa, `trocas()` a ignora e a pergunta fica só em `mensagem_tutor`.
        if ((await tutor.avaliativaAberta(agora.turma.turmaId)) !== undefined) throw new DomainException(ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO)
        const questao = agora.atividade === undefined || pergunta.questao === null ? undefined : questaoSemGabarito(agora.atividade.conteudo, pergunta.questao)
        const entregues = await this.#trechosDoTurno(pergunta, agora, questao)
        const turnosAnteriores = (await tutor.turnosParaATarefa(pergunta, TURNOS_ANTERIORES_NO_TURNO)).reverse().map((turno) => ({ autor: turno.autor, texto: turno.texto.slice(0, TAMANHO_MAXIMO_DO_TURNO) }))
        lido = { pergunta, entregues }
        return {
          duvida: pergunta.texto,
          contexto: await this.#contexto(tutor, agora),
          trechos: entregues.map(({ materialId, pagina, texto }) => ({ materialId, pagina, texto })),
          ...(questao === undefined ? {} : { questao }),
          memoria: memoriaDoTrabalho(await tutor.trabalhos(MAXIMO_DE_ITENS_NA_MEMORIA)),
          turnosAnteriores,
        }
      },
      aoConcluir: async (saida, tx) => {
        if (lido === undefined) throw new LLMError('IA_ENTRADA_INVALIDA')
        // A avaliação que abriu enquanto o modelo respondia descarta a resposta e desfaz a transação: nada é gravado e a troca
        // não conta. A exceção é o encaminhamento da D36: a mensagem fixa e o sinal ficam mesmo com a avaliação aberta.
        // Sem trava: a conferência lê e grava em READ COMMITTED, e a avaliação que comita logo depois da leitura ainda deixa a
        // resposta passar. O resultado equivale à ordem serial "a resposta grava antes de a prova abrir": nenhuma transação lê o que a outra escreve.
        if (saida.classificacao !== 'assunto_delicado' && (await new TutorDoAlunoRepository(tx, this.relogio).avaliativaAberta(lido.pergunta.turmaId)) !== undefined) {
          throw new DomainException(ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO)
        }
        exigirCitacoesEntregues(saida.citacoes, lido.entregues)
        return { tipo: 'mensagem_do_tutor', mensagemId: await this.#gravarTurno(tx, lido.pergunta, saida) }
      },
    })
  }

  /**
   * O que o aluno referencia, conferido: a turma dele, a atividade aplicada a ela e o material que ela pode usar. Com
   * atividade e material juntos, o material precisa ser da disciplina da atividade. Fora do alcance, de outra escola,
   * de outro ano ou inexistente: `NAO_ENCONTRADO`, igual para todos (regra 10, item 6).
   */
  async #alcance(pedido: Pick<MensagemAoTutorRequest, 'atividadeAplicadaId' | 'questao' | 'materialId' | 'pagina'>): Promise<Alcance> {
    const tutor = new TutorDoAlunoRepository(this.banco, this.relogio)
    const naoEncontrado = (): never => {
      throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    }
    const turma = (await tutor.turmaDoAluno()) ?? naoEncontrado()
    const atividade = pedido.atividadeAplicadaId === undefined ? undefined : ((await tutor.atividadeDaTurma(turma.turmaId, pedido.atividadeAplicadaId.toLowerCase())) ?? naoEncontrado())
    const material = pedido.materialId === undefined ? undefined : ((await tutor.materialDaTurma(turma.turmaId, pedido.materialId.toLowerCase())) ?? naoEncontrado())
    if (atividade !== undefined && material !== undefined && material.disciplinaId !== atividade.disciplinaId) naoEncontrado()
    if (atividade !== undefined && pedido.questao !== undefined && questaoSemGabarito(atividade.conteudo, pedido.questao) === undefined) naoEncontrado()
    if (material !== undefined && pedido.pagina !== undefined && pedido.pagina > (material.paginas ?? 0)) naoEncontrado()
    return { turma, ...(atividade === undefined ? {} : { atividade }), ...(material === undefined ? {} : { material }) }
  }

  /** Série e disciplina como a tarefa as recebe: o nome que a escola deu, sem nome de turma nem de pessoa. */
  async #contexto(tutor: TutorDoAlunoRepository, alcance: Alcance): Promise<TutorInput['contexto']> {
    let disciplina = alcance.atividade?.disciplina ?? alcance.material?.disciplina
    // Sem atividade e sem material, o Tutor não sabe de que disciplina é a dúvida: recebe as da turma, e pergunta onde o aluno está.
    if (disciplina === undefined) {
      const daTurma = await tutor.disciplinasDaTurma(alcance.turma.turmaId)
      disciplina = daTurma.length === 0 ? 'estudo' : listaEmPortugues.format(daTurma)
    }
    return { serie: nomeDaSerie(alcance.turma.serie).slice(0, TAMANHO_MAXIMO_DO_CONTEXTO), disciplina: disciplina.slice(0, TAMANHO_MAXIMO_DO_CONTEXTO) }
  }

  /**
   * Os trechos do material para a dúvida: da disciplina da atividade ou do material, que o `#alcance` já conferiu que a
   * turma do aluno tem (a `BuscaDeTrechos` não confere quem pede). A busca leva a dúvida e o enunciado da questão, porque
   * "é a B, né?" sozinho não acha página nenhuma. Com a página que o aluno tem aberta, ela vem na frente. Sem atividade
   * e sem material não há disciplina, e não há trecho.
   */
  async #trechosDoTurno(pergunta: PerguntaGravada, alcance: Alcance, questao: QuestaoEmAndamento | undefined): Promise<TrechoDoMaterial[]> {
    const disciplinaId = alcance.atividade?.disciplinaId ?? alcance.material?.disciplinaId
    if (disciplinaId === undefined) return []
    const achados = await this.trechos.buscar({
      texto: `${pergunta.texto} ${questao?.enunciado ?? ''}`,
      disciplinaId,
      ...(alcance.material === undefined ? {} : { materialId: alcance.material.id }),
      limite: TRECHOS_NO_TURNO,
    })
    if (alcance.material === undefined || pergunta.pagina === null) return achados
    // A disciplina vai para a porta, que filtra no repository: o material de outra disciplina não devolve página nenhuma.
    const aberta = (await this.trechos.doMaterial(alcance.material.id, disciplinaId)).find((trecho) => trecho.pagina === pergunta.pagina)
    if (aberta === undefined) return achados
    return [aberta, ...achados.filter((trecho) => !(trecho.materialId === aberta.materialId && trecho.pagina === aberta.pagina))].slice(0, TRECHOS_NO_TURNO)
  }

  /**
   * Grava a resposta do Tutor e os sinais do turno, na transação que conclui a execução.
   *
   * - **Assunto delicado** (pelos gatilhos, ou pela classificação do modelo): a mensagem fixa, com `tipo =
   *   'assunto_delicado'`, e o sinal `atencao_humana`, **sem referência e sem conteúdo**. Esse sinal não depende de a
   *   função de sinais estar ativa: suspender os sinais de aprendizagem não cala o aviso de que um aluno precisa de um adulto.
   * - **`resposta_pronta`**: a classificação que a regra da tarefa decidiu, e só com questão em andamento.
   * - **`travou` e `duvida_repetida`**: a regra de `sinais-do-turno.ts`, sobre onde o aluno pediu ajuda.
   *
   * Nenhum sinal leva texto. Com `sinais_para_o_professor` suspensa, os três sinais de aprendizagem não nascem; o uso
   * do Tutor continua visível ao professor em `GET /v1/tutor/uso`, que não é sinal.
   */
  async #gravarTurno(tx: DatabaseTransaction, pergunta: PerguntaGravada, saida: TutorOutput): Promise<string> {
    const tutor = new TutorDoAlunoRepository(tx, this.relogio)
    const { execucaoId, turmaId } = pergunta
    if (saida.classificacao === 'assunto_delicado') {
      const mensagemId = await tutor.gravarResposta(pergunta, { tipo: 'assunto_delicado', texto: saida.resposta })
      await tutor.tirarReferenciaDaPergunta(pergunta.id)
      await tutor.gravarSinal(execucaoId, turmaId, { tipo: 'atencao_humana' })
      return mensagemId
    }
    const mensagemId = await tutor.gravarResposta(pergunta, { tipo: 'texto', texto: saida.resposta, citacoes: saida.citacoes })
    if (await this.suspensao.estaSuspensa(FUNCAO_DOS_SINAIS)) return mensagemId
    if (saida.classificacao === 'pediu_resposta_pronta' && pergunta.atividadeAplicadaId !== null && pergunta.questao !== null) {
      await tutor.gravarSinal(execucaoId, turmaId, { tipo: 'resposta_pronta', atividadeAplicadaId: pergunta.atividadeAplicadaId, questao: pergunta.questao })
    }
    // Sob a trava do aluno: duas respostas concluindo juntas não contam a mesma sequência duas vezes.
    await tutor.travarAluno()
    const atual = { atividadeAplicadaId: pergunta.atividadeAplicadaId, questao: pergunta.questao, materialId: pergunta.materialId, pagina: pergunta.pagina, dia: diaDeUso(pergunta.criadaEm) }
    for (const sinal of sinaisDeTrabalhoDoTurno(atual, await tutor.turnosRespondidos(pergunta.id, TURNOS_QUE_A_REGRA_OLHA))) await tutor.gravarSinal(execucaoId, turmaId, sinal)
    return mensagemId
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
    const { escolaId, usuarioId: alunoId } = requestSessao()
    const fixa = turnoDoTutor.semModelo?.({ duvida: pedido.texto, contexto: await this.#contexto(new TutorDoAlunoRepository(this.banco, this.relogio), alcance), trechos: [], memoria: [], turnosAnteriores: [] })
    if (fixa === undefined || fixa.classificacao !== 'assunto_delicado') throw new LLMError('IA_SAIDA_INVALIDA')
    const execucaoId = await this.banco.transaction(async (tx) => {
      const execucoes = new ExecucaoDaSessaoRepository(tx)
      const nova = await execucoes.gravarPendente(turnoDoTutor.nome, pedido.chaveEnvio, { tarefa: 'turno_do_tutor' })
      if (nova === undefined) {
        // A chave entrou entre a consulta e a gravação: se foi este aluno, é o reenvio; se não, é como se não existisse.
        const existente = await execucoes.daChave(pedido.chaveEnvio)
        if (existente === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        if (existente.tarefa !== turnoDoTutor.nome) throw new DomainException(ErrorCode.CONFLITO)
        return existente.id
      }
      const tutor = new TutorDoAlunoRepository(tx, this.relogio)
      const naConversa = { execucaoId: nova, turmaId: alcance.turma.turmaId, atividadeAplicadaId: alcance.atividade?.id ?? null }
      await tutor.gravarPergunta(nova, naConversa.turmaId, pedido.texto, { atividadeAplicadaId: naConversa.atividadeAplicadaId, questao: null, materialId: null, pagina: null })
      const mensagemId = await tutor.gravarResposta(naConversa, { tipo: 'assunto_delicado', texto: fixa.resposta })
      await tutor.gravarSinal(nova, naConversa.turmaId, { tipo: 'atencao_humana' })
      const execucao = { id: nova, escolaId, chave: pedido.chaveEnvio }
      const estados = new ExecucaoRepository(tx)
      if (!(await estados.marcarRodando(execucao)) || !(await estados.concluirRodando(execucao, { tipo: 'mensagem_do_tutor', mensagemId }))) throw new LLMError('IA_INDISPONIVEL')
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
    const alcance = await this.#alcance(atividadeAplicadaId === undefined ? {} : { atividadeAplicadaId })
    const { turmaId } = alcance.turma
    const linhas = await tutor.conversa(alcance.atividade?.id ?? null, antes?.toLowerCase(), limite + 1)
    const pagina = linhas.slice(0, limite)
    const anterior = linhas.length > limite ? pagina.at(-1)?.id : undefined
    const avaliacaoAberta = (await tutor.avaliativaAberta(turmaId)) ?? null
    const { usuarioId: alunoId } = requestSessao()
    let estado: EstadoDoTutor = 'ligado'
    if (avaliacaoAberta !== null) estado = 'avaliacao'
    else if (!(await this.orcamento.consultar({ funcao: FUNCAO_DO_TUTOR, alunoId, turmaId })).permitido) estado = 'limite'
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
