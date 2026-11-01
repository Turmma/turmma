// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haDialogoPrioritario, registrarDialogoPrioritario } from './priority-dialog'
import { Sheet } from './Sheet'

/**
 * O painel que abre pelo endereço espera o aviso de incidente (correção 2026-10-17-painel-pelo-endereco-cobre-o-aviso). A ordem dos
 * modais na camada de cima é do navegador, e é do e2e (`e2e/incidentes.spec.ts`); aqui está o que é do código: o painel não chama
 * `showModal` enquanto há um diálogo prioritário, chama quando o último sai, e o que já estava aberto não é fechado.
 */

let aberturas: number

beforeEach(() => {
  aberturas = 0
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    aberturas += 1
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(() => {
  cleanup()
  // O registro mora no módulo: um teste que quebrasse no meio deixaria o prioritário na tela para os outros.
  expect(haDialogoPrioritario()).toBe(false)
})

const painel = () => <Sheet titulo="Painel de teste" aoFechar={() => undefined}>Conteúdo</Sheet>
const dialogo = () => document.querySelector('dialog[data-painel-lado]')

describe('PainelLado com um diálogo prioritário na tela', () => {
  it('sem prioritário, abre ao montar', () => {
    render(painel())
    expect(aberturas).toBe(1)
    expect(dialogo()?.hasAttribute('open')).toBe(true)
  })

  it('com prioritário, não abre ao montar, e abre quando o último prioritário sai, com o foco no miolo', () => {
    const tirar = registrarDialogoPrioritario()
    render(painel())
    expect(aberturas).toBe(0)
    expect(dialogo()?.hasAttribute('open')).toBe(false)
    expect(screen.queryByRole('dialog', { name: 'Painel de teste' })).toBeNull()

    act(() => tirar())
    expect(aberturas).toBe(1)
    expect(dialogo()?.hasAttribute('open')).toBe(true)
    expect(document.activeElement).toBe(document.querySelector('[data-painel-miolo]'))
  })

  it('o painel que já estava aberto continua aberto quando o prioritário chega, e não reabre quando ele sai', () => {
    render(painel())
    const tirar = registrarDialogoPrioritario()
    expect(dialogo()?.hasAttribute('open')).toBe(true)
    act(() => tirar())
    expect(aberturas).toBe(1)
    expect(dialogo()?.hasAttribute('open')).toBe(true)
  })

  it('o painel desmontado enquanto esperava não abre depois', () => {
    const tirar = registrarDialogoPrioritario()
    const { unmount } = render(painel())
    unmount()
    act(() => tirar())
    expect(aberturas).toBe(0)
  })

  it('o painel desmontado sem ter chegado a abrir não manda o foco para a reserva: ele não tomou o foco de ninguém', () => {
    const tirar = registrarDialogoPrioritario()
    const reserva = vi.fn()
    const { unmount } = render(
      <Sheet titulo="Painel de teste" aoFechar={() => undefined} focoDeReserva={reserva}>
        Conteúdo
      </Sheet>,
    )
    unmount()
    act(() => tirar())
    expect(reserva).not.toHaveBeenCalled()
  })

  it('quem abriu é quem tem o foco quando o painel de fato abre, e não quando ele montou', () => {
    const tirar = registrarDialogoPrioritario()
    const { rerender } = render(
      <>
        <button>A</button>
        <button>B</button>
        {painel()}
      </>,
    )
    const [a, b] = screen.getAllByRole('button')
    if (a === undefined || b === undefined) throw new Error('os dois botões não foram montados')
    a.focus()
    // Enquanto o painel espera, o foco anda: quando ele abrir, é o B que o tem.
    b.focus()
    act(() => tirar())
    expect(document.activeElement).toBe(document.querySelector('[data-painel-miolo]'))
    // Fecha o painel e deixa os botões: o foco volta ao que o tinha quando ele abriu.
    rerender(
      <>
        <button>A</button>
        <button>B</button>
      </>,
    )
    expect(document.activeElement).toBe(b)
  })
})
