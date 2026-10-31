import { describe, expect, it } from 'vitest'
import { BYTES_DO_REFRESH, hashDoRefresh, normalizarEmail } from './login-identifiers.js'

describe('normalização e refresh', () => {
  it('o e-mail sai sem espaço nas pontas e em minúsculas, como a conta citext o compara', () => {
    expect(normalizarEmail('  Camila@Escola.Invalid ')).toBe('camila@escola.invalid')
    // Em turco, `toLocaleLowerCase` trocaria o `I` por `ı`: a conta guardada antes não seria mais achada.
    expect(normalizarEmail('INES@ESCOLA.INVALID')).toBe('ines@escola.invalid')
  })

  it('o refresh vira SHA-256 em hex, que é o que a sessão guarda, e tem 32 bytes sorteados', () => {
    expect(hashDoRefresh('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(BYTES_DO_REFRESH).toBe(32)
  })
})
