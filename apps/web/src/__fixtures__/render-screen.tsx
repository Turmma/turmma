import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeAll, vi } from 'vitest'
import { createQueryClient } from '../api/query-client'
import { abrirSessaoPeloCookie } from '../api/sessao'

/**
 * O que o teste de componente da web usa (correção `2026-10-12-teste-de-componente`). O arquivo de teste declara o ambiente
 * dele na primeira linha, `// @vitest-environment jsdom`: o projeto `unidade` roda no Node, e só quem renderiza uma peça
 * paga o `jsdom`.
 *
 * Aqui a **rede** é falsa (a API está fora da web) e todo o resto é o código de verdade: o cliente de consultas é o da
 * aba (`createQueryClient`), a sessão é a do módulo `api/sessao`, e a peça faz as chamadas que faria no navegador.
 * Peça nossa que o teste trocasse por um dublê esconderia justamente o que ele quer ver (regra 40).
 */

/** A resposta que a API daria. Sem `corpo`, a resposta vem vazia, como o 204. */
export interface FakeResponse {
  readonly status: number
  readonly corpo?: unknown
}

/** O que a peça pediu à API, na ordem: o caminho, o método e a credencial com que foi. O corpo fica de fora. */
export interface RecordedCall {
  readonly caminho: string
  readonly metodo: string
  /** O `Authorization` da chamada. Sem sessão aberta, `undefined`: a chamada sairia anônima. */
  readonly autorizacao: string | undefined
}

const TEST_TOKEN = 'token-de-teste'
/** O `Authorization` da sessão que `setupScreen` abre, para o teste conferir que a peça chamou a API com ela. */
export const TEST_AUTHORIZATION = `Bearer ${TEST_TOKEN}`

export interface FakeNetwork {
  /** Tudo o que a peça pediu desde que a rede foi instalada. */
  readonly chamadas: readonly RecordedCall[]
  /** A resposta da **próxima** chamada que ainda não tem uma. */
  responder(resposta: FakeResponse): void
  /**
   * A resposta de **toda** chamada cujo caminho (com a consulta) casa, na hora que ela chega: a ordem não importa. É o que
   * serve à tela que lê em paralelo (a fila do sino faz seis leituras de uma vez), em que a fila de respostas viraria
   * sorteio. Sem consumir: vale até o fim do caso. A resposta pode ser uma função, que recebe o caminho da própria chamada (com a consulta), para mudar entre uma chamada e outra, e a função pode devolver uma promessa para segurar a chamada.
   */
  responderPor(casa: string | RegExp, resposta: FakeResponse | ((caminho: string) => FakeResponse | Promise<FakeResponse>)): void
  /**
   * A próxima chamada fica no ar, sem resposta, até `liberar`: é o jeito de ver a tela carregando, e a resposta que chega
   * depois do que a pessoa já fez.
   */
  segurar(): { liberar(resposta: FakeResponse): void }
}

/**
 * Instala a rede falsa no `fetch` global. `setupScreen` a tira depois de cada teste. Chamada sem resposta preparada
 * estoura com o caminho dela: a peça que pede o que o caso não esperava fica vermelha, em vez de ficar esperando.
 */
export function fakeNetwork(): FakeNetwork {
  const chamadas: RecordedCall[] = []
  const fila: (FakeResponse | Promise<FakeResponse>)[] = []
  const porCaminho: { readonly casa: string | RegExp; readonly resposta: FakeResponse | ((caminho: string) => FakeResponse | Promise<FakeResponse>) }[] = []
  const casaCom = (casa: string | RegExp, caminho: string) => (typeof casa === 'string' ? caminho === casa || caminho.startsWith(`${casa}?`) : casa.test(caminho))
  vi.stubGlobal(
    'fetch',
    vi.fn(async (caminho: string, opcoes?: RequestInit) => {
      chamadas.push({ caminho, metodo: opcoes?.method ?? 'GET', autorizacao: new Headers(opcoes?.headers).get('Authorization') ?? undefined })
      const doCaminho = porCaminho.find(({ casa }) => casaCom(casa, caminho))
      const preparada = doCaminho === undefined ? fila.shift() : typeof doCaminho.resposta === 'function' ? doCaminho.resposta(caminho) : doCaminho.resposta
      if (preparada === undefined) throw new Error(`chamada à API sem resposta preparada: ${caminho}`)
      const resposta = await preparada
      return new Response(resposta.corpo === undefined ? null : JSON.stringify(resposta.corpo), { status: resposta.status })
    }),
  )
  return {
    chamadas,
    responder: (resposta) => void fila.push(resposta),
    responderPor: (casa, resposta) => void porCaminho.push({ casa, resposta }),
    segurar: () => {
      let liberar: (resposta: FakeResponse) => void = () => undefined
      fila.push(new Promise<FakeResponse>((resolver) => (liberar = resolver)))
      return { liberar: (resposta) => liberar(resposta) }
    },
  }
}

/**
 * Prepara o arquivo de teste de tela: abre a sessão uma vez, como a aba faz ao chegar à área (a peça chama a API com o
 * token em memória), e, depois de cada caso, desmonta a tela e tira a rede falsa. Sem a desmontagem, a tela do caso
 * anterior continua no documento (a `testing-library` só a limpa sozinha com `globals`, que a unidade não liga). Chame no
 * corpo do arquivo, antes dos `describe`.
 */
export function setupScreen(): void {
  beforeAll(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token: TEST_TOKEN, expiraEm: new Date(Date.now() + 600_000).toISOString() }), { status: 200 })),
    )
    await abrirSessaoPeloCookie()
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })
}

/** A tela renderizada dentro do cliente de consultas da aba, um novo a cada chamada: o cache de um caso não passa ao outro. */
export function renderScreen(tela: ReactElement): RenderResult {
  return render(<QueryClientProvider client={createQueryClient()}>{tela}</QueryClientProvider>)
}
