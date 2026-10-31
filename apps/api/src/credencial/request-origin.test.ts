import { IP_DESCONHECIDO } from '@educa/core'
import { describe, expect, it } from 'vitest'
import { ipParaRegistro } from './request-origin.js'

describe('o IP como o registro de acesso o grava', () => {
  it('o endereço que não foi lido vira o não roteável, e o lido passa igual', () => {
    expect(ipParaRegistro(IP_DESCONHECIDO)).toBe('0.0.0.0')
    expect(ipParaRegistro('203.0.113.7')).toBe('203.0.113.7')
    expect(ipParaRegistro('2001:db8::1')).toBe('2001:db8::1')
  })
})
