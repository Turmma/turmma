import { ErrorCode, avisosResponseSchema, MENSAGENS_DE_ERRO } from '@educa/shared'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { shouldRetry } from './query-client'
import { RespostaForaDoContrato } from './contrato/resposta-fora-do-contrato'
import { baixarPdfDoArtefato } from '../areas/professor/artefatos/api/artefatos'
import { sendEdicao } from '../areas/coordenacao/material/api/material'
import { apiGet, apiRequest, ApiError, comPrazo, errorMessage, estourouNoCliente, EMPTY_BODY, PRAZOS_DA_CHAMADA_MS } from './client'
import { responderQuestao } from './atividades-do-aluno'
import { openSessaoPeloCookie } from './sessao'

function responder(status: number, corpo: unknown, cabecalhos?: Record<string, string>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status, headers: cabecalhos ?? {} }))),
  )
}

/** O que o `fetch` recebeu na última chamada. */
function ultimoPedido(): { caminho: string; opcoes: RequestInit } {
  const espiao = vi.mocked(fetch)
  const chamada = espiao.mock.calls.at(-1)
  expect(chamada, 'nenhuma chamada ao fetch').toBeDefined()
  return { caminho: chamada?.[0] as string, opcoes: (chamada?.[1] ?? {}) as RequestInit }
}

async function erroDe(promessa: Promise<unknown>): Promise<ApiError> {
  const erro = await promessa.then(
    () => undefined,
    (motivo: unknown) => motivo,
  )
  expect(erro).toBeInstanceOf(ApiError)
  return erro as ApiError
}

const envelope = (codigo: string) => ({ erro: { codigo, mensagem: 'texto da API', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buscarDaApi', () => {
  it('devolve o corpo validado pelo contrato de packages/shared', async () => {
    responder(200, { itens: [] })
    await expect(apiGet('/v1/sistema/avisos', avisosResponseSchema)).resolves.toEqual({ itens: [] })
  })

  it('o código vem do envelope, não do status: 500 com LIMITE_EXCEDIDO é limite excedido', async () => {
    responder(500, envelope('LIMITE_EXCEDIDO'))
    expect((await erroDe(apiGet('/x', avisosResponseSchema))).codigo).toBe(ErrorCode.LIMITE_EXCEDIDO)
  })

  it('sem envelope reconhecível, deduz pelo status só o que o status diz, e o resto é erro interno', async () => {
    const casos: [number, unknown, ErrorCode][] = [
      [502, '<html>Bad Gateway</html>', ErrorCode.INDISPONIVEL_TENTE_DE_NOVO],
      [503, {}, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO],
      [429, '', ErrorCode.LIMITE_EXCEDIDO],
      [500, envelope('CODIGO_QUE_NAO_EXISTE'), ErrorCode.ERRO_INTERNO],
      [404, envelope('toString'), ErrorCode.ERRO_INTERNO],
    ]
    for (const [status, corpo, esperado] of casos) {
      responder(status, corpo)
      expect((await erroDe(apiGet('/x', avisosResponseSchema))).codigo, `${status}`).toBe(esperado)
    }
  })

  it('sem rede, é indisponível: a tela diz para tentar de novo em instantes', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    expect((await erroDe(apiGet('/x', avisosResponseSchema))).codigo).toBe(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
  })

  it('busca cancelada pelo TanStack Query sai como cancelamento, e não vira erro de indisponível na tela', async () => {
    const controle = new AbortController()
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new DOMException('abortada', 'AbortError'))))
    controle.abort()
    const erro = await apiGet('/x', avisosResponseSchema, controle.signal).catch((motivo: unknown) => motivo)
    expect(erro).not.toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ name: 'AbortError' })
  })

  it('200 fora do contrato vira erro interno, e não dado quebrado na tela', async () => {
    responder(200, { itens: [{ id: 'x', texto: 'sem data' }] })
    expect((await erroDe(apiGet('/x', avisosResponseSchema))).codigo).toBe(ErrorCode.ERRO_INTERNO)
  })
})

