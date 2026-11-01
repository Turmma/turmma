// @vitest-environment jsdom
import { focusManager, onlineManager, QueryClientProvider, QueryObserver, useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { createQueryClient } from '../../../api/query-client'
import { anosLetivosQueryOptions, turmasQueryOptions, vinculosQueryOptions } from '../../../api/estrutura'
import { listaDaTurmaQueryOptions } from '../estrutura/api/lista'
import { materiaisQueryOptions } from '../material/api/material'
import { pedidosDaTurmaQueryOptions } from '../../../api/pedidos'
import { incidentesQueryOptions, pedidosDoTitularQueryOptions } from '../privacidade/api/privacidade'
import { professoresQueryOptions } from '../professores/api/professores'
import { setupScreen, fakeNetwork, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import { SinoAnchorContext } from '../../../components/sino-anchor-context'
import SinoDaCoordenacao from './SinoDaCoordenacao'

/**
 * O sino da coordenação com a fila de verdade (telas da coordenação, 1.0; RF4, RF5 e RF7): o que ele lê, o que nunca lê, e
 * quando relê. A rede é falsa e responde **por caminho**, porque a fila lê em paralelo; a fila, o cliente de consultas e a
 * peça são os da aba. O `jsdom` não implementa o `dialog` modal: o teste instala o `showModal` e o `close`.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const ANO = { id: id(1), ano: 2026, inicio: '2026-02-02', fim: '2026-12-18', situacao: 'em_curso' }
const TURMA = { id: id(101), anoLetivoId: ANO.id, nome: '7º A', turno: null, serie: { id: id(200), etapa: 'ef_anos_finais', ano: 7 } }
const PAULO = { usuarioId: id(302), nome: 'Paulo Sintético', estado: 'vencido' }
const CAMILA = { usuarioId: id(301), nome: 'Camila Sintética', estado: 'ativo' }
const VINCULO = { id: id(401), usuarioId: CAMILA.usuarioId, papel: 'professor', turma: { id: TURMA.id, nome: TURMA.nome }, estado: 'confirmado' }
const MATERIAL = (estado: 'processando' | 'falhou' | 'pronto') => ({
  id: id(701),
  titulo: 'Apostila sintética',
  disciplinaId: id(500),
  titularidade: 'escola',
  licenciante: null,
  licenca: 'autoria_da_escola',
  estado,
  falha: estado === 'falhou' ? 'sem_texto' : null,
  paginas: null,
  trechos: 0,
  enviadoEm: '2026-10-01T12:00:00.000Z',
})

const ok = (itens: readonly unknown[], extra: Record<string, unknown> = {}): FakeResponse => ({ status: 200, corpo: { itens, ...extra } })
const INDISPONIVEL: FakeResponse = { status: 503, corpo: { erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }
const FORA = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }

/** O que cada leitura da fila responde. Cada caso muda só o que importa para ele. */
type Resposta = FakeResponse | (() => FakeResponse | Promise<FakeResponse>)
interface Respostas {
  anos: Resposta
  incidentes: Resposta
  professores: Resposta
  materiais: Resposta
  turmas: Resposta
  vinculos: Resposta
}
const TUDO_EM_DIA: Respostas = {
  anos: ok([ANO]),
  incidentes: { status: 200, corpo: { incidentes: [], prazoLegal: 'O prazo é da escola.' } },
  professores: ok([CAMILA]),
  materiais: ok([MATERIAL('pronto')]),
  turmas: ok([TURMA]),
  vinculos: ok([VINCULO]),
}
/** Um item só: o convite vencido de Paulo. */
const COM_UM_ITEM: Respostas = { ...TUDO_EM_DIA, professores: ok([CAMILA, PAULO]) }

function instalar(rede: FakeNetwork, respostas: Respostas): void {
  rede.responderPor('/v1/anos-letivos', respostas.anos)
  rede.responderPor('/v1/privacidade/incidentes', respostas.incidentes)
  rede.responderPor('/v1/professores', respostas.professores)
  rede.responderPor('/v1/materiais', respostas.materiais)
  rede.responderPor('/v1/turmas', respostas.turmas)
  rede.responderPor('/v1/vinculos', respostas.vinculos)
}

const LEITURAS_DA_FILA = ['/v1/anos-letivos', '/v1/privacidade/incidentes', '/v1/professores', '/v1/materiais', '/v1/turmas', '/v1/vinculos']
const semConsulta = (caminho: string) => caminho.split('?')[0] ?? caminho
const caminhosDe = (rede: FakeNetwork) => rede.chamadas.map((chamada) => semConsulta(chamada.caminho))

beforeEach(() => {
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
  cleanup()
  vi.useRealTimers()
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
})

/** As leituras auditadas que a Estrutura e a Privacidade têm abertas, para o sino provar que não as toca. */
function LeiturasAuditadasAbertas() {
  useInfiniteQuery(listaDaTurmaQueryOptions(TURMA.id))
  useQuery({ ...pedidosDaTurmaQueryOptions(TURMA.id, 'coordenacao'), enabled: true })
  useInfiniteQuery(pedidosDoTitularQueryOptions)
  return null
}

function montar(opcoes: { auditadas?: boolean; cliente?: QueryClient } = {}) {
  const cliente = opcoes.cliente ?? createQueryClient()
  const ancora = document.createElement('div')
  document.body.append(ancora)
  const localizacao = memoryLocation({ path: '/painel' })
  const { unmount } = render(
    <QueryClientProvider client={cliente}>
      <Router hook={localizacao.hook}>
        <SinoAnchorContext value={{ elemento: ancora }}>
          {opcoes.auditadas === true && <LeiturasAuditadasAbertas />}
          <SinoDaCoordenacao />
        </SinoAnchorContext>
      </Router>
    </QueryClientProvider>,
  )
  return { cliente, ancora, desmontar: unmount }
}

const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome })

