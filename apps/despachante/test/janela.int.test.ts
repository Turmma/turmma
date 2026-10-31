import 'reflect-metadata'
import { createDatabase, createPool, DispatchRepository, runInContext, QUEUE_PRIORITY } from '@educa/core'
import type { QueueName } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import type { JobProcessor } from '../../worker/src/job-executor.js'
import { QueueFixtures, configuracaoDoBanco, InMemoryLog } from '../../worker/test/queue.fixture.js'

// Despachante de verdade (a mesma montagem do main.ts) contra o Postgres e o Redis de fila do compose
// de teste, com o horário letivo padrão de `.env.example` (São Paulo, segunda a sexta, 07:00 às
// 18:00) e as vagas padrão (lote 2). Só o relógio é falso: é ele que põe a escola numa terça às 10h.

const TERCA_10H = new Date('2026-09-15T10:00:00-03:00')
const TERCA_17H59 = new Date('2026-09-15T17:59:59.999-03:00')
const TERCA_18H = new Date('2026-09-15T18:00:00-03:00')
const SABADO_10H = new Date('2026-09-19T10:00:00-03:00')

interface NoDoPlano {
  'Index Name'?: string
  'Rows Removed by Filter'?: number
  Plans?: NoDoPlano[]
}

function nosDoPlano(no: NoDoPlano | undefined): NoDoPlano[] {
  return no === undefined ? [] : [no, ...(no.Plans ?? []).flatMap(nosDoPlano)]
}

