import { describe, expect, it } from 'vitest'
import { alunosAprovadosDaTurmaQueryOptions, ALUNOS_APROVADOS_QUERY_KEY, listaDaTurmaQueryOptions } from './lista'

/**
 * A leitura dos alunos aprovados da coordenação (acesso-e-convites, 12.0): cada leitura vai à auditoria em nome de quem clicou (regra 20, item 10), e por isso ela não envelhece sozinha, não relê
 * ao voltar para a aba e não sobra no cache depois de a tela fechar, com os nomes (regra 20, itens 1 e 4). As opções são o que o `useInfiniteQuery` da tela segue.
 */
describe('os alunos aprovados da turma, como a coordenação os lê', () => {
  const TURMA = '0197a1c0-0000-7000-8000-000000000101'

  it('sai do cache ao fechar a tela: sem tempo de guarda, para os nomes não ficarem na memória da aba', () => {
    expect(alunosAprovadosDaTurmaQueryOptions(TURMA).gcTime).toBe(0)
  })

  it('não relê ao voltar para a aba, e não envelhece sozinha: cada leitura é um clique, e fica na auditoria', () => {
    const opcoes = alunosAprovadosDaTurmaQueryOptions(TURMA)
    expect(opcoes.refetchOnWindowFocus).toBe(false)
    expect(opcoes.staleTime).toBe(Number.POSITIVE_INFINITY)
  })

  it('a chave leva a turma e é só dos aprovados: a lista de nomes e a decisão de um pedido não a trocam', () => {
    expect(alunosAprovadosDaTurmaQueryOptions(TURMA).queryKey).toEqual([...ALUNOS_APROVADOS_QUERY_KEY, TURMA])
    expect(alunosAprovadosDaTurmaQueryOptions('outra').queryKey).not.toEqual(alunosAprovadosDaTurmaQueryOptions(TURMA).queryKey)
    expect(alunosAprovadosDaTurmaQueryOptions(TURMA).queryKey).not.toEqual(listaDaTurmaQueryOptions(TURMA).queryKey)
  })
})
