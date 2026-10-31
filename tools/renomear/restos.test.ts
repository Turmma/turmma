import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PASTA_DO_PROTOTIPO } from './ast.ts'
import { PASTA_DOS_MAPAS } from './reaplicar.ts'
import { apagarRepositoriosDeTeste, montarRepositorio, type RepositorioDeTeste } from './repositorio-de-teste.ts'
import { restos, trocaAMaoRegistrada } from './restos.ts'

// O `restos` pelo efeito: o repositório de brinquedo já tem a onda aplicada (o mapa em `tools/renomear/mapas/`), e o caso deixa um nome
// antigo para trás, ou o deixa onde ele pode ficar. O que se confere é a lista de restos, com o arquivo e a linha.

const RAIZ = join(import.meta.dirname, '..', '..')

afterEach(apagarRepositoriosDeTeste)

const ANEXO = 'inventario-back.md:10'
const BANCO = { tipo: 'simbolo', de: 'Banco', para: 'Database', arquivo: 'packages/shared/src/db.ts' }
const ADAPTADOR = { tipo: 'simbolo', de: 'AdaptadorFalso', para: 'FakeAdapter', arquivo: 'packages/shared/src/db.ts' }
const FILA = { tipo: 'simbolo', de: 'Fila', para: 'Queue', arquivo: 'packages/shared/src/db.ts' }
const COM = { tipo: 'simbolo', de: 'com', para: 'forRoot' }
const NUCLEO = { tipo: 'pasta', de: 'packages/nucleo', para: 'packages/core' }

const mapa = (entradas: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ entradas: entradas.map((entrada) => ({ linhaDoAnexo: ANEXO, ...entrada })), ...extra })

const fica = (arquivo: string, de: string, trecho?: string) => ({ arquivo, de, classe: 'fica', linha: 'inventario-back.md:20', ...(trecho === undefined ? {} : { trecho }) })

/** A declaração dos nomes novos, para o repositório ter onde os usar. */
const BASE = { 'packages/shared/src/db.ts': 'export class Database {}\nexport class FakeAdapter {}\nexport class Queue {}\n' }

function aposAOnda(arquivos: Record<string, string>, mapas: Record<string, string> = { '4': mapa([BANCO, ADAPTADOR, FILA, COM, NUCLEO]) }): RepositorioDeTeste {
  return montarRepositorio({
    ...BASE,
    ...Object.fromEntries(Object.entries(mapas).map(([nome, conteudo]) => [`${PASTA_DOS_MAPAS}/${nome}.json`, conteudo])),
    ...arquivos,
  })
}

const sobras = (repo: RepositorioDeTeste): string[] => restos(repo.raiz).restos.map((resto) => `${resto.arquivo}:${String(resto.linha)} ${resto.onde} ${resto.de}`).sort()

