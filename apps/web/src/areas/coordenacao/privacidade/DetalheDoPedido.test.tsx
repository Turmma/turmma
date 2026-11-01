// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { setupScreen, fakeNetwork, renderScreen, type FakeResponse } from '../../../__fixtures__/render-screen'
import { COORDENACAO_ROUTES } from '../../../paths'
import DetalheDoPedido from './DetalheDoPedido'
import { TEXTO_DO_PEDIDO_AUSENTE } from './textos-do-pedido'

/**
 * O detalhe do pedido de titular na página de leitura (telas da coordenação, 12.0; RF20 e RF22): a coluna de 880 px, o
 * "‹ Pedidos" de volta, o prazo no topo e o caminho até as turmas com o nome de hoje. A rede é falsa; a tela, o cliente de
 * consultas e a auditoria da leitura são os da aba. As ações (concluir, cancelar, corrigir, baixar) e o arquivo em preparação
 * são do e2e (`e2e/pedido-do-titular.spec.ts`).
 */
setupScreen()

const PEDIDO_ID = '0197a1c0-0000-7000-8000-000000000042'
const FORA = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }
const AGORA = new Date('2026-10-16T15:00:00Z')

function detalhe(parcial: Record<string, unknown> = {}): FakeResponse {
  return {
    status: 200,
    corpo: {
      id: PEDIDO_ID,
      tipo: 'correcao',
      solicitante: 'titular',
      chegouEm: '2026-09-26',
      estado: 'recebido',
      titular: { nome: 'Ana Souza', turmas: ['7º A'] },
      homonimo: null,
      nomeTrocado: null,
      compartilhamento: [],
      concluidoEm: null,
      ...parcial,
    },
  }
}

/** A largura da janela, para a consulta `(min-width: 768px)` que o miolo lê; o `jsdom` não tem `matchMedia`. */
function janelaDe(largura: number): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta === '(min-width: 768px)' ? largura >= 768 : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

beforeEach(() => {
  janelaDe(1366)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
})

afterEach(() => {
  vi.useRealTimers()
})

function montar() {
  const localizacao = memoryLocation({ path: `/privacidade/pedidos/${PEDIDO_ID}`, record: true })
  return renderScreen(
    <Router hook={localizacao.hook}>
      <DetalheDoPedido pedidoId={PEDIDO_ID} />
    </Router>,
  )
}

const larguraDaTela = () => document.querySelector('[data-tela]')?.getAttribute('data-tela')

describe('o detalhe do pedido: a página de leitura', () => {
  it('com dado: coluna de leitura, "‹ Pedidos" de volta para a lista, e o nome da pessoa é o título', async () => {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/privacidade/pedidos/${PEDIDO_ID}`, detalhe())
    montar()
    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Souza' })).toBeTruthy()
    expect(larguraDaTela()).toBe('leitura')
    const voltar = screen.getByRole('link', { name: 'Voltar para Pedidos' })
    expect(voltar.textContent).toBe('Pedidos')
    expect(voltar.getAttribute('href')).toBe('/privacidade/pedidos')
    expect(screen.queryByText('Voltar para os pedidos')).toBeNull()
  })

  it('carregando, pedido que não se acha e erro também são a página de leitura, com o mesmo "‹ Pedidos"', async () => {
    const rede = fakeNetwork()
    const lida = rede.segurar()
    const { unmount } = montar()
    expect(await screen.findByText('Carregando o pedido…')).toBeTruthy()
    expect(larguraDaTela()).toBe('leitura')
    expect(screen.getByRole('link', { name: 'Voltar para Pedidos' })).toBeTruthy()
    lida.liberar(FORA)
    expect(await screen.findByText(TEXTO_DO_PEDIDO_AUSENTE)).toBeTruthy()
    expect(larguraDaTela()).toBe('leitura')
    expect(screen.getByRole('link', { name: 'Voltar para Pedidos' })).toBeTruthy()
    unmount()
    // O erro que não é "não achado" (aqui, o limite de pedidos) passa pelo mesmo `Page`: "Tentar de novo" e o mesmo "‹ Pedidos".
    const outraRede = fakeNetwork()
    outraRede.responderPor(`/v1/privacidade/pedidos/${PEDIDO_ID}`, { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
    montar()
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(larguraDaTela()).toBe('leitura')
    expect(screen.getByRole('link', { name: 'Voltar para Pedidos' })).toBeTruthy()
  })

  it('a partir de 768 px a coluna do pedido é o miolo que rola e recebe foco; abaixo disso a página rola e a coluna só recebe o foco de reserva', async () => {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/privacidade/pedidos/${PEDIDO_ID}`, detalhe())
    const { unmount } = montar()
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' })
    const coluna = () => screen.getByRole('region', { name: 'Tudo sobre este pedido' })
    expect(coluna().getAttribute('tabindex')).toBe('0')
    expect(coluna().className).toContain('overflow-y-auto')
    unmount()
    janelaDe(360)
    montar()
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' })
    expect(coluna().getAttribute('tabindex')).toBe('-1')
  })

  it('o prazo vem no topo, antes de "O pedido", e diz há quantos dias venceu', async () => {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/privacidade/pedidos/${PEDIDO_ID}`, detalhe())
    montar()
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' })
    const prazo = screen.getByRole('region', { name: 'Prazo da declaração completa' })
    const pedido = screen.getByRole('region', { name: 'O pedido' })
    expect(prazo.compareDocumentPosition(pedido) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(prazo).getByText('Prazo vencido há 5 dias (venceu em 11/10/2026)')).toBeTruthy()
  })
})

describe('o detalhe do pedido: o caminho até as turmas', () => {
  it('a correção aberta leva a "Escola › Turmas", no mesmo endereço de sempre, e nenhum texto diz "Estrutura"', async () => {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/privacidade/pedidos/${PEDIDO_ID}`, detalhe())
    montar()
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' })
    const link = screen.getByRole('link', { name: 'Ir para as turmas' })
    expect(link.getAttribute('href')).toBe(COORDENACAO_ROUTES.estrutura)
    expect(screen.getByText(/pela turma, em Escola › Turmas\./)).toBeTruthy()
    expect(document.body.textContent).not.toContain('Estrutura')
  })

  it('o pedido que não é de correção aberta não tem o link', async () => {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/privacidade/pedidos/${PEDIDO_ID}`, detalhe({ tipo: 'acesso', estado: 'concluido', concluidoEm: '2026-10-10T12:00:00.000Z' }))
    montar()
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' })
    expect(screen.queryByRole('link', { name: 'Ir para as turmas' })).toBeNull()
  })
})
