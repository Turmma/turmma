import { LIMITES_DO_HISTOGRAMA_HTTP_S, METRICS, type Meter } from '@educa/core'

/** O rótulo `metodo` de `login.duracao`: só os dois logins que conferem senha. */
export type MetodoDoLogin = 'email' | 'matricula'

/**
 * `login.duracao{metodo}` (Tech Spec da identidade, seção 7c; regra 80, item 10): do pedido à resposta, com qualquer
 * desfecho, inclusive o 503 do semáforo e a conta segurada. É o p95 dela que o alerta `login-lento` olha. Os limites
 * do histograma são os do HTTP, que têm 1 s, o limiar do alerta, como fronteira.
 */
export class LoginDurationHistogram {
  readonly #histograma: ReturnType<Meter['createHistogram']>

  constructor(
    medidor: Meter,
    private readonly metodo: MetodoDoLogin,
  ) {
    this.#histograma = medidor.createHistogram(METRICS.duracaoDoLogin, {
      unit: 's',
      description: 'Duração do login por e-mail ou matrícula, do pedido à resposta',
      advice: { explicitBucketBoundaries: LIMITES_DO_HISTOGRAMA_HTTP_S },
    })
  }

  async medir<T>(login: () => Promise<T>): Promise<T> {
    const inicio = performance.now()
    try {
      return await login()
    } finally {
      this.#histograma.record((performance.now() - inicio) / 1_000, { metodo: this.metodo })
    }
  }
}
