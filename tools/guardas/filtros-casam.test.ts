import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, join, matchesGlob } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PASTA_DO_PROTOTIPO } from '../renomear/ast.ts'
import { EXCECOES_DO_CODIGO, REGRAS_DO_RF16, RESTO_DO_PROCESSO } from '../processo/guardioes-por-caminho.ts'
import { ARQUIVOS_DE_TESTE, configuracaoDasGuardas, ESCOPO_DO_ERRO_TIPADO, EXCECOES_DAS_GUARDAS } from './index.mjs'
import { PASTA_DOS_ADAPTADORES } from './regras-ia.mjs'

// Nenhum filtro casa vazio (X8, 2.0; Tech Spec §5, "A trava contra filtro vazio"). Um glob, um caminho ou um `path` de regex que
// o rename deixou apontando para o nome antigo não dá erro: a regra para de valer e ninguém vê. Aqui cada item de cada fonte tem
// de casar com ao menos um arquivo, item a item, e cada fonte rende um mínimo de itens (a fonte que o extrator deixa de ler não
// vira "zero itens, tudo verde").
//
// **A base** é o `git ls-files` (os versionados e os que vão ser). O item que nomeia `__fixtures__/` ou a pasta do protótipo confere
// contra a base inteira; os demais, contra a base sem essas pastas e sem `dist/`: o glob que só casa dentro de uma fixture não vigia
// nada do produto. O que é saída não versionada (`node_modules`, `dist`, os relatórios do Playwright) é exceção nominal, com o motivo.
//
// **Os limites.** O item é conferido inteiro, e não cada alternativa de um `{a,b}`. O `knip.json` e o `eslint.config.mjs` são lidos
// do que o ESLint e o Knip leem (o JSON e a configuração exportada); o glob negado (`!x`) é conferido sem o `!`.

const RAIZ = join(import.meta.dirname, '..', '..')
const requerer = createRequire(import.meta.url)

type Tipo = 'glob' | 'prefixo' | 'regex' | 'pasta' | 'dist'

interface Item {
  valor: string
  tipo: Tipo
}

interface Fonte {
  nome: string
  /** Quantos itens a fonte rende hoje. Menos que isso é extrator que deixou de ler. */
  minimo: number
  itens: Item[]
}

interface Base {
  inteira: readonly string[]
  /** Sem `__fixtures__/`, sem o protótipo e sem `dist/`. */
  comum: readonly string[]
}

/** Saída não versionada: o item existe na configuração e não casa nada na base. Cada uma com o motivo. */
const EXCECOES_NOMINAIS: ReadonlyMap<string, string> = new Map([
  ['**/node_modules/**', 'instalado pelo npm, não versionado'],
  ['**/dist/**', 'saída do build, não versionada'],
  ['playwright-report/**', 'relatório do Playwright, gerado e não versionado'],
  ['test-results/**', 'resultado do Playwright, gerado e não versionado'],
  ['.claude/worktrees/**', 'checkouts de subagente, criados em execução e não versionados'],
  ['node_modules', 'camadas.cjs: a dependência de fora não é seguida; instalada pelo npm'],
  [String.raw`(?:^|/)node_modules/drizzle-orm(?:/|$)`, 'camadas.cjs: o drizzle-orm instalado pelo npm, não versionado'],
])

function baseDe(arquivos: readonly string[]): Base {
  const fora = (arquivo: string) => /(^|\/)(__fixtures__|dist)\//.test(arquivo) || arquivo.startsWith(`${PASTA_DO_PROTOTIPO}/`)
  return { inteira: arquivos, comum: arquivos.filter((arquivo) => !fora(arquivo)) }
}

function arquivosDoRepositorio(): string[] {
  const resultado = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  if (resultado.status !== 0) throw new Error(`git ls-files falhou: ${resultado.stderr}`)
  return resultado.stdout.split('\n').filter((arquivo) => arquivo !== '' && existsSync(join(RAIZ, arquivo)))
}

/** O glob do ESLint e do Knip: o que não tem `/` vale para o nome do arquivo em qualquer pasta. */
function globCasa(glob: string, arquivo: string): boolean {
  const limpo = glob.startsWith('!') ? glob.slice(1) : glob
  return matchesGlob(limpo.includes('/') ? arquivo : basename(arquivo), limpo)
}

