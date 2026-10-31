// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Galeria from './Gallery'

/**
 * A galeria por seções (tarefa 2.0 da X1; Tech Spec, seção 9, "Galeria"): cada grupo de peças mora no arquivo dele, em
 * `sections/`, e o `import.meta.glob` os registra. O que este arquivo prova é que o corte não perdeu nenhum bloco do que o
 * e2e (`e2e/components-*.spec.ts`) acha pelo `data-galeria`, e que o e2e dividido não perdeu caso nem asserção.
 */
beforeEach(() => {
  // O `jsdom` não tem `matchMedia` (a caixa de pedido e a `Aparencia` o leem) nem `ResizeObserver` (a barra presa).
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Os 15 blocos que a galeria tinha num arquivo só, pelo nome que o e2e usa. O número só cresce. */
const BLOCOS_DE_ANTES = [
  'abas',
  'barra-presa',
  'botoes',
  'caixa-do-aluno',
  'caixa-pedido',
  'confirmacao',
  'conversa',
  'estado',
  'motor',
  'motor-da-adaptacao',
  'pagina-mini',
  'painel',
  'selecao-e-menu',
  'selo-de-ia',
  'tabela',
]

const RAIZ = join(import.meta.dirname, '..', '..', '..', '..')

describe('a galeria por seções', () => {
  it('desenha cada bloco de antes, uma vez só, com a Aparência no topo', () => {
    render(<Galeria />)
    const nomes = [...document.querySelectorAll('[data-galeria]')].map((bloco) => bloco.getAttribute('data-galeria') ?? '')
    for (const nome of BLOCOS_DE_ANTES) expect(nomes.filter((achado) => achado === nome), nome).toHaveLength(1)
    expect(new Set(nomes).size, 'nome de bloco repetido').toBe(nomes.length)
    // O que cresceu: bloco novo entra por arquivo novo, e o nome dele é único.
    expect(nomes.length).toBeGreaterThanOrEqual(BLOCOS_DE_ANTES.length)

    expect(screen.getByRole('radiogroup', { name: 'Aparência' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Galeria de peças' })).toBeTruthy()
  })

  it('cada arquivo de secoes/ exporta o componente que o glob registra, e a galeria não escreve bloco nenhum', () => {
    const pasta = join(import.meta.dirname, 'sections')
    const arquivos = readdirSync(pasta).filter((nome) => nome.endsWith('.tsx'))
    expect(arquivos.length).toBeGreaterThanOrEqual(6)
    for (const arquivo of arquivos) expect(readFileSync(join(pasta, arquivo), 'utf8'), arquivo).toMatch(/export default function \w+\(/)

    const galeria = readFileSync(join(import.meta.dirname, 'Gallery.tsx'), 'utf8')
    expect(galeria).toMatch(/import\.meta\.glob<[^>]*>\('\.\/sections\/\*\.tsx', \{ eager: true \}\)/)
    expect(galeria).not.toMatch(/<Secao\b/)
  })
})

describe('o e2e das peças, dividido por grupo', () => {
  const pasta = join(RAIZ, 'e2e')
  const arquivos = readdirSync(pasta).filter((nome) => /^components-.+\.spec\.ts$/.test(nome))
  const texto = arquivos.map((nome) => readFileSync(join(pasta, nome), 'utf8')).join('\n')
  const auxiliares = readFileSync(join(pasta, 'support', 'gallery.ts'), 'utf8')

  it('o arquivo único deixou de existir, e há um arquivo por grupo', () => {
    expect(readdirSync(pasta)).not.toContain('components.spec.ts')
    for (const grupo of ['button', 'gallery', 'ai', 'overlays', 'surfaces']) expect(arquivos, grupo).toContain(`components-${grupo}.spec.ts`)
  })

  it('os 12 casos de antes continuam, e as 309 asserções também (as dos auxiliares contam)', () => {
    const casos = [...texto.matchAll(/^ {2}test\(/gm)].length
    expect(casos).toBeGreaterThanOrEqual(12)
    const asercoes = [...(texto + auxiliares).matchAll(/\bexpect\(/g)].length
    expect(asercoes).toBeGreaterThanOrEqual(309)
  })
})
