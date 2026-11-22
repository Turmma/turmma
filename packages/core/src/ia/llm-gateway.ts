import type { Counter, Histogram, Meter } from '@opentelemetry/api'
import { TAREFAS_DE_IA, type ChaveDeFuncao, type TarefaDeIa } from '@educa/shared'
import type { LLMConfig, ReservaConfig } from '../config/llm-config.js'
import { InvalidConfigError } from '../config/validate-config.js'
import { currentContext } from '../context/context.js'
import { summarizeError } from '../error/summarize-error.js'
import type { LoggerBase } from '../log/logger.js'
import { METRICS } from '../telemetry/metrics.js'
import { systemClock, type Clock } from '../clock.js'
import type { ModelAdapter, ModelCall, ModelResponse, RepairHint } from './adapter.js'
import { FakeAdapter, type FakeAdapterOptions } from './fake-adapter.js'
import { OpenAICompatAdapter } from './openai-compat-adapter.js'
import { ResilientAdapter } from './resilient-adapter.js'
import { chaveDoPreco, custoDaChamada, precoDoModelo, type ConsumoDeIa, type DestinoDoAdaptador, type OrcamentoDeIa, type RegistroDeConsumo, type TabelaDePrecos } from './consumo.js'
import { LLMError, type LLMErrorCode } from './errors.js'
import { semMarcacao } from './clean-output.js'
import { SEM_ENVIO_EXTERNO, type DeclaracaoDeSoberania, type LLMProvider, type GenerationMeasurement, type GenerationRequest, type GenerationResult } from './port.js'
import { exigirFuncaoAtiva, type SuspensaoDeFuncao } from './suspensao.js'
import type { TaskDefinition } from './task.js'
import { tokensDoPedido } from './teto-de-entrada.js'
import { PERFIS, type Perfil } from './perfis.js'
import type { LimiteDeTokens, ReservaDeTokens } from './token-limiter.js'

/** O que o provedor escreve no log: evento fixo, ids, duração. Nunca entrada, saída nem prompt (regra 20, item 9). */
export type LLMLogger = Pick<LoggerBase, 'info' | 'warn'>

export interface LLMGatewayDependencies {
  readonly adaptador: ModelAdapter
  readonly registro: RegistroDeConsumo
  readonly orcamento: OrcamentoDeIa
  readonly suspensao: SuspensaoDeFuncao
  /**
   * A subida conferiu a D62 desta instância (`SoberaniaNaSubida`)? Lida a cada chamada. Com adaptador que manda o conteúdo para fora, a tarefa
   * que leva texto de aluno só sai se `conferida`; **sem ela, vale não conferida** (falha fechada). O adaptador falso e o local não mandam nada
   * para fora e não precisam dela.
   */
  readonly soberania?: DeclaracaoDeSoberania
  readonly logger?: LLMLogger
  readonly relogio?: Clock
  /** Onde as métricas do gateway são contadas (`ia.pedido_acima_do_teto`, as da chamada, a da degradação e a do uso do teto). Sem ele tudo vale do mesmo jeito, só sem a métrica. */
  readonly medidor?: Meter
  /**
   * O limite de tokens por minuto (49.0): reserva antes de cada chamada ao modelo. Sem ele (o `local` sem `LLM_TOKENS_POR_MINUTO`, a ferramenta de medição) a chamada não espera
   * nem desce de degrau.
   */
  readonly limiteDeTokens?: LimiteDeTokens
  /**
   * O limitador **da reserva** (F5b, 2.0): o `TokenLimiter` dela, com o contratado dela (`LLM_RESERVA_TOKENS_POR_MINUTO`) e os mesmos baldes por fila. Entregue ao gateway; quem o lê é o ramo sem vaga (7.0).
   * Sem ele (reserva sem contratado, só no `local`, ou sem reserva) a reserva não tem balde.
   */
  readonly limiteDeTokensDaReserva?: LimiteDeTokens
  /** A conferência da D62 **da reserva** (F5b, 2.0): a porta de `reservaElegivel`. Ausente vale não conferida, e a reserva não é elegível. Quem a lê é o roteamento (4.0). */
  readonly soberaniaDaReserva?: DeclaracaoDeSoberania
  /** O modelo menor de cada perfil que tem o seu (`LLM_MODELO_MENOR_<PERFIL>`): o degrau depois da espera. O turno do Tutor nunca o usa. */
  readonly modelosMenores?: Readonly<Partial<Record<Perfil, string>>>
  /** O preço de cada modelo (`provedor:modelo`, com as vigências). Sem ele vale `PRECO_DOS_MODELOS`; o teste injeta a tabela com os preços que prova. */
  readonly precos?: TabelaDePrecos
}

/** Quanto o pedido espera pela vaga de tokens antes de descer um degrau: o "Pensando" que o aluno aguenta (`aluno/Tutor.tsx`), dentro do prazo único da execução (RF7). */
export const ESPERA_MAXIMA_DA_VAGA_MS = 8_000
/** O piso de cada espera entre duas tentativas de reservar: o balde que libera em 1 ms não vira laço apertado contra o Redis. */
const ESPERA_MINIMA_ENTRE_RESERVAS_MS = 50
/** Quanto a última reserva vale como "uso do teto": depois de um minuto sem reservar, o balde esvaziou e a métrica volta a 0. */
const VALIDADE_DO_USO_DO_TETO_MS = 60_000
/** Os degraus da degradação, nesta ordem (`ia.degradacao{degrau}`). */
const DEGRAUS = ['espera', 'modelo_menor', 'indisponivel'] as const
type Degrau = (typeof DEGRAUS)[number]

/**
 * O turno do Tutor nunca vai ao modelo menor (D36, regra 30, item 11): liberar pede a medida de risco à vida e a suíte de recusa de `docs/avaliacao-de-modelos.md`, e uma decisão
 * registrada. Sem vaga, ele termina `IA_INDISPONIVEL`, e quem responde é a regra fixa da D36 quando ela se aplica.
 *
 * A classificação do material também não desce a modelo menor **sem medida** (classificacao-bncc, Tech Spec §5, "Degradação do lote"): a taxa mínima de `docs/aia/diagnostico-por-habilidade.md` é
 * medida no modelo do perfil, e o menor não a atingiu em lugar nenhum. Sem vaga, o lote espera: a execução volta a `pendente` e o job é adiado.
 */
const TAREFAS_SEM_MODELO_MENOR: ReadonlySet<TarefaDeIa> = new Set<TarefaDeIa>(['turno_do_tutor', 'classificar_secoes'])

export const MOTIVO_MODELO_MENOR_SEM_PRECO =
  'LLM_MODELO_MENOR_<PERFIL> precisa de preço em PRECO_DOS_MODELOS (packages/core/src/ia/consumo.ts): sem preço o degrau do gateway gastaria sem a conta da D14, e o modelo real só entra com a D37'
