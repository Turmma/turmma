import { ErrorCode } from '@educa/shared'
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { DomainException } from './erro-de-dominio.js'
import { mapPostgresError } from './mapear-erro-postgres.js'
import { summarizeError } from './resumir-erro.js'

function erroDoPostgres(code: string, campos: Record<string, string> = {}): pg.DatabaseError {
  const erro = new pg.DatabaseError('mensagem do servidor com Enzo Martins', 0, 'error')
  return Object.assign(erro, { severity: 'ERROR', code, ...campos })
}

describe('mapearErroPostgres', () => {
  it('traduz violação de unicidade em CONFLITO 409 sem carregar detail nem mensagem', () => {
    const erro = erroDoPostgres('23505', {
      constraint: 'aluno_turma_nome_key',
      detail: 'Key (nome)=(Enzo Martins) already exists.',
      where: 'Enzo Martins',
    })
    const mapeado = mapPostgresError(erro)
    expect(mapeado).toBeInstanceOf(DomainException)
    expect(mapeado).toMatchObject({ codigo: ErrorCode.CONFLITO, status: 409 })
    expect(JSON.stringify({ ...mapeado, message: mapeado?.message, stack: mapeado?.stack })).not.toContain('Enzo Martins')
  })

  it('traduz consulta cancelada pelo statement_timeout em TEMPO_ESGOTADO 503', () => {
    expect(mapPostgresError(erroDoPostgres('57014'))).toMatchObject({ codigo: ErrorCode.TEMPO_ESGOTADO, status: 503 })
  })

  it.each(['22P02', '23503', '40001', '42P01', '53300'])('traduz o SQLSTATE %s em ERRO_INTERNO 500', (code) => {
    expect(mapPostgresError(erroDoPostgres(code))).toMatchObject({ codigo: ErrorCode.ERRO_INTERNO, status: 500 })
  })

  it('não trata como Postgres erro comum nem erro de sistema do Node com código de cinco letras', () => {
    expect(mapPostgresError(new Error('qualquer'))).toBeUndefined()
    expect(mapPostgresError(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))).toBeUndefined()
    expect(mapPostgresError('23505')).toBeUndefined()
  })

  it('reconhece o erro do Postgres embrulhado pelo Drizzle, sem levar a consulta nem os parâmetros', async () => {
    const { DrizzleQueryError } = await import('drizzle-orm/errors')
    const embrulhado = new DrizzleQueryError('insert into aluno (nome) values ($1)', ['Enzo Martins'], erroDoPostgres('57014'))
    const mapeado = mapPostgresError(embrulhado)
    expect(mapeado).toMatchObject({ codigo: ErrorCode.TEMPO_ESGOTADO, status: 503 })
    expect(summarizeError(embrulhado)).toEqual({ tipo: 'ErroDoPostgres', sqlstate: '57014' })
    expect(JSON.stringify(summarizeError(embrulhado))).not.toContain('Enzo')
  })
})
