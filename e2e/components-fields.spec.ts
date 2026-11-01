import { AxeBuilder } from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support/profiles.ts'
import { abrirGaleria, caixa, desenho, secao } from './support/gallery.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, focoVisivel, IMPACTOS_QUE_REPROVAM, TAGS_WCAG } from './support/checks.ts'

/**
 * Os campos da D80 na galeria (`/galeria`), nos projetos `chromebook` e `celular` e nos dois temas (X1, tarefa 4.0; RF2,
 * RF7, RF9 e RF11): a borda de 2 px que se vê, o anel de foco colado à borda, o alvo de toque, o erro com ícone e as três
 * peças novas (`SearchInput`, `Switch` e `OptionCard`). O que cada peça promete sem medida (nome acessível, teclado, estado) está
 * no teste de componente de cada uma; aqui está o que só o navegador calcula: a cor resolvida, o contorno desenhado e a
 * medida. A galeria não chama a API e não tem sessão; o dado é inventado, escrito em `gallery/sections/fields.tsx`.
 *
 * Os campos de `entrar`, `mfa`, `turma-publica` e `estrutura` (RF21) continuam sendo achados por `getByLabel`, sem edição
 * nos specs deles: a prova é eles passarem.
 */

const TEMAS = ['claro', 'escuro'] as const
type Tema = (typeof TEMAS)[number]

/** O `foco` de cada tema, como o navegador devolve (`docs/interface.md` 9.10). */
const FOCO: Record<Tema, string> = { claro: 'rgb(20, 110, 170)', escuro: 'rgb(96, 185, 244)' }

/** As seções de campo da galeria. A de seleção e menu é anterior à 4.0 e continua com os casos dela. */
const SECOES = ['campos', 'busca', 'interruptor', 'opcao'] as const

/** O valor de um token no tema da página, como `rgb()`: lido por uma sonda com `color: var(--color-<token>)`. */
function rgbDoToken(page: Page, token: string): Promise<string> {
  return page.evaluate((nome) => {
    const sonda = document.createElement('span')
    sonda.style.color = `var(--color-${nome})`
    document.body.append(sonda)
    const cor = getComputedStyle(sonda).color
    sonda.remove()
    return cor
  }, token)
}

/** Vários tokens de uma vez, pelo nome. */
async function rgbDosTokens<Nome extends string>(page: Page, nomes: readonly Nome[]): Promise<Record<Nome, string>> {
  const cores = await Promise.all(nomes.map((nome) => rgbDoToken(page, nome)))
  return Object.fromEntries(nomes.map((nome, indice) => [nome, cores[indice] ?? ''])) as Record<Nome, string>
}

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

async function irParaOTema(page: Page, tema: Tema): Promise<void> {
  await abrirGaleria(page)
  await page.evaluate((valor) => document.documentElement.setAttribute('data-tema', valor), tema)
}

/** O contorno do elemento, como o navegador o desenha, e a borda dele. */
function anelDe(alvo: Locator): Promise<{ estilo: string; largura: string; cor: string; afastamento: string; bordaLargura: string; bordaCor: string }> {
  return alvo.evaluate((elemento) => {
    const estilo = getComputedStyle(elemento)
    return {
      estilo: estilo.outlineStyle,
      largura: estilo.outlineWidth,
      cor: estilo.outlineColor,
      afastamento: estilo.outlineOffset,
      bordaLargura: estilo.borderTopWidth,
      bordaCor: estilo.borderTopColor,
    }
  })
}

/** Os campos de uma linha, o longo, a seleção e a busca, um por estado: o que a regra da caixa vale para. */
const campos = (page: Page) => ({
  vazio: secao(page, 'campos').locator('[data-estado="vazio"] input'),
  preenchido: secao(page, 'campos').locator('[data-estado="preenchido"] input'),
  erro: secao(page, 'campos').locator('[data-estado="erro"] input'),
  desligado: secao(page, 'campos').locator('[data-estado="desligado"] input'),
  senha: secao(page, 'campos').locator('[data-estado="senha"] input'),
  longo: secao(page, 'campos').locator('[data-estado="longo-erro"] textarea'),
  longoDesligado: secao(page, 'campos').locator('[data-estado="longo-desligado"] textarea'),
  selecao: secao(page, 'campos').locator('[data-estado="selecao-erro"] select'),
  selecaoDesligada: secao(page, 'campos').locator('[data-estado="selecao-desligada"] select'),
  busca: secao(page, 'busca').locator('[data-estado="vazia"] input'),
  // Os que não estão inválidos nem desligados, da seção de seleção e menu: a borda é a de campo.
  selecaoLivre: secao(page, 'selecao-e-menu').getByLabel('Turma'),
  longoLivre: secao(page, 'selecao-e-menu').getByLabel('Observação'),
})