export const MOTIVO_MODELO_DA_RESERVA_SEM_PRECO =
  'LLM_RESERVA_MODELO e LLM_RESERVA_MODELO_<PERFIL> precisam de preço em PRECO_DOS_MODELOS (packages/core/src/ia/consumo.ts, chave identidade:modelo) fora de AMBIENTE=local: sem preço a chamada da reserva gravaria custo zero e o orçamento de IA subestimaria o gasto (D14)'
export const MOTIVO_MODELO_SEM_PRECO =
  'LLM_MODELO e LLM_MODELO_<PERFIL> precisam de preço em PRECO_DOS_MODELOS (packages/core/src/ia/consumo.ts, chave provedor:modelo) fora de AMBIENTE=local: sem preço a chamada gravaria custo zero e o orçamento de IA subestimaria o gasto (D14)'

/** A espera entre duas reservas, cortada pelo sinal de quem chamou (o prazo único da execução, ou o desligamento): o prazo que vence na espera a encerra na hora. */
function wait(ms: number, sinal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    if (sinal?.aborted === true) {
      rejeitar(new LLMError('IA_TEMPO_ESGOTADO'))
      return
    }
    const cancelar = (): void => {
      clearTimeout(temporizador)
      rejeitar(new LLMError('IA_TEMPO_ESGOTADO'))
    }
    const temporizador = setTimeout(() => {
      sinal?.removeEventListener('abort', cancelar)
      resolver()
    }, ms)
    sinal?.addEventListener('abort', cancelar, { once: true })
  })
}

/** A chamada ao adaptador: a correção só existe na repetição, e o modelo só quando o degrau trocou o do perfil. */
function chamadaAoModelo<Entrada, Saida>(base: Pick<ModelCall<Entrada, Saida>, 'tarefa' | 'entrada' | 'sinal'>, correcao: RepairHint | undefined, modelo: string | undefined): ModelCall<Entrada, Saida> {
  return { ...base, ...(correcao === undefined ? {} : { correcao }), ...(modelo === undefined ? {} : { modelo }) }
}

/** As medidas do gateway, criadas na subida (o medidor pode faltar: sem ele tudo vale do mesmo jeito, só sem a métrica). Cada série nasce em zero: o `increase()` do alerta não conta o primeiro ponto de uma série nova. */
interface Medidas {
  readonly pedidosAcimaDoTeto?: Counter
  readonly degradacao?: Counter
  readonly duracaoDaChamada?: Histogram
  readonly errosDaChamada?: Counter
}

/**
 * A hora do processo, a que o `setTimeout` obedece: a espera pela vaga e a validade do uso do teto medem **tempo decorrido**, e por isso leem o mesmo relógio dos temporizadores
 * (e o `vi.useFakeTimers` dos testes, que falsifica os dois juntos). O `relogio` injetado (`Clock`) é o do **dia de negócio** (o freio diário, o mês do orçamento, o `em` do consumo): um
 * teste o fixa numa data, e a espera, que depende de o relógio andar, ficaria parada nele.
 */
const horaDoProcessoMs = (): number => Date.now()

function createMedidas(medidor: Meter | undefined, usosDoTeto: ReadonlyMap<string, { readonly valor: number; readonly em: number }>): Medidas {
  if (medidor === undefined) return {}
  const pedidosAcimaDoTeto = medidor.createCounter(METRICS.pedidoAcimaDoTeto, { description: 'Pedidos de IA recusados acima do teto de entrada da tarefa, por tarefa' })
  const degradacao = medidor.createCounter(METRICS.degradacaoDeIa, { description: 'Pedidos de IA que desceram um degrau da degradação (espera, modelo menor, indisponível), por degrau' })
  const duracaoDaChamada = medidor.createHistogram(METRICS.duracaoDaChamadaDeIa, {
    unit: 's',
    description: 'Duração de cada chamada ao provedor de IA, por provedor, perfil e resultado',
    advice: { explicitBucketBoundaries: LIMITES_DO_HISTOGRAMA_DA_CHAMADA_S },
  })
  const errosDaChamada = medidor.createCounter(METRICS.errosDaChamadaDeIa, { description: 'Chamadas ao provedor de IA que terminaram em erro, por provedor, perfil e código' })
  medidor.createObservableGauge(METRICS.usoDoTetoDeTokens, { description: 'Quanto do contratado o balde geral de tokens do modelo já consumiu no minuto (0,8 é o balde cheio)' }).addCallback((observador) => {
    const agora = horaDoProcessoMs()
    for (const [modelo, uso] of usosDoTeto) observador.observe(agora - uso.em < VALIDADE_DO_USO_DO_TETO_MS ? uso.valor : 0, { modelo })
  })
  for (const degrau of DEGRAUS) degradacao.add(0, { degrau })
  for (const tarefa of TAREFAS_DE_IA) pedidosAcimaDoTeto.add(0, { tarefa })
  return { pedidosAcimaDoTeto, degradacao, duracaoDaChamada, errosDaChamada }
}

/** Com qual modelo a chamada sai e o que reservar dele. `modelo` ausente é o do perfil. */
interface Vaga {
  readonly modelo?: string
  readonly reserva?: ReservaDeTokens
}

/** Funções cujo gasto é de um aluno: sem `alunoId` não há como consultar o freio dele, e a chamada é recusada. */
const FUNCOES_COM_ORCAMENTO_POR_ALUNO: ReadonlySet<ChaveDeFuncao> = new Set<ChaveDeFuncao>(['tutor_com_o_aluno'])

/** Os limites do histograma da chamada ao modelo, em segundos: da resposta rápida do Tutor ao prazo de 140 s da ferramenta. */
const LIMITES_DO_HISTOGRAMA_DA_CHAMADA_S = [0.5, 1, 2, 5, 10, 20, 30, 60, 90, 140]

/** Uma primeira chamada e uma repetição, dizendo ao modelo o que veio errado. Depois disso é erro tipado. */
const TENTATIVAS_MAXIMAS = 2
const PROBLEMAS_MAXIMOS_NA_REPETICAO = 8
export const MODELO_DA_REGRA_FIXA = 'regra_fixa'

type Interpretacao<Saida> =
  | { readonly ok: true; readonly saida: Saida }
  // `naConferencia`: o JSON e o schema passaram, e quem reprovou foi a conferência da tarefa (o conteúdo, não a forma).
  | { readonly ok: false; readonly problemas: readonly string[]; readonly naConferencia?: boolean }

/** Do texto do modelo à saída que o domínio pode usar: JSON, schema, ajuste e conferência da tarefa, nesta ordem. */
function interpretar<Entrada, Saida>(tarefa: TaskDefinition<Entrada, Saida>, entrada: Entrada, texto: string): Interpretacao<Saida> {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return { ok: false, problemas: ['A resposta não é um JSON válido: veio texto fora do objeto, ou o objeto veio cortado.'] }
  }
  // A tela mostra o texto como texto: a marcação que o modelo põe por hábito sai antes de validar.
  const limpo = semMarcacao(bruto)
  return validate(tarefa, entrada, tarefa.prepararResposta?.(entrada, limpo) ?? limpo)
}

