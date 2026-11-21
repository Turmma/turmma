import 'reflect-metadata'
import { createDatabase, createPool, OrcamentoDoMesRepository, requireEscolaId, type CronEscolasRepository } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it, onTestFinished } from 'vitest'
import { esperarNaTrava, WriteBlockTrigger } from '../../api/test/write-block-trigger.js'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import type { StorageConfig } from '../src/config.js'
import { createWorker } from '../src/composition.js'
import { OrcamentoGauge } from '../src/orcamento-gauge.js'
import { configuracaoDoBanco, InMemoryLog, janelaPadraoDoAmbiente, QueueFixtures, urlRedisDeFila, vagasPadraoDoAmbiente } from './queue.fixture.js'

// A medida `ia.orcamento.uso_do_mes` e `ia.orcamento.uso_do_teto` (camada-ia, tarefa 4.0; Tech Spec, seções 5, 6 e 7c; `cenarios.md`, RF8 e RF9 e a corrida do retrato) contra o Postgres do compose de teste, com a
// lista de escolas dada e o relógio injetado: uma soma só por escola, o retrato do mês regravado com `on conflict`, e nenhuma série para a escola sem orçamento ou sem aluno ativo. Os alertas em si, com o Prometheus
// e o Grafana, são `infra/test/alertas.test.ts`.

const ambiente = lerAmbienteDeTeste()
const STORAGE: StorageConfig = {
  url: `http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}`,
  regiao: valorObrigatorio(ambiente, 'STORAGE_REGIAO'),
  bucket: valorObrigatorio(ambiente, 'STORAGE_BUCKET'),
  chaveAcesso: valorObrigatorio(ambiente, 'STORAGE_CHAVE_ACESSO'),
  chaveSecreta: valorObrigatorio(ambiente, 'STORAGE_CHAVE_SECRETA'),
}
const REAIS = 1_000_000
const MES = 'ia.orcamento.uso_do_mes'
const TETO = 'ia.orcamento.uso_do_teto'
/** Dia 10 de novembro, ao meio-dia em São Paulo: meio do mês. */
const AGORA = new Date('2026-11-10T12:00:00-03:00')
const NO_MES = '2026-11-05T12:00:00-03:00'
/** Dia 31 de março às 21h30 em São Paulo: o mês que acaba, e não o seguinte, mesmo já sendo abril em UTC. */
const FIM_DE_MARCO = new Date('2026-03-31T21:30:00-03:00')
const COMECO_DE_ABRIL = new Date('2026-04-01T00:30:00-03:00')

