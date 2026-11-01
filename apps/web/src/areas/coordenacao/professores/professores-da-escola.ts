import { ESTADOS_DO_PROFESSOR_ALOCAVEIS, type EstadoDoProfessor, type MotivoDeEncerramentoDeVinculo, type ProfessorDaEscola, type VinculoDaCoordenacao } from '@educa/shared'
import type { ListaDaEstrutura } from '../../../api/estrutura'
import { PROFESSOR_PARAM } from '../../../paths'
import { ordenarPeloNome, ordenarVinculos } from '../comum/ordem'

/**
 * O que a aba Professores desenha, sem React (telas da coordenação, 6.0; Tech Spec seção 9, "Professores"): cada professor com as
 * turmas e as disciplinas dos vínculos dele, e o professor que o endereço abre. Fica num módulo puro para a conta ter teste de
 * unidade e para a tela só desenhar.
 *
 * **O que a linha diz é o vínculo que a escola criou, e nada de uso** (regra 70, itens 8 e 9; D45, D64): sem turma ou disciplina
 * "mais usada", sem contagem de entrega, sem ordem que não seja a do nome. O e-mail não está aqui: a lista de professores não o traz
 * e a tela não o pede (regra 20, itens 2 e 4; E11).
 */

export interface ProfessorDaTabela {
  readonly professor: ProfessorDaEscola
  /** Os nomes das turmas dos vínculos pendentes, confirmados e contestados, cada turma uma vez, na ordem do nome (7ºA antes de 10ºA). */
  readonly turmas: readonly string[]
  /** As disciplinas desses mesmos vínculos, cada uma uma vez, pelo nome. */
  readonly disciplinas: readonly string[]
}

/**
 * Os vínculos que contam na linha do professor: o que a escola alocou e ainda vale — o que espera o aceite, o que ele confirmou e o
 * que ele contestou, que a coordenação ainda precisa corrigir. O encerrado já não é dele. Diferente de "dar professor à turma" (a
 * conta do sino e das Turmas), em que o contestado não conta: aqui a pergunta é "onde a escola pôs este professor".
 */
function vinculoDaLinha(vinculo: VinculoDaCoordenacao): boolean {
  return vinculo.papel === 'professor' && (vinculo.estado === 'pendente' || vinculo.estado === 'confirmado' || vinculo.estado === 'contestado')
}

/** Os nomes, sem repetir pelo id, na ordem do nome. */
function nomesUnicos(itens: readonly { readonly id: string; readonly nome: string }[]): string[] {
  const porId = new Map(itens.map((item) => [item.id, item]))
  return ordenarPeloNome([...porId.values()]).map((item) => item.nome)
}

/**
 * Os professores da lista pelo nome, cada um com as turmas e as disciplinas dos vínculos dele. Sem os vínculos lidos (carregando, erro
 * ou escola sem ano em curso) as duas listas vêm vazias, e a tela diz "—": ela não afirma o que não leu. O professor com duas
 * disciplinas na mesma turma tem a turma uma vez e as duas disciplinas; o sem vínculo, as duas vazias.
 */
export function professoresDaTabela(professores: readonly ProfessorDaEscola[], vinculos: ListaDaEstrutura<VinculoDaCoordenacao> | undefined): ProfessorDaTabela[] {
  const doProfessor = new Map<string, VinculoDaCoordenacao[]>()
  for (const vinculo of vinculos?.itens ?? []) {
    if (!vinculoDaLinha(vinculo)) continue
    const dele = doProfessor.get(vinculo.usuarioId) ?? []
    dele.push(vinculo)
    doProfessor.set(vinculo.usuarioId, dele)
  }
  return ordenarPeloNome(professores).map((professor) => {
    const dele = doProfessor.get(professor.usuarioId) ?? []
    return {
      professor,
      turmas: nomesUnicos(dele.map((vinculo) => vinculo.turma)),
      disciplinas: nomesUnicos(dele.flatMap((vinculo) => (vinculo.disciplina === undefined ? [] : [vinculo.disciplina]))),
    }
  })
}

/**
 * O professor que o endereço abre: `?professor=<usuarioId>` **e que está na lista da escola**. O id que a lista não tem — de outra
 * escola, apagado, inventado, ou vazio — não abre nada, e não diz que existe (regra 10, item 6). Só o id vai ao endereço.
 */
export function professorDoEndereco(busca: string, professores: readonly ProfessorDaEscola[]): ProfessorDaEscola | undefined {
  const usuarioId = new URLSearchParams(busca).get(PROFESSOR_PARAM)
  return professores.find((professor) => professor.usuarioId === usuarioId)
}

/** A contagem ao lado do botão: "1 professor", "31 professores". */
export function contagemDeProfessores(quantos: number): string {
  return quantos === 1 ? '1 professor' : `${String(quantos)} professores`
}

/** Os estados do professor que não recebem turma: os que `ESTADOS_DO_PROFESSOR_ALOCAVEIS` não lista. */
type EstadoNaoAlocavel = Exclude<EstadoDoProfessor, (typeof ESTADOS_DO_PROFESSOR_ALOCAVEIS)[number]>

/**
 * O professor que a coordenação pode alocar: com o convite em aberto e dentro do prazo, ou já aceito. É a mesma lista pela qual
 * a API decide (`ESTADOS_DO_PROFESSOR_ALOCAVEIS`); o vencido, o revogado e o desativado ela recusa como inexistentes.
 */
export function professorAlocavel(estado: EstadoDoProfessor): estado is (typeof ESTADOS_DO_PROFESSOR_ALOCAVEIS)[number] {
  return (ESTADOS_DO_PROFESSOR_ALOCAVEIS as readonly EstadoDoProfessor[]).includes(estado)
}

const PORQUE_NAO_RECEBE_TURMA: Readonly<Record<EstadoNaoAlocavel, string>> = {
  vencido: 'O convite venceu. Refaça o convite para acrescentar uma turma.',
  revogado: 'O convite foi revogado. Para acrescentar uma turma, cadastre o mesmo e-mail de novo.',
  desativado: 'A conta foi desativada. Para acrescentar uma turma, cadastre o mesmo e-mail de novo.',
}

/** Por que o painel não oferece "Acrescentar turma" a este professor, em texto; `undefined` quando ele recebe turma. */
export function porQueNaoRecebeTurma(estado: EstadoDoProfessor): string | undefined {
  return professorAlocavel(estado) ? undefined : PORQUE_NAO_RECEBE_TURMA[estado]
}

/**
 * Os vínculos deste professor, **em todo estado** — o painel mostra também o contestado, que a escola ainda precisa corrigir, e o
 * encerrado, que já não é dele —, pela turma e, dentro dela, pela disciplina (7ºA antes de 10ºA). O vínculo de outra pessoa não entra.
 */
export function vinculosDoProfessor(vinculos: readonly VinculoDaCoordenacao[], usuarioId: string): VinculoDaCoordenacao[] {
  return ordenarVinculos(
    vinculos.filter((vinculo) => vinculo.papel === 'professor' && vinculo.usuarioId === usuarioId),
    () => '',
  )
}

/** Por que o vínculo acabou, como a coordenação o lê. */
export const MOTIVO_DO_ENCERRAMENTO: Readonly<Record<MotivoDeEncerramentoDeVinculo, string>> = {
  fim_do_ano: 'fim do ano letivo',
  desligamento: 'desligamento',
  realocacao: 'realocação',
}
