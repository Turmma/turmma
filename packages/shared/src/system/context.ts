import { z } from 'zod'
import { PAPEIS_DE_USUARIO } from '../permissao/matriz.js'

/**
 * Corpo de `GET /v1/sistema/contexto`: a escola, o usuário, o papel e a sessão que a API leu da sessão gravada,
 * e o ano letivo em curso da escola, nulo quando ela não tem. Só ids e o papel. Estrito: nada além destes
 * campos sai na resposta.
 */
export const contextResponseSchema = z
  .object({
    escolaId: z.uuid(),
    usuarioId: z.uuid(),
    papel: z.enum(PAPEIS_DE_USUARIO),
    sessaoId: z.uuid(),
    anoLetivoId: z.uuid().nullable(),
  })
  .strict()

export type ContextResponse = z.infer<typeof contextResponseSchema>
