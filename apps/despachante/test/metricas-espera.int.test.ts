import 'reflect-metadata'
import {
  criarBanco,
  criarPool,
  DespachoRepository,
  ExpurgoDeJobsRepository,
  METRICAS,
  METRICAS_COM_ESCOLA,
  TETO_DA_CONTAGEM_DE_FALHOS,
  TETO_DA_CONTAGEM_DE_PENDENTES,
  type MedicaoDeFalhos,
  type MedicaoDePendentes,
} from '@educa/nucleo'
import type { QueueName } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { BancadaDeFila, configuracaoDoBanco, LogEmMemoria } from '../../worker/test/fila-de-teste.js'

// A medição das filas do despachante de verdade (a mesma montagem do main.ts), contra o Postgres e o Redis
// de fila do compose de teste, com o horário letivo padrão de `.env.example`. O relógio falso põe a escola
// numa terça às 10h, em aula; a espera é contada no relógio do banco.

const TERCA_10H = new Date('2026-09-15T10:00:00-03:00')

interface NoDoPlano {
  'Node Type'?: string
  'Relation Name'?: string
  'Index Name'?: string
  Plans?: NoDoPlano[]
}

function nosDoPlano(no: NoDoPlano | undefined): NoDoPlano[] {
  return no === undefined ? [] : [no, ...(no.Plans ?? []).flatMap(nosDoPlano)]
}

