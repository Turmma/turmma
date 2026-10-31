// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { escolherAparencia } from '../theme'
import { classesDo } from '../__fixtures__/class-colors'
import { iniciaisDe, MenuDaPessoa } from './MenuDaPessoa'

/**
 * O lugar da Aparência (RF3 da X1): "Sua conta", entre os links da pessoa e o "Sair", que continua sendo o último. No
 * trilho de 56 px, onde só cabem ícones, ela não aparece. A escolha em si é de `Aparencia.test.tsx`; o que se vê na
 * lateral de verdade, no teclado, é do e2e (`e2e/casca.spec.ts › W12` e `e2e/aparencia.spec.ts`).
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

describe('iniciaisDe', () => {
  it('a primeira letra da primeira e da última palavra, em maiúscula; uma palavra dá uma letra e vazio não dá nenhuma', () => {
    expect(iniciaisDe('Camila Souza')).toBe('CS')
    expect(iniciaisDe('  maria  da Silva  Santos ')).toBe('MS')
    expect(iniciaisDe('Ágata')).toBe('Á')
    expect(iniciaisDe('')).toBe('')
    expect(iniciaisDe('   ')).toBe('')
  })
})

describe('MenuDaPessoa', () => {
  it('a Aparência fica no menu da conta, antes do "Sair", que continua sendo o último controle', () => {
    render(<MenuDaPessoa nome="Professora Exemplo" papel="Professor" aoSair={() => undefined} saindo={false} />)
    const grupo = screen.getByRole('radiogroup', { name: 'Aparência' })
    const sair = screen.getByRole('button', { name: 'Sair' })
    expect(grupo.compareDocumentPosition(sair) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const controles = screen.getAllByRole('button').concat(screen.getAllByRole('radio'))
    const ultimo = controles.reduce((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? b : a))
    expect(ultimo).toBe(sair)
  })

  it('no trilho, só ícones: a Aparência não aparece, e o "Sair" continua alcançável', () => {
    render(<MenuDaPessoa nome="Professora Exemplo" aoSair={() => undefined} saindo={false} trilho />)
    expect(screen.queryByRole('radiogroup', { name: 'Aparência' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy()
  })

  it('o pé mostra as iniciais (decoração), o nome e o papel; o nome da pessoa é o do texto, e as iniciais não entram nele', () => {
    const { container } = render(<MenuDaPessoa nome="Camila Souza" papel="professor" aoSair={() => undefined} saindo={false} />)
    const iniciais = container.querySelector('[data-iniciais]')
    expect(iniciais?.textContent).toBe('CS')
    expect(iniciais?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText('Camila Souza')).toBeTruthy()
    expect(screen.getByText('professor')).toBeTruthy()
    // Sem o nome ainda (o `/v1/eu` não chegou), não há bolinha: só o "Sair".
    cleanup()
    const vazio = render(<MenuDaPessoa aoSair={() => undefined} saindo={false} />)
    expect(vazio.container.querySelector('[data-iniciais]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy()
  })

  it('o "Sair" tem a medida de um lugar da navegação, aberto e no trilho, e não é menor que ele (RF15; D59)', () => {
    for (const trilho of [false, true]) {
      render(<MenuDaPessoa nome="Professora Exemplo" aoSair={() => undefined} saindo={false} trilho={trilho} />)
      const classes = classesDo(screen.getByRole('button', { name: 'Sair' }))
      // A mesma altura que `ItemDaLateral` desenha: 52 px, aberto (e a linha inteira) ou o quadrado do trilho.
      expect(classes.has(trilho ? 'size-13' : 'min-h-13'), `trilho: ${String(trilho)}`).toBe(true)
      if (!trilho) expect(classes.has('w-full')).toBe(true)
      expect(classes.has('border-2')).toBe(true)
      // O espaço da borda existe também no "Sair", transparente: acender o vizinho não desloca nada.
      expect(classes.has('border-transparent')).toBe(true)
      expect(classes.has('disabled:text-inativo')).toBe(true)
      cleanup()
    }
  })

  it('"Saindo…" desliga o botão sem trocar o lugar, aberto e no trilho', () => {
    for (const trilho of [false, true]) {
      render(<MenuDaPessoa nome="Professora Exemplo" aoSair={() => undefined} saindo trilho={trilho} />)
      const botao = screen.getByRole('button', { name: 'Saindo…' }) as HTMLButtonElement
      expect(botao.disabled, `trilho: ${String(trilho)}`).toBe(true)
      cleanup()
    }
  })

  it('no trilho não há bolinha das iniciais, mesmo com o nome, e o nome da pessoa não aparece', () => {
    const { container } = render(<MenuDaPessoa nome="Camila Souza" papel="professor" aoSair={() => undefined} saindo={false} trilho />)
    expect(container.querySelector('[data-iniciais]')).toBeNull()
    expect(screen.queryByText('Camila Souza')).toBeNull()
    expect(screen.queryByText('CS')).toBeNull()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy()
  })

  it('nome só de espaços não desenha a bolinha das iniciais', () => {
    const { container } = render(<MenuDaPessoa nome="   " aoSair={() => undefined} saindo={false} />)
    expect(container.querySelector('[data-iniciais]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy()
  })
})
