import { describe, expect, it } from 'vitest'
import { InMemoryLog } from './queue.fixture.js'

/**
 * O contrato do conserto da correção `2026-11-16-uuid-no-log-do-job-timeout`: o teste que prova que o log não leva o dado do
 * job procura o valor sem tropeçar nos ids sorteados, que também são feitos de dígitos. A intermitência não é determinística (o
 * UUID é sorteado); este contrato é, e é ele que impede a volta.
 */
describe('o log em memória: ids sorteados não contam como valor vazado', () => {
  const jobId = '0b1f6c52-8e34-4d7a-9c10-594242a7b87a'
  const escolaId = '3f2a9d10-77c4-4b1e-8a65-1c0d5e9f2b34'

  it('o `4242` dentro de um UUID não é o `4242` do dado do job', () => {
    const log = new InMemoryLog('worker')
    log.logger.warn({ evento: 'job.tempo_esgotado', jobId, escolaId, tentativa: 1, prazoMs: 300 })

    expect(log.linhas.join('\n')).toContain('4242')
    expect(log.contemValor('4242')).toBe(false)
  })

  it('o `4242` que o log leva como valor, fora de um id, é visto', () => {
    const log = new InMemoryLog('worker')
    log.logger.warn({ evento: 'job.tempo_esgotado', jobId, escolaId, tentativa: 1, prazoMs: 4_242 })

    expect(log.contemValor('4242')).toBe(true)
  })
})
