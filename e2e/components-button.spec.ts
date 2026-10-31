import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support/profiles.ts'
import { abrirGaleria, caixa, desenho, secao } from './support/gallery.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX } from './support/checks.ts'

/**
 * As peças do MVP de apresentação (`docs/mvp-rapido.md` 9.3; `docs/interface.md` 11.1 e 11.3), na galeria (`/galeria`),
 * nos projetos `chromebook` e `celular`: o que a regra de cada peça promete, visto no navegador. A galeria não chama a
 * API e não tem sessão; o dado é inventado, escrito nela.
 *
 * Este arquivo é o grupo `botoes` do antigo `pecas.spec.ts` (tarefa 2.0 da X1). O primeiro caso veio inteiro, com a
 * regra de antes e a cor nova (3.0 da X1: o oficial é `grafite`, o perigo é `vermelho`, o canto é de 12 px, o desligado é
 * `borda` com `apoio`); os outros são da 3.0: o degrau, o alvo de toque de cada desenho e tamanho, o apertado no toque, o
 * movimento reduzido e o anel de foco nos dois temas. Os auxiliares comuns estão em `support/gallery.ts`.
 */

/** Os hex da 9.10 do `docs/interface.md`, como o navegador os devolve no estilo calculado: só os que este arquivo afirma. */
const RGB = {
  laranja: 'rgb(232, 115, 46)',
  grafite: 'rgb(51, 51, 51)',
  vermelho: 'rgb(242, 84, 91)',
  vermelhoTexto: 'rgb(184, 64, 69)',
  superficie: 'rgb(255, 255, 255)',
  borda: 'rgb(229, 229, 229)',
  apoio: 'rgb(66, 66, 66)',
} as const

/** O `foco` de cada tema, como o navegador devolve. */
const FOCO = { claro: 'rgb(20, 110, 170)', escuro: 'rgb(96, 185, 244)' } as const

const VARIANTES = ['discreto', 'oficial', 'perigo', 'primario', 'secundario']

/** As peças ligadas da galeria na ordem do DOM, que é a do Tab: `<fileira>:<variante>`. */
const PECAS_NA_ORDEM_DO_TAB = [
  ...['principal', 'compacto', 'com-glifo', 'icone'].flatMap((fileira) => ['primario', 'oficial', 'secundario', 'discreto', 'perigo'].map((variante) => `${fileira}:${variante}`)),
  'perigo-cheio:perigo-cheio',
]

