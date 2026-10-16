import { esquemaRespostaEu, esquemaRespostaIntroducao, type RespostaIntroducao } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { buscarComSessao, chamarComSessao } from './sessao'

/** Quem está na sessão, na escola dela (`GET /v1/eu`). É a consulta que prova que o token da sessão vale. */
export const consultaEu = queryOptions({
  queryKey: ['eu'],
  queryFn: ({ signal }) => buscarComSessao('/v1/eu', esquemaRespostaEu, signal),
})

/**
 * Marca que a pessoa viu a introdução (`POST /v1/eu/introducao`). Corpo vazio: a data vem do servidor, e a resposta é a
 * mesma que o `GET /v1/eu` devolveria. Quem chama põe a resposta no cache `['eu']`.
 */
export function concluirIntroducao(): Promise<RespostaIntroducao> {
  return chamarComSessao('/v1/eu/introducao', esquemaRespostaIntroducao, { metodo: 'POST', corpo: {} })
}
