import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { createLogger } from '../log/logger.js'
import { planejarSecoes, type CapituloGravado } from '../material/secoes.js'
import { migrate, PASTA_MIGRACOES, type MigrationConfig } from './migrate.js'

/**
 * A volta do código depois da classificacao-bncc 2.0 (tarefa 2.0; regra 80, item 9; `docs/runbook.md`, "Voltar o código depois da classificacao-bncc 2.0"). Um banco só para este teste, migrado até o fim, com o
 * que o código anterior grava depois da `0061`: material `pronto` (com e sem capítulo), excluído e `processando`, **sem seção**. O SQL que o teste roda **é o do runbook**, lido do bloco `-- volta-da-2-0`: o
 * procedimento que a pessoa de plantão copia é o que está provado. Prova que a seção nasce pela mesma conta de `planejarSecoes`, só onde deve, e que rodar de novo não duplica nem toca o que já existe.
 */

const logger = createLogger({ servico: 'volta-2-0-teste', nivel: 'silent' })
const RUNBOOK = join(fileURLToPath(new URL('../../../../docs/runbook.md', import.meta.url)))

/** O bloco de SQL do runbook que abre com `-- volta-da-2-0: <nome>`. */
function blocoDoRunbook(nome: string): string {
  const texto = readFileSync(RUNBOOK, 'utf8')
  const achado = new RegExp('```sql\\n-- volta-da-2-0: ' + nome + '[^\\n]*\\n([\\s\\S]*?)```').exec(texto)
  if (achado?.[1] === undefined) throw new Error(`o runbook não tem o bloco "volta-da-2-0: ${nome}"`)
  return achado[1]
}

