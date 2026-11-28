// @vitest-environment jsdom
import type { AtividadeAplicada } from '@educa/shared'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuery } from '@tanstack/react-query'
import { acompanhamentoQueryOptions } from './api/acompanhamento'
import { atividadesAplicadasQueryOptions } from './api/atividades'
import { setupScreen, fakeNetwork, renderScreen, type FakeResponse } from '../../../__fixtures__/render-screen'
import { EFEITO_DE_ENCERRAR } from './aprovar'
import { EncerramentoDaAtividade } from './EncerramentoDaAtividade'

/**
 * O "Encerrar a atividade" extraído de `AplicacaoDoArtefato` (telas do professor, 6.0): quem tem o botão, o que a confirmação
 * diz antes, o pedido que sai uma vez só e a falha em português. A rede é falsa; a peça, o diálogo e o cliente de consultas são
 * os de verdade. O `jsdom` não tem o `dialog` modal: o teste o põe (é API do navegador, e não peça nossa).
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const APLICADA: AtividadeAplicada = {
  id: id(1),
  artefatoId: id(2),
  turmaId: id(3),
  titulo: 'Atividade de estequiometria',
  avaliativa: false,
  estado: 'aberta',
  questoes: 2,
  aplicadaEm: '2026-10-05T13:00:00.000Z',
  encerradaEm: null,
  participacao: { alunos: 30, iniciaram: 12, enviaram: 10 },
  entrega: null,
}
const ENCERRADA: AtividadeAplicada = { ...APLICADA, estado: 'encerrada', encerradaEm: '2026-10-05T13:50:00.000Z' }
const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const encerramentos = (rede: ReturnType<typeof fakeNetwork>) => rede.chamadas.filter((chamada) => chamada.caminho === `/v1/atividades-aplicadas/${APLICADA.id}/encerrar`)

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

function montar(aplicada: AtividadeAplicada, focoDeReserva: () => void = () => undefined) {
  return renderScreen(<EncerramentoDaAtividade aplicada={aplicada} nomeDaTurma="7ºA" focoDeReserva={focoDeReserva} />)
}

describe('EncerramentoDaAtividade', () => {
  it('só a atividade aberta tem o botão: a encerrada não se encerra de novo por aqui', () => {
    fakeNetwork()
    const { unmount } = montar(APLICADA)
    expect(screen.getByRole('button', { name: 'Encerrar a atividade' })).toBeTruthy()
    unmount()
    montar(ENCERRADA)
    expect(screen.queryByRole('button', { name: 'Encerrar a atividade' })).toBeNull()
  })

  it('a confirmação diz a atividade, a turma, quantos já enviaram e o que acontece, antes de qualquer pedido', async () => {
    const rede = fakeNetwork()
    const usuario = userEvent.setup()
    montar(APLICADA)
    await usuario.click(screen.getByRole('button', { name: 'Encerrar a atividade' }))

    const dialogo = screen.getByRole('alertdialog', { name: 'Encerrar a atividade' })
    expect(within(dialogo).getByText('Atividade de estequiometria')).toBeTruthy()
    expect(within(dialogo).getByText('7ºA')).toBeTruthy()
    expect(within(dialogo).getByText('10 de 30 alunos')).toBeTruthy()
    expect(within(dialogo).getByText(EFEITO_DE_ENCERRAR)).toBeTruthy()
    expect(encerramentos(rede)).toHaveLength(0)

    // Cancelar fecha e nada sai.
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(encerramentos(rede)).toHaveLength(0)
  })

  it('dois cliques em confirmar no mesmo instante mandam um pedido só, e o diálogo fecha quando ele volta', async () => {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${APLICADA.id}/encerrar`, ok({ atividade: ENCERRADA, execucaoId: null }))
    const usuario = userEvent.setup()
    montar(APLICADA)
    await usuario.click(screen.getByRole('button', { name: 'Encerrar a atividade' }))
    const confirmar = within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Encerrar a atividade' })

    // Os dois cliques saem antes de a tela redesenhar: só a trava de dentro da peça os distingue, e não o botão desligado.
    act(() => {
      confirmar.click()
      confirmar.click()
    })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(encerramentos(rede)).toHaveLength(1)
    expect(encerramentos(rede)[0]?.metodo).toBe('POST')
  })

  it('a falha fica no diálogo, em português e sem o código; fechando, a mensagem fica ao lado do botão; e abrir de novo a limpa', async () => {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${APLICADA.id}/encerrar`, { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
    const usuario = userEvent.setup()
    montar(APLICADA)
    await usuario.click(screen.getByRole('button', { name: 'Encerrar a atividade' }))
    const dialogo = screen.getByRole('alertdialog')
    await usuario.click(within(dialogo).getAllByRole('button', { name: 'Encerrar a atividade' }).at(-1) as HTMLElement)

    await waitFor(() => expect(within(dialogo).getByRole('alert').textContent).not.toBe(''))
    expect(within(dialogo).getByRole('alert').textContent).not.toMatch(/LIMITE_EXCEDIDO|429/)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(encerramentos(rede)).toHaveLength(1)

    // O pedido que falhou libera a trava: confirmar de novo manda outro, e não fica preso.
    await usuario.click(within(dialogo).getAllByRole('button', { name: 'Encerrar a atividade' }).at(-1) as HTMLElement)
    await waitFor(() => expect(encerramentos(rede)).toHaveLength(2))

    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('alert').textContent).not.toBe('')

    // Uma nova tentativa começa limpa: o aviso da anterior não fica em cima do diálogo novo.
    await usuario.click(screen.getByRole('button', { name: 'Encerrar a atividade' }))
    expect(within(screen.getByRole('alertdialog')).getByRole('alert').textContent).toBe('')
  })
})

/** Quem lê a lista da turma, como o painel dela faz: é a leitura que o encerramento manda reler. */
function LeitorDaLista() {
  useQuery(atividadesAplicadasQueryOptions(APLICADA.turmaId))
  return null
}

