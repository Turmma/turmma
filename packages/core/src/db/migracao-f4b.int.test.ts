import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { createLogger } from '../log/logger.js'
import { planejarSecoes, type CapituloGravado } from '../material/secoes.js'
import { migrate, PASTA_MIGRACOES, type MigrationConfig } from './migrate.js'

/**
 * As migrations `0060_secao_do_material` e `0061_secao_do_material_backfill` (classificacao-bncc, tarefa 2.0; Tech Spec, seção 3, "Migrations", passo 2) sobre dado que já existia: um banco só para este teste, migrado até a
 * 0059 (o que a 1.0 deixou), com material `pronto` com e sem capítulo, excluído, `processando` e `falhou`, em duas escolas, e depois migrado até a 0061 pelo mesmo `migrate` do serviço de migração. Prova que a migration só
 * expande, que cada material `pronto` e não excluído ganha as seções que `planejarSecoes` daria (uma por capítulo, ou um bloco por 10 páginas), sem execução, que o lote menor que o número de materiais e a segunda
 * rodada dão o mesmo resultado sem duplicar, e as travas de banco da seção (a eliminação da coordenação, a execução expurgada, os índices).
 */

const ULTIMA_DA_1_0 = '0059_habilidade_bncc'
const ULTIMA_DA_2_0 = '0061_secao_do_material_backfill'
const LOTE_PEQUENO = 3

const logger = createLogger({ servico: 'migrar-f4b-teste', nivel: 'silent' })

