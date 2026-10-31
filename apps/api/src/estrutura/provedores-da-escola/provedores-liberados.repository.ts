import { escola, requireEscolaId, provedorEscola, type ProvedorExterno, type DatabaseTransaction } from '@educa/core'
import { and, eq, inArray, isNull } from 'drizzle-orm'

/** Uma linha liberada: o id (o que a auditoria guarda), o provedor e o domínio ou tenant. */
export interface ProvedorLiberado {
  readonly id: string
  readonly provedor: ProvedorExterno
  readonly valor: string
}

/**
 * Os domínios Google e tenants Microsoft liberados, da escola do contexto e só dela (regra 10, item 3): nenhum método
 * recebe escola. A linha retirada nunca é apagada: ganha `removido_em`, para o id da auditoria continuar dizendo qual
 * domínio foi.
 */
export class ProvedoresLiberadosRepository {
  constructor(private readonly tx: DatabaseTransaction) {}

  /**
   * Trava a linha da escola até o fim da transação: duas trocas da lista ao mesmo tempo passam uma depois da outra, e
   * a segunda lê o `antes` já com a primeira. `FOR NO KEY UPDATE`, que não segura o login nem a renovação da escola.
   */
  async travarEscola(): Promise<boolean> {
    const [linha] = await this.tx.select({ id: escola.id }).from(escola).where(eq(escola.id, requireEscolaId())).for('no key update')
    return linha !== undefined
  }

  /** Os liberados agora, na ordem de criação. */
  async liberados(): Promise<ProvedorLiberado[]> {
    return this.tx
      .select({ id: provedorEscola.id, provedor: provedorEscola.provedor, valor: provedorEscola.valor })
      .from(provedorEscola)
      .where(and(eq(provedorEscola.escolaId, requireEscolaId()), isNull(provedorEscola.removidoEm)))
      .orderBy(provedorEscola.id)
  }

  /** Retira da lista as linhas com estes ids, da escola do contexto. */
  async retirar(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return
    await this.tx
      .update(provedorEscola)
      .set({ removidoEm: new Date() })
      .where(and(eq(provedorEscola.escolaId, requireEscolaId()), inArray(provedorEscola.id, [...ids]), isNull(provedorEscola.removidoEm)))
  }

  /** Libera os domínios e tenants novos na escola do contexto. */
  async liberar(novos: ReadonlyArray<{ provedor: ProvedorExterno; valor: string }>): Promise<void> {
    if (novos.length === 0) return
    const escolaId = requireEscolaId()
    await this.tx.insert(provedorEscola).values(novos.map((novo) => ({ escolaId, provedor: novo.provedor, valor: novo.valor })))
  }
}
