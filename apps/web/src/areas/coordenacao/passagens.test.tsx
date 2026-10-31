// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { prepararTela, redeFalsa, renderizarTela, type RespostaFalsa } from '../../__fixtures__/render-screen'
import { Inicio } from '../../pages/Inicio'
import Agentes from './governanca/Agentes'
import Governanca from './governanca/Governanca'
import ListaDaTurma from './estrutura/ListaDaTurma'

/**
 * As passagens entre os lugares da coordenação (telas da coordenação, 3.0; RF2 e RF3): quem entra na raiz chega ao Painel, a aba IA de
 * Registros leva aos Agentes (que saíram da lateral), e a lista da turma e os Agentes voltam para o lugar de onde vieram. Cada uma é
 * uma linha de código que só o clique prova: sem o teste, apagar o link deixaria a tela em pé e a página dos Agentes sem caminho.
 */
prepararTela()

const ID_DA_TURMA = '0197a1c0-0000-7000-8000-000000000101'
const NUNCA = () => new Promise<RespostaFalsa>(() => undefined)

function emUmaArea(endereco: string, tela: ReactElement) {
  const local = memoryLocation({ path: endereco, record: true })
  renderizarTela(
    <Router base="/coordenacao" hook={local.hook}>
      {tela}
    </Router>,
  )
  return local
}

describe('a raiz de quem entrou', () => {
  it('a coordenação é levada ao Painel, sem ficar no histórico da raiz', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/eu', {
      status: 200,
      corpo: {
        usuarioId: '0197a1c0-0000-7000-8000-000000000001',
        papel: 'coordenador',
        nome: 'Coordenação Sintética',
        escola: { id: '0197a1c0-0000-7000-8000-000000000002', nome: 'Escola Sintética', slug: 'escola-sintetica' },
        inatividadeMin: 30,
        introducaoVistaEm: '2026-02-01T10:00:00.000Z',
        acessos: [],
      },
    })
    const local = memoryLocation({ path: '/', record: true })
    renderizarTela(
      <Router hook={local.hook}>
        <Inicio />
      </Router>,
    )
    await waitFor(() => expect(local.history?.at(-1)).toBe('/coordenacao/painel'))
    // `replace`: a raiz sai do histórico, e o "voltar" do navegador não devolve a quem já saiu dela.
    expect(local.history).toEqual(['/coordenacao/painel'])
  })
})

describe('Registros › IA', () => {
  it('leva aos Agentes pelo link "Como cada IA trabalha" (RF3: lugar e link, dois cliques)', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/governanca/resumo', { status: 200, corpo: { numeros: { geradoPorIa: 0, aprovadoPorPessoa: 0, rejeitado: 0, esperando: 0 }, itens: [] } })
    rede.responderPor('/v1/governanca/consumo', NUNCA)
    emUmaArea('/coordenacao/governanca', <Governanca />)
    const link = await screen.findByRole('link', { name: 'Como cada IA trabalha' })
    expect(link.getAttribute('href')).toBe('/coordenacao/agentes')
  })
})

describe('as telas que ficam dentro de um lugar voltam para ele', () => {
  it('Agentes volta para Registros, na aba IA', async () => {
    // O miolo dos Agentes lê a largura da janela; o `jsdom` não tem `matchMedia`.
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }))
    const rede = redeFalsa()
    rede.responderPor('/v1/governanca/funcoes', NUNCA)
    emUmaArea('/coordenacao/agentes', <Agentes />)
    const voltar = await screen.findByRole('link', { name: 'Voltar para Registros' })
    expect(voltar.getAttribute('href')).toBe('/coordenacao/governanca')
  })

  it('a lista da turma volta para Escola, na aba Turmas', async () => {
    const rede = redeFalsa()
    rede.responderPor(/\/v1\/turmas\//, NUNCA)
    emUmaArea(`/coordenacao/estrutura/turmas/${ID_DA_TURMA}`, <ListaDaTurma turmaId={ID_DA_TURMA} />)
    const voltar = await screen.findByRole('link', { name: 'Voltar para Escola' })
    expect(voltar.getAttribute('href')).toBe('/coordenacao/estrutura')
  })
})
