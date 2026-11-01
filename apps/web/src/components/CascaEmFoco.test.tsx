// @vitest-environment jsdom
import type { PapelDeUsuario } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { createQueryClient } from '../api/query-client'
import { euQueryOptions } from '../api/eu'
import { abrirSessaoPeloCookie, encerrarPorInatividade } from '../api/sessao'
import { ROUTES } from '../paths'
import { setupScreen, fakeNetwork, type FakeNetwork } from '../__fixtures__/render-screen'
import { CascaDaEscola } from './CascaDaEscola'
import { TelaDeFoco } from './introducao/TelaDeFoco'

/**
 * A casca nos endereços de tela de foco (tarefa 5.0 da X4; `ehTelaDeFoco`; RF3): sem lateral nem barras, um `<main>`, o
 * "Sair" à vista e o relógio de inatividade ligado. O `jsdom` não tem `matchMedia`, e o teste instala o do computador (a
 * largura em que a casca mais desenha). A rede é falsa; a sessão, o cliente de consultas e as rotas são os de verdade.
 */
setupScreen()

const ESCOLA = { id: '0197a1c0-0000-7000-8000-0000000000e1', nome: 'Colégio Vista Alegre', slug: 'vista-alegre' }
const PESSOA_A = '0197a1c0-0000-7000-8000-0000000000a1'
const PESSOA_B = '0197a1c0-0000-7000-8000-0000000000b2'

const TELAS_DE_FOCO: readonly (readonly [PapelDeUsuario, string])[] = [
  ['aluno', ROUTES.bemVindoDoAluno],
  ['professor', ROUTES.bemVindoDoProfessor],
  ['coordenador', ROUTES.bemVindoDaCoordenacao],
]

function respostaEu(papel: PapelDeUsuario, usuarioId: string, nome: string) {
  return { status: 200, corpo: { usuarioId, papel, nome, escola: ESCOLA, inatividadeMin: 30, introducaoVistaEm: '2026-02-01T10:00:00.000Z', acessos: [] } }
}

beforeEach(async () => {
  // Cada caso pode sair ou vencer a sessão, e o seguinte a abre de novo.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ token: 'token-de-teste', expiraEm: new Date(Date.now() + 600_000).toISOString() }), { status: 200 })),
  )
  await abrirSessaoPeloCookie()
  vi.unstubAllGlobals()
  // O computador: a casca desenha a lateral aberta, e é ela que não pode aparecer na tela de foco.
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: true, media: consulta, addEventListener: () => undefined, removeEventListener: () => undefined }))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function desenhar(caminho: string, filho = <p>Tela aberta</p>) {
  const cliente = createQueryClient()
  const localizacao = memoryLocation({ path: caminho, record: true })
  render(
    <QueryClientProvider client={cliente}>
      <Router hook={localizacao.hook}>
        <CascaDaEscola>{filho}</CascaDaEscola>
      </Router>
    </QueryClientProvider>,
  )
  return { cliente, localizacao }
}

async function abrir(rede: FakeNetwork, papel: PapelDeUsuario, caminho: string, filho?: React.ReactElement) {
  rede.responder(respostaEu(papel, PESSOA_A, 'Camila Souza'))
  const casca = desenhar(caminho, filho)
  await screen.findByText('Tela aberta')
  // A moldura só se desenha com o `/v1/eu` na mão: o caso espera por ele, senão "sem lateral" passaria por ela ainda não ter chegado.
  await waitFor(() => expect(casca.cliente.getQueryData(euQueryOptions.queryKey)).toBeDefined())
  return casca
}

/** O que a casca desenha em volta da tela: a lateral, a navegação, a barra do topo, a gaveta e a barra de baixo. */
function moldura(): string[] {
  const achados: string[] = []
  if (document.querySelector('nav')) achados.push('navegação')
  if (document.querySelector('dialog')) achados.push('gaveta')
  if (document.querySelector('[data-ancora-do-sino]')) achados.push('âncora do sino')
  if (screen.queryByRole('button', { name: /lateral|menu/i, hidden: true })) achados.push('botão da lateral')
  if (screen.queryByRole('link', { name: 'Turmma, página inicial' })) achados.push('marca')
  return achados
}

