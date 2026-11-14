import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { createLogger } from '../log/logger.js'
import { migrate, PASTA_MIGRACOES, type MigrationConfig } from './migrate.js'

/**
 * As migrations `0052_licenca_de_material` e `0053_licenca_de_material_backfill` (ingestao-do-material, tarefa 5.0) sobre dado que já existia: um banco só para este teste, migrado até a 0051
 * (o que a 4.0 deixou), com material de terceiro de antes da F4 (só o `licenciante` na linha), e depois migrado até a 0053 pelo mesmo `migrate` do serviço de migração. Prova as promessas da Tech
 * Spec, seção 3: a migration só expande (nada apagado, nenhuma coluna a menos), o backfill dá **uma licença por `(escola, licenciante)`**, com o começo no `enviado_em` mais antigo, sem fim ou com
 * o fim na última exclusão, e o `licenciante` do material continua gravado. Também confere o check da auditoria da 5.8, que passa a aceitar o `job` sem escola.
 */

const ULTIMA_DA_5_0 = '0053_licenca_de_material_backfill'
const ULTIMA_DA_7_0 = '0055_material_serie_backfill'

const logger = createLogger({ servico: 'migrar-f4-teste', nivel: 'silent' })

describe('a migration da licença sobre dado da F3', () => {
  const nomeDoBanco = `f4_migracao_${Date.now()}`
  const urlDoTeste = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoTeste)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoTeste.toString() })
  const scratch = new pg.Client({ connectionString: urlDoScratch.toString() })
  const pastas: string[] = []

  const configuracao = (pasta: string): MigrationConfig => ({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 120_000, pasta })

  /** A pasta de migrations só até `tag` (inclusive): copia a do repositório e tira do diário, e da pasta, o que vem depois. */
  function pastaAte(tag: string): string {
    const pasta = mkdtempSync(join(tmpdir(), 'educa-migrar-f4-'))
    pastas.push(pasta)
    cpSync(PASTA_MIGRACOES, pasta, { recursive: true })
    const diario = JSON.parse(readFileSync(join(pasta, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> }
    const indice = diario.entries.findIndex((entrada) => entrada.tag === tag)
    expect(indice, `${tag} está no diário`).toBeGreaterThan(0)
    const depois = diario.entries.slice(indice + 1)
    writeFileSync(join(pasta, 'meta', '_journal.json'), JSON.stringify({ ...diario, entries: diario.entries.slice(0, indice + 1) }))
    for (const entrada of depois) rmSync(join(pasta, `${entrada.tag}.sql`))
    expect(readdirSync(pasta).filter((arquivo) => arquivo.endsWith('.sql')).at(-1)).toBe(`${tag}.sql`)
    return pasta
  }

  /** A pasta só até a migration anterior à da licença: a 0051, que a 4.0 deixou. */
  function pastaAteA0051(): string {
    return pastaAte('0051_capitulo_do_material')
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
    readonly escolaA: string
    readonly escolaB: string
    readonly escolaC: string
    /** A escola sem série nenhuma, com um material (7.0). */
    readonly escolaD: string
    /** As séries de cada escola, pelo nome da escola (7.0). */
    readonly series: Record<'A' | 'B' | 'C', string[]>
    /** O material de terceiro de cada caso, pelo nome do caso. */
    readonly materiais: Record<string, string>
  }

  let contador = 0
  /** Um material de antes da F4: só o `licenciante` na linha, com o instante do envio e, se foi, o da exclusão. */
  async function material(escolaId: string, disciplinaId: string, caso: { licenciante: string | null; enviadoEm: string; excluidoEm?: string }): Promise<string> {
    contador += 1
    return id(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenciante, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em, excluido_em, objeto_apagado_em)
       values ($1, $2, $3, $4, $5, $6, true, md5($7::text) || md5($7::text || 'x'), 1000, 'pronto', 1, $8::timestamptz, $9::timestamptz, $8::timestamptz) returning id`,
      [
        escolaId,
        disciplinaId,
        `Material ${String(contador)}`,
        caso.licenciante === null ? 'escola' : 'terceiro_com_licenca',
        caso.licenciante,
        caso.licenciante === null ? 'autoria_da_escola' : 'licenca_comercial_autorizada',
        String(contador),
        caso.enviadoEm,
        caso.excluidoEm ?? null,
      ],
    )
  }

  /** Dado como a F3 o deixou: três escolas, material próprio e de terceiro, vivo e excluído, e o mesmo licenciante em duas escolas. */
  async function semearDadoDaF3(): Promise<Dados> {
    const rede = await id("insert into rede (nome, tipo) values ('Rede da migração', 'independente') returning id", [])
    const escola = (slug: string) => id("insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id", [rede, `Escola ${slug}`, slug])
    const escolaA = await escola('licenca-a')
    const escolaB = await escola('licenca-b')
    const escolaC = await escola('licenca-c')
    const disciplina = (escolaId: string) => id("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escolaId])
    const [quimicaA, quimicaB, quimicaC] = [await disciplina(escolaA), await disciplina(escolaB), await disciplina(escolaC)]

    const materiais: Record<string, string> = {
      // A mesma licenciante, três materiais, dois vivos e um excluído: uma licença sem fim, com o começo no envio mais antigo. O envio mais antigo é a 1h UTC de 1º/02, que em São Paulo ainda é 31/01.
      aVivo1: await material(escolaA, quimicaA, { licenciante: 'Editora X', enviadoEm: '2026-03-10T12:00:00Z' }),
      aVivo2: await material(escolaA, quimicaA, { licenciante: 'Editora X', enviadoEm: '2026-02-01T01:00:00Z' }),
      aExcluido: await material(escolaA, quimicaA, { licenciante: 'Editora X', enviadoEm: '2026-02-20T12:00:00Z', excluidoEm: '2026-09-01T12:00:00Z' }),
      // Só excluídos: o fim é o dia da última exclusão, em São Paulo (23h de 20/08 lá é 02h de 21/08 em UTC).
      aSoExcluido1: await material(escolaA, quimicaA, { licenciante: 'Editora Y', enviadoEm: '2026-04-01T12:00:00Z', excluidoEm: '2026-06-10T18:00:00Z' }),
      aSoExcluido2: await material(escolaA, quimicaA, { licenciante: 'Editora Y', enviadoEm: '2026-05-01T12:00:00Z', excluidoEm: '2026-08-21T02:00:00Z' }),
      // O mesmo licenciante na escola B: outra licença.
      bVivo: await material(escolaB, quimicaB, { licenciante: 'Editora X', enviadoEm: '2026-07-07T12:00:00Z' }),
      // Material próprio, sem licenciante: não ganha licença.
      aProprio: await material(escolaA, quimicaA, { licenciante: null, enviadoEm: '2026-01-15T12:00:00Z' }),
      // Maiúscula diferente é outro licenciante: o backfill não adivinha.
      aOutraGrafia: await material(escolaA, quimicaA, { licenciante: 'EDITORA X', enviadoEm: '2026-08-08T12:00:00Z' }),
    }
    // A escola C tem material de terceiro demais para um lote só: 5.100 linhas do mesmo licenciante, mais de um lote de 5.000.
    await scratch.query(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenciante, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em, objeto_apagado_em)
       select $1, $2, 'Material em massa', 'terceiro_com_licenca', 'Editora Z', 'licenca_comercial_autorizada', true, md5(n::text) || md5(n::text || 'z'), 1000, 'pronto', 1, '2026-06-01T12:00:00Z'::timestamptz + n * interval '1 second', '2026-06-01T12:00:00Z'
       from generate_series(1, 5100) as n`,
      [escolaC, quimicaC],
    )
    // As séries da 7.0: A tem duas, B uma, C duas (os dois lotes de 5.000 somam 10.200 linhas) e D nenhuma.
    const serieDe = (escolaId: string, etapa: string, ano: number) => id('insert into serie (escola_id, etapa, ano) values ($1, $2, $3) returning id', [escolaId, etapa, ano])
    const series = {
      A: [await serieDe(escolaA, 'ef_anos_finais', 6), await serieDe(escolaA, 'em', 1)],
      B: [await serieDe(escolaB, 'ef_anos_finais', 7)],
      C: [await serieDe(escolaC, 'ef_anos_finais', 8), await serieDe(escolaC, 'em', 2)],
    }
    const escolaD = await escola('licenca-d')
    const daD = await material(escolaD, await disciplina(escolaD), { licenciante: null, enviadoEm: '2026-03-01T12:00:00Z' })
    // Fora do padrão `Material %` dos casos da licença, que contam só o dado da 5.0.
    await scratch.query("update material set titulo = 'Da escola sem série' where id = $1", [daD])
    return { escolaA, escolaB, escolaC, escolaD, series, materiais }
  }

  // O dado da F3 e o retrato de antes e de depois nascem uma vez, no `beforeAll`: cada caso lê o que precisa e roda sozinho (`-t`).
  let dados: Dados
  let antes: Awaited<ReturnType<typeof retrato>>
  let depois: Awaited<ReturnType<typeof retrato>>
  let depoisDaSerie: Awaited<ReturnType<typeof retrato>>

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate(configuracao(pastaAteA0051()), logger)
    await scratch.connect()
    dados = await semearDadoDaF3()
    antes = await retrato()
    await migrate(configuracao(pastaAte(ULTIMA_DA_5_0)), logger)
    depois = await retrato()
    await migrate(configuracao(pastaAte(ULTIMA_DA_7_0)), logger)
    depoisDaSerie = await retrato()
  }, 240_000)

  afterAll(async () => {
    await scratch.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
    for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
  })

  it('só expande: nenhuma linha some, nenhuma coluna some, a tabela nova nasce das licenças do backfill e só `material.licenca_id` é coluna nova', () => {
    expect(antes.colunas).not.toContain('material.licenca_id')
    expect(antes.colunas).not.toContain('licenca_de_material.id')
    for (const coluna of antes.colunas) expect(depois.colunas, coluna).toContain(coluna)
    expect(depois.colunas.filter((coluna) => !antes.colunas.includes(coluna) && !coluna.startsWith('licenca_de_material.'))).toEqual(['material.licenca_id'])
    for (const [tabela, total] of Object.entries(antes.linhas)) expect(depois.linhas[tabela], tabela).toBe(total)
    // Editora X em A, Editora Y em A, EDITORA X em A, Editora X em B, Editora Z em C.
    expect(depois.linhas['licenca_de_material']).toBe(5)
  })

  it('uma licença por `(escola, licenciante)`: o mesmo licenciante duas vezes na escola dá uma, e na escola B dá outra', async () => {
    const { rows } = await scratch.query<{ escola_id: string; licenciante: string; materiais: number }>(
      `select l.escola_id, l.licenciante, (select count(*)::int from material m where m.licenca_id = l.id) as materiais
       from licenca_de_material l order by l.escola_id, l.licenciante`,
    )
    const porEscola = (escolaId: string) => rows.filter((linha) => linha.escola_id === escolaId).map(({ licenciante, materiais }) => [licenciante, materiais] as const).sort(([a], [b]) => (a < b ? -1 : 1))
    expect(porEscola(dados.escolaA)).toEqual([
      ['EDITORA X', 1],
      ['Editora X', 3],
      ['Editora Y', 2],
    ])
    expect(porEscola(dados.escolaB)).toEqual([['Editora X', 1]])
    expect(porEscola(dados.escolaC)).toEqual([['Editora Z', 5100]])
    const daA = rows.find((linha) => linha.escola_id === dados.escolaA && linha.licenciante === 'Editora X')
    const daB = rows.find((linha) => linha.escola_id === dados.escolaB && linha.licenciante === 'Editora X')
    expect(daA).toBeDefined()
    expect(daB).toBeDefined()
  })

  it('cada material de terceiro aponta a licença da própria escola; o próprio da escola não aponta nenhuma, e o `licenciante` dele continua gravado', async () => {
    const { rows } = await scratch.query<{ id: string; licenciante: string | null; licenca_id: string | null; escola_id: string; escola_da_licenca: string | null; licenciante_da_licenca: string | null }>(
      `select m.id, m.licenciante, m.licenca_id, m.escola_id, l.escola_id as escola_da_licenca, l.licenciante as licenciante_da_licenca
       from material m left join licenca_de_material l on l.id = m.licenca_id where m.titulo like 'Material %' and m.titulo <> 'Material em massa'`,
    )
    expect(rows).toHaveLength(Object.keys(dados.materiais).length)
    for (const linha of rows) {
      if (linha.id === dados.materiais['aProprio']) {
        expect(linha).toMatchObject({ licenciante: null, licenca_id: null })
        continue
      }
      expect(linha.licenca_id, linha.id).not.toBeNull()
      expect(linha.escola_da_licenca, linha.id).toBe(linha.escola_id)
      expect(linha.licenciante_da_licenca, linha.id).toBe(linha.licenciante)
    }
    const { rows: semLicenca } = await scratch.query<{ total: number }>("select count(*)::int as total from material where licenciante is not null and licenca_id is null")
    expect(semLicenca[0]?.total).toBe(0)
  })

  it('`vigente_desde` é o envio mais antigo, no dia de São Paulo; o fim é nulo, ou o dia da última exclusão quando todo material dela foi excluído', async () => {
    const { rows } = await scratch.query<{ escola_id: string; licenciante: string; vigente_desde: string; vigente_ate: string | null; cobertura: string; referencia: string; registrada_por: string | null }>(
      "select escola_id, licenciante, vigente_desde::text, vigente_ate::text, cobertura, referencia, registrada_por from licenca_de_material where escola_id <> $1 or licenciante <> 'Editora Z' order by escola_id, licenciante",
      [dados.escolaC],
    )
    const de = (escolaId: string, licenciante: string) => rows.find((linha) => linha.escola_id === escolaId && linha.licenciante === licenciante)
    // 1º/02 à 1h UTC é 31/01 em São Paulo, e a licença sem fim fica com o excluído de setembro sem mudar o fim (há material vivo).
    expect(de(dados.escolaA, 'Editora X')).toMatchObject({ vigente_desde: '2026-01-31', vigente_ate: null })
    // Só excluídos: a última exclusão é 21/08 à 02h UTC, que é 20/08 em São Paulo.
    expect(de(dados.escolaA, 'Editora Y')).toMatchObject({ vigente_desde: '2026-04-01', vigente_ate: '2026-08-20' })
    expect(de(dados.escolaA, 'EDITORA X')).toMatchObject({ vigente_desde: '2026-08-08', vigente_ate: null })
    expect(de(dados.escolaB, 'Editora X')).toMatchObject({ vigente_desde: '2026-07-07', vigente_ate: null })
    for (const linha of rows) {
      expect(linha.referencia).toBe('registrada antes da F4')
      expect(linha.cobertura.length).toBeGreaterThan(0)
      expect(linha.registrada_por).toBeNull()
    }
  })

  it('mais de um lote de 5.000: as 5.100 linhas da escola C apontam a mesma licença, e nenhuma ficou sem', async () => {
    const { rows } = await scratch.query<{ licencas: number; sem: number }>(
      `select count(distinct licenca_id)::int as licencas, count(*) filter (where licenca_id is null)::int as sem from material where escola_id = $1`,
      [dados.escolaC],
    )
    expect(rows[0]).toEqual({ licencas: 1, sem: 0 })
  })

  it('a licença tem as travas do banco: a FK composta com a escola, o fim antes do começo e o texto fora do tamanho', async () => {
    const { rows } = await scratch.query<{ id: string }>('select id from licenca_de_material where escola_id = $1 limit 1', [dados.escolaA])
    const daA = rows[0]?.id
    expect(daA).toBeDefined()
    const quimicaB = await id('select id from disciplina where escola_id = $1', [dados.escolaB])
    // O material da B não aponta a licença da A.
    await expect(
      scratch.query(
        `insert into material (escola_id, disciplina_id, titulo, titularidade, licenciante, licenca, licenca_id, declaracao, sha256, tamanho_bytes, estado, paginas)
         values ($1, $2, 'Cruzado', 'terceiro_com_licenca', 'Editora X', 'licenca_comercial_autorizada', $3, true, repeat('a', 64), 1, 'pronto', 1)`,
        [dados.escolaB, quimicaB, daA],
      ),
    ).rejects.toMatchObject({ code: '23503', constraint: 'material_licenca_da_escola_fk' })
    await expect(
      scratch.query("insert into licenca_de_material (escola_id, licenciante, cobertura, referencia, vigente_desde, vigente_ate) values ($1, 'a', 'b', 'c', '2026-05-02', '2026-05-01')", [dados.escolaA]),
    ).rejects.toMatchObject({ code: '23514', constraint: 'licenca_de_material_vigencia_valida' })
    // O fim no mesmo dia do começo vale: a licença de um dia só.
    await scratch.query("insert into licenca_de_material (escola_id, licenciante, cobertura, referencia, vigente_desde, vigente_ate) values ($1, 'Um dia', 'b', 'c', '2026-05-01', '2026-05-01')", [dados.escolaA])
    for (const [licenciante, cobertura, referencia, constraint] of [
      ['', 'b', 'c', 'licenca_de_material_licenciante_preenchido'],
      ['a'.repeat(121), 'b', 'c', 'licenca_de_material_licenciante_preenchido'],
      ['a', ' ', 'c', 'licenca_de_material_cobertura_preenchida'],
      ['a', 'b'.repeat(301), 'c', 'licenca_de_material_cobertura_preenchida'],
      ['a', 'b', '', 'licenca_de_material_referencia_preenchida'],
      ['a', 'b', 'c'.repeat(201), 'licenca_de_material_referencia_preenchida'],
    ] as const) {
      await expect(
        scratch.query("insert into licenca_de_material (escola_id, licenciante, cobertura, referencia, vigente_desde) values ($1, $2, $3, $4, '2026-05-01')", [dados.escolaA, licenciante, cobertura, referencia]),
      ).rejects.toMatchObject({ code: '23514', constraint })
    }
  })

  it('os dois índices são parciais e começam pela escola: o das licenças com fim e o dos materiais com licença', async () => {
    const { rows } = await scratch.query<{ indexname: string; indexdef: string }>(
      "select indexname, indexdef from pg_indexes where schemaname = 'public' and indexname in ('licenca_de_material_vigente_ate_idx', 'material_licenca_idx') order by indexname",
    )
    expect(rows.map((linha) => linha.indexname)).toEqual(['licenca_de_material_vigente_ate_idx', 'material_licenca_idx'])
    expect(rows[0]?.indexdef).toMatch(/\(escola_id, vigente_ate\) WHERE \(?vigente_ate IS NOT NULL\)?/)
    expect(rows[1]?.indexdef).toMatch(/\(escola_id, licenca_id\) WHERE \(?licenca_id IS NOT NULL\)?/)
  })

  it('o `registrada_por` vira nulo com a eliminação da pessoa, sem anular a escola da licença (`on delete set null ("registrada_por")`)', async () => {
    const conta = await id("insert into conta (email) values ('coordenacao@migracao.invalid') returning id", [])
    const coordenacao = await id("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'coordenador', 'Coordenação') returning id", [dados.escolaB, conta])
    const licenca = await id(
      "insert into licenca_de_material (escola_id, licenciante, cobertura, referencia, vigente_desde, registrada_por) values ($1, 'Editora Nova', 'x', 'y', '2026-05-01', $2) returning id",
      [dados.escolaB, coordenacao],
    )
    await scratch.query('delete from usuario where id = $1', [coordenacao])
    const { rows } = await scratch.query<{ escola_id: string; registrada_por: string | null }>('select escola_id, registrada_por from licenca_de_material where id = $1', [licenca])
    expect(rows).toEqual([{ escola_id: dados.escolaB, registrada_por: null }])
  })

  it('o check da auditoria aceita sem escola o `job` do operador, e só ele além da rede e do suboperador (5.8)', async () => {
    const inserir = (entidade: string, autorOperador: string | null) =>
      scratch.query(
        `insert into auditoria (escola_id, autor_usuario_id, autor_operador, acao, entidade, entidade_id, requisicao_id)
         values (null, null, $1, 'teste.check', $2, gen_random_uuid(), gen_random_uuid())`,
        [autorOperador, entidade],
      )
    await inserir('job', 'operador-teste')
    await expect(inserir('job', null)).rejects.toMatchObject({ code: '23514' })
    await expect(inserir('escola', 'operador-teste')).rejects.toMatchObject({ code: '23514', constraint: 'auditoria_escola_ou_operacao_global' })
    await scratch.query("delete from auditoria where acao = 'teste.check'")
  })

  // A 7.0: as séries do material (`0054_material_serie`, `0055_material_serie_backfill`), sobre o mesmo dado, já migrado até a 0053.
  describe('as séries do material (7.0)', () => {
    const seriesDoMaterial = async (escolaId: string): Promise<Array<{ material_id: string; serie_id: string }>> =>
      (await scratch.query<{ material_id: string; serie_id: string }>('select material_id, serie_id from material_serie where escola_id = $1 order by material_id, serie_id', [escolaId])).rows

    it('só expande: nenhuma coluna nem linha some, e a tabela nova é a única diferença', () => {
      for (const coluna of depois.colunas) expect(depoisDaSerie.colunas, coluna).toContain(coluna)
      expect(depoisDaSerie.colunas.filter((coluna) => !depois.colunas.includes(coluna))).toEqual(['material_serie.escola_id', 'material_serie.material_id', 'material_serie.serie_id'])
      for (const [tabela, linhas] of Object.entries(depois.linhas)) if (tabela !== 'material_serie') expect(depoisDaSerie.linhas[tabela], tabela).toBe(linhas)
    })

    it('cada material ganha todas as séries da própria escola, e nenhuma de outra', async () => {
      const materiaisDaA = Number((await scratch.query<{ total: string }>('select count(*) as total from material where escola_id = $1', [dados.escolaA])).rows[0]?.total)
      const daA = await seriesDoMaterial(dados.escolaA)
      expect(daA).toHaveLength(materiaisDaA * dados.series.A.length)
      expect(new Set(daA.map((linha) => linha.serie_id))).toEqual(new Set(dados.series.A))
      const daB = await seriesDoMaterial(dados.escolaB)
      expect(daB).toEqual([{ material_id: dados.materiais['bVivo'], serie_id: dados.series.B[0] }])
    })

    it('mais de um lote de 5.000: os 5.100 materiais da escola C têm as duas séries dela, e nenhum ficou sem', async () => {
      const { rows } = await scratch.query<{ total: number; sem: number }>(
        `select count(*)::int as total, (select count(*)::int from material m where m.escola_id = $1 and not exists (select 1 from material_serie s where s.escola_id = m.escola_id and s.material_id = m.id)) as sem
         from material_serie where escola_id = $1`,
        [dados.escolaC],
      )
      expect(rows[0]).toEqual({ total: 5_100 * dados.series.C.length, sem: 0 })
    })

    it('a escola sem série deixa o material sem linha, e rodar o backfill de novo não duplica nada', async () => {
      expect(await seriesDoMaterial(dados.escolaD)).toEqual([])
      const antesDoRepeteco = (await scratch.query<{ total: string }>('select count(*) as total from material_serie')).rows[0]?.total
      const corpo = readFileSync(join(PASTA_MIGRACOES, '0055_material_serie_backfill.sql'), 'utf8').split('--> statement-breakpoint')
      for (const instrucao of corpo) await scratch.query(instrucao)
      expect((await scratch.query<{ total: string }>('select count(*) as total from material_serie')).rows[0]?.total).toBe(antesDoRepeteco)
    })

    it('a tabela tem as travas do banco: a FK composta com a escola do material e da série, e a chave sem repetição', async () => {
      const [serieDaA] = dados.series.A
      const material = dados.materiais['aVivo1']
      await expect(scratch.query('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [dados.escolaB, material, dados.series.B[0]])).rejects.toMatchObject({ constraint: 'material_serie_material_da_escola_fk' })
      await expect(scratch.query('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [dados.escolaA, material, dados.series.B[0]])).rejects.toMatchObject({ constraint: 'material_serie_serie_da_escola_fk' })
      await expect(scratch.query('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [dados.escolaA, material, serieDaA])).rejects.toMatchObject({ constraint: 'material_serie_pk' })
    })

    it('o índice começa pela escola e pela série', async () => {
      const { rows } = await scratch.query<{ indexdef: string }>("select indexdef from pg_indexes where tablename = 'material_serie' and indexname = 'material_serie_serie_idx'")
      expect(rows[0]?.indexdef).toContain('(escola_id, serie_id, material_id)')
    })
  })

  // A 11.0: o índice do resumo do material (`0057_auditoria_material_recusado`), sobre o mesmo banco, migrado até a 0057 (a 0056 é da 8.0).
  describe('o índice da recusa de material (11.0)', () => {
    beforeAll(async () => {
      await migrate(configuracao(pastaAte('0057_auditoria_material_recusado')), logger)
    }, 120_000)

    it('o índice da recusa é parcial na ação `material.recusado` e começa pela escola e pelo instante', async () => {
      const { rows } = await scratch.query<{ indexdef: string }>("select indexdef from pg_indexes where tablename = 'auditoria' and indexname = 'auditoria_material_recusado_idx'")
      expect(rows).toHaveLength(1)
      expect(rows[0]?.indexdef).toMatch(/\(escola_id, em\) WHERE .*material\.recusado/)
    })
  })
})
