import { createApiRedisClient, createQueueRedisClient, TIMEOUT_COMANDO_REDIS_API_MS } from '@educa/core'
import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../../tools/ci/compose.ts'
import { travarRedis } from '../../../../tools/testes/redis-travado.ts'
import { ContadorDeTentativas, ESPERA_INICIAL_MS, FALHAS_ANTES_DE_SEGURAR, VALIDADE_DO_CONTADOR_MS } from './contador-de-tentativas.js'

const URL_REDIS_FILA = `redis://127.0.0.1:${valorObrigatorio(lerAmbienteDeTeste(), 'REDIS_FILA_PORTA_HOST')}`
/**
 * Quanto o Redis fica travado nos testes de corte: cinco comandos de 100 ms cabem com folga larga, e o fim da pausa é
 * esperado pelo teste, não adivinhado. O que se prova é por contagem e estado, não por tempo.
 */
const PAUSA_MS = 3_000

const CHAVE = new TextEncoder().encode('chave-de-teste-do-contador-com-32-bytes')

function relogioParado(inicio = Date.parse('2026-09-21T07:30:00Z')) {
  let agora = inicio
  return { agora: () => new Date(agora), avancar: (ms: number) => (agora += ms) }
}

async function pronto(cliente: Redis): Promise<void> {
  const prazo = performance.now() + 10_000
  while (cliente.status !== 'ready') {
    if (performance.now() > prazo) throw new Error('o Redis de fila de teste não conectou')
    await new Promise((resolver) => setTimeout(resolver, 20))
  }
}

