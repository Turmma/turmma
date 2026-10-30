import { convite, requireEscolaId, usuario, type Database, type DadosDoProfessor, type DatabaseTransaction, type UltimoConviteDoProfessor } from '@educa/nucleo'
import type { PaginationQuery } from '@educa/shared'
import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm'

/** Um professor da página, com o que decide o estado dele (`estadoDoProfessor`): nunca o e-mail nem a conta. */
export interface ProfessorLido extends DadosDoProfessor {
  readonly usuarioId: string
  readonly nome: string
}

/**
 * Os professores da escola do contexto, para a lista da coordenação (A1, tarefa 3.0): a escola vem do contexto que a
 * `SessaoGuard` gravou, nunca de argumento (regra 10, item 3). O usuário não pertence a um ano letivo: a lista é da
 * escola.
 */
export class ProfessoresRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Uma página dos usuários `professor` da escola, em ordem de id (`limite + 1`, para o `paginar` saber se há próxima), e
   * o último convite `tipo = 'professor'` de cada um (maior `expira_em`, depois maior `id`, a mesma ordem de
   * `ConviteRepository.dadosDoProfessor`), com a hora do banco. Os convites são lidos só para os ids da página, com a
   * escola no `where` das duas consultas, pelo índice `convite_escola_usuario_idx`.
   */
  async pagina({ pagina, limite }: PaginationQuery): Promise<ProfessorLido[]> {
    const escolaId = requireEscolaId()
    const professores = await this.banco
      .select({ usuarioId: usuario.id, nome: usuario.nome, desativadoEm: usuario.desativadoEm, agora: sql<Date>`now()`.mapWith(usuario.desativadoEm) })
      .from(usuario)
      .where(and(eq(usuario.escolaId, escolaId), eq(usuario.papel, 'professor'), pagina === undefined ? undefined : gt(usuario.id, pagina)))
      .orderBy(asc(usuario.id))
      .limit(limite + 1)
    if (professores.length === 0) return []
    const convites = await this.banco
      .select({ usuarioId: convite.usuarioId, id: convite.id, expiraEm: convite.expiraEm, usadoEm: convite.usadoEm, revogadoEm: convite.revogadoEm })
      .from(convite)
      .where(
        and(
          eq(convite.escolaId, escolaId),
          eq(convite.tipo, 'professor'),
          inArray(
            convite.usuarioId,
            professores.map((professor) => professor.usuarioId),
          ),
        ),
      )
      .orderBy(asc(convite.usuarioId), desc(convite.expiraEm), desc(convite.id))
    const ultimo = new Map<string, UltimoConviteDoProfessor>()
    for (const { usuarioId, ...lido } of convites) if (!ultimo.has(usuarioId)) ultimo.set(usuarioId, lido)
    return professores.map(({ usuarioId, nome, desativadoEm, agora }) => ({ usuarioId, nome, desativadoEm, agora, ultimoConvite: ultimo.get(usuarioId) }))
  }
}
