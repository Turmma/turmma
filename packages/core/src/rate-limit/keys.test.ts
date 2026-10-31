import { describe, expect, it } from 'vitest'
import { IP_DESCONHECIDO, clientIp, forwardedIp, insuranceLimit, normalizeIp, retryAfterSeconds } from './keys.js'

describe('normalizarIp', () => {
  it('o mesmo cliente é uma chave só: IPv4 mapeado em IPv6 vira IPv4, e IPv6 fica em minúsculas', () => {
    expect(normalizeIp('::ffff:198.51.100.7')).toBe('198.51.100.7')
    expect(normalizeIp('::FFFF:198.51.100.7')).toBe('198.51.100.7')
    expect(normalizeIp('2001:DB8::1')).toBe('2001:db8::1')
    expect(normalizeIp(' 198.51.100.7 ')).toBe('198.51.100.7')
  })

  it.each([undefined, '', 'borda', 'Enzo Martins', '198.51.100.7:443', '999.1.1.1', 'rl:u:x'])(
    'recusa %s: texto que não é IP não vira chave de limite',
    (texto) => {
      expect(normalizeIp(texto)).toBeUndefined()
    },
  )
})

describe('ipEncaminhado', () => {
  it('vale a última entrada, a que o proxy mais próximo escreveu; as anteriores são do cliente', () => {
    expect(forwardedIp('203.0.113.9, 198.51.100.7')).toBe('198.51.100.7')
    expect(forwardedIp(['203.0.113.9', '198.51.100.7'])).toBe('198.51.100.7')
  })

  it('última entrada que não é IP não vale', () => {
    expect(forwardedIp('198.51.100.7, qualquer-coisa')).toBeUndefined()
    expect(forwardedIp(undefined)).toBeUndefined()
  })
})

describe('ipDoCliente', () => {
  const DA_BORDA = '172.20.0.9'

  it('conexão que não é da borda: vale o endereço da conexão, e o X-Forwarded-For forjado é ignorado', () => {
    expect(clientIp('::ffff:198.51.100.7', '203.0.113.9', false)).toBe('198.51.100.7')
  })

  it('conexão da borda: vale o IP que a borda viu', () => {
    expect(clientIp(DA_BORDA, '203.0.113.9', true)).toBe('203.0.113.9')
  })

  it('conexão da borda sem X-Forwarded-For válido (a sonda): vale o endereço da borda', () => {
    expect(clientIp(DA_BORDA, undefined, true)).toBe(DA_BORDA)
    expect(clientIp(DA_BORDA, 'lixo', true)).toBe(DA_BORDA)
  })

  it('conexão sem endereço legível cai numa chave própria, sem erro', () => {
    expect(clientIp(undefined, undefined, false)).toBe(IP_DESCONHECIDO)
  })
})

describe('limiteDoSeguro', () => {
  it('divide o limite pelas instâncias, para a soma delas não passar do limite', () => {
    expect(insuranceLimit(120, 2)).toBe(60)
    expect(insuranceLimit(3_000, 3)).toBe(1_000)
    expect(insuranceLimit(25, 2)).toBe(12)
  })

  it('nunca chega a zero: com mais instâncias que o limite, cada uma aceita uma', () => {
    expect(insuranceLimit(1, 4)).toBe(1)
  })
})

describe('segundosParaTentarDeNovo', () => {
  it('arredonda para cima e nunca manda repetir já', () => {
    expect(retryAfterSeconds(59_001)).toBe(60)
    expect(retryAfterSeconds(1_000)).toBe(1)
    expect(retryAfterSeconds(0)).toBe(1)
  })
})
