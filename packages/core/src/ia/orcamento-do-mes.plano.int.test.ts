import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { runInContext } from '../context/context.js'
import { createDatabase } from '../db/database.js'
import { migrate, PASTA_MIGRACOES } from '../db/migrate.js'
import { createPool, type DatabasePool } from '../db/pool.js'
import { createLogger } from '../log/logger.js'
import { OrcamentoDoMesRepository } from './orcamento-do-mes.repository.js'

/**
 * O plano da soma do mês do orçamento de IA (camada-ia, tarefa 2.0; Tech Spec, seção 7c, "Laços e índices"; regra 80, item 8), num banco só dele: migrado até a `0067`, com um ano da maior escola (~1,8 milhão de linhas de
 * `consumo_ia`) e as de outras duas, e com `vacuum analyze`, como o autovacuum o deixaria. Fica fora de `orcamento-do-mes.repository.int.test.ts` porque a carga leva perto de um minuto e meio, e a mutação de cada caso daquele
 * arquivo não deve pagá-la.
 */
describe('OrcamentoDoMesRepository: o plano da soma do mês num ano da maior escola', () => {
  const nomeDoBanco = `orcamento_plano_${String(Date.now())}`
  const urlDoTeste = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoTeste)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoTeste.toString() })
  let pool: DatabasePool
  let escolaGrande = ''

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 240_000, pasta: PASTA_MIGRACOES }, createLogger({ servico: 'orcamento-plano-teste', nivel: 'silent' }))
    pool = createPool({ url: urlDoScratch.toString(), maximoConexoes: 2, timeoutConexaoMs: 5_000, timeoutConsultaMs: 240_000 }, () => undefined)
    const { rows: [rede] } = await pool.query<{ id: string }>("insert into rede (nome, tipo) values ('Rede do plano', 'independente') returning id")
    const escolas: string[] = []
    for (const nome of ['grande', 'media', 'pequena']) {
      const { rows } = await pool.query<{ id: string }>('insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id', [rede?.id, `Escola ${nome}`, `plano-${nome}`])
      escolas.push(rows[0]?.id ?? '')
    }
    escolaGrande = escolas[0] ?? ''
    // Um ano da maior escola (~1,8 milhão de chamadas, uma a cada 17 s) e um pouco das outras: o índice tem de achar o mês dela entre as linhas de todas.
    const inserir = (escolaId: string, linhas: number, passoEmSegundos: number): Promise<unknown> =>
      pool.query(
        `insert into consumo_ia (escola_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, custo_micros, em)
         select $1, 'gerar_atividade_objetiva', (array['conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao'])[1 + g % 3], 'padrao', 'openai_compat', 'modelo-de-teste', '2026-11-21.1', 100, 50, 10, false, 1, 'concluida', 1500,
                timestamptz '2026-01-01 00:00:00-03' + g * make_interval(secs => $3::int)
         from generate_series(1, $2::int) as g`,
        [escolaId, linhas, passoEmSegundos],
      )
    await inserir(escolaGrande, 1_800_000, 17)
    await inserir(escolas[1] ?? '', 150_000, 200)
    await inserir(escolas[2] ?? '', 20_000, 1_500)
    // Estatística e mapa de visibilidade como o autovacuum os deixaria: sem isso o plano de um banco recém-carregado não vale nada.
    await pool.query('vacuum (analyze) consumo_ia')
  }, 600_000)

  afterAll(async () => {
    await pool.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
  })

  it('a soma do mês lê só o `consumo_ia_mes_idx`, sem a tabela e sem varrer a tabela inteira; o índice leva o `include` da migration', async () => {
    const { rows: indice } = await pool.query<{ definicao: string }>("select indexdef as definicao from pg_indexes where indexname = 'consumo_ia_mes_idx'")
    expect(indice[0]?.definicao).toMatch(/\(escola_id, em\) INCLUDE \(custo_micros, tokens_de_entrada, tokens_de_saida, funcao, pelo_provedor_de_reserva, execucao_id\)/u)
    const { sql: texto, params } = runInContext({ requisicaoId: randomUUID(), escolaId: escolaGrande }, () => new OrcamentoDoMesRepository(createDatabase(pool)).consultaDoCustoDoMes('2026-06').toSQL())
    const { rows } = await pool.query<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>(`explain (analyze, buffers, format json) ${texto}`, params as unknown[])
    const nos: Array<Record<string, unknown>> = []
    const andar = (no: Record<string, unknown> | undefined): void => {
      if (no === undefined) return
      nos.push(no)
      for (const filho of (no['Plans'] as Array<Record<string, unknown>> | undefined) ?? []) andar(filho)
    }
    andar(rows[0]?.['QUERY PLAN'][0]?.Plan)
    const resumo = nos.map((no) => `${String(no['Node Type'])} ${String(no['Relation Name'] ?? '-')} ${String(no['Index Name'] ?? '-')} fetches=${String(no['Heap Fetches'] ?? '-')} ${String(no['Index Cond'] ?? '')}`).join(' > ')
    const doIndice = nos.find((no) => no['Index Name'] === 'consumo_ia_mes_idx')
    expect(doIndice, resumo).toBeDefined()
    expect(doIndice?.['Node Type'], resumo).toBe('Index Only Scan')
    // O índice entra pela escola e pela faixa do mês, e não só pela escola; a tabela não é lida (o mapa de visibilidade a dispensa).
    expect(String(doIndice?.['Index Cond']), resumo).toMatch(/escola_id.*em.*em/u)
    expect(doIndice?.['Heap Fetches'], resumo).toBe(0)
    expect(nos.filter((no) => no['Node Type'] === 'Seq Scan' && no['Relation Name'] === 'consumo_ia'), resumo).toEqual([])
  })
})
