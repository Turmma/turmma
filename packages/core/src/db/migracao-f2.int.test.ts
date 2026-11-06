import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chaveDaTurma } from '@educa/shared'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { createLogger } from '../log/logger.js'
import { migrate, PASTA_MIGRACOES, type MigrationConfig } from './migrate.js'

/**
 * A migration `0040_f2_planilhas` (F2, tarefa 2.0) sobre dado que já existia: um banco só para este teste, migrado até a 0039 (o que
 * a A1 deixou), com turmas escritas de vários jeitos, e depois migrado até a 0040 pelo mesmo `migrate` do serviço de migração. Prova
 * as duas promessas da Tech Spec, seção 3: a migration só expande (nada apagado, nenhuma coluna a menos) e a `turma.chave` das
 * turmas que já existem nasce só onde é única no ano.
 */

const PRIMEIRA_DO_F2 = '0040_f2_planilhas'

const logger = createLogger({ servico: 'migrar-f2-teste', nivel: 'silent' })

describe('a migration do F2 sobre dado da A1', () => {
  const nomeDoBanco = `f2_migracao_${Date.now()}`
  const urlDoTeste = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoTeste)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoTeste.toString() })
  const scratch = new pg.Client({ connectionString: urlDoScratch.toString() })
  const pastas: string[] = []

  const configuracao = (pasta: string): MigrationConfig => ({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 60_000, pasta })

  /** A pasta de migrations só até a 0039: copia a do repositório e tira do diário (e da pasta) a do F2 em diante. */
  function pastaAteA0039(): string {
    const pasta = mkdtempSync(join(tmpdir(), 'educa-migrar-f2-'))
    pastas.push(pasta)
    cpSync(PASTA_MIGRACOES, pasta, { recursive: true })
    const diario = JSON.parse(readFileSync(join(pasta, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> }
    const indice = diario.entries.findIndex((entrada) => entrada.tag === PRIMEIRA_DO_F2)
    expect(indice, 'a migration do F2 está no diário').toBeGreaterThan(0)
    const doF2EmDiante = diario.entries.slice(indice)
    writeFileSync(join(pasta, 'meta', '_journal.json'), JSON.stringify({ ...diario, entries: diario.entries.slice(0, indice) }))
    for (const entrada of doF2EmDiante) rmSync(join(pasta, `${entrada.tag}.sql`))
    expect(readdirSync(pasta).filter((arquivo) => arquivo.endsWith('.sql')).at(-1)).toBe('0039_introducao_vista.sql')
    return pasta
  }

  async function id(instrucao: string, valores: unknown[]): Promise<string> {
    const { rows } = await scratch.query<{ id: string }>(instrucao, valores)
    const linha = rows[0]
    if (linha === undefined) throw new Error('insert sem linha')
    return linha.id
  }

  /** As colunas de toda tabela do banco, `tabela.coluna`, e quantas linhas cada tabela tem. */
  async function retrato(): Promise<{ colunas: string[]; linhas: Record<string, number> }> {
    const { rows } = await scratch.query<{ table_name: string; column_name: string }>(
      "select table_name, column_name from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position",
    )
    const tabelas = [...new Set(rows.map((linha) => linha.table_name))]
    const linhas: Record<string, number> = {}
    for (const tabela of tabelas) linhas[tabela] = Number((await scratch.query<{ total: string }>(`select count(*) as total from "${tabela}"`)).rows[0]?.total)
    return { colunas: rows.map((linha) => `${linha.table_name}.${linha.column_name}`), linhas }
  }

  interface Dados {
    escolaA: string
    escolaB: string
    turmas: Record<string, string>
    vinculo: string
  }

  /** Dado como a A1 deixou: duas escolas, dois anos na A, turmas escritas de vários jeitos e um vínculo. */
  async function semearDadoDaA1(): Promise<Dados> {
    const rede = await id("insert into rede (nome, tipo) values ('Rede da migração', 'independente') returning id", [])
    const escolaA = await id("insert into escola (rede_id, nome, slug) values ($1, 'Escola A', 'migracao-a') returning id", [rede])
    const escolaB = await id("insert into escola (rede_id, nome, slug) values ($1, 'Escola B', 'migracao-b') returning id", [rede])
    const anoA = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaA])
    const anoA2027 = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2027, '2027-02-01', '2027-12-15', 'planejado') returning id", [escolaA])
    const anoB = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaB])
    const serieA = await id("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 8) returning id", [escolaA])
    const serieB = await id("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 8) returning id", [escolaB])
    const turma = (escolaId: string, anoId: string, serieId: string, nome: string) =>
      id('insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [escolaId, anoId, serieId, nome])
    const turmas: Record<string, string> = {
      // Cada nome é uma turma só no ano: ganha a chave.
      sozinha: await turma(escolaA, anoA, serieA, '8ºA'),
      porExtenso: await turma(escolaA, anoA, serieA, '9º ano B'),
      comAcentoEMaiuscula: await turma(escolaA, anoA, serieA, '7ºÁ'),
      // A mesma chave, escrita de dois jeitos, no mesmo ano: as duas ficam sem chave.
      repetidaUm: await turma(escolaA, anoA, serieA, '6ºA'),
      repetidaDois: await turma(escolaA, anoA, serieA, '6 a'),
      // Fora do padrão: sem chave.
      foraDoPadrao: await turma(escolaA, anoA, serieA, 'Turma Azul'),
      dezA: await turma(escolaA, anoA, serieA, '10A'),
      // A chave de outro ano e a de outra escola não contam como repetição.
      outroAno: await turma(escolaA, anoA2027, serieA, '8ºA'),
      outraEscola: await turma(escolaB, anoB, serieB, '8A'),
    }
    const pessoa = async (papel: 'coordenador' | 'professor', nome: string) =>
      id('insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, $4) returning id', [
        escolaA,
        await id('insert into conta (email) values ($1) returning id', [`${papel}@migracao.invalid`]),
        papel,
        nome,
      ])
    const coordenador = await pessoa('coordenador', 'Coordenação')
    const professor = await pessoa('professor', 'Professora')
    const vinculo = await id("insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, criado_por) values ($1, $2, $3, $4, 'professor', $5) returning id", [
      escolaA,
      anoA,
      professor,
      turmas['sozinha'],
      coordenador,
    ])
    return { escolaA, escolaB, turmas, vinculo }
  }

  // O dado da A1, o retrato de antes e o de depois da 0040 nascem uma vez, no `beforeAll`: cada caso lê o que precisa e roda sozinho (`-t`).
  let dados: Dados
  let antes: Awaited<ReturnType<typeof retrato>>
  let depois: Awaited<ReturnType<typeof retrato>>

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate(configuracao(pastaAteA0039()), logger)
    await scratch.connect()
    dados = await semearDadoDaA1()
    antes = await retrato()
    await migrate(configuracao(PASTA_MIGRACOES), logger)
    depois = await retrato()
  }, 240_000)

  afterAll(async () => {
    await scratch.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
    for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
  })

  it('só expande: nenhuma linha some, nenhuma coluna some, as tabelas novas nascem vazias; o vínculo antigo nasce `coordenacao`', async () => {
    expect(antes.colunas).not.toContain('turma.chave')
    expect(antes.linhas['turma']).toBe(9)

    for (const coluna of antes.colunas) expect(depois.colunas, coluna).toContain(coluna)
    expect(depois.colunas.filter((coluna) => !antes.colunas.includes(coluna)).sort()).toEqual(
      [
        'alocacao.id',
        'alocacao.escola_id',
        'alocacao.ano_letivo_id',
        'alocacao.vinculo_id',
        'alocacao.dia_semana',
        'alocacao.inicio',
        'alocacao.fim',
        'alocacao.sala',
        'evento_calendario.id',
        'evento_calendario.escola_id',
        'evento_calendario.ano_letivo_id',
        'evento_calendario.tipo',
        'evento_calendario.inicio',
        'evento_calendario.fim',
        'evento_calendario.descricao',
        'importacao_planilha.id',
        'importacao_planilha.escola_id',
        'importacao_planilha.ano_letivo_id',
        'importacao_planilha.tipo',
        'importacao_planilha.estado',
        'importacao_planilha.linhas',
        'importacao_planilha.marcas',
        'importacao_planilha.assinatura',
        'importacao_planilha.resumo',
        'importacao_planilha.erro',
        'importacao_planilha.criado_por',
        'importacao_planilha.criado_em',
        'importacao_planilha.concluida_em',
        'turma.chave',
        'vinculo.origem',
      ].sort(),
    )
    for (const [tabela, total] of Object.entries(antes.linhas)) expect(depois.linhas[tabela], tabela).toBe(total)
    for (const nova of ['alocacao', 'evento_calendario', 'importacao_planilha']) expect(depois.linhas[nova], nova).toBe(0)

    const { rows } = await scratch.query<{ origem: string }>('select origem from vinculo where id = $1', [dados.vinculo])
    expect(rows).toEqual([{ origem: 'coordenacao' }])
  })

  it('a chave das turmas que já existiam nasce só onde é única no ano: duas de mesma chave no ano ficam as duas sem chave', async () => {
    const { rows } = await scratch.query<{ nome: string; ano: number; escola: string; chave: string | null }>(
      'select t.nome, a.ano, e.slug as escola, t.chave from turma t join ano_letivo a on a.id = t.ano_letivo_id join escola e on e.id = t.escola_id order by e.slug, a.ano, t.nome',
    )
    expect(rows).toEqual([
      { nome: '10A', ano: 2026, escola: 'migracao-a', chave: null },
      { nome: '6 a', ano: 2026, escola: 'migracao-a', chave: null },
      { nome: '6ºA', ano: 2026, escola: 'migracao-a', chave: null },
      { nome: '7ºÁ', ano: 2026, escola: 'migracao-a', chave: '7a' },
      { nome: '8ºA', ano: 2026, escola: 'migracao-a', chave: '8a' },
      { nome: '9º ano B', ano: 2026, escola: 'migracao-a', chave: '9b' },
      { nome: 'Turma Azul', ano: 2026, escola: 'migracao-a', chave: null },
      { nome: '8ºA', ano: 2027, escola: 'migracao-a', chave: '8a' },
      { nome: '8A', ano: 2026, escola: 'migracao-b', chave: '8a' },
    ])
  })

  /** A conta da chave como a migration a escreve: o `regexp_match(...)` do `with calculada`, de onde o teste a tira para rodá-la sobre um nome qualquer. */
  const CONTA_NA_MIGRATION = /regexp_match\((.+)\) AS "achado"/
  const CONTA_NO_RUNBOOK = /regexp_match\((.+)\) as achado/

  /** A chave que a conta SQL da migration dá a um nome (`null`: não casou). */
  async function chavePelaMigration(nome: string): Promise<string | null> {
    const sql = readFileSync(join(PASTA_MIGRACOES, `${PRIMEIRA_DO_F2}.sql`), 'utf8')
    const conta = CONTA_NA_MIGRATION.exec(sql)?.[1]
    if (conta === undefined) throw new Error('a conta da chave não está na migration')
    const contaDoNome = conta.replaceAll('"nome"', '$1::text')
    expect(contaDoNome, 'a conta rodada é a da migration, com o nome no lugar de "nome"').not.toContain('"nome"')
    const { rows } = await scratch.query<{ achado: string[] | null }>(`select regexp_match(${contaDoNome}) as achado`, [nome])
    const achado = rows[0]?.achado
    return achado ? `${achado[0] ?? ''}${achado[2] ?? ''}` : null
  }

  it('a conta da chave em SQL (a da migration, a mesma do runbook) dá a mesma chave que o `chaveDaTurma` do TypeScript, ou nenhuma: nunca outra', async () => {
    const nomes = [
      '8ºA', '8º A', '8A', '8a', '8º ano A', '8 A', '8ª A', '8° a', ' 8o ano  a ', '8ºÁ', '7ºÂ', '9ºÃ', '6º ano C', '1º A',
      'Turma Azul', '10A', '10º A', '8', 'A', '8ºAB', '8ano', '', '   ', '8\tA',
    ]
    for (const nome of nomes) {
      const dela = await chavePelaMigration(nome)
      const doTypeScript = chaveDaTurma(nome)
      expect(dela, JSON.stringify(nome)).toBe(doTypeScript)
    }
    // Onde as duas escritas se afastam, o SQL deixa a chave nula (a turma fica sem chave e a prévia a acusa); nunca dá uma chave diferente.
    // A lista de letras da migration (`translate`) é fixa, e o TypeScript tira qualquer diacrítico; o `btrim` do SQL só tira espaço, e o
    // `trim` do TypeScript tira também a quebra de linha da ponta; o `\s` do TypeScript pega o espaço sem quebra (U+00A0) e o do Postgres não.
    for (const [nome, doTypeScript] of [
      ['8ñ', '8n'],
      ['8ºÿ', '8y'],
      ['8ºA\n', '8a'],
      ['8\u00a0A', '8a'],
    ] as const) {
      expect(chaveDaTurma(nome), JSON.stringify(nome)).toBe(doTypeScript)
      expect(await chavePelaMigration(nome), JSON.stringify(nome)).toBeNull()
    }
  })

  it('o SQL do runbook ("Voltar o código depois da chave da turma") faz a mesma conta da migration', () => {
    const migration = CONTA_NA_MIGRATION.exec(readFileSync(join(PASTA_MIGRACOES, `${PRIMEIRA_DO_F2}.sql`), 'utf8'))?.[1]
    const runbook = CONTA_NO_RUNBOOK.exec(readFileSync(fileURLToPath(new URL('../../../../docs/runbook.md', import.meta.url)), 'utf8'))?.[1]
    expect(migration, 'a conta está na migration').toBeDefined()
    expect(runbook, 'a conta está no runbook').toBeDefined()
    // A migration escreve os nomes entre aspas ("nome"); o runbook, sem.
    expect(runbook).toBe(migration?.replaceAll('"nome"', 'nome'))
  })

  it('a migration aplicada de novo não muda nada, e o único da chave já vale sobre o que ficou', async () => {
    await migrate(configuracao(PASTA_MIGRACOES), logger)
    const { rows } = await scratch.query<{ chave: string | null }>("select t.chave from turma t where t.nome in ('6ºA', '6 a')")
    expect(rows).toEqual([{ chave: null }, { chave: null }])
    const { rows: base } = await scratch.query<{ escola_id: string; ano_letivo_id: string; serie_id: string }>("select escola_id, ano_letivo_id, serie_id from turma where nome = '8ºA' and chave = '8a' and ano_letivo_id in (select id from ano_letivo where ano = 2026)")
    expect(base).toHaveLength(1)
    const sobre = base[0]
    await expect(
      scratch.query("insert into turma (escola_id, ano_letivo_id, serie_id, nome, chave) values ($1, $2, $3, '8º A', '8a')", [sobre?.escola_id, sobre?.ano_letivo_id, sobre?.serie_id]),
    ).rejects.toMatchObject({ code: '23505', constraint: 'turma_chave_no_ano_unica' })
  }, 120_000)
})
