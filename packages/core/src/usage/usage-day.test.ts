import { describe, expect, it } from 'vitest'
import { diaAnterior, diaDeUso, diaValido, limitesDoMes } from './usage-day.js'

describe('dia de uso em São Paulo', () => {
  it('23h59 e 00h01 de São Paulo caem em dias diferentes, embora sejam o mesmo dia em UTC', () => {
    // 23h59 de 10/03 em São Paulo (UTC-3) é 02h59 de 11/03 em UTC; 00h01 de 11/03 é 03h01 em UTC.
    expect(diaDeUso(new Date('2026-03-11T02:59:00Z'))).toBe('2026-03-10')
    expect(diaDeUso(new Date('2026-03-11T03:01:00Z'))).toBe('2026-03-11')
  })

  it('a última requisição de 31/12 é de dezembro, e a primeira de 01/01, do ano novo', () => {
    expect(diaDeUso(new Date('2027-01-01T02:59:59.999Z'))).toBe('2026-12-31')
    expect(diaDeUso(new Date('2027-01-01T03:00:00Z'))).toBe('2027-01-01')
  })

  it('o dia anterior atravessa mês, ano e fevereiro de ano bissexto', () => {
    expect(diaAnterior('2027-01-01')).toBe('2026-12-31')
    expect(diaAnterior('2026-03-01')).toBe('2026-02-28')
    expect(diaAnterior('2028-03-01')).toBe('2028-02-29')
  })

  it('o mês vai do dia 1 ao último dia dele', () => {
    expect(limitesDoMes('2026-12')).toEqual({ primeiro: '2026-12-01', ultimo: '2026-12-31' })
    expect(limitesDoMes('2026-02')).toEqual({ primeiro: '2026-02-01', ultimo: '2026-02-28' })
    expect(limitesDoMes('2028-02')).toEqual({ primeiro: '2028-02-01', ultimo: '2028-02-29' })
  })

  it.each([
    ['2026-09-13', true],
    ['2028-02-29', true],
    ['2026-02-30', false],
    ['2026-13-01', false],
    ['13/09/2026', false],
    ['2026-9-13', false],
  ])('dia %s válido: %s', (dia, valido) => {
    expect(diaValido(dia)).toBe(valido)
  })
})
