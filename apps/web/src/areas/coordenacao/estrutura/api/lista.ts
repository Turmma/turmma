import {
  nomeDaListaSchema,
  gravacaoDaListaResponseSchema,
  listaDaTurmaResponseSchema,
  previaDaListaResponseSchema,
  type FinalidadeDaLeituraDeAlunos,
  type NomeDaLista,
  type NomeAvulsoRequest,
  type GravacaoDaListaResponse,
  type PreviaDaListaResponse,
} from '@educa/shared'
import { infiniteQueryOptions } from '@tanstack/react-query'
import { SEM_CORPO } from '../../../../api/client'
import { CHAVE_DA_ESTRUTURA } from '../../../../api/estrutura'
import { buscarComSessao, chamarComSessao } from '../../../../api/sessao'

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
export function consultaListaDaTurma(turmaId: string) {
  return infiniteQueryOptions({
    queryKey: [...CHAVE_DA_ESTRUTURA, 'lista', turmaId],
    queryFn: ({ pageParam, signal }) => {
      const consulta = new URLSearchParams({ finalidade: FINALIDADE_DA_LISTA_NA_ESTRUTURA, limite: String(NOMES_POR_PAGINA) })
      if (pageParam !== undefined) consulta.set('pagina', pageParam)
      return buscarComSessao(`/v1/turmas/${encodeURIComponent(turmaId)}/lista?${consulta.toString()}`, listaDaTurmaResponseSchema, signal)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultima) => ultima.proxima,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** `POST /v1/turmas/:id/lista/previa`: o que aconteceria com cada linha, sem gravar nada. */
export function previaDaLista(turmaId: string, texto: string): Promise<PreviaDaListaResponse> {
  return chamarComSessao(`/v1/turmas/${encodeURIComponent(turmaId)}/lista/previa`, previaDaListaResponseSchema, { metodo: 'POST', corpo: { texto } })
}

/** `POST /v1/turmas/:id/lista`: grava só se nenhuma linha tiver erro; reenviar acrescenta só o que falta (RF5). */
export function gravarLista(turmaId: string, texto: string): Promise<GravacaoDaListaResponse> {
  return chamarComSessao(`/v1/turmas/${encodeURIComponent(turmaId)}/lista`, gravacaoDaListaResponseSchema, { metodo: 'POST', corpo: { texto } })
}

/** `POST /v1/turmas/:id/lista/nome`: o nome avulso, o aluno que chega em maio. */
export function acrescentarNome(turmaId: string, pedido: NomeAvulsoRequest): Promise<NomeDaLista> {
  return chamarComSessao(`/v1/turmas/${encodeURIComponent(turmaId)}/lista/nome`, nomeDaListaSchema, { metodo: 'POST', corpo: pedido })
}

/** `DELETE /v1/lista-nomes/:id`: só o nome livre sai; reivindicado ou aprovado é `CONFLITO`. */
export function retirarNome(id: string): Promise<void> {
  return chamarComSessao(`/v1/lista-nomes/${encodeURIComponent(id)}`, SEM_CORPO, { metodo: 'DELETE' })
}
