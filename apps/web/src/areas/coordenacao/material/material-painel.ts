import { ErrorCode, TAMANHO_MAXIMO_DA_EDICAO, type AtualizarMaterialRequest, type CapituloDoMaterial, type Material } from '@educa/shared'
import { ApiError, errorMessage } from '../../../api/client'
import { erroDoTitulo, horaDaEspera, TEXTOS_DA_FALHA_DO_ENVIO } from './material-envio'

/**
 * As regras do painel do material que não dependem do React (ingestao-do-material, 12.0; RF4, RF6, RF10): o pedido do `PATCH` (só o que mudou), o que falta no formulário,
 * a edição em andamento, a faixa de páginas de um capítulo e o texto de cada falha. A tela não tem regra própria: a API decide, a tela diz o que fazer.
 */

/** O que o formulário do painel tem: o título como a pessoa o deixou e as séries marcadas. */
export interface RascunhoDoPainel {
  readonly titulo: string
  readonly serieIds: readonly string[]
}

export function rascunhoDoMaterial(material: Pick<Material, 'titulo' | 'serieIds'>): RascunhoDoPainel {
  return { titulo: material.titulo, serieIds: material.serieIds }
}

const ERRO_DAS_SERIES = 'Marque ao menos uma série: é por ela que o professor e o Tutor acham o material.'

export interface ErrosDoPainel {
  readonly titulo?: string
  readonly serieIds?: string
}

/** O que falta no formulário, dizendo o que fazer. O título é o de `erroDoTitulo`, o mesmo do envio. */
export function errosDoPainel(rascunho: RascunhoDoPainel): ErrosDoPainel {
  const titulo = erroDoTitulo(rascunho.titulo)
  return { ...(titulo === undefined ? {} : { titulo }), ...(rascunho.serieIds.length === 0 ? { serieIds: ERRO_DAS_SERIES } : {}) }
}

function mesmasSeries(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((serieId) => b.includes(serieId))
}

/**
 * O pedido do `PATCH`: só os campos que mudaram. Sem mudança nenhuma, ou com erro no formulário, não há pedido (`undefined`): o botão não manda um `PATCH` que a API recusaria, nem gasta o teto de alterações
 * da escola.
 */
export function pedidoDoPatch(material: Pick<Material, 'titulo' | 'serieIds'>, rascunho: RascunhoDoPainel): AtualizarMaterialRequest | undefined {
  const erros = errosDoPainel(rascunho)
  if (erros.titulo !== undefined || erros.serieIds !== undefined) return undefined
  const titulo = rascunho.titulo.trim()
  const tituloMudou = titulo !== material.titulo
  const seriesMudaram = !mesmasSeries(rascunho.serieIds, material.serieIds)
  if (!tituloMudou && !seriesMudaram) return undefined
  return { ...(tituloMudou ? { titulo } : {}), ...(seriesMudaram ? { serieIds: [...rascunho.serieIds] } : {}) }
}

/** Há alteração no formulário (mesmo inválida)? É o que liga o "Salvar alterações". */
export function houveMudanca(material: Pick<Material, 'titulo' | 'serieIds'>, rascunho: RascunhoDoPainel): boolean {
  return rascunho.titulo.trim() !== material.titulo || !mesmasSeries(rascunho.serieIds, material.serieIds)
}

/**
 * O material tem uma edição sendo lida? É a edição que ainda está `processando` e substitui este material, **ou** o próprio material, se ele é essa edição. Enquanto isso, a API recusa o `PATCH` e outra edição
 * (`EDICAO_EM_ANDAMENTO`), e o painel nem os oferece.
 */
export function temEdicaoEmAndamento(material: Pick<Material, 'id' | 'estado' | 'substitui'>, lista: readonly Pick<Material, 'estado' | 'substitui'>[]): boolean {
  if (material.estado === 'processando' && material.substitui !== null) return true
  return lista.some((outro) => outro.estado === 'processando' && outro.substitui === material.id)
}

export const TEXTO_DA_EDICAO_EM_ANDAMENTO = 'Espere a edição em processamento terminar.'

/** O que o "Enviar edição nova" avisa antes de enviar (RF10): a anterior continua valendo até a nova ficar pronta. */
export const TEXTO_DO_EFEITO_DA_EDICAO_NOVA = 'A edição anterior sai da busca quando a nova ficar pronta. Até lá, ela continua valendo.'

