import { ErrorCode, type HabilidadeDaSecao, type OrigemDaHabilidadeDaSecao, type ReclassificarResponse, type SecaoDoMaterialResponse, type SituacaoDaSecao } from '@educa/shared'
import { ApiError, errorMessage } from '../../../api/client'
import type { StatusFamily } from '../../../components/ui/StatusBadge'
import { paginasDaSecao, textoDoLimiteDeAlteracoesSeguidas, tituloDaSecao } from '../../../components/habilidades/nome-da-secao'

/**
 * O que a seção "Habilidades da BNCC" do painel do material diz, sem React (classificacao-bncc, 8.0; RF6, RF12; `cenarios.md`, "Telas"): o nome de cada capítulo, o rótulo de cada situação, de quem é cada habilidade,
 * a confirmação do que o "Reclassificar" refaz e o texto de cada falha. **Na tela a seção é sempre "capítulo" (ou "páginas X a Y"), nunca "trecho" nem "seção".** A API decide, a tela diz o que fazer.
 */

export const TEXTO_DO_VAZIO_DA_CLASSIFICACAO = 'Nenhum capítulo classificado ainda. A classificação roda à noite.'
export const TEXTO_DA_SUSPENSAO = 'A classificação pela IA está suspensa na escola. Valem só as habilidades corrigidas pela coordenação.'
export const TEXTO_DA_CLASSIFICACAO_QUE_NAO_LEU = 'Não foi possível ler as habilidades.'
export const TEXTO_DO_RECLASSIFICAR_SEM_O_QUE_REFAZER = 'Todos os capítulos já foram corrigidos pela coordenação: não há o que classificar de novo.'
export const TEXTO_DA_CORRECAO_FINAL = 'A correção vale no lugar da IA e não é refeita ao reclassificar. Para mudar de novo, corrija outra vez.'
export const TEXTO_DO_CONFLITO_DA_CORRECAO = 'Este material ainda não terminou de processar. Corrija as habilidades quando ele estiver pronto.'

/** Quem pôs a habilidade, dito na tela: a IA sempre se declara como tal (regra 70, item 3; `docs/interface.md` 6). */
export const TEXTO_DA_ORIGEM: Readonly<Record<OrigemDaHabilidadeDaSecao, string>> = {
  ia: 'Sugerida pela IA',
  coordenacao: 'Corrigida pela coordenação',
}

const TEXTO_DA_IA_QUE_NAO_VALE = 'Sugerida pela IA (não vale enquanto a classificação está suspensa)'

/** A origem de uma habilidade, dita na tela. Com a função suspensa, o que a IA sugeriu não vale (a geração e a cobertura o ignoram), e a tela o diz ao lado. */
export function textoDaOrigem(origem: OrigemDaHabilidadeDaSecao, suspensa: boolean): string {
  return origem === 'ia' && suspensa ? TEXTO_DA_IA_QUE_NAO_VALE : TEXTO_DA_ORIGEM[origem]
}

/** O aviso de quem não tem componente: a classificação precisa dele para saber de que habilidades se trata. */
export function textoDoComponenteQueFalta(disciplina: string): string {
  return `Defina o componente da BNCC de ${disciplina} na Estrutura para classificar este material`
}

export { paginasDaSecao, tituloDaSecao }

/** O que a linha diz da situação e a família do selo; `classificada` não diz nada: as habilidades são o que ela mostra. */
export interface RotuloDaSecao {
  readonly texto: string
  readonly familia: StatusFamily
}

const ROTULO_DA_SITUACAO: Readonly<Record<SituacaoDaSecao, RotuloDaSecao | undefined>> = {
  nao_agendada: { texto: 'Ainda não classificado', familia: 'info' },
  aguardando: { texto: 'Classificação à noite', familia: 'pendente' },
  classificada: undefined,
  sem_habilidade: { texto: 'A IA não achou habilidade neste capítulo', familia: 'info' },
  nao_classificada: { texto: 'A classificação não terminou.', familia: 'erro' },
}

/**
 * O rótulo da situação de um capítulo. O capítulo **corrigido** sem nenhum código não é "a IA não achou": foi a coordenação que o deixou sem habilidade, e a tela diz isso.
 * Com a função suspensa, o capítulo que a IA não terminou não tem rótulo próprio: o aviso da suspensão, no alto, é o que a tela diz (e "Reclassificar" não existe).
 */
export function rotuloDaSecao(secao: Pick<SecaoDoMaterialResponse, 'situacao' | 'corrigida'>, suspensa: boolean): RotuloDaSecao | undefined {
  if (secao.corrigida && secao.situacao === 'sem_habilidade') return { texto: 'Sem habilidade neste capítulo, como a coordenação corrigiu', familia: 'info' }
  if (suspensa && secao.situacao === 'nao_classificada') return undefined
  return ROTULO_DA_SITUACAO[secao.situacao]
}

