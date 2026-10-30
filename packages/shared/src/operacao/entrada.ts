import { z } from 'zod'
import { TAMANHO_MAXIMO_EMAIL, TAMANHO_MAXIMO_SENHA } from '../sessao/login.js'

/**
 * Corpo de `POST /v1/operacao/sessao/email` (Tech Spec da A0, seção 4): o e-mail e a senha do operador, com os tetos do
 * login do F1. Estrito: nada além dos dois.
 */
export const entradaDeOperadorRequestSchema = z
  .object({
    email: z.string().trim().min(3).max(TAMANHO_MAXIMO_EMAIL),
    senha: z.string().min(1).max(TAMANHO_MAXIMO_SENHA),
  })
  .strict()

export type EntradaDeOperadorRequest = z.infer<typeof entradaDeOperadorRequestSchema>

/**
 * Resposta 200 da entrada: a etapa seguinte e o desafio de operador (`desafio-operador+jwt`, 5 min) que leva a ela, sem
 * sessão e sem cookie. `mfa` com o segundo fator ativo; `configurar_mfa` só até 72 h depois do aceite do convite e sem
 * o segundo fator ativo (Tech Spec da A0, seção 5, "Etapas"). Sai com `no-store`. Nada mais: nem o operador, nem o
 * apelido.
 */
export const entradaDeOperadorResponseSchema = z
  .object({
    etapa: z.enum(['configurar_mfa', 'mfa']),
    desafio: z.string().min(1),
  })
  .strict()

export type EntradaDeOperadorResponse = z.infer<typeof entradaDeOperadorResponseSchema>
