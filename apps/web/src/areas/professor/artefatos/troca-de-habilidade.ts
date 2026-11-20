import { ErrorCode, type ArtefatoResponse, type HabilidadeCandidataBncc, type SecaoDaQuestao } from '@educa/shared'
import { ApiError, errorMessage } from '../../../api/client'
import { textoDoLimiteDeAlteracoesSeguidas } from '../../../components/habilidades/nome-da-secao'

/**
 * O que a troca da habilidade da questão diz e decide, sem React (classificacao-bncc, 11.0; RF9; `cenarios.md`, "Telas", artefato): quando a troca está fechada e por quê, a ordem das candidatas e o texto de cada falha.
 * A API decide (a ordem das respostas é a da Tech Spec, seção 4); a tela só não oferece o que ela recusaria e diz o que fazer.
 */

export const TEXTO_DA_TROCA_FECHADA = 'Esta atividade já foi aplicada (ou tem versão adaptada). Gere a atividade de novo para mudar a habilidade.'
export const TEXTO_DA_TROCA_DA_VERSAO_ADAPTADA = 'Esta é a versão adaptada: ela repete a habilidade da atividade de origem. Para mudar a habilidade, troque na atividade de origem antes de adaptar.'
export const TEXTO_DA_FALHA_DA_TROCA = 'Não foi possível trocar a habilidade. Tente de novo.'
export const ROTULO_DE_TROCAR = 'Trocar'
export const ROTULO_DE_DEIXAR_SEM_HABILIDADE = 'Deixar sem habilidade'

/**
 * Por que a troca está fechada, ou `undefined` quando está aberta: a versão adaptada (que repete a habilidade do original), a atividade já aplicada e a que já tem versão adaptada. Só a atividade objetiva tem questão para trocar.
 * A tela lê o que o artefato já traz (`aplicacoes`, `versoesAdaptadas`, `origemId`); se mudou desde a leitura, a API responde `CONFLITO` e a tela diz o mesmo.
 */
export function motivoDaTrocaFechada(artefato: Pick<ArtefatoResponse, 'origemId' | 'aplicacoes' | 'versoesAdaptadas'>): string | undefined {
  if (artefato.origemId !== null) return TEXTO_DA_TROCA_DA_VERSAO_ADAPTADA
  if (artefato.aplicacoes.length > 0 || artefato.versoesAdaptadas.length > 0) return TEXTO_DA_TROCA_FECHADA
  return undefined
}

/**
 * As candidatas na ordem da lista da troca: **as do capítulo da questão primeiro**, depois as outras do recorte, cada grupo na ordem em que a API as mandou. Com a classificação pela IA suspensa, o que a IA sugeriu não vale (Tech Spec,
 * seção 5, "Suspensão"): não ganha prioridade, e só as corrigidas pela coordenação sobem. Sem seção (`null`), a ordem é a da API.
 */
export function candidatasEmOrdem(itens: readonly HabilidadeCandidataBncc[], secao: SecaoDaQuestao | null, suspensa: boolean): HabilidadeCandidataBncc[] {
  const doCapitulo = new Set((secao?.habilidades ?? []).filter((habilidade) => !suspensa || habilidade.origem === 'coordenacao').map((habilidade) => habilidade.codigo))
  return [...itens.filter((item) => doCapitulo.has(item.codigo)), ...itens.filter((item) => !doCapitulo.has(item.codigo))]
}

/** O texto de cada falha da troca: o `CONFLITO` diz que a atividade já foi aplicada; o 429, quando tentar de novo; o resto, uma frase só. */
export function textoDaFalhaDaTroca(erro: unknown): string {
  if (erro instanceof ApiError) {
    if (erro.codigo === ErrorCode.CONFLITO) return TEXTO_DA_TROCA_FECHADA
    if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return textoDoLimiteDeAlteracoesSeguidas(erro.esperaSegundos)
    if (erro.codigo === ErrorCode.NAO_ENCONTRADO) return errorMessage(erro)
  }
  return TEXTO_DA_FALHA_DA_TROCA
}

/** A troca fechada por `CONFLITO`: a leitura do artefato que a tela tem está velha, e é lida de novo. */
export function falhaMudouOArtefato(erro: unknown): boolean {
  return erro instanceof ApiError && erro.codigo === ErrorCode.CONFLITO
}
