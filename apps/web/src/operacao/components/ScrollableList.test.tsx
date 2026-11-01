// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScrollableList } from './ScrollableList'

/**
 * A região da lista de uma tela da operação (RF23): o que passa da altura rola por dentro, e só a região que rola recebe
 * foco, para rolar pelo teclado. O `jsdom` não calcula medida: o teste diz quando o conteúdo "passa", como o da `Table`.
 * A altura de verdade, a 1366 × 768, é do e2e (`e2e/operacao-escolas.spec.ts`).
 */
beforeEach(() => {
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
  vi.restoreAllMocks()
})

function conteudoDe(altura: number, janela: number): void {
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(altura)
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(janela)
}

function regiao() {
  return render(
    <ScrollableList rotulo="Lista de escolas" ocupada={false} pe={<nav aria-label="Páginas da lista">páginas</nav>}>
      <p>a lista</p>
    </ScrollableList>,
  )
}

describe('a região da lista', () => {
  it('com a lista maior que a janela, a região recebe foco e leva o nome; as páginas ficam dentro dela, no pé', () => {
    conteudoDe(1200, 400)
    regiao()
    const rolagem = screen.getByRole('region', { name: 'Lista de escolas' })
    expect(rolagem.getAttribute('tabindex')).toBe('0')
    expect(within(rolagem).getByRole('navigation', { name: 'Páginas da lista' })).toBeTruthy()
    const filhos = Array.from(rolagem.children).map((filho) => filho.textContent)
    expect(filhos).toEqual(['a lista', 'páginas'])
  })

  it('com a lista que cabe, a região não vira uma parada a mais no Tab', () => {
    conteudoDe(400, 400)
    regiao()
    expect(screen.getByRole('region', { name: 'Lista de escolas' }).hasAttribute('tabindex')).toBe(false)
  })

  it('diz que está ocupada enquanto a página nova não chega', () => {
    conteudoDe(400, 400)
    const { rerender } = regiao()
    expect(screen.getByRole('region', { name: 'Lista de escolas' }).getAttribute('aria-busy')).toBe('false')
    rerender(
      <ScrollableList rotulo="Lista de escolas" ocupada pe={<nav aria-label="Páginas da lista">páginas</nav>}>
        <p>a lista</p>
      </ScrollableList>,
    )
    expect(screen.getByRole('region', { name: 'Lista de escolas' }).getAttribute('aria-busy')).toBe('true')
  })
})
