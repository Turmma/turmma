import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O cliente das telas do Assistente (A2): o que cada chamada manda, o que a memória da aba esquece e o que a decisão de
 * uma entrega faz com as listas. A rede é falsa; a regra sob teste é a da web. O módulo é recarregado em cada teste, como
 * uma aba recém-aberta.
 */
const importar = async () => ({
  sessao: await import('../../../../api/sessao'),
  assistente: await import('./assistente'),
  ferramentas: await import('../../ferramentas/api/ferramentas'),
  artefatos: await import('../../artefatos/api/artefatos'),
  entregas: await import('../../artefatos/api/entregas'),
  memoria: await import('../../../../api/tab-store'),
})
type Modulos = Awaited<ReturnType<typeof importar>>

interface Chamada {
  readonly caminho: string
  readonly metodo: string
  readonly corpo: unknown
  readonly autorizacao: string | undefined
}

const chamadas: Chamada[] = []
let fila: { status: number; corpo?: unknown; cabecalhos?: Record<string, string>; binario?: string }[] = []
let m: Modulos

const id = (final: string) => `0190f5a0-0000-7000-8000-0000000000${final}`
const TURMA = id('2b')
const DISCIPLINA = id('c1')
const ARTEFATO = id('a1')
const CHAVE = id('e1')
const ACEITA = { status: 202, corpo: { execucaoId: id('f1') } }
const TOKEN = (valor: string) => ({ status: 200, corpo: { token: valor, expiraEm: new Date(Date.now() + 600_000).toISOString() } })
const erro = (status: number, codigo: string) => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: id('99') } } })

function entrega(final: string, estado: 'pendente' | 'aprovada' | 'rejeitada' = 'pendente') {
  const decidida = estado !== 'pendente'
  return {
    id: id(final),
    tipo: 'versao_adaptada',
    funcao: 'adaptacao',
    estado,
    turmaId: TURMA,
    titulo: 'Atividade de estequiometria',
    artefatoId: ARTEFATO,
    atividadeAplicadaId: null,
    criadaEm: '2026-10-05T13:40:00.000Z',
    decididaEm: decidida ? '2026-10-05T13:42:00.000Z' : null,
    decididaPor: decidida ? { id: id('f9'), nome: 'Camila Souza' } : null,
    justificativa: estado === 'rejeitada' ? 'A questão 3 ficou sem o enunciado.' : null,
  } as const
}

beforeEach(async () => {
  chamadas.length = 0
  fila = []
  vi.resetModules()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (caminho: string, opcoes?: RequestInit) => {
      const cabecalhos = new Headers(opcoes?.headers)
      chamadas.push({ caminho, metodo: opcoes?.method ?? 'GET', corpo: typeof opcoes?.body === 'string' ? (JSON.parse(opcoes.body) as unknown) : undefined, autorizacao: cabecalhos.get('Authorization') ?? undefined })
      const preparada = fila.shift()
      if (preparada === undefined) throw new Error(`chamada sem resposta preparada: ${caminho}`)
      const corpo = preparada.binario ?? (preparada.corpo === undefined ? null : JSON.stringify(preparada.corpo))
      return new Response(corpo, { status: preparada.status, ...(preparada.cabecalhos === undefined ? {} : { headers: preparada.cabecalhos }) })
    }),
  )
  m = await importar()
  fila.push(TOKEN('token-de-acesso'))
  await m.sessao.abrirSessaoPeloCookie()
  chamadas.length = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
  expect(fila, 'resposta preparada que nenhuma chamada consumiu').toHaveLength(0)
})

