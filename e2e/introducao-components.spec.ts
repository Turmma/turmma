import { AxeBuilder } from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support/profiles.ts'
import { abrirGaleria, caixa, secao } from './support/gallery.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, IMPACTOS_QUE_REPROVAM, larguraExcedente, TAGS_WCAG } from './support/checks.ts'

/**
 * As peças da introdução, na galeria (`/galeria`, seção "Introdução"), nos projetos `chromebook` e `celular` e nos dois temas
 * (X4, tarefa 5.0; RF3, RF8, RF16, RF19; `docs/interface.md` 9.7; mockup 2.8). O que o `jsdom` prova — a ordem e o foco, os
 * botões iguais, o passo obrigatório, as poses e o rosto, a cadeia de importação — está em
 * `components/introducao/Introducao.test.tsx`, `components/ui/onca/Onca.test.tsx` e `components/ui/Comemoracao.test.tsx`;
 * aqui está o que só o navegador calcula: a medida, o foco de verdade, o movimento resolvido e o que "reduzir movimento" faz.
 */

const TEMAS = ['claro', 'escuro'] as const
type Tema = (typeof TEMAS)[number]

/** A pelagem da onça (9.7), como o navegador a devolve: a mesma nos dois temas. */
const PELAGEM = 'rgb(232, 115, 46)'

async function irParaOTema(page: Page, tema: Tema): Promise<void> {
  await abrirGaleria(page)
  await page.evaluate((valor) => document.documentElement.setAttribute('data-tema', valor), tema)
}

const introducao = (page: Page) => secao(page, 'introducao').locator('[data-introducao-da-galeria]')
const fala = (page: Page) => introducao(page).getByRole('heading', { level: 1 })
const botao = (page: Page, nome: string) => introducao(page).getByRole('button', { name: nome, exact: true })

