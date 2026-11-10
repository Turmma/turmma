import type { Page } from '@playwright/test'

// A captura da foto da vitrine, separada de `foto.ts` (que traz a semente do e2e) para o spec do e2e que a prova importar só ela.

/** A parte da página que sai na foto: o pedaço da página comprida (`foto.ts`, `pedacos`). */
export interface Recorte {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Grava a foto da página inteira, ou de um recorte dela, com as animações no fim: `animations: 'disabled'` é a opção do Playwright que
 * leva a animação que acaba ao último quadro e para a que repete. Sem ela, a página mais alta que a janela sai com a entrada da onça
 * (240 ms) **recomeçada**, translúcida: o `fullPage` redimensiona a página para tirar a foto, e o Chromium reinicia as animações CSS
 * nesse momento, depois de qualquer espera que se faça antes dele. Medido na sala real (`/e/<slug>/turma`, 970 px a 1366 × 768): a
 * opacidade da onça, 1 antes da foto, ficava em 0,42 e rodando depois dela.
 */
export async function tirarAFoto(page: Page, arquivo: string, recorte?: Recorte): Promise<void> {
  await page.screenshot({ path: arquivo, fullPage: true, animations: 'disabled', ...(recorte === undefined ? {} : { clip: recorte }) })
}
