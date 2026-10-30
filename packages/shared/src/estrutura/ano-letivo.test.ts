import { describe, expect, it } from 'vitest'
import { criarAnoLetivoRequestSchema, fimCaiAteOAnoSeguinte, fimDepoisDoInicio, inicioCaiNoAnoLetivo } from './ano-letivo.js'

const pedido = (ano: number, inicio: string, fim: string) => criarAnoLetivoRequestSchema.safeParse({ ano, inicio, fim })
const campoComErro = (ano: number, inicio: string, fim: string) => {
  const lido = pedido(ano, inicio, fim)
  return lido.success ? [] : lido.error.issues.map((problema) => problema.path.join('.'))
}

describe('o período do ano letivo não contradiz o ano (A1, 13.0)', () => {
  it('o período dentro do ano passa, e o fim em janeiro do ano seguinte também', () => {
    expect(pedido(2027, '2027-02-01', '2027-12-15').success).toBe(true)
    expect(pedido(2027, '2027-02-01', '2028-01-20').success).toBe(true)
    expect(pedido(2027, '2027-01-25', '2028-12-31').success).toBe(true)
  })

  it('o início em outro ano é recusado no campo do início: o 2027 com o período de 2026, e o que começaria no ano seguinte', () => {
    expect(campoComErro(2027, '2026-02-01', '2026-12-15')).toEqual(['inicio'])
    expect(campoComErro(2027, '2028-02-01', '2028-12-15')).toEqual(['inicio'])
    expect(inicioCaiNoAnoLetivo(2027, '2027-12-31')).toBe(true)
    expect(inicioCaiNoAnoLetivo(2027, '2026-12-31')).toBe(false)
  })

  it('o fim depois do ano seguinte é recusado no campo do fim: 2207 digitado no lugar de 2027', () => {
    expect(campoComErro(2027, '2027-02-01', '2207-12-15')).toEqual(['fim'])
    expect(campoComErro(2027, '2027-02-01', '2029-01-01')).toEqual(['fim'])
    expect(fimCaiAteOAnoSeguinte(2027, '2028-12-31')).toBe(true)
    expect(fimCaiAteOAnoSeguinte(2027, '2029-01-01')).toBe(false)
  })

  it('o fim antes do início continua recusado no campo do fim, e o fim no mesmo dia também', () => {
    expect(campoComErro(2027, '2027-12-15', '2027-02-01')).toEqual(['fim'])
    expect(campoComErro(2027, '2027-02-01', '2027-02-01')).toEqual(['fim'])
    expect(fimDepoisDoInicio('2027-02-01', '2027-02-02')).toBe(true)
    expect(fimDepoisDoInicio('2027-02-01', '2027-02-01')).toBe(false)
  })
})
