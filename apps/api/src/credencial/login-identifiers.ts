import { createHash } from 'node:crypto'

/** Bytes do refresh: 256 bits sorteados. O banco guarda só o SHA-256, e o cookie leva o valor. */
export const BYTES_DO_REFRESH = 32

/** O e-mail como a conta o guarda (`citext`): sem espaço nas pontas e sem diferença de caixa. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** O SHA-256 do refresh do cookie `educa_sessao`: é o que `sessao.refresh_hash` guarda e a renovação (5.0) procura. */
export function hashDoRefresh(refresh: string): string {
  return createHash('sha256').update(refresh).digest('hex')
}
