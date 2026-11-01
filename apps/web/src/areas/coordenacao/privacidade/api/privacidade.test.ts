import { focusManager, InfiniteQueryObserver, onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A lista dos pedidos de titular na web (F3, 16.0): cada leitura é auditada em nome da coordenação, e por isso nenhuma sai
 * sozinha (foco, rede) e a lista não fica guardada fora da tela. A rede é falsa; a regra sob teste é a da web. O módulo é
 * recarregado em cada teste, como uma aba recém-aberta.
 */
const importar = async () => ({ sessao: await import('../../../../api/sessao'), privacidade: await import('./privacidade') })
type Modulos = Awaited<ReturnType<typeof importar>>

const chamadas: { readonly caminho: string; readonly metodo: string }[] = []
let fila: { status: number; corpo?: unknown }[] = []
let m: Modulos

const ESPERA_MS = 20

beforeEach(async () => {
  chamadas.length = 0
  fila = []
  vi.resetModules()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (caminho: string, opcoes?: RequestInit) => {
      chamadas.push({ caminho, metodo: opcoes?.method ?? 'GET' })
      const preparada = fila.shift()
      if (preparada === undefined) throw new Error(`chamada sem resposta preparada: ${caminho}`)
      return new Response(preparada.corpo === undefined ? null : JSON.stringify(preparada.corpo), { status: preparada.status })
    }),
  )
  m = await importar()
  // A sessão aberta pelo cookie, como a aba faz ao chegar à área: o token fica em memória.
  fila.push({ status: 200, corpo: { token: 'token-de-acesso', expiraEm: new Date(Date.now() + 600_000).toISOString() } })
  await m.sessao.abrirSessaoPeloCookie()
  chamadas.length = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
  expect(fila, 'resposta preparada que nenhuma chamada consumiu').toHaveLength(0)
})

const esperar = () => new Promise((resolver) => setTimeout(resolver, ESPERA_MS))

describe('a lista dos pedidos de titular na web (F3, 16.0)', () => {
  it('a lista dos pedidos não relê ao voltar o foco nem ao voltar a rede', async () => {
    fila.push({ status: 200, corpo: { itens: [] } })
    const cliente = new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: false } } })
    cliente.mount()
    const observador = new InfiniteQueryObserver(cliente, m.privacidade.pedidosDoTitularQueryOptions)
    const desinscrever = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(chamadas).toHaveLength(1))
    // Com a leitura ainda no ar, o foco só pegaria carona nela: a leitura precisa ter chegado para o foco poder pedir outra.
    await vi.waitFor(() => expect(observador.getCurrentResult().isSuccess).toBe(true))

    focusManager.setFocused(false)
    focusManager.setFocused(true)
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
    await esperar()

    expect(chamadas).toHaveLength(1)
    desinscrever()
    cliente.unmount()
  })

  it('controle: com o foco ligado a mesma consulta relê', async () => {
    fila.push({ status: 200, corpo: { itens: [] } }, { status: 200, corpo: { itens: [] } })
    const cliente = new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: false } } })
    cliente.mount()
    const observador = new InfiniteQueryObserver(cliente, { ...m.privacidade.pedidosDoTitularQueryOptions, refetchOnWindowFocus: true })
    const desinscrever = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(chamadas).toHaveLength(1))
    // Com a leitura ainda no ar, o foco só pegaria carona nela: a leitura precisa ter chegado para o foco poder pedir outra.
    await vi.waitFor(() => expect(observador.getCurrentResult().isSuccess).toBe(true))

    focusManager.setFocused(false)
    focusManager.setFocused(true)

    await vi.waitFor(() => expect(chamadas).toHaveLength(2))
    desinscrever()
    cliente.unmount()
  })

  it('a lista dos pedidos não fica no cache depois que a aba sai', async () => {
    fila.push({ status: 200, corpo: { itens: [] } })
    const cliente = new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: false } } })
    cliente.mount()
    const observador = new InfiniteQueryObserver(cliente, m.privacidade.pedidosDoTitularQueryOptions)
    const desinscrever = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(chamadas).toHaveLength(1))
    await vi.waitFor(() => expect(observador.getCurrentResult().isSuccess).toBe(true))
    expect(cliente.getQueryCache().find({ queryKey: m.privacidade.pedidosDoTitularQueryOptions.queryKey })).toBeDefined()

    desinscrever()
    await esperar()

    expect(cliente.getQueryCache().find({ queryKey: m.privacidade.pedidosDoTitularQueryOptions.queryKey })).toBeUndefined()
    cliente.unmount()
  })
})

const PEDIDO = '0197f3b0-6f3e-7c11-9a3e-5d1c2b7a8e40'
const PEDIDO_DO_TITULAR = {
  id: PEDIDO,
  tipo: 'acesso',
  solicitante: 'titular',
  chegouEm: '2026-10-01',
  estado: 'em_preparacao',
  titular: { nome: 'Ana Souza', turmas: ['6º A'] },
  homonimo: null,
  nomeTrocado: null,
  compartilhamento: [],
  concluidoEm: null,
}

