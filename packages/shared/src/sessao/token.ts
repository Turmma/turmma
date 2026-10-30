import { z } from 'zod'

/**
 * O token opaco dos links que o sistema entrega uma vez: o do convite (coordenação e professor) e o do link da sala
 * (A1, 4.0). São 32 bytes sorteados, em base64url sem preenchimento; o banco guarda só o SHA-256 (`hashDoToken`, na API).
 */
export const tokenDeLinkSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
