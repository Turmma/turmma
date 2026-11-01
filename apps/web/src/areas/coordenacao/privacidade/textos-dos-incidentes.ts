import type { IncidenteDaEscola, RiscoDoIncidente } from '@educa/shared'
import { formatDateTime, formatNumber, formatQuantity } from '../../../format'

/**
 * Os textos do aviso de incidente e da aba Incidentes (F3, 10.0; RF9 e RF20; `docs/interface.md` 3). Funções puras: as telas só
 * as chamam, e o teste as prova sem renderizar nada. O risco e as categorias de dado são ditos por extenso: a chave crua
 * (`relevante`, `conversa_do_aluno`) nunca chega à coordenação.
 */

const RISCOS: Readonly<Record<RiscoDoIncidente, string>> = {
  baixo: 'Baixo',
  relevante: 'Relevante',
  alto: 'Alto',
}

/** O risco para os titulares, na escala do formulário da ANPD, com a primeira letra maiúscula. */
export function textoDoRisco(risco: RiscoDoIncidente): string {
  return RISCOS[risco]
}

/** Quantas pessoas se estima que foram alcançadas. É estimativa da Turmma, e o texto diz isso. */
export function textoDosTitulares(quantidade: number): string {
  return `${formatQuantity(quantidade, 'pessoa', 'pessoas')} (estimativa)`
}

/** Quando a Turmma soube do incidente: é daqui que contam as 24 horas da Turmma para a escola confirmar. */
export function textoDoConhecimento(incidente: Pick<IncidenteDaEscola, 'conhecidoEm'>): string {
  return formatDateTime(incidente.conhecidoEm)
}

/** Quando o aviso ficou visível para a escola. */
export function textoDoAviso(incidente: Pick<IncidenteDaEscola, 'avisadoEm'>): string {
  return formatDateTime(incidente.avisadoEm)
}

/** O estado do aviso: esperando a confirmação, ou confirmado em tal momento. Estado nunca é só cor: o texto o diz. */
export function textoDaConfirmacao(incidente: Pick<IncidenteDaEscola, 'confirmadoEm'>): string {
  return incidente.confirmadoEm === null ? 'Aguardando a confirmação da coordenação' : `Recebimento confirmado em ${formatDateTime(incidente.confirmadoEm)}`
}

/**
 * A faixa que fica depois de "Ver depois": quantos avisos esperam. Singular e plural concordam com a quantidade, e o texto diz
 * o que espera a coordenação.
 */
export function textoDaFaixa(pendentes: number): string {
  return pendentes === 1
    ? 'Um aviso de incidente de segurança que afetou a escola espera a confirmação da coordenação.'
    : `${formatNumber(pendentes)} avisos de incidente de segurança que afetaram a escola esperam a confirmação da coordenação.`
}

/** Em fila: com mais de um aviso, o diálogo diz quantos esperam e que este é o primeiro. Com um só, não diz nada. */
export function textoDaFila(pendentes: number): string | undefined {
  return pendentes > 1 ? `${formatNumber(pendentes)} avisos esperam a sua confirmação. Este é o primeiro.` : undefined
}

/** O que confirmar faz, e o que não faz: a comunicação à ANPD e aos titulares continua sendo da escola. */
export const TEXTO_DO_QUE_CONFIRMAR_FAZ =
  'Confirmar diz à Turmma que a coordenação recebeu este aviso. Ficam registrados quem confirmou e quando. Confirmar não comunica a ANPD nem os titulares: isso é da escola.'
