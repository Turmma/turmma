import { Redis } from 'ioredis'
import { afterEach, describe, expect, it } from 'vitest'
import { TokenLimiter, type ResultadoDaReserva } from './token-limiter.js'

/**
 * Sem Redis: um cliente que nunca conecta (`lazyConnect`) não está `ready`, e o `RateLimiterRedis` entrega cada comando ao seguro em memória, que é o balde
 * dividido por `IA_REPLICAS`. Os baldes, as filas, o acerto e a ordem são os mesmos nos dois lados; o que só o Redis prova (a soma entre réplicas) está em `token-limiter.int.test.ts`.
 */
const CONTRATADO = 10_000
const GERAL = 8_000
const FERRAMENTA = 1_500
const NORMAL = 1_000
const MODELO = 'provedor:modelo'

const clientes: Redis[] = []
function limitador(opcoes: { replicas?: number; contratado?: number; relogioMs?: () => number } = {}): TokenLimiter {
  const cliente = new Redis({ lazyConnect: true, enableOfflineQueue: false })
  cliente.on('error', () => undefined)
  clientes.push(cliente)
  return new TokenLimiter(cliente, { tokensPorMinuto: opcoes.contratado ?? CONTRATADO, replicas: opcoes.replicas ?? 1, ...(opcoes.relogioMs === undefined ? {} : { relogioMs: opcoes.relogioMs }) })
}

afterEach(() => {
  for (const cliente of clientes.splice(0)) cliente.disconnect()
})

function concedida(resultado: ResultadoDaReserva) {
  if (!resultado.concedida) throw new Error('a reserva deveria ter sido concedida')
  return resultado
}

