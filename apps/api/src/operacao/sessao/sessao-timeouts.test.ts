import { describe, expect, it } from 'vitest'
import { INATIVIDADE_DO_OPERADOR_MIN, sessaoDeOperadorVale, type SessaoDeOperadorParaGuarda } from './sessao-timeouts.js'

const AGORA = new Date('2026-09-23T13:00:00Z')
const minutosAntes = (minutos: number) => new Date(AGORA.getTime() - minutos * 60_000)

/** Uma sessão viva: aberta há 1 h, usada há 1 min, com 7 h pela frente, operador ativo. */
const viva: SessaoDeOperadorParaGuarda = {
  encerradaEm: null,
  expiraEm: new Date(AGORA.getTime() + 7 * 3_600_000),
  ultimoUsoEm: minutosAntes(1),
  operadorDesativadoEm: null,
  agora: AGORA,
}

describe('sessaoDeOperadorVale: os prazos da sessão do operador (RF5)', () => {
  it('a sessão viva vale', () => {
    expect(sessaoDeOperadorVale(viva)).toBe(true)
  })

  it('30 min sem uso terminam a sessão; 29 min e 59 s ainda não', () => {
    expect(INATIVIDADE_DO_OPERADOR_MIN).toBe(30)
    expect(sessaoDeOperadorVale({ ...viva, ultimoUsoEm: new Date(minutosAntes(30).getTime() + 1_000) })).toBe(true)
    expect(sessaoDeOperadorVale({ ...viva, ultimoUsoEm: minutosAntes(30) })).toBe(false)
  })

  it('as 8 h terminam a sessão mesmo com uso de agora', () => {
    expect(sessaoDeOperadorVale({ ...viva, ultimoUsoEm: AGORA, expiraEm: AGORA })).toBe(false)
    expect(sessaoDeOperadorVale({ ...viva, ultimoUsoEm: AGORA, expiraEm: new Date(AGORA.getTime() + 1_000) })).toBe(true)
  })

  it('sessão encerrada (saída, refresh reusado, desativação) e operador desativado não valem, mesmo dentro dos prazos', () => {
    expect(sessaoDeOperadorVale({ ...viva, encerradaEm: minutosAntes(1) })).toBe(false)
    expect(sessaoDeOperadorVale({ ...viva, operadorDesativadoEm: minutosAntes(1) })).toBe(false)
  })

  it('sessão que não existe (expurgada, ou de outro operador) não vale', () => {
    expect(sessaoDeOperadorVale(undefined)).toBe(false)
  })
})
