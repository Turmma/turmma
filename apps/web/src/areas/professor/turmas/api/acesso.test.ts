import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O acesso da turma na web (A1, 15.0): a leitura, o gerar e o revogar, com a sessão do professor, e o link e o código
 * fora do cache. A rede é falsa; a regra sob teste é a da web. O módulo é recarregado em cada teste, como uma aba
 * recém-aberta.
 */
const importar = async () => ({ sessao: await import('../../../../api/sessao'), acesso: await import('./acesso') })
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

const TURMA = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5'
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde'
const CODIGO = 'ABCD2345'
const EXPIRA_EM = '2026-10-09T12:00:00.000Z'
const gerado = { token: TOKEN, codigo: CODIGO, expiraEm: EXPIRA_EM }

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

describe('o acesso da turma (A1, 15.0)', () => {
  it('ler, gerar e revogar vão às rotas da turma com a sessão; no pedido vai só a validade, e nada do link nem do código vai na URL', async () => {
    fila.push({ status: 200, corpo: { expiraEm: EXPIRA_EM } }, { status: 201, corpo: gerado }, { status: 204 })
    const cliente = new QueryClient()
    expect(await cliente.fetchQuery(m.acesso.acessoDaTurmaQueryOptions(TURMA))).toEqual({ expiraEm: EXPIRA_EM })
    expect(await m.acesso.gerarAcesso(TURMA, { validadeDias: 30 })).toEqual(gerado)
    expect(await m.acesso.revogarAcesso(TURMA)).toBeUndefined()
    expect(chamadas).toEqual([
      { caminho: `/v1/turmas/${TURMA}/acesso`, metodo: 'GET', corpo: undefined, autorizacao: 'Bearer token-de-acesso' },
      { caminho: `/v1/turmas/${TURMA}/acesso`, metodo: 'POST', corpo: { validadeDias: 30 }, autorizacao: 'Bearer token-de-acesso' },
      { caminho: `/v1/turmas/${TURMA}/acesso/revogar`, metodo: 'POST', corpo: {}, autorizacao: 'Bearer token-de-acesso' },
    ])
  })

  it('a leitura sem acesso vigente traz null, e cada turma tem a chave dela no cache', async () => {
    fila.push({ status: 200, corpo: { expiraEm: null } })
    const cliente = new QueryClient()
    expect(await cliente.fetchQuery(m.acesso.acessoDaTurmaQueryOptions(TURMA))).toEqual({ expiraEm: null })
    expect(m.acesso.acessoDaTurmaQueryOptions(TURMA).queryKey).toEqual(['acesso-da-turma', TURMA])
    expect(m.acesso.acessoDaTurmaQueryOptions('outra').queryKey).not.toEqual(m.acesso.acessoDaTurmaQueryOptions(TURMA).queryKey)
  })

  it('a resposta fora do contrato não chega à tela: a leitura com o link ou o código, o gerar com campo a mais ou com o código fora do alfabeto', async () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    // A leitura nunca traz o link nem o código: se um dia trouxer, a tela não os guarda no cache de consultas.
    fila.push({ status: 200, corpo: { expiraEm: EXPIRA_EM, codigo: CODIGO } })
    await expect(cliente.fetchQuery(m.acesso.acessoDaTurmaQueryOptions(TURMA))).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
    fila.push({ status: 201, corpo: { ...gerado, alunos: ['Nome de aluno'] } })
    await expect(m.acesso.gerarAcesso(TURMA, { validadeDias: 7 })).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
    // O `0` e o `O` não estão no alfabeto do código.
    fila.push({ status: 201, corpo: { ...gerado, codigo: 'ABCD0O45' } })
    await expect(m.acesso.gerarAcesso(TURMA, { validadeDias: 7 })).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
  })
})

