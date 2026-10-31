import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, matchesGlob } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import configuracaoDoVitest from '../../vitest.config.ts'
import { raizRepositorio } from '../ci/executar.ts'

// A guarda de camadas e de ciclos (X5, 12.0; RF10): `tools/guardas/camadas.cjs`, rodada pelo `guarda:camadas`. Cada
// regra tem uma fixture que a viola e uma que não a viola, em `__fixtures__/camadas/`. O teste copia a árvore para uma
// pasta temporária (ali o `node_modules` do repositório não aparece) e monta só o que o `npm install` monta: o pacote
// `drizzle-orm` e os links `@educa/*` para `packages/`. Roda o CLI com os argumentos do `guarda:camadas` do
// `package.json`, e exige a lista exata de violações: regra tirada, pasta tirada do comando ou exceção larga demais
// mudam a lista.

interface Violacao {
  rule: { name: string; severity: string }
  from: string
  to: string
}

interface RelatorioDoCruiser {
  summary: { violations: Violacao[]; error: number; totalCruised: number }
  modules: { source: string; dependencies: { resolved: string; module: string }[] }[]
}

interface Execucao {
  relatorio: RelatorioDoCruiser
}

const PACOTE = JSON.parse(readFileSync(join(raizRepositorio, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
  devDependencies: Record<string, string>
}
const CONFIGURACAO = 'tools/guardas/camadas.cjs'
const DEPCRUISE = join(raizRepositorio, 'node_modules/.bin/depcruise')

/** Os argumentos do `guarda:camadas` do `package.json`, com a configuração em caminho absoluto. */
function argumentosDaGuarda(): string[] {
  const [comando, ...argumentos] = (PACOTE.scripts['guarda:camadas'] ?? '').split(/\s+/)
  expect(comando).toBe('depcruise')
  return argumentos.map((argumento) => (argumento === CONFIGURACAO ? join(raizRepositorio, CONFIGURACAO) : argumento))
}

/** O código de saída do comando como o `npm run lint` o vê: o relatório em JSON sai sempre com 0, e só o padrão sai com o número de erros. */
function codigoDeSaida(pasta: string): number | null {
  return spawnSync(DEPCRUISE, argumentosDaGuarda(), { cwd: pasta, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).status
}

function rodar(pasta: string): Execucao {
  const resultado = spawnSync(DEPCRUISE, [...argumentosDaGuarda(), '--output-type', 'json'], { cwd: pasta, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  expect(resultado.stderr, 'o depcruise não deve falhar na configuração').toBe('')
  return { relatorio: JSON.parse(resultado.stdout) as RelatorioDoCruiser }
}

const linhas = (execucao: Execucao, regra?: string): string[] =>
  execucao.relatorio.summary.violations
    .filter((violacao) => regra === undefined || violacao.rule.name === regra)
    .map((violacao) => `${violacao.from} -> ${violacao.to}`)
    .sort()

function escrever(pasta: string, arquivo: string, texto: string): void {
  mkdirSync(dirname(join(pasta, arquivo)), { recursive: true })
  writeFileSync(join(pasta, arquivo), texto)
}

// A cópia da fixture, montada uma vez por arquivo e só quando um caso a pede.
let pastaDaFixture: string | undefined
let execucaoDaFixture: Execucao | undefined

function fixture(): Execucao {
  if (execucaoDaFixture !== undefined) return execucaoDaFixture
  const pasta = mkdtempSync(join(tmpdir(), 'camadas-'))
  pastaDaFixture = pasta
  cpSync(join(raizRepositorio, 'tools/guardas/__fixtures__/camadas'), pasta, { recursive: true })
  // O que o `npm install` monta num workspace: os pacotes por link e uma dependência de terceiros com a pasta `node_modules`.
  mkdirSync(join(pasta, 'node_modules/@educa'), { recursive: true })
  symlinkSync('../../packages/core', join(pasta, 'node_modules/@educa/core'))
  symlinkSync('../../packages/shared', join(pasta, 'node_modules/@educa/shared'))
  // Os `exports` do `drizzle-orm` de verdade são por condição (`import`, `default`): o cruiser as segue pelos `conditionNames`.
  escrever(pasta, 'node_modules/drizzle-orm/package.json', JSON.stringify({ name: 'drizzle-orm', exports: { '.': { import: './index.js' }, './pg-core': { default: './pg-core.js' } } }))
  escrever(pasta, 'node_modules/drizzle-orm/index.js', 'export const eq = 1\n')
  escrever(pasta, 'node_modules/drizzle-orm/pg-core.js', 'export const pgTable = 1\n')
  // Um pacote de terceiro com ciclo dentro, na `node_modules` de uma app, como o `npm install` deixa o que não sobe para a raiz: a pasta
  // `apps` é argumento do comando, e o cruiser lê o que há nela. O `doNotFollow` o mantém como destino, sem olhar o que ele importa.
  escrever(pasta, 'apps/api/node_modules/ciclico/index.js', "import './dentro.js'\n")
  escrever(pasta, 'apps/api/node_modules/ciclico/dentro.js', "import './index.js'\n")
  // `dist/` é o que o build gera e o `.gitignore` não deixa versionar: nasce aqui, com um import que a regra do pacote reprovaria.
  escrever(pasta, 'packages/shared/dist/importa-nucleo.js', "import { x } from '../../core/src/x.js'\nexport const y = x\n")
  execucaoDaFixture = rodar(pasta)
  return execucaoDaFixture
}

function pastaDaFixtureMontada(): string {
  fixture()
  if (pastaDaFixture === undefined) throw new Error('a fixture não foi montada')
  return pastaDaFixture
}

afterAll(() => {
  if (pastaDaFixture !== undefined) rmSync(pastaDaFixture, { recursive: true, force: true })
})

const REGRAS = (createRequire(import.meta.url)('./camadas.cjs') as { forbidden: { name: string; severity: string; to: { path?: string } }[] }).forbidden

/** Cada regra e as violações que a fixture marca, `de -> para`. O que não está aqui é o controle: tem de passar. */
const ESPERADAS: Readonly<Record<string, readonly string[]>> = {
  'sem-ciclo': ['packages/shared/src/ciclo/a.ts -> packages/shared/src/ciclo/b.ts'],
  'shared-nao-importa-nucleo-nem-app': [
    'packages/shared/src/pacotes/para-app.ts -> apps/api/src/y.ts',
    'packages/shared/src/pacotes/para-nucleo.ts -> packages/core/src/x.ts',
  ],
  'nucleo-nao-importa-app': ['packages/core/src/pacotes/para-app.ts -> apps/api/src/y.ts'],
  'app-nao-importa-app': ['apps/web/src/usa-api.ts -> apps/api/src/y.ts', 'apps/worker/src/usa-api.ts -> apps/api/src/y.ts'],
  'web-nao-importa-nucleo-nem-backend': ['apps/web/src/usa-api.ts -> apps/api/src/y.ts', 'apps/web/src/usa-nucleo.ts -> packages/core/src/x.ts'],
  'producao-nao-importa-teste': [
    'apps/api/src/producao-usa-e2e.ts -> e2e/ajudante.ts',
    'apps/api/src/producao-usa-teste.ts -> apps/api/test/helper.ts',
    'packages/core/src/producao-usa-teste.ts -> packages/core/test/helper.ts',
  ],
  'controller-nao-importa-repository': ['apps/api/src/camadas/a.controller.ts -> apps/api/src/camadas/a.repository.ts'],
  'controller-nao-importa-drizzle': ['apps/api/src/camadas/b.controller.ts -> node_modules/drizzle-orm/index.js'],
  'service-nao-importa-drizzle': ['apps/api/src/camadas/c.service.ts -> node_modules/drizzle-orm/pg-core.js'],
  'repository-nao-importa-service-nem-controller': [
    'apps/api/src/camadas/d.repository.ts -> apps/api/src/camadas/c.service.ts',
    'apps/api/src/camadas/e.repository.ts -> apps/api/src/camadas/a.controller.ts',
    'packages/core/src/retencao/outro.repository.ts -> packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts',
  ],
  'sessao-nao-importa-operacao': ['apps/api/src/sessao/login/x.ts -> apps/api/src/operacao/eu/y.ts'],
  'api-nao-importa-ops': [
    'apps/api/src/app.module.ts -> apps/api/src/ops/uso.ts',
    'apps/api/src/operacao/painel/painel.service.ts -> apps/api/src/ops/escola.ts',
  ],
  'sessao-so-pelo-index': [
    'apps/api/src/estrutura/turma/conta.service.ts -> apps/api/src/sessao/login/reexporta-conta-global.ts',
    'apps/api/src/estrutura/turma/turma.service.ts -> apps/api/src/sessao/login/reexporta-resolucao.ts',
    'apps/api/test/direto-na-sessao.ts -> apps/api/src/sessao/login/x.ts',
  ],
  'credencial-so-pelo-index': ['apps/api/src/operacao/outro-token.ts -> apps/api/src/credencial/token-hash.ts'],
  // Cada cerca: o import, o `export *`, o `import()` e o `tools/x.ts` de fora. O teste (`infra/test/`, `e2e/`) passa.
  'cerca-tenant-resolution': [
    'infra/resolucao-dinamico.ts -> apps/api/src/sessao/tenant/tenant-resolution.repository.ts',
    'infra/resolucao-import.ts -> apps/api/src/sessao/tenant/tenant-resolution.repository.ts',
    'infra/resolucao-reexporta.ts -> apps/api/src/sessao/tenant/tenant-resolution.repository.ts',
    'tools/resolucao.ts -> apps/api/src/sessao/tenant/tenant-resolution.repository.ts',
  ],
  'cerca-conta-global': [
    'apps/worker/src/eliminar.ts -> packages/core/src/ciclo-de-vida/conta-global.repository.ts',
    'infra/conta-global-dinamico.ts -> packages/core/src/ciclo-de-vida/conta-global.repository.ts',
    'infra/conta-global-import.ts -> packages/core/src/ciclo-de-vida/conta-global.repository.ts',
    'infra/conta-global-reexporta.ts -> packages/core/src/ciclo-de-vida/conta-global.repository.ts',
    'infra/subcaminho.ts -> packages/core/src/ciclo-de-vida/conta-global.repository.ts',
    'packages/core/src/retencao/atalho.ts -> packages/core/src/ciclo-de-vida/conta-global.repository.ts',
    'tools/conta-global.ts -> packages/core/src/ciclo-de-vida/conta-global.repository.ts',
  ],
  'cerca-painel-repository': [
    'apps/api/src/operacao/eu/eu.service.ts -> apps/api/src/operacao/painel/painel.repository.ts',
    'apps/api/src/operacao/eu/reexporta-painel.ts -> apps/api/src/operacao/painel/painel.repository.ts',
    'apps/api/src/operacao/painel/relatorio.ts -> apps/api/src/operacao/painel/painel.repository.ts',
    'infra/painel-dinamico.ts -> apps/api/src/operacao/painel/painel.repository.ts',
    'infra/painel-import.ts -> apps/api/src/operacao/painel/painel.repository.ts',
    'infra/painel-reexporta.ts -> apps/api/src/operacao/painel/painel.repository.ts',
    'tools/painel.ts -> apps/api/src/operacao/painel/painel.repository.ts',
  ],
}

describe('a guarda de camadas reprova na fixture exatamente a violação marcada, e deixa o controle passar', () => {
  it('toda regra da configuração tem a sua fixture, e nenhuma fixture é de regra que não existe', () => {
    expect(Object.keys(ESPERADAS).sort()).toEqual(REGRAS.map((regra) => regra.name).sort())
  })

  it.each(Object.entries(ESPERADAS))('%s reprova só o que a fixture marca', (regra, esperadas) => {
    expect(linhas(fixture(), regra)).toEqual([...esperadas].sort())
  }, 120_000)

  it('o total é a soma das regras: nenhum arquivo de controle é acusado', () => {
    const soma = Object.values(ESPERADAS).reduce((total, esperadas) => total + esperadas.length, 0)
    expect(fixture().relatorio.summary.violations).toHaveLength(soma)
  }, 120_000)

  it('o ciclo que só existe por import type conta', () => {
    expect(linhas(fixture(), 'sem-ciclo')).toEqual(['packages/shared/src/ciclo/a.ts -> packages/shared/src/ciclo/b.ts'])
  }, 120_000)

  it('o CLI sai com código de falha quando há violação', () => {
    expect(codigoDeSaida(pastaDaFixtureMontada())).toBe(fixture().relatorio.summary.violations.length)
  }, 120_000)
})

describe('a guarda de camadas no repositório de hoje', () => {
  let real: Execucao | undefined
  const repositorio = (): Execucao => (real ??= rodar(raizRepositorio))

  it('real: zero violações e zero ciclos, e o cruiser enxergou o código', () => {
    const { relatorio } = repositorio()
    // Sem o `typescript` achado, o cruiser responde "0 módulos" e sai verde (R7): a contagem e a aresta abaixo provam que não.
    expect(relatorio.summary.totalCruised).toBeGreaterThan(1000)
    expect(linhas(repositorio())).toEqual([])
    expect(relatorio.summary.error).toBe(0)
  }, 120_000)

  it('real: o comando do lint sai com 0', () => {
    expect(codigoDeSaida(raizRepositorio)).toBe(0)
  }, 120_000)

  it('real: todo alvo de regra existe no grafo, e as arestas legítimas das cercas estão nele', () => {
    const { modules } = repositorio().relatorio
    // Cerca de caminho fixo que não casa com arquivo nenhum passa calada: o arquivo mudou de lugar e a regra ficou olhando o vazio.
    for (const regra of REGRAS.filter((candidata) => candidata.to.path !== undefined)) {
      const alvo = new RegExp(regra.to.path ?? '')
      expect(
        modules.some((modulo) => alvo.test(modulo.source)),
        `a regra ${regra.name} não casa com nenhum módulo do repositório`,
      ).toBe(true)
    }
    // E o lado permitido de cada cerca: quem pode importar a classe a importa, ou a cerca estaria olhando um arquivo que ninguém usa.
    const importa = (origem: RegExp, alvo: string): boolean =>
      modules.some((modulo) => origem.test(modulo.source) && modulo.dependencies.some((dependencia) => dependencia.resolved === alvo))
    expect(importa(/^apps\/api\/src\/operacao\/painel\/painel\.service\.ts$/, 'apps/api/src/operacao/painel/painel.repository.ts')).toBe(true)
    expect(importa(/^apps\/api\/src\/sessao\//, 'apps/api/src/sessao/tenant/tenant-resolution.repository.ts')).toBe(true)
    expect(importa(/^apps\/api\/src\/sessao\//, 'packages/core/src/ciclo-de-vida/conta-global.repository.ts')).toBe(true)
  }, 120_000)

  it('real: a aresta da redefinição de MFA até a conta global está no relatório', () => {
    const modulo = repositorio().relatorio.modules.find((candidato) => candidato.source === 'apps/api/src/sessao/mfa/redefinicao-de-mfa.ts')
    expect(modulo?.dependencies.map((dependencia) => dependencia.resolved)).toContain('packages/core/src/ciclo-de-vida/conta-global.repository.ts')
  }, 120_000)
})

describe('a guarda de camadas na esteira', () => {
  it('toda regra é error: uma em warn sairia com código 0 e o lint passaria calado', () => {
    expect(REGRAS.length).toBeGreaterThan(15)
    expect(REGRAS.filter((regra) => regra.severity !== 'error').map((regra) => regra.name)).toEqual([])
  })

  it('guarda:camadas é o comando das cinco pastas, e o lint termina nele', () => {
    expect(PACOTE.scripts['guarda:camadas']).toBe('depcruise --config tools/guardas/camadas.cjs apps packages tools infra e2e')
    // O comando inteiro, num teste só: o de `guardas.test.ts` confere o começo, e afrouxar os dois ao mesmo tempo exige mexer neste.
    expect(PACOTE.scripts['lint']).toBe('eslint . --max-warnings=0 && node tools/guardas/lint.ts && npm run guarda:camadas')
  })

  it('dependency-cruiser em 18.7.0 exato', () => {
    expect(PACOTE.devDependencies['dependency-cruiser']).toBe('18.7.0')
    const instalado = JSON.parse(readFileSync(join(raizRepositorio, 'node_modules/dependency-cruiser/package.json'), 'utf8')) as { version: string }
    expect(instalado.version).toBe('18.7.0')
  })

  it('o vitest não coleta a árvore das fixtures, que tem um arquivo chamado arquitetura.test.ts', () => {
    const arquivo = 'tools/guardas/__fixtures__/camadas/apps/api/test/architecture.test.ts'
    const projetos = (configuracaoDoVitest.test?.projects ?? []) as { test?: { name?: string; include?: string[]; exclude?: string[] } }[]
    expect(projetos.length).toBeGreaterThan(2)
    // O arquivo de verdade, no lugar de sempre, é coletado: sem isto o `include` mudado de lugar passaria o caso calado.
    const coletado = (caminho: string): string[] =>
      projetos.filter((projeto) => (projeto.test?.include ?? []).some((padrao) => matchesGlob(caminho, padrao)) && !(projeto.test?.exclude ?? []).some((padrao) => matchesGlob(caminho, padrao))).map((projeto) => projeto.test?.name ?? '')
    expect(coletado('apps/api/test/architecture.test.ts')).toEqual(['unidade'])
    expect(coletado(arquivo)).toEqual([])
  })
})
