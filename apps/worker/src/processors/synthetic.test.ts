import { JobFailureCode } from '@educa/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { FalhaDeJob } from '../job-failure.error.js'
import { criarProcessadorSintetico, SandboxDeCpu } from './synthetic.js'

const abertos: SandboxDeCpu[] = []

function sandbox(threadsMaximo: number, arquivo?: URL): SandboxDeCpu {
  const criado = arquivo === undefined ? new SandboxDeCpu(threadsMaximo) : new SandboxDeCpu(threadsMaximo, arquivo)
  abertos.push(criado)
  return criado
}

afterEach(async () => {
  await Promise.all(abertos.splice(0).map((aberto) => aberto.encerrar()))
})

const codigoDe = async (promessa: Promise<unknown>): Promise<string | undefined> => {
  try {
    await promessa
    return undefined
  } catch (erro) {
    return erro instanceof FalhaDeJob ? erro.codigo : 'outro erro'
  }
}

describe('SandboxDeCpu: o job sintético queima CPU de verdade, fora do event loop', () => {
  it('queima pelo menos o cpuMs pedido de CPU do processo, e não só espera o relógio', async () => {
    const cpu = sandbox(1)
    await cpu.queimar(1) // a primeira thread nasce fora da medição
    const antes = process.cpuUsage()
    const inicio = performance.now()
    await cpu.queimar(300)
    const gasto = process.cpuUsage(antes)
    expect((gasto.user + gasto.system) / 1_000).toBeGreaterThanOrEqual(300)
    expect(performance.now() - inicio).toBeGreaterThanOrEqual(290)
  })

  it('o event loop segue girando enquanto a thread queima: o worker renova lock e vaga no meio do job', async () => {
    const cpu = sandbox(1)
    let voltas = 0
    const relogio = setInterval(() => voltas++, 20)
    const inicio = performance.now()
    await cpu.queimar(500)
    clearInterval(relogio)
    // Com o laço preso, nenhuma volta aconteceria antes do fim.
    expect(voltas).toBeGreaterThanOrEqual(Math.floor((performance.now() - inicio) / 20 / 3))
    expect(voltas).toBeGreaterThanOrEqual(5)
  })

  it('nunca passa de threadsMaximo: o pedido a mais espera a vez, e a CPU fica no teto do container', async () => {
    const cpu = sandbox(2)
    let maximoVisto = 0
    const amostra = setInterval(() => (maximoVisto = Math.max(maximoVisto, cpu.threads)), 5)
    const inicio = performance.now()
    const terminos: number[] = []
    await Promise.all([0, 1, 2, 3].map(async (indice) => {
      await cpu.queimar(200)
      terminos[indice] = performance.now() - inicio
    }))
    clearInterval(amostra)
    expect(maximoVisto).toBe(2)
    expect(cpu.threads).toBe(2)
    // Duas threads e quatro pedidos de 200 ms de CPU: o terceiro e o quarto só começam depois de um dos dois primeiros.
    expect(Math.max(...terminos)).toBeGreaterThanOrEqual(390)
  })

  it('cpuMs zero não ocupa thread nenhuma', async () => {
    const cpu = sandbox(1)
    await cpu.queimar(0)
    expect(cpu.threads).toBe(0)
  })

  it('thread que morre no meio falha só aquele job, com ERRO_INTERNO (nova tentativa), e dá lugar a outra', async () => {
    const quebrada = new URL('data:text/javascript,import { parentPort } from "node:worker_threads"; parentPort.on("message", () => process.exit(3))')
    const cpu = sandbox(1, quebrada)
    expect(await codigoDe(cpu.queimar(50))).toBe(JobFailureCode.ERRO_INTERNO)
    expect(await codigoDe(cpu.queimar(50))).toBe(JobFailureCode.ERRO_INTERNO)
    const erro = await cpu.queimar(50).catch((falha: unknown) => falha)
    expect(erro).toBeInstanceOf(FalhaDeJob)
    expect((erro as FalhaDeJob).definitiva).toBe(false)
    expect(cpu.threads).toBe(0)
  })

  it('encerrar falha o que está em andamento e na fila, termina as threads, e recusa pedido novo', async () => {
    const cpu = sandbox(1)
    const emAndamento = codigoDe(cpu.queimar(5_000))
    const naFila = codigoDe(cpu.queimar(5_000))
    await new Promise((resolver) => setTimeout(resolver, 50))
    const inicio = performance.now()
    await cpu.encerrar()
    expect(await emAndamento).toBe(JobFailureCode.ERRO_INTERNO)
    expect(await naFila).toBe(JobFailureCode.ERRO_INTERNO)
    expect(performance.now() - inicio).toBeLessThan(2_000)
    expect(cpu.threads).toBe(0)
    expect(await codigoDe(cpu.queimar(10))).toBe(JobFailureCode.ERRO_INTERNO)
  })

  describe('sinal abortado (o prazo do job estourou, ou o worker foi desligado)', () => {
    it('termina a thread que queimava, rejeita com EXECUCAO_INTERROMPIDA e deixa a vaga de thread para o pedido seguinte', async () => {
      const cpu = sandbox(1)
      const controle = new AbortController()
      const queimando = codigoDe(cpu.queimar(60_000, controle.signal))
      await new Promise((resolver) => setTimeout(resolver, 50))
      expect(cpu.threads).toBe(1)

      const inicio = performance.now()
      controle.abort()
      // A thread que o aborto está terminando já não é contada: o teto de threads não espera o `exit` dela.
      expect(cpu.threads).toBe(0)
      expect(await queimando).toBe(JobFailureCode.EXECUCAO_INTERROMPIDA)
      // Os 60 s de CPU não chegam ao fim: o pedido seguinte usa outra thread, e a primeira não segue queimando.
      await cpu.queimar(20)
      expect(performance.now() - inicio).toBeLessThan(3_000)
      const antes = process.cpuUsage()
      await new Promise((resolver) => setTimeout(resolver, 400))
      const gasto = process.cpuUsage(antes)
      expect((gasto.user + gasto.system) / 1_000).toBeLessThan(200)
    })

    it('o pedido que esperava na fila sai dela: não ocupa thread depois, e o que queimava segue até o fim', async () => {
      const cpu = sandbox(1)
      const controle = new AbortController()
      const primeiro = cpu.queimar(300)
      const naFila = codigoDe(cpu.queimar(60_000, controle.signal))
      await new Promise((resolver) => setTimeout(resolver, 20))
      controle.abort()
      expect(await naFila).toBe(JobFailureCode.EXECUCAO_INTERROMPIDA)

      const inicio = performance.now()
      await primeiro
      // Se o pedido abortado tivesse ficado na fila, a thread passaria a queimar os seus 60 s e este teste não chegaria aqui.
      await cpu.queimar(20)
      expect(performance.now() - inicio).toBeLessThan(3_000)
    })

    it('sinal que já chegou abortado rejeita na hora, sem criar thread', async () => {
      const cpu = sandbox(1)
      expect(await codigoDe(cpu.queimar(5_000, AbortSignal.abort()))).toBe(JobFailureCode.EXECUCAO_INTERROMPIDA)
      expect(cpu.threads).toBe(0)
    })

    it('pedido que terminou antes do aborto não é tocado: abortar depois não derruba a thread nem o pedido seguinte', async () => {
      const cpu = sandbox(1)
      const controle = new AbortController()
      await cpu.queimar(20, controle.signal)
      controle.abort()
      await expect(cpu.queimar(20)).resolves.toBeUndefined()
      expect(cpu.threads).toBe(1)
    })
  })

  it('recusa teto de threads que não é inteiro positivo', () => {
    expect(() => new SandboxDeCpu(0)).toThrow()
    expect(() => new SandboxDeCpu(1.5)).toThrow()
  })
})

