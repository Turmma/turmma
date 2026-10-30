import 'reflect-metadata'
import {
  OperationalSettingsRepository,
  createDatabase,
  createQueueRedisClient,
  createPool,
  DispatchRepository,
  runInContext,
  METRICS,
  bullmqQueueName,
  jobOptions,
  QUEUE_PRIORITY,
  VALIDADE_DA_VAGA_MS,
  type EscolaConcurrencyLimiter,
} from '@educa/nucleo'
import { JobFailureCode, defineJob, JOB_DEFINITIONS, TIPO_EXPURGAR_JOBS, TIPO_JOB_SINTETICO, type QueueName } from '@educa/shared'
import { Queue } from 'bullmq'
import { randomUUID } from 'node:crypto'
import { setTimeout as esperar } from 'node:timers/promises'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import type { Processador } from '../../worker/src/executor.js'
import { FalhaDeJob } from '../../worker/src/falha-de-job.js'
import { BancadaDeFila, configuracaoDoBanco, LogEmMemoria, urlRedisDeFila } from '../../worker/test/fila-de-teste.js'

// Despachantes e workers de verdade (a mesma montagem do main.ts), no processo do teste, contra o
// Postgres e o Redis de fila do compose de teste, com as vagas padrão de `.env.example`
// (interativa 5, normal 5, lote 2).

interface NoDoPlano {
  'Index Name'?: string
  'Rows Removed by Filter'?: number
  Plans?: NoDoPlano[]
}

function nosDoPlano(no: NoDoPlano | undefined): NoDoPlano[] {
  return no === undefined ? [] : [no, ...(no.Plans ?? []).flatMap(nosDoPlano)]
}

/**
 * O `sintetico` deste arquivo aceita, além dos dados do sintético, o `rotulo` da escola que o `ProcessadorContado` conta: o
 * registro de produção o recusaria (chave a mais), e é por isso que o teste injeta o seu na bancada. Os campos são opcionais
 * porque os casos que não contam por escola enfileiram o dado padrão da bancada.
 */
const DEFINICOES_DO_TESTE = {
  ...JOB_DEFINITIONS,
  [TIPO_JOB_SINTETICO]: defineJob({
    ...JOB_DEFINITIONS[TIPO_JOB_SINTETICO],
    dados: z.strictObject({ rotulo: z.string().optional(), cpuMs: z.number().optional(), falhar: z.boolean().optional() }),
  }),
}

/**
 * Processador que conta, por rótulo de escola (`dados.rotulo`), quantos jobs começaram e quantos
 * rodaram ao mesmo tempo. Com `duracaoMs`, cada job leva esse tempo; sem, espera `soltar()`.
 */
class ProcessadorContado {
  readonly #emExecucao = new Map<string, number>()
  readonly #maximo = new Map<string, number>()
  readonly #iniciados = new Map<string, number>()
  readonly #esperando: Array<() => void> = []
  #solto = false

  constructor(private readonly duracaoMs?: number) {}

