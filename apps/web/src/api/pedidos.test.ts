import { InfiniteQueryObserver, QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Os pedidos de nome na web (A1, 16.0): a leitura de cada papel, a decisão e o que a lista faz depois dela. A rede é
 * falsa; a regra sob teste é a da web. O módulo é recarregado em cada teste, como uma aba recém-aberta.
 */
const importar = async () => ({ sessao: await import('./sessao'), pedidos: await import('./pedidos'), alunos: await import('./alunos-da-turma') })
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
const pedido = (final: string, nome: string) => ({ id: `0192a4c0-5b1e-7c3d-8e4f-0000000000${final}`, nome, solicitadaEm: '2026-10-02T13:00:00.000Z', teveMatriculaErrada: false })
const ANA = pedido('01', 'Ana sintética')
const BRUNO = pedido('02', 'Bruno sintético')
const CAIO = pedido('03', 'Caio sintético')
const INDISPONIVEL = { status: 503, corpo: { erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }

/** Um cliente como o da tela, sem a nova tentativa automática: o teste diz cada resposta. */
const clienteDeTeste = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

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

describe('a leitura dos pedidos, por quem decide (A1, 16.0)', () => {
  it('o professor lê sem finalidade; a coordenação manda a finalidade de conferência de cadastro; os dois pedem a página inteira, com a sessão', async () => {
    fila.push({ status: 200, corpo: { itens: [ANA] } }, { status: 200, corpo: { itens: [ANA, BRUNO] } })
    const cliente = clienteDeTeste()
    expect(await cliente.fetchQuery(m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'professor'))).toEqual({ itens: [ANA] })
    expect(await cliente.fetchQuery(m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'coordenacao'))).toEqual({ itens: [ANA, BRUNO] })
    expect(chamadas).toEqual([
      { caminho: `/v1/turmas/${TURMA}/reivindicacoes?limite=100`, metodo: 'GET', corpo: undefined, autorizacao: 'Bearer token-de-acesso' },
      { caminho: `/v1/turmas/${TURMA}/reivindicacoes?limite=100&finalidade=conferencia_de_cadastro`, metodo: 'GET', corpo: undefined, autorizacao: 'Bearer token-de-acesso' },
    ])
  })

  it('a lista que o professor leu não é a da coordenação: cada papel e cada turma têm a chave deles no cache', () => {
    const { pedidosDaTurmaQueryOptions } = m.pedidos
    expect(pedidosDaTurmaQueryOptions(TURMA, 'professor').queryKey).toEqual(['pedidos-da-turma', TURMA, 'professor'])
    expect(pedidosDaTurmaQueryOptions(TURMA, 'coordenacao').queryKey).not.toEqual(pedidosDaTurmaQueryOptions(TURMA, 'professor').queryKey)
    expect(pedidosDaTurmaQueryOptions('outra', 'professor').queryKey).not.toEqual(pedidosDaTurmaQueryOptions(TURMA, 'professor').queryKey)
  })

  it('a tela do professor lê ao abrir; a da coordenação não lê nada sozinha, nem quando a sessão volta a valer, e só lê quando ela pede', async () => {
    const cliente = clienteDeTeste()
    cliente.mount()
    fila.push({ status: 200, corpo: { itens: [ANA] } })
    const doProfessor = new QueryObserver(cliente, m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'professor'))
    const largarProfessor = doProfessor.subscribe(() => undefined)
    await vi.waitFor(() => expect(doProfessor.getCurrentResult().data).toEqual({ itens: [ANA] }))
    largarProfessor()
    chamadas.length = 0

    const daCoordenacao = new QueryObserver(cliente, m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'coordenacao'))
    const largarCoordenacao = daCoordenacao.subscribe(() => undefined)
    // O que o `main.tsx` faz quando a sessão volta a valer e quando ela troca: nenhum dos dois lê pela coordenação.
    await cliente.invalidateQueries()
    await cliente.resetQueries({ queryKey: m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'coordenacao').queryKey })
    expect(chamadas).toEqual([])
    expect(daCoordenacao.getCurrentResult().data).toBeUndefined()

    fila.push({ status: 200, corpo: { itens: [BRUNO] } })
    await daCoordenacao.refetch()
    expect(daCoordenacao.getCurrentResult().data).toEqual({ itens: [BRUNO] })
    expect(chamadas).toHaveLength(1)
    largarCoordenacao()
    cliente.unmount()
  })

  it('a lista não fica guardada depois de a tela sair, nem a da coordenação nem a do professor', async () => {
    const cliente = clienteDeTeste()
    fila.push({ status: 200, corpo: { itens: [ANA] } }, { status: 200, corpo: { itens: [ANA] } })
    for (const quem of ['professor', 'coordenacao'] as const) {
      const observador = new QueryObserver(cliente, { ...m.pedidos.pedidosDaTurmaQueryOptions(TURMA, quem), enabled: false })
      const largar = observador.subscribe(() => undefined)
      await observador.refetch()
      largar()
    }
    // O coletor do cache roda num `setTimeout` de `gcTime`; com 0, na próxima volta do laço.
    await new Promise((resolver) => setTimeout(resolver, 5))
    expect(cliente.getQueryData(m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'coordenacao').queryKey)).toBeUndefined()
    expect(cliente.getQueryData(m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'professor').queryKey)).toBeUndefined()
  })

  it('a resposta fora do contrato não chega à tela: o pedido com matrícula, ou com campo a mais', async () => {
    const cliente = clienteDeTeste()
    fila.push({ status: 200, corpo: { itens: [{ ...ANA, matricula: '2026001' }] } })
    await expect(cliente.fetchQuery(m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'professor'))).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
  })
})

