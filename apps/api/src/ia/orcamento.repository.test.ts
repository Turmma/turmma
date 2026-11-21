import { describe, expect, it } from 'vitest'
import { segundosAteAViradaDoMes } from './orcamento.repository.js'

/**
 * Quantos segundos faltam, em São Paulo, para o mês virar (camada-ia, tarefa 4.0; Tech Spec §5, "O teto de segurança": `tenteDeNovoEmSegundos = mín(até a virada, 3.600)`). É a conta pura da espera do lote
 * acima do teto; o caso que a usa pelo processador, com o job adiado, é `orcamento-teto.int.test.ts`.
 */
describe('segundosAteAViradaDoMes', () => {
  it('o que falta para a virada, em segundos, no fuso de São Paulo: a conta fecha em fevereiro, em dezembro e na meia-noite exata', () => {
    expect(segundosAteAViradaDoMes(new Date('2026-11-30T23:50:00-03:00'))).toBe(600)
    expect(segundosAteAViradaDoMes(new Date('2026-11-10T12:00:00-03:00'))).toBe(21 * 86_400 - 12 * 3_600)
    // Fevereiro de 2027 tem 28 dias; dezembro vira para janeiro; a fração de segundo arredonda para cima.
    expect(segundosAteAViradaDoMes(new Date('2027-02-28T23:50:00-03:00'))).toBe(600)
    expect(segundosAteAViradaDoMes(new Date('2026-12-31T23:50:00-03:00'))).toBe(600)
    expect(segundosAteAViradaDoMes(new Date('2026-11-30T23:59:59.500-03:00'))).toBe(1)
    // A meia-noite do dia 1 já é o mês novo: faltam os 31 dias de dezembro. E 23h30 de 31/03 em São Paulo já é abril em UTC, mas ainda é março aqui.
    expect(segundosAteAViradaDoMes(new Date('2026-12-01T00:00:00-03:00'))).toBe(31 * 86_400)
    expect(segundosAteAViradaDoMes(new Date('2026-03-31T23:30:00-03:00'))).toBe(1_800)
  })
})
