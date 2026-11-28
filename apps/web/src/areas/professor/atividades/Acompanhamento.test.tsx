// @vitest-environment jsdom
import type { AcompanhamentoResponse, AtividadeAplicada } from '@educa/shared'
import { focusManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupScreen, fakeNetwork, renderScreen, type FakeResponse } from '../../../__fixtures__/render-screen'
import TurmaHoje from '../turmas/TurmaHoje'
import { Acompanhamento } from './Acompanhamento'

/**
 * O painel "Acompanhar" da prova (avaliacao-e-correcao, 11.0; RF4): os estados da leitura, a situação em texto no fuso da escola, a releitura aos 15 s só
 * com a janela à vista, os homônimos e o que a tela **não** diz. A rede é falsa; a peça e o cliente de consultas são os de verdade. O `TZ` da unidade é
 * `Asia/Tokyo`: a hora de São Paulo que a tela mostra não é a do computador.
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
  participacao: { alunos: 5, iniciaram: 3, enviaram: 1 },
  entrega: null,
}
const ENCERRADA: AtividadeAplicada = { ...APLICADA, estado: 'encerrada', encerradaEm: '2026-11-24T14:00:00.000Z' }
const CAMINHO = `/v1/atividades-aplicadas/${APLICADA.id}/acompanhamento`

type Aluno = AcompanhamentoResponse['alunos'][number]
const aluno = (n: number, nome: string, situacao: Aluno['situacao'], limiteEm: string | null = null): Aluno => ({ alunoId: id(100 + n), nome, situacao, limiteEm })
/** 13:42 UTC é 10:42 em São Paulo, e 22:42 no `Asia/Tokyo` deste teste. */
const LIMITE = '2026-11-24T13:42:00.000Z'
const TURMA: Aluno[] = [aluno(1, 'Ana Souza', 'fazendo', LIMITE), aluno(2, 'Bia Lima', 'nao_comecou'), aluno(3, 'Caio Rocha', 'enviou'), aluno(4, 'Dora Alves', 'tempo_esgotado')]
/** 429: o cliente de consultas não o repete sozinho, e a falha chega à tela na hora. */
const FALHA: FakeResponse = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }
const acompanhamento = (alunos: readonly Aluno[]): FakeResponse => ({ status: 200, corpo: { atividadeAplicadaId: APLICADA.id, agora: '2026-11-24T13:10:00.000Z', alunos } })
const leituras = (rede: ReturnType<typeof fakeNetwork>) => rede.chamadas.filter((chamada) => chamada.caminho === CAMINHO).length

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

function montar(aplicada: AtividadeAplicada = APLICADA) {
  return renderScreen(<Acompanhamento aplicada={aplicada} nomeDaTurma="7ºA" focoDeReserva={() => undefined} />)
}
const cartao = (nome: string) => screen.getByText(nome).closest('li') as HTMLElement

