import { describe, expect, it } from 'vitest'
import {
  ALCANCES_DO_SUBOPERADOR,
  CATEGORIAS_DE_DADO_DO_SUBOPERADOR,
  CHAVES_DE_CATEGORIA_DO_SUBOPERADOR,
  suboperadoresResponseSchema,
  FORMATO_DA_CHAVE_DO_SUBOPERADOR,
  FORMATO_DO_CONTRATO_DO_SUBOPERADOR,
  FORMATO_DO_PAIS_DO_SUBOPERADOR,
} from './suboperador.js'

const valido = {
  chave: 'maritaca',
  nome: 'Maritaca AI',
  finalidade: 'Modelo de linguagem',
  pais: 'BR',
  categorias: ['conversa_do_aluno'],
  vedaTreinamento: true,
  inicio: '2026-10-05T12:00:00.000Z',
  fim: null,
}

describe('contrato dos suboperadores (F3, 8.0)', () => {
  it('as chaves da lista fechada de categorias são exatamente as do texto, na mesma ordem', () => {
    expect([...CHAVES_DE_CATEGORIA_DO_SUBOPERADOR]).toEqual(Object.keys(CATEGORIAS_DE_DADO_DO_SUBOPERADOR))
  })

  it('o alcance é "todas" ou "lista", e nada mais', () => {
    expect([...ALCANCES_DO_SUBOPERADOR]).toEqual(['todas', 'lista'])
  })

  it('a chave é a do IA_PROVEDOR_ID: minúscula, começa por letra, 2 a 40 caracteres de letra, número, _ e -', () => {
    for (const aceita of ['maritaca', 'google-ai', 'aws_s3', 'a1']) expect(FORMATO_DA_CHAVE_DO_SUBOPERADOR.test(aceita), aceita).toBe(true)
    for (const recusada of ['', 'a', 'Maritaca', '1abc', 'com espaço', 'x'.repeat(41), 'ação']) expect(FORMATO_DA_CHAVE_DO_SUBOPERADOR.test(recusada), recusada).toBe(false)
  })

  it('o país é o código de duas letras maiúsculas, e o contrato é um código curto, nunca uma frase', () => {
    for (const aceito of ['BR', 'US']) expect(FORMATO_DO_PAIS_DO_SUBOPERADOR.test(aceito), aceito).toBe(true)
    for (const recusado of ['br', 'BRA', 'B', '']) expect(FORMATO_DO_PAIS_DO_SUBOPERADOR.test(recusado), recusado).toBe(false)
    for (const aceito of ['DPA-2026-03', '14', 'contrato/2026.1']) expect(FORMATO_DO_CONTRATO_DO_SUBOPERADOR.test(aceito), aceito).toBe(true)
    for (const recusado of ['contrato da Maria', '', '-inicio', 'x'.repeat(61)]) expect(FORMATO_DO_CONTRATO_DO_SUBOPERADOR.test(recusado), recusado).toBe(false)
  })

  it('a resposta aceita só os campos da escola: campo a mais (id, contrato), categoria fora da lista ou sem categoria e data fora do formato são recusados', () => {
    expect(suboperadoresResponseSchema.safeParse({ suboperadores: [valido] }).success).toBe(true)
    expect(suboperadoresResponseSchema.safeParse({ suboperadores: [] }).success).toBe(true)
    for (const [caso, mudanca] of [
      ['id', { id: '0190f5a0-0000-7000-8000-000000000001' }],
      ['contrato', { contrato: 'DPA-1' }],
      ['categoria inventada', { categorias: ['diagnostico'] }],
      ['sem categoria', { categorias: [] }],
      ['país minúsculo', { pais: 'br' }],
      ['data sem formato', { inicio: '05/10/2026' }],
      ['fim ausente', { fim: undefined }],
    ] as const) {
      expect(suboperadoresResponseSchema.safeParse({ suboperadores: [{ ...valido, ...mudanca }] }).success, caso).toBe(false)
    }
    expect(suboperadoresResponseSchema.safeParse({ suboperadores: [valido], contrato: 'x' }).success).toBe(false)
  })
})
