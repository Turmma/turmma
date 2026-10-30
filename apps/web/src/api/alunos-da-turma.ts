import { alunosDaTurmaResponseSchema, TAMANHO_MAXIMO_DA_PAGINA } from '@educa/shared'
import { infiniteQueryOptions } from '@tanstack/react-query'
import { buscarComSessao } from './sessao'

/**
 * A lista de nomes da turma como a professora a lê (telas do professor, 12.0; RF18): `GET /v1/turmas/:id/alunos`, uma página por
 * vez. A escola, o ano e o vínculo vêm do token e do servidor; o que vai no pedido é a turma, no caminho, e a página. **A web não
 * manda `?anoLetivoId`** (é a leitura de um ano encerrado, que a coordenação faz) **nem `finalidade`**: o professor com vínculo
 * confirmado lê a própria turma sem as duas coisas, e a leitura dele não grava auditoria (`turma.alunos_lidos` é da coordenação).
 *
 * Cada leitura traz até uma página, a maior que a API entrega (100). A API devolve em ordem de id, que não é a ordem de nome: quem
 * desenha a lista reordena tudo o que já foi lido (`areas/professor/turmas/alunos-da-turma.ts`).
 *
 * O nome do aluno só passa pela resposta e pela memória da página: nunca no endereço, em `localStorage` nem em `sessionStorage`
 * (regra 20; regra 50, item 7). Fora da tela a lista não fica guardada (`gcTime: 0`): os nomes não ficam na memória da aba do
 * computador compartilhado, e voltar à aba lê de novo.
 */

/** O começo da chave da lista de nomes: a troca de escola e a pessoa seguinte esvaziam tudo junto (`main.tsx`), e a decisão de um pedido a marca como velha. */
export const CHAVE_DOS_ALUNOS_DA_TURMA = ['alunos-da-turma'] as const

/** Uma leitura traz até uma página, a maior que a API entrega. */
export const ALUNOS_POR_LEITURA = TAMANHO_MAXIMO_DA_PAGINA

export function consultaAlunosDaTurma(turmaId: string) {
  return infiniteQueryOptions({
    queryKey: [...CHAVE_DOS_ALUNOS_DA_TURMA, turmaId],
    queryFn: ({ pageParam, signal }) => {
      const consulta = new URLSearchParams({ limite: String(ALUNOS_POR_LEITURA) })
      if (pageParam !== undefined) consulta.set('pagina', pageParam)
      return buscarComSessao(`/v1/turmas/${encodeURIComponent(turmaId)}/alunos?${consulta.toString()}`, alunosDaTurmaResponseSchema, signal)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultima) => ultima.proxima,
    gcTime: 0,
  })
}
