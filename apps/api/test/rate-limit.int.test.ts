import 'reflect-metadata'
import {
  createApiRedisClient,
  createLogger,
  createPool,
  TokenIssuer,
  JANELA_LIMITE_SEGUNDOS,
  RateLimiter,
  Public,
  TIMEOUT_COMANDO_REDIS_API_MS,
} from '@educa/core'
import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { Controller, Get, Module, type INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { Redis } from 'ioredis'
import { randomInt } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { aguardarSaudavel, compose, composeAssincronoOuFalha, composeOuFalha } from '../../../tools/testes/compose.ts'
import { AppModule } from '../src/app.module.js'
import { configurarAplicacao } from '../src/configure-app.js'
import { CLIENTE_REDIS_CACHE } from '../src/rate-limit.module.js'
import { configuracaoDeTeste } from './test-config.js'
import { BancadaDeSessoes } from './sessao.fixture.js'

const ambienteDeTeste = lerAmbienteDeTeste()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const ROTA_AUTENTICADA = '/v1/sistema/contexto'
const ROTA_ANONIMA = '/teste-limite/anonima'

@Public()
@Controller('teste-limite')
class ControladorAnonimo {
  @Get('anonima')
  anonima(): { ok: true } {
    return { ok: true }
  }
}

interface Instancia {
  app: INestApplication
  url: string
  limitador: RateLimiter
}

const instancias: Instancia[] = []

async function clientePronto(cliente: Redis): Promise<void> {
  const prazo = performance.now() + 10_000
  while (cliente.status !== 'ready') {
    if (performance.now() > prazo) throw new Error('o cliente do Redis de cache não conectou')
    await new Promise((resolver) => setTimeout(resolver, 20))
  }
}

/** Uma instância da API no processo do teste, com os limites trocados e o Redis de cache do compose. */
async function subirApi(
  ambiente: Record<string, string>,
  { esperarRedis = true, endereco = '127.0.0.1' }: { esperarRedis?: boolean; endereco?: string } = {},
): Promise<Instancia> {
  @Module({ imports: [AppModule.com(configuracaoDeTeste({ ambiente }))], controllers: [ControladorAnonimo] })
  class ModuloDeTeste {}

  const app = await NestFactory.create(ModuloDeTeste, { logger: false })
  configurarAplicacao(app, createLogger({ servico: 'api-teste', nivel: 'silent' }))
  await app.listen(0, endereco)
  const { port } = app.getHttpServer().address() as AddressInfo
  // Até o cliente conectar, a instância conta no seguro, como no boot real (antes de a borda mandar tráfego).
  if (esperarRedis) await clientePronto(app.get<Redis>(CLIENTE_REDIS_CACHE, { strict: false }))
  const instancia = { app, url: `http://${endereco.includes(':') ? `[${endereco}]` : endereco}:${port}`, limitador: app.get(RateLimiter) }
  instancias.push(instancia)
  return instancia
}

async function fecharInstancias(): Promise<void> {
  await Promise.all(instancias.splice(0).map((instancia) => instancia.app.close()))
}

/** Escolas e sessões reais: a SessaoGuard lê a sessão do token depois do limite. */
const sessoes = new BancadaDeSessoes()
afterAll(async () => {
  await sessoes.fechar()
})

/** O token de um usuário novo da escola, com sessão gravada. */
const tokenNovo = async (escolaId: string) => (await sessoes.sessao(escolaId)).token
/** `quantidade` tokens da escola, cada um de um usuário novo. */
const tokensNovos = async (escolaId: string, quantidade: number) => (await sessoes.sessoes(escolaId, { quantidade })).map((sessao) => sessao.token)
/** O token de um usuário novo numa escola nova. */
const tokenDeEscolaNova = async () => tokenNovo(await sessoes.escola())
/** O token de um usuário da mesma conta do `usuarioId`, em outra escola. */
const sessaoDaMesmaConta = (usuarioId: string, escolaId: string) => sessoes.sessaoDaMesmaConta(usuarioId, escolaId)

interface Resposta {
  status: number
  retryAfter: string | null
  codigo: string | undefined
  duracaoMs: number
}

async function pedir(url: string, rota: string, cabecalhos: Record<string, string> = {}): Promise<Resposta> {
  const inicio = performance.now()
  const resposta = await fetch(`${url}${rota}`, { headers: cabecalhos })
  const corpo = (await resposta.json()) as { erro?: { codigo?: string; mensagem?: string; requisicaoId?: string } }
  const duracaoMs = performance.now() - inicio
  if (resposta.status === 429) {
    expect(corpo).toEqual({
      erro: { codigo: ErrorCode.LIMITE_EXCEDIDO, mensagem: MENSAGENS_DE_ERRO.LIMITE_EXCEDIDO, requisicaoId: expect.stringMatching(UUID) },
    })
  }
  return { status: resposta.status, retryAfter: resposta.headers.get('retry-after'), codigo: corpo.erro?.codigo, duracaoMs }
}

const autenticada = (url: string, tokenDoUsuario: string) => pedir(url, ROTA_AUTENTICADA, { Authorization: `Bearer ${tokenDoUsuario}` })

/** Executa as tarefas com no máximo `paralelos` ao mesmo tempo, na ordem. */
async function emParalelo<T>(tarefas: Array<() => Promise<T>>, paralelos: number): Promise<T[]> {
  const resultados: T[] = new Array<T>(tarefas.length)
  let proxima = 0
  await Promise.all(
    Array.from({ length: paralelos }, async () => {
      while (proxima < tarefas.length) {
        const indice = proxima++
        const tarefa = tarefas[indice]
        if (tarefa !== undefined) resultados[indice] = await tarefa()
      }
    }),
  )
  return resultados
}

function contarStatus(respostas: Resposta[]): Record<number, number> {
  const contagem: Record<number, number> = {}
  for (const { status } of respostas) contagem[status] = (contagem[status] ?? 0) + 1
  return contagem
}

function esperarRetryAfterDaJanela(respostas: Resposta[]): void {
  const recusadas = respostas.filter((resposta) => resposta.status === 429)
  expect(recusadas.length).toBeGreaterThan(0)
  for (const { retryAfter, codigo } of recusadas) {
    expect(codigo).toBe(ErrorCode.LIMITE_EXCEDIDO)
    expect(retryAfter).toMatch(/^\d+$/)
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1)
    expect(Number(retryAfter)).toBeLessThanOrEqual(JANELA_LIMITE_SEGUNDOS)
  }
}