for (const tema of TEMAS) {
  test.describe(`a introdução e a comemoração, no tema ${tema}`, () => {
    test('a fala é o `h1`, a onça acena e depois aponta, sempre com a função e o selo "IA", e o rosto é o da pose', async ({ page }) => {
      await irParaOTema(page, tema)
      await expect(fala(page)).toHaveText('Oi, Lia! Eu sou o Tutor, um programa da escola.')
      const onca = introducao(page).locator('[data-onca]')
      await expect(onca).toHaveAttribute('data-pose', 'acenando')
      await expect(onca.locator('figcaption')).toContainText('Tutor')
      // O nome acessível, como o navegador o calcula: a função, e nunca "onça".
      await expect(introducao(page).getByRole('figure', { name: /^Tutor/ })).toHaveCount(1)
      await expect(introducao(page).getByRole('figure', { name: /on[çc]a/i })).toHaveCount(0)
      await expect(onca.locator('figcaption [data-selo-ia]')).toBeVisible()
      const rostoDoPasso1 = await onca.locator('[data-rosto]').evaluate((no) => no.innerHTML)
      // O corpo e a cabeça são uma forma só, de pelagem.
      const pelagem = await onca.locator('svg [data-parte="corpo"] > g > path').evaluate((no) => getComputedStyle(no).fill)
      expect(pelagem, 'a onça é a mesma no claro e no escuro').toBe(PELAGEM)

      await botao(page, 'Continuar').click()
      await expect(onca).toHaveAttribute('data-pose', 'apontando')
      // O rosto é o do mockup para cada pose: acenando de boca aberta, apontando de lado e sorrindo.
      expect(await onca.locator('[data-rosto]').evaluate((no) => no.innerHTML.replace(/\bonca[a-zA-Z0-9]+(?=-)/g, 'id')), 'cada pose tem o seu rosto').not.toBe(rostoDoPasso1.replace(/\bonca[a-zA-Z0-9]+(?=-)/g, 'id'))
      // A onça de corpo inteiro cabe na coluna e tem a largura do desenho de 120 px.
      expect((await caixa(onca.locator('svg'))).width).toBe(120)
    })

    test('"Continuar" e "Pular" têm o mesmo tamanho e o mesmo peso, e 44 px de toque; o "Sair" também (RF3, RF16, D59)', async ({ page }) => {
      await irParaOTema(page, tema)
      // O passo 1 é obrigatório: o "Pular" aparece no 2.
      await botao(page, 'Continuar').click()
      const medidas = async (nome: string) => {
        const alvo = botao(page, nome)
        await expect(alvo).toBeVisible()
        const [medida, estilo] = await Promise.all([caixa(alvo), alvo.evaluate((no) => ({ peso: getComputedStyle(no).fontWeight, fonte: getComputedStyle(no).fontSize }))])
        return { altura: medida.height, ...estilo }
      }
      const [seguir, pular, sair] = [await medidas('Continuar'), await medidas('Pular'), await medidas('Sair')]
      expect(pular).toEqual(seguir)
      expect(seguir.altura).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect(sair.altura, 'sair nunca é menor que seguir').toBeGreaterThanOrEqual(seguir.altura)
      expect(sair.peso).toBe(seguir.peso)
      const [largSeguir, largPular] = [(await caixa(botao(page, 'Continuar'))).width, (await caixa(botao(page, 'Pular'))).width]
      expect(Math.abs(largSeguir - largPular), 'lado a lado ou em coluna, os dois ocupam o mesmo').toBeLessThanOrEqual(1)
    })

    test('o passo obrigatório não tem "Pular" nem "Fechar", e o Esc não sai; Enter continua e o foco acompanha a fala', async ({ page }) => {
      await irParaOTema(page, tema)
      await expect(botao(page, 'Pular')).toHaveCount(0)
      await expect(botao(page, 'Fechar')).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(secao(page, 'introducao').locator('[data-ultimo-evento]')).toHaveText('Último evento: nenhum')

      // Sem foco na galeria, o Enter vem do corpo da página: avança um passo e leva o foco à fala.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await page.keyboard.press('Enter')
      await expect(fala(page)).toHaveText('Seus professores veem o que você me pergunta.')
      await expect(fala(page)).toBeFocused()
    })

    test('revendo, todo passo tem "Fechar", e o Esc fecha', async ({ page }) => {
      await irParaOTema(page, tema)
      await secao(page, 'introducao').getByLabel('Revendo').check()
      for (let passo = 0; passo < 3; passo++) {
        await expect(botao(page, 'Fechar')).toBeVisible()
        await expect(botao(page, 'Pular')).toHaveCount(0)
        if (passo < 2) await botao(page, 'Continuar').click()
      }
      await page.keyboard.press('Escape')
      await expect(secao(page, 'introducao').locator('[data-ultimo-evento]')).toHaveText('Último evento: pulou')
    })

    test('a seção não tem violação grave de acessibilidade, e a página não ganha rolagem horizontal', async ({ page }) => {
      await irParaOTema(page, tema)
      const { violations } = await new AxeBuilder({ page }).withTags([...TAGS_WCAG]).include('[data-galeria="introducao"]').analyze()
      const graves = violations
        .filter((violacao) => (IMPACTOS_QUE_REPROVAM as readonly string[]).includes(violacao.impact ?? ''))
        .map((violacao) => ({ regra: violacao.id, impacto: violacao.impact, alvos: violacao.nodes.map((no) => no.target.join(' ')) }))
      expect(graves).toEqual([])
      expect(await larguraExcedente(page)).toBe(0)
    })
  })
}