describe('chamarApi', () => {
  it('manda o token no cabeçalho Authorization, e nunca na URL nem no corpo (regra 50, item 7)', async () => {
    responder(200, { itens: [] })
    await apiRequest('/v1/eu', avisosResponseSchema, { token: 'token-da-camila' })
    const { caminho, opcoes } = ultimoPedido()
    expect(new Headers(opcoes.headers).get('Authorization')).toBe('Bearer token-da-camila')
    expect(caminho).toBe('/v1/eu')
    expect(caminho).not.toContain('token-da-camila')
    expect(opcoes.body ?? '').not.toContain('token-da-camila')
  })

  it('nenhuma resposta da API vai para o cache HTTP do navegador, na leitura e na escrita (regra 20)', async () => {
    responder(200, { itens: [] })
    await apiGet('/v1/turmas/x/lista', avisosResponseSchema)
    expect(ultimoPedido().opcoes.cache).toBe('no-store')
    responder(200, { itens: [] })
    await apiRequest('/v1/turmas/x/lista', avisosResponseSchema, { metodo: 'POST', corpo: { texto: 'Ana;1' }, token: 'token-da-renata' })
    expect(ultimoPedido().opcoes.cache).toBe('no-store')
  })

  it('sem token, não manda cabeçalho de autorização nenhum', async () => {
    responder(200, { itens: [] })
    await apiGet('/v1/sistema/avisos', avisosResponseSchema)
    expect(new Headers(ultimoPedido().opcoes.headers).has('Authorization')).toBe(false)
  })

  it('POST com corpo vai como JSON, e o método chega à API', async () => {
    responder(200, { itens: [] })
    await apiRequest('/v1/sessao/email', avisosResponseSchema, { metodo: 'POST', corpo: { email: 'camila@escola.test', senha: 'segredo' } })
    const { opcoes } = ultimoPedido()
    expect(opcoes.method).toBe('POST')
    expect(new Headers(opcoes.headers).get('Content-Type')).toBe('application/json')
    expect(opcoes.body).toBe(JSON.stringify({ email: 'camila@escola.test', senha: 'segredo' }))
  })

  it('o Retry-After chega ao erro em segundos: é dele que a tela tira quanto esperar', async () => {
    responder(429, envelope('CONTA_SEGURADA'), { 'Retry-After': '90' })
    const erro = await erroDe(apiRequest('/v1/sessao/email', avisosResponseSchema, { metodo: 'POST' }))
    expect(erro.codigo).toBe(ErrorCode.CONTA_SEGURADA)
    expect(erro.esperaSegundos).toBe(90)
  })

  it('Retry-After ausente ou em formato de data não vira espera inventada', async () => {
    responder(503, envelope('INDISPONIVEL_TENTE_DE_NOVO'))
    expect((await erroDe(apiRequest('/x', avisosResponseSchema))).esperaSegundos).toBeUndefined()
    responder(503, envelope('INDISPONIVEL_TENTE_DE_NOVO'), { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' })
    expect((await erroDe(apiRequest('/x', avisosResponseSchema))).esperaSegundos).toBeUndefined()
  })

  it('resposta sem corpo (204 de DELETE /v1/sessao) não é erro de contrato', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))))
    await expect(apiRequest('/v1/sessao', EMPTY_BODY, { metodo: 'DELETE' })).resolves.toBeUndefined()
  })
})

describe('mensagemDoErro', () => {
  it('usa o catálogo pt-BR pelo código, e erro desconhecido cai na mensagem de erro interno', () => {
    expect(errorMessage(new ApiError(ErrorCode.LIMITE_EXCEDIDO))).toBe(MENSAGENS_DE_ERRO.LIMITE_EXCEDIDO)
    expect(errorMessage(new Error('HTTP 500'))).toBe(MENSAGENS_DE_ERRO.ERRO_INTERNO)
    expect(errorMessage(new Error('HTTP 500'))).not.toContain('500')
  })
})

