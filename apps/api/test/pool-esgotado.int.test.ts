import 'reflect-metadata'
import { createLogger, DEFAULT_RETRY_AFTER_SECONDS, RequirePermissao, type Database, type DatabasePool } from '@educa/core'
import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { Controller, Get, Inject, Module, Post, type INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { sql } from 'drizzle-orm'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { configureApp } from '../src/configure-app.js'
import { DB, DB_POOL } from '../src/database.module.js'
import { SessaoFixtures } from './sessao.fixture.js'
import { testConfig } from './test-config.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const TABELA = `teste_pool_esgotado_${Date.now()}`
const NOME_SINTETICO = 'Enzo Martins'

/**
 * Cada rota segura a única conexão do pool e pede outra: é o que o PUT de uma resposta faz quando a volta da queda
 * acumula requisições e o pool não entrega a conexão no prazo (`timeoutConexaoMs`). A sessão é lida e devolvida antes,
 * então quem falha é o código da rota, e não o `SessaoGuard`.
 */
@Controller('teste-pool')
class ControladorDoPool {
  constructor(
    @Inject(DB_POOL) private readonly pool: DatabasePool,
    @Inject(DB) private readonly db: Database,
  ) {}

  @Get('consulta')
  @RequirePermissao('sistema_contexto', 'ler')
  async consulta(): Promise<never> {
    const presa = await this.pool.connect()
    try {
      await this.pool.query('select 1')
    } finally {
      presa.release()
    }
    throw new Error('o pool de uma conexão não podia entregar a segunda')
  }

  @Get('transacao')
  @RequirePermissao('sistema_contexto', 'ler')
  async transacao(): Promise<never> {
    const presa = await this.pool.connect()
    try {
      await this.db.transaction(async (tx) => {
        await tx.execute(sql`select 1`)
      })
    } finally {
      presa.release()
    }
    throw new Error('o pool de uma conexão não podia entregar a segunda')
  }

  @Get('drizzle')
  @RequirePermissao('sistema_contexto', 'ler')
  async drizzle(): Promise<never> {
    const presa = await this.pool.connect()
    try {
      await this.db.execute(sql`select ${NOME_SINTETICO}`)
    } finally {
      presa.release()
    }
    throw new Error('o pool de uma conexão não podia entregar a segunda')
  }

  @Post('aluno')
  @RequirePermissao('sistema_contexto', 'ler')
  async inserir(): Promise<{ ok: true }> {
    await this.pool.query(`insert into ${TABELA} (nome) values ($1)`, [NOME_SINTETICO])
    return { ok: true }
  }
}

describe('pool sem conexão no prazo: 503 INDISPONIVEL_TENTE_DE_NOVO com Retry-After, e não 500', () => {
  const bancada = new SessaoFixtures()
  const linhasDeLog: string[] = []
  let app: INestApplication
  let url: string
  let token: string

  beforeAll(async () => {
    @Module({
      imports: [AppModule.forRoot(testConfig({ banco: { maximoConexoes: 1, timeoutConexaoMs: 300, timeoutConsultaMs: 1_000 } }))],
      controllers: [ControladorDoPool],
    })
    class ModuloDeTeste {}
    app = await NestFactory.create(ModuloDeTeste, { logger: false })
    configureApp(app, createLogger({ servico: 'api-teste', destino: { write: (linha: string) => linhasDeLog.push(linha) } }))
    await app.listen(0, '127.0.0.1')
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
    token = (await bancada.escolaComSessao('professor')).token
    await app.get<DatabasePool>(DB_POOL).query(`create table ${TABELA} (nome text primary key)`)
  })

  afterAll(async () => {
    await app.get<DatabasePool>(DB_POOL).query(`drop table if exists ${TABELA}`)
    await app.close()
    await bancada.fechar()
  })

  async function chamar(metodo: 'GET' | 'POST', rota: string) {
    const resposta = await fetch(`${url}/teste-pool/${rota}`, { method: metodo, headers: { Authorization: `Bearer ${token}` } })
    return { status: resposta.status, retryAfter: resposta.headers.get('retry-after'), texto: await resposta.text() }
  }

  it.each([
    ['pool.query', 'consulta'],
    ['transação do Drizzle (pool.connect)', 'transacao'],
    ['consulta do Drizzle, que embrulha o erro com a consulta e os parâmetros', 'drizzle'],
  ])('%s: o prazo do pool vira 503 INDISPONIVEL_TENTE_DE_NOVO com Retry-After, sem pilha nem consulta', async (_caso, rota) => {
    linhasDeLog.length = 0
    const resposta = await chamar('GET', rota)

    expect(resposta.status).toBe(503)
    expect(resposta.retryAfter).toBe(String(DEFAULT_RETRY_AFTER_SECONDS))
    expect(JSON.parse(resposta.texto)).toEqual({
      erro: { codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, mensagem: MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, requisicaoId: expect.stringMatching(UUID) },
    })
    for (const proibido of ['timeout', 'select', NOME_SINTETICO, 'at ', '.ts:']) expect(resposta.texto).not.toContain(proibido)
    const [linha] = linhasDeLog.map((registro) => JSON.parse(registro) as Record<string, unknown>).filter((registro) => registro.evento === 'http.erro')
    expect(linha).toMatchObject({ status: 503, codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO })
    // Nem o valor, nem a consulta que o Drizzle monta, nem o endereço do banco (que o erro do `pg` traz) chegam ao log.
    const bruto = linhasDeLog.join('')
    for (const proibido of [NOME_SINTETICO, 'select', '127.0.0.1']) expect(bruto).not.toContain(proibido)
  })

  it('a violação de unicidade continua CONFLITO 409, e o prazo do pool não a captura', async () => {
    expect((await chamar('POST', 'aluno')).status).toBe(201)
    const repetida = await chamar('POST', 'aluno')

    expect(repetida.status).toBe(409)
    expect(JSON.parse(repetida.texto).erro.codigo).toBe(ErrorCode.CONFLITO)
    expect(repetida.retryAfter).toBeNull()
  })
})