test.describe('peças do MVP de apresentação, na galeria', () => {
  test('botões: cinco variantes, só a oficial em grafite e só a primária em laranja, e o desligado nunca é igual ao ligado', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const botoes = secao(page, 'botoes')
    const principais = botoes.locator('[data-tamanho="principal"] [data-variante]')
    await expect(principais).toHaveCount(5)
    const fundos: Record<string, string> = {}
    for (const botao of await principais.all()) {
      const variante = (await botao.getAttribute('data-variante')) ?? ''
      fundos[variante] = (await desenho(botao)).fundo
      const medida = await caixa(botao)
      expect(medida.height, variante).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      // O canto é de 12 px em todos (9.3); a pílula de antes saiu com a D80.
      expect((await desenho(botao)).canto, variante).toBe('12px')

      // A mesma variante, desligada, na fileira de baixo: outro fundo ou outro texto. O botão que não faz nada não se
      // parece com o que faz.
      const desligado = botoes.locator(`[data-tamanho="desligado"] [data-variante="${variante}"]`)
      await expect(desligado, variante).toBeDisabled()
      const [ligadoDesenho, desligadoDesenho] = [await desenho(botao), await desenho(desligado)]
      expect(ligadoDesenho.fundo !== desligadoDesenho.fundo || ligadoDesenho.texto !== desligadoDesenho.texto, variante).toBe(true)
      // E o desligado nunca fica com a cor da ação: nem laranja, nem grafite, nem o vermelho do perigo. É a face `borda`
      // com o texto `apoio`, em todos (`sutil` não chega a 4,5:1 no escuro).
      expect([RGB.laranja, RGB.grafite, RGB.vermelho], variante).not.toContain(desligadoDesenho.fundo)
      expect(desligadoDesenho.texto, variante).not.toBe(RGB.vermelhoTexto)
      expect(desligadoDesenho.fundo, variante).toBe(RGB.borda)
      expect(desligadoDesenho.texto, variante).toBe(RGB.apoio)
    }
    expect(Object.keys(fundos).sort()).toEqual(VARIANTES)
    expect(Object.entries(fundos).filter(([, fundo]) => fundo === RGB.grafite).map(([variante]) => variante)).toEqual(['oficial'])
    expect(Object.entries(fundos).filter(([, fundo]) => fundo === RGB.laranja).map(([variante]) => variante)).toEqual(['primario'])
    // O perigo fora do diálogo é texto vermelho sobre a face clara, sem a face vermelha.
    expect(fundos['perigo']).toBe(RGB.superficie)
    expect((await desenho(principais.filter({ hasText: 'perigo' }))).texto).toBe(RGB.vermelhoTexto)
    expect(Object.values(fundos)).not.toContain(RGB.vermelho)

    // O botão que abre o menu, desligado, também muda de desenho: é o secundário desligado, com o texto `apoio`.
    const menuDesligado = botoes.getByRole('button', { name: 'Menu desligado' })
    await expect(menuDesligado).toBeDisabled()
    expect((await desenho(menuDesligado)).texto).toBe(RGB.apoio)

    // O compacto tem 36 px no computador e 44 px onde se toca com o dedo.
    const compactos = botoes.locator('[data-tamanho="compacto"] [data-variante]')
    await expect(compactos).toHaveCount(5)
    for (const botao of await compactos.all()) expect((await caixa(botao)).height).toBeGreaterThanOrEqual(hasTouch ? ALVO_DE_TOQUE_PRINCIPAL_PX : 36)
  })

  test('o perigo cheio é a face vermelha com o texto sobre-cor, e o desligado dele perde o vermelho', async ({ page }) => {
    await abrirGaleria(page)
    const cheio = secao(page, 'botoes').locator('[data-tamanho="perigo-cheio"]').getByRole('button', { name: 'Perigo cheio', exact: true })
    expect(await desenho(cheio)).toMatchObject({ fundo: RGB.vermelho, texto: 'rgb(13, 13, 13)', canto: '12px' })
    const desligado = secao(page, 'botoes').locator('[data-tamanho="perigo-cheio"]').getByRole('button', { name: 'Perigo cheio desligado' })
    await expect(desligado).toBeDisabled()
    expect(await desenho(desligado)).toMatchObject({ fundo: RGB.borda, texto: RGB.apoio })
  })

  test('alvo de 44 px: toda variante e todo tamanho, ligado e desligado, com glifo e sem; o compacto tem 36 só a partir de 768', async ({ page }) => {
    await abrirGaleria(page)
    const botoes = secao(page, 'botoes')
    const estreito = (page.viewportSize()?.width ?? 0) < 768
    const todos = botoes.locator('[data-variante]')
    // 5 principais, 5 desligados, 5 compactos, 5 compactos desligados, 5 com glifo, 5 só de ícone, 5 de ícone desligados,
    // e o perigo cheio, ligado e desligado: o sexto desenho tem a mesma medida dos outros.
    await expect(todos).toHaveCount(37)
    // Uma ida só ao navegador para os 37 botões: com a CPU ×4 eram cinco idas por botão (a fileira, a variante, a caixa, o desenho), e o caso
    // passava de 22 s dos 30 no runner da esteira (40880199949). O que se afirma de cada botão é o mesmo.
    const medidas = await todos.evaluateAll((elementos) =>
      elementos.map((elemento) => {
        const caixaDoBotao = elemento.getBoundingClientRect()
        return {
          fileira: elemento.parentElement?.getAttribute('data-tamanho') ?? '',
          variante: elemento.getAttribute('data-variante') ?? '',
          width: caixaDoBotao.width,
          height: caixaDoBotao.height,
          canto: getComputedStyle(elemento).borderTopLeftRadius,
        }
      }),
    )
    expect(medidas).toHaveLength(37)
    for (const { fileira, variante, width, height, canto } of medidas) {
      const piso = fileira.startsWith('compacto') && !estreito ? 36 : ALVO_DE_TOQUE_PRINCIPAL_PX
      expect(height, `${fileira} · ${variante}`).toBeGreaterThanOrEqual(piso)
      expect(width, `${fileira} · ${variante}`).toBeGreaterThanOrEqual(piso)
      // Em toda peça com texto o canto é de 12 px, e o botão só de ícone é o círculo de 44 px.
      if (fileira.startsWith('icone')) {
        expect(width, `${fileira} · ${variante}`).toBe(44)
        expect(height, `${fileira} · ${variante}`).toBe(44)
        expect(Number.parseFloat(canto), `${fileira} · ${variante}`).toBeGreaterThanOrEqual(22)
      } else {
        expect(canto, `${fileira} · ${variante}`).toBe('12px')
      }
    }
  })

  test('o degrau é sombra sólida e margem do mesmo tamanho fora da face, e o desligado perde a sombra e guarda a margem', async ({ page }) => {
    await abrirGaleria(page)
    const botoes = secao(page, 'botoes')
    const sombraEMargem = (alvo: Locator) => alvo.evaluate((elemento) => [getComputedStyle(elemento).boxShadow, getComputedStyle(elemento).marginBottom])
    const degraus: Record<string, string> = {
      primario: 'rgb(186, 92, 37)',
      // O `grafite-degrau` do claro (`#0d0d0d`), e não resto do preto da `noite` de antes: o oficial é grafite (RF6).
      oficial: 'rgb(13, 13, 13)',
      secundario: 'rgb(229, 229, 229)',
      perigo: 'rgb(249, 178, 181)',
    }
    for (const [variante, cor] of Object.entries(degraus)) {
      const ligado = botoes.locator(`[data-tamanho="principal"] [data-variante="${variante}"]`)
      expect(await sombraEMargem(ligado), variante).toEqual([`${cor} 0px 4px 0px 0px`, '4px'])
      // A face é a que mede 44 px: o degrau fica de fora, na margem.
      expect((await caixa(ligado)).height, variante).toBe(44)
      const desligado = botoes.locator(`[data-tamanho="desligado"] [data-variante="${variante}"]`)
      expect(await sombraEMargem(desligado), variante).toEqual(['none', '4px'])
    }
    // O discreto não tem degrau, nem margem.
    expect(await sombraEMargem(botoes.locator('[data-tamanho="principal"] [data-variante="discreto"]'))).toEqual(['none', '0px'])
    // O botão só de ícone tem o degrau de 3 px (9.3), e o perigo cheio o `vermelho-degrau`.
    expect(await sombraEMargem(botoes.locator('[data-tamanho="icone"] [data-variante="primario"]'))).toEqual(['rgb(186, 92, 37) 0px 3px 0px 0px', '3px'])
    const cheio = botoes.locator('[data-tamanho="perigo-cheio"]').getByRole('button', { name: 'Perigo cheio', exact: true })
    expect(await sombraEMargem(cheio)).toEqual(['rgb(194, 67, 73) 0px 4px 0px 0px', '4px'])
  })

  /**
   * Aperta o botão e mantém: o botão do mouse no computador; no celular, o estado `:active` forçado pelo protocolo do
   * navegador, que é o que o toque acende, sem ponteiro passando por cima (o `hover` não é forçado). O Chromium sem
   * tela não acende o `:active` com o toque sintético (`Input.dispatchTouchEvent` e `synthesizeTapGesture` foram
   * medidos e não o acendem), e o que a regra afirma é o que a folha faz quando a peça está apertada.
   */
  async function apertar(page: Page, alvo: Locator, hasTouch: boolean): Promise<() => Promise<void>> {
    // A coordenada é da janela: o botão precisa estar dentro dela, ou o mouse cai em outra peça.
    await alvo.scrollIntoViewIfNeeded()
    if (!hasTouch) {
      const medida = await caixa(alvo)
      await page.mouse.move(medida.x + medida.width / 2, medida.y + medida.height / 2)
      await page.mouse.down()
      return () => page.mouse.up()
    }
    await alvo.evaluate((elemento) => elemento.setAttribute('data-apertado', ''))
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-apertado]' })
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] })
    return async () => {
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
      await alvo.evaluate((elemento) => elemento.removeAttribute('data-apertado'))
    }
  }

  const transformDe = (alvo: Locator) => alvo.evaluate((elemento) => getComputedStyle(elemento).transform)

  test('apertado, a face desce o degrau e a sombra some; no celular, pelo toque e sem hover', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const primario = secao(page, 'botoes').locator('[data-tamanho="principal"] [data-variante="primario"]')
    await expect(primario).toBeVisible()
    expect(await transformDe(primario)).toBe('none')
    const soltar = await apertar(page, primario, hasTouch)
    // A descida de 100 ms termina antes de o `poll` desistir.
    await expect.poll(() => transformDe(primario)).toBe('matrix(1, 0, 0, 1, 0, 4)')
    // A sombra encolheu o que a face desceu: o botão não cresce, e nada em volta se mexe.
    expect(await primario.evaluate((elemento) => getComputedStyle(elemento).boxShadow)).toBe('rgb(186, 92, 37) 0px 0px 0px 0px')
    await soltar()
    await expect.poll(() => transformDe(primario)).toBe('none')
  })

  test('com movimento reduzido, apertar não desloca a face, e a transição some', async ({ page, hasTouch }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await abrirGaleria(page)
    const oficial = secao(page, 'botoes').locator('[data-tamanho="principal"] [data-variante="oficial"]')
    await expect(oficial).toBeVisible()
    // A duração é de 0,01 ms: nenhuma transição que se veja (RF8).
    expect(Number.parseFloat(await oficial.evaluate((elemento) => getComputedStyle(elemento).transitionDuration))).toBeLessThan(0.001)
    const soltar = await apertar(page, oficial, hasTouch)
    // A sombra encolhe, e é ela que diz que a peça está apertada; a face fica onde estava. O `rgb(13, 13, 13)` é o
    // `grafite-degrau` do claro, e não a `noite` de antes.
    await expect.poll(() => oficial.evaluate((elemento) => getComputedStyle(elemento).boxShadow)).toBe('rgb(13, 13, 13) 0px 0px 0px 0px')
    expect(await transformDe(oficial)).toBe('none')
    await soltar()
  })

  for (const tema of ['claro', 'escuro'] as const) {
    test(`o anel de foco é de 3 px na cor foco, afastado 2 px, em todo botão da galeria, no ${tema}`, async ({ page }) => {
      await abrirGaleria(page)
      await page.evaluate((valor) => document.documentElement.setAttribute('data-tema', valor), tema)
      const ativos = secao(page, 'botoes').locator('button:not([disabled])[data-variante]')
      const quantos = await ativos.count()
      // 5 principais, 5 compactos, 5 com glifo, 5 só de ícone e o perigo cheio ligado.
      expect(quantos).toBe(21)
      await page.keyboard.press('Tab')
      await ativos.first().focus()
      for (let indice = 0; indice < quantos; indice++) {
        const anel = await page.evaluate(() => {
          const elemento = document.activeElement
          if (elemento === null) return null
          const estilo = getComputedStyle(elemento)
          const peca = `${elemento.parentElement?.getAttribute('data-tamanho') ?? ''}:${elemento.getAttribute('data-variante') ?? ''}`
          return { visivel: elemento.matches(':focus-visible'), estilo: estilo.outlineStyle, largura: estilo.outlineWidth, cor: estilo.outlineColor, afastamento: estilo.outlineOffset, peca }
        })
        // A ordem do Tab é a da galeria: se ela mudar, o anel que se confere deixa de ser o da peça esperada.
        expect(anel?.peca, `botão ${String(indice)}`).toBe(PECAS_NA_ORDEM_DO_TAB[indice])
        expect(anel, `botão ${String(indice)}`).toMatchObject({ visivel: true, estilo: 'solid', largura: '3px', cor: FOCO[tema], afastamento: '2px' })
        await page.keyboard.press('Tab')
      }
    })
  }
})
