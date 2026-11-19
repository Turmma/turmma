import {
  InvalidConfigError,
  isEscolaConcurrencyLimitDisabled,
  readJanelaPadrao,
  readVagasPadrao,
  loadDatabaseConfig,
  loadLLMConfig,
  loadTelemetryConfig,
  validateEnvironment,
  type ConcurrencyByQueue,
  type DatabaseConfig,
  type JanelaLetiva,
  type LLMConfig,
  type TelemetryConfig,
} from '@educa/core'
import { z } from 'zod'
import { FILAS_DA_IA, type FilaDaIa } from './ia/worker-de-ia.js'

export { InvalidConfigError }

/**
 * Variável do pool de cada fila da IA: `WORKER_IA_POOL_INTERATIVA`, `WORKER_IA_POOL_FERRAMENTA`, `WORKER_IA_POOL_NORMAL`, `WORKER_IA_POOL_LOTE`. Com prefixo próprio porque o
 * `worker-interativo` lê `WORKER_POOL_INTERATIVA` e `WORKER_POOL_NORMAL` com outros valores (50 e 30), na mesma `.env`.
 */
export function variavelDoPoolDaIa(fila: FilaDaIa): string {
  return `WORKER_IA_POOL_${fila.toUpperCase()}`
}

const envSchema = z.object({
  REDIS_FILA_URL: z.string().regex(/^redis:\/\/[^/\s]+(\/\d+)?$/),
})

export interface MainWorkerConfig {
  /** O pool de banco da réplica: `BANCO_POOL_MAXIMO` (20 por `worker-ia`, comportado por `POSTGRES_CONEXOES_MAXIMAS`). Nenhum job o segura durante o modelo. */
  readonly banco: DatabaseConfig
  readonly redisFilaUrl: string
  /** Jobs de IA ao mesmo tempo nesta réplica, por fila. */
  readonly pools: Readonly<Record<FilaDaIa, number>>
  /** Vagas por fila da escola sem vagas próprias (D41). */
  readonly vagasPadrao: ConcurrencyByQueue
  /** O horário letivo de toda escola sem horário próprio (D41): o job do `lote` que volta dentro dele é adiado até o fim (classificacao-bncc, 4.0). */
  readonly janelaPadrao: JanelaLetiva
  /** Só no controle negativo do cenário de carga; o boot recusa a flag com `AMBIENTE=producao`. */
  readonly vagasPorEscolaDesligadas?: true
  readonly telemetria: TelemetryConfig
  /** A camada de IA: o adaptador, o modelo de cada perfil, o prazo da chamada e `IA_REPLICAS`. Só o `main-worker` monta o provedor. */
  readonly ia: LLMConfig
}

/** Lê e valida o ambiente do `main-worker`. Todos os problemas saem de uma vez, só pelo nome da variável. */
export function loadWorkerConfig(ambiente: Record<string, string | undefined>): MainWorkerConfig {
  const problemas: InvalidConfigError[] = []
  const read = <T>(leitura: () => T): T | undefined => {
    try {
      return leitura()
    } catch (erro) {
      if (!(erro instanceof InvalidConfigError)) throw erro
      problemas.push(erro)
      return undefined
    }
  }
  const banco = read(() => loadDatabaseConfig(ambiente))
  const proprio = read(() => validateEnvironment(envSchema, ambiente))
  const inteiroPositivo = z.coerce.number().int().positive()
  const pools = read(() => validateEnvironment(z.object(Object.fromEntries(FILAS_DA_IA.map((fila) => [variavelDoPoolDaIa(fila), inteiroPositivo]))), ambiente))
  const vagasPadrao = read(() => readVagasPadrao(ambiente))
  const vagasDesligadas = read(() => isEscolaConcurrencyLimitDisabled(ambiente))
  const janelaPadrao = read(() => readJanelaPadrao(ambiente))
  const telemetria = read(() => loadTelemetryConfig(ambiente))
  const ia = read(() => loadLLMConfig(ambiente))
  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
    // Sem repetir: o `AMBIENTE` é lido pelo banco e de novo pela IA, que o usa para a trava de produção.
    throw new InvalidConfigError([...new Set(problemas.flatMap((erro) => erro.variaveis))].sort(), problemas.flatMap((erro) => erro.motivos))
  }
  return {
    banco,
    redisFilaUrl: proprio.REDIS_FILA_URL,
    pools: Object.fromEntries(FILAS_DA_IA.map((fila) => [fila, Number(pools[variavelDoPoolDaIa(fila)])])) as Record<FilaDaIa, number>,
    vagasPadrao,
    janelaPadrao,
    ...(vagasDesligadas ? { vagasPorEscolaDesligadas: true as const } : {}),
    telemetria,
    ia,
  }
}