export const TEXTO_DO_PATCH_SALVO = 'Alterações salvas. A busca do Assistente e do Tutor já usa as séries novas.'
export const TEXTO_DA_EDICAO_ENVIADA = 'Edição enviada. A leitura das páginas começa agora; a anterior sai da busca quando a nova ficar pronta.'

/** "Páginas 12 a 20", ou "Página 12" no capítulo de uma página só. */
export function paginasDoCapitulo(capitulo: Pick<CapituloDoMaterial, 'paginaInicial' | 'paginaFinal'>): string {
  return capitulo.paginaInicial === capitulo.paginaFinal ? `Página ${String(capitulo.paginaInicial)}` : `Páginas ${String(capitulo.paginaInicial)} a ${String(capitulo.paginaFinal)}`
}

/** O título do capítulo, com o número que o PDF escreve quando há: "Capítulo 3 · Frações". */
export function tituloDoCapitulo(capitulo: Pick<CapituloDoMaterial, 'numero' | 'titulo'>): string {
  return capitulo.numero === null ? capitulo.titulo : `Capítulo ${String(capitulo.numero)} · ${capitulo.titulo}`
}

export const TEXTO_SEM_CAPITULO = 'O PDF não tem capítulos que a leitura reconheça. A busca continua achando o material pelas páginas.'
export const TEXTO_DOS_CAPITULOS_AINDA_NAO = 'Os capítulos aparecem quando a leitura terminar.'

/** O limite de alterações: a hora em que dá para tentar de novo. */
export function textoDoLimiteDeAlteracoes(esperaSegundos: number | undefined, agora: Date = new Date()): string {
  return esperaSegundos === undefined ? 'Muitas alterações por agora. Tente de novo em instantes.' : `Muitas alterações por agora. Tente de novo às ${horaDaEspera(esperaSegundos, agora)}.`
}

/** O texto de cada falha do "Salvar alterações". `EDICAO_EM_ANDAMENTO` e as outras caem no texto do catálogo, que já diz "Espere a edição em processamento terminar". */
export function textoDaFalhaDoPatch(erro: unknown, agora: Date = new Date()): string {
  if (erro instanceof ApiError) {
    if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return textoDoLimiteDeAlteracoes(erro.esperaSegundos, agora)
    if (erro.codigo === ErrorCode.NAO_ENCONTRADO) return 'Este material, ou uma das séries, já não existe. A lista foi atualizada.'
    if (erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO) return 'As alterações não foram salvas. Tente de novo em instantes.'
  }
  return errorMessage(erro)
}

/** O texto de cada falha do "Enviar edição nova": os do envio de material, e os que são só da edição. */
export function textoDaFalhaDaEdicao(erro: unknown, agora: Date = new Date()): string {
  if (erro instanceof ApiError) {
    if (erro.codigo === ErrorCode.NAO_ENCONTRADO) return 'Este material já não aceita edição nova. A lista foi atualizada.'
    if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return erro.esperaSegundos === undefined ? 'Muitos envios por agora. Tente de novo em instantes.' : `Muitos envios por agora. Tente de novo às ${horaDaEspera(erro.esperaSegundos, agora)}.`
    const texto = TEXTOS_DA_FALHA_DO_ENVIO[erro.codigo]
    if (texto !== undefined) return texto
  }
  return errorMessage(erro)
}

/** Esta falha mudou o que o painel mostra (o material saiu, ou a edição começou)? A lista é relida. */
export function falhaMudouOMaterial(erro: unknown): boolean {
  return erro instanceof ApiError && (erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.EDICAO_EM_ANDAMENTO)
}

export const MAXIMO_DO_ROTULO_DA_EDICAO = TAMANHO_MAXIMO_DA_EDICAO

/** O que está errado no rótulo da edição (opcional), ou `undefined`. */
export function erroDoRotuloDaEdicao(rotulo: string): string | undefined {
  return rotulo.trim().length > MAXIMO_DO_ROTULO_DA_EDICAO ? `O nome da edição tem no máximo ${String(MAXIMO_DO_ROTULO_DA_EDICAO)} caracteres.` : undefined
}
