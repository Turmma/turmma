import { createContext } from 'react'

/**
 * O "Sair" da casca da escola, para quem está dentro dela precisar oferecê-lo (a linha "Sair" de Eu e, na 5.0, a tela de foco).
 * A saída é uma só: encerra a sessão na API, apaga o cookie de renovação e leva à entrada (`CascaDaEscola`, `encerrar`).
 * Quem usa não a reescreve, e por isso a linha de Eu e o botão da casca fazem exatamente a mesma coisa (D59). Fora da casca
 * não há sessão a encerrar, e sair não faz nada.
 */
export interface SaidaDaCasca {
  /** Encerra a sessão. Chamar de novo enquanto `saindo` não faz nada: dois cliques saem uma vez só. */
  readonly sair: () => void
  /** A saída está em curso: o botão diz "Saindo…". */
  readonly saindo: boolean
}

export const ContextoDaSaida = createContext<SaidaDaCasca>({ sair: () => undefined, saindo: false })
