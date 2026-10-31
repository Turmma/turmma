import { AxeBuilder } from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support/profiles.ts'
import { abrirGaleria, acionar, caixa, desenho, secao } from './support/gallery.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, focoVisivel, IMPACTOS_QUE_REPROVAM, larguraExcedente, TAGS_WCAG } from './support/checks.ts'

/**
 * O estado dito sem depender da cor, na galeria (`/galeria`), nos projetos `chromebook` e `celular` e nos dois temas
 * (X1, tarefa 6.0; RF9 e RF11): o selo, a faixa, o aviso, o contador, o toque, as abas e os três estados de tela. O que
 * cada peça promete sem medida (papel, `aria-*`, teclado) está nos testes de componente (`Abas.test.tsx`,
 * `Aviso.test.tsx`, `Contador.test.tsx`, `Toque.test.tsx` e `states/estados.test.tsx`); aqui está o que só o navegador
 * calcula: a cor resolvida, o contraste real e a medida.
 *
 * Os casos de regra que tocam estas peças continuam nos arquivos de origem, sem edição: "Tentar de novo" em 18 specs,
 * `[data-estado]` em `governanca` e `pedido-do-titular`, a linha de aprovação igual ao selo (`pecas-ia`), a faixa que não
 * fecha (`aluno-tutor`) e o caso das abas de `pecas-sobrepor`.
 */

const TEMAS = ['claro', 'escuro'] as const
type Tema = (typeof TEMAS)[number]

/** As famílias de cor da D80, na ordem do `docs/interface.md` 9.1. */
const FAMILIAS = ['laranja', 'azul', 'verde', 'amarelo', 'vermelho', 'roxo', 'turquesa', 'anil', 'lima', 'rosa'] as const

/** O que cada selo de estado pinta: o fundo e o texto, com os nomes de hoje (`docs/interface.md` 9.1, "Os nomes de antes"). */
const SELOS = [
  { familia: 'pendente', fundo: 'pendente-cx', texto: 'pendente' },
  { familia: 'ok', fundo: 'ok-cx', texto: 'ok' },
  { familia: 'erro', fundo: 'erro-cx', texto: 'erro' },
  { familia: 'info', fundo: 'info-cx', texto: 'info' },
] as const

/** Cada tom do aviso e a família dele. */
const TONS = [
  { tom: 'info', familia: 'azul' },
  { tom: 'atencao', familia: 'amarelo' },
  { tom: 'erro', familia: 'vermelho' },
  { tom: 'certo', familia: 'verde' },
] as const

/** As seções que esta tarefa põe na pele nova, ou conserva na galeria. */
const SECOES = ['estado', 'aviso', 'contador', 'toque', 'estados-de-tela', 'abas'] as const

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

/** O estilo calculado de uma propriedade, ou mais. */
function estiloDe(alvo: Locator, ...propriedades: string[]): Promise<string[]> {
  return alvo.evaluate((elemento, nomes) => nomes.map((nome) => getComputedStyle(elemento).getPropertyValue(nome)), propriedades)
}

const selo = (page: Page, familia: string) => secao(page, 'estado').locator(`[data-estado="${familia}"]`)
const aviso = (page: Page, tom: string) => secao(page, 'aviso').locator(`[data-aviso="${tom}"]`)
const toques = (page: Page) => secao(page, 'toque').locator('[data-toques] button')
const desligados = (page: Page) => secao(page, 'toque').locator('[data-toques-desligados] button')
const estados = (page: Page) => secao(page, 'estados-de-tela').locator('[data-estados]')

