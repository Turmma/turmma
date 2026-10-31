// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { escolherLetra } from '../../text-size'
import { TamanhoDaLetra, TEXTO_DA_PREVIA } from './TamanhoDaLetra'

/**
 * A escolha do tamanho da letra (telas do aluno e primeiro acesso, 8.0; RF11), vista como o aluno a usa: três opções, uma
 * marcada, a prévia, e uma escolha que só grava quando ele a faz. O que a letra faz na tela (20 px no `<html>`, 360 px sem
 * rolar de lado) é do e2e (`e2e/tamanho-da-letra.spec.ts`); aqui está o que a peça faz com o teclado e com o armazenamento.
 */
const grupo = () => screen.getByRole('group', { name: 'Tamanho da letra' })
const marcada = () => screen.getAllByRole('radio').find((radio) => (radio as HTMLInputElement).checked)?.closest('label')?.textContent
const guardado = () => Object.entries(window.localStorage)

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  // A escolha que o armazenamento recusou fica na memória do módulo, até uma gravação que funcione.
  escolherLetra('padrao')
  window.localStorage.clear()
})

describe('TamanhoDaLetra', () => {
  it('mostra Padrão, Grande e Maior num grupo nomeado, com Padrão marcado e a prévia, e não escreve nada ao montar', () => {
    const gravar = vi.spyOn(Storage.prototype, 'setItem')
    const apagar = vi.spyOn(Storage.prototype, 'removeItem')
    render(<TamanhoDaLetra />)
    expect(grupo()).toBeTruthy()
    expect(screen.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual(['Padrão', 'Grande', 'Maior'])
    expect(marcada()).toBe('Padrão')
    expect(screen.getByText(TEXTO_DA_PREVIA).textContent).toBe('Assim fica a minha letra.')
    expect(gravar).not.toHaveBeenCalled()
    expect(apagar).not.toHaveBeenCalled()
    expect(guardado()).toEqual([])
  })

  it('escolher Grande e Maior grava só o valor; escolher Padrão apaga a chave e o armazenamento volta a nada', async () => {
    const usuario = userEvent.setup()
    render(<TamanhoDaLetra />)

    await usuario.click(screen.getByRole('radio', { name: 'Grande' }))
    expect(marcada()).toBe('Grande')
    expect(guardado()).toEqual([['educa.letra', 'grande']])

    await usuario.click(screen.getByRole('radio', { name: 'Maior' }))
    expect(marcada()).toBe('Maior')
    expect(guardado()).toEqual([['educa.letra', 'maior']])

    await usuario.click(screen.getByRole('radio', { name: 'Padrão' }))
    expect(marcada()).toBe('Padrão')
    expect(guardado()).toEqual([])
  })

  it('abre marcada na escolha que o navegador já guardava, sem regravar', () => {
    window.localStorage.setItem('educa.letra', 'maior')
    const gravar = vi.spyOn(Storage.prototype, 'setItem')
    render(<TamanhoDaLetra />)
    expect(marcada()).toBe('Maior')
    expect(gravar).not.toHaveBeenCalled()
  })

  it('uma parada só no Tab, na opção marcada, e as setas trocam a escolha', async () => {
    const usuario = userEvent.setup()
    render(
      <>
        <button type="button">Antes</button>
        <TamanhoDaLetra />
        <button type="button">Depois</button>
      </>,
    )
    await usuario.click(screen.getByRole('button', { name: 'Antes' }))

    await usuario.tab()
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Padrão' }))
    // O segundo Tab sai do grupo: as outras duas opções não são paradas.
    await usuario.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Depois' }))

    await usuario.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Padrão' }))
    await usuario.keyboard('{ArrowDown}')
    expect(marcada()).toBe('Grande')
    expect(guardado()).toEqual([['educa.letra', 'grande']])
    await usuario.keyboard('{ArrowDown}')
    expect(marcada()).toBe('Maior')
    await usuario.keyboard('{ArrowUp}')
    expect(marcada()).toBe('Grande')
  })

  it('armazenamento que recusa a gravação: a escolha vale na tela, e nenhum erro aparece', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('armazenamento recusado')
    })
    const usuario = userEvent.setup()
    render(<TamanhoDaLetra />)
    await usuario.click(screen.getByRole('radio', { name: 'Maior' }))
    expect(marcada()).toBe('Maior')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
