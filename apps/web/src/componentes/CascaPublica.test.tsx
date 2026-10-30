// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CascaPublica } from './CascaPublica'
import { esquecerQueAcenou } from './ui/onca/movimento-da-onca'
import { Onca } from './ui/onca/Onca'

/**
 * A moldura das páginas de fora da sessão (`docs/interface.md` 11.3; D80; 14.0): o que o `jsdom` sabe é a estrutura, e
 * ela é a que o leitor de tela e o `tokens.spec` percorrem. A divisão a 1024 px, o painel à esquerda e a rolagem de lado
 * são de `e2e/casca-publica.spec.ts`, que mede o que o navegador desenha.
 */
beforeEach(esquecerQueAcenou)
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

  it('a pinta grande saiu: a página tem a pinta da marca, no banner, e mais nenhuma imagem', async () => {
    const { container } = desenhar()
    await waitFor(() => { expect(container.querySelectorAll('[data-onca-da-marca]')).toHaveLength(2) })

    const banner = screen.getByRole('banner')
    const noBanner = banner.querySelectorAll(`img[src="${PINTA}"]`)
    expect(noBanner).toHaveLength(1)
    expect(noBanner[0]?.getAttribute('alt')).toBe('')
    // A pinta de 384 px e 15% do painel (X1, 14.0; correção `2026-10-30-tela-de-entrar`) deu lugar à onça da marca.
    expect(container.querySelectorAll(`img[src="${PINTA}"]`)).toHaveLength(1)
    expect(container.querySelectorAll('img')).toHaveLength(1)
    // O formulário não está no painel, e o painel é o que tem o banner.
    const painel = container.querySelector('[data-painel-publico]')
    expect(painel?.contains(banner)).toBe(true)
    expect(painel?.contains(screen.getByRole('main'))).toBe(false)
  })

  it('o painel é `papel`, com a borda `borda`, em toda largura: o `laranja-claro` esconderia os pés da onça, que têm o mesmo creme', () => {
    const { container } = desenhar()
    const classes = (container.querySelector('[data-painel-publico]')?.getAttribute('class') ?? '').split(/\s+/)
    expect(classes).toContain('bg-papel')
    expect(classes).toContain('border-borda')
    expect(classes.filter((classe) => classe.includes('laranja'))).toEqual([])
    // A altura mínima é a do cenário (D80 revista às 21:45): com 34rem, o cenário de 300 px, centrado, não encosta na marca de 108 px
    // nem em janela baixa. Só de 1024 px para cima, e nenhuma outra altura mínima.
    expect(classes.filter((classe) => classe.includes('min-h'))).toEqual(['lg:min-h-[34rem]'])
  })

  it('o cenário e a onça chegam depois da primeira pintura: o cenário de 432 × 300 px no painel, com a onça de 240 px, e a de 88 px acima do formulário, sem nome nem selo', async () => {
    const { container } = desenhar()
    // As caixas já existem com o tamanho do que vem antes de ele chegar (o `import()` é tardio: a prova dele está em
    // `ia/avatar-so-nas-duas-pecas.test.ts`), e por isso a página não pula quando o desenho entra.
    const caixa = container.querySelector('[data-cena-da-onca-caixa]') as HTMLElement
    const pequena = container.querySelector('[data-onca-da-marca-pequena]') as HTMLElement
    expect(caixa.getAttribute('class')).toMatch(/\bhidden\b.*\blg:block\b|\blg:block\b.*\bhidden\b/)
    // O `lg:max-w-[calc(100%-5rem)]` guarda os 40 px de respiro a 1024 px, onde o painel tem 510 px úteis por causa da borda.
    for (const classe of ['w-108', 'h-75', 'max-w-full', 'lg:max-w-[calc(100%-5rem)]', 'm-auto', 'inset-0']) expect((caixa.getAttribute('class') ?? '').split(/\s+/), classe).toContain(classe)
    expect(pequena.getAttribute('class')).toMatch(/\blg:hidden\b/)
    expect(pequena.getAttribute('class')).toMatch(/\bsize-22\b/)
    // A onça solta de 160 px saiu: no painel só há o cenário.
    expect(container.querySelector('[data-onca-da-marca-grande]')).toBeNull()

    await waitFor(() => { expect(container.querySelectorAll('[data-onca-da-marca]')).toHaveLength(2) })
    const painel = container.querySelector('[data-painel-publico]') as HTMLElement
    expect(painel.contains(caixa)).toBe(true)
    expect(caixa.querySelectorAll('[data-cena-da-onca]')).toHaveLength(1)
    const onca = caixa.querySelector('[data-onca-da-marca] svg') as SVGElement
    expect(onca.getAttribute('width')).toBe('240')
    expect(onca.getAttribute('class')).toContain('onca-animada')
    expect(container.querySelectorAll('svg[width="160"]')).toHaveLength(0)
    // A de 88 px não está no painel (a faixa de topo fica só com a marca), vem antes do formulário e está parada.
    expect(painel.contains(pequena)).toBe(false)
    expect(pequena.querySelector('svg')?.getAttribute('width')).toBe('88')
    expect(pequena.querySelector('svg')?.getAttribute('class')).not.toContain('onca-animada')
    expect(pequena.querySelector('[data-cena-da-onca]')).toBeNull()
    const principal = screen.getByRole('main')
    expect(principal.contains(pequena)).toBe(false)
    expect(pequena.compareDocumentPosition(principal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Nenhum texto novo (RF20 da X1), nenhum nome de função e nenhum selo: a onça da marca não é saída de agente.
    expect(container.querySelectorAll('figcaption, [data-onca-assinatura], [data-selo-ia]')).toHaveLength(0)
    for (const figura of container.querySelectorAll('[data-onca-da-marca]')) {
      expect(figura.getAttribute('aria-hidden')).toBe('true')
      expect(figura.getAttribute('data-pose')).toBe('acenando')
    }
    expect(caixa.querySelector('[data-cena-da-onca]')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByText(/inteligência artificial|Assistente|Tutor|Analista/)).toBeNull()
  })

  it('a onça da marca, mesmo a escondida pelo CSS a 360 px, não gasta o aceno da introdução: a `Onca` acenando, montada depois na mesma página, ainda acena', async () => {
    const { container } = desenhar()
    await waitFor(() => { expect(container.querySelectorAll('[data-onca-da-marca]')).toHaveLength(2) })
    // As duas onças da marca estão montadas (o `hidden` só esconde pelo CSS) e a do cenário, de 240 px, acenou, para a marca.
    expect(container.querySelectorAll('.onca-acena')).toHaveLength(1)
    // A entrada leva à introdução do papel sem recarregar: a onça dela entra na mesma página, e acena.
    const introducao = render(<Onca pose="acenando" agente="assistente_de_ensino" tamanho={120} />)
    expect(introducao.container.querySelectorAll('.onca-acena')).toHaveLength(1)
  })
})
