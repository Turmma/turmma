import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support/profiles.ts'
import { corDoToken, larguraExcedente, violacoesGraves } from './support/checks.ts'

/**
 * A moldura das páginas de fora da sessão (X1, tarefa 14.0; `docs/interface.md` 11.3, 9.6): a partir de 1024 px a tela
 * se divide, com o painel `papel` e a pinta parada à esquerda e o cartão do formulário à direita; abaixo disso empilha.
 * Nenhum texto, ordem de campo ou resposta muda: os e2e de `entrar`, `convite`, `mfa` e `turma-publica` rodam sem edição.
 *
 * As duas telas aqui não pedem dado nenhum: `/entrar` (a entrada) e `/mfa` (o segundo fator sem desafio, que é a mesma
 * moldura com o aviso). As outras páginas públicas usam a mesma `CascaPublica` e têm os e2e delas, sem edição.
 */

const TELAS = [
  { endereco: '/entrar', titulo: 'Entrar' },
  { endereco: '/mfa', titulo: 'Segundo fator' },
] as const

const painel = (page: Page): Locator => page.locator('[data-painel-publico]')
const cartao = (page: Page): Locator => page.getByRole('main')
/** A pinta parada do painel: a que está ao lado do `banner`, e não a da marca. */
const pintaDoPainel = (page: Page): Locator => page.locator('[data-painel-publico] > img[src="/marca/turmma-pinta.svg"]')

async function caixa(alvo: Locator) {
  const medida = await alvo.boundingBox()
  if (medida === null) throw new Error('o elemento não está na tela')
  return medida
}

