import {
  acompanhamentoResponseSchema,
  atividadeAplicadaResponseSchema,
  type AcompanhamentoResponse,
  type AtividadeAplicadaResponse,
  type EstenderTempoRequest,
  type SegundaChamadaRequest,
} from '@educa/shared'
import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { ATIVIDADES_QUERY_KEY } from '../../../../api/chaves-do-professor'
import { authedGet, authedRequest } from '../../../../api/sessao'

/**
 * O acompanhamento da prova, a extensão de tempo e a segunda chamada (avaliacao-e-correcao, 11.0; RF4, RF10): o que o professor da turma
 * faz com a prova depois de aplicada. A escola, o ano e a pessoa vêm do token. O nome do aluno só chega ao professor da turma (D34), e a
 * situação é só situação: **sem saídas da aba, sem percentual de tempo adicional e sem "parado há X min"** (D70, D88; regra 70, item 7).
 */
const CAMINHO = '/v1/atividades-aplicadas'

/** De quanto em quanto tempo o painel relê a prova aberta, enquanto a janela está à vista. */
export const INTERVALO_DO_ACOMPANHAMENTO_MS = 15_000

/**
 * `GET /v1/atividades-aplicadas/:id/acompanhamento`: uma consulta, por aluno da turma. A chave nasce da lista de atividades (uma
 * releitura da lista também relê o acompanhamento), e `gcTime: 0` tira os nomes da memória quando o painel sai da tela.
 */
export function acompanhamentoQueryOptions(atividadeAplicadaId: string) {
  return queryOptions({
    queryKey: [...ATIVIDADES_QUERY_KEY, 'acompanhamento', atividadeAplicadaId],
    queryFn: ({ signal }) => authedGet(`${CAMINHO}/${encodeURIComponent(atividadeAplicadaId)}/acompanhamento`, acompanhamentoResponseSchema, signal),
    gcTime: 0,
  })
}

/**
 * `POST …/extensoes`: mais minutos para um aluno (`alunoId`) ou para a turma toda. A `chave` é gerada pela tela uma vez por pedido: o
 * reenvio do mesmo pedido devolve o gravado (200) e não grava outra extensão.
 */
export function estenderTempo(atividadeAplicadaId: string, pedido: EstenderTempoRequest): Promise<AcompanhamentoResponse> {
  return authedRequest(`${CAMINHO}/${encodeURIComponent(atividadeAplicadaId)}/extensoes`, acompanhamentoResponseSchema, { metodo: 'POST', corpo: pedido })
}

/** `POST …/segunda-chamada`: a prova abre de novo, numa aplicação nova, para os convocados que a original encerrada não tem enviada. */
export function openSegundaChamada(atividadeAplicadaId: string, pedido: SegundaChamadaRequest): Promise<AtividadeAplicadaResponse> {
  return authedRequest(`${CAMINHO}/${encodeURIComponent(atividadeAplicadaId)}/segunda-chamada`, atividadeAplicadaResponseSchema, { metodo: 'POST', corpo: pedido })
}

/**
 * Guarda o acompanhamento que a extensão devolveu, **depois** de cancelar a leitura que estava no ar: a resposta atrasada de uma releitura
 * que saiu antes da extensão traria o limite velho por cima do novo.
 */
export async function guardarOAcompanhamento(cliente: QueryClient, atividadeAplicadaId: string, acompanhamento: AcompanhamentoResponse): Promise<void> {
  const { queryKey } = acompanhamentoQueryOptions(atividadeAplicadaId)
  await cliente.cancelQueries({ queryKey })
  cliente.setQueryData(queryKey, acompanhamento)
}
