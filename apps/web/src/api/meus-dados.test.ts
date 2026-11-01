import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * "Meus dados" do aluno e do professor na web (F3, 18.0): a resposta é de uma pessoa sobre ela mesma e não fica na memória
 * do computador compartilhado depois que a tela sai, e cada clique de baixar é um `POST` registrado na escola. A rede é
 * falsa; a regra sob teste é a da web. O módulo é recarregado em cada teste, como uma aba recém-aberta.
 */
const importar = async () => ({ sessao: await import('./sessao'), meusDados: await import('./meus-dados') })
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
  expect(fila, 'resposta preparada que nenhuma chamada consumiu').toHaveLength(0)
})

const esperar = () => new Promise((resolver) => setTimeout(resolver, ESPERA_MS))

const PEDIDO = '0197f3b0-6f3e-7c11-9a3e-5d1c2b7a8e40'
const RESPOSTA = {
  pedidos: [{ id: PEDIDO, tipo: 'acesso', estado: 'em_preparacao', chegouEm: '2026-10-10', arquivo: null }],
  categorias: [{ categoria: 'conversa_tutor', quantidade: 4 }],
}
const ARQUIVO = { url: 'http://127.0.0.1:28343/arquivos/x', nome: 'meus-dados-2026-10-10.json', validaAte: '2026-10-10T15:05:00.000Z' }

describe('os meus dados na web (F3, 18.0)', () => {
  it('a leitura é um GET na rota da própria pessoa, sem o id dela no caminho', async () => {
    fila.push({ status: 200, corpo: RESPOSTA })
    const cliente = new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: false } } })
    cliente.mount()
    const observador = new QueryObserver(cliente, m.meusDados.meusDadosQueryOptions)
    const desinscrever = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(observador.getCurrentResult().isSuccess).toBe(true))

    expect(chamadas).toEqual([{ caminho: '/v1/meus-dados', metodo: 'GET' }])
    expect(observador.getCurrentResult().data?.pedidos[0]?.estado).toBe('em_preparacao')
    desinscrever()
    cliente.unmount()
  })

  it('a resposta não fica no cache depois que a tela sai: o que a escola guarda da pessoa não fica na memória do computador', async () => {
    fila.push({ status: 200, corpo: RESPOSTA })
    const cliente = new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: false } } })
    cliente.mount()
    const observador = new QueryObserver(cliente, m.meusDados.meusDadosQueryOptions)
    const desinscrever = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(observador.getCurrentResult().isSuccess).toBe(true))
    expect(cliente.getQueryCache().find({ queryKey: m.meusDados.MEUS_DADOS_QUERY_KEY })).toBeDefined()

    desinscrever()
    await esperar()

    expect(cliente.getQueryCache().find({ queryKey: m.meusDados.MEUS_DADOS_QUERY_KEY })).toBeUndefined()
    cliente.unmount()
  })

  it('baixar é um POST na rota do pedido, com corpo vazio, e o id vai escapado no caminho', async () => {
    fila.push({ status: 200, corpo: ARQUIVO }, { status: 200, corpo: ARQUIVO })
    const arquivo = await m.meusDados.baixarMeuArquivo(PEDIDO)
    await m.meusDados.baixarMeuArquivo('../auditoria?x=1')

    expect(arquivo.nome).toBe('meus-dados-2026-10-10.json')
    expect(chamadas).toEqual([
      { caminho: `/v1/meus-dados/${PEDIDO}/baixar`, metodo: 'POST' },
      { caminho: '/v1/meus-dados/..%2Fauditoria%3Fx%3D1/baixar', metodo: 'POST' },
    ])
    // A primeira chamada do `fetch` é a abertura da sessão do `beforeEach`, que não faz parte do que se mede.
    const corpos = vi
      .mocked(fetch)
      .mock.calls.slice(1)
      .map(([, opcoes]) => (typeof opcoes?.body === 'string' ? (JSON.parse(opcoes.body) as unknown) : undefined))
    expect(corpos).toEqual([{}, {}])
  })

  it('depois que o arquivo saiu, a página relê e o estado que aparece é o do servidor', async () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: false } } })
    cliente.mount()
    const apagado = { ...RESPOSTA.pedidos[0], estado: 'pronto', arquivo: { situacao: 'expirado', expiraEm: '2026-10-09T15:00:00.000Z' } }
    fila.push({ status: 200, corpo: RESPOSTA }, { status: 200, corpo: { ...RESPOSTA, pedidos: [apagado] } })
    const observador = new QueryObserver(cliente, m.meusDados.meusDadosQueryOptions)
    const desinscrever = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(observador.getCurrentResult().isSuccess).toBe(true))

    await m.meusDados.relerMeusDados(cliente)

    expect(observador.getCurrentResult().data?.pedidos[0]?.arquivo?.situacao).toBe('expirado')
    desinscrever()
    cliente.unmount()
  })
})
