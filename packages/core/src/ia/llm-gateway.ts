import type { Counter, Histogram, Meter } from '@opentelemetry/api'
import { TAREFAS_DE_IA, type ChaveDeFuncao, type TarefaDeIa } from '@educa/shared'
import type { LLMConfig } from '../config/llm-config.js'
import { InvalidConfigError } from '../config/validate-config.js'
import { currentContext } from '../context/context.js'
import { summarizeError } from '../error/summarize-error.js'
import type { LoggerBase } from '../log/logger.js'
import { METRICS } from '../telemetry/metrics.js'
import { systemClock, type Clock } from '../clock.js'
import type { ModelAdapter, ModelCall, ModelResponse, RepairHint } from './adapter.js'
import { FakeAdapter } from './fake-adapter.js'
import { OpenAICompatAdapter } from './openai-compat-adapter.js'
import { ResilientAdapter } from './resilient-adapter.js'
import { precoDoModelo, type ConsumoDeIa, type DestinoDoAdaptador, type OrcamentoDeIa, type RegistroDeConsumo } from './consumo.js'
import { LLMError, type LLMErrorCode } from './errors.js'
import { semMarcacao } from './clean-output.js'
import { SEM_ENVIO_EXTERNO, type DeclaracaoDeSoberania, type LLMProvider, type GenerationMeasurement, type GenerationRequest, type GenerationResult } from './port.js'
import { exigirFuncaoAtiva, type SuspensaoDeFuncao } from './suspensao.js'
import type { TaskDefinition } from './task.js'
import { tokensDoPedido } from './teto-de-entrada.js'
import type { Perfil } from './perfis.js'
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
  /** O modelo menor de cada perfil que tem o seu (`LLM_MODELO_MENOR_<PERFIL>`): o degrau depois da espera. O turno do Tutor nunca o usa. */
  readonly modelosMenores?: Readonly<Partial<Record<Perfil, string>>>
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

interface Gasto {
  modelo: string
  tokensDeEntrada: number
  tokensDeSaida: number
  tentativas: number
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

    const gasto: Gasto = { modelo: adaptador.modeloDoPerfil(tarefa.perfil), tokensDeEntrada: 0, tokensDeSaida: 0, tentativas: 0 }
    let saida: Saida
    try {
      saida = fixa === undefined ? await this.chamarAteValer(pedido, entrada, gasto) : this.exigirSaidaFixa(tarefa, entrada, fixa)
    } catch (erro) {
      const codigo: LLMErrorCode = erro instanceof LLMError ? erro.codigoDeIa : 'IA_INDISPONIVEL'
      // Erro que não é da camada é defeito nosso (na versão determinística, na conferência): fica o resumo, sem mensagem.
      if (!(erro instanceof LLMError)) this.dependencias.logger?.warn({ evento: 'ia.geracao.erro_inesperado', erro: summarizeError(erro) })
      const medicao = this.medir(pedido, gasto, inicio, false)
      // O registro da falha é o melhor possível: se ele também falhar, o erro que sobe continua sendo o da chamada.
      // O lote adia o que não saiu (balde cheio, disjuntor aberto) e tenta de novo: a tentativa que nem chegou ao provedor não deixa linha de consumo (D14: a conta é do que foi enviado).
      const adiavelSemEnvio = pedido.fila === 'lote' && erro instanceof LLMError && erro.semEnvio
      if (!adiavelSemEnvio) await this.dependencias.registro.registrar(this.consumo(pedido, medicao, { ...conteudo({ entrada: entradaDoRegistro }), estado: 'falhou', codigoDeErro: codigo })).catch(() => undefined)
      this.avisar(pedido, codigo, inicio, gasto.tentativas)
      throw erro instanceof LLMError ? erro : new LLMError('IA_INDISPONIVEL')
    }