function validate<Entrada, Saida>(tarefa: TaskDefinition<Entrada, Saida>, entrada: Entrada, bruto: unknown): Interpretacao<Saida> {
  const lida = tarefa.esquemaDeSaida.safeParse(bruto)
  if (!lida.success) {
    const problemas = lida.error.issues.slice(0, PROBLEMAS_MAXIMOS_NA_REPETICAO).map((problema) => `${problema.path.join('.') || 'resposta'}: ${problema.message}`)
    return { ok: false, problemas }
  }
  const saida = tarefa.ajustar?.(entrada, lida.data) ?? lida.data
  const problemas = tarefa.conferir?.(entrada, saida) ?? []
  return problemas.length === 0 ? { ok: true, saida } : { ok: false, problemas: problemas.slice(0, PROBLEMAS_MAXIMOS_NA_REPETICAO), naConferencia: true }
}

/**
 * Uma chamada que saiu para o modelo, e é uma linha de `consumo_ia` (D14): o custo pelo preço vigente no instante dela. O `codigoDeErro` é pessimista desde o começo (a chamada que saiu e não
 * terminou de ser lida conta como falha de indisponibilidade) e se acerta quando a saída é lida e reprovada. A última chamada de uma execução que deu certo vira `concluida` ao gravar.
 */
interface ChamadaEnviada {
  readonly modelo: string
  readonly tokensDeEntrada: number
  readonly tokensDeSaida: number
  readonly custoMicros: number
  readonly duracaoMs: number
  readonly em: Date
  codigoDeErro: LLMErrorCode
}

interface Gasto {
  modelo: string
  tokensDeEntrada: number
  tokensDeSaida: number
  tentativas: number
  /** Só as chamadas que saíram, na ordem: a que não saiu (balde cheio, disjuntor aberto) não é chamada. */
  readonly chamadas: ChamadaEnviada[]
}

/**
 * A implementação da porta, igual para todo adaptador. Em toda chamada, nesta ordem: valida a entrada, confere se a
 * escola suspendeu a função, recusa a tarefa de texto de aluno que a subida não conferiu na D62, recusa o pedido acima do teto de entrada da tarefa, consulta o orçamento (salvo na resposta de regra fixa), chama o modelo (o prazo e a repetição do que não cobrou são do `ResilientAdapter`), valida a saída (repetindo uma vez),
 * registra o consumo e escreve o log.
 *
 * Nada que não foi registrado é devolvido: se o registro falhar, a chamada falha (regra 30, item 4).
 */
export class LLMGateway implements LLMProvider {
  private readonly relogio: Clock
  private readonly pedidosAcimaDoTeto: Counter | undefined
  private readonly degradacao: Counter | undefined
  private readonly duracaoDaChamada: Histogram | undefined
  private readonly errosDaChamada: Counter | undefined
  /** O uso do teto de cada modelo na última reserva, lido pela métrica: depois de um minuto sem reservar, vale 0. */
  private readonly usosDoTeto = new Map<string, { readonly valor: number; readonly em: number }>()

  constructor(private readonly dependencias: LLMGatewayDependencies) {
    this.relogio = dependencias.relogio ?? systemClock
    const medidas = createMedidas(dependencias.medidor, this.usosDoTeto)
    this.pedidosAcimaDoTeto = medidas.pedidosAcimaDoTeto
    this.degradacao = medidas.degradacao
    this.duracaoDaChamada = medidas.duracaoDaChamada
    this.errosDaChamada = medidas.errosDaChamada
  }

