import 'reflect-metadata'
import { createLogger, diaDeUso } from '@educa/core'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { Redis } from 'ioredis'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { aguardarSaudavel, compose, composeOuFalha, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { AppModule } from '../src/app.module.js'
import { configurarAplicacao } from '../src/configurar-app.js'
import { configuracaoDeTeste, MONTAGEM_DE_TESTE } from './configuracao-de-teste.js'
import { BancadaDeSessoes } from './sessao-de-teste.js'

const ambienteDeTeste = lerAmbienteDeTeste()
const URL_REDIS_FILA = `redis://127.0.0.1:${valorObrigatorio(ambienteDeTeste, 'REDIS_FILA_PORTA_HOST')}`
const ROTA_AUTENTICADA = '/v1/sistema/contexto'

const apps: INestApplication[] = []
const redis = new Redis(URL_REDIS_FILA, { maxRetriesPerRequest: null })
redis.on('error', () => undefined)

async function subirApi(ambiente: Record<string, string> = {}): Promise<string> {
  const app = await NestFactory.create(AppModule.com(configuracaoDeTeste({ ambiente }), MONTAGEM_DE_TESTE), { logger: false })
  configurarAplicacao(app, createLogger({ servico: 'api-teste', nivel: 'silent' }))
  await app.listen(0, '127.0.0.1')
  apps.push(app)
  return `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
}

const sessoes = new BancadaDeSessoes()
/** Um token de uma sessão nova, de um usuário novo da escola. */
const tokenDa = async (escolaId: string) => (await sessoes.sessao(escolaId)).token

/**
 * O contador da escola hoje. Lido nos dois dias, o de antes e o de depois das requisições: o teste
 * que atravessa a meia-noite de São Paulo não perde a contagem.
 */
async function requisicoesContadas(escolaId: string, dias: Set<string>): Promise<number> {
  const valores = await Promise.all([...dias].map((dia) => redis.get(`uso:${dia}:${escolaId}:req`)))
  return valores.reduce((soma, valor) => soma + Number(valor ?? 0), 0)
}

/** O contador é disparado sem espera: a leitura espera ele chegar, com prazo. */
async function aguardarContagem(escolaId: string, dias: Set<string>, esperado: number): Promise<void> {
  await expect.poll(() => requisicoesContadas(escolaId, dias), { timeout: 5_000, interval: 50 }).toBe(esperado)
}

async function chamar(url: string, token?: string): Promise<{ status: number; duracaoMs: number }> {
  const inicio = performance.now()
  const resposta = await fetch(url, token === undefined ? {} : { headers: { Authorization: `Bearer ${token}` } })
  await resposta.arrayBuffer()
  return { status: resposta.status, duracaoMs: performance.now() - inicio }
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  return ordenados[Math.floor(ordenados.length / 2)] ?? Number.POSITIVE_INFINITY
}

describe('uso por escola marcado pela API', () => {
  const escolasDoTeste: string[] = []
  const novaEscola = async () => {
    const escolaId = await sessoes.escola()
    escolasDoTeste.push(escolaId)
    return escolaId
  }

  beforeAll(async () => {
    // Worker do compose de pé contaria jobs pendentes de outro teste no Redis que este arquivo confere.
    compose('stop', ...PROCESSOS_DA_FILA)
    await redis.ping()
  })

  afterEach(async () => {
    compose('unpause', 'redis-fila')
    await Promise.all(apps.splice(0).map((app) => app.close()))
    const chaves = (await Promise.all(escolasDoTeste.splice(0).map((escolaId) => redis.keys(`uso:*:${escolaId}:*`)))).flat()
    if (chaves.length > 0) await redis.del(...chaves)
  })

  afterAll(async () => {
    compose('unpause', 'redis-fila')
    await aguardarSaudavel('redis-fila')
    await redis.quit()
    await sessoes.fechar()
  })

  it('cada requisição autenticada conta na escola do token, no dia de São Paulo, com prazo para a chave não ficar para sempre', async () => {
    const url = await subirApi()
    const [escolaA, escolaB] = [await novaEscola(), await novaEscola()]
    const [tokenA, tokenB] = await Promise.all([tokenDa(escolaA), tokenDa(escolaB)])
    const dias = new Set([diaDeUso(new Date())])

    for (let indice = 0; indice < 7; indice++) expect((await chamar(`${url}${ROTA_AUTENTICADA}`, tokenA)).status).toBe(200)
    for (let indice = 0; indice < 3; indice++) expect((await chamar(`${url}${ROTA_AUTENTICADA}`, tokenB)).status).toBe(200)
    dias.add(diaDeUso(new Date()))

    await aguardarContagem(escolaA, dias, 7)
    await aguardarContagem(escolaB, dias, 3)
    const [chave] = await redis.keys(`uso:*:${escolaA}:req`)
    expect(chave).toMatch(/^uso:\d{4}-\d{2}-\d{2}:[0-9a-f-]{36}:req$/)
    const validade = await redis.ttl(chave ?? '')
    expect(validade).toBeGreaterThan(30 * 24 * 60 * 60)
    expect(validade).toBeLessThanOrEqual(35 * 24 * 60 * 60)
  })

  it('isolamento: o uso da escola A não soma na B, e a requisição sem token (anônima ou recusada) não conta em escola nenhuma', async () => {
    const url = await subirApi()
    const [escolaA, escolaB] = [await novaEscola(), await novaEscola()]
    const tokenA = await tokenDa(escolaA)
    const dias = new Set([diaDeUso(new Date())])
    const antes = new Set(await redis.keys('uso:*'))

    for (let indice = 0; indice < 4; indice++) await chamar(`${url}${ROTA_AUTENTICADA}`, tokenA)
    expect((await chamar(`${url}/saude`)).status).toBe(200)
    expect((await chamar(`${url}${ROTA_AUTENTICADA}`)).status).toBe(401)
    dias.add(diaDeUso(new Date()))

    await aguardarContagem(escolaA, dias, 4)
    expect(await requisicoesContadas(escolaB, dias)).toBe(0)
    // Nenhuma chave nova além da de A: a anônima e a recusada não criaram contador sem escola.
    const novas = (await redis.keys('uso:*')).filter((chave) => !antes.has(chave))
    expect(novas).toEqual([`uso:${[...dias].at(-1)}:${escolaA}:req`])
  })

  it('Redis de fila inalcançável: a requisição responde 200 na hora, sem esperar o contador', async () => {
    // Porta sem ninguém escutando: o cliente nunca conecta, e o comando falha sem fila offline.
    const url = await subirApi({ REDIS_FILA_URL: 'redis://127.0.0.1:1' })
    const token = await tokenDa(await novaEscola())
    const chamadas = []
    for (let indice = 0; indice < 20; indice++) chamadas.push(await chamar(`${url}${ROTA_AUTENTICADA}`, token))
    expect(chamadas.map(({ status }) => status)).toEqual(Array.from({ length: 20 }, () => 200))
    expect(mediana(chamadas.map(({ duracaoMs }) => duracaoMs))).toBeLessThan(50)
  })

  it('Redis de fila travado (pausado): a requisição não espera o prazo de 100 ms do comando, e a API segue atendendo', async () => {
    const url = await subirApi()
    const escolaId = await novaEscola()
    const token = await tokenDa(escolaId)
    // Conectado antes da pausa: é o caso de um Redis que para de responder com a conexão aberta.
    await chamar(`${url}${ROTA_AUTENTICADA}`, token)
    await aguardarContagem(escolaId, new Set([diaDeUso(new Date())]), 1)

    composeOuFalha('pause', 'redis-fila')
    const chamadas = []
    for (let indice = 0; indice < 20; indice++) chamadas.push(await chamar(`${url}${ROTA_AUTENTICADA}`, token))
    expect(chamadas.map(({ status }) => status)).toEqual(Array.from({ length: 20 }, () => 200))
    // Se a requisição esperasse o contador, cada uma levaria ao menos o prazo do comando (100 ms).
    expect(mediana(chamadas.map(({ duracaoMs }) => duracaoMs))).toBeLessThan(50)
    compose('unpause', 'redis-fila')
    await aguardarSaudavel('redis-fila')
  })
})
