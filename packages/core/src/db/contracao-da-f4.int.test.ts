import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { createLogger } from '../log/logger.js'
import { migrate, PASTA_MIGRACOES, type MigrationConfig } from './migrate.js'
import { material as tabelaDoMaterial } from './schema/material.js'

/**
 * A contração da F4 (classificacao-bncc, tarefa 9.0; Tech Spec, seção 3, "Migrations", item 3): a migration `0065_contracao_da_f4` sobre o que a janela deixou. Um banco só para este teste, migrado até a 0064 (o que o código de antes
 * da 9.0 conhece), com material que entrou depois do backfill da F4: sem série, e de terceiro com o `licenciante` só na linha e sem `licenca_id`. Depois, migrado até a 0065 pelo mesmo `migrate` do serviço de migração.
 *
 * Prova: o backfill (séries e licenças) por escola, sem cruzar, em mais de um lote de 5.000 e repetível; o check `material_terceiro_tem_licenca` validado, recusando os dois lados da igualdade; os dois checks de `licenciante` fora; a coluna
 * ainda lá, e a versão anterior do código (a que grava `licenca_id` junto do `licenciante`) seguindo aceita (regra 80, item 9). Que o código novo não lê nem grava a coluna é da API: `apps/api/test/material.int.test.ts`.
 */

const ULTIMA_ANTES_DA_CONTRACAO = '0064_indice_da_classificacao_atrasada'
const DA_CONTRACAO = '0065_contracao_da_f4'
const CHECK = 'material_terceiro_tem_licenca'

const RUNBOOK = join(fileURLToPath(new URL('../../../../docs/runbook.md', import.meta.url)))

/** O bloco de SQL do runbook que abre com `-- volta-da-f4: <nome>`: o que a pessoa de plantão copia é o que o teste roda. */
function blocoDoRunbook(nome: string): string {
  const achado = new RegExp('```sql\\n-- volta-da-f4: ' + nome + '[^\\n]*\\n([\\s\\S]*?)```').exec(readFileSync(RUNBOOK, 'utf8'))
  if (achado?.[1] === undefined) throw new Error(`o runbook não tem o bloco "volta-da-f4: ${nome}"`)
  return achado[1]
}

const logger = createLogger({ servico: 'migrar-contracao-teste', nivel: 'silent' })

