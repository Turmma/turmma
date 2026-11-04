import 'reflect-metadata'
import { currentContext, ImportacaoRepository } from '@educa/core'
import { afterAll, describe, expect, it, onTestFinished } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import type { StorageConfig } from '../src/config.js'
import { createWorker } from '../src/composition.js'
import { ImportacaoGauge } from '../src/importacao-gauge.js'
import { configuracaoDoBanco, InMemoryLog, janelaPadraoDoAmbiente, QueueFixtures, urlRedisDeFila, vagasPadraoDoAmbiente } from './queue.fixture.js'

// A medição `importacao.minutos_na_fila` (F2, tarefa 5.0; Tech Spec, seção 7c) contra o Postgres do compose de teste, com a lista
// de escolas dada e o relógio injetado: os minutos desde que a importação `na_fila` mais antiga da escola foi gravada. O alerta de
// 30 min em si, com o Prometheus e o Grafana, é `infra/test/alertas.test.ts`.

const ambiente = lerAmbienteDeTeste()
const STORAGE: StorageConfig = {
  url: `http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}`,
  regiao: valorObrigatorio(ambiente, 'STORAGE_REGIAO'),
  bucket: valorObrigatorio(ambiente, 'STORAGE_BUCKET'),
  chaveAcesso: valorObrigatorio(ambiente, 'STORAGE_CHAVE_ACESSO'),
  chaveSecreta: valorObrigatorio(ambiente, 'STORAGE_CHAVE_SECRETA'),
}
const AGORA = new Date('2026-11-03T10:00:00-03:00')
const relogio = { agora: () => AGORA }
const METRICA = 'importacao.minutos_na_fila'

describe('medição dos minutos da importação de planilha na fila', () => {
  const bancada = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')

  afterAll(async () => {
    await bancada.fechar()
  })

  /** Uma importação da escola no estado dado, gravada `minutosAtras` antes do `AGORA`. */
  async function importacao(escolaId: string, minutosAtras: number, estado: 'na_fila' | 'concluida' | 'falhou' = 'na_fila'): Promise<void> {
    await bancada.pool.query(
      `insert into importacao_planilha (escola_id, tipo, estado, assinatura, linhas, marcas, erro, criado_em, concluida_em)
       values ($1, 'professores', $2::text, 'assinatura-sintetica', case when $2::text = 'na_fila' then '[{"linha": 2}]'::jsonb end, case when $2::text = 'na_fila' then '{"desligar": []}'::jsonb end,
               case when $2::text = 'falhou' then 'erro_interno' end, $3::timestamptz - $4::numeric * interval '1 minute', case when $2::text = 'na_fila' then null else $3::timestamptz end)`,
      [escolaId, estado, AGORA.toISOString(), minutosAtras],
    )
  }

  function medicaoDe(ids: readonly string[], medidor: MedidorDeTeste, repositorio: Pick<ImportacaoRepository, 'criadaEmDaNaFilaMaisAntiga'> = new ImportacaoRepository(bancada.banco)): ImportacaoGauge {
    return new ImportacaoGauge({ escolas: { listarIds: () => Promise.resolve([...ids]) }, repositorio, relogio, logger: log.logger, medidor: medidor.medidor })
  }

  async function porEscola(medidor: MedidorDeTeste): Promise<Record<string, unknown>> {
    return Object.fromEntries((await medidor.pontos(METRICA)).map(({ atributos, valor }) => [String(atributos['escola_id']), valor]))
  }

  it('a série é a idade da `na_fila` mais antiga: 5 min, 31 min, a mais antiga entre duas, e a concluída, a que falhou e a escola sem importação ficam sem série', async () => {
    const [a, b, c, d, e] = [await bancada.escola(), await bancada.escola(), await bancada.escola(), await bancada.escola(), await bancada.escola()]
    await importacao(a, 5)
    await importacao(b, 31)
    // C: uma velha concluída e uma nova na fila: vale a da fila.
    await importacao(c, 600, 'concluida')
    await importacao(c, 2)
    // D: só uma que falhou.
    await importacao(d, 90, 'falhou')
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    await medicaoDe([a, b, c, d, e], medidor).medir()
    expect(await porEscola(medidor)).toEqual({ [a]: 5, [b]: 31, [c]: 2 })
    // A série traz a escola e o número: nenhum id de importação, nenhum autor.
    for (const { atributos } of await medidor.pontos(METRICA)) expect(Object.keys(atributos)).toEqual(['escola_id'])
  })

  it('a importação de B não aparece na série de A: cada escola mede o que é dela', async () => {
    const [a, b] = [await bancada.escola(), await bancada.escola()]
    await importacao(b, 45)
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    await medicaoDe([a, b], medidor).medir()
    expect(await porEscola(medidor)).toEqual({ [b]: 45 })
  })

  it('a escola que falha fica sem série nesta volta, e as outras são medidas', async () => {
    const [a, b] = [await bancada.escola(), await bancada.escola()]
    await importacao(a, 10)
    await importacao(b, 10)
    const real = new ImportacaoRepository(bancada.banco)
    const falhaEmB: Pick<ImportacaoRepository, 'criadaEmDaNaFilaMaisAntiga'> = {
      criadaEmDaNaFilaMaisAntiga: () => (currentContext()?.escolaId === b ? Promise.reject(new Error('banco lento')) : real.criadaEmDaNaFilaMaisAntiga()),
    }
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    const avisosAntes = log.doEvento('worker.medicao_da_importacao_indisponivel').length
    await medicaoDe([a, b], medidor, falhaEmB).medir()
    expect(await porEscola(medidor)).toEqual({ [a]: 10 })
    expect(log.doEvento('worker.medicao_da_importacao_indisponivel').length).toBeGreaterThan(avisosAntes)
  })

  it('o job terminar tira a série na volta seguinte', async () => {
    const a = await bancada.escola()
    await importacao(a, 33)
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    const medicao = medicaoDe([a], medidor)
    await medicao.medir()
    expect(await porEscola(medidor)).toEqual({ [a]: 33 })
    await bancada.pool.query("update importacao_planilha set estado = 'concluida', linhas = null, marcas = null, concluida_em = now() where escola_id = $1", [a])
    await medicao.medir()
    expect(await porEscola(medidor)).toEqual({})
  })

  it('montada no worker de lote: mede no boot as escolas do banco e para com o worker', async () => {
    const a = await bancada.escola()
    await importacao(a, 40)
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
    await expect.poll(async () => (await porEscola(medidor))[a], { timeout: 20_000, interval: 100 }).toBe(40)
    await worker.encerrar()
    encerrado = true
  })
})
