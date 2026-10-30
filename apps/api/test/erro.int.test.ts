import 'reflect-metadata'
import { currentContext, createLogger, DomainException, RequirePermissao, Public, DEFAULT_RETRY_AFTER_SECONDS, type DatabasePool } from '@educa/nucleo'
import { ErrorCode, InvariantException, MENSAGENS_DE_ERRO } from '@educa/shared'
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Module,
  Post,
  Query,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { randomUUID } from 'node:crypto'
import { setTimeout as esperar } from 'node:timers/promises'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { POOL_BANCO } from '../src/banco.module.js'
import { configurarAplicacao } from '../src/configurar-app.js'
import { configuracaoDeTeste } from './configuracao-de-teste.js'
import { BancadaDeSessoes } from './sessao-de-teste.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const TABELA = `teste_erro_${Date.now()}`
const NOME_SINTETICO = 'Enzo Martins'
const MOTIVO_DA_INVARIANTE = 'turma gravada sem a linha de volta'

// Escola sintética que o cliente tenta injetar pelo cabeçalho: não precisa existir.
const ESCOLA_INJETADA = '0190f5a0-0000-7000-8000-00000000000b'

const linhasDeLog: string[] = []
const registrador = createLogger({ servico: 'api-teste', destino: { write: (linha: string) => linhasDeLog.push(linha) } })
const registros = () => linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>)

// Anônimo: este arquivo prova o erro e o log; a autenticação é provada em contexto.int.test.ts.
@Public()
@Controller('teste')
class ControladorDeTeste {
  constructor(@Inject(POOL_BANCO) private readonly pool: DatabasePool) {}

  @Get('excecao')
  lancar(): never {
    throw new Error(`falhou ao gravar ${NOME_SINTETICO} com select * from aluno where nome = '${NOME_SINTETICO}'`)
  }

  @Get('invariante')
  invariante(): never {
    throw new InvariantException(MOTIVO_DA_INVARIANTE)
  }

  @Get('dominio/limite')
  limite(): never {
    throw new DomainException(ErrorCode.LIMITE_EXCEDIDO)
  }

  @Get('dominio/conflito-422')
  conflitoComStatus(): never {
    throw new DomainException(ErrorCode.CONFLITO, 422)
  }

  @Get('http/nao-autenticado')
  naoAutenticado(): never {
    throw new UnauthorizedException('token de Enzo Martins recusado')
  }

  @Get('http/proibido')
  proibido(): never {
    throw new ForbiddenException('turma de outra escola')
  }

  @Post('aluno')
  async inserir(@Body() corpo: { nome: string }): Promise<{ ok: true }> {
    await this.pool.query(`insert into ${TABELA} (nome) values ($1)`, [corpo.nome])
    return { ok: true }
  }

  @Get('lenta')
  async lenta(): Promise<never> {
    await this.pool.query('select pg_sleep(2)')
    throw new Error('não deveria chegar aqui')
  }
}

/** Sem `@Public()`: a escola de cada requisição vem da sessão do token, como em qualquer rota real. */
@Controller('teste-autenticado')
class ControladorDeEco {
  constructor(@Inject(POOL_BANCO) private readonly pool: DatabasePool) {}

  @Get('eco')
  @RequirePermissao('sistema_contexto', 'ler')
  async eco(@Query('indice') indice: string): Promise<{ requisicaoId: string }> {
    // Esperas desencontradas e fixas por índice: sem isolamento real do contexto, as linhas
    // trocariam de requisição, e sempre do mesmo jeito.
    const posicao = Number(indice)
    await esperar((posicao * 7) % 13)
    registrador.info({ evento: 'teste.eco', etapa: 1 })
    await this.pool.query('select 1')
    await esperar((posicao * 5) % 11)
    registrador.info({ evento: 'teste.eco', etapa: 2 })
    return { requisicaoId: currentContext()?.requisicaoId ?? '' }
  }
}