  async generate<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>): Promise<GenerationResult<Saida>> {
    const { tarefa } = pedido
    const { adaptador } = this.dependencias
    const inicio = performance.now()
    // O conteúdo de tarefa que leva texto livre de pessoa (aluno ou professor) não entra no registro de consumo: o
    // registro dele é a conversa, que tem dono, acesso restrito e retenção.
    const conteudo = <Conteudo extends object>(campos: Conteudo): Conteudo | Record<string, never> => (tarefa.levaTextoLivreDePessoa ? {} : campos)

    // A escola do pedido é a de quem está pedindo. Com contexto de escola (a requisição, ou a execução em segundo
    // plano), pedir em nome de outra escola é defeito de quem chamou: recusa antes de consultar, gastar ou registrar
    // na escola errada (regra 10, item 3). Sem escola no contexto não há com o que comparar aqui, e quem recusa é a porta
    // da suspensão, logo abaixo, que lê a escola do contexto e falha fechada (`IA_INDISPONIVEL`): nada executa, nem
    // consulta orçamento, nem registra consumo.
    const escolaDoContexto = currentContext()?.escolaId
    if (escolaDoContexto !== undefined && escolaDoContexto !== pedido.escolaId) {
      const tipo = tarefa.nome
      this.dependencias.logger?.warn({ evento: 'ia.geracao.escola_fora_do_contexto', tipo })
      throw new LLMError('IA_ENTRADA_INVALIDA')
    }

    // Entrada fora do schema é erro de quem chamou, antes de qualquer gasto: chave a mais (um nome) para aqui.
    const lida = tarefa.esquemaDeEntrada.safeParse(pedido.entrada)
    if (!lida.success || (FUNCOES_COM_ORCAMENTO_POR_ALUNO.has(tarefa.funcao) && pedido.alunoId === undefined)) {
      this.avisar(pedido, 'IA_ENTRADA_INVALIDA', inicio, 0)
      throw new LLMError('IA_ENTRADA_INVALIDA')
    }
    const entrada = lida.data
    // O que o registro guarda da entrada: a própria, ou a forma reduzida que a tarefa declara (a classificação do material guarda só os ids das seções, nunca o texto da apostila).
    const entradaDoRegistro: unknown = tarefa.entradaParaORegistro?.(entrada) ?? entrada

    // Função suspensa pela escola não executa nada: nem modelo, nem regra fixa, nem consulta de orçamento (D60).
    try {
      await exigirFuncaoAtiva(this.dependencias.suspensao, tarefa.funcao)
    } catch (erro) {
      this.avisar(pedido, erro instanceof LLMError ? erro.codigoDeIa : 'IA_INDISPONIVEL', inicio, 0)
      throw erro
    }
    // A resposta de regra fixa não gasta modelo e não passa pelo orçamento: o aluno que escreve sobre um assunto
    // delicado recebe a mensagem com o 188 mesmo no fim do freio do dia (D36).
    const fixa = tarefa.semModelo?.(entrada)
    if (fixa === undefined) {
      // A D62, antes do teto, do orçamento e do envio: texto de aluno não sai para provedor que a subida não conferiu.
      this.exigirSoberania(pedido, inicio)
      // Antes do orçamento e do envio: o pedido que estoura o teto da tarefa é defeito nosso, e não gasta nada nem a vez de ninguém.
      this.exigirPedidoDentroDoTeto(pedido, entrada, inicio)
      await this.exigirOrcamento(pedido, inicio)
    }

    const gasto: Gasto = { modelo: adaptador.modeloDoPerfil(tarefa.perfil), tokensDeEntrada: 0, tokensDeSaida: 0, tentativas: 0, chamadas: [] }
    let saida: Saida
    try {
      saida = fixa === undefined ? await this.chamarAteValer(pedido, entrada, gasto) : this.exigirSaidaFixa(tarefa, entrada, fixa)
    } catch (erro) {
      const codigo: LLMErrorCode = erro instanceof LLMError ? erro.codigoDeIa : 'IA_INDISPONIVEL'
      // Erro que não é da camada é defeito nosso (na versão determinística, na conferência): fica o resumo, sem mensagem.
      if (!(erro instanceof LLMError)) this.dependencias.logger?.warn({ evento: 'ia.geracao.erro_inesperado', erro: summarizeError(erro) })
      const medicao = this.medir(pedido, gasto, inicio, false)
      // O registro da falha é o melhor possível: se ele também falhar, o erro que sobe continua sendo o da chamada.
      // O lote adia o que não saiu (balde cheio, disjuntor aberto) e tenta de novo: a tentativa que nem chegou ao provedor não deixa linha de consumo (D14: a conta é do que foi enviado). As chamadas que saíram antes dela têm a sua.
      const adiavelSemEnvio = pedido.fila === 'lote' && erro instanceof LLMError && erro.semEnvio
      if (gasto.chamadas.length > 0 || !adiavelSemEnvio) {
        await this.registrarLinhas(this.linhasDeConsumo(pedido, gasto, medicao, { estado: 'falhou', codigoDeErro: codigo, conteudo: conteudo({ entrada: entradaDoRegistro }) })).catch(() => undefined)
      }
      this.avisar(pedido, codigo, inicio, gasto.tentativas)
      throw erro instanceof LLMError ? erro : new LLMError('IA_INDISPONIVEL')
    }

    const medicao = this.medir(pedido, gasto, inicio, fixa !== undefined)
    try {
      await this.registrarLinhas(this.linhasDeConsumo(pedido, gasto, medicao, { estado: 'concluida', conteudo: conteudo({ entrada: entradaDoRegistro, saida }) }))
    } catch {
      this.avisar(pedido, 'IA_INDISPONIVEL', inicio, gasto.tentativas)
      throw new LLMError('IA_INDISPONIVEL')
    }
    const tipo = tarefa.nome
    const { duracaoMs, tentativas } = medicao
    this.dependencias.logger?.info({ evento: 'ia.geracao.concluida', tipo, escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, duracaoMs, tentativas })
    return { saida, medicao }
  }

  /**
   * A D62 na chamada: a tarefa com `levaTextoDeAluno` não segue para adaptador que manda o conteúdo para fora sem a subida ter conferido o
   * suboperador do provedor (`pais = 'BR'`, treinamento vedado, as categorias das tarefas). Recusa com `IA_INDISPONIVEL` e o log
   * `ia.geracao.soberania_recusada`, sem registro de consumo (nada saiu). Fica **fora** da resposta de regra fixa, que não envia nada: o aluno no
   * assunto delicado recebe a mensagem com o 188 mesmo com o provedor não conferido (D36). O log leva a tarefa, os ids e o provedor, nunca a
   * entrada nem o pedido (regra 20, item 9).
   */
  private exigirSoberania<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, inicio: number): void {
    const { tarefa } = pedido
    const { envio } = this.dependencias.adaptador
    if (!tarefa.levaTextoDeAluno || !envio.envioExterno || this.dependencias.soberania?.conferida === true) return
    const tipo = tarefa.nome
    const duracaoMs = Math.round(performance.now() - inicio)
    this.dependencias.logger?.warn({ evento: 'ia.geracao.soberania_recusada', tipo, codigo: 'IA_INDISPONIVEL', escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, provedorId: envio.provedorId, duracaoMs })
    throw new LLMError('IA_INDISPONIVEL', undefined, 'soberania')
  }

  /**
   * O pedido que a tarefa monta passa do `maximoDeTokensDeEntrada` dela, mesmo com a entrada válida no esquema: o teto não acompanhou um
   * campo ou um prompt que cresceu. Recusa sem registro de consumo (nada foi ao modelo), com a métrica, o log de ids e o código que a tela
   * mostra como "Tentar de novo". O log leva a tarefa e os ids, nunca a entrada nem o pedido (regra 20, item 9).
   */
  private exigirPedidoDentroDoTeto<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, entrada: Entrada, inicio: number): void {
    const { tarefa } = pedido
    if (tokensDoPedido(tarefa, entrada) <= tarefa.maximoDeTokensDeEntrada) return
    this.pedidosAcimaDoTeto?.add(1, { tarefa: tarefa.nome })
    const tipo = tarefa.nome
    const duracaoMs = Math.round(performance.now() - inicio)
    this.dependencias.logger?.warn({ evento: 'ia.geracao.pedido_acima_do_teto', tipo, codigo: 'PEDIDO_ACIMA_DO_TETO', escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, duracaoMs })
    throw new LLMError('PEDIDO_ACIMA_DO_TETO')
  }

  /** Sem conseguir consultar o orçamento, não se gasta: a falha da consulta fecha a porta, não abre. */
  private async exigirOrcamento<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, inicio: number): Promise<void> {
    let codigo: LLMErrorCode | undefined
    let tenteDeNovoEmSegundos: number | undefined
    try {
      const decisao = await this.dependencias.orcamento.check({
        funcao: pedido.tarefa.funcao,
        ...(pedido.alunoId === undefined ? {} : { alunoId: pedido.alunoId }),
        ...(pedido.turmaId === undefined ? {} : { turmaId: pedido.turmaId }),
        ...(pedido.execucaoId === undefined ? {} : { execucaoId: pedido.execucaoId }),
        ...(pedido.fila === undefined ? {} : { fila: pedido.fila }),
      })
      if (!decisao.permitido) {
        codigo = decisao.codigo
        tenteDeNovoEmSegundos = decisao.tenteDeNovoEmSegundos
      }
    } catch {
      codigo = 'IA_INDISPONIVEL'
    }
    if (codigo === undefined) return
    this.avisar(pedido, codigo, inicio, 0)
    throw new LLMError(codigo, tenteDeNovoEmSegundos)
  }

  /** A regra fixa também passa pelo schema e pela conferência: texto nosso com defeito não chega a ninguém. */
  private exigirSaidaFixa<Entrada, Saida>(tarefa: TaskDefinition<Entrada, Saida>, entrada: Entrada, fixa: Saida): Saida {
    const validada = validate(tarefa, entrada, fixa)
    if (!validada.ok) throw new LLMError('IA_SAIDA_INVALIDA')
    return validada.saida
  }

  private async chamarAteValer<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, entrada: Entrada, gasto: Gasto): Promise<Saida> {
    const { tarefa } = pedido
    let correcao: RepairHint | undefined
    let reprovadaNaConferencia = false
    let problemasDaUltima: readonly string[] = []
    while (gasto.tentativas < TENTATIVAS_MAXIMAS) {
      // A vaga de tokens vem antes da chamada, e a tentativa só conta depois dela: a que terminou `IA_INDISPONIVEL` sem sair não deixa o consumo dizer que houve envio.
      const vaga = await this.reservarVaga(pedido, entrada, correcao)
      gasto.tentativas += 1
      // O modelo que vai receber o pedido: se a chamada falhar, o consumo de `falhou` grava este (regra 70, item 6), e não o do perfil.
      gasto.modelo = vaga.modelo ?? this.dependencias.adaptador.modeloDoPerfil(tarefa.perfil)
      const { resposta, reserva, inicioDaChamada } = await this.chamarComDegrau(pedido, entrada, correcao, vaga, gasto)
      const chamada = this.chamadaFeita(resposta.modelo, { tokensDeEntrada: resposta.tokensDeEntrada, tokensDeSaida: resposta.tokensDeSaida }, inicioDaChamada)
      gasto.chamadas.push(chamada)
      await reserva?.acertar(resposta.tokensDeEntrada + resposta.tokensDeSaida)
      gasto.modelo = resposta.modelo
      gasto.tokensDeEntrada += resposta.tokensDeEntrada
      gasto.tokensDeSaida += resposta.tokensDeSaida
      const interpretada = interpretar(tarefa, entrada, resposta.texto)
      if (interpretada.ok) return interpretada.saida
      chamada.codigoDeErro = 'IA_SAIDA_INVALIDA'
      correcao = { respostaAnterior: resposta.texto, problemas: interpretada.problemas }
      reprovadaNaConferencia = interpretada.naConferencia === true
      problemasDaUltima = interpretada.problemas
    }
    const reserva = this.saidaDeReserva(pedido, entrada, gasto.tentativas, reprovadaNaConferencia ? problemasDaUltima : undefined)
    if (reserva !== undefined) return reserva
    throw new LLMError('IA_SAIDA_INVALIDA')
  }

  /**
   * A chamada ao modelo da vaga e, se o principal devolver o `limite` (o 429 que sobrou da repetição, falta de vaga do provedor, regra 80, item 4), o mesmo degrau do balde cheio: o modelo menor.
   * A linha da chamada que o principal recusou já está em `gasto.chamadas`. Devolve também a reserva da chamada que respondeu, que o chamador acerta pelo uso real, e quando ela começou.
   */
  private async chamarComDegrau<Entrada, Saida>(
    pedido: GenerationRequest<Entrada, Saida>,
    entrada: Entrada,
    correcao: RepairHint | undefined,
    vaga: Vaga,
    gasto: Gasto,
  ): Promise<{ readonly resposta: ModelResponse; readonly reserva: ReservaDeTokens | undefined; readonly inicioDaChamada: number }> {
    const { tarefa } = pedido
    // O prazo da chamada é do `ResilientAdapter`, que sabe o do perfil. O sinal de quem chamou (o executor) o cancela.
    const sinal = pedido.sinal ?? new AbortController().signal
    const inicioDaChamada = performance.now()
    try {
      const resposta = await this.chamarContando(pedido, chamadaAoModelo({ tarefa, entrada, sinal }, correcao, vaga.modelo), gasto, inicioDaChamada, correcao)
      return { resposta, reserva: vaga.reserva, inicioDaChamada }
    } catch (erro) {
      // Só o 429 que sobrou, e só na chamada ao principal: o menor que também recusa termina, sem descer de novo.
      const desceAoMenor = erro instanceof LLMError && erro.motivo === 'limite' && vaga.modelo === undefined
      const menor = desceAoMenor ? await this.descerPorLimite(pedido, entrada, correcao) : undefined
      if (menor === undefined) throw erro
      gasto.modelo = menor.modelo
      const inicioDoMenor = performance.now()
      const resposta = await this.chamarContando(pedido, chamadaAoModelo({ tarefa, entrada, sinal }, correcao, menor.modelo), gasto, inicioDoMenor, correcao)
      return { resposta, reserva: menor.reserva, inicioDaChamada: inicioDoMenor }
    }
  }

  /** Só quando o modelo respondeu na forma certa e errou no conteúdo (`problemas` presente): modelo que devolve lixo continua sendo falha. */
  private saidaDeReserva<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, entrada: Entrada, tentativas: number, problemas: readonly string[] | undefined): Saida | undefined {
    const { tarefa } = pedido
    const reserva = problemas === undefined ? undefined : tarefa.reservaQuandoInvalida?.(entrada, problemas)
    if (reserva === undefined) return undefined
    const validada = validate(tarefa, entrada, reserva)
    if (!validada.ok) return undefined
    const tipo = tarefa.nome
    this.dependencias.logger?.info({ evento: 'ia.geracao.reserva', tipo, escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, tentativas })
    return validada.saida
  }

  /** A chamada ao modelo. Se ela cai, a que saiu deixa a sua linha estimada em `gasto.chamadas` antes de o erro subir. */
  private async chamarContando<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, aoModelo: ModelCall<Entrada, Saida>, gasto: Gasto, inicioDaChamada: number, correcao: RepairHint | undefined): Promise<ModelResponse> {
    const { entrada } = aoModelo
    try {
      return await this.chamarModelo(pedido, aoModelo)
    } catch (erro) {
      // A chamada que saiu e não voltou com uso (o prazo, a conexão, o servidor, o 429 que sobrou e o outro 4xx) custa o que se estima: a entrada contada e a saída no teto da tarefa (D14, superestima). A que não saiu (o disjuntor aberto) não é chamada.
      if (!(erro instanceof LLMError && erro.semEnvio)) gasto.chamadas.push(this.chamadaSemUso(pedido, entrada, correcao, gasto.modelo, inicioDaChamada, erro instanceof LLMError ? erro.codigoDeIa : 'IA_INDISPONIVEL'))
      throw erro
    }
  }

  /** Uma chamada ao adaptador, medida: a duração e, se falhou, o código. Só o que o provedor fez: a espera pela vaga e a repetição por saída inválida ficam de fora. */
  private async chamarModelo<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
    const { adaptador } = this.dependencias
    const atributos = { provedor: adaptador.identidade, perfil: pedido.tarefa.perfil }
    const inicio = performance.now()
    try {
      const resposta = await adaptador.chamar(chamada)
      this.duracaoDaChamada?.record((performance.now() - inicio) / 1_000, { ...atributos, resultado: 'ok' })
      return resposta
    } catch (erro) {
      this.duracaoDaChamada?.record((performance.now() - inicio) / 1_000, { ...atributos, resultado: 'erro' })
      this.errosDaChamada?.add(1, { ...atributos, codigo: erro instanceof LLMError ? erro.codigoDeIa : 'IA_INDISPONIVEL' })
      throw erro
    }
  }

  /**
   * O limite de tokens por minuto (49.0, regra 80, item 4), antes de cada chamada ao modelo, depois da D62, do teto de entrada e do orçamento: o pedido que estes recusam não reserva nada.
   * Reserva a estimativa do pedido (a da repetição inclui a resposta anterior e a correção) mais o máximo de saída, e, sem vaga:
   *
   * 1. **espera** até `ESPERA_MAXIMA_DA_VAGA_MS`, no ritmo do `msBeforeNext` do balde, cortada pelo `pedido.sinal`: o prazo único da execução cobre a espera;
   * 2. **o modelo menor** do perfil, uma reserva só, se houver e se a tarefa puder (o turno do Tutor, nunca);
   * 3. **`IA_INDISPONIVEL`**, sem troca contada e sem erro cru.
   *
   * O 429 que o provedor devolve **depois** de a vaga ser concedida (o `limite` do `ResilientAdapter`) desce o mesmo degrau 2, em `descerPorLimite`, sem a espera.
   * Sem limitador configurado, a chamada vai direto ao modelo do perfil.
   */
  private async reservarVaga<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, entrada: Entrada, correcao: RepairHint | undefined): Promise<Vaga> {
    const limite = this.dependencias.limiteDeTokens
    if (limite === undefined) return {}
    const { tarefa } = pedido
    const fila = pedido.fila ?? 'normal'
    const estimativa = this.estimativaDoPedido(pedido, entrada, correcao)
    const principal = this.dependencias.adaptador.modeloDoPerfil(tarefa.perfil)
    const limiteDaEspera = horaDoProcessoMs() + ESPERA_MAXIMA_DA_VAGA_MS
    let esperou = false
    let msAteLiberar: number
    for (;;) {
      const resultado = await limite.reservar(this.chaveDoBalde(principal), estimativa, fila)
      this.anotarUsoDoTeto(principal, resultado.usoDoTeto)
      if (resultado.concedida) return { reserva: resultado.reserva }
      msAteLiberar = resultado.msAteLiberar
      const restante = limiteDaEspera - horaDoProcessoMs()
      if (restante <= 0) break
      if (!esperou) {
        esperou = true
        this.descer('espera', tarefa.nome, principal)
      }
      await wait(Math.min(Math.max(resultado.msAteLiberar, ESPERA_MINIMA_ENTRE_RESERVAS_MS), restante), pedido.sinal)
    }
    const vaga = await this.reservarOMenor(pedido, estimativa, fila, limite)
    if (vaga !== undefined) return vaga
    this.descer('indisponivel', tarefa.nome, this.modeloMenorDaTarefa(pedido) ?? principal)
    // O balde diz quando libera: o lote adia o job por esse tempo (`tenteDeNovoEmSegundos`) em vez de falhar.
    throw new LLMError('IA_INDISPONIVEL', Math.max(1, Math.ceil(msAteLiberar / 1_000)), 'sem_vaga')
  }

  /** O modelo menor que a tarefa pode usar: o do perfil, salvo as que nunca descem (o Tutor e a classificação). */
  private modeloMenorDaTarefa<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>): string | undefined {
    const { tarefa } = pedido
    return TAREFAS_SEM_MODELO_MENOR.has(tarefa.nome) ? undefined : this.dependencias.modelosMenores?.[tarefa.perfil]
  }

  /** O que o pedido reserva no balde: a entrada contada (com a correção da repetição) e o máximo de saída da tarefa. */
  private estimativaDoPedido<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, entrada: Entrada, correcao: RepairHint | undefined): number {
    return tokensDoPedido(pedido.tarefa, entrada, correcao) + pedido.tarefa.maximoDeTokensDeSaida
  }

  /** O degrau do modelo menor: a vaga dele no balde próprio, ou nada (a tarefa não o tem, não pode usá-lo, ou o balde dele também está cheio). */
  private async reservarOMenor<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, estimativa: number, fila: NonNullable<GenerationRequest<Entrada, Saida>['fila']>, limite: LimiteDeTokens): Promise<Required<Vaga> | undefined> {
    const menor = this.modeloMenorDaTarefa(pedido)
    if (menor === undefined) return undefined
    const resultado = await limite.reservar(this.chaveDoBalde(menor), estimativa, fila)
    this.anotarUsoDoTeto(menor, resultado.usoDoTeto)
    if (!resultado.concedida) return undefined
    this.descer('modelo_menor', pedido.tarefa.nome, menor)
    return { modelo: menor, reserva: resultado.reserva }
  }

  /**
   * O principal respondeu 429 depois da repetição: o pedido chegou e o provedor não tem vaga. Desce ao modelo menor, sem a espera de 8 s (o provedor já recusou, o balde nosso estava aberto).
   * Sem menor (a tarefa não o tem, ou é o Tutor ou a classificação, D36) ou sem vaga nele, termina como o balde cheio: `IA_INDISPONIVEL`, e o `degrau` conta. Sem limitador configurado não há degrau (o
   * `local`), e o erro sobe como veio. Quem chama relança o `limite` original quando a resposta é `undefined`.
   */
  private async descerPorLimite<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, entrada: Entrada, correcao: RepairHint | undefined): Promise<Required<Vaga> | undefined> {
    const limite = this.dependencias.limiteDeTokens
    if (limite === undefined) return undefined
    const vaga = await this.reservarOMenor(pedido, this.estimativaDoPedido(pedido, entrada, correcao), pedido.fila ?? 'normal', limite)
    if (vaga === undefined) this.descer('indisponivel', pedido.tarefa.nome, this.dependencias.adaptador.modeloDoPerfil(pedido.tarefa.perfil))
    return vaga
  }

  /** O balde é do `provedor:modelo`: o modelo menor tem o seu, e dois provedores não dividem balde. */
  private chaveDoBalde(modelo: string): string {
    return `${this.dependencias.adaptador.identidade}:${modelo}`
  }

  private anotarUsoDoTeto(modelo: string, uso: number | undefined): void {
    if (uso !== undefined) this.usosDoTeto.set(modelo, { valor: uso, em: horaDoProcessoMs() })
  }

  /** Um degrau: a métrica dele e o log só com a tarefa, o modelo e, no fim, o código. Nunca a escola, a execução nem o pedido (regra 20, item 9). */
  private descer(degrau: Degrau, tipo: TarefaDeIa, modeloId: string): void {
    this.degradacao?.add(1, { degrau })
    if (degrau === 'indisponivel') this.dependencias.logger?.warn({ evento: 'ia.geracao.sem_vaga', tipo, modeloId, codigo: 'IA_INDISPONIVEL' })
    else this.dependencias.logger?.info({ evento: degrau === 'espera' ? 'ia.geracao.espera_de_vaga' : 'ia.geracao.modelo_menor', tipo, modeloId })
  }

  private medir<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, gasto: Gasto, inicio: number, regraFixa: boolean): GenerationMeasurement {
    const { adaptador } = this.dependencias
    return {
      origem: regraFixa ? 'regra_fixa' : adaptador.origem,
      perfil: pedido.tarefa.perfil,
      modelo: regraFixa ? MODELO_DA_REGRA_FIXA : gasto.modelo,
      promptVersao: pedido.tarefa.prompt.versao,
      tokensDeEntrada: gasto.tokensDeEntrada,
      tokensDeSaida: gasto.tokensDeSaida,
      duracaoMs: Math.round(performance.now() - inicio),
      tentativas: gasto.tentativas,
      // Só há envio externo se alguma chamada chegou a sair para um provedor de fora, e então o provedor vai junto. A regra
      // fixa não chama ninguém: as tentativas ficam em 0, e é isso que a deixa sem envio.
      ...(gasto.tentativas > 0 ? adaptador.envio : SEM_ENVIO_EXTERNO),
    }
  }

  /** A chamada que saiu, com o custo pelo preço vigente no instante dela (`em`) e a chave `provedor:modelo`. A saída ainda não lida vale falha: quem a lê acerta o `estado`. */
  private chamadaFeita(modelo: string, tokens: { readonly tokensDeEntrada: number; readonly tokensDeSaida: number }, inicioDaChamada: number): ChamadaEnviada {
    const { adaptador, precos } = this.dependencias
    const em = this.relogio.agora()
    const preco = precoDoModelo(chaveDoPreco(adaptador.identidade, modelo), em, precos)
    return { modelo, ...tokens, custoMicros: custoDaChamada(tokens, preco), duracaoMs: Math.round(performance.now() - inicioDaChamada), em, codigoDeErro: 'IA_INDISPONIVEL' }
  }

  /** A chamada que saiu e não voltou com uso: a entrada contada do pedido (a repetição leva a correção) e a saída no teto da tarefa, ao preço do modelo que a recebeu. */
  private chamadaSemUso<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, entrada: Entrada, correcao: RepairHint | undefined, modelo: string, inicioDaChamada: number, codigo: LLMErrorCode): ChamadaEnviada {
    const { tarefa } = pedido
    const chamada = this.chamadaFeita(modelo, { tokensDeEntrada: tokensDoPedido(tarefa, entrada, correcao), tokensDeSaida: tarefa.maximoDeTokensDeSaida }, inicioDaChamada)
    chamada.codigoDeErro = codigo
    return chamada
  }

  /**
   * As linhas de consumo da execução, **uma por chamada que saiu**, na ordem (D14). A saída inválida de uma chamada seguida de repetição grava `falhou`/`IA_SAIDA_INVALIDA` sem conteúdo (regra 20: a saída que
   * não valeu não fica para depuração); `entrada` e `saida` ficam só na última. Sem chamada que saiu (a regra fixa, o balde cheio, o disjuntor aberto), uma linha só, sem tokens, sem custo e sem envio.
   */
  private linhasDeConsumo<Entrada, Saida>(
    pedido: GenerationRequest<Entrada, Saida>,
    gasto: Gasto,
    medicao: GenerationMeasurement,
    final: { readonly estado: 'concluida' | 'falhou'; readonly codigoDeErro?: LLMErrorCode; readonly conteudo: Pick<ConsumoDeIa, 'entrada' | 'saida'> },
  ): ConsumoDeIa[] {
    const { adaptador } = this.dependencias
    const { chamadas } = gasto
    if (chamadas.length === 0) {
      return [this.consumo(pedido, { ...medicao, tentativas: 0, ...SEM_ENVIO_EXTERNO }, { ...final.conteudo, estado: final.estado, ...(final.codigoDeErro === undefined ? {} : { codigoDeErro: final.codigoDeErro }) }, 0, this.relogio.agora())]
    }
    return chamadas.map((chamada, indice) => {
      const ultima = indice === chamadas.length - 1
      const concluida = ultima && final.estado === 'concluida'
      const medida: GenerationMeasurement = {
        origem: adaptador.origem,
        perfil: pedido.tarefa.perfil,
        modelo: chamada.modelo,
        promptVersao: pedido.tarefa.prompt.versao,
        tokensDeEntrada: chamada.tokensDeEntrada,
        tokensDeSaida: chamada.tokensDeSaida,
        duracaoMs: chamada.duracaoMs,
        tentativas: 1,
        ...adaptador.envio,
      }
      const resultado: Pick<ConsumoDeIa, 'estado' | 'codigoDeErro'> = concluida ? { estado: 'concluida' } : { estado: 'falhou', codigoDeErro: chamada.codigoDeErro }
      return this.consumo(pedido, medida, { ...(ultima ? final.conteudo : {}), ...resultado }, chamada.custoMicros, chamada.em)
    })
  }

  /** Grava todas, na ordem, e só falha depois de tentar a última: uma que falhou não esconde a seguinte. */
  private async registrarLinhas(linhas: readonly ConsumoDeIa[]): Promise<void> {
    let falhou = false
    for (const linha of linhas) {
      try {
        await this.dependencias.registro.registrar(linha)
      } catch {
        falhou = true
      }
    }
    if (falhou) throw new LLMError('IA_INDISPONIVEL')
  }

  private consumo<Entrada, Saida>(
    pedido: GenerationRequest<Entrada, Saida>,
    medicao: GenerationMeasurement,
    resultado: Pick<ConsumoDeIa, 'entrada' | 'saida' | 'estado' | 'codigoDeErro'>,
    custoMicros: number,
    em: Date,
  ): ConsumoDeIa {
    return {
      // O aluno só entra no consumo das funções que são dele (o Tutor): nas outras, o consumo não tem pessoa (D64).
      ...(pedido.alunoId === undefined || !FUNCOES_COM_ORCAMENTO_POR_ALUNO.has(pedido.tarefa.funcao) ? {} : { alunoId: pedido.alunoId }),
      ...(pedido.execucaoId === undefined ? {} : { execucaoId: pedido.execucaoId }),
      tarefa: pedido.tarefa.nome,
      funcao: pedido.tarefa.funcao,
      ...medicao,
      custoMicros,
      ...resultado,
      em,
    }
  }

  /** A tarefa fixa a função e o perfil: o `tipo` no log diz os dois. */
  private avisar<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, codigo: LLMErrorCode, inicio: number, tentativas: number): void {
    const tipo = pedido.tarefa.nome
    const duracaoMs = Math.round(performance.now() - inicio)
    this.dependencias.logger?.warn({ evento: 'ia.geracao.falhou', tipo, codigo, escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, duracaoMs, tentativas })
  }
}

