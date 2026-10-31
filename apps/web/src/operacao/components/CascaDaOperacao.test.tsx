// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { escolherAparencia } from '../../theme'
import { TEXTO_DA_OPERACAO_SEM_DADO_DE_PESSOA } from '../textos'
import { CascaDaOperacao, CascaPublicaDaOperacao } from './CascaDaOperacao'

/**
 * A barra de topo da operação (X1, 15.0; `docs/interface.md` 11.4): o que o `jsdom` sabe é a estrutura, e ela é a que o
 * leitor de tela percorre — o `banner` com a marca e o nome, o "Sair" dentro dele, a navegação com o item aceso. A
 * Aparência (RF3) fica ao lado do "Sair", só com a sessão aberta; as telas de fora da sessão seguem o sistema, sem
 * controle. A cor, a altura, o anel e a largura são do e2e (`e2e/operacao.spec.ts`, `e2e/aparencia.spec.ts`).
 */
beforeEach(() => {
  window.localStorage.clear()
  vi.stubGlobal('matchMedia', undefined)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  escolherAparencia('sistema')
  window.localStorage.clear()
})

describe('a barra de topo da operação', () => {
  it('com a sessão aberta, a barra leva a Aparência, com o nome só para o leitor de tela, e o "Sair"', () => {
    render(
      <CascaDaOperacao nome="Operador Exemplo" aoSair={() => undefined} saindo={false}>
        <p>conteúdo</p>
      </CascaDaOperacao>,
    )
    expect(screen.getByRole('radiogroup', { name: 'Aparência' })).toBeTruthy()
    expect(screen.queryByText('Aparência')).toBeNull()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy()
  })

  it('as telas de fora da sessão (entrar e o segundo fator) não têm o controle', () => {
    render(
      <CascaPublicaDaOperacao titulo="Entrar">
        <p>formulário</p>
      </CascaPublicaDaOperacao>,
    )
    expect(screen.queryByRole('radiogroup', { name: 'Aparência' })).toBeNull()
  })

  it('o banner diz "Operação Turmma" com o nome de quem entrou, e o "Sair" está dentro dele', () => {
    render(
      <Dentro caminho="/operacao">
        <CascaDaOperacao nome="Operador Exemplo" aoSair={() => undefined} saindo={false}>
          <p>conteúdo</p>
        </CascaDaOperacao>
      </Dentro>,
    )
    const banner = screen.getByRole('banner')
    expect(banner.textContent).toContain('Operação Turmma')
    expect(within(banner).getByText('Operador Exemplo')).toBeTruthy()
    expect(within(banner).getByRole('button', { name: 'Sair' })).toBeTruthy()
    // Sem lateral e sem outra navegação: só a da operação, para ninguém confundir com a tela de uma escola.
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'))).toEqual(['Operação'])
  })

  it('enquanto sai, o "Sair" fica desligado e diz "Saindo…"; fora disso chama o aoSair uma vez por clique', () => {
    const aoSair = vi.fn()
    const { rerender } = render(
      <Dentro caminho="/operacao">
        <CascaDaOperacao aoSair={aoSair} saindo={false}>
          <p>conteúdo</p>
        </CascaDaOperacao>
      </Dentro>,
    )
    const sair = screen.getByRole('button', { name: 'Sair' })
    expect((sair as HTMLButtonElement).disabled).toBe(false)
    sair.click()
    expect(aoSair).toHaveBeenCalledTimes(1)

    rerender(
      <Dentro caminho="/operacao">
        <CascaDaOperacao aoSair={aoSair} saindo>
          <p>conteúdo</p>
        </CascaDaOperacao>
      </Dentro>,
    )
    const saindo = screen.getByRole('button', { name: 'Saindo…' }) as HTMLButtonElement
    expect(saindo.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull()
  })

  it('a navegação tem Escolas e Uso, e só o link da tela em que a pessoa está leva o aria-current', () => {
    for (const [caminho, aceso, apagado] of [
      ['/operacao', 'Escolas', 'Uso'],
      ['/operacao/uso', 'Uso', 'Escolas'],
    ] as const) {
      const { unmount } = render(
        <Dentro caminho={caminho}>
          <CascaDaOperacao aoSair={() => undefined} saindo={false}>
            <p>conteúdo</p>
          </CascaDaOperacao>
        </Dentro>,
      )
      const navegacao = screen.getByRole('navigation', { name: 'Operação' })
      expect(within(navegacao).getAllByRole('link')).toHaveLength(2)
      expect(within(navegacao).getByRole('link', { name: aceso }).getAttribute('aria-current')).toBe('page')
      expect(within(navegacao).getByRole('link', { name: apagado }).getAttribute('aria-current')).toBeNull()
      unmount()
    }
  })
})

describe('a página da operação (X2, 14.0)', () => {
  it('o título é "Operação", com a frase fixa embaixo e a navegação das abas dentro do main, antes da tela', () => {
    render(
      <Dentro caminho="/operacao">
        <CascaDaOperacao aoSair={() => undefined} saindo={false}>
          <p>a lista</p>
        </CascaDaOperacao>
      </Dentro>,
    )
    const principal = screen.getByRole('main')
    expect(within(principal).getByRole('heading', { level: 1, name: 'Operação' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(within(principal).getByText(TEXTO_DA_OPERACAO_SEM_DADO_DE_PESSOA)).toBeTruthy()
    const navegacao = within(principal).getByRole('navigation', { name: 'Operação' })
    // A ordem de leitura: título, abas e, por fim, a tela.
    const titulo = within(principal).getByRole('heading', { level: 1 })
    const tela = within(principal).getByText('a lista')
    expect(titulo.compareDocumentPosition(navegacao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(navegacao.compareDocumentPosition(tela) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a frase fixa diz que a operação não vê aluno nem professor, com as três coisas que não vê', () => {
    expect(TEXTO_DA_OPERACAO_SEM_DADO_DE_PESSOA).toBe('A operação não vê dado de aluno nem de professor: nem nome, nem nota, nem conversa.')
  })
})

describe('a casca de fora da sessão', () => {
  it('tem o banner "Operação Turmma" e o título, sem "Sair" e sem navegação', () => {
    render(
      <CascaPublicaDaOperacao titulo="Entrar na operação">
        <p>formulário</p>
      </CascaPublicaDaOperacao>,
    )
    expect(screen.getByRole('banner').textContent).toContain('Operação Turmma')
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar na operação' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})

/** Os `Link` da navegação pedem um roteador; a base é a da área, como no `nest` de `routes.tsx`. */
function Dentro({ caminho, children }: { caminho: string; children: ReactNode }) {
  return (
    <Router base="/operacao" hook={memoryLocation({ path: caminho }).hook}>
      {children}
    </Router>
  )
}
