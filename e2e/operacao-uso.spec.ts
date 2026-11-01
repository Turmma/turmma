import type { Page, Route } from '@playwright/test'
import type { OrdemDoPainel, UsoDoPainelResponse } from '../packages/shared/src/operacao/painel.ts'
import { criarOperadorComSegundoFator as criarOperador, removerOperador, type OperadorDeTeste } from './support/operacao.ts'
import {
  criarRedeDoPainel,
  definirUsoDaEscolaSemeada,
  escolasComOEndereco,
  nomeQueVemPrimeiro,
  removerEscolaSemConvite,
  removerPainel,
  semearEscolaDoConvite,
  semearPainel,
  type EscolaDoConvite,
  type PainelSemeado,
  type UsoDoPainel,
} from './support/painel.ts'
import { expect, test } from './support/profiles.ts'
import { activate, conferirAListaQueRola, conferirQueCadaNumeroFicaEmUmaLinha, entrarNaOperacao, SIGN_IN_TIMEOUT_MS, trocarAPrimeiraDaResposta } from './support/operacao-screen.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, rawCodePattern, horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * Uso (A0b, tarefa 8.0; cenários W6, W7 e a data de referência), nos projetos `chromebook` e `celular`. A lista é de todas
 * as escolas do banco de teste, que na máquina guarda as das outras suítes e na esteira começa vazio em cada fatia (o caso
 * que só precisa de uma escola semeia a sua). Cada teste confere a tela contra a resposta que ela mesma recebeu, e acha as
 * suas escolas numa página fixa: a primeira por uso, onde as do `semearPainel` têm o maior uso do banco, ou a primeira por
 * nome, com o `nomeQueVemPrimeiro`. Nenhum percorre a lista inteira (o limite do operador é por minuto).
 */

/** O `GET` do uso, com a página e a ordem na query string. */
const ROTA_DO_USO = (url: URL) => url.pathname === '/v1/operacao/uso'
const TEXTO_DO_503 = 'O Turmma está indisponível agora. Tente de novo em instantes.'
const numero = new Intl.NumberFormat('pt-BR')

const operadores: string[] = []
const paineis: PainelSemeado[] = []
const escolasAvulsas: EscolaDoConvite[] = []

async function novoOperador(): Promise<OperadorDeTeste> {
  const operador = await criarOperador()
  operadores.push(operador.operadorId)
  return operador
}

/** O uso das escolas do painel e a conta de quantas ficam na frente de quem as procura estão em `UsoDoPainel`. */
async function novoPainel(uso: UsoDoPainel): Promise<PainelSemeado> {
  const painel = await semearPainel(uso)
  paineis.push(painel)
  return painel
}

/**
 * Uma escola no banco, para o caso que só precisa de a lista não estar vazia. Cada fatia do e2e na esteira começa com o
 * banco vazio e roda uma parte dos casos: o que conta com a escola que outro caso deixou passa na máquina e cai na fatia
 * em que nenhum outro semeou. Uma só, sem uso, e não as 30 do painel: não entra na frente das escolas dos W6 na ordem por
 * uso. O `afterEach` a apaga.
 */
async function umaEscolaNoBanco(): Promise<void> {
  escolasAvulsas.push(await semearEscolaDoConvite('sem_convite'))
}

test.afterEach(async () => {
  for (const operadorId of operadores.splice(0)) await removerOperador(operadorId)
  for (const painel of paineis.splice(0)) await removerPainel(painel)
  for (const escola of escolasAvulsas.splice(0)) await removerEscolaSemConvite(escola)
})

