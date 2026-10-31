import { expect, type Locator, type Page } from '@playwright/test'
import { PRAZO_DA_ENTRADA_MS } from '../casca.ts'
import { acionar, irPeloPeDoSino } from './scenario.ts'

/** O endereço da aba Hoje de uma turma: onde o "Tutor" do pé do sino chega (telas do professor, 10.0). */
export const ENDERECO_DE_HOJE = /\/professor\/turmas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\?aba=hoje$/

/**
 * Os sinais do Tutor, a atenção humana e as funções dele: a aba Hoje da turma, que o pé do sino abre. O endereço antigo
 * (`/professor/time/tutor`) leva para lá. Só termina quando a aba chegou, com a região dos sinais na tela.
 */
export async function abrirSinaisDoTutor(page: Page, hasTouch: boolean): Promise<void> {
  await irPeloPeDoSino(page, 'O que o Tutor viu', hasTouch)
  await expect(page).toHaveURL(ENDERECO_DE_HOJE, { timeout: PRAZO_DA_ENTRADA_MS })
  await expect(page.getByRole('region', { name: 'Sinais da turma' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
}

/** O painel "O que o Tutor viu": onde o nome do aluno chega, e só depois de pedido. */
export const painelDoTutor = (page: Page): Locator => page.getByRole('dialog', { name: 'O que o Tutor viu' })

/** "Ver o uso do Tutor por aluno" (ou "Ver quem", dentro do aviso): o painel abre com os nomes, e o endereço o guarda. */
export async function abrirOPainelDoTutor(page: Page, hasTouch: boolean, botao: 'uso' | 'quem' = 'uso'): Promise<void> {
  await acionar(page.getByRole('button', { name: botao === 'uso' ? 'Ver o uso do Tutor por aluno' : 'Ver quem' }), hasTouch)
  await expect(painelDoTutor(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  await expect(page).toHaveURL(/\?aba=hoje&ver=tutor$/)
}
