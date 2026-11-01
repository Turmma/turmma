// @vitest-environment jsdom
import { ErrorCode, MENSAGENS_DE_ERRO, type MeuDiagnosticoResponse } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { classesOf } from '../../__fixtures__/class-colors'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../__fixtures__/render-screen'
import { createQueryClient } from '../../api/query-client'
import { euQueryOptions } from '../../api/eu'
import { AVISO_DE_OUTRA_JANELA, FALA_DA_ENTREGA, ROTULO_DE_VOLTAR_AS_TAREFAS } from './atividade'
import Atividade from './Atividade'

/**
 * A atividade do aluno na tela (51.0, RF21): a escolha que perdeu para uma mais nova de outra janela não é reenviada, a
 * alternativa que fica marcada é a gravada, e o aviso "Sua resposta foi alterada em outra janela" aparece em lugar fixo,
 * numa região `role="status"`. A rede é falsa; a fila de respostas, o cliente de consultas e a tela são os de verdade.
 * O tamanho e o toque nas duas larguras, e o fluxo inteiro, são do e2e (`e2e/aluno-atividade.spec.ts`).
 *
 * A fila de respostas é uma por atividade e vive no módulo, como na aba: cada caso usa uma atividade (id) própria.
 *
 * A moldura, os quatro estados e a comemoração do envio são da tarefa 6.0 da X4 (RF7, RF8, RF20), no fim do arquivo. O
 * `jsdom` não tem `ResizeObserver` (a barra presa mede a si mesma) nem o `dialog` modal (o diálogo "Enviar a atividade?"):
 * o teste os põe, e são API do navegador, e não peça nossa.
 */
setupScreen()

/** O `jsdom` não tem `matchMedia`: a janela que o caso diz que tem (o Chromebook, 1366 px, por padrão) responde às consultas `min-width`. */
function janelaDe(largura: number): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: Number(/min-width:\s*(\d+)px/.exec(consulta)?.[1] ?? Number.POSITIVE_INFINITY) <= largura,
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

