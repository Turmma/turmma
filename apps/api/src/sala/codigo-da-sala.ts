import { ALFABETO_DO_CODIGO_DA_TURMA, normalizarCodigoDaTurma, TAMANHO_DO_CODIGO_DA_TURMA } from '@educa/shared'
import { createHmac, randomBytes, randomInt } from 'node:crypto'
import { BYTES_DO_TOKEN_DE_CONVITE } from '../credencial/index.js'

// O link da sala e o código da turma (A1, tarefa 4.0; Tech Spec da A1, seção 3). O token do link é a mesma peça do
// convite (`../credencial/token-hash.ts`): 256 bits sorteados, em base64url, e o banco guarda só o SHA-256 em hex. O
// código tem 8 caracteres do alfabeto de 31, e o banco guarda só o HMAC dele com `SALA_CHAVE_CODIGO`.

/** Quem sorteia o código: o de verdade em produção; o teste da colisão (C6) passa um que repete. */
export type SorteioDoCodigo = () => string

/** Um código novo: 8 sorteios independentes do alfabeto, pelo gerador criptográfico. */
export const sortearCodigoDaTurma: SorteioDoCodigo = () =>
  Array.from({ length: TAMANHO_DO_CODIGO_DA_TURMA }, () => ALFABETO_DO_CODIGO_DA_TURMA.charAt(randomInt(ALFABETO_DO_CODIGO_DA_TURMA.length))).join('')

/** Um token novo para o link da sala, em base64url. Vai só na resposta do gerar. */
export function sortearTokenDaSala(): string {
  return randomBytes(BYTES_DO_TOKEN_DE_CONVITE).toString('base64url')
}

/**
 * O HMAC-SHA256 do código com a chave da sala, em base64url: é o que `acesso_turma.codigo_hmac` guarda e a página
 * pública procura (5.0). O código passa antes por `normalizarCodigoDaTurma`, a mesma da página: `abcd-2345` e
 * `ABCD 2345` dão o mesmo HMAC.
 */
export function hmacDoCodigoDaTurma(chave: Uint8Array, codigo: string): string {
  return createHmac('sha256', chave).update(normalizarCodigoDaTurma(codigo)).digest('base64url')
}
