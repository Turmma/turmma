import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import configuracao from '../../playwright.config.ts'
import { REDE_FAST_3G, type MachineProfile } from '../../e2e/support/profiles.ts'
import { raizRepositorio } from './executar.ts'

// A configuração do Playwright é portão da D51: se um projeto sumir, perder a limitação ou filtrar spec, o e2e
// continua verde sem testar o Chromebook fraco ou o celular. Estas asserções reprovam isso antes.

interface UsoDoProjeto {
  browserName?: string
  defaultBrowserType?: string
  viewport?: { width: number; height: number }
  isMobile?: boolean
  hasTouch?: boolean
  profile?: MachineProfile
}

const projetos = (configuracao.projects ?? []) as { name?: string; use?: UsoDoProjeto; testMatch?: unknown; testIgnore?: unknown; testDir?: unknown }[]
const projeto = (nome: string) => projetos.find((candidato) => candidato.name === nome)

describe('projetos do Playwright (playwright.config.ts)', () => {
  it('são exatamente chromebook e celular, e nenhum filtra spec: todo spec de tela roda nos dois', () => {
    expect(projetos.map((candidato) => candidato.name)).toEqual(['chromebook', 'celular'])
    expect(configuracao.testDir).toBe('e2e')
    expect(configuracao.testMatch).toBeUndefined()
    expect(configuracao.testIgnore).toBeUndefined()
    for (const candidato of projetos) {
      expect(candidato.testMatch, candidato.name).toBeUndefined()
      expect(candidato.testIgnore, candidato.name).toBeUndefined()
      expect(candidato.testDir, candidato.name).toBeUndefined()
    }
  })

  it('chromebook: Chromium com CPU ×4 e Fast 3G do DevTools', () => {
    const uso = projeto('chromebook')?.use
    expect(uso?.defaultBrowserType ?? uso?.browserName).toBe('chromium')
    expect(uso?.profile).toEqual({ cpuMaisLenta: 4, rede: REDE_FAST_3G })
    expect(REDE_FAST_3G).toEqual({ nome: 'Fast 3G', latenciaMs: 562.5, downloadBytesPorSegundo: 180_000, uploadBytesPorSegundo: 84_375 })
  })

  it('celular: Chromium de 360 × 800 com toque e modo móvel, CPU ×4 e rede no máximo tão boa quanto o Fast 3G', () => {
    const uso = projeto('celular')?.use
    expect(uso?.browserName).toBe('chromium')
    expect(uso?.viewport).toEqual({ width: 360, height: 800 })
    expect(uso?.isMobile).toBe(true)
    expect(uso?.hasTouch).toBe(true)
    expect(uso?.profile?.cpuMaisLenta).toBe(4)
    expect(uso?.profile?.rede.latenciaMs).toBeGreaterThanOrEqual(REDE_FAST_3G.latenciaMs)
    expect(uso?.profile?.rede.downloadBytesPorSegundo).toBeLessThanOrEqual(REDE_FAST_3G.downloadBytesPorSegundo)
    expect(uso?.profile?.rede.uploadBytesPorSegundo).toBeLessThanOrEqual(REDE_FAST_3G.uploadBytesPorSegundo)
  })

  it('todo spec usa o test com perfil de e2e/__fixtures__/perfis.ts, e não o de @playwright/test, que pula a limitação', () => {
    const specs = readdirSync(join(raizRepositorio, 'e2e')).filter((arquivo) => arquivo.endsWith('.spec.ts'))
    expect(specs.length).toBeGreaterThan(0)
    for (const spec of specs) {
      const texto = readFileSync(join(raizRepositorio, 'e2e', spec), 'utf8')
      expect(texto, spec).toMatch(/import \{[^}]*\btest\b[^}]*\} from '\.\/support\/profiles\.ts'/)
      // De @playwright/test, só import de tipo.
      for (const importacao of texto.matchAll(/import (type )?[^;\n]*from '@playwright\/test'/g)) {
        expect(importacao[1], `${spec}: ${importacao[0]}`).toBe('type ')
      }
    }
  })

  // O `exports` dos pacotes @educa/* manda o import comum para o `dist`; o `src` só vale com a condição `source`, que o
  // Vitest e o tsc ligam e o Playwright não. Na máquina com um `dist` antigo o e2e passa; na esteira, que não constrói o
  // `dist`, nenhum spec carrega (correção 2026-10-03-e2e-sem-dist-do-shared). Por isso o e2e importa o shared pelo
  // caminho do `src`, e nada que ele carrega, nem por um módulo da API, pode importar o pacote pelo nome.
  it('nada que o e2e carrega importa um pacote @educa/* pelo nome: o Playwright o resolveria para o dist, que a esteira não constrói', () => {
    const varredura = varrerImports(arquivosDeCodigoEm(join(raizRepositorio, 'e2e')))
    // A travessia sai de e2e/: sem isto, uma varredura que parasse no primeiro salto passaria sem olhar a API.
    expect(varredura.vistos).toContain(join(raizRepositorio, 'apps/api/src/credencial/token-hash.ts'))
    expect(varredura.naoResolvidos.map((item) => relativoARaiz(item))).toEqual([])
    expect(varredura.peloNome.map((item) => relativoARaiz(item))).toEqual([])
  })

  describe('a varredura dos imports', () => {
    const raizes: string[] = []
    afterEach(() => {
      for (const raiz of raizes.splice(0)) rmSync(raiz, { recursive: true, force: true })
    })
    const arvore = (arquivos: Record<string, string>): string => {
      const raiz = mkdtempSync(join(tmpdir(), 'varredura-e2e-'))
      raizes.push(raiz)
      for (const [caminho, texto] of Object.entries(arquivos)) {
        mkdirSync(dirname(join(raiz, caminho)), { recursive: true })
        writeFileSync(join(raiz, caminho), texto)
      }
      return raiz
    }
    const varreduraDe = (raiz: string) => varrerImports(arquivosDeCodigoEm(join(raiz, 'e2e')))

    it('acha o import pelo nome a três saltos, por import sem extensão, .js trocado por .ts, pasta com index e .tsx, em várias linhas, no export e no import(); o import só de tipo não conta', () => {
      const raiz = arvore({
        'e2e/a.spec.ts': "import { b } from '../web/b'\nimport type { T } from '@educa/shared'\n",
        'web/b.ts': "export { c } from './c.js'\n",
        'web/c.ts': "import './pasta'\nexport const c = 1\n",
        'web/pasta/index.ts': "export * from \"../d\"\n",
        'web/d.tsx': "import {\n  x,\n  y,\n} from '@educa/shared'\nexport { z } from '@educa/reexportado'\nconst e = import('@educa/outro')\n",
      })
      const varredura = varreduraDe(raiz)
      expect(varredura.peloNome).toEqual([
        `${join(raiz, 'web/d.tsx')} → @educa/shared`,
        `${join(raiz, 'web/d.tsx')} → @educa/reexportado`,
        `${join(raiz, 'web/d.tsx')} → @educa/outro`,
      ])
      expect(varredura.naoResolvidos).toEqual([])
    })

    it('o import relativo que não resolve reprova, em vez de ser pulado', () => {
      const raiz = arvore({ 'e2e/a.spec.ts': "import { b } from '../web/sumiu'\n" })
      expect(varreduraDe(raiz).naoResolvidos).toEqual([`${join(raiz, 'e2e/a.spec.ts')} → ../web/sumiu`])
    })
  })
})

