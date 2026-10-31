import { QUEUE_NAMES, type JobExecutor, type QueueName } from '@educa/shared'

/**
 * As filas do BullMQ, uma por prioridade, na ordem em que o despachante as atende. A prioridade de
 * um job é a fila dele (regra 80, item 2): cada fila tem o próprio pool de workers, então lote
 * nenhum ocupa a vez de um interativo.
 */
export const QUEUES_BY_PRIORITY: readonly QueueName[] = QUEUE_NAMES

/**
 * Nome da fila no BullMQ. A do worker é o próprio nome da fila de `job_registro`, para quem lê o Redis e para o job que já
 * estava publicado antes da separação por executor. O tipo que a API executa (`executor: 'api'`, os de IA e de PDF) vai para a
 * fila `api-<fila>`, que o worker não consome: sem isso, o worker receberia o job de IA e o terminaria com `TIPO_DESCONHECIDO`.
 */
export function bullmqQueueName(fila: QueueName, executor: JobExecutor): string {
  return executor === 'worker' ? fila : `api-${fila}`
}

export interface WorkerPoolOptions {
  /** Quanto o lock do job vale sem renovação. O worker renova na metade. */
  readonly lockDurationMs: number
  /** De quanto em quanto tempo os workers da fila procuram job com lock vencido (réplica morta). */
  readonly stalledIntervalMs: number
}

/**
 * Lock e verificação de stalled por fila. Na interativa e na normal, uma réplica morta com `kill -9`
 * devolve o job em até ~15 s (lock vence em 10 s, verificação a cada 5 s), abaixo do alerta de job
 * interativo esperando 30 s. No lote vale o padrão do BullMQ: job longo, e ninguém esperando na tela.
 *
 * Lock curto só é seguro porque nenhum processador trava o event loop: trabalho de CPU roda em
 * sandbox (15.0), e o worker segue renovando o lock enquanto isso.
 */
export const WORKER_POOL_OPTIONS_BY_QUEUE: Readonly<Record<QueueName, WorkerPoolOptions>> = {
  interativa: { lockDurationMs: 10_000, stalledIntervalMs: 5_000 },
  normal: { lockDurationMs: 10_000, stalledIntervalMs: 5_000 },
  lote: { lockDurationMs: 30_000, stalledIntervalMs: 30_000 },
}
