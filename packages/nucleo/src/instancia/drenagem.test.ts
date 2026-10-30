import { Logger } from '@nestjs/common'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { connect, type AddressInfo, type Socket } from 'node:net'
import { setTimeout as esperar } from 'node:timers/promises'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { InvalidConfigError } from '../config/validar-config.js'
import { GracefulShutdown, loadGracefulShutdownConfig } from './drenagem.js'

const config = { esperaDaBordaMs: 4_000, prazoMs: 10_000 }

describe('Drenagem', () => {
  beforeAll(() => {
    Logger.overrideLogger(false)
  })

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pronta até o SIGTERM; a partir dele a prontidão é 503 na hora, antes de a espera da borda acabar', async () => {
    const drenagem = new GracefulShutdown(config, () => undefined)
    expect(drenagem.prontidao()).toEqual({ status: 200, corpo: { pronta: true } })

    let esperaAcabou = false
    const antesDeFechar = drenagem.beforeApplicationShutdown().then(() => {
      esperaAcabou = true
    })
    expect(drenagem.prontidao()).toEqual({ status: 503, corpo: { pronta: false } })

    await vi.advanceTimersByTimeAsync(config.esperaDaBordaMs - 1)
    expect(esperaAcabou).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await antesDeFechar
    expect(esperaAcabou).toBe(true)
    expect(drenagem.prontidao().status).toBe(503)
  })

  it('sai com código 1 quando o fechamento passa do prazo, com requisição ainda presa', async () => {
    const encerrar = vi.fn<(codigo: number) => void>()
    const drenagem = new GracefulShutdown(config, encerrar)
    const antesDeFechar = drenagem.beforeApplicationShutdown()
    await vi.advanceTimersByTimeAsync(config.esperaDaBordaMs)
    await antesDeFechar

    // O servidor ainda não fechou: nenhum `onApplicationShutdown` chegou.
    await vi.advanceTimersByTimeAsync(config.prazoMs - config.esperaDaBordaMs - 1)
    expect(encerrar).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(encerrar).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('não força a saída quando tudo fechou dentro do prazo', async () => {
    const encerrar = vi.fn<(codigo: number) => void>()
    const drenagem = new GracefulShutdown(config, encerrar)
    const antesDeFechar = drenagem.beforeApplicationShutdown()
    await vi.advanceTimersByTimeAsync(config.esperaDaBordaMs)
    await antesDeFechar
    drenagem.onApplicationShutdown()

    await vi.advanceTimersByTimeAsync(config.prazoMs * 2)
    expect(encerrar).not.toHaveBeenCalled()
  })

  it('um segundo sinal durante a drenagem não reinicia a espera nem o prazo', async () => {
    const encerrar = vi.fn<(codigo: number) => void>()
    const drenagem = new GracefulShutdown(config, encerrar)
    void drenagem.beforeApplicationShutdown()
    await vi.advanceTimersByTimeAsync(3_000)
    await drenagem.beforeApplicationShutdown()

    await vi.advanceTimersByTimeAsync(config.prazoMs - 3_000)
    expect(encerrar).toHaveBeenCalledExactlyOnceWith(1)
  })
})

describe('Drenagem com um servidor HTTP de verdade', () => {
  beforeAll(() => {
    Logger.overrideLogger(false)
  })

  it('conexão que a borda abriu e nunca usou não segura o fechamento, e a requisição que já começou termina', async () => {
    const encerrar = vi.fn<(codigo: number) => void>()
    const drenagem = new GracefulShutdown({ esperaDaBordaMs: 50, prazoMs: 5_000 }, encerrar)
    const servidor = createServer((_pedido, resposta) => {
      setTimeout(() => resposta.end('ok'), 300)
    })
    drenagem.prepararServidor(servidor)
    servidor.listen(0, '127.0.0.1')
    await once(servidor, 'listening')
    const { port } = servidor.address() as AddressInfo
    const conexoes: Socket[] = []
    const abrir = async (): Promise<Socket> => {
      const conexao = connect(port, '127.0.0.1')
      conexoes.push(conexao)
      await once(conexao, 'connect')
      return conexao
    }
    try {
      // Como o pool da borda: discada e nunca usada. Mais de uma, como depois de uma rajada.
      await Promise.all([abrir(), abrir(), abrir()])
      // Requisição que chegou pela metade antes do SIGTERM: ela precisa terminar.
      const pelaMetade = await abrir()
      pelaMetade.write('GET /lenta HTTP/1.1\r\nHost: instancia\r\n')
      let resposta = ''
      pelaMetade.on('data', (parte: Buffer) => (resposta += parte.toString()))
      const respondida = once(pelaMetade, 'close')
      await esperar(50)

      await drenagem.beforeApplicationShutdown()
      const inicio = performance.now()
      const fechou = new Promise<'fechou'>((resolver) => servidor.close(() => resolver('fechou')))
      pelaMetade.write('\r\n')

      expect(await Promise.race([fechou, esperar(2_000, 'segurou')])).toBe('fechou')
      expect(performance.now() - inicio).toBeLessThan(2_000)
      await respondida
      expect(resposta).toMatch(/^HTTP\/1\.1 200 OK\r\n/)
      expect(resposta).toMatch(/\r\nConnection: close\r\n/i)
      drenagem.onApplicationShutdown()
      expect(encerrar).not.toHaveBeenCalled()
    } finally {
      for (const conexao of conexoes) conexao.destroy()
      drenagem.onApplicationShutdown()
      servidor.close()
    }
  })
})

describe('lerConfiguracaoDrenagem', () => {
  it('lê espera e prazo do ambiente', () => {
    expect(loadGracefulShutdownConfig({ DRENAGEM_ESPERA_BORDA_MS: '4000', DRENAGEM_PRAZO_MS: '10000' })).toEqual(config)
  })

  it.each([
    ['sem espera', { DRENAGEM_PRAZO_MS: '10000' }, ['DRENAGEM_ESPERA_BORDA_MS']],
    ['sem prazo', { DRENAGEM_ESPERA_BORDA_MS: '4000' }, ['DRENAGEM_PRAZO_MS']],
    ['espera igual ao prazo', { DRENAGEM_ESPERA_BORDA_MS: '10000', DRENAGEM_PRAZO_MS: '10000' }, ['DRENAGEM_ESPERA_BORDA_MS']],
    ['espera zero', { DRENAGEM_ESPERA_BORDA_MS: '0', DRENAGEM_PRAZO_MS: '10000' }, ['DRENAGEM_ESPERA_BORDA_MS']],
  ])('recusa %s', (_caso, ambiente, variaveis) => {
    expect(() => loadGracefulShutdownConfig(ambiente)).toThrow(InvalidConfigError)
    try {
      loadGracefulShutdownConfig(ambiente)
    } catch (erro) {
      expect((erro as InvalidConfigError).variaveis).toEqual(variaveis)
    }
  })
})
