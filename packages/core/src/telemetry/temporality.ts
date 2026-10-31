import { AggregationTemporality, InstrumentType } from '@opentelemetry/sdk-metrics'

/**
 * Temporalidade de cada instrumento na exportação. Contador e histograma são cumulativos, como o
 * Prometheus espera. O gauge observável é delta: só sai o que foi observado na coleta. Cumulativo, o SDK
 * repetiria para sempre o último valor de uma série que parou de ser observada (a espera de antes de o
 * Postgres cair, a escola que saiu da medição).
 */
export function metricsTemporality(tipo: InstrumentType): AggregationTemporality {
  return tipo === InstrumentType.OBSERVABLE_GAUGE ? AggregationTemporality.DELTA : AggregationTemporality.CUMULATIVE
}