describe('medição do uso do orçamento de IA do mês', () => {
  const bancada = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')

  afterAll(async () => {
    await bancada.fechar()
  })

  interface Montagem {
    /** O valor por aluno da escola, em micros; sem ele, e sem valor na rede, a escola é `sem_orcamento`. */
    readonly valor?: number
    readonly teto?: number
    readonly alunos?: number
    readonly gastoMicros?: number
  }

  /** Insere uma linha e devolve o id dela. */
  async function inserir(texto: string, valores: unknown[]): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(texto, valores)
    return rows.map((linha) => linha.id).join('')
  }

  /** Uma escola em rede própria, com ano em curso, a configuração e os alunos ativos dados, e o consumo do mês. */
  async function escola(montagem: Montagem = {}): Promise<string> {
    const escolaId = await bancada.escola()
    const anoId = await inserir("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])
    const serieId = await inserir("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId])
    const turmaId = await inserir("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºB') returning id", [escolaId, anoId, serieId])
    const contaId = await inserir('insert into conta (email) values ($1) returning id', [`orcamento-${randomUUID()}@educa.invalid`])
    const coordenadorId = await inserir("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'coordenador', 'Coordenação sintética') returning id", [escolaId, contaId])
    base.set(escolaId, { anoId, turmaId, coordenadorId })
    await bancada.pool.query(
      `insert into configuracao_operacional_escola (escola_id, ia_valor_por_aluno_micros, ia_teto_de_seguranca_percentual) values ($1, $2, $3)
       on conflict (escola_id) do update set ia_valor_por_aluno_micros = excluded.ia_valor_por_aluno_micros, ia_teto_de_seguranca_percentual = excluded.ia_teto_de_seguranca_percentual`,
      [escolaId, montagem.valor ?? null, montagem.teto ?? null],
    )
    await maisAlunos(escolaId, montagem.alunos ?? 0)
    await gastar(escolaId, montagem.gastoMicros ?? 0)
    return escolaId
  }

  /** O ano, a turma e a coordenação de cada escola que `escola()` montou. */
  const base = new Map<string, { anoId: string; turmaId: string; coordenadorId: string }>()

  /** Mais `quantos` alunos ativos (vínculo de aluno não encerrado) numa escola que `escola()` já montou. */
  async function maisAlunos(escolaId: string, quantos: number): Promise<void> {
    if (quantos === 0) return
    const { anoId, turmaId, coordenadorId } = base.get(escolaId) ?? { anoId: '', turmaId: '', coordenadorId: '' }
    await bancada.pool.query(
      `with novos as (
         insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno sintético' from generate_series(1, $2::int) returning id
       ) insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, criado_por) select $1, $3, id, $4, 'aluno', $5 from novos`,
      [escolaId, quantos, anoId, turmaId, coordenadorId],
    )
  }

  /** Uma chamada da escola no mês, com o custo gravado. */
  async function gastar(escolaId: string, custoMicros: number, em = NO_MES): Promise<void> {
    if (custoMicros === 0) return
    await bancada.pool.query(
      `insert into consumo_ia (escola_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, custo_micros, em)
       values ($1, 'gerar_atividade_objetiva', 'conversa_e_ferramentas', 'padrao', 'openai_compat', 'modelo-de-teste', '2026-11-21.1', 100, 50, 10, false, 1, 'concluida', $2, $3::timestamptz)`,
      [escolaId, custoMicros, em],
    )
  }

  const retratos = async (escolaId: string) =>
    (await bancada.pool.query<{ mes: string; alunos: number; valor: string | null; teto: number; origem: string }>(
      'select mes::text, alunos_ativos as alunos, valor_por_aluno_micros::text as valor, teto_percentual as teto, origem_do_valor as origem from orcamento_ia_do_mes where escola_id = $1 order by mes',
      [escolaId],
    )).rows

  function medicaoDe(ids: readonly string[], medidor: MedidorDeTeste, agora: Date = AGORA, repositorio: Pick<OrcamentoDoMesRepository, 'regravarRetrato'> = new OrcamentoDoMesRepository(bancada.banco), lista?: Pick<CronEscolasRepository, 'listIds'>): OrcamentoGauge {
    return new OrcamentoGauge({ escolas: lista ?? { listIds: () => Promise.resolve([...ids]) }, repositorio, relogio: { agora: () => agora }, logger: log.logger, medidor: medidor.medidor })
  }

  async function porEscola(medidor: MedidorDeTeste, metrica: string): Promise<Record<string, unknown>> {
    return Object.fromEntries((await medidor.pontos(metrica)).map(({ atributos, valor }) => [String(atributos['escola_id']), valor]))
  }

  const medidorDoTeste = (): MedidorDeTeste => {
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    return medidor
  }

  it('a medida publica 0,79 → 0,81 → 1,02 para a escola certa, e a outra escola, com número e teto diferentes, não se mexe', async () => {
    // A: 100 alunos, R$ 5, teto 200%: orçamento de R$ 500, teto de R$ 1.000. B: 900 alunos, R$ 1, teto 100%: orçamento de R$ 900, teto de R$ 900, já acima dele com R$ 1.000.
    const a = await escola({ valor: 5 * REAIS, teto: 200, alunos: 100, gastoMicros: 395 * REAIS })
    const b = await escola({ valor: 1 * REAIS, teto: 100, alunos: 900, gastoMicros: 1_000 * REAIS })
    const medidor = medidorDoTeste()
    const medicao = medicaoDe([a, b], medidor)

    await medicao.medir()
    expect((await porEscola(medidor, MES))[a]).toBeCloseTo(0.79, 10)
    expect((await porEscola(medidor, TETO))[a]).toBeCloseTo(0.395, 10)
    await gastar(a, 10 * REAIS)
    await medicao.medir()
    expect((await porEscola(medidor, MES))[a]).toBeCloseTo(0.81, 10)
    expect((await porEscola(medidor, TETO))[a]).toBeCloseTo(0.405, 10)
    await gastar(a, 105 * REAIS)
    await medicao.medir()
    const mes = await porEscola(medidor, MES)
    const teto = await porEscola(medidor, TETO)
    expect(mes[a]).toBeCloseTo(1.02, 10)
    expect(teto[a]).toBeCloseTo(0.51, 10)
    // B, nas três voltas, é a dela: R$ 1.000 sobre R$ 900, tanto no orçamento quanto no teto (100%). A soma de uma não entra na outra.
    expect(mes[b]).toBeCloseTo(1_000 / 900, 10)
    expect(teto[b]).toBeCloseTo(1_000 / 900, 10)
    expect(Object.keys(mes).sort()).toEqual([a, b].sort())
    expect(Object.keys(teto).sort()).toEqual([a, b].sort())
    // A série traz a escola e um número: nenhum valor em reais, aluno ou id de consumo.
    for (const metrica of [MES, TETO]) for (const { atributos } of await medidor.pontos(metrica)) expect(Object.keys(atributos)).toEqual(['escola_id'])
  })

  it('a escola `sem_orcamento` e a `sem_aluno_ativo` não têm série nenhuma, e o retrato delas é regravado do mesmo jeito', async () => {
    const [semValor, semAluno, comOrcamento] = [await escola({ alunos: 50, gastoMicros: 900 * REAIS }), await escola({ valor: 5 * REAIS, teto: 200, gastoMicros: 900 * REAIS }), await escola({ valor: 5 * REAIS, alunos: 10, gastoMicros: 25 * REAIS })]
    const medidor = medidorDoTeste()
    await medicaoDe([semValor, semAluno, comOrcamento], medidor).medir()
    // Sem divisão por zero: nem `Infinity` nem `NaN` numa série. A escola com orçamento (R$ 50, R$ 25 gastos) é a única.
    expect(await porEscola(medidor, MES)).toEqual({ [comOrcamento]: 0.5 })
    expect(await porEscola(medidor, TETO)).toEqual({ [comOrcamento]: 0.25 })
    expect(await retratos(semValor)).toEqual([{ mes: '2026-11-01', alunos: 50, valor: null, teto: 200, origem: 'nenhuma' }])
    expect(await retratos(semAluno)).toEqual([{ mes: '2026-11-01', alunos: 0, valor: String(5 * REAIS), teto: 200, origem: 'escola' }])
  })

  it('a escola que deixa de ter orçamento perde as duas séries na volta seguinte, e a que falha fica sem elas nesta volta, com as outras medidas', async () => {
    const [a, b, c] = [await escola({ valor: 5 * REAIS, alunos: 10, gastoMicros: 5 * REAIS }), await escola({ valor: 5 * REAIS, alunos: 10, gastoMicros: 10 * REAIS }), await escola({ valor: 5 * REAIS, alunos: 10, gastoMicros: 15 * REAIS })]
    const real = new OrcamentoDoMesRepository(bancada.banco)
    const quebrados = new Set<string>()
    const repositorio: Pick<OrcamentoDoMesRepository, 'regravarRetrato'> = {
      regravarRetrato: (agora) => (quebrados.has(requireEscolaId()) ? Promise.reject(new Error('banco fora')) : real.regravarRetrato(agora)),
    }
    const medidor = medidorDoTeste()
    const medicao = medicaoDe([a, b, c], medidor, AGORA, repositorio)
    await medicao.medir()
    expect(Object.keys(await porEscola(medidor, MES)).sort()).toEqual([a, b, c].sort())
    expect(Object.keys(await porEscola(medidor, TETO)).sort()).toEqual([a, b, c].sort())

    // B perde o valor (sem orçamento) e C falha na leitura: as duas somem das duas séries, e A segue.
    await bancada.pool.query('update configuracao_operacional_escola set ia_valor_por_aluno_micros = null where escola_id = $1', [b])
    quebrados.add(c)
    await medicao.medir()
    expect(Object.keys(await porEscola(medidor, MES))).toEqual([a])
    expect(Object.keys(await porEscola(medidor, TETO))).toEqual([a])
  })

  it('a lista de escolas que falha zera as duas séries', async () => {
    const a = await escola({ valor: 5 * REAIS, alunos: 10, gastoMicros: 5 * REAIS })
    let listaFora = false
    const medidor = medidorDoTeste()
    const medicao = medicaoDe([], medidor, AGORA, undefined, { listIds: () => (listaFora ? Promise.reject(new Error('banco fora')) : Promise.resolve([a])) })
    await medicao.medir()
    expect(Object.keys(await porEscola(medidor, TETO))).toEqual([a])
    listaFora = true
    await medicao.medir()
    expect(await porEscola(medidor, MES)).toEqual({})
    expect(await porEscola(medidor, TETO)).toEqual({})
  })

  it('o retrato às 21h30 do último dia grava o mês que acaba, e depois da meia-noite, o seguinte: cada mês, a sua linha', async () => {
    const a = await escola({ valor: 5 * REAIS, alunos: 10 })
    const medidor = medidorDoTeste()
    // 21h30 de 31/03 em São Paulo já é 00h30 de 1º/04 em UTC: o mês é o de São Paulo.
    await medicaoDe([a], medidor, FIM_DE_MARCO).medir()
    expect((await retratos(a)).map((linha) => linha.mes)).toEqual(['2026-03-01'])
    await medicaoDe([a], medidor, COMECO_DE_ABRIL).medir()
    expect((await retratos(a)).map((linha) => linha.mes)).toEqual(['2026-03-01', '2026-04-01'])
  })

  it('duas réplicas da medida regravando o mesmo mês: a segunda espera na trava da primeira, a linha é uma só e vale a do último valor', async () => {
    const a = await escola({ valor: 5 * REAIS, alunos: 10 })
    const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'orcamento_ia_do_mes', evento: 'insert', quando: `new.escola_id = '${a}'` })
    await parada.armar()
    onTestFinished(() => parada.desarmar())
    const medidor = medidorDoTeste()
    // As duas réplicas têm o pool delas (o da bancada tem prazo de 2 s por consulta, e a primeira fica parada de propósito).
    const poolDasReplicas = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 6, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    onTestFinished(() => poolDasReplicas.end())
    const repositorio = new OrcamentoDoMesRepository(createDatabase(poolDasReplicas))
    const primeira = medicaoDe([a], medidor, AGORA, repositorio).medir()
    await parada.esperarParadas(1)
    // Com a primeira parada no meio do `insert` (com 10 alunos, ainda sem confirmar), entram mais 5 alunos e chega a segunda réplica: ela lê 15 e fica esperando a linha da primeira.
    await maisAlunos(a, 5)
    const segunda = medicaoDe([a], medidor, AGORA, repositorio).medir()
    // Duas na trava: a primeira, parada no gatilho, e a segunda, esperando na chave única a transação da primeira. Com uma só, a espera já se satisfaz com a primeira.
    await esperarNaTrava(bancada.pool, '%orcamento_ia_do_mes%', 2)
    expect(await retratos(a)).toEqual([])
    await parada.soltar()
    await Promise.all([primeira, segunda])
    // Uma linha por (escola, mês), e a da réplica que gravou por último: 15 alunos. Sem o `on conflict do update` a segunda cairia com 23505, ou deixaria os 10 da primeira.
    expect(await retratos(a)).toEqual([expect.objectContaining({ mes: '2026-11-01', alunos: 15 })])
  })

  it('montada no worker de lote: mede no boot as escolas do banco, publica as duas séries, grava o retrato e para com o worker', async () => {
    const a = await escola({ valor: 5 * REAIS, teto: 200, alunos: 10, gastoMicros: 25 * REAIS })
    const medidor = medidorDoTeste()
    const worker = createWorker(
      { banco: configuracaoDoBanco(), redisFilaUrl: urlRedisDeFila(), pools: { lote: 2 }, vagasPadrao: vagasPadraoDoAmbiente(), threadsMaximo: 1, storage: STORAGE, janelaPadrao: janelaPadraoDoAmbiente() },
      log.logger,
      { prefixo: bancada.prefixo, relogio: { agora: () => AGORA }, agendamentos: [], medidor: medidor.medidor },
    )
    let encerrado = false
    onTestFinished(async () => {
      if (!encerrado) await worker.encerrar()
    })
    await expect.poll(async () => (await porEscola(medidor, MES))[a], { timeout: 30_000, interval: 100 }).toBe(0.5)
    expect((await porEscola(medidor, TETO))[a]).toBe(0.25)
    expect((await retratos(a)).map((linha) => linha.mes)).toEqual(['2026-11-01'])
    await worker.encerrar()
    encerrado = true
  })
})
