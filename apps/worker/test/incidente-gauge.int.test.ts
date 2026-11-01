import 'reflect-metadata'
import { currentContext, IncidenteDaEscolaRepository } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import type { StorageConfig } from '../src/config.js'
import { IncidenteGauge } from '../src/incidente-gauge.js'
import { createWorker } from '../src/composition.js'
import { QueueFixtures, configuracaoDoBanco, janelaPadraoDoAmbiente, InMemoryLog, urlRedisDeFila, vagasPadraoDoAmbiente } from './queue.fixture.js'

// A medição `incidente.horas_sem_confirmacao` (F3, tarefa 9.0; Tech Spec do F3, seção 7c) contra o Postgres do compose de teste,
// com a lista de escolas dada e o relógio injetado: as horas desde que a Turmma soube do incidente mais antigo da escola que ainda
// não foi confirmado. O alerta de 24 h em si, com o Prometheus e o Grafana, é `infra/test/alerta-do-incidente.int.test.ts`.

const ambiente = lerAmbienteDeTeste()
const STORAGE: StorageConfig = {
  url: `http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}`,
  regiao: valorObrigatorio(ambiente, 'STORAGE_REGIAO'),
  bucket: valorObrigatorio(ambiente, 'STORAGE_BUCKET'),
  chaveAcesso: valorObrigatorio(ambiente, 'STORAGE_CHAVE_ACESSO'),
  chaveSecreta: valorObrigatorio(ambiente, 'STORAGE_CHAVE_SECRETA'),
}
const AGORA = new Date('2026-10-09T15:00:00-03:00')
const relogio = { agora: () => AGORA }