describe('a migration da contração da F4 sobre o dado da janela', () => {
  const nomeDoBanco = `contracao_f4_${String(Date.now())}`
  const urlDoTeste = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoTeste)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoTeste.toString() })
  const scratch = new pg.Client({ connectionString: urlDoScratch.toString() })
  const pastas: string[] = []

  const configuracao = (pasta: string): MigrationConfig => ({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 120_000, pasta })

  /** A pasta de migrations só até `tag` (inclusive): copia a do repositório e tira do diário, e da pasta, o que vem depois. */
  function pastaAte(tag: string): string {
    const pasta = mkdtempSync(join(tmpdir(), 'educa-migrar-contracao-'))
    pastas.push(pasta)
    cpSync(PASTA_MIGRACOES, pasta, { recursive: true })
    const diario = JSON.parse(readFileSync(join(pasta, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> }
    const indice = diario.entries.findIndex((entrada) => entrada.tag === tag)
    expect(indice, `${tag} está no diário`).toBeGreaterThan(0)
    writeFileSync(join(pasta, 'meta', '_journal.json'), JSON.stringify({ ...diario, entries: diario.entries.slice(0, indice + 1) }))
    for (const entrada of diario.entries.slice(indice + 1)) rmSync(join(pasta, `${entrada.tag}.sql`))
    return pasta
  }

  async function id(instrucao: string, valores: unknown[]): Promise<string> {
    const { rows } = await scratch.query<{ id: string }>(instrucao, valores)
    const linha = rows[0]
    if (linha === undefined) throw new Error('insert sem linha')
    return linha.id
  }

  interface Escola {
    readonly id: string
    readonly disciplinaId: string
    readonly series: string[]
  }

  async function escola(slug: string, anosDasSeries: number[]): Promise<Escola> {
    const rede = await id("insert into rede (nome, tipo) values ($1, 'independente') returning id", [`Rede ${slug}`])
    const escolaId = await id('insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id', [rede, `Escola ${slug}`, slug])
    const disciplinaId = await id("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escolaId])
    const series: string[] = []
    for (const ano of anosDasSeries) series.push(await id("insert into serie (escola_id, etapa, ano) values ($1, 'em', $2) returning id", [escolaId, ano]))
    return { id: escolaId, disciplinaId, series }
  }

  let contador = 0
  interface CasoDeMaterial {
    readonly licenciante?: string
    readonly licencaId?: string
    readonly enviadoEm: string
    readonly excluidoEm?: string
    /** Série declarada: o que a F4 grava; o material da janela não a tem. */
    readonly serieId?: string
  }

  /** Um material como o código de antes da F4 o grava (o `licenciante` só na linha, sem licença nem série) ou como a F4 o grava (`licenca_id` junto). */
  async function material(escolaDe: Escola, caso: CasoDeMaterial): Promise<string> {
    contador += 1
    const terceiro = caso.licenciante !== undefined
    const materialId = await id(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenciante, licenca, licenca_id, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em, excluido_em, objeto_apagado_em)
       values ($1, $2, $3, $4, $5, $6, $7, true, md5($8::text) || md5($8::text || 'x'), 1000, 'pronto', 1, $9, $10, $9) returning id`,
      [escolaDe.id, escolaDe.disciplinaId, `Material ${String(contador)}`, terceiro ? 'terceiro_com_licenca' : 'escola', caso.licenciante ?? null, terceiro ? 'licenca_comercial_autorizada' : 'autoria_da_escola', caso.licencaId ?? null, String(contador), caso.enviadoEm, caso.excluidoEm ?? null],
    )
    if (caso.serieId !== undefined) await scratch.query('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [escolaDe.id, materialId, caso.serieId])
    return materialId
  }

  const licenca = (escolaDe: Escola, licenciante: string, desde: string) =>
    id("insert into licenca_de_material (escola_id, licenciante, cobertura, referencia, vigente_desde) values ($1, $2, 'Apostilas', 'contrato sintético', $3) returning id", [escolaDe.id, licenciante, desde])

  interface MaterialLigado {
    readonly id: string
    readonly escola_id: string
    readonly licenca_id: string | null
    readonly licenca_da_escola: string | null
    readonly licenciante_da_licenca: string | null
    readonly series: string[]
  }

  /** Cada material da escola com a licença a que aponta (e a escola dela) e as séries declaradas. */
  async function linhasDa(escolaId: string): Promise<Map<string, MaterialLigado>> {
    const { rows } = await scratch.query<MaterialLigado>(
      `select m.id, m.escola_id, m.licenca_id, l.escola_id as licenca_da_escola, l.licenciante as licenciante_da_licenca,
              coalesce((select array_agg(s.serie_id order by s.serie_id) from material_serie s where s.escola_id = m.escola_id and s.material_id = m.id), '{}') as series
         from material m left join licenca_de_material l on l.id = m.licenca_id where m.escola_id = $1`,
      [escolaId],
    )
    return new Map(rows.map((linha) => [linha.id, linha]))
  }

  async function licencasDa(escolaId: string): Promise<Array<{ id: string; licenciante: string; referencia: string; vigente_desde: string; vigente_ate: string | null }>> {
    const { rows } = await scratch.query<{ id: string; licenciante: string; referencia: string; vigente_desde: string; vigente_ate: string | null }>(
      'select id, licenciante, referencia, vigente_desde::text, vigente_ate::text from licenca_de_material where escola_id = $1 order by licenciante, id',
      [escolaId],
    )
    return rows
  }

  let a: Escola
  let b: Escola
  let c: Escola
  let d: Escola
  let e: Escola
  let f: Escola
  const casos: Record<string, string> = {}
  let licencaDaAEditoraX: string
  let antesDoCheck: { recusouTerceiroSemLicenca: boolean; terceiroSemLicenca: number }

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate(configuracao(pastaAte(ULTIMA_ANTES_DA_CONTRACAO)), logger)
    await scratch.connect()
    ;[a, b, c, d] = [await escola('contracao-a', [1, 2]), await escola('contracao-b', [3]), await escola('contracao-c', [1, 2]), await escola('contracao-d', [])]
    ;[e, f] = [await escola('contracao-e', [1]), await escola('contracao-f', [1])]

    // A: já registrou a licença da Editora X (pela API), e uma mais antiga da mesma editora; o que a janela gravou é ligado à de começo mais recente, e não a uma terceira.
    await licenca(a, 'Editora X', '2025-01-01')
    licencaDaAEditoraX = await licenca(a, 'Editora X', '2026-02-01')
    casos['aJaLigado'] = await material(a, { licenciante: 'Editora X', licencaId: licencaDaAEditoraX, enviadoEm: '2026-03-01T12:00:00Z', serieId: a.series[0] ?? '' })
    casos['aDaJanelaComLicencaExistente'] = await material(a, { licenciante: 'Editora X', enviadoEm: '2026-10-05T12:00:00Z' })
    // Editora Nova: nenhuma licença; dois materiais, um excluído: a licença nova não tem fim e começa no envio mais antigo (no dia de São Paulo: 1h UTC de 1º/10 ainda é 30/09).
    casos['aDaJanelaNova1'] = await material(a, { licenciante: 'Editora Nova', enviadoEm: '2026-10-01T01:00:00Z' })
    casos['aDaJanelaNova2'] = await material(a, { licenciante: 'Editora Nova', enviadoEm: '2026-10-09T12:00:00Z', excluidoEm: '2026-10-20T12:00:00Z' })
    // Editora Morta: só material excluído: a licença nova termina no dia da última exclusão.
    casos['aDaJanelaMorta1'] = await material(a, { licenciante: 'Editora Morta', enviadoEm: '2026-09-01T12:00:00Z', excluidoEm: '2026-09-10T12:00:00Z' })
    casos['aDaJanelaMorta2'] = await material(a, { licenciante: 'Editora Morta', enviadoEm: '2026-09-02T12:00:00Z', excluidoEm: '2026-09-15T12:00:00Z' })
    // Material próprio, sem série (o da janela) e com série (o que a F4 já grava).
    casos['aProprioSemSerie'] = await material(a, { enviadoEm: '2026-10-06T12:00:00Z' })
    casos['aProprioComSerie'] = await material(a, { enviadoEm: '2026-10-07T12:00:00Z', serieId: a.series[1] ?? '' })
    // B: o mesmo licenciante que A já registrou, e nenhuma licença na escola B: a de A não alcança o material de B.
    casos['bDaJanela'] = await material(b, { licenciante: 'Editora X', enviadoEm: '2026-10-08T12:00:00Z' })
    casos['bProprioSemSerie'] = await material(b, { enviadoEm: '2026-10-08T13:00:00Z' })
    // C: mais de um lote de 5.000, do mesmo licenciante, sem série (a escola tem duas).
    await scratch.query(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenciante, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em, objeto_apagado_em)
       select $1, $2, 'Material em massa', 'terceiro_com_licenca', 'Editora Z', 'licenca_comercial_autorizada', true, md5(n::text) || md5(n::text || 'z'), 1000, 'pronto', 1, '2026-10-01T12:00:00Z'::timestamptz + n * interval '1 second', '2026-10-01T12:00:00Z'
       from generate_series(1, 5100) as n`,
      [c.id, c.disciplinaId],
    )
    // D: sem série nenhuma na escola: o material fica sem linha, e aparece como "sem série" no resumo (RF18).
    casos['dProprioSemSerie'] = await material(d, { enviadoEm: '2026-10-08T14:00:00Z' })

    // E: a mesma editora escrita de dois jeitos: "Editora X" e "EDITORA X" são licenciantes diferentes (a comparação é exata, como na 0053), e cada um ganha a sua licença.
    casos['eGrafiaUm'] = await material(e, { licenciante: 'Editora X', enviadoEm: '2026-10-05T12:00:00Z' })
    casos['eGrafiaDois'] = await material(e, { licenciante: 'EDITORA X', enviadoEm: '2026-10-06T12:00:00Z' })
    // F: a licença registrada pela coordenação tem o começo **depois** do envio (2026-06-01, contra 2026-03-01): vale a de começo mais recente, e nenhuma licença nova nasce.
    casos['fLicencaComecaDepois'] = await licenca(f, 'Editora Y', '2026-06-01')
    casos['fDaJanelaAntesDaLicenca'] = await material(f, { licenciante: 'Editora Y', enviadoEm: '2026-03-01T12:00:00Z' })

    // Antes da migration o banco aceita o material de terceiro sem licença: é o dado que a janela deixou.
    antesDoCheck = {
      terceiroSemLicenca: Number((await scratch.query("select count(*)::int as total from material where titularidade = 'terceiro_com_licenca' and licenca_id is null")).rows[0]?.total),
      recusouTerceiroSemLicenca: await scratch.query("select 1 from pg_constraint where conname = $1 and conrelid = 'material'::regclass", [CHECK]).then((r) => (r.rowCount ?? 0) > 0),
    }
    await migrate(configuracao(pastaAte(DA_CONTRACAO)), logger)
  }, 240_000)

  afterAll(async () => {
    await scratch.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
    for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
  })

  it('antes da migration o check não existe, e o terceiro sem licença da janela estava lá: o teste parte do banco que a janela deixou', () => {
    expect(antesDoCheck.recusouTerceiroSemLicenca).toBe(false)
    // A (5) + B (1) + C (5.100) + E (2) + F (1): o dado que a migration tem de corrigir, contado antes dela.
    expect(antesDoCheck.terceiroSemLicenca).toBe(5 + 1 + 5_100 + 2 + 1)
  })

  /** A licença a que o material do caso aponta, ou `undefined` se o caso não está na lista. */
  const licencaDoCaso = (linhas: Map<string, MaterialLigado>, nome: string): string | null | undefined => linhas.get(casos[nome] ?? '')?.licenca_id
  /** As séries declaradas do material do caso. */
  const seriesDoCaso = (linhas: Map<string, MaterialLigado>, nome: string): string[] | undefined => linhas.get(casos[nome] ?? '')?.series

  it('o terceiro sem licença criado na janela é corrigido antes do `VALIDATE`: a licença da escola dele, a existente ou uma nova do mesmo licenciante; nenhum fica sem', async () => {
    const daA = await linhasDa(a.id)
    // O já ligado fica como estava; o da janela da mesma editora é ligado à licença de começo mais recente que a escola já tinha, e não a uma nova.
    expect(licencaDoCaso(daA, 'aJaLigado')).toBe(licencaDaAEditoraX)
    expect(licencaDoCaso(daA, 'aDaJanelaComLicencaExistente')).toBe(licencaDaAEditoraX)
    const licencas = await licencasDa(a.id)
    expect(licencas.map((licencaDaEscola) => licencaDaEscola.licenciante)).toEqual(['Editora Morta', 'Editora Nova', 'Editora X', 'Editora X'])
    // A licença nova leva a referência da contração, e o começo é o envio mais antigo no dia de São Paulo.
    const nova = licencas.find((licencaDaEscola) => licencaDaEscola.licenciante === 'Editora Nova')
    expect(nova).toMatchObject({ referencia: 'registrada na contração da F4', vigente_desde: '2026-09-30', vigente_ate: null })
    // Só material excluído: a licença termina no dia da última exclusão.
    const morta = licencas.find((licencaDaEscola) => licencaDaEscola.licenciante === 'Editora Morta')
    expect(morta).toMatchObject({ vigente_desde: '2026-09-01', vigente_ate: '2026-09-15' })
    const esperadas: Array<[string, string | undefined]> = [
      ['aDaJanelaNova1', nova?.id],
      ['aDaJanelaNova2', nova?.id],
      ['aDaJanelaMorta1', morta?.id],
      ['aDaJanelaMorta2', morta?.id],
    ]
    for (const [nome, licencaId] of esperadas) expect(licencaDoCaso(daA, nome), nome).toBe(licencaId)
    // O próprio não ganha licença.
    expect(licencaDoCaso(daA, 'aProprioSemSerie')).toBeNull()
    const semLicenca = await scratch.query("select count(*)::int as total from material where titularidade = 'terceiro_com_licenca' and licenca_id is null")
    expect(semLicenca.rows[0]).toEqual({ total: 0 })
  })

  it('o licenciante escrito de dois jeitos é dois licenciantes: cada grafia ganha a sua licença, como na 0053', async () => {
    const daE = await linhasDa(e.id)
    const licencas = await licencasDa(e.id)
    expect(licencas.map((licencaDaEscola) => licencaDaEscola.licenciante).toSorted()).toEqual(['EDITORA X', 'Editora X'])
    expect(daE.get(casos['eGrafiaUm'] ?? '')?.licenciante_da_licenca).toBe('Editora X')
    expect(daE.get(casos['eGrafiaDois'] ?? '')?.licenciante_da_licenca).toBe('EDITORA X')
    expect(licencaDoCaso(daE, 'eGrafiaUm')).not.toBe(licencaDoCaso(daE, 'eGrafiaDois'))
  })

  it('a licença registrada com começo depois do envio é a escolhida: o material a ela se liga, e nenhuma licença nova nasce (o resultado é o do bloco 2 do runbook)', async () => {
    const daF = await linhasDa(f.id)
    expect(await licencasDa(f.id)).toHaveLength(1)
    expect(licencaDoCaso(daF, 'fDaJanelaAntesDaLicenca')).toBe(casos['fLicencaComecaDepois'])
  })

  it('não cruza escola: o material da B só tem licença da B, e a da A com o mesmo licenciante não o alcança', async () => {
    const daB = await linhasDa(b.id)
    const doTerceiroDaB = daB.get(casos['bDaJanela'] ?? '')
    const licencasDaB = await licencasDa(b.id)
    expect(licencasDaB).toHaveLength(1)
    expect(licencasDaB[0]).toMatchObject({ licenciante: 'Editora X', referencia: 'registrada na contração da F4' })
    expect(doTerceiroDaB?.licenca_id).toBe(licencasDaB[0]?.id)
    expect(doTerceiroDaB?.licenca_id).not.toBe(licencaDaAEditoraX)
    // Em nenhuma escola um material aponta licença de outra.
    const cruzados = await scratch.query('select count(*)::int as total from material m join licenca_de_material l on l.id = m.licenca_id where l.escola_id <> m.escola_id')
    expect(cruzados.rows[0]).toEqual({ total: 0 })
  })

  it('mais de um lote de 5.000: as 5.100 linhas da escola C apontam a mesma licença, e nenhuma ficou sem', async () => {
    const licencasDaC = await licencasDa(c.id)
    expect(licencasDaC).toHaveLength(1)
    expect(licencasDaC[0]).toMatchObject({ licenciante: 'Editora Z', vigente_ate: null })
    const { rows } = await scratch.query<{ total: number; com_a_licenca: number }>('select count(*)::int as total, count(*) filter (where licenca_id = $2)::int as com_a_licenca from material where escola_id = $1', [c.id, licencasDaC[0]?.id])
    expect(rows[0]).toEqual({ total: 5100, com_a_licenca: 5100 })
    // As séries: os 5.100 materiais da escola C ganharam as duas da escola, em mais de um lote.
    const series = await scratch.query<{ total: number; sem_serie: number }>(
      `select count(*)::int as total, count(*) filter (where not exists (select 1 from material_serie s where s.escola_id = m.escola_id and s.material_id = m.id))::int as sem_serie from material m where m.escola_id = $1`,
      [c.id],
    )
    expect(series.rows[0]).toEqual({ total: 5100, sem_serie: 0 })
    expect((await scratch.query<{ total: number }>('select count(*)::int as total from material_serie where escola_id = $1', [c.id])).rows[0]).toEqual({ total: 10_200 })
  })

  it('as séries: o material da janela ganha todas as da escola dele, nunca as de outra; o que já tinha série fica; a escola sem série deixa o material sem linha', async () => {
    const daA = await linhasDa(a.id)
    for (const nome of ['aProprioSemSerie', 'aDaJanelaNova1']) expect(seriesDoCaso(daA, nome), nome).toEqual(a.series.toSorted())
    // O que já tinha série não ganha outra.
    expect(seriesDoCaso(daA, 'aJaLigado')).toEqual([a.series[0]])
    expect(seriesDoCaso(daA, 'aProprioComSerie')).toEqual([a.series[1]])
    expect(seriesDoCaso(await linhasDa(b.id), 'bProprioSemSerie')).toEqual(b.series)
    expect(seriesDoCaso(await linhasDa(d.id), 'dProprioSemSerie')).toEqual([])
    const deOutraEscola = await scratch.query('select count(*)::int as total from material_serie ms join serie s on s.id = ms.serie_id where s.escola_id <> ms.escola_id')
    expect(deOutraEscola.rows[0]).toEqual({ total: 0 })
  })

  it('o backfill duas vezes dá o mesmo resultado: as instruções da própria migration, de novo, não criam licença, nem série, nem mudam o que aponta', async () => {
    const retrato = async () => ({
      licencas: (await scratch.query('select id, escola_id, licenciante, referencia, vigente_desde::text, vigente_ate::text from licenca_de_material order by id')).rows,
      series: (await scratch.query('select escola_id, material_id, serie_id from material_serie order by material_id, serie_id')).rows,
      ligacoes: (await scratch.query('select id, licenca_id from material order by id')).rows,
    })
    const antes = await retrato()
    // Só o backfill: as instruções de `DO`, de `INSERT` e de `UPDATE`; o `SET` e os checks não se repetem.
    const sql = readFileSync(join(PASTA_MIGRACOES, `${DA_CONTRACAO}.sql`), 'utf8')
    const backfill = sql.split('--> statement-breakpoint').map((instrucao) => instrucao.replace(/^(--[^\n]*\n)+/, '').trim()).filter((instrucao) => /^(DO|INSERT)\b/.test(instrucao))
    expect(backfill).toHaveLength(3)
    await scratch.query('begin')
    for (const instrucao of backfill) await scratch.query(instrucao)
    await scratch.query('commit')
    expect(await retrato()).toEqual(antes)
  })

  it('o check: terceiro sem licença é recusado, e o próprio com licença também; cada lado da igualdade tem o seu', async () => {
    const recusa = (promessa: Promise<unknown>) => promessa.then(() => 'aceitou', (erro: { constraint?: string }) => erro.constraint)
    const inserir = (titularidade: string, licencaId: string | null) =>
      scratch.query(
        `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, licenca_id, declaracao, sha256, tamanho_bytes, estado)
         values ($1, $2, 'Do check', $3, 'licenca_comercial_autorizada', $4, true, md5(random()::text) || md5(random()::text), 1000, 'processando')`,
        [a.id, a.disciplinaId, titularidade, licencaId],
      )
    // Um lado: de terceiro, sem licença. O outro: própria da escola, com licença.
    expect(await recusa(inserir('terceiro_com_licenca', null))).toBe(CHECK)
    expect(await recusa(inserir('escola', licencaDaAEditoraX))).toBe(CHECK)
    expect(await recusa(inserir('terceiro_com_licenca', licencaDaAEditoraX))).toBe('aceitou')
    expect(await recusa(inserir('escola', null))).toBe('aceitou')
    // O check terminou validado: o `VALIDATE` varreu as linhas que já existiam.
    expect((await scratch.query('select convalidated from pg_constraint where conname = $1 and conrelid = $2::regclass', [CHECK, 'material'])).rows).toEqual([{ convalidated: true }])
  })

  it('saem os dois checks de `licenciante`, e a coluna fica no banco para o `DROP COLUMN` do deploy seguinte', async () => {
    const { rows } = await scratch.query<{ conname: string }>("select conname from pg_constraint where conrelid = 'material'::regclass and conname like 'material_licenciante%'")
    expect(rows).toEqual([])
    const coluna = await scratch.query("select 1 from information_schema.columns where table_schema = 'public' and table_name = 'material' and column_name = 'licenciante'")
    expect(coluna.rowCount).toBe(1)
  })

  it('a versão anterior do código segue escrevendo com o schema novo: o terceiro com `licenca_id` e `licenciante`, o próprio sem nenhum dos dois, e o terceiro sem o `licenciante` (o código de hoje)', async () => {
    const gravar = (titularidade: string, licenciante: string | null, licencaId: string | null) =>
      scratch.query(
        `insert into material (escola_id, disciplina_id, titulo, titularidade, licenciante, licenca, licenca_id, declaracao, sha256, tamanho_bytes, estado)
         values ($1, $2, 'Da versão anterior', $3, $4, 'licenca_comercial_autorizada', $5, true, md5(random()::text) || md5(random()::text), 1000, 'processando')`,
        [a.id, a.disciplinaId, titularidade, licenciante, licencaId],
      )
    await expect(gravar('terceiro_com_licenca', 'Editora X', licencaDaAEditoraX)).resolves.toBeDefined()
    await expect(gravar('escola', null, null)).resolves.toBeDefined()
    await expect(gravar('terceiro_com_licenca', null, licencaDaAEditoraX)).resolves.toBeDefined()
  })

  it('a volta ao código da F4 (anterior à 9.0), que lê o licenciante da linha: o material que o código novo gravou sem ele, depois do bloco do runbook, traz o licenciante da licença, e só o de terceiro', async () => {
    const lerComoOCodigoDaF4 = async (materialId: string) =>
      (await scratch.query<{ licenciante: string | null }>('select licenciante from material where id = $1', [materialId])).rows[0]?.licenciante
    // Como o código da 9.0 grava: o terceiro com `licenca_id` e sem `licenciante` (o banco o aceita, o check está de pé), e o próprio sem nenhum dos dois.
    const doTerceiro = await material(a, { licenciante: 'Editora X', licencaId: licencaDaAEditoraX, enviadoEm: '2026-11-01T12:00:00Z' })
    const doProprio = await material(a, { enviadoEm: '2026-11-02T12:00:00Z' })
    await scratch.query('update material set licenciante = null where id = $1', [doTerceiro])
    expect(await lerComoOCodigoDaF4(doTerceiro)).toBeNull()

    await scratch.query(`begin; ${blocoDoRunbook('volta ao código da F4')}; commit`)

    expect(await lerComoOCodigoDaF4(doTerceiro)).toBe('Editora X')
    expect(await lerComoOCodigoDaF4(doProprio)).toBeNull()
    const check = await scratch.query("select convalidated from pg_constraint where conname = $1 and conrelid = 'material'::regclass", [CHECK])
    expect(check.rows[0]).toEqual({ convalidated: true })
  })

  it('o schema do Drizzle e a migration dizem o mesmo check: a expressão que o `drizzle-kit` leva ao snapshot é a que a 0065 cria, e a coluna `licenciante` não está mais no schema', () => {
    const { checks, columns } = getTableConfig(tabelaDoMaterial)
    const doSchema = checks.find((check) => check.name === CHECK)
    expect(doSchema, 'o schema declara o check').toBeDefined()
    const expressao = new PgDialect({ casing: 'snake_case' }).sqlToQuery(doSchema?.value as never).sql
    expect(readFileSync(join(PASTA_MIGRACOES, `${DA_CONTRACAO}.sql`), 'utf8')).toContain(`CHECK (${expressao})`)
    expect(columns.map((coluna) => coluna.name)).not.toContain('licenciante')
    expect(checks.map((check) => check.name).filter((nome) => nome.startsWith('material_licenciante'))).toEqual([])
  })
})
