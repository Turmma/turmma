import { AxeBuilder } from '@axe-core/playwright'
import type { APIRequestContext, Locator, Page, Request, Route } from '@playwright/test'
import { SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { criarCapitulosNoBanco, criarMaterialNoBanco, criarSecoesNoBanco, definirComponenteNoBanco, habilidadesDoRecorteNoBanco, vincularMaterialAUmaSerieNoBanco } from './support/material.ts'
import { expect, test } from './support/profiles.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga } from './support/mfa.ts'
import { criarEquipeComSenha, criarTodasAsSeriesNoBanco, montarEstruturaNoBanco, type EquipeDeTeste, type EstruturaDeTeste } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, FAILING_IMPACTS, horizontalOverflow, seriousViolations, WCAG_TAGS } from './support/checks.ts'

/**
 * A cobertura da BNCC por série em Material (classificacao-bncc, 13.0; RF19; `cenarios.md`, "Telas"), pela tela e com a API de verdade, nos projetos `chromebook` e `celular`: a escolha da série, as habilidades sem material
 * por componente com os capítulos ainda sem classificação ao lado, a medida da tela (1366 × 768, 360 px, alvo, axe) e o recomeço (a pessoa seguinte do mesmo computador, a mesma série de outra escola, a resposta atrasada
 * do 6º sob a escolha do 7º, a falha e "Tentar de novo"). O componente da disciplina e as habilidades da BNCC vêm do banco do teste.
 */

/** A mesma expressão de `e2e/support/professor/scenario.ts` (`VOCABULARIO_DE_NOTA`), copiada: a tela inteira não fala em nota, é diagnóstico (D46). */
const VOCABULARIO_DE_NOTA = /\bnotas?\b|\bconceitos?\b|pontuaç/i
const LIMITE = JSON.stringify({ erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
const SERIE_7 = '7º ano do Ensino Fundamental'
const SERIE_6 = '6º ano do Ensino Fundamental'

const principal = (page: Page) => page.getByRole('main')
const seletorDeSerie = (page: Page) => principal(page).getByRole('combobox', { name: /Série/ })
const grupoDe = (page: Page, nome: string) => principal(page).getByRole('region', { name: `Componente: ${nome}` })
const botoesCheios = (page: Page) =>
  principal(page).getByRole('button').evaluateAll((botoes) => botoes.filter((botao) => getComputedStyle(botao).backgroundColor === 'rgb(232, 115, 46)').map((botao) => botao.textContent))

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Uma porta que segura a resposta até o teste abrir. */
function gate(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

interface Cenario {
  readonly coordenadora: EquipeDeTeste
  readonly estrutura: EstruturaDeTeste
}

/** Uma escola com as sete séries e uma disciplina de Ciências, e a coordenadora dela na aba Cobertura, entrando pela API. `antes` roda com a sessão ainda fechada. */
async function abrirCobertura(page: Page, request: APIRequestContext, antes?: (cenario: Cenario) => Promise<void>): Promise<Cenario> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  await criarTodasAsSeriesNoBanco(coordenadora.escolaId)
  const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId)
  await definirComponenteNoBanco(coordenadora.escolaId, estrutura.disciplina.id, 'ciencias')
  const cenario = { coordenadora, estrutura }
  await antes?.(cenario)
  await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/material?aba=cobertura', async () => {
    await expect(page).toHaveURL(/\/coordenacao\/material\?aba=cobertura$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByRole('heading', { level: 1, name: 'Escola' })).toBeAttached({ timeout: SIGN_IN_TIMEOUT_MS })
  })
  return cenario
}

/**
 * Um material `pronto` da série do ano dado, com duas seções: uma classificada pela IA no primeiro código dado e uma que a classificação não terminou (conta em "capítulos sem classificação").
 * Devolve os códigos do recorte do ano, na ordem.
 */
async function materialDoAno(cenario: Cenario, titulo: string, ano: number): Promise<string[]> {
  const { escolaId } = cenario.coordenadora
  const codigos = (await habilidadesDoRecorteNoBanco('ciencias', ano)).map((habilidade) => habilidade.codigo)
  const id = await criarMaterialNoBanco(escolaId, cenario.estrutura.disciplina.id, { titulo, estado: 'pronto', paginas: 8 })
  await vincularMaterialAUmaSerieNoBanco(escolaId, id, ano)
  await criarCapitulosNoBanco(escolaId, id, [
    { numero: 1, titulo: 'Misturas', paginaInicial: 1, paginaFinal: 4 },
    { numero: 2, titulo: 'Energia', paginaInicial: 5, paginaFinal: 8 },
  ])
  await criarSecoesNoBanco(escolaId, id, [
    { paginaInicial: 1, paginaFinal: 4, capituloOrdem: 1, situacao: 'classificada', habilidades: [{ codigo: codigos[0] ?? '', origem: 'ia' }] },
    { paginaInicial: 5, paginaFinal: 8, capituloOrdem: 2, situacao: 'nao_classificada' },
  ])
  return codigos
}

