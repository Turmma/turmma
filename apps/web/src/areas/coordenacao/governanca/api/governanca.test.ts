import { InfiniteQueryObserver, QueryObserver, type QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../../../api/query-client'

/**
 * As consultas do resumo da governança (correção 2026-11-09-recomeco-na-mesma-aba-no-celular). A rede é a falsa: só a `authedGet`
 * muda, e o cliente de consultas, as duas consultas e o `resetQueries` da sessão nova são os de verdade.
 */
const leituras: string[] = []
const VAZIO = { numeros: { geradoPorIa: 0, aprovadoPorPessoa: 0, rejeitado: 0, esperando: 0 }, itens: [] }
const DA_ESCOLA = { numeros: { geradoPorIa: 3, aprovadoPorPessoa: 1, rejeitado: 0, esperando: 2 }, itens: [] }
let resposta: unknown = VAZIO

vi.mock('../../../../api/sessao', async (importarOriginal) => ({
  ...(await importarOriginal<object>()),
  authedGet: vi.fn(async (caminho: string) => {
    leituras.push(caminho)
    await new Promise((fim) => setTimeout(fim, 5))
    return structuredClone(resposta)
  }),
}))

const { primeiraPaginaDoResumoQueryOptions, resumoDaGovernancaQueryOptions } = await import('./governanca')

const NO_AUTO_REFETCH = { refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const

let cliente: QueryClient
const largar: Array<() => void> = []

beforeEach(() => {
  leituras.length = 0
  resposta = VAZIO
  cliente = createQueryClient()
})
afterEach(() => {
  for (const fim of largar.splice(0)) fim()
  cliente.clear()
})

/** Espera a consulta do observador sair de `pending` e de `fetching`. */
async function lida(observador: { getCurrentResult: () => { isFetching: boolean; isPending: boolean } }): Promise<void> {
  await vi.waitFor(() => {
    const atual = observador.getCurrentResult()
    expect(atual.isPending || atual.isFetching).toBe(false)
  })
}

describe('a primeira página do Painel e a lista da Governança', () => {
  it('não dividem consulta: o Painel que relê depois do reset da sessão nova não embrulha o dado na lista da Governança', async () => {
    // A pessoa A abre Registros › IA: a Governança lê a lista, e a aba larga a tela quando ela sai.
    const governancaDeA = new InfiniteQueryObserver(cliente, resumoDaGovernancaQueryOptions)
    const largarA = governancaDeA.subscribe(() => undefined)
    await lida(governancaDeA)
    largarA()

    // A sessão da pessoa B entra na mesma aba: o Painel dela está na tela quando o cache é esvaziado (`main.tsx`, `aoTrocarDeSessao`).
    resposta = DA_ESCOLA
    const painelDeB = new QueryObserver(cliente, { ...primeiraPaginaDoResumoQueryOptions, ...NO_AUTO_REFETCH })
    largar.push(painelDeB.subscribe(() => undefined))
    await cliente.resetQueries()
    await lida(painelDeB)

    // Depois a pessoa B abre a IA. O que a Governança tem para mostrar tem de ser lista de itens, e nunca uma linha `undefined`.
    const governancaDeB = new InfiniteQueryObserver(cliente, resumoDaGovernancaQueryOptions)
    largar.push(governancaDeB.subscribe(() => undefined))
    await lida(governancaDeB)
    const paginas = governancaDeB.getCurrentResult().data?.pages ?? []
    expect(paginas.length).toBeGreaterThan(0)
    for (const pagina of paginas) expect(Array.isArray(pagina.itens)).toBe(true)
    expect(paginas.flatMap((pagina) => pagina.itens)).not.toContain(undefined)
    expect(paginas.at(-1)?.numeros).toEqual(DA_ESCOLA.numeros)
  })

  it('o Painel lido primeiro e a Governança depois: a Governança lê a lista dela, no formato de lista, e não herda a página do Painel', async () => {
    resposta = DA_ESCOLA
    const painel = new QueryObserver(cliente, { ...primeiraPaginaDoResumoQueryOptions, ...NO_AUTO_REFETCH })
    largar.push(painel.subscribe(() => undefined))
    await lida(painel)

    const governanca = new InfiniteQueryObserver(cliente, resumoDaGovernancaQueryOptions)
    largar.push(governanca.subscribe(() => undefined))
    await lida(governanca)
    const paginas = governanca.getCurrentResult().data?.pages ?? []
    expect(paginas).toHaveLength(1)
    expect(paginas[0]?.itens).toEqual([])
    // A chave da Governança é só dela: a leitura dela é uma leitura a mais, e a do Painel continua sendo a página.
    expect(leituras).toEqual(['/v1/governanca/resumo', '/v1/governanca/resumo'])
    expect(cliente.getQueryData(primeiraPaginaDoResumoQueryOptions.queryKey)).toEqual(DA_ESCOLA)
  })

  it('o Painel lê uma página só, a primeira, e guarda os números como a API os devolveu', async () => {
    resposta = DA_ESCOLA
    const painel = new QueryObserver(cliente, { ...primeiraPaginaDoResumoQueryOptions, ...NO_AUTO_REFETCH })
    largar.push(painel.subscribe(() => undefined))
    await lida(painel)
    expect(leituras).toEqual(['/v1/governanca/resumo'])
    expect(painel.getCurrentResult().data?.numeros).toEqual(DA_ESCOLA.numeros)
  })
})
