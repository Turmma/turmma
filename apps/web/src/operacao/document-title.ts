import { tituloDaOperacao, useTituloDaAba } from '../document-title'

/**
 * O título de uma tela da operação: `<tela> · Operação Turmma`, com o sufixo para não confundir com uma aba da escola
 * aberta ao lado (`apps/web/src/document-title.ts`). Ao sair da rota, devolve o título que havia.
 */
export function useTituloDaPagina(tela: string): void {
  useTituloDaAba(tituloDaOperacao(tela))
}
