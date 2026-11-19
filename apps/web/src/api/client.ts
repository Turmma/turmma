import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'

/**
 * Erro de chamada à API, só com o código tipado. A tela decide o que mostrar pelo código e nunca
 * pelo status HTTP nem pela mensagem da resposta (regra 00, item 9; regra 50, item 12).
 *
 * `esperaSegundos` é o `Retry-After` da resposta, quando ela pede para esperar: o 503 do semáforo do login, que a
 * web repete sozinha, e o 429 da conta segurada, cuja espera a tela diz por extenso (Tech Spec, seção 5).
 *
 * `origem` é `'cliente'` só no estouro do prazo da chamada (`comPrazo`, 52.0): o `TEMPO_ESGOTADO` que a **API** devolve (o 503 do
 * `statement_timeout`, o 408 e o 504) é uma recusa, e este é a resposta que não chegou, com a gravação em dúvida. O código é o
 * mesmo, e a tela decide pelo código; quem precisa distinguir os dois usa `estourouNoCliente`.
 */
export class ApiError extends Error {
  constructor(
    readonly codigo: ErrorCode,
    readonly esperaSegundos?: number,
    readonly origem?: 'cliente',
  ) {
    super(codigo)
    this.name = 'ApiError'
  }
}

/** O erro é o prazo da chamada que estourou no navegador (a resposta não chegou, e o servidor pode ter gravado), e não o `TEMPO_ESGOTADO` da API. */
export function estourouNoCliente(erro: unknown): boolean {
  return erro instanceof ApiError && erro.origem === 'cliente'
}

/** O mínimo de um esquema zod de `packages/shared` que o cliente usa, sem a web depender do zod. */
export interface ResponseSchema<T> {
  safeParse(valor: unknown): { success: true; data: T } | { success: false }
}

/** Resposta sem corpo, como o 204 de `DELETE /v1/sessao`: nada a validar, e o corpo vazio não é erro de contrato. */
export const EMPTY_BODY: ResponseSchema<void> = { safeParse: () => ({ success: true, data: undefined }) }

export interface RequestOptions {
  /** `GET` quando não dito. */
  readonly metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Corpo JSON do pedido. */
  readonly corpo?: unknown
  /** O token de acesso da sessão, quando a rota exige (`Authorization: Bearer`). Nunca vai na URL (regra 50, item 7). */
  readonly token?: string | undefined
  readonly sinal?: AbortSignal | undefined
  /** O tipo da chamada escolhe o prazo (`PRAZOS_DA_CHAMADA_MS`). `leitura` quando não dito: o JSON comum. */
  readonly tipo?: TipoDeChamada
}

/**
 * Quanto cada tipo de chamada espera pela API antes de desistir (RF11; regra 80, item 6). A chamada pendurada na rede da escola
 * não pode segurar a tela nem a fila de respostas da prova: passado o prazo, ela vira `TEMPO_ESGOTADO` e a pessoa tenta de novo.
 */
export const PRAZOS_DA_CHAMADA_MS = { leitura: 20_000, pdf: 30_000, envio: 180_000, prova: 10_000 } as const
export type TipoDeChamada = keyof typeof PRAZOS_DA_CHAMADA_MS

/** O `fetch` ligado ao sinal do prazo: é por ele que toda chamada da web sai (o lint barra o `fetch` fora deste arquivo). */
export type Pedir = (caminho: string, opcoes: RequestInit) => Promise<Response>

/**
 * Roda `executar` com um `AbortController` próprio, ligado ao sinal de quem chamou (o do TanStack Query, por exemplo), e com
 * o prazo do `tipo`. Estourado o prazo, a chamada é abortada e sai `ApiError(TEMPO_ESGOTADO)` com `origem: 'cliente'`, que a distingue do `TEMPO_ESGOTADO` da API; cancelada por quem chamou, o
 * `AbortError` é relançado como está, e a tela não mostra erro nenhum. O temporizador sai sempre que a chamada termina.
 * Sem `AbortSignal.timeout` nem `AbortSignal.any`: o Chromebook de entrada é Chrome 99.
 */