/** O `$1` do `camadas.cjs` é o grupo que a regra captura; aqui vale qualquer nome de pasta. */
const regexDoItem = (valor: string): RegExp => new RegExp(valor.replaceAll('$1', '[^/]+'))

/** `packages/core/dist/ia/x.js` → `packages/core/src/ia/x.ts`: a fonte que o build produz o `dist`. */
export function fonteDoDist(caminho: string): string[] {
  const sem = caminho.replace(/\/dist\//, '/src/').replace(/\.js$/, '')
  return [`${sem}.ts`, `${sem}.tsx`]
}

function casa(item: Item, base: readonly string[]): boolean {
  switch (item.tipo) {
    case 'glob':
      return base.some((arquivo) => globCasa(item.valor, arquivo))
    case 'prefixo':
      return base.some((arquivo) => arquivo.startsWith(item.valor))
    case 'regex':
      return base.some((arquivo) => regexDoItem(item.valor).test(arquivo))
    case 'pasta':
      return item.valor === '.' || base.some((arquivo) => globCasa(`${item.valor}/**`, arquivo))
    case 'dist':
      return fonteDoDist(item.valor).some((fonte) => base.includes(fonte))
  }
}

const nomeiaFixtureOuProtótipo = (valor: string): boolean => valor.includes('__fixtures__') || valor.includes(`${PASTA_DO_PROTOTIPO}/`)

/** O que há de errado com o item, ou `undefined`. */
export function problemaDoItem(item: Item, base: Base): string | undefined {
  if (item.valor === '') return 'item vazio'
  if (EXCECOES_NOMINAIS.has(item.valor)) return undefined
  const alvo = nomeiaFixtureOuProtótipo(item.valor) ? base.inteira : base.comum
  if (casa(item, alvo)) return undefined
  return item.tipo === 'dist' ? 'a fonte em src/ não existe' : 'não casa com nenhum arquivo'
}

export function problemasDaFonte(fonte: Fonte, base: Base): string[] {
  const doMinimo = fonte.itens.length < fonte.minimo ? [`${fonte.nome}: rendeu ${String(fonte.itens.length)} itens e o mínimo é ${String(fonte.minimo)}: o extrator deixou de ler`] : []
  const dosItens = fonte.itens.flatMap((item) => {
    const problema = problemaDoItem(item, base)
    return problema === undefined ? [] : [`${fonte.nome}: "${item.valor}" ${problema}`]
  })
  return [...doMinimo, ...dosItens]
}

/** Carrega a fonte; a que não carrega falha alto, e não vira lista vazia. */
export function carregarFonte(nome: string, minimo: number, ler: () => Item[]): Fonte {
  try {
    return { nome, minimo, itens: ler() }
  } catch (erro) {
    throw new Error(`a fonte ${nome} não carregou: ${erro instanceof Error ? erro.message : String(erro)}`, { cause: erro })
  }
}

// ---- os extratores, um por forma de fonte ----------------------------------------------------------------------------

const unicos = (itens: Item[]): Item[] => [...new Map(itens.map((item) => [`${item.tipo}\u0000${item.valor}`, item])).values()]
const globs = (valores: readonly string[]): Item[] => unicos(valores.map((valor) => ({ valor, tipo: 'glob' as const })))

interface Configuracao {
  name?: string
  files?: ReadonlyArray<string | readonly string[]>
  ignores?: readonly string[]
}

const textos = (valores: ReadonlyArray<string | readonly string[]> | undefined): string[] => (valores ?? []).flat()
// Os blocos da configuração que são nossos: os de `typescript-eslint` trazem os `files` que ele mesmo escolheu (os `.cts`).
const dosNossos = (configuracao: readonly Configuracao[]): Configuracao[] => configuracao.filter((bloco) => !(bloco.name ?? '').startsWith('typescript-eslint/'))

export function filesDoEslint(configuracao: readonly Configuracao[]): Item[] {
  return globs(dosNossos(configuracao).flatMap((bloco) => textos(bloco.files)))
}

export function ignoresDoEslint(configuracao: readonly Configuracao[]): Item[] {
  return globs(dosNossos(configuracao).flatMap((bloco) => [...(bloco.ignores ?? [])]))
}

interface Knip {
  ignore?: string[]
  workspaces?: Record<string, { entry?: string[]; project?: string[] }>
}

const noWorkspace = (pasta: string, glob: string): string => (pasta === '.' ? glob : `${pasta}/${glob}`)

export function workspacesDoKnip(knip: Knip): Item[] {
  return unicos(Object.keys(knip.workspaces ?? {}).map((valor) => ({ valor, tipo: 'pasta' as const })))
}

export function entriesDoKnip(knip: Knip): Item[] {
  return globs(Object.entries(knip.workspaces ?? {}).flatMap(([pasta, area]) => (area.entry ?? []).map((glob) => noWorkspace(pasta, glob))))
}

export function projectDoKnip(knip: Knip): Item[] {
  return globs(Object.entries(knip.workspaces ?? {}).flatMap(([pasta, area]) => (area.project ?? []).map((glob) => noWorkspace(pasta, glob))))
}

export function ignoreDoKnip(knip: Knip): Item[] {
  return globs(knip.ignore ?? [])
}

/** O `paths:` do cabeçalho de uma regra: a lista de globs entre aspas, um por linha. */
export function pathsDaRegra(texto: string): Item[] {
  const cabecalho = /^---\n([\s\S]*?)\n---/.exec(texto)?.[1] ?? ''
  const bloco = /^paths:\n((?:\s+- .*\n?)+)/m.exec(`${cabecalho}\n`)?.[1] ?? ''
  return globs([...bloco.matchAll(/^\s+- "?([^"\n]+)"?\s*$/gm)].map((achado) => achado[1] ?? ''))
}

interface Camadas {
  forbidden: Array<{ from?: Filtro; to?: Filtro }>
  options?: { doNotFollow?: Filtro; exclude?: Filtro }
}
interface Filtro {
  path?: string | string[]
  pathNot?: string | string[]
}

const listaDe = (valor: string | string[] | undefined): string[] => (valor === undefined ? [] : Array.isArray(valor) ? valor : [valor])

export function pathsDoCamadas(camadas: Camadas): Item[] {
  const filtros = [...camadas.forbidden.flatMap((regra) => [regra.from, regra.to]), camadas.options?.doNotFollow, camadas.options?.exclude]
  return unicos(filtros.flatMap((filtro) => [...listaDe(filtro?.path), ...listaDe(filtro?.pathNot)]).map((valor) => ({ valor, tipo: 'regex' as const })))
}

/** Os caminhos de `dist` que um script importa em execução: `apps/api/dist/x.js`, `packages/core/dist/index.js`. */
export function caminhosDeDist(texto: string): Item[] {
  return unicos([...texto.matchAll(/'((?:apps|packages)\/[^'\s]+\/dist\/[^'\s]+\.js)'/g)].map((achado) => ({ valor: achado[1] ?? '', tipo: 'dist' as const })))
}

const prefixos = (valores: readonly string[]): Item[] => unicos(valores.map((valor) => ({ valor, tipo: 'prefixo' as const })))

// ---- as fontes da árvore real ----------------------------------------------------------------------------------------

const lerTexto = (caminho: string): string => readFileSync(join(RAIZ, caminho), 'utf8')
const lerJson = <T>(caminho: string): T => JSON.parse(lerTexto(caminho)) as T

const ARQUIVOS_COM_DIST = ['tools/ia/medir-risco-a-vida.ts', ...readdirSync(join(RAIZ, 'infra/scripts')).filter((nome) => nome.endsWith('.ts')).map((nome) => `infra/scripts/${nome}`)]

const regrasComPaths = (): string[] => readdirSync(join(RAIZ, '.claude/rules')).filter((nome) => nome.endsWith('.md')).map((nome) => `.claude/rules/${nome}`)

const { default: configuracaoDoEslint } = (await import('../../eslint.config.mjs')) as { default: Configuracao[] }

/** Cada fonte com o mínimo de itens que rende hoje (revisão da spec, rodada 9). */
function fontesDaArvore(): Fonte[] {
  return [
    carregarFonte('configuracaoDasGuardas', 13, () => globs(configuracaoDasGuardas.flatMap((bloco) => textos(bloco.files)))),
    carregarFonte('EXCECOES_DAS_GUARDAS', 10, () => globs(EXCECOES_DAS_GUARDAS.flatMap((excecao) => excecao.files))),
    carregarFonte('PASTA_DOS_ADAPTADORES', 1, () => globs([PASTA_DOS_ADAPTADORES])),
    carregarFonte('ESCOPO_DO_ERRO_TIPADO', 2, () => globs(ESCOPO_DO_ERRO_TIPADO)),
    carregarFonte('ARQUIVOS_DE_TESTE', 2, () => globs(ARQUIVOS_DE_TESTE)),
    carregarFonte('camadas.cjs', 35, () => pathsDoCamadas(requerer(join(RAIZ, 'tools/guardas/camadas.cjs')) as Camadas)),
    carregarFonte('guardioes-por-caminho.ts', 45, () => prefixos([...EXCECOES_DO_CODIGO.map((e) => e.prefixo), ...REGRAS_DO_RF16.map((r) => r.prefixo), ...RESTO_DO_PROCESSO])),
    carregarFonte('eslint.config.mjs, files', 25, () => filesDoEslint(configuracaoDoEslint)),
    carregarFonte('eslint.config.mjs, ignores', 8, () => ignoresDoEslint(configuracaoDoEslint)),
    carregarFonte('package.json, workspaces', 2, () => unicos(lerJson<{ workspaces: string[] }>('package.json').workspaces.map((valor) => ({ valor, tipo: 'pasta' as const })))),
    carregarFonte('knip.json, workspaces', 8, () => workspacesDoKnip(lerJson<Knip>('knip.json'))),
    carregarFonte('knip.json, entries', 17, () => entriesDoKnip(lerJson<Knip>('knip.json'))),
    carregarFonte('knip.json, project', 15, () => projectDoKnip(lerJson<Knip>('knip.json'))),
    carregarFonte('knip.json, ignore', 2, () => ignoreDoKnip(lerJson<Knip>('knip.json'))),
    carregarFonte('.claude/rules, paths', 18, () => unicos(regrasComPaths().flatMap((regra) => pathsDaRegra(lerTexto(regra))))),
    carregarFonte('dist de infra/scripts e de medir-risco-a-vida', 5, () => unicos(ARQUIVOS_COM_DIST.flatMap((arquivo) => caminhosDeDist(lerTexto(arquivo))))),
  ]
}

// ---- os casos --------------------------------------------------------------------------------------------------------

const BASE_DA_ARVORE = baseDe(arquivosDoRepositorio())
const ARQUIVOS = [
  'apps/api/src/x.ts',
  'packages/shared/src/y.ts',
  'tools/guardas/__fixtures__/f.ts',
  'tools/guardas/__fixtures__/so-na-fixture.ts',
  `${PASTA_DO_PROTOTIPO}/app/p.tsx`,
  '.claude/rules/10-a.md',
  'packages/core/src/index.ts',
  'packages/core/dist/index.js',
  'apps/api/src/z.test.ts',
]
const BASE = baseDe(ARQUIVOS)
const FIXTURES = join(import.meta.dirname, '__fixtures__', 'filtros')
const glob = (valor: string): Item => ({ valor, tipo: 'glob' })

describe('nenhum filtro casa vazio (X8)', () => {
  describe('verde', () => {
    it('o glob que casa um arquivo, o prefixo, a regex, a pasta e o dist com fonte passam', () => {
      const fonte: Fonte = {
        nome: 'f',
        minimo: 5,
        itens: [glob('apps/*/src/**/*.ts'), { valor: 'packages/', tipo: 'prefixo' }, { valor: '^apps/api/src/', tipo: 'regex' }, { valor: 'apps/api', tipo: 'pasta' }, { valor: 'packages/core/dist/index.js', tipo: 'dist' }],
      }
      expect(problemasDaFonte(fonte, BASE)).toEqual([])
    })

    it('o glob que nomeia __fixtures__/ casa na base inteira', () => {
      expect(problemaDoItem(glob('tools/guardas/__fixtures__/**'), BASE)).toBeUndefined()
    })

    it('**/dist/** não casa nada e passa só pela exceção nominal, que tem o motivo', () => {
      expect(BASE.comum.some((arquivo) => globCasa('**/dist/**', arquivo))).toBe(false)
      expect(problemaDoItem(glob('**/dist/**'), BASE)).toBeUndefined()
      expect(problemaDoItem(glob('**/dist/outro/**'), BASE)).toBe('não casa com nenhum arquivo')
      for (const [item, motivo] of EXCECOES_NOMINAIS) expect(motivo.length, `a exceção ${item} sem motivo`).toBeGreaterThan(10)
    })

    it('o glob que nomeia o protótipo casa na base inteira', () => {
      expect(problemaDoItem(glob(`${PASTA_DO_PROTOTIPO}/**`), BASE)).toBeUndefined()
    })

    it('o glob sem barra vale para o nome do arquivo em qualquer pasta, e o negado é conferido sem o !', () => {
      expect(problemaDoItem(glob('*.test.ts'), BASE)).toBeUndefined()
      expect(problemaDoItem(glob('*.mjs'), BASE)).toBe('não casa com nenhum arquivo')
      expect(problemaDoItem(glob('!apps/*/src/**'), BASE)).toBeUndefined()
      expect(problemaDoItem(glob('!apps/*/inexistente/**'), BASE)).toBe('não casa com nenhum arquivo')
    })

    it('o $1 da regra do camadas.cjs casa qualquer nome de pasta', () => {
      expect(problemaDoItem({ valor: '^apps/$1/', tipo: 'regex' }, BASE)).toBeUndefined()
    })
  })

  describe('vermelho', () => {
    it('um glob que não casa nada', () => {
      expect(problemaDoItem(glob('apps/inexistente/**'), BASE)).toBe('não casa com nenhum arquivo')
    })

    it('um array com um só item vazio', () => {
      expect(problemasDaFonte({ nome: 'eslint', minimo: 0, itens: filesDoEslint([{ files: [''] }]) }, BASE)).toEqual(['eslint: "" item vazio'])
    })

    it('um path em regex do camadas.cjs', () => {
      const camadas = requerer(join(RAIZ, 'tools/guardas/camadas.cjs')) as Camadas
      const obsoleta = { forbidden: [{ to: { path: '^packages/core/src/sessao/tenant/resolucao-de-tenant\\.repository\\.ts$' } }] }
      expect(pathsDoCamadas(camadas).length).toBeGreaterThan(20)
      expect(problemasDaFonte({ nome: 'camadas', minimo: 1, itens: pathsDoCamadas(obsoleta) }, BASE)).toEqual(['camadas: "^packages/core/src/sessao/tenant/resolucao-de-tenant\\.repository\\.ts$" não casa com nenhum arquivo'])
    })

    it('um files e um ignores do eslint.config.mjs', () => {
      const antigo = [...configuracaoDoEslint, { files: ['apps/worker/src/antigo/**/*.ts'], ignores: ['apps/worker/src/antigo/**/*.test.ts'] }]
      expect(problemasDaFonte({ nome: 'files', minimo: 0, itens: filesDoEslint(antigo).filter((i) => i.valor.includes('antigo')) }, BASE_DA_ARVORE)).toEqual(['files: "apps/worker/src/antigo/**/*.ts" não casa com nenhum arquivo'])
      expect(problemasDaFonte({ nome: 'ignores', minimo: 0, itens: ignoresDoEslint(antigo).filter((i) => i.valor.includes('antigo')) }, BASE_DA_ARVORE)).toEqual(['ignores: "apps/worker/src/antigo/**/*.test.ts" não casa com nenhum arquivo'])
    })

    it('um workspace inexistente no knip.json e um glob de project com o caminho antigo', () => {
      const knip = JSON.parse(readFileSync(join(FIXTURES, 'knip.json'), 'utf8')) as Knip
      const antigo: Knip = { ...knip, workspaces: { ...knip.workspaces, 'packages/antigo': { entry: ['src/index.ts'], project: ['src/**/*.ts'] } } }
      expect(problemasDaFonte({ nome: 'workspaces', minimo: 0, itens: workspacesDoKnip(antigo) }, BASE_DA_ARVORE)).toEqual(['workspaces: "packages/antigo" não casa com nenhum arquivo'])
      expect(problemasDaFonte({ nome: 'project', minimo: 0, itens: projectDoKnip(antigo) }, BASE_DA_ARVORE)).toEqual(['project: "packages/antigo/src/**/*.ts" não casa com nenhum arquivo'])
      expect(problemasDaFonte({ nome: 'entries', minimo: 0, itens: entriesDoKnip(antigo) }, BASE_DA_ARVORE)).toEqual(['entries: "packages/antigo/src/index.ts" não casa com nenhum arquivo'])
    })

    it('um glob inexistente no paths: de uma regra', () => {
      const regra = readFileSync(join(FIXTURES, '30-camada-ia.md'), 'utf8')
      expect(pathsDaRegra(regra).map((item) => item.valor)).toEqual(['apps/*/src/ia/**', 'packages/*/src/ia/**', '**/prompts/**', '**/tutor/**'])
      const antiga = regra.replace('packages/*/src/ia/**', 'packages/antigo/src/ia/**')
      expect(problemasDaFonte({ nome: 'regra', minimo: 0, itens: pathsDaRegra(antiga) }, BASE_DA_ARVORE)).toEqual(['regra: "packages/antigo/src/ia/**" não casa com nenhum arquivo'])
    })

    it('uma fonte que rende menos itens que o mínimo dela: as entries do knip.json puladas', () => {
      const knip = JSON.parse(readFileSync(join(FIXTURES, 'knip.json'), 'utf8')) as Knip
      const semEntries = { ...knip, workspaces: Object.fromEntries(Object.entries(knip.workspaces ?? {}).map(([pasta, area]) => [pasta, { ...area, entry: [] }])) }
      const entries = fontesDaArvore().find((fonte) => fonte.nome === 'knip.json, entries')
      expect(entries?.minimo).toBeGreaterThan(entriesDoKnip(semEntries).length)
      const problemas = problemasDaFonte({ nome: 'entries', minimo: entries?.minimo ?? 0, itens: entriesDoKnip(semEntries) }, BASE_DA_ARVORE)
      expect(problemas).toEqual([`entries: rendeu 0 itens e o mínimo é ${String(entries?.minimo)}: o extrator deixou de ler`])
    })

    it('um glob que só casa com arquivo dentro de __fixtures__/, sem nomear a pasta', () => {
      expect(BASE.inteira.some((arquivo) => globCasa('**/so-na-fixture.ts', arquivo))).toBe(true)
      expect(problemaDoItem(glob('**/so-na-fixture.ts'), BASE)).toBe('não casa com nenhum arquivo')
    })

    it('o glob que só casa no protótipo, ou dentro de dist/, sem nomear a pasta', () => {
      expect(problemaDoItem(glob('**/p.tsx'), BASE)).toBe('não casa com nenhum arquivo')
      expect(problemaDoItem(glob('packages/*/dist/*.js'), BASE)).toBe('não casa com nenhum arquivo')
      expect(problemaDoItem({ valor: '^packages/core/dist/', tipo: 'regex' }, BASE)).toBe('não casa com nenhum arquivo')
    })

    it('um caminho de dist cuja fonte em src/ não existe', () => {
      expect(problemaDoItem({ valor: 'packages/core/dist/index.js', tipo: 'dist' }, BASE)).toBeUndefined()
      expect(problemaDoItem({ valor: 'packages/core/dist/sumiu.js', tipo: 'dist' }, BASE)).toBe('a fonte em src/ não existe')
      expect(caminhosDeDist("await importar('apps/api/dist/credencial/hash-de-senha.js')").map((item) => item.valor)).toEqual(['apps/api/dist/credencial/hash-de-senha.js'])
    })
  })

  describe('o alvo não existe', () => {
    it('a fonte que não carrega falha alto, com o nome dela', () => {
      expect(() =>
        carregarFonte('knip.json, entries', 1, () => entriesDoKnip(lerJson<Knip>('tools/guardas/__fixtures__/filtros/nao-existe.json'))),
      ).toThrow(/a fonte knip\.json, entries não carregou: ENOENT/)
    })

    it('a regra sem paths: não rende itens, e a fonte com mínimo vermelha', () => {
      expect(pathsDaRegra('# Regra sem cabeçalho\n')).toEqual([])
      expect(problemasDaFonte({ nome: 'regras', minimo: 1, itens: [] }, BASE)).toEqual(['regras: rendeu 0 itens e o mínimo é 1: o extrator deixou de ler'])
    })
  })

  describe('a árvore real', () => {
    it.each(fontesDaArvore().map((fonte) => [fonte.nome, fonte] as const))('%s: cada item casa com um arquivo, e a fonte rende o mínimo', (_nome, fonte) => {
      expect(fonte.itens.length).toBeGreaterThanOrEqual(fonte.minimo)
      expect(problemasDaFonte(fonte, BASE_DA_ARVORE)).toEqual([])
    })

    it('o mínimo gravado é o número de hoje, e não um piso frouxo', () => {
      for (const fonte of fontesDaArvore()) expect(fonte.itens.length, fonte.nome).toBeLessThanOrEqual(fonte.minimo + 3)
    })
  })
})