describe('EncerramentoDaAtividade: a releitura', () => {
  it('o diálogo só fecha depois de a lista da turma ser lida de novo, para o foco ir ao bloco que fica e não ao `body`', async () => {
    const rede = fakeNetwork()
    const usuario = userEvent.setup()
    let segurar = false
    let liberar: (resposta: FakeResponse) => void = () => undefined
    rede.responderPor(`/v1/atividades-aplicadas`, () => {
      if (!segurar) return ok({ itens: [APLICADA] })
      return new Promise<FakeResponse>((resolver) => (liberar = resolver))
    })
    rede.responderPor(`/v1/atividades-aplicadas/${APLICADA.id}/encerrar`, ok({ atividade: ENCERRADA, execucaoId: null }))
    renderScreen(
      <>
        <LeitorDaLista />
        <EncerramentoDaAtividade aplicada={APLICADA} nomeDaTurma="7ºA" focoDeReserva={() => undefined} />
      </>,
    )
    await waitFor(() => expect(rede.chamadas.some((chamada) => chamada.caminho.startsWith('/v1/atividades-aplicadas?'))).toBe(true))
    await usuario.click(screen.getByRole('button', { name: 'Encerrar a atividade' }))
    segurar = true
    await usuario.click(within(screen.getByRole('alertdialog')).getAllByRole('button', { name: 'Encerrar a atividade' }).at(-1) as HTMLElement)

    // O pedido voltou, e a lista está sendo lida de novo: o diálogo continua aberto até ela chegar.
    await waitFor(() => expect(encerramentos(rede)).toHaveLength(1))
    await waitFor(() => expect(rede.chamadas.filter((chamada) => chamada.caminho.startsWith('/v1/atividades-aplicadas?')).length).toBeGreaterThanOrEqual(2))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    liberar(ok({ itens: [ENCERRADA] }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })
})

const PROVA: AtividadeAplicada = { ...APLICADA, avaliativa: true, janela: { abreEm: '2026-10-05T13:00:00.000Z', fechaEm: '2026-10-05T14:40:00.000Z' }, duracaoMin: 40, comTempoAdicional: 0 }
const LEITURA = `/v1/atividades-aplicadas/${APLICADA.id}/acompanhamento`
const alunoDaProva = (n: number, situacao: 'nao_comecou' | 'fazendo' | 'enviou' | 'tempo_esgotado') => ({ alunoId: id(100 + n), nome: `Aluno ${String(n)}`, situacao, limiteEm: situacao === 'fazendo' ? '2026-10-05T13:42:00.000Z' : null })
const doAcompanhamento = (situacoes: readonly ('nao_comecou' | 'fazendo' | 'enviou' | 'tempo_esgotado')[]): FakeResponse =>
  ok({ atividadeAplicadaId: APLICADA.id, agora: '2026-10-05T13:10:00.000Z', alunos: situacoes.map((situacao, indice) => alunoDaProva(indice + 1, situacao)) })

describe('EncerramentoDaAtividade: a prova com relógio diz quantos ainda fazem (RF5)', () => {
  it('com 3 fazendo, a confirmação diz "3 alunos ainda estão fazendo. As respostas salvas deles vão para a correção.", e quem enviou ou não começou não entra na conta', async () => {
    const rede = fakeNetwork()
    rede.responderPor(LEITURA, doAcompanhamento(['fazendo', 'fazendo', 'enviou', 'fazendo', 'nao_comecou', 'tempo_esgotado']))
    const usuario = userEvent.setup()
    montar(PROVA)
    // A leitura só sai quando a confirmação abre: a lista de atividades não paga um acompanhamento por linha.
    expect(rede.chamadas.some((chamada) => chamada.caminho === LEITURA)).toBe(false)
    await usuario.click(screen.getByRole('button', { name: 'Encerrar a atividade' }))
    const dialogo = screen.getByRole('alertdialog', { name: 'Encerrar a atividade' })
    expect(await within(dialogo).findByText('3 alunos ainda estão fazendo. As respostas salvas deles vão para a correção.')).toBeTruthy()
    expect(encerramentos(rede)).toHaveLength(0)
  })

  it('com 1 fazendo, a frase vai ao singular; com ninguém fazendo, não há frase nem "0 alunos"', async () => {
    const rede = fakeNetwork()
    let situacoes: ('fazendo' | 'enviou')[] = ['fazendo', 'enviou']
    rede.responderPor(LEITURA, () => doAcompanhamento(situacoes))
    const usuario = userEvent.setup()
    montar(PROVA)
    await usuario.click(screen.getByRole('button', { name: 'Encerrar a atividade' }))
    const dialogo = screen.getByRole('alertdialog', { name: 'Encerrar a atividade' })
    expect(await within(dialogo).findByText('1 aluno ainda está fazendo. As respostas salvas dele vão para a correção.')).toBeTruthy()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    situacoes = ['enviou', 'enviou']
    await usuario.click(screen.getByRole('button', { name: 'Encerrar a atividade' }))
    await waitFor(() => expect(screen.getByRole('alertdialog').textContent).not.toMatch(/ainda (está|estão) fazendo/))
    expect(screen.getByRole('alertdialog').textContent).not.toMatch(/\b0 alunos ainda|zero alunos/i)
  })

  it('a leitura relida na abertura vale mais que a antiga: o aluno que terminou entre uma e outra sai da conta', async () => {
    const rede = fakeNetwork()
    let leituras = 0
    rede.responderPor(LEITURA, () => doAcompanhamento((leituras += 1) === 1 ? ['fazendo', 'fazendo'] : ['fazendo', 'enviou']))
    const usuario = userEvent.setup()
    renderScreen(
      <>
        <LeitorDoAcompanhamento />
        <EncerramentoDaAtividade aplicada={PROVA} nomeDaTurma="7ºA" focoDeReserva={() => undefined} />
      </>,
    )
    await waitFor(() => expect(leituras).toBe(1))
    await usuario.click(screen.getByRole('button', { name: 'Encerrar a atividade' }))
    await waitFor(() => expect(leituras).toBeGreaterThanOrEqual(2))
    expect(await within(screen.getByRole('alertdialog')).findByText('1 aluno ainda está fazendo. As respostas salvas dele vão para a correção.')).toBeTruthy()
  })

  it('sem a leitura (a rede falhou), a confirmação segue sem a frase, e encerrar continua possível', async () => {
    const rede = fakeNetwork()
    rede.responderPor(LEITURA, { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
    rede.responderPor(`/v1/atividades-aplicadas/${APLICADA.id}/encerrar`, ok({ atividade: { ...PROVA, estado: 'encerrada' }, execucaoId: null }))
    const usuario = userEvent.setup()
    montar(PROVA)
    await usuario.click(screen.getByRole('button', { name: 'Encerrar a atividade' }))
    const dialogo = screen.getByRole('alertdialog')
    await waitFor(() => expect(rede.chamadas.some((chamada) => chamada.caminho === LEITURA)).toBe(true))
    expect(dialogo.textContent).not.toMatch(/ainda (está|estão) fazendo/)
    await usuario.click(within(dialogo).getAllByRole('button', { name: 'Encerrar a atividade' }).at(-1) as HTMLElement)
    await waitFor(() => expect(encerramentos(rede)).toHaveLength(1))
  })

  it('a atividade prática não lê o acompanhamento: o diálogo é o de sempre', async () => {
    const rede = fakeNetwork()
    const usuario = userEvent.setup()
    montar(APLICADA)
    await usuario.click(screen.getByRole('button', { name: 'Encerrar a atividade' }))
    expect(rede.chamadas.some((chamada) => chamada.caminho === LEITURA)).toBe(false)
  })
})

/** Quem já lê o acompanhamento, como o painel faz: o diálogo encontra a leitura em memória e manda relê-la. */
function LeitorDoAcompanhamento() {
  useQuery(acompanhamentoQueryOptions(APLICADA.id))
  return null
}
