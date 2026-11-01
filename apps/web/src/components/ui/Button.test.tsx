// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { buttonVariants, BUTTON_SIZES, BUTTON_VARIANTS } from './button-variants'

/**
 * O `Button` da D80 (`docs/interface.md` 10.2): o que a peça promete sem depender de medida. O `jsdom` não calcula cor,
 * tamanho nem `:active`: a cor resolvida, o degrau e os 44 px são do teste de classes (`button-variants.test.ts`), do
 * CSS (`estilos.test.ts`) e do e2e da galeria.
 */
afterEach(cleanup)

const classesDe = (elemento: HTMLElement): Set<string> => new Set(elemento.className.split(/\s+/).filter((classe) => classe !== ''))

describe('Botao', () => {
  it('é a ação primária de 44 px quando nada é dito, e nunca envia formulário por engano', () => {
    render(<Button>Salvar</Button>)
    const botao = screen.getByRole('button', { name: 'Salvar' })
    expect(botao).toHaveProperty('type', 'button')
    expect([...classesDe(botao)].sort()).toEqual(buttonVariants().split(/\s+/).sort())
    expect(classesDe(botao).has('bg-laranja')).toBe(true)
  })

  it.each(BUTTON_VARIANTS)('a variante %s leva as classes da tabela, e a classe que a tela acrescenta fica ao lado', (variante) => {
    render(
      <Button variante={variante} className="w-full">
        Texto
      </Button>,
    )
    const botao = screen.getByRole('button', { name: 'Texto' })
    const esperadas = buttonVariants({ variante }).split(/\s+/)
    for (const classe of esperadas) expect(classesDe(botao).has(classe), classe).toBe(true)
    expect(classesDe(botao).has('w-full')).toBe(true)
  })

  it.each(BUTTON_SIZES)('o tamanho %s leva as classes dele', (tamanho) => {
    render(
      <Button tamanho={tamanho} aria-label="Ação">
        +
      </Button>,
    )
    const botao = screen.getByRole('button', { name: 'Ação' })
    for (const classe of buttonVariants({ tamanho }).split(/\s+/)) expect(classesDe(botao).has(classe), classe).toBe(true)
  })

  it('o perigo cheio é a face vermelha só quando pedido, e o tipo não aceita cheio em outra variante', () => {
    render(
      <>
        <Button variante="perigo">Excluir</Button>
        <Button variante="perigo" cheio>
          Excluir de vez
        </Button>
        {/* @ts-expect-error `cheio` só existe no `perigo`: na primária o tipo reprova, e o runtime o ignora */}
        <Button variante="primario" cheio>
          Salvar
        </Button>
      </>,
    )
    expect(classesDe(screen.getByRole('button', { name: 'Excluir' })).has('bg-vermelho')).toBe(false)
    expect(classesDe(screen.getByRole('button', { name: 'Excluir de vez' })).has('bg-vermelho')).toBe(true)
    expect(classesDe(screen.getByRole('button', { name: 'Salvar' })).has('bg-vermelho')).toBe(false)
  })

  it('desligado, o clique não faz nada, e o botão avisa que está desligado ao leitor de tela', async () => {
    const aoClicar = vi.fn()
    render(
      <Button disabled onClick={aoClicar}>
        Enviar
      </Button>,
    )
    const botao = screen.getByRole('button', { name: 'Enviar' })
    expect(botao).toHaveProperty('disabled', true)
    await userEvent.click(botao)
    expect(aoClicar).not.toHaveBeenCalled()
    // O desenho do desligado é da classe: face `borda`, texto `apoio` e, no CSS, sem degrau.
    expect(classesDe(botao).has('disabled:bg-borda')).toBe(true)
    expect(classesDe(botao).has('disabled:text-apoio')).toBe(true)
  })

  it('ligado, o clique chega, e o rótulo continua o nome acessível com um glifo ao lado', async () => {
    const aoClicar = vi.fn()
    render(
      <Button onClick={aoClicar}>
        <svg aria-hidden="true" width="20" height="20" />
        Nova turma
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Nova turma' }))
    expect(aoClicar).toHaveBeenCalledTimes(1)
  })

  it('entrega o elemento pela ref e deixa o tipo submit passar', () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <Button ref={ref} type="submit">
        Entrar
      </Button>,
    )
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Entrar' }))
    expect(ref.current?.type).toBe('submit')
  })
})
