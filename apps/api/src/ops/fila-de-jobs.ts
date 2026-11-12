import { bullmqQueueName, createQueueRedisClient, DomainException, jobExecutor, type QueuedJobData } from '@educa/core'
import { ErrorCode, type QueueName } from '@educa/shared'
import { Queue } from 'bullmq'
import type { Redis } from 'ioredis'

/** O job como a fila o conhece: o id da linha de `job_registro`, a fila e o tipo (que diz o executor). */
export interface QueuedJobRef {
  readonly id: string
  readonly fila: QueueName
  readonly tipo: string
}

/** O que os comandos de operação fazem no Redis de fila: tirar a cópia `failed` de um job, para a linha poder voltar a ser publicada. */
export interface FilaDeOperacao {
  /**
   * Remove do BullMQ a cópia `failed` do job. Sem a cópia, não faz nada (a fila já a tinha perdido, ou expirado em 7 dias). Uma cópia em outro
   * estado que não `failed` não se remove: o job está na fila, e a linha que diz `falhou` está desatualizada. Recusa com `CONFLITO`.
   */
  tirarCopiaDaFalha(job: QueuedJobRef): Promise<void>
  fechar(): Promise<void>
}

export interface FilaDeOperacaoOptions {
  /** O prefixo das chaves do BullMQ; só o teste o muda, para ficar no mesmo da bancada. */
  readonly prefixo?: string
}

/**
 * A fila de operação sobre o Redis de fila (`REDIS_FILA_URL`), com o mesmo cliente do despachante: sem fila offline e com prazo por comando.
 * Uma `Queue` por nome, aberta na primeira vez que o tipo a pede.
 */
export function abrirFilaDeOperacao(urlDoRedis: string, opcoes: FilaDeOperacaoOptions = {}): FilaDeOperacao {
  const redis: Redis = createQueueRedisClient(urlDoRedis, 'ops-jobs', () => undefined)
  const filas = new Map<string, Queue<QueuedJobData>>()
  const filaDe = (job: QueuedJobRef): Queue<QueuedJobData> => {
    const nome = bullmqQueueName(job.fila, jobExecutor(job.tipo))
    const existente = filas.get(nome)
    if (existente !== undefined) return existente
    const nova = new Queue<QueuedJobData>(nome, { connection: redis, ...(opcoes.prefixo === undefined ? {} : { prefix: opcoes.prefixo }) })
    nova.on('error', () => undefined)
    filas.set(nome, nova)
    return nova
  }
  return {
    async tirarCopiaDaFalha(job) {
      const naFila = await filaDe(job).getJob(job.id)
      if (naFila === undefined) return
      if ((await naFila.getState()) !== 'failed') throw new DomainException(ErrorCode.CONFLITO)
      await naFila.remove()
    },
    async fechar() {
      await Promise.all([...filas.values()].map((fila) => fila.close()))
      redis.disconnect()
    },
  }
}