describe('Acompanhamento: os estados', () => {
  it('carregando, a seção diz que lê, e não diz que a turma está vazia', async () => {
    const rede = fakeNetwork()
    rede.responderPor(CAMINHO, () => new Promise<FakeResponse>(() => undefined))
    montar()
    expect(await screen.findByText('Carregando o acompanhamento da prova…')).toBeTruthy()
    expect(screen.queryByText(/ainda não tem alunos/)).toBeNull()
    // Carregar não é falhar: nem o alerta, nem o "Tentar de novo".
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Estender/ })).toBeNull()
  })

  it('com falha e sem leitura, a mensagem em português e "Tentar de novo", que lê de novo; nunca a lista vazia', async () => {
    const rede = fakeNetwork()
    let falhando = true
    rede.responderPor(CAMINHO, () => (falhando ? FALHA : acompanhamento(TURMA)))
    const usuario = userEvent.setup()
    montar()
    expect((await screen.findByRole('alert')).textContent).not.toMatch(/LIMITE_EXCEDIDO|429/)
    expect(screen.queryByText(/ainda não tem alunos/)).toBeNull()
    falhando = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Ana Souza')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a turma sem alunos diz isso, e a seção não oferece "Estender a turma toda"', async () => {
    const rede = fakeNetwork()
    rede.responderPor(CAMINHO, acompanhamento([]))
    montar()
    expect(await screen.findByText(/Esta turma ainda não tem alunos para acompanhar\. Na aba Alunos, use “Convidar alunos” e aprove os pedidos de nome/)).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Estender a turma toda' })).toBeNull()
  })

  it('a situação de cada aluno é texto: "Não começou", "Fazendo · termina às 10:42", "Enviou" e "Tempo esgotado", e só quem não enviou tem "Estender"', async () => {
    const rede = fakeNetwork()
    rede.responderPor(CAMINHO, acompanhamento(TURMA))
    montar()
    await screen.findByText('Ana Souza')
    expect(screen.queryByText(/ainda não tem alunos/)).toBeNull()
    // Com o dado na tela, o "Carregando…" já saiu.
    expect(screen.queryByText('Carregando o acompanhamento da prova…')).toBeNull()
    expect(within(cartao('Ana Souza')).getByText('Fazendo · termina às 10:42')).toBeTruthy()
    expect(within(cartao('Bia Lima')).getByText('Não começou')).toBeTruthy()
    expect(within(cartao('Caio Rocha')).getByText('Enviou')).toBeTruthy()
    expect(within(cartao('Dora Alves')).getByText('Tempo esgotado')).toBeTruthy()
    expect(within(cartao('Ana Souza')).getByRole('button', { name: 'Estender o tempo de Ana Souza' })).toBeTruthy()
    expect(within(cartao('Bia Lima')).getByRole('button', { name: 'Estender o tempo de Bia Lima' })).toBeTruthy()
    expect(within(cartao('Dora Alves')).getByRole('button', { name: 'Estender o tempo de Dora Alves' })).toBeTruthy()
    expect(within(cartao('Caio Rocha')).queryByRole('button')).toBeNull()
    expect(screen.getByRole('button', { name: 'Estender a turma toda' })).toBeTruthy()
  })

  it('o que a tela não diz: saída da aba, percentual, "parado há", falta ou consequência; e os alunos seguem em ordem de nome, não de quem acabou antes', async () => {
    const rede = fakeNetwork()
    rede.responderPor(CAMINHO, acompanhamento([aluno(4, 'Dora Alves', 'tempo_esgotado'), aluno(3, 'Caio Rocha', 'enviou'), aluno(2, 'Bia Lima', 'nao_comecou'), aluno(1, 'Ana Souza', 'fazendo', LIMITE)]))
    montar()
    await screen.findByText('Ana Souza')
    const secao = document.querySelector('[data-acompanhamento]') as HTMLElement
    expect(secao.textContent).not.toMatch(/parado|saiu|saída|aba |%|falt|puni|suspeit|cola|atras/i)
    expect(within(secao).getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent)).toEqual(['Ana Souza', 'Bia Lima', 'Caio Rocha', 'Dora Alves'])
  })

  it('o horário é o da escola, e não o do computador: 13:42 UTC é 10:42, com o computador em Tóquio', async () => {
    const rede = fakeNetwork()
    rede.responderPor(CAMINHO, acompanhamento([aluno(1, 'Ana Souza', 'fazendo', LIMITE)]))
    montar()
    expect(await screen.findByText('Fazendo · termina às 10:42')).toBeTruthy()
    expect(screen.queryByText(/22:42/)).toBeNull()
  })

  it('dois alunos com o mesmo nome são dois cartões distintos, na ordem do id, e cada "Estender" diz de qual', async () => {
    const rede = fakeNetwork()
    rede.responderPor(CAMINHO, acompanhamento([aluno(2, 'Ana Souza', 'nao_comecou'), aluno(1, 'Ana Souza', 'fazendo', LIMITE), aluno(3, 'Bia Lima', 'enviou')]))
    montar()
    await screen.findByText('Bia Lima')
    const nomes = screen.getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent)
    expect(nomes).toEqual(['Ana Souza (1 de 2)', 'Ana Souza (2 de 2)', 'Bia Lima'])
    expect(screen.getByRole('button', { name: 'Estender o tempo de Ana Souza (1 de 2)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Estender o tempo de Ana Souza (2 de 2)' })).toBeTruthy()
    // O nome único não leva contagem.
    expect(screen.getByText('Bia Lima')).toBeTruthy()
  })

  it('a prova encerrada mostra a situação, mas sem "Estender": a API a recusaria', async () => {
    const rede = fakeNetwork()
    rede.responderPor(CAMINHO, acompanhamento(TURMA))
    montar(ENCERRADA)
    await screen.findByText('Ana Souza')
    expect(screen.queryByRole('button', { name: /Estender/ })).toBeNull()
  })
})

