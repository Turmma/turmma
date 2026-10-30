import { z } from 'zod'

/**
 * Corpo de `POST /v1/operacao/sessao/renovar` e de `POST /v1/operacao/sessao/sair` (Tech Spec da A0, seção 4): nenhum.
 * A credencial é o cookie `turmma_operacao`, que só vai a `/v1/operacao/sessao`. Estrito: qualquer campo no corpo é
 * `ENTRADA_INVALIDA`, e nada do corpo escolhe a sessão.
 */
export const operadorEmptyBodyRequestSchema = z.object({}).strict()

export type OperadorEmptyBodyRequest = z.infer<typeof operadorEmptyBodyRequestSchema>

/**
 * Resposta 200 de `POST /v1/operacao/sessao/renovar`: o token de acesso de operador novo (`operador+jwt`, 10 min), que a
 * web guarda só em memória. O cookie `turmma_operacao` novo, quando a renovação rotaciona, vai no cabeçalho, nunca no
 * corpo. Sai com `no-store`. Estrito: nada da sessão nem do operador.
 */
export const renovacaoDeOperadorResponseSchema = z.object({ token: z.string().min(1), expiraEm: z.iso.datetime() }).strict()

export type RenovacaoDeOperadorResponse = z.infer<typeof renovacaoDeOperadorResponseSchema>
