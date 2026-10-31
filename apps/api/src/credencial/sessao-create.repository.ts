import { requireEscolaId, sessao, usuario, type MetodoDeSessao, type DatabaseTransaction } from '@educa/core'
import type { PapelDeUsuario } from '@educa/shared'
import { sql } from 'drizzle-orm'

export interface UsuarioNovo {
  readonly contaId: string | null
  readonly papel: PapelDeUsuario
  readonly nome: string
}

export interface SessaoNova {
  readonly usuarioId: string
  readonly contaId: string | null
  readonly metodo: MetodoDeSessao
  readonly refreshHash: string
  readonly duracaoHoras: number
}

/**
 * Grava usuário e sessão na escola do contexto, nunca na de um argumento. A FK composta `(escola_id, usuario_id)` da
 * sessão recusa usuário de outra escola, mesmo que o id chegue trocado.
 */
export class SessaoCreateRepository {
  constructor(private readonly tx: DatabaseTransaction) {}

  /** Os usuários criados, com a conta de cada um: quem chama casa pela conta, sem depender da ordem do `returning`. */
  async criarUsuarios(novos: readonly UsuarioNovo[]): Promise<Array<{ id: string; contaId: string | null }>> {
    if (novos.length === 0) return []
    const escolaId = requireEscolaId()
    return this.tx
      .insert(usuario)
      .values(novos.map((novo) => ({ ...novo, escolaId })))
      .returning({ id: usuario.id, contaId: usuario.contaId })
  }

  /** As sessões criadas, com o usuário de cada uma. */
  async criarSessoes(novas: readonly SessaoNova[]): Promise<Array<{ id: string; usuarioId: string }>> {
    if (novas.length === 0) return []
    const escolaId = requireEscolaId()
    const criadas = await this.tx
      .insert(sessao)
      .values(
        novas.map((nova) => ({
          escolaId,
          usuarioId: nova.usuarioId,
          contaId: nova.contaId,
          metodo: nova.metodo,
          familia: sql`uuidv7()`,
          refreshHash: nova.refreshHash,
          expiraEm: sql`now() + make_interval(hours => ${nova.duracaoHoras})`,
        })),
      )
      .returning({ id: sessao.id, usuarioId: sessao.usuarioId })
    return criadas
  }
}
