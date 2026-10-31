import { runInContext, jobOptions } from '@educa/core'
import { JobFailureCode, JOB_DEFINITIONS, TIPO_JOB_SINTETICO, type JobRegistry } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { BancadaDeFila, LogEmMemoria } from './fila-de-teste.js'

// O prazo do tipo aplicado pelo worker (reengenharia, RF17, tarefa 43.0): worker de verdade, no processo do teste, contra o
// Postgres e o Redis de fila do compose de teste. O registro de jobs é o de produção com o `prazoMs` do sintético trocado por um
// valor curto, para o corte acontecer em 300 ms e não em 90 s.

const PRAZO_CURTO_MS = 300
const DEFINICOES_COM_PRAZO_CURTO: JobRegistry = {
  ...JOB_DEFINITIONS,
  [TIPO_JOB_SINTETICO]: { ...JOB_DEFINITIONS[TIPO_JOB_SINTETICO], prazoMs: PRAZO_CURTO_MS },
}
/** Um valor que só o `dados` do job tem: se ele aparecer no log, o log vazou o conteúdo do job. */
const CPU_QUE_SO_O_JOB_TEM = 4_242

async function aguardarEstado(bancada: BancadaDeFila, id: string, estado: string, limiteMs = 15_000): Promise<void> {
  await expect.poll(async () => (await bancada.estado(id))?.estado, { timeout: limiteMs, interval: 50 }).toBe(estado)
}

beforeAll(() => {
  // Despachante ou worker do compose de pé disputaria as linhas com os deste arquivo.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('o worker corta a tentativa no prazo do tipo', () => {
  let bancada: BancadaDeFila
  let ESCOLA_A: string

  beforeEach(async () => {
    bancada = new BancadaDeFila(DEFINICOES_COM_PRAZO_CURTO)
    await bancada.limparRegistro()
    ESCOLA_A = await bancada.escola()
  })

  afterEach(async () => {
    await bancada.fechar()
  })

  /** Publica como o despachante, com as tentativas pedidas. */
  async function publicado(tentativas: number, cpuMs = CPU_QUE_SO_O_JOB_TEM): Promise<string> {
    const id = await bancada.enfileirar(ESCOLA_A, { dados: { cpuMs, falhar: false } })
    await bancada.reservar(ESCOLA_A)
    await bancada.fila.add('sintetico', { escolaId: ESCOLA_A, requisicaoId: null }, { ...jobOptions(TIPO_JOB_SINTETICO), attempts: tentativas, jobId: id })
    await runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, () => bancada.despacho.marcarPublicados([id]))
    return id
  }

  it('job que não termina, na última tentativa: falhou/TEMPO_ESGOTADO, a vaga sai do Redis, e o log leva só ids, o prazo e o código', async () => {
    const id = await publicado(1)
    const log = new LogEmMemoria('worker')
    let sinalRecebido: AbortSignal | undefined
    bancada.worker(log, {
      processadores: {
        sintetico: (_dados, _execucao, sinal) => {
          sinalRecebido = sinal
          return new Promise<void>(() => undefined)
        },
      },
    })

    await aguardarEstado(bancada, id, 'falhou')
    expect(await bancada.estado(id)).toEqual({ estado: 'falhou', escolaId: ESCOLA_A, codigoFalha: JobFailureCode.TEMPO_ESGOTADO })
    expect(sinalRecebido?.aborted).toBe(true)
    await expect.poll(() => bancada.vagas.membros('interativa', ESCOLA_A), { timeout: 5_000, interval: 50 }).toEqual([])

    const estouro = log.doEvento('job.tempo_esgotado')
    expect(estouro).toEqual([expect.objectContaining({ jobId: id, tentativa: 1, prazoMs: PRAZO_CURTO_MS })])
    expect(log.doEvento('job.falhou')).toEqual([expect.objectContaining({ jobId: id, codigo: JobFailureCode.TEMPO_ESGOTADO })])
    expect(log.linhas.join('\n')).not.toContain(String(CPU_QUE_SO_O_JOB_TEM))
  })

  it('o estouro libera a vaga da escola logo: com limite de 1, o segundo job roda sem esperar o processador que ignora o sinal', async () => {
    await bancada.configurarEscola(ESCOLA_A, { vagas: { interativa: 1 } })
    // O primeiro processador a ser chamado ignora o sinal e só termina em 8 s; o segundo termina na hora.
    let chamadas = 0
    const processador = (): Promise<void> => (++chamadas === 1 ? new Promise<void>((resolver) => setTimeout(resolver, 8_000)) : Promise.resolve())
    const [primeiro, segundo] = [await publicado(1), await publicado(1)]
    const inicio = performance.now()
    bancada.worker(new LogEmMemoria('worker'), { processadores: { sintetico: processador } })

    await expect
      .poll(async () => [(await bancada.estado(primeiro))?.estado, (await bancada.estado(segundo))?.estado].sort(), { timeout: 6_000, interval: 50 })
      .toEqual(['concluido', 'falhou'])
    // Se a vaga só saísse quando o processador do primeiro terminasse (8 s), o segundo não teria concluído a tempo.
    expect(performance.now() - inicio).toBeLessThan(6_000)
    expect(chamadas).toBe(2)
  })

  it('o estouro com tentativa sobrando também libera a vaga da escola: com limite de 1, o segundo job roda enquanto o primeiro ainda tem tentativas e nunca termina', async () => {
    await bancada.configurarEscola(ESCOLA_A, { vagas: { interativa: 1 } })
    // O job de `cpuMs` 1 nunca termina e ignora o sinal, em toda tentativa; o outro termina na hora.
    const processador = (dados: { cpuMs: number }): Promise<void> => (dados.cpuMs === 1 ? new Promise<void>(() => undefined) : Promise.resolve())
    const preso = await publicado(3, 1)
    bancada.worker(new LogEmMemoria('worker'), { processadores: { sintetico: processador } })
    // O segundo só entra com o primeiro rodando: com os dois na fila, quem toma a vaga primeiro não é garantido.
    await aguardarEstado(bancada, preso, 'ativo')
    const livre = await publicado(1, 2)

    // Se a vaga ficasse com o job preso durante o recuo e as tentativas dele (uns 6 s), o outro não concluiria a tempo.
    await aguardarEstado(bancada, livre, 'concluido', 4_000)
    expect((await bancada.estado(preso))?.estado).not.toBe('falhou')
  })

  it('estouro com tentativa sobrando: a vaga sai, o job volta à fila pelo recuo, e o estado não é falhou', async () => {
    const id = await publicado(3)
    const log = new LogEmMemoria('worker')
    bancada.worker(log, { processadores: { sintetico: () => new Promise<void>(() => undefined) } })

    await expect.poll(() => log.doEvento('job.tempo_esgotado').length, { timeout: 10_000, interval: 50 }).toBeGreaterThan(0)
    expect(log.doEvento('job.falhou')).toEqual([])
    expect((await bancada.estado(id))?.estado).not.toBe('falhou')
    await expect.poll(() => bancada.vagas.membros('interativa', ESCOLA_A), { timeout: 5_000, interval: 50 }).toEqual([])
  })
})
