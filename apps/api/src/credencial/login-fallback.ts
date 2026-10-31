/** Uma fonte da proporção do seguro: quanto do que ela contou na janela recente foi atendido sem o Redis de fila. */
export interface FonteDoSeguro {
  readonly proporcaoDoSeguro: number
}

/**
 * O seguro do login no Redis de fila, numa fonte só para `limite.seguro_ativo` (tarefa 15.3): o contador de tentativas,
 * os contadores por IP (rebaixamento na matrícula e limite na rota de e-mail) e o desafio recusado sem Redis (15.5).
 * Vale a maior das proporções: basta uma delas estar sem o Redis para o alerta "Seguro de limite ativo" saber.
 */
export class SeguroDoLogin implements FonteDoSeguro {
  readonly #fontes: readonly FonteDoSeguro[]

  constructor(...fontes: readonly FonteDoSeguro[]) {
    this.#fontes = fontes
  }

  get proporcaoDoSeguro(): number {
    return Math.max(0, ...this.#fontes.map((fonte) => fonte.proporcaoDoSeguro))
  }
}
