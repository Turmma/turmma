// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setThemePreference, initTheme } from '../theme'
import { Aparencia } from './Aparencia'

/**
 * A escolha da aparência (RF3 e RF4 da X1), vista como a pessoa a usa: três opções, uma marcada, e a escolha que vale na
 * página na hora. O armazenamento é o do `jsdom`; o que recusa é um `Storage` que lança. O primeiro quadro, o aparelho que
 * muda de tema e a segunda aba são do e2e (`e2e/aparencia.spec.ts`).
 */
const html = () => document.documentElement
const grupo = () => screen.getByRole('radiogroup', { name: 'Aparência' })
const marcada = () => screen.getAllByRole('radio').find((radio) => radio.getAttribute('aria-checked') === 'true')?.textContent

beforeEach(() => {
  window.localStorage.clear()
  html().removeAttribute('data-tema')
  vi.stubGlobal('matchMedia', undefined)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  // A escolha que o armazenamento recusou fica na memória do módulo, até uma gravação que funcione.
  setThemePreference('sistema')
  window.localStorage.clear()
})

describe('Aparencia', () => {
  it('mostra Sistema, Claro e Escuro, com o nome "Aparência" à vista, e Sistema marcado quando ninguém escolheu', () => {
    render(<Aparencia />)
    expect(screen.getByText('Aparência')).toBeTruthy()
    expect(grupo()).toBeTruthy()
    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Sistema', 'Claro', 'Escuro'])
    expect(marcada()).toBe('Sistema')
  })

  it('escolher Escuro grava só o valor, aplica o tema na hora e marca a opção; voltar a Sistema apaga a chave', async () => {
    const usuario = userEvent.setup()
    render(<Aparencia />)

    await usuario.click(screen.getByRole('radio', { name: 'Escuro' }))
    expect(marcada()).toBe('Escuro')
    expect(Object.entries(window.localStorage)).toEqual([['educa.aparencia', 'escuro']])
    expect(html().getAttribute('data-tema')).toBe('escuro')

    await usuario.click(screen.getByRole('radio', { name: 'Claro' }))
    expect(Object.entries(window.localStorage)).toEqual([['educa.aparencia', 'claro']])
    expect(html().getAttribute('data-tema')).toBe('claro')

    await usuario.click(screen.getByRole('radio', { name: 'Sistema' }))
    expect(marcada()).toBe('Sistema')
    expect(Object.entries(window.localStorage)).toEqual([])
  })

  it('abre marcada na escolha que o navegador já guardava', () => {
    window.localStorage.setItem('educa.aparencia', 'escuro')
    render(<Aparencia />)
    expect(marcada()).toBe('Escuro')
  })

  it('pelo teclado: as setas escolhem, o tema muda e o foco acompanha', async () => {
    const usuario = userEvent.setup()
    render(<Aparencia />)
    screen.getByRole('radio', { name: 'Sistema' }).focus()
    await usuario.keyboard('{ArrowRight}')
    expect(marcada()).toBe('Claro')
    expect(html().getAttribute('data-tema')).toBe('claro')
    await usuario.keyboard('{End}')
    expect(marcada()).toBe('Escuro')
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Escuro' }))
  })

  it('com o rótulo escondido, o nome continua no grupo para o leitor de tela', () => {
    render(<Aparencia rotuloVisivel={false} />)
    expect(screen.queryByText('Aparência')).toBeNull()
    expect(grupo()).toBeTruthy()
  })

  it('a escolha feita em outro lugar da página chega à peça aberta', () => {
    render(<Aparencia />)
    expect(marcada()).toBe('Sistema')
    act(() => setThemePreference('escuro'))
    expect(marcada()).toBe('Escuro')
  })

  it('a escolha de outra aba, pelo evento storage, chega à peça aberta', () => {
    const desligar = initTheme()
    render(<Aparencia />)
    act(() => {
      window.localStorage.setItem('educa.aparencia', 'claro')
      window.dispatchEvent(new StorageEvent('storage', { key: 'educa.aparencia', newValue: 'claro' }))
    })
    expect(marcada()).toBe('Claro')
    desligar()
  })

  it('armazenamento que recusa ao ler e ao gravar: a peça não quebra, mostra Sistema, e a escolha vale até a aba fechar', async () => {
    const usuario = userEvent.setup()
    for (const metodo of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, metodo).mockImplementation(() => {
        throw new Error('armazenamento recusado')
      })
    }
    render(<Aparencia />)
    expect(marcada()).toBe('Sistema')

    await usuario.click(screen.getByRole('radio', { name: 'Escuro' }))
    expect(marcada()).toBe('Escuro')
    expect(html().getAttribute('data-tema')).toBe('escuro')
  })
})
