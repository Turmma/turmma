import { expect, type Locator, type Page } from '@playwright/test'
import { acionar, PRAZO_DA_TELA_MS } from './scenario.ts'

/**
 * Como os specs chegam ao destaque aberto de "Revisar a correção" (telas do professor, 14.0): o clique na linha registra a
 * abertura e abre o painel ao lado, que é um diálogo modal. Enquanto ele está aberto a página de trás é inerte, e por isso
 * quem quer seguir (o contador, o botão de aprovar) o fecha antes. Os fluxos `a3-a4-professor` e `roteiro-da-demonstracao`
 * abrem cada destaque por aqui, e não pelo botão "Abrir" que a tela tinha.
 */

/** O painel do destaque aberto: o título é "Correção de <aluno>". */
export const painelDoDestaque = (page: Page): Locator => page.getByRole('dialog', { name: /^Correção de / })

/**
 * Abre o destaque da linha (um item de `[data-destaque]`): um clique, e o painel com as respostas na tela. Devolve o painel.
 * O prazo é o da tela; quem usa uma API de verdade passa o da entrada.
 */
export async function abrirODestaque(page: Page, linha: Locator, hasTouch: boolean, prazo = PRAZO_DA_TELA_MS): Promise<Locator> {
  await acionar(linha.getByRole('button'), hasTouch)
  const painel = painelDoDestaque(page)
  await expect(painel.locator('[data-destaque-aberto]')).toBeVisible({ timeout: prazo })
  return painel
}

/** Fecha o painel pelo "Fechar" e espera a página de trás voltar a ser alcançável. */
export async function fecharOPainel(page: Page, hasTouch: boolean, prazo = PRAZO_DA_TELA_MS): Promise<void> {
  const painel = painelDoDestaque(page)
  await acionar(painel.getByRole('button', { name: 'Fechar' }), hasTouch)
  await expect(painel).toBeHidden({ timeout: prazo })
}