const trilho = (page: Page, estado: string) => secao(page, 'interruptor').locator(`[data-estado="${estado}"] [role="switch"]`)
const opcao = (page: Page, grupo: string, nome: string) => secao(page, 'opcao').locator(`[data-grupo="${grupo}"]`).getByRole(grupo === 'radio' ? 'radio' : 'checkbox', { name: nome, exact: true })
const rotuloDaOpcao = (alvo: Locator) => alvo.locator('xpath=ancestor::label')

for (const tema of TEMAS) {
  test.describe(`campos, no tema ${tema}`, () => {
    test('a borda é de 2 px e passa de 3:1 contra o chão e contra o campo: o campo, o longo, a seleção, a busca, o trilho desligado e a caixa da opção', async ({ page }) => {
      await irParaOTema(page, tema)
      const { fundo, campo, 'borda-campo': bordaDeCampo } = await rgbDosTokens(page, ['fundo', 'campo', 'borda-campo'])
      const alvos = campos(page)
      const medidos: [string, Locator][] = [
        ['campo vazio', alvos.vazio],
        ['campo preenchido', alvos.preenchido],
        ['campo de senha', alvos.senha],
        ['campo longo', alvos.longoLivre],
        ['seleção', alvos.selecaoLivre],
        ['busca', alvos.busca],
      ]
      for (const [nome, alvo] of medidos) {
        const medida = await desenho(alvo)
        expect(medida.borda, `${nome}: largura, estilo e cor`).toBe(`2px solid ${bordaDeCampo}`)
        expect(contraste(bordaDeCampo, fundo), `${nome}: borda contra o chão`).toBeGreaterThanOrEqual(3)
        expect(contraste(bordaDeCampo, campo), `${nome}: borda contra o campo`).toBeGreaterThanOrEqual(3)
        expect(medida.fundo, `${nome}: o fundo é o do campo`).toBe(campo)
      }

      // O interruptor desligado: a borda `borda-campo` é a única pista do trilho, e vem de 3:1 contra o chão.
      const faceDoTrilho = trilho(page, 'desligado').locator('span').first()
      expect((await desenho(faceDoTrilho)).borda).toBe(`2px solid ${bordaDeCampo}`)
      // A caixa da opção desmarcada: o círculo vazio tem a mesma borda, contra o chão e contra o fundo dele.
      const circulo = rotuloDaOpcao(opcao(page, 'radio', 'Na tela')).locator(':scope > span').last()
      expect((await desenho(circulo)).borda).toBe(`2px solid ${bordaDeCampo}`)
      expect((await desenho(circulo)).fundo).toBe(campo)
    })

    test('em foco o contorno é de 3 px em foco, colado à borda, e a borda continua: o campo, o longo, a seleção e a busca', async ({ page }) => {
      await irParaOTema(page, tema)
      const alvos = campos(page)
      const bordaDeCampo = await rgbDoToken(page, 'borda-campo')
      await page.keyboard.press('Tab')
      for (const [nome, alvo] of [
        ['campo', alvos.vazio],
        ['campo de senha', alvos.senha],
        ['campo longo', alvos.longoLivre],
        ['seleção', alvos.selecaoLivre],
        ['busca', alvos.busca],
      ] as const) {
        await alvo.focus()
        expect(await focoVisivel(page), `${nome}: o anel é sólido, de 3 px, na cor foco`).toBe(true)
        expect(await anelDe(alvo), nome).toMatchObject({ estilo: 'solid', largura: '3px', cor: FOCO[tema], afastamento: '0px', bordaLargura: '2px', bordaCor: bordaDeCampo })
      }
    })

    test('inválido, a borda e o texto do erro são vermelho-texto, e o erro tem ícone ao lado do texto', async ({ page }) => {
      await irParaOTema(page, tema)
      const { 'vermelho-texto': vermelho, fundo } = await rgbDosTokens(page, ['vermelho-texto', 'fundo'])
      const alvos = campos(page)
      for (const [nome, alvo] of [
        ['campo', alvos.erro],
        ['longo', alvos.longo],
        ['seleção', alvos.selecao],
      ] as const) {
        expect((await desenho(alvo)).borda, `${nome}: borda`).toBe(`2px solid ${vermelho}`)
        expect(contraste(vermelho, fundo), `${nome}: borda contra o chão`).toBeGreaterThanOrEqual(3)
        // A mensagem que o campo descreve: texto vermelho com o ícone dentro, à esquerda, e não só a cor da borda.
        const mensagem = alvo.locator('xpath=ancestor::div[@data-estado]').locator('p', { has: page.locator('svg') })
        await expect(mensagem, nome).toBeVisible()
        expect((await desenho(mensagem)).texto, `${nome}: texto do erro`).toBe(vermelho)
        expect(contraste(vermelho, fundo), `${nome}: texto do erro contra o chão`).toBeGreaterThanOrEqual(4.5)
        const icone = mensagem.locator('svg')
        await expect(icone, `${nome}: ícone`).toBeVisible()
        const [medidaDoIcone, medidaDoTexto] = [await caixa(icone), await caixa(mensagem.locator('span'))]
        expect(medidaDoIcone.x + medidaDoIcone.width, `${nome}: o ícone fica antes do texto`).toBeLessThanOrEqual(medidaDoTexto.x)
      }
      // O campo que não está inválido não ganha a borda vermelha.
      expect((await desenho(alvos.preenchido)).borda).not.toContain(vermelho)
    })

    test('desligado, o campo é fundo-suave com texto apoio, e a borda dele continua a de campo', async ({ page }) => {
      await irParaOTema(page, tema)
      const { 'fundo-suave': suave, apoio, 'borda-campo': bordaDeCampo } = await rgbDosTokens(page, ['fundo-suave', 'apoio', 'borda-campo'])
      const alvos = campos(page)
      for (const [nome, alvo] of [
        ['campo', alvos.desligado],
        ['longo', alvos.longoDesligado],
        ['seleção', alvos.selecaoDesligada],
      ] as const) {
        await expect(alvo, nome).toBeDisabled()
        expect(await desenho(alvo), nome).toMatchObject({ fundo: suave, texto: apoio, borda: `2px solid ${bordaDeCampo}` })
        expect(contraste(apoio, suave), `${nome}: texto desligado`).toBeGreaterThanOrEqual(4.5)
      }
    })

    test('o interruptor e a opção: o foco do interruptor é o anel de 3 px afastado 2 px, e o da opção é do rótulo inteiro, com a borda', async ({ page }) => {
      await irParaOTema(page, tema)
      await page.keyboard.press('Tab')
      const liga = trilho(page, 'desligado')
      await liga.focus()
      expect(await focoVisivel(page)).toBe(true)
      expect(await anelDe(liga)).toMatchObject({ estilo: 'solid', largura: '3px', cor: FOCO[tema], afastamento: '2px' })

      const tela = opcao(page, 'radio', 'Na tela')
      await tela.focus()
      // O elemento ativo é o `<input>` escondido: o anel que se vê é o do rótulo, por `focus-within`.
      expect(await focoVisivel(page)).toBe(true)
      const rotulo = rotuloDaOpcao(tela)
      expect(await anelDe(rotulo)).toMatchObject({ estilo: 'solid', largura: '3px', cor: FOCO[tema], afastamento: '2px', bordaLargura: '2px' })
      // A opção que não tem o foco não desenha o anel: o contorno dela é `none` (a largura calculada é a padrão, de 3 px).
      expect((await anelDe(rotuloDaOpcao(opcao(page, 'radio', 'Em papel')))).estilo).toBe('none')
    })

    test('o trilho ligado é azul e a opção marcada é azul-claro com borda e texto da família, e a desmarcada não é', async ({ page }) => {
      await irParaOTema(page, tema)
      const cor = await rgbDosTokens(page, ['azul', 'azul-degrau', 'azul-claro', 'azul-borda', 'azul-texto', 'fundo'])
      const ligado = trilho(page, 'ligado').locator('span').first()
      expect(await desenho(ligado)).toMatchObject({ fundo: cor['azul'], borda: `2px solid ${cor['azul-degrau']}` })
      expect(contraste(cor['azul-degrau'], cor['fundo']), 'trilho ligado contra o chão').toBeGreaterThanOrEqual(3)

      const marcada = rotuloDaOpcao(opcao(page, 'radio', 'Em papel'))
      expect(await desenho(marcada)).toMatchObject({ fundo: cor['azul-claro'], texto: cor['azul-texto'], borda: `2px solid ${cor['azul-borda']}` })
      expect(contraste(cor['azul-texto'], cor['azul-claro']), 'texto da opção marcada').toBeGreaterThanOrEqual(4.5)
      // Marcada leva o visto no círculo da direita; a desmarcada, o círculo vazio.
      const vazia = rotuloDaOpcao(opcao(page, 'radio', 'Na tela'))
      await expect(marcada.locator(':scope > span').last().locator('svg')).toHaveCount(1)
      await expect(vazia.locator(':scope > span').last().locator('svg')).toHaveCount(0)
      expect((await desenho(vazia)).fundo).not.toBe(cor['azul-claro'])
    })

    test('a seção não tem violação grave de acessibilidade', async ({ page }) => {
      await irParaOTema(page, tema)
      const analise = new AxeBuilder({ page }).withTags([...TAGS_WCAG])
      for (const nome of SECOES) analise.include(`[data-galeria="${nome}"]`)
      const { violations } = await analise.analyze()
      const graves = violations
        .filter((violacao) => (IMPACTOS_QUE_REPROVAM as readonly string[]).includes(violacao.impact ?? ''))
        .map((violacao) => ({ regra: violacao.id, impacto: violacao.impact, alvos: violacao.nodes.map((no) => no.target.join(' ')) }))
      expect(graves).toEqual([])
    })
  })
}