export async function comPrazo<T>(tipo: TipoDeChamada, sinalDeFora: AbortSignal | undefined, executar: (pedir: Pedir, sinal: AbortSignal) => Promise<T>): Promise<T> {
  const controle = new AbortController()
  const cancelar = (): void => controle.abort()
  if (sinalDeFora?.aborted === true) cancelar()
  sinalDeFora?.addEventListener('abort', cancelar, { once: true })
  let estourou = false
  const relogio = setTimeout(() => {
    estourou = true
    controle.abort()
  }, PRAZOS_DA_CHAMADA_MS[tipo])
  try {
    return await executar((caminho, opcoes) => fetch(caminho, { ...opcoes, signal: controle.signal }), controle.signal)
  } catch (erro) {
    if (estourou) throw new ApiError(ErrorCode.TEMPO_ESGOTADO, undefined, 'cliente')
    throw erro
  } finally {
    clearTimeout(relogio)
    sinalDeFora?.removeEventListener('abort', cancelar)
  }
}

function isCodigoDeErro(valor: unknown): valor is ErrorCode {
  return typeof valor === 'string' && Object.hasOwn(ErrorCode, valor)
}

/** O código do envelope `{ erro: { codigo } }`; sem envelope reconhecível, o código que o status permite deduzir. */
function codigoDaResposta(corpo: unknown, status: number): ErrorCode {
  if (typeof corpo === 'object' && corpo !== null && 'erro' in corpo) {
    const { erro } = corpo
    if (typeof erro === 'object' && erro !== null && 'codigo' in erro && isCodigoDeErro(erro.codigo)) return erro.codigo
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

/** O corpo JSON, ou `undefined` quando não é JSON. A leitura abortada (o prazo, quem cancelou) não é "sem corpo": o erro sobe. */
export async function readJson(resposta: Response, sinal: AbortSignal): Promise<unknown> {
  try {
    return await resposta.json()
  } catch (erro) {
    if (sinal.aborted) throw erro
    return undefined
  }
}

/**
 * Chamada à API por caminho relativo, com a resposta validada pelo contrato de `packages/shared`.
 * Toda falha sai como `ApiError`: sem rede, erro da API, resposta fora do contrato e prazo estourado (`TEMPO_ESGOTADO`, em
 * `comPrazo`: 20 s na leitura comum, ou o do `tipo` pedido). O cancelamento de quem chamou (`sinal`) é a exceção: sai o `AbortError`.
 *
 * O cookie de renovação vai junto por ser mesma origem (o navegador nunca o lê; é `HttpOnly`), e o token de acesso,
 * quando existe, vai no cabeçalho `Authorization`.
 *
 * `cache: 'no-store'`: a resposta da API não vai para o cache HTTP do navegador, que fica em disco no computador da
 * escola. Várias trazem nome e matrícula de aluno (a lista da turma, 13.0), e o Chromebook do carrinho passa de mão em
 * mão (regra 20).
 */
export function apiRequest<T>(caminho: string, esquema: ResponseSchema<T>, opcoes: RequestOptions = {}): Promise<T> {
  return comPrazo(opcoes.tipo ?? 'leitura', opcoes.sinal, (pedir, sinal) => chamar(pedir, sinal, caminho, esquema, opcoes))
}

async function chamar<T>(pedir: Pedir, sinal: AbortSignal, caminho: string, esquema: ResponseSchema<T>, { metodo = 'GET', corpo, token }: RequestOptions): Promise<T> {
  let resposta: Response
  try {
    resposta = await pedir(caminho, {
      method: metodo,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    })
  } catch (erro) {
    if (sinal.aborted) throw erro
    throw new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
  }
  const corpoDaResposta = await readJson(resposta, sinal)
  if (!resposta.ok) throw new ApiError(codigoDaResposta(corpoDaResposta, resposta.status), esperaDaResposta(resposta))
  const lido = esquema.safeParse(corpoDaResposta)
  if (!lido.success) throw new ApiError(ErrorCode.ERRO_INTERNO)
  return lido.data
}

/** `GET` numa rota anônima da API (estado do sistema, avisos). Rota com sessão passa por `authedGet`. */
export function apiGet<T>(caminho: string, esquema: ResponseSchema<T>, sinal?: AbortSignal): Promise<T> {
  return apiRequest(caminho, esquema, { sinal })
}

/** A mensagem do catálogo pt-BR para qualquer erro; o que não é `ApiError` vira erro interno. */
export function errorMessage(erro: unknown): string {
  return MENSAGENS_DE_ERRO[erro instanceof ApiError ? erro.codigo : ErrorCode.ERRO_INTERNO]
}