describe('TokenLimiter: os baldes (49.0)', () => {
  it('o balde geral tem 80 % do contratado: reserva até ele e recusa o que passa, dizendo em quanto o minuto libera', async () => {
    const limite = limitador()
    concedida(await limite.reservar(MODELO, GERAL, 'interativa'))
    const recusada = await limite.reservar(MODELO, 1, 'interativa')
    expect(recusada.concedida).toBe(false)
    if (recusada.concedida) return
    expect(recusada.msAteLiberar).toBeGreaterThan(0)
    expect(recusada.msAteLiberar).toBeLessThanOrEqual(60_000)
  })

  it('a reserva recusada não enche o balde: quem espera tentando de novo não gasta o minuto que espera liberar', async () => {
    const limite = limitador()
    concedida(await limite.reservar(MODELO, GERAL - 100, 'interativa'))
    for (let tentativa = 0; tentativa < 5; tentativa += 1) expect((await limite.reservar(MODELO, 1_000, 'interativa')).concedida).toBe(false)
    // Só os 100 que sobravam: as cinco recusas não deixaram pontos.
    concedida(await limite.reservar(MODELO, 100, 'interativa'))
  })

  it('o balde é de cada provedor:modelo: o menor tem o seu', async () => {
    const limite = limitador()
    concedida(await limite.reservar(MODELO, GERAL, 'interativa'))
    concedida(await limite.reservar('provedor:menor', GERAL, 'interativa'))
  })

  it('a `ferramenta` tem o balde de 15 % e a `normal` o de 10 %: no teto delas, esperam, e o Tutor da mesma escola segue', async () => {
    const limite = limitador()
    concedida(await limite.reservar(MODELO, FERRAMENTA, 'ferramenta'))
    concedida(await limite.reservar(MODELO, NORMAL, 'normal'))
    expect((await limite.reservar(MODELO, 1, 'ferramenta')).concedida).toBe(false)
    expect((await limite.reservar(MODELO, 1, 'normal')).concedida).toBe(false)
    // O Tutor só olha o geral, que ainda tem 8 000 − 1 500 − 1 000.
    concedida(await limite.reservar(MODELO, GERAL - FERRAMENTA - NORMAL, 'interativa'))
  })

  it('o balde da `ferramenta` cheio recusa sem consultar o geral: a recusa não traz o uso do teto, e o geral não gasta', async () => {
    const limite = limitador()
    concedida(await limite.reservar(MODELO, FERRAMENTA, 'ferramenta'))
    const recusada = await limite.reservar(MODELO, 500, 'ferramenta')
    expect(recusada).toMatchObject({ concedida: false })
    expect(recusada.usoDoTeto).toBeUndefined()
    // O geral só gastou os 1 500 da primeira: o Tutor cabe com o resto do balde.
    const doTutor = concedida(await limite.reservar(MODELO, GERAL - FERRAMENTA, 'interativa'))
    expect(doTutor.usoDoTeto).toBeCloseTo(GERAL / CONTRATADO)
  })

  it('o geral recusa: o que o balde da fila reservou volta (reward), e a fila não gasta o teto dela com chamada que não saiu', async () => {
    const limite = limitador()
    concedida(await limite.reservar(MODELO, GERAL - 100, 'interativa'))
    // Cada pedido de 1 000 da `ferramenta` cabe no balde dela (1 500) e não cabe no geral: se o reward falhasse, o segundo já seria recusado pelo balde da fila.
    for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
      const recusada = await limite.reservar(MODELO, 1_000, 'ferramenta')
      expect(recusada.concedida, `tentativa ${tentativa}`).toBe(false)
      expect(recusada.usoDoTeto, `tentativa ${tentativa}: recusada pelo geral, não pelo balde da fila`).toBeDefined()
    }
  })

  it('a estimativa maior que o balde é reservada pelo tamanho dele: o pedido que nunca caberia não espera à toa', async () => {
    const limite = limitador()
    concedida(await limite.reservar(MODELO, 10 * GERAL, 'interativa'))
    // Ele ocupou o minuto inteiro do balde.
    expect((await limite.reservar(MODELO, 1, 'interativa')).concedida).toBe(false)
    const daFerramenta = limitador()
    concedida(await daFerramenta.reservar(MODELO, 10 * FERRAMENTA, 'ferramenta'))
    expect((await daFerramenta.reservar(MODELO, 1, 'ferramenta')).concedida).toBe(false)
  })

  it('o uso do teto é a fração do contratado que o balde geral consumiu: 0,4 com 4 000 de 10 000, e 0,8 no balde cheio', async () => {
    const limite = limitador()
    expect(concedida(await limite.reservar(MODELO, 4_000, 'interativa')).usoDoTeto).toBeCloseTo(0.4, 6)
    expect(concedida(await limite.reservar(MODELO, 4_000, 'interativa')).usoDoTeto).toBeCloseTo(0.8, 6)
    const cheia = await limite.reservar(MODELO, 1, 'interativa')
    expect(cheia).toMatchObject({ concedida: false })
    expect(cheia.usoDoTeto).toBeCloseTo(0.8, 6)
  })

  it('o contratado que não é redondo: o balde geral lotado (o `floor` de 80 %) também vale 0,8, e o alerta de 0,8 acende', async () => {
    const limite = limitador({ contratado: 1_234_567 })
    const balde = Math.floor(1_234_567 * 0.8)
    const lotada = concedida(await limite.reservar(MODELO, balde, 'interativa'))
    expect(lotada.usoDoTeto).toBeGreaterThanOrEqual(0.8)
    // O `consumidos / contratado` de antes dava 0,7999995 aqui, abaixo do `>= 0,8` do alerta.
    expect(balde / 1_234_567).toBeLessThan(0.8)
  })

  it('a saturação de verdade: sobra menos que o pedido, e a reserva recusada já vale 0,8; o que sobra ainda cabe a um pedido menor', async () => {
    const limite = limitador()
    concedida(await limite.reservar(MODELO, GERAL - 4, 'interativa'))
    const recusada = await limite.reservar(MODELO, 5, 'interativa')
    expect(recusada).toMatchObject({ concedida: false })
    // O balde está em 7 996 de 8 000 e o pedido de 5 não cabe: `consumidos / contratado` diria 0,7996, e o alerta ficaria calado durante a espera e o menor.
    expect(recusada.usoDoTeto).toBeGreaterThanOrEqual(0.8)
    // Acima do pedido recusado, o balde conta só o que foi concedido: 4 tokens de sobra, e a recusa devolveu os 5.
    expect(concedida(await limite.reservar(MODELO, 4, 'interativa')).usoDoTeto).toBeGreaterThanOrEqual(0.8)
  })

  it('estimativa zero ou fracionária reserva ao menos 1 token, arredondada para cima', async () => {
    const limite = limitador()
    concedida(await limite.reservar(MODELO, 0, 'interativa'))
    concedida(await limite.reservar(MODELO, 2.2, 'interativa'))
    // 1 + 3 = 4 usados: sobra GERAL − 4.
    concedida(await limite.reservar(MODELO, GERAL - 4, 'interativa'))
    expect((await limite.reservar(MODELO, 1, 'interativa')).concedida).toBe(false)
  })
})

