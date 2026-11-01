// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { classesOf, tokenOf } from '../../../__fixtures__/class-colors'
import { QueueAlert } from './QueueAlert'

/**
 * O aviso de fila da conversa (`docs/interface.md` 10.2, "degradação declarada"; regra 80, item 4): a demora é calma
 * (`status`), a falha é imediata (`alert`) e diz o que fazer, e **nenhuma das duas mostra erro cru**. A cor resolvida por
 * tema e o contraste são do axe da galeria; aqui está o papel de cada situação e o que o texto não pode conter.
 */
afterEach(cleanup)

describe('AvisoFila', () => {
  it('a falha é `alert`, diz o que fazer e tem o "Tentar de novo", que pede de novo uma vez só', async () => {
    const aoTentarDeNovo = vi.fn()
    const { container } = render(<QueueAlert situacao="falha" aoTentarDeNovo={aoTentarDeNovo} />)
    const alerta = screen.getByRole('alert')
    expect(alerta.textContent).toBe('Não foi possível responder agora. Tente de novo em instantes.')
    expect(screen.queryByRole('status')).toBeNull()

    const botao = screen.getByRole('button', { name: 'Tentar de novo' })
    // O botão fica fora da região que o leitor de tela anuncia: o alerta é só o texto.
    expect(alerta.contains(botao)).toBe(false)
    expect(container.querySelector('[data-aviso-fila="falha"]')?.contains(botao)).toBe(true)
    // `secundario`: borda de 2 px e o degrau da borda, e não a face do primário nem a do oficial.
    expect(classesOf(botao).has('degrau-borda')).toBe(true)
    expect(tokenOf(botao, 'bg')).not.toBe('laranja')
    await userEvent.setup().click(botao)
    expect(aoTentarDeNovo).toHaveBeenCalledTimes(1)
  })

  it('a demora é `status`, sem alerta e sem botão, mesmo que quem usa passe o "tentar de novo"', () => {
    render(<QueueAlert situacao="demora" aoTentarDeNovo={() => undefined} />)
    const estado = screen.getByRole('status')
    expect(estado.textContent).toBe('Ainda preparando. Pode levar mais alguns segundos. Você não precisa pedir de novo.')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('a falha sem a ação não inventa botão, e nenhuma das duas situações mostra código nem nome de provedor', () => {
    const { container, rerender } = render(<QueueAlert situacao="falha" />)
    expect(screen.queryByRole('button')).toBeNull()
    for (const situacao of ['demora', 'falha'] as const) {
      rerender(<QueueAlert situacao={situacao} />)
      const texto = container.textContent ?? ''
      expect(texto, situacao).not.toMatch(/\b\d{3}\b|erro|error|exception|timeout|429|500|openai|maritaca|google|ollama|provedor|modelo/i)
    }
  })

  it('as duas situações têm a borda de 2 px; a falha na família do erro e a demora, na borda comum', () => {
    const { container, rerender } = render(<QueueAlert situacao="falha" />)
    const falha = new Set(classesOf(container.querySelector('[data-aviso-fila="falha"]') as HTMLElement))
    expect(falha.has('border-2')).toBe(true)
    expect(container.querySelector('[data-aviso-fila="falha"]')).not.toBeNull()
    const noDaFalha = container.querySelector('[data-aviso-fila="falha"]') as HTMLElement
    expect(tokenOf(noDaFalha, 'border')).toBe('vermelho-borda')
    expect(tokenOf(noDaFalha, 'bg')).toBe('erro-cx')

    rerender(<QueueAlert situacao="demora" />)
    const noDaDemora = container.querySelector('[data-aviso-fila="demora"]') as HTMLElement
    expect(classesOf(noDaDemora).has('border-2')).toBe(true)
    expect(tokenOf(noDaDemora, 'border')).toBe('borda')
    expect(tokenOf(noDaDemora, 'bg')).toBe('info-cx')
    // Aviso não é alarme: nenhuma classe de movimento, nem na demora nem na falha.
    for (const classes of [falha, classesOf(noDaDemora)]) expect([...classes].filter((classe) => /^(animate-|transition|duration-)/.test(classe))).toEqual([])
  })
})