const EXTENSOES_DE_CODIGO = ['.ts', '.tsx']

function arquivosDeCodigoEm(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) =>
    entrada.isDirectory()
      ? arquivosDeCodigoEm(join(pasta, entrada.name))
      : EXTENSOES_DE_CODIGO.includes(extname(entrada.name))
        ? [join(pasta, entrada.name)]
        : [],
  )
}

const ehArquivo = (caminho: string) => existsSync(caminho) && statSync(caminho).isFile()

/** As formas que o carregador do Playwright aceita: `.js` que é `.ts`, sem extensão, e pasta com `index`. */
function resolverRelativo(de: string, origem: string): string | null {
  const base = resolve(dirname(de), origem)
  const extensao = extname(base)
  const semJs = extensao === '.js' ? base.slice(0, -3) : base
  const candidatos =
    extensao === '.js' || extensao === ''
      ? [...EXTENSOES_DE_CODIGO.map((ext) => semJs + ext), ...EXTENSOES_DE_CODIGO.map((ext) => join(semJs, `index${ext}`)), base]
      : [base]
  return candidatos.find(ehArquivo) ?? null
}

/**
 * Segue os imports relativos a partir das entradas; junta os de @educa/* pelo nome (fora `import type`) e os que não resolvem.
 * `import { type X } from '@educa/...'` conta como pelo nome, de propósito: o carregador pode manter o import. Especificador
 * que não é relativo nem @educa/* (dependência, `node:`) não é seguido; se o repositório ganhar alias de caminho (`@/`, `#`),
 * esta varredura precisa aprender a resolvê-lo, ou deixa de olhar o que ele importa.
 */
function varrerImports(entradas: string[]): { vistos: string[]; peloNome: string[]; naoResolvidos: string[] } {
  const pendentes = [...entradas]
  const vistos = new Set<string>()
  const peloNome: string[] = []
  const naoResolvidos: string[] = []
  for (let arquivo = pendentes.pop(); arquivo !== undefined; arquivo = pendentes.pop()) {
    if (vistos.has(arquivo)) continue
    vistos.add(arquivo)
    const texto = readFileSync(arquivo, 'utf8')
    const estaticos = [...texto.matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\bfrom\s+)?['"]([^'"]+)['"]/gm)].map(([, tipo, origem]) => ({ tipo, origem }))
    const dinamicos = [...texto.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map(([, origem]) => ({ tipo: undefined, origem }))
    for (const { tipo, origem } of [...estaticos, ...dinamicos]) {
      if (origem === undefined || tipo !== undefined) continue
      if (origem.startsWith('@educa/')) peloNome.push(`${arquivo} → ${origem}`)
      if (!origem.startsWith('.')) continue
      const alvo = resolverRelativo(arquivo, origem)
      if (alvo === null) naoResolvidos.push(`${arquivo} → ${origem}`)
      else if (EXTENSOES_DE_CODIGO.includes(extname(alvo))) pendentes.push(alvo)
    }
  }
  return { vistos: [...vistos], peloNome, naoResolvidos }
}

function relativoARaiz(item: string): string {
  const [arquivo = '', origem = ''] = item.split(' → ')
  return `${relative(raizRepositorio, arquivo)} → ${origem}`
}
