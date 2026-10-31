export const MOTIVOS_DE_RECUSA_DA_AUDITORIA = [
  /** Gravação ou leitura fora de um contexto: sem ele não há requisição nem escola. */
  'sem_contexto',
  'acao_desconhecida',
  /** `antes`, `depois`, `entidadeId` ou `finalidade` fora da lista fechada da ação. */
  'dados_fora_do_schema',
  /** Nem usuário no contexto, nem operador válido. */
  'sem_autor',
  /** Operador informado com usuário no contexto: o operador só age em rotina nossa, sem usuário. */
  'operador_com_usuario',
  /** Sem escola no contexto: na gravação, a ação não é a da rede criada pelo operador; na leitura, sempre. */
  'sem_escola',
] as const

export type AuditoriaRejectionReason = (typeof MOTIVOS_DE_RECUSA_DA_AUDITORIA)[number]

/**
 * Gravação ou leitura de auditoria recusada. É erro de programação, não do usuário, e a transação de quem
 * chamou desfaz junto. A mensagem leva só o motivo: nunca o campo recebido nem o valor dele.
 */
export class AuditoriaRejectedError extends Error {
  constructor(readonly motivo: AuditoriaRejectionReason) {
    super(`auditoria.recusada: ${motivo}`)
    this.name = 'AuditoriaRejectedError'
  }
}