describe('o sino da coordenação lê a fila', () => {
  it('desenha o sino na âncora da casca, e não onde a área o monta', async () => {
    const rede = fakeNetwork()
    instalar(rede, COM_UM_ITEM)
    const { ancora } = montar()
    const sino = await botao('Esperando você, 1')
    expect(ancora.contains(sino)).toBe(true)
  })

  it('lê as seis leituras da fila, e só elas', async () => {
    const rede = fakeNetwork()
    instalar(rede, COM_UM_ITEM)
    montar()
    await botao('Esperando você, 1')
    expect([...new Set(caminhosDe(rede))].sort()).toEqual([...LEITURAS_DA_FILA].sort())
  })

  it('o que a fila não lê: nem a lista de nomes, nem os pedidos de nome, nem os pedidos de titular; e abrir a lista não faz chamada', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, COM_UM_ITEM)
    montar()
    await usuario.click(await botao('Esperando você, 1'))
    const antes = rede.chamadas.length
    expect(screen.getByRole('dialog', { name: 'Esperando você' })).toBeTruthy()
    expect(rede.chamadas.map((chamada) => chamada.caminho).filter((caminho) => /\/lista|\/reivindicacoes|\/v1\/privacidade\/pedidos/.test(caminho))).toEqual([])
    expect(rede.chamadas).toHaveLength(antes)
  })

  it('sem ano em curso (nenhum, só planejado ou só encerrado): turmas e vínculos nem são chamados, e a fila está pronta: "Tudo em dia"', async () => {
    const usuario = userEvent.setup()
    for (const anos of [[], [{ ...ANO, situacao: 'planejado' }], [{ ...ANO, situacao: 'encerrado' }]]) {
      const rede = fakeNetwork()
      instalar(rede, { ...TUDO_EM_DIA, anos: ok(anos), turmas: FORA, vinculos: FORA })
      montar()
      await usuario.click(await botao('Esperando você, nada'))
      expect(within(screen.getByRole('dialog', { name: 'Esperando você' })).getByText('Tudo em dia')).toBeTruthy()
      expect(caminhosDe(rede).filter((caminho) => caminho === '/v1/turmas' || caminho === '/v1/vinculos')).toEqual([])
      cleanup()
    }
  })

  it('a leitura dos incidentes que falha: a fila é parcial, com os itens das outras cinco', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { ...COM_UM_ITEM, incidentes: FORA })
    montar()
    await usuario.click(await botao('Esperando você, 1'))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).getByText('Parte da lista não carregou')).toBeTruthy()
    expect(within(painel).getByRole('link', { name: /Refazer o convite de Paulo/ })).toBeTruthy()
    expect(within(painel).queryByText('Tudo em dia')).toBeNull()
  })

  it('o "Atualizado às" é a hora em que a fila terminou de ler, e não a de quando o sino montou', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(2026, 9, 16, 9, 0, 0) })
    const usuario = userEvent.setup({ advanceTimers: (ms) => void vi.advanceTimersByTime(ms) })
    const rede = fakeNetwork()
    let liberar: (resposta: FakeResponse) => void = () => undefined
    const lenta = new Promise<FakeResponse>((resolver) => (liberar = resolver))
    instalar(rede, { ...TUDO_EM_DIA, professores: () => lenta })
    montar()
    await botao('Esperando você, carregando')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    liberar(ok([CAMILA]))
    await usuario.click(await botao('Esperando você, nada'))
    expect(within(screen.getByRole('dialog', { name: 'Esperando você' })).getByText('Atualizado às 09:01')).toBeTruthy()
  })

  it('com ano em curso e tudo lido, sem nada esperando: "Tudo em dia", e a lista diz a hora da leitura', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, TUDO_EM_DIA)
    montar()
    await usuario.click(await botao('Esperando você, nada'))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).getByText('Tudo em dia')).toBeTruthy()
    expect(within(painel).getByText(/^Atualizado às \d{2}:\d{2}$/)).toBeTruthy()
  })
})

