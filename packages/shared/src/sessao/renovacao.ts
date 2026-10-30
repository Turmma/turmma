import { z } from 'zod'

/**
 * Resposta 200 de `POST /v1/sessao/renovar`: o token de acesso novo, de 10 min, que a web guarda só em memória. O
 * cookie `educa_sessao` novo vai no cabeçalho, nunca no corpo.
 */
export const renovacaoResponseSchema = z.object({ token: z.string().min(1), expiraEm: z.iso.datetime() }).strict()

export type RenovacaoResponse = z.infer<typeof renovacaoResponseSchema>

/**
 * Janela em que o cookie anterior ainda é "outra aba renovando junto", e não "a resposta se perdeu" (Tech Spec,
 * seção 5, "Renovar"). As duas situações chegam à API com o mesmo hash anterior, e só o tempo desde a rotação as
 * separa: dentro da janela, 409 `JA_RENOVADO`; depois dela, a API rotaciona de novo.
 *
 * Fica no contrato porque os dois lados dependem do mesmo número: a API decide com ele, e a web espera mais que ele
 * antes de repetir a renovação depois de um 409 (18.0). Dois valores diferentes deslogariam a pessoa.
 */
export const JANELA_DE_RENOVACAO_SIMULTANEA_MS = 2_000
