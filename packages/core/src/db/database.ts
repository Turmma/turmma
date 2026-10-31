import type { ExtractTablesWithRelations } from 'drizzle-orm'
import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { validateEnvironment } from '../config/validate-config.js'
import type { DatabaseConfig, DatabasePool } from './pool.js'
import { acessoTurma } from './schema/acesso-turma.js'
import { anoLetivo } from './schema/ano-letivo.js'
import { codigoRecuperacao } from './schema/codigo-recuperacao.js'
import { configuracaoOperacionalEscola } from './schema/configuracao-operacional-escola.js'
import { conta } from './schema/conta.js'
import { contaExterna } from './schema/conta-externa.js'
import { credencialMatricula } from './schema/credencial-matricula.js'
import { convite } from './schema/convite.js'
import { disciplina } from './schema/disciplina.js'
import { escola } from './schema/escola.js'
import { jobRegistro } from './schema/job-registro.js'
import { listaNome } from './schema/lista-nome.js'
import { mvpTables } from './schema/mvp/tables.js'
import { provedorEscola } from './schema/provedor-escola.js'
import { rede } from './schema/rede.js'
import { registroAcesso } from './schema/registro-acesso.js'
import { reivindicacao } from './schema/reivindicacao.js'
import { retencaoEscola } from './schema/retencao-escola.js'
import { serie } from './schema/serie.js'
import { sessao } from './schema/sessao.js'
import { turma } from './schema/turma.js'
import { usoInfraDiario } from './schema/uso-infra-diario.js'
import { usuario } from './schema/usuario.js'
import { vinculo } from './schema/vinculo.js'

// Sem `auditoria`: a tabela só é alcançável pelo módulo de inserção e pela leitura da auditoria, nunca
// pelo `schema` que o pacote exporta (a escrita tem uma porta só, o AuditoriaRecorder). Sem as seis tabelas da
// operação (`db/schema/operador.ts`), pelo mesmo motivo: só o `OperadorRepository` as toca, e a consulta relacional
// (`banco.query.*`) não as alcançaria de fora sem passar por um `import` que o teste de arquitetura vê.
// As dezessete tabelas do MVP de apresentação (migration 0022) entram juntas, por `mvpTables`.
export const schema = { jobRegistro, configuracaoOperacionalEscola, usoInfraDiario, rede, escola, anoLetivo, conta, codigoRecuperacao, usuario, sessao, registroAcesso, convite, serie, disciplina, turma, vinculo, credencialMatricula, contaExterna, provedorEscola, listaNome, acessoTurma, reivindicacao, retencaoEscola, ...mvpTables }
export type Schema = typeof schema

export type Database = NodePgDatabase<Schema>

/** A transação aberta por quem chama. Quem recebe isto grava junto, e desfaz junto. */
export type DatabaseTransaction = PgTransaction<NodePgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>

/** Drizzle sobre o pool do processo, com os nomes do banco em snake_case (Tech Spec, seção 3). */
export function createDatabase(pool: DatabasePool): Database {
  return drizzle({ client: pool, schema, casing: 'snake_case' })
}

const inteiroPositivo = z.coerce.number().int().positive()

const databaseEnvSchema = z.object({
  BANCO_URL: z.string().regex(/^postgres(ql)?:\/\/[^/]+\/[^/]+$/),
  BANCO_POOL_MAXIMO: inteiroPositivo,
  BANCO_TIMEOUT_CONEXAO_MS: inteiroPositivo,
  BANCO_TIMEOUT_CONSULTA_MS: inteiroPositivo,
})

/**
 * Banco de todo processo que tem pool: API, despachante e worker. Cada um lê o próprio
 * `BANCO_POOL_MAXIMO`, e todos têm `statement_timeout`: nenhum processo fica com consulta sem prazo.
 */
export function loadDatabaseConfig(ambiente: Record<string, string | undefined>): DatabaseConfig {
  const valores = validateEnvironment(databaseEnvSchema, ambiente)
  return {
    url: valores.BANCO_URL,
    maximoConexoes: valores.BANCO_POOL_MAXIMO,
    timeoutConexaoMs: valores.BANCO_TIMEOUT_CONEXAO_MS,
    timeoutConsultaMs: valores.BANCO_TIMEOUT_CONSULTA_MS,
  }
}