describe('o sino não relê sozinho (RF5)', () => {
  const MIL = 1_000
  const CINCO_MINUTOS_E_UM = 5 * 60 * MIL + MIL

  async function avancar(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  /** Foco e rede saem e voltam, pelos gerenciadores: um `focus` solto na janela nem um `online` solto fazem o TanStack reler. */
  async function sairEVoltar(tipo: 'foco' | 'rede'): Promise<void> {
    await act(async () => {
      if (tipo === 'foco') {
        focusManager.setFocused(false)
        focusManager.setFocused(true)
      } else {
        onlineManager.setOnline(false)
        onlineManager.setOnline(true)
      }
      await vi.advanceTimersByTimeAsync(50)
    })
  }

  it('com um material processando, 10 s ou mais depois: nenhuma leitura nova (o material se relê a cada 1,5 s na tela dele, e o sino não)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = fakeNetwork()
    instalar(rede, { ...COM_UM_ITEM, materiais: ok([MATERIAL('processando')]) })
    montar()
    await botao('Esperando você, 1')
    const antes = rede.chamadas.length
    await avancar(12 * MIL)
    expect(rede.chamadas).toHaveLength(antes)
  })

  it('com o dado velho (mais de 5 min), o foco sai e volta: nenhuma leitura, de nenhuma consulta, anos inclusive', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = fakeNetwork()
    instalar(rede, COM_UM_ITEM)
    montar()
    await botao('Esperando você, 1')
    const antes = rede.chamadas.length
    await avancar(CINCO_MINUTOS_E_UM)
    await sairEVoltar('foco')
    expect(rede.chamadas).toHaveLength(antes)
  })

  it('com o dado velho, a rede sai e volta: nenhuma leitura, de nenhuma consulta, anos inclusive', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = fakeNetwork()
    instalar(rede, COM_UM_ITEM)
    montar()
    await botao('Esperando você, 1')
    const antes = rede.chamadas.length
    await avancar(CINCO_MINUTOS_E_UM)
    await sairEVoltar('rede')
    expect(rede.chamadas).toHaveLength(antes)
  })

  it('o sino que monta depois de a tela já ter a leitura dos anos em erro não a relê: o "Tentar de novo" da tela continua de pé até o toque', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = fakeNetwork()
    let indisponivel = true
    instalar(rede, { ...TUDO_EM_DIA, anos: () => (indisponivel ? INDISPONIVEL : ok([ANO])) })
    const cliente = createQueryClient()
    cliente.mount()
    // A tela da Estrutura, que já leu os anos e falhou (uma tentativa automática, um segundo depois).
    const tela = new QueryObserver(cliente, anosLetivosQueryOptions)
    const largar = tela.subscribe(() => undefined)
    await avancar(2 * MIL)
    expect(tela.getCurrentResult().isError).toBe(true)
    // A rede volta, e só então o sino (lazy) chega: uma leitura de anos aqui tiraria o erro de debaixo do dedo de quem vai tocar.
    indisponivel = false
    const antes = caminhosDe(rede).filter((caminho) => caminho === '/v1/anos-letivos').length
    montar({ cliente })
    // Sem releitura, o sino continua dizendo que parte da lista não carregou (e não "nada"): é o erro dos anos que ele ainda vê.
    await screen.findByRole('button', { name: 'Esperando você, parte não carregou' })
    await avancar(2 * MIL)
    expect(screen.getByRole('button', { name: 'Esperando você, parte não carregou' })).toBeTruthy()
    expect(caminhosDe(rede).filter((caminho) => caminho === '/v1/anos-letivos')).toHaveLength(antes)
    expect(tela.getCurrentResult().isError).toBe(true)
    largar()
    cliente.unmount()
  })

  it('o sino que monta depois de a tela já ter em erro as outras cinco leituras (incidentes, professores, materiais, turmas e vínculos) não relê nenhuma', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = fakeNetwork()
    let indisponivel = true
    const quando = (resposta: FakeResponse) => (): FakeResponse => (indisponivel ? INDISPONIVEL : resposta)
    instalar(rede, {
      anos: ok([ANO]),
      incidentes: quando(TUDO_EM_DIA.incidentes as FakeResponse),
      professores: quando(ok([CAMILA])),
      materiais: quando(ok([MATERIAL('pronto')])),
      turmas: quando(ok([TURMA])),
      vinculos: quando(ok([VINCULO])),
    })
    const cliente = createQueryClient()
    cliente.mount()
    // As telas da área leem os anos (com dado, para turmas e vínculos terem ano em curso) e as outras cinco, que falham.
    const telas = [
      new QueryObserver(cliente, anosLetivosQueryOptions),
      new QueryObserver(cliente, incidentesQueryOptions),
      new QueryObserver(cliente, professoresQueryOptions),
      new QueryObserver(cliente, materiaisQueryOptions),
      new QueryObserver(cliente, turmasQueryOptions),
      new QueryObserver(cliente, vinculosQueryOptions),
    ]
    const largar = telas.map((tela) => tela.subscribe(() => undefined))
    await avancar(2 * MIL)
    expect(telas.map((tela) => tela.getCurrentResult().status)).toEqual(['success', 'error', 'error', 'error', 'error', 'error'])
    indisponivel = false
    const leiturasDe = () => LEITURAS_DA_FILA.map((caminho) => caminhosDe(rede).filter((chamado) => chamado === caminho).length)
    const antes = leiturasDe()
    montar({ cliente })
    await screen.findByRole('button', { name: /^Esperando você/ })
    await avancar(2 * MIL)
    expect(leiturasDe()).toEqual(antes)
    expect(telas.map((tela) => tela.getCurrentResult().status)).toEqual(['success', 'error', 'error', 'error', 'error', 'error'])
    for (const parar of largar) parar()
    cliente.unmount()
  })

  it('controle: a mesma consulta de anos, com a opção ligada, relê na volta do foco e na volta da rede (o teste enxerga a leitura que o sino evita)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    for (const tipo of ['foco', 'rede'] as const) {
      const rede = fakeNetwork()
      instalar(rede, TUDO_EM_DIA)
      const cliente = createQueryClient()
      cliente.mount()
      const observador = new QueryObserver(cliente, {
        ...anosLetivosQueryOptions,
        staleTime: 5 * 60 * MIL,
        refetchInterval: false,
        refetchOnWindowFocus: tipo === 'foco',
        refetchOnReconnect: tipo === 'rede',
      })
      const parar = observador.subscribe(() => undefined)
      await waitFor(() => expect(observador.getCurrentResult().isSuccess).toBe(true))
      const antes = rede.chamadas.length
      await avancar(CINCO_MINUTOS_E_UM)
      await sairEVoltar(tipo)
      expect(rede.chamadas.length).toBeGreaterThan(antes)
      parar()
      cliente.unmount()
    }
  })
})

