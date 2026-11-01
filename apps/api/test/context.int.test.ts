import 'reflect-metadata'
import { currentContext, createLogger, EMISSOR_TOKEN, TokenIssuer, RequirePermissao, Public } from '@educa/core'
import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { Controller, Get, Module, type INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { SignJWT } from 'jose'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { AppModule } from '../src/app.module.js'
import { configureApp } from '../src/configure-app.js'
import { testConfig } from './test-config.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const ambienteDeTeste = lerAmbienteDeTeste()

const linhasDeLog: string[] = []
const registrador = createLogger({ servico: 'api-teste', destino: { write: (linha: string) => linhasDeLog.push(linha) } })
const registros = () => linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>)

/** Sem `@Public()`: prova que rota nova nasce exigindo token. O `@RequirePermissao` é obrigatório no boot. */
@Controller('teste-protegido')
class ControladorSemMarcacao {
  @Get('eco')
  @RequirePermissao('sistema_contexto', 'ler')
  eco(): { escolaId: string | undefined } {
    registrador.info({ evento: 'teste.protegido' })
    return { escolaId: currentContext()?.escolaId }
  }
}

/** Rota anônima que mostra o contexto: prova que ele não herda escola de requisição anterior. */
@Public()
@Controller('teste-anonimo')
class ControladorAnonimo {
  @Get('contexto')
  contexto(): { escolaId: string | null; usuarioId: string | null } {
    return { escolaId: currentContext()?.escolaId ?? null, usuarioId: currentContext()?.usuarioId ?? null }
  }
}

async function subirApi(ambiente: Record<string, string> = {}): Promise<INestApplication> {
  @Module({ imports: [AppModule.forRoot(testConfig({ ambiente }))], controllers: [ControladorSemMarcacao, ControladorAnonimo] })
  class ModuloDeTeste {}

  const app = await NestFactory.create(ModuloDeTeste, { logger: false })
  configureApp(app, registrador)
  await app.listen(0, '127.0.0.1')
  return app
}

function tokenAssinadoComAChaveDoAmbiente(claims: Record<string, unknown>): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  return new SignJWT({ iss: EMISSOR_TOKEN, iat: agora, exp: agora + 600, ...claims })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(new TextEncoder().encode(ambienteDeTeste['IDENTIDADE_CHAVE_ASSINATURA']))
}

function esperarNaoAutenticado(resposta: request.Response): void {
  expect(resposta.status).toBe(401)
  expect(resposta.body).toEqual({
    erro: {
      codigo: ErrorCode.NAO_AUTENTICADO,
      mensagem: MENSAGENS_DE_ERRO.NAO_AUTENTICADO,
      requisicaoId: expect.stringMatching(UUID),
    },
  })
}

