// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { classesOf } from '../../__fixtures__/class-colors'
import { CountBadge, COLOR_FAMILIES } from './CountBadge'

/**
 * O contador da D80 (`docs/interface.md` 10.2; Tech Spec da X1, seção 9): o número, o que ele conta em texto, e nada que
 * se mexa. A cor de cada face e o contraste do texto sobre ela são do e2e da galeria (`e2e/components-states.spec.ts`), que
 * mede o que o navegador calcula; aqui está o que o `jsdom` sabe.
 */
afterEach(cleanup)

describe('Contador', () => {
  it('diz o número e o que ele conta, em texto: quem lê a tela ouve "2 pedidos de nome", e não só "2"', () => {
    const { container } = render(<CountBadge n={2} oQueConta="pedidos de nome" />)
    const pilula = container.querySelector('[data-contador]') as HTMLElement
    expect(pilula.textContent).toBe('2 pedidos de nome')
    // O que conta é texto escondido só da vista, depois do número visível: ele não se perde com a face.
    const escondido = pilula.querySelector('.sr-only') as HTMLElement
    expect(escondido.textContent?.trim()).toBe('pedidos de nome')
    expect(pilula.firstChild?.textContent).toBe('2')
  })

  it('"ou mais" mostra o sinal de mais e diz "ou mais" ao leitor de tela; sem ele, o número é exato', () => {
    const { container } = render(<CountBadge n={100} oQueConta="esperando você" ouMais />)
    const pilula = container.querySelector('[data-contador]') as HTMLElement
    expect(pilula.textContent).toBe('100+ ou mais esperando você')
    // O sinal é só da vista: quem lê a tela ouve "100 ou mais", e não "100 mais".
    expect(pilula.querySelector('[aria-hidden="true"]')?.textContent).toBe('+')
    expect((pilula.querySelector('.sr-only') as HTMLElement).textContent?.trim()).toBe('ou mais esperando você')
    cleanup()
    const { container: exato } = render(<CountBadge n={100} oQueConta="esperando você" />)
    expect((exato.querySelector('[data-contador]') as HTMLElement).textContent).toBe('100 esperando você')
  })

  it('zero, negativo e o que não é número não desenham nada', () => {
    for (const n of [0, -1, Number.NaN]) {
      const { container, unmount } = render(<CountBadge n={n} oQueConta="pedidos de nome" />)
      expect(container.innerHTML, String(n)).toBe('')
      unmount()
    }
    const { container } = render(<CountBadge n={1} oQueConta="pedidos de nome" />)
    expect(container.querySelector('[data-contador]')).not.toBeNull()
  })

  it('o número é tabular, em 700, com o texto da face em `sobre-cor`, e a pílula tem 24 px no mínimo', () => {
    const { container } = render(<CountBadge n={128} oQueConta="entregas" />)
    const classes = classesOf(container.querySelector('[data-contador]') as Element)
    for (const classe of ['tabular-nums', 'font-bold', 'text-sobre-cor', 'min-h-6', 'min-w-6', 'rounded-full']) expect(classes.has(classe), classe).toBe(true)
    // Branco e `tinta` sobre a face reprovam em um dos temas: só `sobre-cor`.
    expect([...classes].filter((classe) => /^text-(white|tinta)$/.test(classe))).toEqual([])
  })

  it('sem família é laranja; cada uma das dez tem a face dela, e nenhuma classe repete', () => {
    const { container: padrao } = render(<CountBadge n={1} oQueConta="itens" />)
    expect(classesOf(padrao.querySelector('[data-contador]') as Element).has('bg-laranja')).toBe(true)

    const faces = new Set<string>()
    for (const familia of COLOR_FAMILIES) {
      const { container, unmount } = render(<CountBadge n={3} oQueConta="itens" familia={familia} />)
      const classes = classesOf(container.querySelector('[data-contador]') as Element)
      expect(classes.has(`bg-${familia}`), familia).toBe(true)
      faces.add([...classes].find((classe) => classe.startsWith('bg-')) ?? '')
      unmount()
    }
    expect(faces.size).toBe(COLOR_FAMILIES.length)
  })

  it('não pisca: nenhuma animação nem transição, nem ao trocar o número', () => {
    const { container, rerender } = render(<CountBadge n={1} oQueConta="pedidos" />)
    const antes = container.querySelector('[data-contador]') as Element
    rerender(<CountBadge n={2} oQueConta="pedidos" />)
    const depois = container.querySelector('[data-contador]') as Element
    // O mesmo nó: o número muda e a pílula não é remontada para chamar a atenção.
    expect(depois).toBe(antes)
    expect(depois.textContent).toBe('2 pedidos')
    expect([...classesOf(depois)].filter((classe) => /^(animate|transition|duration|motion)/.test(classe))).toEqual([])
  })

  it('não é controle: nenhum papel, nenhum foco e nenhum botão dentro', () => {
    const { container } = render(<CountBadge n={4} oQueConta="pedidos" />)
    expect(container.querySelector('button, a, [role], [tabindex]')).toBeNull()
  })
})
