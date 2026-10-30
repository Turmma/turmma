import 'reflect-metadata'
import { METRICS } from '@educa/nucleo'
import type { Socket as SocketCliente } from 'socket.io-client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { BancadaDeSessoes, type SessaoDeTeste } from '../../api/test/sessao-de-teste.js'
import { conectar, criarCliente, loggerEmMemoria, subirInstancia, type InstanciaDeTeste } from './realtime-de-teste.js'

// Uma instância do realtime montada como no boot, com o Redis de fila do compose de teste, lendo as métricas
// que ela exportaria.

describe('métricas do realtime', () => {
  const medidor = new MedidorDeTeste()
  const bancada = new BancadaDeSessoes()
  let instancia: InstanciaDeTeste
  const clientes: SocketCliente[] = []
  // Uma sessão real em cada escola: o handshake lê a sessão gravada antes de contar a conexão.
  let sessaoDeA: SessaoDeTeste
  let sessaoDeB: SessaoDeTeste

  beforeAll(async () => {
    instancia = await subirInstancia(loggerEmMemoria().logger, {}, medidor.medidor)
    ;[sessaoDeA, sessaoDeB] = await Promise.all([bancada.escolaComSessao(), bancada.escolaComSessao()])
  })

  afterAll(async () => {
    for (const cliente of clientes) cliente.disconnect()
    await instancia.app.close()
    await medidor.encerrar()
    await bancada.fechar()
  })

  const valores = async (nome: string) => (await medidor.pontos(nome)).map(({ atributos, valor }) => ({ atributos, valor }))

  it('realtime.conexoes acompanha os clientes abertos nesta instância, sem rótulo de escola, sala ou usuário', async () => {
    expect(await valores(METRICS.conexoesRealtime)).toEqual([{ atributos: {}, valor: 0 }])
    for (const sessao of [sessaoDeA, sessaoDeB]) {
      const cliente = criarCliente(instancia.url, await sessao.tokenNovo())
      clientes.push(cliente)
      await conectar(cliente)
    }
    expect(await valores(METRICS.conexoesRealtime)).toEqual([{ atributos: {}, valor: 2 }])

    clientes[0]?.disconnect()
    await expect.poll(async () => (await valores(METRICS.conexoesRealtime))[0]?.valor, { timeout: 5_000, interval: 50 }).toBe(1)
  })

  it('o Redis de fila do adaptador aparece disponível, o pool do banco do handshake é medido, e a prontidão é medida pela rota template', async () => {
    expect(await valores(METRICS.redisDisponivel)).toEqual([{ atributos: { instancia: 'fila' }, valor: 1 }])
    // O pool novo é caminho quente (todo handshake lê a sessão): sem esta série, ninguém vê o pool saturar (regra 80, item 10).
    expect((await medidor.pontos(METRICS.poolEmUso)).length).toBeGreaterThan(0)
    expect((await fetch(`${instancia.url}/prontidao`)).status).toBe(200)
    await expect
      .poll(async () => (await medidor.pontos(METRICS.duracaoHttp)).map(({ atributos }) => atributos['http.route']), { timeout: 5_000, interval: 50 })
      .toContain('/prontidao')
  })
})