describe('o detalhe do pedido de titular na web (F3, 17.0)', () => {
  it('o detalhe não relê ao voltar o foco nem ao voltar a rede: cada leitura é auditada em nome da coordenação', async () => {
    fila.push({ status: 200, corpo: PEDIDO_DO_TITULAR })
    const cliente = new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: false } } })
    cliente.mount()
    const observador = new QueryObserver(cliente, m.privacidade.pedidoDoTitularQueryOptions(PEDIDO))
    const desinscrever = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(observador.getCurrentResult().isSuccess).toBe(true))
    expect(chamadas).toEqual([{ caminho: `/v1/privacidade/pedidos/${PEDIDO}`, metodo: 'GET' }])

    focusManager.setFocused(false)
    focusManager.setFocused(true)
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
    await esperar()

    expect(chamadas).toHaveLength(1)
    desinscrever()
    cliente.unmount()
  })

  it('o pedido do titular não fica no cache depois que a tela sai: nome e turma não ficam na memória do computador', async () => {
    fila.push({ status: 200, corpo: PEDIDO_DO_TITULAR })
    const cliente = new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: false } } })
    cliente.mount()
    const consulta = m.privacidade.pedidoDoTitularQueryOptions(PEDIDO)
    const observador = new QueryObserver(cliente, consulta)
    const desinscrever = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(observador.getCurrentResult().isSuccess).toBe(true))
    expect(cliente.getQueryCache().find({ queryKey: consulta.queryKey })).toBeDefined()

    desinscrever()
    await esperar()

    expect(cliente.getQueryCache().find({ queryKey: consulta.queryKey })).toBeUndefined()
    cliente.unmount()
  })

  it('cada ação é um POST na rota dela: concluir e cancelar, a correção do nome e o arquivo da escola', async () => {
    fila.push(
      { status: 204 },
      { status: 204 },
      { status: 204 },
      { status: 200, corpo: { url: 'http://127.0.0.1:28343/arquivos/x', nome: 'meus-dados-2026-10-10.json', validaAte: '2026-10-10T15:05:00.000Z' } },
    )
    await m.privacidade.concluirPedidoDoTitular(PEDIDO)
    await m.privacidade.cancelarPedidoDoTitular(PEDIDO)
    await m.privacidade.corrigirNomeDoTitular(PEDIDO, 'Ana Souza Lima')
    const arquivo = await m.privacidade.pedirArquivoDaEscola(PEDIDO, 'entregar_ao_titular')

    expect(chamadas).toEqual([
      { caminho: `/v1/privacidade/pedidos/${PEDIDO}/concluir`, metodo: 'POST' },
      { caminho: `/v1/privacidade/pedidos/${PEDIDO}/cancelar`, metodo: 'POST' },
      { caminho: `/v1/privacidade/pedidos/${PEDIDO}/corrigir-nome`, metodo: 'POST' },
      { caminho: `/v1/privacidade/pedidos/${PEDIDO}/arquivo`, metodo: 'POST' },
    ])
    expect(arquivo.nome).toBe('meus-dados-2026-10-10.json')
  })

  it('o nome novo e a finalidade vão no corpo da chamada, e nunca na URL', async () => {
    fila.push({ status: 204 }, { status: 200, corpo: { url: 'http://127.0.0.1:28343/arquivos/x', nome: 'meus-dados-2026-10-10.json', validaAte: '2026-10-10T15:05:00.000Z' } })
    await m.privacidade.corrigirNomeDoTitular(PEDIDO, 'Ana Souza Lima')
    await m.privacidade.pedirArquivoDaEscola(PEDIDO, 'entregar_ao_responsavel_legal')

    // A primeira chamada do `fetch` é a abertura da sessão do `beforeEach`, que não faz parte do que se mede.
    const corpos = vi
      .mocked(fetch)
      .mock.calls.slice(1)
      .map(([, opcoes]) => (typeof opcoes?.body === 'string' ? (JSON.parse(opcoes.body) as unknown) : undefined))
    expect(corpos).toEqual([{ nome: 'Ana Souza Lima' }, { finalidade: 'entregar_ao_responsavel_legal' }])
    expect(chamadas.every(({ caminho }) => !caminho.includes('Ana') && !caminho.includes('entregar'))).toBe(true)
  })

  it('o id do pedido vai escapado no caminho: o que vem do endereço da aba não muda a rota da API', async () => {
    fila.push({ status: 204 })
    await m.privacidade.concluirPedidoDoTitular('../auditoria?x=1')

    expect(chamadas).toEqual([{ caminho: '/v1/privacidade/pedidos/..%2Fauditoria%3Fx%3D1/concluir', metodo: 'POST' }])
  })

  it('depois da ação, a página relê e o estado que aparece é o do servidor', async () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: false } } })
    cliente.mount()
    fila.push(
      { status: 200, corpo: PEDIDO_DO_TITULAR },
      { status: 200, corpo: { ...PEDIDO_DO_TITULAR, estado: 'concluido', concluidoEm: '2026-10-10T15:00:00.000Z' } },
    )
    const observador = new QueryObserver(cliente, m.privacidade.pedidoDoTitularQueryOptions(PEDIDO))
    const desinscrever = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(observador.getCurrentResult().isSuccess).toBe(true))

    await m.privacidade.relerPedidoDoTitular(cliente, PEDIDO)

    expect(observador.getCurrentResult().data?.estado).toBe('concluido')
    desinscrever()
    cliente.unmount()
  })
})