describe('deveTentarDeNovo', () => {
  it('repete uma vez o que o tempo resolve, e nunca o limite excedido nem a entrada inválida', () => {
    expect(shouldRetry(0, new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBe(true)
    expect(shouldRetry(1, new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBe(false)
    expect(shouldRetry(0, new ApiError(ErrorCode.LIMITE_EXCEDIDO))).toBe(false)
    expect(shouldRetry(0, new ApiError(ErrorCode.ENTRADA_INVALIDA))).toBe(false)
    expect(shouldRetry(0, new ApiError(ErrorCode.NAO_AUTENTICADO))).toBe(false)
    expect(shouldRetry(0, new ApiError(ErrorCode.TEMPO_ESGOTADO))).toBe(true)
    expect(shouldRetry(0, new ApiError(ErrorCode.ERRO_INTERNO))).toBe(true)
    expect(shouldRetry(0, new TypeError('falha fora do cliente'))).toBe(true)
  })

  it('a resposta fora do contrato não se repete: o erro é interno, mas a mesma resposta voltaria, e o que resolve é atualizar a página', () => {
    expect(new RespostaForaDoContrato().codigo).toBe(ErrorCode.ERRO_INTERNO)
    expect(shouldRetry(0, new RespostaForaDoContrato())).toBe(false)
  })
})

describe('prazo da chamada (RF11, 52.0)', () => {
  const ID = '0197a1c0-0000-7000-8000-000000000001'

  /** O `fetch` que fica pendurado até o sinal abortar, como o do navegador; guarda cada sinal que recebeu. */
  function penduradoAteAbortar(responderAntes?: (caminho: string, opcoes: RequestInit) => Response | undefined): AbortSignal[] {
    const sinais: AbortSignal[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((caminho: string, opcoes: RequestInit = {}) => {
        const pronta = responderAntes?.(caminho, opcoes)
        if (pronta !== undefined) return Promise.resolve(pronta)
        return new Promise<Response>((_resolver, rejeitar) => {
          const { signal } = opcoes
          if (signal === undefined || signal === null) return
          sinais.push(signal)
          signal.addEventListener('abort', () => rejeitar(new DOMException('abortada', 'AbortError')))
        })
      }),
    )
    return sinais
  }

  /** A resposta que chegou com o cabeçalho e cujo corpo nunca termina: a leitura dele erra quando o sinal aborta, como no navegador. */
  function respostaComCorpoPendurado(status: number, opcoes: RequestInit): Response {
    // O `pull` que rejeita ao abortar faz o fluxo falhar; é o que o navegador faz com a leitura em andamento.
    const corpo = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>((_resolver, rejeitar) => opcoes.signal?.addEventListener('abort', () => rejeitar(new DOMException('abortada', 'AbortError')))),
    })
    return new Response(corpo, { status })
  }

  /** Onde a promessa está agora, sem esperar por ela: o relógio falso é quem a faz andar. */
  function acompanhar(promessa: Promise<unknown>) {
    const visto: { situacao: 'pendente' | 'resolvida' | 'rejeitada'; erro?: unknown } = { situacao: 'pendente' }
    promessa.then(
      () => void (visto.situacao = 'resolvida'),
      (erro: unknown) => {
        visto.situacao = 'rejeitada'
        visto.erro = erro
      },
    )
    return visto
  }

  /** O estouro do prazo no navegador: o código do catálogo e a marca `origem: 'cliente'`, que o separa do `TEMPO_ESGOTADO` da API. */
  const tempoEsgotado = (visto: { erro?: unknown }) => {
    expect(visto.erro).toMatchObject({ name: 'ApiError', codigo: ErrorCode.TEMPO_ESGOTADO, origem: 'cliente' })
    expect(estourouNoCliente(visto.erro)).toBe(true)
  }

  /** A pessoa entrou: `authedRequest` e o envio de arquivo pedem o token da sessão. Com o relógio de verdade, antes dos casos. */
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: 'token-do-prazo', expiraEm: new Date(Date.now() + 3_600_000).toISOString() }), { status: 200 }))))
    await openSessaoPeloCookie()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('os prazos são os do RF11: leitura 20 s, PDF 30 s, envio de arquivo 180 s, resposta de prova 10 s', () => {
    expect(PRAZOS_DA_CHAMADA_MS).toEqual({ leitura: 20_000, pdf: 30_000, envio: 180_000, prova: 10_000 })
  })

  it('o TEMPO_ESGOTADO que a API devolve (503 rápido) não leva a marca do cliente, e o do prazo estourado leva', async () => {
    responder(503, { erro: { codigo: 'TEMPO_ESGOTADO' } })
    const daApi = await apiGet('/v1/turmas', avisosResponseSchema).catch((erro: unknown) => erro)
    expect(daApi).toMatchObject({ codigo: ErrorCode.TEMPO_ESGOTADO })
    expect(estourouNoCliente(daApi)).toBe(false)
    expect(estourouNoCliente(new ApiError(ErrorCode.TEMPO_ESGOTADO))).toBe(false)
    expect(estourouNoCliente(new Error('TEMPO_ESGOTADO'))).toBe(false)
    // O que não é `ApiError` nunca é lido como estouro, ainda que traga uma `origem` igual.
    expect(estourouNoCliente({ origem: 'cliente' })).toBe(false)
    expect(estourouNoCliente(new ApiError(ErrorCode.TEMPO_ESGOTADO, undefined, 'cliente'))).toBe(true)
  })

  it('leitura: aos 19,9 s ainda espera, e aos 20 s vira TEMPO_ESGOTADO', async () => {
    vi.useFakeTimers()
    penduradoAteAbortar()
    const visto = acompanhar(apiGet('/v1/turmas', avisosResponseSchema))
    await vi.advanceTimersByTimeAsync(19_900)
    expect(visto.situacao).toBe('pendente')
    await vi.advanceTimersByTimeAsync(100)
    expect(visto.situacao).toBe('rejeitada')
    tempoEsgotado(visto)
  })

  it('PDF: o prazo é 30 s, e não os 20 s da leitura', async () => {
    vi.useFakeTimers()
    penduradoAteAbortar()
    const visto = acompanhar(baixarPdfDoArtefato(ID, 'Prova de química'))
    await vi.advanceTimersByTimeAsync(29_900)
    expect(visto.situacao).toBe('pendente')
    await vi.advanceTimersByTimeAsync(100)
    expect(visto.situacao).toBe('rejeitada')
    tempoEsgotado(visto)
  })

  it('envio de arquivo: o prazo é 180 s, contado do envio (a conferência da sessão antes dele não conta)', async () => {
    vi.useFakeTimers()
    penduradoAteAbortar((_caminho, opcoes) => (opcoes.method === 'POST' ? undefined : new Response(JSON.stringify({ itens: [] }), { status: 200 })))
    const visto = acompanhar(sendEdicao(ID, { edicao: '2027' }, new File(['%PDF-1.4'], 'material.pdf', { type: 'application/pdf' })))
    await vi.advanceTimersByTimeAsync(179_900)
    expect(visto.situacao).toBe('pendente')
    await vi.advanceTimersByTimeAsync(100)
    expect(visto.situacao).toBe('rejeitada')
    tempoEsgotado(visto)
  })

  it('resposta de prova: a gravação da questão é o PUT de 10 s, e aos 9,9 s ainda espera', async () => {
    vi.useFakeTimers()
    penduradoAteAbortar()
    const visto = acompanhar(responderQuestao(ID, 3, 1, 1))
    await vi.advanceTimersByTimeAsync(9_900)
    expect(visto.situacao).toBe('pendente')
    await vi.advanceTimersByTimeAsync(100)
    expect(visto.situacao).toBe('rejeitada')
    tempoEsgotado(visto)
  })

  it('o estouro aborta a chamada de verdade: o sinal que o fetch recebeu fica abortado, e a leitura do corpo que pendura também estoura', async () => {
    vi.useFakeTimers()
    const sinais = penduradoAteAbortar()
    const visto = acompanhar(apiGet('/v1/turmas', avisosResponseSchema))
    await vi.advanceTimersByTimeAsync(0)
    expect(sinais).toHaveLength(1)
    expect(sinais[0]?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(sinais[0]?.aborted).toBe(true)
    tempoEsgotado(visto)

    // O cabeçalho chegou, e o corpo pendura: o prazo cobre a leitura inteira, e não só o início da resposta.
    vi.stubGlobal('fetch', vi.fn((_caminho: string, opcoes: RequestInit = {}) => Promise.resolve(respostaComCorpoPendurado(200, opcoes))))
    const corpoPendurado = acompanhar(apiGet('/v1/turmas', avisosResponseSchema))
    await vi.advanceTimersByTimeAsync(19_900)
    expect(corpoPendurado.situacao).toBe('pendente')
    await vi.advanceTimersByTimeAsync(100)
    expect(corpoPendurado.situacao).toBe('rejeitada')
    tempoEsgotado(corpoPendurado)
  })

  it('o PDF e o envio de arquivo também contam a leitura do corpo: o cabeçalho que chega e o corpo que pendura estouram no prazo deles, no 200 e no erro', async () => {
    const casos: [string, number, () => Promise<unknown>, number][] = [
      ['PDF, corpo do arquivo', 200, () => baixarPdfDoArtefato(ID, 'Prova de química'), 30_000],
      ['PDF, corpo do erro', 500, () => baixarPdfDoArtefato(ID, 'Prova de química'), 30_000],
      ['envio, corpo da resposta', 201, () => sendEdicao(ID, { edicao: '2027' }, new File(['%PDF-1.4'], 'material.pdf', { type: 'application/pdf' })), 180_000],
    ]
    for (const [nome, status, chamar, prazo] of casos) {
      vi.useFakeTimers()
      // No envio, a conferência da sessão (GET) responde na hora, e só o POST fica com o corpo pendurado.
      vi.stubGlobal(
        'fetch',
        vi.fn((_caminho: string, opcoes: RequestInit = {}) =>
          Promise.resolve(opcoes.method === 'POST' || status !== 201 ? respostaComCorpoPendurado(status, opcoes) : new Response(JSON.stringify({ itens: [] }), { status: 200 })),
        ),
      )
      const visto = acompanhar(chamar())
      await vi.advanceTimersByTimeAsync(prazo - 100)
      expect(visto.situacao, `${nome}: antes do prazo`).toBe('pendente')
      await vi.advanceTimersByTimeAsync(100)
      expect(visto.situacao, `${nome}: no prazo`).toBe('rejeitada')
      tempoEsgotado(visto)
      vi.useRealTimers()
    }
  })

  it('cancelamento: quem chamou cancela, e sai o AbortError, e não um erro de API; nem o prazo, que vence depois, o troca', async () => {
    vi.useFakeTimers()
    penduradoAteAbortar()
    const controle = new AbortController()
    const visto = acompanhar(apiGet('/v1/turmas', avisosResponseSchema, controle.signal))
    await vi.advanceTimersByTimeAsync(5_000)
    expect(visto.situacao).toBe('pendente')
    controle.abort()
    await vi.advanceTimersByTimeAsync(0)
    expect(visto.situacao).toBe('rejeitada')
    expect(visto.erro).not.toBeInstanceOf(ApiError)
    expect(visto.erro).toMatchObject({ name: 'AbortError' })
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(visto.erro).toMatchObject({ name: 'AbortError' })
  })

  it('cancelamento com o corpo pendurado: a leitura que o cancelamento aborta sai como AbortError, e não como erro de API', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_caminho: string, opcoes: RequestInit = {}) => Promise.resolve(respostaComCorpoPendurado(200, opcoes))))
    const controle = new AbortController()
    const visto = acompanhar(apiGet('/v1/turmas', avisosResponseSchema, controle.signal))
    await vi.advanceTimersByTimeAsync(1_000)
    expect(visto.situacao).toBe('pendente')
    controle.abort()
    await vi.advanceTimersByTimeAsync(0)
    expect(visto.situacao).toBe('rejeitada')
    expect(visto.erro).not.toBeInstanceOf(ApiError)
    expect(visto.erro).toMatchObject({ name: 'AbortError' })
  })

  it('o prazo libera: a resposta que chega antes tira o temporizador, e nenhum abort acontece depois', async () => {
    vi.useFakeTimers()
    const sinais: AbortSignal[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_caminho: string, opcoes: RequestInit = {}) => {
        if (opcoes.signal !== undefined && opcoes.signal !== null) sinais.push(opcoes.signal)
        return Promise.resolve(new Response(JSON.stringify({ itens: [] }), { status: 200 }))
      }),
    )
    const controle = new AbortController()
    await expect(apiGet('/v1/turmas', avisosResponseSchema, controle.signal)).resolves.toEqual({ itens: [] })
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sinais).toHaveLength(1)
    expect(sinais[0]?.aborted).toBe(false)
    // O ouvinte do sinal de quem chamou também saiu: cancelar depois não aborta o que já terminou.
    controle.abort()
    expect(sinais[0]?.aborted).toBe(false)
  })

  it('o erro que não é abort sobe do `comPrazo` como está, e o temporizador sai', async () => {
    vi.useFakeTimers()
    await expect(
      comPrazo('leitura', undefined, () => {
        throw new ApiError(ErrorCode.NAO_ENCONTRADO)
      }),
    ).rejects.toMatchObject({ codigo: ErrorCode.NAO_ENCONTRADO })
    expect(vi.getTimerCount()).toBe(0)
  })
})
