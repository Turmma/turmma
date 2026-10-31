import { EventEmitter } from 'node:events'
import pg from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { createPool, isConnectionError, type DatabasePool } from './pool.js'

function erroDoServidor(code: string, severity: string): pg.DatabaseError {
  return Object.assign(new pg.DatabaseError('mensagem', 0, 'error'), { code, severity })
}

describe('ehErroDeConexao', () => {
  it.each([
    ['violação de unicidade', '23505'],
    ['cancelada pelo statement_timeout', '57014'],
    ['sintaxe', '42601'],
    ['conflito de serialização', '40001'],
  ])('mantém a conexão depois de erro de consulta: %s', (_caso, code) => {
    expect(isConnectionError(erroDoServidor(code, 'ERROR'))).toBe(false)
  })

  it.each([
    ['pg_terminate_backend', '57P01', 'FATAL'],
    ['servidor em recuperação', '57P03', 'FATAL'],
    ['falha de conexão', '08006', 'ERROR'],
    ['erro interno', 'XX000', 'ERROR'],
    ['transação ociosa por tempo demais', '25P03', 'FATAL'],
    ['transação abortada', '25P02', 'ERROR'],
    ['FATAL com texto traduzido, SQLSTATE de conexão', '57P01', 'FATAL'],
    ['PANIC', '58000', 'PANIC'],
  ])('descarta a conexão depois de erro que encerra a sessão: %s', (_caso, code, severity) => {
    expect(isConnectionError(erroDoServidor(code, severity))).toBe(true)
  })

  it('descarta a conexão em erro que não veio do servidor: socket e timeout do cliente', () => {
    expect(isConnectionError(new Error('Connection terminated unexpectedly'))).toBe(true)
    expect(isConnectionError(new Error('Query read timeout'))).toBe(true)
  })
})

describe('criarPool: ReadyForQuery que chega depois do erro da consulta', () => {
  // O pg rejeita a consulta no ErrorResponse. Sob carga, o ReadyForQuery (com o estado da
  // transação) chega em outro pacote TCP: a conexão só pode voltar ao pool depois dele.
  const pools: DatabasePool[] = []
  afterEach(async () => {
    await Promise.all(pools.splice(0).map((pool) => pool.end()))
  })

  function poolComConexaoFalsa(estadoDepoisDoErro: 'I' | 'E', atrasoDoReadyForQueryMs: number | null) {
    const protocolo = new EventEmitter()
    let estado = 'I'
    const liberacoes: Array<Error | boolean | undefined> = []
    const conexao = {
      readyForQuery: true,
      connection: protocolo,
      on: () => conexao,
      off: () => conexao,
      getTransactionStatus: () => estado,
      release: (erro?: Error | boolean) => liberacoes.push(erro),
      query: async () => {
        conexao.readyForQuery = false
        if (atrasoDoReadyForQueryMs !== null) {
          setTimeout(() => {
            estado = estadoDepoisDoErro
            conexao.readyForQuery = true
            protocolo.emit('readyForQuery')
          }, atrasoDoReadyForQueryMs)
        }
        throw erroDoServidor('23505', 'ERROR')
      },
    }
    const pool = createPool({ url: 'postgres://sintetico:sintetico@127.0.0.1:1/sintetico', maximoConexoes: 1, timeoutConexaoMs: 300, timeoutConsultaMs: 300 }, () => undefined)
    pools.push(pool)
    pool.connect = (async () => conexao) as unknown as typeof pool.connect
    return { pool, liberacoes }
  }

  it('descarta a sessão que o ReadyForQuery atrasado mostra com transação abortada', async () => {
    const { pool, liberacoes } = poolComConexaoFalsa('E', 50)
    await expect(pool.query(`begin; insert into t (nome) values ('Enzo Martins'); commit`)).rejects.toMatchObject({ code: '23505' })
    expect(liberacoes).toHaveLength(1)
    expect(liberacoes[0]).toBeInstanceOf(Error)
  })

  it('devolve limpa a sessão que o ReadyForQuery atrasado mostra ociosa, depois de uma violação de unicidade simples', async () => {
    const { pool, liberacoes } = poolComConexaoFalsa('I', 50)
    await expect(pool.query(`insert into t (nome) values ('Enzo Martins')`)).rejects.toMatchObject({ code: '23505' })
    expect(liberacoes).toEqual([undefined])
  })

  it('descarta a sessão quando o ReadyForQuery não chega no prazo: estado desconhecido não volta ao pool', async () => {
    const { pool, liberacoes } = poolComConexaoFalsa('I', null)
    await expect(pool.query(`insert into t (nome) values ('Enzo Martins')`)).rejects.toMatchObject({ code: '23505' })
    expect(liberacoes).toHaveLength(1)
    expect(liberacoes[0]).toBeInstanceOf(Error)
  })
})
