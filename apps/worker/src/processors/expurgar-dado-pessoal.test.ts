import { describe, expect, it } from 'vitest'
import { chaveDaNoite } from './expurgar-dado-pessoal.js'

describe('a chave da noite do expurgo da escola (F3, tarefa 3.0)', () => {
  it('é a data local no fuso da escola: 23h59 e 0h01 de São Paulo são noites diferentes, e 0h01 local ainda é a véspera em UTC−5', () => {
    expect(chaveDaNoite('America/Sao_Paulo', new Date('2026-10-06T23:59:00-03:00'))).toBe('2026-10-06')
    expect(chaveDaNoite('America/Sao_Paulo', new Date('2026-10-07T00:01:00-03:00'))).toBe('2026-10-07')
    // O mesmo instante, numa escola em Rio Branco (UTC−5), ainda é o dia 6.
    expect(chaveDaNoite('America/Rio_Branco', new Date('2026-10-07T00:01:00-03:00'))).toBe('2026-10-06')
  })
})
