import type { Locator, Page } from '@playwright/test'
import { entrarComoCoordenacaoNaMesmaAba, entrarPorEmail, esperarPainel, esperarNovaConversa, SIGN_IN_TIMEOUT_MS } from './casca.ts'
import { irPelaCoordenacao, linhasDaTabela } from './coordenacao.ts'
import { CAMINHO_DO_PDF_DE_DEMONSTRACAO } from './material.ts'
import { expect } from './profiles.ts'
import { confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarCoordenadoraNaEscola, criarEquipeComSenha, type EquipeDeTeste } from './seed.ts'

/**
 * O começo de todo fluxo de verdade do professor (A2, A3 e A4), contra a API real e o adaptador falso: a escola com a
 * turma de Química confirmada, o material que a coordenação sobe pela tela, e a professora na tela em que ela abre.
 */

/** A leitura do PDF e cada geração passam pela fila curta da API e pela consulta da execução, com a CPU ×4 do perfil. */
export const AI_TIMEOUT_MS = 45_000
export const TITULO_DO_MATERIAL = 'Química 2, capítulo 7: Estequiometria'
export const DISCIPLINA = 'Química'

export interface Escola {
  readonly professora: EquipeDeTeste
  readonly turmaId: string
  readonly turmaNome: string
}

export async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  await (hasTouch ? alvo.tap() : alvo.click())
}

export const principal = (page: Page) => page.getByRole('main')
export const caixa = (page: Page) => page.getByRole('textbox', { name: 'Pedido ao Assistente de ensino' })
export const conversa = (page: Page) => page.getByRole('log', { name: 'Conversa com o Assistente de ensino' })

/**
 * A escola como a demonstração a encontra: a professora com a turma de Química confirmada (A1), e o material que a
 * **coordenação sobe pela tela**, com titularidade e licença declaradas (D75). Depois a coordenação sai, e a professora
 * entra na mesma aba, em "Nova conversa".
 */
export async function montarEscolaEEntrar(page: Page, hasTouch: boolean): Promise<Escola> {
  const professora = await criarEquipeComSenha()
  const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, [DISCIPLINA])
  await confirmarVinculosNoBanco(professora.escolaId, alocacao.vinculoIds)
  const coordenadora = await criarCoordenadoraNaEscola(professora)

  await page.goto('/entrar')
  await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
  await esperarPainel(page)
  await irPelaCoordenacao(page, 'Material', hasTouch)
  await expect(page).toHaveURL(/\/coordenacao\/material$/)
  // O formulário está no diálogo "Enviar material": o botão da tela o abre (o do vazio, nesta escola sem material).
  await activate(principal(page).getByRole('button', { name: 'Enviar material' }), hasTouch)
  const envio = page.getByRole('dialog', { name: 'Enviar material' })
  await expect(envio).toBeVisible()
  await page.getByTestId('arquivo-do-material').setInputFiles(CAMINHO_DO_PDF_DE_DEMONSTRACAO)
  await envio.getByLabel('Título').fill(TITULO_DO_MATERIAL)
  await envio.getByLabel('Disciplina').selectOption({ label: DISCIPLINA })
  await envio.getByLabel('De quem é o material').selectOption({ label: 'Material próprio da escola' })
  await envio.getByLabel('Licença de uso (obrigatória)').selectOption({ label: 'Autoria da escola ou de professor dela' })
  await envio.getByLabel(/^Declaro que a escola pode usar este material/).check()
  await activate(envio.getByRole('button', { name: 'Enviar material' }), hasTouch)
  const material = linhasDaTabela(principal(page).getByRole('region', { name: 'Materiais da escola' })).filter({ hasText: TITULO_DO_MATERIAL })
  await expect(material.getByText('Pronto · 6 páginas')).toBeVisible({ timeout: AI_TIMEOUT_MS })

  // A coordenação sai, e a professora entra no mesmo computador.
  await activate(page.getByRole('button', { name: 'Sair' }).first(), hasTouch)
  await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
  await entrarPorEmail(page, professora, hasTouch)
  await esperarNovaConversa(page, professora.nome)
  return { professora, turmaId: alocacao.turmaId, turmaNome: alocacao.turmaNome }
}

/**
 * Gera a atividade pelo formulário da ferramenta, com a turma já escolhida, e espera o resultado. O tema é o de
 * estequiometria, ou outro capítulo do mesmo material (o roteiro da demonstração gera uma segunda atividade).
 */
export async function gerarAtividade(cartao: Locator, hasTouch: boolean, questoes: string, tema = 'Estequiometria'): Promise<void> {
  await cartao.getByLabel('Tema').fill(tema)
  await cartao.getByLabel('Questões').fill(questoes)
  await activate(cartao.getByRole('button', { name: 'Gerar atividade' }), hasTouch)
  await expect(cartao.locator('[data-motor="pronto"]').getByText(`Atividade — ${tema}`)).toBeVisible({ timeout: AI_TIMEOUT_MS })
}

