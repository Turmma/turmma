import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './support/profiles.ts'
import { avaliarAssinaturas, avaliarAvatares, avaliarSelos, conferirAssinaturas, conferirQueAOncaNaoTemNome, conferirQueOAvatarFicaParado } from './support/avatar.ts'
import { abrirGaleria, caixa, desenho, secao } from './support/gallery.ts'
import { corDoToken, IMPACTOS_QUE_REPROVAM, larguraExcedente, TAGS_WCAG } from './support/checks.ts'

/**
 * A onça como avatar dos três agentes, na galeria (`/galeria`), nos projetos `chromebook` e `celular` e nos dois temas
 * (X1, tarefa 8.0; RF10; `docs/interface.md` 9.7). O que o `jsdom` prova — as props, o bloco com nome e selo, dois renders
 * iguais, nenhum temporizador, a cadeia fechada de importação — está em `components/ui/onca/CabecaOnca.test.tsx` e em
 * `components/ui/ai/avatar-*.test.ts(x)`; aqui está o que só o navegador calcula: a cor resolvida, a medida e o que se mexe.
 *
 * A onça **de corpo inteiro não aparece**: ela vem com o primeiro uso (X2 e X4), com parecer próprio.
 */

const TEMAS = ['claro', 'escuro'] as const
type Tema = (typeof TEMAS)[number]

const TAMANHOS = [24, 32, 40, 48] as const

/** O anel de cada agente, pelo token: o Assistente em azul, o Tutor em laranja e o Analista em anil (9.7). */
const ANEL = { assistente_de_ensino: 'azul', tutor: 'laranja', analista_de_desempenho_escolar: 'anil' } as const
type Agente = keyof typeof ANEL
const AGENTES = Object.keys(ANEL) as Agente[]

/** Quantos avatares a seção tem: três agentes em quatro tamanhos, e um em cada tipo de mensagem (coluna, balão, pensando). */
const AVATARES_DA_SECAO = AGENTES.length * TAMANHOS.length + 3

/** As cores fixas da onça (9.7), como o navegador as devolve: a pelagem, o olho e a pupila. */
const PELAGEM = 'rgb(232, 115, 46)'
const OLHO = 'rgb(255, 255, 255)'
const PUPILA = 'rgb(22, 35, 62)'

async function irParaOTema(page: Page, tema: Tema): Promise<void> {
  await abrirGaleria(page)
  await page.evaluate((valor) => document.documentElement.setAttribute('data-tema', valor), tema)
}

