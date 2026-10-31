import { randomBytes } from 'node:crypto'
import { BYTES_DO_TOKEN_DE_CONVITE, hashDoToken } from '../credencial/token-hash.js'

// O token do convite de operador é a mesma peça do convite do coordenador (F1), de `../credencial/token-hash.ts`: 256 bits
// sorteados, em base64url, e o banco guarda só o SHA-256 em hex. Uma implementação só, para o comando que gera e o aceite
// que procura não divergirem.

/** Um token novo, em base64url, para o link do convite de operador. O valor vai para o arquivo 0600 do comando. */
export function sortearTokenDeConvite(): string {
  return randomBytes(BYTES_DO_TOKEN_DE_CONVITE).toString('base64url')
}

/** O SHA-256 do token, em hex: é o que `convite_operador.token_hash` guarda e o aceite procura. */
export const hashDoTokenDeConvite: (token: string) => string = hashDoToken