export interface LLMGatewayPorts {
  readonly precos?: TabelaDePrecos
  readonly limiteDeTokens?: LimiteDeTokens
  /** O limitador da reserva (`LLMGatewayDependencies.limiteDeTokensDaReserva`). */
  readonly limiteDeTokensDaReserva?: LimiteDeTokens
  /** A conferência da D62 da reserva (`LLMGatewayDependencies.soberaniaDaReserva`). */
  readonly soberaniaDaReserva?: DeclaracaoDeSoberania
  readonly registro: RegistroDeConsumo
  readonly orcamento: OrcamentoDeIa
  readonly suspensao: SuspensaoDeFuncao
  readonly soberania?: DeclaracaoDeSoberania
  readonly logger?: LLMLogger
  readonly relogio?: Clock
  readonly medidor?: Meter
}

/**
 * Monta a porta a partir da configuração: é aqui, e só aqui, que `IA_ADAPTADOR` escolhe o adaptador, e que ele ganha o
 * prazo por perfil, a repetição e o disjuntor.
 */
export function createLLMGateway(config: LLMConfig, portas: LLMGatewayPorts): LLMProvider {
  const interno = adaptadorInterno(config)
  exigirPrecoDosModelos(config, interno, portas.precos, (portas.relogio ?? systemClock).agora())
  const adaptador = new ResilientAdapter(interno, {
    prazosMs: config.prazosMs,
    recuoMs: config.recuoMs,
    aleatorio: Math.random,
    ...(portas.medidor === undefined ? {} : { medidor: portas.medidor }),
  })
  return new LLMGateway({ adaptador, ...portas, ...(config.modelosMenores === undefined ? {} : { modelosMenores: config.modelosMenores }) })
}

