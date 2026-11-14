import {
  ErrorCode,
  listaDeMateriaisResponseSchema,
  materialComCapitulosResponseSchema,
  materialResponseSchema,
  type AtualizarMaterialRequest,
  type EnviarEdicaoRequest,
  type LicencaDeclarada,
  type Material,
  type TitularidadeDeMaterial,
} from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { ApiError, EMPTY_BODY } from '../../../../api/client'
import { lerPaginas, type ListaDaEstrutura } from '../../../../api/estrutura'
import { authedGet, authedRequest, tokenDeAcesso } from '../../../../api/sessao'

/**
 * O material da escola pela coordenação (MVP, A2; D5, D75): a lista, o envio e a exclusão. A escola vem do token, nunca
 * da tela (regra 10, item 3).
 */

/** O começo de toda chave desta tela: a troca de escola e a pessoa seguinte esvaziam tudo junto (`main.tsx`). */
export const MATERIAL_QUERY_KEY = ['material'] as const

/** De quanto em quanto tempo a lista é lida de novo enquanto houver material sendo lido. */
export const INTERVALO_DA_LEITURA_DO_MATERIAL_MS = 1_500

const CAMINHO = '/v1/materiais'

/** Com algum material `processando`, a lista se relê sozinha; sem nenhum, para. */
export function intervaloDaLista(lista: ListaDaEstrutura<Pick<Material, 'estado'>> | undefined): number | false {
  return lista?.itens.some((material) => material.estado === 'processando') === true ? INTERVALO_DA_LEITURA_DO_MATERIAL_MS : false
}

/**
 * Os materiais da escola, em ordem de envio. Enquanto algum está `processando`, a consulta se repete a cada 1,5 s, sem
 * a pessoa recarregar a página; quando todos saíram de `processando`, para (regra 80: nada de consulta em laço à toa).
 */
export const materiaisQueryOptions = queryOptions({
  queryKey: [...MATERIAL_QUERY_KEY, 'lista'],
  queryFn: ({ signal }) => lerPaginas<Material>(CAMINHO, listaDeMateriaisResponseSchema, signal),
  refetchInterval: (consulta) => intervaloDaLista(consulta.state.data),
})

/** Os campos do envio, como a tela os tem. `declaracao` vai como texto no multipart. */
export interface CamposDoEnvioDeMaterial {
  readonly titulo: string
  readonly disciplinaId: string
  /** De 1 a 7 séries da escola; o multipart leva o campo `serieIds` repetido, uma vez por série. */
  readonly serieIds: readonly string[]
  readonly titularidade: TitularidadeDeMaterial
  /** A licença registrada (`GET /v1/licencas`), só no material de terceiro: o nome de quem licenciou vem dela, nunca da tela. */
  readonly licencaId?: string
  readonly licenca: LicencaDeclarada
  readonly declaracao: boolean
}

function ehCodigoDeErro(valor: unknown): valor is ErrorCode {
  return typeof valor === 'string' && Object.hasOwn(ErrorCode, valor)
}

/** O código do envelope `{ erro: { codigo } }`; sem envelope reconhecível, o que o status permite deduzir. */
function codigoDaResposta(corpo: unknown, status: number): ErrorCode {
  if (typeof corpo === 'object' && corpo !== null && 'erro' in corpo) {
    const { erro } = corpo
    if (typeof erro === 'object' && erro !== null && 'codigo' in erro && ehCodigoDeErro(erro.codigo)) return erro.codigo
  }
  if (status === 401) return ErrorCode.NAO_AUTENTICADO
  if (status === 413) return ErrorCode.ENTRADA_INVALIDA
  if (status === 429) return ErrorCode.LIMITE_EXCEDIDO
  if (status === 502 || status === 503 || status === 504) return ErrorCode.INDISPONIVEL_TENTE_DE_NOVO
  return ErrorCode.ERRO_INTERNO
}

/**
 * `POST /v1/materiais`, em multipart: os campos **antes** do arquivo, para a API recusar por licença sem receber os
 * bytes. Sem `arquivo`, vai só o pedido: é o envio que a tela já sabe que será recusado (sem licença, ou sem a
 * declaração), e que precisa chegar à API para a recusa ficar na auditoria da escola — o arquivo nem sai do computador.
 *
 * O cliente da sessão (`authedRequest`) só manda JSON. Antes de subir até 20 MB, uma leitura pequena passa por ele: é
 * ela que renova o token vencido e encerra a sessão que acabou, pelo mesmo caminho de toda outra tela. O token usado no
 * envio é o que ficou em memória depois dela, no cabeçalho, nunca na URL (regra 50, item 7).
 */
