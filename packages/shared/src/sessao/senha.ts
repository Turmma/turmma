import { z } from 'zod'
import { TAMANHO_MAXIMO_TOKEN_DE_CONVITE, TAMANHO_MINIMO_SENHA_NOVA } from './convite.js'
import { TAMANHO_MAXIMO_EMAIL, TAMANHO_MAXIMO_SENHA } from './login.js'

/**
 * Corpo de `POST /v1/senha/esqueci` (acesso-e-convites, tarefa 5.0; RF12): só o e-mail. A resposta é 202, igual exista ou não a conta
 * (Tech Spec, seção 5, "Esqueci"), então o corpo não tem nada a mais para dizer.
 */
export const esqueciSenhaRequestSchema = z.object({ email: z.string().trim().min(3).max(TAMANHO_MAXIMO_EMAIL) }).strict()

export type EsqueciSenhaRequest = z.infer<typeof esqueciSenhaRequestSchema>

/**
 * Corpo de `POST /v1/senha/redefinir`: o token do link, que a web lê do fragmento e manda aqui (nunca na URL da API), e a senha nova,
 * com o mínimo do aceite do convite. Token de outro formato é tratado como inexistente, com a mesma resposta.
 */
export const redefinirSenhaRequestSchema = z
  .object({
    token: z.string().min(1).max(TAMANHO_MAXIMO_TOKEN_DE_CONVITE),
    senha: z.string().min(TAMANHO_MINIMO_SENHA_NOVA).max(TAMANHO_MAXIMO_SENHA),
  })
  .strict()

export type RedefinirSenhaRequest = z.infer<typeof redefinirSenhaRequestSchema>