describe('o que o sino lê ao voltar à área', () => {
  it('voltar à área dentro dos 5 minutos não relê nada: o dado ainda vale', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = fakeNetwork()
    instalar(rede, COM_UM_ITEM)
    const cliente = createQueryClient()
    const { desmontar } = montar({ cliente })
    await botao('Esperando você, 1')
    desmontar()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000)
    })
    const antes = rede.chamadas.length
    montar({ cliente })
    await botao('Esperando você, 1')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(rede.chamadas).toHaveLength(antes)
  })

  it('voltar à área com o dado de incidentes velho não o relê: é uma leitura por sessão, como a do aviso que fica montado na área', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = fakeNetwork()
    instalar(rede, COM_UM_ITEM)
    const cliente = createQueryClient()
    // O aviso de incidente da área é quem mantém a consulta viva (`gcTime`) enquanto o sino sai e volta; o dele é `Infinity`.
    const aviso = new QueryObserver(cliente, { ...incidentesQueryOptions, staleTime: Infinity })
    const largar = aviso.subscribe(() => undefined)
    const { desmontar } = montar({ cliente })
    await botao('Esperando você, 1')
    desmontar()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6 * 60_000)
    })
    const antes = rede.chamadas.length
    montar({ cliente })
    await botao('Esperando você, 1')
    await waitFor(() => expect(rede.chamadas.length).toBeGreaterThan(antes))
    expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho))).not.toContain('/v1/privacidade/incidentes')
    largar()
  })
})

