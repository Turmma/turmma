import { alunosDaTurmaResponseSchema, nomeDaListaSchema, listaDaTurmaResponseSchema, type FinalidadeDaLeituraDeAlunos, type NomeDaLista, type NomeAvulsoRequest } from '@educa/shared'
import { infiniteQueryOptions } from '@tanstack/react-query'
import { EMPTY_BODY } from '../../../../api/client'
import { ESTRUTURA_QUERY_KEY } from '../../../../api/estrutura'
import { authedGet, authedRequest } from '../../../../api/sessao'

/**
 * A lista de nomes da turma pela coordenação (A1, 2.0 e 13.0; RF4 e RF5). A prévia e o gravar da lista são da peça `ImportarPlanilha` (`importacao/`). Nome e matrícula só passam por aqui no corpo da
 * requisição e na memória da página: nunca no endereço, em `localStorage` ou em `sessionStorage` (regra 20; regra 50,
 * item 7).
 */

/**
 * Por que a Estrutura lê a lista (regra 20, item 10): conferir o cadastro que a própria coordenação está montando. É a
 * única finalidade desta tela, e por isso é fixa; cada leitura fica na auditoria (`turma.lista_lida`).
 */
export const FINALIDADE_DA_LISTA_NA_ESTRUTURA: FinalidadeDaLeituraDeAlunos = 'conferencia_de_cadastro'

/** Nomes por página. */
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

/** O começo da chave dos alunos aprovados da turma: fora da chave da Estrutura e da lista dos professores, para nenhuma decisão de pedido a releia sozinha (cada leitura é auditada). */
export const ALUNOS_APROVADOS_QUERY_KEY = ['alunos-aprovados-da-turma'] as const

/**
 * Os alunos aprovados da turma, como a coordenação os lê (acesso-e-convites, 12.0; RF18): `GET /v1/turmas/:id/alunos?finalidade=conferencia_de_cadastro`, cem de cada vez, que a API já audita
 * (`turma.alunos_lidos`). **A leitura só sai no clique em "Mostrar alunos aprovados"** (quem usa liga `enabled`): cada leitura fica na auditoria, em nome de quem clicou. Não envelhece sozinha
 * (`staleTime` infinito, sem reler ao voltar para a aba) e sai do cache ao fechar a tela (`gcTime: 0`), com os nomes.
 */
export function alunosAprovadosDaTurmaQueryOptions(turmaId: string) {
  return infiniteQueryOptions({
    queryKey: [...ALUNOS_APROVADOS_QUERY_KEY, turmaId],
    queryFn: ({ pageParam, signal }) => {
      const consulta = new URLSearchParams({ finalidade: FINALIDADE_DA_LISTA_NA_ESTRUTURA, limite: String(NOMES_POR_PAGINA) })
      if (pageParam !== undefined) consulta.set('pagina', pageParam)
      return authedGet(`/v1/turmas/${encodeURIComponent(turmaId)}/alunos?${consulta.toString()}`, alunosDaTurmaResponseSchema, signal)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultima) => ultima.proxima,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
}

/** `POST /v1/turmas/:id/lista/nome`: o nome avulso, o aluno que chega em maio. */
export function acrescentarNome(turmaId: string, pedido: NomeAvulsoRequest): Promise<NomeDaLista> {
  return authedRequest(`/v1/turmas/${encodeURIComponent(turmaId)}/lista/nome`, nomeDaListaSchema, { metodo: 'POST', corpo: pedido })
}

/** `DELETE /v1/lista-nomes/:id`: só o nome livre sai; reivindicado ou aprovado é `CONFLITO`. */
export function retirarNome(id: string): Promise<void> {
  return authedRequest(`/v1/lista-nomes/${encodeURIComponent(id)}`, EMPTY_BODY, { metodo: 'DELETE' })
}