beforeEach(() => {
  janelaDe(1366)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

const idDaAtividade = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`

const ALTERNATIVAS = ['Quatro', 'Cinco', 'Seis', 'Sete']
const questao = (numero: number) => ({ numero, enunciado: `Enunciado sintético da questão ${String(numero)}`, alternativas: ALTERNATIVAS })

function prova(atividadeAplicadaId: string, respostas: readonly { questao: number; alternativa: number; sequencia: number }[] = [], campos: Record<string, unknown> = {}): FakeResponse {
  return {
    status: 200,
    corpo: { atividadeAplicadaId, titulo: 'Lista sintética', avaliativa: false, estado: 'aberta', adaptacao: null, questoes: [questao(1), questao(2), questao(3)], respostas, enviadaEm: null, ...campos },
  }
}

const gravada = (alternativa: number, sequencia: number): FakeResponse => ({ status: 200, corpo: { questao: 1, alternativa, sequencia, respondidaEm: '2026-10-22T13:10:00.000Z' } })

function montar(atividadeAplicadaId: string) {
  const localizacao = memoryLocation({ path: `/aluno/atividades/${atividadeAplicadaId}` })
  return renderScreen(
    <Router hook={localizacao.hook}>
      <Atividade atividadeAplicadaId={atividadeAplicadaId} />
    </Router>,
  )
}

/** Os corpos dos `PUT` da resposta, na ordem em que a fila os mandou. */
const envios = (rede: FakeNetwork) =>
  rede.chamadas.flatMap((chamada, indice) => {
    if (chamada.metodo !== 'PUT') return []
    const opcoes = vi.mocked(fetch).mock.calls[indice]?.[1]
    return [JSON.parse(String(opcoes?.body)) as { alternativa: number; sequencia: number }]
  })

/** A região de status da questão: a que diz "Resposta salva", e onde o aviso da outra janela tem de estar. */
const regiaoDeStatus = () => screen.getByRole('status')
const marcada = () => screen.getAllByRole('radio').findIndex((radio) => (radio as HTMLInputElement).checked)

describe('a atividade na tela: a escolha mais nova vale (51.0, RF21)', () => {
  it('a aba que perde adota a alternativa gravada, não reenvia, e avisa dentro da região de status', async () => {
    const usuario = userEvent.setup()
    const id = idDaAtividade(1)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id))
    // O servidor já tinha, de outra janela, a alternativa C com a sequência 8: a escolha desta janela perde.
    rede.responderPor(`/v1/atividades-aplicadas/${id}/respostas/1`, gravada(2, 8))
    montar(id)

    await usuario.click(await screen.findByRole('radio', { name: /^B\./ }))
    await within(regiaoDeStatus()).findByText('Sua resposta foi alterada em outra janela')

    // A que ficou marcada é a do servidor (C), e a escolha daqui (B) foi embora; nada foi reenviado.
    expect(marcada()).toBe(2)
    expect(envios(rede)).toEqual([{ alternativa: 1, sequencia: 1 }])
    // O aviso está na região de status, junto do estado da resposta, e só uma vez.
    expect(screen.getAllByText(AVISO_DE_OUTRA_JANELA)).toHaveLength(1)
    expect(regiaoDeStatus().textContent).toContain('Resposta salva')
  })

  it('o clique seguinte da aba que perdeu sai com servidor + 1, vence, e o aviso some', async () => {
    const usuario = userEvent.setup()
    const id = idDaAtividade(2)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id))
    let chamada = 0
    rede.responderPor(`/v1/atividades-aplicadas/${id}/respostas/1`, () => (++chamada === 1 ? gravada(2, 8) : gravada(0, 9)))
    montar(id)

    await usuario.click(await screen.findByRole('radio', { name: /^B\./ }))
    await within(regiaoDeStatus()).findByText(AVISO_DE_OUTRA_JANELA)
    await usuario.click(screen.getByRole('radio', { name: /^A\./ }))

    await waitFor(() => expect(screen.queryByText(AVISO_DE_OUTRA_JANELA)).toBeNull())
    await waitFor(() => expect(envios(rede)).toHaveLength(2))
    expect(envios(rede)).toEqual([
      { alternativa: 1, sequencia: 1 },
      { alternativa: 0, sequencia: 9 },
    ])
    await waitFor(() => expect(marcada()).toBe(0))
    expect(regiaoDeStatus().textContent).toContain('Resposta salva')
  })

  it('a aba que venceu mostra a sua até a leitura seguinte, e então adota a do servidor com o mesmo aviso', async () => {
    const usuario = userEvent.setup()
    const id = idDaAtividade(3)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/respostas/1`, gravada(1, 1))
    montar(id)

    await usuario.click(await screen.findByRole('radio', { name: /^B\./ }))
    await waitFor(() => expect(regiaoDeStatus().textContent).toContain('Resposta salva'))
    // Ganhou: mostra a sua, sem aviso nenhum.
    expect(marcada()).toBe(1)
    expect(screen.queryByText(AVISO_DE_OUTRA_JANELA)).toBeNull()

    // A prova é lida de novo (a tela é aberta outra vez, sem F5): a outra janela gravou D, com a sequência 5.
    cleanup()
    const redeDaLeitura = fakeNetwork()
    redeDaLeitura.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id, [{ questao: 1, alternativa: 3, sequencia: 5 }]))
    redeDaLeitura.responderPor(`/v1/atividades-aplicadas/${id}/respostas/1`, gravada(2, 6))
    montar(id)

    await screen.findByRole('radio', { name: /^D\./ })
    await within(regiaoDeStatus()).findByText(AVISO_DE_OUTRA_JANELA)
    expect(marcada()).toBe(3)
    // E a escolha seguinte sai uma acima da do servidor.
    await usuario.click(screen.getByRole('radio', { name: /^C\./ }))
    await waitFor(() => expect(envios(redeDaLeitura)).toEqual([{ alternativa: 2, sequencia: 6 }]))
  })

  it('a primeira abertura da atividade, com respostas já gravadas, não avisa nada: nesta janela não havia o que alterar', async () => {
    const id = idDaAtividade(4)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id, [{ questao: 1, alternativa: 2, sequencia: 4 }]))
    montar(id)

    await screen.findByRole('radio', { name: /^C\./ })
    await waitFor(() => expect(marcada()).toBe(2))
    expect(screen.queryByText(AVISO_DE_OUTRA_JANELA)).toBeNull()
    expect(envios(rede)).toEqual([])
  })
})