describe('recomeço: a pessoa seguinte e a troca de escola', () => {
  it('a sessão que troca esvazia a fila: o item da escola A não aparece enquanto a B carrega, nem depois; e a hora da leitura de A sai', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(2026, 9, 16, 9, 0, 0) })
    const usuario = userEvent.setup({ advanceTimers: (ms) => void vi.advanceTimersByTime(ms) })
    const rede = fakeNetwork()
    let escola: 'A' | 'B' = 'A'
    let liberarB: (resposta: FakeResponse) => void = () => undefined
    const daB = new Promise<FakeResponse>((resolver) => (liberarB = resolver))
    instalar(rede, { ...TUDO_EM_DIA, professores: () => (escola === 'A' ? ok([CAMILA, PAULO]) : daB) })
    const { cliente } = montar()
    await botao('Esperando você, 1')

    // É o que `main.tsx` faz em toda sessão nova: `resetQueries`. O dado de A sai de cena antes de a leitura de B voltar.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60_000)
    })
    escola = 'B'
    void cliente.resetQueries()
    expect(await botao('Esperando você, carregando')).toBeTruthy()
    expect(document.body.textContent).not.toContain('Paulo Sintético')
    liberarB(ok([]))
    await usuario.click(await botao('Esperando você, nada'))
    expect(document.body.textContent).not.toContain('Paulo Sintético')
    // A hora é a da leitura de B, e não a de A (09:00).
    expect(within(screen.getByRole('dialog', { name: 'Esperando você' })).getByText('Atualizado às 09:03')).toBeTruthy()
  })
})

