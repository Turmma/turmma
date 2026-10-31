// @vitest-environment jsdom
import type { AtividadeAplicada } from '@educa/shared'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuery } from '@tanstack/react-query'
import { consultaAtividadesAplicadas } from './api/atividades'
import { prepararTela, redeFalsa, renderizarTela, type RespostaFalsa } from '../../../__fixtures__/render-screen'
import { EFEITO_DE_ENCERRAR } from './aprovar'
import { EncerramentoDaAtividade } from './EncerramentoDaAtividade'

/**
 * O "Encerrar a atividade" extraído de `AplicacaoDoArtefato` (telas do professor, 6.0): quem tem o botão, o que a confirmação
 * diz antes, o pedido que sai uma vez só e a falha em português. A rede é falsa; a peça, o diálogo e o cliente de consultas são
 * os de verdade. O `jsdom` não tem o `dialog` modal: o teste o põe (é API do navegador, e não peça nossa).
 */
prepararTela()

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
const ok = (corpo: unknown): RespostaFalsa => ({ status: 200, corpo })
const encerramentos = (rede: ReturnType<typeof redeFalsa>) => rede.chamadas.filter((chamada) => chamada.caminho === `/v1/atividades-aplicadas/${APLICADA.id}/encerrar`)

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
  return renderizarTela(<EncerramentoDaAtividade aplicada={aplicada} nomeDaTurma="7ºA" focoDeReserva={focoDeReserva} />)
}

describe('EncerramentoDaAtividade', () => {
  it('só a atividade aberta tem o botão: a encerrada não se encerra de novo por aqui', () => {
    redeFalsa()
    const { unmount } = montar(APLICADA)
    expect(screen.getByRole('button', { name: 'Encerrar a atividade' })).toBeTruthy()
    unmount()
    montar(ENCERRADA)
    expect(screen.queryByRole('button', { name: 'Encerrar a atividade' })).toBeNull()
  })

  it('a confirmação diz a atividade, a turma, quantos já enviaram e o que acontece, antes de qualquer pedido', async () => {
    const rede = redeFalsa()
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
    const rede = redeFalsa()
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
    const rede = redeFalsa()
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
  useQuery(consultaAtividadesAplicadas(APLICADA.turmaId))
  return null
}

describe('EncerramentoDaAtividade: a releitura', () => {
  it('o diálogo só fecha depois de a lista da turma ser lida de novo, para o foco ir ao bloco que fica e não ao `body`', async () => {
    const rede = redeFalsa()
    const usuario = userEvent.setup()
    let segurar = false
    let liberar: (resposta: RespostaFalsa) => void = () => undefined
    rede.responderPor(`/v1/atividades-aplicadas`, () => {
      if (!segurar) return ok({ itens: [APLICADA] })
      return new Promise<RespostaFalsa>((resolver) => (liberar = resolver))
    })
    rede.responderPor(`/v1/atividades-aplicadas/${APLICADA.id}/encerrar`, ok({ atividade: ENCERRADA, execucaoId: null }))
    renderizarTela(
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
