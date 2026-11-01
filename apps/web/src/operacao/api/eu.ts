import { euDoOperadorResponseSchema, type EuDoOperadorResponse } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { operadorAuthedRequest } from './sessao'

export const CAMINHO_DO_EU_DO_OPERADOR = '/v1/operacao/eu'

/** Quem está na sessão da operação (`GET /v1/operacao/eu`): apelido e nome, e nada mais (Tech Spec da A0, seção 7). */
export const euDoOperadorQueryOptions = queryOptions({
  queryKey: ['operacao', 'eu'],
  queryFn: ({ signal }) => operadorAuthedRequest(CAMINHO_DO_EU_DO_OPERADOR, euDoOperadorResponseSchema, { sinal: signal }),
})

/**
 * Conta para o servidor que há alguém usando a sessão: é o `GET /v1/operacao/eu`, porque a API move o `ultimoUsoEm` em
 * qualquer rota da operação (no máximo uma vez por minuto), e não existe rota de atividade só para isso. Quem chama é o
 * relógio de inatividade, e só quando houve ponteiro ou teclado.
 */
export function registrarUsoDaOperacao(): Promise<EuDoOperadorResponse> {
  return operadorAuthedRequest(CAMINHO_DO_EU_DO_OPERADOR, euDoOperadorResponseSchema)
}
