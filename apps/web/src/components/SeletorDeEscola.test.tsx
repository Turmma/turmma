// @vitest-environment jsdom
import type { AcessoDaConta } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import type { BaseLocationHook } from 'wouter'
import { classesOf } from '../__fixtures__/class-colors'
import { createQueryClient } from '../api/query-client'
import { fakeNetwork, renderScreen, setupScreen, type FakeNetwork, type FakeResponse } from '../__fixtures__/render-screen'
import { SeletorDeEscola } from './SeletorDeEscola'

/**
 * O seletor de escola da lateral (`docs/interface.md` 11.1; D80, 12.0): o botão e cada linha da lista têm 48 px de altura
 * (`min-h-12`). No navegador as duas linhas de texto já passam de 48 px, e por isso a altura mínima não aparece numa
 * medida: quem a prova é a classe, aqui. A troca em si, o teclado e o toque são de `e2e/troca-de-escola.spec.ts`.
 */
afterEach(cleanup)
setupScreen()

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

/**
 * O 503 do Redis de fila fora na troca de escola (54.0; RF13): a espera única pelo `Retry-After`, com a lista aberta e a escola
 * escolhida à vista, o `ErrorState` do segundo 503 ou do `Retry-After` acima de 10 s, e o recomeço. A rede e o relógio são
 * falsos; o seletor, a sessão e o cliente são os de verdade. A jornada a 1366 × 768 e a 360 px é de `e2e/entrar-na-escola.spec.ts`.
 */
