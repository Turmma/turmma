import { describe, expect, it } from 'vitest'
import { habilidadesDoMaterialQueryOptions } from './material'

describe('a leitura das candidatas da correção', () => {
  it('a chave leva o id do material: dois materiais não dividem a lista de candidatas', () => {
    const a = habilidadesDoMaterialQueryOptions('0197a1c0-0000-7000-8000-00000000000a').queryKey
    const b = habilidadesDoMaterialQueryOptions('0197a1c0-0000-7000-8000-00000000000b').queryKey
    expect(a).not.toEqual(b)
    expect(a).toContain('0197a1c0-0000-7000-8000-00000000000a')
  })
})
