import { jobExecutor, bullmqQueueName, jobOptions, TIMEOUT_COMANDO_REDIS_FILA_MS, type QueuedJobData, type ReservedJob, type PublishedJobOptions } from '@educa/core'
import { JOB_FAILURE_CODES, JobFailureCode, JOB_DEFINITIONS, QUEUE_NAMES, type JobExecutor, type QueueName, type JobRegistry } from '@educa/shared'

/** O que a consulta à fila diz de um job. Só `inexistente` autoriza publicar de novo. */
export type QueuedJobState =
  | { situacao: 'inexistente' }
  | { situacao: 'presente' }
  /** A fila desistiu do job (tentativas esgotadas, stalled acima do limite, dado inválido). */
  | { situacao: 'falhou'; codigo: JobFailureCode }

/** O lado do Redis de fila que o despachante usa: publicar e consultar, sempre com prazo. */
export interface JobPublisher {
  /** Publica cada job na fila dele, com `jobId` igual ao id da linha: publicar de novo um job que a fila tem não cria outro. */
  publicar(jobs: readonly ReservedJob[]): Promise<void>
  consultar(job: Pick<ReservedJob, 'id' | 'fila' | 'tipo'>): Promise<QueuedJobState>
}

/** A parte da `Queue` do BullMQ que o despachante usa. */
export interface BullMQQueue {
  waitUntilReady(): Promise<void>
  addBulk(jobs: Array<{ name: string; data: QueuedJobData; opts: { jobId: string } & PublishedJobOptions }>): Promise<unknown>
  getJob(jobId: string): Promise<{ failedReason: string; getState(): Promise<string> } | undefined>
  close(): Promise<void>
}

export class QueueTimeoutError extends Error {
  override readonly name = 'QueueTimeoutError'
}

/**
 * `JobPublisher` sobre as filas do BullMQ, uma `Queue` por fila e executor (`bullmqQueueName`), para o Redis de fila
 * fora ou travado não pendurar o despachante. O job vai à fila do executor da definição dele e leva a retentativa dela
 * (`jobOptions`); as três filas do worker nascem com o despachante, e as da API, na primeira vez que um tipo as pede:
 *
 * - o cliente Redis não tem fila offline e tem `commandTimeout` (`createQueueRedisClient`);
 * - toda operação tem `prazoMs` também por fora, porque a `Queue` espera o Redis ficar pronto antes
 *   do primeiro comando, e essa espera não tem limite: um despachante que sobe com o Redis fora
 *   ficaria parado nela;
 * - se a preparação de uma `Queue` falhar (o Redis caiu no meio dela), o BullMQ guarda a falha para
 *   sempre; a `Queue` é trocada por uma nova, e a operação seguinte já usa a nova.
 */
export class BullMQJobPublisher implements JobPublisher {
  readonly #filas = new Map<string, BullMQQueue>()

  constructor(
    private readonly criarFila: (fila: QueueName, executor: JobExecutor) => BullMQQueue,
    private readonly prazoMs: number = TIMEOUT_COMANDO_REDIS_FILA_MS,
    private readonly definicoes: JobRegistry = JOB_DEFINITIONS,
  ) {
    for (const fila of QUEUE_NAMES) this.#filas.set(bullmqQueueName(fila, 'worker'), criarFila(fila, 'worker'))
  }

  /** Um `addBulk` por fila e executor, todos dentro do mesmo prazo. */
  publicar(jobs: readonly ReservedJob[]): Promise<void> {
    const porFila = new Map<string, { fila: QueueName; executor: JobExecutor; jobs: ReservedJob[] }>()
    for (const job of jobs) {
      const executor = jobExecutor(job.tipo, this.definicoes)
      const chave = bullmqQueueName(job.fila, executor)
      const grupo = porFila.get(chave) ?? { fila: job.fila, executor, jobs: [] }
      grupo.jobs.push(job)
      porFila.set(chave, grupo)
    }
    return comPrazo(async () => {
      await Promise.all(
        [...porFila.values()].map(({ fila, executor, jobs: daFila }) =>
          this.comFila(fila, executor, (queue) =>
            queue.addBulk(
              daFila.map((job) => ({
                name: job.tipo,
                data: { escolaId: job.escolaId, requisicaoId: job.requisicaoId },
                opts: { ...jobOptions(job.tipo, this.definicoes), jobId: job.id },
              })),
            ),
          ),
        ),
      )
    }, this.prazoMs)
  }

  consultar(job: Pick<ReservedJob, 'id' | 'fila' | 'tipo'>): Promise<QueuedJobState> {
    return comPrazo(
      () =>
        this.comFila(job.fila, jobExecutor(job.tipo, this.definicoes), async (queue) => {
          // Sem o hash do job, a fila não o tem. Com o hash e fora de toda lista, ele existe para o
          // BullMQ, que ignoraria a republicação: não é `inexistente`.
          const naFila = await queue.getJob(job.id)
          if (naFila === undefined) return { situacao: 'inexistente' } as const
          if ((await naFila.getState()) !== 'failed') return { situacao: 'presente' } as const
          return { situacao: 'falhou', codigo: codigoDaFalha(naFila.failedReason) } as const
        }),
      this.prazoMs,
    )
  }

  async fechar(): Promise<void> {
    await Promise.all([...this.#filas.values()].map((queue) => queue.close()))
  }

  private async comFila<T>(fila: QueueName, executor: JobExecutor, operacao: (queue: BullMQQueue) => Promise<T>): Promise<T> {
    const queue = this.queueDa(fila, executor)
    try {
      await queue.waitUntilReady()
    } catch (erro) {
      this.trocar(fila, executor, queue)
      throw erro
    }
    return operacao(queue)
  }

  /** A `Queue` do nome, criada na primeira vez que alguém a pede (as do executor `api`; as do worker já nasceram no construtor). */
  private queueDa(fila: QueueName, executor: JobExecutor): BullMQQueue {
    const nome = bullmqQueueName(fila, executor)
    const existente = this.#filas.get(nome)
    if (existente !== undefined) return existente
    const nova = this.criarFila(fila, executor)
    this.#filas.set(nome, nova)
    return nova
  }

  private trocar(fila: QueueName, executor: JobExecutor, falhou: BullMQQueue): void {
    const nome = bullmqQueueName(fila, executor)
    if (this.#filas.get(nome) !== falhou) return
    this.#filas.set(nome, this.criarFila(fila, executor))
    falhou.close().catch(() => undefined)
  }
}

/** O worker só manda à fila o código tipado; o que não for um deles (stalled do BullMQ) é erro interno. */
function codigoDaFalha(motivo: string): JobFailureCode {
  return JOB_FAILURE_CODES.find((codigo) => codigo === motivo) ?? JobFailureCode.ERRO_INTERNO
}

/**
 * A operação ou `QueueTimeoutError`, o que vier antes. A operação que perdeu segue até o fim e é
 * ignorada: uma publicação que chega ao Redis depois do prazo é inofensiva, porque a próxima
 * publicação do mesmo job usa o mesmo `jobId`.
 */
function comPrazo<T>(operacao: () => Promise<T>, prazoMs: number): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined
  const prazo = new Promise<never>((_resolver, rejeitar) => {
    temporizador = setTimeout(() => rejeitar(new QueueTimeoutError()), prazoMs)
  })
  const execucao = operacao()
  execucao.catch(() => undefined)
  return Promise.race([execucao, prazo]).finally(() => clearTimeout(temporizador))
}
