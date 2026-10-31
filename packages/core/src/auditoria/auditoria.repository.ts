import { desc, eq } from 'drizzle-orm'
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import { currentContext } from '../context/context.js'
import type { Schema } from '../db/database.js'
import { auditoria } from '../db/schema/auditoria.js'
import { AuditoriaRejectedError } from './auditoria-rejected.error.js'

/** O banco ou a transação de quem chama: a gravação vai junto com a ação auditada, e desfaz junto. */
export type DatabaseExecutor = PgDatabase<NodePgQueryResultHKT, Schema>

export interface RegistroAuditado {
  id: string
  escolaId: string | null
  autorUsuarioId: string | null
  autorOperador: string | null
  acao: string
  entidade: string
  entidadeId: string
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  finalidade: string | null
  requisicaoId: string
  em: Date
}

export const LIMITE_PADRAO_DA_LISTAGEM = 100
export const LIMITE_MAXIMO_DA_LISTAGEM = 500

/**
 * Leitura de `auditoria` no escopo da escola do contexto (regra 10, item 3). Só lê: a escrita tem uma
 * porta só, o `AuditoriaRecorder`. Não tem rota: a listagem serve ao teste e ao F3, que acrescenta
 * período, cursor e finalidade da consulta.
 */
export class AuditoriaRepository {
  constructor(private readonly banco: DatabaseExecutor) {}

  /** Os registros mais recentes da escola do contexto, do mais novo ao mais antigo. Sem escola, recusa. */
  async listarDaEscola(limite: number = LIMITE_PADRAO_DA_LISTAGEM): Promise<RegistroAuditado[]> {
    const escolaId = currentContext()?.escolaId
    if (escolaId === undefined) throw new AuditoriaRejectedError('sem_escola')
    return this.banco
      .select()
      .from(auditoria)
      .where(eq(auditoria.escolaId, escolaId))
      .orderBy(desc(auditoria.em), desc(auditoria.id))
      .limit(Math.min(Math.max(1, Math.trunc(limite)), LIMITE_MAXIMO_DA_LISTAGEM))
  }
}
