/** Por que o processador pediu para adiar: o teto do minuto, o Redis de fila fora, ou a reserva de outro processo ainda vigente. */
export type MotivoDoAdiamento = 'limite' | 'redis' | 'reserva_alheia'

/**
 * O processador não pôde fazer o trabalho **agora**, e isso não é falha: o `JobExecutor` devolve o job à espera da fila, libera a vaga da
 * escola, volta a linha a `publicado` e não gasta tentativa nem uso. O que espera é `baseMs` mais o sorteio do executor (até 5 s), para os
 * jobs adiados pelo mesmo teto não acordarem juntos.
 *
 * A mensagem é só o motivo: nada do job vai ao Redis.
 */
export class JobAdiadoError extends Error {
  constructor(
    readonly baseMs: number,
    readonly motivo: MotivoDoAdiamento,
  ) {
    super(motivo)
    this.name = 'JobAdiadoError'
  }
}
