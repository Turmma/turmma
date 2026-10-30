import { z } from 'zod'

/**
 * Corpo de `POST /v1/sessao/escola` (tarefa 12.0): o usuário da mesma conta em que a pessoa quer entrar. Estrito: só o
 * id, e nunca a escola, que vem do banco depois de o id ser conferido contra a conta do desafio ou da sessão
 * (regra 10, item 3). A resposta é a do login (`loginResponseSchema`): `pronta` com o token, ou o desafio do segundo
 * fator quando o destino é a coordenação.
 */
export const trocaDeEscolaRequestSchema = z.object({ usuarioId: z.uuid() }).strict()

export type TrocaDeEscolaRequest = z.infer<typeof trocaDeEscolaRequestSchema>