describe('o que cada pedido de IA manda', () => {
  it('a mensagem ao Assistente leva o texto, a turma, a disciplina e a chave do envio, e nada de escola nem de pessoa', async () => {
    fila.push(ACEITA)
    expect(await m.assistente.enviarMensagemAoAssistente({ texto: 'uma atividade de estequiometria', turmaId: TURMA, disciplinaId: DISCIPLINA, chaveEnvio: CHAVE })).toEqual({ execucaoId: id('f1') })
    expect(chamadas).toEqual([
      { caminho: '/v1/assistente/mensagens', metodo: 'POST', corpo: { texto: 'uma atividade de estequiometria', turmaId: TURMA, disciplinaId: DISCIPLINA, chaveEnvio: CHAVE }, autorizacao: 'Bearer token-de-acesso' },
    ])
  })

  it('a ferramenta vai na rota dela, e a Adaptação manda só os tipos, o tempo extra e a chave', async () => {
    fila.push(ACEITA, ACEITA)
    await m.ferramentas.gerarComFerramenta('atividade_objetiva', { turmaId: TURMA, disciplinaId: DISCIPLINA, tema: 'Estequiometria', quantidade: 5, chaveEnvio: CHAVE })
    await m.artefatos.adaptarArtefato(ARTEFATO, { tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 50, chaveEnvio: CHAVE })
    expect(chamadas.map(({ caminho, corpo }) => ({ caminho, corpo }))).toEqual([
      { caminho: '/v1/ferramentas/atividade_objetiva/gerar', corpo: { turmaId: TURMA, disciplinaId: DISCIPLINA, tema: 'Estequiometria', quantidade: 5, chaveEnvio: CHAVE } },
      { caminho: `/v1/artefatos/${ARTEFATO}/adaptar`, corpo: { tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 50, chaveEnvio: CHAVE } },
    ])
  })

  it('a conversa pede as mensagens anteriores pelo id, e as páginas saem da mais antiga para a mais nova, sem repetir', async () => {
    const mensagem = (final: string, texto: string) => ({ id: id(final), criadaEm: '2026-10-05T13:00:00.000Z', autor: 'usuario', tipo: 'texto', texto, turmaId: TURMA, disciplinaId: DISCIPLINA }) as const
    const recente = { mensagens: [mensagem('03', 'terceira'), mensagem('04', 'quarta')], anterior: id('03') }
    const antiga = { mensagens: [mensagem('01', 'primeira'), mensagem('02', 'segunda'), mensagem('03', 'terceira')] }
    fila.push({ status: 200, corpo: recente }, { status: 200, corpo: antiga })
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const lido = await cliente.fetchInfiniteQuery({ ...m.assistente.consultaConversaDoAssistente, pages: 2 })
    expect(chamadas.map((chamada) => chamada.caminho)).toEqual(['/v1/assistente/conversa', `/v1/assistente/conversa?antes=${id('03')}`])
    expect(m.assistente.mensagensEmOrdem(lido.pages).map((item) => item.texto)).toEqual(['primeira', 'segunda', 'terceira', 'quarta'])
  })
})

describe('o PDF do artefato', () => {
  it('vai com o token no cabeçalho, nunca na URL, e sai com o nome que a API deu', async () => {
    fila.push({ status: 200, binario: '%PDF-1.7', cabecalhos: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="atividade.pdf"; filename*=UTF-8\'\'Atividade%20de%20estequiometria.pdf' } })
    const pdf = await m.artefatos.baixarPdfDoArtefato(ARTEFATO, 'Título que a tela conhece')
    expect(pdf.nome).toBe('Atividade de estequiometria.pdf')
    expect(await pdf.arquivo.text()).toBe('%PDF-1.7')
    expect(chamadas).toEqual([{ caminho: `/v1/artefatos/${ARTEFATO}/pdf`, metodo: 'GET', corpo: undefined, autorizacao: 'Bearer token-de-acesso' }])
  })

  it('com o token recusado, renova a sessão uma vez e pede de novo com o token novo', async () => {
    fila.push(erro(401, 'NAO_AUTENTICADO'), TOKEN('token-novo'), { status: 200, binario: '%PDF-1.7' })
    const pdf = await m.artefatos.baixarPdfDoArtefato(ARTEFATO, 'Lista: "reagente/limitante"?')
    // Sem nome no cabeçalho, o do título, sem o que nome de arquivo não aceita.
    expect(pdf.nome).toBe('Lista reagente limitante.pdf')
    expect(chamadas.map(({ caminho, autorizacao }) => ({ caminho, autorizacao }))).toEqual([
      { caminho: `/v1/artefatos/${ARTEFATO}/pdf`, autorizacao: 'Bearer token-de-acesso' },
      { caminho: '/v1/sessao/renovar', autorizacao: undefined },
      { caminho: `/v1/artefatos/${ARTEFATO}/pdf`, autorizacao: 'Bearer token-novo' },
    ])
  })

  it('a falha sai com o código do catálogo: o artefato de outra turma responde como inexistente', async () => {
    fila.push(erro(404, 'NAO_ENCONTRADO'), { status: 503 })
    await expect(m.artefatos.baixarPdfDoArtefato(ARTEFATO, 'x')).rejects.toMatchObject({ codigo: 'NAO_ENCONTRADO' })
    await expect(m.artefatos.baixarPdfDoArtefato(ARTEFATO, 'x')).rejects.toMatchObject({ codigo: 'INDISPONIVEL_TENTE_DE_NOVO' })
  })

  it('o nome do arquivo vem do cabeçalho quando ele diz, e do título quando não diz', () => {
    expect(m.artefatos.nomeNoCabecalho('attachment; filename="plano.pdf"')).toBe('plano.pdf')
    expect(m.artefatos.nomeNoCabecalho('attachment')).toBeUndefined()
    expect(m.artefatos.nomeNoCabecalho(null)).toBeUndefined()
    expect(m.artefatos.nomeDoArquivoPdf('   ')).toBe('artefato.pdf')
  })
})

