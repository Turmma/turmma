import type { AlunoDaTurma, DesempenhoDaTurmaResponse } from '@educa/shared'

/**
 * O que a aba Alunos decide sem tocar a rede (telas do professor, 12.0; RF18, RF21): a ordem de nome, a junção da lista de nomes
 * com os acertos das correções aprovadas e o texto de cada situação. Só nome e número: nenhuma palavra de nota, de média ou de
 * ranking (D46, D57, D69), e nenhuma ordem por acerto, de propósito.
 */

export type DesempenhoDoAluno = DesempenhoDaTurmaResponse['alunos'][number]

/**
 * `na_turma`: o aluno está na lista de nomes. `fora_da_turma`: o desempenho o traz e a lista de nomes, lida até o fim, não: ele foi
 * transferido ou teve o acesso desativado entre uma leitura e a outra. A API não diz qual dos dois, e a tela também não.
 */
export type SituacaoDoAluno = 'na_turma' | 'fora_da_turma'

export interface AlunoRow {
  readonly usuarioId: string
  readonly nome: string
  readonly situacao: SituacaoDoAluno
  /** Os acertos nas correções aprovadas. Sem ele: a leitura não chegou, ou o aluno não tem correção aprovada, ou saiu da turma. */
  readonly desempenho: DesempenhoDoAluno | undefined
}

export const TEXTO_SEM_CORRECAO_APROVADA = 'Sem correção aprovada'
export const TEXTO_DE_QUEM_SAIU = 'Saiu da turma'
export const TEXTO_DOS_ACERTOS_QUE_CARREGAM = 'Carregando os acertos…'
export const TEXTO_DOS_ACERTOS_QUE_FALHARAM = 'Acertos não lidos'
export const TEXTO_SEM_HABILIDADE = '—'

/**
 * Em ordem de nome, no português do Brasil; dois alunos com o mesmo nome ficam em duas linhas, e o id desempata: a ordem não
 * depende de qual deles a API entregou primeiro. **Nunca por acerto** (o Ranking saiu de vez; D59, D69).
 */
export function ordemDeNome(a: Pick<AlunoRow, 'nome' | 'usuarioId'>, b: Pick<AlunoRow, 'nome' | 'usuarioId'>): number {
  const porNome = a.nome.localeCompare(b.nome, 'pt-BR')
  if (porNome !== 0) return porNome
  if (a.usuarioId === b.usuarioId) return 0
  return a.usuarioId < b.usuarioId ? -1 : 1
}

/**
 * A lista de nomes que já foi lida, com os acertos de cada um, em ordem de nome. A junção é pelo id do aluno.
 *
 * O aluno que o desempenho traz e a lista de nomes não só vira linha `fora_da_turma` com a lista **lida até o fim**
 * (`listaCompleta`): enquanto ainda há páginas por ler, ele pode simplesmente estar numa delas, e afirmar que saiu seria
 * dizer o que a tela não sabe. Essa linha não leva acerto nenhum: ele já não conta na turma.
 */
export function montarLinhas(lidos: readonly AlunoDaTurma[], desempenho: DesempenhoDaTurmaResponse | undefined, listaCompleta: boolean): AlunoRow[] {
  const doDesempenho = desempenho?.alunos ?? []
  const acertosDe = new Map(doDesempenho.map((aluno) => [aluno.alunoId, aluno] as const))
  const naLista = new Set(lidos.map((aluno) => aluno.usuarioId))
  const daTurma = lidos.map((aluno): AlunoRow => ({ usuarioId: aluno.usuarioId, nome: aluno.nome, situacao: 'na_turma', desempenho: acertosDe.get(aluno.usuarioId) }))
  const quemSaiu = listaCompleta
    ? doDesempenho.filter((aluno) => !naLista.has(aluno.alunoId)).map((aluno): AlunoRow => ({ usuarioId: aluno.alunoId, nome: aluno.nome, situacao: 'fora_da_turma', desempenho: undefined }))
    : []
  return [...daTurma, ...quemSaiu].sort(ordemDeNome)
}

/** Como anda a leitura dos acertos, para a célula dizer a verdade enquanto eles não chegam. */
export type LeituraDosAcertos = 'lendo' | 'falhou' | 'lida'

/**
 * O que a coluna "Acertos" diz de um aluno. Quem saiu da turma não leva número. Quem está na turma sem correção aprovada
 * (`total` zero, ou fora do desempenho) diz isso, em vez de "0 de 0" (D46). A leitura que não chegou diz que não chegou, e não
 * finge que o aluno não tem acerto.
 */
export function textoDosAcertos(linha: AlunoRow, leitura: LeituraDosAcertos): string {
  if (linha.situacao === 'fora_da_turma') return TEXTO_DE_QUEM_SAIU
  if (leitura === 'lendo') return TEXTO_DOS_ACERTOS_QUE_CARREGAM
  if (leitura === 'falhou') return TEXTO_DOS_ACERTOS_QUE_FALHARAM
  const { desempenho } = linha
  if (desempenho === undefined || desempenho.total === 0) return TEXTO_SEM_CORRECAO_APROVADA
  return `${String(desempenho.acertos)} de ${String(desempenho.total)}`
}

/** O acerto por habilidade do aluno, "QUI.EM.04: 1 de 2 · …". Vazio quando ele não tem correção aprovada. */
export function textoPorHabilidade(linha: AlunoRow): string {
  const itens = linha.desempenho?.porHabilidade ?? []
  if (itens.length === 0) return TEXTO_SEM_HABILIDADE
  return itens.map((item) => `${item.habilidade.codigo}: ${String(item.acertos)} de ${String(item.total)}`).join(' · ')
}
