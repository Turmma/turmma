// @vitest-environment jsdom
import { ErrorCode } from '@educa/shared'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { fakeNetwork, renderScreen, setupScreen, type FakeNetwork, type FakeResponse } from '../../__fixtures__/render-screen'
import { ApiError, errorMessage } from '../../api/client'
import { encerrarPorInatividade, openSessaoPeloCookie, sair } from '../../api/sessao'
import { AVISO_DA_AVALIACAO } from './atividades'
import { TEXTO_DE_ERRO_AO_ABRIR_A_PROVA, TEXTO_DO_ENVIO_QUE_NAO_SAIU, TEXTO_DO_FIM_DO_TEMPO, TEXTO_DO_FIM_ENCERRADA, TEXTO_DO_FIM_ENVIADA, TEXTO_SEM_CONEXAO, textoDasQueNaoChegaram } from './atividade'
import AbrirAtividade from './AntesDeComecar'
import { respostasQueNaoChegaram } from './fila-de-respostas'
import ProvaEmFoco from './ProvaEmFoco'

/**
 * A prova em tela de foco e o "Antes de começar" (avaliacao-e-correcao, 12.0; RF6, RF7, RF8; regra 80, item 6). A rede é falsa; a fila de respostas, a fila de saídas, o cliente de consultas e as telas são as de verdade.
 * O tamanho e o toque nas duas larguras, o eixo e a prova embaralhada ponta a ponta são do e2e (`e2e/aluno-prova.spec.ts`).
 */
setupScreen()

const MIN = 60_000
const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const idDaProva = (n: number) => `0197a1c0-0000-7000-8000-${String(n + 500).padStart(12, '0')}`
const apiError = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: REQUISICAO } } })

const questao = (numero: number) => ({ numero, enunciado: `Enunciado sintético da questão ${String(numero)}`, alternativas: ['Quatro', 'Cinco', 'Seis', 'Sete'], ordemDasAlternativas: [0, 1, 2, 3] })

interface Opcoes {
  readonly respostas?: readonly { questao: number; alternativa: number; sequencia: number }[]
  readonly estado?: 'aberta' | 'encerrada'
  readonly enviadaEm?: string | null
}
const emAndamento = (id: string, { respostas = [], estado = 'aberta', enviadaEm = null }: Opcoes = {}): FakeResponse => ({
  status: 200,
  corpo: { comecou: true, atividadeAplicadaId: id, titulo: 'Prova sintética', avaliativa: true, estado, adaptacao: null, questoes: [questao(1), questao(2), questao(3)], respostas, enviadaEm, tempo: tempoDo(30 * MIN).corpo },
})

/**
 * O tempo como o servidor o dá: `agora` é o do servidor, e o computador do aluno pode estar adiantado (`adiantadoMs`). O limite é `faltam` depois do `agora` do servidor.
 */
function tempoDo(faltam: number, envio: 'aluno' | 'limite' | 'encerramento' | null = null, adiantadoMs = 0): FakeResponse {
  const agora = Date.now() - adiantadoMs
  return { status: 200, corpo: { limiteEm: new Date(agora + faltam).toISOString(), agora: new Date(agora).toISOString(), envio } }
}

function redeDaProva(id: string, prova: FakeResponse, tempo: FakeResponse | ((caminho: string) => FakeResponse) = tempoDo(30 * MIN)): FakeNetwork {
  const rede = fakeNetwork()
  rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova)
  rede.responderPor(`/v1/atividades-aplicadas/${id}/tempo`, tempo)
  return rede
}

function montar(id: string) {
  const localizacao = memoryLocation({ path: `/prova/${id}`, record: true })
  renderScreen(
    <Router hook={localizacao.hook}>
      <ProvaEmFoco atividadeAplicadaId={id} />
    </Router>,
  )
  return localizacao
}

/** A prova só na rota dela: quem sai (`Sair da prova`) desmonta a tela, como no aplicativo, e o que a tela ligava (a vigia da aba) se desliga. */
function montarNaRota(id: string) {
  const localizacao = memoryLocation({ path: `/prova/${id}`, record: true })
  renderScreen(
    <Router hook={localizacao.hook}>
      <Route path="/prova/:id">{() => <ProvaEmFoco atividadeAplicadaId={id} />}</Route>
    </Router>,
  )
  return localizacao
}

