import { ErrorCode } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { DomainException } from '../error/domain.exception.js'
import { IdPipe } from './id.pipe.js'
import { ZodValidationPipe } from './zod-validation.pipe.js'

const esquema = z.strictObject({ nome: z.string().min(1), limite: z.coerce.number().int().min(1).max(100).default(20) })

function erroDe(chamada: () => unknown): DomainException {
  try {
    chamada()
  } catch (erro) {
    if (erro instanceof DomainException) return erro
    throw erro
  }
  throw new Error('a chamada não lançou')
}

describe('ZodValidationPipe', () => {
  it('o válido devolve o valor do esquema, com o default aplicado e o texto coagido, e não o valor cru', () => {
    const pipe = new ZodValidationPipe(esquema)
    expect(pipe.transform({ nome: 'Ana' })).toEqual({ nome: 'Ana', limite: 20 })
    expect(pipe.transform({ nome: 'Ana', limite: '30' })).toEqual({ nome: 'Ana', limite: 30 })
  })

  it('o inválido lança ENTRADA_INVALIDA (400), com campo a mais e com campo fora do formato, e a mensagem é só o código (nunca o valor mandado)', () => {
    const pipe = new ZodValidationPipe(esquema)
    for (const entrada of [{ nome: 'Ana', escolaId: 'b' }, { nome: '' }, { nome: 'Ana', limite: 101 }, undefined, 'texto']) {
      const erro = erroDe(() => pipe.transform(entrada))
      expect(erro.codigo, JSON.stringify(entrada)).toBe(ErrorCode.ENTRADA_INVALIDA)
      expect(erro.status).toBe(400)
      expect(erro.message).toBe(ErrorCode.ENTRADA_INVALIDA)
    }
  })

  it('com errorCode NAO_ENCONTRADO o inválido responde 404, como o inexistente', () => {
    const erro = erroDe(() => new ZodValidationPipe(z.enum(['a', 'b']), { errorCode: ErrorCode.NAO_ENCONTRADO }).transform('c'))
    expect(erro.codigo).toBe(ErrorCode.NAO_ENCONTRADO)
    expect(erro.status).toBe(404)
  })
})

describe('IdPipe', () => {
  const UUID = '0197a5b2-3c4d-7e8f-9a0b-1c2d3e4f5a6b'

  it('aceita o uuid em qualquer caixa e o devolve em minúsculas', () => {
    expect(new IdPipe().transform(UUID.toUpperCase())).toBe(UUID)
    expect(new IdPipe().transform(UUID)).toBe(UUID)
  })

  it('fora do formato responde como o inexistente: NAO_ENCONTRADO, 404, e não 400', () => {
    for (const valor of ['nao-e-uuid', '', '1837', `${UUID}x`, undefined]) {
      const erro = erroDe(() => new IdPipe().transform(valor))
      expect(erro.codigo, String(valor)).toBe(ErrorCode.NAO_ENCONTRADO)
      expect(erro.status).toBe(404)
    }
  })

  it('com invalidAsUndefined, o fora do formato devolve undefined e o válido continua minúsculo', () => {
    const pipe = new IdPipe({ invalidAsUndefined: true })
    expect(pipe.transform('nao-e-uuid')).toBeUndefined()
    expect(pipe.transform(UUID.toUpperCase())).toBe(UUID)
  })
})
