import type { EventEmitter } from 'node:events'
import pg from 'pg'
import { isPostgresError } from '../erro/resumir-erro.js'

export interface DatabaseConfig {
  url: string
  maximoConexoes: number
  timeoutConexaoMs: number
  timeoutConsultaMs: number
}

export type DatabasePool = pg.Pool

// SQLSTATE que encerram a sessão ou indicam estado do servidor em que não vale reaproveitá-la:
// classe 08 (conexão), 57P (servidor desligando, `pg_terminate_backend`, sessão ociosa), XX
// (erro interno), 25P03 (transação ociosa por tempo demais) e 25P02 (transação abortada, rede de
// segurança para o caso de o estado da transação não ter sido lido).
const SQLSTATE_DE_CONEXAO = /^(08|57P|XX|25P0[23])/

/**
 * `true` quando o erro deixou a conexão inutilizável: queda de socket, timeout do cliente
 * (a consulta pode seguir rodando no servidor e a resposta chegaria na consulta seguinte) ou
 * erro do servidor que encerra a sessão.
 *
 * Erro de consulta não é de conexão: violação de restrição única (23505), consulta cancelada
 * pelo `statement_timeout` (57014), sintaxe. O servidor já respondeu ReadyForQuery e a sessão
 * segue boa. A severidade entra só como reforço, porque o texto dela vem traduzido conforme o
 * `lc_messages` do servidor; o SQLSTATE não.
 */
export function isConnectionError(erro: unknown): boolean {
  if (!isPostgresError(erro)) return true
  return SQLSTATE_DE_CONEXAO.test(erro.code) || erro.severity === 'FATAL' || erro.severity === 'PANIC'
}

type Consulta = (...argumentos: unknown[]) => unknown

function ehSubmittable(valor: unknown): boolean {
  return typeof valor === 'object' && valor !== null && typeof (valor as { submit?: unknown }).submit === 'function'
}

/** O que o pg expõe em runtime e os tipos de `PoolClient` não declaram. */
interface ConexaoComProtocolo {
  readyForQuery?: boolean
  connection?: EventEmitter
}

/**
 * Espera o ReadyForQuery que o Postgres manda logo depois do ErrorResponse. O pg rejeita a
 * consulta ao ler o ErrorResponse, antes do ReadyForQuery; quando os dois chegam em pacotes TCP
 * separados (rede sob carga), o estado da transação lido nesse intervalo ainda é o da consulta
 * anterior, e uma sessão com transação abortada voltaria ao pool como limpa.
 *
 * `false` se ele não chegou no prazo: a conexão não tem estado confiável e é descartada.
 */
function aguardarReadyForQuery(conexao: pg.PoolClient, limiteMs: number): Promise<boolean> {
  const { readyForQuery, connection: protocolo } = conexao as pg.PoolClient & ConexaoComProtocolo
  if (readyForQuery === true) return Promise.resolve(true)
  if (protocolo === undefined) return Promise.resolve(false)
  return new Promise((resolver) => {
    // O ouvinte do próprio cliente foi registrado na conexão antes deste: quando este roda, o
    // estado da transação já foi atualizado.
    const aoFicarPronta = (): void => {
      clearTimeout(prazo)
      resolver(true)
    }
    const prazo = setTimeout(() => {
      protocolo.off('readyForQuery', aoFicarPronta)
      resolver(false)
    }, limiteMs)
    protocolo.once('readyForQuery', aoFicarPronta)
  })
}

/**
 * `pg.Pool#query` devolve a conexão com o erro da consulta, e o pool descarta a conexão em
 * qualquer erro. Às 10h de uma segunda, com unicidade violada e consulta cortada pelo timeout
 * a toda hora, isso vira abertura de conexão em rajada (TLS e autenticação) justamente quando o
 * banco está sob carga. Aqui só o erro de conexão descarta; o de consulta devolve a conexão.
 *
 * Vale para a forma com promessa, que é a usada no projeto (e a do Drizzle). Callback e
 * consulta em stream seguem o comportamento original. Transação de verdade não passa por aqui:
 * usa `pool.connect()` e devolve a conexão explicitamente (ver `conexaoQueSaiNoErroDeConexao`).
 */