describe('restos: vermelho', () => {
  it('a chave do passo 2, o membro e o tipo não contam, mas o uso de uma variável local com o nome antigo é resto', () => {
    const repo = aposAOnda({
      'apps/api/src/a.ts': "import { Database } from '@educa/shared'\nexport const r = { Banco: Database }\nexport const x = r.Banco\nexport const f = (Banco: number) => Banco\ninterface T { Banco: number }\n",
    })
    // O uso da variável local de nome `Banco` é o limite que a ferramenta declara: ele conta como resto, e só ele aparece.
    expect(sobras(repo)).toEqual(['apps/api/src/a.ts:4 identificador Banco'])
  })

  it('Banco como tipo no código', () => {
    const repo = aposAOnda({ 'apps/api/src/a.ts': "import { type Database } from '@educa/shared'\nexport const a: Banco | Database | undefined = undefined\n" })
    expect(sobras(repo)).toEqual(['apps/api/src/a.ts:2 identificador Banco'])
  })

  it('dois usos na mesma linha: um resto só', () => {
    const repo = aposAOnda({ 'apps/api/src/a.ts': 'export const f = (a: Banco, b: Banco) => [a, b]\n' })
    expect(sobras(repo)).toEqual(['apps/api/src/a.ts:1 identificador Banco'])
  })

  it('a troca à mão registrada não libera o texto nem o identificador', () => {
    const relatorio = ['## Troca à mão', '', '| Arquivo | Nome | Linhas |', '|---|---|---|', '| apps/api/src/a.ts | Banco | 1 |', ''].join('\n')
    const repo = aposAOnda({ 'apps/api/src/a.ts': "export const a: Banco | undefined = undefined\nexport const b = 'Banco'\n", [`${PASTA_DOS_MAPAS}/4.relatorio.md`]: relatorio })
    expect(sobras(repo)).toEqual(['apps/api/src/a.ts:1 identificador Banco', 'apps/api/src/a.ts:2 texto Banco'])
  })

  it('o nome antigo em uma string, em uma regex, em um template e em um array', () => {
    const repo = aposAOnda({ 'apps/api/src/a.ts': "export const a = ['AdaptadorFalso']\nexport const b = /\\bAdaptadorFalso\\b/\nexport const c = `${a}/AdaptadorFalso`\n" })
    expect(sobras(repo)).toEqual(['apps/api/src/a.ts:1 texto AdaptadorFalso', 'apps/api/src/a.ts:2 texto AdaptadorFalso', 'apps/api/src/a.ts:3 texto AdaptadorFalso'])
  })

  it('`Fila` entre crases num documento', () => {
    const repo = aposAOnda({ 'docs/guia.md': 'A fila é boa.\nUse a `Fila` do BullMQ.\n' })
    expect(sobras(repo)).toEqual(['docs/guia.md:2 documento Fila'])
  })

  it('o identificador composto e o caminho num documento, e o composto num comentário do código', () => {
    const repo = aposAOnda({
      'docs/guia.md': 'O AdaptadorFalso responde.\nVeja packages/nucleo/src/ia.\n',
      'apps/api/src/a.ts': '// o AdaptadorFalso devolve a resposta fixa\nexport const a = 1\n',
    })
    expect(sobras(repo)).toEqual(['apps/api/src/a.ts:1 comentário AdaptadorFalso', 'docs/guia.md:1 documento AdaptadorFalso', 'docs/guia.md:2 documento packages/nucleo'])
  })

  it('um .js de dist com o nome antigo em infra/', () => {
    const repo = aposAOnda({ 'infra/scripts/carga.ts': "export const dist = 'packages/nucleo/dist/index.js'\n" })
    expect(sobras(repo)).toEqual(['infra/scripts/carga.ts:1 texto packages/nucleo'])
  })

  it('um package.json da raiz com o nome antigo em um -w', () => {
    const repo = aposAOnda({ 'package.json': '{ "scripts": { "build": "npm run build -w packages/nucleo" } }\n' })
    expect(sobras(repo)).toEqual(['package.json:1 texto packages/nucleo'])
  })

  it('o de de um mapa anterior, com um mapa mais novo na pasta', () => {
    const repo = aposAOnda({ 'apps/api/src/a.ts': "export const a = 'Banco'\nexport const b = 'AdaptadorFalso'\n" }, { '4': mapa([BANCO]), '7': mapa([ADAPTADOR], { linha: true }) })
    expect(sobras(repo)).toEqual(['apps/api/src/a.ts:1 texto Banco', 'apps/api/src/a.ts:2 texto AdaptadorFalso'])
  })

  it('a ocorrência classificada como trava não libera: a onda a troca, e o que sobra é resto', () => {
    const trava = { arquivo: 'apps/api/src/a.ts', de: 'Banco', classe: 'trava', linha: 'travas.md:33' }
    const repo = aposAOnda({ 'apps/api/src/a.ts': "export const a = 'Banco'\n" }, { '4': mapa([BANCO], { ocorrencias: [trava] }) })
    expect(sobras(repo)).toEqual(['apps/api/src/a.ts:1 texto Banco'])
  })

  it('o fica de outro arquivo, de outro nome e de outro trecho não libera', () => {
    const repo = aposAOnda(
      { 'apps/api/src/a.ts': "export const a = 'Banco'\nexport const b = ['Banco', 1]\n" },
      { '4': mapa([BANCO], { ocorrencias: [fica('apps/api/src/outro.ts', 'Banco'), fica('apps/api/src/a.ts', 'AdaptadorFalso'), fica('apps/api/src/a.ts', 'Banco', 'bradesco')] }) },
    )
    expect(sobras(repo)).toEqual(['apps/api/src/a.ts:1 texto Banco', 'apps/api/src/a.ts:2 texto Banco'])
    const comOTrecho = aposAOnda({ 'apps/api/src/a.ts': "export const a = 'Banco'\n" }, { '4': mapa([BANCO], { ocorrencias: [fica('apps/api/src/a.ts', 'Banco', 'Banco')] }) })
    expect(sobras(comOTrecho)).toEqual([])
  })

  it('na 13.0, o caminho antigo num README do ouro', () => {
    const repo = aposAOnda(
      { 'docs/aia/ouro/README.md': 'Os casos estão em packages/nucleo/src/ia/__fixtures__/.\n' },
      { '4': mapa([NUCLEO]), '13': mapa([ADAPTADOR]) },
    )
    expect(sobras(repo)).toEqual(['docs/aia/ouro/README.md:1 documento packages/nucleo'])
  })

  it('na 13.0, o JSON do ouro também, e o JSON de outra pasta de docs/ não', () => {
    const repo = aposAOnda(
      { 'docs/aia/ouro-retido/RETIDOS.json': '{ "caminho": "packages/nucleo/src/ia/ouro.test.ts" }\n', 'docs/dados.json': '{ "caminho": "packages/nucleo/src/ia/ouro.test.ts" }\n', 'docs/aia/ouro/nota.txt': 'packages/nucleo\n' },
      { '4': mapa([NUCLEO]), '13': mapa([ADAPTADOR]) },
    )
    expect(sobras(repo)).toEqual(['docs/aia/ouro-retido/RETIDOS.json:1 documento packages/nucleo'])
  })

  it('com o 13.json, o mapa de linha vale também nos documentos', () => {
    const arquivos = { 'docs/guia.md': 'O AdaptadorFalso responde.\n' }
    const linha = mapa([ADAPTADOR], { linha: true })
    expect(sobras(aposAOnda(arquivos, { '7': linha, '13': mapa([BANCO]) }))).toEqual(['docs/guia.md:1 documento AdaptadorFalso'])
  })
})