for (const tema of TEMAS) {
  test.describe(`a onça como avatar, no tema ${tema}`, () => {
    test('cada avatar é um círculo `fundo` com anel de 2 px na cor do agente, quadrado, com a cabeça dentro e nenhuma imagem (A28)', async ({ page }) => {
      await irParaOTema(page, tema)
      const [fundo, azul, laranja, anil] = await Promise.all(['fundo', 'azul', 'laranja', 'anil'].map((token) => corDoToken(page, token)))
      const anel: Record<Agente, string | undefined> = { assistente_de_ensino: azul, tutor: laranja, analista_de_desempenho_escolar: anil }
      const avatares = secao(page, 'marca-onca').locator('[data-agente]')
      await expect(avatares).toHaveCount(AVATARES_DA_SECAO)

      let conferidos = 0
      for (const tamanho of TAMANHOS) {
        for (const agente of AGENTES) {
          const avatar = secao(page, 'marca-onca').locator(`[data-tamanho="${String(tamanho)}"] [data-agente="${agente}"]`)
          await expect(avatar, `${agente} a ${String(tamanho)} px`).toHaveCount(1)
          const medida = await caixa(avatar)
          expect(medida, `${agente}: quadrado de ${String(tamanho)} px`).toMatchObject({ width: tamanho, height: tamanho })
          expect(await desenho(avatar), agente).toMatchObject({ fundo, borda: `2px solid ${anel[agente] ?? ''}` })
          expect(Number.parseFloat((await desenho(avatar)).canto), `${agente}: redondo`).toBeGreaterThanOrEqual(tamanho / 2)
          // A cabeça recua do anel como no mockup: o círculo é de `tamanho`, e o desenho, de `tamanho − 2 × folga` (3 px em 24, 4 px a partir de 32).
          await expect(avatar.locator('svg'), agente).toHaveCount(1)
          const dentro = tamanho - 2 * (tamanho < 32 ? 3 : 4)
          expect(await caixa(avatar.locator('svg')), `${agente}: a cabeça dentro do anel`).toMatchObject({ width: dentro, height: dentro })
          await expect(avatar.locator('img, image, picture'), agente).toHaveCount(0)
          conferidos += 1
        }
      }
      expect(conferidos).toBe(AGENTES.length * TAMANHOS.length)
      // O de cada tipo de mensagem tem o mesmo desenho: o avatar da linha é o de 24 px.
      for (const agente of AGENTES) expect(await desenho(secao(page, 'marca-onca').locator(`[data-onca-na-mensagem] [data-agente="${agente}"]`)), agente).toMatchObject({ fundo, borda: `2px solid ${anel[agente] ?? ''}` })
    })

    test('as cores da onça são fixas: a pelagem, o olho e a pupila são os mesmos no claro e no escuro, e a cabeça é a mesma nos três agentes', async ({ page }) => {
      await irParaOTema(page, tema)
      const cabecas = await secao(page, 'marca-onca').locator('[data-tamanho="48"] [data-agente] svg').evaluateAll((svgs) => svgs.map((svg) => svg.innerHTML.replace(/\bcab[a-zA-Z0-9]+(?=-(?:pinta|corpo|olho-[ed])\b)/g, 'id')))
      expect(cabecas).toHaveLength(AGENTES.length)
      expect(new Set(cabecas).size, 'um desenho só: a cabeça não muda de um agente para outro').toBe(1)
      const cores = await secao(page, 'marca-onca')
        .locator('[data-tamanho="48"] [data-agente="tutor"] svg')
        .evaluate((svg) => {
          const fill = (seletor: string) => getComputedStyle(svg.querySelector(seletor) as Element).fill
          return { pelagem: fill('circle[r="22"]'), olho: fill('g > rect[width="38"]'), pupila: fill('rect[data-parte="pupila"]') }
        })
      expect(cores).toEqual({ pelagem: PELAGEM, olho: OLHO, pupila: PUPILA })
    })

    test('todo avatar tem o nome da função em texto visível e o selo "IA" no mesmo bloco, e a assinatura não passa da janela', async ({ page }) => {
      await irParaOTema(page, tema)
      expect(await conferirAssinaturas(secao(page, 'marca-onca'))).toBe(AVATARES_DA_SECAO)
      // Os avatares das outras seções da galeria (a conversa, a assinatura) também assinam.
      expect(await conferirAssinaturas(page)).toBeGreaterThan(AVATARES_DA_SECAO)
      expect(await larguraExcedente(page)).toBe(0)
    })

    test('no balão do Seu time a assinatura fica em cima e o balão logo abaixo dela, com no máximo 85% da coluna no computador e a coluna inteira no celular', async ({ page }) => {
      await irParaOTema(page, tema)
      const mensagem = secao(page, 'marca-onca').locator('article').filter({ has: page.locator('[data-agente="assistente_de_ensino"]') })
      await expect(mensagem).toHaveCount(1)
      const assinatura = mensagem.locator(':scope > [data-assinatura]')
      const balao = mensagem.locator(':scope > div:not([data-assinatura])').first()
      await expect(assinatura).toHaveCount(1)
      await expect(balao).toBeVisible()
      const [da, db, coluna] = await Promise.all([caixa(assinatura), caixa(balao), caixa(mensagem)])
      expect(da.y + da.height, 'o balão começa depois da assinatura').toBeLessThanOrEqual(db.y)
      expect(db.y - (da.y + da.height), 'o balão vem logo abaixo da assinatura').toBeLessThanOrEqual(16)
      expect(Math.abs(da.x - db.x), 'a assinatura e o balão partem da mesma borda').toBeLessThanOrEqual(1)
      const largura = page.viewportSize()?.width ?? 0
      if (largura >= 640) expect(db.width, 'no computador o balão não passa de 85% da coluna').toBeLessThanOrEqual(coluna.width * 0.85 + 1)
      else expect(db.width, 'no celular o balão ocupa a coluna').toBeGreaterThan(coluna.width * 0.85)
      expect(db.x + db.width, 'o balão não passa da coluna').toBeLessThanOrEqual(coluna.x + coluna.width + 1)
    })

    test('nada se mexe: nenhuma animação nem transição no avatar, e o "preparando a resposta" ao lado dele continua parado (A51)', async ({ page }) => {
      await irParaOTema(page, tema)
      expect(await conferirQueOAvatarFicaParado(secao(page, 'marca-onca'))).toBeGreaterThan(0)
      const pensando = secao(page, 'marca-onca').locator('[data-pensando]')
      await expect(pensando).toHaveCount(1)
      await expect(pensando.locator('[data-agente]')).toHaveCount(1)
      expect(await pensando.evaluate((elemento) => [elemento, ...elemento.querySelectorAll('*')].filter((no) => getComputedStyle(no).animationName !== 'none').length)).toBe(0)
    })

    test('a onça não tem nome: o avatar some da leitura de tela, e nada na tela se chama "onça"', async ({ page }) => {
      await irParaOTema(page, tema)
      const avatares = secao(page, 'marca-onca').locator('[data-agente]')
      for (const avatar of await avatares.all()) {
        await expect(avatar).toHaveAttribute('aria-hidden', 'true')
        await expect(avatar).not.toHaveAttribute('title')
        await expect(avatar).not.toHaveAttribute('aria-label')
        await expect(avatar.locator('title, desc, text')).toHaveCount(0)
      }
      await conferirQueAOncaNaoTemNome(page)
    })

    test('a seção não tem violação grave de acessibilidade, e a página não ganha rolagem horizontal', async ({ page }) => {
      await irParaOTema(page, tema)
      const { violations } = await new AxeBuilder({ page }).withTags([...TAGS_WCAG]).include('[data-galeria="marca-onca"]').analyze()
      const graves = violations
        .filter((violacao) => (IMPACTOS_QUE_REPROVAM as readonly string[]).includes(violacao.impact ?? ''))
        .map((violacao) => ({ regra: violacao.id, impacto: violacao.impact, alvos: violacao.nodes.map((no) => no.target.join(' ')) }))
      expect(graves).toEqual([])
      expect(await larguraExcedente(page)).toBe(0)
    })
  })
}

