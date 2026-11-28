// @vitest-environment jsdom
import type { AcompanhamentoResponse, AtividadeAplicada } from '@educa/shared'
import { focusManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import { TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO } from './prova-online'
import { canAbrirSegundaChamada, SegundaChamada, TEXTO_DE_NINGUEM_PARA_CONVOCAR, TEXTO_SEM_CONVOCADOS } from './SegundaChamada'

/**
 * "Segunda chamada" (avaliacao-e-correcao, 11.0; RF10): quem pode ser convocado, a escolha por nome, a janela, a duração e o tempo adicional, a confirmação que diz tudo
 * antes de abrir, a lista de uma coluna e o pedido que sai uma vez só. O `TZ` da unidade é `Asia/Tokyo`: a janela é a da escola.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const ENCERRADA: AtividadeAplicada = {
  id: id(1),
  artefatoId: id(2),
  turmaId: id(3),
  titulo: 'Prova de estequiometria',
  avaliativa: true,
  estado: 'encerrada',
  questoes: 2,
  aplicadaEm: '2026-11-24T12:00:00.000Z',
  encerradaEm: '2026-11-24T14:00:00.000Z',
  janela: { abreEm: '2026-11-24T13:00:00.000Z', fechaEm: '2026-11-24T14:40:00.000Z' },
  duracaoMin: 40,
  comTempoAdicional: 0,
  participacao: { alunos: 4, iniciaram: 2, enviaram: 2 },
  entrega: null,
}
const LEITURA = `/v1/atividades-aplicadas/${ENCERRADA.id}/acompanhamento`
const SEGUNDA = `/v1/atividades-aplicadas/${ENCERRADA.id}/segunda-chamada`
type Aluno = AcompanhamentoResponse['alunos'][number]
const aluno = (n: number, nome: string, situacao: Aluno['situacao']): Aluno => ({ alunoId: id(100 + n), nome, situacao, limiteEm: null })
const TURMA: Aluno[] = [aluno(1, 'Ana Souza', 'enviou'), aluno(2, 'Bia Lima', 'nao_comecou'), aluno(3, 'Caio Rocha', 'tempo_esgotado'), aluno(4, 'Dora Alves', 'nao_comecou')]
const leitura = (alunos: readonly Aluno[]): FakeResponse => ({ status: 200, corpo: { atividadeAplicadaId: ENCERRADA.id, agora: '2026-11-24T14:10:00.000Z', alunos } })
const FALHA: FakeResponse = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }
const pedidos = (rede: FakeNetwork) => rede.chamadas.filter((chamada) => chamada.caminho === SEGUNDA)
const corpos = (): Record<string, unknown>[] => {
  const fetchFalso = globalThis.fetch as unknown as { mock: { calls: [string, RequestInit | undefined][] } }
  return fetchFalso.mock.calls.filter(([caminho]) => caminho === SEGUNDA).map(([, opcoes]) => JSON.parse(String(opcoes?.body)) as Record<string, unknown>)
}

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

function montar(aplicada: AtividadeAplicada = ENCERRADA, alunos: readonly Aluno[] = TURMA) {
  const rede = fakeNetwork()
  rede.responderPor(LEITURA, leitura(alunos))
  rede.responderPor('/v1/atividades-aplicadas', { status: 200, corpo: { itens: [] } })
  renderScreen(<SegundaChamada aplicada={aplicada} nomeDaTurma="7ºA" focoDeReserva={() => undefined} />)
  return rede
}
const dialogo = () => screen.getByRole('alertdialog', { name: 'Segunda chamada' })
const abrir = async (usuario: ReturnType<typeof userEvent.setup>) => {
  await usuario.click(screen.getByRole('button', { name: 'Segunda chamada' }))
  await within(dialogo()).findByText('Bia Lima')
}
const botaoDeAbrir = () => within(dialogo()).getByRole('button', { name: 'Abrir a segunda chamada' })

describe('SegundaChamada: quem tem o botão', () => {
  it('só a prova avaliativa com janela, já encerrada, e que não é ela mesma segunda chamada', () => {
    expect(canAbrirSegundaChamada(ENCERRADA)).toBe(true)
    expect(canAbrirSegundaChamada({ ...ENCERRADA, estado: 'aberta' })).toBe(false)
    expect(canAbrirSegundaChamada({ ...ENCERRADA, avaliativa: false })).toBe(false)
    expect(canAbrirSegundaChamada({ ...ENCERRADA, janela: null })).toBe(false)
    expect(canAbrirSegundaChamada({ ...ENCERRADA, segundaChamadaDe: id(9) })).toBe(false)
    expect(canAbrirSegundaChamada({ ...ENCERRADA, segundaChamadaDe: null })).toBe(true)
  })

  it('na tela, a aberta e a segunda chamada não têm o botão', () => {
    fakeNetwork()
    const { unmount } = renderScreen(<SegundaChamada aplicada={{ ...ENCERRADA, estado: 'aberta' }} nomeDaTurma="7ºA" focoDeReserva={() => undefined} />)
    expect(screen.queryByRole('button', { name: 'Segunda chamada' })).toBeNull()
    unmount()
    renderScreen(<SegundaChamada aplicada={{ ...ENCERRADA, segundaChamadaDe: id(9) }} nomeDaTurma="7ºA" focoDeReserva={() => undefined} />)
    expect(screen.queryByRole('button', { name: 'Segunda chamada' })).toBeNull()
  })
})

describe('SegundaChamada: a escolha e a confirmação', () => {
  it('só quem não começou é convocável, por nome, em uma lista de uma coluna; quem enviou ou esgotou o tempo não aparece', async () => {
    const usuario = userEvent.setup()
    montar()
    // Fechado, o diálogo nem existe: ele só nasce no clique.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await abrir(usuario)
    // Com os alunos na tela, o "Carregando…" já saiu.
    expect(within(dialogo()).queryByText('Carregando os alunos da turma…')).toBeNull()
    const lista = within(dialogo()).getByRole('group', { name: 'Quem faz a segunda chamada' })
    expect(within(lista).getAllByRole('checkbox').map((caixa) => caixa.getAttribute('value'))).toEqual([id(102), id(104)])
    expect(within(lista).getByRole('checkbox', { name: 'Bia Lima' })).toBeTruthy()
    expect(within(lista).getByRole('checkbox', { name: 'Dora Alves' })).toBeTruthy()
    expect(within(dialogo()).queryByText('Ana Souza')).toBeNull()
    expect(within(dialogo()).queryByText('Caio Rocha')).toBeNull()
    // Uma coluna: a lista é uma lista, sem grade.
    expect(lista.querySelector('ul')?.className).not.toMatch(/grid|columns/)
    expect(within(dialogo()).getByText('Ninguém escolhido ainda')).toBeTruthy()
    // Nada marcado, nada tentado: nem o tempo adicional de ninguém, nem o erro de "escolha alguém".
    expect(within(dialogo()).queryByLabelText(/Tempo adicional de/)).toBeNull()
    expect(within(dialogo()).queryByText(TEXTO_SEM_CONVOCADOS)).toBeNull()
    expect(within(dialogo()).queryByText('Diga quando a prova abre.')).toBeNull()
    // Com convocáveis na lista, nem o aviso de "ninguém" aparece.
    expect(within(dialogo()).queryByText(TEXTO_DE_NINGUEM_PARA_CONVOCAR)).toBeNull()
  })

  it('a confirmação diz os convocados por nome, a janela no fuso da escola, a duração e quantos têm tempo adicional, antes de qualquer pedido', async () => {
    const usuario = userEvent.setup()
    const rede = montar()
    await abrir(usuario)
    await usuario.click(within(dialogo()).getByRole('checkbox', { name: 'Bia Lima' }))
    await usuario.click(within(dialogo()).getByRole('checkbox', { name: 'Dora Alves' }))
    await usuario.type(within(dialogo()).getByLabelText('Abre em'), '2030-03-14T10:00')
    await usuario.type(within(dialogo()).getByLabelText('Fecha em'), '2030-03-14T11:40')
    expect((within(dialogo()).getByLabelText('Duração (minutos)') as HTMLInputElement).value).toBe('40')
    await usuario.selectOptions(within(dialogo()).getByLabelText('Tempo adicional de Bia Lima'), '50')

    expect(within(dialogo()).getByText('Bia Lima, Dora Alves')).toBeTruthy()
    expect(within(dialogo()).getByText('7ºA · abre 14/03 às 10:00 · fecha às 11:40 · 40 min · 1 aluno com tempo adicional')).toBeTruthy()
    // Quem tem o tempo e quanto não aparece no resumo: é adaptação.
    expect(within(dialogo()).queryByText(/\+50%/, { selector: 'dd' })).toBeNull()
    expect(pedidos(rede)).toHaveLength(0)
  })

  it('o pedido leva só os convocados, a janela em UTC, a duração e o tempo adicional de quem foi escolhido; o do desmarcado sai', async () => {
    const usuario = userEvent.setup()
    const rede = montar()
    rede.responderPor(SEGUNDA, { status: 201, corpo: { ...ENCERRADA, id: id(7), segundaChamadaDe: ENCERRADA.id, estado: 'aberta', encerradaEm: null } })
    await abrir(usuario)
    await usuario.click(within(dialogo()).getByRole('checkbox', { name: 'Bia Lima' }))
    await usuario.selectOptions(within(dialogo()).getByLabelText('Tempo adicional de Bia Lima'), '25')
    await usuario.click(within(dialogo()).getByRole('checkbox', { name: 'Dora Alves' }))
    await usuario.selectOptions(within(dialogo()).getByLabelText('Tempo adicional de Dora Alves'), '100')
    // Desmarcada, a Dora leva embora o tempo dela.
    await usuario.click(within(dialogo()).getByRole('checkbox', { name: 'Dora Alves' }))
    await usuario.type(within(dialogo()).getByLabelText('Abre em'), '2030-03-14T10:00')
    await usuario.type(within(dialogo()).getByLabelText('Fecha em'), '2030-03-14T11:40')
    await usuario.click(botaoDeAbrir())
    await waitFor(() => expect(pedidos(rede)).toHaveLength(1))
    expect(corpos()[0]).toEqual({
      alunoIds: [id(102)],
      janela: { abreEm: '2030-03-14T13:00:00.000Z', fechaEm: '2030-03-14T14:40:00.000Z' },
      duracaoMin: 40,
      tempoAdicional: [{ alunoId: id(102), percentual: 25 }],
    })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('status').textContent).toBe('Segunda chamada aberta para 1 aluno. Ela aparece na lista de atividades da turma.')
  })

  it('sem convocado, sem janela ou com o tempo que não cabe, nada sai e cada campo diz o que fazer', async () => {
    const usuario = userEvent.setup()
    const rede = montar()
    await abrir(usuario)
    const grupo = within(dialogo()).getByRole('group', { name: 'Quem faz a segunda chamada' })
    expect(grupo.getAttribute('aria-describedby')).toBeNull()
    await usuario.click(botaoDeAbrir())
    expect(within(dialogo()).getByText(TEXTO_SEM_CONVOCADOS)).toBeTruthy()
    // O aviso é a descrição do grupo, para o leitor de tela.
    expect(grupo.getAttribute('aria-describedby')).toBe(within(dialogo()).getByText(TEXTO_SEM_CONVOCADOS).id)
    expect(within(dialogo()).getByText('Diga quando a prova abre.')).toBeTruthy()
    // Com a janela boa e ninguém escolhido, nada sai e o aviso fica.
    await usuario.type(within(dialogo()).getByLabelText('Abre em'), '2030-03-14T09:00')
    await usuario.type(within(dialogo()).getByLabelText('Fecha em'), '2030-03-14T12:00')
    await usuario.click(botaoDeAbrir())
    expect(pedidos(rede)).toHaveLength(0)
    expect(within(dialogo()).getByText(TEXTO_SEM_CONVOCADOS)).toBeTruthy()

    // 50 min de janela, 40 de duração e +50%: não cabe.
    await usuario.click(within(dialogo()).getByRole('checkbox', { name: 'Bia Lima' }))
    // Com alguém escolhido, o aviso de "escolha alguém" sai.
    expect(within(dialogo()).queryByText(TEXTO_SEM_CONVOCADOS)).toBeNull()
    expect(grupo.getAttribute('aria-describedby')).toBeNull()
    await usuario.selectOptions(within(dialogo()).getByLabelText('Tempo adicional de Bia Lima'), '50')
    await usuario.clear(within(dialogo()).getByLabelText('Abre em'))
    await usuario.type(within(dialogo()).getByLabelText('Abre em'), '2030-03-14T10:00')
    await usuario.clear(within(dialogo()).getByLabelText('Fecha em'))
    await usuario.type(within(dialogo()).getByLabelText('Fecha em'), '2030-03-14T10:50')
    await usuario.click(botaoDeAbrir())
    expect(within(dialogo()).getByText('O tempo adicional não cabe na janela: com 40 min e +50%, a janela precisa de 60 min.')).toBeTruthy()
    expect(pedidos(rede)).toHaveLength(0)
  })

  it('o erro do tempo adicional que não cabe só aparece depois de confirmar', async () => {
    const usuario = userEvent.setup()
    montar()
    await abrir(usuario)
    await usuario.click(within(dialogo()).getByRole('checkbox', { name: 'Bia Lima' }))
    await usuario.selectOptions(within(dialogo()).getByLabelText('Tempo adicional de Bia Lima'), '50')
    await usuario.type(within(dialogo()).getByLabelText('Abre em'), '2030-03-14T10:00')
    await usuario.type(within(dialogo()).getByLabelText('Fecha em'), '2030-03-14T10:50')
    expect(within(dialogo()).queryAllByText(/O tempo adicional não cabe/)).toHaveLength(0)
    await usuario.click(botaoDeAbrir())
    expect(within(dialogo()).getAllByText(/O tempo adicional não cabe/).length).toBeGreaterThan(0)
  })

  it('tempo adicional numa prova sem duração: o aviso de "diga a duração" só aparece depois de confirmar, e o pedido não sai', async () => {
    const usuario = userEvent.setup()
    const rede = montar({ ...ENCERRADA, duracaoMin: null })
    await abrir(usuario)
    await usuario.click(within(dialogo()).getByRole('checkbox', { name: 'Bia Lima' }))
    await usuario.selectOptions(within(dialogo()).getByLabelText('Tempo adicional de Bia Lima'), '50')
    await usuario.type(within(dialogo()).getByLabelText('Abre em'), '2030-03-14T10:00')
    await usuario.type(within(dialogo()).getByLabelText('Fecha em'), '2030-03-14T12:00')
    expect(within(dialogo()).queryByText(TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO)).toBeNull()
    await usuario.click(botaoDeAbrir())
    expect(within(dialogo()).getByText(TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO)).toBeTruthy()
    expect(pedidos(rede)).toHaveLength(0)
  })

  it('quem volta a "Sem tempo adicional" segue convocado e sai do pedido sem o tempo', async () => {
    const usuario = userEvent.setup()
    const rede = montar()
    rede.responderPor(SEGUNDA, { status: 201, corpo: { ...ENCERRADA, id: id(7), segundaChamadaDe: ENCERRADA.id, estado: 'aberta', encerradaEm: null } })
    await abrir(usuario)
    await usuario.click(within(dialogo()).getByRole('checkbox', { name: 'Bia Lima' }))
    await usuario.selectOptions(within(dialogo()).getByLabelText('Tempo adicional de Bia Lima'), '25')
    await usuario.selectOptions(within(dialogo()).getByLabelText('Tempo adicional de Bia Lima'), '0')
    await usuario.type(within(dialogo()).getByLabelText('Abre em'), '2030-03-14T10:00')
    await usuario.type(within(dialogo()).getByLabelText('Fecha em'), '2030-03-14T11:40')
    await usuario.click(botaoDeAbrir())
    await waitFor(() => expect(pedidos(rede)).toHaveLength(1))
    expect(corpos()[0]).toEqual({ alunoIds: [id(102)], janela: { abreEm: '2030-03-14T13:00:00.000Z', fechaEm: '2030-03-14T14:40:00.000Z' }, duracaoMin: 40, tempoAdicional: [] })
  })

  it('se a leitura dos alunos falha, o diálogo diz isso e oferece "Tentar de novo", sem dizer que ninguém é convocável', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor(LEITURA, FALHA)
    renderScreen(<SegundaChamada aplicada={ENCERRADA} nomeDaTurma="7ºA" focoDeReserva={() => undefined} />)
    await usuario.click(screen.getByRole('button', { name: 'Segunda chamada' }))
    expect(await within(dialogo()).findByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(within(dialogo()).queryByText(TEXTO_DE_NINGUEM_PARA_CONVOCAR)).toBeNull()
  })

  it('a releitura que falha com a lista já na tela deixa a lista, sem alerta com texto e sem "Tentar de novo"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const rede = fakeNetwork()
      let falhando = false
      rede.responderPor(LEITURA, () => (falhando ? FALHA : leitura(TURMA)))
      rede.responderPor('/v1/atividades-aplicadas', { status: 200, corpo: { itens: [] } })
      renderScreen(<SegundaChamada aplicada={ENCERRADA} nomeDaTurma="7ºA" focoDeReserva={() => undefined} />)
      await abrir(usuario)
      expect(within(dialogo()).getByRole('checkbox', { name: 'Bia Lima' })).toBeTruthy()
      // A professora troca de aba por mais de 30 s (o `staleTime`) e volta: a releitura sai, e a rede responde erro.
      falhando = true
      focusManager.setFocused(false)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000)
      })
      focusManager.setFocused(true)
      await waitFor(() => expect(rede.chamadas.filter((chamada) => chamada.caminho === LEITURA).length).toBeGreaterThanOrEqual(2))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })
      expect(within(dialogo()).getByRole('checkbox', { name: 'Bia Lima' })).toBeTruthy()
      expect(within(dialogo()).queryAllByRole('alert').map((alerta) => alerta.textContent)).toEqual([''])
      expect(within(dialogo()).queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    } finally {
      focusManager.setFocused(undefined)
      vi.useRealTimers()
    }
  })

  it('enquanto lê os alunos o diálogo diz que carrega, não diz que ninguém é convocável, e o botão de abrir não está desligado', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor(LEITURA, () => new Promise<FakeResponse>(() => undefined))
    renderScreen(<SegundaChamada aplicada={ENCERRADA} nomeDaTurma="7ºA" focoDeReserva={() => undefined} />)
    await usuario.click(screen.getByRole('button', { name: 'Segunda chamada' }))
    expect(await within(dialogo()).findByText('Carregando os alunos da turma…')).toBeTruthy()
    expect(within(dialogo()).queryByText(TEXTO_DE_NINGUEM_PARA_CONVOCAR)).toBeNull()
    // Carregar não é falhar: nem o alerta, nem o "Tentar de novo".
    // O diálogo tem uma região de aviso vazia: o que não pode haver é um alerta com texto.
    expect(within(dialogo()).queryAllByRole('alert').map((alerta) => alerta.textContent)).toEqual([''])
    expect(within(dialogo()).queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect((botaoDeAbrir() as HTMLButtonElement).disabled).toBe(false)
  })

  it('dois cliques em confirmar mandam um pedido só; a falha fica no diálogo, e abrir de novo a limpa', async () => {
    const usuario = userEvent.setup()
    const rede = montar()
    rede.responderPor(SEGUNDA, FALHA)
    await abrir(usuario)
    await usuario.click(within(dialogo()).getByRole('checkbox', { name: 'Bia Lima' }))
    await usuario.type(within(dialogo()).getByLabelText('Abre em'), '2030-03-14T10:00')
    await usuario.type(within(dialogo()).getByLabelText('Fecha em'), '2030-03-14T11:40')
    // Os dois cliques saem antes de a tela redesenhar: só a trava de dentro da peça os distingue, e não o botão desligado.
    const botao = botaoDeAbrir()
    act(() => {
      botao.click()
      botao.click()
    })
    await waitFor(() => expect(within(dialogo()).getByRole('alert').textContent).not.toBe(''))
    expect(pedidos(rede)).toHaveLength(1)
    expect(within(dialogo()).getByRole('alert').textContent).not.toMatch(/LIMITE_EXCEDIDO|429/)
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    await usuario.click(screen.getByRole('button', { name: 'Segunda chamada' }))
    expect(within(dialogo()).getByRole('alert').textContent).toBe('')
  })

  it('quando ninguém é convocável o diálogo diz por quê e o botão de abrir fica desligado', async () => {
    const usuario = userEvent.setup()
    montar(ENCERRADA, [aluno(1, 'Ana Souza', 'enviou'), aluno(3, 'Caio Rocha', 'tempo_esgotado')])
    await usuario.click(screen.getByRole('button', { name: 'Segunda chamada' }))
    expect(await within(dialogo()).findByText(TEXTO_DE_NINGUEM_PARA_CONVOCAR)).toBeTruthy()
    expect((botaoDeAbrir() as HTMLButtonElement).disabled).toBe(true)
    expect(within(dialogo()).queryByLabelText('Abre em')).toBeNull()
    expect(within(dialogo()).queryByRole('group', { name: 'Quem faz a segunda chamada' })).toBeNull()
  })

  it('o `CONFLITO` e o `ENTRADA_INVALIDA` dizem o que houve, em português', async () => {
    const usuario = userEvent.setup()
    const rede = montar()
    rede.responderPor(SEGUNDA, { status: 409, corpo: { erro: { codigo: 'CONFLITO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
    await abrir(usuario)
    await usuario.click(within(dialogo()).getByRole('checkbox', { name: 'Bia Lima' }))
    await usuario.type(within(dialogo()).getByLabelText('Abre em'), '2030-03-14T10:00')
    await usuario.type(within(dialogo()).getByLabelText('Fecha em'), '2030-03-14T11:40')
    await usuario.click(botaoDeAbrir())
    await waitFor(() => expect(within(dialogo()).getByRole('alert').textContent).toMatch(/segunda chamada aberta/))
  })
})
