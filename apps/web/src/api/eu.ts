import { euResponseSchema, introducaoResponseSchema, type IntroducaoResponse } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { authedGet, authedRequest } from './sessao'

/** Quem está na sessão, na escola dela (`GET /v1/eu`). É a consulta que prova que o token da sessão vale. */
export const euQueryOptions = queryOptions({
  queryKey: ['eu'],
  queryFn: ({ signal }) => authedGet('/v1/eu', euResponseSchema, signal),
})

/**
 * `POST /v1/eu/introducao`: a pessoa marca que viu a introdução. Corpo vazio e estrito; a resposta é a primeira data que
 * ficou gravada, a mesma que o `GET /v1/eu` devolve. Repetir não muda nada.
 */
export function concluirIntroducao(): Promise<IntroducaoResponse> {
  return authedRequest('/v1/eu/introducao', introducaoResponseSchema, { metodo: 'POST', corpo: {} })
}