test.describe('a moldura das páginas públicas', () => {
  for (const { endereco, titulo } of TELAS) {
    test(`${endereco}: a 1024 e a 1366 px o painel fica à esquerda do cartão, na altura da janela e sem rolagem de lado`, async ({ page }) => {
      for (const largura of [1366, 1024]) {
        await page.setViewportSize({ width: largura, height: 768 })
        await page.goto(endereco)
        await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()

        const [lateral, principal] = [await caixa(painel(page)), await caixa(cartao(page))]
        // Lado a lado: o painel termina onde o cartão começa, e os dois ocupam a mesma faixa de cima a baixo.
        expect(lateral.x, `painel a ${String(largura)} px`).toBe(0)
        expect(lateral.x + lateral.width, `o painel termina antes do cartão a ${String(largura)} px`).toBeLessThanOrEqual(principal.x)
        expect(principal.x + principal.width, `o cartão cabe na janela a ${String(largura)} px`).toBeLessThanOrEqual(largura)
        // Meia janela para cada lado: o formulário não se espalha, e o painel não some.
        expect(lateral.width, `largura do painel a ${String(largura)} px`).toBeGreaterThanOrEqual(largura / 2 - 2)
        expect(lateral.height, `altura do painel a ${String(largura)} px`).toBeGreaterThanOrEqual(768)
        expect(await larguraExcedente(page), `rolagem de lado a ${String(largura)} px`).toBe(0)
        // O cartão fica no meio da altura do painel: o espaço de cima é o de baixo, e maior que o enchimento da coluna
        // (48 px). Sem o centro, a linha da coluna o esticaria até o pé, e os dois espaços cairiam para o enchimento.
        const acima = principal.y - lateral.y
        const abaixo = lateral.y + lateral.height - (principal.y + principal.height)
        expect(Math.abs(acima - abaixo), `o cartão centrado a ${String(largura)} px`).toBeLessThanOrEqual(2)
        expect(acima, `o cartão não gruda no topo a ${String(largura)} px`).toBeGreaterThanOrEqual(96)
        // O formulário não se espalha: a largura do cartão é a de `max-w-md` (28 rem), e não a da coluna (a 1366 px, 603 px).
        expect(principal.width, `largura do cartão a ${String(largura)} px`).toBeLessThanOrEqual(448)

        // A pinta parada está à vista dentro do painel, sem passar do canto dele.
        const pinta = pintaDoPainel(page)
        await expect(pinta).toBeVisible()
        const dela = await caixa(pinta)
        expect(dela.x).toBeGreaterThanOrEqual(lateral.x)
        expect(dela.x + dela.width).toBeLessThanOrEqual(lateral.x + lateral.width)
        expect(dela.y + dela.height).toBeLessThanOrEqual(lateral.y + lateral.height)
      }
    })

    test(`${endereco}: a 1023 e a 360 px empilha, o painel em cima do formulário, sem a pinta grande e sem rolagem de lado`, async ({ page }) => {
      for (const largura of [1023, 360]) {
        await page.setViewportSize({ width: largura, height: 800 })
        await page.goto(endereco)
        await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()

        const [lateral, principal] = [await caixa(painel(page)), await caixa(cartao(page))]
        // Um em cima do outro: o formulário começa onde o painel termina, e o painel ocupa a largura inteira.
        expect(principal.y, `o cartão vem embaixo do painel a ${String(largura)} px`).toBeGreaterThanOrEqual(lateral.y + lateral.height)
        expect(lateral.width, `largura do painel a ${String(largura)} px`).toBe(largura)
        // O formulário continua legível no celular: não passa da janela, e a coluna única ocupa a largura menos a margem.
        expect(principal.x).toBeGreaterThanOrEqual(0)
        expect(principal.x + principal.width).toBeLessThanOrEqual(largura)
        expect(await larguraExcedente(page), `rolagem de lado a ${String(largura)} px`).toBe(0)
        // Empilhado o painel é só a marca: a pinta grande é do computador.
        await expect(pintaDoPainel(page)).toBeHidden()
        await expect(page.getByRole('banner').getByText('Turmma')).toBeVisible()
      }
    })
  }

  test('a pinta do painel está parada e apagada, e não é uma imagem nova: o arquivo da marca, com `alt` vazio', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/entrar')
    const pinta = pintaDoPainel(page)
    await expect(pinta).toBeVisible()
    await expect(pinta).toHaveAttribute('alt', '')
    await expect(pinta).toHaveJSProperty('complete', true)
    expect(await pinta.evaluate((imagem) => (imagem as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)

    // Parada: nenhuma animação e transição de 0 s (docs/interface.md 9.6). Apagada: bem mais clara que a da marca.
    const estilo = await pinta.evaluate((imagem) => {
      const calculado = getComputedStyle(imagem)
      return { animacao: calculado.animationName, duracao: calculado.transitionDuration, opacidade: Number(calculado.opacity) }
    })
    expect(estilo.animacao).toBe('none')
    expect(estilo.opacidade).toBeGreaterThan(0)
    expect(estilo.opacidade).toBeLessThanOrEqual(0.2)
    // O `all` que o navegador devolve sem regra não conta: parada é duração zero, como o resto do projeto mede.
    expect(estilo.duracao).toBe('0s')
    const daMarca = page.getByRole('banner').locator('img[src="/marca/turmma-pinta.svg"]')
    expect(await daMarca.evaluate((imagem) => Number(getComputedStyle(imagem).opacity))).toBe(1)
  })

  test('o painel é o `papel` dos dois temas, e o cartão é a `superficie`', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/entrar')
    const fundoDoPainel = () => painel(page).evaluate((elemento) => getComputedStyle(elemento).backgroundColor)
    const fundoDoCartao = () => cartao(page).evaluate((elemento) => getComputedStyle(elemento).backgroundColor)

    expect(await fundoDoPainel()).toBe(await corDoToken(page, 'papel'))
    expect(await fundoDoCartao()).toBe(await corDoToken(page, 'superficie'))
    const claro = await fundoDoPainel()

    await page.evaluate(() => document.documentElement.setAttribute('data-tema', 'escuro'))
    expect(await fundoDoPainel()).toBe(await corDoToken(page, 'papel'))
    expect(await fundoDoPainel()).not.toBe(claro)
    expect(await fundoDoCartao()).toBe(await corDoToken(page, 'superficie'))
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('/entrar: os dois campos têm o rótulo, o tipo, o teclado, o preenchimento e o limite de sempre, o e-mail antes da senha', async ({ page }) => {
    await page.goto('/entrar')
    const email = page.getByLabel('E-mail', { exact: true })
    const senha = page.getByLabel('Senha', { exact: true })

    // O e-mail: teclado de e-mail, sem maiúscula nem corretor, o preenchimento de usuário e o teto de `TAMANHO_MAXIMO_EMAIL`
    // (254, `packages/shared/src/sessao/login.ts`, que o e2e não importa: o módulo é do pacote e usa `.js` nos imports).
    await expect(email).toHaveAttribute('name', 'email')
    await expect(email).toHaveAttribute('type', 'email')
    await expect(email).toHaveAttribute('inputmode', 'email')
    await expect(email).toHaveAttribute('autocomplete', 'username')
    await expect(email).toHaveAttribute('autocapitalize', 'none')
    await expect(email).toHaveAttribute('spellcheck', 'false')
    await expect(email).toHaveAttribute('required', '')
    await expect(email).toHaveAttribute('maxlength', '254')

    // A senha: o gerenciador do navegador a reconhece como a senha atual, e o teto é o de `TAMANHO_MAXIMO_SENHA` (1.024).
    await expect(senha).toHaveAttribute('name', 'senha')
    await expect(senha).toHaveAttribute('type', 'password')
    await expect(senha).toHaveAttribute('autocomplete', 'current-password')
    await expect(senha).toHaveAttribute('required', '')
    await expect(senha).toHaveAttribute('maxlength', '1024')

    // A ordem: o e-mail vem antes da senha, e entre os dois não há parada de Tab nova (a senha é `FormField`, sem o "Mostrar").
    const emOrdem = await email.evaluate((campo, alvo) => Boolean(campo.compareDocumentPosition(alvo as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await senha.elementHandle())
    expect(emOrdem).toBe(true)
    await expect(page.getByRole('button', { name: 'Mostrar a senha' })).toHaveCount(0)
  })

  test('/e/<escola>: o nome comprido e sem espaço quebra dentro do cartão, a 360 e a 1024 px, sem rolagem de lado', async ({ page }) => {
    const nome = 'EscolaMunicipalDeEnsinoFundamentalProfessoraMariaAparecidaDaSilvaSantosOliveiraPereira'
    // O nome que a escola cadastrou vai direto ao `h1`: a resposta pública é interceptada, e nada mais da página muda.
    await page.route('**/v1/escolas/*/acesso', (rota) => rota.fulfill({ json: { nome, provedores: [] } }))
    for (const largura of [360, 1024]) {
      await page.setViewportSize({ width: largura, height: 800 })
      await page.goto('/e/escola-do-nome-comprido')
      const titulo = page.getByRole('heading', { level: 1, name: nome })
      await expect(titulo).toBeVisible()

      expect(await larguraExcedente(page), `rolagem de lado a ${String(largura)} px`).toBe(0)
      const [h1, principal] = [await caixa(titulo), await caixa(cartao(page))]
      expect(h1.x, `título dentro do cartão a ${String(largura)} px`).toBeGreaterThanOrEqual(principal.x)
      expect(h1.x + h1.width, `título dentro do cartão a ${String(largura)} px`).toBeLessThanOrEqual(principal.x + principal.width + 1)
      expect(principal.x + principal.width, `cartão dentro da janela a ${String(largura)} px`).toBeLessThanOrEqual(largura)
      // O texto cabe na caixa do `h1`: a palavra quebrou, e não vazou dela.
      expect(await titulo.evaluate((elemento) => elemento.scrollWidth - elemento.clientWidth), `texto do título a ${String(largura)} px`).toBeLessThanOrEqual(0)
    }
  })

  test('sem violação grave do axe, com a pinta parada, a 1366 e a 360 px', async ({ page }) => {
    for (const largura of [1366, 360]) {
      await page.setViewportSize({ width: largura, height: 800 })
      await page.goto('/entrar')
      await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible()
      expect(await violacoesGraves(page), `axe a ${String(largura)} px`).toEqual([])
      // Um `banner` e um `main` só: dois deles dão a violação `landmark-no-duplicate-*` que o axe leria como grave.
      await expect(page.getByRole('banner')).toHaveCount(1)
      await expect(page.getByRole('main')).toHaveCount(1)
    }
  })
})