beforeAll(() => {
  // Despachante ou worker do compose de pé disputaria as linhas e as vagas com os deste arquivo.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('lote não urgente segurado no horário letivo da escola', () => {
  let bancada: QueueFixtures
  // Escolas reais, criadas a cada caso: desde a tarefa 3.0 `job_registro` e
  // `configuracao_operacional_escola` têm FK para `escola`, e id inventado é recusado pelo banco.
  let ESCOLA_A: string
  let ESCOLA_B: string
  let agora: Date
  const relogio = { agora: () => agora }
  const soltar: Array<() => void> = []

  beforeEach(async () => {
    bancada = new QueueFixtures()
    await bancada.limparRegistro()
    ;[ESCOLA_A, ESCOLA_B] = await Promise.all([bancada.escola(), bancada.escola()])
    agora = TERCA_10H
  })

  afterEach(async () => {
    for (const resolver of soltar.splice(0)) resolver()
    await bancada.fechar()
  }, 60_000)

  const enfileirar = (escolaId: string, fila: QueueName, naoUrgente: boolean) => bancada.enfileirar(escolaId, { fila, naoUrgente })

  async function linha(id: string): Promise<{ estado: string; reservadoAte: Date | null } | undefined> {
    const { rows } = await bancada.pool.query<{ estado: string; reservadoAte: Date | null }>('select estado, reservado_ate as "reservadoAte" from job_registro where id = $1', [id])
    return rows[0]
  }

  const membrosDaVaga = async (fila: QueueName, escolaId: string) => (await bancada.redis.zrange(bancada.vagas.chave(fila, escolaId), '0', '-1')).sort()

  it('caminho feliz: não urgente criado numa terça às 10h fica aguardando, sem reserva nem vaga, até as 18h, e sai às 18h00', async () => {
    const id = await enfileirar(ESCOLA_A, 'lote', true)
    const { despachante } = bancada.despachante(new InMemoryLog('despachante'), { relogio })

    for (const hora of [TERCA_10H, TERCA_17H59]) {
      agora = hora
      expect(await despachante.rodada(), hora.toISOString()).toBe(0)
      expect(await linha(id)).toEqual({ estado: 'aguardando', reservadoAte: null })
      expect(await membrosDaVaga('lote', ESCOLA_A)).toEqual([])
      expect(await bancada.filas.lote.getJob(id)).toBeUndefined()
    }

    agora = TERCA_18H
    expect(await despachante.rodada()).toBe(1)
    expect((await linha(id))?.estado).toBe('publicado')
    expect(await membrosDaVaga('lote', ESCOLA_A)).toEqual([id])
    expect(await bancada.filas.lote.getJob(id)).toBeDefined()
  })

  it('caminho feliz: não urgente criado num sábado sai na hora', async () => {
    agora = SABADO_10H
    const id = await enfileirar(ESCOLA_A, 'lote', true)
    const { despachante } = bancada.despachante(new InMemoryLog('despachante'), { relogio })
    expect(await despachante.rodada()).toBe(1)
    expect((await linha(id))?.estado).toBe('publicado')
  })

  it('borda: na terça às 10h o urgente sai na hora, e os não urgentes segurados, mais antigos, não tomam a vaga dele', async () => {
    // Cinco não urgentes chegam antes: numa fila por ordem de chegada, levariam as duas vagas de lote da A.
    const naoUrgentes = []
    for (let indice = 0; indice < 5; indice++) naoUrgentes.push(await enfileirar(ESCOLA_A, 'lote', true))
    const urgentes = [await enfileirar(ESCOLA_A, 'lote', false), await enfileirar(ESCOLA_A, 'lote', false)]
    const processador: JobProcessor = () => new Promise<void>((resolver) => soltar.push(resolver))
    bancada.worker(new InMemoryLog('worker-lote'), { pools: { lote: 10 }, processadores: { sintetico: processador } })
    bancada.despachante(new InMemoryLog('despachante'), { relogio }).despachante.iniciar()

    for (const id of urgentes) await expect.poll(async () => (await linha(id))?.estado, { timeout: 5_000, interval: 50 }).toBe('ativo')
    // As duas vagas de lote da A são dos urgentes; nenhum segurado foi reservado nem publicado.
    expect(await membrosDaVaga('lote', ESCOLA_A)).toEqual([...urgentes].sort())
    for (const id of naoUrgentes) expect(await linha(id)).toEqual({ estado: 'aguardando', reservadoAte: null })
    expect(await bancada.filas.lote.getJobCounts('active', 'waiting')).toEqual({ active: 2, waiting: 0 })
  })

  it('borda: às 18h o acúmulo liberado não passa na frente do urgente que chega: ele fica com uma das vagas na primeira rodada', async () => {
    const naoUrgentes = []
    for (let indice = 0; indice < 5; indice++) naoUrgentes.push(await enfileirar(ESCOLA_A, 'lote', true))
    const { despachante } = bancada.despachante(new InMemoryLog('despachante'), { relogio })
    expect(await despachante.rodada()).toBe(0)

    agora = TERCA_18H
    const urgente = await enfileirar(ESCOLA_A, 'lote', false)
    expect(await despachante.rodada()).toBe(2)
    expect((await linha(urgente))?.estado).toBe('publicado')
    const comVaga = await membrosDaVaga('lote', ESCOLA_A)
    expect(comVaga).toContain(urgente)
    // A outra vaga vai para o não urgente mais antigo, que já esperou a aula inteira.
    expect(comVaga).toEqual([urgente, naoUrgentes[0]].sort())
  })

  it('borda: interativa e normal com a marca de não urgente nunca são seguradas', async () => {
    const interativo = await enfileirar(ESCOLA_A, 'interativa', true)
    const normal = await enfileirar(ESCOLA_A, 'normal', true)
    const log = new InMemoryLog('despachante')
    const { despachante } = bancada.despachante(log, { relogio })
    const publicados = await despachante.rodada()
    // Antes do número: o 0 desta rodada já veio do Redis ainda conectando, e não do despacho. A
    // asserção vem primeiro para a recaída cair com nome, e não como `expected +0 to be 2`.
    expect(log.doEvento('despachante.vaga_indisponivel')).toEqual([])
    expect(publicados).toBe(2)
    expect((await linha(interativo))?.estado).toBe('publicado')
    expect((await linha(normal))?.estado).toBe('publicado')
  })

  it('borda: a rodada cujo primeiro comando de vaga falha não publica nada, e a seguinte publica', async () => {
    // Sem fila offline, o comando emitido antes da conexão falha na hora. A rodada termina ali e
    // devolve 0 — em produção o laço tenta de novo, e é por isso que a bancada espera o `pronto`
    // antes da rodada avulsa do teste.
    const id = await enfileirar(ESCOLA_A, 'interativa', false)
    const log = new InMemoryLog('despachante')
    let conectando = true
    const { despachante } = bancada.despachante(log, {
      relogio,
      embrulharVagas: (vagas) => ({
        membros: (fila, escolaId) => {
          if (!conectando) return vagas.membros(fila, escolaId)
          conectando = false
          return Promise.reject(new Error("Stream isn't writeable and enableOfflineQueue options is false"))
        },
        manter: vagas.manter.bind(vagas),
        livres: vagas.livres.bind(vagas),
        tomar: vagas.tomar.bind(vagas),
        liberar: vagas.liberar.bind(vagas),
      }),
    })

    expect(await despachante.rodada()).toBe(0)
    expect((await linha(id))?.estado).toBe('aguardando')
    expect(await membrosDaVaga('interativa', ESCOLA_A)).toEqual([])
    expect(log.doEvento('despachante.vaga_indisponivel')).toHaveLength(1)

    expect(await despachante.rodada()).toBe(1)
    expect((await linha(id))?.estado).toBe('publicado')
  })

  it('borda: a janela é lida da configuração da escola; horário 13:00–22:30 segura às 20h e solta às 10h', async () => {
    await bancada.configurarEscola(ESCOLA_A, { inicio: '13:00', fim: '22:30' })
    const id = await enfileirar(ESCOLA_A, 'lote', true)
    agora = new Date('2026-09-15T20:00:00-03:00')
    const { despachante } = bancada.despachante(new InMemoryLog('despachante'), { relogio })
    expect(await despachante.rodada()).toBe(0)
    agora = TERCA_10H
    expect(await despachante.rodada()).toBe(1)
    expect((await linha(id))?.estado).toBe('publicado')
  })

  it('borda: o fuso vem da linha da escola — Manaus às 17h30 (18h30 em São Paulo) segura a A, e a B, no padrão, sai', async () => {
    await bancada.configurarEscola(ESCOLA_A, { fuso: 'America/Manaus' })
    agora = new Date('2026-09-15T18:30:00-03:00')
    const daEscolaA = await enfileirar(ESCOLA_A, 'lote', true)
    const daEscolaB = await enfileirar(ESCOLA_B, 'lote', true)
    const { despachante } = bancada.despachante(new InMemoryLog('despachante'), { relogio })

    expect(await despachante.rodada()).toBe(1)
    expect(await linha(daEscolaA)).toEqual({ estado: 'aguardando', reservadoAte: null })
    expect((await linha(daEscolaB))?.estado).toBe('publicado')
    agora = new Date('2026-09-15T19:00:00-03:00')
    expect(await despachante.rodada()).toBe(1)
    expect((await linha(daEscolaA))?.estado).toBe('publicado')
  })

  it('borda: fuso que ninguém conhece gravado na escola não derruba a rodada: vale o fuso padrão, com aviso no log', async () => {
    await bancada.configurarEscola(ESCOLA_A, { fuso: 'Brasil/Joinville' })
    const segurado = await enfileirar(ESCOLA_A, 'lote', true)
    const urgente = await enfileirar(ESCOLA_A, 'lote', false)
    const log = new InMemoryLog('despachante')
    const { despachante } = bancada.despachante(log, { relogio })

    expect(await despachante.rodada()).toBe(1)
    expect((await linha(urgente))?.estado).toBe('publicado')
    expect(await linha(segurado)).toEqual({ estado: 'aguardando', reservadoAte: null })
    expect(log.doEvento('despachante.janela_da_escola_invalida')).toHaveLength(1)
    expect(log.doEvento('despachante.rodada_falhou')).toEqual([])
  })

  describe('isolamento', () => {
    it('a janela da escola A (sábado letivo) não segura o job da B no sábado', async () => {
      await bancada.configurarEscola(ESCOLA_A, { diasLetivos: [1, 2, 3, 4, 5, 6] })
      agora = SABADO_10H
      const daEscolaA = await enfileirar(ESCOLA_A, 'lote', true)
      const daEscolaB = await enfileirar(ESCOLA_B, 'lote', true)
      const { despachante } = bancada.despachante(new InMemoryLog('despachante'), { relogio })

      expect(await despachante.rodada()).toBe(1)
      expect(await linha(daEscolaA)).toEqual({ estado: 'aguardando', reservadoAte: null })
      expect((await linha(daEscolaB))?.estado).toBe('publicado')
      expect(await membrosDaVaga('lote', ESCOLA_A)).toEqual([])
    })

    it('o sábado letivo da B também não solta o da A de segunda a sexta: cada escola com a própria linha', async () => {
      await bancada.configurarEscola(ESCOLA_B, { diasLetivos: [6] })
      const daEscolaA = await enfileirar(ESCOLA_A, 'lote', true)
      const daEscolaB = await enfileirar(ESCOLA_B, 'lote', true)
      const { despachante } = bancada.despachante(new InMemoryLog('despachante'), { relogio })

      expect(await despachante.rodada()).toBe(1)
      expect(await linha(daEscolaA)).toEqual({ estado: 'aguardando', reservadoAte: null })
      expect((await linha(daEscolaB))?.estado).toBe('publicado')
    })

    it('a reserva só de urgentes continua no escopo da escola do contexto', async () => {
      const urgenteDaB = await enfileirar(ESCOLA_B, 'lote', false)
      const naEscola = (escolaId: string) => runInContext({ requisicaoId: randomUUID(), escolaId }, () => bancada.despacho.reservarDaEscola('lote', 10, { soUrgentes: true }))
      expect(await naEscola(ESCOLA_A)).toEqual([])
      expect((await linha(urgenteDaB))?.estado).toBe('aguardando')
      expect((await naEscola(ESCOLA_B)).map((job) => job.id)).toEqual([urgenteDaB])
    })
  })

  it('o banco recusa horário letivo com o início depois do fim', async () => {
    await expect(
      bancada.pool.query('insert into configuracao_operacional_escola (escola_id, inicio, fim) values ($1, $2, $3)', [ESCOLA_A, '18:00', '07:00']),
    ).rejects.toThrow('configuracao_operacional_horario_valido')
  })

  it('com 5.000 não urgentes segurados, a reserva dos urgentes desce pelo índice deles, sem atravessar os segurados', async () => {
    await bancada.pool.query(
      `insert into job_registro (escola_id, fila, prioridade, tipo, nao_urgente) select $1, 'lote', $2, 'sintetico', true from generate_series(1, 5000)`,
      [ESCOLA_A, QUEUE_PRIORITY.lote],
    )
    const urgente = await enfileirar(ESCOLA_A, 'lote', false)
    await bancada.pool.query('analyze job_registro')

    // O banco do teste registra a instrução que o repository manda, para o EXPLAIN ser da consulta de verdade.
    const pool = createPool(configuracaoDoBanco(), () => undefined)
    const enviadas: Array<{ text: string; values: unknown[] }> = []
    const consultar = pool.query.bind(pool) as (...argumentos: unknown[]) => Promise<unknown>
    pool.query = ((...argumentos: unknown[]) => {
      const [instrucao, valores] = argumentos as [string | { text: string; values?: unknown[] }, unknown[] | undefined]
      enviadas.push(typeof instrucao === 'string' ? { text: instrucao, values: valores ?? [] } : { text: instrucao.text, values: instrucao.values ?? valores ?? [] })
      return consultar(...argumentos)
    }) as typeof pool.query
    const cliente = await bancada.pool.connect()
    try {
      const repositorio = new DispatchRepository(createDatabase(pool))
      const reservados = await runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, () => repositorio.reservarDaEscola('lote', 2, { soUrgentes: true }))
      expect(reservados.map((job) => job.id)).toEqual([urgente])
      const [consulta] = enviadas
      if (consulta === undefined) throw new Error('o repository não consultou o banco')

      // A reserva já aconteceu; o EXPLAIN ANALYZE da mesma instrução roda numa transação desfeita.
      await bancada.pool.query(`update job_registro set estado = 'aguardando', reservado_ate = null where id = $1`, [urgente])
      await cliente.query('begin')
      const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: NoDoPlano }> }>(`explain (analyze, buffers, format json) ${consulta.text}`, consulta.values)
      await cliente.query('rollback')
      const nos = nosDoPlano(rows[0]?.['QUERY PLAN'][0]?.Plan)
      expect(nos.map((no) => no['Index Name'])).toContain('job_registro_pendentes_urgentes_idx')
      // Pelo índice de pendentes, os 5.000 segurados sairiam no filtro a cada rodada da manhã.
      expect(nos.reduce((soma, no) => soma + (no['Rows Removed by Filter'] ?? 0), 0)).toBeLessThanOrEqual(1)
    } finally {
      cliente.release()
      await pool.end()
    }
  }, 60_000)
})