test.describe('campos: medida e toque', () => {
  test('o alvo: campo, busca, interruptor e opção têm 44 px de altura no celular; o campo tem 48 e a opção 64 em qualquer tela', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const alvos = campos(page)
    const altura = async (alvo: Locator) => (await caixa(alvo.first())).height
    expect(await altura(alvos.vazio)).toBeGreaterThanOrEqual(48)
    expect(await altura(alvos.senha)).toBeGreaterThanOrEqual(48)
    expect(await altura(alvos.selecao)).toBeGreaterThanOrEqual(48)
    expect(await altura(alvos.longo)).toBeGreaterThanOrEqual(96)
    expect(await altura(alvos.busca)).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    for (const estado of ['desligado', 'ligado']) {
      const medida = await caixa(trilho(page, estado))
      expect(medida.width, `interruptor ${estado}`).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      // A área de toque sobe a 44 px abaixo de 768; no computador é o próprio trilho, de 32 (acima do piso de 24).
      expect(medida.height, `interruptor ${estado}`).toBeGreaterThanOrEqual(hasTouch ? ALVO_DE_TOQUE_PRINCIPAL_PX : 32)
    }
    for (const [grupo, nome] of [
      ['radio', 'Em papel'],
      ['checkbox', 'A turma'],
    ] as const)
      expect((await caixa(rotuloDaOpcao(opcao(page, grupo, nome)))).height, `opção ${nome}`).toBeGreaterThanOrEqual(64)
  })

  test('o trilho desenhado mede 52 por 32 px, e a bolinha de 24 px troca de lado quando liga', async ({ page }) => {
    await abrirGaleria(page)
    const botao = trilho(page, 'desligado')
    const face = botao.locator('span').first()
    expect(await caixa(face)).toMatchObject({ width: 52, height: 32 })
    const bolinha = face.locator('span')
    expect(await caixa(bolinha)).toMatchObject({ width: 24, height: 24 })
    const antes = await caixa(bolinha)
    const trilhoAntes = await caixa(face)
    // Desligado, a bolinha encosta à esquerda (2 px de borda mais 2 de folga); ligado, à direita.
    expect(antes.x - trilhoAntes.x).toBeLessThan(trilhoAntes.width / 2 - antes.width / 2)
    await botao.click()
    await expect(botao).toHaveAttribute('aria-checked', 'true')
    const depois = await caixa(bolinha)
    expect(depois.x).toBeGreaterThan(antes.x + 16)
    expect(depois.x + depois.width - (await caixa(face)).x).toBeGreaterThan(trilhoAntes.width / 2)
  })

  test('a busca: o rótulo não aparece escrito, a lupa não cobre o texto, e o valor digitado fica', async ({ page }) => {
    await abrirGaleria(page)
    const busca = campos(page).busca
    const rotulo = secao(page, 'busca').locator('[data-estado="vazia"] label')
    expect(await caixa(rotulo)).toMatchObject({ width: 1, height: 1 })
    // O texto começa depois da lupa (20 px a 12 px da borda): o enchimento da esquerda passa de 32 px.
    expect(Number.parseFloat(await busca.evaluate((elemento) => getComputedStyle(elemento).paddingLeft))).toBeGreaterThanOrEqual(36)
    expect(await busca.evaluate((elemento) => getComputedStyle(elemento).fontSize)).toBe('16px')
    await busca.fill('estequiometria')
    await expect(busca).toHaveValue('estequiometria')
  })

  test('o grupo de rádio é uma parada de Tab e as setas trocam a marcada; a caixa de marcar liga pelo Espaço', async ({ page }) => {
    await abrirGaleria(page)
    const papel = opcao(page, 'radio', 'Em papel')
    const tela = opcao(page, 'radio', 'Na tela')
    await page.keyboard.press('Tab')
    await papel.focus()
    await expect(papel).toBeChecked()
    await page.keyboard.press('ArrowDown')
    await expect(tela).toBeFocused()
    await expect(tela).toBeChecked()
    await expect(papel).not.toBeChecked()
    // A desligada do grupo não entra no percurso das setas.
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(opcao(page, 'radio', 'Por apresentação oral')).not.toBeChecked()
    await expect(opcao(page, 'radio', 'Em papel')).toBeChecked()

    const turma = opcao(page, 'checkbox', 'O prazo')
    await expect(turma).not.toBeChecked()
    await turma.focus()
    await page.keyboard.press('Space')
    await expect(turma).toBeChecked()
    await page.keyboard.press('Space')
    await expect(turma).not.toBeChecked()
  })
})
