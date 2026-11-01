import { MAXIMA_PAGINA_DO_PAINEL } from '@educa/shared'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A API do painel na web: a página e a ordem da barra, o `GET` da lista com elas, e as criações com o id do pedido. A rede
 * é falsa; a regra sob teste é a da web. O módulo é recarregado em cada teste, como uma aba recém-aberta.
 */
const importar = async () => ({ sessao: await import('./sessao'), painel: await import('./painel') })
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

const ESCOLA = {
  id: '5b1d7a3e-2c4f-4a8b-9d6e-1f0a2b3c4d5e',
  nome: 'Colégio sintético',
  slug: 'colegio-sintetico',
  rede: { id: '3f2a8c1e-6b7d-4e9a-8c21-5d4f0e9b7a61', nome: 'Rede sintética' },
  estado: 'sem_convite',
  turmas: 0,
  professores: 0,
  alunos: 0,
}

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
      const resposta = fila.shift()
      if (resposta === undefined) throw new Error(`chamada sem resposta preparada: ${caminho}`)
      return new Response(resposta.corpo === undefined ? null : JSON.stringify(resposta.corpo), { status: resposta.status })
    }),
  )
  m = await importar()
  // A sessão aberta pelo cookie, como a aba faz ao chegar a `/operacao`: o token fica em memória.
  fila.push({ status: 200, corpo: { token: 'token-de-acesso', expiraEm: new Date(Date.now() + 600_000).toISOString() } })
  await m.sessao.abrirSessaoDeOperadorPeloCookie()
  chamadas.length = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
  expect(fila, 'resposta preparada que nenhuma chamada consumiu').toHaveLength(0)
})

describe('a página e a ordem da barra de endereço (Tech Spec da A0b, seção 9)', () => {
  it('lê a página e a ordem da query string, e a busca escrita volta à mesma consulta', () => {
    expect(m.painel.lerConsultaDaTela('pagina=3&ordem=uso')).toEqual({ pagina: 3, ordem: 'uso' })
    expect(m.painel.lerConsultaDaTela('?ordem=nome&pagina=2')).toEqual({ pagina: 2, ordem: 'nome' })
    expect(m.painel.buscaDaConsulta({ pagina: 3, ordem: 'uso' })).toBe('pagina=3&ordem=uso')
    expect(m.painel.lerConsultaDaTela(m.painel.buscaDaConsulta({ pagina: 7, ordem: 'uso' }))).toEqual({ pagina: 7, ordem: 'uso' })
  })

  it('o que não é página nem ordem do contrato volta ao padrão daquele campo, sem levar o resto junto', () => {
    expect(m.painel.lerConsultaDaTela('')).toEqual({ pagina: 1, ordem: 'nome' })
    for (const pagina of ['0', '-1', '2.5', 'abc', '1e3', ' 2', '02', String(MAXIMA_PAGINA_DO_PAINEL + 1)]) {
      expect(m.painel.lerConsultaDaTela(`pagina=${encodeURIComponent(pagina)}&ordem=uso`)).toEqual({ pagina: 1, ordem: 'uso' })
    }
    expect(m.painel.lerConsultaDaTela(`pagina=${String(MAXIMA_PAGINA_DO_PAINEL)}`)).toEqual({ pagina: MAXIMA_PAGINA_DO_PAINEL, ordem: 'nome' })
    expect(m.painel.lerConsultaDaTela('pagina=4&ordem=USO')).toEqual({ pagina: 4, ordem: 'nome' })
    expect(m.painel.lerConsultaDaTela('pagina=4&ordem=alunos')).toEqual({ pagina: 4, ordem: 'nome' })
  })

  it('o GET da lista leva a página e a ordem da tela, com o token da sessão, e cada consulta tem a sua chave de cache', async () => {
    const resposta = { itens: [ESCOLA], pagina: 2, total: 26 }
    fila.push({ status: 200, corpo: resposta })
    const cliente = new QueryClient()
    const opcoes = m.painel.dasEscolasQueryOptions({ pagina: 2, ordem: 'uso' })
    expect(await cliente.fetchQuery(opcoes)).toEqual(resposta)
    expect(chamadas).toEqual([{ caminho: '/v1/operacao/escolas?pagina=2&ordem=uso', metodo: 'GET', corpo: undefined, autorizacao: 'Bearer token-de-acesso' }])
    expect(opcoes.queryKey).not.toEqual(m.painel.dasEscolasQueryOptions({ pagina: 2, ordem: 'nome' }).queryKey)
    expect(opcoes.queryKey).not.toEqual(m.painel.dasEscolasQueryOptions({ pagina: 1, ordem: 'uso' }).queryKey)
    // A criação invalida todas as páginas das duas ordens pelo prefixo.
    expect(opcoes.queryKey.slice(0, m.painel.ESCOLAS_QUERY_KEY.length)).toEqual([...m.painel.ESCOLAS_QUERY_KEY])
  })

  it('a resposta fora do contrato (um campo de pessoa a mais) não chega à tela', async () => {
    fila.push({ status: 200, corpo: { itens: [{ ...ESCOLA, coordenadora: 'Nome de pessoa' }], pagina: 1, total: 1 } })
    await expect(new QueryClient().fetchQuery(m.painel.dasEscolasQueryOptions({ pagina: 1, ordem: 'nome' }))).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
  })
})