describe('TokenLimiter: a reserva é acertada pelo uso real', () => {
  it('o uso menor que a estimativa devolve a diferença ao balde geral', async () => {
    const limite = limitador()
    const reserva = concedida(await limite.reservar(MODELO, 4_000, 'interativa')).reserva
    await reserva.acertar(1_000)
    // Ficou 1 000 gasto: cabem 7 000.
    concedida(await limite.reservar(MODELO, 7_000, 'interativa'))
    expect((await limite.reservar(MODELO, 1, 'interativa')).concedida).toBe(false)
  })

  it('o uso maior que a estimativa soma a diferença, sem recusar a chamada que já saiu', async () => {
    const limite = limitador()
    const reserva = concedida(await limite.reservar(MODELO, 4_000, 'interativa')).reserva
    await reserva.acertar(6_000)
    // Ficou 6 000 gasto: só cabem 2 000.
    expect((await limite.reservar(MODELO, 2_001, 'interativa')).concedida).toBe(false)
    concedida(await limite.reservar(MODELO, 2_000, 'interativa'))
  })

  it('o acerto vale também para o balde da fila: a `ferramenta` que gastou menos recupera o teto dela', async () => {
    const limite = limitador()
    const reserva = concedida(await limite.reservar(MODELO, FERRAMENTA, 'ferramenta')).reserva
    await reserva.acertar(500)
    concedida(await limite.reservar(MODELO, FERRAMENTA - 500, 'ferramenta'))
    expect((await limite.reservar(MODELO, 1, 'ferramenta')).concedida).toBe(false)
  })

  it('o uso real maior que o balde da fila soma no balde da fila também', async () => {
    const limite = limitador()
    const reserva = concedida(await limite.reservar(MODELO, 500, 'ferramenta')).reserva
    await reserva.acertar(FERRAMENTA)
    expect((await limite.reservar(MODELO, 1, 'ferramenta')).concedida).toBe(false)
  })

  it('depois do minuto da reserva o acerto não devolve nada: a janela seguinte começa vazia, e devolver nela daria crédito que ninguém gastou', async () => {
    let agora = 1_000_000
    const limite = limitador({ relogioMs: () => agora })
    const reserva = concedida(await limite.reservar(MODELO, GERAL, 'interativa')).reserva
    agora += 60_001
    await reserva.acertar(0)
    // O seguro em memória ainda é o da janela da reserva (o relógio do teste só andou aqui): sem o reward, ele segue cheio.
    expect((await limite.reservar(MODELO, 1, 'interativa')).concedida).toBe(false)
  })

  it('o uso real igual à estimativa (diferença zero) não mexe em nada', async () => {
    const limite = limitador()
    const reserva = concedida(await limite.reservar(MODELO, 1, 'interativa')).reserva
    await reserva.acertar(1)
    concedida(await limite.reservar(MODELO, GERAL - 1, 'interativa'))
  })
})

describe('TokenLimiter: com o Redis fora, cada réplica segura o teto ÷ IA_REPLICAS', () => {
  it('com duas réplicas, o seguro de cada uma tem metade do balde geral', async () => {
    const limite = limitador({ replicas: 2 })
    concedida(await limite.reservar(MODELO, GERAL / 2, 'interativa'))
    expect((await limite.reservar(MODELO, 1, 'interativa')).concedida).toBe(false)
  })

  it('o balde da fila também é dividido: a `ferramenta` de cada réplica segura 15 % ÷ 2', async () => {
    const limite = limitador({ replicas: 2 })
    concedida(await limite.reservar(MODELO, FERRAMENTA / 2, 'ferramenta'))
    expect((await limite.reservar(MODELO, 1, 'ferramenta')).concedida).toBe(false)
  })

  it('nunca libera sem teto: com mais réplicas que tokens, o seguro ainda é de 1', async () => {
    // 80 % de 20 = 16; ÷ 20 = 0,8, que o piso (`insuranceLimit`) leva a 1: a réplica segura 1 token por minuto, e não zero (que não limitaria nada) nem os 16.
    const limite = limitador({ contratado: 20, replicas: 20 })
    concedida(await limite.reservar(MODELO, 1, 'interativa'))
    expect((await limite.reservar(MODELO, 1, 'interativa')).concedida).toBe(false)
  })
})