/** IP reservado (198.18.0.0/15) sorteado: cada execução usa chaves próprias no Redis de cache. */
const ipSorteado = () => `198.18.${randomInt(0, 256)}.${randomInt(1, 255)}`

const redisDeCache = () => new Redis(`redis://127.0.0.1:${valorObrigatorio(ambienteDeTeste, 'REDIS_CACHE_PORTA_HOST')}`, { lazyConnect: true })

async function chavesDeIp(redis: Redis): Promise<string[]> {
  const chaves: string[] = []
  for await (const lote of redis.scanStream({ match: 'rl:ip:*', count: 1_000 })) chaves.push(...(lote as string[]))
  return chaves.map((chave) => chave.slice('rl:ip:'.length))
}

async function religarRedisDeCache(): Promise<void> {
  compose('unpause', 'redis-cache')
  composeOuFalha('start', 'redis-cache')
  await aguardarSaudavel('redis-cache')
}

describe('rate limit por usuário e por escola, em instâncias no processo', () => {
  // A conexão do teste faz o papel da borda: cada teste anônimo usa um IP sorteado, e não divide a
  // chave de 127.0.0.1 com o healthcheck das APIs do compose, que usam o mesmo Redis de cache.
  const LIMITES = {
    LIMITE_REQ_USUARIO_MIN: '20',
    LIMITE_REQ_ESCOLA_MIN: '30',
    LIMITE_REQ_IP_ANONIMO_MIN: '10',
    LIMITE_INSTANCIAS_API: '2',
    LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1',
  }
  let api1: Instancia
  let api2: Instancia

  beforeAll(async () => {
    api1 = await subirApi(LIMITES)
    api2 = await subirApi(LIMITES)
  })

  afterAll(async () => {
    await fecharInstancias()
  })

  it('concorrência: rajada do mesmo usuário em paralelo nas duas APIs aceita exatamente o limite, somado no Redis', async () => {
    const tokenDoUsuario = await tokenDeEscolaNova()
    // Distribuição desigual de propósito: contando em memória, com limite inteiro ou dividido, o total mudaria.
    const pedidos = Array.from({ length: 60 }, (_, indice) => (indice % 12 === 0 ? api2 : api1))
    const respostas = await Promise.all(pedidos.map((instancia) => autenticada(instancia.url, tokenDoUsuario)))

    expect(contarStatus(respostas)).toEqual({ 200: 20, 429: 40 })
    esperarRetryAfterDaJanela(respostas)
    // Janela recém-aberta: o Retry-After é o que falta dela, e não um valor fixo.
    for (const { status, retryAfter } of respostas) if (status === 429) expect(Number(retryAfter)).toBeGreaterThanOrEqual(JANELA_LIMITE_SEGUNDOS - 5)
  })

  it('toda chave de limite expira dentro da janela: nem contador de aluno nem IP ficam guardados', async () => {
    const ip = ipSorteado()
    const { escolaId: escola, usuarioId: usuario, token: tokenDoUsuario } = await sessoes.escolaComSessao()
    expect((await autenticada(api1.url, tokenDoUsuario)).status).toBe(200)
    expect((await pedir(api2.url, ROTA_ANONIMA, { 'X-Forwarded-For': ip })).status).toBe(200)

    const redis = redisDeCache()
    try {
      await redis.connect()
      for (const chave of [`rl:u:${usuario}`, `rl:e:${escola}`, `rl:ip:${ip}`]) {
        const validadeMs = await redis.pttl(chave)
        expect(validadeMs, chave).toBeGreaterThan(0)
        expect(validadeMs, chave).toBeLessThanOrEqual(JANELA_LIMITE_SEGUNDOS * 1_000)
      }
    } finally {
      redis.disconnect()
    }
  })

  it('o limite gasto numa instância vale na outra: o 21º pedido, na API 2, recebe 429', async () => {
    const tokenDoUsuario = await tokenDeEscolaNova()
    for (let pedido = 0; pedido < 20; pedido++) expect((await autenticada(api1.url, tokenDoUsuario)).status).toBe(200)
    const naOutra = await autenticada(api2.url, tokenDoUsuario)
    expect(naOutra.status).toBe(429)
    esperarRetryAfterDaJanela([naOutra])
  })

  it('um usuário acima do próprio limite recebe 429, e os outros da mesma escola seguem', async () => {
    const escola = await sessoes.escola()
    const [abusivo, ...colegas] = await tokensNovos(escola, 6)
    if (abusivo === undefined) throw new Error('sessão não criada')

    const doAbusivo = await Promise.all(Array.from({ length: 25 }, () => autenticada(api1.url, abusivo)))
    expect(contarStatus(doAbusivo)).toEqual({ 200: 20, 429: 5 })
    // Os 5 recusados voltam para a cota da escola (30): sobram 10 para os colegas, que não são barrados.
    const dosColegas = await Promise.all(colegas.flatMap((colega) => [autenticada(api2.url, colega), autenticada(api1.url, colega)]))
    expect(contarStatus(dosColegas)).toEqual({ 200: 10 })
  })

  it('borda: a mesma conta com usuário em duas escolas tem o limite de usuário do sub de cada escola, e cada escola conta o seu', async () => {
    // Desde o F1 o `sub` é o usuário da escola (Tech Spec, seção 1): a mesma pessoa em duas escolas é um usuário em cada uma.
    const naA = await sessoes.escolaComSessao('professor')
    const escolaB = await sessoes.escola()
    const naB = await sessaoDaMesmaConta(naA.usuarioId, escolaB)

    expect(contarStatus(await Promise.all(Array.from({ length: 20 }, () => autenticada(api1.url, naA.token))))).toEqual({ 200: 20 })
    expect((await autenticada(api2.url, naA.token)).status).toBe(429)
    // O usuário dela na B tem o próprio limite: o limite do usuário da A não o alcança.
    expect(contarStatus(await Promise.all(Array.from({ length: 10 }, () => autenticada(api2.url, naB))))).toEqual({ 200: 10 })

    // Escola: a A gastou 20 de 30 e a B, 10. Somadas numa chave só, as duas estariam a 30 e já recusariam.
    const [outroDaA] = await tokensNovos(naA.escolaId, 1)
    expect(contarStatus(await Promise.all(Array.from({ length: 10 }, () => autenticada(api1.url, outroDaA ?? ''))))).toEqual({ 200: 10 })
    expect((await autenticada(api2.url, await tokenNovo(naA.escolaId))).status).toBe(429)
    const outrosDaB = await tokensNovos(escolaB, 2)
    expect(contarStatus(await Promise.all(outrosDaB.flatMap((outro) => Array.from({ length: 10 }, () => autenticada(api1.url, outro)))))).toEqual({ 200: 20 })
    expect((await autenticada(api2.url, await tokenNovo(escolaB))).status).toBe(429)
  })

  it('isolamento: limite de escola esgotado na escola A não gera 429 para a escola B', async () => {
    const [escolaA, escolaB] = [await sessoes.escola(), await sessoes.escola()]
    const daA = await tokensNovos(escolaA, 2)
    const esgotando = await Promise.all(daA.flatMap((usuario, indice) => Array.from({ length: indice === 0 ? 20 : 10 }, () => autenticada(api1.url, usuario))))
    expect(contarStatus(esgotando)).toEqual({ 200: 30 })

    const outroDaA = await autenticada(api2.url, await tokenNovo(escolaA))
    expect(outroDaA.status).toBe(429)
    esperarRetryAfterDaJanela([outroDaA])

    const daB = await tokensNovos(escolaB, 3)
    const respostasDaB = await Promise.all(daB.flatMap((usuario) => [autenticada(api1.url, usuario), autenticada(api2.url, usuario)]))
    expect(contarStatus(respostasDaB)).toEqual({ 200: 6 })
  })

  it('isolamento: token da escola A com X-Escola-Id da B conta na A, e a B segue livre', async () => {
    const [escolaA, escolaB] = [await sessoes.escola(), await sessoes.escola()]
    const usuarioA = await tokenNovo(escolaA)
    const respostas = await Promise.all(
      Array.from({ length: 20 }, () => pedir(api1.url, `${ROTA_AUTENTICADA}?escolaId=${escolaB}`, { Authorization: `Bearer ${usuarioA}`, 'X-Escola-Id': escolaB })),
    )
    expect(contarStatus(respostas)).toEqual({ 200: 20 })
    const outrosDaA = await tokensNovos(escolaA, 11)
    const segundoDaA = await Promise.all(outrosDaA.map((outro) => autenticada(api2.url, outro)))
    expect(contarStatus(segundoDaA)).toEqual({ 200: 10, 429: 1 })
    expect((await autenticada(api1.url, await tokenNovo(escolaB))).status).toBe(200)
  })

  it('turma com token vencido às 7h30: rota autenticada responde 401, nunca 429, e não gasta o limite anônimo do IP', async () => {
    const ip = ipSorteado()
    const sessao = await sessoes.escolaComSessao()
    const emissorNoPassado = new TokenIssuer(new TextEncoder().encode(valorObrigatorio(ambienteDeTeste, 'IDENTIDADE_CHAVE_ASSINATURA')), { agora: () => new Date(Date.now() - 11 * 60_000) })
    const { token: vencido } = await emissorNoPassado.emitir(sessao)
    const semToken = Array.from({ length: 15 }, () => pedir(api1.url, ROTA_AUTENTICADA, { 'X-Forwarded-For': ip }))
    const comVencido = Array.from({ length: 15 }, () => pedir(api2.url, ROTA_AUTENTICADA, { 'X-Forwarded-For': ip, Authorization: `Bearer ${vencido}` }))
    expect(contarStatus(await Promise.all([...semToken, ...comVencido]))).toEqual({ 401: 30 })

    const anonimas = await Promise.all(Array.from({ length: 12 }, () => pedir(api1.url, ROTA_ANONIMA, { 'X-Forwarded-For': ip })))
    expect(contarStatus(anonimas)).toEqual({ 200: 10, 429: 2 })
  })

  it('a sonda /prontidao fica fora do limite: nem com o IP esgotado ela recebe 429', async () => {
    const ip = ipSorteado()
    const anonimas = await Promise.all(Array.from({ length: 12 }, () => pedir(api1.url, ROTA_ANONIMA, { 'X-Forwarded-For': ip })))
    expect(contarStatus(anonimas)).toEqual({ 200: 10, 429: 2 })
    const sondas = await Promise.all(
      Array.from({ length: 30 }, () => fetch(`${api1.url}/prontidao`, { headers: { 'X-Forwarded-For': ip } }).then((resposta) => resposta.status)),
    )
    expect(sondas.every((status) => status === 200)).toBe(true)
  })
})

