import 'reflect-metadata'
import {
  runInContext,
  METRICS,
  bullmqQueueName,
  jobOptions,
  RETENCAO_JOB_CONCLUIDO_SEGUNDOS,
  RETENCAO_JOB_FALHO_SEGUNDOS,
  JobRejectionReason,
  JobRequestRejectedError,
  summarizeError,
  type RequestContext,
  type IdempotencyKeyResult,
  type DatabaseTransaction,
} from '@educa/core'
import {
  ErrorCode,
  JobFailureCode,
  TIPO_CONSOLIDAR_USO,
  TIPO_ELIMINAR_TITULAR,
  TIPO_EXPURGAR_ACESSO,
  TIPO_EXPURGAR_DADO_PESSOAL,
  TIPO_EXPURGAR_ESCOLA,
  TIPO_EXPURGAR_JOBS,
  TIPO_JOB_SINTETICO,
  TIPO_MONTAR_ARQUIVO,
} from '@educa/shared'
import { Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { aguardarSaudavel, compose, composeAssincronoOuFalha, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { QueueFixtures, InMemoryLog, urlRedisDeFila } from './queue.fixture.js'

// Despachantes e workers de verdade (a mesma montagem do main.ts), no processo do teste, contra o
// Postgres e o Redis de fila do compose de teste. Cada bancada usa um prefixo próprio no BullMQ.

async function aguardarEstado(bancada: QueueFixtures, id: string, estado: string, limiteMs = 30_000): Promise<void> {
  await expect.poll(async () => (await bancada.estado(id))?.estado, { timeout: limiteMs, interval: 100 }).toBe(estado)
}

beforeAll(() => {
  // Despachante ou worker do compose de pé disputaria as linhas com os deste arquivo.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('dois despachantes e dois workers sobre a mesma fila', () => {
  let bancada: QueueFixtures
  // Escolas reais, criadas a cada caso: desde a tarefa 3.0 `job_registro` e
  // `configuracao_operacional_escola` têm FK para `escola`, e id inventado é recusado pelo banco.
  let ESCOLA_A: string
  let ESCOLA_B: string

  beforeEach(async () => {
    bancada = new QueueFixtures()
    await bancada.limparRegistro()
    ;[ESCOLA_A, ESCOLA_B] = await Promise.all([bancada.escola(), bancada.escola()])
  })

  afterEach(async () => {
    await bancada.fechar()
  })

  it('500 jobs: cada um é reservado e publicado por um despachante só, e, sem falha nem queda, inicia uma vez', async () => {
    const ids = new Set<string>()
    for (let lote = 0; lote < 5; lote++) {
      const criados = await Promise.all(
        Array.from({ length: 100 }, (_, indice) => bancada.enfileirar(indice % 2 === 0 ? ESCOLA_A : ESCOLA_B)),
      )
      for (const id of criados) ids.add(id)
    }
    expect(ids.size).toBe(500)

    const logs = { d1: new InMemoryLog('despachante-1'), d2: new InMemoryLog('despachante-2'), w1: new InMemoryLog('worker-1'), w2: new InMemoryLog('worker-2') }
    const trabalhadores = [bancada.worker(logs.w1, { concorrencia: 10 }), bancada.worker(logs.w2, { concorrencia: 10 })]
    const despachantes = [bancada.despachante(logs.d1), bancada.despachante(logs.d2)]
    // Os dois partem juntos sobre as mesmas 500 linhas: é a disputa que o SKIP LOCKED e a troca condicional resolvem.
    for (const { despachante } of despachantes) despachante.iniciar()

    await expect
      .poll(async () => {
        const { rows } = await bancada.pool.query<{ total: string }>(`select count(*) as total from job_registro where estado = 'concluido'`)
        return Number(rows[0]?.total)
      }, { timeout: 60_000, interval: 250 })
      .toBe(500)
    await Promise.all(despachantes.map((montado) => montado.encerrar()))
    await Promise.all(trabalhadores.map((montado) => montado.encerrar()))

    const publicadosPor = (log: InMemoryLog) => log.doEvento('job.publicado').map((registro) => String(registro['jobId']))
    const publicados1 = publicadosPor(logs.d1)
    const publicados2 = publicadosPor(logs.d2)
    // A disputa aconteceu de verdade: os dois publicaram, e nenhuma rodada falhou calada.
    expect(publicados1.length).toBeGreaterThan(0)
    expect(publicados2.length).toBeGreaterThan(0)
    expect([...logs.d1.doEvento('despachante.rodada_falhou'), ...logs.d2.doEvento('despachante.rodada_falhou')]).toEqual([])
    expect(publicados1.filter((id) => publicados2.includes(id))).toEqual([])
    expect(new Set([...publicados1, ...publicados2])).toEqual(ids)
    expect(publicados1.length + publicados2.length).toBe(500)

    // Uma reserva por job, e nenhuma queda no caminho: cada um inicia uma vez. Com queda, a entrega é pelo menos uma
    // vez (D49), e a reexecução tem teste próprio (job-reexecution.int.test.ts).
    const execucoes = new Map<string, number>()
    for (const registro of [...logs.w1.doEvento('job.iniciado'), ...logs.w2.doEvento('job.iniciado')]) {
      const id = String(registro['jobId'])
      execucoes.set(id, (execucoes.get(id) ?? 0) + 1)
    }
    expect(execucoes.size).toBe(500)
    expect([...execucoes.values()].filter((vezes) => vezes !== 1)).toEqual([])
  }, 120_000)

  it('o worker restaura escola e requisição do job: toda linha do despachante e do worker sobre ele leva o requisicaoId de quem pediu', async () => {
    const requisicaoId = randomUUID()
    const id = await bancada.enfileirar(ESCOLA_B, {}, requisicaoId)
    const logDespachante = new InMemoryLog('despachante')
    const logWorker = new InMemoryLog('worker')
    const { workers } = bancada.worker(logWorker)
    bancada.despachante(logDespachante).despachante.iniciar()
    await aguardarEstado(bancada, id, 'concluido')
    // O BullMQ guarda o concluído por 1 dia e o falho por 7: é o que ainda deduplica um reenvio.
    for (const worker of workers.values()) {
      expect(worker.opts.removeOnComplete).toEqual({ age: RETENCAO_JOB_CONCLUIDO_SEGUNDOS })
      expect(worker.opts.removeOnFail).toEqual({ age: RETENCAO_JOB_FALHO_SEGUNDOS })
    }

    const sobreOJob = [...logDespachante.registros(), ...logWorker.registros()].filter((registro) => registro['jobId'] === id)
    expect(sobreOJob.map((registro) => registro['evento'])).toEqual(['job.publicado', 'job.iniciado', 'job.concluido'])
    for (const registro of sobreOJob) expect(registro).toMatchObject({ requisicaoId, escolaId: ESCOLA_B })
  })

  it('falha permanente: 5 tentativas com recuo e depois falhou, com a escola e o código tipado', async () => {
    const id = await bancada.enfileirar(ESCOLA_A, { dados: { cpuMs: 0, falhar: true } })
    const logWorker = new InMemoryLog('worker')
    bancada.worker(logWorker)
    const inicio = performance.now()
    bancada.despachante(new InMemoryLog('despachante')).despachante.iniciar()

    await aguardarEstado(bancada, id, 'falhou', 60_000)
    // Recuo exponencial de 2 s com jitter de 50 %: as quatro esperas somam pelo menos 15 s.
    expect(performance.now() - inicio).toBeGreaterThan(15_000)
    expect(await bancada.estado(id)).toEqual({ estado: 'falhou', escolaId: ESCOLA_A, codigoFalha: JobFailureCode.FALHA_SINTETICA })
    expect(logWorker.doEvento('job.iniciado').filter((registro) => registro['jobId'] === id)).toHaveLength(5)

    const naFila = await bancada.fila.getJob(id)
    expect(naFila?.attemptsMade).toBe(5)
    expect(naFila?.failedReason).toBe(JobFailureCode.FALHA_SINTETICA)
    expect(await naFila?.getState()).toBe('failed')
  }, 90_000)

  it('erro inesperado com valor de campo na mensagem: nem o Redis nem o log recebem o texto, só o código', async () => {
    const id = await bancada.enfileirar(ESCOLA_A)
    const logWorker = new InMemoryLog('worker')
    const processadores = {
      sintetico: () => Promise.reject(new Error('Key (nome)=(Enzo Martins) already exists')),
    }
    bancada.worker(logWorker, { processadores })
    // Publicado como o despachante faz, com duas tentativas e sem recuo: passa pela falha intermediária e pela definitiva.
    await bancada.reservar(ESCOLA_A)
    await bancada.fila.add('sintetico', { escolaId: ESCOLA_A, requisicaoId: null }, { jobId: id, attempts: 2 })

    await aguardarEstado(bancada, id, 'falhou')
    expect((await bancada.estado(id))?.codigoFalha).toBe(JobFailureCode.ERRO_INTERNO)
    const naFila = await bancada.fila.getJob(id)
    expect(naFila?.attemptsMade).toBe(2)
    expect(naFila?.failedReason).toBe(JobFailureCode.ERRO_INTERNO)
    expect(naFila?.stacktrace).toHaveLength(2)
    expect(JSON.stringify(naFila?.stacktrace)).not.toContain('Enzo')
    expect(logWorker.linhas.join('')).not.toContain('Enzo')
  })

  it('escrita tardia: marcar publicado depois de o worker concluir não tira o job de concluido', async () => {
    const id = await bancada.enfileirar(ESCOLA_A)
    const [reservado] = await bancada.reservar(ESCOLA_A)
    expect(reservado?.id).toBe(id)

    // O worker pega o job antes de o despachante gravar `publicado`, e termina.
    await runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, async () => {
      expect((await bancada.registro.iniciarExecucao(id)).situacao).toBe('iniciado')
      // Ainda ativo: a escrita tardia também não o rebaixa.
      expect(await bancada.despacho.marcarPublicados([id])).toBe(0)
      expect((await bancada.estado(id))?.estado).toBe('ativo')
      expect(await bancada.registro.concluir(id)).toBe(true)
    })

    expect(await runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, () => bancada.despacho.marcarPublicados([id]))).toBe(0)
    expect((await bancada.estado(id))?.estado).toBe('concluido')
    // Concluido não volta a reservado nem a ativo, nem com a reserva antiga vencida.
    await bancada.pool.query(`update job_registro set reservado_ate = now() - interval '1 minute' where id = $1`, [id])
    expect(await bancada.reservar(ESCOLA_A)).toEqual([])
    await runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, async () => {
      expect((await bancada.registro.iniciarExecucao(id)).situacao).toBe('nao_executavel')
      expect(await bancada.registro.registrarFalha(id, JobFailureCode.ERRO_INTERNO)).toBe(false)
    })
    expect((await bancada.estado(id))?.estado).toBe('concluido')
  })

  it('reserva vencida volta a ser reservada, mas job ativo com reserva vencida não', async () => {
    const parado = await bancada.enfileirar(ESCOLA_A)
    const emExecucao = await bancada.enfileirar(ESCOLA_A)
    expect((await bancada.reservar(ESCOLA_A)).map((job) => job.id).sort()).toEqual([parado, emExecucao].sort())
    // Antes de vencer, ninguém mais pega.
    expect(await bancada.reservar(ESCOLA_A)).toEqual([])

    await runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, () => bancada.registro.iniciarExecucao(emExecucao))
    // O despachante que reservou caiu antes de publicar: a reserva vence.
    await bancada.pool.query(`update job_registro set reservado_ate = now() - interval '1 second'`)

    expect((await bancada.reservar(ESCOLA_A)).map((job) => job.id)).toEqual([parado])
    expect((await bancada.estado(emExecucao))?.estado).toBe('ativo')
  })

  it('o mesmo job entregue de novo pela fila depois de concluído não roda outra vez', async () => {
    const id = await bancada.enfileirar(ESCOLA_A)
    const logWorker = new InMemoryLog('worker')
    bancada.worker(logWorker)
    bancada.despachante(new InMemoryLog('despachante')).despachante.iniciar()
    await aguardarEstado(bancada, id, 'concluido')

    // A fila perdeu o job e ele foi publicado de novo, com o mesmo id.
    await (await bancada.fila.getJob(id))?.remove()
    const reentregue = await bancada.fila.add('sintetico', { escolaId: ESCOLA_A, requisicaoId: null }, { jobId: id })
    await expect.poll(() => reentregue.getState(), { timeout: 10_000 }).toBe('completed')

    expect(logWorker.doEvento('job.iniciado').filter((registro) => registro['jobId'] === id)).toHaveLength(1)
    expect(logWorker.doEvento('job.ja_finalizado').filter((registro) => registro['jobId'] === id)).toHaveLength(1)
  })

  describe('isolamento no worker', () => {
    it('job da fila com a escola A, ou sem escola, apontando para a linha da B não roda, e dá o mesmo resultado de um id inexistente', async () => {
      const daEscolaB = await bancada.enfileirar(ESCOLA_B)
      const outraDaEscolaB = await bancada.enfileirar(ESCOLA_B)
      await bancada.reservar(ESCOLA_B)
      const logWorker = new InMemoryLog('worker')
      bancada.worker(logWorker)
      const inexistente = randomUUID()

      // Com as opções de publicação de verdade (5 tentativas): nenhuma tentativa a mais é gasta.
      const publicar = (jobId: string, escolaId: string | null) =>
        bancada.fila.add('sintetico', { escolaId, requisicaoId: null }, { ...jobOptions(TIPO_JOB_SINTETICO), jobId })
      const jobs = [
        await publicar(daEscolaB, ESCOLA_A),
        // Sem escola, o contexto é de rotina do sistema, que só alcança job sem escola.
        await publicar(outraDaEscolaB, null),
        await publicar(inexistente, ESCOLA_A),
      ]
      for (const job of jobs) await expect.poll(() => job.getState(), { timeout: 10_000 }).toBe('failed')

      const naFila = await Promise.all([daEscolaB, outraDaEscolaB, inexistente].map((id) => bancada.fila.getJob(id)))
      for (const job of naFila) {
        expect(job?.failedReason).toBe(ErrorCode.NAO_ENCONTRADO)
        expect(job?.attemptsMade).toBe(1)
      }

      const eventos = (id: string) => logWorker.registros().filter((registro) => registro['jobId'] === id).map((registro) => registro['evento'])
      expect(eventos(inexistente)).toEqual(['job.nao_encontrado'])
      expect(eventos(daEscolaB)).toEqual(eventos(inexistente))
      expect(eventos(outraDaEscolaB)).toEqual(eventos(inexistente))
      // As linhas da escola B continuam intocadas.
      expect(await bancada.estado(daEscolaB)).toEqual({ estado: 'reservado', escolaId: ESCOLA_B, codigoFalha: null })
      expect(await bancada.estado(outraDaEscolaB)).toEqual({ estado: 'reservado', escolaId: ESCOLA_B, codigoFalha: null })
    })

    it('contexto sem escola e sem a marca de rotina do sistema (rota anônima) não alcança job nenhum', async () => {
      const daEscolaA = await bancada.enfileirar(ESCOLA_A)
      await bancada.reservar(ESCOLA_A)
      await expect(runInContext({ requisicaoId: randomUUID() }, () => bancada.registro.iniciarExecucao(daEscolaA))).rejects.toThrow(
        'não tem escopo',
      )
      expect((await bancada.estado(daEscolaA))?.estado).toBe('reservado')
    })
  })

  describe('enfileirar', () => {
    const contar = async () => Number((await bancada.pool.query<{ total: string }>('select count(*) as total from job_registro')).rows[0]?.total)
    const naEscola = (escolaId: string, fazer: (tx: DatabaseTransaction) => Promise<unknown>) =>
      runInContext({ requisicaoId: randomUUID(), escolaId }, () => bancada.banco.transaction((tx) => fazer(tx)))
    /** A recusa do `JobOutbox`, com o motivo, ou falha o teste: outro erro (o do banco, por exemplo) não vale. */
    const recusa = async (pedido: Promise<unknown>): Promise<JobRequestRejectedError> => {
      const erro = await pedido.then(
        () => undefined,
        (falha: unknown) => falha,
      )
      if (!(erro instanceof JobRequestRejectedError)) throw new Error('o pedido devia ter sido recusado pela definição do tipo')
      return erro
    }

    it('o job é gravado na transação de quem pede: se ela desfaz, não sobra linha nem publicação', async () => {
      const logDespachante = new InMemoryLog('despachante')
      bancada.despachante(logDespachante).despachante.iniciar()
      await expect(
        runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, () =>
          bancada.banco.transaction(async (tx) => {
            await bancada.enfileirador.enfileirar(tx, TIPO_JOB_SINTETICO, { cpuMs: 0, falhar: false }, { fila: 'normal', naoUrgente: false })
            throw new Error('o que originou o job não foi gravado')
          }),
        ),
      ).rejects.toThrow('o que originou o job não foi gravado')

      await new Promise((resolver) => setTimeout(resolver, 1_000))
      expect(await contar()).toBe(0)
      expect(logDespachante.doEvento('job.publicado')).toEqual([])
    })

    // Caracterização (18.1): o que cada um dos 8 tipos grava, escrita contra o `enfileirar` anterior, com a chamada no formato
    // dele, e verde com ele. O que se afirma é a linha de `job_registro`, e só a chamada de cada caso mudou na migração.
    it('caracterização: cada um dos 8 tipos grava a fila, o não urgente, a prioridade e o escopo de hoje', async () => {
      const primeiroGravado = async (resultado: Promise<IdempotencyKeyResult>): Promise<string> => {
        const lido = await resultado
        if (lido.situacao !== 'enfileirado') throw new Error('a chave já tinha job')
        return lido.id
      }
      const pedidoId = randomUUID()
      const doSistema = { requisicaoId: randomUUID(), rotinaDoSistema: true as const }
      const daEscola = { requisicaoId: randomUUID(), escolaId: ESCOLA_A }
      const nada = { fila: 'lote', prioridade: 3, naoUrgente: true, dados: {} }
      const casos = [
        { tipo: 'titular.montar-arquivo', contexto: daEscola, esperado: { fila: 'normal', prioridade: 2, naoUrgente: false, dados: { pedidoId } }, enfileirar: (tx: DatabaseTransaction) => bancada.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, { pedidoId }) },
        { tipo: 'titular.eliminar', contexto: daEscola, esperado: { fila: 'lote', prioridade: 3, naoUrgente: true, dados: { pedidoId } }, enfileirar: (tx: DatabaseTransaction) => primeiroGravado(bancada.enfileirador.enfileirarUmaVez(tx, TIPO_ELIMINAR_TITULAR, { pedidoId }, `eliminacao:${pedidoId}`)) },
        { tipo: 'retencao.expurgar-escola', contexto: daEscola, esperado: nada, enfileirar: (tx: DatabaseTransaction) => primeiroGravado(bancada.enfileirador.enfileirarUmaVez(tx, TIPO_EXPURGAR_ESCOLA, {}, 'noite')) },
        { tipo: 'sistema.consolidar-uso', contexto: doSistema, esperado: nada, enfileirar: (tx: DatabaseTransaction) => bancada.enfileirador.enfileirar(tx, TIPO_CONSOLIDAR_USO, {}) },
        { tipo: 'sistema.expurgar-acesso', contexto: doSistema, esperado: nada, enfileirar: (tx: DatabaseTransaction) => bancada.enfileirador.enfileirar(tx, TIPO_EXPURGAR_ACESSO, {}) },
        { tipo: 'sistema.expurgar-jobs', contexto: doSistema, esperado: nada, enfileirar: (tx: DatabaseTransaction) => bancada.enfileirador.enfileirar(tx, TIPO_EXPURGAR_JOBS, {}) },
        { tipo: 'sistema.expurgar-dado-pessoal', contexto: doSistema, esperado: nada, enfileirar: (tx: DatabaseTransaction) => bancada.enfileirador.enfileirar(tx, TIPO_EXPURGAR_DADO_PESSOAL, {}) },
        // O sintético é o único em que a fila e o não urgente vêm do corpo do `POST`: aqui, as três filas.
        ...(['interativa', 'normal', 'lote'] as const).map((fila) => ({
          tipo: 'sintetico',
          contexto: daEscola,
          esperado: { fila, prioridade: { interativa: 1, normal: 2, lote: 3 }[fila], naoUrgente: fila === 'lote', dados: { cpuMs: 5, falhar: false } },
          enfileirar: (tx: DatabaseTransaction) => bancada.enfileirador.enfileirar(tx, TIPO_JOB_SINTETICO, { cpuMs: 5, falhar: false }, { fila, naoUrgente: fila === 'lote' }),
        })),
      ]
      for (const caso of casos) {
        const id = await runInContext(caso.contexto, () => bancada.banco.transaction((tx) => caso.enfileirar(tx)))
        const { rows } = await bancada.pool.query<{ tipo: string; fila: string; prioridade: number; naoUrgente: boolean; escolaId: string | null; dados: unknown }>(
          'select tipo, fila, prioridade, nao_urgente as "naoUrgente", escola_id as "escolaId", dados from job_registro where id = $1',
          [id],
        )
        expect(rows[0], `${caso.tipo} / ${caso.esperado.fila}`).toEqual({ tipo: caso.tipo, ...caso.esperado, escolaId: caso.tipo.startsWith('sistema.') ? null : ESCOLA_A })
      }
    })

    it('a fila vem do pedido só dentro das filas do tipo: com o tipo de uma fila só, a outra é recusada, sem linha', async () => {
      const pedidoId = randomUUID()
      // @ts-expect-error o titular.montar-arquivo só nasce na fila normal
      const naLote = naEscola(ESCOLA_A, (tx) => bancada.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, { pedidoId }, { fila: 'lote' }))
      expect((await recusa(naLote)).motivo).toBe(JobRejectionReason.FILA_FORA_DA_DEFINICAO)
      // @ts-expect-error o titular.eliminar só nasce na fila de lote
      const naNormal = naEscola(ESCOLA_A, (tx) => bancada.enfileirador.enfileirarUmaVez(tx, TIPO_ELIMINAR_TITULAR, { pedidoId }, 'chave', { fila: 'normal' }))
      expect((await recusa(naNormal)).motivo).toBe(JobRejectionReason.FILA_FORA_DA_DEFINICAO)
      expect(await contar()).toBe(0)
    })

    it('o não urgente de quem pede só vale onde a definição o deixa: nos outros tipos é recusado, tenha o valor que tiver', async () => {
      const pedidoId = randomUUID()
      const motivos = await Promise.all([
        // @ts-expect-error o titular.montar-arquivo fixa o não urgente em `false`
        recusa(naEscola(ESCOLA_A, (tx) => bancada.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, { pedidoId }, { naoUrgente: true }))),
        // @ts-expect-error nem o mesmo valor da definição se escolhe
        recusa(naEscola(ESCOLA_A, (tx) => bancada.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, { pedidoId }, { naoUrgente: false }))),
        // @ts-expect-error o titular.eliminar fixa o não urgente em `true`
        recusa(naEscola(ESCOLA_A, (tx) => bancada.enfileirador.enfileirarUmaVez(tx, TIPO_ELIMINAR_TITULAR, { pedidoId }, 'chave', { naoUrgente: false }))),
      ])
      expect(motivos.map(({ motivo }) => motivo)).toEqual(Array(3).fill(JobRejectionReason.NAO_URGENTE_FIXO))
      expect(await contar()).toBe(0)
    })

    it('o tipo que deixa o não urgente com quem pede o exige: sem as opções, ou sem o campo nelas, é recusado', async () => {
      const dados = { cpuMs: 0, falhar: false }
      const motivos = await Promise.all([
        // @ts-expect-error o sintético exige as opções
        recusa(naEscola(ESCOLA_A, (tx) => bancada.enfileirador.enfileirar(tx, TIPO_JOB_SINTETICO, dados))),
        // @ts-expect-error o sintético exige o não urgente nas opções
        recusa(naEscola(ESCOLA_A, (tx) => bancada.enfileirador.enfileirar(tx, TIPO_JOB_SINTETICO, dados, { fila: 'lote' }))),
      ])
      expect(motivos.map(({ motivo }) => motivo)).toEqual(Array(2).fill(JobRejectionReason.NAO_URGENTE_AUSENTE))
      expect(await contar()).toBe(0)
    })

    it('chave a mais no payload é recusada antes de gravar', async () => {
      // @ts-expect-error o payload do titular.montar-arquivo é só o pedidoId
      const comSobra = naEscola(ESCOLA_A, (tx) => bancada.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, { pedidoId: randomUUID(), tema: 'x' }))
      expect((await recusa(comSobra)).motivo).toBe(JobRejectionReason.DADOS_INVALIDOS)
      expect(await contar()).toBe(0)
    })

    it('campo obrigatório ausente é recusado antes de gravar', async () => {
      // @ts-expect-error falta o pedidoId
      const semPedido = naEscola(ESCOLA_A, (tx) => bancada.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, {}))
      expect((await recusa(semPedido)).motivo).toBe(JobRejectionReason.DADOS_INVALIDOS)
      expect(await contar()).toBe(0)
    })

    it('o pedidoId que não é um uuid é recusado antes de gravar', async () => {
      const naoUuid = naEscola(ESCOLA_A, (tx) => bancada.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, { pedidoId: 'abc' }))
      expect((await recusa(naoUuid)).motivo).toBe(JobRejectionReason.DADOS_INVALIDOS)
      expect(await contar()).toBe(0)
    })

    it('a recusa chega como promessa rejeitada, e não como exceção na chamada: quem engole com `.catch` a engole de verdade', async () => {
      await naEscola(ESCOLA_A, async (tx) => {
        const chamadas = [
          () => bancada.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, { pedidoId: 'abc' }),
          () => bancada.enfileirador.enfileirarUmaVez(tx, TIPO_ELIMINAR_TITULAR, { pedidoId: 'abc' }, 'eliminacao:abc'),
        ]
        for (const chamar of chamadas) {
          let pedido: Promise<unknown> | undefined
          expect(() => {
            pedido = chamar()
          }).not.toThrow()
          expect((await recusa(pedido ?? Promise.resolve())).motivo).toBe(JobRejectionReason.DADOS_INVALIDOS)
          await expect(chamar().catch(() => undefined)).resolves.toBeUndefined()
        }
      })
      expect(await contar()).toBe(0)
    })

    it('o escolaId de outra escola no payload é recusado: a escola do job é só a do contexto', async () => {
      // @ts-expect-error o payload não tem escolaId
      const deOutraEscola = naEscola(ESCOLA_A, (tx) => bancada.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, { pedidoId: randomUUID(), escolaId: ESCOLA_B }))
      expect((await recusa(deOutraEscola)).motivo).toBe(JobRejectionReason.DADOS_INVALIDOS)
      expect(await contar()).toBe(0)
    })

    it('a recusa não leva o valor nem as issues: nem na mensagem, nem no que o log escreve do erro', async () => {
      const sentinela = `sentinela-${randomUUID()}`
      const erro = await recusa(naEscola(ESCOLA_A, (tx) => bancada.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, { pedidoId: randomUUID(), [sentinela]: sentinela })))
      const dito = [erro.message, String(erro), JSON.stringify(erro), JSON.stringify(summarizeError(erro)), erro.stack?.split('\n')[0] ?? '']
      for (const texto of dito) expect(texto).not.toContain(sentinela)
      expect(Object.keys(erro).sort()).toEqual(['motivo', 'name', 'tipo'])
      expect(erro.cause).toBeUndefined()
      expect(erro.message).toBe('pedido de job recusado: titular.montar-arquivo (DADOS_INVALIDOS)')
    })

    it('tipo e opções que a definição aceita compilam; o que ela não descreve não compila', () => {
      // O que não compila não chega ao banco: o compilador é o teste, e cada linha abaixo precisa do seu `@ts-expect-error`.
      const naoChamada = (tx: DatabaseTransaction) => [
        // @ts-expect-error tipo que não está em JOB_DEFINITIONS
        bancada.enfileirador.enfileirar(tx, 'tipo.inexistente', {}),
        // @ts-expect-error os dados são os de outro tipo
        bancada.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, { cpuMs: 0, falhar: false }),
        // @ts-expect-error a fila fora das filas do tipo
        bancada.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, { pedidoId: 'x' }, { fila: 'interativa' }),
      ]
      expect(naoChamada).toBeTypeOf('function')
    })

    it('job de escola sem escola no contexto, e job de sistema vindo de escola ou de rota anônima, são recusados antes de gravar', async () => {
      const tentarDeEscola = (contexto: RequestContext) =>
        runInContext(contexto, () => bancada.banco.transaction((tx) => bancada.enfileirador.enfileirar(tx, TIPO_JOB_SINTETICO, { cpuMs: 0, falhar: false }, { fila: 'lote', naoUrgente: true })))
      const tentarDoSistema = (contexto: RequestContext) =>
        runInContext(contexto, () => bancada.banco.transaction((tx) => bancada.enfileirador.enfileirar(tx, TIPO_EXPURGAR_JOBS, {})))

      await expect(tentarDeEscola({ requisicaoId: randomUUID() })).rejects.toThrow('job de escola sem escola no contexto')
      await expect(tentarDoSistema({ requisicaoId: randomUUID(), escolaId: ESCOLA_A })).rejects.toThrow('job de sistema só nasce de rotina do sistema')
      await expect(tentarDoSistema({ requisicaoId: randomUUID() })).rejects.toThrow('job de sistema só nasce de rotina do sistema')
      expect(await contar()).toBe(0)

      const doSistema = await tentarDoSistema({ requisicaoId: randomUUID(), rotinaDoSistema: true })
      expect(await bancada.estado(doSistema)).toEqual({ estado: 'aguardando', escolaId: null, codigoFalha: null })
    })
  })

  describe('o worker valida pela definição (a linha de `job_registro` não é confiável)', () => {
    /** Grava a linha por SQL, como quem não passou pelo `JobOutbox`: sem esquema, sem escopo, sem conferir o tipo. */
    const gravarPorSql = async (tipo: string, escolaId: string | null, dados: object): Promise<string> => {
      const { rows } = await bancada.pool.query<{ id: string }>(
        `insert into job_registro (escola_id, fila, prioridade, tipo, dados) values ($1, 'interativa', 1, $2, $3) returning id`,
        [escolaId, tipo, JSON.stringify(dados)],
      )
      await bancada.pool.query(`select pg_notify('job', '')`)
      return rows[0]?.id ?? ''
    }

    it('dados que o esquema recusa terminam falhou com DADOS_INVALIDOS na primeira tentativa, sem o processador, e nem o log nem o Redis levam o valor', async () => {
      const sentinela = `sentinela-${randomUUID()}`
      const chaveAMais = await gravarPorSql(TIPO_JOB_SINTETICO, ESCOLA_A, { cpuMs: 0, falhar: false, [sentinela]: sentinela })
      const foraDoFormato = await gravarPorSql(TIPO_JOB_SINTETICO, ESCOLA_A, { cpuMs: -1, falhar: false })
      const chamados: string[] = []
      const logWorker = new InMemoryLog('worker')
      bancada.worker(logWorker, { processadores: { [TIPO_JOB_SINTETICO]: () => Promise.resolve(void chamados.push('chamado')) } })
      bancada.despachante(new InMemoryLog('despachante')).despachante.iniciar()

      for (const id of [chaveAMais, foraDoFormato]) {
        await aguardarEstado(bancada, id, 'falhou')
        expect(await bancada.estado(id)).toEqual({ estado: 'falhou', escolaId: ESCOLA_A, codigoFalha: JobFailureCode.DADOS_INVALIDOS })
        const naFila = await bancada.fila.getJob(id)
        // Definitivo: as cinco tentativas não são gastas, e o que o Redis guarda é o código, e só ele.
        expect(naFila?.attemptsMade).toBe(1)
        expect(naFila?.failedReason).toBe(JobFailureCode.DADOS_INVALIDOS)
        expect(JSON.stringify(naFila?.stacktrace)).not.toContain(sentinela)
        const eventos = logWorker.registros().filter((registro) => registro['jobId'] === id)
        expect(eventos.map((registro) => registro['evento'])).toEqual(['job.iniciado', 'job.tentativa_falhou', 'job.falhou'])
        expect(eventos[1]).toMatchObject({ tentativa: 1, codigo: JobFailureCode.DADOS_INVALIDOS })
      }
      expect(chamados).toEqual([])
      expect(logWorker.linhas.join('')).not.toContain(sentinela)
    })

    it('tipo que o registro não tem (uma linha de outra versão) termina falhou com TIPO_DESCONHECIDO, definitivo', async () => {
      const id = await gravarPorSql('tipo.de-uma-versao-antiga', ESCOLA_A, { qualquer: 'coisa' })
      bancada.worker(new InMemoryLog('worker'))
      bancada.despachante(new InMemoryLog('despachante')).despachante.iniciar()

      await aguardarEstado(bancada, id, 'falhou')
      expect(await bancada.estado(id)).toEqual({ estado: 'falhou', escolaId: ESCOLA_A, codigoFalha: JobFailureCode.TIPO_DESCONHECIDO })
      expect((await bancada.fila.getJob(id))?.attemptsMade).toBe(1)
    })

    it('rotina do sistema com escola (a linha foi escrita por SQL; o check do banco a aceita) não roda, e o dado da escola fica como está', async () => {
      const id = await gravarPorSql(TIPO_EXPURGAR_JOBS, ESCOLA_A, {})
      const chamados: string[] = []
      bancada.worker(new InMemoryLog('worker'), { processadores: { [TIPO_EXPURGAR_JOBS]: () => Promise.resolve(void chamados.push('chamado')) } })
      bancada.despachante(new InMemoryLog('despachante')).despachante.iniciar()

      await aguardarEstado(bancada, id, 'falhou')
      expect(await bancada.estado(id)).toEqual({ estado: 'falhou', escolaId: ESCOLA_A, codigoFalha: JobFailureCode.DADOS_INVALIDOS })
      expect(chamados).toEqual([])
    })
  })

  it('o aviso do NOTIFY acorda o despachante sem esperar a sondagem', async () => {
    const logDespachante = new InMemoryLog('despachante')
    // Sondagem de um minuto: só o aviso explica a publicação em segundos.
    bancada.despachante(logDespachante, { intervaloMs: 60_000 }).despachante.iniciar()
    // A primeira rodada (que abre o LISTEN) já passou, e o laço dorme a sondagem inteira.
    await new Promise((resolver) => setTimeout(resolver, 1_500))

    const id = await bancada.enfileirar(ESCOLA_A)
    await expect.poll(() => logDespachante.doEvento('job.publicado').map((registro) => registro['jobId']), { timeout: 5_000 }).toEqual([id])
  })

  it('despachante que caiu entre publicar e marcar: o job é publicado de novo com o mesmo id, a fila não o duplica, e ele inicia uma vez', async () => {
    const id = await bancada.enfileirar(ESCOLA_A)
    // Primeiro despachante: reserva e publica, e cai antes de marcar `publicado`.
    await bancada.reservar(ESCOLA_A)
    await bancada.fila.add('sintetico', { escolaId: ESCOLA_A, requisicaoId: null }, { ...jobOptions(TIPO_JOB_SINTETICO), jobId: id })
    await bancada.pool.query(`update job_registro set reservado_ate = now() - interval '1 second' where id = $1`, [id])

    const logDespachante = new InMemoryLog('despachante')
    bancada.despachante(logDespachante).despachante.iniciar()
    await expect.poll(() => logDespachante.doEvento('job.publicado').map((registro) => registro['jobId']), { timeout: 5_000 }).toEqual([id])
    expect((await bancada.estado(id))?.estado).toBe('publicado')

    const logWorker = new InMemoryLog('worker')
    bancada.worker(logWorker)
    await aguardarEstado(bancada, id, 'concluido')
    await new Promise((resolver) => setTimeout(resolver, 1_000))
    expect(logWorker.doEvento('job.iniciado').filter((registro) => registro['jobId'] === id)).toHaveLength(1)
    expect(await bancada.fila.getJobCounts('completed', 'waiting', 'active', 'delayed', 'failed')).toEqual({ completed: 1, waiting: 0, active: 0, delayed: 0, failed: 0 })
  })
  describe('dependência fora e desligamento', () => {
    /** Publica como o despachante, com as opções de retentativa de verdade, ou com mais tentativas. */
    async function publicado(tentativas = 5, escolaId = ESCOLA_A): Promise<string> {
      const id = await bancada.enfileirar(escolaId)
      await bancada.reservar(escolaId)
      await bancada.fila.add('sintetico', { escolaId, requisicaoId: null }, { ...jobOptions(TIPO_JOB_SINTETICO), attempts: tentativas, jobId: id })
      await runInContext({ requisicaoId: randomUUID(), escolaId }, () => bancada.despacho.marcarPublicados([id]))
      return id
    }

    it('Postgres fora na troca para ativo: a tentativa conta sem executar, e com o Postgres de volta o job executa uma vez e conclui', async () => {
      // Tentativas de sobra: com o recuo sorteado para baixo, as cinco de verdade podem acabar antes de o Postgres ficar saudável.
      const id = await publicado(10)
      const logWorker = new InMemoryLog('worker')
      await composeAssincronoOuFalha('stop', 'postgres')
      try {
        bancada.worker(logWorker)
        await expect.poll(() => logWorker.doEvento('job.estado_nao_gravado').length, { timeout: 15_000, interval: 100 }).toBeGreaterThan(0)
        expect(logWorker.doEvento('job.iniciado')).toEqual([])
      } finally {
        await composeAssincronoOuFalha('start', 'postgres')
        await aguardarSaudavel('postgres')
      }

      await aguardarEstado(bancada, id, 'concluido', 90_000)
      expect(logWorker.doEvento('job.iniciado').filter((registro) => registro['jobId'] === id)).toHaveLength(1)
      expect(logWorker.doEvento('job.concluido').filter((registro) => registro['jobId'] === id)).toHaveLength(1)
      const naFila = await bancada.fila.getJob(id)
      expect(await naFila?.getState()).toBe('completed')
      expect(naFila?.attemptsMade).toBeGreaterThan(1)
    }, 150_000)

    it('réplica que morreu com o job na mão (lock vencido): a outra o devolve pelo stalled, conta fila.jobs_stalled só pela fila, e o job conclui', async () => {
      const id = await publicado()
      // A réplica que "morre": pega o job com lock de 1 s e nunca o renova nem processa.
      const conexao = new Redis(urlRedisDeFila(), { maxRetriesPerRequest: null })
      const morta = new Worker(bullmqQueueName('interativa', 'worker'), undefined, { connection: conexao, prefix: bancada.prefixo, lockDuration: 1_000, autorun: false })
      const tomado = await morta.getNextJob(randomUUID())
      expect(tomado?.id).toBe(id)
      await morta.close(true)
      await conexao.quit()

      const medidor = new MedidorDeTeste()
      try {
        bancada.worker(new InMemoryLog('worker'), { medidor: medidor.medidor })
        await aguardarEstado(bancada, id, 'concluido', 40_000)
        expect(await medidor.pontos(METRICS.jobsStalled)).toEqual([{ atributos: { fila: 'interativa' }, valor: 1 }])
      } finally {
        await medidor.encerrar()
      }
    }, 60_000)

    it('SIGTERM com job que passa da graça e tentativas sobrando: o encerramento força a saída no prazo, sem marcar falha, e o job segue na fila para outra réplica', async () => {
      const id = await publicado(5)
      const logWorker = new InMemoryLog('worker')
      const graca = 1_000
      // Um job que não termina: só a graça encerra o worker.
      const montado = bancada.worker(logWorker, { graca, processadores: { sintetico: () => new Promise<void>(() => undefined) } })
      await aguardarEstado(bancada, id, 'ativo')

      const inicio = performance.now()
      await montado.encerrar()
      const encerrouEmMs = performance.now() - inicio

      expect(encerrouEmMs).toBeGreaterThanOrEqual(graca - 50)
      expect(encerrouEmMs).toBeLessThan(graca + 1_500)
      expect(logWorker.doEvento('worker.desligamento_forcado')).toHaveLength(1)
      // Nada foi dado como perdido: a linha segue ativa e o job segue ativo na fila, com o lock que
      // vai vencer para o stalled de outra réplica retomá-lo (provado com `kill -9` em infra/test/jobs).
      expect(await bancada.estado(id)).toEqual({ estado: 'ativo', escolaId: ESCOLA_A, codigoFalha: null })
      expect(await (await bancada.fila.getJob(id))?.getState()).toBe('active')
      expect(logWorker.doEvento('job.falhou')).toEqual([])
      // A vaga fica com o job: quem o retomar a confirma, e a escola não ganha um lugar que o job ainda ocupa.
      expect(await bancada.vagas.membros('interativa', ESCOLA_A)).toEqual([id])
    })

    it('SIGTERM com job na última tentativa além da graça: a linha termina falhou/EXECUCAO_INTERROMPIDA, a vaga sai, e a réplica que retoma o job pelo stalled não o executa', async () => {
      const id = await publicado(1)
      const logWorker = new InMemoryLog('worker')
      const montado = bancada.worker(logWorker, { graca: 1_000, processadores: { sintetico: () => new Promise<void>(() => undefined) } })
      await aguardarEstado(bancada, id, 'ativo')
      expect(await bancada.vagas.membros('interativa', ESCOLA_A)).toEqual([id])

      await montado.encerrar()
      expect(await bancada.estado(id)).toEqual({ estado: 'falhou', escolaId: ESCOLA_A, codigoFalha: JobFailureCode.EXECUCAO_INTERROMPIDA })
      expect(await bancada.vagas.membros('interativa', ESCOLA_A)).toEqual([])
      expect(logWorker.doEvento('job.falhou')).toEqual([expect.objectContaining({ jobId: id, codigo: JobFailureCode.EXECUCAO_INTERROMPIDA })])

      // O lock do job que ficou na fila vence (10 s) e o stalled de outra réplica o devolve: ela vê a linha final e não o executa.
      const logSobrevivente = new InMemoryLog('worker')
      const executados: string[] = []
      bancada.worker(logSobrevivente, { processadores: { sintetico: (_dados, execucao) => (executados.push(execucao.jobId), Promise.resolve()) } })
      await expect.poll(async () => (await bancada.fila.getJob(id))?.getState(), { timeout: 45_000, interval: 500 }).toBe('completed')
      expect(executados).toEqual([])
      expect(logSobrevivente.doEvento('job.ja_finalizado')).toEqual([expect.objectContaining({ jobId: id })])
      expect(await bancada.estado(id)).toEqual({ estado: 'falhou', escolaId: ESCOLA_A, codigoFalha: JobFailureCode.EXECUCAO_INTERROMPIDA })
    }, 90_000)

    it('SIGTERM com duas escolas na última tentativa: cada falha grava só a linha da própria escola, e cada vaga sai da própria escola', async () => {
      const [idA, idB] = [await publicado(1, ESCOLA_A), await publicado(1, ESCOLA_B)]
      const logWorker = new InMemoryLog('worker')
      const montado = bancada.worker(logWorker, { graca: 1_000, processadores: { sintetico: () => new Promise<void>(() => undefined) } })
      await aguardarEstado(bancada, idA, 'ativo')
      await aguardarEstado(bancada, idB, 'ativo')

      await montado.encerrar()
      expect(await bancada.estado(idA)).toEqual({ estado: 'falhou', escolaId: ESCOLA_A, codigoFalha: JobFailureCode.EXECUCAO_INTERROMPIDA })
      expect(await bancada.estado(idB)).toEqual({ estado: 'falhou', escolaId: ESCOLA_B, codigoFalha: JobFailureCode.EXECUCAO_INTERROMPIDA })
      expect(await bancada.vagas.membros('interativa', ESCOLA_A)).toEqual([])
      expect(await bancada.vagas.membros('interativa', ESCOLA_B)).toEqual([])
    })
  })
})
