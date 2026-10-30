import { describe, expect, it } from 'vitest'
import { TAMANHO_MAXIMO_TOKEN_DE_CONVITE, TAMANHO_MINIMO_SENHA_NOVA } from '../sessao/convite.js'
import { TAMANHO_MAXIMO_SENHA } from '../sessao/login.js'
import { TAMANHO_MAXIMO_MATRICULA, TAMANHO_MAXIMO_SLUG_NO_LOGIN } from '../sessao/matricula.js'
import {
  abrirSalaRequestSchema,
  reivindicarSalaRequestSchema,
  reivindicacaoResponseSchema,
  salaAbertaResponseSchema,
  MAXIMO_DE_NOMES_NA_SALA,
  TAMANHO_MAXIMO_CODIGO_DIGITADO,
} from './salas.js'

describe('contrato de salas/abrir (A1, tarefa 5.0)', () => {
  // Valores fixos e sintéticos: o pacote não tem os tipos do Node.
  const token = 'A'.repeat(43)
  const UM_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'

  it('aceita o slug com o token ou com o código como o aluno digita, e nada mais', () => {
    expect(abrirSalaRequestSchema.parse({ slug: 'colegio-horizonte', token })).toEqual({ slug: 'colegio-horizonte', token })
    expect(abrirSalaRequestSchema.parse({ slug: 'colegio-horizonte', codigo: 'abcd 2345' })).toEqual({ slug: 'colegio-horizonte', codigo: 'abcd 2345' })
    // O formato do token e do código fica para a busca: o que não é vigente responde NAO_ENCONTRADO, como o inexistente.
    expect(abrirSalaRequestSchema.safeParse({ slug: 'colegio-horizonte', token: 'curto' }).success).toBe(true)
    expect(abrirSalaRequestSchema.safeParse({ slug: 'colegio-horizonte', codigo: 'x'.repeat(TAMANHO_MAXIMO_CODIGO_DIGITADO) }).success).toBe(true)
  })

  it('P5: escolaId, turmaId, campo a mais, os dois caminhos juntos ou nenhum deles não passam', () => {
    for (const corpo of [
      { slug: 'a', token, escolaId: UM_ID },
      { slug: 'a', codigo: 'ABCD2345', turmaId: UM_ID },
      { slug: 'a', token, codigo: 'ABCD2345' },
      { slug: 'a' },
      { token },
      { slug: '', token },
      { slug: 'a', codigo: '' },
      { slug: 'a', token: '' },
      { slug: 'a', codigo: 'x'.repeat(TAMANHO_MAXIMO_CODIGO_DIGITADO + 1) },
      { slug: 'a', token: 'x'.repeat(TAMANHO_MAXIMO_TOKEN_DE_CONVITE + 1) },
      { slug: 'a'.repeat(TAMANHO_MAXIMO_SLUG_NO_LOGIN + 1), token },
    ]) {
      expect(abrirSalaRequestSchema.safeParse(corpo).success, JSON.stringify(Object.keys(corpo))).toBe(false)
    }
  })

  it('a resposta é estrita: nome da turma e nomes com id e nome, sem matrícula nem id de turma, até o teto', () => {
    const nome = { id: UM_ID, nome: 'Ana' }
    expect(salaAbertaResponseSchema.safeParse({ turma: { nome: '2ºB' }, nomes: [nome] }).success).toBe(true)
    expect(salaAbertaResponseSchema.safeParse({ turma: { nome: '2ºB' }, nomes: [{ ...nome, matricula: '123' }] }).success).toBe(false)
    expect(salaAbertaResponseSchema.safeParse({ turma: { nome: '2ºB', id: UM_ID }, nomes: [] }).success).toBe(false)
    expect(salaAbertaResponseSchema.safeParse({ turma: { nome: '2ºB' }, nomes: [{ id: nome.id, nome: null }] }).success).toBe(false)
    expect(salaAbertaResponseSchema.safeParse({ turma: { nome: '2ºB' }, nomes: Array.from({ length: MAXIMO_DE_NOMES_NA_SALA + 1 }, () => nome) }).success).toBe(false)
  })
})