describe('medição das horas do incidente sem confirmação', () => {
  let bancada: QueueFixtures
  const log = new InMemoryLog('worker-teste')
  const incidentes: string[] = []

  beforeAll(() => {
    bancada = new QueueFixtures()
  })

  afterAll(async () => {
    await bancada.pool.query('delete from incidente where id = any($1::uuid[])', [incidentes])
    await bancada.fechar()
  })

  /** Um incidente que a Turmma soube `horasAtras` antes do `AGORA`, com a seção de cada escola dada; `confirmadoEm` marca a seção como confirmada. */
  async function incidente(horasAtras: number, escolas: ReadonlyArray<string | { escolaId: string; confirmada: true }>): Promise<void> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into incidente (conhecido_em, registrado_por, registrado_em) values ($1::timestamptz - $2::numeric * interval '1 hour', 'equipe-de-teste', $1::timestamptz) returning id`,
      [AGORA.toISOString(), horasAtras],
    )
    const id = rows[0]?.id ?? ''
    incidentes.push(id)
    for (const escola of escolas) {
      const escolaId = typeof escola === 'string' ? escola : escola.escolaId
      await bancada.pool.query(
        `insert into incidente_escola (incidente_id, escola_id, circunstancias, categorias, titulares_estimados, risco, contencao, correcao, confirmado_em)
         values ($1, $2, 'Circunstância sintética', array['cadastro'], 3, 'baixo', 'Contenção sintética', 'Correção sintética', case when $3::boolean then now() else null end)`,
        [id, escolaId, typeof escola !== 'string'],
      )
    }
  }

  function medicaoDe(ids: readonly string[], medidor: MedidorDeTeste, repositorio: Pick<IncidenteDaEscolaRepository, 'conhecidoEmDoPendenteMaisAntigo'> = new IncidenteDaEscolaRepository(bancada.banco)): IncidenteGauge {
    return new IncidenteGauge({ escolas: { listarIds: () => Promise.resolve([...ids]) }, repositorio, relogio, logger: log.logger, medidor: medidor.medidor })
  }

  async function porEscola(medidor: MedidorDeTeste): Promise<Record<string, unknown>> {
    return Object.fromEntries((await medidor.pontos('incidente.horas_sem_confirmacao')).map(({ atributos, valor }) => [String(atributos['escola_id']), valor]))
  }

  it('a série é a idade do incidente mais antigo sem confirmação: 23 h, 25 h, o mais antigo entre dois, e o confirmado e a escola sem incidente ficam sem série', async () => {
    const [a, b, c, d, e] = [await bancada.escola(), await bancada.escola(), await bancada.escola(), await bancada.escola(), await bancada.escola()]
    await incidente(23, [a])
    await incidente(25, [b])
    // C: um velho confirmado e um novo sem confirmação: vale o novo.
    await incidente(70, [{ escolaId: c, confirmada: true }])
    await incidente(2, [c])
    // D: dois sem confirmação, o mais antigo vale; E: só um confirmado.
    await incidente(5, [d])
    await incidente(30, [d])
    await incidente(40, [{ escolaId: e, confirmada: true }])
    const f = await bancada.escola()
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    await medicaoDe([a, b, c, d, e, f], medidor).medir()
    const pontos = await medidor.pontos('incidente.horas_sem_confirmacao')
    expect(await porEscola(medidor)).toEqual({ [a]: 23, [b]: 25, [c]: 2, [d]: 30 })
    // A série traz a escola e o número: nenhum outro rótulo.
    for (const { atributos } of pontos) expect(Object.keys(atributos)).toEqual(['escola_id'])
  })

  it('o incidente de B não aparece na série de A, mesmo dividindo o mesmo incidente; cada escola mede o que é dela', async () => {
    const [a, b] = [await bancada.escola(), await bancada.escola()]
    // O mesmo incidente alcança as duas, e só B confirmou.
    await incidente(40, [a, { escolaId: b, confirmada: true }])
    // Outro, só de B, ainda sem confirmação.
    await incidente(10, [b])
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    await medicaoDe([a, b], medidor).medir()
    expect(await porEscola(medidor)).toEqual({ [a]: 40, [b]: 10 })
  })

  it('a escola que falha fica sem série nesta volta, e as outras são medidas', async () => {
    const [a, b] = [await bancada.escola(), await bancada.escola()]
    await incidente(26, [a, b])
    const real = new IncidenteDaEscolaRepository(bancada.banco)
    const falhaEmB: Pick<IncidenteDaEscolaRepository, 'conhecidoEmDoPendenteMaisAntigo'> = {
      conhecidoEmDoPendenteMaisAntigo: () => (currentContext()?.escolaId === b ? Promise.reject(new Error('banco lento')) : real.conhecidoEmDoPendenteMaisAntigo()),
    }
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    const avisosAntes = log.doEvento('worker.medicao_do_incidente_indisponivel').length
    await medicaoDe([a, b], medidor, falhaEmB).medir()
    expect(await porEscola(medidor)).toEqual({ [a]: 26 })
    expect(log.doEvento('worker.medicao_do_incidente_indisponivel').length).toBeGreaterThan(avisosAntes)
  })

  it('confirmar tira a série na volta seguinte', async () => {
    const a = await bancada.escola()
    await incidente(30, [a])
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    const medicao = medicaoDe([a], medidor)
    await medicao.medir()
    expect(await porEscola(medidor)).toEqual({ [a]: 30 })
    await bancada.pool.query('update incidente_escola set confirmado_em = now() where escola_id = $1', [a])
    await medicao.medir()
    expect(await porEscola(medidor)).toEqual({})
  })

  it('a série é nova a cada volta: o número acompanha o relógio, e escola inexistente na lista não derruba a volta', async () => {
    const a = await bancada.escola()
    await incidente(20, [a])
    let agora = AGORA
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    const medicao = new IncidenteGauge({
      escolas: { listarIds: () => Promise.resolve([randomUUID(), a]) },
      repositorio: new IncidenteDaEscolaRepository(bancada.banco),
      relogio: { agora: () => agora },
      logger: log.logger,
      medidor: medidor.medidor,
    })
    await medicao.medir()
    expect(await porEscola(medidor)).toEqual({ [a]: 20 })
    agora = new Date(AGORA.getTime() + 5 * 3_600_000)
    await medicao.medir()
    expect(await porEscola(medidor)).toEqual({ [a]: 25 })
  })

  it('montada no worker de lote: mede no boot as escolas do banco e para com o worker', async () => {
    const a = await bancada.escola()
    await incidente(31, [a])
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    const worker = createWorker(
      { banco: configuracaoDoBanco(), redisFilaUrl: urlRedisDeFila(), pools: { lote: 2 }, vagasPadrao: vagasPadraoDoAmbiente(), threadsMaximo: 1, storage: STORAGE, janelaPadrao: janelaPadraoDoAmbiente() },
      log.logger,
      { prefixo: bancada.prefixo, relogio, agendamentos: [], medidor: medidor.medidor },
    )
    let encerrado = false
    onTestFinished(async () => {
      if (!encerrado) await worker.encerrar()
    })
    await expect.poll(async () => (await porEscola(medidor))[a], { timeout: 20_000, interval: 100 }).toBe(31)
    await worker.encerrar()
    encerrado = true
  })
})