function esperarEnvelopeSemVazamento(corpo: unknown, codigo: ErrorCode): string {
  expect(corpo).toEqual({
    erro: { codigo, mensagem: MENSAGENS_DE_ERRO[codigo], requisicaoId: expect.stringMatching(UUID) },
  })
  return (corpo as { erro: { requisicaoId: string } }).erro.requisicaoId
}

describe('erro tipado e log sem dado pessoal', () => {
  let app: INestApplication
  const bancada = new BancadaDeSessoes()

  beforeAll(async () => {
    @Module({
      imports: [AppModule.com(configuracaoDeTeste({ banco: { timeoutConexaoMs: 1_000, timeoutConsultaMs: 300 } }))],
      controllers: [ControladorDeTeste, ControladorDeEco],
    })
    class ModuloDeTeste {}

    app = await NestFactory.create(ModuloDeTeste, { logger: false })
    configurarAplicacao(app, registrador)
    // Um servidor só, já ouvindo: sem isso o supertest abre uma porta por requisição, e 50 em
    // paralelo esbarram no backlog do sistema (ECONNRESET) em vez de testar o contexto.
    await app.listen(0, '127.0.0.1')
    const pool = app.get<DatabasePool>(POOL_BANCO)
    await pool.query(`create table ${TABELA} (id uuid primary key default gen_random_uuid(), nome text not null constraint ${TABELA}_nome_key unique)`)
  })

  afterAll(async () => {
    await app.get<DatabasePool>(POOL_BANCO).query(`drop table if exists ${TABELA}`)
    await app.close()
    await bancada.fechar()
  })

  beforeEach(() => {
    linhasDeLog.length = 0
  })

  it('exceção não tratada vira ERRO_INTERNO 500 com requisicaoId, sem stack, consulta nem valor', async () => {
    const resposta = await request(app.getHttpServer()).get('/teste/excecao')

    expect(resposta.status).toBe(500)
    const requisicaoId = esperarEnvelopeSemVazamento(resposta.body, ErrorCode.ERRO_INTERNO)
    for (const proibido of [NOME_SINTETICO, 'select', 'at ', '.ts:', 'Error']) {
      expect(resposta.text).not.toContain(proibido)
    }

    const [linha] = registros().filter((registro) => registro.evento === 'http.erro')
    expect(linha).toMatchObject({ requisicaoId, status: 500, codigo: ErrorCode.ERRO_INTERNO, erro: { tipo: 'Error' } })
    expect(linhasDeLog.join('')).not.toContain(NOME_SINTETICO)
    expect(linhasDeLog.join('')).not.toContain('select * from')
  })

  it('ErroDeInvariante vira ERRO_INTERNO 500 sem o motivo na resposta, e o log leva só o nome da classe', async () => {
    const resposta = await request(app.getHttpServer()).get('/teste/invariante')

    expect(resposta.status).toBe(500)
    // O corpo é lido como texto antes do envelope: o filtro que põe o nome da classe na resposta cai aqui, no nome, e não
    // na igualdade estrita da mensagem.
    expect(resposta.text).not.toContain(MOTIVO_DA_INVARIANTE)
    expect(resposta.text).not.toContain('InvariantException')
    const requisicaoId = esperarEnvelopeSemVazamento(resposta.body, ErrorCode.ERRO_INTERNO)

    const [linha] = registros().filter((registro) => registro.evento === 'http.erro')
    expect(linha).toMatchObject({ requisicaoId, status: 500, codigo: ErrorCode.ERRO_INTERNO, erro: { tipo: 'InvariantException' } })
    expect(linhasDeLog.join('')).not.toContain(MOTIVO_DA_INVARIANTE)
  })

  it('ErroDeDominio lançado pelo código sai com o próprio código e status, e o status informado vale', async () => {
    const limite = await request(app.getHttpServer()).get('/teste/dominio/limite')
    expect(limite.status).toBe(429)
    esperarEnvelopeSemVazamento(limite.body, ErrorCode.LIMITE_EXCEDIDO)
    // Quem lançou não disse quanto esperar: sai o padrão, e o cliente não repete na hora.
    expect(limite.headers['retry-after']).toBe(String(DEFAULT_RETRY_AFTER_SECONDS))

    const conflito = await request(app.getHttpServer()).get('/teste/dominio/conflito-422')
    expect(conflito.status).toBe(422)
    esperarEnvelopeSemVazamento(conflito.body, ErrorCode.CONFLITO)
    expect(conflito.headers['retry-after']).toBeUndefined()
  })

  it('violação de unicidade com "Enzo Martins" no detail vira CONFLITO 409, sem o valor na resposta nem no log', async () => {
    const primeira = await request(app.getHttpServer()).post('/teste/aluno').send({ nome: NOME_SINTETICO })
    expect(primeira.status).toBe(201)

    const repetida = await request(app.getHttpServer()).post('/teste/aluno').send({ nome: NOME_SINTETICO })

    expect(repetida.status).toBe(409)
    const requisicaoId = esperarEnvelopeSemVazamento(repetida.body, ErrorCode.CONFLITO)
    expect(repetida.text).not.toContain(NOME_SINTETICO)
    expect(repetida.text).not.toContain(TABELA)

    const [linha] = registros().filter((registro) => registro.evento === 'http.erro')
    expect(linha).toMatchObject({
      requisicaoId,
      status: 409,
      codigo: ErrorCode.CONFLITO,
      erro: { tipo: 'ErroDoPostgres', sqlstate: '23505', constraint: `${TABELA}_nome_key` },
    })
    const bruto = linhasDeLog.join('')
    expect(bruto).not.toContain(NOME_SINTETICO)
    expect(bruto).not.toContain('already exists')
    expect(bruto).not.toContain('duplicate key')
  })

  it('consulta cortada pelo statement_timeout vira TEMPO_ESGOTADO 503, com Retry-After', async () => {
    const resposta = await request(app.getHttpServer()).get('/teste/lenta')

    expect(resposta.status).toBe(503)
    esperarEnvelopeSemVazamento(resposta.body, ErrorCode.TEMPO_ESGOTADO)
    expect(resposta.headers['retry-after']).toBe(String(DEFAULT_RETRY_AFTER_SECONDS))
    expect(registros().find((registro) => registro.evento === 'http.erro')).toMatchObject({ erro: { sqlstate: '57014' } })
  })

  it('rota inexistente e corpo JSON inválido também saem no envelope, sem ecoar o que o cliente mandou', async () => {
    const inexistente = await request(app.getHttpServer()).get(`/teste/${encodeURIComponent(NOME_SINTETICO)}`)
    expect(inexistente.status).toBe(404)
    esperarEnvelopeSemVazamento(inexistente.body, ErrorCode.NAO_ENCONTRADO)
    expect(inexistente.text).not.toContain('Enzo')
    const logDo404 = registros().find((registro) => registro.evento === 'http.erro' && registro.status === 404)
    expect(logDo404).toMatchObject({ codigo: ErrorCode.NAO_ENCONTRADO, erro: { tipo: 'NotFoundException' } })
    expect(logDo404).not.toHaveProperty('erro.pilha')

    const corpoInvalido = await request(app.getHttpServer())
      .post('/teste/aluno')
      .set('Content-Type', 'application/json')
      .send(`{"nome": "${NOME_SINTETICO}"`)
    expect(corpoInvalido.status).toBe(400)
    esperarEnvelopeSemVazamento(corpoInvalido.body, ErrorCode.ENTRADA_INVALIDA)
    expect(corpoInvalido.text).not.toContain(NOME_SINTETICO)
    expect(linhasDeLog.join('')).not.toContain(NOME_SINTETICO)
  })

  it('401 de exceção HTTP vira NAO_AUTENTICADO, sem o texto da exceção', async () => {
    const resposta = await request(app.getHttpServer()).get('/teste/http/nao-autenticado')
    expect(resposta.status).toBe(401)
    esperarEnvelopeSemVazamento(resposta.body, ErrorCode.NAO_AUTENTICADO)
    expect(resposta.text).not.toContain(NOME_SINTETICO)
  })

  it('403 responde igual a rota inexistente: 404 NAO_ENCONTRADO, sem confirmar que o objeto existe', async () => {
    const proibido = await request(app.getHttpServer()).get('/teste/http/proibido')
    const inexistente = await request(app.getHttpServer()).get('/teste/http/nao-existe')

    expect(proibido.status).toBe(404)
    esperarEnvelopeSemVazamento(proibido.body, ErrorCode.NAO_ENCONTRADO)
    const semRequisicaoId = (corpo: { erro: Record<string, unknown> }) => ({ ...corpo.erro, requisicaoId: undefined })
    expect(semRequisicaoId(proibido.body)).toEqual(semRequisicaoId(inexistente.body))
    expect(proibido.headers['content-type']).toBe(inexistente.headers['content-type'])
    expect(proibido.text).not.toContain('outra escola')
  })

  it('50 requisições das escolas A e B em paralelo: cada linha de log tem o próprio requisicaoId e a própria escola', async () => {
    const sessaoA = await bancada.escolaComSessao()
    const sessaoB = await bancada.escolaComSessao()
    const enviadas = Array.from({ length: 50 }, (_, indice) => ({
      requisicaoId: randomUUID(),
      escolaId: indice % 2 === 0 ? sessaoA.escolaId : sessaoB.escolaId,
    }))

    const tokenDa = new Map([sessaoA, sessaoB].map((sessao) => [sessao.escolaId, sessao.token] as const))
    const respostas = await Promise.all(
      enviadas.map(({ requisicaoId, escolaId }, indice) =>
        request(app.getHttpServer())
          .get(`/teste-autenticado/eco?indice=${indice}`)
          .set('X-Requisicao-Id', requisicaoId)
          .set('Authorization', `Bearer ${tokenDa.get(escolaId) ?? ''}`),
      ),
    )

    const escolaDaRequisicao = new Map<string, string>(enviadas.map(({ requisicaoId, escolaId }) => [requisicaoId, escolaId]))
    respostas.forEach((resposta, indice) => {
      expect(resposta.status).toBe(200)
      expect(resposta.body).toEqual({ requisicaoId: enviadas[indice]?.requisicaoId })
    })

    const linhas = registros().filter((registro) => registro.evento === 'teste.eco')
    expect(linhas).toHaveLength(100)
    const linhasPorRequisicao = new Map<unknown, number>()
    for (const linha of linhas) {
      const escolaEsperada = escolaDaRequisicao.get(String(linha.requisicaoId))
      expect(escolaEsperada).toBeDefined()
      expect(linha.escolaId).toBe(escolaEsperada)
      linhasPorRequisicao.set(linha.requisicaoId, (linhasPorRequisicao.get(linha.requisicaoId) ?? 0) + 1)
    }
    expect(linhasPorRequisicao.size).toBe(50)
    expect([...linhasPorRequisicao.values()].every((total) => total === 2)).toBe(true)
  })

  it('X-Requisicao-Id fora do formato UUID é substituído, e o texto enviado não chega ao log nem à resposta', async () => {
    const injetado = `${randomUUID()}","escolaId":"${ESCOLA_INJETADA}`

    const resposta = await request(app.getHttpServer()).get('/teste/excecao').set('X-Requisicao-Id', injetado)

    const requisicaoId = esperarEnvelopeSemVazamento(resposta.body, ErrorCode.ERRO_INTERNO)
    expect(requisicaoId).not.toBe(injetado)
    expect(injetado).not.toContain(requisicaoId)
    const bruto = linhasDeLog.join('')
    expect(bruto).not.toContain(injetado)
    expect(bruto).not.toContain(ESCOLA_INJETADA)
    expect(registros().find((registro) => registro.evento === 'http.erro')).toMatchObject({ requisicaoId })
  })
})