describe('as migrations das seções sobre dado da F4', () => {
  const nomeDoBanco = `f4b_migracao_${Date.now()}`
  const urlDoTeste = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoTeste)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoTeste.toString() })
  const scratch = new pg.Client({ connectionString: urlDoScratch.toString() })
  const pastas: string[] = []

  const configuracao = (pasta: string): MigrationConfig => ({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 120_000, pasta })

  /** A pasta de migrations só até `tag` (inclusive): copia a do repositório e tira do diário, e da pasta, o que vem depois. */
  function pastaAte(tag: string): string {
    const pasta = mkdtempSync(join(tmpdir(), 'educa-migrar-f4b-'))
    pastas.push(pasta)
    cpSync(PASTA_MIGRACOES, pasta, { recursive: true })
    const diario = JSON.parse(readFileSync(join(pasta, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> }
    const indice = diario.entries.findIndex((entrada) => entrada.tag === tag)
    expect(indice, `${tag} está no diário`).toBeGreaterThan(0)
    const depoisDela = diario.entries.slice(indice + 1)
    writeFileSync(join(pasta, 'meta', '_journal.json'), JSON.stringify({ ...diario, entries: diario.entries.slice(0, indice + 1) }))
    for (const entrada of depoisDela) rmSync(join(pasta, `${entrada.tag}.sql`))
    expect(readdirSync(pasta).filter((arquivo) => arquivo.endsWith('.sql')).at(-1)).toBe(`${tag}.sql`)
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
    const { rows } = await scratch.query<{ table_name: string; column_name: string }>("select table_name, column_name from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position")
    const tabelas = [...new Set(rows.map((linha) => linha.table_name))]
    const linhas: Record<string, number> = {}
    for (const tabela of tabelas) linhas[tabela] = Number((await scratch.query<{ total: string }>(`select count(*) as total from "${tabela}"`)).rows[0]?.total)
    return { colunas: rows.map((linha) => `${linha.table_name}.${linha.column_name}`), linhas }
  }

  interface CapituloSemeado {
    readonly numero: number | null
    readonly titulo: string
    readonly paginaInicial: number
    readonly paginaFinal: number
  }

  interface MaterialSemeado {
    readonly id: string
    readonly escolaId: string
    readonly paginas: number | null
    readonly capitulos: readonly CapituloSemeado[]
    /** O que a migration deve fazer com ele: ganha as seções, ou fica sem. */
    readonly ganha: boolean
  }

  let contador = 0
  async function material(escolaId: string, disciplinaId: string, caso: { estado: 'pronto' | 'processando' | 'falhou'; paginas: number | null; excluido?: boolean; capitulos?: readonly CapituloSemeado[] }): Promise<MaterialSemeado> {
    contador += 1
    const materialId = await id(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, falha, excluido_em, objeto_apagado_em)
       values ($1, $2, $3, 'escola', 'autoria_da_escola', true, md5($4::text) || md5($4::text || 'x'), 1000, $5, $6, $7, $8::timestamptz, now()) returning id`,
      [escolaId, disciplinaId, `Material ${String(contador)}`, String(contador), caso.estado, caso.paginas, caso.estado === 'falhou' ? 'sem_texto' : null, caso.excluido === true ? '2026-09-01T12:00:00Z' : null],
    )
    const capitulos = caso.capitulos ?? []
    for (const [indice, capitulo] of capitulos.entries()) {
      await scratch.query('insert into capitulo_do_material (escola_id, material_id, ordem, numero, titulo, pagina_inicial, pagina_final) values ($1, $2, $3, $4, $5, $6, $7)', [
        escolaId,
        materialId,
        indice + 1,
        capitulo.numero,
        capitulo.titulo,
        capitulo.paginaInicial,
        capitulo.paginaFinal,
      ])
    }
    return { id: materialId, escolaId, paginas: caso.paginas, capitulos, ganha: caso.estado === 'pronto' && caso.excluido !== true }
  }

  const TRES_CAPITULOS: readonly CapituloSemeado[] = [
    { numero: 1, titulo: 'Mol e massa molar', paginaInicial: 1, paginaFinal: 2 },
    { numero: 2, titulo: 'Reações químicas', paginaInicial: 3, paginaFinal: 4 },
    { numero: null, titulo: 'Soluções', paginaInicial: 5, paginaFinal: 6 },
  ]

  interface Dados {
    readonly escolaA: string
    readonly escolaB: string
    readonly materiais: Record<string, MaterialSemeado>
  }

  /** Dado como a F4 o deixou: material `pronto` com capítulo, sem capítulo (1, 10, 25 páginas), os que não ganham seção, e mais `pronto` que o lote pequeno. */
  async function semearDadoDaF4(): Promise<Dados> {
    const rede = await id("insert into rede (nome, tipo) values ('Rede da migração', 'independente') returning id", [])
    const escola = (slug: string) => id('insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id', [rede, `Escola ${slug}`, slug])
    const escolaA = await escola('lida-a')
    const escolaB = await escola('lida-b')
    const disciplina = (escolaId: string) => id("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escolaId])
    const [quimicaA, quimicaB] = [await disciplina(escolaA), await disciplina(escolaB)]
    const materiais: Record<string, MaterialSemeado> = {
      aComCapitulos: await material(escolaA, quimicaA, { estado: 'pronto', paginas: 6, capitulos: TRES_CAPITULOS }),
      aSemCapitulo25: await material(escolaA, quimicaA, { estado: 'pronto', paginas: 25 }),
      aUmaPagina: await material(escolaA, quimicaA, { estado: 'pronto', paginas: 1 }),
      aDezPaginas: await material(escolaA, quimicaA, { estado: 'pronto', paginas: 10 }),
      aComCapituloSoNoMeio: await material(escolaA, quimicaA, { estado: 'pronto', paginas: 8, capitulos: [{ numero: 1, titulo: 'Só este', paginaInicial: 3, paginaFinal: 8 }] }),
      aExcluido: await material(escolaA, quimicaA, { estado: 'pronto', paginas: 12, excluido: true }),
      // O `processando` e o `falhou` com páginas: só o filtro por estado os deixa sem seção (na prática não têm página, e o filtro é a defesa).
      aProcessando: await material(escolaA, quimicaA, { estado: 'processando', paginas: 12 }),
      aFalhou: await material(escolaA, quimicaA, { estado: 'falhou', paginas: 12 }),
      bComCapitulos: await material(escolaB, quimicaB, { estado: 'pronto', paginas: 6, capitulos: TRES_CAPITULOS }),
      bSemCapitulo: await material(escolaB, quimicaB, { estado: 'pronto', paginas: 11 }),
    }
    // Mais `pronto` na escola A: o lote pequeno (3) precisa de vários laços para os 13 que ganham seção.
    for (let n = 1; n <= 3; n += 1) materiais[`aEmMassa${String(n)}`] = await material(escolaA, quimicaA, { estado: 'pronto', paginas: 12 })
    return { escolaA, escolaB, materiais }
  }

  interface SecaoLida {
    readonly material_id: string
    readonly escola_id: string
    readonly capitulo_id: string | null
    readonly ordem: number
    readonly pagina_inicial: number
    readonly pagina_final: number
    readonly execucao_id: string | null
    readonly falhas_seguidas: number
    readonly classificada_em: Date | null
    readonly corrigida_em: Date | null
    readonly corrigida_por: string | null
  }

  const lerSecoes = async (): Promise<SecaoLida[]> =>
    (
      await scratch.query<SecaoLida>(
        `select s.material_id, s.escola_id, s.capitulo_id, s.ordem, s.pagina_inicial, s.pagina_final, s.execucao_id, s.falhas_seguidas, s.classificada_em, s.corrigida_em, s.corrigida_por
         from secao_do_material s join material m on m.escola_id = s.escola_id and m.id = s.material_id where m.titulo like 'Material %' order by s.material_id, s.ordem`,
      )
    ).rows

  /** O que `planejarSecoes` daria para o material, com os capítulos como o banco os guarda (o id é o que a seção cita). */
  async function esperadas(semeado: MaterialSemeado): Promise<Array<{ ordem: number; capitulo: boolean; paginaInicial: number; paginaFinal: number }>> {
    const { rows } = await scratch.query<{ id: string; ordem: number; numero: number | null; titulo: string; pagina_inicial: number; pagina_final: number }>(
      'select id, ordem, numero, titulo, pagina_inicial, pagina_final from capitulo_do_material where escola_id = $1 and material_id = $2 order by ordem',
      [semeado.escolaId, semeado.id],
    )
    const capitulos: CapituloGravado[] = rows.map((linha) => ({ id: linha.id, ordem: linha.ordem, numero: linha.numero, titulo: linha.titulo, paginaInicial: linha.pagina_inicial, paginaFinal: linha.pagina_final }))
    return planejarSecoes(semeado.paginas ?? 0, capitulos).map(({ capituloId, ordem, paginaInicial, paginaFinal }) => ({ ordem, capitulo: capituloId !== null, paginaInicial, paginaFinal }))
  }

  const comoPlanejado = (linhas: readonly SecaoLida[]) => linhas.map((lida) => ({ ordem: lida.ordem, capitulo: lida.capitulo_id !== null, paginaInicial: lida.pagina_inicial, paginaFinal: lida.pagina_final }))

  /** A 0061 com o lote trocado pelo pequeno, rodada numa transação (o `SET LOCAL` da migration precisa dela). */
  async function rodarOBackfillComLote(lote: number | null): Promise<void> {
    const original = readFileSync(join(PASTA_MIGRACOES, `${ULTIMA_DA_2_0}.sql`), 'utf8')
    const injetado = lote === null ? original : original.replace('lote integer := 1000;', `lote integer := ${String(lote)};`)
    if (lote !== null) expect(injetado, 'o lote da migration é a variável `lote`').not.toBe(original)
    await scratch.query('begin')
    try {
      for (const instrucao of injetado.split('--> statement-breakpoint')) await scratch.query(instrucao)
      await scratch.query('commit')
    } catch (erro) {
      await scratch.query('rollback')
      throw erro
    }
  }

  let dados: Dados
  let antes: Awaited<ReturnType<typeof retrato>>
  let depois: Awaited<ReturnType<typeof retrato>>
  let secoesDaMigration: SecaoLida[]

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate(configuracao(pastaAte(ULTIMA_DA_1_0)), logger)
    await scratch.connect()
    dados = await semearDadoDaF4()
    antes = await retrato()
    await migrate(configuracao(pastaAte(ULTIMA_DA_2_0)), logger)
    depois = await retrato()
    secoesDaMigration = await lerSecoes()
  }, 240_000)

  afterAll(async () => {
    await scratch.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
    for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
  })

  const secoesDe = (linhas: readonly SecaoLida[], semeado: MaterialSemeado | undefined): SecaoLida[] => linhas.filter((lida) => lida.material_id === semeado?.id)

  it('só expande: nenhuma coluna nem linha some, e as duas tabelas novas são a única diferença de colunas', () => {
    for (const coluna of antes.colunas) expect(depois.colunas, coluna).toContain(coluna)
    expect(depois.colunas.filter((coluna) => !antes.colunas.includes(coluna)).map((coluna) => coluna.split('.')[0])).toSatisfy((tabelas: string[]) => tabelas.every((tabela) => tabela === 'secao_do_material' || tabela === 'habilidade_da_secao'))
    for (const [tabela, total] of Object.entries(antes.linhas)) expect(depois.linhas[tabela], tabela).toBe(total)
    expect(depois.linhas['habilidade_da_secao']).toBe(0)
  })

  it('cada `pronto` não excluído ganha as seções que `planejarSecoes` daria: uma por capítulo, ou um bloco por 10 páginas, na escola do material e na ordem', async () => {
    for (const [nome, semeado] of Object.entries(dados.materiais)) {
      if (!semeado.ganha) continue
      const lidas = secoesDe(secoesDaMigration, semeado)
      expect(comoPlanejado(lidas), nome).toEqual(await esperadas(semeado))
      for (const lida of lidas) expect(lida.escola_id, nome).toBe(semeado.escolaId)
    }
    // Os casos de que o teste depende existem de verdade: capítulos, bloco por 10 páginas, o último com as que sobram, e a página antes do capítulo 1 sem seção.
    expect(comoPlanejado(secoesDe(secoesDaMigration, dados.materiais['aSemCapitulo25']))).toEqual([
      { ordem: 1, capitulo: false, paginaInicial: 1, paginaFinal: 10 },
      { ordem: 2, capitulo: false, paginaInicial: 11, paginaFinal: 20 },
      { ordem: 3, capitulo: false, paginaInicial: 21, paginaFinal: 25 },
    ])
    expect(comoPlanejado(secoesDe(secoesDaMigration, dados.materiais['aComCapitulos'])).map((lida) => lida.capitulo)).toEqual([true, true, true])
    expect(comoPlanejado(secoesDe(secoesDaMigration, dados.materiais['aComCapituloSoNoMeio']))).toEqual([{ ordem: 1, capitulo: true, paginaInicial: 3, paginaFinal: 8 }])
    expect(comoPlanejado(secoesDe(secoesDaMigration, dados.materiais['aDezPaginas']))).toEqual([{ ordem: 1, capitulo: false, paginaInicial: 1, paginaFinal: 10 }])
  })

  it('as seções nascem sem execução, sem falha, sem classificação e sem correção: a rotina das 19h as agenda', () => {
    expect(secoesDaMigration.length).toBeGreaterThan(0)
    for (const lida of secoesDaMigration) expect(lida).toMatchObject({ execucao_id: null, falhas_seguidas: 0, classificada_em: null, corrigida_em: null, corrigida_por: null })
  })

  it('o excluído e o `processando` ficam sem seção, um caso cada, e o `falhou` também', () => {
    expect(secoesDe(secoesDaMigration, dados.materiais['aExcluido'])).toEqual([])
    expect(secoesDe(secoesDaMigration, dados.materiais['aProcessando'])).toEqual([])
    expect(secoesDe(secoesDaMigration, dados.materiais['aFalhou'])).toEqual([])
  })

  it('o material da B ganha as dele, e as da A nunca apontam material da B (a junção é pela escola)', () => {
    expect(secoesDe(secoesDaMigration, dados.materiais['bComCapitulos'])).toHaveLength(3)
    expect(secoesDe(secoesDaMigration, dados.materiais['bSemCapitulo'])).toHaveLength(2)
    for (const lida of secoesDaMigration) {
      const dono = Object.values(dados.materiais).find((semeado) => semeado.id === lida.material_id)
      expect(lida.escola_id).toBe(dono?.escolaId)
    }
  })

  it('o lote menor que o número de materiais (3, com 13 a migrar) e a segunda rodada dão o mesmo resultado, sem duplicar', async () => {
    const referencia = await lerSecoes()
    await scratch.query("delete from secao_do_material where material_id in (select id from material where titulo like 'Material %')")
    expect(await lerSecoes()).toEqual([])

    await rodarOBackfillComLote(LOTE_PEQUENO)
    const comLotePequeno = await lerSecoes()
    expect(comoPlanejado(comLotePequeno)).toEqual(comoPlanejado(referencia))
    expect(comLotePequeno.map((lida) => [lida.material_id, lida.ordem])).toEqual(referencia.map((lida) => [lida.material_id, lida.ordem]))

    await rodarOBackfillComLote(LOTE_PEQUENO)
    expect((await lerSecoes()).map((lida) => [lida.material_id, lida.ordem])).toEqual(referencia.map((lida) => [lida.material_id, lida.ordem]))
    // O lote da migration real: com 1.000 e tudo já migrado, também não muda nada.
    await rodarOBackfillComLote(null)
    expect(await lerSecoes()).toHaveLength(referencia.length)
  })

  it('o material `pronto` que a extração nova já deu seção não ganha de novo: a seção dele fica como está, com a correção e a execução', async () => {
    const semeado = dados.materiais['aDezPaginas']
    const secaoId = await id('select id from secao_do_material where escola_id = $1 and material_id = $2', [semeado?.escolaId, semeado?.id])
    await scratch.query("update secao_do_material set corrigida_em = '2026-10-01T15:00:00Z', falhas_seguidas = 2 where id = $1", [secaoId])
    await rodarOBackfillComLote(LOTE_PEQUENO)
    const { rows } = await scratch.query<{ corrigida_em: Date | null; falhas_seguidas: number }>('select corrigida_em, falhas_seguidas from secao_do_material where material_id = $1', [semeado?.id])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.falhas_seguidas).toBe(2)
    expect(rows[0]?.corrigida_em?.toISOString()).toBe('2026-10-01T15:00:00.000Z')
  })

  it('os três índices começam pela escola, e o da execução é parcial', async () => {
    const { rows } = await scratch.query<{ indexname: string; indexdef: string }>(
      "select indexname, indexdef from pg_indexes where schemaname = 'public' and indexname in ('secao_do_material_pagina_idx', 'secao_do_material_execucao_idx', 'habilidade_da_secao_codigo_idx') order by indexname",
    )
    expect(rows.map((linha) => linha.indexname)).toEqual(['habilidade_da_secao_codigo_idx', 'secao_do_material_execucao_idx', 'secao_do_material_pagina_idx'])
    expect(rows[0]?.indexdef).toMatch(/\(escola_id, codigo\)/)
    expect(rows[1]?.indexdef).toMatch(/\(escola_id, execucao_id\) WHERE \(?execucao_id IS NOT NULL\)?/)
    expect(rows[2]?.indexdef).toMatch(/\(escola_id, material_id, pagina_inicial\)/)
  })

  it('o `corrigida_por` vira nulo com a eliminação da pessoa, sem anular a escola da seção, e a marca da correção fica (`on delete set null ("corrigida_por")`)', async () => {
    const conta = await id("insert into conta (email) values ('coordenacao@lida.invalid') returning id", [])
    const coordenacao = await id("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'coordenador', 'Coordenação') returning id", [dados.escolaB, conta])
    const semeado = dados.materiais['bSemCapitulo']
    const secaoId = await id('select id from secao_do_material where escola_id = $1 and material_id = $2 order by ordem limit 1', [dados.escolaB, semeado?.id])
    await scratch.query("update secao_do_material set corrigida_em = '2026-10-02T10:00:00Z', corrigida_por = $2 where id = $1", [secaoId, coordenacao])

    await scratch.query('delete from usuario where id = $1', [coordenacao])

    const { rows } = await scratch.query<{ escola_id: string; corrigida_por: string | null; corrigida_em: Date | null }>('select escola_id, corrigida_por, corrigida_em from secao_do_material where id = $1', [secaoId])
    expect(rows[0]).toMatchObject({ escola_id: dados.escolaB, corrigida_por: null })
    expect(rows[0]?.corrigida_em?.toISOString()).toBe('2026-10-02T10:00:00.000Z')
  })

  it('o `corrigida_por` sem `corrigida_em` é recusado: a autoria só existe com a marca da correção', async () => {
    const conta = await id("insert into conta (email) values ('outra@lida.invalid') returning id", [])
    const coordenacao = await id("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'coordenador', 'Outra') returning id", [dados.escolaB, conta])
    const secaoId = await id('select id from secao_do_material where escola_id = $1 and material_id = $2 order by ordem desc limit 1', [dados.escolaB, dados.materiais['bSemCapitulo']?.id])
    await expect(scratch.query('update secao_do_material set corrigida_por = $2 where id = $1', [secaoId, coordenacao])).rejects.toMatchObject({ code: '23514', constraint: 'secao_do_material_corrigida_por_so_na_corrigida' })
  })

  it.each([
    ['página final antes da inicial', { ordem: 90, inicial: 5, final: 4 }, 'secao_do_material_paginas_validas'],
    ['página inicial zero', { ordem: 91, inicial: 0, final: 2 }, 'secao_do_material_paginas_validas'],
    ['ordem zero', { ordem: 0, inicial: 1, final: 2 }, 'secao_do_material_ordem_valida'],
    ['ordem repetida no material', { ordem: 1, inicial: 1, final: 2 }, 'secao_do_material_ordem_unica'],
    ['falhas seguidas negativas', { ordem: 92, inicial: 1, final: 2, falhas: -1 }, 'secao_do_material_falhas_validas'],
  ] as const)('o check recusa %s', async (_caso, campos, restricao) => {
    const material = dados.materiais['bSemCapitulo']
    await expect(
      scratch.query('insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final, falhas_seguidas) values ($1, $2, $3, $4, $5, $6)', [
        dados.escolaB,
        material?.id,
        campos.ordem,
        campos.inicial,
        campos.final,
        'falhas' in campos ? campos.falhas : 0,
      ]),
    ).rejects.toMatchObject({ constraint: restricao })
  })

  it('o check da auditoria aceita a herança da classificação como `rotina` (sem pessoa) e continua recusando a aprovação de entrega', async () => {
    const comoRotina = (acao: string, entidade: string) =>
      scratch.query(
        `insert into auditoria (escola_id, autor_usuario_id, autor_operador, acao, entidade, entidade_id, requisicao_id)
         values ($1, null, 'rotina', $2, $3, gen_random_uuid(), gen_random_uuid())`,
        [dados.escolaA, acao, entidade],
      )
    await comoRotina('material.classificacao_herdada', 'material')
    await expect(comoRotina('entrega.decidida', 'entrega')).rejects.toMatchObject({ code: '23514', constraint: 'auditoria_rotina_so_nas_acoes' })
    await scratch.query("delete from auditoria where acao = 'material.classificacao_herdada'")
  })

  it('a execução expurgada anula só o `execucao_id` da seção, sem anular a escola (`on delete set null ("execucao_id")`)', async () => {
    const ano = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [dados.escolaB])
    const execucao = await id(
      `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, chave_envio, entrada)
       values ($1, $2, 'conversa_e_ferramentas', 'gerar_atividade_objetiva', gen_random_uuid(), '{"tarefa":"gerar_atividade_objetiva"}') returning id`,
      [dados.escolaB, ano],
    )
    const secaoId = await id('select id from secao_do_material where escola_id = $1 and material_id = $2 order by ordem limit 1', [dados.escolaB, dados.materiais['bComCapitulos']?.id])
    await scratch.query('update secao_do_material set execucao_id = $2 where id = $1', [secaoId, execucao])

    await scratch.query('delete from execucao_agente where id = $1', [execucao])

    const { rows } = await scratch.query<{ escola_id: string; execucao_id: string | null }>('select escola_id, execucao_id from secao_do_material where id = $1', [secaoId])
    expect(rows).toEqual([{ escola_id: dados.escolaB, execucao_id: null }])
  })

  it('a seção da A não aponta o capítulo nem o material da B: as duas FKs compostas recusam, uma por vez', async () => {
    const deA = dados.materiais['aComCapitulos']
    const capituloDaB = await id('select id from capitulo_do_material where escola_id = $1 and material_id = $2 order by ordem limit 1', [dados.escolaB, dados.materiais['bComCapitulos']?.id])
    const inserir = (escolaId: string, materialId: string | undefined, capituloId: string | null) =>
      scratch.query('insert into secao_do_material (escola_id, material_id, capitulo_id, ordem, pagina_inicial, pagina_final) values ($1, $2, $3, 77, 1, 2)', [escolaId, materialId, capituloId])
    await expect(inserir(dados.escolaA, deA?.id, capituloDaB)).rejects.toMatchObject({ code: '23503', constraint: 'secao_do_material_capitulo_da_escola_fk' })
    await expect(inserir(dados.escolaA, dados.materiais['bSemCapitulo']?.id, null)).rejects.toMatchObject({ code: '23503', constraint: 'secao_do_material_da_escola_fk' })
    // O mesmo insert com o material e o capítulo da própria escola entra: as duas recusas acima são da escola, não de outro defeito.
    await inserir(dados.escolaB, dados.materiais['bComCapitulos']?.id, capituloDaB)
    await scratch.query('delete from secao_do_material where ordem = 77')
  })

  it('a habilidade da seção: código fora da BNCC, origem fora de `ia` e `coordenacao` e o mesmo código duas vezes são recusados; dois códigos na mesma seção entram', async () => {
    const semeado = dados.materiais['aComCapitulos']
    const secaoId = await id('select id from secao_do_material where escola_id = $1 and material_id = $2 order by ordem limit 1', [semeado?.escolaId, semeado?.id])
    const inserir = (codigo: string, origem: string) => scratch.query('insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, $4)', [dados.escolaA, secaoId, codigo, origem])
    await expect(inserir('QUI.EM.05', 'ia')).rejects.toMatchObject({ code: '23503', constraint: 'habilidade_da_secao_codigo_habilidade_bncc_codigo_fk' })
    await expect(inserir('EM13CNT301', 'professor')).rejects.toMatchObject({ code: '23514', constraint: 'habilidade_da_secao_origem_valida' })
    await inserir('EM13CNT301', 'ia')
    await inserir('EM13CNT101', 'coordenacao')
    await expect(inserir('EM13CNT301', 'coordenacao')).rejects.toMatchObject({ code: '23505', constraint: 'habilidade_da_secao_pk' })
    await scratch.query('delete from habilidade_da_secao where secao_id = $1', [secaoId])
  })

  it('apagar o material leva as seções e as habilidades delas em cascata, e as do vizinho ficam', async () => {
    const novo = await material(dados.escolaA, await id("select id from disciplina where escola_id = $1 and nome = 'Química'", [dados.escolaA]), { estado: 'pronto', paginas: 15 })
    await rodarOBackfillComLote(null)
    const secaoId = await id('select id from secao_do_material where escola_id = $1 and material_id = $2 order by ordem limit 1', [dados.escolaA, novo.id])
    await scratch.query("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, 'EM13CNT301', 'ia')", [dados.escolaA, secaoId])
    const vizinhas = (await scratch.query('select 1 from secao_do_material where material_id = $1', [dados.materiais['aSemCapitulo25']?.id])).rowCount

    await scratch.query('delete from material where id = $1', [novo.id])

    expect((await scratch.query('select 1 from secao_do_material where material_id = $1', [novo.id])).rowCount).toBe(0)
    expect((await scratch.query('select 1 from habilidade_da_secao where secao_id = $1', [secaoId])).rowCount).toBe(0)
    expect((await scratch.query('select 1 from secao_do_material where material_id = $1', [dados.materiais['aSemCapitulo25']?.id])).rowCount).toBe(vizinhas)
  })
})
