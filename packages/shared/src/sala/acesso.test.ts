import { describe, expect, it } from 'vitest'
import {
  ALFABETO_DO_CODIGO_DA_TURMA,
  codigoDaTurmaValido,
  gerarAcessoRequestSchema,
  acessoGeradoResponseSchema,
  exibirCodigoDaTurma,
  normalizarCodigoDaTurma,
  TAMANHO_DO_CODIGO_DA_TURMA,
} from './acesso.js'

describe('código da turma (A1, 4.0, E15)', () => {
  it('o alfabeto tem 31 caracteres, sem repetir, sem 0, 1, I, L nem O, e o código tem 8', () => {
    expect(ALFABETO_DO_CODIGO_DA_TURMA).toHaveLength(31)
    expect(new Set(ALFABETO_DO_CODIGO_DA_TURMA).size).toBe(31)
    for (const confuso of ['0', '1', 'I', 'L', 'O']) expect(ALFABETO_DO_CODIGO_DA_TURMA).not.toContain(confuso)
    expect(TAMANHO_DO_CODIGO_DA_TURMA).toBe(8)
  })

  it('só oito caracteres do alfabeto formam um código: sete, nove, ou um 0, 1, I, L ou O no meio não', () => {
    expect(codigoDaTurmaValido('ABCD2345')).toBe(true)
    expect(codigoDaTurmaValido('ZZZZ9999')).toBe(true)
    expect(codigoDaTurmaValido('ABCD234')).toBe(false)
    expect(codigoDaTurmaValido('ABCD23456')).toBe(false)
    for (const confuso of ['0', '1', 'I', 'L', 'O']) expect(codigoDaTurmaValido(`ABC${confuso}2345`), confuso).toBe(false)
    expect(codigoDaTurmaValido('abcd2345')).toBe(false)
  })

  it('é mostrado em dois grupos de quatro', () => {
    expect(exibirCodigoDaTurma('ABCD2345')).toBe('ABCD 2345')
  })

  it('a entrada com espaço, hífen, tabulação e minúscula normaliza para o mesmo código', () => {
    for (const digitado of ['ABCD2345', 'ABCD 2345', 'abcd-2345', ' abcd 2345 ', 'Ab-Cd\t23 45', exibirCodigoDaTurma('ABCD2345')]) {
      expect(normalizarCodigoDaTurma(digitado), digitado).toBe('ABCD2345')
    }
  })

  it('a normalização não recusa nem troca caractere fora do alfabeto: o código errado continua errado', () => {
    expect(normalizarCodigoDaTurma('abcd-234o')).toBe('ABCD234O')
    expect(codigoDaTurmaValido(normalizarCodigoDaTurma('abcd-234o'))).toBe(false)
  })
})

describe('contrato do acesso da turma (A1, 4.0, E13)', () => {
  it('a validade é 1, 7 ou 30 dias; 0, 2, 31, texto e campo a mais são recusados', () => {
    for (const validadeDias of [1, 7, 30]) expect(gerarAcessoRequestSchema.safeParse({ validadeDias }).success, String(validadeDias)).toBe(true)
    for (const validadeDias of [0, 2, 31, '7', 7.5]) expect(gerarAcessoRequestSchema.safeParse({ validadeDias }).success, String(validadeDias)).toBe(false)
    expect(gerarAcessoRequestSchema.safeParse({}).success).toBe(false)
    expect(gerarAcessoRequestSchema.safeParse({ validadeDias: 7, turmaId: '0190c7e2-0000-7000-8000-000000000000' }).success).toBe(false)
  })

  it('a resposta do gerar é estrita e só aceita o código sem os espaços', () => {
    const resposta = { token: 'a'.repeat(43), codigo: 'ABCD2345', expiraEm: '2026-09-26T12:00:00.000Z' }
    expect(acessoGeradoResponseSchema.safeParse(resposta).success).toBe(true)
    expect(acessoGeradoResponseSchema.safeParse({ ...resposta, codigo: 'ABCD 2345' }).success).toBe(false)
    for (const token of ['a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}=`, `${'a'.repeat(42)}+`]) {
      expect(acessoGeradoResponseSchema.safeParse({ ...resposta, token }).success, token).toBe(false)
    }
    expect(acessoGeradoResponseSchema.safeParse({ ...resposta, turmaId: '0190c7e2-0000-7000-8000-000000000000' }).success).toBe(false)
  })
})
