import { describe, expect, it } from 'vitest'
import { limiteDeTrabalhadores } from './limite-de-trabalhadores.ts'

describe('limiteDeTrabalhadores', () => {
  it('é a metade dos núcleos: 4 → 2, 12 → 6, 16 → 8', () => {
    expect(limiteDeTrabalhadores(4)).toBe(2)
    expect(limiteDeTrabalhadores(12)).toBe(6)
    expect(limiteDeTrabalhadores(16)).toBe(8)
  })

  it('arredonda para baixo e nunca passa de metade: 5 → 2, 7 → 3', () => {
    expect(limiteDeTrabalhadores(5)).toBe(2)
    expect(limiteDeTrabalhadores(7)).toBe(3)
  })

  it('nunca zera: 1 núcleo → 1 e 2 núcleos → 1, que é o que o Vitest já usava na esteira', () => {
    expect(limiteDeTrabalhadores(1)).toBe(1)
    expect(limiteDeTrabalhadores(2)).toBe(1)
  })
})
