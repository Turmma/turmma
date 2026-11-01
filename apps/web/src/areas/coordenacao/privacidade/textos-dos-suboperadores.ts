import { CATEGORIAS_DE_DADO_DO_SUBOPERADOR, type SuboperadorDaEscola } from '@educa/shared'
import { formatDayOfInstant } from '../../../format'

/**
 * Os textos da aba "Empresas que recebem dados" (F3, 8.0; `docs/interface.md` 3). Funções puras: a tela só as chama, e o
 * teste as prova sem renderizar nada.
 */

const NOMES_DE_PAIS = new Intl.DisplayNames(['pt-BR'], { type: 'region' })

/** `BR` → `Brasil`. Um código que o Intl não conhece fica como veio: a coordenação ainda lê onde é. */
export function textoDoPais(codigo: string): string {
  try {
    return NOMES_DE_PAIS.of(codigo) ?? codigo
  } catch {
    return codigo
  }
}

/** O que a empresa recebe, em linguagem comum, na ordem da lista fechada do contrato. */
export function textoDasCategorias(categorias: SuboperadorDaEscola['categorias']): string {
  return categorias.map((categoria) => CATEGORIAS_DE_DADO_DO_SUBOPERADOR[categoria]).join('; ')
}

/** A vigência para a escola: "Desde 05/10/2026" enquanto vigente, e "De 05/10/2026 até 20/10/2026" depois de encerrada. */
export function textoDaVigencia(vigencia: Pick<SuboperadorDaEscola, 'inicio' | 'fim'>): string {
  const inicio = formatDayOfInstant(vigencia.inicio)
  return vigencia.fim === null ? `Desde ${inicio}` : `De ${inicio} até ${formatDayOfInstant(vigencia.fim)}`
}

/** O contrato proíbe, ou não, que a empresa use o dado para treinar IA: um fato do contrato, dito com todas as letras. */
export function textoDoTreinamento(vedaTreinamento: boolean): string {
  return vedaTreinamento ? 'O contrato proíbe usar o dado para treinar IA' : 'O contrato não proíbe usar o dado para treinar IA'
}
