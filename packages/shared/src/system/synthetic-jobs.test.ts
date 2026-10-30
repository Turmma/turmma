import { describe, expect, it } from 'vitest'
import { CPU_MS_MAXIMO_SINTETICO, syntheticJobDataSchema } from './synthetic-jobs.js'

describe('os dados do job sintético', () => {
  it('aceitam o que a API grava e o que o modo de referência acrescenta', () => {
    expect(syntheticJobDataSchema.safeParse({ cpuMs: 0, falhar: false }).success).toBe(true)
    expect(syntheticJobDataSchema.safeParse({ cpuMs: CPU_MS_MAXIMO_SINTETICO, falhar: true, efeito: true }).success).toBe(true)
  })

  it('recusam chave a mais, como o escolaId: o job é sempre da escola do contexto', () => {
    expect(syntheticJobDataSchema.safeParse({ cpuMs: 0, falhar: false, escolaId: '0191f3a6-6b9e-7c1a-8f35-2d4c5b6a7e80' }).success).toBe(false)
    expect(syntheticJobDataSchema.safeParse({ cpuMs: 0, falhar: false, tipo: 'sintetico' }).success).toBe(false)
  })

  it('recusam o que falta ou passa do teto de CPU', () => {
    expect(syntheticJobDataSchema.safeParse({ cpuMs: 0 }).success).toBe(false)
    expect(syntheticJobDataSchema.safeParse({ cpuMs: CPU_MS_MAXIMO_SINTETICO + 1, falhar: false }).success).toBe(false)
  })
})
