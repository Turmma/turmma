import { z } from 'zod'

/** Os provedores de conta da escola que a tela `/e/:slug` oferece como botão (13.0). */
export const PROVEDORES_DE_CONTA_DA_ESCOLA = ['google', 'microsoft'] as const
export type ProvedorDeContaDaEscola = (typeof PROVEDORES_DE_CONTA_DA_ESCOLA)[number]

/**
 * Corpo de `GET /v1/escolas/:slug/acesso`, anônima: o nome da escola e os tipos de provedor que ela liberou. Estrito:
 * nunca o domínio (`hd`) nem o tenant (`tid`), que ficam no servidor, e nada de pessoa.
 */
export const acessoDaEscolaResponseSchema = z
  .object({
    nome: z.string().min(1),
    provedores: z.array(z.enum(PROVEDORES_DE_CONTA_DA_ESCOLA)),
  })
  .strict()

export type AcessoDaEscolaResponse = z.infer<typeof acessoDaEscolaResponseSchema>
