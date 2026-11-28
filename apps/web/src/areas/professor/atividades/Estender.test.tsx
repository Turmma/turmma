// @vitest-environment jsdom
import type { AcompanhamentoResponse, AtividadeAplicada } from '@educa/shared'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import { Acompanhamento } from './Acompanhamento'

/**
 * "Estender" (avaliacao-e-correcao, 11.0; RF4): "Mais quantos minutos?", o aluno ou a turma toda, o efeito antes de confirmar, o pedido que sai uma vez só e a mesma `chave` no
 * reenvio. Montado pelo painel "Acompanhar", que é onde os botões moram. O `TZ` da unidade é `Asia/Tokyo`: o horário que a tela diz é o da escola.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const APLICADA: AtividadeAplicada = {
  id: id(1),
  artefatoId: id(2),
  turmaId: id(3),
  titulo: 'Prova de estequiometria',
  avaliativa: true,
  estado: 'aberta',
  questoes: 2,
  aplicadaEm: '2026-11-24T12:00:00.000Z',
  encerradaEm: null,
  janela: { abreEm: '2026-11-24T13:00:00.000Z', fechaEm: '2026-11-24T14:40:00.000Z' },
  duracaoMin: 40,
  comTempoAdicional: 0,
  participacao: { alunos: 2, iniciaram: 1, enviaram: 0 },
  entrega: null,
}
const LEITURA = `/v1/atividades-aplicadas/${APLICADA.id}/acompanhamento`
const EXTENSOES = `/v1/atividades-aplicadas/${APLICADA.id}/extensoes`
type Aluno = AcompanhamentoResponse['alunos'][number]
const ANA: Aluno = { alunoId: id(101), nome: 'Ana Souza', situacao: 'fazendo', limiteEm: '2026-11-24T13:42:00.000Z' }
const BIA: Aluno = { alunoId: id(102), nome: 'Bia Lima', situacao: 'nao_comecou', limiteEm: null }
const resposta = (alunos: readonly Aluno[]): FakeResponse => ({ status: 200, corpo: { atividadeAplicadaId: APLICADA.id, agora: '2026-11-24T13:10:00.000Z', alunos } })
const FALHA: FakeResponse = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }
const pedidos = (rede: FakeNetwork) => rede.chamadas.filter((chamada) => chamada.caminho === EXTENSOES)

/** Os corpos dos `POST …/extensoes`: a rede falsa não os guarda, então o teste os lê do `fetch` que ela instalou. */
function corposDosPedidos(): { alunoId?: string; minutos: number; chave: string }[] {
  const fetchFalso = globalThis.fetch as unknown as { mock: { calls: [string, RequestInit | undefined][] } }
  return fetchFalso.mock.calls.filter(([caminho]) => caminho === EXTENSOES).map(([, opcoes]) => JSON.parse(String(opcoes?.body)) as { alunoId?: string; minutos: number; chave: string })
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

afterEach(() => {
  vi.useRealTimers()
})

async function montar(alunos: readonly Aluno[] = [ANA, BIA]) {
  const rede = fakeNetwork()
  rede.responderPor(LEITURA, resposta(alunos))
  renderScreen(<Acompanhamento aplicada={APLICADA} nomeDaTurma="7ºA" focoDeReserva={() => undefined} />)
  await screen.findByText(alunos[0]?.nome ?? '')
  return rede
}
const dialogo = () => screen.getByRole('alertdialog', { name: 'Estender o tempo' })
const minutos = () => within(dialogo()).getByLabelText(/Mais quantos minutos\?/)
const confirmar = () => within(dialogo()).getByRole('button', { name: 'Estender o tempo' })

describe('Estender: o diálogo e o efeito antes de confirmar', () => {
  it('"Mais quantos minutos?", o aluno ou a turma toda, e o efeito do horário: Ana termina às 10:52 em vez de 10:42 (10 min), às 10:47 com 5', async () => {
    const usuario = userEvent.setup()
    const rede = await montar()
    await usuario.click(screen.getByRole('button', { name: 'Estender o tempo de Ana Souza' }))
    expect(within(dialogo()).getByText('Ana Souza', { selector: 'dd' })).toBeTruthy()
    expect(within(dialogo()).getByRole('radio', { name: 'Ana Souza' }).getAttribute('aria-checked')).toBe('true')
    expect(within(dialogo()).getByRole('radio', { name: 'A turma toda' })).toBeTruthy()
    expect(within(dialogo()).getByText(/Diga quantos minutos a mais/)).toBeTruthy()

    await usuario.type(minutos(), '10')
    expect(within(dialogo()).getByText('Ana Souza termina às 10:52 em vez de 10:42.')).toBeTruthy()
    await usuario.clear(minutos())
    await usuario.type(minutos(), '5')
    expect(within(dialogo()).getByText('Ana Souza termina às 10:47 em vez de 10:42.')).toBeTruthy()
    // Nada saiu: o efeito é lido antes de confirmar.
    expect(pedidos(rede)).toHaveLength(0)
  })

  it('"a turma toda" diz o que anda junto; o aluno que ainda não começou ganha os minutos sem horário de fim', async () => {
    const usuario = userEvent.setup()
    await montar()
    await usuario.click(screen.getByRole('button', { name: 'Estender o tempo de Ana Souza' }))
    await usuario.type(minutos(), '10')
    await usuario.click(within(dialogo()).getByRole('radio', { name: 'A turma toda' }))
    expect(within(dialogo()).getByText(/A turma toda ganha 10 minutos: quem está fazendo termina 10 minutos depois/)).toBeTruthy()
    expect(within(dialogo()).getByText('A turma toda', { selector: 'dd' })).toBeTruthy()
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))

    await usuario.click(screen.getByRole('button', { name: 'Estender o tempo de Bia Lima' }))
    await usuario.type(minutos(), '1')
    expect(within(dialogo()).getByText('Bia Lima ganha 1 minuto a mais na prova.')).toBeTruthy()
  })

  it('o botão da seção estende a turma toda, sem a escolha entre o aluno e a turma', async () => {
    const usuario = userEvent.setup()
    await montar()
    await usuario.click(screen.getByRole('button', { name: 'Estender a turma toda' }))
    expect(within(dialogo()).queryByRole('radio')).toBeNull()
    expect(within(dialogo()).getByText('A turma toda', { selector: 'dd' })).toBeTruthy()
  })

  it('0 e 121 minutos são recusados na tela, ao lado do campo, e nada sai; vazio e fração também', async () => {
    const usuario = userEvent.setup()
    const rede = await montar()
    await usuario.click(screen.getByRole('button', { name: 'Estender o tempo de Ana Souza' }))
    // O erro só vem depois de confirmar: o campo vazio, recém-aberto, não acusa nada.
    expect(within(dialogo()).queryByText('Diga de 1 a 120 minutos, em número inteiro.')).toBeNull()
    for (const texto of ['0', '121', '2.5']) {
      await usuario.clear(minutos())
      await usuario.type(minutos(), texto)
      await usuario.click(confirmar())
      expect(within(dialogo()).getByText('Diga de 1 a 120 minutos, em número inteiro.')).toBeTruthy()
    }
    await usuario.clear(minutos())
    await usuario.click(confirmar())
    expect(within(dialogo()).getByText('Diga de 1 a 120 minutos, em número inteiro.')).toBeTruthy()
    expect(pedidos(rede)).toHaveLength(0)
    // O limite de dentro (120) passa.
    rede.responderPor(EXTENSOES, resposta([ANA, BIA]))
    await usuario.clear(minutos())
    await usuario.type(minutos(), '120')
    await usuario.click(confirmar())
    await waitFor(() => expect(pedidos(rede)).toHaveLength(1))
  })
})