/** Quantos capítulos o "Reclassificar" refaz e quantos a coordenação corrigiu e por isso ficam como estão (RF12). */
export function contagemDoReclassificar(secoes: ReadonlyArray<Pick<SecaoDoMaterialResponse, 'corrigida'>>): { readonly refeitos: number; readonly corrigidos: number } {
  const corrigidos = secoes.filter((secao) => secao.corrigida).length
  return { refeitos: secoes.length - corrigidos, corrigidos }
}

/** "3 capítulos serão classificados de novo à noite; 1 corrigido fica como está.": o que a pessoa lê antes de confirmar (regra 50, item 8). */
export function textoDaConfirmacaoDoReclassificar(refeitos: number, corrigidos: number): string {
  const primeira = refeitos === 1 ? '1 capítulo será classificado' : `${String(refeitos)} capítulos serão classificados`
  const segunda = corrigidos === 1 ? '1 corrigido fica como está' : `${String(corrigidos)} corrigidos ficam como estão`
  return `${primeira} de novo à noite; ${segunda}.`
}

/** O que a tela diz depois de a API aceitar o pedido, com os números que ela devolveu. */
export function textoDoReclassificarPedido(resposta: Pick<ReclassificarResponse, 'secoes' | 'preservadas'>): string {
  return `Pedido feito. ${textoDaConfirmacaoDoReclassificar(resposta.secoes, resposta.preservadas)}`
}

/** O 429 da correção e do reclassificar: "Tente de novo em N minutos", arredondando para cima; sem `Retry-After`, "em instantes". É o mesmo texto da troca da habilidade da questão (11.0). */
export const textoDoLimiteDaClassificacao = textoDoLimiteDeAlteracoesSeguidas

/** O texto de cada falha da correção; o resto cai no catálogo, que diz o que fazer. */
export function textoDaFalhaDaCorrecao(erro: unknown): string {
  if (erro instanceof ApiError) {
    if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return textoDoLimiteDaClassificacao(erro.esperaSegundos)
    if (erro.codigo === ErrorCode.CONFLITO) return TEXTO_DO_CONFLITO_DA_CORRECAO
    if (erro.codigo === ErrorCode.ENTRADA_INVALIDA) return 'Alguma habilidade não vale mais para este material. A lista foi atualizada: escolha de novo.'
    if (erro.codigo === ErrorCode.NAO_ENCONTRADO) return 'Este capítulo, ou o material, já não existe. A lista foi atualizada.'
  }
  return errorMessage(erro)
}

/** O texto de cada falha do "Reclassificar". A suspensão que começou depois de a tela abrir diz a mesma coisa do aviso. */
export function textoDaFalhaDoReclassificar(erro: unknown): string {
  if (erro instanceof ApiError) {
    if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return textoDoLimiteDaClassificacao(erro.esperaSegundos)
    if (erro.codigo === ErrorCode.FUNCAO_SUSPENSA) return TEXTO_DA_SUSPENSAO
    if (erro.codigo === ErrorCode.CONFLITO) return 'Este material não pode ser classificado de novo agora: ele ainda está sendo lido, ou a disciplina ficou sem componente da BNCC.'
    if (erro.codigo === ErrorCode.NAO_ENCONTRADO) return 'Este material já não existe. A lista foi atualizada.'
  }
  return errorMessage(erro)
}

/** Esta falha mudou o que a tela sabe (o capítulo ou o material saiu, o recorte mudou, o material deixou de estar pronto, a função foi suspensa)? A leitura é refeita. */
export function falhaMudouAClassificacao(erro: unknown): boolean {
  return (
    erro instanceof ApiError &&
    (erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.CONFLITO || erro.codigo === ErrorCode.ENTRADA_INVALIDA || erro.codigo === ErrorCode.FUNCAO_SUSPENSA)
  )
}

/**
 * Os códigos com que o editor de um capítulo começa: os que ele tem hoje. **Com a função suspensa, só os que a coordenação corrigiu**: a geração e a cobertura ignoram o que a IA sugeriu (Tech Spec, seção 5), e
 * a sugestão da IA não é ponto de partida de uma correção. O que deixou de ser candidato do recorte atual (a correção ficou, as séries mudaram) não entra: a API o recusaria.
 */
export function codigosIniciaisDaCorrecao(secao: Pick<SecaoDoMaterialResponse, 'habilidades'>, suspensa: boolean, candidatas: ReadonlySet<string>): string[] {
  return secao.habilidades.filter((habilidade) => (!suspensa || habilidade.origem === 'coordenacao') && candidatas.has(habilidade.codigo)).map((habilidade) => habilidade.codigo)
}

/** Uma marca do que o capítulo mostra: a situação, a correção e as habilidades com a origem. Se ela muda enquanto o editor está aberto, o que a pessoa via já não vale. */
export function assinaturaDaSecao(secao: Pick<SecaoDoMaterialResponse, 'situacao' | 'corrigida' | 'habilidades'>): string {
  return JSON.stringify([secao.situacao, secao.corrigida, secao.habilidades.map((habilidade: HabilidadeDaSecao) => `${habilidade.codigo}:${habilidade.origem}`)])
}