beforeAll(() => {
  // Despachante ou worker do compose de pé disputaria as linhas e as vagas com os deste arquivo.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('medição das filas por escola, no despachante', () => {
  let bancada: BancadaDeFila
  // Escolas reais, criadas a cada caso: desde a tarefa 3.0 `job_registro` e
  // `configuracao_operacional_escola` têm FK para `escola`, e id inventado é recusado pelo banco.
  let ESCOLA_A: string
  let ESCOLA_B: string
  let medidor: MedidorDeTeste

  beforeEach(async () => {
    bancada = new BancadaDeFila()
    medidor = new MedidorDeTeste()
    await bancada.limparRegistro()
    // O id da escola é sorteado e não cresce com a criação (o `ops:escola` e o painel mandam UUID v4). A ordem ruim fica
    // fixa: a A com o id maior, para que asserção que dependa da ordem dos ids falhe sempre, e não em metade das vezes.
    ;[ESCOLA_B, ESCOLA_A] = (await Promise.all([bancada.escola(), bancada.escola()])).sort()
  })

  afterEach(async () => {
    await bancada.fechar()
    await medidor.encerrar()
  }, 60_000)

  /** Enfileira e recua a criação, para a espera ter um valor conhecido no relógio do banco. */
  async function job(escolaId: string, fila: QueueName, { naoUrgente = false, haSegundos = 0, estado }: { naoUrgente?: boolean; haSegundos?: number; estado?: string } = {}): Promise<string> {
    const id = await bancada.enfileirar(escolaId, { fila, naoUrgente })
    await bancada.pool.query(`update job_registro set criado_em = now() - make_interval(secs => $2), estado = coalesce($3, estado) where id = $1`, [id, haSegundos, estado ?? null])
    return id
  }

  async function medir(): Promise<void> {
    const { medicao } = bancada.despachante(new LogEmMemoria('despachante'), { medidor: medidor.medidor, relogio: { agora: () => TERCA_10H } })
    if (medicao === undefined) throw new Error('o despachante com medidor não montou a medição')
    await medicao.medir()
  }

  const porSerie = async (nome: string) =>
    Object.fromEntries((await medidor.pontos(nome)).map(({ atributos, valor }) => [`${String(atributos['fila'])}:${String(atributos['escola_id'])}`, valor]))

  it('caminho feliz: as filas da escola A e da B saem em séries separadas, com espera do mais antigo, pendentes e vagas', async () => {
    await job(ESCOLA_A, 'interativa', { haSegundos: 300, estado: 'ativo' })
    await job(ESCOLA_A, 'interativa', { haSegundos: 40 })
    await job(ESCOLA_A, 'interativa', { haSegundos: 10, estado: 'publicado' })
    await job(ESCOLA_A, 'lote', { haSegundos: 120 })
    await job(ESCOLA_B, 'interativa', { haSegundos: 5 })
    await job(ESCOLA_B, 'normal', { haSegundos: 900, estado: 'concluido' })
    // Falha permanente não espera mais nada: nem no mais antigo da fila que tem pendente, nem abrindo série na que não tem.
    await job(ESCOLA_B, 'interativa', { haSegundos: 600, estado: 'falhou' })
    await job(ESCOLA_B, 'lote', { haSegundos: 600, estado: 'falhou' })
    const [comVaga = '', outraComVaga = ''] = await Promise.all([randomUUID(), randomUUID()])
    await bancada.vagas.tomar('interativa', ESCOLA_A, 5, [comVaga, outraComVaga])

    await medir()

    const espera = await porSerie(METRICAS.esperaMaisAntiga)
    expect(Object.keys(espera).sort()).toEqual([`interativa:${ESCOLA_A}`, `interativa:${ESCOLA_B}`, `lote:${ESCOLA_A}`].sort())
    // O ativo de 300 s já começou: não espera. O mais antigo que não começou é o de 40 s. Concluído e falho não aparecem.
    expect(espera[`interativa:${ESCOLA_A}`]).toBeGreaterThanOrEqual(40)
    expect(espera[`interativa:${ESCOLA_A}`]).toBeLessThan(45)
    expect(espera[`lote:${ESCOLA_A}`]).toBeGreaterThanOrEqual(120)
    expect(espera[`interativa:${ESCOLA_B}`]).toBeGreaterThanOrEqual(5)
    expect(espera[`interativa:${ESCOLA_B}`]).toBeLessThan(10)
    expect(await porSerie(METRICAS.pendentes)).toEqual({ [`interativa:${ESCOLA_A}`]: 2, [`lote:${ESCOLA_A}`]: 1, [`interativa:${ESCOLA_B}`]: 1 })
    expect(await porSerie(METRICAS.vagasEmUso)).toEqual({ [`interativa:${ESCOLA_A}`]: 2, [`lote:${ESCOLA_A}`]: 0, [`interativa:${ESCOLA_B}`]: 0 })
  })

  it('borda: terça às 10h, o não urgente segurado no lote conta nos pendentes e não na espera; o urgente atrás dele espera', async () => {
    await job(ESCOLA_A, 'lote', { naoUrgente: true, haSegundos: 3 * 3_600 })
    await job(ESCOLA_B, 'lote', { naoUrgente: true, haSegundos: 3 * 3_600 })
    await job(ESCOLA_B, 'lote', { haSegundos: 20 })

    await medir()

    expect(await porSerie(METRICAS.pendentes)).toEqual({ [`lote:${ESCOLA_A}`]: 1, [`lote:${ESCOLA_B}`]: 2 })
    const espera = await porSerie(METRICAS.esperaMaisAntiga)
    expect(Object.keys(espera)).toEqual([`lote:${ESCOLA_B}`])
    expect(espera[`lote:${ESCOLA_B}`]).toBeGreaterThanOrEqual(20)
    expect(espera[`lote:${ESCOLA_B}`]).toBeLessThan(3_600)
  })

  it('permissão: a rotina do sistema sai como `sistema`; as de job levam só fila e escola, e as do processo (pool, Redis) não levam escola', async () => {
    await bancada.pool.query(`insert into job_registro (fila, prioridade, tipo, estado, criado_em) values ('normal', 1, 'sistema.consolidar-uso', 'aguardando', now() - interval '30 seconds')`)
    // Com uma linha `falhou`, a série `job.falhos` existe e entra na conta das métricas sem escola.
    await falhou(ESCOLA_A, 'titular.eliminar')
    await job(ESCOLA_A, 'interativa', { haSegundos: 3 })
    await medir()

    const series = await medidor.atributosDeTodas()
    const deJob = series.filter(({ nome }) => METRICAS_COM_ESCOLA.includes(nome))
    expect(new Set(deJob.map(({ nome }) => nome))).toEqual(new Set([METRICAS.esperaMaisAntiga, METRICAS.pendentes, METRICAS.vagasEmUso]))
    expect(deJob.filter(({ nome }) => nome === METRICAS.pendentes).map(({ atributos }) => `${String(atributos['fila'])}:${String(atributos['escola_id'])}`).sort()).toEqual([
      `interativa:${ESCOLA_A}`,
      'normal:sistema',
    ])
    for (const { atributos } of deJob) expect(Object.keys(atributos).sort()).toEqual(['escola_id', 'fila'])
    const doProcesso = series.filter(({ nome }) => !METRICAS_COM_ESCOLA.includes(nome))
    expect(new Set(doProcesso.map(({ nome }) => nome))).toEqual(new Set([METRICAS.falhos, METRICAS.poolEmUso, METRICAS.redisDisponivel]))
    for (const { atributos } of doProcesso) expect(Object.keys(atributos)).not.toContain('escola_id')
  })

  it('carga: com 5.000 lotes da A à espera, a medição não varre a tabela, e a contagem para no teto', async () => {
    await bancada.semear(
      `insert into job_registro (escola_id, fila, prioridade, tipo, criado_em)
       select $1, 'lote', 3, 'sintetico', now() - make_interval(secs => g) from generate_series(1, 5000) as g`,
      [ESCOLA_A],
    )
    // Mais duas escolas reais: a medição precisa de várias escolas na tabela, e a FK de `escola_id` não aceita id solto.
    const outras = await Promise.all([bancada.escola(), bancada.escola()])
    for (const escolaId of [ESCOLA_B, ...outras]) await job(escolaId, 'interativa', { haSegundos: 3 })
    // Uma semana de histórico, como a retenção de 7 dias deixa: é ele que torna a varredura cara.
    await bancada.semear(
      `insert into job_registro (escola_id, fila, prioridade, tipo, estado, concluido_em)
       select $1, 'lote', 3, 'sintetico', 'concluido', now() from generate_series(1, 100000)`,
      [ESCOLA_A],
    )
    await bancada.semear('analyze job_registro')

    // O banco do teste registra a instrução que o repository manda, para o EXPLAIN ser da consulta de verdade.
    const pool = criarPool(configuracaoDoBanco(), () => undefined)
    const enviadas: Array<{ text: string; values: unknown[] }> = []
    const consultar = pool.query.bind(pool) as (...argumentos: unknown[]) => Promise<unknown>
    pool.query = ((...argumentos: unknown[]) => {
      const [instrucao, valores] = argumentos as [string | { text: string; values?: unknown[] }, unknown[] | undefined]
      enviadas.push(typeof instrucao === 'string' ? { text: instrucao, values: valores ?? [] } : { text: instrucao.text, values: instrucao.values ?? valores ?? [] })
      return consultar(...argumentos)
    }) as typeof pool.query
    try {
      const medicoes: MedicaoDePendentes[] = await new DespachoRepository(criarBanco(pool)).medirPendentes()
      expect(medicoes.find((medicao) => medicao.escolaId === ESCOLA_A)?.pendentes).toBe(5_000)
      expect(medicoes).toHaveLength(4)
      const [consulta] = enviadas
      if (consulta === undefined) throw new Error('o repository não consultou o banco')

      const { rows } = await bancada.pool.query<{ 'QUERY PLAN': Array<{ Plan: NoDoPlano }> }>(`explain (analyze, format json) ${consulta.text}`, consulta.values)
      const nos = nosDoPlano(rows[0]?.['QUERY PLAN'][0]?.Plan)
      expect(nos.filter((no) => no['Node Type'] === 'Seq Scan' && no['Relation Name'] === 'job_registro')).toEqual([])
      expect(nos.map((no) => no['Index Name'])).toContain('job_registro_pendentes_urgentes_idx')
    } finally {
      await pool.end()
    }

    // Acima do teto, a contagem para: o custo da medição não cresce com a fila.
    await bancada.semear(
      `insert into job_registro (escola_id, fila, prioridade, tipo) select $1, 'lote', 3, 'sintetico' from generate_series(1, $2::int)`,
      [ESCOLA_A, TETO_DA_CONTAGEM_DE_PENDENTES],
    )
    const [daEscolaA] = (await bancada.despacho.medirPendentes()).filter((medicao) => medicao.escolaId === ESCOLA_A)
    expect(daEscolaA?.pendentes).toBe(TETO_DA_CONTAGEM_DE_PENDENTES)
  }, 60_000)

  /** Uma linha `falhou` de cada tipo e escola, concluída há tantos dias. */
  async function falhou(escolaId: string, tipo: string, haDias = 0, quantas = 1): Promise<void> {
    await bancada.semear(
      `insert into job_registro (escola_id, fila, prioridade, tipo, estado, criado_em, iniciado_em, concluido_em, codigo_falha, dados)
       select $1, 'normal', 2, $2, 'falhou', now() - make_interval(days => $3::int) - interval '1 hour', now() - make_interval(days => $3::int) - interval '1 hour',
              now() - make_interval(days => $3::int), 'FALHA_SINTETICA', '{"pedidoId": "0190f5a0-0000-7000-8000-0000000000aa"}'::jsonb
       from generate_series(1, $4::int)`,
      [escolaId, tipo, haDias, quantas],
    )
  }

  /** A medição não promete ordem: a série de cada tipo é independente. */
  const ordenados = (medicoes: MedicaoDeFalhos[]) => [...medicoes].sort((a, b) => a.tipo.localeCompare(b.tipo))

  const porTipo = async (medidorDaVez: MedidorDeTeste = medidor) =>
    Object.fromEntries((await medidorDaVez.pontos(METRICAS.falhos)).map(({ atributos, valor }) => [String(atributos['tipo']), valor]))

  it('falhos: cinco falhas de um tipo, de duas escolas, sobem a série `job.falhos{tipo}`, que leva só o tipo: nem escola, nem dados, nem código', async () => {
    await falhou(ESCOLA_A, 'titular.montar-arquivo', 0, 3)
    await falhou(ESCOLA_B, 'titular.montar-arquivo', 1, 2)
    await falhou(ESCOLA_A, 'sintetico', 0, 1)
    // O que terminou bem, e o que ainda espera, não são falha, nem quando o tipo é o mesmo da falha ('sintetico') nem quando
    // é de outro tipo, que fica antes ('a.') ou entre os tipos com falha ('sz.') na ordem do índice.
    await job(ESCOLA_A, 'normal', { haSegundos: 900, estado: 'concluido' })
    await job(ESCOLA_A, 'normal', { haSegundos: 30 })
    for (const tipo of ['a.concluido', 'sz.concluido']) {
      await bancada.semear(
        `insert into job_registro (escola_id, fila, prioridade, tipo, estado, concluido_em) values ($1, 'normal', 2, $2, 'concluido', now())`,
        [ESCOLA_A, tipo],
      )
    }

    await medir()

    expect(await porTipo()).toEqual({ 'titular.montar-arquivo': 5, sintetico: 1 })
    const dosFalhos = (await medidor.atributosDeTodas()).filter(({ nome }) => nome === METRICAS.falhos)
    expect(dosFalhos).toHaveLength(2)
    for (const { atributos } of dosFalhos) expect(Object.keys(atributos)).toEqual(['tipo'])
    expect(METRICAS_COM_ESCOLA).not.toContain(METRICAS.falhos)
  })

  it('falhos: a série some com a linha que o expurgo apagou, e a de `titular.*` fica', async () => {
    await falhou(ESCOLA_A, 'sintetico', 31, 2)
    await falhou(ESCOLA_A, 'ia.geracao.concluida', 29)
    await falhou(ESCOLA_B, 'titular.eliminar', 31)
    const { medicao } = bancada.despachante(new LogEmMemoria('despachante'), { medidor: medidor.medidor, relogio: { agora: () => TERCA_10H } })
    if (medicao === undefined) throw new Error('o despachante com medidor não montou a medição')

    await medicao.medir()
    expect(await porTipo()).toEqual({ sintetico: 2, 'ia.geracao.concluida': 1, 'titular.eliminar': 1 })

    expect(await new ExpurgoDeJobsRepository(bancada.banco).apagarLoteVencido()).toBe(2)
    await medicao.medir()
    expect(await porTipo()).toEqual({ 'ia.geracao.concluida': 1, 'titular.eliminar': 1 })
  })

  it('falhos: sem nenhuma linha `falhou`, nenhuma série', async () => {
    await job(ESCOLA_A, 'interativa', { haSegundos: 5 })
    await medir()
    expect(await porTipo()).toEqual({})
  })

  it('carga: com 5.000 falhos de um tipo e 100.000 concluídos, a medição desce pelo índice parcial e não varre a tabela, e a contagem de cada tipo para no teto', async () => {
    await falhou(ESCOLA_A, 'sintetico', 0, 5_000)
    await falhou(ESCOLA_B, 'titular.eliminar', 0, 3)
    await bancada.semear(
      `insert into job_registro (escola_id, fila, prioridade, tipo, estado, concluido_em)
       select $1, 'lote', 3, 'sintetico', 'concluido', now() from generate_series(1, 100000)`,
      [ESCOLA_A],
    )
    await bancada.semear('analyze job_registro')

    // O banco do teste registra a instrução que o repository manda, para o EXPLAIN ser da consulta de verdade.
    const pool = criarPool(configuracaoDoBanco(), () => undefined)
    const enviadas: Array<{ text: string; values: unknown[] }> = []
    const consultar = pool.query.bind(pool) as (...argumentos: unknown[]) => Promise<unknown>
    pool.query = ((...argumentos: unknown[]) => {
      const [instrucao, valores] = argumentos as [string | { text: string; values?: unknown[] }, unknown[] | undefined]
      enviadas.push(typeof instrucao === 'string' ? { text: instrucao, values: valores ?? [] } : { text: instrucao.text, values: instrucao.values ?? valores ?? [] })
      return consultar(...argumentos)
    }) as typeof pool.query
    try {
      expect(ordenados(await new DespachoRepository(criarBanco(pool)).medirFalhos())).toEqual([
        { tipo: 'sintetico', falhos: 5_000 },
        { tipo: 'titular.eliminar', falhos: 3 },
      ])
      const [consulta] = enviadas
      if (consulta === undefined) throw new Error('o repository não consultou o banco')
      const { rows } = await bancada.pool.query<{ 'QUERY PLAN': Array<{ Plan: NoDoPlano }> }>(`explain (analyze, format json) ${consulta.text}`, consulta.values)
      const nos = nosDoPlano(rows[0]?.['QUERY PLAN'][0]?.Plan)
      expect(nos.filter((no) => no['Node Type'] === 'Seq Scan' && no['Relation Name'] === 'job_registro')).toEqual([])
      expect(nos.map((no) => no['Index Name'])).toContain('job_registro_falhos_idx')
      expect(nos.map((no) => no['Index Name'])).not.toContain('job_registro_finalizados_idx')
    } finally {
      await pool.end()
    }

    // Acima do teto, a contagem para: o custo da medição não cresce com a lista de falhas que ninguém tratou.
    await falhou(ESCOLA_A, 'sintetico', 0, TETO_DA_CONTAGEM_DE_FALHOS)
    expect(ordenados(await bancada.despacho.medirFalhos())).toEqual([
      { tipo: 'sintetico', falhos: TETO_DA_CONTAGEM_DE_FALHOS },
      { tipo: 'titular.eliminar', falhos: 3 },
    ])
  }, 60_000)
})
