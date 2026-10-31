// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Clock } from 'lucide-react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { classesDo } from '../../__fixtures__/class-colors'
import { Toque } from './Toque'

/**
 * O toque da D80 (`docs/interface.md` 10.2): um botão de dois estados, com `aria-pressed`, o visto no escolhido e o alvo de
 * 44 px abaixo de 768. A cor resolvida por tema e a altura medida são do e2e da galeria (`e2e/components-states.spec.ts`).
 */
afterEach(cleanup)

/** Controlado, como quem usa a peça: guarda o valor que `aoMudar` entrega. */
function Montado({ inicial = false, desligado = false, aoMudar }: { inicial?: boolean; desligado?: boolean; aoMudar?: (valor: boolean) => void }) {
  const [selecionado, definir] = useState(inicial)
  return (
    <Toque
      selecionado={selecionado}
      desligado={desligado}
      icone={Clock}
      aoMudar={(valor) => {
        aoMudar?.(valor)
        definir(valor)
      }}
    >
      Esperando você
    </Toque>
  )
}

const botao = () => screen.getByRole('button', { name: 'Esperando você' })
const formas = (elemento: Element) => elemento.querySelectorAll('svg')

describe('Toque', () => {
  it('é um botão com `aria-pressed`, que diz o estado em texto de ARIA e entrega o valor novo no clique', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<Montado aoMudar={aoMudar} />)
    expect(botao().getAttribute('type')).toBe('button')
    expect(botao().getAttribute('aria-pressed')).toBe('false')

    await usuario.click(botao())
    expect(aoMudar).toHaveBeenLastCalledWith(true)
    expect(botao().getAttribute('aria-pressed')).toBe('true')

    await usuario.click(botao())
    expect(aoMudar).toHaveBeenLastCalledWith(false)
    expect(botao().getAttribute('aria-pressed')).toBe('false')
    expect(aoMudar).toHaveBeenCalledTimes(2)
  })

  it('o Enter e o Espaço trocam, uma vez cada, e o Tab entra uma vez só', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<Montado aoMudar={aoMudar} />)
    await usuario.tab()
    expect(document.activeElement).toBe(botao())
    await usuario.keyboard('{Enter}')
    expect(aoMudar).toHaveBeenCalledTimes(1)
    await usuario.keyboard(' ')
    expect(aoMudar).toHaveBeenCalledTimes(2)
    expect(aoMudar.mock.calls.map(([valor]) => valor)).toEqual([true, false])
    await usuario.tab()
    expect(document.activeElement).toBe(document.body)
  })

  it('o escolhido leva o visto no lugar do ícone, e não só a cor; o livre mostra o ícone', () => {
    const { container, rerender } = render(<Toque selecionado={false} aoMudar={() => undefined} icone={Clock}>Esperando você</Toque>)
    const livre = formas(container)
    expect(livre).toHaveLength(1)
    expect(livre[0]?.classList.contains('lucide-clock')).toBe(true)
    expect(livre[0]?.getAttribute('aria-hidden')).toBe('true')

    rerender(<Toque selecionado aoMudar={() => undefined} icone={Clock}>Esperando você</Toque>)
    const escolhido = formas(container)
    // Um glifo só, e é o visto: o ícone cede o lugar.
    expect(escolhido).toHaveLength(1)
    expect(escolhido[0]?.classList.contains('lucide-check')).toBe(true)
    expect(escolhido[0]?.getAttribute('aria-hidden')).toBe('true')
    expect(classesDo(container.querySelector('button') as Element).has('text-azul-texto')).toBe(true)
  })

  it('sem ícone, o livre não tem glifo e o escolhido ganha o visto', () => {
    const { container, rerender } = render(<Toque selecionado={false} aoMudar={() => undefined}>Todas</Toque>)
    expect(formas(container)).toHaveLength(0)
    rerender(
      <Toque selecionado aoMudar={() => undefined}>
        Todas
      </Toque>,
    )
    expect(formas(container)).toHaveLength(1)
    expect(formas(container)[0]?.classList.contains('lucide-check')).toBe(true)
  })

  it('desligado não troca, não entra no Tab e continua dizendo o estado em que estava', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    const { container } = render(
      <>
        <Toque selecionado aoMudar={aoMudar} desligado>
          Arquivadas
        </Toque>
        <button type="button">Depois</button>
      </>,
    )
    const desligado = screen.getByRole('button', { name: 'Arquivadas' }) as HTMLButtonElement
    expect(desligado.disabled).toBe(true)
    expect(desligado.getAttribute('aria-pressed')).toBe('true')
    expect(formas(desligado)).toHaveLength(1)
    await usuario.click(desligado)
    await usuario.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Depois' }))
    expect(aoMudar).not.toHaveBeenCalled()
    // Perde a cor de ação: a mesma face `borda` e o mesmo texto `apoio` dos outros botões desligados.
    const classes = classesDo(container.querySelector('button') as Element)
    for (const classe of ['disabled:border-borda', 'disabled:bg-borda', 'disabled:text-apoio']) expect(classes.has(classe), classe).toBe(true)
  })

  it('tem 44 px de face abaixo de 768 e 40 a partir daí, com o degrau de 3 px', () => {
    const { container } = render(<Toque selecionado={false} aoMudar={() => undefined}>Todas</Toque>)
    const classes = classesDo(container.querySelector('button') as Element)
    for (const classe of ['min-h-11', 'md:min-h-10', 'degrau', '[--altura-degrau:3px]', 'border-2', 'rounded-full']) expect(classes.has(classe), classe).toBe(true)
    // Livre: degrau na `borda`. Escolhido, o degrau é azul: a cor do degrau acompanha a face.
    expect(classes.has('degrau-borda')).toBe(true)
    cleanup()
    const { container: escolhido } = render(<Toque selecionado aoMudar={() => undefined}>Todas</Toque>)
    const classesDoEscolhido = classesDo(escolhido.querySelector('button') as Element)
    for (const classe of ['degrau-azul', 'bg-azul-claro', 'border-azul-borda', 'text-azul-texto']) expect(classesDoEscolhido.has(classe), classe).toBe(true)
    expect(classesDoEscolhido.has('degrau-borda')).toBe(false)
  })
})