describe('a atividade na tela: a escolha pendente sobrevive ao F5 (53.0, RF21)', () => {
  const ALUNA = '0197a1c0-0000-7000-8000-00000000a001'
  const OUTRO_ALUNO = '0197a1c0-0000-7000-8000-00000000a002'
  const eu = (usuarioId: string) => ({ usuarioId, papel: 'aluno' as const, nome: 'Aluna Sintética', escola: { id: '0197a1c0-0000-7000-8000-00000000c001', nome: 'Escola Sintética', slug: 'escola-sintetica' }, inatividadeMin: 30, introducaoVistaEm: '2026-02-01T10:00:00.000Z', acessos: [] })
  const guardar = (atividade: string, dono: string) =>
    window.sessionStorage.setItem(`educa.escolhas-pendentes.${atividade}`, JSON.stringify({ dono, atividade, pendentes: [{ questao: 1, alternativa: 2, sequencia: 3 }] }))
  /** A tela dentro do cache da aba, com o `/v1/eu` de quem está na sessão (ou sem ele, ainda). */
  function montarComSessao(atividadeAplicadaId: string, usuarioId: string | undefined) {
    const cliente = createQueryClient()
    if (usuarioId !== undefined) cliente.setQueryData(euQueryOptions.queryKey, eu(usuarioId))
    const localizacao = memoryLocation({ path: `/aluno/atividades/${atividadeAplicadaId}` })
    render(
      <QueryClientProvider client={cliente}>
        <Router hook={localizacao.hook}>
          <Atividade atividadeAplicadaId={atividadeAplicadaId} />
        </Router>
      </QueryClientProvider>,
    )
    return cliente
  }

  it('o F5 com a escolha ainda não salva: ela volta marcada, sai com a mesma sequência, e some do espelho quando o servidor confirma', async () => {
    const id = idDaAtividade(5)
    guardar(id, ALUNA)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id))
    // O servidor só confirma quando o teste diz: até lá a escolha está na tela, marcada, e no espelho.
    let confirmar: (resposta: FakeResponse) => void = () => undefined
    const segurada = new Promise<FakeResponse>((resolver) => (confirmar = resolver))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/respostas/1`, () => segurada)
    montarComSessao(id, ALUNA)

    await screen.findByRole('radio', { name: /^C\./ })
    await waitFor(() => expect(envios(rede)).toEqual([{ alternativa: 2, sequencia: 3 }]))
    expect(marcada()).toBe(2)
    expect(window.sessionStorage.getItem(`educa.escolhas-pendentes.${id}`)).not.toBeNull()

    confirmar(gravada(2, 3))
    await waitFor(() => expect(window.sessionStorage.getItem(`educa.escolhas-pendentes.${id}`)).toBeNull())
    await waitFor(() => expect(regiaoDeStatus().textContent).toContain('Resposta salva'))
  })

  it('o aluno da sessão só se sabe depois de a tela abrir: a escolha guardada volta e sai assim que ele chega', async () => {
    const id = idDaAtividade(6)
    guardar(id, ALUNA)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/respostas/1`, gravada(2, 3))
    const cliente = montarComSessao(id, undefined)

    await screen.findByRole('radio', { name: /^C\./ })
    expect(envios(rede)).toEqual([])
    // A tela só assina o `/v1/eu` que a casca busca: não o busca de novo.
    expect(rede.chamadas.some(({ caminho }) => caminho.startsWith('/v1/eu'))).toBe(false)
    act(() => cliente.setQueryData(euQueryOptions.queryKey, eu(ALUNA)))
    await waitFor(() => expect(envios(rede)).toEqual([{ alternativa: 2, sequencia: 3 }]))
  })

  it('o espelho de outra pessoa no mesmo Chromebook não volta: nada é mandado, nada aparece marcado, e ele sai do armazenamento', async () => {
    const id = idDaAtividade(7)
    guardar(id, OUTRO_ALUNO)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id))
    montarComSessao(id, ALUNA)

    await screen.findByRole('radio', { name: /^C\./ })
    await waitFor(() => expect(window.sessionStorage.getItem(`educa.escolhas-pendentes.${id}`)).toBeNull())
    expect(marcada()).toBe(-1)
    expect(envios(rede)).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// Tarefa 6.0 da X4: a tarefa aberta na pele nova, com a comemoração na entrega (RF7, RF8, RF20).
