import type { Locator, Page, Request, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import type { EscolasDoPainelResponse } from '../packages/shared/src/operacao/painel.ts'
import { TEXTO_DO_ESTADO } from '../apps/web/src/operacao/estados-da-escola.ts'
import { codigoDoOperador, criarOperadorComSegundoFator as criarOperador, encerrarSessoesDoOperador, removerOperador, type OperadorDeTeste } from './support/operacao.ts'
import { criarRedeDoPainel, escolasComOEndereco, nomeDeRedeQueVemPrimeiro, redesComONome, removerPainel, semearPainel, type PainelSemeado, type UsoDoPainel } from './support/painel.ts'
import { expect, test } from './support/profiles.ts'
import { acionar, conferirAListaQueRola, conferirQueCadaNumeroFicaEmUmaLinha, entrarNaOperacao, PRAZO_DA_ENTRADA_MS, trocarAPrimeiraDaResposta } from './support/operacao-screen.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, codigoCru, larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './support/checks.ts'

/**
 * Escolas, Nova rede e Nova escola (A0b, tarefa 6.0; cenários W6, W7, W8 e W10), nos projetos `chromebook` e `celular`.
 * A lista é de todas as escolas do banco de teste, que guarda as das outras suítes: cada teste confere a tela contra a
 * resposta que ela mesma recebeu, e procura as suas escolas pelo nome, nunca pela posição que um id teria.
 */

/** A lista (`GET`, com a página e a ordem na query string). */
const ROTA_DAS_ESCOLAS = (url: URL) => url.pathname === '/v1/operacao/escolas' && url.search !== ''
/** As redes (`GET`) e o criar rede (`POST`): o manipulador separa pelo método. */
const ROTA_DAS_REDES = (url: URL) => url.pathname === '/v1/operacao/redes'
/** O criar escola (`POST`, sem query string). */
const ROTA_DE_CRIAR_ESCOLA = (url: URL) => url.pathname === '/v1/operacao/escolas' && url.search === ''
const TEXTO_DO_503 = 'O Turmma está indisponível agora. Tente de novo em instantes.'
const TEXTO_DO_ENDERECO_REPETIDO = 'Esse endereço já é de outra escola. Escolha outro.'
const TEXTO_DA_TENTATIVA_INCERTA = 'A tentativa anterior pode ter criado a escola antes de a conexão cair. Feche este diálogo e confira a lista antes de tentar de novo.'

const operadores: string[] = []
const paineis: PainelSemeado[] = []

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

test.afterEach(async () => {
  for (const operadorId of operadores.splice(0)) await removerOperador(operadorId)
  for (const painel of paineis.splice(0)) await removerPainel(painel)
})

function envelope(codigo: string) {
  return JSON.stringify({ erro: { codigo, mensagem: 'texto da API que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
}

/** A resposta do `GET` da lista com aquela página e ordem, esperada a partir de agora. */
function respostaDaLista(page: Page, pagina: number, ordem: 'nome' | 'uso') {
  return page.waitForResponse((resposta) => {
    const url = new URL(resposta.url())
    return url.pathname === '/v1/operacao/escolas' && url.searchParams.get('pagina') === String(pagina) && url.searchParams.get('ordem') === ordem && resposta.ok()
  })
}

/** Os nomes das escolas na tela, na ordem: as linhas da tabela no Chromebook, os cartões no celular (uma só estrutura está no documento). */
async function nomesNaTela(page: Page): Promise<string[]> {
  return page.locator('[data-nome-da-escola]').allTextContents()
}

/** A linha (Chromebook) ou o cartão (celular) daquela escola, o que estiver à vista. */
function itemDaEscola(page: Page, nome: string): Locator {
  return page.getByRole('main').locator('tr, li').filter({ hasText: nome }).filter({ visible: true })
}

/** O botão de um diálogo aberto. */
function noDialogo(page: Page): Locator {
  return page.getByRole('dialog')
}

/** Aperta Tab até o foco chegar no alvo, sem passar de 40 teclas. */
async function tabAte(page: Page, alvo: Locator): Promise<void> {
  for (let tecla = 0; tecla < 40; tecla++) {
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error('o Tab não chegou ao alvo')
}

const focoDentroDoDialogo = (page: Page) => page.evaluate(() => document.activeElement?.closest('dialog[open]') !== null && document.activeElement !== null)

/** O corpo JSON de uma requisição da tela. */
const corpoDe = (pedido: Request) => pedido.postDataJSON() as { id: string; nome: string; slug?: string }

test.describe('Escolas, Nova rede e Nova escola (A0b, tarefa 6.0)', () => {
  test('W6 e W10: 30 escolas, página e ordem na barra, o texto de cada estado, e sem rolagem a 360 px', async ({ page, hasTouch }) => {
    test.slow()
    const painel = await novoPainel('comum')
    const operador = await novoOperador()
    const primeira = respostaDaLista(page, 1, 'nome')
    await entrarNaOperacao(page, operador, hasTouch)
    await expect(page).toHaveTitle('Escolas · Operação Turmma')
    const porNome = (await (await primeira).json()) as EscolasDoPainelResponse
    await expect.poll(() => nomesNaTela(page)).toEqual(porNome.itens.map((escola) => escola.nome))
    expect(porNome.total).toBeGreaterThanOrEqual(30)
    const paginas = Math.ceil(porNome.total / 25)
    await expect(page.getByRole('navigation', { name: 'Páginas da lista' })).toContainText(`Página 1 de ${String(paginas)}`)

    // A ordem por uso vai à barra e volta à primeira página; as escolas do teste, com o maior uso do banco, abrem a lista.
    const porUsoResposta = respostaDaLista(page, 1, 'uso')
    await acionar(page, 'Mais uso no mês', hasTouch)
    const porUso = (await (await porUsoResposta).json()) as EscolasDoPainelResponse
    await expect(page).toHaveURL(/\/operacao\?pagina=1&ordem=uso$/)
    await expect(page.getByRole('button', { name: 'Mais uso no mês' })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => nomesNaTela(page)).toEqual(porUso.itens.map((escola) => escola.nome))

    // W10 na tela: o texto de cada estado, na linha ou no cartão da escola, sem o identificador cru.
    for (const [estado, escola] of Object.entries(painel.porEstado) as [keyof typeof TEXTO_DO_ESTADO, { nome: string }][]) {
      await expect(itemDaEscola(page, escola.nome)).toContainText(TEXTO_DO_ESTADO[estado])
    }
    // "Convite vencido" tem a palavra "vencido", e isso é texto; o identificador cru é o com sublinhado, ou o `pendente`.
    for (const identificador of ['sem_convite', 'sem_coordenacao', 'pendente']) await expect(page.getByRole('main')).not.toContainText(identificador)

    // A escola de nome, rede e endereço no limite cabe na tela, sem rolagem horizontal, também a 360 px.
    await expect(itemDaEscola(page, painel.longa.nome)).toContainText(`/e/${painel.longa.slug}`)
    await expect(itemDaEscola(page, painel.longa.nome)).toContainText(painel.redeNome)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    for (const nome of ['Nova escola', 'Nova rede', 'Próxima', 'Nome', 'Mais uso no mês']) {
      const caixa = await page.getByRole('button', { name: nome, exact: true }).boundingBox()
      expect(caixa?.height ?? 0, nome).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect(caixa?.width ?? 0, nome).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    }

    // A página seguinte vai à barra; a anterior fica na tela, marcada como ocupada, até ela chegar (`placeholderData`),
    // em vez de a lista sumir no Chromebook em rede lenta. Depois, nenhuma escola do teste reaparece.
    let soltarSegunda: () => void = () => undefined
    const segundaSegura = new Promise<void>((resolver) => {
      soltarSegunda = resolver
    })
    const segurarSegunda = async (rota: Route) => {
      if (new URL(rota.request().url()).searchParams.get('pagina') === '2') await segundaSegura
      return rota.fallback()
    }
    await page.route(ROTA_DAS_ESCOLAS, segurarSegunda)
    const segundaResposta = respostaDaLista(page, 2, 'uso')
    await acionar(page, 'Próxima', hasTouch)
    await expect(page).toHaveURL(/\/operacao\?pagina=2&ordem=uso$/)
    await expect(page.getByRole('region', { name: 'Lista de escolas' })).toHaveAttribute('aria-busy', 'true')
    expect(await nomesNaTela(page)).toEqual(porUso.itens.map((escola) => escola.nome))
    await expect(page.getByRole('status').filter({ hasText: 'Carregando as escolas…' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Próxima' })).toBeDisabled()
    soltarSegunda()
    const segunda = (await (await segundaResposta).json()) as EscolasDoPainelResponse
    await page.unroute(ROTA_DAS_ESCOLAS, segurarSegunda)
    await expect(page.getByRole('region', { name: 'Lista de escolas' })).toHaveAttribute('aria-busy', 'false')
    await expect.poll(() => nomesNaTela(page)).toEqual(segunda.itens.map((escola) => escola.nome))
    for (const escola of Object.values(painel.porEstado)) expect(segunda.itens.map((item) => item.id)).not.toContain(escola.id)
    await expect(page.getByRole('navigation', { name: 'Páginas da lista' })).toContainText(`Página 2 de ${String(Math.ceil(segunda.total / 25))}`)
    expect(await larguraExcedente(page)).toBe(0)

    // O endereço copiado abre a mesma lista: a página e a ordem vêm da barra, não da memória da aba.
    const recarregada = respostaDaLista(page, 2, 'uso')
    await page.reload()
    const depoisDaRecarga = (await (await recarregada).json()) as EscolasDoPainelResponse
    await expect(page.getByRole('button', { name: 'Mais uso no mês' })).toHaveAttribute('aria-pressed', 'true', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('navigation', { name: 'Páginas da lista' })).toContainText(`Página 2 de ${String(Math.ceil(depoisDaRecarga.total / 25))}`)

    // "Escolas", na navegação, volta ao começo da lista: `/operacao`, sem a barra no fim, na primeira página por nome.
    const devolta = respostaDaLista(page, 1, 'nome')
    const escolas = page.getByRole('navigation', { name: 'Operação' }).getByRole('link', { name: 'Escolas' })
    await expect(escolas).toHaveAttribute('aria-current', 'page')
    if (hasTouch) await escolas.tap()
    else await escolas.click()
    await devolta
    await expect(page).toHaveURL(/\/operacao$/)
    await expect(page.getByRole('button', { name: 'Nome', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('navigation', { name: 'Páginas da lista' })).toContainText('Página 1 de')

    // O diálogo Nova escola com a prévia do endereço no limite também cabe a 360 px, e a revisão com a rede, o nome e o
    // endereço no limite: sem rolagem dentro do diálogo, que o documento não mostra.
    await acionar(page, 'Nova escola', hasTouch)
    // 63 caracteres sem hífen (o contrato aceita): sem ponto de quebra, só o `wrap-anywhere` o segura a 360 px.
    const enderecoLongo = 'e'.repeat(63)
    await noDialogo(page).getByLabel('Rede').selectOption(painel.redeId, { timeout: PRAZO_DA_ENTRADA_MS })
    await noDialogo(page).getByLabel('Nome da escola').fill(painel.longa.nome)
    await noDialogo(page).getByLabel('Endereço da escola').fill(enderecoLongo)
    await expect(noDialogo(page)).toContainText(`/e/${enderecoLongo}`)
    await expect(noDialogo(page)).toContainText('Só letras minúsculas sem acento, números e hífen entre eles, até 63.')
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await acionar(page, 'Revisar', hasTouch)
    await expect(noDialogo(page).getByRole('heading', { name: 'Confira antes de criar' })).toBeVisible()
    await expect(noDialogo(page)).toContainText(painel.redeNome)
    await expect(noDialogo(page)).toContainText(`/e/${enderecoLongo}`)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('RF23: no Chromebook a página não rola e a lista rola por dentro, pelo teclado; no celular a página rola e nada rola de lado', async ({ page, hasTouch }) => {
    test.slow()
    await novoPainel('nenhum')
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)
    await expect.poll(() => nomesNaTela(page), { timeout: PRAZO_DA_ENTRADA_MS }).not.toEqual([])
    if (hasTouch) {
      expect(await larguraExcedente(page)).toBe(0)
      return
    }
    await conferirAListaQueRola(page, 'Lista de escolas', 'Páginas da lista')
  })

  test('14.4: o uso de uma escola com números grandes fica inteiro na linha, a 360 e a 1366 px', async ({ page, hasTouch }) => {
    test.slow()
    await novoPainel('nenhum')
    const operador = await novoOperador()
    await trocarAPrimeiraDaResposta(page, ROTA_DAS_ESCOLAS, (escola) => ({ ...escola, turmas: 1234, professores: 12_345, alunos: 1_234_567 }))
    await entrarNaOperacao(page, operador, hasTouch)
    const numeros = ['1.234 turmas', '12.345 professores', '1.234.567 alunos']
    await conferirQueCadaNumeroFicaEmUmaLinha(page, numeros)
    expect(await larguraExcedente(page)).toBe(0)
    // A tabela mais estreita que há, a 768 px (abaixo dela é a lista de cartões): a coluna do uso aperta, e o número ainda não quebra.
    if (!hasTouch) {
      await page.setViewportSize({ width: 768, height: 800 })
      await conferirQueCadaNumeroFicaEmUmaLinha(page, numeros)
      expect(await larguraExcedente(page)).toBe(0)
    }
  })

  test('W7: carregando, vazio que convida, erro com "Tentar de novo" e com dado; e o Nova escola sem rede', async ({ page, hasTouch }) => {
    test.slow()
    const operador = await novoOperador()
    // A primeira lista fica segura até o teste olhar o carregando, e então chega vazia.
    let soltar: () => void = () => undefined
    const segura = new Promise<void>((resolver) => {
      soltar = resolver
    })
    const vazia = async (rota: Route) => {
      await segura
      await rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], pagina: 1, total: 0 }) })
    }
    await page.route(ROTA_DAS_ESCOLAS, vazia)
    await entrarNaOperacao(page, operador, hasTouch)

    await expect(page.getByRole('status').filter({ hasText: 'Carregando as escolas…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    soltar()
    await expect(page.getByRole('main')).toContainText('Nenhuma escola ainda.', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('main')).toContainText('Comece criando a rede.')
    // Um só "Nova rede" e um só botão cheio (o "Nova escola"): o vazio não repete o convite como um segundo primário.
    await expect(page.getByRole('main').getByRole('button', { name: 'Nova rede' })).toHaveCount(1)
    await expect(page.getByRole('main').locator('button.bg-laranja')).toHaveText(['Nova escola'])
    await expect(page.getByRole('navigation', { name: 'Páginas da lista' })).toHaveCount(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // O 503: a mensagem e o "Tentar de novo", e a tela fica. Tentando de novo com a API de volta, a lista de verdade.
    await page.unroute(ROTA_DAS_ESCOLAS, vazia)
    const falhar = (rota: Route) => rota.fulfill({ status: 503, contentType: 'application/json', body: envelope('INDISPONIVEL_TENTE_DE_NOVO') })
    await page.route(ROTA_DAS_ESCOLAS, falhar)
    await page.reload()
    await expect(page.getByRole('alert')).toHaveText(TEXTO_DO_503, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveURL(/\/operacao$/)
    await expect(page.getByRole('main')).not.toContainText(codigoCru('503'))
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    await page.unroute(ROTA_DAS_ESCOLAS, falhar)
    const lista = respostaDaLista(page, 1, 'nome')
    await acionar(page, 'Tentar de novo', hasTouch)
    const dados = (await (await lista).json()) as EscolasDoPainelResponse
    await expect.poll(() => nomesNaTela(page)).toEqual(dados.itens.map((escola) => escola.nome))
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(await violacoesGraves(page)).toEqual([])

    // A página além da última (endereço digitado, escolas que saíram): o vazio dela, com o caminho de volta à primeira.
    const alemDaUltima = (rota: Route) => rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], pagina: 9999, total: 30 }) })
    await page.route(ROTA_DAS_ESCOLAS, alemDaUltima)
    await page.goto('/operacao?pagina=9999&ordem=uso')
    await expect(page.getByRole('main')).toContainText('Não há escolas nesta página.', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('main')).toContainText('A lista tem 2 páginas.')
    expect(await violacoesGraves(page)).toEqual([])
    await page.unroute(ROTA_DAS_ESCOLAS, alemDaUltima)
    await acionar(page, 'Ir para a primeira página', hasTouch)
    await expect(page).toHaveURL(/\/operacao\?pagina=1&ordem=uso$/)
    await expect.poll(() => nomesNaTela(page), { timeout: PRAZO_DA_ENTRADA_MS }).not.toEqual([])

    // O Nova escola com as redes carregando e depois com o 503: o carregando, e o erro com "Tentar de novo" no diálogo.
    let soltarRedes: () => void = () => undefined
    const redesSeguras = new Promise<void>((resolver) => {
      soltarRedes = resolver
    })
    const redesFalham = async (rota: Route) => {
      if (rota.request().method() !== 'GET') return rota.fallback()
      await redesSeguras
      return rota.fulfill({ status: 503, contentType: 'application/json', body: envelope('INDISPONIVEL_TENTE_DE_NOVO') })
    }
    await page.route(ROTA_DAS_REDES, redesFalham)
    await acionar(page, 'Nova escola', hasTouch)
    await expect(noDialogo(page).getByRole('status').filter({ hasText: 'Carregando as redes…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(await violacoesGraves(page)).toEqual([])
    soltarRedes()
    await expect(noDialogo(page).getByRole('alert')).toHaveText(TEXTO_DO_503, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(await larguraExcedente(page)).toBe(0)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await page.unroute(ROTA_DAS_REDES, redesFalham)

    // O Nova escola sem rede nenhuma: "Crie a rede primeiro", com o botão que abre o Nova rede.
    const semRede = (rota: Route) => rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [] }) })
    await page.route(ROTA_DAS_REDES, semRede)
    await noDialogo(page).getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(noDialogo(page)).toContainText('Crie a rede primeiro.', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('button', { name: 'Nova rede' })).toBeFocused()
    expect(await larguraExcedente(page)).toBe(0)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    const botao = noDialogo(page).getByRole('button', { name: 'Nova rede' })
    if (hasTouch) await botao.tap()
    else await botao.click()
    await expect(noDialogo(page).getByRole('heading', { name: 'Nova rede' })).toBeVisible()
    await expect(noDialogo(page).getByLabel('Nome da rede')).toBeFocused()
  })

  test('W8: criar rede e escola só com Tab e Enter, com o foco preso no diálogo e devolvido a quem o abriu', async ({ page, hasTouch }) => {
    test.slow()
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)
    await expect(page.getByRole('main').getByRole('button', { name: 'Nova rede' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const marca = crypto.randomUUID().slice(0, 8)
    const nomeDaRede = nomeDeRedeQueVemPrimeiro('Rede do teclado')
    const nomeDaEscola = `Escola do teclado ${marca}`
    const endereco = `teclado-${marca}`

    // Nova rede: Tab até o botão, Enter abre; o foco começa no nome e não sai do diálogo com Tab nem com Shift+Tab.
    const abrirRede = page.getByRole('main').getByRole('button', { name: 'Nova rede' })
    await tabAte(page, abrirRede)
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByLabel('Nome da rede')).toBeFocused()
    for (let tecla = 0; tecla < 12; tecla++) {
      await page.keyboard.press('Tab')
      expect(await focoDentroDoDialogo(page)).toBe(true)
    }
    for (let tecla = 0; tecla < 12; tecla++) {
      await page.keyboard.press('Shift+Tab')
      expect(await focoDentroDoDialogo(page)).toBe(true)
    }
    // O Esc fecha, e o foco volta ao botão que abriu.
    await page.keyboard.press('Escape')
    await expect(noDialogo(page)).toHaveCount(0)
    await expect(abrirRede).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByLabel('Nome da rede')).toBeFocused()
    await page.keyboard.type(nomeDaRede)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: `Rede ${nomeDaRede} criada.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page)).toHaveCount(0)
    await expect(abrirRede).toBeFocused()
    // O tipo que o diálogo traz de começo é o da escola independente.
    expect((await redesComONome(nomeDaRede)).map((linha) => linha.tipo)).toEqual(['independente'])

    // Nova escola: a rede que acabou de nascer já vem escolhida; Tab e digitar, Enter revisa, Tab e Enter criam.
    const abrirEscola = page.getByRole('main').getByRole('button', { name: 'Nova escola' })
    await page.keyboard.press('Shift+Tab')
    await expect(abrirEscola).toBeFocused()
    await page.keyboard.press('Enter')
    const rede = noDialogo(page).getByLabel('Rede')
    await expect(rede).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(rede.locator('option:checked')).toHaveText(nomeDaRede)
    await page.keyboard.press('Tab')
    await page.keyboard.type(nomeDaEscola)
    await page.keyboard.press('Tab')
    await page.keyboard.type(endereco)
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByRole('heading', { name: 'Confira antes de criar' })).toBeFocused()
    await expect(noDialogo(page)).toContainText(nomeDaRede)
    await expect(noDialogo(page)).toContainText(nomeDaEscola)
    await expect(noDialogo(page)).toContainText(`/e/${endereco}`)
    await expect(noDialogo(page)).toContainText('O endereço não muda depois.')
    // Na revisão o foco também fica preso, com outros controles.
    for (let tecla = 0; tecla < 6; tecla++) {
      await page.keyboard.press('Tab')
      expect(await focoDentroDoDialogo(page)).toBe(true)
    }
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Criar escola' }))
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: `Escola ${nomeDaEscola} criada.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(abrirEscola).toBeFocused()
    const [redeCriada] = await redesComONome(nomeDaRede)
    expect((await escolasComOEndereco(endereco)).map(({ redeId, nome }) => ({ redeId, nome }))).toEqual([{ redeId: redeCriada?.id, nome: nomeDaEscola }])
  })

  test('clique duplo e resposta perdida: o mesmo id do pedido, e uma escola só', async ({ page, hasTouch }) => {
    test.slow()
    const rede = await criarRedeDoPainel()
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)
    const marca = crypto.randomUUID().slice(0, 8)

    async function preencherERevisar(nome: string, endereco: string): Promise<void> {
      await acionar(page, 'Nova escola', hasTouch)
      await noDialogo(page).getByLabel('Rede').selectOption(rede.id, { timeout: PRAZO_DA_ENTRADA_MS })
      await noDialogo(page).getByLabel('Nome da escola').fill(nome)
      await noDialogo(page).getByLabel('Endereço da escola').fill(endereco)
      await acionar(page, 'Revisar', hasTouch)
      await expect(noDialogo(page).getByRole('heading', { name: 'Confira antes de criar' })).toBeVisible()
    }

    // A primeira resposta se perde depois de o servidor criar a escola; o operador tenta de novo, com o mesmo id, e o
    // servidor devolve a que já existe. Com um id novo a cada envio, a segunda tentativa voltaria "endereço repetido".
    const enderecoPerdido = `perdida-${marca}`
    const enviados: string[] = []
    let perder = true
    const perderAPrimeira = async (rota: Route) => {
      if (rota.request().method() !== 'POST') return rota.fallback()
      enviados.push(corpoDe(rota.request()).id)
      if (!perder) return rota.continue()
      perder = false
      await rota.fetch()
      return rota.abort('connectionreset')
    }
    await page.route(ROTA_DE_CRIAR_ESCOLA, perderAPrimeira)
    await preencherERevisar(`Escola da resposta perdida ${marca}`, enderecoPerdido)
    await acionar(page, 'Criar escola', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveText(TEXTO_DO_503, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(await escolasComOEndereco(enderecoPerdido)).toHaveLength(1)
    await acionar(page, 'Criar escola', hasTouch)
    await expect(page.getByRole('status').filter({ hasText: `Escola da resposta perdida ${marca} criada.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(enviados).toHaveLength(2)
    expect(enviados[1]).toBe(enviados[0])
    expect(await escolasComOEndereco(enderecoPerdido)).toEqual([{ id: enviados[0], redeId: rede.id, nome: `Escola da resposta perdida ${marca}` }])

    // A resposta se perde de novo, e o operador volta e muda o endereço: o mesmo id com outros dados é recusado pelo
    // servidor, e a tela não chama isso de endereço repetido — manda conferir a lista, e nenhuma segunda escola nasce.
    const enderecoIncerto = `incerta-${marca}`
    const enderecoMudado = `mudada-${marca}`
    perder = true
    await preencherERevisar(`Escola da conexão que caiu ${marca}`, enderecoIncerto)
    await acionar(page, 'Criar escola', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveText(TEXTO_DO_503, { timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(page, 'Voltar e corrigir', hasTouch)
    await noDialogo(page).getByLabel('Endereço da escola').fill(enderecoMudado)
    await acionar(page, 'Revisar', hasTouch)
    await acionar(page, 'Criar escola', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveText(TEXTO_DA_TENTATIVA_INCERTA, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('heading', { name: 'Confira antes de criar' })).toBeVisible()
    expect(enviados.slice(2)).toHaveLength(2)
    expect(enviados[3]).toBe(enviados[2])
    expect(await escolasComOEndereco(enderecoIncerto)).toHaveLength(1)
    expect(await escolasComOEndereco(enderecoMudado)).toEqual([])
    await acionar(page, 'Cancelar', hasTouch)
    await page.unroute(ROTA_DE_CRIAR_ESCOLA, perderAPrimeira)

    // Dois cliques seguidos em "Criar escola", com o primeiro pedido ainda no ar: sai um pedido só, e nasce uma escola só,
    // com o id dele.
    const enderecoDuplo = `duplo-${marca}`
    const duplos: string[] = []
    let soltarDuplo: () => void = () => undefined
    const duploSeguro = new Promise<void>((resolver) => {
      soltarDuplo = resolver
    })
    const segurarDuplo = async (rota: Route) => {
      if (rota.request().method() !== 'POST') return rota.fallback()
      duplos.push(corpoDe(rota.request()).id)
      await duploSeguro
      return rota.fallback()
    }
    await page.route(ROTA_DE_CRIAR_ESCOLA, segurarDuplo)
    await preencherERevisar(`Escola do clique duplo ${marca}`, enderecoDuplo)
    await noDialogo(page).getByRole('button', { name: 'Criar escola' }).dblclick()
    await expect.poll(() => duplos.length).toBe(1)
    await expect(noDialogo(page).getByRole('button', { name: 'Criando…' })).toBeDisabled()
    expect(duplos).toHaveLength(1)
    soltarDuplo()
    await expect(page.getByRole('status').filter({ hasText: `Escola do clique duplo ${marca} criada.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(duplos).toHaveLength(1)
    expect(await escolasComOEndereco(enderecoDuplo)).toEqual([{ id: duplos[0], redeId: rede.id, nome: `Escola do clique duplo ${marca}` }])
    await page.unroute(ROTA_DE_CRIAR_ESCOLA, segurarDuplo)

    // O mesmo no Nova rede: dois cliques em "Criar rede" com o primeiro pedido no ar, um pedido só, uma rede só.
    const redeDupla = `Rede do clique duplo ${marca}`
    const redesNoAr: string[] = []
    let soltarRede: () => void = () => undefined
    const redeSegura = new Promise<void>((resolver) => {
      soltarRede = resolver
    })
    const segurarRede = async (rota: Route) => {
      if (rota.request().method() !== 'POST') return rota.fallback()
      redesNoAr.push(corpoDe(rota.request()).id)
      await redeSegura
      return rota.fallback()
    }
    await page.route(ROTA_DAS_REDES, segurarRede)
    await acionar(page, 'Nova rede', hasTouch)
    await noDialogo(page).getByLabel('Nome da rede').fill(redeDupla, { timeout: PRAZO_DA_ENTRADA_MS })
    await noDialogo(page).getByRole('button', { name: 'Criar rede' }).dblclick()
    await expect.poll(() => redesNoAr.length).toBe(1)
    await expect(noDialogo(page).getByRole('button', { name: 'Criando…' })).toBeDisabled()
    soltarRede()
    await expect(page.getByRole('status').filter({ hasText: `Rede ${redeDupla} criada.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(redesNoAr).toHaveLength(1)
    expect((await redesComONome(redeDupla)).map((linha) => linha.id)).toEqual(redesNoAr)
    await page.unroute(ROTA_DAS_REDES, segurarRede)

    // O operador cancela com o pedido no ar e abre o Nova rede; a resposta que chega depois anuncia a escola criada, mas
    // não fecha o diálogo que está aberto agora.
    const enderecoAtrasado = `atrasada-${marca}`
    let soltarAtrasada: () => void = () => undefined
    const atrasadaSegura = new Promise<void>((resolver) => {
      soltarAtrasada = resolver
    })
    let atrasadaNoAr = false
    const segurarAtrasada = async (rota: Route) => {
      if (rota.request().method() !== 'POST') return rota.fallback()
      atrasadaNoAr = true
      await atrasadaSegura
      return rota.fallback()
    }
    await page.route(ROTA_DE_CRIAR_ESCOLA, segurarAtrasada)
    await preencherERevisar(`Escola da resposta atrasada ${marca}`, enderecoAtrasado)
    await acionar(page, 'Criar escola', hasTouch)
    await expect.poll(() => atrasadaNoAr).toBe(true)
    await acionar(page, 'Cancelar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    await acionar(page, 'Nova rede', hasTouch)
    await expect(noDialogo(page).getByLabel('Nome da rede')).toBeVisible()
    soltarAtrasada()
    await expect(page.getByRole('status').filter({ hasText: `Escola da resposta atrasada ${marca} criada.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('heading', { name: 'Nova rede' })).toBeVisible()
    await acionar(page, 'Cancelar', hasTouch)
    await page.unroute(ROTA_DE_CRIAR_ESCOLA, segurarAtrasada)

    // Reabrir o mesmo diálogo com o pedido no ar (correção 2026-09-25-resposta-atrasada-fecha-o-dialogo-reaberto): a
    // resposta atrasada é da abertura que foi cancelada, e não fecha a reaberta, que é outro pedido com outro id e com o
    // que o operador já digitou nela.
    const enderecoDaPrimeira = `reaberta-${marca}`
    let soltarReaberta: () => void = () => undefined
    const reabertaSegura = new Promise<void>((resolver) => {
      soltarReaberta = resolver
    })
    let reabertaNoAr = false
    const segurarReaberta = async (rota: Route) => {
      if (rota.request().method() !== 'POST') return rota.fallback()
      reabertaNoAr = true
      await reabertaSegura
      return rota.fallback()
    }
    await page.route(ROTA_DE_CRIAR_ESCOLA, segurarReaberta)
    await preencherERevisar(`Escola da primeira abertura ${marca}`, enderecoDaPrimeira)
    await acionar(page, 'Criar escola', hasTouch)
    await expect.poll(() => reabertaNoAr).toBe(true)
    await acionar(page, 'Cancelar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    await acionar(page, 'Nova escola', hasTouch)
    const nomeDaReaberta = noDialogo(page).getByLabel('Nome da escola')
    await nomeDaReaberta.fill(`Escola da segunda abertura ${marca}`, { timeout: PRAZO_DA_ENTRADA_MS })
    soltarReaberta()
    await expect(page.getByRole('status').filter({ hasText: `Escola da primeira abertura ${marca} criada.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('heading', { name: 'Nova escola' })).toBeVisible()
    await expect(nomeDaReaberta).toHaveValue(`Escola da segunda abertura ${marca}`)
    expect(await escolasComOEndereco(enderecoDaPrimeira)).toHaveLength(1)
    await acionar(page, 'Cancelar', hasTouch)
    await page.unroute(ROTA_DE_CRIAR_ESCOLA, segurarReaberta)

    // O mesmo no Nova rede.
    const redeDaPrimeira = `Rede da primeira abertura ${marca}`
    let soltarRedeReaberta: () => void = () => undefined
    const redeReabertaSegura = new Promise<void>((resolver) => {
      soltarRedeReaberta = resolver
    })
    let redeReabertaNoAr = false
    const segurarRedeReaberta = async (rota: Route) => {
      if (rota.request().method() !== 'POST') return rota.fallback()
      redeReabertaNoAr = true
      await redeReabertaSegura
      return rota.fallback()
    }
    await page.route(ROTA_DAS_REDES, segurarRedeReaberta)
    await acionar(page, 'Nova rede', hasTouch)
    await noDialogo(page).getByLabel('Nome da rede').fill(redeDaPrimeira, { timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(page, 'Criar rede', hasTouch)
    await expect.poll(() => redeReabertaNoAr).toBe(true)
    await acionar(page, 'Cancelar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    await acionar(page, 'Nova rede', hasTouch)
    const nomeDaRedeReaberta = noDialogo(page).getByLabel('Nome da rede')
    await nomeDaRedeReaberta.fill(`Rede da segunda abertura ${marca}`, { timeout: PRAZO_DA_ENTRADA_MS })
    soltarRedeReaberta()
    await expect(page.getByRole('status').filter({ hasText: `Rede ${redeDaPrimeira} criada.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('heading', { name: 'Nova rede' })).toBeVisible()
    await expect(nomeDaRedeReaberta).toHaveValue(`Rede da segunda abertura ${marca}`)
    expect(await redesComONome(redeDaPrimeira)).toHaveLength(1)
    await page.unroute(ROTA_DAS_REDES, segurarRedeReaberta)
  })

  test('recomeço: reabrir o diálogo sorteia outro id; sair e entrar outro operador na aba não mostra a lista do primeiro', async ({ page, hasTouch }) => {
    test.slow()
    const primeiro = await novoOperador()
    const segundo = await novoOperador()
    await entrarNaOperacao(page, primeiro, hasTouch)

    // O pedido que não chega: dentro do mesmo diálogo, a nova tentativa repete o id; o diálogo reaberto sorteia outro.
    const ids: string[] = []
    const naoChega = (rota: Route) => {
      if (rota.request().method() !== 'POST') return rota.fallback()
      ids.push(corpoDe(rota.request()).id)
      return rota.abort('internetdisconnected')
    }
    await page.route(ROTA_DAS_REDES, naoChega)
    for (let abertura = 0; abertura < 2; abertura++) {
      await acionar(page, 'Nova rede', hasTouch)
      await noDialogo(page).getByLabel('Nome da rede').fill('Rede que não chega', { timeout: PRAZO_DA_ENTRADA_MS })
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        await acionar(page, 'Criar rede', hasTouch)
        await expect(noDialogo(page).getByRole('alert')).toHaveText(TEXTO_DO_503, { timeout: PRAZO_DA_ENTRADA_MS })
        await expect.poll(() => ids.length).toBe(abertura * 2 + tentativa + 1)
      }
      await acionar(page, 'Cancelar', hasTouch)
      await expect(noDialogo(page)).toHaveCount(0)
    }
    expect(ids[1]).toBe(ids[0])
    expect(ids[3]).toBe(ids[2])
    expect(ids[2]).not.toBe(ids[0])
    await page.unroute(ROTA_DAS_REDES, naoChega)

    // A lista do primeiro operador está na tela. Ele sai; o segundo entra na mesma aba, sem recarregar, e a lista dele
    // fica segura no servidor: a tela mostra o carregando, e nada da lista de antes.
    const lista = await nomesNaTela(page)
    expect(lista.length).toBeGreaterThan(0)
    await acionar(page, 'Sair', hasTouch)
    await expect(page.getByRole('heading', { name: 'Entrar na operação' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    let soltar: () => void = () => undefined
    const segura = new Promise<void>((resolver) => {
      soltar = resolver
    })
    const segurar = async (rota: Route) => {
      await segura
      await rota.fallback()
    }
    await page.route(ROTA_DAS_ESCOLAS, segurar)
    await page.getByLabel('E-mail').fill(segundo.email)
    await page.getByLabel('Senha').fill(segundo.senha)
    await acionar(page, /^Entrar$/, hasTouch)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await page.getByLabel('Código do aplicativo').fill(codigoDoOperador(segundo))
    await acionar(page, /^Entrar$/, hasTouch)
    await expect(page.getByRole('banner')).toContainText(segundo.nome, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('status').filter({ hasText: 'Carregando as escolas…' })).toBeVisible()
    expect(await nomesNaTela(page)).toEqual([])
    soltar()
    await expect.poll(() => nomesNaTela(page), { timeout: PRAZO_DA_ENTRADA_MS }).not.toEqual([])
  })

  test('o aviso de inatividade com um diálogo aberto aparece dentro dele, alcançável pelo Tab e acionável', async ({ page, hasTouch }) => {
    test.slow()
    const operador = await novoOperador()
    await page.clock.install()
    await entrarNaOperacao(page, operador, hasTouch)
    await acionar(page, 'Nova escola', hasTouch)
    await expect(noDialogo(page).getByLabel('Rede')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // Parada com o diálogo aberto: passados os 27 min, o aviso aparece dentro do diálogo, e só lá (o de fora ficaria
    // inerte atrás do diálogo modal).
    await page.clock.fastForward('00:27:30')
    const aviso = noDialogo(page).getByRole('region', { name: 'Aviso de inatividade' })
    await expect(aviso).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(aviso.getByRole('alert')).toHaveText('Sua sessão vai terminar em 2 minutos por falta de uso.')
    await expect(page.getByRole('region', { name: 'Aviso de inatividade' })).toHaveCount(1)
    expect(await violacoesGraves(page)).toEqual([])

    // "Continuar na sessão" recebe o foco pelo Tab. A tecla já conta como uso (`idle-timeout.ts`), e o `/eu` dela fica seguro
    // no teste, para o aviso não sumir antes de o foco chegar ao botão em rede rápida.
    const continuar = aviso.getByRole('button', { name: 'Continuar na sessão' })
    const ehEu = (url: URL) => url.pathname === '/v1/operacao/eu'
    let soltarEu: () => void = () => undefined
    const euSeguro = new Promise<void>((resolver) => {
      soltarEu = resolver
    })
    const segurarEu = async (rota: Route) => {
      await euSeguro
      return rota.fallback()
    }
    await page.route(ehEu, segurarEu)
    await tabAte(page, continuar)
    await expect(continuar).toBeFocused()
    await expect(aviso).toBeVisible()
    soltarEu()
    await expect(aviso).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await page.unroute(ehEu, segurarEu)
    await expect(noDialogo(page).getByLabel('Rede')).toBeVisible()

    // O botão em si: parada de novo, o aviso volta ao diálogo, e o clique no botão — sem tecla nem ponteiro, que já contariam
    // como uso sozinhos — manda o uso ao servidor e tira o aviso, com o diálogo no lugar.
    await page.clock.fastForward('00:27:30')
    await expect(aviso).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const usos: string[] = []
    const contarUso = (pedido: Request) => {
      if (ehEu(new URL(pedido.url()))) usos.push(pedido.url())
    }
    page.on('request', contarUso)
    await continuar.evaluate((botao) => (botao as HTMLButtonElement).click())
    await expect.poll(() => usos.length).toBe(1)
    await expect(aviso).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    page.off('request', contarUso)
    await expect(noDialogo(page).getByLabel('Rede')).toBeVisible()

    // Fechado o diálogo, o aviso volta a ser o da casca.
    await acionar(page, 'Cancelar', hasTouch)
    await page.clock.fastForward('00:27:30')
    await expect(page.getByRole('region', { name: 'Aviso de inatividade' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page)).toHaveCount(0)

    // Aberto um diálogo com o aviso na tela, o aviso vai para dentro dele, e o "Sair" de lá encerra a sessão.
    const abrirRede = page.getByRole('main').getByRole('button', { name: 'Nova rede' })
    await abrirRede.evaluate((botao) => (botao as HTMLButtonElement).click())
    await expect(noDialogo(page).getByRole('region', { name: 'Aviso de inatividade' })).toBeVisible()
    await noDialogo(page).getByRole('region', { name: 'Aviso de inatividade' }).getByRole('button', { name: 'Sair' }).evaluate((botao) => (botao as HTMLButtonElement).click())
    await expect(page).toHaveURL(/\/operacao\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page)).toHaveCount(0)
  })

  test('W10 na tela: o endereço repetido no campo, o 429 com a espera, o 503 de tempo esgotado e o 401 que leva à entrada', async ({ page, hasTouch }) => {
    test.slow()
    const rede = await criarRedeDoPainel()
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)
    const marca = crypto.randomUUID().slice(0, 8)
    const enderecoDeOutra = `ocupado-${marca}`
    const livre = `livre-${marca}`

    // O que não passa no contrato fica na tela, antes de ir ao servidor: cada campo com o seu texto, e o diálogo no lugar.
    await acionar(page, 'Nova escola', hasTouch)
    await expect(noDialogo(page).getByLabel('Rede')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await noDialogo(page).getByLabel('Nome da escola').fill('   ')
    await noDialogo(page).getByLabel('Endereço da escola').fill('Colégio Horizonte')
    await acionar(page, 'Revisar', hasTouch)
    await expect(noDialogo(page).getByLabel('Rede')).toHaveAttribute('aria-invalid', 'true')
    await expect(noDialogo(page)).toContainText('Escolha a rede da escola.')
    await expect(noDialogo(page).getByLabel('Nome da escola')).toHaveAccessibleDescription('Escreva o nome, com até 200 caracteres.')
    await expect(noDialogo(page).getByLabel('Endereço da escola')).toHaveAttribute('aria-invalid', 'true')
    await expect(noDialogo(page).getByRole('heading', { name: 'Confira antes de criar' })).toHaveCount(0)
    expect(await violacoesGraves(page)).toEqual([])
    await acionar(page, 'Cancelar', hasTouch)

    // Nova rede sem nome: o texto no campo, e nada sai para o servidor.
    const redesEnviadas: string[] = []
    const contarRedes = (rota: Route) => {
      if (rota.request().method() === 'POST') redesEnviadas.push(rota.request().url())
      return rota.fallback()
    }
    await page.route(ROTA_DAS_REDES, contarRedes)
    await acionar(page, 'Nova rede', hasTouch)
    await acionar(page, 'Criar rede', hasTouch)
    await expect(noDialogo(page).getByLabel('Nome da rede')).toHaveAttribute('aria-invalid', 'true')
    await expect(noDialogo(page).getByLabel('Nome da rede')).toHaveAccessibleDescription(/Escreva o nome, com até 200 caracteres\.$/)
    expect(redesEnviadas).toEqual([])
    await acionar(page, 'Cancelar', hasTouch)
    await page.unroute(ROTA_DAS_REDES, contarRedes)

    // Uma escola com o endereço já existe; a tela cria outra com o mesmo endereço.
    await acionar(page, 'Nova escola', hasTouch)
    await noDialogo(page).getByLabel('Rede').selectOption(rede.id, { timeout: PRAZO_DA_ENTRADA_MS })
    await noDialogo(page).getByLabel('Nome da escola').fill(`Primeira ${marca}`)
    await noDialogo(page).getByLabel('Endereço da escola').fill(enderecoDeOutra)
    await acionar(page, 'Revisar', hasTouch)
    await acionar(page, 'Criar escola', hasTouch)
    await expect(page.getByRole('status').filter({ hasText: `Escola Primeira ${marca} criada.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // Os ids que saem para o servidor, deste diálogo em diante.
    const ids: string[] = []
    const registrar = (rota: Route) => {
      if (rota.request().method() === 'POST') ids.push(corpoDe(rota.request()).id)
      return rota.fallback()
    }
    await page.route(ROTA_DE_CRIAR_ESCOLA, registrar)
    await acionar(page, 'Nova escola', hasTouch)
    await noDialogo(page).getByLabel('Rede').selectOption(rede.id, { timeout: PRAZO_DA_ENTRADA_MS })
    await noDialogo(page).getByLabel('Nome da escola').fill(`Segunda ${marca}`)
    await noDialogo(page).getByLabel('Endereço da escola').fill(enderecoDeOutra)
    await acionar(page, 'Revisar', hasTouch)
    await acionar(page, 'Criar escola', hasTouch)
    const campo = noDialogo(page).getByLabel('Endereço da escola')
    await expect(campo).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(campo).toHaveAttribute('aria-invalid', 'true')
    await expect(campo).toHaveAccessibleDescription(new RegExp(TEXTO_DO_ENDERECO_REPETIDO.replaceAll('.', '\\.')))
    await expect(noDialogo(page)).toContainText(TEXTO_DO_ENDERECO_REPETIDO)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    expect((await escolasComOEndereco(enderecoDeOutra)).map(({ redeId, nome }) => ({ redeId, nome }))).toEqual([{ redeId: rede.id, nome: `Primeira ${marca}` }])

    // O 429 diz quanto esperar, com o N do Retry-After; o 503 de tempo esgotado tem o texto dele. Nenhum código na tela.
    await campo.fill(livre)
    await acionar(page, 'Revisar', hasTouch)
    const limite = (rota: Route) =>
      rota.request().method() === 'POST' ? rota.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '7' }, body: envelope('LIMITE_EXCEDIDO') }) : rota.fallback()
    await page.route(ROTA_DE_CRIAR_ESCOLA, limite)
    await acionar(page, 'Criar escola', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveText('Muitas ações seguidas. Tente de novo em 7 segundos.', { timeout: PRAZO_DA_ENTRADA_MS })
    await page.unroute(ROTA_DE_CRIAR_ESCOLA, limite)
    const tempo = (rota: Route) => (rota.request().method() === 'POST' ? rota.fulfill({ status: 503, contentType: 'application/json', body: envelope('TEMPO_ESGOTADO') }) : rota.fallback())
    await page.route(ROTA_DE_CRIAR_ESCOLA, tempo)
    await acionar(page, 'Criar escola', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveText('A operação demorou demais. Tente de novo em instantes.', { timeout: PRAZO_DA_ENTRADA_MS })
    // O status como número solto (o nome da rede do teste tem dígitos, e "…8209…" não é status).
    for (const proibido of [/\b429\b/, /\b503\b/, 'LIMITE_EXCEDIDO', 'TEMPO_ESGOTADO', 'CONFLITO', 'texto da API']) await expect(noDialogo(page)).not.toContainText(proibido)
    await page.unroute(ROTA_DE_CRIAR_ESCOLA, tempo)

    // Com o endereço trocado, o "Criar escola" conclui, com o mesmo id do pedido que voltou endereço repetido.
    await acionar(page, 'Criar escola', hasTouch)
    await expect(page.getByRole('status').filter({ hasText: `Escola Segunda ${marca} criada.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // Os que chegaram ao servidor: o do endereço repetido e o que criou (o 429 e o 503 foram respondidos pelo teste).
    expect(ids).toHaveLength(2)
    const [daPrimeira, daSegunda] = ids
    expect(daSegunda).toBe(daPrimeira)
    expect(await escolasComOEndereco(livre)).toEqual([{ id: daPrimeira, redeId: rede.id, nome: `Segunda ${marca}` }])
    await page.unroute(ROTA_DE_CRIAR_ESCOLA, registrar)

    // A sessão terminou no servidor no meio do diálogo: o "Criar escola" leva à entrada com a mensagem, e nada é criado.
    const semSessao = `sem-sessao-${marca}`
    await acionar(page, 'Nova escola', hasTouch)
    await noDialogo(page).getByLabel('Rede').selectOption(rede.id, { timeout: PRAZO_DA_ENTRADA_MS })
    await noDialogo(page).getByLabel('Nome da escola').fill(`Terceira ${marca}`)
    await noDialogo(page).getByLabel('Endereço da escola').fill(semSessao)
    await acionar(page, 'Revisar', hasTouch)
    await encerrarSessoesDoOperador(operador.operadorId)
    await acionar(page, 'Criar escola', hasTouch)
    await expect(page).toHaveURL(/\/operacao\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.SESSAO_ENCERRADA)
    await expect(noDialogo(page)).toHaveCount(0)
    expect(await escolasComOEndereco(semSessao)).toEqual([])
  })
})
