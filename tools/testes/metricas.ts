import type { Attributes } from '@opentelemetry/api'
import { MeterProvider, MetricReader, type DataPoint } from '@opentelemetry/sdk-metrics'
import { metricsTemporality } from '../../packages/core/src/telemetry/temporality.ts'
import type { METRICS } from '../../packages/core/src/telemetry/metrics.ts'

/** Leitor que só coleta quando o teste pede: nada é exportado, e o teste lê o que o processo exportaria. */
class LeitorManual extends MetricReader {
  protected override onForceFlush(): Promise<void> {
    return Promise.resolve()
  }

  protected override onShutdown(): Promise<void> {
    return Promise.resolve()
  }
}

export interface PontoLido {
  atributos: Attributes
  /** Número para contador e gauge; o histograma traz a contagem e a soma. */
  valor: number | { contagem: number; soma: number }
}

/**
 * Um medidor de verdade do SDK do OpenTelemetry, com um leitor em memória: o teste passa o medidor a quem
 * mede e lê, pelo nome, os pontos que a próxima exportação levaria.
 */
export class MedidorDeTeste {
  // A mesma temporalidade da exportação: o gauge que parou de ser observado some aqui como some lá.
  readonly #leitor = new LeitorManual({ aggregationTemporalitySelector: metricsTemporality })
  readonly #provedor = new MeterProvider({ readers: [this.#leitor] })
  readonly medidor = this.#provedor.getMeter('teste')

  async pontos(nome: string): Promise<PontoLido[]> {
    const { resourceMetrics, errors } = await this.#leitor.collect()
    if (errors.length > 0) throw new Error(`coleta com erro: ${errors.map(String).join(', ')}`)
    const metricas = resourceMetrics.scopeMetrics.flatMap((escopo) => escopo.metrics).filter((metrica) => metrica.descriptor.name === nome)
    return metricas.flatMap((metrica) =>
      (metrica.dataPoints as Array<DataPoint<unknown>>).map((ponto) => ({
        atributos: ponto.attributes,
        valor: typeof ponto.value === 'number' ? ponto.value : { contagem: (ponto.value as { count: number }).count, soma: (ponto.value as { sum?: number }).sum ?? 0 },
      })),
    )
  }

  /** Todos os nomes de atributo de todos os pontos, de todas as métricas coletadas. */
  async atributosDeTodas(): Promise<Array<{ nome: string; atributos: Attributes }>> {
    const { resourceMetrics } = await this.#leitor.collect()
    return resourceMetrics.scopeMetrics
      .flatMap((escopo) => escopo.metrics)
      .flatMap((metrica) => (metrica.dataPoints as Array<DataPoint<unknown>>).map((ponto) => ({ nome: metrica.descriptor.name, atributos: ponto.attributes })))
  }

  encerrar(): Promise<void> {
    return this.#provedor.shutdown()
  }
}

/**
 * Como cada métrica de `METRICS` aparece no Prometheus da observabilidade local, pela tradução do receptor
 * OTLP dele: ponto vira sublinhado, contador ganha `_total`, unidade `s` ganha `_seconds`, e o histograma
 * sai em `_bucket`, `_count` e `_sum`. É o nome que o painel e os alertas consultam.
 */
export const NOMES_NO_PROMETHEUS = {
  duracaoHttp: ['http_server_request_duration_seconds_bucket', 'http_server_request_duration_seconds_count', 'http_server_request_duration_seconds_sum'],
  esperaMaisAntiga: ['job_espera_mais_antiga_s'],
  pendentes: ['job_pendentes'],
  falhos: ['job_falhos'],
  aguardandoVaga: ['job_aguardando_vaga_total'],
  vagasEmUso: ['fila_vagas_em_uso'],
  jobsStalled: ['fila_jobs_stalled_total'],
  conexoesRealtime: ['realtime_conexoes'],
  poolEmUso: ['db_pool_em_uso'],
  conexoesDescartadas: ['db_pool_conexoes_descartadas_total'],
  redisDisponivel: ['redis_disponivel'],
  seguroAtivo: ['limite_seguro_ativo'],
  contaSegurada: ['login_conta_segurada_total'],
  falhasDeLogin: ['login_falhas_total'],
  prioridadeRebaixada: ['login_prioridade_rebaixada'],
  limiteEmailIp: ['login_limite_email_ip_total'],
  rebaixadoPorIp: ['login_rebaixado_ip_total'],
  loginExterno: ['login_externo_total'],
  duracaoDoLogin: ['login_duracao_seconds_bucket', 'login_duracao_seconds_count', 'login_duracao_seconds_sum'],
  esperaPeloHash: ['login_hash_espera_seconds_bucket', 'login_hash_espera_seconds_count', 'login_hash_espera_seconds_sum'],
  hashRecusado: ['login_hash_recusado_total'],
  renovacaoDeSessao: ['sessao_renovacao_total'],
  atividadeFalha: ['sessao_atividade_falha_total'],
  introducaoFalha: ['eu_introducao_falha_total'],
  entradaFalhaDaOperacao: ['operacao_entrada_falha_total'],
  escolaIgnoradaNoUso: ['uso_escola_ignorada_total'],
  reivindicacaoNaSala: ['sala_reivindicacao_total'],
  limiteDaSala: ['sala_limite_atingido_total'],
  leituraDeSessao: ['sessao_leitura_duracao_seconds_bucket', 'sessao_leitura_duracao_seconds_count', 'sessao_leitura_duracao_seconds_sum'],
  atrasoEventLoop: ['nodejs_eventloop_delay_p99_seconds'],
  noitesIncompletasDoExpurgo: ['expurgo_noites_incompletas'],
  horasDoIncidenteSemConfirmacao: ['incidente_horas_sem_confirmacao'],
  horasDoArquivoEmPreparacao: ['arquivo_horas_em_preparacao'],
  horasDaEliminacaoVencida: ['eliminacao_horas_vencida'],
} as const satisfies Record<keyof typeof METRICS, readonly string[]>