describe('a casca em foco', () => {
  it.each(TELAS_DE_FOCO)('%s: sem lateral nem barras, com a tela, um `<main>` só', async (papel, caminho) => {
    await abrir(fakeNetwork(), papel, caminho)
    expect(moldura()).toEqual([])
    expect(document.querySelectorAll('main')).toHaveLength(1)
    expect(document.querySelector('main')?.textContent).toBe('Tela aberta')
  })

  it('fora das telas de foco a mesma casca desenha a moldura (o caso de cima prova algo)', async () => {
    await abrir(fakeNetwork(), 'aluno', ROUTES.inicio)
    expect(moldura()).toContain('navegação')
    expect(document.querySelectorAll('main')).toHaveLength(1)
  })

  it('só o endereço exato é de foco: um endereço parecido tem a casca inteira', async () => {
    await abrir(fakeNetwork(), 'aluno', `${ROUTES.bemVindoDoAluno}/outra`)
    expect(moldura()).toContain('navegação')
  })

  it('o "Sair" da `TelaDeFoco` está à vista e sai pelo caminho da casca: encerra na API e volta para a entrada', async () => {
    const rede = fakeNetwork()
    const { localizacao } = await abrir(
      rede,
      'aluno',
      ROUTES.bemVindoDoAluno,
      <TelaDeFoco passo={1} total={4} idDoPasso="passo" rodape={<span>pé</span>}>
        <p>Tela aberta</p>
      </TelaDeFoco>,
    )
    expect(document.querySelectorAll('main')).toHaveLength(1)
    expect(moldura()).toEqual([])

    rede.responder({ status: 204 })
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(localizacao.history?.at(-1)).toBe(ROUTES.entrar))
    expect(rede.chamadas.some((chamada) => chamada.metodo === 'DELETE' && chamada.caminho.startsWith('/v1/sessao'))).toBe(true)
    // `replace`: a entrada ocupa o lugar da introdução, e o "voltar" não a devolve a quem saiu.
    expect(localizacao.history).toEqual([ROUTES.entrar])
  })
})

describe('a casca em foco continua vigiando a sessão', () => {
  it('o relógio de inatividade está ligado: sem ninguém mexendo, a sessão é encerrada na API no prazo da escola', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const rede = fakeNetwork()
    rede.responder(respostaEu('aluno', PESSOA_A, 'Camila Souza'))
    const { cliente } = desenhar(ROUTES.bemVindoDoAluno)
    await vi.waitFor(() => expect(cliente.getQueryData(euQueryOptions.queryKey)).toBeDefined())
    expect(rede.chamadas.some((chamada) => chamada.metodo === 'DELETE')).toBe(false)

    // Passados os 30 minutos o token de acesso (10 min) também venceu: a saída renova antes de encerrar.
    rede.responder({ status: 200, corpo: { token: 'token-de-teste', expiraEm: new Date(Date.now() + 3_600_000).toISOString() } })
    rede.responder({ status: 204 })
    await vi.advanceTimersByTimeAsync(30 * 60_000 + 1000)
    expect(rede.chamadas.some((chamada) => chamada.metodo === 'DELETE' && chamada.caminho.startsWith('/v1/sessao'))).toBe(true)
  })

  it('lembra quem está na aba: depois de a sessão vencer, outra pessoa que entra é levada para fora da tela da anterior', async () => {
    const rede = fakeNetwork()
    const { cliente, localizacao } = await abrir(rede, 'aluno', ROUTES.bemVindoDoAluno)

    rede.responder({ status: 204 })
    await encerrarPorInatividade()
    // O login por cima: outra pessoa abre a sessão sobre a tela da anterior, e o `/v1/eu` volta com ela.
    rede.responder({ status: 200, corpo: { token: 'token-de-teste', expiraEm: new Date(Date.now() + 600_000).toISOString() } })
    await abrirSessaoPeloCookie()
    rede.responder(respostaEu('aluno', PESSOA_B, 'Beatriz Lima'))
    await cliente.refetchQueries({ queryKey: euQueryOptions.queryKey })

    await waitFor(() => expect(localizacao.history?.at(-1)).toBe(ROUTES.inicio))
  })
})