describe('"Tentar de novo" e "Atualizar" releem pela chave exata', () => {
  it('com a fila parcial, "Tentar de novo" relê só o que falhou; nada de auditado é lido', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let professoresFora = true
    instalar(rede, { ...TUDO_EM_DIA, materiais: ok([MATERIAL('falhou')]), professores: () => (professoresFora ? FORA : ok([CAMILA])) })
    // As leituras auditadas abertas (a lista da turma e os pedidos de titular) leram uma vez, ao abrir a tela delas.
    rede.responderPor(/\/v1\/turmas\/[^/]+\/lista/, ok([]))
    rede.responderPor(/\/v1\/turmas\/[^/]+\/reivindicacoes/, ok([]))
    rede.responderPor('/v1/privacidade/pedidos', ok([]))
    montar({ auditadas: true })

    await usuario.click(await botao('Esperando você, 1'))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).getByText('Parte da lista não carregou')).toBeTruthy()
    const antes = rede.chamadas.length

    professoresFora = false
    await usuario.click(within(painel).getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Esperando você' })).queryByText('Parte da lista não carregou')).toBeNull())
    const depois = rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho))
    expect(depois).toEqual(['/v1/professores'])
  })

  it('"Atualizar" relê as cinco leituras da lista, uma vez cada, e não toca na lista de nomes nem nos pedidos; o "Atualizado às" só muda depois do clique', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(2026, 9, 16, 9, 0, 0) })
    const usuario = userEvent.setup({ advanceTimers: (ms) => void vi.advanceTimersByTime(ms) })
    const rede = fakeNetwork()
    instalar(rede, COM_UM_ITEM)
    rede.responderPor(/\/v1\/turmas\/[^/]+\/lista/, ok([]))
    rede.responderPor(/\/v1\/turmas\/[^/]+\/reivindicacoes/, ok([]))
    rede.responderPor('/v1/privacidade/pedidos', ok([]))
    montar({ auditadas: true })
    await usuario.click(await botao('Esperando você, 1'))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).getByText('Atualizado às 09:00')).toBeTruthy()

    // O tempo passa, e o texto não acompanha: sem temporizador.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000)
    })
    expect(within(painel).getByText('Atualizado às 09:00')).toBeTruthy()

    const antes = rede.chamadas.length
    await usuario.click(within(painel).getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Esperando você' })).getByText('Atualizado às 09:02')).toBeTruthy())
    const lidas = rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho)).sort()
    expect(lidas).toEqual(['/v1/anos-letivos', '/v1/materiais', '/v1/professores', '/v1/turmas', '/v1/vinculos'])
  })

  it('"Tentar de novo" com turmas que vieram truncadas: relê só as turmas', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let truncada = true
    // Uma página com "há mais" depois da outra, até o teto de páginas da estrutura; depois, a lista inteira.
    instalar(rede, { ...TUDO_EM_DIA, turmas: () => (truncada ? ok([TURMA], { proxima: id(999) }) : ok([TURMA])) })
    montar()
    await usuario.click(await botao('Esperando você, parte não carregou'))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).getByText('Parte da lista não carregou')).toBeTruthy()
    const antes = rede.chamadas.length
    truncada = false
    await usuario.click(within(painel).getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Esperando você' })).queryByText('Parte da lista não carregou')).toBeNull())
    expect([...new Set(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho)))]).toEqual(['/v1/turmas'])
  })

  it('clique duplo em "Tentar de novo" e em "Atualizar": uma leitura por consulta, e não duas (o botão fica desligado enquanto a leitura corre)', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let truncada = true
    let seguraTurmas = false
    let seguraAnos = false
    let liberarTurmas: () => void = () => undefined
    let liberarAnos: () => void = () => undefined
    // A lista de turmas veio truncada: com o dado já na tela, a releitura não tira o aviso nem o botão (uma consulta que falhou, sim,
    // volta a "carregando" e o botão some), e é aí que o segundo clique chegaria.
    const turmas = async (): Promise<FakeResponse> => {
      if (seguraTurmas) await new Promise<void>((resolver) => (liberarTurmas = resolver))
      return truncada ? ok([TURMA], { proxima: id(999) }) : ok([TURMA])
    }
    const anos = async (): Promise<FakeResponse> => {
      if (seguraAnos) await new Promise<void>((resolver) => (liberarAnos = resolver))
      return ok([ANO])
    }
    instalar(rede, { ...TUDO_EM_DIA, anos, turmas })
    montar()
    await usuario.click(await botao('Esperando você, parte não carregou'))
    const painel = () => within(screen.getByRole('dialog', { name: 'Esperando você' }))
    expect(painel().getByText('Parte da lista não carregou')).toBeTruthy()

    seguraTurmas = true
    let antes = rede.chamadas.length
    await usuario.dblClick(painel().getByRole('button', { name: 'Tentar de novo' }))
    expect(painel().getByRole('button', { name: 'Tentando de novo…' }).hasAttribute('disabled')).toBe(true)
    expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho))).toEqual(['/v1/turmas'])
    seguraTurmas = false
    truncada = false
    liberarTurmas()
    await waitFor(() => expect(painel().queryByText('Parte da lista não carregou')).toBeNull())

    seguraAnos = true
    antes = rede.chamadas.length
    await usuario.dblClick(painel().getByRole('button', { name: 'Atualizar' }))
    expect(painel().getByRole('button', { name: 'Atualizando…' }).hasAttribute('disabled')).toBe(true)
    seguraAnos = false
    liberarAnos()
    await waitFor(() => expect(painel().getByRole('button', { name: 'Atualizar' })).toBeTruthy())
    expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho)).sort()).toEqual(['/v1/anos-letivos', '/v1/materiais', '/v1/professores', '/v1/turmas', '/v1/vinculos'])
  })

  it('"Atualizar" sem ano em curso relê só anos, professores e materiais: turmas e vínculos continuam sem ser chamados', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { ...TUDO_EM_DIA, anos: ok([{ ...ANO, situacao: 'planejado' }]), turmas: FORA, vinculos: FORA })
    montar()
    await usuario.click(await botao('Esperando você, nada'))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    const antes = rede.chamadas.length
    await usuario.click(within(painel).getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(rede.chamadas.length).toBeGreaterThan(antes))
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Esperando você' })).getByRole('button', { name: 'Atualizar' })).toBeTruthy())
    expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho)).sort()).toEqual(['/v1/anos-letivos', '/v1/materiais', '/v1/professores'])
  })

  it('"Tentar de novo" com a fila inteira em erro: o botão relê o que falhou, e a fila volta', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let fora = true
    const respostas = (resposta: FakeResponse) => () => (fora ? FORA : resposta)
    instalar(rede, {
      anos: respostas(ok([ANO])),
      incidentes: respostas(TUDO_EM_DIA.incidentes as FakeResponse),
      professores: respostas(ok([CAMILA, PAULO])),
      materiais: respostas(ok([])),
      turmas: respostas(ok([TURMA])),
      vinculos: respostas(ok([VINCULO])),
    })
    // As leituras auditadas abertas leram uma vez, ao abrir a tela delas; é em `erro` que os incidentes (`['privacidade']`) são relidos.
    rede.responderPor(/\/v1\/turmas\/[^/]+\/lista/, ok([]))
    rede.responderPor(/\/v1\/turmas\/[^/]+\/reivindicacoes/, ok([]))
    rede.responderPor('/v1/privacidade/pedidos', ok([]))
    montar({ auditadas: true })
    await usuario.click(await botao('Esperando você, não carregou'))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).queryByText('Tudo em dia')).toBeNull()
    const antes = rede.chamadas.length
    fora = false
    await usuario.click(within(painel).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('link', { name: /Refazer o convite de Paulo/ })).toBeTruthy()
    const relidas = rede.chamadas.slice(antes).map((chamada) => chamada.caminho)
    expect(relidas.length).toBeGreaterThan(0)
    expect(relidas.filter((caminho) => /\/lista|\/reivindicacoes|\/v1\/privacidade\/pedidos/.test(caminho))).toEqual([])
  })
})
