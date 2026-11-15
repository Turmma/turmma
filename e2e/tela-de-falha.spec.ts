import type { Locator, Page } from '@playwright/test'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { expect, test } from './support/profiles.ts'

/**
 * A tela que quebra fora de uma área mostra a falha com o caminho de volta, e não a página branca (reengenharia-continuacao,
 * 13.0; RF12; `docs/interface.md` seção 6). É a web de verdade, com a falha vinda do navegador e da rede, sem gancho no build de
 * produção:
 *
 * - **o estado do sistema** (`/sistema`, uma rota sem área): a API responde o que o esquema aceita, e o `Intl.DateTimeFormat`
 *   daquela página lança ao formatar a hora da verificação. Nenhuma resposta válida faz o componente lançar sozinha, e por
 *   isso a falha vem do navegador, só em `/sistema`;
 * - **a operação**: o chunk dela chega, mas o módulo é um componente que lança (`page.route`).
 */

const PRAZO_MS = 20_000
const CHUNK_DA_OPERACAO = /\/assets\/operacao-[^/]+\.js$/

/** O estado do sistema com a API respondendo, e a formatação da hora quebrada só nessa página. */
async function quebrarOEstadoDoSistema(page: Page): Promise<void> {
  await page.route((url) => url.pathname.startsWith('/v1/sistema/') && url.pathname.endsWith('/estado'), (rota) =>
    rota.fulfill({ json: { versao: 'teste', ambiente: 'local', componentes: [{ nome: 'api', situacao: 'disponivel', verificadoEm: '2026-11-15T12:00:00.000Z' }] } }),
  )
  await page.route('**/v1/sistema/avisos', (rota) => rota.fulfill({ json: { itens: [] } }))
  await page.addInitScript(() => {
    if (window.location.pathname !== '/sistema') return
    Object.defineProperty(Intl.DateTimeFormat.prototype, 'format', {
      configurable: true,
      get: () => () => {
        throw new Error('a hora não formata')
      },
    })
  })
}

async function abrirAFalhaDoSistema(page: Page): Promise<void> {
  await quebrarOEstadoDoSistema(page)
  await page.goto('/sistema')
  await expect(page.getByRole('heading', { level: 1, name: 'Esta tela não abriu' })).toBeVisible({ timeout: PRAZO_MS })
}

async function ativar(alvo: Locator, hasTouch: boolean): Promise<void> {
  await (hasTouch ? alvo.tap() : alvo.click())
}

async function caixaDe(alvo: Locator, nome: string) {
  const caixa = await alvo.boundingBox()
  expect(caixa, `${nome} sem caixa`).not.toBeNull()
  if (caixa === null) throw new Error(`${nome} sem caixa`)
  return caixa
}

test.describe('a tela que quebra fora de uma área', () => {
  test('foco: a Falha assume a página com o foco no título, e a aba diz o que houve', async ({ page }) => {
    await abrirAFalhaDoSistema(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Esta tela não abriu' })).toBeFocused()
    await expect(page).toHaveTitle('Esta tela não abriu · Turmma')
    await expect(page.getByRole('alert')).toHaveText('Algo saiu do esperado ao mostrar esta tela. Tente de novo ou volte ao início.')
  })

  test('a medida: 1366 × 768 sem rolar e com os dois botões à vista; 360 px com os botões em linha quebrada, sem corte e com 44 px', async ({ page }) => {
    await abrirAFalhaDoSistema(page)
    const tentar = page.getByRole('button', { name: 'Tentar de novo' })
    const voltar = page.getByRole('link', { name: 'Voltar ao início' })
    const largura = page.viewportSize()?.width ?? 0
    if (largura >= 768) {
      // O computador (1366 × 768): a página não rola, e os dois botões estão à vista.
      await paginaNaoRola(page)
      await expect(tentar).toBeInViewport()
      await expect(voltar).toBeInViewport()
    } else {
      // O celular (360 px): os dois quebram em linha, sem cortar o texto nem passar da janela, com alvo de 44 px.
      for (const [alvo, nome] of [[tentar, 'Tentar de novo'], [voltar, 'Voltar ao início']] as const) {
        const caixa = await caixaDe(alvo, nome)
        expect(caixa.height, `${nome}: altura`).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
        // A altura medida não basta: o link sem a classe herda a do irmão (o `stretch` do flex). O que garante os 44 px é o `min-height`.
        expect(await alvo.evaluate((elemento) => getComputedStyle(elemento).minHeight), `${nome}: altura mínima`).toBe(`${String(ALVO_DE_TOQUE_PRINCIPAL_PX)}px`)
        expect(caixa.width, `${nome}: largura`).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
        expect(caixa.x + caixa.width, `${nome}: passa da janela`).toBeLessThanOrEqual(largura)
        // O texto cabe na própria caixa: o rótulo não é cortado nem escorre para fora.
        expect(await alvo.evaluate((elemento) => elemento.scrollWidth <= elemento.clientWidth), `${nome}: texto cortado`).toBe(true)
      }
      expect(await horizontalOverflow(page)).toBe(0)
    }
    expect(await seriousViolations(page)).toEqual([])
    if (largura < 768) {
      // O celular dobrável fechado (280 px): a posição do segundo botão se lê aqui, e é aqui que o `flex-wrap` se prova.
      await page.setViewportSize({ width: 280, height: 640 })
      const primeiro = await caixaDe(tentar, 'Tentar de novo')
      const segundo = await caixaDe(voltar, 'Voltar ao início')
      expect(segundo.y, 'a 280 px o segundo botão desce para a linha de baixo').toBeGreaterThanOrEqual(primeiro.y + primeiro.height)
      expect(segundo.x + segundo.width, 'a 280 px o segundo botão passa da janela').toBeLessThanOrEqual(280)
      expect(await horizontalOverflow(page), 'a 280 px a página rola na horizontal').toBe(0)
    }
  })

  test('volta: o "Voltar ao início" leva a / e a tela sai da Falha', async ({ page, hasTouch }) => {
    await abrirAFalhaDoSistema(page)
    await ativar(page.getByRole('link', { name: 'Voltar ao início' }), hasTouch)
    // Sem sessão, a raiz leva à entrada: a página nova limpou a fronteira, e a falha ficou para trás.
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible({ timeout: PRAZO_MS })
    await expect(page.getByRole('heading', { name: 'Esta tela não abriu' })).toHaveCount(0)
  })

  test('operação: o "Voltar ao início" leva ao início da operação', async ({ page, hasTouch }) => {
    const quebrada = (rota: Parameters<Parameters<Page['route']>[1]>[0]) =>
      rota.fulfill({ contentType: 'text/javascript', body: 'export default function Quebrada() { throw new Error("a operação quebrou") }' })
    await page.route(CHUNK_DA_OPERACAO, quebrada)
    await page.goto('/operacao/entrar')
    await expect(page.getByRole('heading', { level: 1, name: 'Operação Turmma' })).toBeVisible({ timeout: PRAZO_MS })
    await expect(page.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/operacao')

    await page.unroute(CHUNK_DA_OPERACAO, quebrada)
    await ativar(page.getByRole('link', { name: 'Voltar ao início' }), hasTouch)
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar na operação' })).toBeVisible({ timeout: PRAZO_MS })
    // A página nova limpou a fronteira: a falha ficou para trás (só vale depois de a entrada aparecer).
    await expect(page.getByRole('heading', { name: 'Operação Turmma' })).toHaveCount(0)
  })
})