describe('processador sintético', () => {
  const EXECUCAO = { jobId: '0190f5a0-0000-7000-8000-0000000000f1', tentativa: 1, chaveIdempotencia: '0190f5a0-0000-7000-8000-0000000000f1', prazoMs: 90_000 }
  const semEfeito = { gravar: () => Promise.reject(new Error('sem efeito pedido, nada é gravado')) }

  it('queima a CPU no sandbox e só então falha, quando pedido', async () => {
    const pedidos: number[] = []
    const processar = criarProcessadorSintetico({ queimar: async (cpuMs) => void pedidos.push(cpuMs) }, semEfeito)
    await expect(processar({ cpuMs: 120, falhar: false }, EXECUCAO)).resolves.toBeUndefined()
    expect(await codigoDe(processar({ cpuMs: 80, falhar: true }, EXECUCAO))).toBe(JobFailureCode.FALHA_SINTETICA)
    expect(pedidos).toEqual([120, 80])
  })

  it('passa o sinal da execução à queima de CPU: é por ele que o corte do prazo chega à thread', async () => {
    const recebidos: Array<AbortSignal | undefined> = []
    const processar = criarProcessadorSintetico({ queimar: async (_cpuMs, sinal) => void recebidos.push(sinal) }, semEfeito)
    const sinal = new AbortController().signal
    await processar({ cpuMs: 10, falhar: false }, EXECUCAO, sinal)
    expect(recebidos).toEqual([sinal])
  })

  it('modo efeito: grava com a chave de idempotência e a tentativa da execução, depois da CPU e antes da falha pedida', async () => {
    const passos: string[] = []
    const processar = criarProcessadorSintetico(
      { queimar: async () => void passos.push('queimou') },
      {
        gravar: async (efeito) => {
          passos.push(`gravou:${efeito.chaveIdempotencia}:${efeito.tentativa}`)
          return true
        },
      },
    )
    const chaveIdempotencia = '0190f5a0-0000-7000-8000-0000000000f2'
    expect(await codigoDe(processar({ cpuMs: 10, falhar: true, efeito: true }, { jobId: chaveIdempotencia, tentativa: 2, chaveIdempotencia, prazoMs: 90_000 }))).toBe(
      JobFailureCode.FALHA_SINTETICA,
    )
    expect(passos).toEqual(['queimou', `gravou:${chaveIdempotencia}:2`])
  })
})
