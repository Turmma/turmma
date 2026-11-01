// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { classesOf, contraste, tokenColor, TEMAS, tokenOrThrow } from '../../../__fixtures__/class-colors'
import { SearchInput } from './SearchInput'

/**
 * A busca da D80 (`docs/interface.md` 10.2): o nome do campo é o rótulo, que só o leitor de tela lê, e o valor é de quem
 * usa. A altura de 44 px, a lupa e o anel desenhado são do e2e da galeria, porque o `jsdom` não os calcula.
 */
afterEach(cleanup)

function Controlada({ aoMudar = () => undefined, rotulo = 'Buscar' }: { aoMudar?: (valor: string) => void; rotulo?: string }) {
  const [valor, definirValor] = useState('')
  return (
    <SearchInput
      valor={valor}
      rotulo={rotulo}
      aoMudar={(novo) => {
        definirValor(novo)
        aoMudar(novo)
      }}
    />
  )
}

describe('Busca', () => {
  it('é um campo de busca cujo nome acessível é o rótulo que quem usa a peça deu', () => {
    render(<Controlada rotulo="Buscar atividades" />)
    expect(screen.getByRole('searchbox', { name: 'Buscar atividades' })).toBeTruthy()
    cleanup()
    render(<Controlada rotulo="Buscar na biblioteca" />)
    expect(screen.getByRole('searchbox', { name: 'Buscar na biblioteca' })).toBeTruthy()
  })

  it('pede o teclado de busca no celular e não oferece preenchimento automático', () => {
    render(<Controlada />)
    const campo = screen.getByRole('searchbox', { name: 'Buscar' })
    expect(campo.getAttribute('inputmode')).toBe('search')
    expect(campo.getAttribute('autocomplete')).toBe('off')
  })

  it('o rótulo é só para o leitor de tela e se repete como exemplo; a lupa é decoração', () => {
    render(<Controlada rotulo="Buscar na biblioteca" />)
    const campo = screen.getByRole('searchbox', { name: 'Buscar na biblioteca' })
    expect(campo.getAttribute('placeholder')).toBe('Buscar na biblioteca')
    const rotulo = screen.getByText('Buscar na biblioteca', { selector: 'label' })
    expect(classesOf(rotulo).has('sr-only')).toBe(true)
    expect(campo.parentElement?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('avisa o que a pessoa digita, e o valor é o que quem usa devolve', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<Controlada aoMudar={aoMudar} />)
    const campo = screen.getByRole('searchbox', { name: 'Buscar' })
    await usuario.type(campo, 'estequ')
    expect(aoMudar).toHaveBeenLastCalledWith('estequ')
    expect(aoMudar).toHaveBeenCalledTimes(6)
    expect((campo as HTMLInputElement).value).toBe('estequ')
  })

  it('tem a caixa do campo: borda de 2 px em borda-campo, que se vê nos dois temas, e o anel colado nela', () => {
    render(<Controlada />)
    const campo = screen.getByRole('searchbox', { name: 'Buscar' })
    const classes = classesOf(campo)
    expect(classes.has('border-2')).toBe(true)
    expect(classes.has('focus-visible:outline-offset-0')).toBe(true)
    const borda = tokenOrThrow(campo, 'border')
    expect(borda).toBe('borda-campo')
    for (const tema of TEMAS) {
      expect(contraste(tokenColor(tema, borda), tokenColor(tema, 'fundo')), `${tema}: contra o chão`).toBeGreaterThanOrEqual(3)
      expect(contraste(tokenColor(tema, borda), tokenColor(tema, tokenOrThrow(campo, 'bg'))), `${tema}: contra o campo`).toBeGreaterThanOrEqual(3)
    }
  })
})
