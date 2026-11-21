import { createDatabase, createLogger, createPool, migrate, PASTA_MIGRACOES, OrcamentoDoMesRepository, runInContext, type DatabasePool } from '@educa/core'
import { PgDialect } from 'drizzle-orm/pg-core'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { usoDaPaginaSql } from '../src/operacao/painel/painel.repository.js'

/**
 * O plano do uso de IA da Operação num ano da maior escola (camada-ia, tarefa 5.0; Tech Spec, seção 7c, "Laços e índices"; regra 80, item 8), num banco só dele: migrado até a última migration, com um ano da maior escola
 * (~1,8 milhão de linhas de `consumo_ia`) e as de outras duas, e com `vacuum analyze`, como o autovacuum o deixaria. Duas consultas: o `uso()` na ordem por custo (a soma do mês de **todas** as escolas antes de cortar a
 * página, mais o uso de hoje e do mês das 25 da página) e os 12 meses de uma escola. As duas leem só o `consumo_ia_mes_idx`, sem a tabela. Fica fora de `painel-leitura.int.test.ts` pelo custo da carga (cerca de um minuto e
 * meio), que a mutação de cada caso daquele arquivo não deve pagar.
 */
describe('o uso de IA da Operação: o plano da ordem por custo e dos 12 meses num ano da maior escola', () => {
  const nomeDoBanco = `painel_uso_ia_plano_${String(Date.now())}`
  const urlDoTeste = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoTeste)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoTeste.toString() })
  const dialeto = new PgDialect()
  let pool: DatabasePool
  let escolaGrande = ''

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 240_000, pasta: PASTA_MIGRACOES }, createLogger({ servico: 'painel-uso-ia-plano', nivel: 'silent' }))
    pool = createPool({ url: urlDoScratch.toString(), maximoConexoes: 2, timeoutConexaoMs: 5_000, timeoutConsultaMs: 240_000 }, () => undefined)
    const { rows: [rede] } = await pool.query<{ id: string }>("insert into rede (nome, tipo) values ('Rede do plano', 'independente') returning id")
    const escolas: string[] = []
    for (const nome of ['grande', 'media', 'pequena']) {
      const { rows } = await pool.query<{ id: string }>('insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id', [rede?.id, `Escola ${nome}`, `plano-${nome}`])
      escolas.push(rows[0]?.id ?? '')
    }
    escolaGrande = escolas[0] ?? ''
    // Um ano da maior escola (~1,8 milhão de chamadas, uma a cada 17 s, de 1º/01 a meados de dezembro de 2026, com a execução de uma em cada duas) e um pouco das outras: o índice tem de achar o mês dela entre as linhas de todas.
    const inserir = (escolaId: string, linhas: number, passoEmSegundos: number): Promise<unknown> =>
      pool.query(
        `insert into consumo_ia (escola_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, custo_micros, pelo_provedor_de_reserva, em)
         select $1, 'gerar_atividade_objetiva', 'conversa_e_ferramentas', 'padrao', 'openai_compat', 'modelo-de-teste', '2026-11-21.1', 100, 50, 10, false, 1, 'concluida', 1500, g % 50 = 0,
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

  /** Os nós do plano, achatados (inclusive as subconsultas e a CTE), e o resumo deles para a mensagem de erro. */
  async function planoDe(texto: string, params: unknown[], semVarreduraDaTabela = false): Promise<{ nos: Array<Record<string, unknown>>; resumo: string }> {
    const conexao = await pool.connect()
    let rows: Array<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>
    try {
      await conexao.query('begin')
      if (semVarreduraDaTabela) await conexao.query('set local enable_seqscan = off')
      rows = (await conexao.query<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>(`explain (analyze, buffers, format json) ${texto}`, params)).rows
    } finally {
      await conexao.query('rollback')
      conexao.release()
    }
    const nos: Array<Record<string, unknown>> = []
    const andar = (no: Record<string, unknown> | undefined): void => {
      if (no === undefined) return
      nos.push(no)
      for (const filho of (no['Plans'] as Array<Record<string, unknown>> | undefined) ?? []) andar(filho)
    }
    andar(rows[0]?.['QUERY PLAN'][0]?.Plan)
    const resumo = nos.map((no) => `${String(no['Node Type'])} ${String(no['Relation Name'] ?? '-')} ${String(no['Index Name'] ?? '-')} fetches=${String(no['Heap Fetches'] ?? '-')} ${String(no['Index Cond'] ?? '')}`).join(' > ')
    return { nos, resumo }
  }

  /** Todo acesso a `consumo_ia` é `Index Only Scan` no `consumo_ia_mes_idx`, entrando pela escola e pela faixa, sem ler a tabela. */
  function confereOsAcessosAoConsumo({ nos, resumo }: { nos: Array<Record<string, unknown>>; resumo: string }): void {
    const aoConsumo = nos.filter((no) => no['Relation Name'] === 'consumo_ia')
    expect(aoConsumo.length, resumo).toBeGreaterThan(0)
    for (const no of aoConsumo) {
      expect(no['Node Type'], resumo).toBe('Index Only Scan')
      expect(no['Index Name'], resumo).toBe('consumo_ia_mes_idx')
      expect(String(no['Index Cond']), resumo).toMatch(/escola_id.*em/u)
      expect(no['Heap Fetches'], resumo).toBe(0)
    }
    expect(nos.filter((no) => no['Node Type'] === 'Seq Scan' && no['Relation Name'] === 'consumo_ia'), resumo).toEqual([])
  }

  it('`uso()` por custo: a soma do mês de cada escola, a de hoje e a do mês das da página leem só o `consumo_ia_mes_idx`', async () => {
    const agora = new Date('2026-06-15T15:00:00Z')
    const { sql: texto, params } = dialeto.sqlToQuery(usoDaPaginaSql({ pagina: 1, ordem: 'custo', referencia: { dia: '2026-06-14', primeiroDoMes: '2026-06-01' }, agora }))
    confereOsAcessosAoConsumo(await planoDe(texto, params))
  })

  it('os 12 meses da maior escola: uma consulta só, agrupada, que lê o ano inteiro só pelo `consumo_ia_mes_idx`', async () => {
    const agora = new Date('2027-01-15T15:00:00Z')
    const { sql: texto, params } = runInContext({ requisicaoId: randomUUID(), escolaId: escolaGrande }, () => dialeto.sqlToQuery(new OrcamentoDoMesRepository(createDatabase(pool)).consultaDoUsoDosMeses(agora)))
    // Esta escola é 91% das linhas da tabela do teste, e o planejador escolhe a varredura paralela da tabela (cerca de 0,9 s o ano inteiro, abaixo dos 2 s da regra 00, item 4): ler quase tudo não pede índice. O que o
    // teste prova é que o índice **cobre** a consulta, escola e faixa de tempo, sem ler a tabela, quando a varredura dela é proibida; com outras escolas na tabela (a produção), é ele que o planejador escolhe.
    const plano = await planoDe(texto, params, true)
    confereOsAcessosAoConsumo(plano)
    // O ano inteiro da escola grande entra: 12 meses, e é ela quem o índice lê.
    const doIndice = plano.nos.filter((no) => no['Index Name'] === 'consumo_ia_mes_idx')
    expect(doIndice.reduce((soma, no) => soma + Number(no['Actual Rows']) * Number(no['Actual Loops']), 0), plano.resumo).toBeGreaterThan(1_700_000)
  })
})
