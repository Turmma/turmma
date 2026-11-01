import {
  ErrorCode,
  artefatoResponseSchema,
  execucaoAceitaResponseSchema,
  listaDeArtefatosResponseSchema,
  type AdaptarArtefatoRequest,
  type ArtefatoResponse,
  type ExecucaoAceitaResponse,
} from '@educa/shared'
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { ARTEFATOS_QUERY_KEY } from '../../../../api/chaves-do-professor'
import { ApiError } from '../../../../api/client'
import { authedGet, authedRequest, renovarSessao, tokenDeAcesso } from '../../../../api/sessao'

const CAMINHO_DOS_ARTEFATOS = '/v1/artefatos'

/**
 * O que a professora já gerou (`GET /v1/artefatos`), nas turmas em que ela tem vínculo confirmado: a escola, o ano e o
 * vínculo vêm do token. Paginada, como a API entrega (regra 80, item 8).
 *
 * Com `turmaId` a leitura é só daquela turma (telas do professor, 5.0): o filtro **vai ao servidor**, que o aplica sobre o
 * que o token alcança, e a turma de outra escola ou de outra professora responde uma página vazia, como o id que não existe
 * (regra 10, itens 4 e 6). A chave de cada turma começa pela de todas, e as duas começam por `artefatos`: quem invalida
 * `ARTEFATOS_QUERY_KEY` (gerar, adaptar, decidir) alcança as duas.
 */
export function artefatosQueryOptions(turmaId?: string) {
  return infiniteQueryOptions({
    queryKey: turmaId === undefined ? [...ARTEFATOS_QUERY_KEY, 'lista'] : [...ARTEFATOS_QUERY_KEY, 'lista', turmaId],
    queryFn: ({ pageParam, signal }) => {
      const consulta = new URLSearchParams()
      if (turmaId !== undefined) consulta.set('turmaId', turmaId)
      if (pageParam !== undefined) consulta.set('pagina', pageParam)
      const texto = consulta.toString()
      return authedGet(texto === '' ? CAMINHO_DOS_ARTEFATOS : `${CAMINHO_DOS_ARTEFATOS}?${texto}`, listaDeArtefatosResponseSchema, signal)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultima) => ultima.proxima,
  })
}

/** Um artefato inteiro (`GET /v1/artefatos/:id`): o conteúdo, as versões adaptadas que saíram dele e as aplicações. */
export function artefatoQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...ARTEFATOS_QUERY_KEY, 'um', id],
    queryFn: ({ signal }) => authedGet(`${CAMINHO_DOS_ARTEFATOS}/${encodeURIComponent(id)}`, artefatoResponseSchema, signal),
  })
}

/** `PATCH /v1/artefatos/:id`: só o título. O conteúdo gerado não se edita por aqui. */
export function renomearArtefato(id: string, titulo: string): Promise<ArtefatoResponse> {
  return authedRequest(`${CAMINHO_DOS_ARTEFATOS}/${encodeURIComponent(id)}`, artefatoResponseSchema, { metodo: 'PATCH', corpo: { titulo } })
}

/**
 * `POST /v1/artefatos/:id/adaptar`: os **tipos de adaptação**, de lista fechada, o tempo extra e a chave do envio. O
 * pedido não tem campo de texto, e o tipo `AdaptarArtefatoRequest` não deixa pôr um (D35, D67). Responde 202; a versão
 * nasce com uma entrega pendente.
 */
export function adaptarArtefato(id: string, pedido: AdaptarArtefatoRequest): Promise<ExecucaoAceitaResponse> {
  return authedRequest(`${CAMINHO_DOS_ARTEFATOS}/${encodeURIComponent(id)}/adaptar`, execucaoAceitaResponseSchema, { metodo: 'POST', corpo: pedido })
}

/** O nome do arquivo quando o cabeçalho não diz: o título, sem o que um nome de arquivo não aceita. */
export function nomeDoArquivoPdf(titulo: string): string {
  const limpo = titulo
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim()
  return `${limpo === '' ? 'artefato' : limpo}.pdf`
}

/** O `filename` de um `Content-Disposition: attachment`, na forma simples e na codificada (`filename*=UTF-8''…`). */
export function nomeNoCabecalho(cabecalho: string | null): string | undefined {
  if (cabecalho === null) return undefined
  const codificado = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cabecalho)?.[1]
  if (codificado !== undefined) {
    try {
      return decodeURIComponent(codificado.trim())
    } catch {
      // Codificação quebrada: vale o nome simples, ou o do título.
    }
  }
  const simples = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(cabecalho)
  const nome = (simples?.[2] ?? simples?.[1])?.trim()
  return nome === undefined || nome === '' ? undefined : nome
}

function ehCodigoDeErro(valor: unknown): valor is ErrorCode {
  return typeof valor === 'string' && Object.hasOwn(ErrorCode, valor)
}

/** O erro de uma resposta que não trouxe o PDF: o código do envelope da API, ou o que o status permite dizer. */
async function erroDoPdf(resposta: Response): Promise<ApiError> {
  try {
    const corpo: unknown = await resposta.json()
    if (typeof corpo === 'object' && corpo !== null && 'erro' in corpo) {
      const { erro } = corpo
      if (typeof erro === 'object' && erro !== null && 'codigo' in erro && ehCodigoDeErro(erro.codigo)) return new ApiError(erro.codigo)
    }
  } catch {
    // Sem envelope: o status decide.
  }
  if (resposta.status === 404) return new ApiError(ErrorCode.NAO_ENCONTRADO)
  if (resposta.status === 429) return new ApiError(ErrorCode.LIMITE_EXCEDIDO)
  if (resposta.status >= 502 && resposta.status <= 504) return new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
  return new ApiError(ErrorCode.ERRO_INTERNO)
}

async function pedirPdf(caminho: string): Promise<Response> {
  const token = tokenDeAcesso()
  try {
    // `no-store`: o PDF tem o gabarito, e o cache HTTP do navegador fica em disco no computador da escola.
    return await fetch(caminho, { cache: 'no-store', headers: { Accept: 'application/pdf', ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }) } })
  } catch {
    throw new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
  }
}

export interface PdfDoArtefato {
  readonly arquivo: Blob
  readonly nome: string
}

/**
 * `GET /v1/artefatos/:id/pdf`: o artefato em PDF. É binário, e por isso não passa por `authedRequest`, que valida
 * JSON; a sessão é a mesma: o token vai no cabeçalho (nunca na URL, regra 50, item 7) e, recusado, é renovado uma vez.
 * Toda falha sai como `ApiError`, com código do catálogo.
 */
export async function baixarPdfDoArtefato(id: string, titulo: string): Promise<PdfDoArtefato> {
  const caminho = `${CAMINHO_DOS_ARTEFATOS}/${encodeURIComponent(id)}/pdf`
  let resposta = await pedirPdf(caminho)
  if (resposta.status === 401) {
    await renovarSessao()
    resposta = await pedirPdf(caminho)
  }
  if (!resposta.ok) throw await erroDoPdf(resposta)
  return { arquivo: await resposta.blob(), nome: nomeNoCabecalho(resposta.headers.get('Content-Disposition')) ?? nomeDoArquivoPdf(titulo) }
}

/** Entrega o arquivo à pessoa pelo navegador, como um download comum. O endereço temporário é solto em seguida. */
export function salvarArquivo({ arquivo, nome }: PdfDoArtefato): void {
  const endereco = URL.createObjectURL(arquivo)
  const link = document.createElement('a')
  link.href = endereco
  link.download = nome
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(endereco)
}
