import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'

/**
 * Erro de chamada à API, só com o código tipado. A tela decide o que mostrar pelo código e nunca
 * pelo status HTTP nem pela mensagem da resposta (regra 00, item 9; regra 50, item 12).
 *
 * `esperaSegundos` é o `Retry-After` da resposta, quando ela pede para esperar: o 503 do semáforo do login, que a
 * web repete sozinha, e o 429 da conta segurada, cuja espera a tela diz por extenso (Tech Spec, seção 5).
 */
export class ErroDaApi extends Error {
  constructor(
    readonly codigo: ErrorCode,
    readonly esperaSegundos?: number,
  ) {
    super(codigo)
    this.name = 'ErroDaApi'
  }
}

/** O mínimo de um esquema zod de `packages/shared` que o cliente usa, sem a web depender do zod. */
export interface EsquemaDeResposta<T> {
  safeParse(valor: unknown): { success: true; data: T } | { success: false }
}

/** Resposta sem corpo, como o 204 de `DELETE /v1/sessao`: nada a validar, e o corpo vazio não é erro de contrato. */
export const SEM_CORPO: EsquemaDeResposta<void> = { safeParse: () => ({ success: true, data: undefined }) }

export interface OpcoesDaChamada {
  /** `GET` quando não dito. */
  readonly metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Corpo JSON do pedido. */
  readonly corpo?: unknown
  /** O token de acesso da sessão, quando a rota exige (`Authorization: Bearer`). Nunca vai na URL (regra 50, item 7). */
  readonly token?: string | undefined
  readonly sinal?: AbortSignal | undefined
}

function ehCodigoDeErro(valor: unknown): valor is ErrorCode {
  return typeof valor === 'string' && Object.hasOwn(ErrorCode, valor)
}

/** O código do envelope `{ erro: { codigo } }`; sem envelope reconhecível, o código que o status permite deduzir. */
function codigoDaResposta(corpo: unknown, status: number): ErrorCode {
  if (typeof corpo === 'object' && corpo !== null && 'erro' in corpo) {
    const { erro } = corpo
    if (typeof erro === 'object' && erro !== null && 'codigo' in erro && ehCodigoDeErro(erro.codigo)) return erro.codigo
  }
  if (status === 429) return ErrorCode.LIMITE_EXCEDIDO
  // Borda sem instância, ou instância drenando: o sistema volta sozinho.
  if (status === 502 || status === 503 || status === 504) return ErrorCode.INDISPONIVEL_TENTE_DE_NOVO
  return ErrorCode.ERRO_INTERNO
}

/** Os segundos do `Retry-After`, quando a API mandou um número. Data HTTP e valor inválido ficam de fora. */
function esperaDaResposta(resposta: Response): number | undefined {
  const cabecalho = resposta.headers.get('Retry-After')
  if (cabecalho === null) return undefined
  const segundos = Number(cabecalho.trim())
  return Number.isFinite(segundos) && segundos >= 0 ? segundos : undefined
}

async function lerJson(resposta: Response): Promise<unknown> {
  try {
    return await resposta.json()
  } catch {
    return undefined
  }
}

/**
 * Chamada à API por caminho relativo, com a resposta validada pelo contrato de `packages/shared`.
 * Toda falha sai como `ErroDaApi`: sem rede, erro da API e resposta fora do contrato.
 *
 * O cookie de renovação vai junto por ser mesma origem (o navegador nunca o lê; é `HttpOnly`), e o token de acesso,
 * quando existe, vai no cabeçalho `Authorization`.
 *
 * `cache: 'no-store'`: a resposta da API não vai para o cache HTTP do navegador, que fica em disco no computador da
 * escola. Várias trazem nome e matrícula de aluno (a lista da turma, 13.0), e o Chromebook do carrinho passa de mão em
 * mão (regra 20).
 */
export async function chamarApi<T>(caminho: string, esquema: EsquemaDeResposta<T>, opcoes: OpcoesDaChamada = {}): Promise<T> {
  const { metodo = 'GET', corpo, token, sinal } = opcoes
  let resposta: Response
  try {
    resposta = await fetch(caminho, {
      method: metodo,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
      ...(sinal ? { signal: sinal } : {}),
    })
  } catch (erro) {
    if (sinal?.aborted) throw erro
    throw new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
  }
  const corpoDaResposta = await lerJson(resposta)
  if (!resposta.ok) throw new ErroDaApi(codigoDaResposta(corpoDaResposta, resposta.status), esperaDaResposta(resposta))
  const lido = esquema.safeParse(corpoDaResposta)
  if (!lido.success) throw new ErroDaApi(ErrorCode.ERRO_INTERNO)
  return lido.data
}

/** `GET` numa rota anônima da API (estado do sistema, avisos). Rota com sessão passa por `buscarComSessao`. */
export function buscarDaApi<T>(caminho: string, esquema: EsquemaDeResposta<T>, sinal?: AbortSignal): Promise<T> {
  return chamarApi(caminho, esquema, { sinal })
}

/** A mensagem do catálogo pt-BR para qualquer erro; o que não é `ErroDaApi` vira erro interno. */
export function mensagemDoErro(erro: unknown): string {
  return MENSAGENS_DE_ERRO[erro instanceof ErroDaApi ? erro.codigo : ErrorCode.ERRO_INTERNO]
}
