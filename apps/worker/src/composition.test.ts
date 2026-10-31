import { InMemoryFileStorage, UsageMeter, createDatabase, createLogger, createPool, type JanelaLetiva } from '@educa/core'
import { JOB_DEFINITIONS, QUEUE_NAMES, type QueueName, type JobRegistry } from '@educa/shared'
import { Redis } from 'ioredis'
import { afterAll, describe, expect, it } from 'vitest'
import type { StorageConfig } from './config.js'
import { createProcessors } from './composition.js'

// A ligação entre o registro de jobs (`JOB_DEFINITIONS`, em `packages/shared`) e o que cada réplica do worker sabe executar
// (reengenharia, 19.0): tipo, fila e processador. As peças são as de verdade, sem ninguém conectado: o pool do Postgres e o
// cliente do Redis só abrem conexão quando alguém consulta, e aqui ninguém consulta.

const STORAGE: StorageConfig = { url: 'http://127.0.0.1:1', regiao: 'sa-east-1', bucket: 'teste', chaveAcesso: 'teste', chaveSecreta: 'teste' }
/** O registro lido por nome de tipo qualquer: o processador montado pode ser um que ele não tem, e é isso que o teste procura. */
const REGISTRO: JobRegistry = JOB_DEFINITIONS
const JANELA: JanelaLetiva = { fuso: 'America/Sao_Paulo', diasLetivos: [1, 2, 3, 4, 5], inicio: '07:00', fim: '18:00' }

const pool = createPool({ url: 'postgres://teste:teste@127.0.0.1:1/teste', maximoConexoes: 1, timeoutConexaoMs: 100, timeoutConsultaMs: 100 }, () => undefined)
const redis = new Redis('redis://127.0.0.1:1', { lazyConnect: true })

afterAll(async () => {
  redis.disconnect()
  await pool.end()
})

/** Os tipos que a réplica de uma só fila leva, com a credencial de storage que as réplicas de `normal` e de `lote` recebem. */
async function tiposDaReplicaDa(fila: QueueName): Promise<string[]> {
  const montados = createProcessors(
    { pools: { [fila]: 1 }, storage: STORAGE, janelaPadrao: JANELA },
    {
      banco: createDatabase(pool),
      uso: new UsageMeter(redis),
      relogio: { agora: () => new Date('2026-10-22T10:00:00-03:00') },
      logger: createLogger({ servico: 'worker-teste', nivel: 'silent' }),
      medidor: undefined,
      cpu: { queimar: () => Promise.resolve() },
      efeitos: { gravar: () => Promise.resolve(true) },
      armazem: new InMemoryFileStorage(),
    },
  )
  await montados.rotinas?.encerrar()
  return Object.keys(montados.processadores).sort()
}

describe('a réplica de cada fila contra o registro de jobs', () => {
  it('todo tipo que o worker executa tem processador na réplica de cada fila da definição dele: nenhum job nasce sem quem o processe', async () => {
    for (const [tipo, definicao] of Object.entries(JOB_DEFINITIONS)) {
      if (definicao.executor !== 'worker') continue
      for (const fila of definicao.filas) expect(await tiposDaReplicaDa(fila), `${tipo} na fila ${fila}`).toContain(tipo)
    }
  })

  it('todo processador de uma réplica tem definição, do worker, que lista a fila dela: o inverso, sem processador de tipo que ninguém enfileira', async () => {
    for (const fila of QUEUE_NAMES) {
      for (const tipo of await tiposDaReplicaDa(fila)) {
        const definicao = REGISTRO[tipo]
        expect(definicao, `${tipo} na fila ${fila}`).toBeDefined()
        expect(definicao?.executor, `${tipo} na fila ${fila}`).toBe('worker')
        expect(definicao?.filas, `${tipo} na fila ${fila}`).toContain(fila)
      }
    }
  })

  it('o arquivo do titular só na `normal`, as rotinas só no `lote` e o sintético nas três', async () => {
    expect(await tiposDaReplicaDa('interativa')).toEqual(['sintetico'])
    expect(await tiposDaReplicaDa('normal')).toEqual(['sintetico', 'titular.montar-arquivo'])
    expect(await tiposDaReplicaDa('lote')).toEqual([
      'retencao.expurgar-escola',
      'sintetico',
      'sistema.consolidar-uso',
      'sistema.expurgar-acesso',
      'sistema.expurgar-dado-pessoal',
      'sistema.expurgar-jobs',
      'titular.eliminar',
    ])
  })
})
