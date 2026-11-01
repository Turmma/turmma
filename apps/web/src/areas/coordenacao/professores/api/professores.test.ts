import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Os professores da escola na web (A1, 14.0): a lista, o cadastro, o refazer e o revogar, com a sessão da coordenação, e
 * o token do convite fora do cache. A rede é falsa; a regra sob teste é a da web. O módulo é recarregado em cada teste,
 * como uma aba recém-aberta.
 */
const importar = async () => ({ sessao: await import('../../../../api/sessao'), professores: await import('./professores') })
type Modulos = Awaited<ReturnType<typeof importar>>

interface Chamada {
  readonly caminho: string
  readonly metodo: string
  readonly corpo: unknown
  readonly autorizacao: string | undefined
}

const chamadas: Chamada[] = []
let fila: { status: number; corpo?: unknown }[] = []
let m: Modulos

const USUARIO = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5'
const CONVITE = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f6'
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde'
const pedido = { nome: 'Professora sintética', email: 'professora@escola.invalid' }
const resposta = { usuarioId: USUARIO, conviteId: CONVITE, token: TOKEN }

beforeEach(async () => {
  chamadas.length = 0
  fila = []
  vi.resetModules()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (caminho: string, opcoes?: RequestInit) => {
      const cabecalhos = new Headers(opcoes?.headers)
      chamadas.push({
        caminho,
        metodo: opcoes?.method ?? 'GET',
        corpo: typeof opcoes?.body === 'string' ? (JSON.parse(opcoes.body) as unknown) : undefined,
        autorizacao: cabecalhos.get('Authorization') ?? undefined,
      })
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

describe('os professores da escola (A1, 14.0)', () => {
  it('cadastrar, refazer e revogar vão às rotas da API com a sessão; o token e o e-mail nunca vão na URL, e a escola nunca vai no pedido', async () => {
    fila.push({ status: 201, corpo: resposta }, { status: 201, corpo: resposta }, { status: 204 })
    expect(await m.professores.cadastrarProfessor(pedido)).toEqual(resposta)
    expect(await m.professores.refazerConviteDoProfessor(USUARIO)).toEqual(resposta)
    expect(await m.professores.revogarConviteDoProfessor(USUARIO)).toBeUndefined()
    expect(chamadas).toEqual([
      { caminho: '/v1/professores', metodo: 'POST', corpo: pedido, autorizacao: 'Bearer token-de-acesso' },
      { caminho: `/v1/professores/${USUARIO}/convite/refazer`, metodo: 'POST', corpo: {}, autorizacao: 'Bearer token-de-acesso' },
      { caminho: `/v1/professores/${USUARIO}/convite/revogar`, metodo: 'POST', corpo: {}, autorizacao: 'Bearer token-de-acesso' },
    ])
  })

  it('a resposta do cadastro fora do contrato (um campo de pessoa a mais, ou o token fora do formato) não chega ao diálogo', async () => {
    fila.push({ status: 201, corpo: { ...resposta, email: pedido.email } })
    await expect(m.professores.cadastrarProfessor(pedido)).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
    fila.push({ status: 201, corpo: { ...resposta, token: 'curto' } })
    await expect(m.professores.cadastrarProfessor(pedido)).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
  })

  it('a lista vem da rota paginada, com a sessão, e fica na chave da estrutura, que a troca de escola esvazia', async () => {
    const item = { usuarioId: USUARIO, nome: pedido.nome, estado: 'pendente' }
    fila.push({ status: 200, corpo: { itens: [item] } })
    const cliente = new QueryClient()
    expect(await cliente.fetchQuery(m.professores.professoresQueryOptions)).toEqual({ itens: [item], completa: true })
    expect(chamadas).toEqual([{ caminho: '/v1/professores?limite=100', metodo: 'GET', corpo: undefined, autorizacao: 'Bearer token-de-acesso' }])
    expect(m.professores.professoresQueryOptions.queryKey).toEqual(['estrutura', 'professores'])
  })
})

describe('link fora do cache (regra 20, item 8)', () => {
  /** Tudo o que o cache de mutações guarda, em texto: é onde o token (e o nome e o e-mail do pedido) poderiam sobrar. */
  const guardadoNoCache = (cliente: QueryClient) => JSON.stringify(cliente.getMutationCache().getAll().map((mutacao) => mutacao.state))
  /** O coletor do cache roda num `setTimeout` de `gcTime`; com 0, na próxima volta do laço. */
  const depoisDoColetor = () => new Promise((resolver) => setTimeout(resolver, 5))

  it('fechado o diálogo do cadastro (reset), nenhuma entrada do MutationCache guarda o link, nem o nome e o e-mail do pedido', async () => {
    fila.push({ status: 201, corpo: resposta })
    const cliente = new QueryClient()
    // O diálogo aberto: a mutação do cadastro, com um observador inscrito, como o `useMutation` montado.
    const observador = new MutationObserver(cliente, m.professores.mutacaoDoCadastroDeProfessor())
    const desinscrever = observador.subscribe(() => undefined)
    await observador.mutate(pedido)
    expect(observador.getCurrentResult().data?.token).toBe(TOKEN)
    // Com o diálogo aberto o link está lá: a asserção de depois é sobre o fechar, e não sobre um cache que nunca o teve.
    expect(guardadoNoCache(cliente)).toContain(TOKEN)

    // Fechar: `reset()` e o diálogo desmontado.
    observador.reset()
    desinscrever()
    await depoisDoColetor()
    expect(guardadoNoCache(cliente)).not.toContain(TOKEN)
    expect(guardadoNoCache(cliente)).not.toContain(pedido.email)
    expect(guardadoNoCache(cliente)).not.toContain(pedido.nome)
    expect(cliente.getMutationCache().getAll()).toEqual([])
  })

  it('o diálogo que sai sem o reset (a sessão venceu com ele aberto) também não deixa o link no MutationCache', async () => {
    fila.push({ status: 201, corpo: resposta })
    const cliente = new QueryClient()
    const observador = new MutationObserver(cliente, m.professores.mutacaoDoRefazerConviteDoProfessor(USUARIO))
    const desinscrever = observador.subscribe(() => undefined)
    await observador.mutate()
    expect(guardadoNoCache(cliente)).toContain(TOKEN)
    // Só o desmonte, sem `reset()`: é o `gcTime: 0` que tira a resposta do cache.
    desinscrever()
    await depoisDoColetor()
    expect(guardadoNoCache(cliente)).not.toContain(TOKEN)
    expect(cliente.getMutationCache().getAll()).toEqual([])
  })

  it('a resposta do refazer que chega depois de o diálogo fechar também não fica no MutationCache', async () => {
    let responder: (resposta: Response) => void = () => undefined
    const pedidoSaiu = new Promise<void>((saiu) => {
      vi.mocked(fetch).mockImplementationOnce(() => {
        saiu()
        return new Promise<Response>((resolver) => (responder = resolver))
      })
    })
    const cliente = new QueryClient()
    const observador = new MutationObserver(cliente, m.professores.mutacaoDoRefazerConviteDoProfessor(USUARIO))
    const desinscrever = observador.subscribe(() => undefined)
    const noAr = observador.mutate().catch(() => undefined)
    await pedidoSaiu
    // A coordenação fecha com o pedido no ar ("Fechar sem copiar"): o diálogo some antes da resposta.
    observador.reset()
    desinscrever()
    await depoisDoColetor()
    // Ainda no ar, a mutação fica no cache (o coletor espera ela terminar); é a resposta que não pode sobrar nele.
    expect(cliente.getMutationCache().getAll()).toHaveLength(1)
    responder(new Response(JSON.stringify(resposta), { status: 201 }))
    await noAr
    await depoisDoColetor()
    expect(guardadoNoCache(cliente)).not.toContain(TOKEN)
    expect(cliente.getMutationCache().getAll()).toEqual([])
  })

  it('o recarregar da lista que a tela acrescenta roda quando o pedido termina, dê certo ou não', async () => {
    const recarregar = vi.fn(async () => undefined)
    fila.push({ status: 409, corpo: { erro: { codigo: 'CONFLITO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }, { status: 201, corpo: resposta })
    const cliente = new QueryClient()
    await expect(new MutationObserver(cliente, m.professores.mutacaoDoRefazerConviteDoProfessor(USUARIO, recarregar)).mutate()).rejects.toMatchObject({ codigo: 'CONFLITO' })
    expect(recarregar).toHaveBeenCalledTimes(1)
    await new MutationObserver(cliente, m.professores.mutacaoDoCadastroDeProfessor(recarregar)).mutate(pedido)
    expect(recarregar).toHaveBeenCalledTimes(2)
  })
})
