// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CascaPublica } from './CascaPublica'

/**
 * A moldura das páginas de fora da sessão (`docs/interface.md` 11.3; D80; 14.0): o que o `jsdom` sabe é a estrutura, e
 * ela é a que o leitor de tela e o `tokens.spec` percorrem. A divisão a 1024 px, o painel à esquerda e a rolagem de lado
 * são de `e2e/casca-publica.spec.ts`, que mede o que o navegador desenha.
 */
afterEach(cleanup)

const PINTA = '/marca/turmma-pinta.svg'

function desenhar() {
  return render(
    <CascaPublica titulo="Entrar na turma">
      <p>Primeiro filho.</p>
      <button type="button">Segundo filho</button>
    </CascaPublica>,
  )
}

describe('CascaPublica', () => {
  it('tem um banner com a marca, um main e um h1 com o título, e o filho vem depois do título dentro do main', () => {
    desenhar()

    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('Turmma')).toBeTruthy()

    const principal = screen.getByRole('main')
    const titulo = within(principal).getByRole('heading', { level: 1, name: 'Entrar na turma' })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    // O banner não está dentro do `main`: um `header` dentro dele perderia o papel de `banner`.
    expect(principal.contains(banner)).toBe(false)

    const filho = within(principal).getByText('Primeiro filho.')
    expect(titulo.compareDocumentPosition(filho) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(principal).getByRole('button', { name: 'Segundo filho' })).toBeTruthy()
  })

  it('a pinta do painel é decorativa, está fora do banner, e o banner continua com uma pinta só', () => {
    const { container } = desenhar()

    const banner = screen.getByRole('banner')
    const noBanner = banner.querySelectorAll(`img[src="${PINTA}"]`)
    expect(noBanner).toHaveLength(1)
    expect(noBanner[0]?.getAttribute('alt')).toBe('')

    // Duas pintas na página: a da marca, no banner, e a parada do painel, ao lado dele. As duas com `alt=""`.
    const todas = [...container.querySelectorAll(`img[src="${PINTA}"]`)]
    expect(todas).toHaveLength(2)
    const doPainel = todas.find((imagem) => !banner.contains(imagem))
    expect(doPainel?.getAttribute('alt')).toBe('')
    // O painel é o que tem o banner e a pinta parada: o mesmo bloco, à esquerda do formulário.
    const painel = container.querySelector('[data-painel-publico]')
    expect(painel?.contains(banner)).toBe(true)
    expect(painel?.contains(doPainel ?? null)).toBe(true)
    // O formulário não está no painel.
    expect(painel?.contains(screen.getByRole('main'))).toBe(false)
  })
})
