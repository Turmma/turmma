import type { Locator, Page } from '@playwright/test'
import { entrarComoCoordenacaoNaMesmaAba, esperarPainel, SIGN_IN_TIMEOUT_MS } from './casca.ts'
import { irPelaCoordenacao } from './coordenacao.ts'
import { expect } from './profiles.ts'
import type { EquipeDeTeste } from './seed.ts'

/**
 * O que a aba "Pedidos" da Privacidade e o detalhe do pedido têm em comum nos e2e (F3, 16.0 e 17.0): o endereço, os
 * textos que a tela repete, os localizadores e os passos de entrar, buscar e registrar. Moram aqui para a 17.0 não
 * copiar da 16.0, e a 16.0 passou a importar daqui: o que muda na tela muda num lugar só.
 */

export const ENDERECO_DA_ABA = /\/coordenacao\/privacidade\/pedidos$/
export const ENDERECO_DO_DETALHE = /\/coordenacao\/privacidade\/pedidos\/[0-9a-f-]{36}$/
export const TITULO_DA_BUSCA = 'Registrar pedido de titular'
export const HOMONIMO = 'Há outro aluno com o mesmo nome completo nesta escola. O nome não será trocado nos textos livres.'
export const ELIMINADO = 'Titular eliminado'
export const INDISPONIVEL = JSON.stringify({
  erro: {
    codigo: 'INDISPONIVEL_TENTE_DE_NOVO',
    mensagem: 'texto que a tela não usa',
    requisicaoId: '0190f5a0-0000-7000-8000-000000000001',
  },
})
/** A face do perigo cheio (`--color-vermelho`, #f2545b), que é a de "Registrar a eliminação", dentro da confirmação. */
export const COR_DO_PERIGO = 'rgb(242, 84, 91)'
/** A face da decisão oficial (`--color-grafite`, #333333). */
export const COR_DO_OFICIAL = 'rgb(51, 51, 51)'

export const principal = (page: Page) => page.getByRole('main')
export const busca = (page: Page) => page.getByRole('dialog', { name: TITULO_DA_BUSCA })
export const confirmacao = (page: Page, titulo: string) => page.getByRole('alertdialog', { name: titulo, exact: true })
export const campoDoTermo = (page: Page) => busca(page).getByLabel('Nome do aluno ou do professor')
export const marca = () => Math.random().toString(36).slice(2, 10)
/** As linhas da lista de pedidos: `tr` do corpo no chromebook, `li` da lista no celular. */
export const linhas = (page: Page) => principal(page).locator('tbody tr, ul[data-tabela="lista"] > li')
export const linhaDa = (page: Page, texto: string | RegExp) => linhas(page).filter({ hasText: texto })
/**
 * O link do pedido de uma pessoa dentro da linha dela. O nome acessível é "<nome>, <tipo do pedido>" (12.0): a busca ancora no
 * nome inteiro e na vírgula, para "Ana" não achar "Ana Souza" e o nome de outra pessoa não casar por pedaço.
 */
export const linkDoPedido = (linha: Locator, nome: string) => linha.getByRole('link', { name: new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) })
export const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
/** O dia como a tela o escreve por extenso: "9 de outubro de 2026". */
export const comoNaTela = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
/** O dia como o detalhe escreve o prazo: "16/10/2026". */
export const diaCurto = (dia: string) => dia.split('-').reverse().join('/')

/** `AAAA-MM-DD` de hoje (São Paulo) mais `dias`, em dia de calendário. */
export function somarDiasAHoje(dias: number): string {
  return new Date(Date.parse(`${hoje()}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10)
}

export async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/**
 * Clica (ou toca) no meio de um pedaço da linha que **não é o link**, onde só o link esticado pela linha (12.0) recebe o
 * clique. `force` pula a espera de o próprio pedaço receber o toque: o ponto é justamente o que o link cobre por cima.
 */
export async function acionarNoPontoDaLinha(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap({ force: true })
  else await alvo.click({ force: true })
}

export function gate(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

/** Os dois cliques de um clique duplo no mesmo instante, antes de a tela desligar o botão. */
export async function doisCliquesNoMesmoInstante(botao: Locator): Promise<void> {
  await botao.evaluate((elemento: HTMLButtonElement) => {
    elemento.click()
    elemento.click()
  })
}

/** A coordenadora entra e abre a Privacidade pela navegação: a aba que abre é a dos pedidos. */
export async function entrarNosPedidos(page: Page, hasTouch: boolean, pessoa: EquipeDeTeste): Promise<void> {
  await page.goto('/entrar')
  await entrarComoCoordenacaoNaMesmaAba(page, pessoa, hasTouch)
  await esperarPainel(page)
  await irPelaCoordenacao(page, 'Pedidos', hasTouch)
  await expect(page).toHaveURL(ENDERECO_DA_ABA, {
    timeout: SIGN_IN_TIMEOUT_MS,
  })
  await expect(
    principal(page).getByRole('button', {
      name: 'Registrar pedido',
      exact: true,
    }),
  ).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
}

export async function abrirABusca(page: Page, hasTouch: boolean): Promise<void> {
  await activate(
    principal(page).getByRole('button', {
      name: 'Registrar pedido',
      exact: true,
    }),
    hasTouch,
  )
  await expect(busca(page)).toBeVisible()
}

/** Digita o termo e busca pelo Enter, que é como a coordenação busca no teclado. */
export async function buscarPor(page: Page, termo: string): Promise<void> {
  await campoDoTermo(page).fill(termo)
  await campoDoTermo(page).press('Enter')
}

/** Escolhe a pessoa (radio) e preenche o pedido, e segue para a confirmação. */
export async function escolherEPedir(page: Page, hasTouch: boolean, pessoa: RegExp, tipo: string, quemPediu = 'A própria pessoa'): Promise<void> {
  await busca(page).getByRole('radio', { name: pessoa }).check()
  await busca(page).getByLabel('Tipo do pedido').selectOption({ label: tipo })
  await busca(page).getByLabel('Quem pediu').selectOption({ label: quemPediu })
  await activate(busca(page).getByRole('button', { name: 'Continuar', exact: true }), hasTouch)
}

/**
 * Registra o pedido pelo caminho de verdade, da busca à confirmação: o que a 16.0 prova em detalhe e a 17.0 usa para ter um
 * pedido real (com o worker montando o arquivo, ou a eliminação agendada) para conduzir. Termina com o diálogo fechado e o
 * pedido na lista.
 */
export async function registrarPeloFluxo(
  page: Page,
  hasTouch: boolean,
  opcoes: {
    readonly nome: string
    readonly pessoa: RegExp
    readonly tipo: string
    readonly quemPediu?: string
    readonly confirmar: string
  },
): Promise<void> {
  await abrirABusca(page, hasTouch)
  await buscarPor(page, opcoes.nome)
  await expect(busca(page).getByRole('radio', { name: opcoes.pessoa })).toHaveCount(1, { timeout: SIGN_IN_TIMEOUT_MS })
  await escolherEPedir(page, hasTouch, opcoes.pessoa, opcoes.tipo, opcoes.quemPediu)
  const dialogo = page.getByRole('alertdialog')
  await expect(dialogo.getByRole('button', { name: opcoes.confirmar, exact: true })).toBeEnabled({ timeout: SIGN_IN_TIMEOUT_MS })
  await activate(dialogo.getByRole('button', { name: opcoes.confirmar, exact: true }), hasTouch)
  await expect(dialogo).toHaveCount(0, { timeout: SIGN_IN_TIMEOUT_MS })
}
