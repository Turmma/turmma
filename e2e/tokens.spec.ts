import type { Locator, Page, Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { botaoDoSeletor, gaveta, lateral, naGaveta, esperarNovaConversa, secoes } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { criarEquipeComSenha, criarUsuarioEmOutraEscola } from './support/seed.ts'
import { larguraExcedente, violacoesGraves } from './support/checks.ts'

/**
 * A pele nos componentes compartilhados (tarefa 1.0 da A0; os tokens são os da D80 desde a 1.0 da X1): os dois blocos
 * de cor da 9.10 do `docs/interface.md`, o claro e o escuro, chegam ao navegador, o botão primário é o laranja com
 * texto escuro e o degrau, o foco é o anel de 3 px em `foco` (3.0 da X1), e a marca vem em curvas.
 *
 * O teste de unidade `apps/web/src/estilos.test.ts` confere o fonte. Este confere o que o navegador recebe e desenha:
 * com a paleta zerada, um token que não chegou ao CSS servido faz a classe sair sem regra nenhuma, caladamente.
 */

/** O Chromebook com CPU ×4 e rede Fast 3G carrega a página e ainda faz o hash da senha no servidor. */
const PRAZO_DA_ENTRADA_MS = 20_000

/** Os hex da 9.9 que os componentes desta tarefa pintam, como o navegador os devolve no estilo calculado. */
const RGB = {
  laranja: 'rgb(232, 115, 46)',
  carameloClaro: 'rgb(238, 135, 71)',
  sobreCor: 'rgb(13, 13, 13)',
  tinta: 'rgb(13, 13, 13)',
  borda: 'rgb(229, 229, 229)',
  apoio: 'rgb(66, 66, 66)',
  foco: 'rgb(20, 110, 170)',
} as const

/** O anel de foco de cada tema (`foco` da 9.10), como o navegador devolve: o claro e o escuro. */
const FOCO_POR_TEMA = { claro: 'rgb(20, 110, 170)', escuro: 'rgb(96, 185, 244)' } as const

type Tema = 'claro' | 'escuro'
type Paleta = Map<string, string>

/** Quantas cores cada bloco da 9.10 declara, `white` e `black` incluídas: o mesmo número do teste de unidade. */
const CORES_POR_BLOCO = 98

const DECLARACAO_DE_COR = /--color-([a-z]+(?:-[a-z0-9]+)*)\s*:\s*([^;}]+)/g

/** `#fff` e `#FFFFFF` são o mesmo hex, e `#0009` e `#00000099` também: o minificador encurta o que pode. */
function hexCompleto(valor: string): string {
  const hex = valor.trim().toLowerCase()
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{4})$/.test(hex) ? `#${[...hex.slice(1)].map((digito) => digito + digito).join('')}` : hex
}

function coresDe(css: string): Paleta {
  return new Map([...css.matchAll(DECLARACAO_DE_COR)].map(([, nome, valor]) => [nome ?? '', hexCompleto(valor ?? '')]))
}

/**
 * Os tokens de cor dos dois blocos `css` da 9.10, com o valor de cada um: o documento é a fonte, não uma cópia aqui. O
 * claro é o bloco do `@theme static`, e o escuro, o de `:root[data-tema='escuro']`.
 */
function tokensDoDocumento(): Record<Tema, Paleta> {
  const documento = readFileSync(new URL('../docs/interface.md', import.meta.url), 'utf8')
  const inicio = documento.indexOf('### 9.10')
  const proxima = documento.indexOf('\n## ', inicio)
  const secao = documento.slice(inicio, proxima === -1 ? undefined : proxima)
  const blocos = [...secao.matchAll(/```css\n([\s\S]*?)```/g)].map(([, bloco]) => bloco ?? '')
  const claro = blocos.find((bloco) => bloco.includes('@theme static')) ?? ''
  const escuro = blocos.find((bloco) => bloco.includes("data-tema='escuro'")) ?? ''
  return { claro: coresDe(claro), escuro: coresDe(escuro) }
}

