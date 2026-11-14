import type { APIRequestContext, Locator, Page, Request, Route } from '@playwright/test'
import { SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { linhasDaTabela, paginaNaoRola } from './support/coordenacao.ts'
import {
  CAMINHO_DO_PDF_DE_DEMONSTRACAO,
  criarCapitulosNoBanco,
  criarEdicaoEmLeituraNoBanco,
  criarMaterialNoBanco,
  edicoesDoMaterialNoBanco,
  seriesDoMaterialNoBanco,
  tituloDoMaterialNoBanco,
  vincularMaterialAUmaSerieNoBanco,
} from './support/material.ts'
import { expect, test } from './support/profiles.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga } from './support/mfa.ts'
import { criarEquipeComSenha, criarTodasAsSeriesNoBanco, montarEstruturaNoBanco, type EquipeDeTeste, type EstruturaDeTeste } from './support/seed.ts'
import { horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * O painel do material com os capítulos, a correção de título e séries e a edição nova (ingestao-do-material, 12.0; RF4, RF6, RF10), pela tela, nos
 * projetos `chromebook` e `celular`: os capítulos e o "sem capítulo", a correção que chega ao banco e ao resumo, a edição nova de verdade (PDF e
 * worker) que herda as séries corrigidas, o recomeço quando a pessoa troca de material com o painel aberto, e o professor, que não alcança nada
 * disso. Nomes inventados pelo teste.
 */

const SERIE_6 = '6º ano do Ensino Fundamental'
const SERIE_7 = '7º ano do Ensino Fundamental'
/** A leitura do PDF da edição acontece depois da resposta do envio, e a tela a acompanha de 1,5 em 1,5 s. */
const PRAZO_DA_LEITURA_MS = 30_000
const INDISPONIVEL = JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
const TEXTO_SALVO = 'Alterações salvas. A busca do Assistente e do Tutor já usa as séries novas.'
const TEXTO_NAO_SALVO = 'As alterações não foram salvas. Tente de novo em instantes.'

const principal = (page: Page) => page.getByRole('main')
const lista = (page: Page) => principal(page).getByRole('region', { name: 'Materiais da escola' })
const linhasDaLista = (page: Page) => linhasDaTabela(lista(page))
const linhaDe = (page: Page, titulo: string) => linhasDaLista(page).filter({ hasText: titulo })
const resumo = (page: Page) => principal(page).getByRole('region', { name: 'Resumo do material' })
const painelDe = (page: Page, titulo: string) => page.getByRole('dialog', { name: titulo })
const capitulos = (painel: Locator) => painel.getByRole('region', { name: 'Capítulos' })
const campoDoTitulo = (painel: Locator) => painel.getByRole('textbox', { name: 'Título', exact: true })
const salvar = (painel: Locator) => painel.getByRole('button', { name: /^Salvar alterações$|^Salvando…$/ })
const caixaDaEdicao = (page: Page) => page.getByRole('dialog', { name: 'Enviar edição nova' })

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

/** Uma escola com as sete séries e uma disciplina, e a coordenadora dela na aba Material, entrando pela API. `antes` roda com a sessão ainda fechada. */
async function abrirMaterial(page: Page, request: APIRequestContext, antes?: (cenario: Cenario) => Promise<void>): Promise<Cenario> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  await criarTodasAsSeriesNoBanco(coordenadora.escolaId)
  const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId)
  const cenario = { coordenadora, estrutura }
  await antes?.(cenario)
  await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/material', async () => {
    await expect(page).toHaveURL(/\/coordenacao\/material$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByRole('heading', { level: 1, name: 'Escola' })).toBeAttached({ timeout: SIGN_IN_TIMEOUT_MS })
  })
  return cenario
}

/** Um material `pronto` na série do 7º ano, com capítulos quando o caso os quer. Devolve o id. */
async function materialPronto(cenario: Cenario, titulo: string, comCapitulos: readonly string[] = []): Promise<string> {
  const { escolaId } = cenario.coordenadora
  const id = await criarMaterialNoBanco(escolaId, cenario.estrutura.disciplina.id, { titulo, estado: 'pronto', paginas: 12 })
  await vincularMaterialAUmaSerieNoBanco(escolaId, id, 7)
  await criarCapitulosNoBanco(
    escolaId,
    id,
    comCapitulos.map((nome, indice) => ({ numero: indice + 1, titulo: nome, paginaInicial: indice * 2 + 1, paginaFinal: indice * 2 + 2 })),
  )
  return id
}

