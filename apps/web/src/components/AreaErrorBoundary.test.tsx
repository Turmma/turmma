// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { esquecerTodosOsEspelhos, readEspelho } from '../api/espelho-da-fila'
import { createQueryClient } from '../api/query-client'
import { createFilaDeRespostas } from '../areas/aluno/fila-de-respostas'
import { fakeNetwork, setupScreen, type FakeNetwork } from '../__fixtures__/render-screen'
import { AppRoutes } from '../routes'
import { AreaErrorBoundary } from './AreaErrorBoundary'

/**
 * A fronteira de erro (13.0, RF12): o componente que lança numa rota sem área mostra a tela de falha de página inteira, com o
 * "Voltar ao início", e não a página branca. É o `AppRoutes` de verdade, com a tela da rota trocada por uma que lança; a
 * fronteira da área, a casca e a rede falsa são as de verdade. Medida, foco e toque são do e2e (`tela-de-falha.spec.ts`),
 * e a saída da tela de falha pelo clique também: o "Voltar ao início" é um link que recarrega a página (o `state` da fronteira só
 * se desfaz com a página nova), e o `jsdom` não navega.
 */
setupScreen()

// As telas que lançam. `vi.mock` sobe para o topo do arquivo, e a fábrica não pode citar variável do módulo.
vi.mock('../pages/Entrar', () => ({
  Entrar: () => {
    throw new Error('a entrada quebrou')
  },
}))
vi.mock('../pages/TurmaPublica', () => ({
  TurmaPublica: () => {
    throw new Error('a sala pública quebrou')
  },
}))
vi.mock('../pages/TrocarSenhaProvisoria', () => ({
  TrocarSenhaProvisoria: () => {
    throw new Error('a troca de senha quebrou')
  },
}))
vi.mock('../pages/Casca', () => ({
  Casca: () => {
    throw new Error('o estado do sistema quebrou')
  },
}))
vi.mock('../operacao/routes', () => ({
  default: () => {
    throw new Error('a operação quebrou')
  },
}))
vi.mock('../areas/professor/routes', () => ({
  default: () => {
    throw new Error('a área do professor quebrou')
  },
}))

/** A mesma expressão de `e2e/support/professor/scenario.ts` (`VOCABULARIO_DE_NOTA`), copiada: a unidade não importa do e2e. */
const VOCABULARIO_DE_NOTA = /\bnotas?\b|\bconceitos?\b|pontuaç/i
/** O que a regra 50 (item 12) proíbe na tela: termo técnico, código, status, rastro de pilha. */
const TERMO_TECNICO = /\b(erro|error|exce[cç][aã]o|exception|stack|status|c[oó]digo|undefined|null|typeerror|chunk|http|\d{3})\b/i

const ESCOLA = { id: '0197a1c0-0000-7000-8000-0000000000e1', nome: 'Colégio Vista Alegre', slug: 'vista-alegre' }

let erroDoReact: MockInstance
beforeEach(() => {
  // O React escreve no console o erro que a fronteira pegou, e o `jsdom`, a navegação que ele não implementa.
  erroDoReact = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(min-width: 768px)' || consulta === '(min-width: 1024px)', media: consulta, addEventListener: () => undefined, removeEventListener: () => undefined }))
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  window.sessionStorage.clear()
})
afterEach(() => {
  erroDoReact.mockRestore()
  cleanup()
})

function abrir(caminho: string): FakeNetwork {
  const rede = fakeNetwork()
  rede.responderPor('/v1/eu', { status: 200, corpo: { usuarioId: '0197a1c0-0000-7000-8000-0000000000a1', papel: 'professor', nome: 'Camila Souza', escola: ESCOLA, inatividadeMin: 30, introducaoVistaEm: '2026-02-01T10:00:00.000Z', acessos: [] } })
  rede.responderPor(/^\/v1\//, { status: 200, corpo: { itens: [] } })
  const localizacao = memoryLocation({ path: caminho })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <Router hook={localizacao.hook}>
        <AppRoutes />
      </Router>
    </QueryClientProvider>,
  )
  return rede
}

/** O clique no link, como o navegador o faz: a navegação só acontece se ninguém a impediu. */
function clicar(alvo: HTMLElement): MouseEvent {
  const clique = new MouseEvent('click', { bubbles: true, cancelable: true })
  alvo.dispatchEvent(clique)
  return clique
}

const ROTAS_SEM_AREA = [
  ['a entrada', '/entrar'],
  ['a sala pública', '/e/vista-alegre/turma'],
  ['a troca da senha provisória', '/e/vista-alegre/trocar-senha'],
  ['o estado do sistema', '/sistema'],
] as const