describe('Acompanhamento: a releitura aos 15 s, só com a janela à vista', () => {
  async function passar(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  it('relógio falso: aos 14 s nenhuma leitura nova; aos 15 s, uma, e o limite novo aparece sem recarregar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = fakeNetwork()
    let n = 0
    rede.responderPor(CAMINHO, () => ((n += 1) === 1 ? acompanhamento([aluno(1, 'Ana Souza', 'fazendo', LIMITE)]) : acompanhamento([aluno(1, 'Ana Souza', 'enviou')])))
    montar()
    expect(await screen.findByText('Fazendo · termina às 10:42')).toBeTruthy()
    expect(leituras(rede)).toBe(1)

    await passar(14_000)
    expect(leituras(rede)).toBe(1)

    await passar(1_000)
    expect(leituras(rede)).toBe(2)
    expect(await screen.findByText('Enviou')).toBeTruthy()
  })

  it('com a janela escondida, nenhuma leitura; o controle: com ela à vista de novo, a leitura sai', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = fakeNetwork()
    rede.responderPor(CAMINHO, acompanhamento(TURMA))
    montar()
    await screen.findByText('Ana Souza')
    const antes = leituras(rede)
    focusManager.setFocused(false)
    await passar(46_000)
    expect(leituras(rede)).toBe(antes)

    focusManager.setFocused(true)
    await passar(16_000)
    await waitFor(() => expect(leituras(rede)).toBeGreaterThan(antes))
  })

  it('a prova encerrada não é relida: o que ela mostra já não muda', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = fakeNetwork()
    rede.responderPor(CAMINHO, acompanhamento(TURMA))
    montar(ENCERRADA)
    await screen.findByText('Ana Souza')
    await passar(46_000)
    expect(leituras(rede)).toBe(1)
  })

  it('a releitura que falha deixa o último acompanhamento na tela, sem alerta nem "Tentar de novo"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = fakeNetwork()
    let n = 0
    rede.responderPor(CAMINHO, () => ((n += 1) === 1 ? acompanhamento(TURMA) : FALHA))
    montar()
    await screen.findByText('Ana Souza')
    await passar(15_500)
    await waitFor(() => expect(leituras(rede)).toBeGreaterThanOrEqual(2))
    expect(screen.getByText('Ana Souza')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })
})

describe('Acompanhamento: nunca na tela da sala', () => {
  it('a aba Hoje, que a professora projeta, não lê o acompanhamento nem aos 15 s, mesmo com a prova aberta na turma', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = fakeNetwork()
    rede.responderPor(/.*/, { status: 200, corpo: { itens: [APLICADA] } })
    renderScreen(<TurmaHoje turmaId={APLICADA.turmaId} aoPerderATurma={() => undefined} />)
    await waitFor(() => expect(rede.chamadas.some((chamada) => chamada.caminho.startsWith('/v1/atividades-aplicadas?'))).toBe(true))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(46_000)
    })
    expect(rede.chamadas.filter((chamada) => chamada.caminho.includes('/acompanhamento'))).toHaveLength(0)
  })
})
