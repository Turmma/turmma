// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Botao } from './Botao'
import { classesDoBotao, TAMANHOS_DE_BOTAO, VARIANTES_DE_BOTAO } from './button-variants'

/**
 * O `Botao` da D80 (`docs/interface.md` 10.2): o que a peça promete sem depender de medida. O `jsdom` não calcula cor,
 * tamanho nem `:active`: a cor resolvida, o degrau e os 44 px são do teste de classes (`button-variants.test.ts`), do
 * CSS (`estilos.test.ts`) e do e2e da galeria.
 */
afterEach(cleanup)

const classesDe = (elemento: HTMLElement): Set<string> => new Set(elemento.className.split(/\s+/).filter((classe) => classe !== ''))

describe('Botao', () => {
  it('é a ação primária de 44 px quando nada é dito, e nunca envia formulário por engano', () => {
    render(<Botao>Salvar</Botao>)
    const botao = screen.getByRole('button', { name: 'Salvar' })
    expect(botao).toHaveProperty('type', 'button')
    expect([...classesDe(botao)].sort()).toEqual(classesDoBotao().split(/\s+/).sort())
    expect(classesDe(botao).has('bg-laranja')).toBe(true)
  })

  it.each(VARIANTES_DE_BOTAO)('a variante %s leva as classes da tabela, e a classe que a tela acrescenta fica ao lado', (variante) => {
    render(
      <Botao variante={variante} className="w-full">
        Texto
      </Botao>,
    )
    const botao = screen.getByRole('button', { name: 'Texto' })
    const esperadas = classesDoBotao({ variante }).split(/\s+/)
    for (const classe of esperadas) expect(classesDe(botao).has(classe), classe).toBe(true)
    expect(classesDe(botao).has('w-full')).toBe(true)
  })

  it.each(TAMANHOS_DE_BOTAO)('o tamanho %s leva as classes dele', (tamanho) => {
    render(
      <Botao tamanho={tamanho} aria-label="Ação">
        +
      </Botao>,
    )
    const botao = screen.getByRole('button', { name: 'Ação' })
    for (const classe of classesDoBotao({ tamanho }).split(/\s+/)) expect(classesDe(botao).has(classe), classe).toBe(true)
  })

  it('o perigo cheio é a face vermelha só quando pedido, e o tipo não aceita cheio em outra variante', () => {
    render(
      <>
        <Botao variante="perigo">Excluir</Botao>
        <Botao variante="perigo" cheio>
          Excluir de vez
        </Botao>
        {/* @ts-expect-error `cheio` só existe no `perigo`: na primária o tipo reprova, e o runtime o ignora */}
        <Botao variante="primario" cheio>
          Salvar
        </Botao>
      </>,
    )
    expect(classesDe(screen.getByRole('button', { name: 'Excluir' })).has('bg-vermelho')).toBe(false)
    expect(classesDe(screen.getByRole('button', { name: 'Excluir de vez' })).has('bg-vermelho')).toBe(true)
    expect(classesDe(screen.getByRole('button', { name: 'Salvar' })).has('bg-vermelho')).toBe(false)
  })

  it('desligado, o clique não faz nada, e o botão avisa que está desligado ao leitor de tela', async () => {
    const aoClicar = vi.fn()
    render(
      <Botao disabled onClick={aoClicar}>
        Enviar
      </Botao>,
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
      <Botao onClick={aoClicar}>
        <svg aria-hidden="true" width="20" height="20" />
        Nova turma
      </Botao>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Nova turma' }))
    expect(aoClicar).toHaveBeenCalledTimes(1)
  })

  it('entrega o elemento pela ref e deixa o tipo submit passar', () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <Botao ref={ref} type="submit">
        Entrar
      </Botao>,
    )
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Entrar' }))
    expect(ref.current?.type).toBe('submit')
  })
})
