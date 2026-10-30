// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CascaPublica } from './CascaPublica'

/**
 * O pedaço da onça que não carrega (rede de escola instável às 7h30; regras 50 e 80): a casca pública não tem fronteira de
 * erro em volta, e quem a usa é a entrada, o convite, o segundo fator e a página da turma. Uma figura de enfeite não pode
 * derrubar o formulário. O `vi.mock` vale para o arquivo inteiro, por isso este caso não mora em `CascaPublica.test.tsx`: lá a
 * onça carrega de verdade.
 */
vi.mock('./ui/onca/OncaDaMarca', () => {
  throw new Error('o pedaço da onça não carregou')
})

afterEach(cleanup)

async function esperarOImportFalhar(): Promise<void> {
  // O `import()` rejeita numa microtarefa e o `lazy` relança no render seguinte: algumas voltas bastam, e a falha, se não fosse
  // tratada, desmontaria a árvore dentro do `act`.
  for (let volta = 0; volta < 5; volta += 1) await act(async () => { await Promise.resolve() })
}

describe('CascaPublica sem o pedaço da onça', () => {
  it('o formulário continua na tela, e as duas caixas ficam no lugar, vazias', async () => {
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
    expect(within(principal).getByRole('button', { name: 'Entrar' })).toBeTruthy()
    expect(within(screen.getByRole('banner')).getByText('Turmma')).toBeTruthy()
    // A página não pula: as caixas de 160 e 88 px seguem, sem a onça dentro.
    const grande = container.querySelector('[data-onca-da-marca-grande]') as HTMLElement
    const pequena = container.querySelector('[data-onca-da-marca-pequena]') as HTMLElement
    expect(grande.getAttribute('class')).toMatch(/\bsize-40\b/)
    expect(pequena.getAttribute('class')).toMatch(/\bsize-22\b/)
    expect(container.querySelectorAll('[data-onca-da-marca], svg')).toHaveLength(0)
    expect(grande.childElementCount + pequena.childElementCount).toBe(0)
  })
})
