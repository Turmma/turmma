import {
  anoLetivoResponseSchema,
  disciplinaResponseSchema,
  listaDeAnosLetivosResponseSchema,
  listaDeDisciplinasResponseSchema,
  listaDeSeriesResponseSchema,
  listaDeTurmasResponseSchema,
  listaDeVinculosResponseSchema,
  serieResponseSchema,
  turmaResponseSchema,
  turmaAbertaResponseSchema,
  vinculoDaCoordenacaoResponseSchema,
  TAMANHO_MAXIMO_DA_PAGINA,
  type AnoLetivo,
  type Disciplina,
  type CriarAnoLetivoRequest,
  type CriarDisciplinaRequest,
  type CriarSerieRequest,
  type CriarTurmaRequest,
  type CriarVinculoRequest,
  type Serie,
  type Turma,
  type VinculoDaCoordenacao,
} from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { EMPTY_BODY, type ResponseSchema } from './client'
import { authedGet, authedRequest } from './sessao'

/**
 * A estrutura da escola pela coordenação (A1, 13.0; RF3 e RF8): ano letivo, séries, disciplinas, turmas e a alocação dos
 * professores. A escola e o ano em curso vêm do token, nunca da tela: nenhuma destas consultas tem como pedir a
 * estrutura de outra escola (regra 10, item 3). O único ano que vai no corpo é o `anoLetivoId` da turma nova, que só
 * confere: a API o compara com o ano em curso do token e nunca escolhe o ano por ele.
 */

/** O começo de toda chave desta tela: a troca de escola e a pessoa seguinte esvaziam tudo junto (`main.tsx`). */
export const ESTRUTURA_QUERY_KEY = ['estrutura'] as const

/**
 * Quantas páginas de 100 a tela lê de cada lista da estrutura. Uma escola do recorte tem dezenas de turmas e de
 * professores, e cabe numa ou duas; o teto só impede que uma lista inesperada vire uma rajada de pedidos (regra 80, item
 * 8). Acima dele, a tela diz que mostra só o começo (`completa: false`).
 */
export const MAXIMO_DE_PAGINAS_DA_ESTRUTURA = 10

/** Os itens de uma lista da estrutura e se ela veio inteira. */
export interface ListaDaEstrutura<Item> {
  readonly itens: readonly Item[]
  readonly completa: boolean
}

/** Lê as páginas de uma listagem paginada da API, 100 por vez, até a última ou até o teto. */
export async function lerPaginas<Item>(
  caminho: string,
  esquema: ResponseSchema<{ itens: Item[]; proxima?: string | undefined }>,
  sinal?: AbortSignal,
  maximoDePaginas = MAXIMO_DE_PAGINAS_DA_ESTRUTURA,
): Promise<ListaDaEstrutura<Item>> {
  const itens: Item[] = []
  let proxima: string | undefined
  for (let pagina = 0; pagina < maximoDePaginas; pagina += 1) {
    const consulta = `limite=${String(TAMANHO_MAXIMO_DA_PAGINA)}${proxima === undefined ? '' : `&pagina=${encodeURIComponent(proxima)}`}`
    const resposta = await authedGet(`${caminho}?${consulta}`, esquema, sinal)
    itens.push(...resposta.itens)
    proxima = resposta.proxima
    if (proxima === undefined) return { itens, completa: true }
  }
  return { itens, completa: false }
}

export const anosLetivosQueryOptions = queryOptions({
  queryKey: [...ESTRUTURA_QUERY_KEY, 'anos-letivos'],
  queryFn: ({ signal }) => lerPaginas<AnoLetivo>('/v1/anos-letivos', listaDeAnosLetivosResponseSchema, signal),
})

export const seriesQueryOptions = queryOptions({
  queryKey: [...ESTRUTURA_QUERY_KEY, 'series'],
  queryFn: ({ signal }) => lerPaginas<Serie>('/v1/series', listaDeSeriesResponseSchema, signal),
})