describe('a decisão e a lista depois dela (A1, 16.0)', () => {
  it('decidir manda os ids e a decisão, e nada de escola nem de turma', async () => {
    const resposta = { resultados: [{ id: ANA.id, resultado: 'decidida' }] }
    fila.push({ status: 200, corpo: resposta })
    expect(await m.pedidos.decidirPedidos({ ids: [ANA.id], decisao: 'aprovar' })).toEqual(resposta)
    expect(chamadas).toEqual([{ caminho: '/v1/reivindicacoes/decidir', metodo: 'POST', corpo: { ids: [ANA.id], decisao: 'aprovar' }, autorizacao: 'Bearer token-de-acesso' }])
  })

  it('todo id da resposta sai da lista na hora, qualquer que seja o resultado, sem leitura nova da coordenação', async () => {
    const cliente = clienteDeTeste()
    cliente.mount()
    const { queryKey } = m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'coordenacao')
    // A tela da coordenação montada, com a lista que ela pediu no "Atualizar".
    const daCoordenacao = new QueryObserver(cliente, m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'coordenacao'))
    const largar = daCoordenacao.subscribe(() => undefined)
    fila.push({ status: 200, corpo: { itens: [ANA, BRUNO, CAIO, pedido('04', 'Dani sintética')] } })
    await daCoordenacao.refetch()
    chamadas.length = 0
    await m.pedidos.aplicarDecisao(cliente, TURMA, 'coordenacao', {
      resultados: [
        { id: ANA.id, resultado: 'decidida' },
        { id: BRUNO.id, resultado: 'ja_decidida' },
        { id: CAIO.id, resultado: 'nao_encontrada' },
      ],
    })
    expect(daCoordenacao.getCurrentResult().data).toEqual({ itens: [pedido('04', 'Dani sintética')] })
    // Tempo para uma releitura sair, se saísse: nenhuma sai.
    await new Promise((resolver) => setTimeout(resolver, 20))
    expect(chamadas).toEqual([])
    expect(cliente.getQueryData(queryKey)).toEqual({ itens: [pedido('04', 'Dani sintética')] })
    largar()
    cliente.unmount()
  })

  it('resposta atrasada: a leitura que estava no ar antes da decisão não traz de volta o pedido decidido', async () => {
    const cliente = clienteDeTeste()
    const { queryKey } = m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'coordenacao')
    cliente.setQueryData(queryKey, { itens: [ANA, BRUNO] })
    // A leitura sai antes da decisão e fica no ar: o servidor a respondeu com os dois pedidos ainda pendentes.
    let responder: (resposta: Response) => void = () => undefined
    const leituraSaiu = new Promise<void>((saiu) => {
      vi.mocked(fetch).mockImplementationOnce(() => {
        saiu()
        return new Promise<Response>((resolver) => (responder = resolver))
      })
    })
    const noAr = cliente.fetchQuery({ ...m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'coordenacao'), staleTime: 0 }).catch(() => undefined)
    await leituraSaiu

    await m.pedidos.aplicarDecisao(cliente, TURMA, 'coordenacao', { resultados: [{ id: ANA.id, resultado: 'decidida' }] })
    responder(new Response(JSON.stringify({ itens: [ANA, BRUNO] }), { status: 200 }))
    await noAr
    expect(cliente.getQueryData(queryKey)).toEqual({ itens: [BRUNO] })
  })

  it('para o professor a lista ainda é relida depois da decisão; se a releitura cai, o pedido decidido continua fora dela', async () => {
    const cliente = clienteDeTeste()
    cliente.mount()
    const { queryKey } = m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'professor')
    fila.push({ status: 200, corpo: { itens: [ANA, BRUNO] } })
    const observador = new QueryObserver(cliente, m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'professor'))
    const largar = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(observador.getCurrentResult().data).toEqual({ itens: [ANA, BRUNO] }))
    chamadas.length = 0

    fila.push(INDISPONIVEL)
    await m.pedidos.aplicarDecisao(cliente, TURMA, 'professor', { resultados: [{ id: ANA.id, resultado: 'decidida' }] })
    await vi.waitFor(() => expect(observador.getCurrentResult().isError).toBe(true))
    expect(chamadas.map(({ caminho }) => caminho)).toEqual([`/v1/turmas/${TURMA}/reivindicacoes?limite=100`])
    expect(cliente.getQueryData(queryKey)).toEqual({ itens: [BRUNO] })
    largar()
    cliente.unmount()
  })

  it('depois da decisão que falha, a lista do professor é relida, e a da coordenação sai da tela sem leitura nenhuma', async () => {
    const cliente = clienteDeTeste()
    cliente.mount()
    fila.push({ status: 200, corpo: { itens: [ANA, BRUNO] } })
    const doProfessor = new QueryObserver(cliente, m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'professor'))
    const largarProfessor = doProfessor.subscribe(() => undefined)
    await vi.waitFor(() => expect(doProfessor.getCurrentResult().data).toEqual({ itens: [ANA, BRUNO] }))
    // Um erro no meio do lote: o primeiro pedido já foi decidido no servidor, e a releitura mostra só o que continua.
    // Enquanto ela não volta, a lista de antes fica na tela, e o diálogo aberto continua com os nomes.
    let responder: (resposta: Response) => void = () => undefined
    const releituraSaiu = new Promise<void>((saiu) => {
      vi.mocked(fetch).mockImplementationOnce(() => {
        saiu()
        return new Promise<Response>((resolver) => (responder = resolver))
      })
    })
    const descartada = m.pedidos.descartarListaDepoisDaFalha(cliente, TURMA, 'professor')
    await releituraSaiu
    expect(doProfessor.getCurrentResult().data).toEqual({ itens: [ANA, BRUNO] })
    responder(new Response(JSON.stringify({ itens: [BRUNO] }), { status: 200 }))
    await descartada
    expect(doProfessor.getCurrentResult().data).toEqual({ itens: [BRUNO] })
    largarProfessor()
    chamadas.length = 0

    const daCoordenacao = new QueryObserver(cliente, m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'coordenacao'))
    const largarCoordenacao = daCoordenacao.subscribe(() => undefined)
    fila.push({ status: 200, corpo: { itens: [ANA, BRUNO] } })
    await daCoordenacao.refetch()
    chamadas.length = 0
    await m.pedidos.descartarListaDepoisDaFalha(cliente, TURMA, 'coordenacao')
    expect(daCoordenacao.getCurrentResult().data).toBeUndefined()
    expect(daCoordenacao.getCurrentResult().isError).toBe(false)
    expect(chamadas).toEqual([])
    largarCoordenacao()
    cliente.unmount()
  })
})

