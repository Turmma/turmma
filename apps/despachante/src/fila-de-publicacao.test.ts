import { bullmqQueueName, type ReservedJob } from '@educa/core'
import { JobFailureCode, defineJob, JOB_DEFINITIONS, TIPO_JOB_SINTETICO, type JobExecutor, type QueueName, type JobRegistry } from '@educa/shared'
import { describe, expect, it, vi } from 'vitest'
import { PrazoDaFilaEsgotado, PublicacaoBullMQ, type FilaBullMQ } from './fila-de-publicacao.js'

const JOB: ReservedJob = {
  id: '0190f5a0-0000-7000-8000-0000000000f1',
  escolaId: '0190f5a0-0000-7000-8000-00000000000a',
  requisicaoId: '0190f5a0-0000-7000-8000-0000000000e1',
  tipo: 'sintetico',
  fila: 'interativa',
}

type JobNaFila = Awaited<ReturnType<FilaBullMQ['getJob']>>

/** `Queue` falsa: pronta na hora, sem job nenhum, e cada parte trocável pelo teste. */
function filaFalsa(partes: Partial<FilaBullMQ> = {}): FilaBullMQ {
  return {
    waitUntilReady: () => Promise.resolve(),
    addBulk: () => Promise.resolve([]),
    getJob: () => Promise.resolve(undefined),
    close: () => Promise.resolve(),
    ...partes,
  }
}

function jobNaFila(estado: string, failedReason = ''): JobNaFila {
  return { failedReason, getState: () => Promise.resolve(estado) }
}