describe('restos: verde', () => {
  it('"Fila de jobs" em prosa, num documento e num comentário', () => {
    const repo = aposAOnda({ 'docs/guia.md': 'A Fila de jobs é do BullMQ.\n', 'apps/api/src/a.ts': '// Fila de jobs\nexport const a = 1\n' })
    expect(sobras(repo)).toEqual([])
  })

  it('"com" numa string de tela, e a variável com', () => {
    const repo = aposAOnda({ 'apps/web/src/Entrar.tsx': "export const Entrar = () => <b>{'Entrar com a conta'}</b>\nconst com = 1\nexport const x = com\n" })
    expect(sobras(repo)).toEqual([])
  })

  it('o texto de describe, de it e de test', () => {
    const repo = aposAOnda({
      'apps/api/src/a.test.ts': "describe('o AdaptadorFalso', () => {\n  it('AdaptadorFalso responde', () => {})\n  test.each([1])(`a AdaptadorFalso ${1}`, () => {})\n  it.each([1])('AdaptadorFalso %s', () => {})\n  it(`${1} e o AdaptadorFalso`, () => {})\n})\n",
    })
    expect(sobras(repo)).toEqual([])
  })

  it('o fica: a string de fora', () => {
    const repo = aposAOnda({ 'apps/api/src/a.ts': "export const a = 'Banco'\nexport const b = 'Banco'\n" }, { '4': mapa([BANCO], { ocorrencias: [fica('apps/api/src/a.ts', 'Banco')] }) })
    expect(sobras(repo)).toEqual([])
  })

  it('o fica de uma pasta vale para o que está dentro dela', () => {
    const repo = aposAOnda({ 'apps/api/src/s/a.ts': "export const a = 'Banco'\n" }, { '4': mapa([BANCO], { ocorrencias: [fica('apps/api/src/s/', 'Banco')] }) })
    expect(sobras(repo)).toEqual([])
  })

  it('docs/decisoes.md, tasks/ e o protótipo', () => {
    const repo = aposAOnda({
      'docs/decisoes.md': 'A `Fila` e o AdaptadorFalso e packages/nucleo.\n',
      'tasks/prd-x/prd.md': 'O AdaptadorFalso e packages/nucleo.\n',
      [`${PASTA_DO_PROTOTIPO}/app.ts`]: "export const a = 'AdaptadorFalso'\nexport const b: Banco = 1\n",
      'tasks/prd-x/exemplo.ts': 'export const c: Banco = 1\n',
      'docs/exemplo.ts': 'export const d: Banco = 1\n',
    })
    expect(sobras(repo)).toEqual([])
  })

  it('a própria ferramenta: o identificador e o comentário em tools/renomear/', () => {
    const repo = aposAOnda({ 'tools/renomear/exemplo.ts': '// o AdaptadorFalso\nexport const a: Banco = 1\n' })
    expect(sobras(repo)).toEqual([])
  })

  it('o que não é código não é lido como código: um Markdown fora de docs/ com o nome em prosa', () => {
    const repo = aposAOnda({ 'apps/api/LEIAME.md': 'O Banco do sistema.\n' })
    expect(sobras(repo)).toEqual([])
  })

  it('a troca à mão registrada no relatório', () => {
    const relatorio = ['# Relatório da onda 4', '', '## Troca à mão', '', '| Arquivo | Nome | Linhas |', '|---|---|---|', '| docs/guia.md | Fila | 2 |', ''].join('\n')
    const arquivos = { 'docs/guia.md': 'A fila.\nUse a `Fila` do BullMQ.\n' }
    expect(sobras(aposAOnda({ ...arquivos, [`${PASTA_DOS_MAPAS}/4.relatorio.md`]: relatorio }))).toEqual([])
    expect(sobras(aposAOnda(arquivos))).toEqual(['docs/guia.md:2 documento Fila'])
  })

  it('um documento com o nome antigo numa onda de linha, sem o 13.json', () => {
    const repo = aposAOnda({ 'docs/guia.md': 'O AdaptadorFalso responde.\n', 'apps/api/src/a.ts': '// o AdaptadorFalso\n' }, { '7': mapa([ADAPTADOR], { linha: true }) })
    expect(sobras(repo)).toEqual(['apps/api/src/a.ts:1 comentário AdaptadorFalso'])
  })

  it('o README do ouro numa onda que não é a 13.0', () => {
    const repo = aposAOnda({ 'docs/aia/ouro/README.md': 'Os casos estão em packages/nucleo/src/ia/__fixtures__/.\n' })
    expect(sobras(repo)).toEqual([])
  })

  it('o nome novo, a árvore limpa', () => {
    const repo = aposAOnda({ 'apps/api/src/a.ts': "import { Database } from '@educa/shared'\nexport const a: Database | undefined = undefined\n", 'docs/guia.md': 'A `Queue` e o FakeAdapter, em packages/core.\n' })
    expect(restos(repo.raiz)).toMatchObject({ codigo: 0, restos: [] })
  })
})