describe('a contagem de pedidos do sino do professor (telas do professor, 1.0)', () => {
  const OUTRA = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f6'
  const CONTADA = { quantidade: 2, haMais: false }

  it('lê a mesma rota da lista e guarda só { quantidade, haMais }: a lista com os nomes não chega ao cache', async () => {
    const cliente = clienteDeTeste()
    fila.push({ status: 200, corpo: { itens: [ANA, BRUNO] } })
    const lida = await cliente.fetchQuery(m.pedidos.contagemDePedidosQueryOptions(TURMA))
    expect(lida).toEqual(CONTADA)
    expect(chamadas.map(({ caminho, metodo, autorizacao }) => ({ caminho, metodo, comSessao: autorizacao !== undefined }))).toEqual([{ caminho: `/v1/turmas/${TURMA}/reivindicacoes?limite=100`, metodo: 'GET', comSessao: true }])
    expect(JSON.stringify(cliente.getQueryData(m.pedidos.contagemDePedidosQueryOptions(TURMA).queryKey))).not.toContain('sintética')
    expect(cliente.getQueryCache().getAll().map((consulta) => JSON.stringify(consulta.state.data)).join('')).not.toContain('sintética')
  })

  it('página com outra depois diz que há mais, e a chave é a da contagem, distinta da lista nominal', async () => {
    const cliente = clienteDeTeste()
    fila.push({ status: 200, corpo: { itens: [ANA], proxima: ANA.id } })
    expect(await cliente.fetchQuery(m.pedidos.contagemDePedidosQueryOptions(TURMA))).toEqual({ quantidade: 1, haMais: true })
    const contagem = m.pedidos.contagemDePedidosQueryOptions(TURMA).queryKey
    expect(contagem).toEqual(['pedidos-da-turma', 'contagem', TURMA])
    expect(contagem).not.toEqual(m.pedidos.pedidosDaTurmaQueryOptions(TURMA, 'professor').queryKey)
  })

  it('sem ninguém olhando, a contagem sai do cache: a chave leva o id da turma, e ele não fica na aba da pessoa seguinte', async () => {
    const cliente = clienteDeTeste()
    cliente.mount()
    fila.push({ status: 200, corpo: { itens: [ANA] } })
    const observador = new QueryObserver(cliente, m.pedidos.contagemDePedidosQueryOptions(TURMA))
    const largar = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(observador.getCurrentResult().data).toEqual({ quantidade: 1, haMais: false }))
    expect(cliente.getQueryCache().findAll({ queryKey: ['pedidos-da-turma'] })).toHaveLength(1)
    largar()
    await vi.waitFor(() => expect(cliente.getQueryCache().findAll({ queryKey: ['pedidos-da-turma'] })).toHaveLength(0))
    cliente.unmount()
  })

  it('decidir como professor invalida a contagem da turma por chave exata: a de outra turma e a lista nominal não são tocadas por ela', async () => {
    const cliente = clienteDeTeste()
    cliente.setQueryData(m.pedidos.contagemDePedidosQueryOptions(TURMA).queryKey, CONTADA)
    cliente.setQueryData(m.pedidos.contagemDePedidosQueryOptions(OUTRA).queryKey, CONTADA)
    cliente.setQueryData(m.pedidos.pedidosDaTurmaQueryOptions(OUTRA, 'professor').queryKey, { itens: [BRUNO] })
    await m.pedidos.aplicarDecisao(cliente, TURMA, 'professor', { resultados: [{ id: ANA.id, resultado: 'decidida' }] })
    expect(cliente.getQueryState(m.pedidos.contagemDePedidosQueryOptions(TURMA).queryKey)?.isInvalidated).toBe(true)
    expect(cliente.getQueryState(m.pedidos.contagemDePedidosQueryOptions(OUTRA).queryKey)?.isInvalidated).toBe(false)
    // A lista nominal da outra turma, com o nome do aluno, também não é tocada pela invalidação da contagem.
    expect(cliente.getQueryState(m.pedidos.pedidosDaTurmaQueryOptions(OUTRA, 'professor').queryKey)?.isInvalidated).toBe(false)
  })

  it('decidir sem o sino olhando não lê a contagem: nem a guardada sem observador, nem a da turma que nunca foi lida', async () => {
    const cliente = clienteDeTeste()
    // TURMA: contagem no cache sem observador (a turma saiu da tela). OUTRA: nenhuma consulta, como a 13ª turma.
    cliente.setQueryData(m.pedidos.contagemDePedidosQueryOptions(TURMA).queryKey, CONTADA)
    await m.pedidos.aplicarDecisao(cliente, TURMA, 'professor', { resultados: [{ id: ANA.id, resultado: 'decidida' }] })
    await m.pedidos.aplicarDecisao(cliente, OUTRA, 'professor', { resultados: [{ id: BRUNO.id, resultado: 'decidida' }] })
    await vi.waitFor(() => expect(cliente.isFetching()).toBe(0))
    expect(chamadas.filter((chamada) => chamada.caminho.includes('/reivindicacoes'))).toEqual([])
    expect(cliente.getQueryState(m.pedidos.contagemDePedidosQueryOptions(TURMA).queryKey)?.isInvalidated).toBe(true)
  })

  it('dois cliques em decidir, com o sino olhando: uma releitura só da contagem', async () => {
    const cliente = clienteDeTeste()
    cliente.mount()
    fila.push({ status: 200, corpo: { itens: [ANA] } })
    const observador = new QueryObserver(cliente, m.pedidos.contagemDePedidosQueryOptions(TURMA))
    const largar = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(observador.getCurrentResult().data).toEqual({ quantidade: 1, haMais: false }))
    observador.setOptions({ ...m.pedidos.contagemDePedidosQueryOptions(TURMA), enabled: false })
    fila.push({ status: 200, corpo: { itens: [] } })
    const decisao = { resultados: [{ id: ANA.id, resultado: 'decidida' as const }] }
    await Promise.all([m.pedidos.aplicarDecisao(cliente, TURMA, 'professor', decisao), m.pedidos.aplicarDecisao(cliente, TURMA, 'professor', decisao)])
    await vi.waitFor(() => expect(observador.getCurrentResult().data).toEqual({ quantidade: 0, haMais: false }))
    expect(chamadas.filter((chamada) => chamada.caminho.includes('/reivindicacoes'))).toHaveLength(2)
    largar()
    cliente.unmount()
  })

  it('a coordenação não tem contagem: a decisão dela não invalida a do sino', async () => {
    const cliente = clienteDeTeste()
    cliente.setQueryData(m.pedidos.contagemDePedidosQueryOptions(TURMA).queryKey, CONTADA)
    await m.pedidos.aplicarDecisao(cliente, TURMA, 'coordenacao', { resultados: [{ id: ANA.id, resultado: 'decidida' }] })
    expect(cliente.getQueryState(m.pedidos.contagemDePedidosQueryOptions(TURMA).queryKey)?.isInvalidated).toBe(false)
  })

  it('a decisão que falha no meio do lote também invalida a contagem da turma (e só a dela), mas só para o professor', async () => {
    const cliente = clienteDeTeste()
    for (const turma of [TURMA, OUTRA]) cliente.setQueryData(m.pedidos.contagemDePedidosQueryOptions(turma).queryKey, CONTADA)
    await m.pedidos.descartarListaDepoisDaFalha(cliente, TURMA, 'coordenacao')
    expect(cliente.getQueryState(m.pedidos.contagemDePedidosQueryOptions(TURMA).queryKey)?.isInvalidated).toBe(false)
    await m.pedidos.descartarListaDepoisDaFalha(cliente, TURMA, 'professor')
    expect(cliente.getQueryState(m.pedidos.contagemDePedidosQueryOptions(TURMA).queryKey)?.isInvalidated).toBe(true)
    expect(cliente.getQueryState(m.pedidos.contagemDePedidosQueryOptions(OUTRA).queryKey)?.isInvalidated).toBe(false)
  })
})