describe('Estender: o pedido', () => {
  it('o duplo clique em confirmar manda um pedido só, com o aluno, os minutos e uma chave; e a resposta troca o limite na lista sem recarregar', async () => {
    const usuario = userEvent.setup()
    const rede = await montar()
    rede.responderPor(EXTENSOES, resposta([{ ...ANA, limiteEm: '2026-11-24T13:52:00.000Z' }, BIA]))
    await usuario.click(screen.getByRole('button', { name: 'Estender o tempo de Ana Souza' }))
    await usuario.type(minutos(), '10')
    const botao = confirmar()
    act(() => {
      botao.click()
      botao.click()
    })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(pedidos(rede)).toHaveLength(1)
    const [corpo] = corposDosPedidos()
    expect(corpo).toMatchObject({ alunoId: ANA.alunoId, minutos: 10 })
    expect(corpo?.chave).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(await screen.findByText('Fazendo · termina às 10:52')).toBeTruthy()
  })

  it('a turma toda manda o pedido sem `alunoId`', async () => {
    const usuario = userEvent.setup()
    const rede = await montar()
    rede.responderPor(EXTENSOES, resposta([ANA, BIA]))
    await usuario.click(screen.getByRole('button', { name: 'Estender a turma toda' }))
    await usuario.type(minutos(), '15')
    await usuario.click(confirmar())
    await waitFor(() => expect(pedidos(rede)).toHaveLength(1))
    expect(corposDosPedidos()[0]).not.toHaveProperty('alunoId')
    expect(corposDosPedidos()[0]).toMatchObject({ minutos: 15 })
  })

  it('a falha fica no diálogo, em português; o reenvio do mesmo pedido leva a mesma chave, e outro pedido (outros minutos, ou outro alvo) leva uma nova', async () => {
    const usuario = userEvent.setup()
    const rede = await montar()
    rede.responderPor(EXTENSOES, FALHA)
    await usuario.click(screen.getByRole('button', { name: 'Estender o tempo de Ana Souza' }))
    await usuario.type(minutos(), '10')
    await usuario.click(confirmar())
    await waitFor(() => expect(within(dialogo()).getByRole('alert').textContent).not.toBe(''))
    expect(within(dialogo()).getByRole('alert').textContent).not.toMatch(/LIMITE_EXCEDIDO|429/)
    // Minutos válidos: a falha do servidor não vira o erro do campo.
    expect(within(dialogo()).queryByText('Diga de 1 a 120 minutos, em número inteiro.')).toBeNull()
    await usuario.click(confirmar())
    await waitFor(() => expect(pedidos(rede)).toHaveLength(2))
    const [primeiro, segundo] = corposDosPedidos()
    expect(segundo?.chave).toBe(primeiro?.chave)

    // Outros minutos: outro pedido, e a API não devolveria o gravado do primeiro.
    await usuario.clear(minutos())
    await usuario.type(minutos(), '20')
    await usuario.click(confirmar())
    await waitFor(() => expect(pedidos(rede)).toHaveLength(3))
    // Outro alvo, com os mesmos minutos: também outra chave.
    await usuario.click(within(dialogo()).getByRole('radio', { name: 'A turma toda' }))
    await usuario.click(confirmar())
    await waitFor(() => expect(pedidos(rede)).toHaveLength(4))
    const chaves = corposDosPedidos().map((corpo) => corpo.chave)
    expect(new Set(chaves).size).toBe(3)
    expect(chaves[2]).not.toBe(chaves[0])
    expect(chaves[3]).not.toBe(chaves[2])

    // Fechar e abrir de novo: a falha sai, o campo volta vazio e o pedido novo tem chave nova.
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    await usuario.click(screen.getByRole('button', { name: 'Estender o tempo de Ana Souza' }))
    expect(within(dialogo()).getByRole('alert').textContent).toBe('')
    expect((minutos() as HTMLInputElement).value).toBe('')
    rede.responderPor(EXTENSOES, resposta([ANA, BIA]))
    await usuario.type(minutos(), '10')
    // O alvo volta a ser o aluno (a última escolha foi a turma toda): o efeito fala dela, e não da turma.
    expect(dialogo().textContent).toContain('Ana Souza termina às')
    await usuario.click(confirmar())
    await waitFor(() => expect(pedidos(rede)).toHaveLength(5))
    expect(corposDosPedidos()[4]?.chave).not.toBe(chaves[0])
  })

  it('abrir o diálogo de novo começa outro pedido: o mesmo aluno e os mesmos minutos levam chave nova', async () => {
    const usuario = userEvent.setup()
    const rede = await montar()
    rede.responderPor(EXTENSOES, FALHA)
    const pedir = async () => {
      await usuario.click(screen.getByRole('button', { name: 'Estender o tempo de Ana Souza' }))
      await usuario.type(minutos(), '10')
      await usuario.click(confirmar())
    }
    await pedir()
    await waitFor(() => expect(pedidos(rede)).toHaveLength(1))
    await usuario.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    await pedir()
    await waitFor(() => expect(pedidos(rede)).toHaveLength(2))
    const [primeiro, segundo] = corposDosPedidos()
    expect(segundo?.chave).not.toBe(primeiro?.chave)
  })

  it('a prova que encerrou com o diálogo aberto: a mensagem diz que não dá mais para estender, e não fala ao aluno', async () => {
    const usuario = userEvent.setup()
    const rede = await montar()
    rede.responderPor(EXTENSOES, { status: 409, corpo: { erro: { codigo: 'ATIVIDADE_ENCERRADA', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
    await usuario.click(screen.getByRole('button', { name: 'Estender o tempo de Ana Souza' }))
    await usuario.type(minutos(), '10')
    await usuario.click(confirmar())
    await waitFor(() => expect(within(dialogo()).getByRole('alert').textContent).toBe('A prova já foi encerrada, e não dá mais para estender o tempo.'))
  })

  it('a leitura que estava no ar quando a extensão saiu não cobre o limite novo: a resposta atrasada é descartada', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    const rede = fakeNetwork()
    let leituras = 0
    let liberarAtrasada: (resposta: FakeResponse) => void = () => undefined
    rede.responderPor(LEITURA, () => {
      leituras += 1
      if (leituras === 1) return resposta([ANA, BIA])
      return new Promise<FakeResponse>((resolver) => (liberarAtrasada = resolver))
    })
    rede.responderPor(EXTENSOES, resposta([{ ...ANA, limiteEm: '2026-11-24T13:52:00.000Z' }, BIA]))
    renderScreen(<Acompanhamento aplicada={APLICADA} nomeDaTurma="7ºA" focoDeReserva={() => undefined} />)
    expect(await screen.findByText('Fazendo · termina às 10:42')).toBeTruthy()

    // A releitura dos 15 s sai e fica no ar; a professora estende; só então a leitura velha chega, com o limite antigo.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_500)
    })
    await waitFor(() => expect(leituras).toBe(2))
    await usuario.click(screen.getByRole('button', { name: 'Estender o tempo de Ana Souza' }))
    await usuario.type(minutos(), '10')
    await usuario.click(confirmar())
    expect(await screen.findByText('Fazendo · termina às 10:52')).toBeTruthy()
    await act(async () => {
      liberarAtrasada(resposta([ANA, BIA]))
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(screen.getByText('Fazendo · termina às 10:52')).toBeTruthy()
    expect(screen.queryByText('Fazendo · termina às 10:42')).toBeNull()
  })
})