    const medicao = this.medir(pedido, gasto, inicio, fixa !== undefined)
    try {
      await this.dependencias.registro.registrar(this.consumo(pedido, medicao, { ...conteudo({ entrada: entradaDoRegistro, saida }), estado: 'concluida' }))
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
      // O prazo da chamada é do `ResilientAdapter`, que sabe o do perfil. O sinal de quem chamou (o executor) o cancela.
      const sinal = pedido.sinal ?? new AbortController().signal
      // O modelo que vai receber o pedido: se a chamada falhar, o consumo de `falhou` grava este (regra 70, item 6), e não o do perfil.
      gasto.modelo = vaga.modelo ?? this.dependencias.adaptador.modeloDoPerfil(tarefa.perfil)
      const resposta = await this.chamarModelo(pedido, chamadaAoModelo({ tarefa, entrada, sinal }, correcao, vaga.modelo))
      await vaga.reserva?.acertar(resposta.tokensDeEntrada + resposta.tokensDeSaida)
      gasto.modelo = resposta.modelo
      gasto.tokensDeEntrada += resposta.tokensDeEntrada
      gasto.tokensDeSaida += resposta.tokensDeSaida
      const interpretada = interpretar(tarefa, entrada, resposta.texto)
      if (interpretada.ok) return interpretada.saida
      correcao = { respostaAnterior: resposta.texto, problemas: interpretada.problemas }
      reprovadaNaConferencia = interpretada.naConferencia === true
      problemasDaUltima = interpretada.problemas
    }
    const reserva = this.saidaDeReserva(pedido, entrada, gasto.tentativas, reprovadaNaConferencia ? problemasDaUltima : undefined)
    if (reserva !== undefined) return reserva
    throw new LLMError('IA_SAIDA_INVALIDA')
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

