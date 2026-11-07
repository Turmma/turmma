// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DaySelector, type DiaDoSeletor } from './DaySelector'

/**
 * O seletor de dia da semana (`docs/interface.md` 10.2): grupo de rádio de 5 a 7 dias, com o nome inteiro, uma parada só
 * no Tab e as setas, Home e End levando o foco. O `jsdom` não calcula tamanho: os 44 px e a largura a 360 px são do e2e.
 */
afterEach(cleanup)

const SEMANA: readonly DiaDoSeletor[] = [
  { valor: '2026-11-09', rotulo: 'Seg', diaDoMes: '9', nome: 'Segunda, 9 de novembro' },
  { valor: '2026-11-10', rotulo: 'Ter', diaDoMes: '10', nome: 'Terça, 10 de novembro', hoje: true },
  { valor: '2026-11-11', rotulo: 'Qua', diaDoMes: '11', nome: 'Quarta, 11 de novembro' },
  { valor: '2026-11-12', rotulo: 'Qui', diaDoMes: '12', nome: 'Quinta, 12 de novembro' },
  { valor: '2026-11-13', rotulo: 'Sex', diaDoMes: '13', nome: 'Sexta, 13 de novembro' },
]
const COM_SABADO_E_DOMINGO: readonly DiaDoSeletor[] = [
  ...SEMANA,
  { valor: '2026-11-14', rotulo: 'Sáb', diaDoMes: '14', nome: 'Sábado, 14 de novembro' },
  { valor: '2026-11-15', rotulo: 'Dom', diaDoMes: '15', nome: 'Domingo, 15 de novembro' },
]

function Controlado({ dias = SEMANA, inicial = '2026-11-10', aoMudar = () => undefined }: { dias?: readonly DiaDoSeletor[]; inicial?: string; aoMudar?: (valor: string) => void }) {
  const [valor, definirValor] = useState(inicial)
  return (
    <>
      <button type="button">antes</button>
      <DaySelector
        rotulo="Dia da semana"
        dias={dias}
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

const dia = (nome: string) => screen.getByRole('radio', { name: nome })

describe('seletor de dia', () => {
  it('é um grupo de rádio com nome; o dia marcado tem aria-checked, e o nome acessível é o inteiro', () => {
    render(<Controlado inicial="2026-11-11" />)
    expect(screen.getByRole('radiogroup', { name: 'Dia da semana' })).toBeTruthy()
    expect(screen.getAllByRole('radio').map((radio) => [radio.getAttribute('aria-label'), radio.getAttribute('aria-checked')])).toEqual([
      ['Segunda, 9 de novembro', 'false'],
      ['Terça, 10 de novembro', 'false'],
      ['Quarta, 11 de novembro', 'true'],
      ['Quinta, 12 de novembro', 'false'],
      ['Sexta, 13 de novembro', 'false'],
    ])
  })

  it('cabe de cinco a sete dias, numa linha só: uma coluna por dia', () => {
    const { rerender } = render(<Controlado dias={SEMANA} />)
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.getByRole('radiogroup').style.gridTemplateColumns).toBe('repeat(5, minmax(0, 1fr))')
    rerender(<Controlado dias={COM_SABADO_E_DOMINGO} />)
    expect(screen.getAllByRole('radio')).toHaveLength(7)
    expect(screen.getByRole('radiogroup').style.gridTemplateColumns).toBe('repeat(7, minmax(0, 1fr))')
  })

  it('hoje é marcado em texto, e é a descrição do botão; os outros dias não têm descrição', () => {
    render(<Controlado />)
    const hoje = dia('Terça, 10 de novembro')
    expect(hoje.textContent).toContain('hoje')
    const descricao = hoje.getAttribute('aria-describedby')
    expect(descricao).not.toBeNull()
    expect(document.getElementById(descricao ?? '')?.textContent).toBe('hoje')
    expect(dia('Quarta, 11 de novembro').hasAttribute('aria-describedby')).toBe(false)
    expect(dia('Quarta, 11 de novembro').textContent).not.toContain('hoje')
  })

  it('o dia marcado não é só cor: leva a borda e o fundo que os outros não têm', () => {
    render(<Controlado inicial="2026-11-11" />)
    expect(dia('Quarta, 11 de novembro').className).toMatch(/\bborder-azul-borda\b/)
    expect(dia('Quarta, 11 de novembro').className).toMatch(/\bbg-azul-claro\b/)
    for (const nome of ['Segunda, 9 de novembro', 'Sexta, 13 de novembro']) {
      expect(dia(nome).className, nome).not.toMatch(/\bborder-azul-borda\b/)
      expect(dia(nome).className, nome).not.toMatch(/\bbg-azul-claro\b/)
    }
  })

  it('o alvo tem 44 px de altura ou mais: min-h-14 (56 px), nunca menos que o min-h-11', () => {
    render(<Controlado />)
    for (const radio of screen.getAllByRole('radio')) expect(radio.className).toMatch(/\bmin-h-1[1-9]\b/)
  })

  it('uma parada só no Tab: o dia marcado; o Tab seguinte sai do grupo', async () => {
    const usuario = userEvent.setup()
    render(<Controlado inicial="2026-11-11" />)
    await usuario.tab()
    expect(document.activeElement?.textContent).toBe('antes')
    await usuario.tab()
    expect(document.activeElement).toBe(dia('Quarta, 11 de novembro'))
    await usuario.tab()
    expect(document.activeElement?.textContent).toBe('depois')
  })

  it('com o valor fora da lista, o primeiro dia continua alcançável pelo Tab e nenhum está marcado', async () => {
    const usuario = userEvent.setup()
    render(<Controlado inicial="2030-01-01" />)
    expect(screen.getAllByRole('radio').every((radio) => radio.getAttribute('aria-checked') === 'false')).toBe(true)
    await usuario.tab()
    await usuario.tab()
    expect(document.activeElement).toBe(dia('Segunda, 9 de novembro'))
  })

  it('as setas escolhem e levam o foco junto, e dão a volta nas pontas; Home e End vão às pontas', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<Controlado inicial="2026-11-13" aoMudar={aoMudar} />)
    dia('Sexta, 13 de novembro').focus()
    await usuario.keyboard('{ArrowRight}')
    expect(aoMudar).toHaveBeenLastCalledWith('2026-11-09')
    expect(document.activeElement).toBe(dia('Segunda, 9 de novembro'))
    await usuario.keyboard('{ArrowLeft}')
    expect(aoMudar).toHaveBeenLastCalledWith('2026-11-13')
    await usuario.keyboard('{Home}')
    expect(aoMudar).toHaveBeenLastCalledWith('2026-11-09')
    await usuario.keyboard('{End}')
    expect(aoMudar).toHaveBeenLastCalledWith('2026-11-13')
    await usuario.keyboard('{ArrowDown}{ArrowUp}')
    expect(aoMudar).toHaveBeenLastCalledWith('2026-11-13')
    expect(document.activeElement).toBe(dia('Sexta, 13 de novembro'))
  })

  it('clicar escolhe; clicar no dia que já está marcado não avisa de novo', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<Controlado inicial="2026-11-10" aoMudar={aoMudar} />)
    await usuario.click(dia('Quinta, 12 de novembro'))
    expect(aoMudar).toHaveBeenCalledTimes(1)
    expect(aoMudar).toHaveBeenCalledWith('2026-11-12')
    await usuario.click(dia('Quinta, 12 de novembro'))
    expect(aoMudar).toHaveBeenCalledTimes(1)
  })
})
