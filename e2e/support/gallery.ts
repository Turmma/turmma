import type { Locator, Page } from '@playwright/test'
import { loadUnthrottled, expect } from './profiles.ts'
import { horizontalOverflow } from './checks.ts'

/**
 * O que os `e2e/pecas-*.spec.ts` dividem: abrir a galeria (`/galeria`), achar um bloco dela, medir uma peça. O que cada
 * grupo afirma de cor mora no arquivo do grupo, para a tarefa da peça não editar o arquivo de outra (tarefa 2.0 da X1).
 */

/** O quanto `openGallery` espera o título: a galeria baixa com a rede livre (`loadUnthrottled`), mas lê o JS com a CPU ×4 do perfil. */
export const GALLERY_TIMEOUT_MS = 20_000

/** O bloco da galeria pelo nome que a `Secao` dá (`data-galeria`). */
export const gallerySection = (page: Page, nome: string) => page.locator(`[data-galeria="${nome}"]`)

/**
 * Abre `/galeria` e espera o título. A galeria não chama a API e não tem sessão, e tudo o que ela baixa chega antes de o
 * título aparecer: a abertura roda sem a rede do perfil (`loadUnthrottled`), que custava mais de seis segundos de
 * latência em cascata aos trinta de cada caso. A rede do perfil está de volta quando a função devolve.
 */
export async function openGallery(page: Page): Promise<void> {
  await loadUnthrottled(page, async () => {
    await page.goto('/galeria')
    await expect(page.getByRole('heading', { level: 1, name: 'Galeria de peças' })).toBeVisible({ timeout: GALLERY_TIMEOUT_MS })
  })
}

/** Clica ou toca, conforme o projeto: no celular não existe clique de mouse. */
export async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  await (hasTouch ? alvo.tap() : alvo.click())
}

/** O desenho de uma peça: o que o navegador calcula da face, do texto, da borda, do canto e do respiro dela. */
export interface Desenho {
  fundo: string
  texto: string
  borda: string
  peso: string
  fonte: string
  canto: string
  enchimento: string
}

export function desenho(alvo: Locator): Promise<Desenho> {
  return alvo.evaluate((elemento) => {
    const estilo = getComputedStyle(elemento)
    return {
      fundo: estilo.backgroundColor,
      texto: estilo.color,
      borda: `${estilo.borderTopWidth} ${estilo.borderTopStyle} ${estilo.borderTopColor}`,
      peso: estilo.fontWeight,
      fonte: estilo.fontSize,
      canto: estilo.borderTopLeftRadius,
      enchimento: estilo.padding,
    }
  })
}

/**
 * O `desenho` de cada peça de `alvos`, na ordem, **numa ida só ao navegador**: percorrer dezenas de peças com um `desenho`
 * cada passava dos 30 s do caso no runner da esteira (CPU ×4). Não espera a peça aparecer: o chamador já esperou.
 * O corpo repete o de `desenho` porque o que vai ao navegador não enxerga o que o módulo declara.
 */
export function desenhos(alvos: Locator): Promise<Desenho[]> {
  return alvos.evaluateAll((elementos) =>
    elementos.map((elemento) => {
      const estilo = getComputedStyle(elemento)
      return {
        fundo: estilo.backgroundColor,
        texto: estilo.color,
        borda: `${estilo.borderTopWidth} ${estilo.borderTopStyle} ${estilo.borderTopColor}`,
        peso: estilo.fontWeight,
        fonte: estilo.fontSize,
        canto: estilo.borderTopLeftRadius,
        enchimento: estilo.padding,
      }
    }),
  )
}

export interface MedidaDosBlocos {
  total: number
  passamDaJanela: string[]
  comRolagemPropria: string[]
}

/**
 * Cada `[data-galeria]` cabe na janela e não rola por dentro, numa ida só: uma peça que estourasse dentro de um contêiner
 * com rolagem passaria na conta do documento (`horizontalOverflow`). Percorrer os blocos com três idas cada, somado às duas
 * auditorias do axe, passava dos 30 s do caso no runner da esteira (CPU ×4).
 */
export function measureGalleryBlocks(page: Page): Promise<MedidaDosBlocos> {
  const janela = page.viewportSize()?.width ?? 0
  return page.locator('[data-galeria]').evaluateAll((blocos, largura) => {
    const medidas = blocos.map((bloco) => {
      const caixaDoBloco = bloco.getBoundingClientRect()
      return { nome: bloco.getAttribute('data-galeria') ?? '', direita: caixaDoBloco.x + caixaDoBloco.width, sobra: bloco.scrollWidth - bloco.clientWidth }
    })
    return {
      total: medidas.length,
      passamDaJanela: medidas.filter((medida) => medida.direita > largura).map((medida) => medida.nome),
      comRolagemPropria: medidas.filter((medida) => medida.sobra !== 0).map((medida) => medida.nome),
    }
  }, janela)
}

export async function caixa(alvo: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const medida = await alvo.boundingBox()
  if (medida === null) throw new Error('a peça não está na tela')
  return medida
}

/** O que flutua aberto fica inteiro dentro da janela, e a página não ganha rolagem horizontal por causa dele. */
export async function conferirQueCabeNaJanela(page: Page, flutuante: Locator): Promise<void> {
  const medida = await caixa(flutuante)
  const largura = page.viewportSize()?.width ?? 0
  expect(medida.x).toBeGreaterThanOrEqual(0)
  expect(medida.x + medida.width).toBeLessThanOrEqual(largura)
  expect(await horizontalOverflow(page)).toBe(0)
}

/** O foco está em algum controle ou texto da página, e não perdido no `body` (regra 50, item 11). */
export async function conferirQueOFocoNaoCaiu(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.activeElement === null || document.activeElement === document.body)).toBe(false)
}
