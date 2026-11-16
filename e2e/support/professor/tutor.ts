import { expect, type Locator, type Page } from '@playwright/test'
import { SIGN_IN_TIMEOUT_MS } from '../casca.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, larguraExcedenteDoDialogo } from '../checks.ts'
import { activate, irPeloPeDoSino, VOCABULARIO_DE_NOTA } from './scenario.ts'

/** O endereço da aba Hoje de uma turma: onde o "Tutor" do pé do sino chega (telas do professor, 10.0). */
export const ENDERECO_DE_HOJE = /\/professor\/turmas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\?aba=hoje$/

/**
 * Os sinais do Tutor, a atenção humana e as funções dele: a aba Hoje da turma, que o pé do sino abre. O endereço antigo
 * (`/professor/time/tutor`) leva para lá. Só termina quando a aba chegou, com a região dos sinais na tela.
 */
export async function abrirSinaisDoTutor(page: Page, hasTouch: boolean): Promise<void> {
  await irPeloPeDoSino(page, 'O que o Tutor viu', hasTouch)
  await expect(page).toHaveURL(ENDERECO_DE_HOJE, { timeout: SIGN_IN_TIMEOUT_MS })
  await expect(page.getByRole('region', { name: 'Sinais da turma' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
}

/** O painel "O que o Tutor viu": onde o nome do aluno chega, e só depois de pedido. */
export const painelDoTutor = (page: Page): Locator => page.getByRole('dialog', { name: 'O que o Tutor viu' })

/** "Ver o uso do Tutor por aluno" (ou "Ver quem", dentro do aviso): o painel abre com os nomes, e o endereço o guarda. */
export async function abrirOPainelDoTutor(page: Page, hasTouch: boolean, botao: 'uso' | 'quem' = 'uso'): Promise<void> {
  await activate(page.getByRole('button', { name: botao === 'uso' ? 'Ver o uso do Tutor por aluno' : 'Ver quem' }), hasTouch)
  await expect(painelDoTutor(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  await expect(page).toHaveURL(/\?aba=hoje&ver=tutor$/)
}

/**
 * A pergunta que o Tutor não respondeu hoje, no painel aberto (RF5): "1 pergunta que o Tutor não respondeu hoje", neutra, abaixo do freio ("1 de N") e à parte dele,
 * uma só na tela, sem o texto da pergunta nem vocabulário de nota; o painel cabe na largura e o botão de fechar tem 44 px (a 1366 e a 360 px, nos dois projetos).
 */
export async function conferirAPerguntaSemResposta(page: Page): Promise<void> {
  const uso = painelDoTutor(page).getByRole('region', { name: 'Uso do Tutor pela turma' })
  // O freio do aluno ("1 de N", o limite do dia da escola) é o último texto assim da lista: o primeiro é o do mês da turma ("1 de 600").
  const freio = uso.getByText(/^1 de \d+$/).last()
  const semResposta = uso.getByText('1 pergunta que o Tutor não respondeu hoje', { exact: true })
  await expect(semResposta).toBeVisible()
  await expect(uso.getByText(/não respondeu hoje/)).toHaveCount(1)
  const [caixaDoFreio, caixaDaFrase] = [await freio.boundingBox(), await semResposta.boundingBox()]
  expect(caixaDaFrase?.y ?? 0, 'a frase vem abaixo do freio').toBeGreaterThan((caixaDoFreio?.y ?? 0) + (caixaDoFreio?.height ?? 0) - 1)
  await expect(painelDoTutor(page)).not.toContainText(VOCABULARIO_DE_NOTA)
  await expect(painelDoTutor(page)).not.toContainText('Pergunta sintética sem resposta')
  expect(await larguraExcedenteDoDialogo(page)).toBe(0)
  const fechar = await painelDoTutor(page).getByRole('button', { name: 'Fechar' }).boundingBox()
  expect(fechar?.height ?? 0, 'o botão Fechar tem 44 px').toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
}