/** Abre o painel de um material pela linha da tabela. */
async function abrirPainel(page: Page, titulo: string, hasTouch: boolean): Promise<Locator> {
  await activate(linhaDe(page, titulo).getByRole('button', { name: titulo }), hasTouch)
  const painel = painelDe(page, titulo)
  await expect(painel).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  return painel
}

/** O painel passa a ser o de outro material pelo endereço, sem fechar: o que o Voltar do histórico e o link do sino fazem. */
async function irParaOPainelDe(page: Page, materialId: string): Promise<void> {
  await page.evaluate((id) => history.pushState(null, '', `/coordenacao/material?material=${id}`), materialId)
}

test.describe('O painel do material', () => {
  test('os capítulos em ordem, com o número e as páginas, e o PDF sem capítulo que diz isso; a página não rola em 1366 × 768', async ({ page, hasTouch, request }) => {
    await abrirMaterial(page, request, async (cenario) => {
      await materialPronto(cenario, 'Apostila com capítulos', ['Substâncias e misturas', 'Reações químicas', 'Estequiometria', 'Soluções', 'Ácidos e bases', 'Eletroquímica', 'Termoquímica', 'Cinética', 'Equilíbrio', 'Orgânica'])
      await materialPronto(cenario, 'Apostila sem capítulo')
    })
    await page.setViewportSize({ width: 1366, height: 768 })
    const painel = await abrirPainel(page, 'Apostila com capítulos', hasTouch)
    const itens = capitulos(painel).getByRole('listitem')
    await expect(itens).toHaveCount(10, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(itens.first()).toHaveText('Capítulo 1 · Substâncias e misturasPáginas 1 a 2')
    await expect(itens.last()).toHaveText('Capítulo 10 · OrgânicaPáginas 19 a 20')
    await paginaNaoRola(page)
    expect(await seriousViolations(page)).toEqual([])

    await page.keyboard.press('Escape')
    await expect(painel).toHaveCount(0)
    const semCapitulo = await abrirPainel(page, 'Apostila sem capítulo', hasTouch)
    await expect(capitulos(semCapitulo)).toContainText('O PDF não tem capítulos que a leitura reconheça', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(capitulos(semCapitulo).getByRole('listitem')).toHaveCount(0)
    await paginaNaoRola(page)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('corrigir título e séries: o banco e o resumo mudam, a tela diz que salvou, e o formulário incompleto não faz pedido', async ({ page, hasTouch, request }) => {
    let id = ''
    const cenario = await abrirMaterial(page, request, async (feito) => {
      id = await materialPronto(feito, 'Apostila a corrigir')
    })
    const pedidos: string[] = []
    page.on('request', (pedido: Request) => {
      if (pedido.method() === 'PATCH') pedidos.push(pedido.url())
    })
    await expect(resumo(page).getByRole('table').or(resumo(page).getByRole('list')).first()).toContainText(SERIE_7, { timeout: SIGN_IN_TIMEOUT_MS })
    const painel = await abrirPainel(page, 'Apostila a corrigir', hasTouch)
    await expect(salvar(painel)).toBeDisabled()

    // Sem nenhuma série, ou com o título vazio, a tela diz o que fazer e nada sai.
    await painel.getByRole('checkbox', { name: SERIE_7 }).uncheck()
    await campoDoTitulo(painel).fill('')
    await activate(salvar(painel), hasTouch)
    await expect(painel.getByText(/Marque ao menos uma série/)).toBeVisible()
    await expect(painel.getByText(/Dê um título ao material/)).toBeVisible()
    expect(pedidos).toEqual([])

    // O 7º ano sai, o 6º entra, e o título muda.
    await painel.getByRole('checkbox', { name: SERIE_6 }).check()
    await campoDoTitulo(painel).fill('  Apostila corrigida  ')
    await activate(salvar(painel), hasTouch)
    // O título do painel é o do material, que já mudou: o painel passa a se chamar pelo nome novo.
    const salvo = painelDe(page, 'Apostila corrigida')
    await expect(salvo.getByText(TEXTO_SALVO)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(salvar(salvo)).toBeDisabled()
    expect(pedidos).toHaveLength(1)
    expect(await tituloDoMaterialNoBanco(cenario.coordenadora.escolaId, id)).toBe('Apostila corrigida')
    expect(await seriesDoMaterialNoBanco(cenario.coordenadora.escolaId, id)).toEqual(['ef_anos_finais:6'])

    // A lista e o resumo do topo já dizem o que o painel salvou, sem recarregar a página.
    await expect(linhaDe(page, 'Apostila corrigida')).toBeVisible()
    await expect(resumo(page)).toContainText(SERIE_6, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(resumo(page)).not.toContainText(SERIE_7)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('editar as séries e enviar a edição nova: ela nasce com as séries corrigidas, a anterior sai da lista quando a nova fica pronta', async ({ page, hasTouch, request }) => {
    let id = ''
    const cenario = await abrirMaterial(page, request, async (feito) => {
      id = await materialPronto(feito, 'Apostila 2026')
    })
    const { escolaId } = cenario.coordenadora
    const painel = await abrirPainel(page, 'Apostila 2026', hasTouch)
    await painel.getByRole('checkbox', { name: SERIE_6 }).check()
    await activate(salvar(painel), hasTouch)
    await expect(painel.getByText(TEXTO_SALVO)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    // O diálogo diz o que a edição herda e o que acontece com a anterior, antes de enviar.
    await activate(painel.getByRole('button', { name: 'Enviar edição nova' }), hasTouch)
    const caixa = caixaDaEdicao(page)
    await expect(caixa).toBeVisible()
    await expect(caixa).toContainText('A edição anterior sai da busca quando a nova ficar pronta.')
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await page.getByTestId('arquivo-da-edicao').setInputFiles(CAMINHO_DO_PDF_DE_DEMONSTRACAO)
    await expect(caixa).toContainText('PDF escolhido')
    await caixa.getByLabel(/^Nome da edição/).fill('2ª edição')
    await activate(caixa.getByRole('button', { name: 'Enviar edição nova' }), hasTouch)

    // O diálogo e o painel fecham, a tela anuncia, e a edição é outra linha, que termina `pronto` e leva a anterior para fora da lista.
    await expect(caixa).toHaveCount(0, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(painel).toHaveCount(0)
    await expect(lista(page).getByRole('status').filter({ hasText: 'Edição enviada. A leitura das páginas começa agora; a anterior sai da busca quando a nova ficar pronta.' })).toBeVisible()
    await expect(linhasDaLista(page)).toHaveCount(1, { timeout: PRAZO_DA_LEITURA_MS })
    await expect(linhasDaLista(page).first()).toContainText('Pronto · 6 páginas', { timeout: PRAZO_DA_LEITURA_MS })
    const edicoes = await edicoesDoMaterialNoBanco(escolaId, id)
    expect(edicoes).toEqual([expect.objectContaining({ titulo: 'Apostila 2026', estado: 'pronto', edicao: '2ª edição' })])
    expect(await seriesDoMaterialNoBanco(escolaId, edicoes[0]?.id ?? '')).toEqual(['ef_anos_finais:6', 'ef_anos_finais:7'])
  })

  test('com a edição em leitura, nem o material nem a edição se corrigem, e o painel diz por quê; sem ela, volta a poder', async ({ page, hasTouch, request }) => {
    await abrirMaterial(page, request, async (feito) => {
      const alvo = await materialPronto(feito, 'Apostila 2026')
      await criarEdicaoEmLeituraNoBanco(feito.coordenadora.escolaId, alvo, 'Apostila 2027')
    })
    const doAlvo = await abrirPainel(page, 'Apostila 2026', hasTouch)
    await expect(doAlvo).toContainText('Espere a edição em processamento terminar.', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoDoTitulo(doAlvo)).toBeDisabled()
    await expect(doAlvo.getByRole('checkbox', { name: SERIE_7 })).toBeDisabled()
    await expect(salvar(doAlvo)).toBeDisabled()
    await expect(doAlvo.getByRole('button', { name: 'Enviar edição nova' })).toHaveCount(0)
    // "Excluir material" continua: a exclusão não espera a edição.
    await expect(doAlvo.getByRole('button', { name: 'Excluir material' })).toBeVisible()
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    await page.keyboard.press('Escape')
    await expect(doAlvo).toHaveCount(0)
    const daEdicao = await abrirPainel(page, 'Apostila 2027', hasTouch)
    await expect(daEdicao).toContainText('Espere a edição em processamento terminar.')
    await expect(campoDoTitulo(daEdicao)).toBeDisabled()
    await expect(salvar(daEdicao)).toBeDisabled()
  })

  test('recomeço: o outro material no mesmo painel, o mesmo de novo, a resposta atrasada e a falha com o painel aberto não deixam nada do anterior', async ({ page, hasTouch, request }) => {
    let idA = ''
    let idB = ''
    await abrirMaterial(page, request, async (feito) => {
      idA = await materialPronto(feito, 'Apostila A', ['Capítulo só de A'])
      idB = await materialPronto(feito, 'Apostila B', ['Capítulo só de B'])
    })
    const segurada = gate()
    await page.route(
      (url) => url.pathname === `/v1/materiais/${idA}`,
      async (rota: Route) => {
        if (rota.request().method() !== 'PATCH') return rota.fallback()
        await segurada.aberta
        return rota.fallback()
      },
    )
    const falhar = { ligada: false }
    await page.route(
      (url) => url.pathname === `/v1/materiais/${idB}`,
      async (rota: Route) => {
        if (rota.request().method() !== 'PATCH' || !falhar.ligada) return rota.fallback()
        return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
      },
    )

    // A resposta atrasada: o `PATCH` de A está no ar quando a pessoa passa a B.
    const painelA = await abrirPainel(page, 'Apostila A', hasTouch)
    await expect(capitulos(painelA)).toContainText('Capítulo só de A', { timeout: SIGN_IN_TIMEOUT_MS })
    await campoDoTitulo(painelA).fill('Rascunho de A')
    await activate(salvar(painelA), hasTouch)
    await expect(painelA.getByRole('button', { name: 'Salvando…' })).toBeVisible()
    await irParaOPainelDe(page, idB)
    const painelB = painelDe(page, 'Apostila B')
    await expect(painelB).toBeVisible()
    await expect(painelDe(page, 'Apostila A')).toHaveCount(0)
    await expect(campoDoTitulo(painelB)).toHaveValue('Apostila B')
    await expect(capitulos(painelB)).toContainText('Capítulo só de B')
    await expect(capitulos(painelB)).not.toContainText('Capítulo só de A')
    await expect(salvar(painelB)).toBeDisabled()
    segurada.abrir()
    await expect(linhaDe(page, 'Rascunho de A')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    // O aviso e o foco do pedido de A não aparecem no painel de B.
    await expect(painelB.getByText(TEXTO_SALVO)).toHaveCount(0)

    // A falha com o painel aberto fica nele: a troca de material a leva, e a volta não a traz.
    falhar.ligada = true
    await campoDoTitulo(painelB).fill('Rascunho de B')
    await activate(salvar(painelB), hasTouch)
    await expect(painelB.getByRole('alert').filter({ hasText: TEXTO_NAO_SALVO })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await irParaOPainelDe(page, idA)
    const outraVezA = painelDe(page, 'Rascunho de A')
    await expect(outraVezA).toBeVisible()
    await expect(outraVezA.getByRole('alert').filter({ hasText: TEXTO_NAO_SALVO })).toHaveCount(0)
    await irParaOPainelDe(page, idB)
    const deNovoB = painelDe(page, 'Apostila B')
    await expect(deNovoB).toBeVisible()
    // O mesmo material de novo é um painel novo: o rascunho e o aviso da tentativa que falhou não voltam.
    await expect(campoDoTitulo(deNovoB)).toHaveValue('Apostila B')
    await expect(deNovoB.getByRole('alert').filter({ hasText: TEXTO_NAO_SALVO })).toHaveCount(0)
    await expect(salvar(deNovoB)).toBeDisabled()
  })

  test('o professor não alcança o painel nem a correção: o endereço da aba cai em "não encontrada", sem pedido de edição ou correção', async ({ page }) => {
    const professora = await criarEquipeComSenha()
    const pedidos: string[] = []
    page.on('request', (pedido: Request) => {
      const { pathname } = new URL(pedido.url())
      if (pedido.method() !== 'GET' && pathname.startsWith('/v1/materiais')) pedidos.push(`${pedido.method()} ${pathname}`)
    })
    const entrada = await page.request.post('/v1/sessao/email', { data: { email: professora.email, senha: professora.senha } })
    expect(entrada.ok(), 'a entrada pela API').toBe(true)
    await page.goto('/coordenacao/material?material=0190f5a0-0000-7000-8000-0000000000ff')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('button', { name: 'Salvar alterações' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enviar edição nova' })).toHaveCount(0)
    expect(pedidos).toEqual([])
  })
})
