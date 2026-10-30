import { ErrorCode } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { DomainException } from './erro-de-dominio.js'

describe('ErroDeDominio', () => {
  it('usa o status padrão do código, e o informado quando o caso pede outro', () => {
    expect(new DomainException(ErrorCode.NAO_AUTENTICADO).status).toBe(401)
    expect(new DomainException(ErrorCode.CONFLITO, 422).status).toBe(422)
  })

  it('NAO_ENCONTRADO sai sempre com 404: um 403 confirmaria que o objeto existe', () => {
    expect(new DomainException(ErrorCode.NAO_ENCONTRADO, 403).status).toBe(404)
  })
})
