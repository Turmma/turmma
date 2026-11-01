import { createContext, useContext } from 'react'

/**
 * A âncora do sino (Tech Spec das telas da coordenação, seção 5, "O sino"): um elemento vazio que a casca desenha, na barra
 * de topo abaixo de 768 px e no canto de cima do conteúdo acima, e que a área da coordenação preenche por `createPortal`.
 * A casca é da entrada e **não importa nada da área** nem o `Sino`: ela só guarda o elemento e o expõe por aqui.
 *
 * `null` é a casca ainda sem o elemento (o primeiro quadro) e quem não está dentro dela (a operação, a página pública): o
 * sino não desenha nada.
 */
export interface SinoAnchorContextValue {
  readonly elemento: HTMLElement | null
}

export const SinoAnchorContext = createContext<SinoAnchorContextValue>({ elemento: null })

/** O elemento onde o sino se desenha, ou `null` enquanto não existe. */
export function useSinoAnchor(): HTMLElement | null {
  return useContext(SinoAnchorContext).elemento
}