async function escolherASerie(page: Page, nome: string): Promise<void> {
  const seletor = seletorDeSerie(page)
  await expect(seletor.getByRole('option', { name: nome })).toBeAttached({ timeout: SIGN_IN_TIMEOUT_MS })
  await seletor.selectOption({ label: nome })
}

const ehACobertura = (pedido: Request) => pedido.method() === 'GET' && new URL(pedido.url()).pathname === '/v1/materiais/cobertura'

test.describe('A cobertura da BNCC por série', () => {
  test('a série escolhida mostra, por componente, as habilidades sem material e os capítulos sem classificação; 1366 × 768 não rola, 360 px sem rolagem lateral, alvo medido, nenhuma ação cheia e sem vocabulário de nota', async ({ page, hasTouch, request }) => {
    let codigos: string[] = []
    await abrirCobertura(page, request, async (feito) => {
      codigos = await materialDoAno(feito, 'Apostila de Ciências', 7)
    })
    const doRecorte = await habilidadesDoRecorteNoBanco('ciencias', 7)
    await page.setViewportSize(hasTouch ? { width: 360, height: 740 } : { width: 1366, height: 768 })
    // Sem série escolhida a tela convida a escolher, e nenhuma cobertura é pedida.
    await expect(seletorDeSerie(page)).toHaveValue('', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByText('Escolha uma série para ver as habilidades que ainda não têm material.')).toBeVisible()

    await escolherASerie(page, SERIE_7)

    const ciencias = grupoDe(page, 'Ciências')
    await expect(ciencias).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(ciencias).toContainText(`${String(doRecorte.length - 1)} de ${String(doRecorte.length)} habilidades sem material`)
    await expect(ciencias).toContainText('1 capítulo ainda sem classificação')
    // A coberta não aparece na lista; a que nenhum material cobre aparece com o código e a descrição.
    await expect(ciencias).not.toContainText(codigos[0] ?? '')
    await expect(ciencias).toContainText(`${codigos[1] ?? ''}${doRecorte[1]?.descricao ?? ''}`)
    await expect(ciencias.getByRole('listitem')).toHaveCount(doRecorte.length - 1)
    // A tela só lê, e na tela a seção é "capítulo", nunca "trecho" nem "seção"; e ela não fala em nota.
    await expect(principal(page).getByRole('button', { name: /Corrigir|Reclassificar|Classificar/ })).toHaveCount(0)
    // O texto da tela, sem as descrições da BNCC (que são da base nacional e podem usar a palavra "seção").
    const textoDaTela = await principal(page).evaluate((miolo) => {
      const copia = miolo.cloneNode(true) as HTMLElement
      copia.querySelectorAll('li').forEach((item) => item.remove())
      return copia.textContent ?? ''
    })
    expect(textoDaTela).not.toMatch(/\btrechos?\b|\bse[cç][oõ][ae]s?\b/i)
    expect(textoDaTela).not.toMatch(VOCABULARIO_DE_NOTA)

    await paginaNaoRola(page)
    expect(await horizontalOverflow(page)).toBe(0)
    // A Cobertura é só leitura: a tela não tem ação cheia (a regra de uma por tela é o teto, e hoje o número é zero).
    expect(await botoesCheios(page)).toEqual([])
    // O alvo da escolha da série: 24 px no computador e 44 px no celular (regra 50, item 2a).
    const alvo = await seletorDeSerie(page).boundingBox()
    expect(alvo?.height ?? 0).toBeGreaterThanOrEqual(hasTouch ? ALVO_DE_TOQUE_PRINCIPAL_PX : 24)
  })

  test('o seletor da série e o grupo de habilidades não têm violação de acessibilidade grave, no computador e no celular', async ({ page, request }) => {
    await abrirCobertura(page, request, async (feito) => {
      await materialDoAno(feito, 'Apostila de Ciências', 7)
    })

    await escolherASerie(page, SERIE_7)
    await expect(grupoDe(page, 'Ciências')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    // Um grupo e o seletor, e não a página inteira: o axe leva 5 s nas ~100 habilidades da série, e as seções são a mesma peça.
    const analise = new AxeBuilder({ page }).withTags([...WCAG_TAGS]).include('[aria-label="Componente: Ciências"]').include('main select')
    const { violations } = await analise.analyze()
    const graves = violations
      .filter((violacao) => (FAILING_IMPACTS as readonly string[]).includes(violacao.impact ?? ''))
      .map((violacao) => ({ regra: violacao.id, impacto: violacao.impact, alvos: violacao.nodes.map((no) => no.target.join(' ')) }))
    expect(graves).toEqual([])
  })

  test('a série sem material em uso convida a enviar, e não lista habilidade nem aviso de capítulo', async ({ page, hasTouch, request }) => {
    await abrirCobertura(page, request)
    await page.setViewportSize(hasTouch ? { width: 360, height: 740 } : { width: 1366, height: 768 })

    await escolherASerie(page, SERIE_7)

    await expect(principal(page).getByText('Nenhum material desta série ainda')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByText(/Envie material desta série para ver a cobertura/)).toBeVisible()
    await expect(principal(page).getByRole('listitem')).toHaveCount(0)
    await expect(principal(page).getByText(/ainda sem classificação/)).toHaveCount(0)
    await paginaNaoRola(page)
  })

  test('recomeço: a cobertura do 6º segurada com o 7º escolhido: a resposta atrasada não aparece sob o 7º', async ({ page, request }) => {
    let codigosDoSexto: string[] = []
    let codigosDoSetimo: string[] = []
    await abrirCobertura(page, request, async (feito) => {
      codigosDoSexto = await materialDoAno(feito, 'Apostila do sexto', 6)
      codigosDoSetimo = await materialDoAno(feito, 'Apostila do sétimo', 7)
    })
    const segurada = gate()
    const liberada = gate()
    let primeira = true
    await page.route(
      (url) => url.pathname === '/v1/materiais/cobertura',
      async (rota: Route) => {
        // A primeira leitura é a do 6º, escolhido antes: ela fica no ar até o teste abrir.
        if (!primeira) return rota.fallback()
        primeira = false
        await segurada.aberta
        await rota.fallback().catch(() => undefined)
        liberada.abrir()
      },
    )
    await escolherASerie(page, SERIE_6)
    await expect(principal(page).getByText('Carregando a cobertura…')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    await escolherASerie(page, SERIE_7)
    await expect(grupoDe(page, 'Ciências')).toContainText(codigosDoSetimo[1] ?? '', { timeout: SIGN_IN_TIMEOUT_MS })
    segurada.abrir()
    await liberada.aberta

    // A leitura do 6º foi liberada: nada dela entra sob o 7º.
    await expect.poll(() => grupoDe(page, 'Ciências').getByText(codigosDoSexto[1] ?? '', { exact: false }).count(), { message: 'a cobertura do 6º não pode aparecer sob o 7º' }).toBe(0)
    await expect(grupoDe(page, 'Ciências')).toContainText(codigosDoSetimo[1] ?? '')
    await expect(seletorDeSerie(page)).toHaveValue(/.+/)
  })

  test('recomeço: a leitura que falha mostra o erro curto, sem afirmar que não há material, e "Tentar de novo" lê de novo', async ({ page, hasTouch, request }) => {
    let codigos: string[] = []
    await abrirCobertura(page, request, async (feito) => {
      codigos = await materialDoAno(feito, 'Apostila de Ciências', 7)
    })
    let derrubar = true
    const pedidos: string[] = []
    page.on('request', (pedido) => {
      if (ehACobertura(pedido)) pedidos.push(pedido.url())
    })
    await page.route(
      (url) => url.pathname === '/v1/materiais/cobertura',
      async (rota: Route) => {
        if (!derrubar) return rota.fallback()
        return rota.fulfill({ status: 429, contentType: 'application/json', body: LIMITE })
      },
    )
    await escolherASerie(page, SERIE_7)

    const alerta = principal(page).getByRole('alert')
    await expect(alerta).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByText('Nenhum material desta série ainda')).toHaveCount(0)
    await expect(grupoDe(page, 'Ciências')).toHaveCount(0)
    const tentar = principal(page).getByRole('button', { name: 'Tentar de novo' })
    const alvo = await tentar.boundingBox()
    expect(alvo?.height ?? 0).toBeGreaterThanOrEqual(hasTouch ? ALVO_DE_TOQUE_PRINCIPAL_PX : 24)
    expect(await seriousViolations(page)).toEqual([])

    derrubar = false
    await activate(tentar, hasTouch)
    await expect(grupoDe(page, 'Ciências')).toContainText(codigos[1] ?? '', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    expect(pedidos).toHaveLength(2)
  })
})
