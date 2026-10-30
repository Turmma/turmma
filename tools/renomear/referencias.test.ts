import { afterEach, describe, expect, it } from 'vitest'
import { Arvore } from './arvore.ts'
import { ehComum, type EntradaDoMapa, type TipoDeEntrada } from './mapa.ts'
import { acharReferencias } from './referencias.ts'
import { apagarRepositoriosDeTeste, montarRepositorio } from './repositorio-de-teste.ts'

// O passo 6 do `aplicar`: o que a busca por texto lista, e o que ela deixa de fora de propósito. Cada forma de `casos.md` é um caso.

afterEach(apagarRepositoriosDeTeste)

const entrada = (tipo: TipoDeEntrada, de: string, para = 'novo'): EntradaDoMapa => ({ tipo, de, para, linhaDoAnexo: 'inventario-x.md:1', comum: tipo === 'simbolo' && ehComum(de) })

/** O que o passo 6 lista no arquivo, `nome` por nome. */
function listados(arquivos: Record<string, string>, entradas: EntradaDoMapa[]): string[] {
  const repo = montarRepositorio(arquivos)
  return acharReferencias(Arvore.carregar(repo.raiz), entradas).map((referencia) => `${referencia.arquivo}: ${referencia.de}`)
}

describe('o que o passo 6 lista', () => {
  const casos: Array<[string, Record<string, string>, EntradaDoMapa[], string]> = [
    ['/\\bX\\b/ numa regex', { 'apps/a.ts': 'export const r = /\\bX\\b/\n' }, [entrada('simbolo', 'X')], 'apps/a.ts: X'],
    ['x\\.repository numa regex', { 'apps/a.ts': 'export const r = /x\\.repository/\n' }, [entrada('arquivo', 'x.repository.ts')], 'apps/a.ts: x.repository.ts'],
    ["startsWith('esquemaResposta')", { 'apps/a.ts': "export const f = (n: string) => n.startsWith('esquemaResposta')\n" }, [entrada('simbolo', 'esquemaRespostaLogin')], 'apps/a.ts: esquemaResposta'],
    ["endsWith com o sufixo da gramática", { 'apps/a.ts': "export const f = (n: string) => n.endsWith('EmMemoria')\n" }, [entrada('simbolo', 'ArmazemEmMemoria')], 'apps/a.ts: EmMemoria'],
    ["'Banco' duas vezes na mesma linha: uma referência só", { 'apps/a.ts': "export const l = ['Banco', 'Banco']\n" }, [entrada('simbolo', 'Banco')], 'apps/a.ts: Banco'],
    ["'Banco' num array", { 'apps/a.ts': "export const l = ['Banco']\n" }, [entrada('simbolo', 'Banco')], 'apps/a.ts: Banco'],
    ['/\\bFila\\b/ numa regex', { 'apps/a.ts': 'export const r = /\\bFila\\b/\n' }, [entrada('simbolo', 'Fila')], 'apps/a.ts: Fila'],
    ["'migrar(' numa string", { 'apps/a.ts': "export const s = 'migrar('\n" }, [entrada('simbolo', 'migrar')], 'apps/a.ts: migrar'],
    ["'@Banco' que não é e-mail", { 'apps/a.ts': "export const s = '@Banco'\n" }, [entrada('simbolo', 'Banco')], 'apps/a.ts: Banco'],
    ["'./Fila/x' como segmento de caminho", { 'apps/a.ts': "export const s = './Fila/x'\n" }, [entrada('simbolo', 'Fila')], 'apps/a.ts: Fila'],
    ["'dist/src/fila/x' com a pasta no mapa", { 'apps/a.ts': "export const s = 'dist/src/fila/x'\n" }, [entrada('pasta', 'packages/nucleo/src/fila')], 'apps/a.ts: packages/nucleo/src/fila'],
    [
      "'dist/credencial/hash-de-senha.js' com o arquivo no mapa",
      { 'apps/a.ts': "export const s = 'dist/credencial/hash-de-senha.js'\n" },
      [entrada('arquivo', 'apps/api/src/credencial/hash-de-senha.ts')],
      'apps/a.ts: apps/api/src/credencial/hash-de-senha.ts',
    ],
    ["'@educa/nucleo' com o pacote no mapa", { 'apps/a.ts': "export const s = '@educa/nucleo'\n" }, [entrada('pacote', '@educa/nucleo')], 'apps/a.ts: @educa/nucleo'],
    ["'schema.Banco' como acesso a membro", { 'apps/a.ts': "export const s = 'schema.Banco'\n" }, [entrada('simbolo', 'Banco')], 'apps/a.ts: Banco'],
    ['/Banco\\.x/ como acesso a membro numa regex', { 'apps/a.ts': 'export const r = /Banco\\.x/\n' }, [entrada('simbolo', 'Banco')], 'apps/a.ts: Banco'],
    ["'@SemEscopo(' como identificador", { 'apps/a.ts': "export const s = '@SemEscopo('\n" }, [entrada('simbolo', 'SemEscopo')], 'apps/a.ts: SemEscopo'],
    ['String.raw, na forma sem escape', { 'apps/a.ts': 'export const r = String.raw`packages\\/nucleo\\/src`\n' }, [entrada('pasta', 'packages/nucleo')], 'apps/a.ts: packages/nucleo'],
    ['-w do package.json da raiz', { 'package.json': '{ "scripts": { "b": "npm run build -w @educa/nucleo" } }\n' }, [entrada('pacote', '@educa/nucleo')], 'package.json: @educa/nucleo'],
    ['template sem substituição', { 'apps/a.ts': 'export const s = `Banco`\n' }, [entrada('simbolo', 'Banco')], 'apps/a.ts: Banco'],
    ['template com substituição, na cabeça', { 'apps/a.ts': 'export const s = (x: string) => `Banco/${x}`\n' }, [entrada('simbolo', 'Banco')], 'apps/a.ts: Banco'],
    ['.mjs', { 'tools/guardas/regras.mjs': "export const pasta = 'packages/nucleo'\n" }, [entrada('pasta', 'packages/nucleo')], 'tools/guardas/regras.mjs: packages/nucleo'],
    ['caminho antigo no knip.json', { 'knip.json': '{ "workspaces": { "packages/nucleo": {} } }\n' }, [entrada('pasta', 'packages/nucleo')], 'knip.json: packages/nucleo'],
    ['caminho em .github/', { '.github/workflows/ci.yml': 'run: cd packages/nucleo && ls\n' }, [entrada('pasta', 'packages/nucleo')], '.github/workflows/ci.yml: packages/nucleo'],
    ['*.Dockerfile', { 'infra/docker/servico.Dockerfile': 'COPY packages/nucleo/drizzle ./\n' }, [entrada('pasta', 'packages/nucleo')], 'infra/docker/servico.Dockerfile: packages/nucleo'],
    ['.cjs', { 'tools/guardas/camadas.cjs': "module.exports = { path: 'packages/nucleo' }\n" }, [entrada('pasta', 'packages/nucleo')], 'tools/guardas/camadas.cjs: packages/nucleo'],
  ]
  it.each(casos)('%s', (_nome, arquivos, entradas, esperado) => {
    expect(listados(arquivos, entradas)).toEqual([esperado])
  })
})

