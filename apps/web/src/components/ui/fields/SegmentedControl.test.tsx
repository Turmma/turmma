// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SegmentedControl, type SegmentedOptions } from './SegmentedControl'

/**
 * O grupo de rádio do jeito de ver (`docs/interface.md` 10.2): marcada com `aria-checked`, uma parada só no Tab, e as
 * setas, Home e End escolhendo e levando o foco. O `jsdom` não calcula tamanho nem foco visível: o alvo de toque e o anel
 * são do e2e da galeria.
 */
afterEach(cleanup)

type Modo = 'a' | 'b' | 'c'
const OPCOES: SegmentedOptions<Modo> = [
  { valor: 'a', rotulo: 'Primeira' },
  { valor: 'b', rotulo: 'Segunda' },
  { valor: 'c', rotulo: 'Terceira' },
]

function Controlado({ inicial = 'a', aoMudar = () => undefined }: { inicial?: Modo; aoMudar?: (valor: Modo) => void }) {
  const [valor, definirValor] = useState<Modo>(inicial)
  return (
    <>
      <button type="button">antes</button>
      <SegmentedControl
        rotulo="Jeito de ver"
        opcoes={OPCOES}
        valor={valor}
        aoMudar={(novo) => {
          definirValor(novo)
          aoMudar(novo)
        }}
      />
      <button type="button">depois</button>
    </>
  )
}

const opcao = (nome: string) => screen.getByRole('radio', { name: nome })

