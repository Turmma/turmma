import type { EstadoDoProfessor } from '@educa/shared'

/**
 * O último convite de professor de um usuário na escola (maior `expira_em`, depois maior `id`): só datas e o id, nada da
 * pessoa.
 */
export interface UltimoConviteDoProfessor {
  readonly id: string
  readonly expiraEm: Date
  readonly usadoEm: Date | null
  readonly revogadoEm: Date | null
}

/** O que decide o estado: o `desativado_em` do usuário professor, o último convite de professor dele e a hora do banco. */
export interface DadosDoProfessor {
  /** Nulo quando o professor está ativo na escola. */
  readonly desativadoEm: Date | null
  readonly ultimoConvite: UltimoConviteDoProfessor | undefined
  /** A hora do banco, a mesma régua do `expira_em > now()` do aceite. */
  readonly agora: Date
}

/**
 * O estado do professor na escola, pelo convite dele (A1, tarefa 3.0; `ESTADOS_DO_PROFESSOR`, de `@educa/shared`). A
 * lista da coordenação o mostra, e o refazer e o revogar o leem sob a trava da escola e decidem pelas matrizes de
 * `@educa/shared`: as duas usam esta função, e só ela.
 *
 * - Ativo: `aceito` se o último convite de professor foi usado, `ativo` se não (o professor de antes da A1);
 * - inativo, pelo último convite de professor:
 *   - nenhum → `desativado`;
 *   - revogado → `revogado`;
 *   - não usado e com `expira_em` já alcançado → `vencido` (o aceite exige `expira_em > now()`); não usado → `pendente`;
 *   - usado, com o usuário inativo desde antes do aceite (`desativado_em <= usado_em`, a mesma condição com que o login o
 *     ativa) → `aceito`: falta a primeira entrada com a senha que a conta já tinha;
 *   - usado, com o usuário desativado depois do aceite → `desativado`.
 *
 * O `aceito` junta o professor ativo pelo convite e o que espera a primeira entrada: separar os dois diria à coordenação
 * se o e-mail tinha conta em outra escola, porque só a conta nova é ativada já no aceite (E11).
 */
export function estadoDoProfessor({ desativadoEm, ultimoConvite, agora }: DadosDoProfessor): EstadoDoProfessor {
  if (desativadoEm === null) return ultimoConvite !== undefined && ultimoConvite.usadoEm !== null ? 'aceito' : 'ativo'
  if (ultimoConvite === undefined) return 'desativado'
  if (ultimoConvite.revogadoEm !== null) return 'revogado'
  if (ultimoConvite.usadoEm === null) return ultimoConvite.expiraEm.getTime() > agora.getTime() ? 'pendente' : 'vencido'
  return desativadoEm.getTime() <= ultimoConvite.usadoEm.getTime() ? 'aceito' : 'desativado'
}
