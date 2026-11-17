import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { createLogger } from '../log/logger.js'
import { migrate, PASTA_MIGRACOES, type MigrationConfig } from './migrate.js'

/**
 * A migration `0059_habilidade_bncc` (classificacao-bncc, tarefa 1.0; Tech Spec, seção 3; `cenarios.md`, "Tabela BNCC e componente") sobre dado que já existia: um banco só para este teste,
 * migrado até a 0058 (o que o código anterior conhece), com disciplinas de duas escolas, e depois até a 0059 pelo mesmo `migrate` do serviço de migração. Prova a carga (a contagem, a
 * idempotência, o `ON CONFLICT` que nunca apaga), o check do código e o componente que a migration dá às disciplinas de antes pelo nome.
 */

const ULTIMA_ANTES = '0058_fila_ferramenta'
const DA_BNCC = '0059_habilidade_bncc'

const logger = createLogger({ servico: 'migrar-bncc-teste', nivel: 'silent' })

interface Habilidade {
  readonly codigo: string
  readonly descricao: string
  readonly etapa: string
  readonly componente: string | null
  readonly area: string | null
  readonly anos: number[] | null
  readonly localizador: string
}
const dados = JSON.parse(readFileSync(join(PASTA_MIGRACOES, '../src/db/bncc/dados-2026.08.json'), 'utf8')) as { versao: string; habilidades: Habilidade[] }

const sql0059 = readFileSync(join(PASTA_MIGRACOES, `${DA_BNCC}.sql`), 'utf8')
const instrucoes = sql0059.split('--> statement-breakpoint')
const instrucaoDaCarga = instrucoes.find((instrucao) => instrucao.trimStart().startsWith('INSERT INTO "habilidade_bncc"')) ?? ''
const instrucaoDoCasamento = instrucoes.find((instrucao) => instrucao.trimStart().startsWith('UPDATE "disciplina"')) ?? ''
/** Tudo o que a migration faz com a tabela depois de criá-la (a carga e o que mais ela tenha): o teste da carga repete isso, e não só o `INSERT`. */
const instrucoesDaCarga = instrucoes.filter((instrucao) => instrucao.includes('"habilidade_bncc"') && !instrucao.includes('CREATE TABLE'))
const LITERAL = /\$bncc\$([\s\S]*)\$bncc\$/

/** A mesma instrução de carga da migration, com outro conjunto de habilidades no lugar do literal. */
const cargaCom = (habilidades: readonly unknown[]): string => instrucaoDaCarga.replace(LITERAL, () => `$bncc$${JSON.stringify(habilidades)}$bncc$`)
/** A migration inteira da carga, com outro conjunto de habilidades no lugar do literal. */
const cargaCompletaCom = (habilidades: readonly unknown[]): string[] => instrucoesDaCarga.map((instrucao) => (instrucao === instrucaoDaCarga ? cargaCom(habilidades) : instrucao))

