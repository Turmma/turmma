// @vitest-environment jsdom
import type { PapelDeUsuario } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { criarClienteDeConsultas } from './api/query-client'
import { prepararTela, redeFalsa, type RedeFalsa } from './__fixtures__/render-screen'
import { Rotas } from './routes'

/**
 * Cada área monta o sino dela, e só ele (telas da coordenação, 1.0, e telas do professor, 1.0): a coordenação lê a fila
 * dela, o professor lê a dele (`/v1/entregas` e `/v1/meus-vinculos`, sem nenhuma das leituras da coordenação), e o aluno não
 * tem sino nem lê fila nenhuma. É a app inteira de verdade (as rotas, a casca e a área de cada papel,
 * por `import()`), com a rede falsa. A coordenação, no mesmo cenário, é o controle: sem ele, "não há sino" passaria também
 * com o sino quebrado em todo lugar.
 */
prepararTela()

const ESCOLA = { id: '0197a1c0-0000-7000-8000-0000000000e1', nome: 'Colégio Vista Alegre', slug: 'vista-alegre' }
const LEITURAS_DA_FILA = ['/v1/vinculos', '/v1/professores', '/v1/privacidade/incidentes']

beforeEach(() => {
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(min-width: 768px)' || consulta === '(min-width: 1024px)', media: consulta, addEventListener: () => undefined, removeEventListener: () => undefined }))
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})
afterEach(cleanup)

function abrir(papel: PapelDeUsuario, caminho: string): RedeFalsa {
  const rede = redeFalsa()
  rede.responderPor('/v1/eu', { status: 200, corpo: { usuarioId: '0197a1c0-0000-7000-8000-0000000000a1', papel, nome: 'Camila Souza', escola: ESCOLA, inatividadeMin: 30, introducaoVistaEm: '2026-02-01T10:00:00.000Z', acessos: [] } })
  rede.responderPor('/v1/privacidade/incidentes', { status: 200, corpo: { incidentes: [], prazoLegal: 'O prazo é da escola.' } })
  rede.responderPor('/v1/anos-letivos', { status: 200, corpo: { itens: [{ id: '0197a1c0-0000-7000-8000-000000000001', ano: 2026, inicio: '2026-02-02', fim: '2026-12-18', situacao: 'em_curso' }] } })
  // Tudo o mais que a tela do papel pede: uma página vazia. O que o teste olha é o que o sino pediria.
  rede.responderPor(/^\/v1\//, { status: 200, corpo: { itens: [] } })
  const localizacao = memoryLocation({ path: caminho })
  render(
    <QueryClientProvider client={criarClienteDeConsultas()}>
      <Router hook={localizacao.hook}>
        <Rotas />
      </Router>
    </QueryClientProvider>,
  )
  return rede
}

const caminhosDe = (rede: RedeFalsa) => rede.chamadas.map((chamada) => chamada.caminho.split('?')[0])

describe('o sino só existe na área da coordenação', () => {
  it('controle: na coordenação, o sino está na casca e a fila é lida', async () => {
    const rede = abrir('coordenador', '/coordenacao/material')
    // O sino é `lazy()`: com a suíte inteira rodando, o chunk leva mais que o prazo padrão.
    expect(await screen.findByRole('button', { name: /^Esperando você/ }, { timeout: 5_000 })).toBeTruthy()
    await waitFor(() => {
      for (const leitura of LEITURAS_DA_FILA) expect(caminhosDe(rede)).toContain(leitura)
    })
    // A coordenação não recebe o `SinoDoProfessor`: nenhuma leitura da fila da professora sai na área dela.
    expect(caminhosDe(rede)).not.toContain('/v1/entregas')
    expect(caminhosDe(rede)).not.toContain('/v1/meus-vinculos')
  })

  it('professor: o sino é o dele, e lê as entregas e os vínculos dele, e nenhuma das leituras da coordenação', async () => {
    const rede = abrir('professor', '/professor/turmas')
    expect(await screen.findByRole('button', { name: /^Esperando você/ }, { timeout: 5_000 })).toBeTruthy()
    await waitFor(() => {
      expect(caminhosDe(rede)).toContain('/v1/entregas')
      expect(caminhosDe(rede)).toContain('/v1/meus-vinculos')
    })
    for (const leitura of LEITURAS_DA_FILA) expect(caminhosDe(rede)).not.toContain(leitura)
  })

  it('aluno: nenhum "Esperando você", e nenhuma chamada a /v1/vinculos, /v1/professores, /v1/privacidade/incidentes, /v1/entregas nem /v1/meus-vinculos', async () => {
    const rede = abrir('aluno', '/aluno/atividades')
    await screen.findByText('Camila Souza')
    // A área do papel monta e lê o que é dela: só então a ausência do sino quer dizer alguma coisa.
    await waitFor(() => expect(caminhosDe(rede).filter((chamada) => chamada !== '/v1/eu').length).toBeGreaterThan(0))
    // O título da área na tela: a área terminou de montar. O sino é `lazy()`, e o título não prova que um sino montado por
    // engano já teria pedido a fila: por isso a espera invertida, com prazo, sobre cada leitura da fila.
    await screen.findByRole('heading', { level: 1, name: 'Tarefas' })
    const todas = [...LEITURAS_DA_FILA, '/v1/entregas', '/v1/meus-vinculos']
    await expect(waitFor(() => expect(todas.some((leitura) => caminhosDe(rede).includes(leitura))).toBe(true), { timeout: 300 })).rejects.toThrow()
    expect(screen.queryByRole('button', { name: /^Esperando você/ })).toBeNull()
    for (const leitura of todas) expect(caminhosDe(rede)).not.toContain(leitura)
  })
})
