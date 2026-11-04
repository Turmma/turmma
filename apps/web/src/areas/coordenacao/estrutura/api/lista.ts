import {
  gravarPlanilhaResponseSchema,
  importacaoSchema,
  nomeDaListaSchema,
  listaDaTurmaResponseSchema,
  previaDaPlanilhaResponseSchema,
  type FinalidadeDaLeituraDeAlunos,
  type NomeDaLista,
  type NomeAvulsoRequest,
  type GravacaoDaListaResponse,
  type PreviaDaListaResponse,
} from '@educa/shared'
import { infiniteQueryOptions } from '@tanstack/react-query'
import { EMPTY_BODY } from '../../../../api/client'
import { ESTRUTURA_QUERY_KEY } from '../../../../api/estrutura'
import { authedGet, authedRequest } from '../../../../api/sessao'
import { alunosDoTexto, esperarAGravacao, previaNoFormatoDaLista, type AcompanhamentoDaImportacao } from '../ponte-da-lista'

/**
 * A lista de nomes da turma pela coordenação (A1, 2.0 e 13.0; RF4 e RF5). Nome e matrícula só passam por aqui no corpo da
 * requisição e na memória da página: nunca no endereço, em `localStorage` ou em `sessionStorage` (regra 20; regra 50,
 * item 7).
 */

/**
 * Por que a Estrutura lê a lista (regra 20, item 10): conferir o cadastro que a própria coordenação está montando. É a
 * única finalidade desta tela, e por isso é fixa; cada leitura fica na auditoria (`turma.lista_lida`).
 */
export const FINALIDADE_DA_LISTA_NA_ESTRUTURA: FinalidadeDaLeituraDeAlunos = 'conferencia_de_cadastro'

/** Nomes por página: o teto da lista de um envio (200) cabe em duas. */
const NOMES_POR_PAGINA = 100

/**
 * `GET /v1/turmas/:id/lista`, paginada como a API entrega. Cada leitura é auditada: a lista nunca envelhece sozinha
 * (`staleTime` infinito), e por isso a tela não relê ao voltar para a aba nem ao reconectar; relê ao abrir a turma e
 * depois de cada escrita, que a invalida.
 */
export function listaDaTurmaQueryOptions(turmaId: string) {
  return infiniteQueryOptions({
    queryKey: [...ESTRUTURA_QUERY_KEY, 'lista', turmaId],
    queryFn: ({ pageParam, signal }) => {
      const consulta = new URLSearchParams({ finalidade: FINALIDADE_DA_LISTA_NA_ESTRUTURA, limite: String(NOMES_POR_PAGINA) })
      if (pageParam !== undefined) consulta.set('pagina', pageParam)
      return authedGet(`/v1/turmas/${encodeURIComponent(turmaId)}/lista?${consulta.toString()}`, listaDaTurmaResponseSchema, signal)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultima) => ultima.proxima,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/**
 * `POST /v1/turmas/:id/lista/previa`: o que aconteceria com cada linha, sem gravar nada. A API responde no contrato da importação
 * (F2, 8.0); a tela da A1 ainda lê o formato antigo, e a ponte o reescreve até a 13.0.
 */
export async function previaDaLista(turmaId: string, texto: string): Promise<PreviaDaListaResponse> {
  const resposta = await authedRequest(`/v1/turmas/${encodeURIComponent(turmaId)}/lista/previa`, previaDaPlanilhaResponseSchema, { metodo: 'POST', corpo: { texto } })
  return previaNoFormatoDaLista(texto, resposta)
}

/**
 * `POST /v1/turmas/:id/lista`: grava só se nenhuma linha tiver erro (RF5). A API responde 202 com o id da importação (F2, 8.0), e a
 * ponte espera o job terminar em `GET /v1/importacoes/:id` para a tela dizer quantos nomes entraram, como antes da 13.0. Sem marcas: a
 * tela da A1 não as oferece, e a transferência e o desligamento só valem com a marca da coordenação.
 */
export async function gravarLista(turmaId: string, texto: string, acompanhamento: AcompanhamentoDaImportacao = {}): Promise<GravacaoDaListaResponse> {
  const { id } = await authedRequest(`/v1/turmas/${encodeURIComponent(turmaId)}/lista`, gravarPlanilhaResponseSchema, { metodo: 'POST', corpo: { texto } })
  return esperarAGravacao(() => authedGet(`/v1/importacoes/${encodeURIComponent(id)}`, importacaoSchema), alunosDoTexto(texto), acompanhamento)
}

/** `POST /v1/turmas/:id/lista/nome`: o nome avulso, o aluno que chega em maio. */
export function acrescentarNome(turmaId: string, pedido: NomeAvulsoRequest): Promise<NomeDaLista> {
  return authedRequest(`/v1/turmas/${encodeURIComponent(turmaId)}/lista/nome`, nomeDaListaSchema, { metodo: 'POST', corpo: pedido })
}

/** `DELETE /v1/lista-nomes/:id`: só o nome livre sai; reivindicado ou aprovado é `CONFLITO`. */
export function retirarNome(id: string): Promise<void> {
  return authedRequest(`/v1/lista-nomes/${encodeURIComponent(id)}`, EMPTY_BODY, { metodo: 'DELETE' })
}
