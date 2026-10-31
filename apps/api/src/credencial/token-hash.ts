import { createHash } from 'node:crypto'

// O token dos convites (o do coordenador, F1, e o do operador, A0): 256 bits sorteados, em base64url no link, e só o
// SHA-256 em hex no banco. Arquivo sem outra dependência além do `node:crypto`, para a semente do e2e usar a mesma peça
// que o comando e o aceite usam, em vez de repetir o hash (tarefa 10.0 da A0b).

/** Bytes do token do convite: 256 bits sorteados. O banco guarda só o SHA-256, e o link leva o valor. */
export const BYTES_DO_TOKEN_DE_CONVITE = 32

/** O SHA-256 do token, em hex: é o que `convite.token_hash` e `convite_operador.token_hash` guardam e o aceite procura. */
export function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
