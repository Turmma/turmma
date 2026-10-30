import {
  entregaResponseSchema,
  listaDeEntregasResponseSchema,
  TAMANHO_MAXIMO_DA_PAGINA,
  type Entrega,
  type DecidirEntregaRequest,
  type EntregaResponse,
  type ListaDeEntregasResponse,
} from '@educa/shared'
import { infiniteQueryOptions, queryOptions, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { CHAVE_DAS_ENTREGAS, CHAVE_DOS_ARTEFATOS } from '../../../../api/chaves-do-professor'
import { buscarComSessao, chamarComSessao } from '../../../../api/sessao'

const CAMINHO_DAS_ENTREGAS = '/v1/entregas'

/**
 * O que a IA produziu e espera a professora (`GET /v1/entregas?estado=pendente`), nas turmas em que ela tem vínculo
 * confirmado. Uma página, a maior que a API entrega: é o que "Esperando você" mostra na Home e no sino da casca. Havendo mais (`proxima`), a Home diz que há mais e manda ao sino.
 */
export const consultaEntregasPendentes = queryOptions({
  queryKey: [...CHAVE_DAS_ENTREGAS, 'pendentes'],
  queryFn: ({ signal }) => buscarComSessao(`${CAMINHO_DAS_ENTREGAS}?estado=pendente&limite=${String(TAMANHO_MAXIMO_DA_PAGINA)}`, listaDeEntregasResponseSchema, signal),
})

/** Todas as entregas da professora, de qualquer estado, paginadas: é o que o Assistente fez, na conversa de "O que o Assistente fez". */
export const consultaEntregas = infiniteQueryOptions({
  queryKey: [...CHAVE_DAS_ENTREGAS, 'todas'],
  queryFn: ({ pageParam, signal }) =>
    buscarComSessao(pageParam === undefined ? CAMINHO_DAS_ENTREGAS : `${CAMINHO_DAS_ENTREGAS}?pagina=${encodeURIComponent(pageParam)}`, listaDeEntregasResponseSchema, signal),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (ultima) => ultima.proxima,
})

/**
 * As entregas de uma turma, para a tela do artefato dizer quem aprovou a versão adaptada e quando: o artefato traz só o
 * estado e a data da entrega dele (`entregaDoArtefatoSchema`), sem o autor nem a justificativa.
 */
export function consultaEntregasDaTurma(turmaId: string) {
  return queryOptions({
    queryKey: [...CHAVE_DAS_ENTREGAS, 'turma', turmaId],
    queryFn: ({ signal }) => buscarComSessao(`${CAMINHO_DAS_ENTREGAS}?turmaId=${encodeURIComponent(turmaId)}&limite=${String(TAMANHO_MAXIMO_DA_PAGINA)}`, listaDeEntregasResponseSchema, signal),
  })
}

/**
 * `POST /v1/entregas/:id/decidir`: a aprovação registrada, com autor e data, ou a rejeição com justificativa (regra 70,
 * item 3). **É o único caminho de decisão da tela**: não existe atalho em volta dele. A que já tinha decisão responde
 * `ENTREGA_JA_DECIDIDA`.
 */
export function decidirEntrega(id: string, pedido: DecidirEntregaRequest): Promise<EntregaResponse> {
  return chamarComSessao(`${CAMINHO_DAS_ENTREGAS}/${encodeURIComponent(id)}/decidir`, entregaResponseSchema, { metodo: 'POST', corpo: pedido })
}

/**
 * A tela depois da decisão: a entrega decidida entra no lugar da pendente em toda lista já lida, na hora, com quem decidiu
 * e quando, e sai de "Esperando você". Depois tudo é marcado como velho e relido: as entregas, e o artefato, que mostra
 * o estado da versão adaptada.
 */
export async function aplicarEntregaDecidida(cliente: QueryClient, decidida: Entrega): Promise<void> {
  await cliente.cancelQueries({ queryKey: CHAVE_DAS_ENTREGAS })
  cliente.setQueryData<ListaDeEntregasResponse>(consultaEntregasPendentes.queryKey, (lista) => (lista === undefined ? undefined : { ...lista, itens: lista.itens.filter((entrega) => entrega.id !== decidida.id) }))
  cliente.setQueryData<InfiniteData<ListaDeEntregasResponse, string | undefined>>(consultaEntregas.queryKey, (lido) =>
    lido === undefined ? undefined : { ...lido, pages: lido.pages.map((pagina) => ({ ...pagina, itens: pagina.itens.map((entrega) => (entrega.id === decidida.id ? decidida : entrega)) })) },
  )
  void recarregarEntregas(cliente)
}

/** Marca como velho o que depende de uma decisão: a entrega já decidida por outro caminho também cai aqui. */
export async function recarregarEntregas(cliente: QueryClient): Promise<void> {
  void cliente.invalidateQueries({ queryKey: CHAVE_DOS_ARTEFATOS })
  // Quem chama espera a releitura das entregas que estão na tela: só depois a tela mostra como a entrega ficou.
  await cliente.invalidateQueries({ queryKey: CHAVE_DAS_ENTREGAS })
}
