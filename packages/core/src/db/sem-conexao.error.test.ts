import { DrizzleQueryError } from 'drizzle-orm/errors'
import { describe, expect, it } from 'vitest'
import { SemConexaoComOBancoError, semConexaoIn } from './sem-conexao.error.js'

describe('semConexaoIn', () => {
  const erro = new SemConexaoComOBancoError(new Error('timeout exceeded when trying to connect'))

  it('reconhece o erro solto', () => {
    expect(semConexaoIn(erro)).toBe(erro)
  })

  it('reconhece o erro embrulhado pelo Drizzle, que o guarda em cause com a consulta e os parâmetros', () => {
    expect(semConexaoIn(new DrizzleQueryError('select $1', ['Enzo Martins'], erro))).toBe(erro)
  })

  it('não reconhece pelo texto: o Error do pg-pool com a mesma mensagem não é o erro tipado', () => {
    expect(semConexaoIn(new Error('timeout exceeded when trying to connect'))).toBeUndefined()
    expect(semConexaoIn(new Error('qualquer', { cause: new Error('timeout exceeded when trying to connect') }))).toBeUndefined()
  })

  it('não reconhece o que não é erro, nem lança', () => {
    expect(semConexaoIn(undefined)).toBeUndefined()
    expect(semConexaoIn(null)).toBeUndefined()
    expect(semConexaoIn('sem conexão com o banco')).toBeUndefined()
  })

  it('a mensagem não repete a do erro original, que pode trazer o endereço do servidor', () => {
    expect(new SemConexaoComOBancoError(new Error('connect ECONNREFUSED 10.0.0.7:5432')).message).not.toContain('10.0.0.7')
  })
})
