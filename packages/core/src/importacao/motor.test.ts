import { describe, expect, it } from 'vitest'
import { isFalhaDeTrava } from './motor.js'

/** Um erro como o `pg` o lança: o SQLSTATE em `code` e a `severity` do servidor. */
function erroDoBanco(code: string, severity = 'ERROR'): Error {
  return Object.assign(new Error('erro do banco'), { code, severity })
}

describe('isFalhaDeTrava', () => {
  it('a trava que não veio no prazo, o deadlock e a falha de serialização repetem; o resto não', () => {
    expect(isFalhaDeTrava(erroDoBanco('55P03'))).toBe(true)
    expect(isFalhaDeTrava(erroDoBanco('40P01'))).toBe(true)
    expect(isFalhaDeTrava(erroDoBanco('40001'))).toBe(true)
    expect(isFalhaDeTrava(erroDoBanco('23505'))).toBe(false)
    expect(isFalhaDeTrava(erroDoBanco('57014'))).toBe(false)
    expect(isFalhaDeTrava(new Error('55P03'))).toBe(false)
    expect(isFalhaDeTrava('55P03')).toBe(false)
  })

  it('acha o erro do banco que o Drizzle embrulha em `cause`', () => {
    expect(isFalhaDeTrava(new Error('Failed query', { cause: erroDoBanco('55P03') }))).toBe(true)
    expect(isFalhaDeTrava(new Error('Failed query', { cause: erroDoBanco('23505') }))).toBe(false)
  })
})
