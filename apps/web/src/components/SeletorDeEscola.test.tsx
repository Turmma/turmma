// @vitest-environment jsdom
import type { AcessoDaConta } from '@educa/shared'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { classesOf } from '../__fixtures__/class-colors'
import { SeletorDeEscola } from './SeletorDeEscola'

/**
 * O seletor de escola da lateral (`docs/interface.md` 11.1; D80, 12.0): o botão e cada linha da lista têm 48 px de altura
 * (`min-h-12`). No navegador as duas linhas de texto já passam de 48 px, e por isso a altura mínima não aparece numa
 * medida: quem a prova é a classe, aqui. A troca em si, o teclado e o toque são de `e2e/troca-de-escola.spec.ts`.
 */
afterEach(cleanup)

const ESCOLA_A = '0197a1c0-0000-7000-8000-00000000000a'
const ESCOLA_B = '0197a1c0-0000-7000-8000-00000000000b'
const ACESSOS: readonly AcessoDaConta[] = [
  { usuarioId: ESCOLA_A, escolaNome: 'Colégio Vista Alegre', redeNome: 'Rede Vista Alegre', papel: 'professor' },
  { usuarioId: ESCOLA_B, escolaNome: 'Escola Municipal do Norte', redeNome: 'Rede Norte', papel: 'professor' },
]

function desenhar(): void {
  render(
    <Router hook={memoryLocation({ path: '/professor/nova-conversa' }).hook}>
      <SeletorDeEscola escolaAtual="Colégio Vista Alegre" acessos={ACESSOS} usuarioAtual={ESCOLA_A} />
    </Router>,
  )
}

describe('SeletorDeEscola', () => {
  it('o botão e cada linha da lista têm a altura mínima de 48 px, com a borda de 2 px no botão', () => {
    desenhar()
    const botao = screen.getByRole('button', { name: /Colégio Vista Alegre/ })
    expect(classesOf(botao).has('min-h-12')).toBe(true)
    expect(classesOf(botao).has('min-h-11')).toBe(false)
    expect(classesOf(botao).has('border-2')).toBe(true)

    fireEvent.click(botao)
    const linhas = screen.getByRole('list', { name: 'Suas escolas' }).querySelectorAll('button')
    expect(linhas).toHaveLength(2)
    for (const linha of linhas) {
      expect(classesOf(linha).has('min-h-12'), linha.textContent ?? '').toBe(true)
      expect(classesOf(linha).has('min-h-11'), linha.textContent ?? '').toBe(false)
    }
  })

  it('com uma escola só não há botão: fica o nome dela, para o leitor de tela dito como "Escola"', () => {
    render(
      <Router hook={memoryLocation({ path: '/' }).hook}>
        <SeletorDeEscola escolaAtual="Colégio Vista Alegre" acessos={ACESSOS.slice(0, 1)} usuarioAtual={ESCOLA_A} />
      </Router>,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Colégio Vista Alegre')).toBeTruthy()
  })
})