describe('uma tela que quebra fora de uma área mostra a falha com o caminho de volta', () => {
  it.each(ROTAS_SEM_AREA)('%s: a Falha de página inteira, com os dois botões, e nenhuma casca', async (_nome, caminho) => {
    const rede = abrir(caminho)
    expect(await screen.findByRole('heading', { level: 1, name: 'Esta tela não abriu' })).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Algo saiu do esperado ao mostrar esta tela. Tente de novo ou volte ao início.')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toBeTruthy()
    expect(document.title).toBe('Esta tela não abriu · Turmma')
    // Sem casca: nem a navegação, nem o nome da pessoa, e a sessão nem foi lida.
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByText('Camila Souza')).toBeNull()
    expect(rede.chamadas.map((chamada) => chamada.caminho)).not.toContain('/v1/eu')
    // O React avisou o console do erro que pegou: é a prova de que a tela lançou e a fronteira a segurou.
    expect(erroDoReact).toHaveBeenCalled()
  })

  it('o "Voltar ao início" é um link comum para a raiz: o clique não é impedido, e a página nova limpa a fronteira', async () => {
    abrir('/entrar')
    const voltar = await screen.findByRole('link', { name: 'Voltar ao início' })
    expect(voltar.getAttribute('href')).toBe('/')
    expect(voltar.tagName).toBe('A')
    expect(clicar(voltar).defaultPrevented).toBe(false)
  })

  it('na operação, o "Voltar ao início" leva ao início da operação', async () => {
    abrir('/operacao/entrar')
    expect(await screen.findByRole('heading', { level: 1, name: 'Operação Turmma' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar ao início' }).getAttribute('href')).toBe('/operacao')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })

  it('dentro de uma área, a fronteira da área pega primeiro: a casca fica de pé, e a Falha é a da área', async () => {
    abrir('/professor/turmas')
    expect(await screen.findByRole('heading', { level: 1, name: 'Não foi possível carregar esta parte do Turmma' })).toBeTruthy()
    // A casca da escola continua: o nome da pessoa, e a Falha dentro dela; o título da fronteira de fora não aparece.
    expect(await screen.findByText('Camila Souza')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Esta tela não abriu' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Voltar ao início' }).getAttribute('href')).toBe('/')
  })

  it('o texto da falha é em português comum: sem termo técnico e sem o vocabulário de nota', async () => {
    abrir('/entrar')
    const fora = (await screen.findByRole('main')).textContent ?? ''
    cleanup()
    abrir('/operacao/entrar')
    const operacao = (await screen.findByRole('main')).textContent ?? ''
    cleanup()
    abrir('/professor/turmas')
    await screen.findByRole('heading', { level: 1, name: 'Não foi possível carregar esta parte do Turmma' })
    const area = screen.getByRole('alert').textContent ?? ''
    for (const texto of [fora, operacao, area]) {
      expect(texto.length).toBeGreaterThan(0)
      expect(texto).not.toMatch(VOCABULARIO_DE_NOTA)
      expect(texto).not.toMatch(TERMO_TECNICO)
    }
  })
})

describe('a Falha no meio da atividade não perde a resposta', () => {
  const ALUNA = '0197a1c0-0000-7000-8000-00000000a001'
  const ATIVIDADE = '0197a1c0-0000-7000-8000-00000000b001'

  /** A tela da atividade: a aluna escolhe (o servidor não confirma, a escolha fica no espelho) e, em seguida, a tela quebra. */
  function TelaQueQuebraDepoisDeEscolher() {
    const [quebrou, quebrar] = useState(false)
    useState(() => {
      const fila = createFilaDeRespostas({ save: () => new Promise(() => undefined), aoSalvar: () => undefined, espelho: { atividade: ATIVIDADE, dono: () => ALUNA } })
      fila.escolher(1, 2)
    })
    useEffect(() => quebrar(true), [])
    if (quebrou) throw new Error('a atividade quebrou')
    return <p>Atividade aberta</p>
  }

  it('a escolha guardada no espelho continua lá depois do "Voltar ao início"', async () => {
    esquecerTodosOsEspelhos()
    render(
      <AreaErrorBoundary tituloDaAba="Esta tela não abriu · Turmma" titulo="Esta tela não abriu" texto="Algo saiu do esperado." paginaInteira>
        <TelaQueQuebraDepoisDeEscolher />
      </AreaErrorBoundary>,
    )
    const voltar = await screen.findByRole('link', { name: 'Voltar ao início' })
    expect(readEspelho(ALUNA, ATIVIDADE)).toEqual([{ questao: 1, alternativa: 2, sequencia: 1 }])
    fireEvent.click(voltar)
    expect(readEspelho(ALUNA, ATIVIDADE)).toEqual([{ questao: 1, alternativa: 2, sequencia: 1 }])
    esquecerTodosOsEspelhos()
  })
})
