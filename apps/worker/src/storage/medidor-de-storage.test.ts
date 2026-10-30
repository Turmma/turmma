import { unscopedJustification } from '@educa/nucleo'
import { describe, expect, it } from 'vitest'
import { MedidorDeStorage, prefixoDaEscola } from './medidor-de-storage.js'

describe('MedidorDeStorage', () => {
  it('só a descoberta das pastas de escola sai sem escopo; a medição dos bytes é da escola do contexto', () => {
    const marcados = Object.getOwnPropertyNames(MedidorDeStorage.prototype)
      .filter((metodo) => metodo !== 'constructor' && unscopedJustification(MedidorDeStorage, metodo) !== undefined)
      .sort()
    expect(marcados).toEqual(['listarEscolas'])
    expect(unscopedJustification(MedidorDeStorage, 'listarEscolas')).toMatch(/consolidação/)
  })

  it('o prefixo da escola termina em barra', () => {
    expect(prefixoDaEscola('0190f5a0-0000-7000-8000-00000000000a')).toBe('escolas/0190f5a0-0000-7000-8000-00000000000a/')
  })
})