describe('SeletorDeEscola com o 503 que pede para esperar', () => {
  const AVISO = 'Tentando de novo em instantes'
  const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
  const CAMINHO_DA_TROCA = '/v1/sessao/escola'
  const indisponivel = (segundos?: number): FakeResponse => ({
    status: 503,
    corpo: { erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto da API que a tela não usa', requisicaoId: REQUISICAO } },
    ...(segundos === undefined ? {} : { cabecalhos: { 'Retry-After': String(segundos) } }),
  })
  const PRONTA: FakeResponse = { status: 200, corpo: { etapa: 'pronta', token: 'token-da-escola-b', expiraEm: '2099-01-01T00:00:00.000Z' } }
  let rede: FakeNetwork

  beforeEach(() => {
    vi.useFakeTimers()
    rede = fakeNetwork()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const pedidos = () => rede.chamadas.filter((chamada) => chamada.caminho === CAMINHO_DA_TROCA)
  const avancar = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
  async function assentar(): Promise<void> {
    for (let volta = 0; volta < 5; volta++) await avancar(0)
  }
  const regiaoDeStatus = () => screen.getAllByRole('status').find((regiao) => regiao.tagName === 'P') as HTMLElement
  // A linha da lista pelo nome da escola (o nome acessível do botão, `aria-label`, é "Escola, Rede · papel" ou "Abrindo …").
  const linha = (nome: RegExp) => within(screen.getByRole('list', { name: 'Suas escolas' })).getByRole('button', { name: nome })

  function abrirATroca(usuarioAtual = ESCOLA_A) {
    const localizacao = memoryLocation({ path: '/professor/nova-conversa', record: true })
    // Cada chamada de `navegar` fica anotada, ainda que o destino não deixe rastro no histórico (um destino `undefined`, por exemplo).
    const navegacoes: unknown[] = []
    const hook: BaseLocationHook = (roteador) => {
      const [caminho, navegar] = localizacao.hook(roteador)
      return [
        caminho,
        (destino, opcoes) => {
          navegacoes.push(destino)
          navegar(destino, opcoes)
        },
      ]
    }
    const tela = renderScreen(
      <Router hook={hook}>
        <SeletorDeEscola escolaAtual="Colégio Vista Alegre" acessos={ACESSOS} usuarioAtual={usuarioAtual} />
      </Router>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Colégio Vista Alegre/ }))
    return { localizacao, navegacoes, hook, ...tela }
  }

  async function escolherANorte(): Promise<void> {
    // O foco que o `abrir` pede no quadro seguinte (`requestAnimationFrame`) já aconteceu quando a pessoa clica.
    await avancar(20)
    fireEvent.click(linha(/Escola Municipal/))
    await avancar(0)
  }

  it('espera o Retry-After uma vez com a lista aberta e a escola escolhida à vista, e repete a mesma troca', async () => {
    rede.responder(indisponivel(3))
    rede.responder(PRONTA)
    const { localizacao } = abrirATroca()

    await escolherANorte()
    expect(pedidos()).toHaveLength(1)
    expect(regiaoDeStatus().textContent).toContain(AVISO)
    // A lista continua aberta: a linha escolhida diz "Abrindo …", e a escola de agora segue marcada.
    expect(linha(/Escola Municipal/).textContent).toContain('Abrindo Escola Municipal do Norte…')
    expect(linha(/Colégio/).getAttribute('aria-current')).toBe('true')
    expect(screen.queryByRole('alert')).toBeNull()

    await avancar(3_000)
    expect(pedidos()).toHaveLength(2)
    await assentar()
    expect(localizacao.history?.at(-1)).toBe('/')
  })

  it('o segundo 503 vai ao ErrorState: a lista segue aberta com a escola de agora marcada, o foco fica na linha, e "Tentar de novo" repete a troca', async () => {
    rede.responder(indisponivel(2))
    rede.responder(indisponivel(2))
    rede.responder(PRONTA)
    const { localizacao } = abrirATroca()

    await escolherANorte()
    linha(/Escola Municipal/).focus()
    await avancar(2_000)
    expect(pedidos()).toHaveLength(2)
    expect(screen.getByRole('alert').textContent).toBe('O sistema está indisponível no momento. Tente de novo em instantes.')
    expect(regiaoDeStatus().textContent).not.toContain(AVISO)
    expect(linha(/Colégio/).getAttribute('aria-current')).toBe('true')
    expect(linha(/Escola Municipal/).textContent).not.toContain('Abrindo')
    expect(document.activeElement).toBe(linha(/Escola Municipal/))
    await avancar(60_000)
    expect(pedidos()).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await avancar(0)
    expect(pedidos()).toHaveLength(3)
    await assentar()
    expect(localizacao.history?.at(-1)).toBe('/')
    expect(JSON.stringify(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body)).toContain(ESCOLA_B)
  })

  it('a falha é de quem trocou: com a pessoa da aba outra, o ErrorState some, e "Tentar de novo" não repete a troca dela', async () => {
    rede.responder(indisponivel(2))
    rede.responder(indisponivel(2))
    const { rerender, hook } = abrirATroca()
    await escolherANorte()
    await avancar(2_000)
    expect(pedidos()).toHaveLength(2)
    expect(screen.getByRole('alert').textContent).toContain('indisponível')

    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <Router hook={hook}>
          <SeletorDeEscola escolaAtual="Escola Municipal do Norte" acessos={ACESSOS} usuarioAtual={ESCOLA_B} />
        </Router>
      </QueryClientProvider>,
    )
    await assentar()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(pedidos()).toHaveLength(2)
  })

  it('o limite de 10 s: Retry-After de 10 espera, o de 11 vai direto ao ErrorState', async () => {
    rede.responder(indisponivel(10))
    rede.responder(PRONTA)
    abrirATroca()
    await escolherANorte()
    await avancar(9_900)
    expect(pedidos()).toHaveLength(1)
    await avancar(200)
    expect(pedidos()).toHaveLength(2)
    cleanup()

    rede.responder(indisponivel(11))
    abrirATroca()
    await escolherANorte()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    await avancar(60_000)
    expect(pedidos()).toHaveLength(3)
  })

  it('recomeço: se a pessoa da aba muda durante a espera, a repetição não sai e o aviso some', async () => {
    rede.responder(indisponivel(3))
    const { rerender, navegacoes, hook } = abrirATroca()
    await escolherANorte()
    expect(regiaoDeStatus().textContent).toContain(AVISO)

    // A mesma árvore da primeira renderização (o provedor do `renderScreen` em volta): só a pessoa muda, e a peça não remonta.
    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <Router hook={hook}>
          <SeletorDeEscola escolaAtual="Escola Municipal do Norte" acessos={ACESSOS} usuarioAtual={ESCOLA_B} />
        </Router>
      </QueryClientProvider>,
    )
    await avancar(3_000)
    await assentar()
    expect(pedidos()).toHaveLength(1)
    expect(screen.queryByText(AVISO)).toBeNull()
    // A troca descartada não vira falha na tela de quem ficou, e não leva a lugar nenhum.
    expect(screen.queryByRole('alert')).toBeNull()
    expect(navegacoes).toEqual([])

    // E a pessoa de antes, de volta à aba, também não encontra falha nenhuma da troca que foi descartada.
    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <Router hook={hook}>
          <SeletorDeEscola escolaAtual="Colégio Vista Alegre" acessos={ACESSOS} usuarioAtual={ESCOLA_A} />
        </Router>
      </QueryClientProvider>,
    )
    await assentar()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