describe('identidade pela sessão do token e GET /v1/sistema/contexto', () => {
  const bancada = new SessaoFixtures()
  let app: INestApplication
  let a: TestSessao
  let b: TestSessao
  let tokenA: string
  let tokenB: string
  const esperadoDe = (sessao: TestSessao) => ({ escolaId: sessao.escolaId, usuarioId: sessao.usuarioId, papel: 'aluno', sessaoId: sessao.sessaoId, anoLetivoId: null })

  beforeAll(async () => {
    a = await bancada.escolaComSessao()
    b = await bancada.escolaComSessao()
    tokenA = a.token
    tokenB = b.token
    app = await subirApi()
  })

  afterAll(async () => {
    await app.close()
    await bancada.fechar()
  })

  beforeEach(() => {
    linhasDeLog.length = 0
  })

  it('o token da sessão chega ao contexto: /contexto devolve a escola, o usuário, o papel e a sessão dela', async () => {
    const resposta = await request(app.getHttpServer()).get('/v1/sistema/contexto').set('Authorization', `Bearer ${tokenA}`)

    expect(resposta.status).toBe(200)
    expect(resposta.body).toEqual(esperadoDe(a))
    expect(resposta.headers['cache-control']).toBe('no-store')
  })

  it('sem token, /contexto responde 401 NAO_AUTENTICADO', async () => {
    esperarNaoAutenticado(await request(app.getHttpServer()).get('/v1/sistema/contexto'))
  })

  it('rota sem @RotaAnonima exige token, e com ele o log da requisição leva a escola do token', async () => {
    esperarNaoAutenticado(await request(app.getHttpServer()).get('/teste-protegido/eco'))
    expect(registros().some((registro) => registro.evento === 'teste.protegido')).toBe(false)

    const autenticada = await request(app.getHttpServer()).get('/teste-protegido/eco').set('Authorization', `Bearer ${tokenB}`)
    expect(autenticada.body).toEqual({ escolaId: b.escolaId })
    expect(registros().find((registro) => registro.evento === 'teste.protegido')).toMatchObject({
      escolaId: b.escolaId,
      usuarioId: b.usuarioId,
    })
  })

  it('assinatura errada, token vencido, token sem esc ou sem sid e token sem sessão dão o mesmo 401, sem dizer o que falhou', async () => {
    const [cabecalho, corpo] = tokenA.split('.')
    const daSessaoA = { escolaId: a.escolaId, usuarioId: a.usuarioId, sessaoId: a.sessaoId }
    const tokens = {
      assinaturaErrada: (await new TokenIssuer(new TextEncoder().encode('outra_chave_sintetica_com_32_caracteres')).emitir(daSessaoA)).token,
      vencido: (await new TokenIssuer(new TextEncoder().encode(ambienteDeTeste['IDENTIDADE_CHAVE_ASSINATURA']), { agora: () => new Date(Date.now() - 11 * 60_000) }).emitir(daSessaoA)).token,
      semEsc: await tokenAssinadoComAChaveDoAmbiente({ sub: a.usuarioId, sid: a.sessaoId }),
      semSid: await tokenAssinadoComAChaveDoAmbiente({ sub: a.usuarioId, esc: a.escolaId }),
      semSessao: await tokenAssinadoComAChaveDoAmbiente({ sub: a.usuarioId, esc: a.escolaId, sid: randomUUID() }),
      corpoTrocado: `${cabecalho}.${corpo}.${tokenB.split('.')[2]}`,
    }

    // Também na rota sem a segunda checagem do /contexto: a guarda sozinha precisa recusar.
    const respostas = await Promise.all(
      ['/v1/sistema/contexto', '/teste-protegido/eco'].flatMap((rota) =>
        Object.values(tokens).map((token) => request(app.getHttpServer()).get(rota).set('Authorization', `Bearer ${token}`)),
      ),
    )
    expect(registros().some((registro) => registro.evento === 'teste.protegido')).toBe(false)
    for (const resposta of respostas) esperarNaoAutenticado(resposta)
    const semRequisicaoId = respostas.map((resposta) => ({ ...resposta.body.erro, requisicaoId: undefined, cabecalhos: resposta.headers['www-authenticate'] }))
    expect(new Set(semRequisicaoId.map((corpoSemId) => JSON.stringify(corpoSemId))).size).toBe(1)
  })

  it('isolamento: token da escola A com x-escola-id e ?escolaId= apontando para B devolve A', async () => {
    const resposta = await request(app.getHttpServer())
      .get(`/v1/sistema/contexto?escolaId=${b.escolaId}&usuarioId=${b.usuarioId}&sessaoId=${b.sessaoId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Escola-Id', b.escolaId)
      .set('X-Usuario-Id', b.usuarioId)

    expect(resposta.status).toBe(200)
    expect(resposta.body).toEqual(esperadoDe(a))
  })

  it('isolamento: sem token, escola mandada pelo cliente não autentica ninguém', async () => {
    const resposta = await request(app.getHttpServer())
      .get(`/teste-protegido/eco?escolaId=${b.escolaId}`)
      .set('X-Escola-Id', b.escolaId)
    esperarNaoAutenticado(resposta)
    expect(linhasDeLog.join('')).not.toContain(b.escolaId)
  })

  it('token fora do cabeçalho Authorization não autentica: nada sensível vem pela URL', async () => {
    for (const parametro of ['access_token', 'token']) {
      esperarNaoAutenticado(await request(app.getHttpServer()).get(`/v1/sistema/contexto?${parametro}=${tokenA}`))
    }
    esperarNaoAutenticado(await request(app.getHttpServer()).get('/v1/sistema/contexto').set('Cookie', `token=${tokenA}`))
  })

  it('rota anônima logo depois de uma autenticada não herda escola nem usuário no contexto', async () => {
    const servidor = app.getHttpServer()
    for (let rodada = 0; rodada < 5; rodada++) {
      expect((await request(servidor).get('/v1/sistema/contexto').set('Authorization', `Bearer ${tokenA}`)).status).toBe(200)
      expect((await request(servidor).get('/teste-anonimo/contexto')).body).toEqual({ escolaId: null, usuarioId: null })
    }
  })

  it('isolamento: 40 requisições intercaladas das escolas A e B recebem cada uma a própria escola', async () => {
    const pedidos = Array.from({ length: 40 }, (_, indice) => (indice % 2 === 0 ? 'A' : 'B'))
    const respostas = await Promise.all(
      pedidos.map((escola) =>
        request(app.getHttpServer())
          .get('/v1/sistema/contexto')
          .set('Authorization', `Bearer ${escola === 'A' ? tokenA : tokenB}`),
      ),
    )
    respostas.forEach((resposta, indice) => {
      const esperado = pedidos[indice] === 'A' ? esperadoDe(a) : esperadoDe(b)
      expect(resposta.body).toEqual(esperado)
    })
  })

  it('o token não vai para o log, nem quando é recusado', async () => {
    await request(app.getHttpServer()).get('/v1/sistema/contexto').set('Authorization', `Bearer ${tokenA}x`)
    await request(app.getHttpServer()).get('/teste-protegido/eco').set('Authorization', `Bearer ${tokenA}`)
    const bruto = linhasDeLog.join('')
    expect(linhasDeLog.length).toBeGreaterThan(0)
    for (const parte of tokenA.split('.')) expect(bruto).not.toContain(parte)
  })
})

describe('o emissor sintético do F0 saiu (tarefa 3.0)', () => {
  const bancada = new SessaoFixtures()

  afterAll(async () => {
    await bancada.fechar()
  })

  /** O mesmo token da sessão real, só que assinado com o emissor `sintetico` que existia no F0. */
  const comEmissorSintetico = (sessao: TestSessao): Promise<string> =>
    tokenAssinadoComAChaveDoAmbiente({ iss: 'sintetico', esc: sessao.escolaId, sub: sessao.usuarioId, sid: sessao.sessaoId })

  it.each([
    ['sem a variável, como o .env.example agora é', {}],
    ['com ACEITAR_TOKEN_SINTETICO=true no ambiente, que já não liga nada', { ACEITAR_TOKEN_SINTETICO: 'true' }],
  ])('a API sobe %s e recusa o token do emissor sintético, mesmo com a sessão real gravada', async (_caso, ambiente) => {
    const app = await subirApi(ambiente)
    try {
      const sessao = await bancada.escolaComSessao()

      esperarNaoAutenticado(await request(app.getHttpServer()).get('/v1/sistema/contexto').set('Authorization', `Bearer ${await comEmissorSintetico(sessao)}`))
      // A mesma sessão, com o emissor `educa`, passa: o que recusou foi o emissor.
      expect((await request(app.getHttpServer()).get('/v1/sistema/contexto').set('Authorization', `Bearer ${sessao.token}`)).status).toBe(200)
      expect((await request(app.getHttpServer()).get('/saude')).status).toBe(200)
    } finally {
      await app.close()
    }
  })
})