// ---------------------------------------------------------------------------------------------------------------------

const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const erroDaApi = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: REQUISICAO } } })
const NAO_ACHADA = erroDaApi(404, ErrorCode.NAO_ENCONTRADO)
const ENVIADA_EM = '2026-10-22T13:30:00.000Z'
const respostaDe = (questaoNumero: number, alternativa: number) => ({ questao: questaoNumero, alternativa, sequencia: 1 })
const DUAS_RESPONDIDAS = [respostaDe(1, 1), respostaDe(2, 0)]

function diagnosticoDe(atividadeAplicadaId: string): FakeResponse {
  const corpo: MeuDiagnosticoResponse = {
    atividadeAplicadaId,
    titulo: 'Lista sintética',
    acertos: 2,
    total: 3,
    porHabilidade: [{ habilidade: { codigo: 'QUI.EM.05', descricao: 'Calcular a massa molar de uma substância' }, acertos: 2, total: 3 }],
    questoes: [{ numero: 1, alternativa: 1, gabarito: 1, correta: true, explicacao: 'Porque sim.', citacao: { materialId: '0190f5a0-0000-7000-8000-0000000000b1', pagina: 3, trecho: 'Trecho sintético.' } }],
    aprovadoPor: { nome: 'Professora Sintética' },
    aprovadoEm: '2026-10-22T15:00:00.000Z',
  }
  return { status: 200, corpo }
}

const enviadaAgora: FakeResponse = { status: 200, corpo: { enviadaEm: ENVIADA_EM, respondidas: 2, questoes: 3 } }
const comemoracoes = () => document.querySelectorAll('[data-comemoracao]')
const pedidosDeEnvio = (rede: FakeNetwork) => rede.chamadas.filter(({ caminho, metodo }) => metodo === 'POST' && caminho.endsWith('/enviar'))

/** O aluno abre a confirmação e confirma o envio: o mesmo caminho da tela, pelos dois botões "Enviar a atividade". */
async function enviarPelaTela(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(await screen.findByRole('button', { name: 'Enviar a atividade' }))
  const dialogo = await screen.findByRole('alertdialog')
  await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar a atividade' }))
  return dialogo
}

/** A tela da tarefa de uma aluna que respondeu duas de três, com a rede pronta para o envio dar certo. */
function prepararEnvio(n: number, diagnostico: FakeResponse = NAO_ACHADA) {
  const id = idDaAtividade(n)
  const rede = fakeNetwork()
  rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id, DUAS_RESPONDIDAS))
  rede.responderPor(`/v1/atividades-aplicadas/${id}/enviar`, enviadaAgora)
  rede.responderPor(`/v1/atividades-aplicadas/${id}/meu-diagnostico`, diagnostico)
  return { id, rede }
}

