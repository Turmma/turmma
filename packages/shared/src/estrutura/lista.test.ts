import { describe, expect, it } from 'vitest'
import { linhaDaPreviaSchema } from './lista.js'

describe('contrato da prévia da lista (A1, 2.0)', () => {
  const linha = { linha: 1, nome: 'Ana', matricula: '101' }

  it('a linha traz o código do erro se, e só se, o resultado é `erro`', () => {
    expect(linhaDaPreviaSchema.safeParse({ ...linha, resultado: 'erro', erro: 'sem_nome' }).success).toBe(true)
    expect(linhaDaPreviaSchema.safeParse({ ...linha, resultado: 'entra' }).success).toBe(true)
    expect(linhaDaPreviaSchema.safeParse({ ...linha, resultado: 'erro' }).success).toBe(false)
    expect(linhaDaPreviaSchema.safeParse({ ...linha, resultado: 'ja_existe', erro: 'matricula_em_uso' }).success).toBe(false)
  })
})