describe('link e código fora do cache (regra 20, item 8)', () => {
  /** Tudo o que o cache de mutações guarda, em texto: é onde o token e o código poderiam sobrar. */
  const guardadoNoCache = (cliente: QueryClient) => JSON.stringify(cliente.getMutationCache().getAll().map((mutacao) => mutacao.state))
  /** O coletor do cache roda num `setTimeout` de `gcTime`; com 0, na próxima volta do laço. */
  const depoisDoColetor = () => new Promise((resolver) => setTimeout(resolver, 5))

  it('fechado o diálogo (reset), nenhuma entrada do MutationCache guarda o link nem o código', async () => {
    fila.push({ status: 201, corpo: gerado })
    const cliente = new QueryClient()
    // O diálogo aberto: a mutação do gerar, com um observador inscrito, como o `useMutation` montado.
    const observador = new MutationObserver(cliente, m.acesso.mutacaoDoGerarAcesso(TURMA))
    const desinscrever = observador.subscribe(() => undefined)
    await observador.mutate({ validadeDias: 7 })
    expect(observador.getCurrentResult().data).toEqual(gerado)
    // Com o diálogo aberto os dois estão lá: a asserção de depois é sobre o fechar, e não sobre um cache que nunca os teve.
    expect(guardadoNoCache(cliente)).toContain(TOKEN)
    expect(guardadoNoCache(cliente)).toContain(CODIGO)

    // Fechar: `reset()` e o diálogo desmontado.
    observador.reset()
    desinscrever()
    await depoisDoColetor()
    expect(guardadoNoCache(cliente)).not.toContain(TOKEN)
    expect(guardadoNoCache(cliente)).not.toContain(CODIGO)
    expect(cliente.getMutationCache().getAll()).toEqual([])
  })

  it('o diálogo que sai sem o reset (a sessão venceu com ele aberto) também não deixa o link nem o código no MutationCache', async () => {
    fila.push({ status: 201, corpo: gerado })
    const cliente = new QueryClient()
    const observador = new MutationObserver(cliente, m.acesso.mutacaoDoGerarAcesso(TURMA))
    const desinscrever = observador.subscribe(() => undefined)
    await observador.mutate({ validadeDias: 1 })
    expect(guardadoNoCache(cliente)).toContain(CODIGO)
    // Só o desmonte, sem `reset()`: é o `gcTime: 0` que tira a resposta do cache.
    desinscrever()
    await depoisDoColetor()
    expect(guardadoNoCache(cliente)).not.toContain(TOKEN)
    expect(guardadoNoCache(cliente)).not.toContain(CODIGO)
    expect(cliente.getMutationCache().getAll()).toEqual([])
  })

  it('a resposta do gerar que chega depois de o diálogo fechar também não fica no MutationCache', async () => {
    let responder: (resposta: Response) => void = () => undefined
    const pedidoSaiu = new Promise<void>((saiu) => {
      vi.mocked(fetch).mockImplementationOnce(() => {
        saiu()
        return new Promise<Response>((resolver) => (responder = resolver))
      })
    })
    const cliente = new QueryClient()
    const observador = new MutationObserver(cliente, m.acesso.mutacaoDoGerarAcesso(TURMA))
    const desinscrever = observador.subscribe(() => undefined)
    const noAr = observador.mutate({ validadeDias: 7 }).catch(() => undefined)
    await pedidoSaiu
    // O professor fecha com o pedido no ar ("Fechar sem copiar"): o diálogo some antes da resposta.
    observador.reset()
    desinscrever()
    await depoisDoColetor()
    // Ainda no ar, a mutação fica no cache (o coletor espera ela terminar); é a resposta que não pode sobrar nele.
    expect(cliente.getMutationCache().getAll()).toHaveLength(1)
    responder(new Response(JSON.stringify(gerado), { status: 201 }))
    await noAr
    await depoisDoColetor()
    expect(guardadoNoCache(cliente)).not.toContain(TOKEN)
    expect(guardadoNoCache(cliente)).not.toContain(CODIGO)
    expect(cliente.getMutationCache().getAll()).toEqual([])
  })

  it('a releitura da seção roda quando o gerar termina, dê certo ou não, e o gerar só termina depois dela', async () => {
    const ordem: string[] = []
    const recarregar = vi.fn(async () => {
      ordem.push('releitura')
    })
    fila.push({ status: 409, corpo: { erro: { codigo: 'CONFLITO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }, { status: 201, corpo: gerado })
    const cliente = new QueryClient()
    await expect(new MutationObserver(cliente, m.acesso.mutacaoDoGerarAcesso(TURMA, recarregar)).mutate({ validadeDias: 7 })).rejects.toMatchObject({ codigo: 'CONFLITO' })
    expect(recarregar).toHaveBeenCalledTimes(1)
    await new MutationObserver(cliente, m.acesso.mutacaoDoGerarAcesso(TURMA, recarregar)).mutate({ validadeDias: 7 }).then(() => ordem.push('link na tela'))
    expect(recarregar).toHaveBeenCalledTimes(2)
    // O link só aparece com a seção já relida: fechado o diálogo, o que está atrás dele é o estado de agora.
    expect(ordem).toEqual(['releitura', 'releitura', 'link na tela'])
  })
})
