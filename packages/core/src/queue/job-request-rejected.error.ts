import type { JobType } from '@educa/shared'

/**
 * Por que o `JobOutbox` recusou um pedido, antes de gravar. Lista fechada: o motivo nunca é texto livre.
 *
 * - `DADOS_INVALIDOS`: o payload não passa no esquema estrito do tipo (falta campo, formato errado, chave a mais).
 * - `FILA_FORA_DA_DEFINICAO`: a fila pedida não está nas `filas` do tipo.
 * - `NAO_URGENTE_FIXO`: o tipo fixa o `naoUrgente`, e quem enfileira tentou escolher.
 * - `NAO_URGENTE_AUSENTE`: o tipo deixa o `naoUrgente` com quem enfileira (`'do-pedido'`), e ele não veio.
 */
export const JobRejectionReason = {
  DADOS_INVALIDOS: 'DADOS_INVALIDOS',
  FILA_FORA_DA_DEFINICAO: 'FILA_FORA_DA_DEFINICAO',
  NAO_URGENTE_FIXO: 'NAO_URGENTE_FIXO',
  NAO_URGENTE_AUSENTE: 'NAO_URGENTE_AUSENTE',
} as const

export type JobRejectionReason = (typeof JobRejectionReason)[keyof typeof JobRejectionReason]

/**
 * O pedido de job que a definição do tipo recusa (`JOB_DEFINITIONS`). É defeito de quem chamou, e não erro do usuário: não
 * é um `DomainException`, e a API o responde como erro interno. Leva só o tipo e o motivo, os dois fixos: o payload recusado
 * carrega o que o esquema não quis, e as `issues` do zod repetem chave e valor (regra 20, itens 9 e 11).
 */
export class JobRequestRejectedError extends Error {
  override readonly name = 'JobRequestRejectedError'
  readonly tipo: JobType
  readonly motivo: JobRejectionReason

  constructor(tipo: JobType, motivo: JobRejectionReason) {
    super(`pedido de job recusado: ${tipo} (${motivo})`)
    this.tipo = tipo
    this.motivo = motivo
  }
}
