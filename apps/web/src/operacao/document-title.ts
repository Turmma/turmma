import { tituloDaOperacao, useTabTitle } from '../document-title'

/**
 * O título de uma tela da operação: `<tela> · Operação Turmma`, com o sufixo para não confundir com uma aba da escola
 * aberta ao lado (`apps/web/src/document-title.ts`). Ao sair da rota, devolve o título que havia.
 */
export function useOperacaoPageTitle(tela: string): void {
  useTabTitle(tituloDaOperacao(tela))
}