describe('a lista de nomes da turma depois da decisão (telas do professor, 12.0)', () => {
  const OUTRA = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f6'
  const PAGINA = { pages: [{ itens: [{ usuarioId: '0192a4c0-5b1e-7c3d-8e4f-0000000000a1', nome: 'Ana sintética' }] }], pageParams: [undefined] }

  it('aprovar um pedido marca como velha a lista de nomes da turma, e só a dela: a de outra turma não é tocada', async () => {
    const cliente = clienteDeTeste()
    cliente.setQueryData(m.alunos.alunosDaTurmaQueryOptions(TURMA).queryKey, PAGINA)
    cliente.setQueryData(m.alunos.alunosDaTurmaQueryOptions(OUTRA).queryKey, PAGINA)
    await m.pedidos.aplicarDecisao(cliente, TURMA, 'professor', { resultados: [{ id: ANA.id, resultado: 'decidida' }] })
    expect(cliente.getQueryState(m.alunos.alunosDaTurmaQueryOptions(TURMA).queryKey)?.isInvalidated).toBe(true)
    expect(cliente.getQueryState(m.alunos.alunosDaTurmaQueryOptions(OUTRA).queryKey)?.isInvalidated).toBe(false)
  })

  it('com a aba olhando, a decisão faz a lista de nomes ser lida de novo, e o aluno aprovado entra nela', async () => {
    const cliente = clienteDeTeste()
    cliente.mount()
    fila.push({ status: 200, corpo: { itens: [] } })
    const observador = new InfiniteQueryObserver(cliente, m.alunos.alunosDaTurmaQueryOptions(TURMA))
    const largar = observador.subscribe(() => undefined)
    await vi.waitFor(() => expect(observador.getCurrentResult().data?.pages).toEqual([{ itens: [] }]))
    chamadas.length = 0

    fila.push({ status: 200, corpo: { itens: PAGINA.pages[0]?.itens } })
    await m.pedidos.aplicarDecisao(cliente, TURMA, 'professor', { resultados: [{ id: ANA.id, resultado: 'decidida' }] })
    await vi.waitFor(() => expect(observador.getCurrentResult().data?.pages).toEqual(PAGINA.pages))
    expect(chamadas.filter((chamada) => chamada.caminho.includes('/alunos'))).toHaveLength(1)
    largar()
    cliente.unmount()
  })

  it('a decisão que falha no meio do lote também marca a lista de nomes da turma como velha', async () => {
    const cliente = clienteDeTeste()
    cliente.setQueryData(m.alunos.alunosDaTurmaQueryOptions(TURMA).queryKey, PAGINA)
    cliente.setQueryData(m.alunos.alunosDaTurmaQueryOptions(OUTRA).queryKey, PAGINA)
    await m.pedidos.descartarListaDepoisDaFalha(cliente, TURMA, 'professor')
    expect(cliente.getQueryState(m.alunos.alunosDaTurmaQueryOptions(TURMA).queryKey)?.isInvalidated).toBe(true)
    expect(cliente.getQueryState(m.alunos.alunosDaTurmaQueryOptions(OUTRA).queryKey)?.isInvalidated).toBe(false)
  })
})