function consultaQueDevolveAConexao(pool: pg.Pool, limiteReadyForQueryMs: number): Consulta {
  const original = pool.query.bind(pool) as Consulta
  return async function consultar(...argumentos: unknown[]): Promise<unknown> {
    if (typeof argumentos.at(-1) === 'function' || ehSubmittable(argumentos[0])) {
      return original(...argumentos)
    }
    const [textoOuConfiguracao, valores] = argumentos as [string | pg.QueryConfig, unknown[] | undefined]
    const conexao = await pool.connect()
    // Enquanto a conexão está emprestada, o pool não ouve o 'error' dela. Sem ouvinte, a queda
    // do socket no meio da consulta encerraria o processo.
    let erroDaConexao: Error | undefined
    const aoErroDaConexao = (erro: Error): void => {
      erroDaConexao = erro
    }
    conexao.on('error', aoErroDaConexao)
    let descartarCom: Error | undefined
    try {
      return await conexao.query(textoOuConfiguracao, valores)
    } catch (erro) {
      if (isConnectionError(erro)) {
        descartarCom = erro instanceof Error ? erro : new Error('consulta falhou')
      } else if (!(await aguardarReadyForQuery(conexao, limiteReadyForQueryMs))) {
        descartarCom = new Error('sem ReadyForQuery depois do erro da consulta')
      }
      throw erro
    } finally {
      conexao.off('error', aoErroDaConexao)
      // Sessão fora de "ociosa" não volta ao pool, com ou sem erro: `begin; ...; commit` que
      // falhou no meio deixa a transação abortada (E), e `pool.query('begin')` solto a deixa
      // aberta (T). Devolvida, ela faria toda consulta seguinte falhar com 25P02.
      const sessaoSuja = conexao.getTransactionStatus() !== 'I'
      conexao.release(erroDaConexao ?? descartarCom ?? (sessaoSuja ? new Error('sessão com transação pendente') : undefined))
    }
  }
}

/** A `query` do cliente antes da troca: o mesmo cliente volta ao pool e é emprestado de novo, e a troca não se empilha. */
const consultaDoCliente = new WeakMap<pg.PoolClient, Consulta>()

/**
 * `pool.connect()` na forma com promessa, que é a da transação do Drizzle, com a conexão emprestada saindo do pool no
 * primeiro erro de conexão de uma consulta (`isConnectionError`: timeout do cliente, socket, sessão encerrada) ou no
 * primeiro `'error'` da conexão, que o `pg` emite na queda do socket mesmo entre duas consultas da transação.
 *
 * O Drizzle manda o `begin` fora do `try` e só devolve a conexão no `finally` dele, sem erro. Com o Postgres travado, o
 * prazo do cliente (`query_timeout`) estoura com a consulta já enviada, e dois defeitos aparecem:
 * - `begin` que estoura: a conexão nunca é devolvida. Cada uma dessas esgota uma vaga do pool até a instância reiniciar,
 *   e o `pool.end()` do desligamento espera por ela para sempre;
 * - consulta do meio que estoura: o `rollback` estoura também e sai da fila sem ir ao servidor, e a conexão volta ao
 *   pool como boa, com a transação ainda aberta no servidor. O `commit` de quem a pega depois confirma a escrita da
 *   requisição que já respondeu 503.
 *
 * Aqui a conexão é devolvida com o erro na hora em que a consulta falha: o pool a descarta e a encerra, e o servidor
 * desfaz a transação ao perder a sessão. O `rollback` seguinte falha na hora, e o `release` do Drizzle no `finally` não
 * faz nada. Erro de consulta (unicidade, `statement_timeout`) não é de conexão: a transação segue e o `rollback` é do
 * Drizzle, como antes. A forma com callback, que o próprio `pg.Pool#query` usa por dentro, fica como está.
 */
