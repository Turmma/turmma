import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A leitura da lista de nomes da turma na web (telas do professor, 12.0; RF18): o caminho que a web chama, a página seguinte, e o
 * que fica na memória da aba. A rede é falsa; a regra sob teste é a da web. O módulo é recarregado em cada teste, como uma aba
 * recém-aberta.
 */
const importar = async () => ({ sessao: await import('./sessao'), alunos: await import('./alunos-da-turma') })
type Modulos = Awaited<ReturnType<typeof importar>>

interface Chamada {
  readonly caminho: string
  readonly metodo: string
  readonly autorizacao: string | undefined
}

const chamadas: Chamada[] = []
let fila: { status: number; corpo?: unknown }[] = []
let m: Modulos

const TURMA = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5'
const aluno = (final: string, nome: string) => ({ usuarioId: `0192a4c0-5b1e-7c3d-8e4f-0000000000${final}`, nome })
const ANA = aluno('01', 'Ana sintética')
const BRUNO = aluno('02', 'Bruno sintético')
const CAIO = aluno('03', 'Caio sintético')

const clienteDeTeste = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

beforeEach(async () => {
  chamadas.length = 0
  fila = []
  vi.resetModules()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (caminho: string, opcoes?: RequestInit) => {
      chamadas.push({ caminho, metodo: opcoes?.method ?? 'GET', autorizacao: new Headers(opcoes?.headers).get('Authorization') ?? undefined })
      const preparada = fila.shift()
      if (preparada === undefined) throw new Error(`chamada sem resposta preparada: ${caminho}`)
      return new Response(preparada.corpo === undefined ? null : JSON.stringify(preparada.corpo), { status: preparada.status })
    }),
  )
  m = await importar()
  fila.push({ status: 200, corpo: { token: 'token-de-acesso', expiraEm: new Date(Date.now() + 600_000).toISOString() } })
  await m.sessao.abrirSessaoPeloCookie()
  chamadas.length = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
  expect(fila, 'resposta preparada que nenhuma chamada consumiu').toHaveLength(0)
})

describe('a consulta da lista de nomes da turma', () => {
  it('a chave começa por `alunos-da-turma` e leva a turma: é por ela que a troca de sessão e a decisão de um pedido alcançam a lista', () => {
    expect(m.alunos.alunosDaTurmaQueryOptions(TURMA).queryKey).toEqual(['alunos-da-turma', TURMA])
    expect(m.alunos.alunosDaTurmaQueryOptions('outra-turma').queryKey).not.toEqual(m.alunos.alunosDaTurmaQueryOptions(TURMA).queryKey)
  })

  it('lê a turma do professor de cem em cem, sem `anoLetivoId` nem finalidade, com a credencial da sessão; a página seguinte leva a `pagina` que a anterior mandou', async () => {
    const cliente = clienteDeTeste()
    cliente.mount()
    fila.push({ status: 200, corpo: { itens: [BRUNO, ANA], proxima: ANA.usuarioId } })
    const observador = new InfiniteQueryObserver(cliente, m.alunos.alunosDaTurmaQueryOptions(TURMA))
    const largar = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(observador.getCurrentResult().data?.pages).toHaveLength(1))
    expect(observador.getCurrentResult().hasNextPage).toBe(true)

    fila.push({ status: 200, corpo: { itens: [CAIO] } })
    await observador.fetchNextPage()
    expect(observador.getCurrentResult().hasNextPage).toBe(false)
    expect(observador.getCurrentResult().data?.pages.flatMap((pagina) => pagina.itens)).toEqual([BRUNO, ANA, CAIO])
    expect(chamadas).toEqual([
      { caminho: `/v1/turmas/${TURMA}/alunos?limite=100`, metodo: 'GET', autorizacao: 'Bearer token-de-acesso' },
      { caminho: `/v1/turmas/${TURMA}/alunos?limite=100&pagina=${ANA.usuarioId}`, metodo: 'GET', autorizacao: 'Bearer token-de-acesso' },
    ])
    for (const { caminho } of chamadas) {
      expect(caminho).not.toContain('anoLetivoId')
      expect(caminho).not.toContain('finalidade')
    }
    largar()
    cliente.unmount()
  })

  it('fora da tela a lista não fica guardada (`gcTime: 0`): sem observador, o cache não guarda nome nenhum', async () => {
    const cliente = clienteDeTeste()
    cliente.mount()
    fila.push({ status: 200, corpo: { itens: [ANA] } })
    const observador = new InfiniteQueryObserver(cliente, m.alunos.alunosDaTurmaQueryOptions(TURMA))
    const largar = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(observador.getCurrentResult().data?.pages).toHaveLength(1))
    expect(JSON.stringify(cliente.getQueryCache().getAll().map((consulta) => consulta.state.data))).toContain('Ana sintética')

    largar()
    await vi.waitFor(() => expect(cliente.getQueryCache().findAll({ queryKey: ['alunos-da-turma'] })).toHaveLength(0))
    expect(JSON.stringify(cliente.getQueryCache().getAll().map((consulta) => consulta.state.data))).not.toContain('Ana sintética')
    cliente.unmount()
  })

  it('o id da turma vai no caminho já codificado, e a resposta com campo a mais é recusada (o contrato é estrito)', async () => {
    const cliente = clienteDeTeste()
    cliente.mount()
    fila.push({ status: 200, corpo: { itens: [{ ...ANA, matricula: '123' }] } })
    const observador = new InfiniteQueryObserver(cliente, m.alunos.alunosDaTurmaQueryOptions('a/b'))
    const largar = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(observador.getCurrentResult().isError).toBe(true))
    expect(chamadas[0]?.caminho).toBe('/v1/turmas/a%2Fb/alunos?limite=100')
    largar()
    cliente.unmount()
  })
})