function envelope(codigo: string) {
  return JSON.stringify({ erro: { codigo, mensagem: 'texto da API que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
}

/** A resposta do `GET` do uso com aquela página e ordem, esperada a partir de agora. */
function respostaDoUso(page: Page, pagina: number, ordem: OrdemDoPainel) {
  return page.waitForResponse((resposta) => {
    const url = new URL(resposta.url())
    return ROTA_DO_USO(url) && url.searchParams.get('pagina') === String(pagina) && url.searchParams.get('ordem') === ordem && resposta.ok()
  })
}

/** Um item da navegação da operação, pelo toque no celular e pelo clique no Chromebook. */
async function irPelaNavegacao(page: Page, item: 'Escolas' | 'Uso', hasTouch: boolean): Promise<void> {
  const link = page.getByRole('navigation', { name: 'Operação' }).getByRole('link', { name: item, exact: true })
  if (hasTouch) await link.tap()
  else await link.click()
}

interface EscolaNaTela {
  readonly nome: string
  /** As seis medidas, na ordem da tela: o dia (requisições, tarefas, armazenamento), depois o mês. */
  readonly valores: string[]
}

/** As escolas na tela, na ordem, com as medidas: as linhas da tabela no Chromebook, os cartões no celular. */
async function usoNaTela(page: Page): Promise<EscolaNaTela[]> {
  const tabela = page.getByRole('table')
  if (await tabela.isVisible()) {
    const linhas = await tabela.locator('tbody tr').all()
    return Promise.all(linhas.map(async (linha) => ({ nome: (await linha.getByRole('rowheader').textContent()) ?? '', valores: await linha.getByRole('cell').allTextContents() })))
  }
  const cartoes = await page.getByRole('main').getByRole('listitem').all()
  return Promise.all(
    cartoes.map(async (cartao) => ({ nome: (await cartao.getByRole('heading', { level: 2 }).textContent()) ?? '', valores: await cartao.getByRole('definition').allTextContents() })),
  )
}

const nomesNaTela = async (page: Page) => (await usoNaTela(page)).map((escola) => escola.nome)

/** `2026-09-23` → `23/09/2026`, para conferir a data de referência que a API mandou. */
const comoDia = (dia: string) => dia.split('-').reverse().join('/')

test.describe('Uso (A0b, tarefa 8.0)', () => {
  test('W6: 30 escolas, página e ordem na barra, o uso de cada escola nas colunas dela, e sem rolagem a 360 px', async ({ page, hasTouch }) => {
    test.slow()
    // No topo da ordem por uso, com só as 2 escolas que o caso afirma: na frente delas ficam no máximo as 2 do W6 do outro
    // projeto, e não os painéis que os outros casos semeiam ao mesmo tempo (a máquina roda o e2e com 6 trabalhadores).
    const painel = await novoPainel('topo')
    // Uma das escolas com uso ganha tarefas e armazenamento: a tela mostra cada medida no formato dela.
    const comMedidas = painel.porEstado.sem_convite
    await definirUsoDaEscolaSemeada(comMedidas.id, { jobs: 1234, bytesStorage: 1_288_490_189 })
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)

    // "Uso" na navegação, marcado como a página atual.
    const primeira = respostaDoUso(page, 1, 'nome')
    await irPelaNavegacao(page, 'Uso', hasTouch)
    await expect(page).toHaveURL(/\/operacao\/uso$/)
    await expect(page.getByRole('navigation', { name: 'Operação' }).getByRole('link', { name: 'Uso' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('navigation', { name: 'Operação' }).getByRole('link', { name: 'Escolas' })).not.toHaveAttribute('aria-current', 'page')
    await expect(page).toHaveTitle('Uso · Operação Turmma')
    const porNome = (await (await primeira).json()) as UsoDoPainelResponse
    await expect.poll(() => nomesNaTela(page)).toEqual(porNome.itens.map((escola) => escola.nome))
    expect(porNome.total).toBeGreaterThanOrEqual(30)
    await expect(page.getByRole('navigation', { name: 'Páginas do uso' })).toContainText(`Página 1 de ${String(Math.ceil(porNome.total / 25))}`)
    await expect(page.getByRole('main')).toContainText(`Último dia fechado: ${comoDia(porNome.dia)}.`)

    // A ordem por uso vai à barra e volta à primeira página; as escolas do teste, com o maior uso do banco, estão nela.
    const porUsoResposta = respostaDoUso(page, 1, 'uso')
    await activate(page, 'Mais uso no mês', hasTouch)
    const porUso = (await (await porUsoResposta).json()) as UsoDoPainelResponse
    await expect(page).toHaveURL(/\/operacao\/uso\?pagina=1&ordem=uso$/)
    await expect(page.getByRole('button', { name: 'Mais uso no mês' })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => nomesNaTela(page)).toEqual(porUso.itens.map((escola) => escola.nome))

    // As duas escolas do teste com mais uso (a de nome no limite e a com tarefas e armazenamento), cada uma com o seu uso,
    // na ordem do uso e nas colunas dela: o mês delas tem só a linha do dia de referência, e por isso soma e pico são os do
    // dia. Só as duas: o W6 do outro projeto semeia ao mesmo tempo, também no topo, e passa as oito dele na frente; elas
    // seguem na primeira página, que tem 25.
    const naTela = await usoNaTela(page)
    const semeadas = painel.escolas.slice(0, 2)
    expect(semeadas.map((escola) => escola.id)).toEqual([painel.longa.id, comMedidas.id])
    const posicoes = semeadas.map((escola) => porUso.itens.findIndex((item) => item.id === escola.id))
    expect(posicoes.every((posicao) => posicao >= 0)).toBe(true)
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b))
    for (const [indice, escola] of semeadas.entries()) {
      const posicao = posicoes[indice] ?? -1
      const requisicoes = numero.format(porUso.itens[posicao]?.dia.requisicoes ?? -1)
      const [tarefas, armazenamento] = escola.id === comMedidas.id ? ['1.234', '1,2 GB'] : ['0', '0 bytes']
      expect(naTela[posicao], escola.nome).toEqual({ nome: escola.nome, valores: [requisicoes, tarefas, armazenamento, requisicoes, tarefas, armazenamento] })
    }

    // A escola de nome no limite cabe na tela, sem rolagem horizontal, também a 360 px; os alvos de toque têm 44 px.
    expect(naTela.map((escola) => escola.nome)).toContain(painel.longa.nome)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    for (const nome of ['Próxima', 'Nome', 'Mais uso no mês']) {
      const caixa = await page.getByRole('button', { name: nome, exact: true }).boundingBox()
      expect(caixa?.height ?? 0, nome).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect(caixa?.width ?? 0, nome).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    }
    for (const item of ['Escolas', 'Uso']) {
      const caixa = await page.getByRole('navigation', { name: 'Operação' }).getByRole('link', { name: item, exact: true }).boundingBox()
      expect(caixa?.height ?? 0, item).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect(caixa?.width ?? 0, item).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    }

    // A página seguinte vai à barra; a anterior fica na tela, marcada como ocupada, até ela chegar (`placeholderData`).
    let soltarSegunda: () => void = () => undefined
    const segundaSegura = new Promise<void>((resolver) => {
      soltarSegunda = resolver
    })
    const segurarSegunda = async (rota: Route) => {
      if (new URL(rota.request().url()).searchParams.get('pagina') === '2') await segundaSegura
      return rota.fallback()
    }
    await page.route(ROTA_DO_USO, segurarSegunda)
    const segundaResposta = respostaDoUso(page, 2, 'uso')
    await activate(page, 'Próxima', hasTouch)
    await expect(page).toHaveURL(/\/operacao\/uso\?pagina=2&ordem=uso$/)
    await expect(page.getByRole('region', { name: 'Uso por escola' })).toHaveAttribute('aria-busy', 'true')
    expect(await nomesNaTela(page)).toEqual(porUso.itens.map((escola) => escola.nome))
    await expect(page.getByRole('status').filter({ hasText: 'Carregando o uso das escolas…' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Próxima' })).toBeDisabled()
    soltarSegunda()
    const segunda = (await (await segundaResposta).json()) as UsoDoPainelResponse
    await page.unroute(ROTA_DO_USO, segurarSegunda)
    await expect(page.getByRole('region', { name: 'Uso por escola' })).toHaveAttribute('aria-busy', 'false')
    await expect.poll(() => nomesNaTela(page)).toEqual(segunda.itens.map((escola) => escola.nome))
    for (const escola of semeadas) expect(segunda.itens.map((item) => item.id)).not.toContain(escola.id)
    await expect(page.getByRole('navigation', { name: 'Páginas do uso' })).toContainText(`Página 2 de ${String(Math.ceil(segunda.total / 25))}`)
    expect(await horizontalOverflow(page)).toBe(0)

    // O endereço copiado abre a mesma página: a página e a ordem vêm da barra, não da memória da aba.
    const recarregada = respostaDoUso(page, 2, 'uso')
    await page.reload()
    const depoisDaRecarga = (await (await recarregada).json()) as UsoDoPainelResponse
    await expect(page.getByRole('button', { name: 'Mais uso no mês' })).toHaveAttribute('aria-pressed', 'true', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('navigation', { name: 'Páginas do uso' })).toContainText(`Página 2 de ${String(Math.ceil(depoisDaRecarga.total / 25))}`)
    await expect.poll(() => nomesNaTela(page)).toEqual(depoisDaRecarga.itens.map((escola) => escola.nome))

    // "Anterior" volta à primeira página, na mesma ordem, com as escolas do teste.
    const devolta = respostaDoUso(page, 1, 'uso')
    await activate(page, 'Anterior', hasTouch)
    const primeiraDeNovo = (await (await devolta).json()) as UsoDoPainelResponse
    await expect(page).toHaveURL(/\/operacao\/uso\?pagina=1&ordem=uso$/)
    await expect.poll(() => nomesNaTela(page)).toEqual(primeiraDeNovo.itens.map((escola) => escola.nome))
    for (const escola of semeadas) expect(primeiraDeNovo.itens.map((item) => item.id)).toContain(escola.id)
    await expect(page.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  })

  test('14.4: as medidas de uma escola com números grandes ficam inteiras na linha, a 360 e a 1366 px', async ({ page, hasTouch }) => {
    test.slow()
    await novoPainel('nenhum')
    const operador = await novoOperador()
    const grande = { requisicoes: 1_234_567_890, jobs: 1_234_567, bytesStorage: 123_456_789_012 }
    await trocarAPrimeiraDaResposta(page, ROTA_DO_USO, (escola) => ({ ...escola, dia: grande, mes: grande }))
    await entrarNaOperacao(page, operador, hasTouch)
    await irPelaNavegacao(page, 'Uso', hasTouch)
    // Dia e mês trazem o mesmo número: dois trechos de cada, ou uma linha de cartão para cada.
    const numeros = ['1.234.567.890', '1.234.567', '115 GB']
    await conferirQueCadaNumeroFicaEmUmaLinha(page, numeros)
    expect(await horizontalOverflow(page)).toBe(0)
    // A tabela mais estreita que há, a 768 px (abaixo dela é a lista de cartões): as colunas apertam, e o número ainda não quebra.
    if (!hasTouch) {
      await page.setViewportSize({ width: 768, height: 800 })
      await conferirQueCadaNumeroFicaEmUmaLinha(page, numeros)
      expect(await horizontalOverflow(page)).toBe(0)
    }
  })

  test('RF23: no Chromebook a página não rola e a lista rola por dentro, pelo teclado; no celular a página rola e nada rola de lado', async ({ page, hasTouch }) => {
    test.slow()
    await novoPainel('nenhum')
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)
    await irPelaNavegacao(page, 'Uso', hasTouch)
    await expect.poll(() => nomesNaTela(page), { timeout: SIGN_IN_TIMEOUT_MS }).not.toEqual([])
    if (hasTouch) {
      expect(await horizontalOverflow(page)).toBe(0)
      return
    }
    await conferirAListaQueRola(page, 'Uso por escola', 'Páginas do uso')
  })

  test('sem sessão, o endereço do Uso leva à entrada da operação, sem mostrar uso nenhum', async ({ page }) => {
    let pedidosDoUso = 0
    page.on('request', (pedido) => {
      if (ROTA_DO_USO(new URL(pedido.url()))) pedidosDoUso++
    })
    await page.goto('/operacao/uso?pagina=2&ordem=uso')
    await expect(page).toHaveURL(/\/operacao\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('heading', { name: 'Entrar na operação' })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    expect(pedidosDoUso).toBe(0)
  })

  test('W7: carregando, vazio com o link para Escolas, erro com "Tentar de novo" e com dado, com axe em todos', async ({ page, hasTouch }) => {
    test.slow()
    await umaEscolaNoBanco()
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)

    // O uso fica seguro até o teste olhar o carregando, e então chega vazio.
    let soltar: () => void = () => undefined
    const segura = new Promise<void>((resolver) => {
      soltar = resolver
    })
    const vazio = async (rota: Route) => {
      await segura
      await rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], pagina: 1, total: 0, dia: '2026-09-23', mes: '2026-09' }) })
    }
    await page.route(ROTA_DO_USO, vazio)
    await irPelaNavegacao(page, 'Uso', hasTouch)
    await expect(page.getByRole('status').filter({ hasText: 'Carregando o uso das escolas…' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    soltar()
    await expect(page.getByRole('main')).toContainText('Nenhuma escola ainda.', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('main')).toContainText('O uso de cada escola aparece aqui assim que ela é criada.')
    const paraEscolas = page.getByRole('main').getByRole('button', { name: 'Ir para Escolas' })
    await expect(paraEscolas).toBeVisible()
    const caixa = await paraEscolas.boundingBox()
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    await expect(page.getByRole('navigation', { name: 'Páginas do uso' })).toHaveCount(0)
    await expect(page.getByRole('table')).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    // O botão do vazio (a peça `EmptyState`) leva a Escolas, onde a escola se cria.
    if (hasTouch) await paraEscolas.tap()
    else await paraEscolas.click()
    await expect(page).toHaveURL(/\/operacao$/)
    await expect(page.getByRole('navigation', { name: 'Operação' }).getByRole('link', { name: 'Escolas' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('main').getByRole('button', { name: 'Nova escola' })).toBeVisible()

    // O 503: a mensagem e o "Tentar de novo", e a tela fica. Tentando de novo com a API de volta, o uso de verdade.
    await page.unroute(ROTA_DO_USO, vazio)
    const falhar = (rota: Route) => rota.fulfill({ status: 503, contentType: 'application/json', body: envelope('INDISPONIVEL_TENTE_DE_NOVO') })
    await page.route(ROTA_DO_USO, falhar)
    await page.goto('/operacao/uso')
    await expect(page.getByRole('alert')).toHaveText(TEXTO_DO_503, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page).toHaveURL(/\/operacao\/uso$/)
    await expect(page.getByRole('main')).not.toContainText(rawCodePattern('503'))
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    await page.unroute(ROTA_DO_USO, falhar)
    const lista = respostaDoUso(page, 1, 'nome')
    await activate(page, 'Tentar de novo', hasTouch)
    const dados = (await (await lista).json()) as UsoDoPainelResponse
    await expect.poll(() => nomesNaTela(page)).toEqual(dados.itens.map((escola) => escola.nome))
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    // Com o uso na tela, a busca seguinte falha (a volta à aba com o dado já velho): a mensagem e o "Tentar de novo" em
    // cima, e o uso que já estava fica. Tentando de novo com a API de volta, a mensagem sai.
    await page.route(ROTA_DO_USO, falhar)
    await page.clock.setFixedTime(new Date(Date.now() + 60_000))
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
    await expect(page.getByRole('region', { name: 'Uso por escola' }).getByRole('alert')).toHaveText(TEXTO_DO_503, { timeout: SIGN_IN_TIMEOUT_MS })
    expect(await nomesNaTela(page)).toEqual(dados.itens.map((escola) => escola.nome))
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await page.unroute(ROTA_DO_USO, falhar)
    const denovo = respostaDoUso(page, 1, 'nome')
    await activate(page, 'Tentar de novo', hasTouch)
    await denovo
    await expect(page.getByRole('alert')).toHaveCount(0)

    // A página além da última (endereço digitado): o vazio dela, com o caminho de volta à primeira.
    const alemDaUltima = (rota: Route) =>
      rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], pagina: 9999, total: 30, dia: '2026-09-23', mes: '2026-09' }) })
    await page.route(ROTA_DO_USO, alemDaUltima)
    await page.goto('/operacao/uso?pagina=9999&ordem=uso')
    await expect(page.getByRole('main')).toContainText('Não há escolas nesta página.', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('main')).toContainText('A lista tem 2 páginas.')
    expect(await seriousViolations(page)).toEqual([])
    await page.unroute(ROTA_DO_USO, alemDaUltima)
    await activate(page, 'Ir para a primeira página', hasTouch)
    await expect(page).toHaveURL(/\/operacao\/uso\?pagina=1&ordem=uso$/)
    await expect.poll(() => nomesNaTela(page), { timeout: SIGN_IN_TIMEOUT_MS }).not.toEqual([])
  })

  test('referência: o dia e o mês são os que a API devolveu, e não os de hoje no navegador; cada período nas suas colunas', async ({ page, hasTouch }) => {
    test.slow()
    await umaEscolaNoBanco()
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)

    // A resposta de verdade, com outra referência (a virada de ano) e medidas diferentes no dia e no mês da primeira
    // escola: o que a tela mostra só pode ter vindo daqui.
    let diaDeVerdade: string | undefined
    const trocada = async (rota: Route) => {
      const resposta = await rota.fetch()
      const corpo = (await resposta.json()) as UsoDoPainelResponse
      diaDeVerdade = corpo.dia
      const [primeira, ...resto] = corpo.itens
      if (primeira === undefined) throw new Error('o banco de teste não tem escola para a referência')
      const itens = [{ ...primeira, dia: { requisicoes: 1234, jobs: 0, bytesStorage: 1023 }, mes: { requisicoes: 98_765, jobs: 12, bytesStorage: 1_288_490_189 } }, ...resto]
      await rota.fulfill({ response: resposta, json: { ...corpo, itens, dia: '2025-12-31', mes: '2025-12' } })
    }
    await page.route(ROTA_DO_USO, trocada)
    await irPelaNavegacao(page, 'Uso', hasTouch)

    const principal = page.getByRole('main')
    await expect(principal).toContainText('Último dia fechado: 31/12/2025. Mês: dezembro de 2025, até 31/12.', { timeout: SIGN_IN_TIMEOUT_MS })
    const hojeNoNavegador = await page.evaluate(() => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()))
    expect(diaDeVerdade).toBeDefined()
    await expect(principal).not.toContainText(hojeNoNavegador)
    await expect(principal).not.toContainText(comoDia(diaDeVerdade ?? ''))

    // A primeira escola: o dia nas três primeiras colunas (ou no primeiro bloco do cartão) e o mês nas três seguintes.
    const [primeira] = await usoNaTela(page)
    expect(primeira?.valores).toEqual(['1.234', '0', '1.023 bytes', '98.765', '12', '1,2 GB'])
    const titulosDosPeriodos = ['Dia 31/12/2025', 'Mês: dezembro de 2025, até 31/12']
    if (await page.getByRole('table').isVisible()) {
      for (const titulo of titulosDosPeriodos) await expect(page.getByRole('columnheader', { name: titulo })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Tarefas em segundo plano' })).toHaveCount(2)
    } else {
      const cartao = principal.getByRole('listitem').first()
      expect(await cartao.getByRole('heading', { level: 3 }).allTextContents()).toEqual(titulosDosPeriodos)
      expect(await cartao.getByRole('term').allTextContents()).toEqual(['Requisições', 'Tarefas em segundo plano', 'Armazenamento', 'Requisições', 'Tarefas em segundo plano', 'Armazenamento'])
    }
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('a escola criada pela tela entra no Uso com zero, mesmo com o Uso aberto há pouco no cache', async ({ page, hasTouch }) => {
    test.slow()
    await umaEscolaNoBanco()
    const rede = await criarRedeDoPainel()
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)

    // O Uso visitado antes da criação: a primeira página por nome fica no cache.
    const antes = respostaDoUso(page, 1, 'nome')
    await irPelaNavegacao(page, 'Uso', hasTouch)
    await antes
    await expect.poll(() => nomesNaTela(page), { timeout: SIGN_IN_TIMEOUT_MS }).not.toEqual([])
    // O relógio do navegador para aqui (os temporizadores seguem): o cache do Uso não envelhece sozinho durante o teste, e
    // só a criação da escola pode fazê-lo buscar de novo.
    await page.clock.setFixedTime(new Date())

    await irPelaNavegacao(page, 'Escolas', hasTouch)
    const nome = nomeQueVemPrimeiro('Escola sintética do uso')
    const endereco = `uso-${crypto.randomUUID().slice(0, 8)}`
    await activate(page, 'Nova escola', hasTouch)
    const dialogo = page.getByRole('dialog')
    await dialogo.getByLabel('Rede').selectOption(rede.id, { timeout: SIGN_IN_TIMEOUT_MS })
    await dialogo.getByLabel('Nome da escola').fill(nome)
    await dialogo.getByLabel('Endereço da escola').fill(endereco)
    await activate(page, 'Revisar', hasTouch)
    await activate(page, 'Criar escola', hasTouch)
    await expect(page.getByRole('status').filter({ hasText: `Escola ${nome} criada.` })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(await escolasComOEndereco(endereco)).toHaveLength(1)

    // De volta ao Uso: a página busca de novo, e a escola nova, sem uso consolidado, aparece com zero no dia e no mês.
    const depois = respostaDoUso(page, 1, 'nome')
    await irPelaNavegacao(page, 'Uso', hasTouch)
    const lista = (await (await depois).json()) as UsoDoPainelResponse
    expect(lista.itens.map((escola) => escola.nome)).toContain(nome)
    await expect.poll(async () => (await usoNaTela(page)).find((escola) => escola.nome === nome)?.valores).toEqual(['0', '0', '0 bytes', '0', '0', '0 bytes'])
    expect(await horizontalOverflow(page)).toBe(0)
  })
})
