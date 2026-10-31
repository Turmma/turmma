import { createDatabase, createPool, type Database, type DatabasePool } from '@educa/core'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { consultarUso } from '../src/ops/uso.js'
import { autorDaBancada, BancadaDeSessoes } from './sessao-de-teste.js'

describe('npm run ops:uso: consulta de uso por escola no dia e no mês', () => {
  const bancada = new BancadaDeSessoes()
  let pool: DatabasePool
  let banco: Database
  // Escolas reais: desde a tarefa 3.0 `uso_infra_diario` tem FK para `escola`.
  let escolaA: string
  let escolaB: string

  const gravar = (escolaId: string, dia: string, requisicoes: number, jobs: number, bytes: number) =>
    pool.query('insert into uso_infra_diario (escola_id, dia, requisicoes, jobs, bytes_storage) values ($1, $2, $3, $4, $5)', [escolaId, dia, requisicoes, jobs, bytes])

  beforeAll(async () => {
    pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 2, timeoutConexaoMs: 2_000, timeoutConsultaMs: 2_000 }, () => undefined)
    banco = createDatabase(pool)
    ;[escolaA, escolaB] = await Promise.all([bancada.escola(), bancada.escola()])
  })

  afterEach(async () => {
    await pool.query('delete from uso_infra_diario where escola_id = any($1::uuid[])', [[escolaA, escolaB]])
  })

  afterAll(async () => {
    await pool.end()
    await bancada.fechar()
  })

  it('o dia é o do pedido; o mês soma requisições e jobs dos dias dele e leva o pico de bytes, sem o dia do mês seguinte', async () => {
    await gravar(escolaA, '2026-09-01', 100, 10, 5_000)
    await gravar(escolaA, '2026-09-15', 40, 4, 8_000)
    await gravar(escolaA, '2026-09-30', 1, 1, 7_000)
    await gravar(escolaA, '2026-10-01', 999, 999, 99_999)
    await gravar(escolaA, '2026-08-31', 999, 999, 99_999)

    expect(await consultarUso(banco, autorDaBancada, { escolaId: escolaA, dia: '2026-09-15', mes: '2026-09' })).toEqual({
      escolaId: escolaA,
      dia: { data: '2026-09-15', requisicoes: 40, jobs: 4, bytesStorage: 8_000 },
      mes: { referencia: '2026-09', requisicoes: 141, jobs: 15, bytesStorage: 8_000 },
    })
  })

  it('isolamento: a escola B com uso no mesmo dia não aparece na consulta da A, e dia sem uso é zero', async () => {
    await gravar(escolaB, '2026-09-15', 70, 7, 700)
    expect(await consultarUso(banco, autorDaBancada, { escolaId: escolaA, dia: '2026-09-15', mes: '2026-09' })).toEqual({
      escolaId: escolaA,
      dia: { data: '2026-09-15', requisicoes: 0, jobs: 0, bytesStorage: 0 },
      mes: { referencia: '2026-09', requisicoes: 0, jobs: 0, bytesStorage: 0 },
    })
    expect((await consultarUso(banco, autorDaBancada, { escolaId: escolaB, dia: '2026-09-15', mes: '2026-09' })).mes.requisicoes).toBe(70)
  })
})
