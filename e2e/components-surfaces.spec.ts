import { AxeBuilder } from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support/profiles.ts'
import { openGallery, activate, caixa, conferirQueCabeNaJanela, desenho, gallerySection } from './support/gallery.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, isFocusVisible, FAILING_IMPACTS, horizontalOverflow, WCAG_TAGS, seriousViolations } from './support/checks.ts'

/**
 * As peças do MVP de apresentação (`docs/mvp-rapido.md` 9.3; `docs/interface.md` 11.1 e 11.3), na galeria (`/galeria`),
 * nos projetos `chromebook` e `celular`: o que a regra de cada peça promete, visto no navegador. A galeria não chama a
 * API e não tem sessão; o dado é inventado, escrito nela.
 *
 * Este arquivo é o grupo `superficies` do antigo `pecas.spec.ts` (tarefa 2.0 da X1): cada caso veio inteiro, com a mesma
 * asserção, e só mudou de arquivo. Os auxiliares comuns estão em `support/gallery.ts`.
 */

test.describe('peças do MVP de apresentação, na galeria', () => {
  test('a Tela não põe margem dentro da casca; fora dela, com `comMargem`, põe a da página', async ({ page }) => {
    await openGallery(page)
    // A galeria está fora da casca e pede a margem: 16 px no celular, 32 px a partir de 768 px, dos dois lados (a 9.3 do
    // `docs/interface.md`; era 24 px antes da X1).
    const tela = page.locator('[data-tela]').first()
    const esperada = (page.viewportSize()?.width ?? 0) >= 768 ? '32px' : '16px'
    expect(await tela.evaluate((elemento) => [getComputedStyle(elemento).paddingLeft, getComputedStyle(elemento).paddingRight])).toEqual([esperada, esperada])
  })

  // Este caso era um só, de 22 s no `celular` da esteira (execução 40880199949) e o do campo de várias linhas vinha junto; são quatro, que
  // abrem a galeria cada um e dividem o que ele afirmava, na mesma ordem e sem tirar asserção.
  test('a barra presa não cobre o último item, e os botões dela cabem na caixa com o alvo de toque', async ({ page }) => {
    await openGallery(page)

    // A barra presa: gruda no pé da caixa que rola, com a lista por trás, e no fim da rolagem o último item fica inteiro
    // acima dela.
    const rolagem = gallerySection(page, 'barra-presa').locator('[data-rolagem]')
    const barra = rolagem.getByRole('group', { name: 'Aprovação do lote' })
    await rolagem.scrollIntoViewIfNeeded()
    await expect(barra).toContainText('3 de 5 destaques abertos')
    await expect(barra.getByRole('button', { name: 'Aprovar 32 correções' })).toBeDisabled()
    const [daRolagem, daBarraNoTopo] = [await caixa(rolagem), await caixa(barra)]
    expect(await rolagem.evaluate((elemento) => elemento.scrollHeight > elemento.clientHeight)).toBe(true)
    // Com a lista no começo, a barra já está no pé da caixa, e não lá embaixo, depois do último item.
    expect(daBarraNoTopo.y + daBarraNoTopo.height).toBeLessThanOrEqual(daRolagem.y + daRolagem.height)
    expect(daBarraNoTopo.y + daBarraNoTopo.height).toBeGreaterThan(daRolagem.y + daRolagem.height - 4)
    await rolagem.evaluate((elemento) => elemento.scrollTo(0, elemento.scrollHeight))
    const ultimo = rolagem.locator('li').last()
    await expect.poll(async () => (await caixa(ultimo)).y + (await caixa(ultimo)).height).toBeLessThanOrEqual((await caixa(barra)).y + 0.5)
    // Pelo Tab, no meio da lista: o controle que recebe o foco para acima da barra, e não escondido atrás dela (WCAG
    // 2.4.11). A barra reservou a altura dela no bloco que rola.
    expect(await rolagem.evaluate((elemento) => elemento.style.scrollPaddingBottom)).toBe(`${String(Math.ceil((await caixa(barra)).height))}px`)
    await rolagem.evaluate((elemento) => elemento.scrollTo(0, 0))
    const abrir = rolagem.locator('li').getByRole('button', { name: 'Abrir' })
    await expect(abrir).toHaveCount(6)
    await abrir.first().focus()
    for (let indice = 0; indice < 6; indice++) {
      if (indice > 0) await page.keyboard.press('Tab')
      await expect(abrir.nth(indice)).toBeFocused()
      const [focado, daBarra, daCaixa] = [await caixa(abrir.nth(indice)), await caixa(barra), await caixa(rolagem)]
      expect(focado.y + focado.height, `item ${String(indice + 1)} atrás da barra`).toBeLessThanOrEqual(daBarra.y + 0.5)
      expect(focado.y, `item ${String(indice + 1)} acima da caixa`).toBeGreaterThanOrEqual(daCaixa.y - 0.5)
    }
    // O Tab seguinte chega à barra: ela é o fim da lista, na ordem do teclado também.
    await page.keyboard.press('Tab')
    await expect(barra.getByRole('button', { name: 'Rejeitar' })).toBeFocused()

    // A 360 px os dois botões da barra continuam com o alvo de toque e dentro da caixa.
    for (const botao of await barra.getByRole('button').all()) {
      const medida = await caixa(botao)
      expect(medida.height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect(medida.x + medida.width).toBeLessThanOrEqual(daRolagem.x + daRolagem.width)
    }

  })

  test('a tabela é de verdade a partir de 768 px e lista abaixo disso, e o menu de uma linha abre inteiro, por cima, sem ser cortado', async ({ page, hasTouch }) => {
    await openGallery(page)
    // A tabela: de verdade a partir de 768 px, com cabeçalho de coluna e de linha; lista abaixo disso, com o rótulo de
    // cada valor escrito. Uma estrutura só no documento.
    const tabela = gallerySection(page, 'tabela')
    const larga = (page.viewportSize()?.width ?? 0) >= 768
    if (larga) {
      const principal = tabela.locator('[data-tabela="tabela"]').first()
      await expect(tabela.getByRole('table', { name: 'O que a IA gerou e quem aprovou' })).toBeVisible()
      await expect(principal.getByRole('columnheader')).toHaveText(['O quê', 'Agente e função', 'Turma', 'Aprovação', 'Ações'])
      await expect(principal.getByRole('rowheader')).toHaveText(['Correção da lista 3', 'Versão com fonte ampliada', 'Atividade de estequiometria'])
      await expect(tabela.locator('[data-tabela="lista"]')).toHaveCount(0)
      // A tabela que cabe não é uma parada a mais no Tab; a que não cabe rola dentro dela mesma, e aí recebe foco e nome.
      expect(await principal.evaluate((elemento) => elemento.scrollWidth > elemento.clientWidth)).toBe(false)
      await expect(principal).not.toHaveAttribute('tabindex')
      await expect(principal).not.toHaveAttribute('role')
      const estreita = tabela.locator('[data-tabela-estreita] [data-tabela="tabela"]')
      expect(await estreita.evaluate((elemento) => elemento.scrollWidth > elemento.clientWidth)).toBe(true)
      await expect(estreita).toHaveAttribute('tabindex', '0')
      await expect(tabela.getByRole('region', { name: 'Tabela que não cabe' })).toHaveCount(1)
    } else {
      await expect(tabela.locator('table')).toHaveCount(0)
      const itens = tabela.getByRole('list', { name: 'O que a IA gerou e quem aprovou' }).locator('> li')
      await expect(itens).toHaveCount(3)
      await expect(itens.first().locator('dt')).toHaveText(['Agente e função', 'Turma', 'Aprovação', 'Ações'])
      await expect(itens.first()).toContainText('Correção da lista 3')
    }
    // Para a coordenação, a pendente diz por quem espera.
    await expect(tabela.locator('[data-aprovacao="pendente"]').first()).toHaveText('Esperando o professor')

    // O menu de uma linha, dentro do contêiner que rola ou corta: abre inteiro, por cima, sem ser cortado.
    const acoes = tabela.getByRole('button', { name: 'Ações de Correção da lista 3' })
    await activate(acoes, hasTouch)
    const menu = page.getByRole('menu', { name: 'Ações de Correção da lista 3' })
    await expect(menu).toBeVisible()
    await conferirQueCabeNaJanela(page, menu)
    // Perto dos quatro cantos do menu, o que está por cima é o próprio menu: nada dele ficou atrás da tabela. Os pontos
    // ficam 20 px para dentro, depois da curva do canto de 16 px, onde a caixa do menu ainda não é o menu.
    const cortado = await menu.evaluate((elemento) => {
      const caixaDoMenu = elemento.getBoundingClientRect()
      const pontos = [
        [caixaDoMenu.left + 20, caixaDoMenu.top + 20],
        [caixaDoMenu.right - 20, caixaDoMenu.top + 20],
        [caixaDoMenu.left + 20, caixaDoMenu.bottom - 20],
        [caixaDoMenu.right - 20, caixaDoMenu.bottom - 20],
      ] as const
      return pontos.filter(([x, y]) => !elemento.contains(document.elementFromPoint(x, y))).length
    })
    expect(cortado).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await page.keyboard.press('Escape')
    await expect(acoes).toBeFocused()

  })

  test('"preparando a resposta" é um texto anunciado com calma, sem nada animado, e a demora troca o texto, uma vez', async ({ page, hasTouch }) => {
    await openGallery(page)
    // "Preparando a resposta": um texto, anunciado com calma, sem nada animado; a demora troca o texto, uma vez.
    const conversa = gallerySection(page, 'conversa')
    const registro = conversa.getByRole('log', { name: 'Conversa com o Assistente de ensino' })
    await expect(registro).toHaveAttribute('aria-live', 'polite')
    await expect(registro).toHaveAttribute('aria-busy', 'false')
    const pensando = conversa.locator('[data-pensando]')
    await expect(pensando.locator('[aria-live="polite"]')).toHaveText('Preparando a resposta…')
    expect(await pensando.evaluate((elemento) => [elemento, ...elemento.querySelectorAll('*')].filter((no) => getComputedStyle(no).animationName !== 'none').length)).toBe(0)
    await activate(conversa.getByRole('button', { name: 'Simular a demora' }), hasTouch)
    await expect(pensando.locator('[aria-live="polite"]')).toHaveText('Ainda preparando a resposta. Você não precisa pedir de novo.')
    // Enquanto a resposta chega, a conversa está ocupada: o leitor de tela espera para ler o que entrou.
    await expect(registro).toHaveAttribute('aria-busy', 'true')
  })

  test('o campo de várias linhas tem rótulo, contador em texto e o limite no próprio campo, e a seleção obrigatória diz que é', async ({ page }) => {
    await openGallery(page)
    // O campo de várias linhas: rótulo, contador em texto e o limite no próprio campo.
    const observacao = gallerySection(page, 'selecao-e-menu').getByLabel('Observação')
    await observacao.fill('linha um\nlinha dois')
    await expect(gallerySection(page, 'selecao-e-menu').getByText('19 de 200')).toBeVisible()
    // O campo corta no limite pela mesma conta do contador: o espaço das pontas não gasta o limite, e nada trava antes.
    await observacao.fill(`  ${'x'.repeat(205)}`)
    await expect(observacao).toHaveValue(`  ${'x'.repeat(200)}`)
    await expect(gallerySection(page, 'selecao-e-menu').getByText('200 de 200')).toBeVisible()
    // Só cresce para baixo: arrastado para o lado, estouraria a largura da tela.
    expect(await observacao.evaluate((elemento) => getComputedStyle(elemento).resize)).toBe('vertical')
    // A seleção obrigatória diz que é, em texto e para o leitor de tela.
    await expect(gallerySection(page, 'selecao-e-menu').getByText('Turma (obrigatório)')).toBeVisible()
    await expect(gallerySection(page, 'selecao-e-menu').getByLabel('Turma')).toHaveAttribute('aria-required', 'true')
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// X1, tarefa 5.0: cartão, linha, tabela, número e barras na pele da D80 (RF7, RF9, RF11, RF23). O que cada peça promete sem
// medida (nome acessível, teclado, estado) está nos testes de componente (`ListItem.test.tsx`, `Table.test.tsx`,
// `Superficies.test.tsx`); aqui está o que só o navegador calcula: a cor resolvida, o contorno desenhado e a medida.
// ---------------------------------------------------------------------------------------------------------------------

const TEMAS = ['claro', 'escuro'] as const
type Tema = (typeof TEMAS)[number]

/** O `foco` de cada tema, como o navegador devolve (`docs/interface.md` 9.10). */
const FOCO: Record<Tema, string> = { claro: 'rgb(20, 110, 170)', escuro: 'rgb(96, 185, 244)' }

/** As seções que esta tarefa põe na pele nova, ou conserva na galeria. */
const SECOES = ['cartao-e-numero', 'barra-rotulada', 'linha', 'tabela', 'barra-presa'] as const

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

async function irParaOTema(page: Page, tema: Tema): Promise<void> {
  await openGallery(page)
  await page.evaluate((valor) => document.documentElement.setAttribute('data-tema', valor), tema)
}

/** O contorno do elemento, como o navegador o desenha. */
function anelDe(alvo: Locator): Promise<{ estilo: string; largura: string; cor: string; afastamento: string }> {
  return alvo.evaluate((elemento) => {
    const estilo = getComputedStyle(elemento)
    return { estilo: estilo.outlineStyle, largura: estilo.outlineWidth, cor: estilo.outlineColor, afastamento: estilo.outlineOffset }
  })
}

/** A sombra calculada: nenhuma sombra borrada, e nenhum degrau, em peça de leitura. */
const sombraDe = (alvo: Locator) => alvo.evaluate((elemento) => getComputedStyle(elemento).boxShadow)

/** A moldura da tabela no computador, ou o cartão de uma linha no celular. */
const moldura = (page: Page) => gallerySection(page, 'tabela').locator('[data-tabela="tabela"], [data-tabela="lista"] > li').first()

const linhasDaLista = (page: Page) => gallerySection(page, 'linha').locator('[data-linhas] > li')

for (const tema of TEMAS) {
  test.describe(`superfícies da D80, no tema ${tema}`, () => {
    test('cartão, número de painel, moldura da tabela e barra presa têm borda de 2 px em borda, canto de 16 e nenhuma sombra', async ({ page }) => {
      await irParaOTema(page, tema)
      const borda = await rgbDoToken(page, 'borda')
      const comTitulo = gallerySection(page, 'cartao-e-numero').getByRole('region', { name: 'Atividades da semana' })
      const semTitulo = gallerySection(page, 'cartao-e-numero').locator('div.rounded-cartao').filter({ hasText: 'Um cartão sem título é só a caixa.' }).first()
      const numero = gallerySection(page, 'cartao-e-numero').locator('[data-numeros] > div').first()
      for (const [nome, alvo] of [
        ['cartão com título', comTitulo],
        ['cartão sem título', semTitulo],
        ['número de painel', numero],
        ['moldura da tabela', moldura(page)],
      ] as const) {
        const medida = await desenho(alvo)
        expect(medida.borda, `${nome}: largura, estilo e cor`).toBe(`2px solid ${borda}`)
        expect(medida.canto, `${nome}: canto`).toBe('16px')
        expect(await sombraDe(alvo), `${nome}: sem sombra`).toBe('none')
      }
      // A barra presa: o fio de cima é de 2 px em `borda`, o fundo é cheio e o chão dela é o da página.
      const barra = gallerySection(page, 'barra-presa').getByRole('group', { name: 'Aprovação do lote' })
      const daBarra = await barra.evaluate((elemento) => {
        const estilo = getComputedStyle(elemento)
        return { fio: `${estilo.borderTopWidth} ${estilo.borderTopStyle} ${estilo.borderTopColor}`, fundo: estilo.backgroundColor }
      })
      expect(daBarra.fio).toBe(`2px solid ${borda}`)
      expect(daBarra.fundo).toBe(await rgbDoToken(page, 'fundo'))
    })

    test('o número é t-numero e o rótulo é t-selo, e o painel não muda de cor com o valor', async ({ page }) => {
      await irParaOTema(page, tema)
      const [sutil, tinta] = [await rgbDoToken(page, 'sutil'), await rgbDoToken(page, 'tinta')]
      const numeros = gallerySection(page, 'cartao-e-numero').locator('[data-numeros] > div')
      await expect(numeros).toHaveCount(3)
      for (const indice of [0, 1, 2]) {
        const painel = numeros.nth(indice)
        const rotulo = await desenho(painel.locator('p').first())
        expect(rotulo, `rótulo ${String(indice)}`).toMatchObject({ fonte: '13px', peso: '700', texto: sutil })
        expect(await painel.locator('p').first().evaluate((elemento) => getComputedStyle(elemento).textTransform)).toBe('uppercase')
        const valor = painel.locator('p').nth(1)
        expect(await desenho(valor), `valor ${String(indice)}`).toMatchObject({ fonte: '28px', peso: '700', texto: tinta })
        expect(await valor.evaluate((elemento) => getComputedStyle(elemento).fontVariantNumeric)).toContain('tabular-nums')
      }
    })

    test('a barra rotulada continua neutra, vazia, no meio e cheia: trilho ia-cx e enchimento sutil, com 12 px de altura', async ({ page }) => {
      await irParaOTema(page, tema)
      const [trilho, enchimento] = [await rgbDoToken(page, 'ia-cx'), await rgbDoToken(page, 'sutil')]
      const barras = gallerySection(page, 'barra-rotulada').locator('svg')
      await expect(barras).toHaveCount(4)
      const fills = await barras.locator('rect').evaluateAll((retangulos) => [...new Set(retangulos.map((retangulo) => getComputedStyle(retangulo).fill))])
      // Só os dois, em toda barra: nenhuma família (verde, vermelho, laranja) aparece, nem a cheia nem a vazia.
      expect(fills.sort()).toEqual([trilho, enchimento].sort())
      for (const barra of await barras.all()) {
        expect((await caixa(barra)).height).toBe(12)
        // O trilho e o enchimento são os dois retângulos, nessa ordem.
        const [dotrilho, doenchimento] = await barra.locator('rect').evaluateAll((retangulos) => retangulos.map((retangulo) => getComputedStyle(retangulo).fill))
        expect([dotrilho, doenchimento]).toEqual([trilho, enchimento])
      }
      // A cheia ("60 de 60") enche o trilho inteiro e a vazia ("0%") não tem enchimento, ainda assim neutras.
      const larguras = await barras.evaluateAll((svgs) => svgs.map((svg) => svg.querySelectorAll('rect')[1]?.getBoundingClientRect().width ?? -1))
      expect(larguras[3]).toBe(0)
      expect(larguras[2]).toBeGreaterThan(0)
    })

    test('a linha tem o anel de 3 px em foco por dentro, inteiro dentro da moldura, no link e no botão', async ({ page }) => {
      await irParaOTema(page, tema)
      const lista = gallerySection(page, 'linha').locator('[data-linhas]')
      const link = linhasDaLista(page).nth(0).getByRole('link')
      const botao = linhasDaLista(page).nth(1).getByRole('button')
      await page.keyboard.press('Tab')
      for (const [nome, alvo] of [
        ['link', link],
        ['botão', botao],
      ] as const) {
        await alvo.focus()
        expect(await isFocusVisible(page), `${nome}: o anel é sólido, de 3 px, na cor foco`).toBe(true)
        expect(await anelDe(alvo), nome).toEqual({ estilo: 'solid', largura: '3px', cor: FOCO[tema], afastamento: '-3px' })
        // Por dentro: a caixa que o foco desenha é a da linha, e a linha cabe dentro da borda de 2 px da moldura.
        const [daLinha, daMoldura] = [await caixa(alvo), await caixa(lista)]
        expect(daLinha.x, `${nome}: à esquerda`).toBeGreaterThanOrEqual(daMoldura.x + 2 - 0.5)
        expect(daLinha.x + daLinha.width, `${nome}: à direita`).toBeLessThanOrEqual(daMoldura.x + daMoldura.width - 2 + 0.5)
      }
    })

    test('a linha: a pele da linha sob o ponteiro e o chevron em apagado, e a seção não tem violação grave', async ({ page }) => {
      await irParaOTema(page, tema)
      const [suave, apagado, borda] = [await rgbDoToken(page, 'fundo-suave'), await rgbDoToken(page, 'apagado'), await rgbDoToken(page, 'borda')]
      const link = linhasDaLista(page).nth(0).getByRole('link')
      // Sem o ponteiro em cima, o fundo é o do cartão; em cima, o fundo suave.
      await page.mouse.move(0, 0)
      expect((await desenho(link)).fundo).not.toBe(suave)
      if (!(await page.evaluate(() => matchMedia('(hover: none)').matches))) {
        await link.hover()
        expect((await desenho(link)).fundo).toBe(suave)
      }
      const chevron = link.locator('svg[aria-hidden="true"]').last()
      expect((await desenho(chevron)).texto).toBe(apagado)
      // O fio entre uma linha e a de baixo é de 2 px em `borda` (o `divide-y-2` da moldura), e a última não leva.
      const fios = await linhasDaLista(page).evaluateAll((itens) =>
        itens.map((elemento) => {
          const estilo = getComputedStyle(elemento)
          return { largura: estilo.borderBottomWidth, estilo: estilo.borderBottomStyle, cor: estilo.borderBottomColor }
        }),
      )
      expect(fios.slice(0, 3)).toEqual([0, 1, 2].map(() => ({ largura: '2px', estilo: 'solid', cor: borda })))
      expect(fios[3]?.largura).toBe('0px')

      const analise = new AxeBuilder({ page }).withTags([...WCAG_TAGS])
      for (const nome of SECOES) analise.include(`[data-galeria="${nome}"]`)
      const { violations } = await analise.analyze()
      const graves = violations
        .filter((violacao) => (FAILING_IMPACTS as readonly string[]).includes(violacao.impact ?? ''))
        .map((violacao) => ({ regra: violacao.id, impacto: violacao.impact, alvos: violacao.nodes.map((no) => no.target.join(' ')) }))
      expect(graves).toEqual([])
    })
  })
}

test.describe('superfícies da D80: medida, teclado e toque', () => {
  test('a linha inteira é um alvo só: um focável por linha com ação, nenhum na de leitura, e o Tab pula a de leitura', async ({ page }) => {
    await openGallery(page)
    const linhas = linhasDaLista(page)
    await expect(linhas).toHaveCount(4)
    const focaveis = (indice: number) => linhas.nth(indice).locator('a[href], button, input, select, textarea, [tabindex]')
    await expect(focaveis(0)).toHaveCount(1)
    await expect(focaveis(1)).toHaveCount(1)
    await expect(focaveis(2)).toHaveCount(0)
    await expect(focaveis(3)).toHaveCount(1)
    // O título e o que a linha diz entram no nome do alvo.
    await expect(linhas.nth(0).getByRole('link', { name: /Lista de estequiometria.*2ºB · entregas até 24\/10.*Esperando você/ })).toBeVisible()

    const link = linhas.nth(0).getByRole('link')
    await page.keyboard.press('Tab')
    await link.focus()
    await page.keyboard.press('Tab')
    await expect(linhas.nth(1).getByRole('button')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(linhas.nth(3).getByRole('link')).toBeFocused()
  })

  test('o selo do fim fica à direita do texto no computador e embaixo dele no celular, e o título não é espremido', async ({ page }) => {
    await openGallery(page)
    const link = linhasDaLista(page).nth(0).getByRole('link')
    const titulo = link.locator('[title]')
    const selo = link.locator('[data-estado="pendente"]')
    const [medidaDoTitulo, medidaDoSelo, medidaDoLink] = [await caixa(titulo), await caixa(selo), await caixa(link)]
    if ((page.viewportSize()?.width ?? 0) >= 640) {
      expect(medidaDoSelo.x, 'à direita do título').toBeGreaterThanOrEqual(medidaDoTitulo.x + medidaDoTitulo.width)
    } else {
      expect(medidaDoSelo.y, 'embaixo do texto').toBeGreaterThanOrEqual(medidaDoTitulo.y + medidaDoTitulo.height)
      // O título tem a largura do texto da linha, e não o que sobrou ao lado do selo: cabe inteiro.
      expect(await titulo.evaluate((elemento) => elemento.scrollWidth > elemento.clientWidth)).toBe(false)
    }
    expect(medidaDoSelo.x + medidaDoSelo.width).toBeLessThanOrEqual(medidaDoLink.x + medidaDoLink.width)
  })

  test('o Enter e o Espaço acionam a linha que é botão; sem ação, a linha não responde', async ({ page, hasTouch }) => {
    await openGallery(page)
    const aberta = gallerySection(page, 'linha').locator('[data-linha-aberta]')
    await expect(aberta).toHaveText('Nenhuma linha aberta.')
    const botao = linhasDaLista(page).nth(1).getByRole('button')
    await botao.focus()
    await page.keyboard.press('Enter')
    await expect(aberta).toHaveText('Aberta: Resultado da lista 3')
    // O Espaço, sozinho: a página abre de novo (o estado volta ao começo), para o texto só poder vir dele.
    await openGallery(page)
    await expect(aberta).toHaveText('Nenhuma linha aberta.')
    await botao.focus()
    await page.keyboard.press('Space')
    await expect(aberta).toHaveText('Aberta: Resultado da lista 3')
    // A de leitura não é alvo: tocar nela não muda nada.
    await activate(linhasDaLista(page).nth(2), hasTouch)
    await expect(aberta).toHaveText('Aberta: Resultado da lista 3')
    await expect(linhasDaLista(page).nth(2).locator('svg')).toHaveCount(0)
  })

  test('alvo de toque: toda linha com ação tem 64 px no mínimo (44 ou mais no celular), e a de leitura mantém a altura', async ({ page, hasTouch }) => {
    await openGallery(page)
    const linhas = linhasDaLista(page)
    for (const indice of [0, 1, 2, 3]) {
      const medida = await caixa(linhas.nth(indice))
      expect(medida.height, `linha ${String(indice)}`).toBeGreaterThanOrEqual(64)
      if (hasTouch && indice !== 2) expect(medida.height, `linha ${String(indice)} no toque`).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    }
    // O alvo ocupa a largura da moldura: não é só o texto que se aperta.
    // O `<a>` com `flex` já ocupa a largura toda; o `<button>` só ocupa com `w-full`, e por isso o botão também se mede.
    const daLista = await caixa(gallerySection(page, 'linha').locator('[data-linhas]'))
    for (const alvo of [linhas.nth(0).getByRole('link'), linhas.nth(1).getByRole('button')]) {
      expect((await caixa(alvo)).width).toBeGreaterThanOrEqual(daLista.width - 4 - 0.5)
    }
  })

  test('o título comprido fica numa linha com reticências, guarda o texto inteiro e a página não rola de lado', async ({ page }) => {
    await openGallery(page)
    const titulo = linhasDaLista(page).nth(3).locator('[title]')
    const completo = await titulo.getAttribute('title')
    expect(completo).toContain('Relatório de laboratório sobre a titulação ácido-base')
    await expect(titulo).toHaveText(completo ?? '')
    expect(await titulo.evaluate((elemento) => ({ estouro: getComputedStyle(elemento).textOverflow, quebra: getComputedStyle(elemento).whiteSpace, corta: elemento.scrollWidth > elemento.clientWidth }))).toEqual({ estouro: 'ellipsis', quebra: 'nowrap', corta: true })
    // Uma linha só: a altura do título é a de uma linha de 22 px, e não a de três.
    expect((await caixa(titulo)).height).toBeLessThanOrEqual(26)
    expect(await horizontalOverflow(page)).toBe(0)
    // O título curto de uma linha sem nada no fim não corta: as reticências são do que não cabe.
    const curto = linhasDaLista(page).nth(1).locator('[title]')
    await expect(curto).toHaveText('Resultado da lista 3')
    expect(await curto.evaluate((elemento) => elemento.scrollWidth > elemento.clientWidth)).toBe(false)
  })

  test('a tabela na pele nova: cabeçalho de 44 px em caixa-alta de 13 px, linha de 64 px e fio de 2 px; no celular, o cartão da lista', async ({ page }) => {
    await openGallery(page)
    const larga = (page.viewportSize()?.width ?? 0) >= 768
    const tabela = gallerySection(page, 'tabela')
    if (larga) {
      const principal = tabela.locator('[data-tabela="tabela"]').first()
      const cabecalho = principal.locator('thead tr')
      expect((await caixa(cabecalho)).height).toBeGreaterThanOrEqual(44)
      expect((await caixa(cabecalho)).height).toBeLessThan(48)
      const primeiroTitulo = principal.getByRole('columnheader').first()
      expect(await primeiroTitulo.evaluate((elemento) => ({ fonte: getComputedStyle(elemento).fontSize, caixa: getComputedStyle(elemento).textTransform, peso: getComputedStyle(elemento).fontWeight }))).toEqual({ fonte: '13px', caixa: 'uppercase', peso: '700' })
      for (const linha of await principal.locator('tbody tr').all()) expect((await caixa(linha)).height).toBeGreaterThanOrEqual(64)
      // O fio entre as linhas é de 2 px, e a última não leva.
      const larguras = await principal.locator('tbody tr').evaluateAll((linhas) => linhas.map((linha) => getComputedStyle(linha).borderBottomWidth))
      expect(larguras).toEqual(['2px', '2px', '0px'])
    } else {
      const item = tabela.locator('[data-tabela="lista"] > li').first()
      expect(await item.locator('dt').first().evaluate((elemento) => ({ fonte: getComputedStyle(elemento).fontSize, caixa: getComputedStyle(elemento).textTransform }))).toEqual({ fonte: '13px', caixa: 'uppercase' })
      // O título do item é o da primeira coluna, em 17 px e 700, sem caixa-alta. O nome da coluna vai antes, só para o leitor
      // de tela, e o `innerText` o devolve (é o que `professor-turma` tira com a expressão `^Aluno:`).
      const titulo = item.locator('> div').first()
      expect(await titulo.evaluate((elemento) => ({ fonte: getComputedStyle(elemento).fontSize, peso: getComputedStyle(elemento).fontWeight, caixa: getComputedStyle(elemento).textTransform }))).toEqual({ fonte: '17px', peso: '700', caixa: 'none' })
      expect(await titulo.innerText()).toMatch(/^O quê:\s*Correção da lista 3$/)
    }
  })

  test('a tabela que não cabe rola dentro dela: a região ganha foco e nome só com sobra, o anel aparece, e a página não rola de lado', async ({ page }) => {
    await openGallery(page)
    const tabela = gallerySection(page, 'tabela')
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      const estreita = tabela.locator('[data-tabela-estreita] [data-tabela="tabela"]')
      expect(await estreita.evaluate((elemento) => ({ passa: elemento.scrollWidth > elemento.clientWidth, rola: getComputedStyle(elemento).overflowX }))).toEqual({ passa: true, rola: 'auto' })
      await expect(estreita).toHaveAttribute('role', 'region')
      await expect(estreita).toHaveAttribute('aria-label', 'Tabela que não cabe')
      await page.keyboard.press('Tab')
      await estreita.focus()
      expect(await isFocusVisible(page)).toBe(true)
      // A que cabe não é parada do Tab.
      await expect(tabela.locator('[data-tabela="tabela"]').first()).not.toHaveAttribute('tabindex')
    } else {
      // No celular não há o que rolar: a lista quebra o que não cabe, e a região sem sobra nem existe.
      await expect(tabela.locator('[data-tabela="tabela"]')).toHaveCount(0)
      await expect(tabela.getByRole('region')).toHaveCount(0)
    }
    // Nenhuma das duas faz a página rolar de lado.
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('a barra presa com o degrau: os botões cabem inteiros dentro dela, com a sombra e a margem de 4 px', async ({ page }) => {
    await openGallery(page)
    const rolagem = gallerySection(page, 'barra-presa').locator('[data-rolagem]')
    const barra = rolagem.getByRole('group', { name: 'Aprovação do lote' })
    await rolagem.scrollIntoViewIfNeeded()
    const daBarra = await caixa(barra)
    const rejeitar = barra.getByRole('button', { name: 'Rejeitar' })
    const aprovar = barra.getByRole('button', { name: 'Aprovar 32 correções' })
    for (const botao of [rejeitar, aprovar]) {
      const medida = await caixa(botao)
      expect(medida.y, 'não sobe acima da barra').toBeGreaterThanOrEqual(daBarra.y)
      // A margem do degrau fica dentro da barra: o botão mais os 4 px de baixo cabem nela.
      expect(medida.y + medida.height + 4, 'o degrau cabe').toBeLessThanOrEqual(daBarra.y + daBarra.height + 0.5)
    }
    // O ligado tem o degrau de 4 px, sólido e sem desfoque; o desligado perde a sombra e guarda a margem.
    expect(await rejeitar.evaluate((elemento) => getComputedStyle(elemento).boxShadow)).toMatch(/ 0px 4px 0px 0px$/)
    expect(await aprovar.evaluate((elemento) => getComputedStyle(elemento).boxShadow)).toBe('none')
    expect(await aprovar.evaluate((elemento) => getComputedStyle(elemento).marginBottom)).toBe('4px')
  })
})