/**
 * O modelo sem preço em `PRECO_DOS_MODELOS` recusa a subida (D14): o menor de um perfil em qualquer ambiente (49.0: o degrau gastaria sem conta), o do principal fora de `AMBIENTE=local` com
 * `openai_compat` (`config.exigePreco`: a chamada gravaria custo zero onde há cobrança) e o da reserva nas mesmas condições (`config.reserva.exigePreco`, F5b, 1.0). A chave é `identidade:modelo` e o preço
 * vale se há vigência que já começou. Diz a variável, nunca o valor dela.
 */
function exigirPrecoDosModelos(config: LLMConfig, adaptador: ModelAdapter, precos: TabelaDePrecos | undefined, agora: Date): void {
  const semPreco = (identidade: string, modelo: string): boolean => precoDoModelo(chaveDoPreco(identidade, modelo), agora, precos) === undefined
  const doPrincipal =
    config.exigePreco === true
      ? PERFIS.filter((perfil) => semPreco(adaptador.identidade, config.modelo?.modelos[perfil] ?? '')).map((perfil) => config.modelo?.variaveisDosModelos?.[perfil] ?? 'LLM_MODELO')
      : []
  const dosMenores = Object.entries(config.modelosMenores ?? {})
    .filter(([, modelo]) => semPreco(adaptador.identidade, modelo))
    .map(([perfil]) => `LLM_MODELO_MENOR_${perfil.toUpperCase()}`)
  const grupos: readonly (readonly [readonly string[], string])[] = [
    [doPrincipal, MOTIVO_MODELO_SEM_PRECO],
    [dosMenores, MOTIVO_MODELO_MENOR_SEM_PRECO],
    [variaveisDaReservaSemPreco(config.reserva, semPreco), MOTIVO_MODELO_DA_RESERVA_SEM_PRECO],
  ]
  const variaveis = [...new Set(grupos.flatMap(([citadas]) => citadas))].sort()
  if (variaveis.length === 0) return
  throw new InvalidConfigError(
    variaveis,
    grupos.filter(([citadas]) => citadas.length > 0).map(([, motivo]) => motivo),
  )
}

