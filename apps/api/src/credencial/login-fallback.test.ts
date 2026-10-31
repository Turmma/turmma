import { describe, expect, it } from 'vitest'
import { SeguroDoLogin } from './login-fallback.js'

const fonte = (proporcaoDoSeguro: number) => ({ proporcaoDoSeguro })

describe('SeguroDoLogin: uma fonte só do limite.seguro_ativo para o login no Redis de fila', () => {
  it('qualquer fonte sozinha no seguro leva o sinal a 1, e vale a maior', () => {
    expect(new SeguroDoLogin(fonte(0), fonte(0), fonte(1)).proporcaoDoSeguro).toBe(1)
    expect(new SeguroDoLogin(fonte(1), fonte(0), fonte(0)).proporcaoDoSeguro).toBe(1)
    expect(new SeguroDoLogin(fonte(0.2), fonte(0.7), fonte(0.4)).proporcaoDoSeguro).toBe(0.7)
  })

  it('sem nada no seguro, e sem fonte, é 0', () => {
    expect(new SeguroDoLogin(fonte(0), fonte(0), fonte(0)).proporcaoDoSeguro).toBe(0)
    expect(new SeguroDoLogin().proporcaoDoSeguro).toBe(0)
  })
})