describe('Segmentado', () => {
  it('é um grupo de rádio com nome, uma opção marcada com aria-checked e as outras não', () => {
    render(<Controlado inicial="b" />)
    expect(screen.getByRole('radiogroup', { name: 'Jeito de ver' })).toBeTruthy()
    expect(screen.getAllByRole('radio').map((radio) => [radio.textContent, radio.getAttribute('aria-checked')])).toEqual([
      ['Primeira', 'false'],
      ['Segunda', 'true'],
      ['Terceira', 'false'],
    ])
  })

  it('a marcada não é só cor: leva a borda e o fundo que as outras não têm', () => {
    render(<Controlado inicial="b" />)
    expect(opcao('Segunda').className).toMatch(/\bborder-azul-borda\b/)
    expect(opcao('Segunda').className).toMatch(/\bbg-azul-claro\b/)
    for (const nome of ['Primeira', 'Terceira']) {
      expect(opcao(nome).className, nome).not.toMatch(/\bborder-azul-borda\b/)
      expect(opcao(nome).className, nome).not.toMatch(/\bbg-azul-claro\b/)
    }
  })

  it('é uma parada só no Tab: a marcada entra, e o Tab seguinte sai do grupo', async () => {
    const usuario = userEvent.setup()
    render(<Controlado inicial="b" />)
    expect(screen.getAllByRole('radio').map((radio) => (radio as HTMLElement).tabIndex)).toEqual([-1, 0, -1])

    await usuario.click(screen.getByRole('button', { name: 'antes' }))
    await usuario.tab()
    expect(document.activeElement).toBe(opcao('Segunda'))
    await usuario.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'depois' }))
    await usuario.tab({ shift: true })
    expect(document.activeElement).toBe(opcao('Segunda'))
  })

  it('as setas escolhem e levam o foco junto, e dão a volta nas pontas', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<Controlado aoMudar={aoMudar} />)
    opcao('Primeira').focus()

    await usuario.keyboard('{ArrowRight}')
    expect(aoMudar).toHaveBeenLastCalledWith('b')
    expect(document.activeElement).toBe(opcao('Segunda'))
    expect(opcao('Segunda').getAttribute('aria-checked')).toBe('true')
    expect(opcao('Primeira').getAttribute('aria-checked')).toBe('false')

    await usuario.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(opcao('Terceira'))
    await usuario.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(opcao('Primeira'))
    await usuario.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(opcao('Terceira'))
    await usuario.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(opcao('Segunda'))
    expect(aoMudar).toHaveBeenCalledTimes(5)
  })

  it('Home vai à primeira e End à última, escolhendo', async () => {
    const usuario = userEvent.setup()
    render(<Controlado inicial="b" />)
    opcao('Segunda').focus()

    await usuario.keyboard('{End}')
    expect(document.activeElement).toBe(opcao('Terceira'))
    expect(opcao('Terceira').getAttribute('aria-checked')).toBe('true')
    await usuario.keyboard('{Home}')
    expect(document.activeElement).toBe(opcao('Primeira'))
    expect(opcao('Primeira').getAttribute('aria-checked')).toBe('true')
  })

  it('o clique escolhe; escolher de novo a marcada, ou apertar uma tecla que não é do grupo, não muda nada', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<Controlado aoMudar={aoMudar} />)

    await usuario.click(opcao('Terceira'))
    expect(aoMudar).toHaveBeenCalledExactlyOnceWith('c')
    expect(opcao('Terceira').getAttribute('aria-checked')).toBe('true')

    // O Enter na marcada é um clique na marcada: não é mudança.
    await usuario.keyboard('{Enter}')
    await usuario.keyboard('x')
    await usuario.click(opcao('Terceira'))
    expect(aoMudar).toHaveBeenCalledTimes(1)
  })

  it('com o valor fora da lista, nenhuma está marcada e a primeira continua alcançável pelo Tab', () => {
    render(<SegmentedControl<string> rotulo="Jeito de ver" opcoes={OPCOES} valor="que-sumiu" aoMudar={() => undefined} />)
    expect(screen.getAllByRole('radio').map((radio) => [radio.getAttribute('aria-checked'), (radio as HTMLElement).tabIndex])).toEqual([
      ['false', 0],
      ['false', -1],
      ['false', -1],
    ])
  })

  it('com o rótulo visível, o nome aparece em texto e nomeia o grupo; sem ele, o nome fica só para o leitor de tela', () => {
    const { rerender } = render(<SegmentedControl rotulo="Jeito de ver" rotuloVisivel opcoes={OPCOES} valor="a" aoMudar={() => undefined} />)
    expect(screen.getByText('Jeito de ver')).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Jeito de ver' })).toBeTruthy()

    rerender(<SegmentedControl rotulo="Jeito de ver" opcoes={OPCOES} valor="a" aoMudar={() => undefined} />)
    expect(screen.queryByText('Jeito de ver')).toBeNull()
    expect(screen.getByRole('radiogroup', { name: 'Jeito de ver' })).toBeTruthy()
  })

  it('com rótulos longos, `emDuasColunasNoCelular` põe as opções em duas colunas abaixo de 768 px e numa linha só a partir dela; sem a prop, a linha única de sempre', () => {
    const { rerender } = render(<SegmentedControl rotulo="Jeito de ver" opcoes={OPCOES} valor="a" aoMudar={() => undefined} />)
    const grupo = () => screen.getByRole('radiogroup', { name: 'Jeito de ver' })
    expect(grupo().className).toMatch(/\bflex\b/)
    expect(grupo().className).not.toMatch(/\bgrid\b|\bgrid-cols-2\b/)
    rerender(<SegmentedControl rotulo="Jeito de ver" opcoes={OPCOES} valor="a" aoMudar={() => undefined} emDuasColunasNoCelular />)
    expect(grupo().className).toMatch(/\bgrid\b/)
    expect(grupo().className).toMatch(/\bgrid-cols-2\b/)
    expect(grupo().className).toMatch(/\bmd:flex\b/)
    // As opções continuam as mesmas: o rádio, a marcada e o alvo não mudam com o arranjo.
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'Primeira' }).getAttribute('aria-checked')).toBe('true')
  })

  it('o alvo é de 44 px abaixo de 768 px e de 36 px a partir dela: a opção traz as duas classes', () => {
    render(<Controlado />)
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.className).toMatch(/\bmin-h-11\b/)
      expect(radio.className).toMatch(/\bmd:min-h-9\b/)
    }
  })
})