/** O CSS de todas as folhas que a página carrega, junto. */
async function cssServido(page: Page): Promise<string> {
  const folhas = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href))
  expect(folhas.length).toBeGreaterThan(0)
  return (await Promise.all(folhas.map(async (folha) => (await page.request.get(folha)).text()))).join('\n')
}

/**
 * As declarações `--color-*` que o navegador recebe, separadas pelo tema: as do bloco `[data-tema=escuro]` (o
 * minificador tira as aspas e o `:root`) e as de fora dele. Juntas num mapa só, a última venceria e o claro sumiria.
 */
async function coresServidas(page: Page): Promise<Record<Tema, Paleta>> {
  const css = await cssServido(page)
  const abertura = css.search(/\[data-tema=["']?escuro["']?\]\s*\{/)
  expect(abertura, 'o CSS servido não tem o bloco do escuro').toBeGreaterThan(-1)
  const fim = css.indexOf('}', abertura)
  return { claro: coresDe(css.slice(0, abertura) + css.slice(fim)), escuro: coresDe(css.slice(abertura, fim)) }
}

/** Luminância relativa da WCAG 2.1 de uma cor `rgb(r, g, b)` do estilo calculado. */
function luminancia(rgb: string): number {
  const canais = (rgb.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).map((canal) => {
    const c = Number(canal) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const [r = 0, g = 0, b = 0] = canais
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(a: string, b: string): number {
  const [clara, escura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return ((clara ?? 0) + 0.05) / ((escura ?? 0) + 0.05)
}

async function corDe(alvo: Locator): Promise<{ fundo: string; texto: string }> {
  return alvo.evaluate((elemento) => {
    const estilo = getComputedStyle(elemento)
    return { fundo: estilo.backgroundColor, texto: estilo.color }
  })
}

/** O anel de foco como o navegador desenha, no elemento que tem o foco agora. */
function anelDoFoco(page: Page): Promise<{ visivel: boolean; estilo: string; largura: string; cor: string; afastamento: string }> {
  return page.evaluate(() => {
    const elemento = document.activeElement
    if (elemento === null) return { visivel: false, estilo: '', largura: '', cor: '', afastamento: '' }
    const estilo = getComputedStyle(elemento)
    return { visivel: elemento.matches(':focus-visible'), estilo: estilo.outlineStyle, largura: estilo.outlineWidth, cor: estilo.outlineColor, afastamento: estilo.outlineOffset }
  })
}

/**
 * Caminha pelo teclado até o alvo e confere o anel dele: 3 px sólido na cor `foco` do tema, com 2 px de afastamento (9.1
 * e 10.1). O campo passa o afastamento 0 (colado na borda, 10.1) e o item da barra de baixo, −3 px (por dentro).
 */
async function tabAteOAnel(page: Page, alvo: Locator, descricao: string, maximoDeTeclas = 30, cor: string = RGB.foco, afastamento = '2px'): Promise<void> {
  for (let tecla = 0; tecla < maximoDeTeclas; tecla++) {
    await page.keyboard.press('Tab')
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) {
      expect(await anelDoFoco(page), `anel de foco em ${descricao}`).toEqual({ visivel: true, estilo: 'solid', largura: '3px', cor, afastamento })
      return
    }
  }
  throw new Error(`${descricao} não foi alcançado pelo teclado em ${String(maximoDeTeclas)} teclas`)
}

/** Uma porta que segura a resposta até o teste abrir. */
function portao(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

test.describe('pele da D72 nos componentes compartilhados', () => {
  test('E5: o CSS servido tem cada token de cor da 9.10, com o hex do documento, no claro e no escuro', async ({ page }) => {
    await page.goto('/sistema')
    const tokens = tokensDoDocumento()
    const servidas = await coresServidas(page)
    for (const tema of ['claro', 'escuro'] as const) {
      // `white` e `black` incluídas; outro número é o bloco do documento lido pela metade, e o teste passaria vazio.
      expect(tokens[tema].size, `bloco ${tema} da 9.10`).toBe(CORES_POR_BLOCO)
      const divergentes = [...tokens[tema]]
        .filter(([nome, hex]) => servidas[tema].get(nome) !== hex)
        .map(([nome, hex]) => `${tema} · ${nome}: a 9.10 diz ${hex}, o CSS servido tem ${servidas[tema].get(nome) ?? 'nada'}`)
      expect(divergentes).toEqual([])
    }
  })

  test('o escuro liga pelo atributo do html: o chão e o texto da página trocam, e voltam', async ({ page }) => {
    // O bloco do escuro fica fora de camada para vencer o do Tailwind. Se perdesse, as variáveis chegariam ao navegador
    // (o caso acima passaria) e a tela continuaria clara: aqui se mede o que o navegador desenha.
    await page.goto('/sistema')
    const chaoETexto = () => page.evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.documentElement).color])
    expect(await chaoETexto()).toEqual(['rgb(255, 255, 255)', RGB.tinta])
    await page.evaluate(() => document.documentElement.setAttribute('data-tema', 'escuro'))
    expect(await chaoETexto()).toEqual(['rgb(19, 31, 36)', 'rgb(241, 247, 251)'])
    expect(await violacoesGraves(page)).toEqual([])
    await page.evaluate(() => document.documentElement.setAttribute('data-tema', 'claro'))
    expect(await chaoETexto()).toEqual(['rgb(255, 255, 255)', RGB.tinta])
  })

  test('botão primário: laranja com texto sobre-cor e degrau, sem violação do axe, e o desligado em borda com texto apoio', async ({ page, hasTouch }) => {
    const segurada = portao()
    await page.route('**/v1/sessao/email', async (rota) => {
      await segurada.aberta
      await rota.abort()
    })
    await page.goto('/entrar')
    const entrar = page.getByRole('button', { name: 'Entrar' })
    await expect(entrar).toBeVisible()

    const ligado = await corDe(entrar)
    expect(ligado).toEqual({ fundo: RGB.laranja, texto: RGB.sobreCor })
    // 6,4:1 na 9.1: passa o AA de texto (4,5:1), e o axe confere o mesmo na página inteira.
    expect(contraste(ligado.fundo, ligado.texto)).toBeGreaterThanOrEqual(4.5)
    expect(await violacoesGraves(page)).toEqual([])

    // O degrau: sombra sólida de 4 px na cor do degrau da família (`laranja-degrau`, #ba5c25), sem desfoque, e a margem
    // de baixo do mesmo tamanho, que reserva o lugar para apertar não mexer em nada em volta (9.3).
    expect(await entrar.evaluate((elemento) => [getComputedStyle(elemento).boxShadow, getComputedStyle(elemento).marginBottom])).toEqual(['rgb(186, 92, 37) 0px 4px 0px 0px', '4px'])
    // Só o `transform` anima, em 100 ms: a cor do hover e a sombra trocam na hora (9.5, item 1).
    expect(await entrar.evaluate((elemento) => [getComputedStyle(elemento).transitionProperty, getComputedStyle(elemento).transitionDuration])).toEqual(['transform', '0.1s'])

    // O hover existe só onde há ponteiro; no toque o pressionado é o que dá o sinal, e ele não depende de hover.
    if (!hasTouch) {
      await entrar.hover()
      // A troca é seca porque só o `transform` anima: quem prova é a `transitionProperty` acima, e aqui o `poll` só
      // espera a cor do hover chegar.
      await expect.poll(async () => (await corDe(entrar)).fundo).toBe(RGB.carameloClaro)
    }

    await page.getByLabel('E-mail').fill('professora-sintetica@educa.invalid')
    await page.getByLabel('Senha').fill('senha-sintetica-do-botao')
    await (hasTouch ? entrar.tap() : entrar.click())
    const entrando = page.getByRole('button', { name: 'Entrando…' })
    await expect(entrando).toBeDisabled()
    // O ponteiro continua em cima do botão, como fica com quem acabou de clicar: o hover não pinta o desligado.
    const desligado = await corDe(entrando)
    // Desligado é outro desenho, e não o laranja apagado: a face `borda` com o texto `apoio` (`sutil` não chega a 4,5:1
    // no escuro), distinguível do ligado, legível, e sem degrau, mas com a margem que guarda a altura.
    expect(desligado).toEqual({ fundo: RGB.borda, texto: RGB.apoio })
    expect(contraste(desligado.fundo, desligado.texto)).toBeGreaterThanOrEqual(4.5)
    expect(await entrando.evaluate((elemento) => [getComputedStyle(elemento).boxShadow, getComputedStyle(elemento).marginBottom])).toEqual(['none', '4px'])
    segurada.abrir()
  })

  test('foco de 3 px em foco com 2 px de afastamento nos componentes, no claro', async ({ page }) => {
    const emA = await criarEquipeComSenha()
    await criarUsuarioEmOutraEscola(emA.contaId)
    await page.goto('/entrar')

    // A entrada: os dois campos e o botão primário, pelo teclado.
    // Os dois campos são a peça `Campo` desde a 14.0: o anel é colado na borda, com afastamento 0 (10.1).
    await tabAteOAnel(page, page.getByLabel('E-mail'), 'campo de e-mail', 30, RGB.foco, '0px')
    await page.keyboard.type(emA.email)
    await tabAteOAnel(page, page.getByLabel('Senha'), 'campo de senha', 30, RGB.foco, '0px')
    await page.keyboard.type(emA.senha)
    await tabAteOAnel(page, page.getByRole('button', { name: 'Entrar' }), 'botão Entrar')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('heading', { name: 'Escolher a escola' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await page.getByRole('button', { name: `${emA.escolaNome} · professor` }).focus()
    await page.keyboard.press('Enter')
    await esperarNovaConversa(page, emA.nome)

    // A casca: a marca em curvas, o seletor de escola, a navegação e o "Sair". No celular a lateral é a gaveta, e ela
    // abre pelo teclado também.
    if (naGaveta(page)) {
      await tabAteOAnel(page, page.getByRole('button', { name: 'Abrir o menu' }), 'botão do menu')
      await page.keyboard.press('Enter')
    }
    const casca = lateral(page)
    const pinta = casca.locator('img[src="/marca/turmma-pinta.svg"]')
    await expect(casca.getByText('Turmma', { exact: true })).toBeVisible()
    await expect(pinta).toHaveJSProperty('complete', true)
    expect(await pinta.evaluate((imagem) => (imagem as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    expect(await larguraExcedente(page)).toBe(0)
    await tabAteOAnel(page, botaoDoSeletor(page), 'seletor de escola')
    const itemTurmas = secoes(page).getByRole('link', { name: 'Turmas' })
    if (naGaveta(page)) {
      await tabAteOAnel(page, casca.getByRole('button', { name: 'Sair' }), 'botão Sair')
      // No celular o item é da barra de baixo, que fica fora da gaveta: modal aberta, ela está inerte (A5; 13.0). O Esc
      // fecha a gaveta e devolve o foco ao botão do menu, e dali o Tab percorre o `<main>` até o item. A barra encosta no
      // pé e nas laterais da janela, e por isso o anel dela é por dentro (−3 px), como o da linha de lista (10.1).
      await page.keyboard.press('Escape')
      await expect(gaveta(page)).toBeHidden()
      await expect(page.getByRole('button', { name: 'Abrir o menu' })).toBeFocused()
      await tabAteOAnel(page, itemTurmas, 'item Turmas da barra de baixo', 80, RGB.foco, '-3px')
    } else {
      await tabAteOAnel(page, itemTurmas, 'item Turmas da navegação')
      await tabAteOAnel(page, casca.getByRole('button', { name: 'Sair' }), 'botão Sair')
    }

    // O link de texto é `caramelo-texto` sublinhado: laranja como texto só nesse tom (5,1:1), nunca o `caramelo`
    // (3,0:1). Até a 11.0 ele era o "Meus vínculos" do cabeçalho; na casca da A1 a navegação é de itens, e o link de
    // texto que sobra é o "página inicial" da página não encontrada.
    await page.goto('/endereco-que-nao-existe')
    const link = page.getByRole('link', { name: 'página inicial' })
    await tabAteOAnel(page, link, 'link página inicial')
    expect(await link.evaluate((elemento) => [getComputedStyle(elemento).color, getComputedStyle(elemento).textDecorationLine])).toEqual(['rgb(180, 82, 15)', 'underline'])
  })

  test('foco de 3 px nos componentes, no escuro: o anel é o foco do tema', async ({ page }) => {
    await page.goto('/entrar')
    await page.evaluate(() => document.documentElement.setAttribute('data-tema', 'escuro'))
    await tabAteOAnel(page, page.getByLabel('E-mail'), 'campo de e-mail', 30, FOCO_POR_TEMA.escuro, '0px')
    await page.keyboard.type('professora-sintetica@educa.invalid')
    await tabAteOAnel(page, page.getByLabel('Senha'), 'campo de senha', 30, FOCO_POR_TEMA.escuro, '0px')
    await page.keyboard.type('senha-sintetica-do-foco')
    await tabAteOAnel(page, page.getByRole('button', { name: 'Entrar' }), 'botão Entrar', 30, FOCO_POR_TEMA.escuro)
  })

  /**
   * As faces `bg-noite` que ainda existem, com as classes que o código usa: o cabeçalho da operação, a dica da lateral, o
   * avatar do Assistente e o grupo da `Aparencia` na faixa. Dentro de cada uma há um controle em foco, e o anel precisa ter 3:1 contra a face nos dois
   * temas. No escuro a `noite` é clara (`#f1f7fb`), e o `foco` sozinho dá 1,99:1 sobre ela: ali o anel é o texto da face.
   * É a regra `.bg-noite :focus-visible` que a 1.0 deixou para a 3.0 (achado da 1ª rodada, `frontend-reviewer`).
   *
   * A última é a `Aparencia` da barra de topo da operação: o grupo de três opções tem chão próprio (`bg-fundo`, com a
   * borda de 2 px) dentro da faixa `noite`, e o anel é desenhado sobre ele, e não sobre a face: ali o `foco` volta
   * (`.bg-noite .bg-fundo :focus-visible`), e o contraste é contra o chão do grupo.
   */
  const FACES_NOITE: readonly { nome: string; classe: string; chaoProprio: boolean }[] = [
    { nome: 'cabeçalho da operação', classe: 'bg-noite text-sobre-grafite', chaoProprio: false },
    { nome: 'dica da lateral', classe: 'rounded-linha bg-noite px-2 py-1 text-sm text-sobre-grafite', chaoProprio: false },
    { nome: 'avatar do Assistente', classe: 'inline-flex size-6 items-center justify-center rounded-full bg-noite text-sobre-grafite', chaoProprio: false },
    { nome: 'grupo da Aparência na faixa', classe: 'bg-noite text-sobre-grafite', chaoProprio: true },
  ]

  for (const tema of ['claro', 'escuro'] as const) {
    test(`o anel de foco tem 3:1 contra cada face noite que ainda existe, no ${tema}`, async ({ page }) => {
      await page.goto('/entrar')
      await page.evaluate((valor) => document.documentElement.setAttribute('data-tema', valor), tema)
      for (const { nome, classe, chaoProprio } of FACES_NOITE) {
        await page.evaluate(
          ([rotulo, classes, comChao]) => {
            const controle = `<button type="button">Controle sobre ${rotulo}</button>`
            const miolo = comChao === 'sim' ? `<div data-chao class="flex gap-1 rounded-controle border-2 border-borda bg-fundo p-1">${controle}</div>` : controle
            document.body.insertAdjacentHTML('beforeend', `<div data-face="${rotulo}" class="${classes}">${miolo}</div>`)
          },
          [nome, classe, chaoProprio ? 'sim' : 'nao'],
        )
        await page.keyboard.press('Tab')
        await page.getByRole('button', { name: `Controle sobre ${nome}` }).focus()
        const anel = await anelDoFoco(page)
        const chao = await page
          .locator(chaoProprio ? `[data-face="${nome}"] [data-chao]` : `[data-face="${nome}"]`)
          .evaluate((elemento) => getComputedStyle(elemento).backgroundColor)
        expect(anel, nome).toMatchObject({ visivel: true, estilo: 'solid', largura: '3px', afastamento: '2px' })
        expect(contraste(anel.cor, chao), `${nome} no ${tema}: ${anel.cor} sobre ${chao}`).toBeGreaterThanOrEqual(3)
        // O anel é o `foco`, no claro e sobre chão próprio; só no escuro, sobre a face clara, é o texto da face.
        if (tema === 'claro' || chaoProprio) expect(anel.cor, nome).toBe(FOCO_POR_TEMA[tema])
        else expect(anel.cor, nome).toBe('rgb(19, 31, 36)')
      }
    })
  }

  test('só transform e opacity têm transição no CSS servido, e nada gira sem fim (RF8)', async ({ page }) => {
    await page.goto('/sistema')
    const css = await cssServido(page)
    const propriedades = [...css.matchAll(/transition(?:-property)?\s*:\s*([^;}]+)[;}]/g)].flatMap(([, valor = '']) => valor.split(',').map((parte) => parte.trim().split(/\s+/)[0] ?? ''))
    // Sem a âncora o caso passaria vazio no dia em que o minificador mudasse a forma da declaração.
    expect(propriedades).toContain('transform')
    expect(propriedades.filter((propriedade) => !['transform', 'opacity'].includes(propriedade))).toEqual([])
    expect(css).not.toContain('infinite')
    // A regra global de movimento reduzido está no CSS servido.
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/)
  })

  test('a marca vem dos SVGs em curvas, sem nenhuma requisição de fonte', async ({ page }) => {
    const fontes: string[] = []
    page.on('request', (pedido: Request) => {
      if (pedido.resourceType() === 'font' || /\.(?:woff2?|ttf|otf)(?:[?#]|$)/i.test(pedido.url())) fontes.push(pedido.url())
    })
    // O segundo fator aberto sem desafio: a casca pública inteira, sem depender da API.
    await page.goto('/mfa')
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible()

    const marca = page.getByRole('banner')
    await expect(marca.getByText('Turmma')).toBeVisible()
    const pinta = marca.locator('img[src="/marca/turmma-pinta.svg"]')
    await expect(pinta).toBeVisible()
    // Decorativa: o nome ao lado já diz o que ela é, e o leitor de tela não ouve "Turmma" duas vezes.
    await expect(pinta).toHaveAttribute('alt', '')
    await expect(pinta).toHaveJSProperty('complete', true)
    expect(await pinta.evaluate((imagem) => (imagem as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // O ícone do aplicativo é o `turmma-icone.svg` do manual (9.6), servido pelo próprio app.
    const icone = await page.locator('link[rel="icon"]').getAttribute('href')
    expect(icone).toBe('/marca/turmma-icone.svg')
    const resposta = await page.request.get(icone ?? '')
    expect(resposta.status()).toBe(200)
    expect(resposta.headers()['content-type']).toContain('image/svg+xml')

    await page.waitForLoadState('networkidle')
    expect(fontes).toEqual([])
  })
})
