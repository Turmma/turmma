import type { Page, Route } from '@playwright/test'
import { codigoDoOperador, type OperadorDeTeste } from './operacao.ts'
import { expect } from './profiles.ts'

/** O Chromebook com CPU ×4 e Fast 3G carrega o chunk da operação, e o servidor ainda faz o hash da senha. */
export const SIGN_IN_TIMEOUT_MS = 20_000

/** Toque no celular, clique no Chromebook: a mesma ação pela entrada que cada aparelho tem. */
export async function activate(page: Page, nome: string | RegExp, hasTouch: boolean): Promise<void> {
  const alvo = page.getByRole('button', { name: nome })
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** A casca da operação com a sessão aberta: o nome de quem entrou na faixa, em `/operacao`. */
export async function esperarCasca(page: Page, operador: Pick<OperadorDeTeste, 'nome'>): Promise<void> {
  await expect(page.getByRole('banner')).toContainText(operador.nome, { timeout: SIGN_IN_TIMEOUT_MS })
  await expect(page).toHaveURL(/\/operacao(\?.*)?$/)
}

/** O operador entra pela tela: e-mail e senha, depois o código do aplicativo, até a casca da operação. */
export async function entrarNaOperacao(page: Page, operador: OperadorDeTeste, hasTouch: boolean): Promise<void> {
  await page.goto('/operacao/entrar')
  await expect(page.getByRole('heading', { name: 'Entrar na operação' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  await page.getByLabel('E-mail').fill(operador.email)
  await page.getByLabel('Senha').fill(operador.senha)
  await activate(page, /^Entrar$/, hasTouch)
  await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  await page.getByLabel('Código do aplicativo').fill(codigoDoOperador(operador))
  await activate(page, /^Entrar$/, hasTouch)
  await esperarCasca(page, operador)
}

/** O quanto a página inteira passa da janela, em px: zero é a página que não rola. */
export function alturaExcedente(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)
}

/**
 * RF23, no Chromebook (1366 × 768): a página não rola, e a lista, que não cabe, rola por dentro. A região recebe foco, para
 * rolar pelo teclado, e as páginas ficam presas no pé, à vista com a lista rolada até o fim.
 */
export async function conferirAListaQueRola(page: Page, regiao: string, paginas: string): Promise<void> {
  const lista = page.getByRole('region', { name: regiao })
  await expect(lista).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  expect(await alturaExcedente(page)).toBe(0)
  expect(await lista.evaluate((elemento) => elemento.scrollHeight - elemento.clientHeight)).toBeGreaterThan(0)
  await expect(lista).toHaveAttribute('tabindex', '0')
  await lista.focus()
  await page.keyboard.press('End')
  await expect.poll(() => lista.evaluate((elemento) => elemento.scrollTop)).toBeGreaterThan(0)
  await expect(page.getByRole('navigation', { name: paginas })).toBeInViewport()
  expect(await alturaExcedente(page)).toBe(0)
}

/**
 * Troca a primeira escola da resposta de uma rota da operação por outra, com números grandes, sem semear nada: a resposta
 * é a de verdade, com a primeira linha reescrita. Vale antes de a tela abrir, e a rota fica até a página fechar.
 */
export async function trocarAPrimeiraDaResposta(
  page: Page,
  rota: (url: URL) => boolean,
  trocar: (escola: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  await page.route(rota, async (pedido: Route) => {
    const resposta = await pedido.fetch()
    const corpo = (await resposta.json()) as { itens: Record<string, unknown>[] }
    const [primeira, ...resto] = corpo.itens
    await pedido.fulfill({ response: resposta, json: { ...corpo, itens: primeira === undefined ? [] : [trocar(primeira), ...resto] } })
  })
}

/**
 * 14.4: cada número dado ocupa uma linha só na tela, nunca "1.234.567" numa e "alunos" na outra. É
 * `getClientRects().length === 1`: um trecho que quebra em duas linhas devolve dois retângulos. Os trechos se acham pelo
 * texto, e não pela classe que os protege: tirada a classe, o trecho continuaria sendo conferido.
 */
export async function conferirQueCadaNumeroFicaEmUmaLinha(page: Page, textos: readonly string[]): Promise<void> {
  for (const texto of textos) {
    const trechos = page.getByRole('main').getByText(texto, { exact: true })
    await expect(trechos.first(), texto).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const retangulos = await trechos.evaluateAll((elementos) => elementos.map((elemento) => elemento.getClientRects().length))
    expect(retangulos.filter((quantos) => quantos !== 1), texto).toEqual([])
  }
}
