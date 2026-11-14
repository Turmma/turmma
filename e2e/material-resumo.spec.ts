import type { APIRequestContext, Locator, Page, Request, Route } from '@playwright/test'
import { abrirNavegacao, entrarPelaTelaComSegundoFator, lateral, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { irPelaCoordenacao, linhasDaTabela, paginaNaoRola } from './support/coordenacao.ts'
import { CAMINHO_DO_PDF_DE_DEMONSTRACAO, criarMaterialNoBanco, criarMateriaisNoBanco, recusasNaAuditoria, vincularMaterialAsSeriesNoBanco } from './support/material.ts'
import { expect, test } from './support/profiles.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga, configurarSegundoFatorPelaApi } from './support/mfa.ts'
import { criarEquipeComSenha, montarEstruturaNoBanco, type EquipeDeTeste, type EstruturaDeTeste } from './support/seed.ts'
import { horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * O resumo no topo da aba Material (ingestao-do-material, 11.0; RF18), pela tela, nos projetos `chromebook` e `celular`: a contagem por
 * disciplina e série, o aviso das séries sem declaração, a recusa que entra no número sem recarregar, o vazio, o professor que não alcança
 * a aba, a pessoa seguinte na mesma aba, e a tabela de 300 materiais com "Mostrar mais". Nomes inventados pelo teste.
 */

const SERIE_DA_ESTRUTURA = '7º ano do Ensino Fundamental'
const TITULO = 'Química 2 — Capítulo 7: Estequiometria'

const principal = (page: Page) => page.getByRole('main')
/** O resumo é uma região própria, fora da lista: a contagem das linhas da lista continua a dela. */
const resumo = (page: Page) => principal(page).getByRole('region', { name: 'Resumo do material' })
const linhasDoResumo = (page: Page) => linhasDaTabela(resumo(page))
const lista = (page: Page) => principal(page).getByRole('region', { name: 'Materiais da escola' })
const linhasDaLista = (page: Page) => linhasDaTabela(lista(page))
const caixaDeEnvio = (page: Page) => page.getByRole('dialog', { name: 'Enviar material' })
const enviar = (page: Page) => caixaDeEnvio(page).getByRole('button', { name: /^Enviar material$|^Enviando…$/ })

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

/** Uma escola com uma disciplina e a coordenadora dela na aba Material, entrando pela API (como `material.spec.ts`). `antes` roda com a sessão ainda fechada. */
async function abrirMaterial(page: Page, request: APIRequestContext, antes?: (cenario: Cenario) => Promise<void>): Promise<Cenario> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId)
  const cenario = { coordenadora, estrutura }
  await antes?.(cenario)
  await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/material', async () => {
    await expect(page).toHaveURL(/\/coordenacao\/material$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByRole('heading', { level: 1, name: 'Escola' })).toBeAttached({ timeout: SIGN_IN_TIMEOUT_MS })
  })
  return cenario
}

