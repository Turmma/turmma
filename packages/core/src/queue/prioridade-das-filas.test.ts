import { QUEUE_NAMES } from '@educa/shared'
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { configuracaoOperacionalEscola } from '../db/schema/configuracao-operacional-escola.js'
import { jobRegistro } from '../db/schema/job-registro.js'
import { QUEUE_PRIORITY } from './job-outbox.js'
import { QUEUES_BY_PRIORITY, WORKER_POOL_OPTIONS_BY_QUEUE } from './queues.js'

describe('a fila `ferramenta` entre a `interativa` e a `normal` (reengenharia-continuacao, 3.0)', () => {
  it('a ordem das filas é a da prioridade: a ferramenta vem depois da interativa e antes da normal, e QUEUE_PRIORITY só cresce nessa ordem', () => {
    expect(QUEUES_BY_PRIORITY.slice(0, 3)).toEqual(['interativa', 'ferramenta', 'normal'])
    const prioridades = QUEUE_NAMES.map((fila) => QUEUE_PRIORITY[fila])
    expect(prioridades).toEqual([...prioridades].sort((a, b) => a - b))
    expect(new Set(prioridades).size).toBe(QUEUE_NAMES.length)
    expect(QUEUE_PRIORITY.interativa).toBeLessThan(QUEUE_PRIORITY.ferramenta)
    expect(QUEUE_PRIORITY.ferramenta).toBeLessThan(QUEUE_PRIORITY.normal)
  })

  it('o pool da `ferramenta` tem o lock e o stalled da `interativa`: a réplica morta devolve o job em até ~15 s, abaixo do alerta de 30 s', () => {
    expect(WORKER_POOL_OPTIONS_BY_QUEUE.ferramenta).toEqual({ lockDurationMs: 10_000, stalledIntervalMs: 5_000 })
    expect(WORKER_POOL_OPTIONS_BY_QUEUE.ferramenta).toEqual(WORKER_POOL_OPTIONS_BY_QUEUE.interativa)
    for (const fila of QUEUE_NAMES) expect(WORKER_POOL_OPTIONS_BY_QUEUE[fila], fila).toBeDefined()
  })

  it('o check de `job_registro` e o das vagas, no schema, listam exatamente as filas de `QUEUE_NAMES`: o schema e a migration 0058 dizem o mesmo', () => {
    const dialeto = new PgDialect()
    const sqlDoCheck = (checks: ReturnType<typeof getTableConfig>['checks'], nome: string): string => {
      const check = checks.find((candidato) => candidato.name === nome)
      expect(check, nome).toBeDefined()
      return check === undefined ? '' : dialeto.sqlToQuery(check.value).sql
    }
    const filaValida = sqlDoCheck(getTableConfig(jobRegistro).checks, 'job_registro_fila_valida')
    const listadasNaFila = [...filaValida.matchAll(/'([a-z]+)'/g)].map((achado) => achado[1])
    expect(listadasNaFila).toEqual([...QUEUE_NAMES])
    const vagasValidas = sqlDoCheck(getTableConfig(configuracaoOperacionalEscola).checks, 'configuracao_operacional_vagas_validas')
    const listadasNasVagas = [...vagasValidas.matchAll(/ - '([a-z]+)'/g)].map((achado) => achado[1])
    expect(listadasNasVagas).toEqual([...QUEUE_NAMES])
  })
})
