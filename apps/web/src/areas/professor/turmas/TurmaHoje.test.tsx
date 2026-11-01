// @vitest-environment jsdom
import { montarTime } from '@educa/shared'
import { focusManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { createQueryClient } from '../../../api/query-client'
import { formatDayAndTime } from '../../../format'
import { USO_DO_TUTOR_QUERY_KEY } from '../../../api/chaves-do-professor'
import { sinaisQueryOptions } from './api/tutor-da-turma'
import { setupScreen, fakeNetwork, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import TurmaHoje from './TurmaHoje'

/**
 * A aba Hoje da turma aberta (telas do professor, 10.0; RF6, RF15, RF16, RF21): a atenção humana sem nome, os sinais em
 * agregado, o que o Tutor faz sozinho e o acerto por habilidade. A rede é falsa e responde **por caminho**; a aba, o cliente de
 * consultas, o painel e a rota são os de verdade. O `jsdom` não implementa o `dialog` modal: o teste instala o `showModal`.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const TURMA = id(100)
const ATIVIDADE = id(200)
const ANA = { id: id(901), nome: 'Ana Sintética' }
const BRUNO = { id: id(902), nome: 'Bruno Sintético' }
const CAIO = { id: id(903), nome: 'Caio Sintético' }
const DELA = { id: id(904), nome: 'Dani Sintética' }
// A hora na zona de quem roda o teste, como a tela a mostra: a conta é a da tela, e o caso vale em qualquer zona.
const HORA_DO_AVISO = formatDayAndTime('2026-10-05T13:40:00.000Z')
const HORA_DO_AVISO_MAIS_NOVO = formatDayAndTime('2026-10-05T13:50:00.000Z')
const NOMES = [ANA, BRUNO, CAIO, DELA].map((aluno) => aluno.nome)

const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
// Limite excedido não é repetido sozinho: o erro chega na hora, sem esperar a nova tentativa.
const FALHA = erro(429, 'LIMITE_EXCEDIDO')

const travou = (aluno: { id: string; nome: string }, n: number) => ({ id: id(300 + n), tipo: 'travou', aluno, atividadeAplicadaId: ATIVIDADE, questao: 3, materialId: null, pagina: null, criadoEm: '2026-10-05T13:20:00.000Z' })
const pediu = (aluno: { id: string; nome: string }, n: number) => ({ id: id(300 + n), tipo: 'resposta_pronta', aluno, atividadeAplicadaId: ATIVIDADE, questao: 1, materialId: null, pagina: null, criadoEm: '2026-10-05T13:25:00.000Z' })
const atencao = (aluno: { id: string; nome: string }, n: number, criadoEm = '2026-10-05T13:40:00.000Z') => ({ id: id(300 + n), tipo: 'atencao_humana', aluno, criadoEm })
const sinais = (itens: readonly unknown[], grupos: readonly unknown[] = []) => ok({ itens, grupos })

const APLICADA = {
  id: ATIVIDADE,
  artefatoId: id(210),
  turmaId: TURMA,
  titulo: 'Atividade de estequiometria',
  avaliativa: false,
  estado: 'aberta',
  questoes: 5,
  aplicadaEm: '2026-10-05T13:00:00.000Z',
  encerradaEm: null,
  participacao: { alunos: 30, iniciaram: 20, enviaram: 3 },
  entrega: null,
}
const USO = {
  turmaId: TURMA,
  limiteDoDia: 60,
  trocasDaTurmaNoMes: 412,
  pacoteDaTurmaNoMes: 9000,
  alunos: [
    { aluno: DELA, trocasHoje: 7, ultimaTrocaEm: '2026-10-05T13:30:00.000Z', ultimaReferencia: { atividadeAplicadaId: null, questao: null, materialId: null, pagina: null } },
    { aluno: ANA, trocasHoje: 12, ultimaTrocaEm: '2026-10-05T13:42:00.000Z', ultimaReferencia: { atividadeAplicadaId: ATIVIDADE, questao: 3, materialId: null, pagina: null } },
  ],
}
const DESEMPENHO_VAZIO = { turmaId: TURMA, lotesAprovados: 0, porHabilidade: [], alunos: [] }
const DESEMPENHO = {
  turmaId: TURMA,
  lotesAprovados: 1,
  porHabilidade: [
    { habilidade: { codigo: 'QUI.EM.04', descricao: 'Usar a proporção da equação balanceada.' }, acertos: 20, total: 28, alunosAbaixoDaMetade: 8 },
    { habilidade: { codigo: 'QUI.EM.05', descricao: 'Identificar o reagente limitante.' }, acertos: 15, total: 28, alunosAbaixoDaMetade: 0 },
  ],
  alunos: [{ alunoId: ANA.id, nome: ANA.nome, acertos: 1, total: 2, porHabilidade: [] }],
}

interface Quem {
  sinais?: FakeResponse | (() => FakeResponse | Promise<FakeResponse>)
  uso?: FakeResponse | (() => FakeResponse | Promise<FakeResponse>)
  desempenho?: FakeResponse | (() => FakeResponse | Promise<FakeResponse>)
}

function instalar(rede: FakeNetwork, quem: Quem = {}): void {
  rede.responderPor('/v1/sinais', quem.sinais ?? sinais([]))
  rede.responderPor('/v1/tutor/uso', quem.uso ?? ok(USO))
  rede.responderPor(`/v1/turmas/${TURMA}/desempenho`, quem.desempenho ?? ok(DESEMPENHO_VAZIO))
  rede.responderPor('/v1/atividades-aplicadas', ok({ itens: [APLICADA] }))
  rede.responderPor('/v1/time', ok(montarTime(new Set())))
  rede.responderPor('/v1/materiais', ok({ itens: [] }))
}

const semConsulta = (caminho: string) => caminho.split('?')[0] ?? caminho
const caminhosDe = (rede: FakeNetwork) => rede.chamadas.map((chamada) => semConsulta(chamada.caminho))
const vezesQue = (rede: FakeNetwork, caminho: string) => caminhosDe(rede).filter((chamado) => chamado === caminho).length

function montar(busca = 'aba=hoje', aoPerderATurma: () => void = () => undefined) {
  const cliente: QueryClient = createQueryClient()
  const localizacao = memoryLocation({ path: `/turmas/${TURMA}`, searchPath: busca, record: true })
  const tela = render(
    <QueryClientProvider client={cliente}>
      <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
        <TurmaHoje turmaId={TURMA} aoPerderATurma={aoPerderATurma} />
      </Router>
    </QueryClientProvider>,
  )
  return { cliente, localizacao, ...tela }
}

const aviso = () => document.querySelector('[data-atencao-humana]')
const painel = () => screen.getByRole('dialog', { name: 'O que o Tutor viu' })
const textoDaPagina = () => document.body.textContent ?? ''
const seNomes = (texto: string) => NOMES.filter((nome) => texto.includes(nome))
const tudoDoCache = (cliente: QueryClient) => cliente.getQueryCache().getAll()

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  // A tabela lê a largura da janela e mede o que rola; o `jsdom` não tem `matchMedia` nem `ResizeObserver`. Janela larga, como a do Chromebook.
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

describe('Hoje: os estados', () => {
  it('carregando: cada bloco diz que está lendo, e nenhum diz que não há nada', async () => {
    const rede = fakeNetwork()
    instalar(rede, { sinais: () => new Promise(() => undefined), desempenho: () => new Promise(() => undefined) })
    montar()
    expect(await screen.findByText('Carregando os sinais…')).toBeTruthy()
    expect(screen.getByText('Carregando o desempenho da turma…')).toBeTruthy()
    expect(screen.queryByText('Nenhum sinal desta turma ainda')).toBeNull()
    expect(screen.queryByText('Ainda não há correção aprovada nesta turma')).toBeNull()
    expect(aviso()).toBeNull()
  })

  it('erro das duas leituras: um erro só, com um "Tentar de novo" que lê as duas, e nunca o vazio', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhando = true
    instalar(rede, { sinais: () => (falhando ? FALHA : sinais([])), desempenho: () => (falhando ? FALHA : ok(DESEMPENHO_VAZIO)) })
    montar()
    await screen.findByRole('alert')
    expect(screen.getAllByRole('button', { name: 'Tentar de novo' })).toHaveLength(1)
    expect(screen.getByText(/Também não foi possível carregar o acerto por habilidade/)).toBeTruthy()
    expect(screen.queryByText('Nenhum sinal desta turma ainda')).toBeNull()
    expect(screen.queryByText('Ainda não há correção aprovada nesta turma')).toBeNull()

    falhando = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Nenhum sinal desta turma ainda')).toBeTruthy()
    expect(await screen.findByText('Ainda não há correção aprovada nesta turma')).toBeTruthy()
    expect(vezesQue(rede, '/v1/sinais')).toBe(2)
    expect(vezesQue(rede, `/v1/turmas/${TURMA}/desempenho`)).toBe(2)
  })

  it('erro de uma leitura só: o bloco dela mostra o erro, e o outro segue com o dado', async () => {
    const rede = fakeNetwork()
    instalar(rede, { sinais: sinais([]), desempenho: FALHA })
    montar()
    await screen.findByRole('alert')
    expect(await screen.findByText('Nenhum sinal desta turma ainda')).toBeTruthy()
    expect(screen.queryByText(/Também não foi possível carregar o acerto/)).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Acerto por habilidade' })).getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })

  it('sem sinal: o vazio diz o que o Tutor avisa e quando (regra 50, item 6); sem correção aprovada: o vazio tracejado diz o que falta', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    expect(await screen.findByText('Nenhum sinal desta turma ainda')).toBeTruthy()
    expect(screen.getByText(/Quando um aluno travar numa questão, pedir a resposta pronta ou repetir a mesma dúvida/)).toBeTruthy()
    expect(await screen.findByText('Ainda não há correção aprovada nesta turma')).toBeTruthy()
    expect(aviso()).toBeNull()
  })

  it('sinal de trabalho só antigo (sem grupo dos últimos 7 dias): a seção diz isso e aponta o painel, sem nome nenhum, e não fica em branco', async () => {
    const rede = fakeNetwork()
    instalar(rede, { sinais: sinais([travou(ANA, 1), pediu(BRUNO, 2)], []) })
    montar()
    const regiao = await screen.findByRole('region', { name: 'Sinais da turma' })
    await within(regiao).findByText(/Nenhum sinal agrupado da turma nos últimos 7 dias/)
    expect(regiao.textContent).toContain('estão em “Ver o uso do Tutor por aluno”')
    expect(screen.queryByText('Nenhum sinal desta turma ainda')).toBeNull()
    expect(within(regiao).queryByRole('log')).toBeNull()
    expect(seNomes(textoDaPagina())).toEqual([])
  })

  it('com dado: o grupo é dito sem nome, assinado pela função do Tutor, e as funções e o "quando o Tutor avisa" estão na aba', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { sinais: sinais([travou(ANA, 1), pediu(BRUNO, 2)], [{ tipo: 'travou', atividadeAplicadaId: ATIVIDADE, questao: 3, alunos: 8 }]), desempenho: ok(DESEMPENHO) })
    montar()
    const regiao = await screen.findByRole('region', { name: 'Sinais da turma' })
    const log = await within(regiao).findByRole('log')
    await waitFor(() => expect(log.textContent).toContain('8 alunos travaram na questão 3 de "Atividade de estequiometria".'))
    expect(within(log).getByText('Tutor · sinais para o professor')).toBeTruthy()
    expect(screen.queryByText('Nenhum sinal desta turma ainda')).toBeNull()

    await usuario.click(screen.getByText('O que o Tutor faz sozinho, e o que você vê aqui'))
    expect(await screen.findByText('Travou: a quarta troca seguida na mesma questão ou página, no mesmo dia.')).toBeTruthy()
    expect(screen.getByText('Quando o Tutor avisa você')).toBeTruthy()
    expect(document.querySelector('[data-funcao="sinais_para_o_professor"]')).not.toBeNull()
    expect(seNomes(textoDaPagina())).toEqual([])
  })
})

describe('Hoje: a atenção humana vai sem nome e sem conteúdo (D34, D36; LGPD, art. 14)', () => {
  it('recém-aberta, com sinal de atenção: o aviso está no alto, sem painel, com a contagem, a hora e o que fazer, e nenhum nome no DOM', async () => {
    const rede = fakeNetwork()
    instalar(rede, { sinais: sinais([atencao(CAIO, 1), travou(ANA, 2)]) })
    const { container } = montar()
    await waitFor(() => expect(aviso()).not.toBeNull())
    const avisoAtual = aviso() as HTMLElement
    expect(within(avisoAtual).getByRole('heading', { name: 'Um aluno precisa de um adulto' })).toBeTruthy()
    expect(avisoAtual.textContent).toContain(`Aviso mais recente: ${HORA_DO_AVISO}`)
    expect(avisoAtual.textContent).toContain('O que foi dito não aparece aqui')
    expect(within(avisoAtual).getByRole('button', { name: 'Ver quem' })).toBeTruthy()
    expect(within(avisoAtual).queryByRole('link')).toBeNull()
    // O aviso é o primeiro bloco da aba, antes dos sinais.
    expect(container.firstElementChild?.firstElementChild?.contains(avisoAtual)).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(seNomes(textoDaPagina())).toEqual([])
    expect(textoDaPagina()).not.toMatch(/Caio|Ana S/)
  })

  it('dois alunos: a contagem diz dois, e o mesmo aluno com dois avisos conta um', async () => {
    const rede = fakeNetwork()
    instalar(rede, { sinais: sinais([atencao(CAIO, 1), atencao(CAIO, 2, '2026-10-05T13:50:00.000Z'), atencao(DELA, 3)]) })
    montar()
    await waitFor(() => expect(aviso()?.textContent).toContain('2 alunos precisam de um adulto'))
    // A hora é a do aviso mais recente de todos.
    expect(aviso()?.textContent).toContain(`Aviso mais recente: ${HORA_DO_AVISO_MAIS_NOVO}`)
    expect(seNomes(textoDaPagina())).toEqual([])
  })

  it('o aviso some quando não há sinal de atenção', async () => {
    const rede = fakeNetwork()
    instalar(rede, { sinais: sinais([travou(ANA, 1)]) })
    montar()
    await screen.findByRole('region', { name: 'Sinais da turma' })
    await waitFor(() => expect(screen.queryByText('Carregando os sinais…')).toBeNull())
    expect(aviso()).toBeNull()
  })

  it('o aviso que a releitura dos 15 s traz resolvido sai da tela: a professora não fica com um aviso que já passou', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let leituras = 0
    const rede = fakeNetwork()
    instalar(rede, { sinais: () => ((leituras += 1) === 1 ? sinais([atencao(CAIO, 1)]) : sinais([])) })
    montar()
    await waitFor(() => expect(aviso()).not.toBeNull())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_500)
    })
    await waitFor(() => expect(vezesQue(rede, '/v1/sinais')).toBe(2))
    await waitFor(() => expect(aviso()).toBeNull())
    expect(screen.getByRole('region', { name: 'Sinais da turma' })).toBeTruthy()
  })

  it('o painel lista a atenção humana em ordem de nome, e não pela recência: o aviso mais novo vem primeiro da API e não vem primeiro na tela', async () => {
    const rede = fakeNetwork()
    // A API entrega do mais novo ao mais antigo: Dani às 13h50, Ana às 13h40.
    instalar(rede, { sinais: sinais([atencao(DELA, 1, '2026-10-05T13:50:00.000Z'), atencao(ANA, 2, '2026-10-05T13:40:00.000Z')]) })
    montar('aba=hoje&ver=tutor')
    const aberto = await screen.findByRole('dialog', { name: 'O que o Tutor viu' })
    const lista = await within(aberto).findByRole('region', { name: 'Alunos que precisam de um adulto' })
    expect(within(lista).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Ana Sintética'),
      expect.stringContaining('Dani Sintética'),
    ])
  })

  it('o nome só aparece depois de "Ver quem", no painel, que começa pela atenção humana e leva ao endereço', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { sinais: sinais([travou(ANA, 1), atencao(CAIO, 2)]) })
    const { localizacao } = montar()
    await usuario.click(await screen.findByRole('button', { name: 'Ver quem' }))
    // Abrir é um passo no histórico: o Voltar do navegador fecha o painel.
    expect(localizacao.history).toEqual([`/turmas/${TURMA}?aba=hoje`, `/turmas/${TURMA}?aba=hoje&ver=tutor`])
    const aberto = painel()
    // O painel começa pela lista de atenção humana: o nome e a hora, sem o que foi dito.
    const primeiro = aberto.querySelector('[data-painel-miolo] section')
    expect(primeiro?.textContent).toContain(`Caio Sintético · ${HORA_DO_AVISO}`)
    expect(primeiro?.textContent).toContain('O que foi dito não aparece aqui')
    expect(within(aberto).getByRole('table', { name: 'Sinais por aluno' }).textContent).toContain('Ana Sintética')
    expect(within(aberto).queryByRole('link')).toBeNull()
  })

  it('o aviso novo chega aos 15 s dentro de uma região educada, sem mover o foco, e o nome continua fora da tela', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let leituras = 0
    const rede = fakeNetwork()
    instalar(rede, { sinais: () => ((leituras += 1) === 1 ? sinais([travou(ANA, 1)]) : sinais([travou(ANA, 1), atencao(CAIO, 2)])) })
    montar()
    await screen.findByRole('region', { name: 'Sinais da turma' })
    await waitFor(() => expect(vezesQue(rede, '/v1/sinais')).toBe(1))
    const botao = await screen.findByRole('button', { name: 'Ver o uso do Tutor por aluno' })
    botao.focus()
    expect(aviso()).toBeNull()
    // A região existe antes do aviso: é nela que ele entra, e é ela que o leitor de tela anuncia.
    const regiao = document.querySelector('[aria-live="polite"]')
    expect(regiao).not.toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    await waitFor(() => expect(aviso()).not.toBeNull())
    expect(regiao?.contains(aviso())).toBe(true)
    expect(document.activeElement).toBe(botao)
    expect(seNomes(textoDaPagina())).toEqual([])
  })
})

describe('Hoje lê os sinais aos 15 s, só com a aba à vista', () => {
  it('relógio falso: aos 15 s sai nova leitura, e o sinal novo aparece no alto sem recarregar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let leituras = 0
    const rede = fakeNetwork()
    instalar(rede, { sinais: () => ((leituras += 1) === 1 ? sinais([]) : sinais([atencao(CAIO, 1)])) })
    montar()
    expect(await screen.findByText('Nenhum sinal desta turma ainda')).toBeTruthy()
    expect(vezesQue(rede, '/v1/sinais')).toBe(1)
    expect(aviso()).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_000)
    })
    expect(vezesQue(rede, '/v1/sinais')).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500)
    })
    await waitFor(() => expect(vezesQue(rede, '/v1/sinais')).toBe(2))
    await waitFor(() => expect(aviso()).not.toBeNull())
  })

  it('com a janela escondida, nenhuma leitura aos 15 s; o controle: com ela à vista, a leitura sai', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByText('Nenhum sinal desta turma ainda')
    const antes = vezesQue(rede, '/v1/sinais')
    focusManager.setFocused(false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(46_000)
    })
    expect(vezesQue(rede, '/v1/sinais')).toBe(antes)

    focusManager.setFocused(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000)
    })
    await waitFor(() => expect(vezesQue(rede, '/v1/sinais')).toBeGreaterThan(antes))
  })
})

describe('Hoje e a turma que sai do alcance com a aba aberta (PRD §7, "Vínculo encerrado com a turma aberta")', () => {
  async function passarOsQuinzeSegundos(): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_500)
    })
  }
  // A leitura dos sinais já chegou ao estado da consulta (a chamada ao `fetch` conta antes da resposta): só depois disso as
  // asserções "não avisou" valem, e não passam só porque a falha ainda estava a caminho.
  const falhaDosSinaisChegou = (cliente: QueryClient) => waitFor(() => expect(cliente.getQueryState(sinaisQueryOptions(TURMA).queryKey)?.status).toBe('error'))

  it('o 404 da releitura dos 15 s avisa a página que a turma saiu do alcance, uma vez só, também nas releituras seguintes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let leituras = 0
    const rede = fakeNetwork()
    instalar(rede, { sinais: () => ((leituras += 1) === 1 ? sinais([atencao(CAIO, 1)]) : erro(404, 'NAO_ENCONTRADO')) })
    const aoPerderATurma = vi.fn()
    montar('aba=hoje', aoPerderATurma)
    await waitFor(() => expect(aviso()).not.toBeNull())
    expect(aoPerderATurma).not.toHaveBeenCalled()

    await passarOsQuinzeSegundos()
    await waitFor(() => expect(vezesQue(rede, '/v1/sinais')).toBe(2))
    await waitFor(() => expect(aoPerderATurma).toHaveBeenCalledTimes(1))

    // Uma terceira releitura, também 404: a página já saiu, e o aviso não se repete.
    await passarOsQuinzeSegundos()
    await waitFor(() => expect(vezesQue(rede, '/v1/sinais')).toBe(3))
    expect(aoPerderATurma).toHaveBeenCalledTimes(1)
  })

  it('a primeira leitura dos sinais já com 404 (a página abre sem o vínculo) também avisa a página', async () => {
    const rede = fakeNetwork()
    instalar(rede, { sinais: erro(404, 'NAO_ENCONTRADO') })
    const aoPerderATurma = vi.fn()
    montar('aba=hoje', aoPerderATurma)
    await waitFor(() => expect(aoPerderATurma).toHaveBeenCalledTimes(1))
  })

  it('o controle: a releitura que cai por limite ou servidor, com o dado na tela, não avisa nada e o aviso fica', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let leituras = 0
    const rede = fakeNetwork()
    instalar(rede, { sinais: () => ((leituras += 1) === 1 ? sinais([atencao(CAIO, 1)]) : FALHA) })
    const aoPerderATurma = vi.fn()
    const { cliente } = montar('aba=hoje', aoPerderATurma)
    await waitFor(() => expect(aviso()).not.toBeNull())

    await passarOsQuinzeSegundos()
    await waitFor(() => expect(vezesQue(rede, '/v1/sinais')).toBe(2))
    await falhaDosSinaisChegou(cliente)
    expect(aoPerderATurma).not.toHaveBeenCalled()
    expect(aviso()).not.toBeNull()
  })

  it('o controle: a primeira leitura que cai por limite, sem dado, mostra o erro e não avisa a página', async () => {
    const rede = fakeNetwork()
    instalar(rede, { sinais: FALHA })
    const aoPerderATurma = vi.fn()
    const { cliente } = montar('aba=hoje', aoPerderATurma)
    expect(await screen.findByRole('alert')).toBeTruthy()
    await falhaDosSinaisChegou(cliente)
    expect(aoPerderATurma).not.toHaveBeenCalled()
  })
})

describe('Hoje: sem painel, sem rota nominal; com painel, só o que o painel pede', () => {
  it('sem `?ver=tutor` só a leitura dos sinais é do Tutor: nada do uso por aluno, nenhum nome na tela e nenhuma consulta de uso no cache', async () => {
    const rede = fakeNetwork()
    instalar(rede, { sinais: sinais([travou(ANA, 1), atencao(CAIO, 2)]), desempenho: ok(DESEMPENHO) })
    const { cliente } = montar()
    await waitFor(() => expect(aviso()).not.toBeNull())
    await screen.findByText('QUI.EM.04 · Usar a proporção da equação balanceada.')
    expect(caminhosDe(rede).filter((caminho) => caminho.startsWith('/v1/tutor'))).toEqual([])
    expect(caminhosDe(rede).filter((caminho) => caminho === '/v1/materiais')).toEqual([])
    expect(tudoDoCache(cliente).some((consulta) => consulta.queryKey[0] === USO_DO_TUTOR_QUERY_KEY[0])).toBe(false)
    expect(seNomes(textoDaPagina())).toEqual([])
    // Os nomes dos sinais ficam em memória, na resposta da leitura, e não na tela.
    expect(JSON.stringify(tudoDoCache(cliente).map((consulta) => consulta.state.data))).toContain('Caio Sintético')
  })

  it('o painel pelo endereço lê o uso, mostra os nomes em ordem de nome e some com eles ao fechar: a consulta de uso sai do cache', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { sinais: sinais([travou(BRUNO, 1), travou(ANA, 2)]) })
    const { cliente, localizacao } = montar('aba=hoje&ver=tutor')
    const aberto = await screen.findByRole('dialog', { name: 'O que o Tutor viu' })
    const uso = await within(aberto).findByRole('table', { name: 'Uso do Tutor por aluno' })
    // Em ordem de nome, e não pela ordem da API (Dani veio antes de Ana) nem pela recência.
    expect(within(uso).getAllByRole('row').map((linha) => linha.textContent)).toEqual([
      expect.stringContaining('Aluno'),
      expect.stringContaining('Ana Sintética'),
      expect.stringContaining('Dani Sintética'),
    ])
    const sinaisPorAluno = within(aberto).getByRole('table', { name: 'Sinais por aluno' })
    expect(within(sinaisPorAluno).getAllByRole('row').map((linha) => linha.textContent?.slice(0, 20))).toEqual([expect.stringContaining('Aluno'), expect.stringContaining('Ana'), expect.stringContaining('Bruno')])
    expect(aberto.textContent).toContain('12 de 60')
    expect(aberto.textContent).toContain('412 de 9000')
    expect(tudoDoCache(cliente).some((consulta) => consulta.queryKey[0] === USO_DO_TUTOR_QUERY_KEY[0])).toBe(true)
    expect(vezesQue(rede, '/v1/tutor/uso')).toBe(1)

    await usuario.click(within(aberto).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Fechar troca o endereço em vez de acrescentar um passo: o histórico fica do mesmo tamanho, sem o painel no último.
    expect(localizacao.history).toEqual([`/turmas/${TURMA}?aba=hoje`])
    expect(textoDaPagina()).not.toContain('Ana Sintética')
    await waitFor(() => expect(tudoDoCache(cliente).some((consulta) => consulta.queryKey[0] === USO_DO_TUTOR_QUERY_KEY[0])).toBe(false))
  })

  it('"Ver o uso do Tutor por aluno" abre o mesmo painel, também sem sinal de atenção', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    const { localizacao } = montar()
    await usuario.click(await screen.findByRole('button', { name: 'Ver o uso do Tutor por aluno' }))
    expect(localizacao.history).toEqual([`/turmas/${TURMA}?aba=hoje`, `/turmas/${TURMA}?aba=hoje&ver=tutor`])
    expect(await within(painel()).findByRole('table', { name: 'Uso do Tutor por aluno' })).toBeTruthy()
  })

  it('o uso que falha mostra o erro e o "Tentar de novo" dentro do painel, e o uso sem aluno diz que ninguém usou ainda', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhando = true
    instalar(rede, { uso: () => (falhando ? FALHA : ok({ ...USO, alunos: [] })) })
    montar('aba=hoje&ver=tutor')
    const aberto = await screen.findByRole('dialog', { name: 'O que o Tutor viu' })
    await within(aberto).findByRole('alert')
    falhando = false
    await usuario.click(within(aberto).getByRole('button', { name: 'Tentar de novo' }))
    expect(await within(aberto).findByText('Nenhum aluno desta turma usou o Tutor ainda')).toBeTruthy()
  })

  it('o painel aberto pelo endereço devolve o foco ao botão do painel ao fechar, e não ao corpo da página', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    montar('aba=hoje&ver=tutor')
    const aberto = await screen.findByRole('dialog', { name: 'O que o Tutor viu' })
    await usuario.click(within(aberto).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ver o uso do Tutor por aluno' })))
  })

  it('o aviso "Ver quem" que sai da tela com o painel aberto, porque a releitura o resolveu, também devolve o foco ao botão do painel', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    let leituras = 0
    const rede = fakeNetwork()
    instalar(rede, { sinais: () => ((leituras += 1) === 1 ? sinais([atencao(CAIO, 1)]) : sinais([])) })
    montar()
    await usuario.click(await screen.findByRole('button', { name: 'Ver quem' }))
    const aberto = painel()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_500)
    })
    await waitFor(() => expect(aviso()).toBeNull())
    await usuario.click(within(aberto).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ver o uso do Tutor por aluno' })))
  })

  it('o foco volta ao botão que abriu o painel ("Ver quem"), quando foi ele que o abriu', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { sinais: sinais([atencao(CAIO, 1)]) })
    montar()
    const quem = await screen.findByRole('button', { name: 'Ver quem' })
    await usuario.click(quem)
    await usuario.click(within(painel()).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(document.activeElement).toBe(quem))
  })
})

describe('Hoje: nada abre a conversa de um aluno, nem mede tempo ou recência (D46, D69; regra 70, item 7)', () => {
  it('nenhuma linha, botão ou link do painel leva a conversa; sem tempo parado, "há X minutos" nem lista de quem não usou', async () => {
    const rede = fakeNetwork()
    instalar(rede, { sinais: sinais([travou(ANA, 1), pediu(BRUNO, 2), atencao(CAIO, 3)]) })
    montar('aba=hoje&ver=tutor')
    const aberto = await screen.findByRole('dialog', { name: 'O que o Tutor viu' })
    await within(aberto).findByRole('table', { name: 'Uso do Tutor por aluno' })
    expect(within(aberto).queryAllByRole('link')).toEqual([])
    expect(within(aberto).getAllByRole('button').map((botao) => botao.getAttribute('aria-label') ?? botao.textContent)).toEqual(['Fechar'])
    expect(document.querySelector('a[href*="conversa"], a[href*="aluno"]')).toBeNull()
    expect(document.body.textContent).not.toMatch(/há \d+ (min|hora|segundo)|ocios|não usou|não usaram|ranking|pódio/i)
  })

  it('a aba inteira não fala em nota, conceito, média nem pontuação, com dado em todos os blocos', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { sinais: sinais([travou(ANA, 1), atencao(CAIO, 2)], [{ tipo: 'resposta_pronta', atividadeAplicadaId: ATIVIDADE, questao: 1, alunos: 2 }]), desempenho: ok(DESEMPENHO) })
    montar('aba=hoje&ver=tutor')
    const aberto = await screen.findByRole('dialog', { name: 'O que o Tutor viu' })
    await within(aberto).findByRole('table', { name: 'Uso do Tutor por aluno' })
    fireEvent.click(screen.getByText('O que o Tutor faz sozinho, e o que você vê aqui'))
    await usuario.click(within(aberto).getByRole('button', { name: 'Fechar' }))
    await screen.findByText('QUI.EM.04 · Usar a proporção da equação balanceada.')
    expect(document.body.textContent).not.toMatch(/\bnotas?\b|\bconceitos?\b|pontua|\bmédia\b|ranking/i)
  })
})

describe('Hoje: o acerto por habilidade é só de correção aprovada, em barra neutra e sem aluno em ordem de acerto', () => {
  it('com lote aprovado: uma barra por habilidade, com o que cada número quer dizer, e nenhum aluno na aba', async () => {
    const rede = fakeNetwork()
    instalar(rede, { desempenho: ok(DESEMPENHO) })
    montar()
    const regiao = await screen.findByRole('region', { name: 'Acerto por habilidade' })
    await waitFor(() => expect(regiao.textContent).toContain('QUI.EM.04'))
    expect(regiao.textContent).toContain('20 de 28')
    expect(regiao.textContent).toContain('8 alunos acertaram menos da metade das questões desta habilidade nas atividades aprovadas.')
    expect(regiao.textContent).toContain('Nenhum aluno acertou menos da metade das questões desta habilidade nas atividades aprovadas.')
    // Neutra: nenhuma cor de alerta, e o número está no texto.
    expect(regiao.innerHTML).not.toMatch(/vermelh|erro|perigo/)
    // Os alunos do desempenho são da aba Alunos: Hoje não os lista, em ordem nenhuma.
    expect(screen.queryByRole('table', { name: 'Acertos por aluno' })).toBeNull()
    expect(seNomes(textoDaPagina())).toEqual([])
  })

  it('só de correção aprovada: com `lotesAprovados` zero não há barra, e o vazio diz o que falta', async () => {
    const rede = fakeNetwork()
    instalar(rede, { desempenho: ok({ ...DESEMPENHO_VAZIO, porHabilidade: [] }) })
    montar()
    const regiao = await screen.findByRole('region', { name: 'Acerto por habilidade' })
    await waitFor(() => expect(regiao.textContent).toContain('Ainda não há correção aprovada nesta turma'))
    expect(regiao.textContent).toContain('Correção que ainda espera você não entra na conta.')
    expect(regiao.querySelector('svg rect')).toBeNull()
  })
})
