import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './support/profiles.ts'
import { openGallery, caixa, desenho, gallerySection } from './support/gallery.ts'
import { corDoToken, FAILING_IMPACTS, horizontalOverflow, WCAG_TAGS } from './support/checks.ts'

/**
 * Os ícones ilustrados dos lugares e o ladrilho, na galeria (`/galeria`), nos projetos `chromebook` e `celular` e nos
 * dois temas (X1, tarefa 9.0; RF17 e RF22; `docs/interface.md` 9.4 e 10.2). O que o `jsdom` prova — o nome, a decoração,
 * a família de cada ladrilho, as classes — está em `components/ui/Icon.test.tsx`, `components/ui/IconTile.test.tsx` e
 * `components/ui/icons/places.test.tsx`; aqui está o que só o navegador calcula: a cor resolvida de cada forma, a medida
 * e o ícone a 72% do lado.
 */

const TEMAS = ['claro', 'escuro'] as const
type Tema = (typeof TEMAS)[number]

const TAMANHOS_DO_ICONE = [24, 32, 48] as const
const TAMANHOS_DO_LADRILHO = [32, 36, 40, 44, 48, 56] as const
const LUGARES = ['inicio', 'turmas', 'tarefas', 'ferramentas'] as const

/** O papel e a linha dos ícones, como o navegador os devolve, em cada tema (9.10: `icone-papel` e `icone-linha`). */
const PAPEL: Record<Tema, string> = { claro: 'rgb(239, 239, 239)', escuro: 'rgb(55, 70, 79)' }
const LINHA: Record<Tema, string> = { claro: 'rgb(215, 215, 215)', escuro: 'rgb(82, 101, 109)' }

async function irParaOTema(page: Page, tema: Tema): Promise<void> {
  await openGallery(page)
  await page.evaluate((valor) => document.documentElement.setAttribute('data-tema', valor), tema)
}

/** O `fill` calculado de cada forma de um ícone, na ordem em que foram desenhadas. */
function enchimentoDasFormas(icone: ReturnType<typeof gallerySection>): Promise<string[]> {
  return icone.evaluate((svg) => [...svg.children].map((forma) => getComputedStyle(forma).fill))
}