  /** Uma chamada ao adaptador, medida: a duração e, se falhou, o código. Só o que o provedor fez: a espera pela vaga e a repetição por saída inválida ficam de fora. */
  private async chamarModelo<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
    const { adaptador } = this.dependencias
    const atributos = { provedor: adaptador.envio.provedorId ?? adaptador.origem, perfil: pedido.tarefa.perfil }
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
   * Sem limitador configurado, a chamada vai direto ao modelo do perfil.
   */
  private async reservarVaga<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, entrada: Entrada, correcao: RepairHint | undefined): Promise<Vaga> {
    const limite = this.dependencias.limiteDeTokens
    if (limite === undefined) return {}
    const { tarefa } = pedido
    const fila = pedido.fila ?? 'normal'
    const estimativa = tokensDoPedido(tarefa, entrada, correcao) + tarefa.maximoDeTokensDeSaida
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
    return this.descerParaOMenor(pedido, estimativa, fila, limite, msAteLiberar)
  }

  private async descerParaOMenor<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, estimativa: number, fila: NonNullable<GenerationRequest<Entrada, Saida>['fila']>, limite: LimiteDeTokens, msAteLiberar: number): Promise<Vaga> {
    const { tarefa } = pedido
    const menor = TAREFAS_SEM_MODELO_MENOR.has(tarefa.nome) ? undefined : this.dependencias.modelosMenores?.[tarefa.perfil]
    if (menor !== undefined) {
      const resultado = await limite.reservar(this.chaveDoBalde(menor), estimativa, fila)
      this.anotarUsoDoTeto(menor, resultado.usoDoTeto)
      if (resultado.concedida) {
        this.descer('modelo_menor', tarefa.nome, menor)
        return { modelo: menor, reserva: resultado.reserva }
      }
    }
    const modelo = menor ?? this.dependencias.adaptador.modeloDoPerfil(tarefa.perfil)
    this.descer('indisponivel', tarefa.nome, modelo)
    // O balde diz quando libera: o lote adia o job por esse tempo (`tenteDeNovoEmSegundos`) em vez de falhar.
    throw new LLMError('IA_INDISPONIVEL', Math.max(1, Math.ceil(msAteLiberar / 1_000)), 'sem_vaga')
  }

  /** O balde é do `provedor:modelo`: o modelo menor tem o seu, e dois provedores não dividem balde. */
  private chaveDoBalde(modelo: string): string {
    const { adaptador } = this.dependencias
    return `${adaptador.envio.provedorId ?? adaptador.origem}:${modelo}`
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

  private consumo<Entrada, Saida>(
    pedido: GenerationRequest<Entrada, Saida>,
    medicao: GenerationMeasurement,
    resultado: Pick<ConsumoDeIa, 'entrada' | 'saida' | 'estado' | 'codigoDeErro'>,
  ): ConsumoDeIa {
    return {
      // O aluno só entra no consumo das funções que são dele (o Tutor): nas outras, o consumo não tem pessoa (D64).
      ...(pedido.alunoId === undefined || !FUNCOES_COM_ORCAMENTO_POR_ALUNO.has(pedido.tarefa.funcao) ? {} : { alunoId: pedido.alunoId }),
      ...(pedido.execucaoId === undefined ? {} : { execucaoId: pedido.execucaoId }),
      tarefa: pedido.tarefa.nome,
      funcao: pedido.tarefa.funcao,
      ...medicao,
      ...resultado,
      em: this.relogio.agora(),
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
  readonly limiteDeTokens?: LimiteDeTokens
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
  exigirPrecoDosModelosMenores(config)
  const adaptador = new ResilientAdapter(adaptadorInterno(config), {
    prazosMs: config.prazosMs,
    recuoMs: config.recuoMs,
    aleatorio: Math.random,
    ...(portas.medidor === undefined ? {} : { medidor: portas.medidor }),
  })
  return new LLMGateway({ adaptador, ...portas, ...(config.modelosMenores === undefined ? {} : { modelosMenores: config.modelosMenores }) })
}

/** O modelo menor sem preço em `PRECO_DOS_MODELOS` recusa a subida (49.0, D14): o degrau gastaria sem conta. Diz a variável, nunca o valor dela. */
function exigirPrecoDosModelosMenores(config: LLMConfig): void {
  const semPreco = Object.entries(config.modelosMenores ?? {}).filter(([, modelo]) => precoDoModelo(modelo) === undefined)
  if (semPreco.length > 0) throw new InvalidConfigError(semPreco.map(([perfil]) => `LLM_MODELO_MENOR_${perfil.toUpperCase()}`).sort(), [MOTIVO_MODELO_MENOR_SEM_PRECO])
}

/** O adaptador que `IA_ADAPTADOR` escolhe, sem a resiliência: a única conta de qual é, e que `createLLMGateway` e `destinoDoAdaptador` dividem. */
function adaptadorInterno(config: LLMConfig): ModelAdapter {
  if (config.adaptador === 'openai_compat' && config.modelo === undefined) throw new InvalidConfigError(['LLM_BASE_URL', 'LLM_MODELO'])
  // A latência simulada é só do adaptador falso (teste de carga, regra 80, item 11): o do provedor tem a do provedor.
  if (config.modelo !== undefined) return new OpenAICompatAdapter(config.modelo)
  return new FakeAdapter({
    ...(config.latenciaFalsaMs === undefined ? {} : { latenciaMs: config.latenciaFalsaMs }),
    ...(config.latenciaFalsaMsPadrao === undefined ? {} : { latenciaMsPadrao: config.latenciaFalsaMsPadrao }),
    ...(config.tokensFalsos === undefined ? {} : { tokens: config.tokensFalsos }),
  })
}

/**
 * Para onde a configuração manda o conteúdo (a origem, o envio externo e o provedor, o modelo de cada perfil), **sem montar o gateway**: é o que a linha
 * estimada da execução interrompida lê (`consumoEstimadoDaInterrompida`). Sai da mesma conta de `createLLMGateway`, e por isso não diverge do que a
 * chamada de verdade registraria.
 */
export function destinoDoAdaptador(config: LLMConfig): DestinoDoAdaptador {
  const interno = adaptadorInterno(config)
  return { origem: interno.origem, envio: interno.envio, modeloDoPerfil: (perfil) => interno.modeloDoPerfil(perfil) }
}
