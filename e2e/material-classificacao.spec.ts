import type { APIRequestContext, Locator, Page, Request, Route } from '@playwright/test'
import { abrirNavegacao, entrarPelaTelaComSegundoFator, lateral, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { irPelaCoordenacao, linhasDaTabela, paginaNaoRola } from './support/coordenacao.ts'
import {
  corrigirSecaoNoBanco,
  criarCapitulosNoBanco,
  criarMaterialNoBanco,
  criarSecoesNoBanco,
  definirComponenteNoBanco,
  execucoesDaClassificacaoNoBanco,
  habilidadesDoRecorteNoBanco,
  secoesNoBanco,
  vincularMaterialAUmaSerieNoBanco,
} from './support/material.ts'
import { expect, test } from './support/profiles.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga, configurarSegundoFatorPelaApi } from './support/mfa.ts'
import { criarEquipeComSenha, criarTodasAsSeriesNoBanco, montarEstruturaNoBanco, type EquipeDeTeste, type EstruturaDeTeste } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * A classificação do material pela BNCC no painel (classificacao-bncc, 8.0; RF6, RF12; `cenarios.md`, "Telas"), pela tela e com a API de verdade, nos projetos `chromebook` e `celular`: cada capítulo com a situação em texto, a origem e
 * o código com a descrição; o seletor pelo teclado (abre, filtra, o sexto bloqueado, o Esc devolve o foco ao botão); a correção que chega ao banco; o "Reclassificar" com a confirmação; o aviso de quem não tem componente; e o recomeço
 * (a coordenação de B na mesma aba, o material X, Y e X de novo, as habilidades de X seguradas com Y aberto, o `PUT` que falha com a lista relida). O componente da disciplina e as habilidades da BNCC vêm do banco do teste.
 */

/** A mesma expressão de `e2e/support/professor/scenario.ts` (`VOCABULARIO_DE_NOTA`), copiada: a tela inteira não fala em nota, é diagnóstico (D46). */
const VOCABULARIO_DE_NOTA = /\bnotas?\b|\bconceitos?\b|pontuaç/i
const CONFLITO = JSON.stringify({ erro: { codigo: 'CONFLITO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
const TEXTO_DO_CONFLITO = 'Este material ainda não terminou de processar. Corrija as habilidades quando ele estiver pronto.'

const principal = (page: Page) => page.getByRole('main')
const lista = (page: Page) => principal(page).getByRole('region', { name: 'Materiais da escola' })
const linhaDe = (page: Page, titulo: string) => linhasDaTabela(lista(page)).filter({ hasText: titulo })
const painelDe = (page: Page, titulo: string) => page.getByRole('dialog', { name: titulo })
const habilidadesDe = (painel: Locator) => painel.getByRole('region', { name: 'Habilidades da BNCC' })
/** A linha de um capítulo na seção: o `ol` de fora, e não a lista de habilidades de dentro. */
const capituloDe = (painel: Locator, nome: string) => habilidadesDe(painel).locator('ol > li').filter({ hasText: nome })
const corrigir = (capitulo: Locator) => capitulo.getByRole('button', { name: /^Corrigir/ })
const seletorDe = (capitulo: Locator) => capitulo.getByRole('group', { name: /^Habilidades de / })
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

/** Uma escola com as sete séries e uma disciplina de Ciências, e a coordenadora dela na aba Material, entrando pela API. `antes` roda com a sessão ainda fechada. */
async function abrirMaterial(page: Page, request: APIRequestContext, antes?: (cenario: Cenario) => Promise<void>, comComponente = true): Promise<Cenario> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  await criarTodasAsSeriesNoBanco(coordenadora.escolaId)
  const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId)
  if (comComponente) await definirComponenteNoBanco(coordenadora.escolaId, estrutura.disciplina.id, 'ciencias')
  const cenario = { coordenadora, estrutura }
  await antes?.(cenario)
  await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/material', async () => {
    await expect(page).toHaveURL(/\/coordenacao\/material$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByRole('heading', { level: 1, name: 'Escola' })).toBeAttached({ timeout: SIGN_IN_TIMEOUT_MS })
  })
  return cenario
}