describe('a comemoração do envio (X4, 6.0; RF8; D59)', () => {
  it('aparece uma vez, logo depois do envio confirmado: a onça comemorando, a função, o selo "IA", o fato e o caminho de volta', async () => {
    const usuario = userEvent.setup()
    const { id, rede } = prepararEnvio(10)
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })
    expect(comemoracoes()).toHaveLength(0)

    await enviarPelaTela(usuario)
    await screen.findByRole('heading', { name: 'Atividade enviada' })

    expect(pedidosDeEnvio(rede)).toHaveLength(1)
    expect(comemoracoes()).toHaveLength(1)
    const comemoracao = comemoracoes()[0] as HTMLElement
    expect(comemoracao.querySelector('[data-onca]')?.getAttribute('data-pose')).toBe('comemorando')
    expect(comemoracao.querySelector('figcaption')?.textContent).toMatch(/^Tutor/)
    expect(comemoracao.querySelectorAll('[data-selo-ia]')).toHaveLength(1)
    expect(comemoracao.textContent).toContain(FALA_DA_ENTREGA)
    // O caminho de volta é o mesmo do "Voltar" do alto: a lista, do mesmo tamanho de toque de qualquer botão.
    const volta = screen.getByRole('link', { name: ROTULO_DE_VOLTAR_AS_TAREFAS })
    expect(volta.getAttribute('href')).toBe('/atividades')
    // O que a tela já dizia continua: o cartão "Atividade enviada" e o aviso de que o resultado vem depois.
    expect(screen.getByRole('heading', { name: 'Atividade enviada' })).toBeTruthy()
    expect(await screen.findByText(/Quem dá a aula ainda vai revisar a correção/)).toBeTruthy()
  })

  it('nunca de nota nem de acerto: o cartão da comemoração não traz número, acerto, tempo nem "parabéns"', async () => {
    const usuario = userEvent.setup()
    const { id } = prepararEnvio(11)
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })
    await enviarPelaTela(usuario)
    await screen.findByRole('heading', { name: 'Atividade enviada' })

    const cartao = (comemoracoes()[0] as HTMLElement).parentElement as HTMLElement
    // A legenda da onça, a fala e o botão: é tudo o que o cartão diz, e nada disso tem dígito nem festa.
    expect(cartao.textContent).not.toMatch(/\d/)
    expect(cartao.textContent).not.toMatch(/acert|errou|nota\b|conceito|ponto|%|tempo|minuto|parab[ée]ns|incr[ií]vel|muito bem|!/i)
    expect(cartao.textContent).toContain('Atividade entregue.')
    // O número de questões respondidas está no cartão "Atividade enviada", ao lado, e não na comemoração.
    expect(cartao.querySelectorAll('audio, video, progress, [role="progressbar"]')).toHaveLength(0)
  })

  it('não volta ao reabrir: a mesma tarefa, lida de novo do servidor, só diz "Atividade enviada"; nada fica guardado', async () => {
    const usuario = userEvent.setup()
    const { id } = prepararEnvio(12)
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })
    await enviarPelaTela(usuario)
    await waitFor(() => expect(comemoracoes()).toHaveLength(1))
    // Nem no armazenamento da aba, nem no do navegador: a comemoração é estado da tela.
    expect(window.localStorage.length).toBe(0)
    expect(Object.keys(window.sessionStorage).filter((chave) => /comemor|entreg/i.test(chave))).toEqual([])

    // O F5, ou abrir a tarefa pela lista: outra abertura, outro cache, e o servidor já tem o envio.
    cleanup()
    const redeDaLeitura = fakeNetwork()
    redeDaLeitura.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id, DUAS_RESPONDIDAS, { enviadaEm: ENVIADA_EM }))
    redeDaLeitura.responderPor(`/v1/atividades-aplicadas/${id}/meu-diagnostico`, NAO_ACHADA)
    montar(id)
    await screen.findByRole('heading', { name: 'Atividade enviada' })
    await screen.findByText(/Quem dá a aula ainda vai revisar a correção/)
    expect(comemoracoes()).toHaveLength(0)
    expect(screen.queryByRole('link', { name: ROTULO_DE_VOLTAR_AS_TAREFAS })).toBeNull()
  })

  it('a tarefa que tem resultado abre sem comemoração', async () => {
    const id = idDaAtividade(13)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id, DUAS_RESPONDIDAS, { enviadaEm: ENVIADA_EM }))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/meu-diagnostico`, diagnosticoDe(id))
    montar(id)
    await screen.findByRole('region', { name: 'Seu resultado' })
    expect(comemoracoes()).toHaveLength(0)
  })

  it('a lista "Questão por questão" rola por dentro e ganha foco só a partir de 1024 px; abaixo disso a página é que rola', async () => {
    const id = idDaAtividade(14)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id, DUAS_RESPONDIDAS, { enviadaEm: ENVIADA_EM }))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/meu-diagnostico`, diagnosticoDe(id))
    montar(id)
    const resultado = await screen.findByRole('region', { name: 'Seu resultado' })
    const lista = within(resultado).getByRole('group', { name: 'Questões corrigidas' })
    expect(lista.getAttribute('tabindex')).toBe('0')
    for (const classe of ['relative', 'lg:overflow-y-auto']) expect(classesOf(lista).has(classe), classe).toBe(true)
    expect(lista.querySelectorAll('[data-questao-corrigida]').length).toBeGreaterThan(0)
    cleanup()

    // O celular: a lista não é uma segunda rolagem dentro da página, e não é mais uma parada do Tab.
    janelaDe(360)
    const outra = idDaAtividade(15)
    rede.responderPor(`/v1/atividades-aplicadas/${outra}/prova`, prova(outra, DUAS_RESPONDIDAS, { enviadaEm: ENVIADA_EM }))
    rede.responderPor(`/v1/atividades-aplicadas/${outra}/meu-diagnostico`, diagnosticoDe(outra))
    montar(outra)
    const noCelular = within(await screen.findByRole('region', { name: 'Seu resultado' }))
    expect(noCelular.queryByRole('group', { name: 'Questões corrigidas' })).toBeNull()
    expect(noCelular.getByRole('region', { name: 'Questão por questão' }).querySelector('[tabindex]')).toBeNull()
  })

  it('a tarefa que a professora encerrou abre sem comemoração', async () => {
    const id = idDaAtividade(14)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id, DUAS_RESPONDIDAS, { estado: 'encerrada' }))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/meu-diagnostico`, NAO_ACHADA)
    montar(id)
    await screen.findByRole('heading', { name: 'Quem dá a aula encerrou esta atividade' })
    expect(comemoracoes()).toHaveLength(0)
  })

  it('o resultado aprovado que já está à vista na hora do envio tira a comemoração: ela nunca divide a tela com acerto', async () => {
    const usuario = userEvent.setup()
    const id = idDaAtividade(15)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id, DUAS_RESPONDIDAS))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/enviar`, enviadaAgora)
    rede.responderPor(`/v1/atividades-aplicadas/${id}/meu-diagnostico`, diagnosticoDe(id))
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })
    await enviarPelaTela(usuario)

    await screen.findByRole('region', { name: 'Seu resultado' })
    expect(comemoracoes()).toHaveLength(0)
  })

  it('a professora encerra com o diálogo aberto (ATIVIDADE_ENCERRADA): a tela passa a dizer isso, sem comemoração', async () => {
    const usuario = userEvent.setup()
    const id = idDaAtividade(16)
    const rede = fakeNetwork()
    let encerrou = false
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, () => prova(id, DUAS_RESPONDIDAS, encerrou ? { estado: 'encerrada' } : {}))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/enviar`, () => {
      encerrou = true
      return erroDaApi(409, ErrorCode.ATIVIDADE_ENCERRADA)
    })
    rede.responderPor(`/v1/atividades-aplicadas/${id}/meu-diagnostico`, NAO_ACHADA)
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })
    await enviarPelaTela(usuario)

    await screen.findByRole('heading', { name: 'Quem dá a aula encerrou esta atividade' })
    expect(comemoracoes()).toHaveLength(0)
    expect(screen.queryByRole('heading', { name: 'Atividade enviada' })).toBeNull()
  })

  it('a queda de rede no envio deixa o diálogo aberto e sem comemoração; ela só vem quando o envio, de fato, passa', async () => {
    const usuario = userEvent.setup()
    const id = idDaAtividade(17)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id, DUAS_RESPONDIDAS))
    let tentativas = 0
    rede.responderPor(`/v1/atividades-aplicadas/${id}/enviar`, () => (++tentativas === 1 ? erroDaApi(503, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO) : enviadaAgora))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/meu-diagnostico`, NAO_ACHADA)
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })
    const dialogo = await enviarPelaTela(usuario)

    await within(dialogo).findByText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    expect(comemoracoes()).toHaveLength(0)
    // As respostas continuam à vista: nada foi enviado.
    expect(screen.getAllByRole('radio')).toHaveLength(4)

    await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar a atividade' }))
    await screen.findByRole('heading', { name: 'Atividade enviada' })
    expect(tentativas).toBe(2)
    expect(comemoracoes()).toHaveLength(1)
  })

  it('o envio que falha com a tarefa já enviada em outra janela não comemora: a comemoração é só do `onSuccess`', async () => {
    const usuario = userEvent.setup()
    const id = idDaAtividade(18)
    const rede = fakeNetwork()
    // Outra janela enviou a mesma tarefa: este envio é recusado, e a leitura que a tela refaz já traz o envio.
    let enviadaEmOutraJanela = false
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, () => prova(id, DUAS_RESPONDIDAS, enviadaEmOutraJanela ? { enviadaEm: ENVIADA_EM } : {}))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/enviar`, () => {
      enviadaEmOutraJanela = true
      return erroDaApi(409, ErrorCode.ATIVIDADE_ENCERRADA)
    })
    rede.responderPor(`/v1/atividades-aplicadas/${id}/meu-diagnostico`, NAO_ACHADA)
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })
    await enviarPelaTela(usuario)

    // A tela passou a ser a da tarefa enviada (a leitura trouxe o envio), e a comemoração não veio: este envio não deu certo.
    await screen.findByRole('heading', { name: 'Atividade enviada' })
    expect(pedidosDeEnvio(rede)).toHaveLength(1)
    expect(comemoracoes()).toHaveLength(0)
    expect(screen.queryByRole('link', { name: ROTULO_DE_VOLTAR_AS_TAREFAS })).toBeNull()
  })

  it('o clique duplo em "Enviar a atividade" manda um envio só e comemora uma vez', async () => {
    const usuario = userEvent.setup()
    const id = idDaAtividade(19)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id, DUAS_RESPONDIDAS))
    // O servidor só responde quando o teste libera: o segundo clique chega com o primeiro envio ainda no ar.
    let liberar: (resposta: FakeResponse) => void = () => undefined
    const segurada = new Promise<FakeResponse>((resolver) => (liberar = resolver))
    rede.responderPor(`/v1/atividades-aplicadas/${id}/enviar`, () => segurada)
    rede.responderPor(`/v1/atividades-aplicadas/${id}/meu-diagnostico`, NAO_ACHADA)
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })
    await usuario.click(await screen.findByRole('button', { name: 'Enviar a atividade' }))
    const dialogo = await screen.findByRole('alertdialog')

    await usuario.dblClick(within(dialogo).getByRole('button', { name: 'Enviar a atividade' }))
    expect((within(dialogo).getByRole('button', { name: 'Enviando…' }) as HTMLButtonElement).disabled).toBe(true)
    liberar(enviadaAgora)

    await screen.findByRole('heading', { name: 'Atividade enviada' })
    expect(pedidosDeEnvio(rede)).toHaveLength(1)
    expect(comemoracoes()).toHaveLength(1)
  })
})

describe('a tarefa aberta: a moldura (X4, 6.1; RF7)', () => {
  it('é a `Tela` na largura de leitura, e o "Voltar" diz Tarefas', async () => {
    const id = idDaAtividade(20)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id))
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })

    expect(document.querySelector('[data-tela]')?.getAttribute('data-tela')).toBe('leitura')
    const volta = screen.getByRole('link', { name: 'Voltar para Tarefas' })
    expect(volta.getAttribute('href')).toBe('/atividades')
    expect(screen.queryByText(/Voltar para Atividades/)).toBeNull()
  })

  it('"Anterior" e "Próxima" estão na barra presa, e param nas pontas; "Enviar a atividade" não fica dentro dela', async () => {
    const usuario = userEvent.setup()
    const id = idDaAtividade(21)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id))
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })

    const barra = screen.getByRole('group', { name: 'Trocar de questão' })
    expect(barra.hasAttribute('data-barra-presa')).toBe(true)
    const anterior = within(barra).getByRole('button', { name: 'Anterior' })
    const proxima = within(barra).getByRole('button', { name: 'Próxima' })
    expect(within(barra).queryByRole('button', { name: 'Enviar a atividade' })).toBeNull()
    expect((anterior as HTMLButtonElement).disabled).toBe(true)
    expect((proxima as HTMLButtonElement).disabled).toBe(false)

    await usuario.click(proxima)
    await usuario.click(proxima)
    expect((proxima as HTMLButtonElement).disabled).toBe(true)
    expect((anterior as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('Questão 3 de 3')).toBeTruthy()
    await usuario.click(anterior)
    expect(screen.getByText('Questão 2 de 3')).toBeTruthy()
  })

  it('"Enviar a atividade", o ponto de parada e a navegação são uma linha só em janela larga; a barra presa embaixo é do celular', async () => {
    const id = idDaAtividade(23)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id))
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })

    const barra = screen.getByRole('group', { name: 'Trocar de questão' })
    const enviar = screen.getByRole('button', { name: 'Enviar a atividade' })
    const parada = screen.getByText(/Pode parar quando quiser/)
    // A mesma linha: os três blocos têm o mesmo pai, que é uma linha a partir de 768 px.
    const linha = barra.parentElement
    expect(parada.parentElement).toBe(linha)
    expect(enviar.closest('div')?.parentElement).toBe(linha)
    expect(classesOf(linha as HTMLElement).has('md:flex')).toBe(true)
    // O invólucro de "Enviar": à esquerda e sem o fio nem o respiro de cima que ele tem no celular, para a linha única alinhar.
    const envio = classesOf(enviar.closest('div') as HTMLElement)
    for (const classe of ['md:justify-start', 'md:border-t-0', 'md:pt-0']) expect(envio.has(classe), classe).toBe(true)
    // Presa no celular; solta, sem fio, a partir de 768 px: presa, cobriria "Enviar" e o ponto de parada.
    const classes = classesOf(barra)
    for (const classe of ['sticky', 'md:static', 'md:border-t-0', 'md:py-0']) expect(classes.has(classe), classe).toBe(true)
    // O ponto de parada fica no vão da linha, e não numa fileira só dele.
    expect(classesOf(parada).has('md:flex-1')).toBe(true)
  })

  it('o mapa distingue a questão aberta e a respondida da que está em branco, sem depender só da cor', async () => {
    const id = idDaAtividade(22)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id, [respostaDe(2, 1)]))
    montar(id)
    await screen.findByRole('radio', { name: /^A\./ })

    const mapa = screen.getByRole('navigation', { name: 'Questões' })
    const [primeira, segunda, terceira] = within(mapa).getAllByRole('button')
    expect(primeira?.getAttribute('aria-current')).toBe('step')
    expect(segunda?.getAttribute('aria-label')).toBe('Questão 2, respondida')
    expect(terceira?.getAttribute('aria-label')).toBe('Questão 3, sem resposta')
    // A aberta não tem o mesmo desenho de uma em branco (a 3 está em branco como a 1, que está aberta), nem a respondida.
    expect(primeira?.className).not.toBe(terceira?.className)
    expect(segunda?.className).not.toBe(terceira?.className)
  })
})

describe('a tarefa aberta: os quatro estados (X4, 6.1; RF20)', () => {
  it('carregando: o texto, o "Voltar" à vista e nenhuma questão', async () => {
    const id = idDaAtividade(30)
    const rede = fakeNetwork()
    const segurada = rede.segurar()
    montar(id)

    expect((await screen.findByRole('status')).textContent).toBe('Carregando a atividade…')
    expect(screen.getByRole('link', { name: 'Voltar para Tarefas' })).toBeTruthy()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    segurada.liberar(prova(id))
    await screen.findByRole('radio', { name: /^A\./ })
  })

  it('não disponível: a de outra turma responde como a que não existe, e aponta para Tarefas, sem "Tentar de novo"', async () => {
    const id = idDaAtividade(31)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, NAO_ACHADA)
    montar(id)

    await screen.findByText('Esta atividade não está disponível')
    expect(screen.getByText(/As tarefas da sua turma estão em Tarefas\./)).toBeTruthy()
    expect(screen.queryByText(/estão em Atividades/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Voltar para Tarefas' }).getAttribute('href')).toBe('/atividades')
  })

  it('erro: diz o que fazer, sem código, e "Tentar de novo" traz a tarefa', async () => {
    const usuario = userEvent.setup()
    const id = idDaAtividade(32)
    const rede = fakeNetwork()
    let tentativas = 0
    // Limite excedido não é repetido sozinho (`shouldRetry`): o erro aparece na hora, sem esperar a nova tentativa de 1 s.
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, () => (++tentativas === 1 ? erroDaApi(429, ErrorCode.LIMITE_EXCEDIDO) : prova(id)))
    montar(id)

    expect((await screen.findByRole('alert')).textContent).toBe(MENSAGENS_DE_ERRO.LIMITE_EXCEDIDO)
    expect(document.body.textContent).not.toMatch(/429|LIMITE_EXCEDIDO/)
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findByRole('radio', { name: /^A\./ })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('com dado: o título da tarefa, a questão, as alternativas e o ponto de parada dito', async () => {
    const id = idDaAtividade(33)
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${id}/prova`, prova(id))
    montar(id)

    await screen.findByRole('heading', { level: 1, name: 'Lista sintética' })
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(screen.getByText('Questão 1 de 3')).toBeTruthy()
    expect(screen.getByText(/Pode parar quando quiser/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Pedir ajuda ao Tutor nesta questão' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Enviar a atividade' })).toBeTruthy()
  })
})
