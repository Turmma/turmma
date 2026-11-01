// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { classesOf } from '../../__fixtures__/class-colors'
import { Icon } from './Icon'
import { PLACE_NAMES } from './icons/places'

/**
 * O ícone ilustrado de um lugar (`docs/interface.md` 9.4; Tech Spec da X1, seção 9): o nome quando está sozinho, a
 * decoração quando o rótulo está ao lado, e o desenho de 48 por 48. A cor resolvida por tema e a medida na tela são do e2e
 * da galeria (`e2e/components-brand-icons.spec.ts`).
 */
afterEach(cleanup)

describe('Icone', () => {
  it('com `rotulo` é uma imagem com esse nome, e quem lê a tela o ouve', () => {
    render(<Icon nome="turmas" tamanho={32} rotulo="Turmas" />)
    const imagem = screen.getByRole('img', { name: 'Turmas' })
    expect(imagem.tagName.toLowerCase()).toBe('svg')
    expect(imagem.getAttribute('aria-hidden')).toBeNull()
  })

  it('sem `rotulo` some da leitura de tela: `aria-hidden`, sem papel e sem nome', () => {
    const { container } = render(<Icon nome="inicio" tamanho={24} />)
    const desenho = container.querySelector('svg') as SVGElement
    expect(desenho.getAttribute('aria-hidden')).toBe('true')
    expect(desenho.getAttribute('role')).toBeNull()
    expect(desenho.getAttribute('aria-label')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('`rotulo` vazio é o mesmo que sem rótulo: imagem sem nome é erro de acessibilidade, e não decoração calada', () => {
    const { container } = render(<Icon nome="inicio" tamanho={24} rotulo="" />)
    const desenho = container.querySelector('svg') as SVGElement
    expect(desenho.getAttribute('aria-hidden')).toBe('true')
    expect(desenho.getAttribute('role')).toBeNull()
    expect(desenho.getAttribute('aria-label')).toBeNull()
  })

  it('o nome vem só do `rotulo`: nenhum `<title>` nem `<desc>` dentro, e o nome do lugar não vaza para a leitura', () => {
    const { container } = render(<Icon nome="ferramentas" tamanho={40} />)
    expect(container.querySelector('title, desc, text')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('cada nome dá um SVG de 0 0 48 48, e o HTML dos quatro é diferente entre si', () => {
    const html = new Set<string>()
    for (const nome of PLACE_NAMES) {
      const { container, unmount } = render(<Icon nome={nome} tamanho={48} />)
      const desenho = container.querySelector('svg') as SVGElement
      expect(desenho.getAttribute('viewBox'), nome).toBe('0 0 48 48')
      expect(desenho.getAttribute('data-icone'), nome).toBe(nome)
      html.add(container.innerHTML)
      unmount()
    }
    expect(html.size).toBe(PLACE_NAMES.length)
  })

  it('o tamanho é a largura e a altura, de 24 a 48', () => {
    for (const tamanho of [24, 28, 32, 40, 48] as const) {
      const { container, unmount } = render(<Icon nome="tarefas" tamanho={tamanho} />)
      const desenho = container.querySelector('svg') as SVGElement
      expect(desenho.getAttribute('width'), String(tamanho)).toBe(String(tamanho))
      expect(desenho.getAttribute('height'), String(tamanho)).toBe(String(tamanho))
      unmount()
    }
  })

  it('não recebe foco nem encolhe na linha: `focusable="false"` e `shrink-0`, e é um bloco, sem a linha de base', () => {
    const { container } = render(<Icon nome="turmas" tamanho={24} />)
    const desenho = container.querySelector('svg') as SVGElement
    expect(desenho.getAttribute('focusable')).toBe('false')
    const classes = classesOf(desenho)
    expect(classes.has('shrink-0')).toBe(true)
    expect(classes.has('block')).toBe(true)
  })

  it('a cor está só nas formas, por classe de token: o `<svg>` não pinta nada', () => {
    const { container } = render(<Icon nome="inicio" tamanho={48} />)
    const desenho = container.querySelector('svg') as SVGElement
    expect(desenho.getAttribute('fill')).toBeNull()
    expect(desenho.getAttribute('style')).toBeNull()
    for (const classe of classesOf(desenho)) expect(classe).not.toMatch(/^(?:fill|text|bg)-/)
  })
})