/** Um material `pronto` na série do ano dado, com quatro capítulos. Devolve o id. */
async function materialPronto(cenario: Cenario, titulo: string, ano = 7): Promise<string> {
  const { escolaId } = cenario.coordenadora
  const id = await criarMaterialNoBanco(escolaId, cenario.estrutura.disciplina.id, { titulo, estado: 'pronto', paginas: 12 })
  await vincularMaterialAUmaSerieNoBanco(escolaId, id, ano)
  await criarCapitulosNoBanco(
    escolaId,
    id,
    ['Misturas', 'Transformações', 'Energia', 'Ecossistemas'].map((nome, indice) => ({ numero: indice + 1, titulo: nome, paginaInicial: indice * 2 + 1, paginaFinal: indice * 2 + 2 })),
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

/** O material com as cinco situações do seed: classificada pela IA, sem habilidade, não terminou, não agendada, e o bloco de páginas corrigido pela coordenação. */
async function materialComAsCincoSituacoes(cenario: Cenario, titulo: string): Promise<{ id: string; secoes: string[]; codigos: string[] }> {
  const { escolaId } = cenario.coordenadora
  const id = await materialPronto(cenario, titulo)
  const codigos = (await habilidadesDoRecorteNoBanco('ciencias', 7)).map((habilidade) => habilidade.codigo)
  const secoes = await criarSecoesNoBanco(escolaId, id, [
    { paginaInicial: 1, paginaFinal: 2, capituloOrdem: 1, situacao: 'classificada', habilidades: [{ codigo: codigos[0] ?? '', origem: 'ia' }] },
    { paginaInicial: 3, paginaFinal: 4, capituloOrdem: 2, situacao: 'sem_habilidade' },
    { paginaInicial: 5, paginaFinal: 6, capituloOrdem: 3, situacao: 'nao_classificada' },
    { paginaInicial: 7, paginaFinal: 8, capituloOrdem: 4, situacao: 'nao_agendada' },
    { paginaInicial: 9, paginaFinal: 12, situacao: 'classificada', corrigida: true, habilidades: [{ codigo: codigos[1] ?? '', origem: 'coordenacao' }] },
  ])
  return { id, secoes, codigos }
}

const codigoDe = (codigos: readonly string[], indice: number): string => codigos[indice] ?? ''
const descricaoDe = (doRecorte: ReadonlyArray<{ readonly descricao: string }>, indice: number): string => doRecorte[indice]?.descricao ?? ''
type DoRecorte = ReadonlyArray<{ readonly codigo: string; readonly descricao: string }>

/** Cada capítulo com a situação em texto, a origem e o código com a descrição. */
async function conferirOsRotulos(painel: Locator, codigos: readonly string[], doRecorte: DoRecorte): Promise<void> {
  const habilidades = habilidadesDe(painel)
  // A situação de cada capítulo é dita em texto (e o selo leva um glifo, para quem não distingue as cores); a classificada só mostra as habilidades.
  await expect(capituloDe(painel, 'Capítulo 1 · Misturas')).toContainText('Páginas 1 a 2')
  await expect(capituloDe(painel, 'Capítulo 1 · Misturas')).toContainText(`${codigoDe(codigos, 0)} ${descricaoDe(doRecorte, 0)}`)
  await expect(capituloDe(painel, 'Capítulo 1 · Misturas')).toContainText('Sugerida pela IA')
  await expect(capituloDe(painel, 'Capítulo 1 · Misturas').locator('[data-estado]')).toHaveCount(0)
  await expect(capituloDe(painel, 'Capítulo 2 · Transformações')).toContainText('A IA não achou habilidade neste capítulo')
  await expect(capituloDe(painel, 'Capítulo 3 · Energia')).toContainText('A classificação não terminou.')
  await expect(capituloDe(painel, 'Capítulo 3 · Energia').getByRole('button', { name: 'Reclassificar o material' })).toBeVisible()
  await expect(capituloDe(painel, 'Capítulo 4 · Ecossistemas')).toContainText('Ainda não classificado')
  await expect(capituloDe(painel, 'Páginas 9 a 12')).toContainText('Corrigida pela coordenação')
  await expect(capituloDe(painel, 'Páginas 9 a 12')).toContainText(`${codigoDe(codigos, 1)} ${descricaoDe(doRecorte, 1)}`)
  for (const selo of await habilidades.locator('[data-estado]').all()) {
    expect((await selo.textContent())?.trim().length ?? 0).toBeGreaterThan(0)
    await expect(selo.locator('svg')).toHaveCount(1)
  }
  // Na tela a seção é "capítulo" ou "páginas", nunca "trecho" nem "seção", e a tela não fala em nota.
  expect(await habilidades.textContent()).not.toMatch(/\btrechos?\b|\bse[cç][oõ][ae]s?\b/i)
  await expect(painel).not.toContainText(VOCABULARIO_DE_NOTA)
}

/** A medida da tela: sem rolagem, sem violação de axe, uma ação cheia e o alvo do botão. */
async function conferirAMedida(page: Page, painel: Locator, hasTouch: boolean): Promise<void> {
  await paginaNaoRola(page)
  expect(await horizontalOverflow(page)).toBe(0)
  expect(await seriousViolations(page)).toEqual([])
  expect(await botoesCheios(page)).toEqual(['Enviar material'])
  // O alvo da ação principal da linha: 24 px no computador e 44 px no celular (regra 50, item 2a).
  const alvo = await corrigir(capituloDe(painel, 'Capítulo 1 · Misturas')).boundingBox()
  expect(alvo?.height ?? 0).toBeGreaterThanOrEqual(hasTouch ? ALVO_DE_TOQUE_PRINCIPAL_PX : 24)
  expect(alvo?.width ?? 0).toBeGreaterThanOrEqual(hasTouch ? ALVO_DE_TOQUE_PRINCIPAL_PX : 24)
}

/** O seletor pelo teclado: abre com o foco no filtro, filtra por código e por texto, e o Esc o fecha sem fechar o painel. */
async function filtrarEFecharPeloTeclado(page: Page, painel: Locator, capitulo: Locator, botao: Locator, codigos: readonly string[], doRecorte: DoRecorte): Promise<void> {
  // Abre pelo teclado: o foco entra no filtro, que acha pelo código (sem caixa) e pelo texto (sem acento).
  const seletor = seletorDe(capitulo)
  await botao.focus()
  await page.keyboard.press('Enter')
  await expect(seletor.getByRole('searchbox')).toBeFocused({ timeout: SIGN_IN_TIMEOUT_MS })
  await expect(seletor.getByRole('checkbox').first()).toBeVisible()
  await seletor.getByRole('searchbox').fill((codigoDe(codigos, 2)).toLowerCase())
  await expect(seletor.getByRole('checkbox')).toHaveCount(1)
  await expect(seletor.getByRole('checkbox', { name: new RegExp(`^${codigoDe(codigos, 2)}`) })).toBeVisible()
  const palavra = (descricaoDe(doRecorte, 3)).split(' ').find((candidata) => candidata.length > 6) ?? ''
  await seletor.getByRole('searchbox').fill(palavra.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase())
  await expect(seletor.getByRole('checkbox', { name: new RegExp(`^${codigoDe(codigos, 3)}`) })).toBeVisible()
  await seletor.getByRole('searchbox').fill('xyz inexistente')
  await expect(seletor.getByText('Nenhuma habilidade com esse código ou texto.')).toBeVisible()

  // O Esc fecha o seletor, e só ele: o painel segue aberto e o foco volta ao botão de onde a pessoa veio.
  await page.keyboard.press('Escape')
  await expect(seletor).toHaveCount(0)
  await expect(painel).toBeVisible()
  await expect(botao).toBeFocused()
}

/** De cinco em cinco: o sexto fica bloqueado, tirar uma o liberta, e a tela segue sem rolagem lateral nem violação. */
async function escolherAteOTeto(page: Page, seletor: Locator, codigos: readonly string[], hasTouch: boolean): Promise<void> {
  // De volta: o filtro vem vazio, a pessoa escolhe cinco, o sexto fica bloqueado, e tirar uma o liberta.
  await page.keyboard.press('Enter')
  await expect(seletor.getByRole('searchbox')).toHaveValue('')
  // O alvo da linha do seletor: a linha inteira é o rótulo da caixa, de 24 px no computador e 44 px no celular (regra 50, item 2a).
  const linha = await seletor.getByRole('checkbox').first().locator('xpath=ancestor::label').boundingBox()
  expect(linha?.height ?? 0).toBeGreaterThanOrEqual(hasTouch ? ALVO_DE_TOQUE_PRINCIPAL_PX : 24)
  for (const codigo of codigos.slice(0, 5)) await seletor.getByRole('checkbox', { name: new RegExp(`^${codigo}`) }).check()
  await expect(seletor.getByText('5 de 5 escolhidas. Tire uma para escolher outra.')).toBeVisible()
  await expect(seletor.getByRole('checkbox', { name: new RegExp(`^${codigoDe(codigos, 5)}`) })).toBeDisabled()
  await seletor.getByRole('checkbox', { name: new RegExp(`^${codigoDe(codigos, 4)}`) }).uncheck()
  await expect(seletor.getByRole('checkbox', { name: new RegExp(`^${codigoDe(codigos, 5)}`) })).toBeEnabled()
  await seletor.getByRole('checkbox', { name: new RegExp(`^${codigoDe(codigos, 3)}`) }).uncheck()
  await seletor.getByRole('checkbox', { name: new RegExp(`^${codigoDe(codigos, 2)}`) }).uncheck()
  expect(await horizontalOverflow(page)).toBe(0)
  expect(await seriousViolations(page)).toEqual([])
}

test.describe('A classificação do material no painel', () => {
  test('cada capítulo com a situação em texto, a origem e o código com a descrição; 1366 × 768 não rola, 360 px sem rolagem lateral, alvos medidos, uma ação cheia e sem vocabulário de nota', async ({ page, hasTouch, request }) => {
    let codigos: string[] = []
    await abrirMaterial(page, request, async (feito) => {
      codigos = (await materialComAsCincoSituacoes(feito, 'Apostila de Ciências')).codigos
    })
    const doRecorte = await habilidadesDoRecorteNoBanco('ciencias', 7)
    await page.setViewportSize(hasTouch ? { width: 360, height: 740 } : { width: 1366, height: 768 })
    const painel = await abrirPainel(page, 'Apostila de Ciências', hasTouch)
    const habilidades = habilidadesDe(painel)
    await expect(habilidades.locator('ol > li')).toHaveCount(5, { timeout: SIGN_IN_TIMEOUT_MS })

    await conferirOsRotulos(painel, codigos, doRecorte)

    await conferirAMedida(page, painel, hasTouch)
  })

  test('o seletor pelo teclado: abre com o foco no filtro, filtra por código e por texto, o sexto fica bloqueado, o Esc fecha sem fechar o painel e devolve o foco ao botão; salvar grava a correção', async ({ page, hasTouch, request }) => {
    let escolaId = ''
    let materialId = ''
    let codigos: string[] = []
    await abrirMaterial(page, request, async (feito) => {
      escolaId = feito.coordenadora.escolaId
      const criado = await materialComAsCincoSituacoes(feito, 'Apostila de Ciências')
      materialId = criado.id
      codigos = (await habilidadesDoRecorteNoBanco('ciencias', 7)).map((habilidade) => habilidade.codigo)
    })
    const doRecorte = await habilidadesDoRecorteNoBanco('ciencias', 7)
    expect(doRecorte.length).toBeGreaterThan(6)
    const painel = await abrirPainel(page, 'Apostila de Ciências', hasTouch)
    const capitulo = capituloDe(painel, 'Capítulo 4 · Ecossistemas')
    const botao = corrigir(capitulo)
    await expect(botao).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    const seletor = seletorDe(capitulo)
    await filtrarEFecharPeloTeclado(page, painel, capitulo, botao, codigos, doRecorte)

    await escolherAteOTeto(page, seletor, codigos, hasTouch)

    // Salvar: a correção chega ao banco com a origem da coordenação, o capítulo mostra as duas e o foco volta ao botão.
    const resposta = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/habilidades') && r.request().method() === 'PUT')
    await activate(capitulo.getByRole('button', { name: 'Salvar correção' }), hasTouch)
    expect((await resposta).status()).toBe(200)
    await expect(seletor).toHaveCount(0, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(capitulo.getByText('Corrigida pela coordenação')).toHaveCount(2)
    await expect(botao).toBeFocused()
    expect((await secoesNoBanco(escolaId, materialId)).find((registro) => registro.ordem === 4)).toEqual({
      ordem: 4,
      corrigida: true,
      habilidades: [codigos[0], codigos[1]].map((codigo) => ({ codigo, origem: 'coordenacao' })),
    })
  })

  test('"Reclassificar" mostra quantos capítulos refaz e quantos ficam, "Cancelar" não pede nada e devolve o foco, "Confirmar" pede e a tela diz o que a API aceitou', async ({ page, hasTouch, request }) => {
    let escolaId = ''
    let materialId = ''
    let codigos: string[] = []
    await abrirMaterial(page, request, async (feito) => {
      escolaId = feito.coordenadora.escolaId
      const criado = await materialComAsCincoSituacoes(feito, 'Apostila de Ciências')
      materialId = criado.id
      codigos = criado.codigos
    })
    const pedidos: string[] = []
    page.on('request', (pedido: Request) => {
      if (pedido.method() === 'POST' && new URL(pedido.url()).pathname.endsWith('/reclassificar')) pedidos.push(pedido.url())
    })
    const painel = await abrirPainel(page, 'Apostila de Ciências', hasTouch)
    const reclassificar = habilidadesDe(painel).getByRole('button', { name: 'Reclassificar', exact: true })
    await expect(reclassificar).toBeEnabled({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(reclassificar, hasTouch)
    const aviso = habilidadesDe(painel).getByText('4 capítulos serão classificados de novo à noite; 1 corrigido fica como está.')
    await expect(aviso).toBeVisible()
    await expect(aviso).toBeFocused()
    expect(pedidos).toEqual([])
    await activate(habilidadesDe(painel).getByRole('button', { name: 'Cancelar' }), hasTouch)
    await expect(aviso).toHaveCount(0)
    await expect(reclassificar).toBeFocused()
    expect(pedidos).toEqual([])

    const antes = await execucoesDaClassificacaoNoBanco(escolaId)
    await activate(reclassificar, hasTouch)
    const resposta = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/reclassificar'))
    await activate(habilidadesDe(painel).getByRole('button', { name: 'Confirmar' }), hasTouch)
    expect((await resposta).status()).toBe(202)
    const pedido = habilidadesDe(painel).getByText('Pedido feito. 4 capítulos serão classificados de novo à noite; 1 corrigido fica como está.')
    await expect(pedido).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(pedido).toBeFocused()
    expect(pedidos).toHaveLength(1)
    // As execuções da noite foram criadas, e a corrigida não foi tocada.
    expect(await execucoesDaClassificacaoNoBanco(escolaId)).toBeGreaterThan(antes)
    expect((await secoesNoBanco(escolaId, materialId)).find((registro) => registro.ordem === 5)).toEqual({
      ordem: 5,
      corrigida: true,
      habilidades: [{ codigo: codigoDe(codigos, 1), origem: 'coordenacao' }],
    })
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('a disciplina sem componente: o aviso nomeia a disciplina, "Corrigir" e "Reclassificar" ficam desligados e nenhuma candidata é pedida', async ({ page, hasTouch, request }) => {
    const candidatas: string[] = []
    page.on('request', (pedido: Request) => {
      if (new URL(pedido.url()).pathname === '/v1/habilidades-bncc') candidatas.push(pedido.url())
    })
    const cenario = await abrirMaterial(
      page,
      request,
      async (feito) => {
        await materialComAsCincoSituacoes(feito, 'Apostila de Ciências')
      },
      false,
    )
    const painel = await abrirPainel(page, 'Apostila de Ciências', hasTouch)
    await expect(habilidadesDe(painel)).toContainText(`Defina o componente da BNCC de ${cenario.estrutura.disciplina.nome} na Estrutura para classificar este material`, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(corrigir(capituloDe(painel, 'Capítulo 1 · Misturas'))).toBeDisabled()
    await expect(habilidadesDe(painel).getByRole('button', { name: 'Reclassificar', exact: true })).toBeDisabled()
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    expect(candidatas).toEqual([])
  })

  test('recomeço: a coordenação de B entra na mesma aba e o endereço do material de A não abre painel nem mostra as habilidades de A', async ({ page, hasTouch, request }) => {
    let materialDeA = ''
    await abrirMaterial(page, request, async (feito) => {
      materialDeA = (await materialComAsCincoSituacoes(feito, 'Apostila da escola A')).id
    })
    const painelA = await abrirPainel(page, 'Apostila da escola A', hasTouch)
    await expect(capituloDe(painelA, 'Capítulo 1 · Misturas')).toContainText('Sugerida pela IA', { timeout: SIGN_IN_TIMEOUT_MS })
    await page.keyboard.press('Escape')
    await abrirNavegacao(page, hasTouch)
    await activate(lateral(page).getByRole('button', { name: 'Sair' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })

    const deB = await criarEquipeComSenha('coordenador')
    await montarEstruturaNoBanco(deB.escolaId)
    const { segredo } = await configurarSegundoFatorPelaApi(request, deB)
    await entrarPelaTelaComSegundoFator(page, deB, segredo, hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/painel$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await irPelaCoordenacao(page, 'Material', hasTouch)
    await expect(lista(page).getByText('Nenhum material ainda')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    // Sem recarregar: o endereço do material de A, dentro da aba de B.
    await irParaOPainelDe(page, materialDeA)
    // O endereço do material de A está mesmo na aba de B: as ausências abaixo valem depois da navegação.
    await expect(page).toHaveURL(new RegExp(`material=${materialDeA}`))
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('Apostila da escola A')
    await expect(page.locator('body')).not.toContainText('Sugerida pela IA')
    await expect(page.locator('body')).not.toContainText('Capítulo 1 · Misturas')
  })

  test('recomeço: o material X, o Y e o X de novo no mesmo painel: o seletor volta fechado e o filtro vazio', async ({ page, hasTouch, request }) => {
    let idX = ''
    let idY = ''
    await abrirMaterial(page, request, async (feito) => {
      idX = (await materialComAsCincoSituacoes(feito, 'Apostila X')).id
      idY = (await materialComAsCincoSituacoes(feito, 'Apostila Y')).id
    })
    const painelX = await abrirPainel(page, 'Apostila X', hasTouch)
    await activate(corrigir(capituloDe(painelX, 'Capítulo 4 · Ecossistemas')), hasTouch)
    await expect(seletorDe(capituloDe(painelX, 'Capítulo 4 · Ecossistemas'))).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await seletorDe(capituloDe(painelX, 'Capítulo 4 · Ecossistemas')).getByRole('searchbox').fill('rascunho de X')

    await irParaOPainelDe(page, idY)
    const painelY = painelDe(page, 'Apostila Y')
    await expect(painelY).toBeVisible()
    await expect(habilidadesDe(painelY).locator('ol > li')).toHaveCount(5, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(seletorDe(capituloDe(painelY, 'Capítulo 4 · Ecossistemas'))).toHaveCount(0)
    await expect(page.getByRole('searchbox')).toHaveCount(0)

    await irParaOPainelDe(page, idX)
    const deNovoX = painelDe(page, 'Apostila X')
    await expect(deNovoX).toBeVisible()
    await expect(habilidadesDe(deNovoX).locator('ol > li')).toHaveCount(5, { timeout: SIGN_IN_TIMEOUT_MS })
    // O seletor da tentativa anterior não volta, e o filtro, quando se abre, vem vazio.
    await expect(seletorDe(capituloDe(deNovoX, 'Capítulo 4 · Ecossistemas'))).toHaveCount(0)
    await activate(corrigir(capituloDe(deNovoX, 'Capítulo 4 · Ecossistemas')), hasTouch)
    await expect(seletorDe(capituloDe(deNovoX, 'Capítulo 4 · Ecossistemas')).getByRole('searchbox')).toHaveValue('')
    expect(idX).not.toBe(idY)
  })

  test('recomeço: as habilidades de X seguradas com Y aberto: as de X não aparecem no seletor de Y', async ({ page, hasTouch, request }) => {
    let idX = ''
    let idY = ''
    await abrirMaterial(page, request, async (feito) => {
      // X é do 7º ano e Y é do 6º: as candidatas de um não são as do outro.
      idX = (await materialComAsCincoSituacoes(feito, 'Apostila X')).id
      const { escolaId } = feito.coordenadora
      idY = await criarMaterialNoBanco(escolaId, feito.estrutura.disciplina.id, { titulo: 'Apostila Y', estado: 'pronto', paginas: 4 })
      await vincularMaterialAUmaSerieNoBanco(escolaId, idY, 6)
      await criarCapitulosNoBanco(escolaId, idY, [{ numero: 1, titulo: 'Capítulo do sexto', paginaInicial: 1, paginaFinal: 4 }])
      await criarSecoesNoBanco(escolaId, idY, [{ paginaInicial: 1, paginaFinal: 4, capituloOrdem: 1, situacao: 'nao_agendada' }])
    })
    const segurada = gate()
    const liberada = gate()
    const liberadoDeX = liberada.aberta
    await page.route(
      (url) => url.pathname === '/v1/habilidades-bncc' && url.searchParams.get('materialId') === idX,
      async (rota: Route) => {
        await segurada.aberta
        // Se a tela já cancelou o pedido ao abrir Y, a rota não tem mais o que continuar: a liberação vale do mesmo jeito.
        await rota.fallback().catch(() => undefined)
        liberada.abrir()
      },
    )
    const painelX = await abrirPainel(page, 'Apostila X', hasTouch)
    await activate(corrigir(capituloDe(painelX, 'Capítulo 4 · Ecossistemas')), hasTouch)
    await expect(seletorDe(capituloDe(painelX, 'Capítulo 4 · Ecossistemas')).getByText('Carregando as habilidades…')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    await irParaOPainelDe(page, idY)
    const painelY = painelDe(page, 'Apostila Y')
    await expect(painelY).toBeVisible()
    await activate(corrigir(capituloDe(painelY, 'Capítulo 1 · Capítulo do sexto')), hasTouch)
    const seletorY = seletorDe(capituloDe(painelY, 'Capítulo 1 · Capítulo do sexto'))
    await expect(seletorY.getByRole('checkbox').first()).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(seletorY.getByRole('checkbox', { name: /^EF06CI/ }).first()).toBeVisible()
    segurada.abrir()
    await liberadoDeX
    // O pedido de X foi liberado (e a tela o pode ter cancelado ao abrir Y): nada dele entra no seletor de Y.
    await expect.poll(() => seletorY.getByRole('checkbox', { name: /^EF07CI/ }).count(), { message: 'o seletor de Y não pode ter habilidade do 7º ano' }).toBe(0)
    await expect(seletorY.getByRole('checkbox', { name: /^EF06CI/ }).first()).toBeVisible()
  })

  test('recomeço: o `PUT` que falha e a leitura que traz o capítulo já corrigido por outra pessoa: o editor e o erro saem, o foco volta ao "Corrigir"', async ({ page, hasTouch, request }) => {
    let escolaId = ''
    let materialId = ''
    let secoes: string[] = []
    let codigos: string[] = []
    await abrirMaterial(page, request, async (feito) => {
      escolaId = feito.coordenadora.escolaId
      const criado = await materialComAsCincoSituacoes(feito, 'Apostila de Ciências')
      materialId = criado.id
      secoes = criado.secoes
      codigos = criado.codigos
    })
    let derrubar = true
    let leiturasNoAr = 0
    const ehALeitura = (pedido: Request) => pedido.method() === 'GET' && new URL(pedido.url()).pathname === `/v1/materiais/${materialId}`
    page.on('request', (pedido) => {
      if (ehALeitura(pedido)) leiturasNoAr += 1
    })
    const terminou = (pedido: Request) => {
      if (ehALeitura(pedido)) leiturasNoAr -= 1
    }
    page.on('requestfinished', terminou)
    page.on('requestfailed', terminou)
    await page.route(
      (url) => url.pathname.endsWith('/habilidades') && url.pathname.includes('/secoes/'),
      async (rota: Route) => {
        if (rota.request().method() !== 'PUT' || !derrubar) return rota.fallback()
        derrubar = false
        return rota.fulfill({ status: 409, contentType: 'application/json', body: CONFLITO })
      },
    )
    const painel = await abrirPainel(page, 'Apostila de Ciências', hasTouch)
    const capitulo = capituloDe(painel, 'Capítulo 4 · Ecossistemas')
    await activate(corrigir(capitulo), hasTouch)
    await expect(seletorDe(capitulo).getByRole('checkbox').first()).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await seletorDe(capitulo).getByRole('checkbox', { name: new RegExp(`^${codigos[2] ?? ''}`) }).check()

    // Sem a leitura relida, a falha fica no editor, com o texto da tela e o foco nela.
    await activate(capitulo.getByRole('button', { name: 'Salvar correção' }), hasTouch)
    const alerta = capitulo.getByRole('alert')
    await expect(alerta).toHaveText(TEXTO_DO_CONFLITO, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(alerta).toBeFocused()

    // Outra pessoa corrige o capítulo por fora, depois de a leitura que a primeira falha pediu terminar (uma releitura no ar vale pelas duas: a segunda não a refaz); a falha seguinte traz o que mudou, e o editor, o rascunho e o erro saem.
    await expect.poll(() => leiturasNoAr, { message: 'a releitura da primeira falha terminou' }).toBe(0)
    await corrigirSecaoNoBanco(escolaId, secoes[3] ?? '', [codigos[3] ?? ''])
    derrubar = true
    await activate(capitulo.getByRole('button', { name: 'Salvar correção' }), hasTouch)
    await expect(capitulo.getByText('Corrigida pela coordenação')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(seletorDe(capitulo)).toHaveCount(0)
    await expect(capitulo.getByRole('alert')).toHaveCount(0)
    await expect(corrigir(capitulo)).toBeFocused()
    expect((await secoesNoBanco(escolaId, materialId)).find((registro) => registro.ordem === 4)?.habilidades).toEqual([{ codigo: codigos[3], origem: 'coordenacao' }])
  })
})
