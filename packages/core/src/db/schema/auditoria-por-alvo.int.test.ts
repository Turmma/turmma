import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../../tools/testes/integracao.setup.ts'
import { ACOES_DA_LISTA_POR_ALVO, ACOES_DO_ARQUIVO_POR_ALVO, ACOES_DO_USUARIO_POR_ALVO } from '../../auditoria/acoes-por-alvo.js'
import { createLogger } from '../../log/logger.js'
import { migrate, PASTA_MIGRACOES } from '../migrate.js'

/**
 * O índice parcial da leitura "por alvo" do arquivo do titular (migration 0046, acesso-e-convites, tarefa 11.0; D85; regra 80, item 8). O teste
 * migra um banco só dele, com as migrations da pasta, como o `convite-envio.int.test.ts`: o que se prova é o texto da
 * `0046_auditoria_por_alvo.sql`, e o banco do ambiente já a aplicou antes de qualquer teste rodar.
 */
describe('acesso-e-convites: o índice da auditoria por alvo', () => {
  const nomeDoBanco = `auditoria_por_alvo_${Date.now()}`
  const urlDoAmbiente = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoAmbiente)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoAmbiente.toString() })
  const cliente = new pg.Client({ connectionString: urlDoScratch.toString() })

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 60_000, pasta: PASTA_MIGRACOES }, createLogger({ servico: 'migrar-auditoria-por-alvo-teste', nivel: 'silent' }))
    await cliente.connect()
  })

  afterAll(async () => {
    await cliente.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
  })

  /**
   * Os índices que o plano usa, da consulta com a escola e o alvo, sobre a tabela **vazia** e com a varredura sequencial e a de bitmap desligadas. Isto prova só que o
   * índice **pode** servir à consulta (o `where` do índice é implicado pela lista de ações da leitura), e não que o planejador o escolheria com volume: essa prova é o caso
   * "D85: o índice parcial por alvo…" de `apps/api/test/arquivo-do-titular.int.test.ts`, que roda as leituras reais sobre 31 alunos e 3.720 linhas de auditoria.
   */
  async function indicesDoPlano(acoes: readonly string[]): Promise<string[]> {
    await cliente.query('begin')
    try {
      await cliente.query('set local enable_seqscan = off')
      await cliente.query('set local enable_bitmapscan = off')
      const lista = acoes.map((acao) => `'${acao}'`).join(', ')
      const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>(
        `explain (format json) select id from auditoria t where t.escola_id = gen_random_uuid() and t.entidade_id = gen_random_uuid() and t.acao in (${lista})`,
      )
      const nos: Array<Record<string, unknown>> = []
      const andar = (no: Record<string, unknown> | undefined): void => {
        if (no === undefined) return
        nos.push(no)
        for (const filho of (no['Plans'] as Array<Record<string, unknown>> | undefined) ?? []) andar(filho)
      }
      andar(rows[0]?.['QUERY PLAN'][0]?.Plan)
      return nos.map((no) => no['Index Name']).filter((nome): nome is string => typeof nome === 'string')
    } finally {
      await cliente.query('rollback')
    }
  }

  it('o índice começa pela escola, segue pelo alvo e pela data, e é parcial nas seis ações da lista fechada', async () => {
    const { rows } = await cliente.query<{ definicao: string }>(`select pg_get_indexdef(indexrelid) as definicao from pg_index where indexrelid = 'auditoria_por_alvo_idx'::regclass`)
    const definicao = rows[0]?.definicao ?? ''
    expect(definicao).toMatch(/\(escola_id, entidade_id, em\)/)
    for (const acao of ACOES_DO_ARQUIVO_POR_ALVO) expect(definicao, acao).toContain(`'${acao}'`)
  })

  it('a leitura do titular (as quatro ações do usuário) e a da lista (as duas da linha da lista) descem pelo índice', async () => {
    expect(await indicesDoPlano(ACOES_DO_USUARIO_POR_ALVO)).toContain('auditoria_por_alvo_idx')
    expect(await indicesDoPlano(ACOES_DA_LISTA_POR_ALVO)).toContain('auditoria_por_alvo_idx')
  })
})