describe('o uso por escola (tarefa 8.0)', () => {
  const USO = {
    id: ESCOLA.id,
    nome: ESCOLA.nome,
    dia: { requisicoes: 10, jobs: 2, bytesStorage: 1024 },
    mes: { requisicoes: 300, jobs: 40, bytesStorage: 2048 },
  }

  it('o GET do uso leva a página e a ordem da tela, com o token da sessão, e cada consulta tem a sua chave, fora da da lista', async () => {
    const resposta = { itens: [USO], pagina: 2, total: 26, dia: '2026-09-23', mes: '2026-09' }
    fila.push({ status: 200, corpo: resposta })
    const opcoes = m.painel.doUsoQueryOptions({ pagina: 2, ordem: 'uso' })
    expect(await new QueryClient().fetchQuery(opcoes)).toEqual(resposta)
    expect(chamadas).toEqual([{ caminho: '/v1/operacao/uso?pagina=2&ordem=uso', metodo: 'GET', corpo: undefined, autorizacao: 'Bearer token-de-acesso' }])
    expect(opcoes.queryKey).not.toEqual(m.painel.doUsoQueryOptions({ pagina: 2, ordem: 'nome' }).queryKey)
    expect(opcoes.queryKey).not.toEqual(m.painel.doUsoQueryOptions({ pagina: 1, ordem: 'uso' }).queryKey)
    // A criação da escola invalida todas as páginas do uso pelo prefixo; e o uso não se confunde com a lista da mesma página.
    expect(opcoes.queryKey.slice(0, m.painel.USO_QUERY_KEY.length)).toEqual([...m.painel.USO_QUERY_KEY])
    expect(opcoes.queryKey).not.toEqual(m.painel.dasEscolasQueryOptions({ pagina: 2, ordem: 'uso' }).queryKey)
  })

  it('a resposta do uso fora do contrato (um campo de pessoa a mais, ou sem o dia de referência) não chega à tela', async () => {
    fila.push({ status: 200, corpo: { itens: [{ ...USO, coordenadora: 'Nome de pessoa' }], pagina: 1, total: 1, dia: '2026-09-23', mes: '2026-09' } })
    await expect(new QueryClient().fetchQuery(m.painel.doUsoQueryOptions({ pagina: 1, ordem: 'nome' }))).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
    fila.push({ status: 200, corpo: { itens: [USO], pagina: 1, total: 1 } })
    await expect(new QueryClient().fetchQuery(m.painel.doUsoQueryOptions({ pagina: 1, ordem: 'nome' }))).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
  })

  it('as páginas do total: ao menos uma, e a 26ª escola abre a segunda', () => {
    expect(m.painel.paginasDoTotal(0)).toBe(1)
    expect(m.painel.paginasDoTotal(1)).toBe(1)
    expect(m.painel.paginasDoTotal(25)).toBe(1)
    expect(m.painel.paginasDoTotal(26)).toBe(2)
    expect(m.painel.paginasDoTotal(30)).toBe(2)
  })
})

