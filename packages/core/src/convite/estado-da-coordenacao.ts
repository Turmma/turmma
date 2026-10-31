import type { EstadoDaCoordenacao } from '@educa/shared'

/**
 * O último convite de coordenação da escola (maior `expira_em`, depois maior `id`), com a data em que o usuário dele ficou
 * inativo: só datas e o id, nada da pessoa.
 */
export interface UltimoConviteDaCoordenacao {
  readonly id: string
  readonly expiraEm: Date
  readonly usadoEm: Date | null
  readonly revogadoEm: Date | null
  /** `desativado_em` do usuário do convite: nulo quando ele está ativo. */
  readonly usuarioDesativadoEm: Date | null
}

/** O que decide o estado: se há coordenador ativo, o último convite de coordenação e a hora do banco. */
export interface DadosDaCoordenacao {
  readonly coordenadorAtivo: boolean
  readonly ultimoConvite: UltimoConviteDaCoordenacao | undefined
  /** A hora do banco, a mesma régua do `expira_em > now()` do aceite. */
  readonly agora: Date
}

/**
 * O estado da primeira coordenação de uma escola (Tech Spec da A0b, seção 5). A escrita (gerar, refazer, revogar) o lê
 * sob a trava da escola, e a lista o mostra: as duas usam esta função, e só ela.
 *
 * - `ativa`: há coordenador ativo na escola;
 * - senão, pelo último convite de coordenação:
 *   - nenhum → `sem_convite`;
 *   - revogado → `revogado`;
 *   - não usado e com `expira_em` já alcançado → `vencido` (o aceite exige `expira_em > now()`);
 *   - não usado → `pendente`;
 *   - usado, com o usuário dele inativo desde antes do aceite (`desativado_em <= usado_em`, a mesma condição com que o
 *     login o ativa) → `aceito`: falta a primeira entrada;
 *   - usado, com o usuário desativado depois do aceite → `sem_coordenacao`.
 *
 * Convite usado com o usuário ativo quer dizer coordenador ativo: sai `ativa` mesmo que `coordenadorAtivo` tenha vindo
 * falso, porque o usuário de um convite de coordenação é coordenador.
 */
export function estadoDaCoordenacao({ coordenadorAtivo, ultimoConvite, agora }: DadosDaCoordenacao): EstadoDaCoordenacao {
  if (coordenadorAtivo) return 'ativa'
  if (ultimoConvite === undefined) return 'sem_convite'
  if (ultimoConvite.revogadoEm !== null) return 'revogado'
  if (ultimoConvite.usadoEm === null) return ultimoConvite.expiraEm.getTime() > agora.getTime() ? 'pendente' : 'vencido'
  if (ultimoConvite.usuarioDesativadoEm === null) return 'ativa'
  return ultimoConvite.usuarioDesativadoEm.getTime() <= ultimoConvite.usadoEm.getTime() ? 'aceito' : 'sem_coordenacao'
}
