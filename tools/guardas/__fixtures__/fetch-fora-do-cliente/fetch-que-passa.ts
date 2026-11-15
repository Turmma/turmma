// Fixture do que a guarda do `fetch` NÃO acusa (52.0; RF11): o que a web usa no lugar dele, e os nomes que só se parecem com
// ele. Nenhuma linha leva marca.

import { apiRequest, comPrazo } from '../../../../apps/web/src/api/client'

export const pelaApi = (esquema: Parameters<typeof apiRequest>[1]) => apiRequest('/v1/eu', esquema)
export const peloPrazo = () => comPrazo('pdf', undefined, (pedir) => pedir('/v1/artefatos/1/pdf', {}))
export const buscarDeNovo = (consulta: { refetch: () => void; fetchStatus: string }) => (consulta.fetchStatus === 'idle' ? consulta.refetch() : undefined)
export const nomes = { fetchado: 1, 'fetch-api': 2 }
export const texto = 'chamar o fetch fora do cliente é barrado'
export const ehBuscar = (fetchQuery: () => void) => fetchQuery()
