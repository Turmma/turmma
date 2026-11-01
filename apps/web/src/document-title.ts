import { useEffect } from 'react'

/**
 * O `document.title` de cada rota (regra 50, item 11; `docs/interface.md` 6): o leitor de tela anuncia a aba ao trocar
 * de rota, e quem tem várias abas abertas acha a certa pelo título. A tela vem primeiro e o sufixo diz de onde ela é:
 * `Turmas · Turmma` numa escola, `Escolas · Operação Turmma` no painel da operação, para uma aba não se confundir com a
 * outra aberta ao lado.
 *
 * Mora na raiz de `src/` porque a entrada da web e a área da operação usam os dois, e a entrada não importa nada de
 * `src/operacao/` (B2, `apps/web/chunk-names.test.ts`).
 */
export const SUFIXO_DA_ESCOLA = 'Turmma'
export const SUFIXO_DA_OPERACAO = 'Operação Turmma'

export function tituloDaEscola(tela: string): string {
  return `${tela} · ${SUFIXO_DA_ESCOLA}`
}

export function tituloDaOperacao(tela: string): string {
  return `${tela} · ${SUFIXO_DA_OPERACAO}`
}

/** Põe o título na aba enquanto a tela está montada, e ao sair devolve o que havia antes dela. */
export function useTabTitle(titulo: string): void {
  useEffect(() => {
    const anterior = document.title
    document.title = titulo
    return () => {
      document.title = anterior
    }
  }, [titulo])
}

/** O título de uma tela da escola: `<tela> · Turmma`. */
export function usePageTitle(tela: string): void {
  useTabTitle(tituloDaEscola(tela))
}