describe('contrato de salas/reivindicar (A1, tarefa 6.0)', () => {
  const token = 'A'.repeat(43)
  const UM_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'
  const CHAVE = '4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
  const campos = { listaNomeId: UM_ID, matricula: '2026-001', senha: 's'.repeat(TAMANHO_MINIMO_SENHA_NOVA), chaveEnvio: CHAVE }

  it('aceita a sala pelo token ou pelo código com o nome, a matrícula, a senha e a chave, e tira o espaço das pontas da matrícula', () => {
    expect(reivindicarSalaRequestSchema.parse({ slug: 'colegio-horizonte', token, ...campos })).toEqual({ slug: 'colegio-horizonte', token, ...campos })
    expect(reivindicarSalaRequestSchema.parse({ slug: 'colegio-horizonte', codigo: 'abcd 2345', ...campos, matricula: ' 2026-001 ' })).toEqual({
      slug: 'colegio-horizonte',
      codigo: 'abcd 2345',
      ...campos,
    })
    expect(reivindicarSalaRequestSchema.safeParse({ slug: 'a', token, ...campos, matricula: 'm'.repeat(TAMANHO_MAXIMO_MATRICULA), senha: 's'.repeat(TAMANHO_MAXIMO_SENHA) }).success).toBe(true)
  })

  it('P5 e E21: campo a mais, escola ou turma no corpo, os dois caminhos, chave ou nome fora de UUID, senha curta ou longa e matrícula vazia não passam', () => {
    for (const [caso, corpo] of [
      ['escolaId', { slug: 'a', token, ...campos, escolaId: UM_ID }],
      ['turmaId', { slug: 'a', codigo: 'ABCD2345', ...campos, turmaId: UM_ID }],
      ['campo a mais', { slug: 'a', token, ...campos, nome: 'Ana' }],
      ['token e código', { slug: 'a', token, codigo: 'ABCD2345', ...campos }],
      ['sem token nem código', { slug: 'a', ...campos }],
      ['chave que não é UUID', { slug: 'a', token, ...campos, chaveEnvio: 'chave-1' }],
      ['sem chave', { slug: 'a', token, listaNomeId: UM_ID, matricula: '1', senha: campos.senha }],
      ['nome que não é UUID', { slug: 'a', token, ...campos, listaNomeId: '1' }],
      ['senha curta', { slug: 'a', token, ...campos, senha: 's'.repeat(TAMANHO_MINIMO_SENHA_NOVA - 1) }],
      ['senha longa', { slug: 'a', token, ...campos, senha: 's'.repeat(TAMANHO_MAXIMO_SENHA + 1) }],
      ['matrícula em branco', { slug: 'a', token, ...campos, matricula: '   ' }],
      ['matrícula longa', { slug: 'a', token, ...campos, matricula: 'm'.repeat(TAMANHO_MAXIMO_MATRICULA + 1) }],
      ['matrícula com quebra de linha', { slug: 'a', token, ...campos, matricula: '2026\n001' }],
      ['token vazio', { slug: 'a', token: '', ...campos }],
      ['código longo', { slug: 'a', codigo: 'x'.repeat(TAMANHO_MAXIMO_CODIGO_DIGITADO + 1), ...campos }],
    ] as const) {
      expect(reivindicarSalaRequestSchema.safeParse(corpo).success, caso).toBe(false)
    }
  })

  it('a resposta é só enviado, estrita', () => {
    expect(reivindicacaoResponseSchema.safeParse({ resultado: 'enviado' }).success).toBe(true)
    expect(reivindicacaoResponseSchema.safeParse({ resultado: 'aprovado' }).success).toBe(false)
    expect(reivindicacaoResponseSchema.safeParse({ resultado: 'enviado', id: UM_ID }).success).toBe(false)
  })
})
