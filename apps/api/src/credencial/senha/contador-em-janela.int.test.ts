import { createApiRedisClient, createQueueRedisClient } from '@educa/nucleo'
import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../../../tools/ci/compose.ts'
import { travarRedis } from '../../../../../tools/testes/redis-travado.ts'
import { ContadorEmJanela, JANELA_DO_CONTADOR_POR_IP_MS } from './contador-em-janela.js'
import { PREFIXO_EMAIL_POR_IP } from './limite-email-ip.js'
import { PREFIXO_FALHAS_POR_IP_NA_ESCOLA } from './rebaixamento.js'

const CHAVE = new TextEncoder().encode('chave-de-teste-do-contador-com-32-bytes')
const URL_REDIS_FILA = `redis://127.0.0.1:${valorObrigatorio(lerAmbienteDeTeste(), 'REDIS_FILA_PORTA_HOST')}`
const ESCOLA = '0190f5a0-0000-7000-8000-0000000000e1'

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

/** Um IP da faixa de documentação, sorteado: a janela de uma execução anterior não conta. */
const ipSorteado = () => `2001:db8:15:${randomUUID().slice(0, 4)}::${randomUUID().slice(0, 4)}`

describe('ContadorEmJanela: os contadores por IP do login (15.0), no Redis de fila, por minuto e sem o IP', () => {
  let cliente: Redis

  beforeAll(async () => {
    // O que se prova aqui é o script e a chave, não o corte dos 100 ms: o cliente da fila, com prazo de 2 s. O corte é
    // provado no fim do arquivo, com o cliente de produção e o Redis travado.
    cliente = createQueueRedisClient(URL_REDIS_FILA, 'teste-janela', () => undefined)
    await pronto(cliente)
  })

  afterAll(() => {
    cliente.disconnect()
  })

  it('privacidade (regra 20) e janela: a chave tem o prefixo e o HMAC, nunca o IP nem a escola em texto; o primeiro somar dá o prazo de 1 min, e o seguinte não o empurra', async () => {
    const contador = new ContadorEmJanela(cliente, CHAVE)
    const ip = ipSorteado()
    const chave = contador.chaveDe(PREFIXO_FALHAS_POR_IP_NA_ESCOLA, `${ESCOLA}|${ip}`)
    expect(chave).toMatch(new RegExp(`^${PREFIXO_FALHAS_POR_IP_NA_ESCOLA}:[\\w-]{43}$`))
    for (const texto of [ip, ESCOLA, ip.split('::')[0] ?? '']) expect(chave).not.toContain(texto)
    expect(contador.chaveDe(PREFIXO_EMAIL_POR_IP, ip)).not.toContain(ip)

    expect(await contador.somar(chave)).toEqual({ valor: 1, doSeguro: false })
    const primeiroPrazo = await cliente.pttl(chave)
    expect(primeiroPrazo).toBeGreaterThan(0)
    expect(primeiroPrazo).toBeLessThanOrEqual(JANELA_DO_CONTADOR_POR_IP_MS)
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(await contador.somar(chave)).toEqual({ valor: 2, doSeguro: false })
    // O segundo não renovou o prazo: ele só diminuiu. Com o prazo renovado a cada soma, um IP nunca sairia da janela.
    expect(await cliente.pttl(chave)).toBeLessThan(primeiroPrazo)
    expect(await contador.ler(chave)).toEqual({ valor: 2, doSeguro: false })
    expect(await contador.ler(contador.chaveDe(PREFIXO_EMAIL_POR_IP, ipSorteado()))).toEqual({ valor: 0, doSeguro: false })
    // Nenhuma chave com o IP em texto, em lugar nenhum do Redis de fila.
    expect(await cliente.keys(`*${ip}*`)).toEqual([])
    expect(contador.proporcaoDoSeguro).toBe(0)
  })

  it('L8 (A1, 7.0): a instância com janela de 10 min dá à chave o prazo de 10 min no Redis, e o restante do Retry-After é o prazo dela; sem a chave, 0', async () => {
    const dezMinutos = 10 * 60_000
    const contador = new ContadorEmJanela(cliente, CHAVE, { janelaMs: dezMinutos })
    const chave = contador.chaveDe('sala:teste-janela', randomUUID())
    expect(await contador.somar(chave)).toEqual({ valor: 1, doSeguro: false })
    const prazo = await cliente.pttl(chave)
    expect(prazo).toBeGreaterThan(dezMinutos - 5_000)
    expect(prazo).toBeLessThanOrEqual(dezMinutos)
    const restante = await contador.restanteMs(chave)
    expect(restante).toBeGreaterThan(dezMinutos - 5_000)
    expect(restante).toBeLessThanOrEqual(prazo)
    expect(await contador.restanteMs(contador.chaveDe('sala:teste-janela', randomUUID()))).toBe(0)
    // A do login, sem a opção, continua com o minuto.
    const doLogin = new ContadorEmJanela(cliente, CHAVE)
    const chaveDoLogin = doLogin.chaveDe(PREFIXO_EMAIL_POR_IP, ipSorteado())
    await doLogin.somar(chaveDoLogin)
    expect(await cliente.pttl(chaveDoLogin)).toBeLessThanOrEqual(JANELA_DO_CONTADOR_POR_IP_MS)
  })

  it('concorrência (regra 80, item 7): vinte somas ao mesmo tempo, de duas instâncias, dão os valores de 1 a 20, cada um uma vez', async () => {
    const [instancia1, instancia2] = [new ContadorEmJanela(cliente, CHAVE), new ContadorEmJanela(cliente, CHAVE)]
    const chave = instancia1.chaveDe(PREFIXO_EMAIL_POR_IP, ipSorteado())
    const somas = await Promise.all(Array.from({ length: 20 }, (_, posicao) => (posicao % 2 === 0 ? instancia1 : instancia2).somar(chave)))
    expect(somas.map(({ valor }) => valor).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, posicao) => posicao + 1))
  })

  it('falha (Redis de fila fora): o seguro em memória conta, na mesma janela, diz que é do seguro, volta a 0 depois do minuto e esquece a chave', async () => {
    const fora = createApiRedisClient('redis://127.0.0.1:9', 'teste-janela-fora', () => undefined)
    try {
      const relogio = relogioParado()
      const contador = new ContadorEmJanela(fora, CHAVE, { relogio })
      const chave = contador.chaveDe(PREFIXO_FALHAS_POR_IP_NA_ESCOLA, `${ESCOLA}|${ipSorteado()}`)
      for (let soma = 1; soma <= 3; soma++) expect(await contador.somar(chave)).toEqual({ valor: soma, doSeguro: true })
      expect(await contador.ler(chave)).toEqual({ valor: 3, doSeguro: true })
      expect(contador.proporcaoDoSeguro).toBe(1)

      relogio.avancar(JANELA_DO_CONTADOR_POR_IP_MS - 1)
      expect(await contador.ler(chave)).toEqual({ valor: 3, doSeguro: true })
      relogio.avancar(1)
      expect(await contador.ler(chave)).toEqual({ valor: 0, doSeguro: true })
      // A soma seguinte, de outra chave, varre o que venceu: o HMAC do IP não fica na memória depois do minuto.
      await contador.somar(contador.chaveDe(PREFIXO_EMAIL_POR_IP, ipSorteado()))
      expect(contador.noSeguro).toBe(1)
    } finally {
      fora.disconnect()
    }
  })

  it('falha (Redis de fila travado, com a conexão aberta): cada soma corta nos 100 ms do cliente de produção e cai no seguro, que conta; nenhuma responde "zero" por não saber', async () => {
    const producao = createApiRedisClient(URL_REDIS_FILA, 'teste-janela-travada', () => undefined)
    try {
      await pronto(producao)
      const contador = new ContadorEmJanela(producao, CHAVE)
      const chave = contador.chaveDe(PREFIXO_EMAIL_POR_IP, ipSorteado())
      const travado = await travarRedis(URL_REDIS_FILA, 3_000)
      const somas = []
      for (let soma = 0; soma < 3; soma++) somas.push(await contador.somar(chave))
      expect(producao.status).toBe('ready')
      expect(somas).toEqual([1, 2, 3].map((valor) => ({ valor, doSeguro: true })))
      expect(await contador.ler(chave)).toEqual({ valor: 3, doSeguro: true })
      expect(contador.proporcaoDoSeguro).toBe(1)
      await travado.fim
      // Os scripts que passaram do prazo rodaram quando a pausa acabou: contados no Redis também, para o lado de rebaixar.
      await expect.poll(() => cliente.get(chave), { timeout: 5_000 }).toBe('3')
    } finally {
      producao.disconnect()
    }
  })
})
