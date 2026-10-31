import { describe, expect, it } from 'vitest'
import { prazosDaInatividade } from './idle-timeout'

const MINUTO = 60_000

describe('prazos do relógio de inatividade do operador', () => {
  it('o fim desconta o minuto em que a API pode não ter gravado o uso, e o aviso vem 2 min antes dele', () => {
    const ultimoUso = Date.parse('2026-09-24T12:00:00.000Z')
    const { aviso, fim } = prazosDaInatividade(ultimoUso)
    // A API grava o `ultimoUsoEm` no máximo uma vez por minuto: o uso dela pode ser até 1 min mais velho que o daqui, e a
    // sessão pode acabar no servidor aos 29 min contados da última requisição aceita. O aviso tem de chegar antes.
    expect(fim - ultimoUso).toBe(29 * MINUTO)
    expect(fim - aviso).toBe(2 * MINUTO)
    expect(aviso - ultimoUso).toBe(27 * MINUTO)
  })
})
