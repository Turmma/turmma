import { meusVinculosResponseSchema, vinculoResponseSchema, type ContestarVinculoRequest, type VinculoResponse } from '@educa/shared'
import { infiniteQueryOptions } from '@tanstack/react-query'
import { authedGet, authedRequest } from '../../../../api/sessao'

const CAMINHO_DOS_MEUS_VINCULOS = '/v1/meus-vinculos'

/**
 * Os vínculos do professor da sessão, na escola ativa (`GET /v1/meus-vinculos`, RF4). A escola e o ano letivo vêm do
 * token, nunca da tela: esta consulta não tem como pedir os de outra escola.
 *
 * Paginada como a API entrega (regra 80, item 8): a primeira página cobre o professor de verdade, e `proxima` leva o
 * resto sem a tela nunca pedir a lista inteira.
 */
export const meusVinculosQueryOptions = infiniteQueryOptions({
  queryKey: ['meus-vinculos'],
  queryFn: ({ pageParam, signal }) =>
    authedGet(pageParam === undefined ? CAMINHO_DOS_MEUS_VINCULOS : `${CAMINHO_DOS_MEUS_VINCULOS}?pagina=${encodeURIComponent(pageParam)}`, meusVinculosResponseSchema, signal),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (ultima) => ultima.proxima,
})

/** `POST /v1/vinculos/:id/confirmar` (RF4): o professor confirma aquele vínculo, e só aquele. */
export function confirmarVinculo(id: string): Promise<VinculoResponse> {
  return authedRequest(`/v1/vinculos/${encodeURIComponent(id)}/confirmar`, vinculoResponseSchema, { metodo: 'POST' })
}

/**
 * `POST /v1/vinculos/:id/contestar` (RF4): o código do motivo e, quando a pessoa escreve, o complemento curto, que a
 * coordenação lê. A tela avisa para não escrever nome de aluno ali (regra 20).
 */
export function contestarVinculo(id: string, pedido: ContestarVinculoRequest): Promise<VinculoResponse> {
  return authedRequest(`/v1/vinculos/${encodeURIComponent(id)}/contestar`, vinculoResponseSchema, { metodo: 'POST', corpo: pedido })
}
