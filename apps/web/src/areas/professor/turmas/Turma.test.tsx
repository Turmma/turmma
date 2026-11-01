// @vitest-environment jsdom
import { montarTime } from '@educa/shared'
import { focusManager, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { createQueryClient } from '../../../api/query-client'
import { setupScreen, fakeNetwork, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import Turma from './Turma'

/**
 * A turma aberta em três abas, guardadas no endereço (telas do professor, 10.0; RF15): qual aba abre, como trocar sem passo
 * no histórico, o que o parâmetro do painel faz fora de Hoje e quais leituras cada aba faz. A rede é falsa e responde por
 * caminho; a `Turma`, as abas, o cliente de consultas e a rota são os de verdade.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const TURMA = id(100)
const SERIE = { id: id(110), etapa: 'ef_anos_finais', ano: 7 }
const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })

function instalar(rede: FakeNetwork, sinais?: () => FakeResponse): void {
  rede.responderPor(`/v1/turmas/${TURMA}`, ok({ id: TURMA, nome: '7º A', serie: SERIE }))
  rede.responderPor('/v1/eu', ok({ usuarioId: id(1), papel: 'professor', nome: 'Professora sintética', escola: { id: id(2), nome: 'Escola sintética', slug: 'escola-sintetica' }, inatividadeMin: 30, introducaoVistaEm: '2026-02-01T10:00:00.000Z', acessos: [] }))
  rede.responderPor('/v1/sinais', sinais ?? (() => ok({ itens: [{ id: id(300), tipo: 'atencao_humana', aluno: { id: id(901), nome: 'Caio Sintético' }, criadoEm: '2026-10-05T13:40:00.000Z' }], grupos: [] })))
  rede.responderPor('/v1/tutor/uso', ok({ turmaId: TURMA, limiteDoDia: 60, trocasDaTurmaNoMes: 0, pacoteDaTurmaNoMes: 0, alunos: [] }))
  rede.responderPor(`/v1/turmas/${TURMA}/desempenho`, ok({ turmaId: TURMA, lotesAprovados: 0, porHabilidade: [], alunos: [] }))
  rede.responderPor('/v1/atividades-aplicadas', ok({ itens: [] }))
  rede.responderPor('/v1/time', ok(montarTime(new Set())))
  rede.responderPor('/v1/materiais', ok({ itens: [] }))
  rede.responderPor(`/v1/turmas/${TURMA}/acesso`, ok({ expiraEm: null }))
  rede.responderPor(`/v1/turmas/${TURMA}/reivindicacoes`, ok({ itens: [] }))
  rede.responderPor(`/v1/turmas/${TURMA}/alunos`, ok({ itens: [] }))
}

function montar(busca = '') {
  const localizacao = memoryLocation({ path: `/turmas/${TURMA}`, searchPath: busca, record: true })
  const tela = render(
    <QueryClientProvider client={createQueryClient()}>
      <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
        <Turma turmaId={TURMA} />
      </Router>
    </QueryClientProvider>,
  )
  return { localizacao, ...tela }
}

const semConsulta = (caminho: string) => caminho.split('?')[0] ?? caminho
const caminhosDe = (rede: FakeNetwork) => rede.chamadas.map((chamada) => semConsulta(chamada.caminho))
const vezesQue = (rede: FakeNetwork, caminho: string) => caminhosDe(rede).filter((chamado) => chamado === caminho).length
const abaSelecionada = () => screen.getByRole('tab', { selected: true }).textContent

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(min-width: 768px)', media: consulta, addEventListener: () => undefined, removeEventListener: () => undefined }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})

afterEach(() => {
  vi.useRealTimers()
  focusManager.setFocused(undefined)
})

describe('a turma aberta: a aba pelo endereço', () => {
  it('são três abas, Hoje, Atividades e Alunos, nessa ordem; o `h1` e o "Voltar para Turmas" ficam', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByRole('tab', { name: 'Hoje' })
    expect(screen.getAllByRole('tab').map((aba) => aba.textContent)).toEqual(['Hoje', 'Atividades', 'Alunos'])
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Turma 7º A')
    expect(screen.getByRole('link', { name: 'Voltar para Turmas' })).toBeTruthy()
  })

  it('sem aba, a turma abre em Hoje; `?aba=visao-geral`, o endereço de antes, e um valor que não existe, também', async () => {
    for (const busca of ['', 'aba=visao-geral', 'aba=qualquer-coisa', 'aba=']) {
      const rede = fakeNetwork()
      instalar(rede)
      const { unmount } = montar(busca)
      await screen.findByRole('region', { name: 'Sinais da turma' })
      expect(abaSelecionada(), busca).toBe('Hoje')
      unmount()
    }
  })

  it('`?aba=alunos` abre Alunos, e `?aba=atividades`, Atividades: cada uma com o conteúdo dela e só as leituras dela', async () => {
    const redeAlunos = fakeNetwork()
    instalar(redeAlunos)
    const { unmount } = montar('aba=alunos')
    expect(await screen.findByRole('heading', { name: 'Acesso dos alunos' })).toBeTruthy()
    expect(abaSelecionada()).toBe('Alunos')
    expect(caminhosDe(redeAlunos)).not.toContain('/v1/sinais')
    unmount()

    const redeAtividades = fakeNetwork()
    instalar(redeAtividades)
    montar('aba=atividades')
    expect(await screen.findByText('Nenhuma atividade aplicada a esta turma')).toBeTruthy()
    expect(abaSelecionada()).toBe('Atividades')
    expect(caminhosDe(redeAtividades)).not.toContain('/v1/sinais')
    expect(caminhosDe(redeAtividades)).not.toContain(`/v1/turmas/${TURMA}/acesso`)
  })

  it('trocar de aba troca o endereço com `replace`: a aba nova no endereço, o histórico com o mesmo tamanho, e o Voltar não passa por ela', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    const { localizacao } = montar()
    await screen.findByRole('region', { name: 'Sinais da turma' })
    const antes = localizacao.history.length
    await usuario.click(screen.getByRole('tab', { name: 'Alunos' }))
    await screen.findByRole('heading', { name: 'Acesso dos alunos' })
    expect(localizacao.history.length).toBe(antes)
    expect(localizacao.history.at(-1)).toBe(`/turmas/${TURMA}?aba=alunos`)
    expect(abaSelecionada()).toBe('Alunos')
    await usuario.click(screen.getByRole('tab', { name: 'Atividades' }))
    await screen.findByText('Nenhuma atividade aplicada a esta turma')
    expect(localizacao.history.length).toBe(antes)
    expect(localizacao.history.at(-1)).toBe(`/turmas/${TURMA}?aba=atividades`)
  })

  it('o painel do Tutor pedido no endereço só abre em Hoje: em Alunos o parâmetro não abre nada, e voltar a Hoje não o reabre', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    const { localizacao } = montar('aba=alunos&ver=tutor')
    await screen.findByRole('heading', { name: 'Acesso dos alunos' })
    expect(screen.queryByRole('dialog', { name: 'O que o Tutor viu' })).toBeNull()
    expect(caminhosDe(rede)).not.toContain('/v1/tutor/uso')

    await usuario.click(screen.getByRole('tab', { name: 'Hoje' }))
    await screen.findByRole('region', { name: 'Sinais da turma' })
    expect(localizacao.history.at(-1)).toBe(`/turmas/${TURMA}?aba=hoje`)
    expect(screen.queryByRole('dialog', { name: 'O que o Tutor viu' })).toBeNull()
    expect(caminhosDe(rede)).not.toContain('/v1/tutor/uso')
  })

  it('o painel do Tutor pedido em Hoje abre, com Hoje por baixo', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar('aba=hoje&ver=tutor')
    expect(await screen.findByRole('dialog', { name: 'O que o Tutor viu' })).toBeTruthy()
    expect(abaSelecionada()).toBe('Hoje')
    await waitFor(() => expect(vezesQue(rede, '/v1/tutor/uso')).toBe(1))
  })
})

describe('Hoje só lê os sinais com Hoje à vista', () => {
  async function avancar(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  it('com Atividades ou Alunos aberta, nenhuma leitura de sinais aos 15 s; o controle: com Hoje aberta, a leitura sai', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByRole('region', { name: 'Sinais da turma' })
    await waitFor(() => expect(vezesQue(rede, '/v1/sinais')).toBe(1))

    // O controle: Hoje à vista relê aos 15 s.
    await avancar(16_000)
    await waitFor(() => expect(vezesQue(rede, '/v1/sinais')).toBe(2))

    for (const aba of ['Atividades', 'Alunos']) {
      await usuario.click(screen.getByRole('tab', { name: aba }))
      await waitFor(() => expect(abaSelecionada()).toBe(aba))
      // Só com o pedaço da aba carregado a Hoje saiu: enquanto a aba nova suspende, o React guarda a anterior escondida, ainda montada.
      if (aba === 'Atividades') await screen.findByText('Nenhuma atividade aplicada a esta turma')
      else await screen.findByRole('heading', { name: 'Acesso dos alunos' })
      const antes = vezesQue(rede, '/v1/sinais')
      await avancar(46_000)
      expect(vezesQue(rede, '/v1/sinais'), aba).toBe(antes)
    }
  })
})

describe('o vínculo encerrado com a turma aberta em Hoje', () => {
  it.each([
    ['com o painel "Ver quem" aberto', 'aba=hoje&ver=tutor'],
    ['com o painel fechado', 'aba=hoje'],
  ])('o 404 da releitura dos sinais tira a página inteira, %s, sem o nome de aluno nenhum, e deixa só o aviso e o caminho de volta', async (_quando, busca) => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let leituras = 0
    const rede = fakeNetwork()
    const sinaisComNome = ok({ itens: [{ id: id(300), tipo: 'atencao_humana', aluno: { id: id(901), nome: 'Caio Sintético' }, criadoEm: '2026-10-05T13:40:00.000Z' }], grupos: [] })
    // A primeira leitura traz o aluno; a releitura dos 15 s já não acha a turma.
    instalar(rede, () => ((leituras += 1) === 1 ? sinaisComNome : erro(404, 'NAO_ENCONTRADO')))
    montar(busca)
    // Com o painel fechado o nome não está na tela: o aviso de atenção é o que mostra que a turma foi lida.
    if (busca.includes('ver=tutor')) expect((await screen.findByRole('dialog', { name: 'O que o Tutor viu' })).textContent).toContain('Caio Sintético')
    else await screen.findByRole('region', { name: 'Um aluno precisa de um adulto' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_500)
    })
    await waitFor(() => expect(vezesQue(rede, '/v1/sinais')).toBe(2))
    expect(await screen.findByText(/Esta turma não está disponível para você agora/)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
    expect(document.body.textContent).not.toContain('Caio Sintético')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Turma')
    expect(screen.getByRole('link', { name: 'Voltar para Turmas' })).toBeTruthy()
  })
})