describe('as entregas e a decisão', () => {
  it('aprovar e rejeitar passam pela rota da decisão registrada, com a justificativa só na rejeição', async () => {
    fila.push({ status: 200, corpo: entrega('01', 'aprovada') }, { status: 200, corpo: entrega('02', 'rejeitada') })
    await m.entregas.decidirEntrega(id('01'), { decisao: 'aprovar' })
    await m.entregas.decidirEntrega(id('02'), { decisao: 'rejeitar', justificativa: 'A questão 3 ficou sem o enunciado.' })
    expect(chamadas.map(({ caminho, metodo, corpo }) => ({ caminho, metodo, corpo }))).toEqual([
      { caminho: `/v1/entregas/${id('01')}/decidir`, metodo: 'POST', corpo: { decisao: 'aprovar' } },
      { caminho: `/v1/entregas/${id('02')}/decidir`, metodo: 'POST', corpo: { decisao: 'rejeitar', justificativa: 'A questão 3 ficou sem o enunciado.' } },
    ])
  })

  it('a entrega que já tinha decisão sai como ENTREGA_JA_DECIDIDA, para a tela se atualizar em vez de mostrar erro', async () => {
    fila.push(erro(409, 'ENTREGA_JA_DECIDIDA'))
    await expect(m.entregas.decidirEntrega(id('01'), { decisao: 'aprovar' })).rejects.toMatchObject({ codigo: 'ENTREGA_JA_DECIDIDA' })
  })

  it('depois da decisão, a entrega sai de "Esperando você" na hora e aparece decidida na conversa de "O que o Assistente fez"', async () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    cliente.setQueryData(m.entregas.consultaEntregasPendentes.queryKey, { itens: [entrega('01'), entrega('02')] })
    cliente.setQueryData(m.entregas.consultaEntregas.queryKey, { pages: [{ itens: [entrega('02'), entrega('01')] }], pageParams: [undefined] })
    await m.entregas.aplicarEntregaDecidida(cliente, entrega('01', 'aprovada'))
    expect(cliente.getQueryData(m.entregas.consultaEntregasPendentes.queryKey)?.itens.map((item) => item.id)).toEqual([id('02')])
    expect(cliente.getQueryData(m.entregas.consultaEntregas.queryKey)?.pages[0]?.itens.map((item) => [item.id, item.estado, item.decididaPor?.nome])).toEqual([
      [id('02'), 'pendente', undefined],
      [id('01'), 'aprovada', 'Camila Souza'],
    ])
    expect(cliente.getQueryState(m.entregas.consultaEntregasPendentes.queryKey)?.isInvalidated).toBe(true)
  })
})

describe('a memória da aba', () => {
  it('guarda o pedido em curso entre duas telas e avisa quem assina', () => {
    const lugar = m.memoria.criarLugarNaAba<{ texto: string }>()
    const avisos: (string | undefined)[] = []
    const cancelar = lugar.assinar(() => avisos.push(lugar.ler()?.texto))
    lugar.guardar({ texto: 'uma atividade de estequiometria' })
    expect(lugar.ler()).toEqual({ texto: 'uma atividade de estequiometria' })
    cancelar()
    lugar.guardar(undefined)
    expect(avisos).toEqual(['uma atividade de estequiometria'])
  })

  it('o "Sair" esvazia tudo: a pessoa seguinte no mesmo computador não encontra o pedido da anterior', async () => {
    const lugar = m.memoria.criarLugarNaAba<{ texto: string }>()
    lugar.guardar({ texto: 'conversa da professora anterior' })
    fila.push({ status: 204 })
    await m.sessao.sair()
    expect(lugar.ler()).toBeUndefined()
  })
})