for (const tema of TEMAS) {
  test.describe(`os ícones dos lugares e o ladrilho, no tema ${tema}`, () => {
    test('o papel e a linha do ícone são os tokens do tema: papel #EFEFEF no claro e #37464F no escuro, lidos do estilo calculado', async ({ page }) => {
      await irParaOTema(page, tema)
      const [papelDoToken, linhaDoToken] = await Promise.all([corDoToken(page, 'icone-papel'), corDoToken(page, 'icone-linha')])
      expect(papelDoToken).toBe(PAPEL[tema])
      expect(linhaDoToken).toBe(LINHA[tema])

      const casa = gallerySection(page, 'marca-icones').locator('[data-icones-do-tamanho="48"] [data-icone="inicio"]')
      await expect(casa).toHaveCount(1)
      const enchimento = await enchimentoDasFormas(casa)
      // A casa tem o papel (o corpo) e a linha (as janelas), e nenhuma forma ficou sem cor: `none` seria um buraco.
      expect(enchimento).toContain(PAPEL[tema])
      expect(enchimento).toContain(LINHA[tema])
      expect(enchimento).not.toContain('none')
      expect(enchimento).not.toContain('rgb(0, 0, 0)')
    })

    test('a cor dominante de cada lugar é a face da família dele, lida do token, e as ferramentas são laranja, azul, verde e roxo', async ({ page }) => {
      await irParaOTema(page, tema)
      const faces = Object.fromEntries(
        await Promise.all(['laranja', 'azul', 'verde', 'roxo', 'turquesa', 'amarelo'].map(async (token) => [token, await corDoToken(page, token)] as const)),
      )
      const doLugar = (nome: string) => gallerySection(page, 'marca-icones').locator(`[data-icones-do-tamanho="48"] [data-icone="${nome}"]`)
      expect(await enchimentoDasFormas(doLugar('inicio'))).toContain(faces['laranja'])
      expect(await enchimentoDasFormas(doLugar('turmas'))).toContain(faces['turquesa'])
      expect(await enchimentoDasFormas(doLugar('tarefas'))).toContain(faces['azul'])
      expect(await enchimentoDasFormas(doLugar('ferramentas'))).toEqual([faces['laranja'], faces['azul'], faces['verde'], faces['roxo']])
      // Criados (telas do professor, 5.0): a pasta é amarela, com a folha e a linha nos tokens de papel e de linha.
      expect(await enchimentoDasFormas(doLugar('criados'))).toContain(faces['amarelo'])
    })

    test('cada ícone é quadrado na medida pedida, e o ladrilho, também, com o ícone a 72% do lado, centrado', async ({ page }) => {
      await irParaOTema(page, tema)
      for (const tamanho of TAMANHOS_DO_ICONE) {
        for (const nome of LUGARES) {
          const icone = gallerySection(page, 'marca-icones').locator(`[data-icones-do-tamanho="${String(tamanho)}"] [data-icone="${nome}"]`)
          await expect(icone, `${nome} a ${String(tamanho)} px`).toHaveCount(1)
          expect(await caixa(icone), `${nome}: quadrado de ${String(tamanho)} px`).toMatchObject({ width: tamanho, height: tamanho })
        }
      }
      for (const [grupo, filho] of [
        ['data-ladrilhos-ilustrados', 'svg[data-icone="inicio"]'],
        ['data-ladrilhos-do-lucide', 'svg'],
      ] as const) {
        const ladrilhos = gallerySection(page, 'marca-icones').locator(`[${grupo}] [data-ladrilho]`)
        await expect(ladrilhos, grupo).toHaveCount(TAMANHOS_DO_LADRILHO.length)
        for (const [indice, tamanho] of TAMANHOS_DO_LADRILHO.entries()) {
          const ladrilho = ladrilhos.nth(indice)
          const moldura = await caixa(ladrilho)
          expect(moldura, `${grupo}: ladrilho de ${String(tamanho)} px`).toMatchObject({ width: tamanho, height: tamanho })
          const interno = await caixa(ladrilho.locator(filho))
          expect(interno.width, `${grupo}: o ícone a 72% de ${String(tamanho)}`).toBeCloseTo(tamanho * 0.72, 0)
          expect(interno.height).toBeCloseTo(interno.width, 1)
          // Centrado: a sobra é a mesma dos dois lados.
          expect(interno.x - moldura.x).toBeCloseTo(moldura.x + moldura.width - (interno.x + interno.width), 0)
          expect(interno.y - moldura.y).toBeCloseTo(moldura.y + moldura.height - (interno.y + interno.height), 0)
        }
      }
    })

    test('o fundo do ladrilho é o `claro` da família, de canto 12, e o ícone do `lucide` desenha com o `texto` dela', async ({ page }) => {
      await irParaOTema(page, tema)
      const familias = ['laranja', 'azul', 'verde', 'amarelo', 'vermelho', 'roxo', 'turquesa', 'anil', 'lima', 'rosa'] as const
      const ladrilhos = gallerySection(page, 'marca-icones').locator('[data-ladrilhos-das-familias] [data-ladrilho]')
      await expect(ladrilhos).toHaveCount(familias.length)
      for (const [indice, familia] of familias.entries()) {
        const ladrilho = ladrilhos.nth(indice)
        await expect(ladrilho).toHaveAttribute('data-ladrilho', familia)
        const [claro, texto] = await Promise.all([corDoToken(page, `${familia}-claro`), corDoToken(page, `${familia}-texto`)])
        const estilo = await desenho(ladrilho)
        expect(estilo.fundo, `${familia}: o fundo`).toBe(claro)
        expect(estilo.canto, `${familia}: canto 12`).toBe('12px')
        expect(await ladrilho.locator('svg').evaluate((svg) => getComputedStyle(svg).color), `${familia}: a cor do ícone`).toBe(texto)
      }
    })

    test('o ícone com nome é uma imagem; ao lado do texto, ele some da leitura de tela, e o ladrilho com nome é uma imagem só', async ({ page }) => {
      await irParaOTema(page, tema)
      const bloco = gallerySection(page, 'marca-icones').locator('[data-ladrilhos-com-nome]')
      await expect(bloco.getByRole('img', { name: 'Turmas' })).toHaveCount(1)
      await expect(bloco.getByRole('img', { name: 'Início' })).toHaveCount(1)
      // Os dois que têm o texto ao lado são decoração: nenhuma imagem com o nome deles.
      await expect(bloco.getByRole('img', { name: 'Ferramentas' })).toHaveCount(0)
      await expect(bloco.getByRole('img', { name: 'Atividades' })).toHaveCount(0)
      await expect(bloco.getByText('Ferramentas')).toBeVisible()
      await expect(bloco.getByText('Atividades')).toBeVisible()
      // Na seção toda, as imagens com nome são só essas duas.
      await expect(gallerySection(page, 'marca-icones').getByRole('img')).toHaveCount(2)
    })

    test('nada se mexe: nenhuma animação nem transição em ícone nem em ladrilho', async ({ page }) => {
      await irParaOTema(page, tema)
      const animados = await gallerySection(page, 'marca-icones').evaluate((raiz) =>
        [raiz, ...raiz.querySelectorAll('*')].filter((no) => {
          const estilo = getComputedStyle(no)
          return estilo.animationName !== 'none' || Number.parseFloat(estilo.transitionDuration) > 0
        }).length,
      )
      expect(animados).toBe(0)
    })

    test('a seção não tem violação grave de acessibilidade, e a página não ganha rolagem horizontal', async ({ page }) => {
      await irParaOTema(page, tema)
      const { violations } = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).include('[data-galeria="marca-icones"]').analyze()
      const graves = violations
        .filter((violacao) => (FAILING_IMPACTS as readonly string[]).includes(violacao.impact ?? ''))
        .map((violacao) => ({ regra: violacao.id, impacto: violacao.impact, alvos: violacao.nodes.map((no) => no.target.join(' ')) }))
      expect(graves).toEqual([])
      expect(await horizontalOverflow(page)).toBe(0)
    })
  })
}