describe('PublicacaoBullMQ', () => {
  it('publica cada job com o id da linha como jobId, as opções de retentativa, e só escola e requisição no data', async () => {
    const addBulk = vi.fn<FilaBullMQ['addBulk']>(() => Promise.resolve([]))
    await new PublicacaoBullMQ(() => filaFalsa({ addBulk })).publicar([JOB])
    expect(addBulk).toHaveBeenCalledExactlyOnceWith([
      { name: 'sintetico', data: { escolaId: JOB.escolaId, requisicaoId: JOB.requisicaoId }, opts: { attempts: 5, backoff: { type: 'exponential', delay: 2_000, jitter: 0.5 }, jobId: JOB.id } },
    ])
  })

  it('cada job leva a retentativa da definição do tipo dele: com a definição injetada, as tentativas e o recuo dela, e o outro tipo segue com os seus', async () => {
    const addBulk = vi.fn<FilaBullMQ['addBulk']>(() => Promise.resolve([]))
    const definicoes: JobRegistry = {
      ...JOB_DEFINITIONS,
      [TIPO_JOB_SINTETICO]: defineJob({ ...JOB_DEFINITIONS[TIPO_JOB_SINTETICO], retentativa: { tentativas: 2, recuoMs: 10, jitter: 0 } }),
    }
    const montar = { ...JOB, id: '0190f5a0-0000-7000-8000-0000000000f2', tipo: 'titular.montar-arquivo', fila: 'interativa' as const }
    await new PublicacaoBullMQ(() => filaFalsa({ addBulk }), undefined, definicoes).publicar([JOB, montar])
    const opcoes = Object.fromEntries((addBulk.mock.calls[0]?.[0] ?? []).map(({ name, opts }) => [name, opts]))
    expect(opcoes).toEqual({
      sintetico: { attempts: 2, backoff: { type: 'exponential', delay: 10, jitter: 0 }, jobId: JOB.id },
      'titular.montar-arquivo': { attempts: 5, backoff: { type: 'exponential', delay: 2_000, jitter: 0.5 }, jobId: montar.id },
    })
  })

  it('o tipo da API vai à Queue da API da fila dele, o do worker e o tipo desconhecido, à do worker; e a consulta segue o mesmo caminho', async () => {
    const adicionados = new Map<string, string[]>()
    const consultadas: string[] = []
    const criadas: string[] = []
    const criar = (fila: QueueName, executor: JobExecutor) => {
      const nome = bullmqQueueName(fila, executor)
      criadas.push(nome)
      return filaFalsa({
        addBulk: (jobs) => {
          adicionados.set(nome, [...(adicionados.get(nome) ?? []), ...jobs.map((job) => job.opts.jobId)])
          return Promise.resolve([])
        },
        getJob: () => {
          consultadas.push(nome)
          return Promise.resolve(undefined)
        },
      })
    }
    const definicoes: JobRegistry = { ...JOB_DEFINITIONS, 'teste.da-api': defineJob({ ...JOB_DEFINITIONS[TIPO_JOB_SINTETICO], executor: 'api' }) }
    const daApi = { ...JOB, id: '0190f5a0-0000-7000-8000-0000000000f2', tipo: 'teste.da-api' }
    const antigo = { ...JOB, id: '0190f5a0-0000-7000-8000-0000000000f3', tipo: 'tipo.de-uma-versao-antiga', fila: 'normal' as const }
    const publicacao = new PublicacaoBullMQ(criar, undefined, definicoes)
    await publicacao.publicar([JOB, daApi, antigo])
    expect(Object.fromEntries(adicionados)).toEqual({ interativa: [JOB.id], 'api-interativa': [daApi.id], normal: [antigo.id] })
    await publicacao.consultar(daApi)
    await publicacao.consultar(JOB)
    expect(consultadas).toEqual(['api-interativa', 'interativa'])
    // As três do worker nascem com o despachante; a da API, na primeira vez que um tipo a pede, e uma só, que a consulta reaproveita.
    expect(criadas).toEqual(['interativa', 'normal', 'lote', 'api-interativa'])
  })

  it('cada job vai à fila dele: uma Queue por fila, e a prioridade é a fila', async () => {
    const adicionados = new Map<QueueName, string[]>()
    const criar = (fila: QueueName) =>
      filaFalsa({
        addBulk: (jobs) => {
          adicionados.set(fila, [...(adicionados.get(fila) ?? []), ...jobs.map((job) => job.opts.jobId)])
          return Promise.resolve([])
        },
      })
    const lote = { ...JOB, id: '0190f5a0-0000-7000-8000-0000000000f2', fila: 'lote' as const }
    const normal = { ...JOB, id: '0190f5a0-0000-7000-8000-0000000000f3', fila: 'normal' as const }
    await new PublicacaoBullMQ(criar).publicar([JOB, lote, normal])
    expect(Object.fromEntries(adicionados)).toEqual({ interativa: [JOB.id], lote: [lote.id], normal: [normal.id] })
  })

  it('consulta o job na fila dele', async () => {
    const consultadas: QueueName[] = []
    const criar = (fila: QueueName) =>
      filaFalsa({
        getJob: () => {
          consultadas.push(fila)
          return Promise.resolve(undefined)
        },
      })
    await new PublicacaoBullMQ(criar).consultar({ id: JOB.id, fila: 'lote', tipo: JOB.tipo })
    expect(consultadas).toEqual(['lote'])
  })

  it('Redis fora quando o despachante sobe: a Queue esperaria o Redis sem limite, e a publicação desiste no prazo', async () => {
    const nuncaFicaPronta = filaFalsa({ waitUntilReady: () => new Promise(() => undefined) })
    const publicacao = new PublicacaoBullMQ(() => nuncaFicaPronta, 50)
    const inicio = performance.now()
    await expect(publicacao.publicar([JOB])).rejects.toBeInstanceOf(PrazoDaFilaEsgotado)
    await expect(publicacao.consultar(JOB)).rejects.toBeInstanceOf(PrazoDaFilaEsgotado)
    expect(performance.now() - inicio).toBeLessThan(1_000)
  })

  it('comando travado: a publicação desiste no prazo, mesmo que o comando nunca responda', async () => {
    const publicacao = new PublicacaoBullMQ(() => filaFalsa({ addBulk: () => new Promise(() => undefined) }), 50)
    await expect(publicacao.publicar([JOB])).rejects.toBeInstanceOf(PrazoDaFilaEsgotado)
  })

  it('a preparação da Queue falhou (o BullMQ guarda essa falha para sempre): a operação falha, e a seguinte já usa uma Queue nova', async () => {
    const quebrada = filaFalsa({ waitUntilReady: () => Promise.reject(new Error('Connection is closed.')), close: vi.fn(() => Promise.resolve()) })
    const addBulkDaNova = vi.fn<FilaBullMQ['addBulk']>(() => Promise.resolve([]))
    const criadas = [quebrada, filaFalsa({ addBulk: addBulkDaNova })]
    const criar = vi.fn((fila: QueueName) => (fila === 'interativa' ? (criadas.shift() ?? filaFalsa()) : filaFalsa()))
    const publicacao = new PublicacaoBullMQ(criar)

    await expect(publicacao.publicar([JOB])).rejects.toThrow('Connection is closed.')
    expect(quebrada.close).toHaveBeenCalledOnce()
    await publicacao.publicar([JOB])
    expect(addBulkDaNova).toHaveBeenCalledOnce()
    // As três da construção e a nova, só da fila que quebrou.
    expect(criar.mock.calls.map(([fila]) => fila)).toEqual(['interativa', 'normal', 'lote', 'interativa'])
  })

  it('a Queue da API que falhou também é trocada, pelo executor: a seguinte nasce como (fila, api) e recebe o addBulk, e a do worker não é tocada', async () => {
    const quebrada = filaFalsa({ waitUntilReady: () => Promise.reject(new Error('Connection is closed.')), close: vi.fn(() => Promise.resolve()) })
    const addBulkDaNova = vi.fn<FilaBullMQ['addBulk']>(() => Promise.resolve([]))
    const addBulkDoWorker = vi.fn<FilaBullMQ['addBulk']>(() => Promise.resolve([]))
    const daApi = [quebrada, filaFalsa({ addBulk: addBulkDaNova })]
    const criar = vi.fn((_fila: QueueName, executor: JobExecutor) => (executor === 'api' ? (daApi.shift() ?? filaFalsa()) : filaFalsa({ addBulk: addBulkDoWorker })))
    const definicoes: JobRegistry = { ...JOB_DEFINITIONS, 'teste.da-api': defineJob({ ...JOB_DEFINITIONS[TIPO_JOB_SINTETICO], executor: 'api' }) }
    const job = { ...JOB, tipo: 'teste.da-api' }
    const publicacao = new PublicacaoBullMQ(criar, undefined, definicoes)

    await expect(publicacao.publicar([job])).rejects.toThrow('Connection is closed.')
    expect(quebrada.close).toHaveBeenCalledOnce()
    await publicacao.publicar([job])
    expect(addBulkDaNova).toHaveBeenCalledOnce()
    expect(addBulkDoWorker).not.toHaveBeenCalled()
    expect(criar.mock.calls).toEqual([
      ['interativa', 'worker'],
      ['normal', 'worker'],
      ['lote', 'worker'],
      ['interativa', 'api'],
      ['interativa', 'api'],
    ])
  })

  it('esperar o Redis ficar pronto não é falha da preparação: no prazo, a Queue não é trocada', async () => {
    const criar = vi.fn(() => filaFalsa({ waitUntilReady: () => new Promise(() => undefined) }))
    const publicacao = new PublicacaoBullMQ(criar, 20)
    await expect(publicacao.publicar([JOB])).rejects.toBeInstanceOf(PrazoDaFilaEsgotado)
    expect(criar).toHaveBeenCalledTimes(3)
  })

  describe('consultar', () => {
    const consultar = (job: JobNaFila) => new PublicacaoBullMQ(() => filaFalsa({ getJob: () => Promise.resolve(job) })).consultar(JOB)

    it('inexistente só quando a fila não tem o job', async () => {
      expect(await consultar(undefined)).toEqual({ situacao: 'inexistente' })
    })

    it.each(['waiting', 'active', 'delayed', 'prioritized', 'completed', 'unknown'])('presente quando a fila tem o job em %s', async (estado) => {
      expect(await consultar(jobNaFila(estado))).toEqual({ situacao: 'presente' })
    })

    it('falhou, com o código que o worker mandou à fila', async () => {
      expect(await consultar(jobNaFila('failed', JobFailureCode.FALHA_SINTETICA))).toEqual({ situacao: 'falhou', codigo: JobFailureCode.FALHA_SINTETICA })
    })

    it('falhou com motivo que não é código nosso (stalled acima do limite do BullMQ): erro interno', async () => {
      expect(await consultar(jobNaFila('failed', 'job stalled more than allowable limit'))).toEqual({ situacao: 'falhou', codigo: JobFailureCode.ERRO_INTERNO })
    })
  })
})