describe('limites por escola, da configuracao_operacional_escola', () => {
  const LIMITES = { LIMITE_REQ_USUARIO_MIN: '20', LIMITE_REQ_ESCOLA_MIN: '30', LIMITE_REQ_IP_ANONIMO_MIN: '10', LIMITE_INSTANCIAS_API: '2', LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' }
  const pool = createPool(configuracaoDeTeste().banco, () => undefined)
  let api1: Instancia
  let api2: Instancia

  /** Escola nova, com a configuração gravada antes do primeiro pedido dela (nenhuma instância a guardou ainda). */
  async function escolaConfigurada(limites: { usuario: number | null; escola: number | null }): Promise<string> {
    const escola = await sessoes.escola()
    await pool.query('insert into configuracao_operacional_escola (escola_id, limite_req_usuario_min, limite_req_escola_min) values ($1, $2, $3)', [
      escola,
      limites.usuario,
      limites.escola,
    ])
    return escola
  }

  beforeAll(async () => {
    api1 = await subirApi(LIMITES)
    api2 = await subirApi(LIMITES)
  })

  afterAll(async () => {
    await fecharInstancias()
    await pool.end()
  })

  it('a escola com limite próprio de escola é limitada nele, somado nas duas APIs; a escola sem configuração segue no padrão', async () => {
    const comLimite = await escolaConfigurada({ usuario: null, escola: 5 })
    const semConfiguracao = await sessoes.escola()
    const pedidosDa = async (escola: string) => {
      const usuarios = await tokensNovos(escola, 4)
      return Promise.all(usuarios.flatMap((usuario) => [autenticada(api1.url, usuario), autenticada(api2.url, usuario)]))
    }

    const respostas = await pedidosDa(comLimite)
    expect(contarStatus(respostas)).toEqual({ 200: 5, 429: 3 })
    esperarRetryAfterDaJanela(respostas)
    expect(contarStatus(await pedidosDa(semConfiguracao))).toEqual({ 200: 8 })
  })

  it('limite próprio de usuário vale para os usuários daquela escola, e o nulo cai no padrão do ambiente', async () => {
    const usuarioLimitado = await escolaConfigurada({ usuario: 3, escola: null })
    const tokenDoUsuario = await tokenNovo(usuarioLimitado)
    const respostas = await Promise.all(Array.from({ length: 6 }, (_, indice) => autenticada(indice % 2 === 0 ? api1.url : api2.url, tokenDoUsuario)))
    expect(contarStatus(respostas)).toEqual({ 200: 3, 429: 3 })

    // O limite de escola dela é o padrão (30): outros 20 usuários, um pedido cada, passam todos.
    const colegas = await tokensNovos(usuarioLimitado, 20)
    expect(contarStatus(await Promise.all(colegas.map((colega) => autenticada(api1.url, colega))))).toEqual({ 200: 20 })
  })

  it('isolamento: o limite configurado da escola A não vale para a B, nem para a mesma conta com usuário nas duas', async () => {
    const escolaA = await escolaConfigurada({ usuario: 2, escola: 2 })
    const escolaB = await sessoes.escola()
    const naA = await sessoes.sessao(escolaA, 'professor')
    const naB = await sessaoDaMesmaConta(naA.usuarioId, escolaB)
    expect(contarStatus(await Promise.all(Array.from({ length: 3 }, () => autenticada(api1.url, naA.token))))).toEqual({ 200: 2, 429: 1 })
    // Na B, o usuário da mesma conta tem o limite de usuário do padrão (20), e a B, o de escola do padrão.
    expect(contarStatus(await Promise.all(Array.from({ length: 10 }, () => autenticada(api2.url, naB))))).toEqual({ 200: 10 })
  })
})

describe('X-Forwarded-For só vale vindo da borda', () => {
  const LIMITES = { LIMITE_REQ_USUARIO_MIN: '20', LIMITE_REQ_ESCOLA_MIN: '30', LIMITE_REQ_IP_ANONIMO_MIN: '10', LIMITE_INSTANCIAS_API: '2' }
  const redis = redisDeCache()

  beforeAll(async () => {
    await redis.connect()
  })

  afterAll(async () => {
    redis.disconnect()
    await fecharInstancias()
  })

  it('permissão: X-Forwarded-For forjado sem passar pela borda é ignorado, e o limite anônimo é o do IP da conexão', async () => {
    // A borda configurada é outro endereço: a conexão do teste não é dela. A instância escuta em ::1,
    // chave que o healthcheck das APIs do compose (127.0.0.1, no mesmo Redis) não usa.
    const api = await subirApi({ ...LIMITES, LIMITE_PROXIES_CONFIAVEIS: '192.0.2.250' }, { endereco: '::1' })
    await redis.del('rl:ip:::1')
    const forjados = Array.from({ length: 12 }, ipSorteado)

    const respostas = await Promise.all(forjados.map((ip) => pedir(api.url, ROTA_ANONIMA, { 'X-Forwarded-For': ip })))

    expect(contarStatus(respostas)).toEqual({ 200: 10, 429: 2 })
    esperarRetryAfterDaJanela(respostas)
    const chaves = await chavesDeIp(redis)
    expect(chaves).toContain('::1')
    for (const ip of forjados) expect(chaves).not.toContain(ip)
  })

  it('vindo da borda (configurada por nome), vale o IP que a borda viu: clientes diferentes atrás da mesma borda não dividem uma chave', async () => {
    const api = await subirApi({ ...LIMITES, LIMITE_PROXIES_CONFIAVEIS: 'localhost' })
    const clientes = Array.from({ length: 30 }, (_, indice) => `198.19.${randomInt(0, 256)}.${indice + 1}`)

    const distintos = await Promise.all(clientes.map((ip) => pedir(api.url, ROTA_ANONIMA, { 'X-Forwarded-For': ip })))
    expect(contarStatus(distintos)).toEqual({ 200: 30 })

    // O mesmo cliente segue limitado pelo próprio IP, e a entrada que ele mesmo mandou antes da borda não conta.
    const mesmoCliente = ipSorteado()
    const repetidos = await Promise.all(
      Array.from({ length: 12 }, () => pedir(api.url, ROTA_ANONIMA, { 'X-Forwarded-For': `${ipSorteado()}, ${mesmoCliente}` })),
    )
    expect(contarStatus(repetidos)).toEqual({ 200: 10, 429: 2 })
  })
})

describe('Redis de cache fora: seguro em memória', () => {
  // Limite 20 em duas instâncias: cada uma aceita 10 sozinha.
  const LIMITES = { LIMITE_REQ_USUARIO_MIN: '20', LIMITE_REQ_ESCOLA_MIN: '1000', LIMITE_REQ_IP_ANONIMO_MIN: '20', LIMITE_INSTANCIAS_API: '2', LIMITE_PROXIES_CONFIAVEIS: 'localhost' }
  let api: Instancia

  beforeAll(async () => {
    api = await subirApi(LIMITES)
  })

  afterEach(async () => {
    await religarRedisDeCache()
  })

  afterAll(async () => {
    await fecharInstancias()
  })

  async function provarSeguro(): Promise<void> {
    const tokenDoUsuario = await tokenDeEscolaNova()
    const respostas: Resposta[] = []
    for (let pedido = 0; pedido < 14; pedido++) respostas.push(await autenticada(api.url, tokenDoUsuario))
    const anonimas: Resposta[] = []
    const ip = ipSorteado()
    for (let pedido = 0; pedido < 12; pedido++) anonimas.push(await pedir(api.url, ROTA_ANONIMA, { 'X-Forwarded-For': ip }))

    expect(respostas.map((resposta) => resposta.status)).toEqual([...Array.from({ length: 10 }, () => 200), 429, 429, 429, 429])
    expect(anonimas.map((resposta) => resposta.status)).toEqual([...Array.from({ length: 10 }, () => 200), 429, 429])
    esperarRetryAfterDaJanela([...respostas, ...anonimas])
    expect(api.limitador.seguroAtivo).toBe(1)
    const duracoes = [...respostas, ...anonimas].map((resposta) => Math.round(resposta.duracaoMs))
    expect(duracoes.filter((duracao) => duracao >= 150)).toEqual([])
  }

  async function provarVolta(): Promise<void> {
    await religarRedisDeCache()
    const tokenDoUsuario = await tokenDeEscolaNova()
    await expect
      .poll(async () => {
        await autenticada(api.url, tokenDoUsuario)
        return api.limitador.seguroAtivo
      }, { timeout: 15_000, interval: 250 })
      .toBe(0)
  }

  it('borda: Redis parado → o seguro limita a limite ÷ instâncias, seguro_ativo=1, abaixo de 150 ms e nenhum 5xx', async () => {
    expect((await autenticada(api.url, await tokenDeEscolaNova())).status).toBe(200)
    expect(api.limitador.seguroAtivo).toBe(0)

    composeOuFalha('stop', 'redis-cache')
    await provarSeguro()
    await provarVolta()
  })

  const urlDoRedisDeCache = `redis://127.0.0.1:${valorObrigatorio(ambienteDeTeste, 'REDIS_CACHE_PORTA_HOST')}`

  async function duracaoDaRecusa(cliente: Redis): Promise<number> {
    const inicio = performance.now()
    await expect(cliente.get('rl:u:sonda-do-teste')).rejects.toThrow()
    return performance.now() - inicio
  }

  it('cliente Redis da API: com o Redis parado, o comando falha na hora, sem fila offline, no boot e depois de conectado', async () => {
    const conectado = createApiRedisClient(urlDoRedisDeCache, 'teste-conectado', () => undefined)
    try {
      await clientePronto(conectado)
      composeOuFalha('stop', 'redis-cache')
      const noBoot = createApiRedisClient(urlDoRedisDeCache, 'teste-boot', () => undefined)
      try {
        // Com fila offline, o comando esperaria a reconexão até o commandTimeout (100 ms).
        for (let tentativa = 0; tentativa < 5; tentativa++) {
          expect(await duracaoDaRecusa(conectado)).toBeLessThan(TIMEOUT_COMANDO_REDIS_API_MS / 2)
          expect(await duracaoDaRecusa(noBoot)).toBeLessThan(TIMEOUT_COMANDO_REDIS_API_MS / 2)
        }
      } finally {
        noBoot.disconnect()
      }
    } finally {
      conectado.disconnect()
    }
  })

  it('cliente Redis da API: com o Redis travado, o comando corta no commandTimeout, sem pendurar', async () => {
    const cliente = createApiRedisClient(urlDoRedisDeCache, 'teste-travado', () => undefined)
    try {
      await clientePronto(cliente)
      composeOuFalha('pause', 'redis-cache')
      const duracao = await duracaoDaRecusa(cliente)
      expect(duracao).toBeGreaterThanOrEqual(TIMEOUT_COMANDO_REDIS_API_MS - 10)
      expect(duracao).toBeLessThan(150)
    } finally {
      cliente.disconnect()
    }
  })

  it('borda: a API sobe com o Redis de cache já fora, atende pelo seguro e passa ao Redis quando ele volta', async () => {
    composeOuFalha('stop', 'redis-cache')
    const semRedis = await subirApi(LIMITES, { esperarRedis: false })
    const primeiroToken = await tokenDeEscolaNova()
    const inicio = performance.now()
    expect((await autenticada(semRedis.url, primeiroToken)).status).toBe(200)
    expect(performance.now() - inicio).toBeLessThan(150)
    expect(semRedis.limitador.seguroAtivo).toBe(1)
    // A métrica `limite.seguro_ativo` desta instância: toda requisição limitada da janela foi pelo seguro.
    expect(semRedis.limitador.proporcaoDoSeguro).toBe(1)

    await religarRedisDeCache()
    const tokenDoUsuario = await tokenDeEscolaNova()
    await expect
      .poll(async () => {
        expect((await autenticada(semRedis.url, tokenDoUsuario)).status).toBe(200)
        return semRedis.limitador.seguroAtivo
      }, { timeout: 15_000, interval: 250 })
      .toBe(0)
    // Com o Redis de volta, a proporção da janela desce: a métrica não fica presa em 1.
    for (let pedido = 0; pedido < 5; pedido++) expect((await autenticada(semRedis.url, tokenDoUsuario)).status).toBe(200)
    expect(semRedis.limitador.proporcaoDoSeguro).toBeLessThan(1)
    expect(semRedis.limitador.proporcaoDoSeguro).toBeGreaterThan(0)
  })

  it('borda: Redis travado (conectado, sem responder) → o comando corta em 100 ms e o seguro atende, abaixo de 150 ms', async () => {
    expect((await autenticada(api.url, await tokenDeEscolaNova())).status).toBe(200)

    composeOuFalha('pause', 'redis-cache')
    await provarSeguro()
    await provarVolta()
  })
})

describe('pela borda (Caddy) com as duas APIs do compose e os limites do ambiente', () => {
  const BORDA = `http://127.0.0.1:${valorObrigatorio(ambienteDeTeste, 'BORDA_PORTA_HOST')}`
  const API_1_DIRETA = `http://127.0.0.1:${valorObrigatorio(ambienteDeTeste, 'API_1_PORTA_HOST')}`
  const LIMITE_USUARIO = Number(valorObrigatorio(ambienteDeTeste, 'LIMITE_REQ_USUARIO_MIN'))
  const redis = redisDeCache()

  beforeAll(async () => {
    await redis.connect()
    await composeAssincronoOuFalha('up', '--detach', '--build', '--wait', '--remove-orphans', 'borda')
  }, 900_000)

  afterAll(async () => {
    redis.disconnect()
    // Derruba só o que este arquivo subiu: os outros testes de integração não contam com eles de pé.
    await composeAssincronoOuFalha('stop', 'borda', 'api-1', 'api-2', 'realtime-1', 'realtime-2')
  }, 120_000)

  it('caminho feliz: 400 usuários da escola C pelo mesmo IP não recebem 429; um acima do próprio limite recebe, com Retry-After, e os outros seguem', async () => {
    const escolaC = await sessoes.escola()
    const [abusivo, ...alunos] = await tokensNovos(escolaC, 401)
    if (abusivo === undefined) throw new Error('sessão não criada')

    const primeiraRodada = await emParalelo(alunos.flatMap((aluno) => [() => autenticada(BORDA, aluno), () => autenticada(BORDA, aluno)]), 50)
    expect(contarStatus(primeiraRodada)).toEqual({ 200: 800 })

    const doAbusivo = await emParalelo(Array.from({ length: LIMITE_USUARIO + 10 }, () => () => autenticada(BORDA, abusivo)), 20)
    expect(contarStatus(doAbusivo)).toEqual({ 200: LIMITE_USUARIO, 429: 10 })
    esperarRetryAfterDaJanela(doAbusivo)

    const segundaRodada = await emParalelo(alunos.map((aluno) => () => autenticada(BORDA, aluno)), 50)
    expect(contarStatus(segundaRodada)).toEqual({ 200: 400 })
  }, 120_000)

  it('permissão: pela borda, a chave anônima é o IP que a borda viu, nunca o X-Forwarded-For forjado nem o IP da borda; direto na API, o forjado é ignorado', async () => {
    const enderecosDaBorda = composeOuFalha('exec', '-T', 'borda', 'hostname', '-i').trim().split(/\s+/)
    const [forjadoPelaBorda, forjadoDireto] = [ipSorteado(), ipSorteado()]
    const doCompose = (ip: string) => ip === '127.0.0.1' // healthcheck do compose, de dentro do container
    for (const ip of await chavesDeIp(redis)) if (!doCompose(ip)) await redis.del(`rl:ip:${ip}`)

    expect((await fetch(`${BORDA}/saude`, { headers: { 'X-Forwarded-For': forjadoPelaBorda } })).status).toBe(200)
    const pelaBorda = (await chavesDeIp(redis)).filter((ip) => !doCompose(ip))
    expect(pelaBorda).toHaveLength(1)
    expect(pelaBorda).not.toContain(forjadoPelaBorda)
    for (const endereco of enderecosDaBorda) expect(pelaBorda).not.toContain(endereco)

    expect((await fetch(`${API_1_DIRETA}/saude`, { headers: { 'X-Forwarded-For': forjadoDireto } })).status).toBe(200)
    const depoisDoDireto = await chavesDeIp(redis)
    expect(depoisDoDireto).not.toContain(forjadoDireto)
    // A borda e a porta direta veem o mesmo cliente (esta máquina): a chave é a mesma.
    expect(depoisDoDireto.filter((ip) => !doCompose(ip))).toEqual(pelaBorda)
  })
})
