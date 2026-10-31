import { ErrorCode } from '@educa/shared'
import { DomainException } from './domain.exception.js'
import { postgresErrorIn } from './summarize-error.js'

/** SQLSTATE que viram erro que o usuário entende. Todo o resto é `ERRO_INTERNO`. */
const CODIGO_DO_SQLSTATE: Readonly<Record<string, ErrorCode>> = {
  // unique_violation: "Enzo Martins já existe"; o valor vem no `detail`, que nunca sai daqui.
  '23505': ErrorCode.CONFLITO,
  // query_canceled: o statement_timeout do servidor cortou a consulta.
  '57014': ErrorCode.TEMPO_ESGOTADO,
}

/**
 * Traduz um erro do Postgres em `DomainException`. O erro traduzido não carrega nada do original:
 * nem `message`, nem `detail`, nem `where`, nem a consulta que o Drizzle anexa. Devolve `undefined` se não
 * for erro do Postgres, solto ou embrulhado pelo Drizzle.
 */
export function mapPostgresError(erro: unknown): DomainException | undefined {
  const doPostgres = postgresErrorIn(erro)
  if (doPostgres === undefined) return undefined
  return new DomainException(CODIGO_DO_SQLSTATE[doPostgres.code] ?? ErrorCode.ERRO_INTERNO)
}