/** As variáveis dos modelos da reserva que não têm preço na identidade dela, ou nenhuma se a reserva não exige (`local`, o falso, sem reserva). */
function variaveisDaReservaSemPreco(reserva: ReservaConfig | undefined, semPreco: (identidade: string, modelo: string) => boolean): string[] {
  if (reserva?.exigePreco !== true) return []
  return PERFIS.filter((perfil) => semPreco(reserva.identidade, reserva.modelo?.modelos[perfil] ?? '')).map((perfil) => reserva.modelo?.variaveisDosModelos?.[perfil] ?? 'LLM_RESERVA_MODELO')
}

/** As opções do adaptador falso, as do principal e as da reserva: a espera simulada e os tokens informados. A identidade, só a da reserva (`falso-reserva`). */
function opcoesDoFalso(config: LLMConfig, identidade?: string): FakeAdapterOptions {
  return {
    ...(identidade === undefined ? {} : { identidade }),
    ...(config.latenciaFalsaMs === undefined ? {} : { latenciaMs: config.latenciaFalsaMs }),
    ...(config.latenciaFalsaMsPadrao === undefined ? {} : { latenciaMsPadrao: config.latenciaFalsaMsPadrao }),
    ...(config.tokensFalsos === undefined ? {} : { tokens: config.tokensFalsos }),
  }
}

