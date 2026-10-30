import type { Locator, Page } from '@playwright/test'
import { expect, test } from './__fixtures__/perfis.ts'
import { corDoToken, larguraExcedente, violacoesGraves } from './__fixtures__/verificacoes.ts'

/**
 * A moldura das páginas de fora da sessão (X1, tarefa 14.0; `docs/interface.md` 11.3, 9.6): a partir de 1024 px a tela
 * se divide, com o painel `papel` e a onça da marca acenando à esquerda e o cartão do formulário à direita; abaixo disso
 * empilha, com a onça de 88 px, parada, acima do formulário (D80 revista em 30/10/2026; correção `2026-10-30-onca-na-entrada`).
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
/** A caixa de 160 px do painel, que não se mexe (a figura dentro dela entra e acena): é ela que a medida de posição lê. */
const caixaDaOnca = (page: Page): Locator => page.locator('[data-painel-publico] [data-onca-da-marca-grande]')
const oncaDoPainel = (page: Page): Locator => page.locator('[data-painel-publico] [data-onca-da-marca]')
/** A de 88 px, fora do painel, acima do formulário. */
const caixaDaOncaPequena = (page: Page): Locator => page.locator('[data-onca-da-marca-pequena]')
const oncaPequena = (page: Page): Locator => page.locator('[data-onca-da-marca-pequena] [data-onca-da-marca]')

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

        // A onça da marca está à vista dentro do painel, com 160 px, sem passar da borda dele; a de 88 px, só do celular, não.
        const onca = oncaDoPainel(page)
        await expect(onca).toBeVisible()
        await expect(onca.locator('svg')).toHaveAttribute('width', '160')
        const dela = await caixa(caixaDaOnca(page))
        expect(dela.width, `caixa da onça a ${String(largura)} px`).toBe(160)
        expect(dela.x).toBeGreaterThanOrEqual(lateral.x)
        expect(dela.x + dela.width).toBeLessThanOrEqual(lateral.x + lateral.width)
        expect(dela.y + dela.height).toBeLessThanOrEqual(lateral.y + lateral.height)
        await expect(oncaPequena(page)).toBeHidden()
      }
    })

    test(`${endereco}: a 1023 e a 360 px empilha, o painel em cima do formulário, a onça de 88 px parada acima do formulário e sem rolagem de lado`, async ({ page }) => {
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
        // Empilhado o painel é só a marca: a onça de 160 px é do computador. A de 88 px vai sobre `fundo`, fora do painel, entre ele
        // e o formulário, centrada, e fica parada.
        await expect(oncaDoPainel(page)).toBeHidden()
        await expect(page.getByRole('banner').getByText('Turmma')).toBeVisible()
        const pequena = oncaPequena(page)
        await expect(pequena).toBeVisible()
        await expect(pequena.locator('svg')).toHaveAttribute('width', '88')
        const [dela, caixaFixa] = [await caixa(pequena), await caixa(caixaDaOncaPequena(page))]
        expect(caixaFixa.width, `caixa da onça pequena a ${String(largura)} px`).toBe(88)
        expect(dela.y, `a onça vem depois do painel a ${String(largura)} px`).toBeGreaterThanOrEqual(lateral.y + lateral.height)
        expect(dela.y + dela.height, `a onça vem antes do formulário a ${String(largura)} px`).toBeLessThanOrEqual(principal.y)
        expect(Math.abs(caixaFixa.x + caixaFixa.width / 2 - largura / 2), `a onça centrada a ${String(largura)} px`).toBeLessThanOrEqual(2)
        expect(await pequena.evaluate((figura) => figura.getAnimations({ subtree: true }).length), `a onça do celular está parada a ${String(largura)} px`).toBe(0)
      }
    })
  }

  test('a pinta grande saiu: a página tem só a pinta da marca, e a onça do painel é decorativa, sem nome nem selo nem texto', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/entrar')
    const onca = oncaDoPainel(page)
    await expect(onca).toBeVisible()
    // Nenhuma imagem de 384 px: o painel não tem `img`, e a única pinta da página é a do `banner`.
    await expect(page.locator('[data-painel-publico] > img')).toHaveCount(0)
    await expect(page.locator('img[src="/marca/turmma-pinta.svg"]')).toHaveCount(1)
    await expect(page.getByRole('banner').locator('img[src="/marca/turmma-pinta.svg"]')).toHaveCount(1)
    // A onça da marca não é saída de agente: sem legenda, sem selo "IA" e sem nome para o leitor de tela.
    await expect(onca).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('figcaption, [data-selo-ia], [data-onca-assinatura]')).toHaveCount(0)
    expect(await onca.evaluate((figura) => figura.textContent)).toBe('')
  })

  test('a onça do painel entra e acena uma vez, e nenhuma animação da página fica em laço', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/entrar')
    const onca = oncaDoPainel(page)
    await expect(onca).toBeVisible()
    // Duas animações, entrar e acenar, as duas com uma volta só: nenhuma com `infinite` (D59).
    await expect.poll(() => onca.evaluate((figura) => figura.getAnimations({ subtree: true }).map((a) => (a as CSSAnimation).animationName).sort()), { message: 'a onça entra e acena' }).toEqual(['onca-acenar', 'onca-entrar'])
    const voltas = await page.evaluate(() => document.getAnimations().map((a) => a.effect?.getComputedTiming().iterations))
    expect(voltas.length).toBeGreaterThan(0)
    for (const volta of voltas) expect(volta, 'cada animação roda uma vez').toBe(1)
  })

  test.describe('com "reduzir movimento"', () => {
    test.use({ reducedMotion: 'reduce' })

    test('a onça aparece parada: nenhuma animação roda', async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 768 })
      await page.goto('/entrar')
      const onca = oncaDoPainel(page)
      await expect(onca).toBeVisible()
      await expect(onca.locator('svg')).toHaveAttribute('width', '160')
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
      // O desenho está inteiro, não escondido no começo do movimento.
      expect(await onca.locator('.onca-entra').evaluate((corpo) => Number(getComputedStyle(corpo).opacity))).toBe(1)
    })
  })

  for (const { endereco } of TELAS) {
    test(`${endereco}: a onça do painel está no centro dele, na altura do centro do cartão, com respiro dos quatro lados e abaixo da marca, mesmo em janela baixa`, async ({ page }) => {
      // 1366 × 650 é o Chromebook de referência com a barra do navegador (regra 50, item 1); 1024 × 500 é a janela mais baixa
      // em que o painel ainda se divide, e a onça de 160 px ainda cabe abaixo da marca sem o painel precisar de altura mínima.
      // A medida é a da caixa fixa de 160 px: a figura dentro dela entra (8 px de deslocamento nos primeiros 240 ms) e não serve de régua.
      // A página abre uma vez só: o layout é CSS, e trocar o tamanho da janela basta (quatro `goto` levavam 11 s, perto dos 15 s do portão).
      await page.goto(endereco)
      const onca = caixaDaOnca(page)
      for (const [largura, altura] of [[1366, 768], [1366, 650], [1024, 768], [1024, 500]] as const) {
        const janela = `${String(largura)} × ${String(altura)} px`
        await page.setViewportSize({ width: largura, height: altura })
        await expect(onca).toBeVisible()

        const [lateral, dela, principal, marca] = [await caixa(painel(page)), await caixa(onca), await caixa(cartao(page)), await caixa(page.getByRole('banner'))]
        // O centro dela é o do painel, nos dois eixos (2 px de folga para o arredondamento do navegador): no canto, o desenho
        // ficava a um quarto do painel do centro, e o painel parecia vazio no meio.
        expect(Math.abs(dela.x + dela.width / 2 - (lateral.x + lateral.width / 2)), `centro da onça na horizontal a ${janela}`).toBeLessThanOrEqual(2)
        expect(Math.abs(dela.y + dela.height / 2 - (lateral.y + lateral.height / 2)), `centro da onça na vertical a ${janela}`).toBeLessThanOrEqual(2)
        // Na mesma linha do cartão: os dois são centrados na altura da janela, e a onça e o formulário se leem como um par.
        expect(Math.abs(dela.y + dela.height / 2 - (principal.y + principal.height / 2)), `a onça e o cartão na mesma altura a ${janela}`).toBeLessThanOrEqual(2)
        // Respiro: pelo menos 40 px de cada lado do painel, sem encostar na borda nem passar para o lado do formulário.
        expect(dela.x - lateral.x, `respiro à esquerda a ${janela}`).toBeGreaterThanOrEqual(40)
        expect(lateral.x + lateral.width - (dela.x + dela.width), `respiro à direita a ${janela}`).toBeGreaterThanOrEqual(40)
        expect(dela.y - lateral.y, `respiro em cima a ${janela}`).toBeGreaterThanOrEqual(40)
        expect(lateral.y + lateral.height - (dela.y + dela.height), `respiro embaixo a ${janela}`).toBeGreaterThanOrEqual(40)
        // Abaixo da marca: a caixa da onça começa onde a do `banner` termina, ou depois. Com 160 px não precisa de altura mínima:
        // a 1024 × 500 o topo dela fica uns 170 px abaixo do topo do painel, e a marca acaba em 108.
        expect(dela.y, `a onça começa abaixo da marca a ${janela}`).toBeGreaterThanOrEqual(marca.y + marca.height)
        expect(await larguraExcedente(page), `rolagem de lado a ${janela}`).toBe(0)
      }
    })
  }

  test('o painel é o `papel` e a borda dele a `borda` nos dois temas, e o cartão é a `superficie`: o `laranja-claro` esconderia os pés da onça', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/entrar')
    const fundoDoPainel = () => painel(page).evaluate((elemento) => getComputedStyle(elemento).backgroundColor)
    const bordaDoPainel = () => painel(page).evaluate((elemento) => getComputedStyle(elemento).borderRightColor)
    const fundoDoCartao = () => cartao(page).evaluate((elemento) => getComputedStyle(elemento).backgroundColor)

    expect(await fundoDoPainel()).toBe(await corDoToken(page, 'papel'))
    expect(await bordaDoPainel()).toBe(await corDoToken(page, 'borda'))
    expect(await fundoDoPainel()).not.toBe(await corDoToken(page, 'laranja-claro'))
    expect(await painel(page).evaluate((elemento) => getComputedStyle(elemento).borderRightWidth)).toBe('2px')
    expect(await fundoDoCartao()).toBe(await corDoToken(page, 'superficie'))
    const claro = await fundoDoPainel()

    await page.evaluate(() => document.documentElement.setAttribute('data-tema', 'escuro'))
    expect(await fundoDoPainel()).toBe(await corDoToken(page, 'papel'))
    expect(await bordaDoPainel()).toBe(await corDoToken(page, 'borda'))
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

    // A ordem: o e-mail vem antes da senha, e entre os dois não há parada de Tab nova (a senha é `Campo`, sem o "Mostrar").
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

  test('sem violação grave do axe, com a onça da marca, a 1366 e a 360 px', async ({ page }) => {
    for (const largura of [1366, 360]) {
      await page.setViewportSize({ width: largura, height: 800 })
      await page.goto('/entrar')
      await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible()
      // A onça chega depois, por `import()`: o axe lê a página com ela.
      await expect(largura >= 1024 ? oncaDoPainel(page) : oncaPequena(page)).toBeVisible()
      expect(await violacoesGraves(page), `axe a ${String(largura)} px`).toEqual([])
      // Um `banner` e um `main` só: dois deles dão a violação `landmark-no-duplicate-*` que o axe leria como grave.
      await expect(page.getByRole('banner')).toHaveCount(1)
      await expect(page.getByRole('main')).toHaveCount(1)
    }
  })
})