function conexaoQueSaiNoErroDeConexao(pool: pg.Pool): typeof pool.connect {
  const original = pool.connect.bind(pool) as (...argumentos: unknown[]) => unknown
  return async function conectar(...argumentos: unknown[]): Promise<unknown> {
    if (typeof argumentos[0] === 'function') return original(...argumentos)
    const conexao = (await original()) as pg.PoolClient
    const devolverAoPool = conexao.release.bind(conexao)
    let devolvida = false
    // Emprestada, a conexão fica sem o ouvinte de 'error' do pool, e o `pg` emite 'error' em toda queda de socket, com
    // ou sem consulta em andamento. Sem ouvinte, um failover do Postgres com uma transação aberta encerraria o processo.
    const aoErroDaConexao = (erro: Error): void => devolver(erro)
    const devolver = (erro?: Error | boolean): void => {
      if (devolvida) return
      devolvida = true
      // Antes de devolver: o pool põe o ouvinte dele de volta, e o deste empréstimo não se acumula no cliente.
      conexao.off('error', aoErroDaConexao)
      devolverAoPool(erro)
    }
    conexao.on('error', aoErroDaConexao)
    const consultar = consultaDoCliente.get(conexao) ?? (conexao.query as Consulta)
    consultaDoCliente.set(conexao, consultar)
    conexao.release = devolver
    conexao.query = function (...argumentosDaConsulta: unknown[]): unknown {
      const resultado = consultar.apply(conexao, argumentosDaConsulta)
      if (typeof argumentosDaConsulta.at(-1) === 'function' || ehSubmittable(argumentosDaConsulta[0])) return resultado
      return (resultado as Promise<unknown>).catch((erro: unknown) => {
        if (isConnectionError(erro)) devolver(erro instanceof Error ? erro : new Error('consulta falhou'))
        throw erro
      })
    } as typeof conexao.query
    return conexao
  } as unknown as typeof pool.connect
}

/**
 * Pool único por processo. Os timeouts existem para que um Postgres travado vire resposta
 * rápida de indisponível, e não requisição pendurada ocupando o event loop na hora da aula.
 */
export function createPool(config: DatabaseConfig, aoPerderConexaoOciosa: () => void): DatabasePool {
  const pool = new pg.Pool({
    connectionString: config.url,
    max: config.maximoConexoes,
    connectionTimeoutMillis: config.timeoutConexaoMs,
    // O servidor cancela primeiro (57014) e libera o Postgres, e a conexão volta ao pool. O
    // timeout do cliente é o seguro para Postgres travado, que nem consegue cancelar: nesse
    // caso a conexão é descartada e o pool abre outra na próxima consulta.
    statement_timeout: config.timeoutConsultaMs,
    query_timeout: config.timeoutConsultaMs + config.timeoutConexaoMs,
    // Sem keepalive, conexão ociosa derrubada em silêncio por NAT só aparece no timeout da próxima consulta.
    keepAlive: true,
  })
  // Sem ouvinte, o 'error' de uma conexão ociosa que o Postgres derrubou encerra o processo.
  pool.on('error', aoPerderConexaoOciosa)
  // A assinatura sobrecarregada de `query` não tem como ser escrita sem `any`; o comportamento
  // é o mesmo em todas as formas, e os testes de integração cobrem a forma com promessa.
  pool.connect = conexaoQueSaiNoErroDeConexao(pool)
  pool.query = consultaQueDevolveAConexao(pool, config.timeoutConexaoMs) as unknown as typeof pool.query
  return pool
}

/** Consulta real ao banco: `true` só se o Postgres respondeu dentro do timeout. */
export async function pingDatabase(pool: DatabasePool): Promise<boolean> {
  try {
    await pool.query('select 1')
    return true
  } catch {
    return false
  }
}