describe('ContadorDeTentativas no Redis de fila', () => {
  let cliente: Redis

  beforeAll(async () => {
    // O cliente de produção da API desiste em 100 ms de propósito, para o login cair no seguro em memória e não
    // travar. Aqui o que se prova é o script no Redis, e no runner carregado da esteira uma resposta passou dos
    // 100 ms e caiu no seguro (correção 2026-09-18-contador-testado-com-o-prazo-de-producao). O cliente da fila é o
    // mesmo, sem fila offline, com prazo de 2 s. A queda com o Redis fora é provada pelos testes que usam o cliente de
    // produção de propósito, e o Redis travado (conectado, sem responder) pelo teste de `CLIENT PAUSE` no fim do arquivo.
    cliente = createQueueRedisClient(URL_REDIS_FILA, 'teste-contador', () => undefined)
    await pronto(cliente)
  })

  afterAll(() => {
    cliente.disconnect()
  })

  const emailNovo = () => `teste-${randomUUID()}@escola.invalid`

  it('borda: a quinta falha segura 30 s; com o relógio 30 s adiante, a sexta segura 60 s; e o Redis nunca vê o e-mail', async () => {
    const relogio = relogioParado()
    const contador = new ContadorDeTentativas(cliente, CHAVE, relogio)
    const email = emailNovo()
    const chave = contador.chaveDe(email, 'outro')
    for (let tentativa = 1; tentativa < FALHAS_ANTES_DE_SEGURAR; tentativa++) expect(await contador.reservar(chave)).toEqual({ liberada: true, esperaSeFalharMs: 0 })
    expect(await contador.reservar(chave)).toEqual({ liberada: true, esperaSeFalharMs: 30_000 })
    expect(await contador.reservar(chave)).toEqual({ liberada: false, esperaMs: 30_000 })
    relogio.avancar(30_000)
    expect(await contador.reservar(chave)).toEqual({ liberada: true, esperaSeFalharMs: 60_000 })
    relogio.avancar(59_000)
    expect(await contador.reservar(chave)).toEqual({ liberada: false, esperaMs: 1_000 })
    expect(contador.proporcaoDoSeguro).toBe(0)
    // Só o HMAC, e o contador vive a retenção do docs/lgpd.md (15 min), não para sempre.
    expect(await cliente.keys(`*${email}*`)).toEqual([])
    const vida = await cliente.pttl(chave)
    expect(vida).toBeGreaterThan(VALIDADE_DO_CONTADOR_MS - 5_000)
    expect(vida).toBeLessThanOrEqual(VALIDADE_DO_CONTADOR_MS)
  })

  it('borda: a espera para em 15 min, por mais falhas que venham', async () => {
    const relogio = relogioParado()
    const contador = new ContadorDeTentativas(cliente, CHAVE, relogio)
    const chave = contador.chaveDe(emailNovo(), 'outro')
    let ultima = 0
    for (let tentativa = 1; tentativa <= 12; tentativa++) {
      const reserva = await contador.reservar(chave)
      if (!reserva.liberada) throw new Error('reserva recusada fora da espera')
      ultima = reserva.esperaSeFalharMs
      relogio.avancar(ultima)
    }
    expect(ultima).toBe(15 * 60_000)
  })

  it('concorrência: dez reservas ao mesmo tempo liberam exatamente cinco; as outras cinco já encontram a conta segurada', async () => {
    const contador = new ContadorDeTentativas(cliente, CHAVE)
    const chave = contador.chaveDe(emailNovo(), 'outro')
    const reservas = await Promise.all(Array.from({ length: 10 }, () => contador.reservar(chave)))
    expect(reservas.filter((reserva) => reserva.liberada)).toHaveLength(FALHAS_ANTES_DE_SEGURAR)
    expect(reservas.filter((reserva) => !reserva.liberada)).toHaveLength(10 - FALHAS_ANTES_DE_SEGURAR)
  })

  it('o acerto zera só aquele contador: o `outro` segurado continua segurado quando o `conhecido` zera', async () => {
    const contador = new ContadorDeTentativas(cliente, CHAVE)
    const email = emailNovo()
    const outro = contador.chaveDe(email, 'outro')
    const conhecido = contador.chaveDe(email, 'conhecido')
    for (let tentativa = 1; tentativa <= FALHAS_ANTES_DE_SEGURAR; tentativa++) await contador.reservar(outro)
    for (let tentativa = 1; tentativa < FALHAS_ANTES_DE_SEGURAR; tentativa++) await contador.reservar(conhecido)
    expect(await contador.zerar(conhecido)).toBe(true)
    expect(await cliente.exists(conhecido)).toBe(0)
    expect((await contador.reservar(outro)).liberada).toBe(false)
    for (let tentativa = 1; tentativa < FALHAS_ANTES_DE_SEGURAR; tentativa++) expect(await contador.reservar(conhecido)).toEqual({ liberada: true, esperaSeFalharMs: 0 })
  })

  it('A0b: desfazer no Redis tira só a falha daquela reserva; a que segurou a conta solta a espera; a única apaga a chave', async () => {
    const contador = new ContadorDeTentativas(cliente, CHAVE, relogioParado())
    const chave = contador.chaveDe(emailNovo(), 'outro')
    for (let tentativa = 1; tentativa <= 2; tentativa++) await contador.reservar(chave)
    const terceira = await contador.reservar(chave)
    if (!terceira.liberada) throw new Error('a terceira reserva foi recusada')
    await contador.desfazer(chave, terceira)
    expect(await cliente.hget(chave, 'falhas')).toBe('2')

    // Até a quinta, que segura; desfeita, a conta volta a quatro falhas e sem espera.
    await contador.reservar(chave)
    await contador.reservar(chave)
    const quinta = await contador.reservar(chave)
    expect(quinta).toEqual({ liberada: true, esperaSeFalharMs: ESPERA_INICIAL_MS })
    if (!quinta.liberada) throw new Error('a quinta reserva foi recusada')
    await contador.desfazer(chave, quinta)
    expect(await cliente.hgetall(chave)).toEqual({ falhas: '4', ate: '0' })
    // A próxima reserva é a quinta de novo, e não encontra a conta segurada.
    expect(await contador.reservar(chave)).toEqual({ liberada: true, esperaSeFalharMs: ESPERA_INICIAL_MS })

    const outra = contador.chaveDe(emailNovo(), 'outro')
    const unica = await contador.reservar(outra)
    if (!unica.liberada) throw new Error('a reserva foi recusada')
    await contador.desfazer(outra, unica)
    expect(await cliente.exists(outra)).toBe(0)
  })

  it('A0b: a espera que o Redis gravou e o seguro espelhou (15.3), desfeita, sai dos dois: com o Redis sumindo depois, o seguro não segura a conta', async () => {
    const producao = createApiRedisClient(URL_REDIS_FILA, 'teste-contador-desfazer', () => undefined)
    try {
      await pronto(producao)
      const contador = new ContadorDeTentativas(producao, CHAVE)
      const chave = contador.chaveDe(emailNovo(), 'outro')
      for (let tentativa = 1; tentativa < FALHAS_ANTES_DE_SEGURAR; tentativa++) await contador.reservar(chave)
      const quinta = await contador.reservar(chave)
      expect(quinta).toEqual({ liberada: true, esperaSeFalharMs: ESPERA_INICIAL_MS })
      if (!quinta.liberada) throw new Error('a quinta reserva foi recusada')
      await contador.desfazer(chave, quinta)
      producao.disconnect()
      // Só o seguro atende agora: sem desfazer o espelho, a conta estaria segurada nele por 30 s.
      expect(await contador.reservar(chave)).toMatchObject({ liberada: true })
      expect(contador.proporcaoDoSeguro).toBeGreaterThan(0)
    } finally {
      producao.disconnect()
    }
  })

  it('falha (15.5): Redis de fila travado, com a conexão aberta; cada reserva corta nos 100 ms do cliente de produção e cai no seguro, que conta e segura a conta na quinta; quando o Redis volta, as cinco também estão lá, para o lado de segurar', async () => {
    // O cliente de produção da API, de propósito: o que se prova é o corte dos 100 ms.
    const producao = createApiRedisClient(URL_REDIS_FILA, 'teste-contador-travado', () => undefined)
    try {
      await pronto(producao)
      const contador = new ContadorDeTentativas(producao, CHAVE)
      const chave = contador.chaveDe(emailNovo(), 'outro')
      expect(TIMEOUT_COMANDO_REDIS_API_MS).toBe(100)

      const travado = await travarRedis(URL_REDIS_FILA, PAUSA_MS)
      const reservas = []
      for (let tentativa = 1; tentativa <= FALHAS_ANTES_DE_SEGURAR; tentativa++) reservas.push(await contador.reservar(chave))
      // Conectado o tempo todo: não é o caminho do Redis fora, é o `catch` do comando que não voltou.
      expect(producao.status).toBe('ready')
      // Nenhuma liberou sem contar: o seguro contou as cinco, e a quinta já segura a conta em memória.
      expect(reservas).toEqual([...Array.from({ length: FALHAS_ANTES_DE_SEGURAR - 1 }, () => ({ liberada: true, esperaSeFalharMs: 0 })), { liberada: true, esperaSeFalharMs: ESPERA_INICIAL_MS }])
      expect(await contador.reservar(chave)).toMatchObject({ liberada: false })
      expect(contador.proporcaoDoSeguro).toBe(1)

      await travado.fim
      // Os scripts que passaram do prazo rodaram quando a pausa acabou: as cinco falhas foram contadas no Redis também
      // (o erro é para o lado de segurar; a sexta já achou a conta segurada lá), e a próxima reserva, já pelo Redis,
      // encontra a conta segurada.
      await expect.poll(() => cliente.hget(chave, 'falhas'), { timeout: 5_000 }).toBe(String(FALHAS_ANTES_DE_SEGURAR))
      expect(await contador.reservar(chave)).toMatchObject({ liberada: false })
    } finally {
      producao.disconnect()
    }
  })

  it('falha (15.3): a conta que o Redis segurou continua segurada no seguro desta instância quando o Redis some', async () => {
    const producao = createApiRedisClient(URL_REDIS_FILA, 'teste-contador-espelho', () => undefined)
    try {
      await pronto(producao)
      const contador = new ContadorDeTentativas(producao, CHAVE)
      const chave = contador.chaveDe(emailNovo(), 'outro')
      for (let tentativa = 1; tentativa <= FALHAS_ANTES_DE_SEGURAR; tentativa++) await contador.reservar(chave)
      expect(await contador.reservar(chave)).toMatchObject({ liberada: false })
      expect(contador.proporcaoDoSeguro).toBe(0)
      // O Redis sai da vista desta instância (a conexão cai): o seguro atende, e a conta segue segurada, sem recomeçar.
      producao.disconnect()
      expect(await contador.reservar(chave)).toMatchObject({ liberada: false })
      expect(contador.proporcaoDoSeguro).toBeGreaterThan(0)
    } finally {
      producao.disconnect()
    }
  })
})
