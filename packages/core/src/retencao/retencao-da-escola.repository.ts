import type { AjusteDeRetencao, CategoriaDeRetencao } from '@educa/shared'
import { eq, sql } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { escola } from '../db/schema/escola.js'
import { retencaoEscola } from '../db/schema/retencao-escola.js'

/** O ajuste que o `ops:retencao` grava: a categoria, os meses, o número do contrato e o apelido do operador. */
export interface AjusteAGravar {
  readonly categoria: CategoriaDeRetencao
  readonly meses: number
  readonly referenciaContrato: number
  readonly alteradaPor: string
}

/**
 * `retencao_escola` no escopo da escola do contexto (regra 10, item 3; Tech Spec do F3, seção 6): o comando da operação
 * abre o contexto da escola antes de ajustar, a API lê a da escola do token, e o expurgo (tarefas 3.0 a 5.0), a da
 * escola do job. Não existe leitura nem escrita por escola vinda de argumento, e nenhum método é `@Unscoped`.
 *
 * O prazo efetivo, com as travas, sai de `retencaoDaEscola` (`@educa/shared`) sobre os `ajustes()` daqui.
 */
export class RetencaoDaEscolaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** Os ajustes da escola do contexto. Categoria sem linha usa o padrão do catálogo. */
  async ajustes(): Promise<AjusteDeRetencao[]> {
    return this.banco
      .select({ categoria: retencaoEscola.categoria, meses: retencaoEscola.meses })
      .from(retencaoEscola)
      .where(eq(retencaoEscola.escolaId, requireEscolaId()))
  }

  /**
   * Trava a escola do contexto até o fim da transação (`for no key update`, que não briga com as FKs que apontam para
   * ela) e diz se ela existe. Dois ajustes da mesma escola ao mesmo tempo passam um de cada vez: o segundo lê os ajustes
   * depois de o primeiro confirmar, e confere as travas e grava o `antes` da auditoria sobre eles.
   */
  async travarEscola(): Promise<boolean> {
    const linhas = await this.banco.select({ id: escola.id }).from(escola).where(eq(escola.id, requireEscolaId())).for('no key update')
    return linhas.length > 0
  }

  /** Grava o ajuste da escola do contexto na categoria, por cima do anterior, se houver. */
  async gravar(ajuste: AjusteAGravar): Promise<void> {
    await this.banco
      .insert(retencaoEscola)
      .values({ escolaId: requireEscolaId(), ...ajuste })
      .onConflictDoUpdate({
        target: [retencaoEscola.escolaId, retencaoEscola.categoria],
        set: { meses: ajuste.meses, referenciaContrato: ajuste.referenciaContrato, alteradaPor: ajuste.alteradaPor, alteradaEm: sql`now()` },
      })
  }
}