describe('a migration da tabela da BNCC e do componente da disciplina', () => {
  const nomeDoBanco = `bncc_migracao_${String(Date.now())}`
  const urlDoTeste = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoTeste)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoTeste.toString() })
  const scratch = new pg.Client({ connectionString: urlDoScratch.toString() })
  const pastas: string[] = []
  let escolaA = ''
  let escolaB = ''

  const configuracao = (pasta: string): MigrationConfig => ({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 120_000, pasta })

  /** A pasta de migrations só até `tag` (inclusive): copia a do repositório e tira do diário, e da pasta, o que vem depois. */
  function pastaAte(tag: string): string {
    const pasta = mkdtempSync(join(tmpdir(), 'educa-migrar-bncc-'))
    pastas.push(pasta)
    cpSync(PASTA_MIGRACOES, pasta, { recursive: true })
    const diario = JSON.parse(readFileSync(join(pasta, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> }
    const indice = diario.entries.findIndex((entrada) => entrada.tag === tag)
    expect(indice, `${tag} está no diário`).toBeGreaterThan(0)
    writeFileSync(join(pasta, 'meta', '_journal.json'), JSON.stringify({ ...diario, entries: diario.entries.slice(0, indice + 1) }))
    for (const entrada of diario.entries.slice(indice + 1)) rmSync(join(pasta, `${entrada.tag}.sql`))
    return pasta
  }

  const novaEscola = async (slug: string): Promise<string> => {
    const rede = (await scratch.query<{ id: string }>("insert into rede (nome, tipo) values ($1, 'independente') returning id", [`Rede ${slug}`])).rows[0]?.id
    return (await scratch.query<{ id: string }>("insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id", [rede, `Escola ${slug}`, slug])).rows[0]?.id ?? ''
  }
  const criarDisciplina = (escolaId: string, nome: string) => scratch.query('insert into disciplina (escola_id, nome) values ($1, $2)', [escolaId, nome])
  const componentesDa = async (escolaId: string): Promise<Record<string, string | null>> =>
    Object.fromEntries((await scratch.query<{ nome: string; componente_bncc: string | null }>('select nome, componente_bncc from disciplina where escola_id = $1', [escolaId])).rows.map((linha) => [linha.nome, linha.componente_bncc]))
  const total = async (filtro = 'true'): Promise<number> => Number((await scratch.query<{ total: string }>(`select count(*) as total from habilidade_bncc where ${filtro}`)).rows[0]?.total)
  const habilidade = async (codigo: string) => (await scratch.query<Habilidade & { versao: string }>('select * from habilidade_bncc where codigo = $1', [codigo])).rows[0]

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate(configuracao(pastaAte(ULTIMA_ANTES)), logger)
    await scratch.connect()
    escolaA = await novaEscola('bncc-a')
    escolaB = await novaEscola('bncc-b')
    // O dado de antes: as escolas já tinham disciplinas, escritas de jeitos diferentes. Na A, "Química" e "química" colidiriam no índice único; por isso as variações têm acento, caixa e espaço de verdade.
    for (const nome of ['Química', 'QUIMICA', ' física ', 'Português', 'Projeto de Vida', 'Robótica', 'Educação   Física']) await criarDisciplina(escolaA, nome)
    for (const nome of ['Matemática', 'Robótica', 'Projeto de Vida']) await criarDisciplina(escolaB, nome)
    await migrate(configuracao(pastaAte(DA_BNCC)), logger)
  }, 240_000)

  afterAll(async () => {
    await scratch.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
    for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
  })

  it('a migration carrega as 913 habilidades (183 do Médio), toda linha com versão e localizador, e nada de Computação nem dos anos iniciais', async () => {
    expect(await total()).toBe(913)
    expect(await total("etapa = 'em'")).toBe(183)
    expect(await total("etapa = 'ef_anos_finais'")).toBe(730)
    expect(await total(`versao = '${dados.versao}' and localizador like 'página PDF %'`)).toBe(913)
    expect(await total("codigo ~ '^EF[0-9]{2}CO'")).toBe(0)
    expect(await total('anos is not null and not anos <@ array[6, 7, 8, 9]::smallint[]')).toBe(0)
    expect(await habilidade('EF69LP01')).toMatchObject({ etapa: 'ef_anos_finais', componente: 'lingua_portuguesa', area: null, anos: [6, 7, 8, 9] })
    expect(await habilidade('EM13CNT301')).toMatchObject({ etapa: 'em', area: 'ciencias_da_natureza', anos: null })
  })

  it('o literal da migration é o JSON versionado, habilidade por habilidade', () => {
    const literal = JSON.parse(LITERAL.exec(instrucaoDaCarga)?.[1] ?? '[]') as Habilidade[]
    expect(literal).toEqual(dados.habilidades)
  })

  it('a carga de novo dá a mesma contagem, e uma descrição mudada no JSON atualiza a linha sem criar outra', async () => {
    await scratch.query(instrucaoDaCarga)
    expect(await total()).toBe(913)
    expect(await total("etapa = 'em'")).toBe(183)

    const alterada = dados.habilidades.map((h) => (h.codigo === 'EF69LP01' ? { ...h, descricao: 'Descrição nova, para o teste.', localizador: 'página PDF 999' } : h))
    await scratch.query(cargaCom(alterada).replace("'dados-2026.08'", "'dados-2026.09'"))
    expect(await total()).toBe(913)
    expect(await habilidade('EF69LP01')).toMatchObject({ descricao: 'Descrição nova, para o teste.', localizador: 'página PDF 999', versao: 'dados-2026.09' })
    // A versão é a da carga inteira: a linha que não mudou de texto também passa a dizer de que release veio.
    expect(await total("versao = 'dados-2026.09'")).toBe(913)

    // E volta ao que o JSON diz: a carga da versão fixa restaura o texto.
    await scratch.query(instrucaoDaCarga)
    expect(await habilidade('EF69LP01')).toMatchObject({ versao: dados.versao, localizador: dados.habilidades.find((h) => h.codigo === 'EF69LP01')?.localizador })
  })

  it('o JSON com um código a menos não apaga o código: ele fica na tabela', async () => {
    for (const instrucao of cargaCompletaCom(dados.habilidades.filter((h) => h.codigo !== 'EM13MAT101' && h.codigo !== 'EF06CI01'))) await scratch.query(instrucao)
    expect(await total()).toBe(913)
    expect(await habilidade('EM13MAT101')).toBeDefined()
    expect(await habilidade('EF06CI01')).toBeDefined()
    await scratch.query(instrucaoDaCarga)
  })

  it('o check do código recusa `EF03CI03B`, `EF15AR01`, `EM13CNT3010` e `EF07LP01A`, um caso cada, e aceita `EF06CO01`: quem barra a Computação é a carga', async () => {
    const gravar = (codigo: string) =>
      scratch.query("insert into habilidade_bncc (codigo, descricao, etapa, componente, area, anos, versao, localizador) values ($1, 'texto', 'ef_anos_finais', 'ciencias', null, array[6], 'teste', 'página PDF 1')", [codigo])
    await expect(gravar('EF03CI03B')).rejects.toMatchObject({ constraint: 'habilidade_bncc_codigo_valido' })
    await expect(gravar('EF15AR01')).rejects.toMatchObject({ constraint: 'habilidade_bncc_codigo_valido' })
    await expect(gravar('EF07LP01A')).rejects.toMatchObject({ constraint: 'habilidade_bncc_codigo_valido' })
    await expect(
      scratch.query("insert into habilidade_bncc (codigo, descricao, etapa, componente, area, anos, versao, localizador) values ('EM13CNT3010', 'texto', 'em', null, 'ciencias_da_natureza', null, 'teste', 'página PDF 1')"),
    ).rejects.toMatchObject({ constraint: 'habilidade_bncc_codigo_valido' })
    await expect(gravar('EF06CO01')).resolves.toBeDefined()
    // A carga não a trouxe, e o que o teste gravou à mão sai.
    expect(await total("codigo = 'EF06CO01'")).toBe(1)
    expect(await total("codigo ~ '^EF[0-9]{2}CO' and versao <> 'teste'")).toBe(0)
    await scratch.query("delete from habilidade_bncc where codigo = 'EF06CO01'")
  })

  it('a linha precisa ser do Fundamental (com componente e anos de 6 a 9) ou do Médio (com área e sem anos): o resto o banco recusa', async () => {
    const gravar = (campos: string) =>
      scratch.query(`insert into habilidade_bncc (codigo, descricao, etapa, componente, area, anos, versao, localizador) values ${campos}`)
    const recorte = { constraint: 'habilidade_bncc_recorte_da_etapa' }
    await expect(gravar("('EF06CI90', 't', 'ef_anos_finais', 'ciencias', null, null, 'teste', 'p')")).rejects.toMatchObject(recorte)
    await expect(gravar("('EF06CI91', 't', 'ef_anos_finais', 'ciencias', null, array[5], 'teste', 'p')")).rejects.toMatchObject(recorte)
    await expect(gravar("('EF06CI92', 't', 'ef_anos_finais', null, null, array[6], 'teste', 'p')")).rejects.toMatchObject(recorte)
    await expect(gravar("('EF06CI93', 't', 'ef_anos_finais', 'ciencias', 'linguagens', array[6], 'teste', 'p')")).rejects.toMatchObject(recorte)
    await expect(gravar("('EM13LGG901', 't', 'em', null, null, null, 'teste', 'p')")).rejects.toMatchObject(recorte)
    await expect(gravar("('EM13LGG902', 't', 'em', null, 'linguagens', array[1], 'teste', 'p')")).rejects.toMatchObject(recorte)
    await expect(gravar("('EF06CI94', 't', 'ef_anos_finais', 'astrologia', null, array[6], 'teste', 'p')")).rejects.toMatchObject({ constraint: 'habilidade_bncc_componente_valido' })
    await expect(gravar("('EM13LGG903', 't', 'em', null, 'astrologia', null, 'teste', 'p')")).rejects.toMatchObject({ constraint: 'habilidade_bncc_area_valida' })
    await expect(gravar("('EM13LGG904', 't', 'fundamental', null, 'linguagens', null, 'teste', 'p')")).rejects.toMatchObject({ constraint: 'habilidade_bncc_etapa_valida' })
    expect(await total("versao = 'teste'")).toBe(0)
  })

  it('a tabela é pública: não tem `escola_id`, e é a única tabela da BNCC', async () => {
    const colunas = (await scratch.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'habilidade_bncc' order by column_name")).rows.map((linha) => linha.column_name)
    expect(colunas).toEqual(['anos', 'area', 'codigo', 'componente', 'descricao', 'etapa', 'localizador', 'versao'])
  })

  it('as disciplinas de antes ganham o componente pelo nome, sem acento nem caixa: "Química", "QUIMICA" e " física " casam, "Português" é Língua Portuguesa, e "Projeto de Vida" e "Robótica" ficam nulos', async () => {
    expect(await componentesDa(escolaA)).toEqual({
      Química: 'quimica',
      QUIMICA: 'quimica',
      ' física ': 'fisica',
      Português: 'lingua_portuguesa',
      'Projeto de Vida': null,
      Robótica: null,
      'Educação   Física': 'educacao_fisica',
    })
  })

  it('a disciplina da outra escola segue a mesma regra e só a dela: a "Matemática" da B casa, e a "Robótica" e o "Projeto de Vida" da B não recebem o que a A tem', async () => {
    expect(await componentesDa(escolaB)).toEqual({ Matemática: 'matematica', Robótica: null, 'Projeto de Vida': null })
  })

  it('o casamento de novo não desfaz o que a coordenação definiu: só a disciplina sem componente é tocada', async () => {
    await scratch.query("update disciplina set componente_bncc = 'fisica' where escola_id = $1 and nome = 'Química'", [escolaA])
    await scratch.query("update disciplina set componente_bncc = 'historia' where escola_id = $1 and nome = 'Robótica'", [escolaA])
    await scratch.query(instrucaoDoCasamento)
    const depois = await componentesDa(escolaA)
    expect(depois['Química']).toBe('fisica')
    expect(depois['Robótica']).toBe('historia')
    expect(depois['QUIMICA']).toBe('quimica')
  })

  it('só expande: o código de antes continua criando disciplina sem informar o componente, e o banco recusa o componente fora da lista', async () => {
    await expect(criarDisciplina(escolaA, 'Sociologia')).resolves.toBeDefined()
    expect((await componentesDa(escolaA))['Sociologia']).toBeNull()
    await expect(scratch.query("update disciplina set componente_bncc = 'astrologia' where escola_id = $1", [escolaA])).rejects.toMatchObject({ constraint: 'disciplina_componente_bncc_valido' })
  })
})