for (const tema of TEMAS) {
  test.describe(`estado sem depender da cor, no tema ${tema}`, () => {
    test('o selo: fundo e texto da família, 24 px, canto de 8, t-selo em caixa-alta, o glifo de 16 px e 4,5:1', async ({ page }) => {
      await irParaOTema(page, tema)
      for (const { familia, fundo, texto } of SELOS) {
        const { [fundo]: rgbDoFundo, [texto]: rgbDoTexto } = await rgbDosTokens(page, [fundo, texto])
        const alvo = selo(page, familia)
        await expect(alvo, familia).toHaveCount(1)
        const medida = await desenho(alvo)
        expect(medida, familia).toMatchObject({ fundo: rgbDoFundo, texto: rgbDoTexto, canto: '8px', fonte: '13px', peso: '700' })
        expect(await estiloDe(alvo, 'text-transform', 'border-top-width'), familia).toEqual(['uppercase', '0px'])
        expect((await caixa(alvo)).height, `${familia}: 24 px`).toBe(24)
        expect(contraste(rgbDoTexto, rgbDoFundo), `${familia}: contraste`).toBeGreaterThanOrEqual(4.5)
        // O estado está no texto e no glifo: um `svg` de 16 px, que repete a família sem a cor.
        const glifo = alvo.locator('svg')
        await expect(glifo, familia).toHaveCount(1)
        expect(await caixa(glifo), familia).toMatchObject({ width: 16, height: 16 })
        expect(((await alvo.textContent()) ?? '').trim().length, `${familia}: texto`).toBeGreaterThan(0)
      }
      // As quatro formas são diferentes: quem não distingue as cores distingue o glifo.
      const formas = await Promise.all(SELOS.map(({ familia }) => selo(page, familia).locator('svg').evaluate((svg) => svg.innerHTML)))
      expect(new Set(formas).size).toBe(SELOS.length)
    })

    test('a faixa é o aviso permanente: família info, borda de 2 px, sem botão nem link, role note', async ({ page }) => {
      await irParaOTema(page, tema)
      const { 'info-cx': fundo, info: texto, borda } = await rgbDosTokens(page, ['info-cx', 'info', 'borda'])
      const faixa = secao(page, 'estado').getByRole('note')
      await expect(faixa).toHaveCount(1)
      expect(await desenho(faixa)).toMatchObject({ fundo, texto, borda: `2px solid ${borda}`, canto: '12px' })
      expect(contraste(texto, fundo)).toBeGreaterThanOrEqual(4.5)
      await expect(faixa.locator('button, a, [tabindex]')).toHaveCount(0)
      await expect(faixa.locator('svg')).toHaveCount(1)
    })

    test('o aviso: borda e fundo da família, glifo num círculo de 28 px, e o corpo em tinta com 4,5:1 em cada tom', async ({ page }) => {
      await irParaOTema(page, tema)
      const cores = await rgbDosTokens(page, ['tinta', 'fundo', 'azul-borda', 'azul-claro', 'azul-texto', 'amarelo-borda', 'amarelo-claro', 'amarelo-texto', 'vermelho-borda', 'vermelho-claro', 'vermelho-texto', 'verde-borda', 'verde-claro', 'verde-texto'])
      for (const { tom, familia } of TONS) {
        // A galeria tem dois de informação: o com título e o que é só o corpo, que vem depois.
        await expect(aviso(page, tom), tom).toHaveCount(tom === 'info' ? 2 : 1)
        const alvo = aviso(page, tom).first()
        const fundo = cores[`${familia}-claro` as keyof typeof cores]
        const borda = cores[`${familia}-borda` as keyof typeof cores]
        const glifo = cores[`${familia}-texto` as keyof typeof cores]
        expect(await desenho(alvo), tom).toMatchObject({ fundo, borda: `2px solid ${borda}`, canto: '12px' })
        // Sem degrau nem sombra.
        expect((await estiloDe(alvo, 'box-shadow'))[0], `${tom}: sem sombra`).toBe('none')
        // O corpo e o título são `tinta`; o par é o de cada fundo claro da tabela de pares.
        const corpo = alvo.locator('div.font-medium').first()
        expect((await desenho(corpo)).texto, `${tom}: corpo`).toBe(cores.tinta)
        expect(contraste(cores.tinta, fundo), `${tom}: corpo contra o fundo`).toBeGreaterThanOrEqual(4.5)
        // O glifo: texto da família sobre o círculo `fundo`, com 3:1 (é gráfico, e não texto).
        const circulo = alvo.locator(':scope > span[aria-hidden="true"]')
        expect(await desenho(circulo), `${tom}: círculo`).toMatchObject({ fundo: cores.fundo, texto: glifo })
        expect(await caixa(circulo), `${tom}: círculo`).toMatchObject({ width: 28, height: 28 })
        expect(contraste(glifo, cores.fundo), `${tom}: glifo contra o círculo`).toBeGreaterThanOrEqual(3)
      }
      // O erro é o único com região viva, e só o texto dele; os outros três não têm papel vivo.
      await expect(secao(page, 'aviso').getByRole('alert')).toHaveCount(1)
      await expect(aviso(page, 'erro').getByRole('alert')).toHaveCount(1)
      await expect(secao(page, 'aviso').getByRole('status')).toHaveCount(0)
      await expect(aviso(page, 'erro').getByRole('alert').getByRole('button')).toHaveCount(0)
      await expect(aviso(page, 'erro').getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
    })

    test('o contador: a face de cada família, o texto em sobre-cor com 4,5:1, 24 px e algarismos tabulares; zero não desenha', async ({ page }) => {
      await irParaOTema(page, tema)
      const { 'sobre-cor': sobreCor, ...faces } = await rgbDosTokens(page, ['sobre-cor', ...FAMILIAS])
      const pilulas = secao(page, 'contador').locator('[data-contadores] [data-contador]')
      await expect(pilulas).toHaveCount(FAMILIAS.length)
      for (const [indice, familia] of FAMILIAS.entries()) {
        const pilula = pilulas.nth(indice)
        const medida = await desenho(pilula)
        expect(medida, familia).toMatchObject({ fundo: faces[familia], texto: sobreCor, peso: '700' })
        // A pílula é redonda: o raio é o de `rounded-full`, muito maior que a metade da altura.
        expect(Number.parseFloat(medida.canto), `${familia}: redonda`).toBeGreaterThanOrEqual(12)
        expect(contraste(sobreCor, faces[familia]), `${familia}: contraste`).toBeGreaterThanOrEqual(4.5)
        expect((await caixa(pilula)).height, `${familia}: 24 px`).toBe(24)
        expect((await estiloDe(pilula, 'font-variant-numeric'))[0], `${familia}: tabular`).toContain('tabular-nums')
        // O que ele conta é texto, e o texto não se vê: o número é o que está à mostra, e o resto é só para o leitor de tela.
        expect(((await pilula.textContent()) ?? '').trim(), familia).toBe(`${String(indice + 1)} pedidos de nome`)
        const escondido = pilula.locator('.sr-only')
        await expect(escondido, familia).toHaveCount(1)
        expect(await caixa(escondido), `${familia}: o texto do que conta`).toMatchObject({ width: 1, height: 1 })
      }
      await expect(secao(page, 'contador').locator('[data-contador-zero] [data-contador]')).toHaveCount(0)
      // Não pisca: nenhuma pílula tem animação.
      expect(await pilulas.evaluateAll((itens) => itens.map((item) => getComputedStyle(item).animationName))).toEqual(FAMILIAS.map(() => 'none'))
    })

    test('o toque: livre em borda e fundo, escolhido em azul com o visto, e desligado em face borda com texto apoio', async ({ page }) => {
      await irParaOTema(page, tema)
      const c = await rgbDosTokens(page, ['borda', 'fundo', 'apoio', 'azul-borda', 'azul-claro', 'azul-texto', 'fundo-suave'])
      const todas = toques(page).nth(0)
      const esperando = toques(page).nth(1)
      // "Todas" abre escolhida: a face, a borda e o texto são os da família azul, com 4,5:1.
      await expect(todas).toHaveAttribute('aria-pressed', 'true')
      expect(await desenho(todas)).toMatchObject({ fundo: c['azul-claro'], texto: c['azul-texto'], borda: `2px solid ${c['azul-borda']}`, peso: '700', fonte: '15px' })
      expect(contraste(c['azul-texto'], c['azul-claro'])).toBeGreaterThanOrEqual(4.5)
      // O escolhido leva o visto, e a escolha não é só cor.
      await expect(todas.locator('svg')).toHaveCount(1)
      expect(await todas.locator('svg').evaluate((svg) => svg.classList.contains('lucide-check'))).toBe(true)

      await expect(esperando).toHaveAttribute('aria-pressed', 'false')
      expect(await desenho(esperando)).toMatchObject({ fundo: c.fundo, texto: c.apoio, borda: `2px solid ${c.borda}` })
      expect(contraste(c.apoio, c.fundo)).toBeGreaterThanOrEqual(4.5)
      expect(await esperando.locator('svg').evaluate((svg) => svg.classList.contains('lucide-clock'))).toBe(true)
      // Livre ou escolhido, o degrau é sombra sólida de 3 px.
      expect((await estiloDe(esperando, 'box-shadow'))[0]).toBe(`${c.borda} 0px 3px 0px 0px`)
      expect((await estiloDe(todas, 'box-shadow'))[0]).toContain('0px 3px 0px 0px')

      for (const desligado of await desligados(page).all()) {
        await expect(desligado).toBeDisabled()
        expect(await desenho(desligado)).toMatchObject({ fundo: c.borda, texto: c.apoio })
        expect((await estiloDe(desligado, 'box-shadow'))[0]).toBe('none')
      }
      expect(contraste(c.apoio, c.borda)).toBeGreaterThanOrEqual(4.5)
    })

    test('as abas: a ativa em azul-texto com o sublinhado de 3 px em azul, e as outras em sutil, com 4,5:1 nas duas', async ({ page }) => {
      await irParaOTema(page, tema)
      const c = await rgbDosTokens(page, ['azul-texto', 'azul', 'sutil', 'fundo', 'borda'])
      const lista = secao(page, 'abas').getByRole('tablist', { name: 'Seções da turma' })
      const [ativa, outra] = [lista.getByRole('tab', { selected: true }), lista.getByRole('tab', { selected: false }).first()]
      expect((await desenho(ativa)).texto).toBe(c['azul-texto'])
      expect((await desenho(outra)).texto).toBe(c.sutil)
      // O par calculado é o par desenhado: o primeiro fundo pintado acima da lista é o `fundo` da página, e não a `superficie`.
      const fundoAtrasDaLista = await lista.evaluate((no) => {
        for (let atual: Element | null = no; atual !== null; atual = atual.parentElement) {
          const cor = getComputedStyle(atual).backgroundColor
          if (cor !== 'rgba(0, 0, 0, 0)' && cor !== 'transparent') return cor
        }
        return 'sem fundo pintado'
      })
      expect(fundoAtrasDaLista).toBe(c.fundo)
      expect(contraste(c['azul-texto'], c.fundo)).toBeGreaterThanOrEqual(4.5)
      expect(contraste(c.sutil, c.fundo)).toBeGreaterThanOrEqual(4.5)
      // O sublinhado é desenho, e só a ativa o tem; o fio da lista é de 2 px em `borda`.
      const sublinhado = ativa.locator('span[aria-hidden="true"]')
      await expect(sublinhado).toHaveCount(1)
      expect((await desenho(sublinhado)).fundo).toBe(c.azul)
      expect((await caixa(sublinhado)).height).toBe(3)
      await expect(outra.locator('span[aria-hidden="true"]')).toHaveCount(0)
      expect((await desenho(lista)).borda.startsWith('0px')).toBe(true)
      expect((await estiloDe(lista, 'border-bottom-width', 'border-bottom-color'))).toEqual(['2px', c.borda])
      // O número da aba é o contador: face laranja, texto em sobre-cor, e o que ele conta escrito para a leitura de tela.
      const alunos = lista.getByRole('tab', { name: /Alunos/ })
      await expect(alunos.locator('[data-contador]')).toHaveCount(1)
      await expect(alunos).toContainText('2 pedidos de nome')
    })

    test('carregando, vazio e erro: caixa de 2 px, o carregando parado, o vazio tracejado em borda-campo e o erro em erro', async ({ page }) => {
      await irParaOTema(page, tema)
      const c = await rgbDosTokens(page, ['borda', 'borda-campo', 'erro', 'erro-cx', 'apoio', 'superficie', 'tinta'])
      const carregando = estados(page).getByRole('status').filter({ hasText: 'Carregando as atividades da turma…' })
      await expect(carregando).toHaveCount(1)
      expect(await desenho(carregando)).toMatchObject({ borda: `2px solid ${c.borda}`, fundo: c.superficie, texto: c.apoio, canto: '16px' })

      const vazio = estados(page).locator('div', { has: page.getByText('Nenhuma atividade ainda', { exact: true }) }).last()
      expect(await desenho(vazio)).toMatchObject({ borda: `2px dashed ${c['borda-campo']}`, canto: '16px' })
      expect((await desenho(vazio.getByText('Nenhuma atividade ainda', { exact: true }))).texto).toBe(c.tinta)
      expect((await desenho(vazio.getByText('Nenhuma atividade ainda', { exact: true }))).fonte).toBe('20px')

      const erro = estados(page).locator('div', { has: page.getByRole('alert') }).last()
      expect(await desenho(erro)).toMatchObject({ borda: `2px solid ${c.erro}`, fundo: c['erro-cx'], canto: '16px' })
      expect((await desenho(erro.getByRole('alert'))).texto).toBe(c.erro)
      expect(contraste(c.erro, c['erro-cx'])).toBeGreaterThanOrEqual(4.5)

      // Nada nos três se mexe sozinho.
      const animacoes = await estados(page).locator('*').evaluateAll((nos) => nos.map((no) => getComputedStyle(no).animationName))
      expect([...new Set(animacoes)]).toEqual(['none'])
    })

    test('as seções não têm violação grave de acessibilidade, e nenhuma passa da largura da janela', async ({ page }) => {
      await irParaOTema(page, tema)
      const analise = new AxeBuilder({ page }).withTags([...TAGS_WCAG])
      for (const nome of SECOES) analise.include(`[data-galeria="${nome}"]`)
      const { violations } = await analise.analyze()
      const graves = violations
        .filter((violacao) => (IMPACTOS_QUE_REPROVAM as readonly string[]).includes(violacao.impact ?? ''))
        .map((violacao) => ({ regra: violacao.id, impacto: violacao.impact, alvos: violacao.nodes.map((no) => no.target.join(' ')) }))
      expect(graves).toEqual([])
      expect(await larguraExcedente(page)).toBe(0)
    })
  })
}

test.describe('estado sem depender da cor: medida, teclado e toque', () => {
  test('alvo de toque: a aba e o toque têm 44 px de altura abaixo de 768, e 44 e 40 a partir daí', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const abas = secao(page, 'abas').getByRole('tablist', { name: 'Seções da turma' }).getByRole('tab')
    await expect(abas).toHaveCount(3)
    for (const aba of await abas.all()) {
      const medida = await caixa(aba)
      expect(medida.height, 'aba').toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect(medida.width, 'aba').toBeGreaterThanOrEqual(24)
    }
    for (const toque of await toques(page).all()) {
      const medida = await caixa(toque)
      expect(medida.height, 'toque').toBeGreaterThanOrEqual(hasTouch ? ALVO_DE_TOQUE_PRINCIPAL_PX : 40)
    }
    for (const toque of await desligados(page).all()) {
      expect((await caixa(toque)).height, 'toque desligado').toBeGreaterThanOrEqual(hasTouch ? ALVO_DE_TOQUE_PRINCIPAL_PX : 40)
    }
  })

  test('o toque troca no clique e no teclado, mostra o visto, e o desligado fica fora do Tab', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const esperando = toques(page).nth(1)
    const sugeridas = toques(page).nth(2)
    await expect(esperando).toHaveAttribute('aria-pressed', 'false')
    await acionar(esperando, hasTouch)
    await expect(esperando).toHaveAttribute('aria-pressed', 'true')
    expect(await esperando.locator('svg').evaluate((svg) => svg.classList.contains('lucide-check'))).toBe(true)
    await acionar(esperando, hasTouch)
    await expect(esperando).toHaveAttribute('aria-pressed', 'false')

    // Pelo teclado: Espaço e Enter trocam, e a ordem do Tab passa pelas três e salta as desligadas.
    // Chega pelo teclado (um passo para trás e um para a frente): o anel de foco só aparece depois de uma tecla, e o clique
    // acima deixou o ponteiro como a última entrada.
    await esperando.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(esperando).toBeFocused()
    expect(await focoVisivel(page)).toBe(true)
    await page.keyboard.press('Space')
    await expect(esperando).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Tab')
    await expect(sugeridas).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(sugeridas).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Tab')
    const ativo = await page.evaluate(() => document.activeElement?.closest('[data-toques-desligados]') !== null)
    expect(ativo, 'o Tab não para no toque desligado').toBe(false)

    // O desligado não troca nem pelo clique forçado.
    const arquivadas = desligados(page).nth(1)
    await expect(arquivadas).toHaveAttribute('aria-pressed', 'true')
    await arquivadas.click({ force: true })
    await expect(arquivadas).toHaveAttribute('aria-pressed', 'true')
    await expect(secao(page, 'toque').locator('[data-toques-acionados]')).toHaveAttribute('data-toques-acionados', '0')
  })

  test('as abas pelo teclado: uma parada só no Tab, as setas dão a volta, Home e End, e o painel aponta para a aba', async ({ page }) => {
    await abrirGaleria(page)
    const abas = secao(page, 'abas')
    const lista = abas.getByRole('tablist', { name: 'Seções da turma' })
    const painel = abas.getByRole('tabpanel').first()
    const aba = (nome: RegExp | string) => lista.getByRole('tab', { name: nome })

    expect(await lista.getByRole('tab').evaluateAll((guias) => guias.map((guia) => (guia as HTMLElement).tabIndex))).toEqual([0, -1, -1])
    await aba('Visão geral').focus()
    await page.keyboard.press('ArrowLeft')
    await expect(aba('Atividades')).toHaveAttribute('aria-selected', 'true')
    await expect(aba('Atividades')).toBeFocused()
    await page.keyboard.press('Home')
    await expect(aba('Visão geral')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('End')
    await expect(aba('Atividades')).toHaveAttribute('aria-selected', 'true')
    // `aria-controls` aponta para o painel, e o painel se nomeia pela aba ativa.
    const idDoPainel = await painel.getAttribute('id')
    for (const guia of await lista.getByRole('tab').all()) await expect(guia).toHaveAttribute('aria-controls', idDoPainel ?? '')
    await expect(painel).toHaveAttribute('aria-labelledby', (await aba('Atividades').getAttribute('id')) ?? '')
    await page.keyboard.press('Tab')
    await expect(painel).toBeFocused()
  })

  test('a faixa não fecha e continua à vista: sem botão nem link, e visível depois de rolar a galeria', async ({ page }) => {
    await abrirGaleria(page)
    const faixa = secao(page, 'estado').getByRole('note')
    await expect(faixa.getByRole('button')).toHaveCount(0)
    await expect(faixa.getByRole('link')).toHaveCount(0)
    await expect(faixa).toHaveText('Seu professor acompanha como você usa o Tutor.')
    await faixa.scrollIntoViewIfNeeded()
    await expect(faixa).toBeInViewport()
  })

  test('o "Tentar de novo" é o botão primário de 44 px, e o "Tentando de novo…" é um status fora do alerta', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const blocos = estados(page).locator('div', { has: page.getByRole('alert') })
    const erro = blocos.last()
    await expect(erro.getByRole('alert')).toHaveCount(1)
    const botao = erro.getByRole('button', { name: 'Tentar de novo' })
    expect((await caixa(botao)).height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    await acionar(estados(page).getByRole('button', { name: 'Tentar de novo' }).first(), hasTouch)
    await expect(secao(page, 'estados-de-tela').locator('[data-tentativas]')).toHaveAttribute('data-tentativas', '1')
    await expect(estados(page).getByRole('status').filter({ hasText: 'Tentando de novo…' })).toHaveCount(1)
    await expect(estados(page).getByRole('alert').filter({ hasText: 'Tentando' })).toHaveCount(0)
    await expect(estados(page).getByRole('status').filter({ hasText: 'Verificando…' })).toHaveCount(1)
  })
})