export const disciplinasQueryOptions = queryOptions({
  queryKey: [...ESTRUTURA_QUERY_KEY, 'disciplinas'],
  queryFn: ({ signal }) => lerPaginas<Disciplina>('/v1/disciplinas', listaDeDisciplinasResponseSchema, signal),
})

/** As turmas do ano em curso. Sem ano em curso a API responde como inexistente: a tela só pergunta quando há um. */
export const turmasQueryOptions = queryOptions({
  queryKey: [...ESTRUTURA_QUERY_KEY, 'turmas'],
  queryFn: ({ signal }) => lerPaginas<Turma>('/v1/turmas', listaDeTurmasResponseSchema, signal),
})

/** Os vínculos de professor do ano em curso, como a coordenação os vê (com o `complemento` da contestação). */
export const vinculosQueryOptions = queryOptions({
  queryKey: [...ESTRUTURA_QUERY_KEY, 'vinculos'],
  queryFn: ({ signal }) => lerPaginas<VinculoDaCoordenacao>('/v1/vinculos', listaDeVinculosResponseSchema, signal),
})

/** A turma aberta na Estrutura: o nome e a série (`GET /v1/turmas/:id`). */
export function turmaAbertaQueryOptions(turmaId: string) {
  return queryOptions({
    queryKey: [...ESTRUTURA_QUERY_KEY, 'turma', turmaId],
    queryFn: ({ signal }) => authedGet(`/v1/turmas/${encodeURIComponent(turmaId)}`, turmaAbertaResponseSchema, signal),
  })
}

/** `POST /v1/anos-letivos`: nasce `planejado`. */
export function criarAnoLetivo(pedido: CriarAnoLetivoRequest): Promise<AnoLetivo> {
  return authedRequest('/v1/anos-letivos', anoLetivoResponseSchema, { metodo: 'POST', corpo: pedido })
}

/** `POST /v1/anos-letivos/:id/abrir`: `planejado` → `em_curso`. As turmas nascem no ano em curso. */
export function abrirAnoLetivo(id: string): Promise<AnoLetivo> {
  return authedRequest(`/v1/anos-letivos/${encodeURIComponent(id)}/abrir`, anoLetivoResponseSchema, { metodo: 'POST' })
}

export function criarSerie(pedido: CriarSerieRequest): Promise<Serie> {
  return authedRequest('/v1/series', serieResponseSchema, { metodo: 'POST', corpo: pedido })
}

export function criarDisciplina(pedido: CriarDisciplinaRequest): Promise<Disciplina> {
  return authedRequest('/v1/disciplinas', disciplinaResponseSchema, { metodo: 'POST', corpo: pedido })
}

export function renomearDisciplina(id: string, nome: string): Promise<Disciplina> {
  return authedRequest(`/v1/disciplinas/${encodeURIComponent(id)}`, disciplinaResponseSchema, { metodo: 'PATCH', corpo: { nome } })
}

export function excluirDisciplina(id: string): Promise<void> {
  return authedRequest(`/v1/disciplinas/${encodeURIComponent(id)}`, EMPTY_BODY, { metodo: 'DELETE' })
}

export function criarTurma(pedido: CriarTurmaRequest): Promise<Turma> {
  return authedRequest('/v1/turmas', turmaResponseSchema, { metodo: 'POST', corpo: pedido })
}

export function renomearTurma(id: string, nome: string): Promise<Turma> {
  return authedRequest(`/v1/turmas/${encodeURIComponent(id)}`, turmaResponseSchema, { metodo: 'PATCH', corpo: { nome } })
}

export function excluirTurma(id: string): Promise<void> {
  return authedRequest(`/v1/turmas/${encodeURIComponent(id)}`, EMPTY_BODY, { metodo: 'DELETE' })
}

/** `POST /v1/vinculos`: aloca o professor na turma e na disciplina. O vínculo nasce `pendente` até ele confirmar (RF8). */
export function alocarProfessor(pedido: CriarVinculoRequest): Promise<VinculoDaCoordenacao> {
  return authedRequest('/v1/vinculos', vinculoDaCoordenacaoResponseSchema, { metodo: 'POST', corpo: pedido })
}
