import { ErrorCode, avisosResponseSchema, MENSAGENS_DE_ERRO } from '@educa/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shouldRetry } from './query-client'
import { apiGet, apiRequest, ApiError, errorMessage, EMPTY_BODY } from './client'

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
})
