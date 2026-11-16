import { JOB_DEFINITIONS, TIPO_EXECUTAR_IA } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { FOLGA_DO_PRAZO_MS, PRAZO_DA_EXECUCAO_MS } from './prazo-da-execucao.js'
import { PERFIS } from './perfis.js'

// O prazo único da execução (techspec §5) tem de terminar a execução marcada antes de o executor de jobs cortar a tentativa.
describe('o prazo único da execução', () => {
  it('todo perfil tem prazo, e ele é menor que o `prazoMs` do job `ia.executar` menos a folga de gravar a falha', () => {
    const prazoDoJob = JOB_DEFINITIONS[TIPO_EXECUTAR_IA].prazoMs
    expect(Object.keys(PRAZO_DA_EXECUCAO_MS).sort()).toEqual([...PERFIS].sort())
    for (const [perfil, prazoMs] of Object.entries(PRAZO_DA_EXECUCAO_MS)) {
      expect(prazoMs, perfil).toBeGreaterThan(0)
      expect(prazoMs, perfil).toBeLessThanOrEqual(prazoDoJob - FOLGA_DO_PRAZO_MS)
    }
  })

  it('o Tutor (`rapido`) tem 60 s e a ferramenta (`padrao`), 140 s', () => {
    expect(PRAZO_DA_EXECUCAO_MS.rapido).toBe(60_000)
    expect(PRAZO_DA_EXECUCAO_MS.padrao).toBe(140_000)
  })
})
