import {
  BrokenCircuitError,
  circuitBreaker,
  CircuitState,
  ConsecutiveBreaker,
  DelegateBackoff,
  handleWhen,
  retry,
  TaskCancelledError,
  timeout,
  TimeoutStrategy,
  wrap,
  type IDefaultPolicyContext,
  type IPolicy,
} from 'cockatiel'
import type { Meter } from '@opentelemetry/api'
import { METRICS } from '../telemetry/metrics.js'
import type { ModelAdapter, ModelCall, ModelResponse } from './adapter.js'
import { LLMError, ProviderError, type ProviderFailure } from './errors.js'
import type { Perfil } from './perfis.js'
import type { EnvioDaChamada } from './port.js'

/** Quantas falhas seguidas abrem o disjuntor (`onda-3c.md`, T10). */
const FALHAS_PARA_ABRIR_O_DISJUNTOR = 5
/** Quanto o disjuntor aberto espera antes de deixar passar uma chamada de teste (e quanto o job do `lote` espera quando o provedor não diz quando volta). */
export const MEIO_ABRE_O_DISJUNTOR_EM_MS = 30_000
/** Só o `rapido` tem chamada lenta: acima de metade do prazo dele a chamada vale, mas pesa no disjuntor. */
const PERFIL_COM_CHAMADA_LENTA: Perfil = 'rapido'

export interface ResiliencePolicy {
  /** O prazo de cada perfil. Cobre a chamada **e** a repetição. */
  readonly prazosMs: Readonly<Record<Perfil, number>>
  /** Espera antes da única repetição, quando o provedor não disse quanto (com jitter). */
  readonly recuoMs: number
  /** Sorteio do jitter, entre 0 e 1 (`Math.random`). O teste o fixa. */
  readonly aleatorio: () => number
  /** Onde `ia.disjuntor.aberto{provedor,modelo,perfil}` é observada (10.0). Sem ele o disjuntor vale do mesmo jeito, só sem a métrica. */
  readonly medidor?: Meter
}

/** O estado de um disjuntor, como a métrica o lê: o modelo e o perfil são os da chave dele, e `aberto` é 1 enquanto não está fechado. */
interface EstadoDoDisjuntor {
  readonly modelo: string
  readonly perfil: Perfil
  aberto: 0 | 1
}

interface Tentativa {
  readonly resposta: ModelResponse
  /** Chamada do `rapido` acima de metade do prazo: devolve a resposta, e pesa no disjuntor como uma falha. */
  readonly lenta: boolean
}

type Resiliencia = IPolicy<IDefaultPolicyContext, never>

/** Quem chamou desistiu (o sinal dele): não é falha do provedor, não repete e não pesa no disjuntor. */
class ChamadaCancelada extends Error {}

/** O que o adaptador contou. O erro de IA que não é dele (a entrada inválida, o material insuficiente) não é falha do provedor. */
function falhaDe(erro: unknown): ProviderFailure | undefined {
  if (erro instanceof ProviderError) return erro.falha
  if (erro instanceof LLMError && erro.codigoDeIa === 'IA_INDISPONIVEL') return 'servidor'
  if (erro instanceof LLMError && erro.codigoDeIa === 'IA_TEMPO_ESGOTADO') return 'tempo'
  return undefined
}

/** 5xx, timeout e conexão recusada abrem o disjuntor. O 429 e o outro 4xx não: o provedor está de pé, só recusou. */
function pesaNoDisjuntor(erro: unknown): boolean {
  const falha = falhaDe(erro)
  return falha === 'servidor' || falha === 'recusada' || falha === 'tempo'
}

/** O `Retry-After` do 429 em segundos, quando o provedor o mandou. */
function esperaSugeridaMs(erro: unknown): number | undefined {
  return erro instanceof ProviderError && erro.tenteDeNovoEmSegundos !== undefined ? erro.tenteDeNovoEmSegundos * 1_000 : undefined
}

/**
 * Troca pelo `LLMError` simples o que é de dentro desta camada: o `ProviderError`, que leva a classificação, e o erro do
 * `cockatiel` (`TaskCancelledError`, `BrokenCircuitError`), que tem texto próprio e não é código do contrato. O resto passa
 * como veio (a `ChamadaCancelada` só chega até aqui se o prazo não tiver respondido primeiro, e não chega: o `Aggressive`
 * responde antes), e o `LLMGateway`, acima, cobre qualquer erro que não seja `LLMError`.
 */
function traduzir(erro: unknown): unknown {
  if (erro instanceof ProviderError) return new LLMError(erro.codigoDeIa, erro.tenteDeNovoEmSegundos)
  if (erro instanceof BrokenCircuitError) return new LLMError('IA_INDISPONIVEL', undefined, 'disjuntor')
  // O prazo vencido e a desistência de quem chamou abortam o mesmo sinal, e a política de prazo é quem responde primeiro.
  if (erro instanceof TaskCancelledError) return new LLMError('IA_TEMPO_ESGOTADO')
  return erro
}