/** Avança o relógio falso (`vi.useFakeTimers`) e deixa a tela acabar o que o avanço dispara. */
async function passar(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

const faixa = () => document.querySelector('[data-faixa-da-prova]') as HTMLElement
const relogio = () => document.querySelector('[data-relogio]')?.textContent
const anuncio = () => document.querySelector('[data-anuncio-do-relogio]')?.textContent
const salvo = () => document.querySelector('[data-salvo]')?.textContent
const puts = (rede: FakeNetwork) => rede.chamadas.filter(({ metodo }) => metodo === 'PUT')
const saidas = (rede: FakeNetwork) => rede.chamadas.filter(({ caminho }) => caminho.endsWith('/saidas-da-aba'))

beforeEach(() => {
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: false, media: consulta, addEventListener: () => undefined, removeEventListener: () => undefined }))
  vi.stubGlobal('ResizeObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} })
  // O `jsdom` não tem o `dialog` modal (a confirmação do envio): é API do navegador, e não peça nossa.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

describe('a prova em foco: o relógio é o do servidor (RF6)', () => {
  it('o computador 10 min adiantado não tira 10 min do aluno: a faixa diz o que falta pelo `agora` do servidor, e não leva Tutor nem navegação', async () => {
    const id = idDaProva(1)
    montar2(id, emAndamento(id), tempoDo(30 * MIN, null, 10 * MIN))

    await screen.findByRole('radio', { name: /^A\./ })
    // Sem o desvio, o relógio diria 20 min.
    await waitFor(() => expect(relogio()).toBe('Faltam 30 min'))
    expect(within(faixa()).getByRole('button', { name: 'Sair da prova' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Tutor/ })).toBeNull()
    expect(document.querySelector('[role="status"] [data-relogio], [aria-live] [data-relogio]')).toBeNull()
  })

  it('o leitor de tela só é avisado a 10, 5 e 1 min: com 11 min a região não diz nada, com 10 min diz uma vez', async () => {
    const onze = idDaProva(2)
    montar2(onze, emAndamento(onze), tempoDo(11 * MIN - 30_000))
    await waitFor(() => expect(relogio()).toBe('Faltam 11 min'))
    expect(anuncio()).toBe('')
  })

  it('com 10 min, o aviso é um só e educado (região `polite`)', async () => {
    const dez = idDaProva(3)
    montar2(dez, emAndamento(dez), tempoDo(10 * MIN - 30_000))
    await waitFor(() => expect(anuncio()).toBe('Faltam 10 minutos.'))
    expect(document.querySelector('[data-anuncio-do-relogio]')?.getAttribute('role')).toBe('status')
  })
})

/** `montar` com a rede da prova, devolvendo a rede. */
function montar2(id: string, prova: FakeResponse, tempo: FakeResponse = tempoDo(30 * MIN)): { rede: FakeNetwork; localizacao: ReturnType<typeof montar> } {
  const rede = redeDaProva(id, prova, tempo)
  rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
  rede.responderPor(new RegExp(`/v1/atividades-aplicadas/${id}/respostas/\\d+$`), (caminho) => {
    const questaoDaResposta = Number(/respostas\/(\d+)$/.exec(caminho)?.[1])
    return { status: 200, corpo: { questao: questaoDaResposta, alternativa: 0, sequencia: 1, respondidaEm: new Date().toISOString() } }
  })
  return { rede, localizacao: montar(id) }
}

describe('a prova em foco: "Sair da prova" é um clique (D59)', () => {
  it('um clique leva às tarefas, sem confirmação, mesmo com 2 respostas ainda na fila, e diz de onde veio para o foco voltar; a fila segue depois de sair', async () => {
    const usuario = userEvent.setup()
    const id = idDaProva(4)
    const rede = redeDaProva(id, emAndamento(id))
    // O servidor não responde às respostas até o caso mandar: as duas escolhas ficam pendentes.
    const seguradas: (() => void)[] = []
    rede.responderPor(
      new RegExp(`/v1/atividades-aplicadas/${id}/respostas/\\d+$`),
      (caminho) =>
        new Promise<FakeResponse>((resolver) => {
          const questaoDaResposta = Number(/respostas\/(\d+)$/.exec(caminho)?.[1])
          seguradas.push(() => resolver({ status: 200, corpo: { questao: questaoDaResposta, alternativa: 1, sequencia: 1, respondidaEm: new Date().toISOString() } }))
        }),
    )
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    const localizacao = montarNaRota(id)

    await usuario.click(await screen.findByRole('radio', { name: /^B\./ }))
    await usuario.click(screen.getByRole('button', { name: /Próxima/ }))
    await usuario.click(await screen.findByRole('radio', { name: /^B\./ }))
    await waitFor(() => expect(respostasQueNaoChegaram(id)).toBe(2))
    await usuario.click(screen.getByRole('button', { name: 'Sair da prova' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(localizacao.history?.at(-1)).toBe('/atividades')
    // A tela de foco saiu, e a fila não: as duas seguem pendentes até o servidor confirmar, uma e depois a outra.
    expect(screen.queryByRole('radio')).toBeNull()
    expect(respostasQueNaoChegaram(id)).toBe(2)
    act(() => seguradas[0]?.())
    await waitFor(() => expect(respostasQueNaoChegaram(id)).toBe(1))
    await waitFor(() => expect(seguradas).toHaveLength(2))
    act(() => seguradas[1]?.())
    await waitFor(() => expect(respostasQueNaoChegaram(id)).toBe(0))
  })
})

describe('a prova em foco: a resposta que não chega não se perde (regra 80, item 6)', () => {
  it('a rede cai: "Sem conexão", três respostas guardadas; a rede volta e cada uma é gravada uma vez, com o mesmo relógio', async () => {
    const usuario = userEvent.setup()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const id = idDaProva(5)
    const rede = redeDaProva(id, emAndamento(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    let caiu = false
    rede.responderPor(new RegExp(`/v1/atividades-aplicadas/${id}/respostas/\\d+$`), (caminho): FakeResponse => {
      if (caiu) throw new TypeError('Failed to fetch')
      return { status: 200, corpo: { questao: Number(/respostas\/(\d+)$/.exec(caminho)?.[1]), alternativa: 1, sequencia: 1, respondidaEm: new Date().toISOString() } }
    })
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })
    await waitFor(() => expect(relogio()).toBe('Faltam 30 min'))

    caiu = true
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    act(() => void window.dispatchEvent(new Event('offline')))
    // O navegador sem rede já basta: o aviso vem antes de qualquer resposta falhar.
    expect(await screen.findByText(TEXTO_SEM_CONEXAO)).toBeTruthy()
    await usuario.click(screen.getByRole('radio', { name: /^B\./ }))
    await usuario.click(screen.getByRole('button', { name: /Próxima/ }))
    await usuario.click(await screen.findByRole('radio', { name: /^B\./ }))
    await usuario.click(screen.getByRole('button', { name: /Próxima/ }))
    await usuario.click(await screen.findByRole('radio', { name: /^B\./ }))

    expect((await screen.findByText(TEXTO_SEM_CONEXAO)).getAttribute('role')).toBe('status')
    expect(salvo()).toBe('Salvando…')
    // "Salvando…" é dito ao leitor de tela, com educação (`polite`).
    expect(document.querySelector('[data-salvo]')?.getAttribute('role')).toBe('status')
    // O relógio seguiu: a queda não o parou.
    expect(relogio()).toBe('Faltam 30 min')

    caiu = false
    // O que foi tentado enquanto a rede estava fora não conta: só as gravações da volta provam o "uma vez".
    const tentadasNaQueda = puts(rede).length
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
    // O evento `online` marca o sorteio da volta da rede (0,5 de 5 s = 2,5 s), e nenhum recuo do backoff vale isso.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const marcadas: number[] = []
    const marcar = globalThis.setTimeout
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((funcao: TimerHandler, ms?: number, ...resto: unknown[]) => {
      marcadas.push(ms ?? 0)
      return marcar(funcao, ms, ...resto)
    }) as typeof setTimeout)
    act(() => void window.dispatchEvent(new Event('online')))
    expect(marcadas).toContain(2_500)

    await waitFor(() => expect(salvo()).toBe('Salvo'), { timeout: 8_000 })
    expect(screen.queryByText(TEXTO_SEM_CONEXAO)).toBeNull()
    const gravadas = puts(rede)
      .slice(tentadasNaQueda)
      .map(({ caminho }) => /respostas\/(\d+)$/.exec(caminho)?.[1])
    for (const numero of ['1', '2', '3']) expect(gravadas.filter((item) => item === numero)).toHaveLength(1)
  }, 15_000)
})

describe('a prova em foco: o fim', () => {
  it('o tempo acabou: a questão sai, o aviso é `assertive` e leva o foco, e o caminho de volta é um link', async () => {
    const id = idDaProva(6)
    montar2(id, emAndamento(id), tempoDo(0, 'limite'))

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toContain(TEXTO_DO_FIM_DO_TEMPO)
    expect(document.activeElement).toBe(aviso)
    expect(aviso.textContent).not.toMatch(/não chegou|não chegaram/)
    expect(screen.queryByRole('radio')).toBeNull()
    expect(within(aviso).getByRole('link', { name: 'Voltar às tarefas' }).getAttribute('href')).toBe('/atividades')
  })

  it('a professora encerrou (o tempo diz "encerramento"): o texto é o do encerramento, e nenhum código aparece', async () => {
    const id = idDaProva(7)
    montar2(id, emAndamento(id, { estado: 'encerrada' }), tempoDo(10 * MIN, 'encerramento'))

    // Lido o tempo, o motivo do fim é o dele (antes, só a prova diz "encerrada"): o texto fica o do encerramento.
    await screen.findByRole('alert')
    await new Promise((resolver) => setTimeout(resolver, 200))
    const aviso = screen.getByRole('alert')
    expect(aviso.textContent).toContain(TEXTO_DO_FIM_ENCERRADA)
    expect(aviso.textContent).not.toMatch(/não chegou|não chegaram/)
    expect(document.body.textContent).not.toMatch(/ATIVIDADE_ENCERRADA|409/)
  })

  it('a professora encerra com uma resposta na fila: o servidor recusa o envio, a tela relê a prova e o fim diz "1 resposta não chegou. Chame o professor."', async () => {
    const usuario = userEvent.setup()
    const id = idDaProva(8)
    const rede = fakeNetwork()
    let encerrada = false
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, () => emAndamento(id, { estado: encerrada ? 'encerrada' : 'aberta' }))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/tempo`, tempoDo(30 * MIN))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    rede.responderPor(new RegExp(`/v1/atividades-aplicadas/${id}/respostas/\\d+$`), () => {
      encerrada = true
      return apiError(409, ErrorCode.ATIVIDADE_ENCERRADA)
    })
    montar(id)

    await usuario.click(await screen.findByRole('radio', { name: /^B\./ }))

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toContain(TEXTO_DO_FIM_ENCERRADA)
    expect(aviso.textContent).toContain(textoDasQueNaoChegaram(1))
    expect(document.body.textContent).not.toMatch(/ATIVIDADE_ENCERRADA|409/)
  })

  it('o tempo acabou depois de a prova ser encerrada (o tempo diz "limite"): o texto é o do tempo, e não o do encerramento', async () => {
    const id = idDaProva(9)
    montar2(id, emAndamento(id, { estado: 'encerrada' }), tempoDo(0, 'limite'))

    // Antes de o tempo ser lido, só a prova diz "encerrada"; lido o tempo, o motivo do fim é o dele.
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(TEXTO_DO_FIM_DO_TEMPO))
  })
})

describe('a prova em foco: a saída da aba (D70)', () => {
  it('sair da aba vai ao servidor com uma chave nova (uuid v4); a saída que o aluno repete depois de voltar é outra; parar a prova não conta mais', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const id = idDaProva(8)
    const rede = redeDaProva(id, emAndamento(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    const localizacao = montarNaRota(id)
    await screen.findByRole('radio', { name: /^A\./ })

    act(() => void window.dispatchEvent(new Event('blur')))
    await waitFor(() => expect(saidas(rede)).toHaveLength(1))
    // Mais um evento da mesma saída: não soma.
    act(() => void window.dispatchEvent(new Event('blur')))
    act(() => void window.dispatchEvent(new Event('focus')))
    act(() => void window.dispatchEvent(new Event('blur')))
    await waitFor(() => expect(saidas(rede)).toHaveLength(2))
    // A tela não conta nem mostra a soma.
    expect(document.body.textContent).not.toMatch(/saiu da aba|saídas/i)

    // "Sair da prova" para a vigia: a prova acabou para o aluno, e a aba que perde o foco depois disso não conta (D70: só durante a prova).
    fireEvent.click(screen.getByRole('button', { name: 'Sair da prova' }))
    expect(localizacao.history?.at(-1)).toBe('/atividades')
    expect(screen.queryByRole('radio')).toBeNull()
    act(() => void window.dispatchEvent(new Event('focus')))
    act(() => void window.dispatchEvent(new Event('blur')))
    await passar(5_000)
    expect(saidas(rede)).toHaveLength(2)
  })

  it('a saída que o servidor não recebeu sai na volta da rede (`online`), depois do sorteio, e não só no recuo comum de 1,5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const id = idDaProva(93)
    const rede = redeDaProva(id, emAndamento(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, apiError(503, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })

    act(() => void window.dispatchEvent(new Event('blur')))
    await waitFor(() => expect(saidas(rede)).toHaveLength(1))
    // O menor recuo do backoff, com o sorteio em 0, é de 1,1 s: antes disso, só o `online` explica uma segunda tentativa.
    await passar(500)
    expect(saidas(rede)).toHaveLength(1)
    act(() => void window.dispatchEvent(new Event('online')))

    await passar(500)
    expect(saidas(rede).length).toBeGreaterThanOrEqual(2)
  })

  it('com o fim já na tela o relógio não bate mais: nenhum intervalo de 1 s é criado', async () => {
    const batidas = vi.spyOn(globalThis, 'setInterval')
    const id = idDaProva(94)
    montar2(id, emAndamento(id, { estado: 'encerrada' }))

    expect((await screen.findByRole('alert')).textContent).toContain(TEXTO_DO_FIM_ENCERRADA)
    expect(batidas.mock.calls.filter(([, espera]) => espera === 1_000)).toHaveLength(0)
  })

  it('a prova que já acabou não conta saída nenhuma', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const id = idDaProva(9)
    const { rede } = montar2(id, emAndamento(id), tempoDo(0, 'aluno'))
    await screen.findByRole('alert')
    act(() => void window.dispatchEvent(new Event('blur')))
    // Nenhum relógio de verdade: o que a saída levaria (o envio na hora, o recuo, o sorteio da volta da rede) cabe nos 5 s que o relógio falso anda.
    await passar(5_000)
    expect(saidas(rede)).toHaveLength(0)
  })
})

describe('a prova em foco: a porta e o erro', () => {
  it('o endereço digitado sem a prova ter começado leva à atividade: o aviso do "Antes de começar" não se pula', async () => {
    const id = idDaProva(10)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, { status: 200, corpo: { comecou: false, atividadeAplicadaId: id, titulo: 'Prova sintética', janela: null, duracaoMin: 60 } })
    const localizacao = montar(id)

    await waitFor(() => expect(localizacao.history?.at(-1)).toBe(`/atividades/${id}`))
    expect(rede.chamadas.some(({ metodo }) => metodo === 'POST')).toBe(false)
  })

  it('a prova que não abre diz o que fazer, sem código, e "Tentar de novo" lê de novo', async () => {
    const usuario = userEvent.setup()
    const id = idDaProva(11)
    const rede = fakeNetwork()
    let tentativa = 0
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, () => (++tentativa === 1 ? apiError(400, ErrorCode.ENTRADA_INVALIDA) : emAndamento(id)))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/tempo`, tempoDo(30 * MIN))
    montar(id)

    expect((await screen.findByRole('alert')).textContent).toBe(TEXTO_DE_ERRO_AO_ABRIR_A_PROVA)
    expect(document.body.textContent).not.toMatch(/ENTRADA_INVALIDA|400/)
    // Mesmo com erro, o "Sair da prova" está na faixa.
    expect(screen.getByRole('button', { name: 'Sair da prova' })).toBeTruthy()
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findByRole('radio', { name: /^A\./ })
  })
})

describe('"Antes de começar" (RF7)', () => {
  const janela = (abreMin: number, fechaMin: number) => ({ abreEm: new Date(Date.now() + abreMin * MIN).toISOString(), fechaEm: new Date(Date.now() + fechaMin * MIN).toISOString() })
  const antes = (id: string, janelaDaProva: ReturnType<typeof janela> | null, duracaoMin: number | null = 60): FakeResponse => ({ status: 200, corpo: { comecou: false, atividadeAplicadaId: id, titulo: 'Prova sintética', janela: janelaDaProva, duracaoMin } })

  function montarAntes(id: string, resposta: FakeResponse) {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, resposta)
    const localizacao = memoryLocation({ path: `/atividades/${id}`, record: true })
    renderScreen(
      <Router hook={localizacao.hook}>
        <AbrirAtividade atividadeAplicadaId={id} />
      </Router>,
    )
    return { rede, localizacao }
  }

  it('diz a duração sem a palavra "adicional", o aviso da saída da aba e como sair; nenhuma questão aparece', async () => {
    const id = idDaProva(12)
    montarAntes(id, antes(id, janela(-5, 55)))

    await screen.findByRole('heading', { name: 'Antes de começar' })
    expect(screen.getByText('Esta prova tem 60 minutos, contados a partir de Começar.')).toBeTruthy()
    expect(screen.getByText('Se você sair desta aba, isso aparece para o professor. Nada acontece com a sua prova.')).toBeTruthy()
    expect(screen.getByText('Para sair, use Sair da prova. O tempo continua.')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/adicional/i)
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.getByText(/^Ela fecha às \d\d:\d\d\.$/)).toBeTruthy()
    // Nenhuma recusa nem erro antes de o aluno tocar em "Começar".
    expect(screen.queryByRole('alert')).toBeNull()
    // Janela aberta e sem recusa: nenhuma região de status vazia.
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('"Começar" cria a tentativa uma vez e leva à prova em foco, sem voltar ao "Antes de começar" pelo "Voltar"', async () => {
    const usuario = userEvent.setup()
    const id = idDaProva(13)
    const { rede, localizacao } = montarAntes(id, antes(id, janela(-5, 55)))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/comecar`, emAndamento(id))

    await usuario.click(await screen.findByRole('button', { name: 'Começar' }))

    await waitFor(() => expect(localizacao.history?.at(-1)).toBe(`/prova/${id}`))
    expect(rede.chamadas.filter(({ metodo }) => metodo === 'POST')).toHaveLength(1)
    // `replace`: a entrada de "Antes de começar" sai do histórico, e o "Voltar" do navegador não a reabre.
    expect(localizacao.history).toEqual([`/prova/${id}`])
  })

  it('antes de abrir, diz quando abre e não oferece "Começar"; depois de fechar, diz que fechou', async () => {
    const aindaNao = idDaProva(14)
    montarAntes(aindaNao, antes(aindaNao, janela(30, 90)))
    expect((await screen.findByText(/^Esta prova abre em \d\d\/\d\d às \d\d:\d\d$/)).getAttribute('role')).toBe('status')
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull()
  })

  it('depois de fechar: "Esta prova fechou às HH:MM" e nada de "Começar"', async () => {
    const fechou = idDaProva(15)
    montarAntes(fechou, antes(fechou, janela(-90, -30)))
    await screen.findByText(/^Esta prova fechou às \d\d:\d\d$/)
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull()
    expect(screen.queryByText(/^Ela fecha às/)).toBeNull()
  })

  it('a janela que o servidor recusa vale mais que o relógio do computador: o botão some com a mensagem dela', async () => {
    const usuario = userEvent.setup()
    const id = idDaProva(16)
    const { rede } = montarAntes(id, antes(id, janela(-1, 59)))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/comecar`, apiError(409, ErrorCode.PROVA_FORA_DA_JANELA))

    await usuario.click(await screen.findByRole('button', { name: 'Começar' }))

    await screen.findByText('Esta prova não está aberta agora.')
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull()
  })

  it('a prova já em andamento (voltou depois do "Sair da prova") vai direto para a tela de foco; a sem janela é a atividade de hoje', async () => {
    const id = idDaProva(17)
    const { localizacao } = montarAntes(id, emAndamento(id))
    await waitFor(() => expect(localizacao.history?.at(-1)).toBe(`/prova/${id}`))
  })
})

