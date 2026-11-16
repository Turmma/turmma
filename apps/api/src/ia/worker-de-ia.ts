import {
  bullmqQueueName,
  createQueueRedisClient,
  DONO_DAS_VAGAS_DO_SISTEMA,
  EscolaConcurrencyLimiter,
  JobExecutor,
  JobOutboxRepository,
  METRICS,
  observeDatabasePool,
  observeRedis,
  OperationalSettings,
  OperationalSettingsRepository,
  RETENCAO_JOB_CONCLUIDO_SEGUNDOS,
  RETENCAO_JOB_FALHO_SEGUNDOS,
  resolverVagasDaEscola,
  SlotReleasedNotifier,
  throttledWarn,
  UsageMeter,
  WORKER_POOL_OPTIONS_BY_QUEUE,
  systemClock,
  type ConcurrencyByQueue,
  type Database,
  type DatabasePool,
  type JobProcessors,
  type LoggerBase,
  type Meter,
  type QueuedJobData,
} from '@educa/core'
import type { JobRegistry, QueueName } from '@educa/shared'
import { Worker } from 'bullmq'
import { Redis } from 'ioredis'

/** As filas que o worker de IA atende: o Tutor, as ferramentas e o Analista. Cada uma com o pool dela. */
export const FILAS_DA_IA = ['interativa', 'ferramenta', 'normal'] as const satisfies readonly QueueName[]
export type FilaDaIa = (typeof FILAS_DA_IA)[number]

/** Quanto o SIGTERM espera os jobs em andamento terminarem antes de fechar à força; o `stop_grace_period` do compose é maior. */
export const GRACA_DO_WORKER_DE_IA_MS = 20_000

export interface WorkerDeIaConfig {
  readonly redisFilaUrl: string
  /** Jobs ao mesmo tempo nesta réplica, por fila. Fila fora daqui não é consumida por esta réplica. */
  readonly pools: Readonly<Partial<Record<FilaDaIa, number>>>
  /** Vagas por fila da escola sem vagas próprias (D41): o worker confere a vaga do job ao começar. */
  readonly vagasPadrao: ConcurrencyByQueue
  /** Só o controle negativo do cenário de carga: o worker não segura job de escola acima do teto. */
  readonly vagasPorEscolaDesligadas?: true
}

export interface WorkerDeIaOpcoes {
  /** Prefixo das chaves do BullMQ e das vagas. Só o teste troca, para não disputar a fila com outro teste. */
  readonly prefixo?: string
  /** O registro de jobs que valida os dados e dá o prazo de cada tipo. Só o teste troca. */
  readonly definicoes?: JobRegistry
  readonly medidor?: Meter
  readonly graca?: number
  readonly intervaloRenovacaoDaVagaMs?: number
  readonly validadeDaVagaMs?: number
}

/** O banco de quem monta: o pool é dele (o do `DatabaseModule` no `main-worker`, o da bancada no teste), e `encerrar` não o fecha. */
export interface BancoDoWorkerDeIa {
  readonly banco: Database
  readonly pool: DatabasePool
}

export interface WorkerDeIa {
  /** Um `Worker` do BullMQ por fila atendida, cada um com o próprio pool de jobs. */
  readonly workers: ReadonlyMap<FilaDaIa, Worker<QueuedJobData>>
  /** `close()` com graça em todos: espera os jobs em andamento até o prazo e só então força (`interromper`). Não fecha o pool do banco. */
  encerrar(): Promise<void>
}

/** Os clientes Redis do worker e o executor que os usa. */
interface PecasDoWorker {
  readonly redis: Redis
  readonly redisDasVagas: Redis
  readonly executor: JobExecutor
  readonly stalled: ReturnType<Meter['createCounter']> | undefined
}

