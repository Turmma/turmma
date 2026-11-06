import { describe, expect, it } from 'vitest'
import { ehFalhaDeTrava } from './motor.js'

/** Um erro como o `pg` o lança: o SQLSTATE em `code` e a `severity` do servidor. */
function erroDoBanco(code: string, severity = 'ERROR'): Error {
  return Object.assign(new Error('erro do banco'), { code, severity })
}

describe('ehFalhaDeTrava', () => {
  it('a trava que não veio no prazo, o deadlock e a falha de serialização repetem; o resto não', () => {
    expect(ehFalhaDeTrava(erroDoBanco('55P03'))).toBe(true)
    expect(ehFalhaDeTrava(erroDoBanco('40P01'))).toBe(true)
    expect(ehFalhaDeTrava(erroDoBanco('40001'))).toBe(true)
    expect(ehFalhaDeTrava(erroDoBanco('23505'))).toBe(false)
    expect(ehFalhaDeTrava(erroDoBanco('57014'))).toBe(false)
    expect(ehFalhaDeTrava(new Error('55P03'))).toBe(false)
    expect(ehFalhaDeTrava('55P03')).toBe(false)
  })

  it('acha o erro do banco que o Drizzle embrulha em `cause`', () => {
    expect(ehFalhaDeTrava(new Error('Failed query', { cause: erroDoBanco('55P03') }))).toBe(true)
    expect(ehFalhaDeTrava(new Error('Failed query', { cause: erroDoBanco('23505') }))).toBe(false)
  })
})
