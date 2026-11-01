import { useCallback, useSyncExternalStore } from 'react'

/**
 * O ponteiro principal é o dedo: celular e Chromebook em modo de prancheta. Ali não existe Shift+Enter, e a caixa de
 * pedido troca o que o Enter faz (`ai/prompt-input.ts`). O Chromebook de teclado com tela de toque continua "fino": o
 * ponteiro principal dele é o do teclado.
 */
export const COARSE_POINTER = '(pointer: coarse)'

/** A largura em que a casca deixa de ser a do celular (`docs/interface.md` 11.1): a tabela é tabela daqui para cima. */
export const MEDIA_MD = '(min-width: 768px)'

/** A largura em que a tela do aluno põe o resultado em duas colunas (a janela do Chromebook e acima). */
export const MEDIA_LG = '(min-width: 1024px)'

/**
 * Se a consulta de mídia vale agora, acompanhando a mudança (girar o aparelho, encolher a janela). Para o que o CSS não
 * resolve sozinho: trocar o comportamento de uma tecla, ou desenhar uma estrutura no lugar de outra sem pôr as duas no
 * documento.
 */
export function useMediaQuery(consulta: string): boolean {
  const assinar = useCallback(
    (avisar: () => void) => {
      const midia = window.matchMedia(consulta)
      midia.addEventListener('change', avisar)
      return () => midia.removeEventListener('change', avisar)
    },
    [consulta],
  )
  return useSyncExternalStore(assinar, () => window.matchMedia(consulta).matches)
}
