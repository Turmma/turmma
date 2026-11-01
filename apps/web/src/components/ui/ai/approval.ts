import { formatarDiaEHora } from '../../../format'

/**
 * A situação de uma saída de IA diante da aprovação humana (regra 70, itens 3 e 6): esperando, aprovada ou rejeitada.
 * Aprovada e rejeitada **só existem com quem decidiu e quando**: o tipo não deixa a tela escrever "Aprovado" sem autor.
 */
export type Aprovacao =
  | { readonly estado: 'pendente' }
  | { readonly estado: 'aprovada'; readonly por: string; readonly quando: string }
  | { readonly estado: 'rejeitada'; readonly por: string; readonly quando: string; readonly motivo: string }

export interface TextoOptions {
  /** O verbo da aprovação, com o gênero do que foi aprovado: "Aprovada por", "Validação registrada por". */
  readonly verbo?: string
  /** O que o pendente diz. Para a professora é "Esperando você"; na Governança da coordenação, "Esperando o professor". */
  readonly espera?: string
  readonly fuso?: string
  readonly agora?: Date
}

export const VERBO_DA_APROVACAO = 'Aprovado por'
export const TEXTO_DA_ESPERA = 'Esperando você'

/**
 * A linha da aprovação: "Aprovado por Camila Souza · 19/09, 10h42" (`docs/interface.md` 11.3), "Esperando você", ou
 * "Camila Souza rejeitou · 19/09, 10h42". Data e hora no formato local (regra 50, item 12).
 *
 * A rejeição é escrita com a pessoa como sujeito, e não como "Rejeitado por": o particípio concordaria com o que foi
 * rejeitado (a versão adaptada, o lote), e a frase com o verbo vale para qualquer coisa e para qualquer pessoa. A
 * aprovação segue a 11.3, com o `verbo` de quem usa para o gênero do que foi aprovado.
 */
export function textoDaAprovacao(aprovacao: Aprovacao, { verbo = VERBO_DA_APROVACAO, espera = TEXTO_DA_ESPERA, fuso, agora }: TextoOptions = {}): string {
  if (aprovacao.estado === 'pendente') return espera
  const quando = formatarDiaEHora(aprovacao.quando, { ...(fuso === undefined ? {} : { fuso }), ...(agora === undefined ? {} : { agora }) })
  return aprovacao.estado === 'aprovada' ? `${verbo} ${aprovacao.por} · ${quando}` : `${aprovacao.por} rejeitou · ${quando}`
}

/** O motivo da rejeição, que vem junto dela: "Motivo: a questão 3 não é do capítulo." Em branco, não há linha. */
export function motivoDaRejeicao(aprovacao: Aprovacao): string | undefined {
  if (aprovacao.estado !== 'rejeitada') return undefined
  const motivo = aprovacao.motivo.trim()
  return motivo === '' ? undefined : `Motivo: ${motivo}`
}
