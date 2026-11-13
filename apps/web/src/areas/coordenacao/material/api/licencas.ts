import {
  licencaResponseSchema,
  listaDeLicencasResponseSchema,
  type AlterarLicencaRequest,
  type Licenca,
  type RegistrarLicencaRequest,
} from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { lerPaginas } from '../../../../api/estrutura'
import { authedRequest } from '../../../../api/sessao'
import { MATERIAL_QUERY_KEY } from './material'

/**
 * As licenças de material da escola pela coordenação (ingestao-do-material, 6.0; RF16 e RF17; Tech Spec, seções 4 e 9): a lista com a
 * situação e quantos materiais cada uma cobre, o registro e a mudança da vigência. A escola vem do token, nunca da tela (regra 10, item 3).
 */

const CAMINHO = '/v1/licencas'

/** A chave da lista de licenças, sob a de Material: a troca de escola e a pessoa seguinte esvaziam tudo junto (`main.tsx`). */
export const LICENCAS_QUERY_KEY = [...MATERIAL_QUERY_KEY, 'licencas'] as const

/**
 * As licenças da escola, em ordem de registro. **Sem `refetchInterval`**: a situação sai do dia de São Paulo na hora da leitura, e a tela
 * e o sino a relêem por ação da pessoa (o "Atualizar" do sino, o registro, a vigência), nunca por tempo (RF5; regra 80).
 */
export const licencasQueryOptions = queryOptions({
  queryKey: LICENCAS_QUERY_KEY,
  queryFn: ({ signal }) => lerPaginas<Licenca>(CAMINHO, listaDeLicencasResponseSchema, signal),
})

/**
 * `POST /v1/licencas`. A rota não tem chave de idempotência: dois envios iguais seriam duas licenças, e por isso a tela manda **um pedido
 * por vez** (`Licencas.tsx`, `useSingleSubmit` no nível da tela) e desliga o botão enquanto ele corre.
 */
export function registrarLicenca(pedido: RegistrarLicencaRequest): Promise<Licenca> {
  return authedRequest(CAMINHO, licencaResponseSchema, { metodo: 'POST', corpo: pedido })
}

/** `PATCH /v1/licencas/:id`: a vigência (e, para a API, a cobertura e a referência, que a tela não muda). */
export function alterarLicenca(id: string, pedido: AlterarLicencaRequest): Promise<Licenca> {
  return authedRequest(`${CAMINHO}/${encodeURIComponent(id)}`, licencaResponseSchema, { metodo: 'PATCH', corpo: pedido })
}
