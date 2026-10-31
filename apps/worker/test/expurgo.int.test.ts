import 'reflect-metadata'
import { runInContext, ExpurgoDeJobsRepository, expurgoExpiredBatchStatement, LOTE_DO_EXPURGO } from '@educa/core'
import { PgDialect } from 'drizzle-orm/pg-core'
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { criarExpurgoDeJobs } from '../src/processors/expurgar-jobs.js'
import { QueueFixtures, InMemoryLog } from './queue.fixture.js'
import { jobExecution } from './job-execution.fixture.js'

// `job_registro` do Postgres do compose de teste, com 12.000 jobs vencidos de verdade.

const VENCIDOS = 12_000

interface NoDoPlano {
  'Index Name'?: string
  'Node Type'?: string
  Plans?: NoDoPlano[]
}

function nosDoPlano(no: NoDoPlano | undefined): NoDoPlano[] {
  return no === undefined ? [] : [no, ...(no.Plans ?? []).flatMap(nosDoPlano)]
}

beforeAll(() => {
  // Worker do compose de pé poderia rodar um expurgo agendado no meio da contagem.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('sistema.expurgar-jobs', () => {
  let bancada: QueueFixtures
  // Escolas reais, criadas a cada caso: desde a tarefa 3.0 `job_registro` e
  // `configuracao_operacional_escola` têm FK para `escola`, e id inventado é recusado pelo banco.
  let ESCOLA_A: string
  let ESCOLA_B: string
  const log = new InMemoryLog('worker-teste')
  let protegidos: Record<string, string>

  /** Roda como o worker roda um job `sistema.*`: no contexto da rotina do sistema. */
  const expurgar = (lotes: number[] = []) => {
    const repositorio = new ExpurgoDeJobsRepository(bancada.banco)
    const processador = criarExpurgoDeJobs({
      repositorio: {
        apagarLoteVencido: async (limite) => {
          const apagadas = await repositorio.apagarLoteVencido(limite)
          lotes.push(apagadas)
          return apagadas
        },
      },
      logger: log.logger,
    })
    const jobId = randomUUID()
    return runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => processador({}, jobExecution(jobId)))
  }

  const contar = async (condicao: string): Promise<number> =>
    Number((await bancada.pool.query<{ total: string }>(`select count(*) as total from job_registro where ${condicao}`)).rows[0]?.total)

  /** O que o prazo já devia ter levado: o concluído há mais de 7 dias e o falho há mais de 30 (o de `titular.*` não vence). */
  const vencidosRestantes = () =>
    contar(
      `(estado = 'concluido' and concluido_em < now() - interval '7 days')
       or (estado = 'falhou' and tipo not like 'titular.%' and concluido_em < now() - interval '30 days')`,
    )

  /** Os que o expurgo nunca pode tocar, pelo id. */
  const protegidosRestantes = async () =>
    (await bancada.pool.query<{ id: string }>('select id from job_registro where id = any($1::uuid[])', [Object.values(protegidos)])).rows.length

  beforeEach(async () => {
    bancada = new QueueFixtures()
    await bancada.limparRegistro()
    ;[ESCOLA_A, ESCOLA_B] = await Promise.all([bancada.escola(), bancada.escola()])
    log.linhas.length = 0
    // Vencidos das duas escolas: o concluído, de 8 a 29 dias atrás, e o falho, de 31 a 52 (o prazo dele é de 30).
    await bancada.pool.query(
      `insert into job_registro (escola_id, fila, prioridade, tipo, estado, criado_em, iniciado_em, concluido_em, codigo_falha)
       select case when n % 2 = 0 then $1::uuid else $2::uuid end, 'lote', 3, 'sintetico',
              case when n % 3 = 0 then 'falhou' else 'concluido' end,
              now() - interval '60 days', now() - interval '60 days',
              now() - case when n % 3 = 0 then interval '31 days' else interval '8 days' end - (n % 22) * interval '1 day',
              case when n % 3 = 0 then 'FALHA_SINTETICA' else null end
       from generate_series(1, $3::int) as n`,
      [ESCOLA_A, ESCOLA_B, VENCIDOS - 3],
    )
    const inserir = async (estado: string, criadoHa: string, concluidoHa: string | null, tipo = 'sintetico'): Promise<string> => {
      const { rows } = await bancada.pool.query<{ id: string }>(
        `insert into job_registro (escola_id, fila, prioridade, tipo, estado, criado_em, iniciado_em, concluido_em)
         values ($1, 'lote', 3, $5, $2, now() - $3::interval, now() - $3::interval, now() - $4::interval) returning id`,
        [ESCOLA_A, estado, criadoHa, concluidoHa, tipo],
      )
      return rows[0]?.id ?? ''
    }
    // O outro lado da borda: o concluído há pouco mais de 7 dias e o falho há pouco mais de 30 também saem (retenção de 8 e de 31 dias reprovaria).
    await inserir('concluido', '8 days', '7 days 1 hour')
    await inserir('falhou', '32 days', '30 days 1 hour')
    // O concluído de `titular.*` não tem exceção: sai em 7 dias como os outros.
    await inserir('concluido', '9 days', '8 days', 'titular.montar-arquivo')
    protegidos = {
      // Ativo há 30 dias (preso, ou um lote enorme): nunca é histórico.
      ativoAntigo: await inserir('ativo', '30 days', null),
      // Estado que a troca condicional não produz, mas o expurgo decide pelo estado, e não só pela data.
      ativoComDataDeFim: await inserir('ativo', '30 days', '20 days'),
      aguardandoAntigo: await inserir('aguardando', '30 days', null),
      publicadoAntigo: await inserir('publicado', '30 days', null),
      reservadoAntigo: await inserir('reservado', '30 days', null),
      concluidoRecente: await inserir('concluido', '6 days', '6 days'),
      // O falho tem 30 dias, e não 7: o de 8 e o de 29 ficam, e o de 29 dias e 23 horas é o último a ficar.
      falhouDeOitoDias: await inserir('falhou', '9 days', '8 days'),
      falhouDe29Dias: await inserir('falhou', '31 days', '29 days'),
      falhouQuaseVencido: await inserir('falhou', '31 days', '29 days 23 hours'),
      // O pedido do titular é enfileirado uma vez só: a linha `falhou` fica até o operador agir, por mais velha que seja.
      titularMontarArquivo: await inserir('falhou', '40 days', '31 days', 'titular.montar-arquivo'),
      titularEliminar: await inserir('falhou', '90 days', '60 days', 'titular.eliminar'),
    }
  }, 60_000)

  afterEach(async () => {
    await bancada.limparRegistro()
    await bancada.fechar()
  }, 60_000)

  it('12.000 vencidos saem em lotes de 5.000, e nenhum job ativo, pendente ou recente é tocado', async () => {
    const lotes: number[] = []
    await expurgar(lotes)
    expect(lotes).toEqual([LOTE_DO_EXPURGO, LOTE_DO_EXPURGO, VENCIDOS - 2 * LOTE_DO_EXPURGO])
    expect(await vencidosRestantes()).toBe(0)
    expect(await protegidosRestantes()).toBe(Object.keys(protegidos).length)
    expect(await contar('true')).toBe(Object.keys(protegidos).length)
    expect(log.doEvento('job_registro.expurgado')).toMatchObject([{ total: VENCIDOS, lotesTotal: 3 }])
  })

  /** Roda o expurgo sobre só estas linhas e devolve os ids que sobraram. */
  async function sobramDe(linhas: Array<{ chave: string; estado: 'concluido' | 'falhou'; tipo?: string; ha: string }>): Promise<string[]> {
    await bancada.pool.query('delete from job_registro')
    const ids = new Map<string, string>()
    for (const { chave, estado, tipo = 'sintetico', ha } of linhas) {
      const { rows } = await bancada.pool.query<{ id: string }>(
        `insert into job_registro (escola_id, fila, prioridade, tipo, estado, criado_em, iniciado_em, concluido_em, codigo_falha)
         values ($1, 'lote', 3, $2, $3, now() - $4::interval - interval '1 day', now() - $4::interval - interval '1 day', now() - $4::interval, $5) returning id`,
        [ESCOLA_A, tipo, estado, ha, estado === 'falhou' ? 'FALHA_SINTETICA' : null],
      )
      ids.set(rows[0]?.id ?? '', chave)
    }
    await expurgar()
    const { rows } = await bancada.pool.query<{ id: string }>('select id from job_registro')
    return rows.map(({ id }) => ids.get(id) ?? id).sort()
  }

  it('o concluído sai com 8 dias, e o falho fica até os 30: com 29 dias fica, com 31 sai', async () => {
    expect(
      await sobramDe([
        { chave: 'concluido-8', estado: 'concluido', ha: '8 days' },
        { chave: 'concluido-6', estado: 'concluido', ha: '6 days' },
        { chave: 'falhou-8', estado: 'falhou', ha: '8 days' },
        { chave: 'falhou-29', estado: 'falhou', ha: '29 days' },
        { chave: 'falhou-31', estado: 'falhou', ha: '31 days' },
      ]),
    ).toEqual(['concluido-6', 'falhou-29', 'falhou-8'])
  })

  it('o falho de `titular.*` fica depois dos 30 dias, nos dois tipos; o concluído de `titular.*` sai em 8 dias; o falho de outro tipo sai', async () => {
    expect(
      await sobramDe([
        { chave: 'titular-montar-31', estado: 'falhou', tipo: 'titular.montar-arquivo', ha: '31 days' },
        { chave: 'titular-eliminar-31', estado: 'falhou', tipo: 'titular.eliminar', ha: '31 days' },
        { chave: 'titular-eliminar-400', estado: 'falhou', tipo: 'titular.eliminar', ha: '400 days' },
        { chave: 'titular-concluido-8', estado: 'concluido', tipo: 'titular.montar-arquivo', ha: '8 days' },
        { chave: 'ia-31', estado: 'falhou', tipo: 'ia.geracao.concluida', ha: '31 days' },
      ]),
    ).toEqual(['titular-eliminar-31', 'titular-eliminar-400', 'titular-montar-31'])
  })

  it('cada instrução apaga no máximo um lote, e rodar de novo depois do fim não apaga nada', async () => {
    const repositorio = new ExpurgoDeJobsRepository(bancada.banco)
    expect(await repositorio.apagarLoteVencido()).toBe(LOTE_DO_EXPURGO)
    expect(await vencidosRestantes()).toBe(VENCIDOS - LOTE_DO_EXPURGO)
    await expurgar()
    const lotes: number[] = []
    await expurgar(lotes)
    expect(lotes).toEqual([0])
    expect(await protegidosRestantes()).toBe(Object.keys(protegidos).length)
  })

  it('estatística velha (a tabela era vazia no último analyze): o lote continua sendo de 5.000, dentro do prazo da consulta', async () => {
    // Como logo depois de uma carga grande, antes de o autovacuum analisar: o planejador acha que a tabela está vazia.
    await bancada.pool.query('delete from job_registro')
    await bancada.pool.query('analyze job_registro')
    await bancada.pool.query(
      `insert into job_registro (escola_id, fila, prioridade, tipo, estado, criado_em, iniciado_em, concluido_em)
       select $1, 'lote', 3, 'sintetico', 'concluido', now() - interval '31 days', now() - interval '31 days', now() - interval '8 days' - (n % 22) * interval '1 day'
       from generate_series(1, $2::int) as n`,
      [ESCOLA_A, VENCIDOS],
    )
    // O pool do teste tem o statement_timeout de 2 s do worker: a subconsulta repetida por linha passaria dele.
    expect(await new ExpurgoDeJobsRepository(bancada.banco).apagarLoteVencido()).toBe(LOTE_DO_EXPURGO)
    expect(await contar('true')).toBe(VENCIDOS - LOTE_DO_EXPURGO)
  })

  it('o lote desce pelo índice parcial de finalizados, sem varrer a tabela', async () => {
    const { sql: texto, params } = new PgDialect({ casing: 'snake_case' }).sqlToQuery(expurgoExpiredBatchStatement())
    const cliente = await bancada.pool.connect()
    try {
      await cliente.query('begin')
      await cliente.query('analyze job_registro')
      // Com a varredura sequencial proibida, o plano só usa o índice se o predicado dele casar com o da instrução.
      await cliente.query('set local enable_seqscan = off')
      const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: NoDoPlano }> }>(`explain (format json) ${texto}`, params)
      const nos = nosDoPlano(rows[0]?.['QUERY PLAN'][0]?.Plan)
      expect(nos.map((no) => no['Index Name']).filter(Boolean)).toContain('job_registro_finalizados_idx')
      expect(nos.map((no) => no['Node Type'])).not.toContain('Seq Scan')
    } finally {
      await cliente.query('rollback')
      cliente.release()
    }
  })

  it('reexecução (D49): worker morto no meio de um lote e outra execução ao mesmo tempo terminam sem erro e sem apagar nada além do vencido', async () => {
    // A primeira execução apaga um lote e morre antes do commit, com as linhas ainda presas.
    const morto = new pg.Client({ connectionString: urlDoBancoDeTeste() })
    morto.on('error', () => undefined)
    await morto.connect()
    const { sql: texto, params } = new PgDialect({ casing: 'snake_case' }).sqlToQuery(expurgoExpiredBatchStatement())
    const pid = (await morto.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0]?.pid
    await morto.query('begin')
    expect((await morto.query(texto, params)).rowCount).toBe(LOTE_DO_EXPURGO)

    // A reentrega começa enquanto a morta ainda segura o lote: pega as outras linhas, sem esperar.
    const concorrente: number[] = []
    await expurgar(concorrente)
    expect(concorrente).toEqual([LOTE_DO_EXPURGO, VENCIDOS - 2 * LOTE_DO_EXPURGO])
    expect(await vencidosRestantes()).toBe(LOTE_DO_EXPURGO)

    // O worker morre de vez: o Postgres desfaz o lote dele.
    await bancada.pool.query('select pg_terminate_backend($1)', [pid])
    await morto.end().catch(() => undefined)
    await expect.poll(() => contar('true'), { timeout: 5_000 }).toBe(LOTE_DO_EXPURGO + Object.keys(protegidos).length)

    // A retentativa termina o que faltou.
    const retentativa: number[] = []
    await expurgar(retentativa)
    expect(retentativa).toEqual([LOTE_DO_EXPURGO, 0])
    expect(await vencidosRestantes()).toBe(0)
    expect(await protegidosRestantes()).toBe(Object.keys(protegidos).length)
    expect(await contar('true')).toBe(Object.keys(protegidos).length)
  })

  it('só a rotina do sistema expurga: um job de escola com esse tipo falha sem apagar nada', async () => {
    const processador = criarExpurgoDeJobs({ repositorio: new ExpurgoDeJobsRepository(bancada.banco), logger: log.logger })
    const jobId = randomUUID()
    await expect(runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, () => processador({}, jobExecution(jobId)))).rejects.toThrow()
    expect(await vencidosRestantes()).toBe(VENCIDOS)
  })
})
