import {
  InvalidConfigError,
  loadDatabaseConfig,
  loadTelemetryConfig,
  lerJanelaPadrao,
  lerVagasPadrao,
  isEscolaConcurrencyLimitDisabled,
  validateEnvironment,
  type DatabaseConfig,
  type TelemetryConfig,
  type JanelaLetiva,
  type ConcurrencyByQueue,
} from '@educa/core'
import { z } from 'zod'

export { InvalidConfigError }

const esquemaAmbiente = z.object({
  REDIS_FILA_URL: z.string().regex(/^redis:\/\/[^/\s]+(\/\d+)?$/),
})

export interface ConfiguracaoDespachante {
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
export function lerConfiguracao(ambiente: Record<string, string | undefined>): ConfiguracaoDespachante {
  const problemas: InvalidConfigError[] = []
  const ler = <T>(leitura: () => T): T | undefined => {
    try {
      return leitura()
    } catch (erro) {
      if (!(erro instanceof InvalidConfigError)) throw erro
      problemas.push(erro)
      return undefined
    }
  }
  const banco = ler(() => loadDatabaseConfig(ambiente))
  const proprio = ler(() => validateEnvironment(esquemaAmbiente, ambiente))
  const vagasPadrao = ler(() => lerVagasPadrao(ambiente))
  const janelaPadrao = ler(() => lerJanelaPadrao(ambiente))
  const vagasDesligadas = ler(() => isEscolaConcurrencyLimitDisabled(ambiente))
  const telemetria = ler(() => loadTelemetryConfig(ambiente))
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
