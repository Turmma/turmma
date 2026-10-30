import { z } from 'zod'
import { tokenDeLinkSchema } from '../sessao/token.js'

/**
 * O acesso da turma (A1, tarefa 4.0, RF9; Tech Spec da A1, seções 3 e 4): o link da sala e o código da turma, que o
 * professor com vínculo confirmado gera e o aluno usa para reivindicar o nome. Os dois valem juntos, pela mesma
 * validade, e "Gerar novo" derruba os anteriores da turma.
 */

/** As validades que o professor escolhe, em dias. O padrão da tela (7) entra com ela, na 15.0. */
export const VALIDADES_DO_ACESSO_DIAS = [1, 7, 30] as const

export type ValidadeDoAcessoDias = (typeof VALIDADES_DO_ACESSO_DIAS)[number]

/**
 * O alfabeto do código da turma: 31 caracteres, sem 0, 1, I, L e O, que se confundem na lousa e no projetor. Oito deles
 * dão 31⁸ ≈ 8,5 × 10¹¹ códigos (Tech Spec da A1, seção 3).
 */
export const ALFABETO_DO_CODIGO_DA_TURMA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export const TAMANHO_DO_CODIGO_DA_TURMA = 8

const FORMATO_DO_CODIGO_DA_TURMA = new RegExp(`^[${ALFABETO_DO_CODIGO_DA_TURMA}]{${String(TAMANHO_DO_CODIGO_DA_TURMA)}}$`)

/**
 * O código como o aluno o digitou, na forma em que ele é conferido: sem espaço (também o do meio dos dois grupos), sem
 * hífen e em maiúsculas. Não recusa nada: um caractere fora do alfabeto continua lá, e a busca pelo código não acha
 * (o aluno recebe a mesma resposta do código errado). A página pública (17.0) e a API (5.0) usam esta mesma função.
 */
export function normalizarCodigoDaTurma(digitado: string): string {
  return digitado.replace(/[\s-]/g, '').toUpperCase()
}

/** Se o texto já normalizado tem a forma de um código da turma: oito caracteres do alfabeto. */
export function codigoDaTurmaValido(normalizado: string): boolean {
  return FORMATO_DO_CODIGO_DA_TURMA.test(normalizado)
}

/** O código em dois grupos de quatro, como a tela o projeta: `ABCD2345` vira `ABCD 2345`. */
export function exibirCodigoDaTurma(codigo: string): string {
  return `${codigo.slice(0, 4)} ${codigo.slice(4)}`
}

/**
 * Corpo de `POST /v1/turmas/:id/acesso`: a validade, 1, 7 ou 30 dias. Estrito: campo a mais, como `escolaId` ou
 * `turmaId`, é `ENTRADA_INVALIDA`; a turma vem do caminho e a escola, da sessão.
 */
export const gerarAcessoRequestSchema = z.strictObject({
  validadeDias: z.literal(VALIDADES_DO_ACESSO_DIAS),
})

export type GerarAcessoRequest = z.infer<typeof gerarAcessoRequestSchema>

/** Corpo de `POST /v1/turmas/:id/acesso/revogar`: nenhum campo, `{}` ou corpo nenhum. */
export const revogarAcessoRequestSchema = z.strictObject({})

/**
 * Resposta de `POST /v1/turmas/:id/acesso`, a única que traz o link e o código (sai com `no-store`): o token do link da
 * sala, com que a web monta `/e/<slug>/turma#<token>` (o slug a web já tem, de `/v1/eu`), o código da turma, sem os
 * espaços (a tela o mostra com `exibirCodigoDaTurma`), e até quando os dois valem. O banco guarda só o SHA-256 do token
 * e o HMAC do código. Estrito: nada de aluno, nada da turma.
 */
export const acessoGeradoResponseSchema = z.strictObject({
  token: tokenDeLinkSchema,
  codigo: z.string().regex(FORMATO_DO_CODIGO_DA_TURMA),
  expiraEm: z.iso.datetime(),
})

export type AcessoGeradoResponse = z.infer<typeof acessoGeradoResponseSchema>

/**
 * Resposta de `GET /v1/turmas/:id/acesso`: só até quando vale o acesso vigente da turma, ou `null` quando não há
 * nenhum (revogado, vencido ou nunca gerado). O link e o código não voltam: aparecem uma vez, na resposta que os cria.
 */
export const acessoDaTurmaResponseSchema = z.strictObject({
  expiraEm: z.iso.datetime().nullable(),
})

export type AcessoDaTurmaResponse = z.infer<typeof acessoDaTurmaResponseSchema>