/** Os dois clientes Redis (o do BullMQ e o das vagas) e o `JobExecutor` do `core` com o `processar` da execução de IA. */
function montarExecutor(config: WorkerDeIaConfig, { banco, pool }: BancoDoWorkerDeIa, processadores: JobProcessors, logger: LoggerBase, opcoes: WorkerDeIaOpcoes): PecasDoWorker {
  // O BullMQ exige `maxRetriesPerRequest: null` no worker: o comando bloqueante espera o Redis voltar.
  const redis = new Redis(config.redisFilaUrl, { connectionName: 'worker-ia', maxRetriesPerRequest: null })
  const avisarRedisIndisponivel = throttledWarn(() => logger.warn({ evento: 'worker_ia.redis_indisponivel' }))
  redis.on('error', avisarRedisIndisponivel)
  // As vagas usam outro cliente, sem fila offline e com prazo: Redis fora não pendura o fim do job.
  const redisDasVagas = createQueueRedisClient(config.redisFilaUrl, 'worker-ia-vagas', avisarRedisIndisponivel)
  const uso = new UsageMeter(redisDasVagas, {
    relogio: systemClock,
    ...(opcoes.prefixo === undefined ? {} : { prefixo: opcoes.prefixo }),
    aoFalhar: throttledWarn(() => logger.warn({ evento: 'worker_ia.contador_de_uso_indisponivel' })),
  })
  const { medidor } = opcoes
  if (medidor !== undefined) {
    observeDatabasePool(medidor, pool)
    observeRedis(medidor, { fila: [redis, redisDasVagas] })
  }
  const aguardandoVaga = medidor?.createCounter(METRICS.aguardandoVaga, { description: 'Jobs que chegaram ao worker sem vaga e voltaram a esperar' })
  const stalled = medidor?.createCounter(METRICS.jobsStalled, { description: 'Jobs devolvidos à espera por lock vencido' })
  const repositorio = new JobOutboxRepository(banco)
  const avisoDeVagaLivre = new SlotReleasedNotifier(() => repositorio.avisarVagaLivre(), throttledWarn(() => logger.warn({ evento: 'worker_ia.aviso_de_vaga_indisponivel' })))
  const executor = new JobExecutor({
    repositorio,
    aoLiberarVaga: avisoDeVagaLivre.avisar,
    processadores,
    ...(opcoes.definicoes === undefined ? {} : { definicoes: opcoes.definicoes }),
    logger,
    uso,
    ...(aguardandoVaga === undefined ? {} : { aoAguardarVaga: (fila: QueueName, escolaId: string | null) => aguardandoVaga.add(1, { fila, escola_id: escolaId ?? DONO_DAS_VAGAS_DO_SISTEMA }) }),
    vagas: new EscolaConcurrencyLimiter(redisDasVagas, opcoes.prefixo, opcoes.validadeDaVagaMs),
    vagasDaEscola: new OperationalSettings(new OperationalSettingsRepository(banco), (linha) => resolverVagasDaEscola(config.vagasPadrao, linha, config.vagasPorEscolaDesligadas === true), {
      aoFalhar: throttledWarn(() => logger.warn({ evento: 'worker_ia.configuracao_indisponivel' })),
    }),
    ...(opcoes.intervaloRenovacaoDaVagaMs === undefined ? {} : { intervaloRenovacaoMs: opcoes.intervaloRenovacaoDaVagaMs }),
  })
  return { redis, redisDasVagas, executor, stalled }
}