test.describe('O resumo do material', () => {
  test('contagem por disciplina e série, o aviso das séries sem declaração, e a recusa entra em "Recusados em 30 dias" sem recarregar', async ({ page, hasTouch, request }) => {
    const cenario = await abrirMaterial(page, request, async ({ coordenadora, estrutura }) => {
      const { escolaId } = coordenadora
      const disciplinaId = estrutura.disciplina.id
      for (const material of [
        { titulo: 'Capítulo pronto 1', estado: 'pronto' },
        { titulo: 'Capítulo pronto 2', estado: 'pronto' },
        { titulo: 'Capítulo em leitura', estado: 'processando' },
        { titulo: 'Capítulo sem texto', estado: 'falhou' },
      ] as const) {
        await vincularMaterialAsSeriesNoBanco(escolaId, await criarMaterialNoBanco(escolaId, disciplinaId, material))
      }
      await criarMaterialNoBanco(escolaId, disciplinaId, { titulo: 'Capítulo solto', estado: 'pronto' })
    })

    // Uma linha por disciplina e série: prontos, processando, com falha e recusados. O material sem série é a linha "Sem série" da disciplina, por último, e também o aviso.
    await expect(resumo(page).getByRole('heading', { name: 'Resumo do material' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(linhasDoResumo(page)).toHaveCount(2)
    await expect(linhasDoResumo(page).first()).toContainText(cenario.estrutura.disciplina.nome)
    await expect(linhasDoResumo(page).first().locator('td, dd')).toHaveText([SERIE_DA_ESTRUTURA, '2', '1', '1', '0'])
    await expect(linhasDoResumo(page).last()).toContainText(cenario.estrutura.disciplina.nome)
    await expect(linhasDoResumo(page).last().locator('td, dd')).toHaveText(['Sem série', '1', '0', '0', '0'])
    await expect(resumo(page).getByRole('note')).toContainText('Séries atribuídas na migração: 1 material está sem série')
    // O resumo vem antes da lista, e a lista continua com as linhas dela.
    await expect(linhasDaLista(page)).toHaveCount(5)
    const topoDoResumo = await resumo(page).boundingBox()
    const topoDaLista = await lista(page).boundingBox()
    expect(topoDoResumo?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(topoDaLista?.y ?? 0)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    // Um envio recusado por licença entra no número, sem recarregar a página.
    await activate(principal(page).getByRole('button', { name: 'Enviar material' }), hasTouch)
    await expect(caixaDeEnvio(page)).toBeVisible()
    const caixa = caixaDeEnvio(page)
    await page.getByTestId('arquivo-do-material').setInputFiles(CAMINHO_DO_PDF_DE_DEMONSTRACAO)
    await caixa.getByLabel('Título').fill(TITULO)
    await caixa.getByLabel('Disciplina').selectOption({ label: cenario.estrutura.disciplina.nome })
    await caixa.getByRole('checkbox', { name: SERIE_DA_ESTRUTURA }).check()
    await caixa.getByLabel('De quem é o material').selectOption({ label: 'Material próprio da escola' })
    await caixa.getByLabel('Licença de uso (obrigatória)').selectOption({ label: 'Não tenho a licença, ou não sei' })
    await caixa.getByLabel(/^Declaro que a escola pode usar este material/).check()
    await activate(enviar(page), hasTouch)
    await expect(caixa.getByRole('alert').filter({ hasText: 'Envio recusado.' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(caixa.getByRole('button', { name: 'Cancelar' }), hasTouch)
    await expect(caixa).toHaveCount(0)
    await expect(linhasDoResumo(page).first().locator('td, dd')).toHaveText([SERIE_DA_ESTRUTURA, '2', '1', '1', '1'], { timeout: SIGN_IN_TIMEOUT_MS })
    expect(await recusasNaAuditoria(cenario.coordenadora.escolaId)).toHaveLength(1)
  })

  test('sem material: o vazio diz o que acontece, e a escola nova não vê aviso nem linha', async ({ page, request }) => {
    await abrirMaterial(page, request)
    await expect(resumo(page).getByText('Ainda não há material para resumir.')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(resumo(page).getByRole('note')).toHaveCount(0)
    await expect(linhasDoResumo(page)).toHaveCount(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('o professor não alcança o resumo: o endereço da aba cai em "não encontrada", sem pedido do resumo', async ({ page }) => {
    const professora = await criarEquipeComSenha()
    const pedidos: string[] = []
    page.on('request', (pedido: Request) => {
      if (new URL(pedido.url()).pathname === '/v1/materiais/resumo') pedidos.push(pedido.method())
    })
    const entrada = await page.request.post('/v1/sessao/email', { data: { email: professora.email, senha: professora.senha } })
    expect(entrada.ok(), 'a entrada pela API').toBe(true)
    await page.goto('/coordenacao/material')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('region', { name: 'Resumo do material' })).toHaveCount(0)
    expect(pedidos).toEqual([])
  })

  test('segunda pessoa: a contagem de A não aparece na aba da coordenação de B, nem enquanto o resumo de B ainda carrega', async ({ page, hasTouch, request }) => {
    test.slow()
    await abrirMaterial(page, request, async ({ coordenadora, estrutura }) => {
      await vincularMaterialAsSeriesNoBanco(coordenadora.escolaId, await criarMaterialNoBanco(coordenadora.escolaId, estrutura.disciplina.id, { titulo: 'Capítulo da escola A', estado: 'pronto', paginas: 4 }))
    })
    await expect(linhasDoResumo(page)).toHaveCount(1, { timeout: SIGN_IN_TIMEOUT_MS })
    await abrirNavegacao(page, hasTouch)
    await activate(lateral(page).getByRole('button', { name: 'Sair' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })

    // A de B entra na mesma aba, com a leitura do resumo segurada: é aí que a contagem de A apareceria.
    const deB = await criarEquipeComSenha('coordenador')
    await montarEstruturaNoBanco(deB.escolaId)
    const segurada = gate()
    await page.route(
      (url) => url.pathname === '/v1/materiais/resumo',
      async (rota: Route) => {
        await segurada.aberta
        return rota.fallback()
      },
    )
    const { segredo } = await configurarSegundoFatorPelaApi(request, deB)
    await entrarPelaTelaComSegundoFator(page, deB, segredo, hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/painel$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await irPelaCoordenacao(page, 'Material', hasTouch)
    await expect(resumo(page).getByRole('status').filter({ hasText: 'Carregando o resumo…' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(linhasDoResumo(page)).toHaveCount(0)
    segurada.abrir()
    await expect(resumo(page).getByText('Ainda não há material para resumir.')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(linhasDoResumo(page)).toHaveCount(0)
  })

  test('numa escola com 300 materiais a tabela mostra 25 e "Mostrar mais" revela de 25 em 25; a página não rola em 1366 × 768', async ({ page, hasTouch, request }) => {
    test.slow()
    await abrirMaterial(page, request, async ({ coordenadora, estrutura }) => {
      await criarMateriaisNoBanco(coordenadora.escolaId, estrutura.disciplina.id, 300)
    })
    await expect(linhasDaLista(page)).toHaveCount(25, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(lista(page)).toContainText('Mostrando 25 de 300')
    await page.setViewportSize({ width: 1366, height: 768 })
    await paginaNaoRola(page)
    await activate(lista(page).getByRole('button', { name: 'Mostrar mais' }), hasTouch)
    await expect(linhasDaLista(page)).toHaveCount(50)
    await expect(lista(page)).toContainText('Mostrando 50 de 300')
    await paginaNaoRola(page)
    expect(await seriousViolations(page)).toEqual([])
  })
})