/**
 * Decora o adaptador do provedor com prazo, uma repetição e disjuntor (regra 30, item 8; regra 80, item 4), pelo
 * `cockatiel` (D81). Provedor lento, que recusa ou que caiu não derruba a aula: a chamada falha cedo, com erro tipado,
 * e o aluno nunca vê o erro do provedor.
 *
 * - **A ordem** é `wrap(prazo, disjuntor, repetição)`: o prazo é o de fora e cobre a chamada e a repetição; o sinal dele
 *   aborta o `fetch` e a espera da repetição.
 * - **A repetição** é uma, com jitter, só no que não cobrou: 429 e conexão recusada. Timeout e 5xx podem ter cobrado
 *   e não se repetem. Um 429 com `Retry-After` além do prazo não se repete: a espera vai para quem chamou.
 * - **O disjuntor** é por provedor, modelo **e perfil**: o `LLM_MODELO` é um só, e o Tutor (`rapido`) não pode cair
 *   porque a ferramenta (`padrao`) estourou o prazo. Abre com cinco falhas seguidas, meio-abre em 30 s. Em memória,
 *   por réplica, de propósito: é saúde local do provedor, a exceção declarada à regra 80, item 5 (Tech Spec da X5,
 *   `onda-3c.md` T10 e ADR da onda 6).
 */
export class ResilientAdapter implements ModelAdapter {
  readonly origem: ModelAdapter['origem']
  readonly envio: EnvioDaChamada
  private readonly politicas = new Map<string, Resiliencia>()
  private readonly estados = new Map<string, EstadoDoDisjuntor>()

  constructor(
    private readonly interno: ModelAdapter,
    private readonly politica: ResiliencePolicy,
  ) {
    this.origem = interno.origem
    this.envio = interno.envio
    const provedor = interno.envio.provedorId ?? interno.origem
    politica.medidor?.createObservableGauge(METRICS.disjuntorDeIaAberto, { description: '1 enquanto o disjuntor do modelo e do perfil não está fechado, por provedor, modelo e perfil' }).addCallback((observador) => {
      for (const estado of this.estados.values()) observador.observe(estado.aberto, { provedor, modelo: estado.modelo, perfil: estado.perfil })
    })
  }

  modeloDoPerfil(perfil: Perfil): string {
    return this.interno.modeloDoPerfil(perfil)
  }

  async chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
    const perfil = chamada.tarefa.perfil
    try {
      const { resposta } = await this.resiliencia(perfil, chamada.modelo ?? this.interno.modeloDoPerfil(perfil)).execute((contexto) => this.attempt(chamada, contexto.signal), chamada.sinal)
      return resposta
    } catch (erro) {
      throw traduzir(erro)
    }
  }

  /** Uma tentativa. O `cockatiel` não corta a espera da repetição, e por isso uma tentativa que começa com o prazo já vencido não sai. */
  private async attempt<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>, sinal: AbortSignal): Promise<Tentativa> {
    if (sinal.aborted) throw new ChamadaCancelada()
    const perfil = chamada.tarefa.perfil
    const inicio = Date.now()
    try {
      const resposta = await this.interno.chamar({ ...chamada, sinal })
      return { resposta, lenta: perfil === PERFIL_COM_CHAMADA_LENTA && Date.now() - inicio > this.politica.prazosMs[perfil] / 2 }
    } catch (erro) {
      // Quem chamou cancelou: o `fetch` abortado volta como "tempo esgotado", e isso não é o provedor que demorou.
      if (chamada.sinal.aborted) throw new ChamadaCancelada()
      throw erro
    }
  }

  /**
   * Um disjuntor por modelo e perfil, criado na primeira chamada e mantido: ele só vale compartilhado. O provedor é
   * o desta instância (uma por `createLLMGateway`), e por isso não entra na chave. O modelo é o que atende a chamada: o menor do degrau (49.0) tem o seu.
   */
  private resiliencia(perfil: Perfil, modelo: string): Resiliencia {
    const chave = `${modelo}|${perfil}`
    const guardada = this.politicas.get(chave)
    if (guardada !== undefined) return guardada
    const prazoMs = this.politica.prazosMs[perfil]
    const repeticao = retry(
      // O 429 com espera maior que o prazo não se repete: a repetição nasceria já sem tempo.
      handleWhen((erro) => {
        const falha = falhaDe(erro)
        if (falha === 'recusada') return true
        const sugerida = esperaSugeridaMs(erro)
        return falha === 'limite' && (sugerida === undefined || sugerida < prazoMs)
      }),
      {
        maxAttempts: 1,
        backoff: new DelegateBackoff((contexto) => {
          // Só o erro é tratado pela repetição (`handleWhen`), e por isso o resultado que chega aqui é sempre um erro.
          const sugerida = esperaSugeridaMs((contexto.result as { error: unknown }).error)
          // Jitter de meio recuo para baixo: nunca passa do recuo, que cabe no prazo (a subida confere), e a escola inteira não volta no mesmo instante.
          return sugerida ?? this.politica.recuoMs * (0.5 + 0.5 * this.politica.aleatorio())
        }),
      },
    )
    const disjuntor = circuitBreaker(
      handleWhen(pesaNoDisjuntor).orWhenResult((resultado) => (resultado as Tentativa).lenta),
      { breaker: new ConsecutiveBreaker(FALHAS_PARA_ABRIR_O_DISJUNTOR), halfOpenAfter: MEIO_ABRE_O_DISJUNTOR_EM_MS },
    )
    // Meio aberto ainda é "não fechado": o provedor só volta a valer depois da chamada de teste, e o alerta de provedor fora não oscila a cada 30 s.
    const estado: EstadoDoDisjuntor = { modelo, perfil, aberto: 0 }
    this.estados.set(chave, estado)
    disjuntor.onStateChange((novo) => {
      estado.aberto = novo === CircuitState.Closed ? 0 : 1
    })
    const criada = wrap(timeout(prazoMs, TimeoutStrategy.Aggressive), disjuntor, repeticao)
    this.politicas.set(chave, criada)
    return criada
  }
}