/** Um `Worker` do BullMQ por fila da IA com pool, na fila do executor `api`: o worker comum não a consome, e este não consome a dele. */
function abrirWorkers(config: WorkerDeIaConfig, { redis, executor, stalled }: PecasDoWorker, logger: LoggerBase, opcoes: WorkerDeIaOpcoes): Map<FilaDaIa, Worker<QueuedJobData>> {
  const avisarErroDaFila = throttledWarn(() => logger.warn({ evento: 'worker_ia.fila_com_erro' }))
  const workers = new Map<FilaDaIa, Worker<QueuedJobData>>()
  for (const fila of FILAS_DA_IA) {
    const concorrencia = config.pools[fila]
    if (concorrencia === undefined) continue
    const worker = new Worker<QueuedJobData>(bullmqQueueName(fila, 'api'), (job, token) => executor.processar(job, token), {
      connection: redis,
      concurrency: concorrencia,
      lockDuration: WORKER_POOL_OPTIONS_BY_QUEUE[fila].lockDurationMs,
      stalledInterval: WORKER_POOL_OPTIONS_BY_QUEUE[fila].stalledIntervalMs,
      removeOnComplete: { age: RETENCAO_JOB_CONCLUIDO_SEGUNDOS },
      removeOnFail: { age: RETENCAO_JOB_FALHO_SEGUNDOS },
      ...(opcoes.prefixo === undefined ? {} : { prefix: opcoes.prefixo }),
    })
    worker.on('error', avisarErroDaFila)
    if (stalled !== undefined) worker.on('stalled', () => stalled.add(1, { fila }))
    workers.set(fila, worker)
  }
  return workers
}

/** Quanto o `encerrar` espera o `close()` terminar depois de abortar o que rodava, antes de largar a conexão. */
const ESPERA_APOS_INTERROMPER_MS = 3_000

/** Fecha os workers com graça; passada ela, aborta o que roda e só então larga a conexão. */
async function encerrarComGraca(workers: ReadonlyMap<FilaDaIa, Worker<QueuedJobData>>, { redis, redisDasVagas, executor }: PecasDoWorker, graca: number, logger: LoggerBase): Promise<void> {
  let prazo: NodeJS.Timeout | undefined
  const estourou = new Promise<'estourou'>((resolver) => {
    prazo = setTimeout(() => resolver('estourou'), graca)
  })
  const fechamento = Promise.all([...workers.values()].map((aberto) => aberto.close())).then(() => 'fechou' as const)
  const resultado = await Promise.race([fechamento, estourou])
  clearTimeout(prazo)
  if (resultado === 'estourou') {
    // O `close()` em andamento não aceita ser forçado: o que roda aborta o `sinal` (o processador não grava, e a reentrega decide) e o processo sai.
    logger.warn({ evento: 'worker_ia.desligamento_forcado' })
    await executor.interromper()
    // O job abortado ainda se encerra pelo Redis (o BullMQ marca a tentativa): fechar a conexão antes disso o faz tentar de novo em laço. Espera o
    // `close()` acabar, com um teto curto para o processador que ignorar o `sinal`.
    let teto: NodeJS.Timeout | undefined
    await Promise.race([fechamento.catch(() => undefined), new Promise((resolver) => (teto = setTimeout(resolver, ESPERA_APOS_INTERROMPER_MS)))])
    clearTimeout(teto)
    redis.disconnect()
  } else {
    await redis.quit().catch(() => redis.disconnect())
  }
  redisDasVagas.disconnect()
}

/**
 * O consumo das filas `api-*` do BullMQ pelo `JobExecutor` do `core` (X6, 5.0): o mesmo executor do worker, com o `processar` da
 * execução de IA. É o que o `main-worker` e a bancada de teste (`apps/api/test/fila-de-ia.fixture.ts`) montam, cada um com o seu
 * pool de banco, que não é fechado aqui: o job não segura conexão durante o modelo, e o pool de uma réplica comporta os jobs ao mesmo tempo.
 */
export function criarWorkerDeIa(config: WorkerDeIaConfig, banco: BancoDoWorkerDeIa, processadores: JobProcessors, logger: LoggerBase, opcoes: WorkerDeIaOpcoes = {}): WorkerDeIa {
  if (config.vagasPorEscolaDesligadas === true) logger.warn({ evento: 'worker_ia.vagas_por_escola_desligadas' })
  const pecas = montarExecutor(config, banco, processadores, logger, opcoes)
  const workers = abrirWorkers(config, pecas, logger, opcoes)
  let encerramento: Promise<void> | undefined
  return { workers, encerrar: () => (encerramento ??= encerrarComGraca(workers, pecas, opcoes.graca ?? GRACA_DO_WORKER_DE_IA_MS, logger)) }
}
