import { randomBytes } from 'node:crypto'

/**
 * Um UUIDv7 (RFC 9562) feito na aplicação: 48 bits de milissegundos, versão 7, variante 10 e 74 bits ao acaso. O envio do material precisa
 * do id **antes** da linha, porque o objeto do storage leva o id na chave (`chaveDoTemporario`) e é gravado antes da transação. Ordenado no
 * tempo, como o `uuidv7()` do Postgres que as outras tabelas usam, e sem entregar volume: não é sequencial.
 */
export function uuidV7(agoraMs: number = Date.now()): string {
  const bytes = randomBytes(16)
  bytes.writeUIntBE(agoraMs, 0, 6)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
