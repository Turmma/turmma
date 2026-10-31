// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { codigoSemComentarioNemTexto } from '../../__fixtures__/danger-solid'
import { Comemoracao } from './Comemoracao'

/**
 * A comemoração (tarefa 5.0 da X4; RF8, RF19; D59): **um** salto, o da onça `comemorando` (`onca-comemora`, em CSS, uma
 * iteração), parado com "reduzir movimento", sem som e sem número. O `jsdom` não calcula `animation-name`: o CSS é lido como
 * texto aqui (`onca/Onca.css`), e o que o navegador resolve — `animationName` com e sem "reduzir movimento", exatamente uma
 * animação na árvore — está em `e2e/introducao-components.spec.ts`.
 */
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const RAIZ = join(import.meta.dirname, '..', '..')
const CSS = readFileSync(join(RAIZ, 'components/ui/onca/Onca.css'), 'utf8')
const FONTE = readFileSync(join(RAIZ, 'components/ui/Comemoracao.tsx'), 'utf8')

/** O miolo do bloco que abre na primeira `{` depois de `inicio`, até a `}` que o fecha. */
function bloco(texto: string, inicio: number): string {
  const abertura = texto.indexOf('{', inicio)
  let profundidade = 0
  for (let posicao = abertura; posicao < texto.length; posicao++) {
    if (texto[posicao] === '{') profundidade++
    else if (texto[posicao] === '}' && --profundidade === 0) return texto.slice(abertura + 1, posicao)
  }
  throw new Error('bloco de CSS sem fechamento')
}

describe('Comemoracao: o que aparece', () => {
  it('é a onça comemorando, com a função e o selo "IA", e a frase de quem a monta', () => {
    const { container } = render(<Comemoracao agente="tutor">Atividade enviada.</Comemoracao>)
    expect(container.querySelector('[data-onca]')?.getAttribute('data-pose')).toBe('comemorando')
    expect(container.querySelector('figcaption')?.textContent).toMatch(/^Tutor/)
    expect(container.querySelectorAll('[data-selo-ia]')).toHaveLength(1)
    expect(container.textContent).toContain('Atividade enviada.')
  })

  it('sem frase, só a onça: nada de texto inventado pela peça', () => {
    const { container } = render(<Comemoracao agente="tutor" />)
    expect(container.querySelectorAll('p')).toHaveLength(0)
  })

  it('o salto é um só, o do corpo da onça, e o texto fica parado: a peça não põe outro movimento por cima', () => {
    const { container } = render(<Comemoracao agente="tutor">Atividade enviada.</Comemoracao>)
    const saltos = container.querySelectorAll('.onca-comemora')
    expect(saltos).toHaveLength(1)
    expect(saltos[0]?.closest('[data-onca]'), 'o salto é do corpo da onça').not.toBeNull()
    expect(saltos[0]?.textContent).not.toContain('Atividade enviada.')
    expect(container.querySelectorAll('.comemoracao-salto, .onca-entra, .onca-acena'), 'nenhum outro movimento na árvore').toHaveLength(0)
  })

  it('não tem número, som nem temporizador', () => {
    vi.useFakeTimers()
    const { container } = render(<Comemoracao agente="tutor">Atividade enviada.</Comemoracao>)
    expect(vi.getTimerCount()).toBe(0)
    expect(container.querySelectorAll('audio, video, source, embed, object')).toHaveLength(0)
    expect(container.textContent).not.toMatch(/\d/)
    const codigo = codigoSemComentarioNemTexto(FONTE)
    expect(codigo).not.toMatch(/\b(?:Audio|AudioContext|setTimeout|setInterval|requestAnimationFrame|useEffect|useLayoutEffect|useState|useReducer)\b/)
  })
})

describe('Onca.css: o salto da comemoração', () => {
  const inicioDosFrames = CSS.indexOf('@keyframes onca-comemorar')
  const quadros = bloco(CSS, inicioDosFrames)

  it('o salto muda só `transform`', () => {
    expect(inicioDosFrames, 'os @keyframes sumiram').toBeGreaterThan(-1)
    const propriedades = new Set([...quadros.matchAll(/([a-z-]+)\s*:/g)].map(([, nome]) => nome))
    expect([...propriedades].sort()).toEqual(['transform'])
  })

  it('roda uma vez, em 500 ms: a regra do `onca-comemora` não repete, e `infinite` não aparece em lugar nenhum', () => {
    expect(CSS).toMatch(/\.onca-comemora\s*\{[^}]*animation:\s*onca-comemorar 500ms ease-out both;/)
    expect(CSS).not.toMatch(/infinite/)
    expect(CSS).not.toMatch(/animation-iteration-count:\s*(?!1\b)/)
    expect(CSS).not.toMatch(/animation-direction:\s*(?:alternate|reverse)/)
  })

  it('com "reduzir movimento", a animação é `none` para a onça e tudo dentro dela', () => {
    const inicio = CSS.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(inicio, 'o bloco de "reduzir movimento" sumiu').toBeGreaterThan(-1)
    expect(bloco(CSS, inicio)).toMatch(/\.onca \*, \.onca \{ animation: none !important; \}/)
  })

  it('a peça não carrega CSS próprio, e o salto não depende de estilo em linha', () => {
    expect(FONTE).not.toMatch(/import '[^']*\.css'/)
    const { container } = render(<Comemoracao agente="tutor" />)
    for (const elemento of container.querySelectorAll('*')) expect(elemento.hasAttribute('style'), elemento.outerHTML).toBe(false)
  })
})
