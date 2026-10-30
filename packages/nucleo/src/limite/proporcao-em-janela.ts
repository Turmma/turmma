/** Janela da proporção do seguro: amortece a troca Redis ↔ seguro de uma requisição para outra (6.0). */
export const JANELA_DA_PROPORCAO_DO_SEGURO_MS = 30_000
/** Fatias da janela. A proporção anda de fatia em fatia, e não some de uma vez quando a janela vira. */
export const FATIAS_DA_PROPORCAO_DO_SEGURO = 6

interface Fatia {
  inicio: number
  total: number
  marcadas: number
}

/**
 * Proporção de eventos marcados numa janela deslizante, em fatias de tempo fixas: quantas das
 * requisições limitadas nos últimos 30 s foram contadas pelo seguro em memória. Memória constante,
 * uma soma por evento, e nada de log a cada troca.
 *
 * Sem evento na janela, a proporção é 0: ninguém foi limitado pelo seguro. Redis fora sem tráfego
 * aparece em `redis.disponivel`.
 */
export class SlidingWindowRatio {
  readonly #fatias: Fatia[]
  readonly #duracaoDaFatiaMs: number

  constructor(
    janelaMs = JANELA_DA_PROPORCAO_DO_SEGURO_MS,
    quantidadeDeFatias = FATIAS_DA_PROPORCAO_DO_SEGURO,
    private readonly agora: () => number = () => performance.now(),
  ) {
    this.#duracaoDaFatiaMs = janelaMs / quantidadeDeFatias
    this.#fatias = Array.from({ length: quantidadeDeFatias }, () => ({ inicio: Number.NEGATIVE_INFINITY, total: 0, marcadas: 0 }))
  }

  registrar(marcado: boolean): void {
    const inicio = this.#inicioDaFatia(this.agora())
    const indice = Math.abs(Math.floor(inicio / this.#duracaoDaFatiaMs)) % this.#fatias.length
    let fatia = this.#fatias[indice]
    if (fatia === undefined) return
    if (fatia.inicio !== inicio) {
      fatia = { inicio, total: 0, marcadas: 0 }
      this.#fatias[indice] = fatia
    }
    fatia.total++
    if (marcado) fatia.marcadas++
  }

  /** De 0 a 1: marcados sobre o total das fatias que ainda estão dentro da janela. */
  valor(): number {
    const agora = this.agora()
    const inicioDaJanela = this.#inicioDaFatia(agora) - this.#duracaoDaFatiaMs * (this.#fatias.length - 1)
    let total = 0
    let marcadas = 0
    for (const fatia of this.#fatias) {
      if (fatia.inicio < inicioDaJanela || fatia.inicio > agora) continue
      total += fatia.total
      marcadas += fatia.marcadas
    }
    return total === 0 ? 0 : marcadas / total
  }

  #inicioDaFatia(instante: number): number {
    return Math.floor(instante / this.#duracaoDaFatiaMs) * this.#duracaoDaFatiaMs
  }
}
