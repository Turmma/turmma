import { semanaResponseSchema } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { SEMANA_QUERY_KEY } from '../../../../api/chaves-do-professor'
import { authedGet } from '../../../../api/sessao'

/**
 * A semana da professora (`GET /v1/semana?segunda=`, F2b): as aulas dela na escola ativa e no ano em curso, de segunda a
 * domingo, com o texto de cada uma. A escola, o ano e a professora vêm da sessão, nunca do pedido (regra 10, item 3). A chave leva a
 * segunda-feira: cada semana é uma consulta, e a resposta lenta de uma não ocupa o lugar da outra. Só se lê com a aba Semana aberta, e
 * a troca de escola ou de pessoa esvazia o cache (`main.tsx`).
 */
export function semanaQueryOptions(segunda: string) {
  return queryOptions({
    queryKey: [...SEMANA_QUERY_KEY, segunda],
    queryFn: ({ signal }) => authedGet(`/v1/semana?segunda=${encodeURIComponent(segunda)}`, semanaResponseSchema, signal),
  })
}
