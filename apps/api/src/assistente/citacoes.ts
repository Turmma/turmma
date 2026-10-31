import { LLMError } from '@educa/core'
import type { Citacao } from '@educa/shared'

/** O que identifica um trecho entregue a uma tarefa: o material e a página. */
export interface PaginaEntregue {
  readonly materialId: string
  readonly pagina: number
}

/**
 * Toda citação aponta para um trecho que **foi entregue à tarefa** (regra 30, item 12)? A camada de IA já confere isso
 * na saída do modelo; aqui é a conferência de quem grava, que não depende de adaptador nem de a tarefa lembrar: página
 * que não veio da busca não vira citação guardada. Fora disso, `IA_SAIDA_INVALIDA`, e nada é gravado.
 */
export function exigirCitacoesEntregues(citacoes: readonly Pick<Citacao, 'materialId' | 'pagina'>[], entregues: readonly PaginaEntregue[]): void {
  const paginas = new Set(entregues.map((trecho) => `${trecho.materialId}:${String(trecho.pagina)}`))
  if (citacoes.some((citacao) => !paginas.has(`${citacao.materialId}:${String(citacao.pagina)}`))) throw new LLMError('IA_SAIDA_INVALIDA')
}