describe('a volta do código depois da classificacao-bncc 2.0', () => {
  const nomeDoBanco = `bncc_volta_${Date.now()}`
  const urlDoTeste = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoTeste)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoTeste.toString() })
  const scratch = new pg.Client({ connectionString: urlDoScratch.toString() })
  const configuracao: MigrationConfig = { url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 120_000, pasta: PASTA_MIGRACOES }

  async function id(instrucao: string, valores: unknown[]): Promise<string> {
    const { rows } = await scratch.query<{ id: string }>(instrucao, valores)
    const linha = rows[0]
    if (linha === undefined) throw new Error('insert sem linha')
    return linha.id
  }

  interface Semeado {
    readonly id: string
    readonly escolaId: string
    readonly paginas: number | null
    readonly ganha: boolean
  }

  let contador = 0
  async function material(escolaId: string, disciplinaId: string, estado: 'pronto' | 'processando', paginas: number | null, opcoes: { excluido?: boolean; capitulos?: number } = {}): Promise<Semeado> {
    contador += 1
    const materialId = await id(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, excluido_em, objeto_apagado_em)
       values ($1, $2, $3, 'escola', 'autoria_da_escola', true, md5($4::text) || md5($4::text || 'x'), 1000, $5, $6, $7::timestamptz, now()) returning id`,
      [escolaId, disciplinaId, `Material ${String(contador)}`, String(contador), estado, paginas, opcoes.excluido === true ? '2026-09-01T12:00:00Z' : null],
    )
    for (let ordem = 1; ordem <= (opcoes.capitulos ?? 0); ordem += 1) {
      await scratch.query('insert into capitulo_do_material (escola_id, material_id, ordem, numero, titulo, pagina_inicial, pagina_final) values ($1, $2, $3::int, $3::int, $4, $5, $6)', [
        escolaId,
        materialId,
        ordem,
        `Capítulo ${String(ordem)}`,
        ordem * 2 - 1,
        ordem * 2,
      ])
    }
    return { id: materialId, escolaId, paginas, ganha: estado === 'pronto' && opcoes.excluido !== true }
  }

  const materiais: Record<string, Semeado> = {}
  let corrigidaEm: string

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate(configuracao, logger)
    await scratch.connect()
    const rede = await id("insert into rede (nome, tipo) values ('Rede da volta 2.0', 'independente') returning id", [])
    const escolaA = await id("insert into escola (rede_id, nome, slug) values ($1, 'Escola A', 'volta-bncc-a') returning id", [rede])
    const escolaB = await id("insert into escola (rede_id, nome, slug) values ($1, 'Escola B', 'volta-bncc-b') returning id", [rede])
    const quimicaA = await id("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escolaA])
    const quimicaB = await id("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escolaB])
    materiais['capitulos'] = await material(escolaA, quimicaA, 'pronto', 6, { capitulos: 3 })
    materiais['blocos25'] = await material(escolaA, quimicaA, 'pronto', 25)
    materiais['umaPagina'] = await material(escolaA, quimicaA, 'pronto', 1)
    materiais['excluido'] = await material(escolaA, quimicaA, 'pronto', 12, { excluido: true })
    materiais['processando'] = await material(escolaA, quimicaA, 'processando', 12)
    materiais['daEscolaB'] = await material(escolaB, quimicaB, 'pronto', 11)
    // Um `pronto` que já tem a seção (a extração nova a deu): o bloco não a toca nem dá outra.
    materiais['jaTem'] = await material(escolaA, quimicaA, 'pronto', 30)
    corrigidaEm = '2026-10-01T15:00:00.000Z'
    await scratch.query("insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final, falhas_seguidas, corrigida_em) values ($1, $2, 1, 1, 30, 2, $3)", [
      escolaA,
      materiais['jaTem']?.id,
      corrigidaEm,
    ])
  }, 240_000)

  afterAll(async () => {
    await scratch.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
  })

  const secoesDe = async (semeado: Semeado | undefined) =>
    (await scratch.query<{ escola_id: string; capitulo_id: string | null; ordem: number; pagina_inicial: number; pagina_final: number; execucao_id: string | null; falhas_seguidas: number }>(
      'select escola_id, capitulo_id, ordem, pagina_inicial, pagina_final, execucao_id, falhas_seguidas from secao_do_material where material_id = $1 order by ordem',
      [semeado?.id],
    )).rows

  async function esperadas(semeado: Semeado | undefined): Promise<Array<{ ordem: number; capitulo: boolean; paginaInicial: number; paginaFinal: number }>> {
    const { rows } = await scratch.query<{ id: string; ordem: number; numero: number | null; titulo: string; pagina_inicial: number; pagina_final: number }>(
      'select id, ordem, numero, titulo, pagina_inicial, pagina_final from capitulo_do_material where escola_id = $1 and material_id = $2 order by ordem',
      [semeado?.escolaId, semeado?.id],
    )
    const capitulos: CapituloGravado[] = rows.map((linha) => ({ id: linha.id, ordem: linha.ordem, numero: linha.numero, titulo: linha.titulo, paginaInicial: linha.pagina_inicial, paginaFinal: linha.pagina_final }))
    return planejarSecoes(semeado?.paginas ?? 0, capitulos).map(({ capituloId, ordem, paginaInicial, paginaFinal }) => ({ ordem, capitulo: capituloId !== null, paginaInicial, paginaFinal }))
  }

  const comoPlanejado = (linhas: Awaited<ReturnType<typeof secoesDe>>) => linhas.map((linha) => ({ ordem: linha.ordem, capitulo: linha.capitulo_id !== null, paginaInicial: linha.pagina_inicial, paginaFinal: linha.pagina_final }))

  async function rodarOBloco(): Promise<void> {
    await scratch.query('begin')
    try {
      await scratch.query(blocoDoRunbook('roll-forward'))
      await scratch.query('commit')
    } catch (erro) {
      await scratch.query('rollback')
      throw erro
    }
  }

  it('o `pronto` não excluído sem seção ganha a que `planejarSecoes` daria, na escola dele e sem execução; o excluído e o `processando` ficam sem', async () => {
    for (const nome of ['capitulos', 'blocos25', 'umaPagina', 'daEscolaB']) expect(await secoesDe(materiais[nome]), `${nome} antes`).toEqual([])

    await rodarOBloco()

    for (const nome of ['capitulos', 'blocos25', 'umaPagina', 'daEscolaB']) {
      const lidas = await secoesDe(materiais[nome])
      expect(comoPlanejado(lidas), nome).toEqual(await esperadas(materiais[nome]))
      expect(lidas.length, nome).toBeGreaterThan(0)
      for (const linha of lidas) expect(linha, nome).toMatchObject({ escola_id: materiais[nome]?.escolaId, execucao_id: null, falhas_seguidas: 0 })
    }
    expect(comoPlanejado(await secoesDe(materiais['blocos25']))).toEqual([
      { ordem: 1, capitulo: false, paginaInicial: 1, paginaFinal: 10 },
      { ordem: 2, capitulo: false, paginaInicial: 11, paginaFinal: 20 },
      { ordem: 3, capitulo: false, paginaInicial: 21, paginaFinal: 25 },
    ])
    expect(await secoesDe(materiais['excluido'])).toEqual([])
    expect(await secoesDe(materiais['processando'])).toEqual([])
  })

  it('rodar de novo não duplica nem toca o que já existe: a seção que a extração nova deu, com a correção e a falha, fica como está', async () => {
    const total = async () => Number((await scratch.query<{ n: string }>('select count(*) as n from secao_do_material')).rows[0]?.n)
    const antes = await total()
    expect(antes).toBeGreaterThan(0)

    await rodarOBloco()
    await rodarOBloco()

    expect(await total()).toBe(antes)
    const { rows } = await scratch.query<{ corrigida_em: Date | null; falhas_seguidas: number }>('select corrigida_em, falhas_seguidas from secao_do_material where material_id = $1', [materiais['jaTem']?.id])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.falhas_seguidas).toBe(2)
    expect(rows[0]?.corrigida_em?.toISOString()).toBe(corrigidaEm)
  })

  it('o material que o código anterior fecha como `pronto` depois do primeiro bloco ganha a seção no segundo, e só ele', async () => {
    const escolaA = materiais['capitulos']?.escolaId ?? ''
    const quimica = await id("select id from disciplina where escola_id = $1 and nome = 'Química'", [escolaA])
    const tardio = await material(escolaA, quimica, 'pronto', 12)
    const total = async () => Number((await scratch.query<{ n: string }>('select count(*) as n from secao_do_material')).rows[0]?.n)
    const antes = await total()

    await rodarOBloco()

    expect(comoPlanejado(await secoesDe(tardio))).toEqual([
      { ordem: 1, capitulo: false, paginaInicial: 1, paginaFinal: 10 },
      { ordem: 2, capitulo: false, paginaInicial: 11, paginaFinal: 12 },
    ])
    expect(await total()).toBe(antes + 2)
  })
})
