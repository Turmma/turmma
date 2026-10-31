import {
  ErrorCode,
  listaDeMateriaisResponseSchema,
  materialResponseSchema,
  type LicencaDeclarada,
  type Material,
  type TitularidadeDeMaterial,
} from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { ErroDaApi, SEM_CORPO } from '../../../../api/client'
import { lerPaginas, type ListaDaEstrutura } from '../../../../api/estrutura'
import { buscarComSessao, chamarComSessao, tokenDeAcesso } from '../../../../api/sessao'

/**
 * O material da escola pela coordenação (MVP, A2; D5, D75): a lista, o envio e a exclusão. A escola vem do token, nunca
 * da tela (regra 10, item 3).
 */

/** O começo de toda chave desta tela: a troca de escola e a pessoa seguinte esvaziam tudo junto (`main.tsx`). */
export const CHAVE_DO_MATERIAL = ['material'] as const

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
export const consultaMateriais = queryOptions({
  queryKey: [...CHAVE_DO_MATERIAL, 'lista'],
  queryFn: ({ signal }) => lerPaginas<Material>(CAMINHO, listaDeMateriaisResponseSchema, signal),
  refetchInterval: (consulta) => intervaloDaLista(consulta.state.data),
})

/** Os campos do envio, como a tela os tem. `declaracao` vai como texto no multipart. */
export interface CamposDoEnvioDeMaterial {
  readonly titulo: string
  readonly disciplinaId: string
  readonly titularidade: TitularidadeDeMaterial
  readonly licenciante?: string
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
 * O cliente da sessão (`chamarComSessao`) só manda JSON. Antes de subir até 20 MB, uma leitura pequena passa por ele: é
 * ela que renova o token vencido e encerra a sessão que acabou, pelo mesmo caminho de toda outra tela. O token usado no
 * envio é o que ficou em memória depois dela, no cabeçalho, nunca na URL (regra 50, item 7).
 */
export async function enviarMaterial(campos: CamposDoEnvioDeMaterial, arquivo: File | undefined): Promise<Material> {
  await buscarComSessao(`${CAMINHO}?limite=1`, listaDeMateriaisResponseSchema)
  const token = tokenDeAcesso()
  if (token === undefined) throw new ErroDaApi(ErrorCode.NAO_AUTENTICADO)
  const formulario = new FormData()
  formulario.append('titulo', campos.titulo)
  formulario.append('disciplinaId', campos.disciplinaId)
  formulario.append('titularidade', campos.titularidade)
  if (campos.licenciante !== undefined) formulario.append('licenciante', campos.licenciante)
  formulario.append('licenca', campos.licenca)
  formulario.append('declaracao', campos.declaracao ? 'true' : 'false')
  // O nome do arquivo no computador da pessoa não vai junto: a API não o usa, e ele não é dado do material.
  if (arquivo !== undefined) formulario.append('arquivo', arquivo, 'material.pdf')
  let resposta: Response
  try {
    resposta = await fetch(CAMINHO, { method: 'POST', cache: 'no-store', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, body: formulario })
  } catch {
    throw new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
  }
  let corpo: unknown
  try {
    corpo = await resposta.json()
  } catch {
    corpo = undefined
  }
  if (!resposta.ok) {
    const espera = Number(resposta.headers.get('Retry-After'))
    throw new ErroDaApi(codigoDaResposta(corpo, resposta.status), Number.isFinite(espera) && espera > 0 ? espera : undefined)
  }
  const lido = materialResponseSchema.safeParse(corpo)
  if (!lido.success) throw new ErroDaApi(ErrorCode.ERRO_INTERNO)
  return lido.data
}

/** `DELETE /v1/materiais/:id`: exclusão lógica; os trechos saem da busca na mesma hora. */
export function excluirMaterial(id: string): Promise<void> {
  return chamarComSessao(`${CAMINHO}/${encodeURIComponent(id)}`, SEM_CORPO, { metodo: 'DELETE' })
}