  readonly processar = async (dados: Record<string, unknown>): Promise<void> => {
    const rotulo = String(dados['rotulo'])
    const emExecucao = (this.#emExecucao.get(rotulo) ?? 0) + 1
    this.#emExecucao.set(rotulo, emExecucao)
    this.#iniciados.set(rotulo, (this.#iniciados.get(rotulo) ?? 0) + 1)
    this.#maximo.set(rotulo, Math.max(this.#maximo.get(rotulo) ?? 0, emExecucao))
    try {
      if (this.duracaoMs !== undefined) await esperar(this.duracaoMs)
      else if (!this.#solto) await new Promise<void>((resolver) => this.#esperando.push(resolver))
    } finally {
      this.#emExecucao.set(rotulo, (this.#emExecucao.get(rotulo) ?? 1) - 1)
    }
  }

  iniciados(rotulo: string): number {
    return this.#iniciados.get(rotulo) ?? 0
  }

  maximo(rotulo: string): number {
    return this.#maximo.get(rotulo) ?? 0
  }

  /** Termina os que esperam, e os próximos já não esperam: o fim do teste não fica preso na graça do worker. */
  soltar(): void {
    this.#solto = true
    for (const resolver of this.#esperando.splice(0)) resolver()
  }
}

beforeAll(() => {
  // Despachante ou worker do compose de pé disputaria as linhas e as vagas com os deste arquivo.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('vagas por escola e filas por prioridade', () => {
  let bancada: BancadaDeFila<typeof DEFINICOES_DO_TESTE>
  // Escolas reais, criadas a cada caso: desde a tarefa 3.0 `job_registro` e
  // `configuracao_operacional_escola` têm FK para `escola`, e id inventado é recusado pelo banco.
  let ESCOLA_A: string
  let ESCOLA_B: string
  let ESCOLA_C: string
  const processadores: ProcessadorContado[] = []

  beforeEach(async () => {
    bancada = new BancadaDeFila(DEFINICOES_DO_TESTE)
    await bancada.limparRegistro()
    ;[ESCOLA_A, ESCOLA_B, ESCOLA_C] = await Promise.all([bancada.escola(), bancada.escola(), bancada.escola()])
  })

  afterEach(async () => {
    for (const processador of processadores.splice(0)) processador.soltar()
    await bancada.fechar()
  }, 60_000)

  function contado(duracaoMs?: number): ProcessadorContado {
    const processador = new ProcessadorContado(duracaoMs)
    processadores.push(processador)
    return processador
  }

  /** Muitos jobs de uma vez, numa instrução só, como o fim de uma transação que enfileirou uma apostila inteira. */
  async function inserirJobs(escolaId: string, fila: QueueName, quantidade: number, rotulo: string): Promise<string[]> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into job_registro (escola_id, fila, prioridade, tipo, dados)
       select $1, $2, $3, 'sintetico', jsonb_build_object('rotulo', $4::text) from generate_series(1, $5)
       returning id`,
      [escolaId, fila, QUEUE_PRIORITY[fila], rotulo, quantidade],
    )
    await bancada.pool.query(`select pg_notify('job', '')`)
    return rows.map((linha) => linha.id)
  }

  async function contarEstado(escolaId: string, estado: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: string }>('select count(*) as total from job_registro where escola_id = $1 and estado = $2', [escolaId, estado])
    return Number(rows[0]?.total)
  }

  const membrosDaVaga = async (fila: QueueName, escolaId: string) => (await bancada.redis.zrange(bancada.vagas.chave(fila, escolaId), '0', '-1')).sort()
  const aguardarEstado = (id: string, estado: string, timeout = 10_000) =>
    expect.poll(async () => (await bancada.estado(id))?.estado, { timeout, interval: 50 }).toBe(estado)
  /**
   * Espera a escola ficar sem vaga tomada. O worker conclui no Postgres, para a renovação e só então
   * libera no Redis (`executar`, em `apps/worker/src/executor.ts`), nessa ordem e de propósito: com o
   * Postgres fora no meio, o job volta a tentar ainda dono da vaga. Quem esperou o estado `concluido`
   * esperou só o primeiro passo, e conferir o ZSET no instante seguinte é corrida — perdida no runner
   * carregado da esteira. A regra provada continua a mesma: a vaga sai no fim do job, ou o prazo estoura.
   *
   * Que a chave conferida é mesmo a que o worker ocupa, quem prova são os dois testes que afirmam o
   * `zscore` dela com o job em execução, antes de esperar o fim: uma chave errada aqui ficaria vazia lá.
   */
  const aguardarVagaVazia = (fila: QueueName, escolaId: string, timeout = 5_000) => {
    // O verde tem de vir da liberação, nunca do vencimento: num teste com validade curta (há um com
    // 1 s), esperar mais que ela deixaria a vaga sumir sozinha e a asserção passar sem o worker.
    expect(timeout).toBeLessThan(VALIDADE_DA_VAGA_MS / 2)
    return expect.poll(() => membrosDaVaga(fila, escolaId), { timeout, interval: 20 }).toEqual([])
  }

  it('caminho feliz: com 1.000 lotes na fila, um interativo novo começa antes de qualquer lote não iniciado', async () => {
    // Vagas de lote de sobra para a A: o que segura o interativo aqui só pode ser o pool, não a vaga.
    await bancada.configurarEscola(ESCOLA_A, { vagas: { lote: 1_000 } })
    const lotes = contado()
    await inserirJobs(ESCOLA_A, 'lote', 1_000, 'A')
    bancada.worker(new LogEmMemoria('worker-lote'), { pools: { lote: 10 }, processadores: { sintetico: lotes.processar } })
    const logInterativo = new LogEmMemoria('worker-interativo')
    bancada.worker(logInterativo, { pools: { interativa: 5, normal: 5 } })
    bancada.despachante(new LogEmMemoria('despachante')).despachante.iniciar()

    // O pool de lote está cheio, com 990 lotes publicados atrás dele.
    await expect.poll(() => bancada.filas.lote.getJobCounts('active', 'waiting'), { timeout: 30_000, interval: 200 }).toEqual({ active: 10, waiting: 990 })

    const interativo = await bancada.enfileirar(ESCOLA_A, { fila: 'interativa' })
    const inicio = performance.now()
    await aguardarEstado(interativo, 'concluido', 5_000)
    expect(performance.now() - inicio).toBeLessThan(2_000)
    // Nenhum lote a mais começou: o interativo não passou por trás de nenhum deles.
    expect(lotes.iniciados('A')).toBe(10)
    expect(await bancada.filas.lote.getJobCounts('active', 'waiting')).toEqual({ active: 10, waiting: 990 })
    expect(logInterativo.doEvento('job.iniciado').map((registro) => registro['jobId'])).toEqual([interativo])
  }, 90_000)

  it('a escola A com 1.000 lotes nunca passa de 2 vagas em uso, com dois despachantes; um lote da B começa sem esperar', async () => {
    const processador = contado(150)
    await inserirJobs(ESCOLA_A, 'lote', 1_000, 'A')
    bancada.worker(new LogEmMemoria('worker-lote'), { pools: { lote: 10 }, processadores: { sintetico: processador.processar } })
    for (const nome of ['despachante-1', 'despachante-2']) bancada.despachante(new LogEmMemoria(nome)).despachante.iniciar()

    // Vários ciclos de vaga da A, conferindo o ZSET a cada 20 ms.
    let maiorEmUso = 0
    while (processador.iniciados('A') < 12) {
      maiorEmUso = Math.max(maiorEmUso, await bancada.redis.zcard(bancada.vagas.chave('lote', ESCOLA_A)))
      await esperar(20)
    }
    expect(processador.maximo('A')).toBe(2)
    expect(maiorEmUso).toBeLessThanOrEqual(2)

    const daEscolaB = await bancada.enfileirar(ESCOLA_B, { fila: 'lote', dados: { rotulo: 'B' } })
    const inicio = performance.now()
    await expect.poll(() => processador.iniciados('B'), { timeout: 5_000, interval: 20 }).toBe(1)
    expect(performance.now() - inicio).toBeLessThan(1_500)
    await aguardarEstado(daEscolaB, 'concluido')
    // A B passou na frente de quase mil lotes da A, que seguem na fila só dela, e dentro das duas vagas.
    expect(await contarEstado(ESCOLA_A, 'aguardando')).toBeGreaterThan(900)
    expect(processador.maximo('A')).toBe(2)
  }, 90_000)

  it('a vaga liberada acorda o despachante: com a escola no teto, o job seguinte começa quando o anterior termina, sem esperar a sondagem', async () => {
    await bancada.configurarEscola(ESCOLA_A, { vagas: { interativa: 1 } })
    const processador = contado(200)
    bancada.worker(new LogEmMemoria('worker-interativo'), { pools: { interativa: 5 }, processadores: { sintetico: processador.processar } })
    // Sondagem de 30 s: se o próximo job saísse só nela, os cinco levariam dois minutos.
    bancada.despachante(new LogEmMemoria('despachante'), { intervaloMs: 30_000 }).despachante.iniciar()
    const ids = await inserirJobs(ESCOLA_A, 'interativa', 5, 'A')
    const inicio = performance.now()
    for (const id of ids) await aguardarEstado(id, 'concluido', 15_000)
    expect(performance.now() - inicio).toBeLessThan(10_000)
    expect(processador.maximo('A')).toBe(1)
  }, 60_000)

  it('controle negativo do cenário de carga: com a vaga por escola desligada no despachante e no worker, a escola passa do teto', async () => {
    const processador = contado()
    const log = new LogEmMemoria('worker-interativo')
    bancada.worker(log, { pools: { interativa: 20 }, processadores: { sintetico: processador.processar }, vagasPorEscolaDesligadas: true })
    bancada.despachante(new LogEmMemoria('despachante'), {}, true).despachante.iniciar()
    await inserirJobs(ESCOLA_A, 'interativa', 12, 'A')
    // Com o teto padrão de 5 vagas interativas no despachante, só 5 começariam. O worker confere a vaga que o
    // despachante já tomou; a flag nele vale para a vaga que venceu no caminho, e o log prova que ela chegou lá.
    await expect.poll(() => processador.iniciados('A'), { timeout: 10_000, interval: 50 }).toBe(12)
    expect(processador.maximo('A')).toBe(12)
    expect(log.doEvento('worker.vagas_por_escola_desligadas')).toHaveLength(1)
  }, 60_000)

  it('concorrência: dois despachantes tomando vaga da mesma escola ao mesmo tempo nunca passam do limite', async () => {
    const clientes = ['despachante-1', 'despachante-2'].map((nome) => createQueueRedisClient(urlRedisDeFila(), nome, () => undefined))
    try {
      await Promise.all(clientes.map((cliente) => new Promise((resolver) => cliente.once('ready', resolver))))
      const vagas = clientes.map((cliente) => bancada.vagasCom(cliente))
      const pedidos = Array.from({ length: 200 }, (_, indice) => (vagas[indice % 2] as EscolaConcurrencyLimiter).tomar('lote', ESCOLA_A, 2, [`job-${indice}`]))
      const concedidos = (await Promise.all(pedidos)).flatMap((concedido) => [...concedido])
      expect(concedidos).toHaveLength(2)
      expect(await membrosDaVaga('lote', ESCOLA_A)).toEqual([...concedidos].sort())

      // Num pedido só com vários jobs, também só até o limite; e job que já tem vaga a mantém sem contar de novo.
      const deUmaVez = await (vagas[0] as EscolaConcurrencyLimiter).tomar('normal', ESCOLA_A, 3, ['n-1', 'n-2', 'n-3', 'n-4', 'n-5'])
      expect([...deUmaVez]).toEqual(['n-1', 'n-2', 'n-3'])
      expect([...(await (vagas[1] as EscolaConcurrencyLimiter).tomar('normal', ESCOLA_A, 3, ['n-2', 'n-6']))]).toEqual(['n-2'])
    } finally {
      for (const cliente of clientes) cliente.disconnect()
    }
  })

  it('borda: reserva feita e vaga negada → a linha volta a aguardando e nenhuma vaga fica presa', async () => {
    const id = await bancada.enfileirar(ESCOLA_A, { fila: 'lote' })
    const deOutroDespachante = [randomUUID(), randomUUID()]
    let outroJaTomou = false
    const log = new LogEmMemoria('despachante')
    // Entre a estimativa desta instância e a tomada, outro despachante leva as duas vagas da escola.
    const montado = bancada.despachante(log, {
      embrulharVagas: (vagas) => ({
        livres: async (fila, escolaId, limite) => {
          const livres = await vagas.livres(fila, escolaId, limite)
          if (!outroJaTomou) {
            outroJaTomou = true
            await bancada.vagas.tomar(fila, escolaId, limite, deOutroDespachante)
          }
          return livres
        },
        membros: (fila, escolaId) => vagas.membros(fila, escolaId),
        manter: (fila, escolaId, jobIds) => vagas.manter(fila, escolaId, jobIds),
        tomar: (fila, escolaId, limite, jobIds) => vagas.tomar(fila, escolaId, limite, jobIds),
        liberar: (fila, escolaId, jobIds) => vagas.liberar(fila, escolaId, jobIds),
      }),
    })

    expect(await montado.despachante.rodada()).toBe(0)
    expect(outroJaTomou).toBe(true)
    const { rows } = await bancada.pool.query<{ estado: string; reservadoAte: Date | null }>('select estado, reservado_ate as "reservadoAte" from job_registro where id = $1', [id])
    expect(rows[0]).toEqual({ estado: 'aguardando', reservadoAte: null })
    expect(await membrosDaVaga('lote', ESCOLA_A)).toEqual([...deOutroDespachante].sort())
    expect(await bancada.filas.lote.getJob(id)).toBeUndefined()
    expect(log.doEvento('job.publicado')).toEqual([])

    // O outro terminou: a rodada seguinte, sem esperar reserva vencer, publica com a vaga do próprio job.
    await bancada.vagas.liberar('lote', ESCOLA_A, deOutroDespachante)
    expect(await montado.despachante.rodada()).toBe(1)
    expect((await bancada.estado(id))?.estado).toBe('publicado')
    expect(await membrosDaVaga('lote', ESCOLA_A)).toEqual([id])
  })

  it('borda: worker morto segurando vaga → a vaga vence em 60 s e a escola volta a andar', async () => {
    const chave = bancada.vagas.chave('lote', ESCOLA_A)
    const deWorkerMorto = [randomUUID(), randomUUID()]
    await bancada.vagas.tomar('lote', ESCOLA_A, 2, deWorkerMorto)
    const [segundos] = await bancada.redis.time()
    const agoraMs = Number(segundos) * 1_000
    expect(VALIDADE_DA_VAGA_MS).toBe(60_000)
    for (const jobId of deWorkerMorto) {
      const vencimento = Number(await bancada.redis.zscore(chave, jobId))
      expect(vencimento - agoraMs).toBeGreaterThan(VALIDADE_DA_VAGA_MS - 2_000)
      expect(vencimento - agoraMs).toBeLessThanOrEqual(VALIDADE_DA_VAGA_MS + 1_000)
    }

    const id = await bancada.enfileirar(ESCOLA_A, { fila: 'lote' })
    bancada.worker(new LogEmMemoria('worker'), { pools: { lote: 10 } })
    bancada.despachante(new LogEmMemoria('despachante')).despachante.iniciar()
    await esperar(1_500)
    expect((await bancada.estado(id))?.estado).toBe('aguardando')

    // Os 60 s passam sem ninguém renovar.
    for (const jobId of deWorkerMorto) await bancada.redis.zadd(chave, 'XX', String(agoraMs - 1), jobId)
    await aguardarEstado(id, 'concluido', 5_000)
    // As vencidas saíram na tomada, e o job liberou a própria vaga no fim.
    await aguardarVagaVazia('lote', ESCOLA_A)
  })

  it('o worker renova a vaga enquanto o job roda, a vaga fica com o job na retentativa, e sai no fim', async () => {
    let tentativas = 0
    let terminar: () => void = () => undefined
    const segundaTentativa = new Promise<void>((resolver) => (terminar = resolver))
    const processador: Processador<typeof TIPO_JOB_SINTETICO> = async () => {
      tentativas++
      if (tentativas === 1) {
        await esperar(800)
        throw new FalhaDeJob(JobFailureCode.FALHA_SINTETICA)
      }
      await segundaTentativa
    }
    const id = await bancada.enfileirar(ESCOLA_A, { fila: 'normal' })
    const chave = bancada.vagas.chave('normal', ESCOLA_A)
    bancada.worker(new LogEmMemoria('worker'), { pools: { normal: 5 }, processadores: { sintetico: processador }, intervaloRenovacaoDaVagaMs: 200 })
    bancada.despachante(new LogEmMemoria('despachante')).despachante.iniciar()

    await aguardarEstado(id, 'ativo')
    const primeiro = Number(await bancada.redis.zscore(chave, id))
    await esperar(500)
    expect(Number(await bancada.redis.zscore(chave, id))).toBeGreaterThan(primeiro)

    // Entre as tentativas (recuo do BullMQ), ninguém roda o job, e a vaga continua dele.
    await expect.poll(async () => (await bancada.filas.normal.getJob(id))?.getState(), { timeout: 5_000, interval: 20 }).toBe('delayed')
    expect(await bancada.redis.zscore(chave, id)).not.toBeNull()

    await expect.poll(() => tentativas, { timeout: 10_000 }).toBe(2)
    terminar()
    await aguardarEstado(id, 'concluido')
    await aguardarVagaVazia('normal', ESCOLA_A)
  })

  it('job publicado e parado na fila (pool cheio, réplica fora) segura a vaga além da validade: a escola não ganha publicados acima do teto', async () => {
    // Validade de 1 s: três validades passam com os dois lotes da A publicados e nenhum worker de pé.
    const validadeDaVagaMs = 1_000
    const daEscolaA = await inserirJobs(ESCOLA_A, 'lote', 10, 'A')
    bancada.despachante(new LogEmMemoria('despachante'), { validadeDaVagaMs }).despachante.iniciar()
    await expect.poll(() => bancada.filas.lote.getJobCounts('waiting'), { timeout: 5_000, interval: 50 }).toEqual({ waiting: 2 })
    for (let conferencia = 0; conferencia < 7; conferencia++) {
      await esperar(500)
      expect(await bancada.filas.lote.getJobCounts('waiting'), `${conferencia * 500} ms`).toEqual({ waiting: 2 })
      expect(await contarEstado(ESCOLA_A, 'publicado')).toBe(2)
    }

    // A réplica volta: a A segue com duas por vez, e a B entra sem esperar a pilha da A.
    const processador = contado(300)
    bancada.worker(new LogEmMemoria('worker-lote'), { pools: { lote: 10 }, processadores: { sintetico: processador.processar }, validadeDaVagaMs, intervaloRenovacaoDaVagaMs: 200 })
    const [daEscolaB = ''] = await inserirJobs(ESCOLA_B, 'lote', 1, 'B')
    await expect.poll(() => processador.iniciados('B'), { timeout: 3_000, interval: 20 }).toBe(1)
    await aguardarEstado(daEscolaB, 'concluido')
    for (const id of daEscolaA) await aguardarEstado(id, 'concluido', 20_000)
    expect(processador.maximo('A')).toBe(2)
  }, 60_000)

  it('a retentativa é a da definição do tipo: com a definição injetada de duas tentativas, o job sai do despachante com attempts 2 e o recuo dela', async () => {
    const definicoes = {
      ...DEFINICOES_DO_TESTE,
      [TIPO_JOB_SINTETICO]: defineJob({ ...DEFINICOES_DO_TESTE[TIPO_JOB_SINTETICO], retentativa: { tentativas: 2, recuoMs: 50, jitter: 0 } }),
    }
    const curta = new BancadaDeFila(definicoes)
    try {
      const escola = await curta.escola()
      const id = await curta.enfileirar(escola, { dados: { rotulo: 'A' } })
      expect(await curta.despachante(new LogEmMemoria('despachante')).despachante.rodada()).toBe(1)
      const naFila = await curta.fila.getJob(id)
      expect(naFila?.opts).toMatchObject({ attempts: 2, backoff: { type: 'exponential', delay: 50, jitter: 0 } })
    } finally {
      await curta.fechar()
    }
  })

  it('o tipo da API vai à fila da API: o worker, que consome as filas do worker, não o recebe, e a linha segue publicada', async () => {
    const daApi = new BancadaDeFila({ ...DEFINICOES_DO_TESTE, [TIPO_JOB_SINTETICO]: defineJob({ ...DEFINICOES_DO_TESTE[TIPO_JOB_SINTETICO], executor: 'api' }) })
    const filaDaApi = new Queue(bullmqQueueName('interativa', 'api'), { connection: daApi.redis, prefix: daApi.prefixo })
    filaDaApi.on('error', () => undefined)
    const processador = contado()
    try {
      daApi.worker(new LogEmMemoria('worker'), { processadores: { sintetico: processador.processar } })
      const escola = await daApi.escola()
      const id = await daApi.enfileirar(escola, { dados: { rotulo: 'A' } })
      expect(await daApi.despachante(new LogEmMemoria('despachante')).despachante.rodada()).toBe(1)
      await expect.poll(async () => (await daApi.estado(id))?.estado, { timeout: 5_000, interval: 50 }).toBe('publicado')
      expect(await filaDaApi.getJob(id)).toBeDefined()
      expect(await daApi.fila.getJob(id)).toBeUndefined()
      expect(processador.iniciados('A')).toBe(0)
      expect((await daApi.estado(id))?.estado).toBe('publicado')
    } finally {
      // Se o worker pegou o job (a fila errada), o processador espera `soltar()`: sem soltá-lo, o fechamento esperaria por ele.
      processador.soltar()
      await filaDaApi.close()
      await daApi.fechar()
    }
  })

  it('publicação ambígua: jobs na fila do BullMQ sem vaga tomada não passam do teto na execução, e esperam sem gastar tentativa', async () => {
    const ids = await inserirJobs(ESCOLA_A, 'lote', 6, 'A')
    // Como um addBulk que expirou no despachante depois de gravar: os jobs estão na fila, e a vaga foi devolvida.
    await bancada.reservar(ESCOLA_A, 'lote')
    await bancada.filas.lote.addBulk(ids.map((jobId) => ({ name: 'sintetico', data: { escolaId: ESCOLA_A, requisicaoId: null }, opts: { ...jobOptions(TIPO_JOB_SINTETICO), jobId } })))
    await runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, () => bancada.despacho.marcarPublicados(ids))
    const processador = contado(300)
    const log = new LogEmMemoria('worker-lote')
    const medidor = new MedidorDeTeste()
    bancada.worker(log, { pools: { lote: 10 }, processadores: { sintetico: processador.processar }, medidor: medidor.medidor })

    for (const id of ids) await aguardarEstado(id, 'concluido', 20_000)
    expect(processador.maximo('A')).toBe(2)
    // A espera por vaga é contada por fila e escola, e não vai ao log a cada volta.
    const esperasPorVaga = await medidor.pontos(METRICS.aguardandoVaga)
    expect(esperasPorVaga.map(({ atributos }) => atributos)).toEqual([{ fila: 'lote', escola_id: ESCOLA_A }])
    expect(esperasPorVaga[0]?.valor).toBeGreaterThan(0)
    expect(log.doEvento('job.aguardando_vaga')).toEqual([])
    await medidor.encerrar()
    for (const id of ids) {
      const naFila = await bancada.filas.lote.getJob(id)
      expect(naFila?.attemptsMade, id).toBe(1)
    }
    expect(log.doEvento('job.tentativa_falhou')).toEqual([])
    await aguardarVagaVazia('lote', ESCOLA_A)
  }, 60_000)

  it('a renovação dos publicados custa as vagas da escola, e não a fila dela: com 5.000 lotes à espera, a busca é pela chave primária', async () => {
    const aguardando = await inserirJobs(ESCOLA_A, 'lote', 5_000, 'A')
    const emExecucao = aguardando.slice(0, 2)
    await bancada.pool.query(`update job_registro set estado = 'ativo' where id = any($1)`, [emExecucao])
    await bancada.vagas.tomar('lote', ESCOLA_A, 2, emExecucao)
    await bancada.pool.query('analyze job_registro')

    // O banco do teste registra a instrução que o repository manda, para o EXPLAIN ser da consulta de verdade.
    const pool = createPool(configuracaoDoBanco(), () => undefined)
    const enviadas: Array<{ text: string; values: unknown[] }> = []
    const consultar = pool.query.bind(pool) as (...argumentos: unknown[]) => Promise<unknown>
    pool.query = ((...argumentos: unknown[]) => {
      const [instrucao, valores] = argumentos as [string | { text: string; values?: unknown[] }, unknown[] | undefined]
      enviadas.push(typeof instrucao === 'string' ? { text: instrucao, values: valores ?? [] } : { text: instrucao.text, values: instrucao.values ?? valores ?? [] })
      return consultar(...argumentos)
    }) as typeof pool.query
    try {
      const repositorio = new DispatchRepository(createDatabase(pool))
      const membros = await bancada.vagas.membros('lote', ESCOLA_A)
      expect(await runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, () => repositorio.publicadosEntre(membros))).toEqual([])
      const [consulta] = enviadas
      if (consulta === undefined) throw new Error('o repository não consultou o banco')

      const { rows } = await bancada.pool.query<{ 'QUERY PLAN': Array<{ Plan: NoDoPlano }> }>(`explain (analyze, buffers, format json) ${consulta.text}`, consulta.values)
      const nos = nosDoPlano(rows[0]?.['QUERY PLAN'][0]?.Plan)
      expect(nos.map((no) => no['Index Name'])).toContain('job_registro_pkey')
      // Só as linhas com vaga passam pelo filtro; varrer a fila da escola descartaria milhares.
      expect(nos.reduce((soma, no) => soma + (no['Rows Removed by Filter'] ?? 0), 0)).toBeLessThanOrEqual(membros.length)
    } finally {
      await pool.end()
    }
  }, 60_000)

  it('borda: vagas nula usa o padrão; vagas.lote=5 vale só para aquela escola', async () => {
    await bancada.configurarEscola(ESCOLA_A, { vagas: { lote: 5 } })
    // A C configurou outra coisa, mas não as vagas: vale o padrão.
    await bancada.configurarEscola(ESCOLA_C, { vagas: null, limiteReqEscolaMin: 10 })
    const processador = contado(200)
    for (const [escolaId, rotulo] of [[ESCOLA_A, 'A'], [ESCOLA_B, 'B'], [ESCOLA_C, 'C']] as const) await inserirJobs(escolaId, 'lote', 40, rotulo)
    bancada.worker(new LogEmMemoria('worker-lote'), { pools: { lote: 20 }, processadores: { sintetico: processador.processar } })
    bancada.despachante(new LogEmMemoria('despachante')).despachante.iniciar()

    await expect
      .poll(() => [processador.iniciados('A') >= 15, processador.iniciados('B') >= 6, processador.iniciados('C') >= 6], { timeout: 30_000, interval: 100 })
      .toEqual([true, true, true])
    expect({ A: processador.maximo('A'), B: processador.maximo('B'), C: processador.maximo('C') }).toEqual({ A: 5, B: 2, C: 2 })
  }, 60_000)

  describe('isolamento', () => {
    it('A sem vaga não atrasa B: com as vagas interativas da A tomadas e jobs dela à espera, o interativo da B executa na hora', async () => {
      const ocupantes = Array.from({ length: 5 }, () => randomUUID())
      await bancada.vagas.tomar('interativa', ESCOLA_A, 5, ocupantes)
      const daEscolaA = await Promise.all(Array.from({ length: 20 }, () => bancada.enfileirar(ESCOLA_A)))
      bancada.worker(new LogEmMemoria('worker'), { pools: { interativa: 5 } })
      bancada.despachante(new LogEmMemoria('despachante')).despachante.iniciar()

      const daEscolaB = await bancada.enfileirar(ESCOLA_B)
      await aguardarEstado(daEscolaB, 'concluido', 3_000)
      for (const id of daEscolaA) expect((await bancada.estado(id))?.estado).toBe('aguardando')
      expect(await membrosDaVaga('interativa', ESCOLA_A)).toEqual([...ocupantes].sort())
    })

    it('reservar, devolver, listar e marcar publicados só alcançam a escola do contexto: ids da B no contexto da A não mudam nada', async () => {
      const [daEscolaB = ''] = await inserirJobs(ESCOLA_B, 'lote', 1, 'B')
      const naEscola = <T>(escolaId: string, funcao: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)

      expect(await bancada.reservar(ESCOLA_A, 'lote')).toEqual([])
      expect((await bancada.estado(daEscolaB))?.estado).toBe('aguardando')

      expect((await bancada.reservar(ESCOLA_B, 'lote')).map((job) => job.id)).toEqual([daEscolaB])
      expect(await naEscola(ESCOLA_A, () => bancada.despacho.devolverParaAguardando([daEscolaB]))).toBe(0)
      expect((await bancada.estado(daEscolaB))?.estado).toBe('reservado')
      expect(await naEscola(ESCOLA_B, () => bancada.despacho.devolverParaAguardando([daEscolaB]))).toBe(1)
      expect((await bancada.estado(daEscolaB))?.estado).toBe('aguardando')

      await bancada.pool.query(`update job_registro set estado = 'publicado' where id = $1`, [daEscolaB])
      expect(await naEscola(ESCOLA_A, () => bancada.despacho.publicadosEntre([daEscolaB]))).toEqual([])
      expect(await naEscola(ESCOLA_B, () => bancada.despacho.publicadosEntre([daEscolaB]))).toEqual([daEscolaB])
      await bancada.pool.query(`update job_registro set estado = 'reservado' where id = $1`, [daEscolaB])
      expect(await naEscola(ESCOLA_A, () => bancada.despacho.marcarPublicados([daEscolaB]))).toBe(0)
      expect((await bancada.estado(daEscolaB))?.estado).toBe('reservado')
    })

    it('a configuração operacional é lida só para a escola do contexto, e contexto sem escola não lê nada', async () => {
      await bancada.configurarEscola(ESCOLA_A, { vagas: { lote: 5 }, limiteReqEscolaMin: 10 })
      const repositorio = new OperationalSettingsRepository(bancada.banco)
      const naEscola = (escolaId: string) => runInContext({ requisicaoId: randomUUID(), escolaId }, () => repositorio.daEscola())

      expect(await naEscola(ESCOLA_A)).toEqual({ fuso: null, diasLetivos: null, inicio: null, fim: null, limiteReqUsuarioMin: null, limiteReqEscolaMin: 10, vagas: { lote: 5 } })
      expect(await naEscola(ESCOLA_B)).toBeUndefined()
      await expect(runInContext({ requisicaoId: randomUUID() }, () => repositorio.daEscola())).rejects.toThrow('consulta com escopo sem escola no contexto')
      await expect(runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => repositorio.daEscola())).rejects.toThrow('consulta com escopo sem escola no contexto')
    })
  })

  it('o banco recusa vaga que o despachante não saberia usar: zero, fração, texto ou fila desconhecida', async () => {
    for (const vagas of [{ lote: 0 }, { lote: 2.5 }, { lote: '5' }, { prioritaria: 3 }]) {
      await expect(
        bancada.pool.query('insert into configuracao_operacional_escola (escola_id, vagas) values ($1, $2)', [ESCOLA_A, JSON.stringify(vagas)]),
        JSON.stringify(vagas),
      ).rejects.toThrow('configuracao_operacional_vagas_validas')
    }
  })

  it('a lista do rodízio tem cada escola com job disponível uma vez por fila, e a rotina do sistema sem escola', async () => {
    await inserirJobs(ESCOLA_A, 'lote', 50, 'A')
    await inserirJobs(ESCOLA_A, 'interativa', 3, 'A')
    // A B só tem job em execução: nada a despachar.
    const [emExecucao = ''] = await inserirJobs(ESCOLA_B, 'lote', 1, 'B')
    await bancada.pool.query(`update job_registro set estado = 'ativo' where id = $1`, [emExecucao])
    // A C tem uma reserva de um despachante que caiu: volta a ser disponível.
    const [reservaVencida = ''] = await inserirJobs(ESCOLA_C, 'normal', 1, 'C')
    await bancada.pool.query(`update job_registro set estado = 'reservado', reservado_ate = now() - interval '1 second' where id = $1`, [reservaVencida])
    await runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () =>
      bancada.banco.transaction((tx) => bancada.enfileirador.enfileirar(tx, TIPO_EXPURGAR_JOBS, {})),
    )

    const lista = await bancada.despacho.listarEscolasComPendentes()
    expect([...lista].sort((a, b) => `${a.fila}${a.escolaId}`.localeCompare(`${b.fila}${b.escolaId}`))).toEqual([
      { fila: 'interativa', escolaId: ESCOLA_A },
      { fila: 'lote', escolaId: ESCOLA_A },
      { fila: 'lote', escolaId: null },
      { fila: 'normal', escolaId: ESCOLA_C },
    ])
  })
})
