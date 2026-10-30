import { describe, expect, it } from 'vitest'
import { InvariantException } from './invariant.exception.js'

describe('ErroDeInvariante', () => {
  it('leva o motivo na message e é um Error com o próprio nome', () => {
    const erro = new InvariantException('turma não criada')

    expect(erro).toBeInstanceOf(Error)
    expect(erro.message).toBe('turma não criada')
    expect(erro.name).toBe('InvariantException')
  })

  it('a subclasse continua sendo ErroDeInvariante e guarda o próprio campo', () => {
    class ComCampo extends InvariantException {
      constructor(readonly lista: readonly string[]) {
        super('lista com problema')
      }
    }

    const erro = new ComCampo(['a'])

    expect(erro).toBeInstanceOf(InvariantException)
    expect(erro.lista).toEqual(['a'])
  })
})
