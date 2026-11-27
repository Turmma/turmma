import { ErrorCode } from '@educa/shared'
import type { ArgumentsHost } from '@nestjs/common'
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { SemConexaoComOBancoError } from '../db/sem-conexao.error.js'
import type { LoggerBase } from '../log/logger.js'
import { DEFAULT_RETRY_AFTER_SECONDS } from './domain.exception.js'
import { AllExceptionsFilter } from './all-exceptions.filter.js'

function responder(excecao: unknown) {
  const cabecalhos = new Map<string, string>()
  const resposta = {
    headersSent: false,
    statusCode: 0,
    corpo: '',
    setHeader: (nome: string, valor: string) => cabecalhos.set(nome.toLowerCase(), valor),
    end(texto: string) {
      resposta.corpo = texto
    },
  }
  const linhas: Array<{ nivel: string; campos: Record<string, unknown> }> = []
  const registrador = {
    error: (campos: Record<string, unknown>) => linhas.push({ nivel: 'error', campos }),
    warn: (campos: Record<string, unknown>) => linhas.push({ nivel: 'warn', campos }),
  } as unknown as LoggerBase
  const host = { getType: () => 'http', switchToHttp: () => ({ getResponse: () => resposta }) } as unknown as ArgumentsHost
  new AllExceptionsFilter(registrador).catch(excecao, host)
  return { status: resposta.statusCode, codigo: (JSON.parse(resposta.corpo) as { erro: { codigo: string } }).erro.codigo, cabecalhos, linhas }
}

describe('AllExceptionsFilter: o pool que não entrega conexão', () => {
  it('SemConexaoComOBancoError vira 503 INDISPONIVEL_TENTE_DE_NOVO com Retry-After', () => {
    const { status, codigo, cabecalhos, linhas } = responder(new SemConexaoComOBancoError(new Error('timeout exceeded when trying to connect')))

    expect(status).toBe(503)
    expect(codigo).toBe(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    expect(cabecalhos.get('retry-after')).toBe(String(DEFAULT_RETRY_AFTER_SECONDS))
    // O log leva o resumo do erro, e nunca a mensagem dele.
    expect(linhas[0]?.campos).toMatchObject({ status: 503, codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, erro: { tipo: 'SemConexaoComOBancoError' } })
    expect(linhas[0]?.campos['erro']).not.toHaveProperty('mensagem')
  })

  it('a recusa do servidor na conexão (SQLSTATE 53300 em cause) também é 503, e não o ERRO_INTERNO do mapa do SQLSTATE', () => {
    const recusa = Object.assign(new pg.DatabaseError('sorry, too many clients already', 0, 'error'), { severity: 'FATAL', code: '53300' })
    const { status, codigo, cabecalhos, linhas } = responder(new SemConexaoComOBancoError(recusa))

    expect(status).toBe(503)
    expect(codigo).toBe(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    expect(cabecalhos.get('retry-after')).toBe(String(DEFAULT_RETRY_AFTER_SECONDS))
    // O log mostra o SQLSTATE da recusa, que é o que diz ao operador por que a conexão não saiu.
    expect(linhas[0]?.campos).toMatchObject({ erro: { sqlstate: '53300' } })
  })

  it('o texto do pg-pool não decide: o Error comum com a mesma mensagem continua ERRO_INTERNO 500', () => {
    const { status, codigo, cabecalhos } = responder(new Error('timeout exceeded when trying to connect'))

    expect(status).toBe(500)
    expect(codigo).toBe(ErrorCode.ERRO_INTERNO)
    expect(cabecalhos.has('retry-after')).toBe(false)
  })
})
