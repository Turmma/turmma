/**
 * Por que o processador pediu para adiar: o teto do minuto, o Redis de fila fora, a reserva de outro processo ainda vigente, o horário letivo da escola (o lote não urgente que voltou dentro dele), o provedor de IA
 * (balde de tokens cheio, disjuntor aberto, provedor fora) ou o teto de segurança do orçamento de IA da escola no mês (camada-ia, 4.0: só o lote, até a virada do mês ou até o teto subir).
 */
export type MotivoDoAdiamento = 'limite' | 'redis' | 'reserva_alheia' | 'janela' | 'provedor' | 'orcamento'

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
