import { requireEscolaId, usuario, type DatabaseTransaction } from '@educa/core'
import { and, eq, isNull } from 'drizzle-orm'

/**
 * O usuário alvo da redefinição do MFA, procurado só na escola do contexto: id de outra escola, ou de ninguém, não
 * acha nada. Devolve só a conta dele, nunca o nome.
 */
export class RedefinicaoDeMfaRepository {
  constructor(private readonly tx: DatabaseTransaction) {}

  async contaDoUsuarioAtivo(usuarioId: string): Promise<string | undefined> {
    const [linha] = await this.tx
      .select({ contaId: usuario.contaId })
      .from(usuario)
      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId), isNull(usuario.desativadoEm)))
      .limit(1)
    return linha?.contaId ?? undefined
  }
}
