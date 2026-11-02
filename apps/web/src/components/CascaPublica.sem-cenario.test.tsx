// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CascaPublica } from './CascaPublica'

/**
 * Só o pedaço do cenário não carrega, e o da onça de 88 px sim: a rede da escola às 7h30 pode entregar um pedaço e perder o outro
 * (regras 50 e 80). A casca não tem fronteira de erro, e o formulário continua; a caixa de 432 × 300 fica vazia e a onça pequena,
 * que vem de outro pedaço, aparece. O `vi.mock` vale para o arquivo inteiro, por isso este caso não mora em
 * `CascaPublica.sem-onca.test.tsx` (lá os dois pedaços falham juntos).
 */
vi.mock('./ui/onca/CenaDaOnca', () => {
  throw new Error('o pedaço do cenário não carregou')
})

afterEach(cleanup)

async function esperarOImportFalhar(): Promise<void> {
  for (let volta = 0; volta < 5; volta += 1) await act(async () => { await Promise.resolve() })
}

describe('CascaPublica sem o pedaço do cenário', () => {
  it('o formulário continua, a caixa do cenário fica vazia e a onça de 88 px chega do pedaço dela', async () => {
    const { container } = render(
      <CascaPublica titulo="Entrar">
        <label>
          E-mail
          <input name="email" />
        </label>
        <button type="button">Entrar</button>
      </CascaPublica>,
    )
    await esperarOImportFalhar()

    const principal = screen.getByRole('main')
    expect(within(principal).getByRole('heading', { level: 1, name: 'Entrar' })).toBeTruthy()
    expect(within(principal).getByLabelText('E-mail')).toBeTruthy()
    expect(within(screen.getByRole('banner')).getByText('Turmma')).toBeTruthy()
    // A caixa de 432 × 300 segue no lugar, vazia: a página não pula e o painel não ganha um cenário pela metade.
    const caixa = container.querySelector('[data-cena-da-onca-caixa]') as HTMLElement
    expect(caixa.childElementCount).toBe(0)
    expect(container.querySelectorAll('[data-cena-da-onca]')).toHaveLength(0)
    // A de 88 px vem de outro pedaço, que carregou: ela aparece, parada, e só ela.
    await waitFor(() => { expect(container.querySelectorAll('[data-onca-da-marca]')).toHaveLength(1) })
    const pequena = container.querySelector('[data-onca-da-marca-pequena]') as HTMLElement
    expect(pequena.querySelector('[data-onca-da-marca] svg')?.getAttribute('width')).toBe('88')
    expect(caixa.querySelector('[data-onca-da-marca]')).toBeNull()
  })
})