/** O adaptador que `IA_ADAPTADOR` escolhe, sem a resiliência: a única conta de qual é, e que `createLLMGateway` e `destinoDoAdaptador` dividem. */
function adaptadorInterno(config: LLMConfig): ModelAdapter {
  if (config.adaptador === 'openai_compat' && config.modelo === undefined) throw new InvalidConfigError(['LLM_BASE_URL', 'LLM_MODELO'])
  // A latência simulada é só do adaptador falso (teste de carga, regra 80, item 11): o do provedor tem a do provedor.
  if (config.modelo !== undefined) return new OpenAICompatAdapter(config.modelo)
  return new FakeAdapter(opcoesDoFalso(config))
}

/**
 * O adaptador do provedor de reserva (F5b, 1.0), sem a resiliência, ou nenhum quando a reserva não está configurada: o `openai_compat` com o endereço, a chave e o modelo dela, ou o falso com a
 * identidade dela (`falso-reserva`). Quem o põe no caminho, com a conferência da D62 e o limitador próprios, é o `main-worker` (2.0); nenhuma chamada vai a ele antes da 4.0.
 */
export function adaptadorDaReserva(config: LLMConfig): ModelAdapter | undefined {
  const { reserva } = config
  if (reserva === undefined) return undefined
  if (reserva.modelo !== undefined) return new OpenAICompatAdapter(reserva.modelo)
  return new FakeAdapter(opcoesDoFalso(config, reserva.identidade))
}

/**
 * Para onde a configuração manda o conteúdo (a origem, o envio externo e o provedor, o modelo de cada perfil), **sem montar o gateway**: é o que a linha
 * estimada da execução interrompida lê (`consumoEstimadoDaInterrompida`). Sai da mesma conta de `createLLMGateway`, e por isso não diverge do que a
 * chamada de verdade registraria.
 */
export function destinoDoAdaptador(config: LLMConfig): DestinoDoAdaptador {
  const interno = adaptadorInterno(config)
  return { origem: interno.origem, envio: interno.envio, identidade: interno.identidade, modeloDoPerfil: (perfil) => interno.modeloDoPerfil(perfil) }
}