describe('restos: o arquivo que uma onda seguinte moveu', () => {
  const mover = (de: string, para: string) => ({ tipo: 'arquivo', de, para })
  const moverPasta = (de: string, para: string) => ({ tipo: 'pasta', de, para })
  const trocaAMao = (arquivo: string, nome: string) => ['## Troca à mão', '', '| Arquivo | Nome | Linhas |', '|---|---|---|', `| ${arquivo} | ${nome} | 1 |`, ''].join('\n')
  const STRING = "export const a = 'Banco'\n"

  it('o fica de uma onda num arquivo que uma onda seguinte moveu', () => {
    const repo = aposAOnda(
      { 'apps/api/src/b.ts': STRING },
      { '4': mapa([BANCO], { ocorrencias: [fica('apps/api/src/a.ts', 'Banco')] }), '5': mapa([mover('apps/api/src/a.ts', 'apps/api/src/b.ts')]) },
    )
    expect(sobras(repo)).toEqual([])
  })

  it('o fica de um arquivo dentro de uma pasta que uma onda seguinte moveu', () => {
    const repo = aposAOnda(
      { 'packages/core/src/a.ts': STRING },
      { '4': mapa([BANCO], { ocorrencias: [fica('packages/nucleo/src/a.ts', 'Banco')] }), '5': mapa([moverPasta('packages/nucleo', 'packages/core')]) },
    )
    expect(sobras(repo)).toEqual([])
  })

  it('o fica que é a própria pasta que uma onda seguinte moveu', () => {
    const repo = aposAOnda(
      { 'apps/api/src/t/x/b.ts': STRING },
      { '4': mapa([BANCO], { ocorrencias: [fica('apps/api/src/s/', 'Banco')] }), '5': mapa([moverPasta('apps/api/src/s', 'apps/api/src/t')]) },
    )
    expect(sobras(repo)).toEqual([])
  })

  it('o fica de uma pasta irmã de prefixo igual não é levado pelo move da pasta', () => {
    const repo = aposAOnda(
      { 'packages/nucleo-x/a.ts': STRING },
      { '4': mapa([BANCO], { ocorrencias: [fica('packages/nucleo-x/a.ts', 'Banco')] }), '5': mapa([moverPasta('packages/nucleo', 'packages/core')]) },
    )
    expect(sobras(repo)).toEqual([])
  })

  it('duas ondas que movem o mesmo arquivo, na ordem das ondas', () => {
    const mapas = {
      '4': mapa([BANCO], { ocorrencias: [fica('apps/api/src/a.ts', 'Banco')] }),
      '5': mapa([mover('apps/api/src/a.ts', 'apps/api/src/b.ts')]),
      '6': mapa([mover('apps/api/src/b.ts', 'apps/api/src/c.ts')]),
    }
    expect(sobras(aposAOnda({ 'apps/api/src/c.ts': STRING }, mapas))).toEqual([])
  })

  it('a troca à mão registrada num arquivo que uma onda seguinte moveu', () => {
    const repo = aposAOnda(
      { 'docs/novo.md': 'A fila.\nUse a `Fila` do BullMQ.\n', [`${PASTA_DOS_MAPAS}/4.relatorio.md`]: trocaAMao('docs/guia.md', 'Fila') },
      { '4': mapa([FILA]), '5': mapa([mover('docs/guia.md', 'docs/novo.md')]) },
    )
    expect(sobras(repo)).toEqual([])
  })

  it('o fica da onda N não libera o arquivo que chegou ao caminho antigo depois do move', () => {
    const repo = aposAOnda(
      { 'apps/api/src/a.ts': STRING, 'apps/api/src/b.ts': STRING },
      { '4': mapa([BANCO], { ocorrencias: [fica('apps/api/src/a.ts', 'Banco')] }), '5': mapa([mover('apps/api/src/a.ts', 'apps/api/src/b.ts')]) },
    )
    expect(sobras(repo)).toEqual(['apps/api/src/a.ts:1 texto Banco'])
  })

  it('a troca à mão da onda N não libera o arquivo que chegou ao caminho antigo depois do move', () => {
    const repo = aposAOnda(
      { 'docs/guia.md': 'Use a `Fila` do BullMQ.\n', 'docs/novo.md': 'Use a `Fila` do BullMQ.\n', [`${PASTA_DOS_MAPAS}/4.relatorio.md`]: trocaAMao('docs/guia.md', 'Fila') },
      { '4': mapa([FILA]), '5': mapa([mover('docs/guia.md', 'docs/novo.md')]) },
    )
    expect(sobras(repo)).toEqual(['docs/guia.md:1 documento Fila'])
  })

  it('o move da própria onda não leva o fica dela: o fica é do arquivo como a onda o deixa', () => {
    const mapas = (arquivoDoFica: string) => ({ '4': mapa([BANCO, mover('apps/api/src/a.ts', 'apps/api/src/b.ts')], { ocorrencias: [fica(arquivoDoFica, 'Banco')] }) })
    expect(sobras(aposAOnda({ 'apps/api/src/b.ts': STRING }, mapas('apps/api/src/b.ts')))).toEqual([])
    expect(sobras(aposAOnda({ 'apps/api/src/b.ts': STRING }, mapas('apps/api/src/a.ts')))).toEqual(['apps/api/src/b.ts:1 texto Banco'])
  })

  it('o move de uma onda anterior não leva o fica de uma onda seguinte', () => {
    const repo = aposAOnda(
      { 'apps/api/src/b.ts': STRING },
      { '4': mapa([mover('apps/api/src/a.ts', 'apps/api/src/b.ts')]), '5': mapa([BANCO], { ocorrencias: [fica('apps/api/src/a.ts', 'Banco')] }) },
    )
    expect(sobras(repo)).toEqual(['apps/api/src/b.ts:1 texto Banco'])
  })
})