export async function enviarMaterial(campos: CamposDoEnvioDeMaterial, arquivo: File | undefined): Promise<Material> {
  const formulario = new FormData()
  formulario.append('titulo', campos.titulo)
  formulario.append('disciplinaId', campos.disciplinaId)
  for (const serieId of campos.serieIds) formulario.append('serieIds', serieId)
  formulario.append('titularidade', campos.titularidade)
  if (campos.licencaId !== undefined) formulario.append('licencaId', campos.licencaId)
  formulario.append('licenca', campos.licenca)
  formulario.append('declaracao', campos.declaracao ? 'true' : 'false')
  // O nome do arquivo no computador da pessoa não vai junto: a API não o usa, e ele não é dado do material.
  if (arquivo !== undefined) formulario.append('arquivo', arquivo, 'material.pdf')
  return enviarMultipart(CAMINHO, formulario)
}

/**
 * `POST /v1/materiais/:id/edicoes` (ingestao-do-material, 12.0; RF10): a edição nova de um material que está `pronto`. Vai só o PDF e, se a pessoa quiser, o rótulo da edição (o título a edição leva o do material): a disciplina, as séries, a titularidade e a
 * licença a API herda do material que a edição substitui. Pelo mesmo caminho do envio (token renovado antes, campos antes do arquivo, `Retry-After` no limite).
 */
export function enviarEdicao(alvoId: string, campos: Pick<EnviarEdicaoRequest, 'edicao'>, arquivo: File): Promise<Material> {
  const formulario = new FormData()
  if (campos.edicao !== undefined) formulario.append('edicao', campos.edicao)
  formulario.append('arquivo', arquivo, 'material.pdf')
  return enviarMultipart(`${CAMINHO}/${encodeURIComponent(alvoId)}/edicoes`, formulario)
}

async function enviarMultipart(caminho: string, formulario: FormData): Promise<Material> {
  await authedGet(`${CAMINHO}?limite=1`, listaDeMateriaisResponseSchema)
  const token = tokenDeAcesso()
  if (token === undefined) throw new ApiError(ErrorCode.NAO_AUTENTICADO)
  let resposta: Response
  try {
    resposta = await fetch(caminho, { method: 'POST', cache: 'no-store', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, body: formulario })
  } catch {
    throw new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
  }
  let corpo: unknown
  try {
    corpo = await resposta.json()
  } catch {
    corpo = undefined
  }
  if (!resposta.ok) {
    const espera = Number(resposta.headers.get('Retry-After'))
    throw new ApiError(codigoDaResposta(corpo, resposta.status), Number.isFinite(espera) && espera > 0 ? espera : undefined)
  }
  const lido = materialResponseSchema.safeParse(corpo)
  if (!lido.success) throw new ApiError(ErrorCode.ERRO_INTERNO)
  return lido.data
}

/**
 * Os capítulos de um material (`GET /v1/materiais/:id`, ingestao-do-material, 12.0; RF4): lidos só do material que está `pronto`, que é o que tem capítulos. A chave leva o id: a troca de material no mesmo painel nunca mostra os
 * capítulos do anterior.
 */
export const materialComCapitulosQueryOptions = (id: string, habilitada: boolean) =>
  queryOptions({
    queryKey: [...MATERIAL_QUERY_KEY, 'capitulos', id],
    queryFn: ({ signal }) => authedGet(`${CAMINHO}/${encodeURIComponent(id)}`, materialComCapitulosResponseSchema, signal),
    enabled: habilitada,
  })

/** `PATCH /v1/materiais/:id` (RF6): corrige o título e as séries; vale na hora para a busca. Responde o material como ficou. */
export function atualizarMaterial(id: string, campos: AtualizarMaterialRequest): Promise<Material> {
  return authedRequest(`${CAMINHO}/${encodeURIComponent(id)}`, materialResponseSchema, { metodo: 'PATCH', corpo: campos })
}

/** `DELETE /v1/materiais/:id`: exclusão lógica; os trechos saem da busca na mesma hora. */
export function excluirMaterial(id: string): Promise<void> {
  return authedRequest(`${CAMINHO}/${encodeURIComponent(id)}`, EMPTY_BODY, { metodo: 'DELETE' })
}