test.describe('o movimento da comemoração', () => {
  const comemoracao = (page: Page) => secao(page, 'introducao').locator('[data-comemoracao]')
  const salto = (page: Page) => comemoracao(page).locator('.onca-comemora')

  /** Os elementos da subárvore (a raiz inclusa) com alguma animação: o que o navegador resolve, não o que o CSS diz. */
  const animados = (page: Page) =>
    comemoracao(page).evaluate((raiz) =>
      [raiz, ...raiz.querySelectorAll('*')].flatMap((no) => {
        const estilo = getComputedStyle(no)
        return estilo.animationName === 'none' ? [] : [{ nome: estilo.animationName, iteracoes: estilo.animationIterationCount, duracao: estilo.animationDuration }]
      }),
    )

  test('um salto só: na árvore da comemoração uma única animação, `onca-comemorar`, uma iteração, nunca em laço', async ({ page }) => {
    await abrirGaleria(page)
    await expect(comemoracao(page)).toHaveCount(1)
    await expect(salto(page)).toHaveCount(1)
    const todas = await animados(page)
    expect(todas, 'exatamente uma animação na árvore da comemoração').toHaveLength(1)
    const [resolvido] = todas
    expect(resolvido?.nome).toBe('onca-comemorar')
    expect(resolvido?.iteracoes).toBe('1')
    expect(Number.parseFloat(resolvido?.duracao ?? '9')).toBeLessThan(1)
    await expect(comemoracao(page).locator('.comemoracao-salto')).toHaveCount(0)

    const propriedades = await page.evaluate(() => {
      const nomes = new Set<string>()
      for (const folha of document.styleSheets) {
        for (const regra of folha.cssRules) {
          if (!(regra instanceof CSSKeyframesRule) || regra.name !== 'onca-comemorar') continue
          for (const quadro of regra.cssRules) for (const propriedade of (quadro as CSSKeyframeRule).style) nomes.add(propriedade)
        }
      }
      return [...nomes].sort()
    })
    expect(propriedades).toEqual(['transform'])
  })

  test('com "reduzir movimento" nenhuma animação na árvore: a onça aparece parada, inteira, com função e selo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await abrirGaleria(page)
    await expect(salto(page)).toHaveCount(1)
    expect(await animados(page)).toEqual([])
    expect(await salto(page).evaluate((no) => getComputedStyle(no).animationName)).toBe('none')
    await expect(comemoracao(page).locator('[data-onca]')).toHaveAttribute('data-pose', 'comemorando')
    await expect(comemoracao(page).locator('figcaption [data-selo-ia]')).toBeVisible()
  })

  test('sem "reduzir movimento" o salto roda e termina: a onça acaba no lugar, visível', async ({ page }) => {
    await abrirGaleria(page)
    await expect.poll(() => salto(page).evaluate((no) => no.getAnimations().every((animacao) => animacao.playState === 'finished'))).toBe(true)
    expect(await salto(page).evaluate((no) => getComputedStyle(no).transform)).toMatch(/^(?:none|matrix\(1, 0, 0, 1, 0, 0\))$/)
    await expect(comemoracao(page).locator('[data-onca]')).toBeVisible()
  })

  test('com "reduzir movimento" a introdução não tem animação nenhuma, e a onça não acena', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await abrirGaleria(page)
    const animadas = await introducao(page).evaluate((raiz) => [raiz, ...raiz.querySelectorAll('*')].filter((no) => getComputedStyle(no).animationName !== 'none').length)
    expect(animadas).toBe(0)
    // O acenar não é ligado; a onça também não pisca nem agenda temporizador (teste de unidade).
    await expect(introducao(page).locator('.onca-acena')).toHaveCount(0)
    // A transição não se confere aqui: sob "reduzir movimento" a regra global do `index.css` põe duração mínima em todo elemento.
  })

  test('sem "reduzir movimento" a onça da introdução só faz os movimentos do `Onca.css`: entrar uma vez, nada em laço, nenhuma transição', async ({ page }) => {
    await abrirGaleria(page)
    const animacoes = await introducao(page)
      .locator('[data-onca]')
      .evaluate((onca) =>
        [onca, ...onca.querySelectorAll('*')].flatMap((no) => {
          const estilo = getComputedStyle(no)
          return estilo.animationName === 'none' ? [] : [{ nome: estilo.animationName, iteracoes: estilo.animationIterationCount }]
        }),
      )
    // Entrar (e acenar, na primeira onça da sessão): finitos e do `Onca.css`. Nada no produto fica em laço.
    for (const { nome, iteracoes } of animacoes) {
      expect(nome).toMatch(/^onca-/)
      expect(iteracoes).not.toBe('infinite')
    }
    await expectSemTransicao(introducao(page).locator('[data-onca]'))
  })
})

/** Os botões do sistema têm a transição do degrau ao apertar (`index.css`); a onça, nenhuma. */
async function expectSemTransicao(onca: Locator): Promise<void> {
  const comTransicao = await onca.evaluate((raiz) => [raiz, ...raiz.querySelectorAll('*')].filter((no) => getComputedStyle(no).transitionDuration.split(',').some((duracao) => Number.parseFloat(duracao) > 0)).length)
  expect(comTransicao).toBe(0)
}
