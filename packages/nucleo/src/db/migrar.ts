import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'node:url'
import { setTimeout as esperar } from 'node:timers/promises'
import pg from 'pg'
import { postgresErrorIn, summarizeError } from '../erro/resumir-erro.js'
import type { LoggerBase } from '../log/logger.js'

/** Pasta das migrations geradas pelo drizzle-kit. Mesma profundidade em `src/db` e em `dist/db`. */
export const PASTA_MIGRACOES = fileURLToPath(new URL('../../drizzle', import.meta.url))

/**
 * Espera máxima por um lock. A migration só expande, mas até expandir pede lock na tabela: com uma
 * consulta longa segurando a tabela, esperar sem prazo enfileiraria atrás dela toda consulta da API.
 * Melhor desistir em 5 s e tentar de novo.
 */
export const LOCK_TIMEOUT_MIGRACAO_MS = 5_000
export const TENTATIVAS_MIGRACAO = 3
const RECUO_ENTRE_TENTATIVAS_MS = 1_000

/** `lock_not_available`: o `lock_timeout` estourou. É o único erro que vale tentar de novo. */
const SQLSTATE_LOCK_TIMEOUT = '55P03'

/** Chave do advisory lock que impede duas migrações ao mesmo tempo (`docker compose up` em paralelo). */
const CHAVE_LOCK_MIGRACAO = 7_000_001

export interface MigrationConfig {
  url: string
  /** Prazo de cada instrução. Maior que o da API: criar índice pode passar de 2 s. */
  timeoutConsultaMs: number
  timeoutConexaoMs: number
  lockTimeoutMs?: number
  tentativas?: number
  pasta?: string
  /** Onde o drizzle registra o que já foi aplicado. Só o teste troca, para não tocar o registro real. */
  schemaDoRegistro?: string
}

export class MigrationFailedError extends Error {
  readonly tentativas: number

  constructor(tentativas: number) {
    super('migracao.falhou')
    this.tentativas = tentativas
    this.name = 'MigrationFailedError'
  }
}

async function aplicarUmaVez(config: MigrationConfig): Promise<void> {
  const cliente = new pg.Client({
    connectionString: config.url,
    connectionTimeoutMillis: config.timeoutConexaoMs,
    statement_timeout: config.timeoutConsultaMs,
    lock_timeout: config.lockTimeoutMs ?? LOCK_TIMEOUT_MIGRACAO_MS,
  })
  // Sem ouvinte, a queda da conexão no meio encerraria o processo sem log.
  cliente.on('error', () => undefined)
  await cliente.connect()
  try {
    // O advisory lock também respeita o `lock_timeout`: outra migração em andamento vira nova tentativa.
    await cliente.query('select pg_advisory_lock($1)', [CHAVE_LOCK_MIGRACAO])
    await drizzleMigrate(drizzle({ client: cliente }), {
      migrationsFolder: config.pasta ?? PASTA_MIGRACOES,
      migrationsSchema: config.schemaDoRegistro ?? 'drizzle',
    })
  } finally {
    await cliente.end()
  }
}

/**
 * Aplica as migrations pendentes, todas numa transação (o migrador do drizzle já faz assim).
 * Roda no serviço `migrar`, antes de qualquer instância subir. Tenta de novo só quando o
 * `lock_timeout` estoura; qualquer outro erro falha na hora, porque repetir não o resolve.
 */
export async function migrate(config: MigrationConfig, logger: LoggerBase): Promise<void> {
  const tentativas = config.tentativas ?? TENTATIVAS_MIGRACAO
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      await aplicarUmaVez(config)
      logger.info({ evento: 'migracao.concluida', tentativa })
      return
    } catch (erro) {
      // O migrador do Drizzle embrulha o erro do servidor.
      const esperouLock = postgresErrorIn(erro)?.code === SQLSTATE_LOCK_TIMEOUT
      logger.warn({ evento: 'migracao.tentativa_falhou', tentativa, erro: summarizeError(erro) })
      if (!esperouLock) throw new MigrationFailedError(tentativa)
      if (tentativa < tentativas) await esperar(RECUO_ENTRE_TENTATIVAS_MS)
    }
  }
  throw new MigrationFailedError(tentativas)
}
