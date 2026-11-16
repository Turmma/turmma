import { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { afterAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../../tools/ci/compose.ts'
import { TokenLimiter } from './token-limiter.js'

/**
 * O limite de tokens no Redis de fila de verdade (49.0): as réplicas somam no mesmo balde, o balde da fila e o geral se
 * comportam como a Tech Spec diz, e com o Redis fora cada réplica segura o teto ÷ `IA_REPLICAS`. Cada caso usa um
 * `provedor:modelo` só dele: a chave do balde é essa, e o teste não depende do que outro deixou no Redis.
 */
const URL_DO_REDIS = `redis://127.0.0.1:${valorObrigatorio(lerAmbienteDeTeste(), 'REDIS_FILA_PORTA_HOST')}`
const CONTRATADO = 10_000
const GERAL = 8_000
const FERRAMENTA = 1_500
const NORMAL = 1_000

const clientes: Redis[] = []
/** Uma réplica com o cliente já pronto: o `rejectIfRedisNotReady` mandaria ao seguro em memória a reserva que chegasse antes da conexão, e o caso provaria o seguro, não o Redis. */
async function replica(replicas = 2): Promise<TokenLimiter> {
  const cliente = new Redis(URL_DO_REDIS, { maxRetriesPerRequest: 1 })
  cliente.on('error', () => undefined)
  clientes.push(cliente)
  if (cliente.status !== 'ready') await once(cliente, 'ready')
  return new TokenLimiter(cliente, { tokensPorMinuto: CONTRATADO, replicas })
}
const modeloNovo = (): string => `teste:${randomUUID()}`

afterAll(() => {
  for (const cliente of clientes) cliente.disconnect()
})

describe('TokenLimiter no Redis (49.0)', () => {
  it('duas réplicas reservando em paralelo somam no mesmo balde: a primeira gasta 6 000 (mais que a metade do seguro dela), a outra cabe nos 2 000 que sobram, e depois nenhuma cabe', async () => {
    const a = await replica()
    const b = await replica()
    const modelo = modeloNovo()
    // Com a conta por réplica (o seguro, 4 000 cada) a segunda reserva da primeira já seria recusada.
    const resultados = await Promise.all([a.reservar(modelo, 2_000, 'interativa'), a.reservar(modelo, 2_000, 'interativa'), a.reservar(modelo, 2_000, 'interativa'), b.reservar(modelo, 2_000, 'interativa')])
    expect(resultados.map((resultado) => resultado.concedida)).toEqual([true, true, true, true])
    expect((await b.reservar(modelo, 1, 'interativa')).concedida).toBe(false)
    expect((await a.reservar(modelo, 1, 'interativa')).concedida).toBe(false)
  })

  it('com as reservas abertas juntas pelas duas réplicas, só cabem as que somam o balde: 5 000 + 5 000 deixa uma recusada', async () => {
    const a = await replica()
    const b = await replica()
    const modelo = modeloNovo()
    const resultados = await Promise.all([a.reservar(modelo, 5_000, 'interativa'), b.reservar(modelo, 5_000, 'interativa')])
    expect(resultados.filter((resultado) => resultado.concedida)).toHaveLength(1)
  })

  it('duas réplicas reservando juntas na `ferramenta` somam no balde da fila (15 %): 1 000 + 1 000 deixa uma recusada, e a recusada não consumiu o geral', async () => {
    const a = await replica()
    const b = await replica()
    const modelo = modeloNovo()
    // O balde da `ferramenta` tem 1 500 no Redis, somado entre as duas: a conta por réplica (o seguro, 750 cada) recusaria as duas.
    const resultados = await Promise.all([a.reservar(modelo, 1_000, 'ferramenta'), b.reservar(modelo, 1_000, 'ferramenta')])
    expect(resultados.filter((resultado) => resultado.concedida)).toHaveLength(1)
    // O geral só tem a reserva concedida (1 000): a recusada devolveu o que o balde da fila tinha pedido e nem chegou ao geral.
    expect((await a.reservar(modelo, GERAL - 1_000, 'interativa')).concedida).toBe(true)
    expect((await b.reservar(modelo, 1, 'interativa')).concedida).toBe(false)
  })

  it('a reserva recusada não enche o balde no Redis: o que sobrava ainda cabe depois de várias recusas', async () => {
    const limite = await replica()
    const modelo = modeloNovo()
    expect((await limite.reservar(modelo, GERAL - 100, 'interativa')).concedida).toBe(true)
    for (let tentativa = 0; tentativa < 4; tentativa += 1) expect((await limite.reservar(modelo, 1_000, 'interativa')).concedida).toBe(false)
    expect((await limite.reservar(modelo, 100, 'interativa')).concedida).toBe(true)
  })

  it('a `ferramenta` (15 %) e a `normal` (10 %) no teto esperam enquanto o Tutor roda', async () => {
    const limite = await replica()
    const modelo = modeloNovo()
    expect((await limite.reservar(modelo, FERRAMENTA, 'ferramenta')).concedida).toBe(true)
    expect((await limite.reservar(modelo, NORMAL, 'normal')).concedida).toBe(true)
    const daFerramenta = await limite.reservar(modelo, 1, 'ferramenta')
    expect(daFerramenta.concedida).toBe(false)
    if (!daFerramenta.concedida) expect(daFerramenta.msAteLiberar).toBeGreaterThan(0)
    expect((await limite.reservar(modelo, 1, 'normal')).concedida).toBe(false)
    const doTutor = await limite.reservar(modelo, GERAL - FERRAMENTA - NORMAL, 'interativa')
    expect(doTutor.concedida).toBe(true)
  })

  it('a `ferramenta` no teto dela não consome o balde geral, e o Tutor roda com o geral perto do limite; o geral que recusa devolve o balde da fila', async () => {
    const limite = await replica()
    const modelo = modeloNovo()
    expect((await limite.reservar(modelo, FERRAMENTA, 'ferramenta')).concedida).toBe(true)
    // Cinco tentativas da `ferramenta` no teto: nenhuma chega ao geral.
    for (let tentativa = 0; tentativa < 5; tentativa += 1) expect((await limite.reservar(modelo, 1_000, 'ferramenta')).concedida).toBe(false)
    // O geral só tem os 1 500 da primeira: o Tutor ainda cabe até o resto do balde.
    expect((await limite.reservar(modelo, GERAL - FERRAMENTA, 'interativa')).concedida).toBe(true)
    // Geral cheio, balde da fila com folga: o pedido da `normal` volta ao balde dela quando o geral recusa, e de novo, e de novo.
    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      const recusada = await limite.reservar(modelo, 900, 'normal')
      expect(recusada.concedida).toBe(false)
      expect(recusada.usoDoTeto, 'recusada pelo geral, e não pelo balde da fila').toBeDefined()
    }
  })

  it('o acerto pelo uso real vale no Redis: a reserva de 4 000 que gastou 1 000 devolve 3 000, visíveis à outra réplica', async () => {
    const a = await replica()
    const b = await replica()
    const modelo = modeloNovo()
    const reserva = (await a.reservar(modelo, 4_000, 'interativa'))
    if (!reserva.concedida) throw new Error('deveria caber')
    await reserva.reserva.acertar(1_000)
    expect((await b.reservar(modelo, 7_000, 'interativa')).concedida).toBe(true)
    expect((await b.reservar(modelo, 1, 'interativa')).concedida).toBe(false)
  })

  it('com o Redis fora, cada réplica segura o teto ÷ IA_REPLICAS: 4 000 de 8 000, e o que o Redis somou antes não conta', async () => {
    const limite = await replica(2)
    const cliente = clientes.at(-1)
    const modelo = modeloNovo()
    expect((await limite.reservar(modelo, 1_000, 'interativa')).concedida).toBe(true)
    cliente?.disconnect()
    // Sem o Redis o comando vai ao seguro em memória, que é o balde dividido. A `ferramenta` primeiro, com o geral ainda vazio: cabem 750 (1 500 ÷ 2) e não 751, e quem recusa é só o balde da fila.
    expect((await limite.reservar(modelo, 750, 'ferramenta')).concedida).toBe(true)
    expect((await limite.reservar(modelo, 1, 'ferramenta')).concedida).toBe(false)
    // O geral (8 000 ÷ 2 = 4 000): sobram 3 250 depois dos 750 da `ferramenta`, e nenhum a mais.
    expect((await limite.reservar(modelo, 3_250, 'interativa')).concedida).toBe(true)
    expect((await limite.reservar(modelo, 1, 'interativa')).concedida).toBe(false)
  })
})