describe('restos: a tabela do relatório', () => {
  it('lê o arquivo e o nome de cada linha, e para na próxima seção', () => {
    const relatorio = ['## Troca à mão', '', '| Arquivo | Nome | Linhas |', '|---|---|---|', '| a.md | Fila | 1, 2 |', '| b.md | Banco | 3 |', '|solto|', '', '## Outra', '| c.md | Tela | 1 |'].join('\n')
    expect([...trocaAMaoRegistrada(relatorio)].sort()).toEqual(['a.md\u0000Fila', 'b.md\u0000Banco'])
    expect(trocaAMaoRegistrada('# sem a seção\n| a.md | Fila | 1 |\n').size).toBe(0)
  })
})

describe('restos: o alvo não existe', () => {
  it('sem mapa na pasta, falha alto', () => {
    expect(() => restos(montarRepositorio({ ...BASE }).raiz)).toThrow(/não há mapa em tools\/renomear\/mapas/)
  })

  it('o mapa inválido lança', () => {
    const repo = aposAOnda({}, { '4': mapa([{ tipo: 'simbolo', de: 'Banco', para: 'Database', linhaDoAnexo: '' }]) })
    expect(() => restos(repo.raiz)).toThrow(/mapa inválido/)
  })
})

describe('restos: a linha de comando', () => {
  const SCRIPT = join(import.meta.dirname, 'restos.ts')
  const rodarComando = (repo: RepositorioDeTeste) => spawnSync('node', [SCRIPT], { cwd: repo.raiz, encoding: 'utf8' })

  it('sai 0 limpa, 1 com resto e 2 sem mapa', () => {
    const limpo = rodarComando(aposAOnda({ 'apps/api/src/a.ts': 'export const a = 1\n' }))
    expect([limpo.status, limpo.stdout]).toEqual([0, expect.stringMatching(/^restos: limpo/)])
    const sujo = rodarComando(aposAOnda({ 'apps/api/src/a.ts': "export const a = 'Banco'\n" }))
    expect([sujo.status, sujo.stdout]).toEqual([1, expect.stringMatching(/^restos: 1 nomes antigos sobraram/)])
    expect(rodarComando(montarRepositorio({ ...BASE })).status).toBe(2)
  })
})

describe('restos na árvore', () => {
  it('a árvore não tem resto dos mapas aplicados', { timeout: 180_000 }, () => {
    let mapas: string[]
    try {
      mapas = readdirSync(join(RAIZ, PASTA_DOS_MAPAS)).filter((nome) => /^[^.]+\.json$/.test(nome))
    } catch {
      mapas = []
    }
    // Antes da primeira onda não há mapa, e o comando falha alto (o alvo não existe). Da 3.0 em diante este caso é o que as ondas
    // citam na forma C: o nome antigo que o mapa aplicado deixou para trás deixa a árvore vermelha.
    if (mapas.length === 0) {
      expect(() => restos(RAIZ)).toThrow(/não há mapa/)
      return
    }
    const resultado = restos(RAIZ)
    expect(resultado.restos.map((resto) => `${resto.arquivo}:${String(resto.linha)} ${resto.de}`)).toEqual([])
  })
})
