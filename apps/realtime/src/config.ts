import {
  InvalidConfigError,
  loadDatabaseConfig,
  loadGracefulShutdownConfig,
  loadAuthConfig,
  loadTelemetryConfig,
  validateEnvironment,
  type DatabaseConfig,
  type GracefulShutdownConfig,
  type AuthConfig,
  type TelemetryConfig,
} from '@educa/core'
import { z } from 'zod'

export { InvalidConfigError }

const inteiroPositivo = z.coerce.number().int().positive()

const envSchema = z.object({
  REALTIME_PORTA: inteiroPositivo,
  REDIS_FILA_URL: z.string().regex(/^redis:\/\/[^/\s]+(\/\d+)?$/),
  REALTIME_STREAM_TAMANHO_MAXIMO: inteiroPositivo,
})

export interface RealtimeConfig {
  porta: number
  redis: {
    url: string
    /** Teto de mensagens guardadas no stream do adaptador, no Redis de fila (`noeviction`). */
    tamanhoMaximoDoStream: number
  }
  identidade: AuthConfig
  /** O handshake lê a sessão no Postgres, com a mesma consulta da API (Tech Spec, seção 5, "Requisição"). */
  banco: DatabaseConfig
  drenagem: GracefulShutdownConfig
  /** Para onde e de quanto em quanto tempo as métricas vão. */
  telemetria: TelemetryConfig
}

type Leitura<T> = { valor: T } | { erro: InvalidConfigError }

function tentar<T>(ler: () => T): Leitura<T> {
  try {
    return { valor: ler() }
  } catch (erro) {
    if (erro instanceof InvalidConfigError) return { erro }
    throw erro
  }
}

/**
 * Lê e valida o ambiente do realtime, incluindo o banco: desde a tarefa 3.0 o handshake lê a sessão
 * gravada, e sem Postgres o realtime não autentica ninguém. Não sobe com variável faltando ou
 * inválida, e todos os problemas saem de uma vez, só pelo nome da variável.
 */
export function loadConfig(ambiente: Record<string, string | undefined>): RealtimeConfig {
  const realtime = tentar(() => validateEnvironment(envSchema, ambiente))
  const identidade = tentar(() => loadAuthConfig(ambiente))
  const banco = tentar(() => loadDatabaseConfig(ambiente))
  const drenagem = tentar(() => loadGracefulShutdownConfig(ambiente))
  const telemetria = tentar(() => loadTelemetryConfig(ambiente))
  if ('erro' in realtime || 'erro' in identidade || 'erro' in banco || 'erro' in drenagem || 'erro' in telemetria) {
    const erros = [realtime, identidade, banco, drenagem, telemetria].flatMap((leitura) => ('erro' in leitura ? [leitura.erro] : []))
    throw new InvalidConfigError(
      erros.flatMap((erro) => erro.variaveis).sort(),
      erros.flatMap((erro) => erro.motivos),
    )
  }
  return {
    porta: realtime.valor.REALTIME_PORTA,
    redis: { url: realtime.valor.REDIS_FILA_URL, tamanhoMaximoDoStream: realtime.valor.REALTIME_STREAM_TAMANHO_MAXIMO },
    identidade: identidade.valor,
    banco: banco.valor,
    drenagem: drenagem.valor,
    telemetria: telemetria.valor,
  }
}