describe('as criações com o id do pedido', () => {
  it('criar rede e criar escola mandam o pedido inteiro, com o id que veio do diálogo', async () => {
    const rede = { id: '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d', nome: 'Rede sintética', tipo: 'grupo' as const }
    const escola = { id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', redeId: rede.id, nome: 'Colégio sintético', slug: 'colegio-sintetico' }
    fila.push({ status: 200, corpo: { id: rede.id } }, { status: 200, corpo: { id: escola.id } })
    expect(await m.painel.criarRedeNoPainel(rede)).toEqual({ id: rede.id })
    expect(await m.painel.criarEscolaNoPainel(escola)).toEqual({ id: escola.id })
    expect(chamadas).toEqual([
      { caminho: '/v1/operacao/redes', metodo: 'POST', corpo: rede, autorizacao: 'Bearer token-de-acesso' },
      { caminho: '/v1/operacao/escolas', metodo: 'POST', corpo: escola, autorizacao: 'Bearer token-de-acesso' },
    ])
  })

  it('o CONFLITO do endereço e o 429 com o Retry-After sobem como erro tipado, sem a tela ler texto da API', async () => {
    const escola = { id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', redeId: '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d', nome: 'Colégio', slug: 'colegio' }
    const envelope = (codigo: string) => ({ erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
    fila.push({ status: 409, corpo: envelope('CONFLITO') })
    await expect(m.painel.criarEscolaNoPainel(escola)).rejects.toMatchObject({ codigo: 'CONFLITO' })
    vi.mocked(fetch).mockImplementationOnce(async () => new Response(JSON.stringify(envelope('LIMITE_EXCEDIDO')), { status: 429, headers: { 'Retry-After': '12' } }))
    await expect(m.painel.criarEscolaNoPainel(escola)).rejects.toMatchObject({ codigo: 'LIMITE_EXCEDIDO', esperaSegundos: 12 })
  })
})

describe('o convite da coordenação (tarefa 7.0)', () => {
  const ESCOLA_ID = ESCOLA.id
  const CONVITE_ID = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5'
  const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde'
  const pedido = { nome: 'Coordenadora sintética', email: 'coordenadora@escola.invalid' }

  it('gerar, refazer e revogar vão às rotas da API com a sessão; o token e o e-mail nunca vão na URL', async () => {
    fila.push({ status: 200, corpo: { conviteId: CONVITE_ID, token: TOKEN } }, { status: 200, corpo: { conviteId: CONVITE_ID, token: TOKEN } }, { status: 204 })
    expect(await m.painel.gerarConviteNoPainel(ESCOLA_ID, pedido)).toEqual({ conviteId: CONVITE_ID, token: TOKEN })
    expect(await m.painel.refazerConviteNoPainel(CONVITE_ID)).toEqual({ conviteId: CONVITE_ID, token: TOKEN })
    expect(await m.painel.revogarConviteNoPainel(CONVITE_ID)).toBeUndefined()
    expect(chamadas).toEqual([
      { caminho: `/v1/operacao/escolas/${ESCOLA_ID}/convite-coordenacao`, metodo: 'POST', corpo: pedido, autorizacao: 'Bearer token-de-acesso' },
      { caminho: `/v1/operacao/convites/${CONVITE_ID}/refazer`, metodo: 'POST', corpo: {}, autorizacao: 'Bearer token-de-acesso' },
      { caminho: `/v1/operacao/convites/${CONVITE_ID}/revogar`, metodo: 'POST', corpo: {}, autorizacao: 'Bearer token-de-acesso' },
    ])
  })

  it('a resposta do gerar fora do contrato (um campo de pessoa a mais) não chega ao diálogo', async () => {
    fila.push({ status: 200, corpo: { conviteId: CONVITE_ID, token: TOKEN, email: pedido.email } })
    await expect(m.painel.gerarConviteNoPainel(ESCOLA_ID, pedido)).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
  })

  /** Tudo o que o cache de mutações guarda, em texto: é onde o token (e o nome e o e-mail do pedido) poderiam sobrar. */
  const guardadoNoCache = (cliente: QueryClient) => JSON.stringify(cliente.getMutationCache().getAll().map((mutacao) => mutacao.state))
  /** O coletor do cache roda num `setTimeout` de `gcTime`; com 0, na próxima volta do laço. */
  const depoisDoColetor = () => new Promise((resolver) => setTimeout(resolver, 5))

  it('token fora do cache: fechado o diálogo (reset), nenhuma entrada do MutationCache guarda o token, nem o e-mail do pedido', async () => {
    fila.push({ status: 200, corpo: { conviteId: CONVITE_ID, token: TOKEN } })
    const cliente = new QueryClient()
    // O diálogo aberto: a mutação do gerar, com um observador inscrito, como o `useMutation` montado.
    const observador = new MutationObserver(cliente, m.painel.mutacaoDoGerarConvite(ESCOLA_ID))
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
    expect(cliente.getMutationCache().getAll()).toEqual([])
  })

  it('token fora do cache: a resposta que chega depois de o diálogo fechar também não fica no MutationCache', async () => {
    let responder: (resposta: Response) => void = () => undefined
    const pedidoSaiu = new Promise<void>((saiu) => {
      vi.mocked(fetch).mockImplementationOnce(() => {
        saiu()
        return new Promise<Response>((resolver) => (responder = resolver))
      })
    })
    const cliente = new QueryClient()
    const observador = new MutationObserver(cliente, m.painel.mutacaoDoRefazerConvite(CONVITE_ID))
    const desinscrever = observador.subscribe(() => undefined)
    const noAr = observador.mutate().catch(() => undefined)
    await pedidoSaiu
    // O operador fecha com o pedido no ar ("Fechar sem copiar"): o diálogo some antes da resposta.
    observador.reset()
    desinscrever()
    await depoisDoColetor()
    // Ainda no ar, a mutação fica no cache (o coletor espera ela terminar); é a resposta que não pode sobrar nele.
    expect(cliente.getMutationCache().getAll()).toHaveLength(1)
    responder(new Response(JSON.stringify({ conviteId: CONVITE_ID, token: TOKEN }), { status: 200 }))
    await noAr
    await depoisDoColetor()
    expect(guardadoNoCache(cliente)).not.toContain(TOKEN)
    expect(cliente.getMutationCache().getAll()).toEqual([])
  })

  it('as duas mutações que trazem o token saem do cache logo que ninguém as observa (gcTime 0), também com o recarregar da lista que o diálogo acrescenta', async () => {
    const recarregar = vi.fn(async () => undefined)
    for (const opcoes of [
      m.painel.mutacaoDoGerarConvite(ESCOLA_ID),
      m.painel.mutacaoDoRefazerConvite(CONVITE_ID),
      m.painel.mutacaoDoGerarConvite(ESCOLA_ID, recarregar),
      m.painel.mutacaoDoRefazerConvite(CONVITE_ID, recarregar),
    ]) {
      expect(opcoes.gcTime).toBe(0)
    }
    // O recarregar roda quando o pedido termina, dê certo ou não: o CONFLITO também deixa a lista velha.
    fila.push({ status: 409, corpo: { erro: { codigo: 'CONFLITO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
    const cliente = new QueryClient()
    const observador = new MutationObserver(cliente, m.painel.mutacaoDoRefazerConvite(CONVITE_ID, recarregar))
    await expect(observador.mutate()).rejects.toMatchObject({ codigo: 'CONFLITO' })
    expect(recarregar).toHaveBeenCalledTimes(1)
  })
})