describe('a porta da atividade e o "Começar" (RF7)', () => {
  const janela = (abreMin: number, fechaMin: number) => ({ abreEm: new Date(Date.now() + abreMin * MIN).toISOString(), fechaEm: new Date(Date.now() + fechaMin * MIN).toISOString() })
  const antes = (id: string, duracaoMin: number | null = 60, janelaDaProva: ReturnType<typeof janela> | null = janela(-5, 55)): FakeResponse => ({
    status: 200,
    corpo: { comecou: false, atividadeAplicadaId: id, titulo: 'Prova sintética', janela: janelaDaProva, duracaoMin },
  })
  const comTempo = (id: string, extra: Record<string, unknown>, tempo: Record<string, unknown> = {}): FakeResponse => {
    const base = emAndamento(id).corpo as { tempo: Record<string, unknown> }
    return { status: 200, corpo: { ...base, ...extra, tempo: { ...base.tempo, ...tempo } } }
  }

  function montarPorta(id: string, resposta: FakeResponse | (() => FakeResponse | Promise<FakeResponse>)) {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, resposta)
    rede.responderPor(`/v1/atividades-aplicadas/${id}/comecar`, emAndamento(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/tempo`, tempoDo(30 * MIN))
    const localizacao = memoryLocation({ path: `/atividades/${id}`, record: true })
    renderScreen(
      <Router hook={localizacao.hook}>
        <AbrirAtividade atividadeAplicadaId={id} />
      </Router>,
    )
    return { rede, localizacao }
  }
  const comecares = (rede: FakeNetwork) => rede.chamadas.filter(({ caminho, metodo }) => metodo === 'POST' && caminho.endsWith('/comecar'))

  it('carregando: "Carregando a atividade…", sem alerta e sem "Começar"', async () => {
    const id = idDaProva(60)
    montarPorta(id, () => new Promise<FakeResponse>(() => undefined))

    expect(await screen.findByText('Carregando a atividade…')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull()
  })

  it('a atividade que a API diz não existir diz que não está disponível, sem "Tentar de novo"', async () => {
    const id = idDaProva(61)
    montarPorta(id, apiError(404, ErrorCode.NAO_ENCONTRADO))

    expect(await screen.findByText('Esta atividade não está disponível')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('o erro ao abrir diz o texto de sempre da atividade, sem código, e "Tentar de novo" lê de novo', async () => {
    const usuario = userEvent.setup()
    const id = idDaProva(62)
    let tentativa = 0
    const { rede } = montarPorta(id, () => (++tentativa === 1 ? apiError(400, ErrorCode.ENTRADA_INVALIDA) : antes(id)))

    expect((await screen.findByRole('alert')).textContent).toBe(errorMessage(new ApiError(ErrorCode.ENTRADA_INVALIDA)))
    expect(document.body.textContent).not.toMatch(/ENTRADA_INVALIDA|400/)
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { name: 'Antes de começar' })).toBeTruthy()
    expect(rede.chamadas.filter(({ caminho }) => caminho.endsWith('/prova')).length).toBeGreaterThanOrEqual(2)
  }, 15_000)

  it('a prova sem duração não diz "Esta prova tem…", e a sem janela é a atividade de hoje: nada de "Antes de começar"', async () => {
    const semDuracao = idDaProva(63)
    montarPorta(semDuracao, antes(semDuracao, null))
    await screen.findByRole('heading', { name: 'Antes de começar' })
    expect(screen.queryByText(/^Esta prova tem/)).toBeNull()
    cleanup()

    const semJanela = idDaProva(64)
    const { rede } = montarPorta(semJanela, antes(semJanela, null, null))
    await waitFor(() => expect(comecares(rede)).toHaveLength(1))
    expect(screen.queryByRole('heading', { name: 'Antes de começar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull()
  })

  it('só a prova em andamento, com limite, ainda aberta e não enviada vai para a tela de foco; sem limite, enviada ou encerrada é a atividade de hoje', async () => {
    const casos: [number, FakeResponse][] = [
      [65, emAndamento(idDaProva(65))],
      [66, comTempo(idDaProva(66), {}, { limiteEm: null })],
      [67, comTempo(idDaProva(67), { enviadaEm: new Date().toISOString() })],
      [68, comTempo(idDaProva(68), { estado: 'encerrada' })],
    ]
    const destinos: string[] = []
    for (const [n, resposta] of casos) {
      const id = idDaProva(n)
      const { localizacao } = montarPorta(id, resposta)
      await new Promise((resolver) => setTimeout(resolver, 250))
      destinos.push(localizacao.history?.at(-1) === `/prova/${id}` ? 'foco' : 'atividade')
      cleanup()
    }
    expect(destinos).toEqual(['foco', 'atividade', 'atividade', 'atividade'])
  })

  it('"Começar" mostra "Abrindo…", desligado, e um segundo toque não cria outra tentativa; a resposta sem `comecou` não navega', async () => {
    const usuario = userEvent.setup()
    const id = idDaProva(69)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, antes(id))
    let liberar: (resposta: FakeResponse) => void = () => undefined
    rede.responderPor(`/v1/atividades-aplicadas/${id}/comecar`, () => new Promise<FakeResponse>((resolver) => (liberar = resolver)))
    const localizacao = memoryLocation({ path: `/atividades/${id}`, record: true })
    renderScreen(
      <Router hook={localizacao.hook}>
        <AbrirAtividade atividadeAplicadaId={id} />
      </Router>,
    )

    await usuario.click(await screen.findByRole('button', { name: 'Começar' }))
    const abrindo = await screen.findByRole('button', { name: 'Abrindo…' })
    expect((abrindo as HTMLButtonElement).disabled).toBe(true)
    await usuario.click(abrindo)
    expect(comecares(rede)).toHaveLength(1)

    // O servidor responde que a prova ainda não começou: a tela não vai a prova nenhuma.
    liberar(antes(id))
    await screen.findByRole('button', { name: 'Começar' })
    expect(localizacao.history?.at(-1)).toBe(`/atividades/${id}`)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('"Começar" que falha diz para tentar de novo, sem código, e o botão fica; a prova encerrada pela professora diz isso e some com o botão', async () => {
    const usuario = userEvent.setup()
    const id = idDaProva(70)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, antes(id))
    let resposta = apiError(400, ErrorCode.ENTRADA_INVALIDA)
    rede.responderPor(`/v1/atividades-aplicadas/${id}/comecar`, () => resposta)
    renderScreen(
      <Router hook={memoryLocation({ path: `/atividades/${id}`, record: true }).hook}>
        <AbrirAtividade atividadeAplicadaId={id} />
      </Router>,
    )

    await usuario.click(await screen.findByRole('button', { name: 'Começar' }))
    expect((await screen.findByRole('alert')).textContent).toBe(TEXTO_DE_ERRO_AO_ABRIR_A_PROVA)
    expect(document.body.textContent).not.toMatch(/ENTRADA_INVALIDA|400/)
    expect(screen.getByRole('button', { name: 'Começar' })).toBeTruthy()

    resposta = apiError(409, ErrorCode.ATIVIDADE_ENCERRADA)
    await usuario.click(screen.getByRole('button', { name: 'Começar' }))
    expect(await screen.findByText('Quem dá a aula encerrou esta prova.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull()
  })
})

describe('a prova em foco: 503, limite e extensão (regra 80, item 6)', () => {
  const respostasDa = (id: string) => new RegExp(`/v1/atividades-aplicadas/${id}/respostas/\\d+$`)
  const salva = (questao: number): FakeResponse => ({ status: 200, corpo: { questao, alternativa: 1, sequencia: 1, respondidaEm: new Date().toISOString() } })

  it('o 503 do servidor não perde a escolha: ela fica marcada, "Salvando…", e quando o servidor volta é gravada uma vez só', async () => {
    const usuario = userEvent.setup()
    // O recuo sorteado fica no menor: 2 s menos o jitter.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const id = idDaProva(30)
    const rede = redeDaProva(id, emAndamento(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    let tentativa = 0
    rede.responderPor(respostasDa(id), () => (++tentativa === 1 ? apiError(503, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO) : salva(1)))
    montar(id)

    await usuario.click(await screen.findByRole('radio', { name: /^B\./ }))
    await waitFor(() => expect(salvo()).toBe('Salvando…'))
    expect((screen.getByRole('radio', { name: /^B\./ }) as HTMLInputElement).checked).toBe(true)
    // A falha passageira do servidor também diz que as respostas ficam guardadas, ainda que a rede do navegador esteja de pé.
    expect(await screen.findByText(TEXTO_SEM_CONEXAO)).toBeTruthy()
    await waitFor(() => expect(salvo()).toBe('Salvo'), { timeout: 6_000 })
    expect(puts(rede)).toHaveLength(2)
    expect(document.body.textContent).not.toMatch(/503|INDISPONIVEL/)
  })

  it('"Enviar a prova" com 503: as respostas ficam guardadas e o texto diz isso, sem código; a prova continua na tela', async () => {
    const usuario = userEvent.setup()
    const id = idDaProva(31)
    const rede = redeDaProva(id, emAndamento(id, { respostas: [{ questao: 1, alternativa: 0, sequencia: 1 }] }))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    rede.responderPor(`/v1/atividades-aplicadas/${id}/enviar`, apiError(503, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))
    montar(id)

    await usuario.click(await screen.findByRole('button', { name: 'Enviar a prova' }))
    const dialogo = await screen.findByRole('alertdialog')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar a prova' }))

    expect(await screen.findByText(TEXTO_DO_ENVIO_QUE_NAO_SAIU)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/503|INDISPONIVEL/)
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(0)
  })

  it('o relógio chega ao limite e a releitura do tempo falha: o último limite vale, e o fim aparece só depois da releitura terminada', async () => {
    const id = idDaProva(32)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, emAndamento(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    let leituras = 0
    // A primeira leitura vem com 1,2 s; as seguintes falham, e a prova não acaba por causa da falha antes de a releitura terminar.
    rede.responderPor(`/v1/atividades-aplicadas/${id}/tempo`, () => (++leituras === 1 ? tempoDo(1_200) : apiError(400, ErrorCode.ENTRADA_INVALIDA)))
    montar(id)

    await screen.findByRole('radio', { name: /^A\./ })
    expect((await screen.findByRole('alert', {}, { timeout: 6_000 })).textContent).toContain(TEXTO_DO_FIM_DO_TEMPO)
    expect(screen.queryByRole('radio')).toBeNull()
    expect(leituras).toBeGreaterThanOrEqual(2)
  })

  it('a extensão chega depois de o servidor recusar por tempo: a releitura traz o limite novo, o fim não aparece e a fila reenvia na hora, sem esperar o recuo', async () => {
    // Relógio falso: o limite vence a 1 s, e o recuo sorteado fica no maior (2,5 s). Só a releitura do limite novo explica a gravação antes disso.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(Math, 'random').mockReturnValue(1)
    const id = idDaProva(33)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, emAndamento(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    let leituras = 0
    rede.responderPor(`/v1/atividades-aplicadas/${id}/tempo`, () => (++leituras === 1 ? tempoDo(1_000) : tempoDo(30 * MIN)))
    let estendida = false
    rede.responderPor(respostasDa(id), () => (estendida ? salva(1) : apiError(503, ErrorCode.TEMPO_ESGOTADO)))
    montar(id)

    fireEvent.click(await screen.findByRole('radio', { name: /^B\./ }))
    await waitFor(() => expect(puts(rede)).toHaveLength(1))
    estendida = true
    // Antes de o relógio alcançar o limite nada sai: o recuo é de 2,5 s, e a releitura só vem com o limite vencido.
    await passar(500)
    expect(puts(rede)).toHaveLength(1)
    expect(salvo()).toBe('Salvando…')
    // O limite vence (1 s), a releitura traz o limite novo, e a fila reenvia na hora: bem antes dos 2,5 s do recuo.
    await passar(700)
    await waitFor(() => expect(salvo()).toBe('Salvo'))
    expect(puts(rede)).toHaveLength(2)
    // O fim nunca apareceu: a prova segue, com o relógio do limite novo.
    expect(screen.queryByRole('alert')).toBeNull()
    expect(relogio()).toMatch(/^Faltam \d+ min$/)
    expect(leituras).toBeGreaterThanOrEqual(2)
  })

  it('acabou o tempo com 2 respostas que não chegaram: o fim diz "2 respostas não chegaram. Chame o professor." e a fila segue com elas', async () => {
    const usuario = userEvent.setup()
    const id = idDaProva(34)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, emAndamento(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    // O limite vem com 2,5 s, e a releitura de quando o relógio o alcança diz que a prova acabou.
    let leituras = 0
    rede.responderPor(`/v1/atividades-aplicadas/${id}/tempo`, () => (++leituras === 1 ? tempoDo(2_500) : tempoDo(0, 'limite')))
    rede.responderPor(respostasDa(id), () => Promise.reject(new TypeError('Failed to fetch')))
    montar(id)

    await usuario.click(await screen.findByRole('radio', { name: /^B\./ }))
    await usuario.click(screen.getByRole('button', { name: /Próxima/ }))
    await usuario.click(await screen.findByRole('radio', { name: /^C\./ }))
    const aviso = await screen.findByRole('alert', {}, { timeout: 6_000 })
    expect(aviso.textContent).toContain(TEXTO_DO_FIM_DO_TEMPO)
    expect(aviso.textContent).toContain(textoDasQueNaoChegaram(2))
    // Acabada, a prova não diz mais "Sem conexão": quem fala é o fim, com o número das que não chegaram.
    expect(screen.queryByText(TEXTO_SEM_CONEXAO)).toBeNull()
    expect(document.activeElement).toBe(aviso)
  })
})

describe('a prova em foco: o que é da prova e não da atividade', () => {
  it('"Enviar a prova", sem aviso de Tutor nem link de ajuda, o ponto de parada da prova, e a marca de resposta fora da região de status da questão', async () => {
    const id = idDaProva(80)
    montar2(id, emAndamento(id))

    await screen.findByRole('radio', { name: /^A\./ })
    expect(screen.getByRole('button', { name: 'Enviar a prova' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Enviar a atividade' })).toBeNull()
    expect(screen.getByText('Para sair, use Sair da prova. O tempo continua.')).toBeTruthy()
    expect(screen.queryByText(/Pode parar quando quiser/)).toBeNull()
    expect(screen.queryByText(AVISO_DA_AVALIACAO)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Pedir ajuda ao Tutor nesta questão' })).toBeNull()
    // "Salvando…" e "Salvo" são ditos uma vez só, pela faixa: a questão não tem região de status própria.
    expect(document.querySelector('[data-resposta]')?.getAttribute('role')).toBeNull()
    expect(screen.getAllByRole('status').map((regiao) => regiao.hasAttribute('data-resposta'))).not.toContain(true)
  })

  it('mesmo que a prova viesse como não avaliativa, a tela de foco não oferece o caminho até o Tutor', async () => {
    const id = idDaProva(82)
    const base = emAndamento(id).corpo as Record<string, unknown>
    montar2(id, { status: 200, corpo: { ...base, avaliativa: false } })

    await screen.findByRole('radio', { name: /^A\./ })
    expect(screen.queryByRole('link', { name: 'Pedir ajuda ao Tutor nesta questão' })).toBeNull()
  })

  it('ao entrar, o foco vai ao enunciado da primeira questão; a confirmação do envio diz "Prova" e "Enviar a prova"', async () => {
    const usuario = userEvent.setup()
    const id = idDaProva(81)
    montar2(id, emAndamento(id))

    const enunciado = await screen.findByRole('heading', { level: 2, name: /^Questão 1:/ })
    await waitFor(() => expect(document.activeElement).toBe(enunciado))

    await usuario.click(screen.getByRole('button', { name: 'Enviar a prova' }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(within(dialogo).getByText('Enviar a prova?')).toBeTruthy()
    expect(within(dialogo).getByText('Prova')).toBeTruthy()
    expect(within(dialogo).getByText('Prova sintética')).toBeTruthy()
    expect(within(dialogo).getByRole('button', { name: 'Enviar a prova' })).toBeTruthy()
    expect(within(dialogo).queryByText('Atividade')).toBeNull()
  })
})

describe('a prova em foco: carregando, não encontrada, sem limite e o que diz o fim', () => {
  it('carregando: "Abrindo a prova…", sem alerta e sem questão; o "Sair da prova" já está na faixa', async () => {
    const id = idDaProva(40)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, () => new Promise<FakeResponse>(() => undefined))
    montar(id)

    expect(await screen.findByText('Abrindo a prova…')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.getByRole('button', { name: 'Sair da prova' })).toBeTruthy()
  })

  it('a prova que a API diz não existir (outra turma, endereço errado) diz que não está disponível, sem "Tentar de novo" nem código', async () => {
    const id = idDaProva(41)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, apiError(404, ErrorCode.NAO_ENCONTRADO))
    montar(id)

    expect(await screen.findByText('Esta prova não está disponível')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.body.textContent).not.toMatch(/NAO_ENCONTRADO|404/)
  })

  it('a prova sem limite (o servidor não deu um) não acaba sozinha: o relógio fica vazio, as questões ficam e nenhum aviso aparece', async () => {
    const id = idDaProva(42)
    redeDaProva(id, emAndamento(id), { status: 200, corpo: { limiteEm: null, agora: new Date().toISOString(), envio: null } })
    montar(id)

    await screen.findByRole('radio', { name: /^A\./ })
    await new Promise((resolver) => setTimeout(resolver, 1_300))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(relogio()).toBe('')
  })

  it('o aluno envia a prova: o fim diz "Prova enviada…" e leva o foco, mesmo com a leitura do tempo ainda sem o envio', async () => {
    const usuario = userEvent.setup()
    const id = idDaProva(43)
    const rede = redeDaProva(id, emAndamento(id, { respostas: [{ questao: 1, alternativa: 0, sequencia: 1 }] }))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/enviar`, { status: 200, corpo: { enviadaEm: new Date().toISOString(), respondidas: 1, questoes: 3 } })
    montar(id)

    await usuario.click(await screen.findByRole('button', { name: 'Enviar a prova' }))
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Enviar a prova' }))

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toContain(TEXTO_DO_FIM_ENVIADA)
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('o servidor diz que o aluno já enviou (outra janela, o "Enviar" que a rede perdeu): o fim é o do envio, e não o do tempo', async () => {
    const id = idDaProva(44)
    montar2(id, emAndamento(id), tempoDo(30 * MIN, 'aluno'))

    expect((await screen.findByRole('alert')).textContent).toContain(TEXTO_DO_FIM_ENVIADA)
  })

  it('a prova que já vem enviada, mesmo sem o envio no tempo lido, é "Prova enviada…"; e a encerrada sem envio é a do encerramento', async () => {
    const enviada = idDaProva(45)
    montar2(enviada, emAndamento(enviada, { enviadaEm: new Date().toISOString() }), tempoDo(30 * MIN))
    expect((await screen.findByRole('alert')).textContent).toContain(TEXTO_DO_FIM_ENVIADA)
    cleanup()

    const encerrada = idDaProva(46)
    montar2(encerrada, emAndamento(encerrada, { estado: 'encerrada' }), tempoDo(30 * MIN))
    expect((await screen.findByRole('alert')).textContent).toContain(TEXTO_DO_FIM_ENCERRADA)
  })
})

describe('a prova em foco: o tempo ainda não lido, o aviso depois do fim e a encerrada que também venceu', () => {
  it('enquanto o tempo não foi lido a prova segue: nenhum fim, o relógio diz "Lendo o tempo…" e as questões ficam', async () => {
    const id = idDaProva(90)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, emAndamento(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/tempo`, () => new Promise<FakeResponse>(() => undefined))
    montar(id)

    await screen.findByRole('radio', { name: /^A\./ })
    await new Promise((resolver) => setTimeout(resolver, 300))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(relogio()).toBe('Lendo o tempo…')
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(0)
  })

  it('a prova que o servidor diz já enviada não anuncia o tempo que sobra: o fim fala, e a região do relógio fica quieta', async () => {
    const id = idDaProva(91)
    montar2(id, emAndamento(id), tempoDo(9 * MIN - 30_000, 'aluno'))

    expect((await screen.findByRole('alert')).textContent).toContain(TEXTO_DO_FIM_ENVIADA)
    await new Promise((resolver) => setTimeout(resolver, 1_300))
    expect(document.querySelector('[data-anuncio-do-relogio]')).not.toBeNull()
    expect(anuncio()).toBe('')
  })
})

describe('a prova em foco: o tempo é relido a cada 30 s enquanto importa', () => {
  const leituras = (rede: FakeNetwork) => rede.chamadas.filter(({ caminho }) => caminho.endsWith('/tempo')).length

  it('em andamento: aos 29 s nenhuma leitura nova, aos 30 s uma', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const id = idDaProva(50)
    const { rede } = montar2(id, emAndamento(id), tempoDo(30 * MIN))
    await screen.findByRole('radio', { name: /^A\./ })
    expect(leituras(rede)).toBe(1)

    await passar(29_000)
    expect(leituras(rede)).toBe(1)
    await passar(1_500)
    await waitFor(() => expect(leituras(rede)).toBe(2))
  })

  it('acabada e com a fila vazia, não relê mais: o que ela diz já não muda', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const id = idDaProva(51)
    const { rede } = montar2(id, emAndamento(id), tempoDo(30 * MIN, 'aluno'))
    await screen.findByRole('alert')

    await passar(95_000)
    expect(leituras(rede)).toBe(1)
  })

  it('acabada, mas com resposta ainda na fila, segue relendo: a extensão do professor pode chegar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const id = idDaProva(52)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, emAndamento(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    let lidas = 0
    // A primeira leitura diz que a prova segue; a seguinte, que o tempo acabou.
    rede.responderPor(`/v1/atividades-aplicadas/${id}/tempo`, () => (++lidas === 1 ? tempoDo(30 * MIN) : tempoDo(0, 'limite')))
    rede.responderPor(new RegExp(`/v1/atividades-aplicadas/${id}/respostas/\\d+$`), () => Promise.reject(new TypeError('Failed to fetch')))
    montar(id)

    fireEvent.click(await screen.findByRole('radio', { name: /^B\./ }))
    await passar(30_500)
    await screen.findByRole('alert')
    const noFim = leituras(rede)

    await passar(30_000)
    await waitFor(() => expect(leituras(rede)).toBeGreaterThan(noFim))
  })
})

describe('o recomeço: a sessão que acaba leva a fila junto (regra 20, itens 4 e 5; regra 80, item 6)', () => {
  it('a resposta que não chegou da primeira pessoa não sai com a sessão da segunda, e nada dela aparece marcado na tela da segunda', async () => {
    const usuario = userEvent.setup()
    // O sorteio da volta da rede dá 0: se a fila da primeira ainda existisse, ela sairia na hora, e o teste a veria.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const id = idDaProva(20)
    // A primeira pessoa marca uma alternativa, e o servidor não responde: a escolha fica na fila da aba.
    const rede = redeDaProva(id, emAndamento(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    rede.responderPor(new RegExp(`/v1/atividades-aplicadas/${id}/respostas/\\d+$`), () => Promise.reject(new TypeError('Failed to fetch')))
    rede.responderPor(/\/v1\/sessao\/sair/, { status: 204 })
    montar(id)
    await usuario.click(await screen.findByRole('radio', { name: /^C\./ }))
    await waitFor(() => expect(salvo()).toBe('Salvando…'))
    cleanup()

    // Ela sai, e a segunda entra na mesma aba (o Chromebook do carrinho).
    await sair()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token: 'token-da-segunda', expiraEm: new Date(Date.now() + 600_000).toISOString() }), { status: 200 })),
    )
    await openSessaoPeloCookie()
    const redeDaSegunda = redeDaProva(id, emAndamento(id))
    redeDaSegunda.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    redeDaSegunda.responderPor(new RegExp(`/v1/atividades-aplicadas/${id}/respostas/\\d+$`), { status: 200, corpo: { questao: 1, alternativa: 2, sequencia: 1, respondidaEm: new Date().toISOString() } })
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })
    act(() => void window.dispatchEvent(new Event('online')))
    await new Promise((resolver) => setTimeout(resolver, 300))

    // A fila da primeira ficou para trás: nada foi mandado com o token da segunda, e nenhuma alternativa aparece marcada.
    expect(puts(redeDaSegunda)).toHaveLength(0)
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
    expect(salvo()).toBe('')
  })

  it('a saída da aba que não chegou da primeira pessoa não sai com a sessão da segunda: nem na volta da rede, nem no recuo (D70, regra 20)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const id = idDaProva(21)
    // A primeira pessoa sai da aba, e o servidor não recebe: a saída fica na fila da aba, esperando o recuo.
    const rede = redeDaProva(id, emAndamento(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, () => Promise.reject(new TypeError('Failed to fetch')))
    rede.responderPor(/\/v1\/sessao\/sair/, { status: 204 })
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })
    act(() => void window.dispatchEvent(new Event('blur')))
    await waitFor(() => expect(saidas(rede)).toHaveLength(1))
    cleanup()

    // Ela sai, e a segunda entra na mesma aba (o Chromebook do carrinho). A rede da segunda já existe quando a sessão dela abre: tudo o que sair daqui em diante, até a abertura, fica registrado nela.
    await sair()
    const redeDaSegunda = redeDaProva(id, emAndamento(id))
    redeDaSegunda.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    redeDaSegunda.responderPor(/\/v1\/sessao\/renovar$/, { status: 200, corpo: { token: 'token-da-segunda', expiraEm: new Date(Date.now() + 600_000).toISOString() } })
    await openSessaoPeloCookie()
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })
    // A rede volta, e o recuo e o sorteio passam: a saída da primeira não sai, nem pela volta da rede nem pelo relógio dela.
    act(() => void window.dispatchEvent(new Event('online')))
    await passar(10_000)
    expect(saidas(redeDaSegunda)).toHaveLength(0)

    // A fila da segunda é dela: a saída que ela faz depois chega, uma vez só, com a sessão dela (não fica atrás da fila da primeira, nem cai numa fila parada).
    act(() => void window.dispatchEvent(new Event('blur')))
    await waitFor(() => expect(saidas(redeDaSegunda)).toHaveLength(1))
    await passar(10_000)
    expect(saidas(redeDaSegunda)).toHaveLength(1)
    expect(saidas(redeDaSegunda)[0]?.autorizacao).toContain('token-da-segunda')
  })

  it('a sessão que volta manda a saída da aba que ficou esperando na hora, sem esperar o recuo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(Math, 'random').mockReturnValue(1)
    const id = idDaProva(22)
    const rede = redeDaProva(id, emAndamento(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/saidas-da-aba`, { status: 204 })
    rede.responderPor(/\/v1\/sessao$/, { status: 204 })
    rede.responderPor(/\/v1\/sessao\/renovar$/, { status: 200, corpo: { token: 'token-da-volta', expiraEm: new Date(Date.now() + 600_000).toISOString() } })
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })

    // A sessão vence com a tela montada (a prova segue na frente do aluno), e a aba sai do foco: sem sessão a saída nem chega à rede, e fica esperando o recuo (de 2,5 s).
    await act(async () => {
      await encerrarPorInatividade()
    })
    act(() => void window.dispatchEvent(new Event('blur')))
    await passar(100)
    expect(saidas(rede)).toHaveLength(0)

    // A sessão volta (pelo cookie): a saída sai agora, sem esperar o recuo, e com o token novo.
    await act(async () => {
      await openSessaoPeloCookie()
    })
    await waitFor(() => expect(saidas(rede)).toHaveLength(1))
    expect(saidas(rede)[0]?.autorizacao).toContain('token-da-volta')
  })
})
