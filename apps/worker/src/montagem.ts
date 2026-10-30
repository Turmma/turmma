import {
  ArquivoDoTitularRepository,
  avisoEspacado,
  ConfiguracaoOperacional,
  ConfiguracaoOperacionalRepository,
  ContadorDeUso,
  criarBanco,
  DONO_DAS_VAGAS_DO_SISTEMA,
  criarClienteRedisDaFila,
  criarPool,
  EfeitoSinteticoRepository,
  Enfileirador,
  EscolasDaRotinaRepository,
  ExpurgoDaEscolaRepository,
  ExpurgoDeAcessoRepository,
  ExpurgoDeJobsRepository,
  IncidenteDaEscolaRepository,
  JobRegistroRepository,
  METRICAS,
  nomeDaFilaBullMQ,
  observarPoolDoBanco,
  observarRedis,
  OPCOES_DO_POOL_POR_FILA,
  RETENCAO_JOB_CONCLUIDO_SEGUNDOS,
  RETENCAO_JOB_FALHO_SEGUNDOS,
  relogioDoSistema,
  resolverJanela,
  resolverVagasDaEscola,
  RetencaoDaEscolaRepository,
  UsoRepository,
  VagasPorEscola,
  type ArmazemDeArquivos,
  type Banco,
  type Batimento,
  type DadosDoJobNaFila,
  type JanelaLetiva,
  type LoggerBase,
  type Meter,
  type Relogio,
} from '@educa/nucleo'
import {
  TIPO_CONSOLIDAR_USO,
  TIPO_ELIMINAR_TITULAR,
  TIPO_EXPURGAR_ACESSO,
  TIPO_EXPURGAR_DADO_PESSOAL,
  TIPO_EXPURGAR_ESCOLA,
  TIPO_EXPURGAR_JOBS,
  TIPO_JOB_SINTETICO,
  TIPO_MONTAR_ARQUIVO,
  type QueueName,
  type JobRegistry,
} from '@educa/shared'
import { ArmazemS3 } from '@educa/nucleo/armazem-s3'
import { Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { AGENDAMENTOS, criarDisparoDeAgendamento, FILA_DOS_AGENDAMENTOS, registrarAgendamentos, type Agendamento } from './agendamentos.js'
import type { ConfiguracaoStorage, ConfiguracaoWorker } from './config.js'
import { AvisoDeVagaLivre, ExecutorDeJobs, type ProcessadoresDeJob } from './executor.js'
import { criarConsolidacaoDeUso } from './processadores/consolidar-uso.js'
import { criarExpurgoDeAcesso } from './processadores/expurgar-acesso.js'
import { criarExpurgoDeJobs } from './processadores/expurgar-jobs.js'
import { criarRotinaDeExpurgo } from './processadores/expurgar-dado-pessoal.js'
import { criarEliminacaoDoTitular } from './processadores/eliminar-titular.js'
import { criarExpurgoDaEscola } from './processadores/expurgar-escola.js'
import { MedicaoDaEliminacao } from './medicao-da-eliminacao.js'
import { MedicaoDoArquivo } from './medicao-do-arquivo.js'
import { MedicaoDoExpurgo } from './medicao-do-expurgo.js'
import { MedicaoDoIncidente } from './medicao-do-incidente.js'
import { criarMontagemDoArquivo } from './processadores/montar-arquivo.js'
import { criarProcessadorSintetico, SandboxDeCpu, type QueimaDeCpu } from './processadores/sintetico.js'
import { criarClienteS3, MedidorDeStorage } from './storage/medidor-de-storage.js'

/**
 * Quanto o SIGTERM espera os jobs em andamento terminarem antes de fechar à força (Tech Spec, seção 5; R55). O
 * `stop_grace_period` do worker, em `infra/compose.yml`, é maior que ela: o Docker só manda SIGKILL depois dos dois.
 */
export const GRACA_DO_DESLIGAMENTO_MS = 20_000
const INTERVALO_BATIMENTO_MS = 2_000

export interface OpcoesDaMontagem {
  /** Troca os processadores da réplica. Sem isto, o sintético (no sandbox de CPU) e, no lote, as rotinas do sistema. */
  processadores?: ProcessadoresDeJob
  /** O registro de jobs que valida os dados e dá o prazo de cada tipo. Só o teste troca, para ter um tipo de dados próprios. */
  definicoes?: JobRegistry
  /** Prefixo das chaves do BullMQ e das vagas. Só o teste troca, para não disputar a fila com outro teste. */
  prefixo?: string
  /** Intervalo de renovação da vaga. Só o teste troca, para ver a renovação sem esperar 15 s. */
  intervaloRenovacaoDaVagaMs?: number
  /** Validade da vaga. Só o teste troca, para ver a vaga vencer sem esperar 60 s. */
  validadeDaVagaMs?: number
  /**
   * Relógio do dia de uso (contador e consolidação), do corte do expurgo do acesso e do expurgo da escola, e da janela
   * conferida a cada lote. Só o teste troca, para marcar às 23h59 e consolidar às 2h.
   */
  relogio?: Relogio
  /** Agendamentos registrados na réplica de lote. Só o teste troca, para não esperar as 2h. */
  agendamentos?: readonly Agendamento[]
  batimento?: Batimento
  graca?: number
  /**
   * Medidor da telemetria. Com ele, o worker mede o pool, o Redis, o stalled e o job que chega sem vaga;
   * sem ele (os testes que não olham métrica), não mede nada.
   */
  medidor?: Meter
}

export interface WorkerMontado {
  /** Um `Worker` do BullMQ por fila atendida, cada um com o próprio pool. */
  workers: ReadonlyMap<QueueName, Worker<DadosDoJobNaFila>>
  /** Só na réplica que atende o lote: a fila dos disparos agendados e o worker que os grava em `job_registro`. */
  agendamentos?: { fila: Queue; worker: Worker }
  /** `close()` com graça em todos: espera os jobs em andamento até o prazo e só então força. */
  encerrar(): Promise<void>
}

/**
 * Workers BullMQ ligados ao Postgres (pool próprio) e ao Redis de fila, um por fila que a réplica
 * atende (`QUEUE_NAMES`), com a concorrência do pool da fila. Pools separados são o que garante que lote
 * nenhum ocupa a vez do interativo: o `worker-lote` nem consome a fila interativa.
 *
 * O stalled é o do BullMQ, com lock e verificação por fila (`OPCOES_DO_POOL_POR_FILA`): se a réplica
 * morre no meio, o lock vence e outra réplica retoma o job, ainda dono da vaga.
 */
export function montarWorker(config: Omit<ConfiguracaoWorker, 'telemetria'>, logger: LoggerBase, opcoes: OpcoesDaMontagem = {}): WorkerMontado {
  if (config.vagasPorEscolaDesligadas === true) {
    // Só o controle negativo do cenário de carga chega aqui, e ele precisa ficar visível no log de quem subiu assim.
    logger.warn({ evento: 'worker.vagas_por_escola_desligadas' })
  }
  const pool = criarPool(config.banco, () => logger.warn({ evento: 'banco.conexao_ociosa_perdida' }))
  // O BullMQ exige `maxRetriesPerRequest: null` no worker: o comando bloqueante espera o Redis voltar.
  const redis = new Redis(config.redisFilaUrl, { connectionName: 'worker', maxRetriesPerRequest: null })
  const avisarRedisIndisponivel = avisoEspacado(() => logger.warn({ evento: 'worker.redis_indisponivel' }))
  redis.on('error', avisarRedisIndisponivel)
  // As vagas usam outro cliente, sem fila offline e com prazo: Redis fora não pendura o fim do job.
  const redisDasVagas = criarClienteRedisDaFila(config.redisFilaUrl, 'worker-vagas', avisarRedisIndisponivel)
  const banco = criarBanco(pool)
  const relogio = opcoes.relogio ?? relogioDoSistema
  const uso = new ContadorDeUso(redisDasVagas, {
    relogio,
    ...(opcoes.prefixo === undefined ? {} : { prefixo: opcoes.prefixo }),
    aoFalhar: avisoEspacado(() => logger.warn({ evento: 'worker.contador_de_uso_indisponivel' })),
  })
  const { medidor } = opcoes
  if (medidor !== undefined) {
    observarPoolDoBanco(medidor, pool)
    observarRedis(medidor, { fila: [redis, redisDasVagas] })
  }
  const aguardandoVaga = medidor?.createCounter(METRICAS.aguardandoVaga, { description: 'Jobs que chegaram ao worker sem vaga e voltaram a esperar' })
  const stalled = medidor?.createCounter(METRICAS.jobsStalled, { description: 'Jobs devolvidos à espera por lock vencido' })
  // O armazém do arquivo do titular (F3, tarefa 13.0): a réplica da fila normal grava o JSON, e a do lote apaga o vencido.
  const armazemS3 = config.storage === undefined ? undefined : ArmazemS3.criar(config.storage)
  const sandbox = new SandboxDeCpu(config.threadsMaximo)
  const repositorio = new JobRegistroRepository(banco)
  // Banco fora: o despachante acorda pela sondagem, e só.
  const { processadores, rotinas } = montarProcessadores(config, {
    banco,
    uso,
    relogio,
    logger,
    medidor,
    cpu: sandbox,
    efeitos: new EfeitoSinteticoRepository(banco),
    armazem: armazemS3?.armazem,
  })
  const avisoDeVagaLivre = new AvisoDeVagaLivre(() => repositorio.avisarVagaLivre(), avisoEspacado(() => logger.warn({ evento: 'worker.aviso_de_vaga_indisponivel' })))
  const executor = new ExecutorDeJobs({
    repositorio,
    aoLiberarVaga: avisoDeVagaLivre.avisar,
    processadores: opcoes.processadores ?? processadores,
    ...(opcoes.definicoes === undefined ? {} : { definicoes: opcoes.definicoes }),
    logger,
    uso,
    ...(aguardandoVaga === undefined ? {} : { aoAguardarVaga: (fila: QueueName, escolaId: string | null) => aguardandoVaga.add(1, { fila, escola_id: escolaId ?? DONO_DAS_VAGAS_DO_SISTEMA }) }),
    vagas: new VagasPorEscola(redisDasVagas, opcoes.prefixo, opcoes.validadeDaVagaMs),
    vagasDaEscola: new ConfiguracaoOperacional(
      new ConfiguracaoOperacionalRepository(banco),
      (linha) => resolverVagasDaEscola(config.vagasPadrao, linha, config.vagasPorEscolaDesligadas === true),
      {
        aoFalhar: avisoEspacado(() => logger.warn({ evento: 'worker.configuracao_indisponivel' })),
      },
    ),
    ...(opcoes.intervaloRenovacaoDaVagaMs === undefined ? {} : { intervaloRenovacaoMs: opcoes.intervaloRenovacaoDaVagaMs }),
  })
  const avisarErroDaFila = avisoEspacado(() => logger.warn({ evento: 'worker.fila_com_erro' }))
  const workers = new Map<QueueName, Worker<DadosDoJobNaFila>>()
  for (const [fila, concorrencia] of Object.entries(config.pools) as Array<[QueueName, number]>) {
    const worker = new Worker<DadosDoJobNaFila>(nomeDaFilaBullMQ(fila, 'worker'), (job, token) => executor.processar(job, token), {
      connection: redis,
      concurrency: concorrencia,
      lockDuration: OPCOES_DO_POOL_POR_FILA[fila].lockDurationMs,
      stalledInterval: OPCOES_DO_POOL_POR_FILA[fila].stalledIntervalMs,
      removeOnComplete: { age: RETENCAO_JOB_CONCLUIDO_SEGUNDOS },
      removeOnFail: { age: RETENCAO_JOB_FALHO_SEGUNDOS },
      ...(opcoes.prefixo === undefined ? {} : { prefix: opcoes.prefixo }),
    })
    worker.on('error', avisarErroDaFila)
    // Só a fila: a escola do job não está à mão aqui sem ler o `data`, e o stalled é problema do worker, não da escola.
    if (stalled !== undefined) worker.on('stalled', () => stalled.add(1, { fila }))
    workers.set(fila, worker)
  }

  const agendamentos = rotinas === undefined ? undefined : montarAgendamentos(redis, banco, logger, opcoes.prefixo, opcoes.agendamentos ?? AGENDAMENTOS)

  const batimento = opcoes.batimento
  const pulso = batimento === undefined ? undefined : setInterval(() => batimento.bater(), INTERVALO_BATIMENTO_MS)
  const graca = opcoes.graca ?? GRACA_DO_DESLIGAMENTO_MS

  const encerrar = async (): Promise<void> => {
    if (pulso !== undefined) clearInterval(pulso)
    let prazo: NodeJS.Timeout | undefined
    const estourou = new Promise<'estourou'>((resolver) => {
      prazo = setTimeout(() => resolver('estourou'), graca)
    })
    const fechamento = Promise.all([...workers.values(), ...(agendamentos === undefined ? [] : [agendamentos.worker, agendamentos.fila])].map((aberto) => aberto.close())).then(
      () => 'fechou' as const,
    )
    const resultado = await Promise.race([fechamento, estourou])
    clearTimeout(prazo)
    if (resultado === 'estourou') {
      // O `close()` em andamento não aceita ser forçado: a conexão cai, o processo sai, e o job
      // interrompido volta pelo stalled em outra réplica. Nada se perde. Antes da conexão cair, o que roda aborta o `sinal`, e a
      // última tentativa termina `EXECUCAO_INTERROMPIDA`: a que ainda tem outra fica `ativo` para a réplica que a retoma (D49).
      logger.warn({ evento: 'worker.desligamento_forcado' })
      await executor.interromper()
      redis.disconnect()
    } else {
      await redis.quit().catch(() => redis.disconnect())
    }
    // Depois dos workers: com graça, nenhum job ainda queima CPU; forçado, a thread morre com o job, que volta pelo stalled.
    await sandbox.encerrar()
    redisDasVagas.disconnect()
    await rotinas?.encerrar()
    armazemS3?.encerrar()
    await pool.end()
  }

  let encerramento: Promise<void> | undefined
  return {
    workers,
    ...(agendamentos === undefined ? {} : { agendamentos }),
    // Uma vez só: o SIGTERM e o fim do teste podem pedir o encerramento juntos.
    encerrar: () => (encerramento ??= encerrar()),
  }
}

/** As peças que os processadores usam, já criadas: quem monta decide quais processadores a réplica leva, e não como se constroem as peças. */
export interface PecasDosProcessadores {
  banco: Banco
  uso: ContadorDeUso
  relogio: Relogio
  logger: LoggerBase
  medidor: Meter | undefined
  /** O sandbox de CPU do job sintético. */
  cpu: QueimaDeCpu
  efeitos: Pick<EfeitoSinteticoRepository, 'gravar'>
  /** O armazém do storage; sem credencial de storage (`config.storage`), não há. */
  armazem: ArmazemDeArquivos | undefined
}

export interface ProcessadoresMontados {
  processadores: ProcessadoresDeJob
  /** Só na réplica que atende o lote: o que as rotinas do sistema abriram (medições) e precisam fechar. */
  rotinas?: { encerrar(): Promise<void> }
}

/**
 * Os processadores que esta réplica leva, pelas filas que ela atende (`config.pools`): o sintético em toda réplica, o
 * arquivo do titular na que atende a `normal` e as rotinas do sistema e da escola na que atende o `lote`. É a fonte do que a
 * réplica sabe executar, e `montagem.test.ts` a liga a `JOB_DEFINITIONS`: todo tipo do worker tem processador nas filas
 * dele, e nenhum processador está numa fila que a definição do tipo não lista.
 */
export function montarProcessadores(config: Pick<ConfiguracaoWorker, 'pools' | 'storage' | 'janelaPadrao'>, pecas: PecasDosProcessadores): ProcessadoresMontados {
  const { banco, uso, relogio, logger, medidor, armazem } = pecas
  const rotinas =
    config.pools.lote === undefined || config.storage === undefined || config.janelaPadrao === undefined || armazem === undefined
      ? undefined
      : montarRotinas(config.storage, config.janelaPadrao, banco, uso, relogio, logger, medidor, armazem)
  const montagemDoArquivo =
    config.pools.normal === undefined || armazem === undefined ? undefined : { [TIPO_MONTAR_ARQUIVO]: criarMontagemDoArquivo({ banco, armazem, relogio, logger }) }
  return {
    processadores: { [TIPO_JOB_SINTETICO]: criarProcessadorSintetico(pecas.cpu, pecas.efeitos), ...rotinas?.processadores, ...montagemDoArquivo },
    ...(rotinas === undefined ? {} : { rotinas }),
  }
}

/**
 * As rotinas do sistema, que só a réplica de lote executa: consolidação de uso (com o storage),
 * expurgo de `job_registro`, expurgo do acesso (registro de acesso, sessão e convite, 17.0) e o expurgo do dado pessoal
 * (F3, tarefa 3.0): a rotina que grava um job por escola, o job da escola, e, com o medidor, a medição das noites
 * incompletas que o alerta lê.
 */
function montarRotinas(
  storage: ConfiguracaoStorage,
  janelaPadrao: JanelaLetiva,
  banco: Banco,
  contador: ContadorDeUso,
  relogio: Relogio,
  logger: LoggerBase,
  medidor: Meter | undefined,
  armazem: ArmazemDeArquivos,
): { processadores: ProcessadoresDeJob; encerrar(): Promise<void> } {
  const s3 = criarClienteS3(storage)
  const avisarJanelaDescartada = avisoEspacado(() => logger.warn({ evento: 'worker.janela_da_escola_invalida' }))
  // O horário letivo da escola, lido como o despachante lê: o lote não urgente que ele soltou fora da janela para quando ela abre.
  const janelaDaEscola = new ConfiguracaoOperacional<JanelaLetiva>(new ConfiguracaoOperacionalRepository(banco), (linha) => resolverJanela(janelaPadrao, linha, avisarJanelaDescartada), {
    aoFalhar: avisoEspacado(() => logger.warn({ evento: 'worker.configuracao_indisponivel' })),
  })
  const escolas = new EscolasDaRotinaRepository(banco)
  const expurgoDaEscola = new ExpurgoDaEscolaRepository(banco)
  const medicao = medidor === undefined ? undefined : new MedicaoDoExpurgo({ escolas, repositorio: expurgoDaEscola, janelaDaEscola, relogio, logger, medidor })
  medicao?.iniciar()
  const medicaoDoIncidente = medidor === undefined ? undefined : new MedicaoDoIncidente({ escolas, repositorio: new IncidenteDaEscolaRepository(banco), relogio, logger, medidor })
  medicaoDoIncidente?.iniciar()
  const arquivos = new ArquivoDoTitularRepository(banco)
  const medicaoDoArquivo = medidor === undefined ? undefined : new MedicaoDoArquivo({ escolas, repositorio: arquivos, relogio, logger, medidor })
  medicaoDoArquivo?.iniciar()
  const medicaoDaEliminacao = medidor === undefined ? undefined : new MedicaoDaEliminacao({ escolas, repositorio: expurgoDaEscola, relogio, logger, medidor })
  medicaoDaEliminacao?.iniciar()
  return {
    processadores: {
      [TIPO_CONSOLIDAR_USO]: criarConsolidacaoDeUso({
        contador,
        repositorio: new UsoRepository(banco),
        storage: new MedidorDeStorage(s3, storage.bucket),
        relogio,
        logger,
        ...(medidor === undefined ? {} : { medidor }),
      }),
      [TIPO_EXPURGAR_JOBS]: criarExpurgoDeJobs({ repositorio: new ExpurgoDeJobsRepository(banco), logger }),
      [TIPO_EXPURGAR_ACESSO]: criarExpurgoDeAcesso({ repositorio: new ExpurgoDeAcessoRepository(banco), relogio, logger }),
      [TIPO_EXPURGAR_DADO_PESSOAL]: criarRotinaDeExpurgo({ escolas, banco, enfileirador: new Enfileirador(new JobRegistroRepository(banco)), janelaDaEscola, relogio, logger }),
      [TIPO_EXPURGAR_ESCOLA]: criarExpurgoDaEscola({
        repositorio: expurgoDaEscola,
        arquivos,
        armazem,
        retencao: new RetencaoDaEscolaRepository(banco),
        janelaDaEscola,
        enfileirador: new Enfileirador(new JobRegistroRepository(banco)),
        relogio,
        logger,
      }),
      [TIPO_ELIMINAR_TITULAR]: criarEliminacaoDoTitular({ banco, janelaDaEscola, relogio, logger }),
    },
    encerrar: async () => {
      await medicao?.encerrar()
      await medicaoDoIncidente?.encerrar()
      await medicaoDoArquivo?.encerrar()
      await medicaoDaEliminacao?.encerrar()
      s3.destroy()
    },
  }
}

/**
 * A fila dos disparos agendados, com um worker de concorrência 1 que grava o job da rotina pelo
 * `Enfileirador`. O registro dos agendadores não segura o boot: com o Redis de fila fora, ele espera a
 * conexão na fila offline do cliente do BullMQ e completa quando o Redis volta.
 */
function montarAgendamentos(
  redis: Redis,
  banco: Banco,
  logger: LoggerBase,
  prefixo: string | undefined,
  agendamentos: readonly Agendamento[],
): { fila: Queue; worker: Worker } {
  const comPrefixo = prefixo === undefined ? {} : { prefix: prefixo }
  const fila = new Queue(FILA_DOS_AGENDAMENTOS, { connection: redis, ...comPrefixo })
  const avisarErro = avisoEspacado(() => logger.warn({ evento: 'worker.agendamentos_com_erro' }))
  fila.on('error', avisarErro)
  const agendamentosTotal = agendamentos.length
  registrarAgendamentos(fila, agendamentos).then(
    () => logger.info({ evento: 'agendamentos.registrados', agendamentosTotal }),
    () => logger.warn({ evento: 'agendamentos.nao_registrados' }),
  )
  const disparar = criarDisparoDeAgendamento(banco, new Enfileirador(new JobRegistroRepository(banco)), logger, agendamentos)
  const worker = new Worker(FILA_DOS_AGENDAMENTOS, (job) => disparar(job), { connection: redis, concurrency: 1, ...comPrefixo })
  worker.on('error', avisarErro)
  return { fila, worker }
}
