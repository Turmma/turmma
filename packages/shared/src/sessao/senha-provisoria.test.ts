import { describe, expect, it } from 'vitest'
import {
  ETAPA_TROCAR_SENHA,
  MAXIMO_DE_PROVISORIAS_ANTERIORES_NA_TROCA,
  loginMatriculaResponseSchema,
  normalizarSenhaProvisoria,
  trocarSenhaProvisoriaRequestSchema,
  trocasDaProvisoriaResponseSchema,
} from './senha-provisoria.js'

describe('a senha provisória na troca (acesso-e-convites, tarefa 10.0)', () => {
  it('a digitação vale como a tela mostra: sem hífen nem espaço, em maiúsculas', () => {
    expect(normalizarSenhaProvisoria('abcd-efgh')).toBe('ABCDEFGH')
    expect(normalizarSenhaProvisoria(' ab cd - ef gh ')).toBe('ABCDEFGH')
    expect(normalizarSenhaProvisoria('ABCDEFGH')).toBe('ABCDEFGH')
    expect(normalizarSenhaProvisoria('abcd-efgh')).not.toBe('abcd-efgh')
  })

  it('o login de matrícula devolve a sessão pronta ou o bilhete da troca, e nada misturado', () => {
    expect(loginMatriculaResponseSchema.safeParse({ etapa: ETAPA_TROCAR_SENHA, bilhete: 'x.y.z' }).success).toBe(true)
    expect(loginMatriculaResponseSchema.safeParse({ etapa: ETAPA_TROCAR_SENHA }).success).toBe(false)
    expect(loginMatriculaResponseSchema.safeParse({ etapa: ETAPA_TROCAR_SENHA, bilhete: 'x.y.z', token: 't' }).success).toBe(false)
    expect(loginMatriculaResponseSchema.safeParse({ etapa: ETAPA_TROCAR_SENHA, bilhete: '' }).success).toBe(false)
    expect(loginMatriculaResponseSchema.safeParse({ etapa: ETAPA_TROCAR_SENHA, bilhete: 'x'.repeat(1024) }).success).toBe(true)
    expect(loginMatriculaResponseSchema.safeParse({ etapa: ETAPA_TROCAR_SENHA, bilhete: 'x'.repeat(1025) }).success).toBe(false)
  })

  it('a senha nova tem o mínimo de 12 e o máximo de 1024, e o corpo não traz mais nada', () => {
    expect(trocarSenhaProvisoriaRequestSchema.safeParse({ senha: 'a'.repeat(12) }).success).toBe(true)
    expect(trocarSenhaProvisoriaRequestSchema.safeParse({ senha: 'a'.repeat(11) }).success).toBe(false)
    expect(trocarSenhaProvisoriaRequestSchema.safeParse({ senha: 'a'.repeat(1024) }).success).toBe(true)
    expect(trocarSenhaProvisoriaRequestSchema.safeParse({ senha: 'a'.repeat(1025) }).success).toBe(false)
    expect(trocarSenhaProvisoriaRequestSchema.safeParse({ senha: 'a'.repeat(12), escolaId: 'x' }).success).toBe(false)
  })

  it('a lista das anteriores traz no máximo dez, com a data, o papel e se foi usada', () => {
    const item = { geradaEm: '2026-11-08T10:00:00.000Z', papel: 'coordenador', usada: false }
    const lista = (quantas: number) => ({ anteriores: Array.from({ length: quantas }, () => item) })
    expect(trocasDaProvisoriaResponseSchema.safeParse(lista(MAXIMO_DE_PROVISORIAS_ANTERIORES_NA_TROCA)).success).toBe(true)
    expect(trocasDaProvisoriaResponseSchema.safeParse(lista(MAXIMO_DE_PROVISORIAS_ANTERIORES_NA_TROCA + 1)).success).toBe(false)
    expect(trocasDaProvisoriaResponseSchema.safeParse({ anteriores: [{ ...item, aluno: 'x' }] }).success).toBe(false)
  })
})
