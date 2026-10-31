import { createContext } from 'react'

/**
 * A gaveta da casca da escola (abaixo de 768 px, e o trilho aberto por cima entre 768 e 1023 px), para quem está dentro
 * dela precisar fechá-la: a fronteira de erro que assume a tela com a gaveta aberta tira o foco de lá, e o foco não
 * sai de um `dialog` modal aberto. Fora da casca (a área da operação, a página pública) não há gaveta, e fechar não faz
 * nada.
 */
export interface Gaveta {
  /** Fecha a gaveta **agora**, e não no próximo render: quem chama move o foco logo em seguida. */
  readonly fechar: () => void
}

export const ContextoDaGaveta = createContext<Gaveta>({ fechar: () => undefined })
