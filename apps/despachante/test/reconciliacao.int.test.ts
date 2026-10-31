import 'reflect-metadata'
import {
  createQueueRedisClient,
  runInContext,
  IDADE_PARA_RECONCILIAR_SEGUNDOS,
  bullmqQueueName,
  TIMEOUT_COMANDO_REDIS_FILA_MS,
  type QueuedJobData,
} from '@educa/core'
import { JobFailureCode } from '@educa/shared'
import { Queue, UnrecoverableError, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { aguardarSaudavel, compose, composeAssincronoOuFalha, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { FalhaDeJob } from '../../worker/src/falha-de-job.js'
import { BancadaDeFila, LogEmMemoria, urlRedisDeFila } from '../../worker/test/fila-de-teste.js'
import type { DespachanteMontado } from '../src/montagem.js'
import { PublicacaoBullMQ, type FilaDePublicacao } from '../src/fila-de-publicacao.js'
import { Reconciliacao } from '../src/reconciliacao.js'

// Despachantes e workers de verdade no processo do teste, contra o Postgres e o Redis de fila do
// compose de teste. A idade de 2 min é simulada recuando as datas da linha no banco.

beforeAll(() => {
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('reconciliação entre job_registro e o BullMQ', () => {
  let bancada: BancadaDeFila
  // Escolas reais, criadas a cada caso: desde a tarefa 3.0 `job_registro` e
  // `configuracao_operacional_escola` têm FK para `escola`, e id inventado é recusado pelo banco.
  let ESCOLA_A: string
  let ESCOLA_B: string

  beforeEach(async () => {
    bancada = new BancadaDeFila()
    await bancada.limparRegistro()
    ;[ESCOLA_A, ESCOLA_B] = await Promise.all([bancada.escola(), bancada.escola()])
    // Os jobs publicados aqui não executam (não há worker na maior parte dos testes) e seguram a vaga:
    // com o padrão, a rodada pararia em 5 interativos e 2 lotes. A vaga tem teste próprio (vagas.int.test.ts).
    for (const escola of [ESCOLA_A, ESCOLA_B]) await bancada.configurarEscola(escola, { vagas: { interativa: 1_000, normal: 1_000, lote: 1_000 } })
  })

  afterEach(async () => {
    compose('unpause', 'redis-fila')
    await composeAssincronoOuFalha('up', '--detach', 'redis-fila', 'postgres')
    // `up --wait` desiste na hora depois de um `pause`, com o último estado ainda `unhealthy`.
    for (const servico of ['redis-fila', 'postgres']) await aguardarSaudavel(servico)
    await bancada.fechar()
  }, 120_000)

  /** Como se o job estivesse no estado atual há mais tempo que a idade da reconciliação. */
  async function envelhecer(...ids: string[]): Promise<void> {
    await bancada.pool.query(
      `update job_registro
       set reservado_ate = reservado_ate - make_interval(secs => $2), iniciado_em = iniciado_em - make_interval(secs => $2)
       where id = any($1)`,
      [ids, IDADE_PARA_RECONCILIAR_SEGUNDOS + 10],
    )
  }

  /** Enfileira e publica pela rodada de um despachante, sem ligar o laço. Devolve o despachante e os ids. */
  async function publicados(log: LogEmMemoria, quantidade: number, fila: 'interativa' | 'lote' = 'interativa'): Promise<{ montado: DespachanteMontado; ids: string[] }> {
    const ids: string[] = []
    for (let indice = 0; indice < quantidade; indice++) ids.push(await bancada.enfileirar(ESCOLA_A, { fila }))
    const montado = bancada.despachante(log)
    let publicadosAteAqui = 0
    while (publicadosAteAqui < quantidade) publicadosAteAqui += await montado.despachante.rodada()
    return { montado, ids }
  }

  /** O Redis perdeu o job depois de publicado (AOF sem o último segundo, Redis trocado). */
  async function perderNaFila(...ids: string[]): Promise<void> {
    for (const id of ids) for (const fila of Object.values(bancada.filas)) await (await fila.getJob(id))?.remove()
  }

  function comoAtivo(id: string): Promise<unknown> {
    return runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, () => bancada.registro.iniciarExecucao(id))
  }

  /** Uma reconciliação à parte, com cliente e `Queue` próprios, e a consulta à fila embrulhada pelo teste. */
  function reconciliacaoAParte(nome: string, embrulhar: (consultar: FilaDePublicacao['consultar']) => FilaDePublicacao['consultar'], lote?: number) {
    const redis = createQueueRedisClient(urlRedisDeFila(), nome, () => undefined)
    const publicacao = new PublicacaoBullMQ((filaDoJob, executor) => new Queue<QueuedJobData>(bullmqQueueName(filaDoJob, executor), { connection: redis, prefix: bancada.prefixo }))
    const fila: FilaDePublicacao = { publicar: (jobs) => publicacao.publicar(jobs), consultar: embrulhar((job) => publicacao.consultar(job)) }
    const log = new LogEmMemoria(nome)
    return {
      log,
      reconciliacao: new Reconciliacao(
        { repositorio: bancada.despacho, fila, vagas: bancada.vagas, vagasDaEscola: bancada.vagasDaEscola(), logger: log.logger },
        lote === undefined ? {} : { lote },
      ),
      fechar: async () => {
        await publicacao.fechar()
        await redis.quit()
      },
    }
  }

  it('job que a fila perdeu depois de publicado, ou de ativo, volta com o mesmo id e executa uma vez; o que a fila tem e o recente ficam como estão', async () => {
    const logDespachante = new LogEmMemoria('despachante')
    const requisicaoId = randomUUID()
    const perdido = await bancada.enfileirar(ESCOLA_B, {}, requisicaoId)
    const [presente = '', recente = '', ativoPerdido = ''] = [await bancada.enfileirar(ESCOLA_A), await bancada.enfileirar(ESCOLA_A), await bancada.enfileirar(ESCOLA_A)]
    const montado = bancada.despachante(logDespachante)
    expect(await montado.despachante.rodada()).toBe(4)
    // O worker marcou `ativo` e a réplica morreu junto com o Redis que tinha o job.
    await comoAtivo(ativoPerdido)
    await perderNaFila(perdido, recente, ativoPerdido)
    await envelhecer(perdido, presente, ativoPerdido)

    const resultado = await montado.reconciliacao.reconciliar()

    expect(resultado.conferidos).toBe(3)
    expect([...resultado.republicados].sort()).toEqual([perdido, ativoPerdido].sort())
    expect(resultado.semConfirmacao).toBe(0)
    expect((await bancada.estado(perdido))?.estado).toBe('publicado')
    expect((await bancada.estado(ativoPerdido))?.estado).toBe('publicado')
    expect(await bancada.fila.getJob(perdido)).toBeDefined()
    // Recente demais: fica para uma próxima reconciliação, ainda publicado e fora da fila.
    expect((await bancada.estado(recente))?.estado).toBe('publicado')
    expect(await bancada.fila.getJob(recente)).toBeUndefined()
    // A republicação leva a trilha de quem pediu o job.
    const republicacao = logDespachante.doEvento('job.republicado').find((registro) => registro['jobId'] === perdido)
    expect(republicacao).toMatchObject({ requisicaoId, escolaId: ESCOLA_B })

    // O worker recomeça o job ativo republicado: com o `iniciado_em` antigo, mas a reserva nova o tira da
    // idade de reconciliar. Só o que a fila tem continua sendo conferido.
    await comoAtivo(ativoPerdido)
    expect(await montado.reconciliacao.reconciliar()).toEqual({ conferidos: 1, republicados: [], falhasRegistradas: [], semConfirmacao: 0 })

    const logWorker = new LogEmMemoria('worker')
    bancada.worker(logWorker)
    const reconciliados = [perdido, presente, ativoPerdido]
    await expect
      .poll(async () => Promise.all(reconciliados.map(async (id) => (await bancada.estado(id))?.estado)), { timeout: 20_000, interval: 200 })
      .toEqual(['concluido', 'concluido', 'concluido'])
    for (const id of reconciliados) {
      expect(logWorker.doEvento('job.iniciado').filter((registro) => registro['jobId'] === id), id).toHaveLength(1)
    }
  })

  it('a varredura passa por todos: um job perdido atrás de 150 lotes que a fila tem é republicado na mesma reconciliação', async () => {
    const log = new LogEmMemoria('despachante')
    const { montado, ids: lotesNaFila } = await publicados(log, 150, 'lote')
    const { ids: [perdido = ''] } = await publicados(log, 1, 'lote')
    await perderNaFila(perdido)
    await envelhecer(...lotesNaFila, perdido)
    // Todos criados no mesmo instante, como numa transação que enfileira muitos: o id desempata o cursor.
    await bancada.pool.query(`update job_registro set criado_em = date_trunc('second', now()) where id = any($1)`, [[...lotesNaFila, perdido]])

    const resultado = await montado.reconciliacao.reconciliar()

    expect(resultado).toEqual({ conferidos: 151, republicados: [perdido], falhasRegistradas: [], semConfirmacao: 0 })
    // Na fila dele, a de lote.
    expect(await bancada.filas.lote.getJob(perdido)).toBeDefined()
    // Com a volta completa, a próxima começa do início de novo.
    expect((await montado.reconciliacao.reconciliar()).conferidos).toBe(150)
  }, 90_000)

  it('a varredura vai do interativo ao lote, e um job que a fila não consegue ler não a prende na mesma página', async () => {
    const log = new LogEmMemoria('despachante')
    const { ids: lotes } = await publicados(log, 3, 'lote')
    const { ids: [interativo = ''] } = await publicados(log, 1, 'interativa')
    const [ilegivel = '', ...outrosLotes] = lotes
    await perderNaFila(interativo, ...lotes)
    await envelhecer(interativo, ...lotes)

    // Páginas de 2: o ilegível, o lote mais antigo, cai na primeira página, junto com o interativo.
    const aParte = reconciliacaoAParte('reconciliacao', (consultar) => (job) => (job.id === ilegivel ? Promise.reject(new Error('hash do job ilegível')) : consultar(job)), 2)
    try {
      const resultado = await aParte.reconciliacao.reconciliar()

      expect(resultado.conferidos).toBe(4)
      expect(resultado.semConfirmacao).toBe(1)
      expect(resultado.republicados).toEqual([interativo, ...outrosLotes])
      expect((await bancada.estado(ilegivel))?.estado).toBe('publicado')
    } finally {
      await aParte.fechar()
    }
  })

  it('consulta sem resposta (Redis de fila travado, e depois parado) não republica; com o Redis de volta, republica', async () => {
    const log = new LogEmMemoria('despachante')
    // O mesmo despachante que acabou de publicar: o cliente dele está conectado quando o Redis trava.
    const { montado, ids: [id = ''] } = await publicados(log, 1)
    await perderNaFila(id)
    await envelhecer(id)

    compose('pause', 'redis-fila')
    const inicio = performance.now()
    const comRedisTravado = await montado.reconciliacao.reconciliar()
    const duracaoMs = performance.now() - inicio
    compose('unpause', 'redis-fila')
    expect(duracaoMs).toBeGreaterThanOrEqual(TIMEOUT_COMANDO_REDIS_FILA_MS - 100)
    expect(duracaoMs).toBeLessThan(TIMEOUT_COMANDO_REDIS_FILA_MS + 2_000)
    expect(comRedisTravado).toEqual({ conferidos: 1, republicados: [], falhasRegistradas: [], semConfirmacao: 1 })
    expect((await bancada.estado(id))?.estado).toBe('publicado')

    await composeAssincronoOuFalha('stop', 'redis-fila')
    const comRedisParado = await montado.reconciliacao.reconciliar()
    expect(comRedisParado).toEqual({ conferidos: 1, republicados: [], falhasRegistradas: [], semConfirmacao: 1 })
    expect((await bancada.estado(id))?.estado).toBe('publicado')
    expect(log.doEvento('reconciliacao.consulta_falhou')).toHaveLength(2)
    expect(log.doEvento('job.republicado')).toEqual([])

    await composeAssincronoOuFalha('start', 'redis-fila')
    // O `start` devolve quando o Docker aceitou o comando, não quando o Redis responde, e essa subida cresce com a
    // carga da máquina: numa esteira com quatro tarefas em paralelo ela sozinha passa do prazo abaixo. Esperar o
    // serviço aqui (teto próprio, e erro com o estado e o log do container) tira o tempo de container do orçamento da
    // recuperação, como o caso do Postgres abaixo já faz.
    await aguardarSaudavel('redis-fila')
    // Só faltava a confirmação: a mesma linha, com a fila respondendo, volta. O prazo mede só a recuperação, que é de
    // milissegundos com a máquina livre e de ~1,5 s sob contenção total: é a garantia do `createQueueRedisClient`,
    // "o Redis que volta é usado de novo em segundos".
    await expect.poll(async () => (await montado.reconciliacao.reconciliar()).republicados, { timeout: 20_000, interval: 500 }).toEqual([id])
    // 120 s como o caso do Postgres: com 90 s o prefixo, o teto da espera e o prazo do poll cabiam justo, e no pior
    // caso o vitest expiraria antes de `aguardarSaudavel` erguer o erro que diz o que houve com o container.
  }, 120_000)

  it('duas reconciliações que confirmaram juntas a perda dos mesmos 20 jobs: cada um é tomado e publicado por uma só, e executa uma vez', async () => {
    const { ids } = await publicados(new LogEmMemoria('despachante'), 20)
    await perderNaFila(...ids)
    await envelhecer(...ids)

    // Uma barreira depois das consultas: as duas só seguem quando ambas já viram os 20 fora da fila,
    // para a disputa acontecer toda vez, e não só quando o relógio ajuda.
    let consultas = 0
    let liberar: () => void = () => undefined
    const barreira = new Promise<void>((resolver) => (liberar = resolver))
    const instancias = ['reconciliacao-1', 'reconciliacao-2'].map((nome) =>
      reconciliacaoAParte(nome, (consultar) => async (job) => {
        try {
          return await consultar(job)
        } finally {
          if (++consultas === ids.length * 2) liberar()
          await barreira
        }
      }),
    )
    try {
      const [primeira, segunda] = await Promise.all(instancias.map(({ reconciliacao }) => reconciliacao.reconciliar()))

      expect(primeira?.conferidos).toBe(20)
      expect(segunda?.conferidos).toBe(20)
      const republicados1 = primeira?.republicados ?? []
      const republicados2 = segunda?.republicados ?? []
      expect(republicados1.filter((id) => republicados2.includes(id))).toEqual([])
      expect([...republicados1, ...republicados2].sort()).toEqual([...ids].sort())
      expect(instancias.flatMap(({ log }) => log.doEvento('job.republicado'))).toHaveLength(20)

      const logWorker = new LogEmMemoria('worker')
      bancada.worker(logWorker, { concorrencia: 10 })
      await expect.poll(async () => (await bancada.fila.getJobCounts('completed'))['completed'], { timeout: 20_000 }).toBe(20)
      expect(new Set(logWorker.doEvento('job.iniciado').map((registro) => registro['jobId'])).size).toBe(20)
      expect(logWorker.doEvento('job.iniciado')).toHaveLength(20)
    } finally {
      for (const { fechar } of instancias) await fechar()
    }
  })

  it('confirmação que envelheceu: outra reconciliação já republicou e o worker recomeçou o job ativo, e a que atrasou não o toma de novo', async () => {
    const { ids: [id = ''] } = await publicados(new LogEmMemoria('despachante'), 1)
    await comoAtivo(id)
    await perderNaFila(id)
    await envelhecer(id)

    // A consulta da atrasada termina (a fila não tem o job) e fica parada até o teste soltar.
    let soltar: () => void = () => undefined
    const solta = new Promise<void>((resolver) => (soltar = resolver))
    let consultou: () => void = () => undefined
    const consultada = new Promise<void>((resolver) => (consultou = resolver))
    const atrasada = reconciliacaoAParte('atrasada', (consultar) => async (job) => {
      const situacao = await consultar(job)
      consultou()
      await solta
      return situacao
    })
    const pontual = reconciliacaoAParte('pontual', (consultar) => consultar)
    try {
      const reconciliacaoAtrasada = atrasada.reconciliacao.reconciliar()
      await consultada

      expect((await pontual.reconciliacao.reconciliar()).republicados).toEqual([id])
      // O worker pega o job republicado: `ativo` de novo, com o `iniciado_em` do primeiro início.
      expect(await comoAtivo(id)).toMatchObject({ situacao: 'iniciado' })
      soltar()

      expect(await reconciliacaoAtrasada).toEqual({ conferidos: 1, republicados: [], falhasRegistradas: [], semConfirmacao: 0 })
      expect((await bancada.estado(id))?.estado).toBe('ativo')
      expect(atrasada.log.doEvento('job.republicado')).toEqual([])
      expect(pontual.log.doEvento('job.republicado')).toHaveLength(1)
    } finally {
      soltar()
      await atrasada.fechar()
      await pontual.fechar()
    }
  })

  describe('falha que a fila tem e a linha não', () => {
    it('Postgres fora na última tentativa: a fila tem o job falho, a linha ficou ativo, e a reconciliação a leva a falhou com o código do worker', async () => {
      const log = new LogEmMemoria('despachante')
      const requisicaoId = randomUUID()
      const id = await bancada.enfileirar(ESCOLA_A, {}, requisicaoId)
      await bancada.reservar(ESCOLA_A)
      // Uma tentativa só: esta é a última.
      await bancada.fila.add('sintetico', { escolaId: ESCOLA_A, requisicaoId }, { jobId: id, attempts: 1 })
      await runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, () => bancada.despacho.marcarPublicados([id]))

      const logWorker = new LogEmMemoria('worker')
      bancada.worker(logWorker, {
        processadores: {
          // O Postgres cai durante o job: o `falhou` que o worker grava no fim não chega ao banco.
          sintetico: async () => {
            await composeAssincronoOuFalha('stop', 'postgres')
            throw new FalhaDeJob(JobFailureCode.FALHA_SINTETICA)
          },
        },
      })
      await expect.poll(async () => (await bancada.fila.getJob(id))?.getState(), { timeout: 30_000, interval: 250 }).toBe('failed')
      expect(logWorker.doEvento('job.falha_nao_registrada').map((registro) => registro['jobId'])).toEqual([id])
      await composeAssincronoOuFalha('start', 'postgres')
      await aguardarSaudavel('postgres')
      await expect.poll(async () => (await bancada.estado(id).catch(() => undefined))?.estado, { timeout: 30_000, interval: 500 }).toBe('ativo')
      await envelhecer(id)

      const resultado = await bancada.despachante(log).reconciliacao.reconciliar()

      expect(resultado).toEqual({ conferidos: 1, republicados: [], falhasRegistradas: [id], semConfirmacao: 0 })
      expect(await bancada.estado(id)).toEqual({ estado: 'falhou', escolaId: ESCOLA_A, codigoFalha: JobFailureCode.FALHA_SINTETICA })
      expect(log.doEvento('job.falha_reconciliada')).toEqual([
        expect.objectContaining({ jobId: id, codigo: JobFailureCode.FALHA_SINTETICA, requisicaoId, escolaId: ESCOLA_A }),
      ])
      // Terminou: a próxima reconciliação não o vê mais.
      expect((await bancada.despachante(log).reconciliacao.reconciliar()).conferidos).toBe(0)
    }, 120_000)

    it('stalled acima do limite (motivo que não é código nosso) com a linha ativo, e job.data inválido com a linha publicado: falhou, com ERRO_INTERNO e DADOS_INVALIDOS', async () => {
      const log = new LogEmMemoria('despachante')
      const { ids: [stalled = '', comDadoInvalido = ''] } = await publicados(log, 2)
      // O que a fila tem para cada um é trocado pelo que o teste precisa.
      await perderNaFila(stalled, comDadoInvalido)
      // O worker que travou tinha marcado o job como ativo.
      await comoAtivo(stalled)

      // O BullMQ falha o job com esta mensagem quando ele trava mais vezes que o limite. Aqui ela vem
      // de um worker à parte, para não esperar dois ciclos de stalled de 30 s.
      const redisStalled = new Redis(urlRedisDeFila(), { maxRetriesPerRequest: null })
      const workerStalled = new Worker(bullmqQueueName('interativa', 'worker'), () => Promise.reject(new UnrecoverableError('job stalled more than allowable limit')), {
        connection: redisStalled,
        prefix: bancada.prefixo,
      })
      try {
        const travado = await bancada.fila.add('sintetico', { escolaId: ESCOLA_A, requisicaoId: null }, { jobId: stalled })
        await expect.poll(() => travado.getState(), { timeout: 15_000 }).toBe('failed')
      } finally {
        await workerStalled.close()
        await redisStalled.quit()
      }

      const invalido = await bancada.fila.add('sintetico', { escolaId: 'nao-e-uuid', requisicaoId: null }, { jobId: comDadoInvalido, attempts: 5 })
      bancada.worker(new LogEmMemoria('worker'))
      await expect.poll(() => invalido.getState(), { timeout: 15_000 }).toBe('failed')
      expect((await bancada.estado(stalled))?.estado).toBe('ativo')
      expect((await bancada.estado(comDadoInvalido))?.estado).toBe('publicado')

      await envelhecer(stalled, comDadoInvalido)
      // As vagas que a publicação tomou seguem com eles: nenhum worker terminou os dois para liberar.
      const chaveDaVaga = bancada.vagas.chave('interativa', ESCOLA_A)
      expect(await bancada.redis.zrange(chaveDaVaga, '0', '-1')).toEqual(expect.arrayContaining([stalled, comDadoInvalido]))
      const resultado = await bancada.despachante(log).reconciliacao.reconciliar()

      expect([...resultado.falhasRegistradas].sort()).toEqual([stalled, comDadoInvalido].sort())
      expect(await bancada.estado(stalled)).toEqual({ estado: 'falhou', escolaId: ESCOLA_A, codigoFalha: JobFailureCode.ERRO_INTERNO })
      expect(await bancada.estado(comDadoInvalido)).toEqual({ estado: 'falhou', escolaId: ESCOLA_A, codigoFalha: JobFailureCode.DADOS_INVALIDOS })
      // A falha reconciliada libera a vaga, em vez de deixá-la vencer em 60 s.
      expect(await bancada.redis.zrange(chaveDaVaga, '0', '-1')).toEqual([])
    }, 60_000)

    it('a falha da fila não muda job que já terminou: o worker lento concluiu antes de a falha ser gravada', async () => {
      const { ids: [id = ''] } = await publicados(new LogEmMemoria('despachante'), 1)
      await runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, async () => {
        await bancada.registro.iniciarExecucao(id)
        await bancada.registro.concluir(id)
      })

      expect(await bancada.despacho.registrarFalhaDaFila(id, JobFailureCode.ERRO_INTERNO)).toBe(false)
      expect(await bancada.estado(id)).toEqual({ estado: 'concluido', escolaId: ESCOLA_A, codigoFalha: null })
    })
  })

  describe('laço', () => {
    it('roda sozinha a cada intervalo, sem ninguém chamar', async () => {
      const log = new LogEmMemoria('despachante')
      const { ids: [id = ''] } = await publicados(log, 1)
      await perderNaFila(id)
      await envelhecer(id)
      bancada.despachante(log, { intervaloReconciliacaoMs: 300 }).reconciliacao.iniciar()
      await expect.poll(() => log.doEvento('job.republicado').map((registro) => registro['jobId']), { timeout: 5_000 }).toEqual([id])
    })

    it('com o Postgres fora, a reconciliação falha a cada volta sem derrubar o laço, e republica quando ele volta', async () => {
      const log = new LogEmMemoria('despachante')
      const { ids: [id = ''] } = await publicados(log, 1)
      await perderNaFila(id)
      await envelhecer(id)

      await composeAssincronoOuFalha('stop', 'postgres')
      try {
        bancada.despachante(log, { intervaloReconciliacaoMs: 300 }).reconciliacao.iniciar()
        await expect.poll(() => log.doEvento('reconciliacao.falhou').length, { timeout: 20_000, interval: 200 }).toBeGreaterThanOrEqual(3)
        expect(log.doEvento('job.republicado')).toEqual([])
      } finally {
        await composeAssincronoOuFalha('start', 'postgres')
        await aguardarSaudavel('postgres')
      }
      await expect.poll(() => log.doEvento('job.republicado').map((registro) => registro['jobId']), { timeout: 30_000, interval: 200 }).toEqual([id])
    }, 90_000)
  })
})
