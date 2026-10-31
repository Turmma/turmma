import { expect, type Page } from '@playwright/test'
import { irPeloPeDoSino } from './scenario.ts'

/** As entregas do Assistente de ensino: o que ele fez e espera a professora. Pelo pé do sino (telas do professor, 2.0); só termina quando a tela chegou. */
export async function abrirEntregasDoAssistente(page: Page, hasTouch: boolean): Promise<void> {
  await irPeloPeDoSino(page, 'O que o Assistente fez', hasTouch)
  await expect(page).toHaveURL(/\/professor\/time\/assistente$/)
}