describe('o que o passo 6 deixa de fora', () => {
  const casos: Array<[string, Record<string, string>, EntradaDoMapa[]]> = [
    ['"com" numa string de tela, em prosa', { 'apps/a.ts': "export const s = 'Entrar com Google'\n" }, [entrada('simbolo', 'com')]],
    ["'teste@exemplo.com', e-mail", { 'apps/a.ts': "export const s = 'teste@exemplo.com'\n" }, [entrada('simbolo', 'com')]],
    ["'https://github.com/x', URL", { 'apps/a.ts': "export const s = 'https://github.com/x'\n" }, [entrada('simbolo', 'com')]],
    ["'hash-de-senha.js', nome solto", { 'apps/a.ts': "export const s = 'hash-de-senha.js'\n" }, [entrada('arquivo', 'apps/api/src/credencial/hash-de-senha.ts')]],
    ["'nucleo', nome solto do pacote", { 'apps/a.ts': "export const s = 'nucleo'\n" }, [entrada('pacote', '@educa/nucleo')]],
    ["'./fila/x', nome solto da pasta", { 'apps/a.ts': "export const s = './fila/x'\n" }, [entrada('simbolo', 'Fila'), entrada('pasta', 'packages/nucleo/src/fila')]],
    ['a pasta do mapa de ondas, tools/renomear/', { 'tools/renomear/mapas/1.json': '{ "x": "@educa/nucleo" }\n' }, [entrada('pacote', '@educa/nucleo')]],
    ["startsWith('es'), prefixo curto demais para ser nome", { 'apps/a.ts': "export const f = (n: string) => n.startsWith('es')\n" }, [entrada('simbolo', 'esquemaTurma')]],
    ['o JsxText, que é texto de tela', { 'apps/web/a.tsx': 'export const A = () => <p>Banco</p>\n' }, [entrada('simbolo', 'Banco')]],
  ]
  it.each(casos)('%s', (_nome, arquivos, entradas) => {
    expect(listados(arquivos, entradas)).toEqual([])
  })

  it('um arquivo não versionado da raiz não é varrido', () => {
    const repo = montarRepositorio({ 'apps/a.ts': 'export const a = 1\n' })
    repo.escrever('rascunho.json', '{ "x": "@educa/nucleo" }\n')
    expect(acharReferencias(Arvore.carregar(repo.raiz), [entrada('pacote', '@educa/nucleo')])).toEqual([])
  })
})
