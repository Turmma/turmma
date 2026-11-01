// @vitest-environment jsdom
import { montarTime } from '@educa/shared'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import Time from './Time'

/**
 * "O que o Assistente fez", o miolo (telas do professor, correção `2026-10-19-formulario-e-assistente-rolam-a-pagina`; RF22):
 * a conversa é a única parte que rola a partir de 768 px, com a faixa "Esperando você", o filtro e o cabeçalho parados, e o
 * "Ver mais entregas" dentro dela, porque fora ele passaria a página da janela. O `jsdom` não faz layout: o que prova a altura
 * a 1366 × 768 é o e2e (`professor-entregas.spec.ts`); este arquivo prova as peças que a produzem, e a variável que o painel
 * mede de si.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const TURMA_A = { id: id(101), nome: '1º A' }
const QUIMICA = { id: id(500), nome: 'Química' }
const VINCULO: FakeResponse = { status: 200, corpo: { itens: [{ id: id(401), turma: TURMA_A, disciplina: QUIMICA, estado: 'confirmado' }] } }

const entrega = (n: number, estado: 'pendente' | 'aprovada') => ({
  id: id(900 + n),
  tipo: 'versao_adaptada',
  funcao: 'adaptacao',
  estado,
  turmaId: TURMA_A.id,
  titulo: `Atividade ${String(n)} (versão adaptada)`,
  artefatoId: id(700 + n),
  atividadeAplicadaId: null,
  criadaEm: `2026-10-05T13:4${String(n)}:00.000Z`,
  decididaEm: estado === 'pendente' ? null : '2026-10-05T14:00:00.000Z',
  decididaPor: estado === 'pendente' ? null : { id: id(1), nome: 'Professora sintética' },
  justificativa: null,
})

function instalar(rede: FakeNetwork, quem: { entregas: readonly unknown[]; maisUma?: boolean }): void {
  rede.responderPor('/v1/meus-vinculos', VINCULO)
  rede.responderPor('/v1/time', { status: 200, corpo: montarTime(new Set()) })
  rede.responderPor(/^\/v1\/entregas(\?|$)/, { status: 200, corpo: { itens: quem.entregas, ...(quem.maisUma === true ? { proxima: id(999) } : {}) } })
}

function montar() {
  const localizacao = memoryLocation({ path: '/time/assistente', record: true })
  renderScreen(
    <Router hook={localizacao.hook}>
      <Time />
    </Router>,
  )
}

afterEach(() => {
  cleanup()
})

describe('o miolo da conversa', () => {
  it('só o painel do filtro rola, a partir de 768 px: a faixa e as abas ficam fora dele, e o "Ver mais entregas" dentro', async () => {
    const rede = fakeNetwork()
    instalar(rede, { entregas: [entrega(1, 'pendente'), entrega(2, 'aprovada')], maisUma: true })
    montar()
    const painel = await screen.findByRole('tabpanel')
    // As três pistas do miolo: rola por dentro, limita a altura pela janela menos o topo medido, e prende o que for posicionado.
    expect(painel.className).toContain('md:overflow-y-auto')
    expect(painel.className).toContain('md:max-h-[calc(100dvh-var(--topo-do-painel,24.5rem)-2.5rem)]')
    expect(painel.className).toContain('md:relative')
    // Nenhuma classe de altura sem o `md:`: abaixo de 768 px a página rola inteira, como qualquer outra.
    expect(painel.className.split(/\s+/).filter((classe) => /overflow|max-h/.test(classe) && !classe.startsWith('md:'))).toEqual([])
    // A conversa, e a paginação com ela.
    await waitFor(() => expect(within(painel).getAllByText(/versão adaptada/).length).toBeGreaterThan(0))
    expect(within(painel).getByRole('button', { name: 'Ver mais entregas' })).toBeTruthy()
    // O que fica parado: a faixa e a lista de abas.
    const faixa = document.querySelector('[data-faixa-esperando]') as HTMLElement
    expect(faixa).not.toBeNull()
    expect(painel.contains(faixa)).toBe(false)
    expect(painel.contains(screen.getByRole('tablist'))).toBe(false)
  })

  it('o painel mede onde começa: a variável `--topo-do-painel` fica na caixa das abas, e sai com a tela', async () => {
    const rede = fakeNetwork()
    instalar(rede, { entregas: [entrega(1, 'pendente')] })
    montar()
    const painel = await screen.findByRole('tabpanel')
    // O `jsdom` não tem layout: o topo medido é 0, e o que importa é que a medida foi gravada no elemento que envolve as abas.
    const caixa = painel.closest('[style*="--topo-do-painel"]') as HTMLElement | null
    expect(caixa, 'a variável do topo está numa caixa acima do painel').not.toBeNull()
    expect(caixa?.style.getPropertyValue('--topo-do-painel')).toBe('0px')
    cleanup()
    expect(caixa?.style.getPropertyValue('--topo-do-painel')).toBe('')
  })

  it('sem "Ver mais": quando não há outra página, o botão não existe', async () => {
    const rede = fakeNetwork()
    instalar(rede, { entregas: [entrega(1, 'pendente')] })
    montar()
    await screen.findByRole('tabpanel')
    expect(screen.queryByRole('button', { name: 'Ver mais entregas' })).toBeNull()
  })
})
