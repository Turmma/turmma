import { describe, expect, it } from 'vitest'
import { uuidV7 } from './uuid-v7.js'

describe('uuidV7 (o id do material nasce na aplicação, antes da linha)', () => {
  it('é um UUID de versão 7 e variante 10, com os 48 bits do instante na frente', () => {
    const agora = Date.UTC(2026, 10, 11, 12, 30, 0)
    const id = uuidV7(agora)

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(agora)
  })

  it('ordena no tempo e não repete no mesmo milissegundo', () => {
    const ids = [uuidV7(1_000), uuidV7(2_000), uuidV7(3_000)]

    expect([...ids].sort()).toEqual(ids)
    expect(new Set(Array.from({ length: 200 }, () => uuidV7(5_000))).size).toBe(200)
  })
})
