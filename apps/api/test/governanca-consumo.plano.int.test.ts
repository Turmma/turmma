import { createDatabase, createLogger, createPool, migrate, PASTA_MIGRACOES, runInContext, type DatabasePool } from '@educa/core'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { GovernancaRepository } from '../src/governanca/governanca.repository.js'

/**
 * O plano do consumo por função da Governança num ano da maior escola (camada-ia, tarefa 6.0; Tech Spec, seção 7c, "Laços e índices"; regra 80, item 8), num banco só dele: migrado até a última migration, com um ano da
 * maior escola (~1,8 milhão de linhas de `consumo_ia`, em três funções) e as de outras duas, e com `vacuum analyze`, como o autovacuum o deixaria. A consulta é a do `GovernancaRepository.consultaDoConsumoPorFuncao`, a mesma que o
 * `consumo()` executa, e lê **só** o `consumo_ia_mes_idx`, sem a tabela. Fica fora de `governanca.int.test.ts` pelo custo da carga (cerca de um minuto e meio), que o resto dos casos daquele arquivo não deve pagar.
 */
describe('o consumo por função da Governança: o plano do mês num ano da maior escola', () => {
  const nomeDoBanco = `governanca_consumo_plano_${String(Date.now())}`
  const urlDoTeste = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoTeste)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoTeste.toString() })
  let pool: DatabasePool
  let escolaGrande = ''

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 240_000, pasta: PASTA_MIGRACOES }, createLogger({ servico: 'governanca-consumo-plano', nivel: 'silent' }))
    pool = createPool({ url: urlDoScratch.toString(), maximoConexoes: 2, timeoutConexaoMs: 5_000, timeoutConsultaMs: 240_000 }, () => undefined)
    const { rows: [rede] } = await pool.query<{ id: string }>("insert into rede (nome, tipo) values ('Rede do plano', 'independente') returning id")
    const escolas: string[] = []
    for (const nome of ['grande', 'media', 'pequena']) {
      const { rows } = await pool.query<{ id: string }>('insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id', [rede?.id, `Escola ${nome}`, `plano-${nome}`])
      escolas.push(rows[0]?.id ?? '')
    }
    escolaGrande = escolas[0] ?? ''
    // Um ano da maior escola (~1,8 milhão de chamadas, uma a cada 17 s, de 1º/01 a meados de dezembro de 2026, em três funções) e um pouco das outras: o índice tem de achar o mês dela entre as linhas de todas.
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

  it('o consumo por função de um mês da maior escola lê só o `consumo_ia_mes_idx`, entrando pela escola e pela faixa, sem a tabela e sem varrê-la', async () => {
    const { sql: texto, params } = runInContext({ requisicaoId: randomUUID(), escolaId: escolaGrande }, () => new GovernancaRepository(createDatabase(pool)).consultaDoConsumoPorFuncao('2026-06-01', '2026-07-01').toSQL())
    const { rows } = await pool.query<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>(`explain (analyze, buffers, format json) ${texto}`, params as unknown[])
    const nos: Array<Record<string, unknown>> = []
    const andar = (no: Record<string, unknown> | undefined): void => {
      if (no === undefined) return
      nos.push(no)
      for (const filho of (no['Plans'] as Array<Record<string, unknown>> | undefined) ?? []) andar(filho)
    }
    andar(rows[0]?.['QUERY PLAN'][0]?.Plan)
    const resumo = nos.map((no) => `${String(no['Node Type'])} ${String(no['Relation Name'] ?? '-')} ${String(no['Index Name'] ?? '-')} fetches=${String(no['Heap Fetches'] ?? '-')} ${String(no['Index Cond'] ?? '')}`).join(' > ')
    const aoConsumo = nos.filter((no) => no['Relation Name'] === 'consumo_ia')
    expect(aoConsumo.length, resumo).toBeGreaterThan(0)
    for (const no of aoConsumo) {
      expect(no['Node Type'], resumo).toBe('Index Only Scan')
      expect(no['Index Name'], resumo).toBe('consumo_ia_mes_idx')
      expect(String(no['Index Cond']), resumo).toMatch(/escola_id.*em.*em/u)
      expect(no['Heap Fetches'], resumo).toBe(0)
    }
    expect(nos.filter((no) => no['Node Type'] === 'Seq Scan' && no['Relation Name'] === 'consumo_ia'), resumo).toEqual([])
    // O mês de junho da escola grande entra, e só ele: ~152 mil linhas de 1,8 milhão.
    const linhasLidas = aoConsumo.reduce((soma, no) => soma + Number(no['Actual Rows']) * Number(no['Actual Loops']), 0)
    expect(linhasLidas, resumo).toBeGreaterThan(100_000)
    expect(linhasLidas, resumo).toBeLessThan(250_000)
  })
})
