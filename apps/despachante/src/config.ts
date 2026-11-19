import {
  InvalidConfigError,
  loadDatabaseConfig,
  loadTelemetryConfig,
  readJanelaPadrao,
  readVagasPadrao,
  isEscolaConcurrencyLimitDisabled,
  validateEnvironment,
  type DatabaseConfig,
  type TelemetryConfig,
  type JanelaLetiva,
  type ConcurrencyByQueue,
} from '@educa/core'
import { z } from 'zod'

export { InvalidConfigError }

const envSchema = z.object({
  REDIS_FILA_URL: z.string().regex(/^redis:\/\/[^/\s]+(\/\d+)?$/),
})

export interface DespachanteConfig {
  /** Pool próprio, com o `statement_timeout` do ambiente; a conexão do `LISTEN` sai dele. */
  banco: DatabaseConfig
  redisFilaUrl: string
  /** Vagas simultâneas por fila da escola que não configurou as próprias (D41). */
  vagasPadrao: ConcurrencyByQueue
  /** Horário letivo da escola que não configurou o próprio, em que o lote não urgente fica segurado (D41). */
  janelaPadrao: JanelaLetiva
  /**
   * Só no controle negativo do cenário de carga (`VAGAS_POR_ESCOLA_DESLIGADAS=true`): nenhuma escola tem teto
   * de jobs simultâneos. Ausente é o normal. O boot recusa a flag com `AMBIENTE=producao`.
   */
  vagasPorEscolaDesligadas?: true
  /** Para onde e de quanto em quanto tempo as métricas vão. */
  telemetria: TelemetryConfig
}

/** Lê e valida o ambiente do despachante. Todos os problemas saem de uma vez, só pelo nome. */
export function loadConfig(ambiente: Record<string, string | undefined>): DespachanteConfig {
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
  const vagasPadrao = read(() => readVagasPadrao(ambiente))
  const janelaPadrao = read(() => readJanelaPadrao(ambiente))
  const vagasDesligadas = read(() => isEscolaConcurrencyLimitDisabled(ambiente))
  const telemetria = read(() => loadTelemetryConfig(ambiente))
  if (banco === undefined || proprio === undefined || vagasPadrao === undefined || janelaPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined) {
    throw new InvalidConfigError(problemas.flatMap((erro) => erro.variaveis).sort(), problemas.flatMap((erro) => erro.motivos))
  }
  return {
    banco,
    redisFilaUrl: proprio.REDIS_FILA_URL,
    vagasPadrao,
    janelaPadrao,
    ...(vagasDesligadas ? { vagasPorEscolaDesligadas: true as const } : {}),
    telemetria,
  }
}
