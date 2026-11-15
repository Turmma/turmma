import type { JobFailureCode } from '@educa/shared'

/**
 * Falha prevista de um processador, com código tipado. `definitiva` pula as tentativas que
 * restam: repetir um tipo desconhecido ou dado inválido não muda o resultado.
 *
 * A mensagem é o próprio código. O BullMQ grava a mensagem no Redis, e nenhum valor de campo pode ir junto.
 */
export class JobFailureError extends Error {
  constructor(
    readonly codigo: JobFailureCode,
    readonly definitiva = false,
  ) {
    super(codigo)
    this.name = 'JobFailureError'
  }
}