/**
 * Os verificadores do avatar, do selo e da assinatura conferem a tela inteira numa ida só ao navegador (correção
 * `2026-10-16-galeria-da-onca-estoura-o-prazo`). Em lote, o que se perde é a prova de que cada defeito ainda é visto: aqui
 * cada um recebe uma página montada com um defeito de cada vez, e tem de acusar exatamente aquele.
 */
test.describe('os verificadores do avatar, do selo e da assinatura, em lote', () => {
  const SELO = '<span data-selo-ia><span aria-hidden="true">IA</span><span>gerado por inteligência artificial</span></span>'
  const assinatura = (miolo: string): string => `<div data-assinatura>${miolo}</div>`
  const CASOS_DA_ASSINATURA: ReadonlyArray<{ nome: string; html: string; falhas: string[] }> = [
    { nome: 'a assinatura inteira não acusa nada', html: assinatura(`<span data-agente="tutor"></span><p>Tutor · sinais para o professor</p>${SELO}`), falhas: [] },
    { nome: 'o título também é nome', html: assinatura(`<span data-agente="analista_de_desempenho_escolar"></span><h3>Analista de desempenho escolar</h3>${SELO}`), falhas: [] },
    { nome: 'avatar fora de uma assinatura', html: `<span data-agente="tutor"></span><p>Tutor</p>${SELO}`, falhas: ['tutor #0: o avatar está fora de uma assinatura'] },
    { nome: 'assinatura com dois avatares', html: assinatura(`<span data-agente="tutor"></span><span data-agente="tutor"></span><p>Tutor</p>${SELO}`), falhas: ['tutor: a assinatura tem mais de um avatar', 'tutor: a assinatura tem mais de um avatar'] },
    { nome: 'sem o selo', html: assinatura('<span data-agente="tutor"></span><p>Tutor</p>'), falhas: ['tutor: sem o selo "IA", ou com dois'] },
    { nome: 'com dois selos', html: assinatura(`<span data-agente="tutor"></span><p>Tutor</p>${SELO}${SELO}`), falhas: ['tutor: sem o selo "IA", ou com dois'] },
    { nome: 'selo escondido', html: assinatura('<span data-agente="tutor"></span><p>Tutor</p><span data-selo-ia style="visibility:hidden">IA</span>'), falhas: ['tutor: o selo está escondido'] },
    { nome: 'selo sem caixa', html: assinatura('<span data-agente="tutor"></span><p>Tutor</p><span data-selo-ia style="display:none">IA</span>'), falhas: ['tutor: o selo está escondido'] },
    { nome: 'selo sem largura', html: assinatura('<span data-agente="tutor"></span><p>Tutor</p><span data-selo-ia style="display:inline-block;width:0;overflow:hidden">IA</span>'), falhas: ['tutor: o selo está escondido'] },
    { nome: 'selo sem altura', html: assinatura('<span data-agente="tutor"></span><p>Tutor</p><span data-selo-ia style="display:inline-block;height:0;overflow:hidden">IA</span>'), falhas: ['tutor: o selo está escondido'] },
    { nome: 'sem o nome da função', html: assinatura(`<span data-agente="tutor"></span>${SELO}`), falhas: ['tutor: a assinatura não diz o nome da função'] },
    { nome: 'dois nomes', html: assinatura(`<span data-agente="tutor"></span><p>Tutor</p><p>Tutor</p>${SELO}`), falhas: ['tutor: a assinatura não diz o nome da função'] },
    { nome: 'nome escondido', html: assinatura(`<span data-agente="tutor"></span><p style="visibility:hidden">Tutor</p>${SELO}`), falhas: ['tutor: o nome da função está escondido'] },
    { nome: 'nome de outro agente', html: assinatura(`<span data-agente="tutor"></span><p>Assistente de ensino</p>${SELO}`), falhas: ['tutor: o nome é de outro agente'] },
    { nome: 'agente que não é um dos três', html: assinatura(`<span data-agente="professora_virtual"></span><p>Professora virtual</p>${SELO}`), falhas: ['o agente "professora_virtual" não é um dos três'] },
    {
      nome: 'vale a assinatura mais próxima: a de fora não cobre o selo que falta na de dentro',
      html: assinatura(`${SELO}${assinatura('<span data-agente="tutor"></span><p>Tutor</p>')}`),
      falhas: ['tutor: sem o selo "IA", ou com dois'],
    },
  ]

  // Um teste que percorre os casos, e não um por caso: cada caso é um `setContent` de milissegundos, e um teste por caso
  // dobrava o número de casos da fatia do e2e na esteira (`tools/ci/esteira.test.ts`). A mensagem nomeia o caso.
  test('acusa, um a um, cada defeito da assinatura, e nenhum onde ela está inteira', async ({ page }) => {
    for (const caso of CASOS_DA_ASSINATURA) {
      await page.setContent(`<body>${caso.html}</body>`)
      expect((await avaliarAssinaturas(page)).falhas, caso.nome).toEqual(caso.falhas)
    }
  })

  test('conta os avatares que conferiu', async ({ page }) => {
    await page.setContent(`<body>${assinatura(`<span data-agente="tutor"></span><p>Tutor</p>${SELO}`)}${assinatura(`<span data-agente="assistente_de_ensino"></span><p>Assistente de ensino</p>${SELO}`)}</body>`)
    expect(await avaliarAssinaturas(page)).toEqual({ total: 2, falhas: [] })
    expect(await conferirAssinaturas(page)).toBe(2)
  })

  test('a conferência de uma página sem nenhum avatar reprova, e não passa vazia', async ({ page }) => {
    await page.setContent('<body><p>nada aqui</p></body>')
    expect(await avaliarAssinaturas(page)).toEqual({ total: 0, falhas: [] })
    await expect(conferirAssinaturas(page)).rejects.toThrow(/nenhum avatar na tela/)
  })

  test('a conferência de uma tela com um defeito reprova, e não só relata', async ({ page }) => {
    await page.setContent(`<body>${assinatura('<span data-agente="tutor"></span><p>Tutor</p>')}</body>`)
    await expect(conferirAssinaturas(page)).rejects.toThrow(/sem o selo/)
  })

  const SELO_BOM = '<span data-selo-ia><span aria-hidden="true">IA</span><span class="sr-only">gerado por inteligência artificial</span></span>'
  const CASOS_DO_SELO: ReadonlyArray<{ nome: string; html: string; falhas: string[] }> = [
    { nome: 'o selo inteiro não acusa nada', html: SELO_BOM, falhas: [] },
    { nome: 'o selo inteiro não acusa nada, com a quebra de linha dentro do texto', html: '<span data-selo-ia><span aria-hidden="true">IA</span><span>gerado por\n    inteligência artificial</span></span>', falhas: [] },
    { nome: 'a sigla fora do aria-hidden', html: '<span data-selo-ia><span>IA</span><span>gerado por inteligência artificial</span></span>', falhas: ['selo #0: a sigla "IA" é uma só e fica escondida do leitor de tela'] },
    { nome: 'duas siglas escondidas', html: '<span data-selo-ia><span aria-hidden="true">IA</span><span aria-hidden="true">IA</span><span>gerado por inteligência artificial</span></span>', falhas: ['selo #0: a sigla "IA" é uma só e fica escondida do leitor de tela', 'selo #0: o que a sigla quer dizer está por extenso, em texto'] },
    { nome: 'a sigla errada', html: '<span data-selo-ia><span aria-hidden="true">AI</span><span>gerado por inteligência artificial</span></span>', falhas: ['selo #0: a sigla "IA" é uma só e fica escondida do leitor de tela', 'selo #0: o que a sigla quer dizer está por extenso, em texto'] },
    { nome: 'o que a sigla quer dizer fora do selo', html: '<span data-selo-ia><span aria-hidden="true">IA</span></span>', falhas: ['selo #0: o que a sigla quer dizer está por extenso, em texto'] },
    { nome: 'o texto por extenso trocado', html: '<span data-selo-ia><span aria-hidden="true">IA</span><span>gerado por IA</span></span>', falhas: ['selo #0: o que a sigla quer dizer está por extenso, em texto'] },
    { nome: 'o selo com title', html: SELO_BOM.replace('<span data-selo-ia>', '<span data-selo-ia title="IA">'), falhas: ['selo #0: o que a sigla quer dizer não fica num title'] },
    { nome: 'só o segundo selo defeituoso, com o número dele', html: `${SELO_BOM}${SELO_BOM.replace('<span data-selo-ia>', '<span data-selo-ia title="IA">')}`, falhas: ['selo #1: o que a sigla quer dizer não fica num title'] },
  ]

  test('acusa, um a um, cada defeito do selo, e nenhum onde ele está inteiro', async ({ page }) => {
    for (const caso of CASOS_DO_SELO) {
      await page.setContent(`<body>${caso.html}</body>`)
      const relatorio = await avaliarSelos(page)
      expect(relatorio.falhas, caso.nome).toEqual(caso.falhas)
      expect(relatorio.total, caso.nome).toBe(caso.html.split('<span data-selo-ia').length - 1)
    }
  })

  const AVATAR = (extra = '', miolo = '<svg width="20" height="20"></svg>'): string =>
    `<span data-agente="tutor" style="display:inline-block;width:24px;height:24px;border-radius:9999px;${extra}">${miolo}</span>`
  const CASOS_DO_AVATAR: ReadonlyArray<{ nome: string; html: string; falhas: string[] }> = [
    { nome: 'o avatar inteiro não acusa nada', html: AVATAR(), falhas: [] },
    { nome: 'avatar que não é quadrado', html: AVATAR('height:30px'), falhas: ['avatar #0: não é um quadrado à vista (24 × 30)'] },
    { nome: 'avatar sem caixa', html: AVATAR('display:none'), falhas: ['avatar #0: não é um quadrado à vista (0 × 0)'] },
    { nome: 'avatar de canto quadrado', html: AVATAR('border-radius:4px'), falhas: ['avatar #0: não é um círculo'] },
    { nome: 'avatar sem a cabeça', html: AVATAR('', ''), falhas: ['avatar #0: tem de ter uma cabeça (um svg)'] },
    { nome: 'avatar com duas cabeças', html: AVATAR('', '<svg width="10" height="10"></svg><svg width="10" height="10"></svg>'), falhas: ['avatar #0: tem de ter uma cabeça (um svg)'] },
    { nome: 'imagem dentro do avatar', html: AVATAR('', '<svg width="20" height="20"></svg><img alt="" src="data:,">'), falhas: ['avatar #0: tem imagem dentro (D58)'] },
    { nome: 'imagem do svg dentro do avatar', html: AVATAR('', '<svg width="20" height="20"><image href="data:,"></image></svg>'), falhas: ['avatar #0: tem imagem dentro (D58)'] },
    { nome: 'só o segundo avatar defeituoso, com o número dele', html: `${AVATAR()}${AVATAR('border-radius:4px')}`, falhas: ['avatar #1: não é um círculo'] },
  ]

  test('acusa, um a um, cada defeito do avatar, e nenhum onde ele está inteiro', async ({ page }) => {
    for (const caso of CASOS_DO_AVATAR) {
      await page.setContent(`<body>${caso.html}</body>`)
      const relatorio = await avaliarAvatares(page)
      expect(relatorio.falhas, caso.nome).toEqual(caso.falhas)
      expect(relatorio.total, caso.nome).toBe(caso.html.split('data-agente').length - 1)
    }
  })
})
