import type { Browser, BrowserContextOptions, Locator, Page, Route } from '@playwright/test'
import { mensagemDoConvite } from '../packages/shared/src/errors/messages.ts'
import type { ConviteDaCoordenacaoResponse, EscolasDoPainelResponse } from '../packages/shared/src/operacao/painel.ts'
import { codigoDoOperador, criarOperadorComSegundoFator as criarOperador, removerOperador, type OperadorDeTeste } from './__fixtures__/operacao.ts'
import { convitesEmAberto, idDaEscolaComOEndereco, nomeQueVemPrimeiro, semearEscolaDoConvite, ultimoConviteDaEscola } from './__fixtures__/painel.ts'
import { expect, test } from './__fixtures__/perfis.ts'
import { acionar, entrarNaOperacao, esperarCasca, PRAZO_DA_ENTRADA_MS } from './__fixtures__/tela-da-operacao.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './__fixtures__/verificacoes.ts'

/**
 * O convite da coordenação pelo painel (A0b, tarefa 7.0; cenários W1, W2, W3, W4, W6, W8, W9 e W10), nos projetos
 * `chromebook` e `celular`. Cada teste usa uma escola própria, com o nome que abre a lista por nome, e a procura pelo
 * nome, nunca pela posição. Os textos esperados são os do cenário, escritos aqui por extenso.
 */

const TEXTO_DO_CONVITE_QUE_MUDOU = 'O convite mudou. A lista foi atualizada.'
const TEXTO_DO_CONVITE_QUE_NAO_VALE = 'Esse convite já não vale. A lista foi atualizada.'
const TEXTO_DO_LINK_SELECIONADO = 'O link está selecionado no campo. Copie com Ctrl+C, ou toque e segure no campo e escolha Copiar.'
/** Senha nova da coordenadora sintética: o mínimo do contrato é 12 caracteres. */
const SENHA_NOVA = 'frase-sintetica-do-painel'

/** O refazer e o revogar (`POST /v1/operacao/convites/:id/…`). */
const ROTA_DO_REFAZER = (url: URL) => url.pathname.startsWith('/v1/operacao/convites/') && url.pathname.endsWith('/refazer')
const ROTA_DO_REVOGAR = (url: URL) => url.pathname.startsWith('/v1/operacao/convites/') && url.pathname.endsWith('/revogar')
/** O gerar (`POST /v1/operacao/escolas/:id/convite-coordenacao`). */
const ROTA_DO_GERAR = (url: URL) => url.pathname.startsWith('/v1/operacao/escolas/') && url.pathname.endsWith('/convite-coordenacao')

const operadores: string[] = []
const contextos: { close: () => Promise<void> }[] = []

async function novoOperador(): Promise<OperadorDeTeste> {
  const operador = await criarOperador()
  operadores.push(operador.operadorId)
  return operador
}

test.afterEach(async () => {
  for (const contexto of contextos.splice(0)) await contexto.close()
  for (const operadorId of operadores.splice(0)) await removerOperador(operadorId)
})

/** Outro navegador (outro operador, ou a coordenadora no computador dela), com a tela e o toque do projeto. */
async function outroNavegador(browser: Browser): Promise<Page> {
  const uso = test.info().project.use
  const opcoes: BrowserContextOptions = {}
  if (uso.baseURL !== undefined) opcoes.baseURL = uso.baseURL
  if (uso.viewport !== undefined) opcoes.viewport = uso.viewport
  if (uso.isMobile !== undefined) opcoes.isMobile = uso.isMobile
  if (uso.hasTouch !== undefined) opcoes.hasTouch = uso.hasTouch
  if (uso.userAgent !== undefined) opcoes.userAgent = uso.userAgent
  if (uso.deviceScaleFactor !== undefined) opcoes.deviceScaleFactor = uso.deviceScaleFactor
  if (uso.locale !== undefined) opcoes.locale = uso.locale
  if (uso.timezoneId !== undefined) opcoes.timezoneId = uso.timezoneId
  const contexto = await browser.newContext(opcoes)
  contextos.push(contexto)
  return contexto.newPage()
}

const noDialogo = (page: Page): Locator => page.getByRole('dialog')

/** A linha (Chromebook) ou o cartão (celular) daquela escola, o que estiver à vista. */
function itemDaEscola(page: Page, nome: string): Locator {
  return page.getByRole('main').locator('tr, li').filter({ hasText: nome }).filter({ visible: true })
}

/** Um botão, pelo nome exato, dentro de um lugar: toque no celular, clique no Chromebook. */
async function tocar(alvo: Locator, nome: string | RegExp, hasTouch: boolean): Promise<void> {
  const botao = alvo.getByRole('button', { name: nome, exact: typeof nome === 'string' })
  if (hasTouch) await botao.tap()
  else await botao.click()
}

/** O link que o diálogo mostra, no campo de leitura. */
const linkNaTela = (page: Page) => noDialogo(page).getByLabel('Link do convite').inputValue()

/** O token de um link de convite: o que vem depois do `#`. */
const tokenDo = (link: string) => new URL(link).hash.slice(1)

/** Convidar pela linha da escola, até o link na tela. Devolve o link. */
async function gerarPelaTela(page: Page, escolaNome: string, hasTouch: boolean, email = `coord-${crypto.randomUUID().slice(0, 8)}@educa.invalid`): Promise<string> {
  await tocar(itemDaEscola(page, escolaNome), `Convidar a coordenação de ${escolaNome}`, hasTouch)
  await noDialogo(page).getByLabel('Nome da coordenadora').fill('Coordenadora sintética')
  await noDialogo(page).getByLabel('E-mail da coordenadora').fill(email)
  await tocar(noDialogo(page), 'Revisar', hasTouch)
  await tocar(noDialogo(page), 'Gerar convite', hasTouch)
  await expect(noDialogo(page).getByRole('heading', { name: 'Copie o link do convite' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  return linkNaTela(page)
}

/** Refazer pela linha da escola, com a confirmação, até o link novo na tela. Devolve o link. */
async function refazerPelaTela(page: Page, escolaNome: string, hasTouch: boolean): Promise<string> {
  await tocar(itemDaEscola(page, escolaNome), `Refazer o convite de ${escolaNome}`, hasTouch)
  await tocar(noDialogo(page), 'Refazer convite', hasTouch)
  await expect(noDialogo(page).getByRole('heading', { name: 'Copie o link do convite' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  return linkNaTela(page)
}

/** A pergunta de fechar sem o link copiado. */
const pergunta = (page: Page) => noDialogo(page).getByRole('heading', { name: 'Fechar sem copiar o link?' })

/** Aperta Tab até o foco chegar no alvo, sem passar de 40 teclas. */
async function tabAte(page: Page, alvo: Locator): Promise<void> {
  for (let tecla = 0; tecla < 40; tecla++) {
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error('o Tab não chegou ao alvo')
}

const focoDentroDoDialogo = (page: Page) => page.evaluate(() => document.activeElement?.closest('dialog[open]') !== null && document.activeElement !== null)

/** A lista de escolas que a tela pede a partir de agora (qualquer página e ordem). */
function proximaLista(page: Page) {
  return page.waitForResponse((resposta) => {
    const url = new URL(resposta.url())
    return url.pathname === '/v1/operacao/escolas' && url.search !== '' && resposta.request().method() === 'GET' && resposta.ok()
  })
}

/**
 * Tudo por onde o token poderia sair da tela (regra 20, item 8): endereços pedidos, endereços por onde a aba passou,
 * mensagens do console. `semToken` confere, e confere também o armazenamento e o histórico da aba.
 */
function vigiarAba(page: Page) {
  const rastros: string[] = []
  page.on('request', (pedido) => rastros.push(pedido.url()))
  page.on('framenavigated', (quadro) => rastros.push(quadro.url()))
  page.on('console', (mensagem) => rastros.push(mensagem.text()))
  return async function semToken(...tokens: string[]): Promise<void> {
    const guardado = await page.evaluate(() => ({
      local: JSON.stringify(Object.entries(localStorage)),
      sessao: JSON.stringify(Object.entries(sessionStorage)),
      historico: JSON.stringify(history.state),
      endereco: location.href,
    }))
    for (const token of tokens) {
      for (const rastro of rastros) expect(rastro, 'token numa URL, numa navegação ou no console').not.toContain(token)
      expect(guardado.local).not.toContain(token)
      expect(guardado.sessao).not.toContain(token)
      expect(guardado.historico).not.toContain(token)
      expect(guardado.endereco).not.toContain(token)
    }
  }
}

/** Os botões de ação da escola têm o alvo de toque da ação principal (W6). */
async function conferirAlvos(item: Locator): Promise<void> {
  const botoes = await item.getByRole('button').all()
  expect(botoes.length).toBeGreaterThan(0)
  for (const botao of botoes) {
    const caixa = await botao.boundingBox()
    const nome = (await botao.textContent()) ?? ''
    expect(caixa?.height ?? 0, nome).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(caixa?.width ?? 0, nome).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  }
}

/** Sem rolagem horizontal no documento nem no diálogo aberto, e o axe limpo (W6, W7). */
async function conferirDialogo(page: Page): Promise<void> {
  expect(await larguraExcedenteDoDialogo(page)).toBe(0)
  expect(await larguraExcedente(page)).toBe(0)
  expect(await violacoesGraves(page)).toEqual([])
}

test.describe('O convite da coordenação pelo painel (A0b, tarefa 7.0)', () => {
  test('W1, W6 e W10: criar rede e escola, convidar e copiar; a coordenadora ativa, e a lista mostra Ativa com as contagens', async ({ page, browser, hasTouch }) => {
    test.slow()
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)
    const marca = crypto.randomUUID().slice(0, 8)
    const nomeDaRede = nomeQueVemPrimeiro('Rede do W1')
    const nomeDaEscola = nomeQueVemPrimeiro('Escola do W1')
    const endereco = `w1-${marca}`

    // Rede e escola pela tela, com a revisão do endereço.
    await acionar(page, 'Nova rede', hasTouch)
    await noDialogo(page).getByLabel('Nome da rede').fill(nomeDaRede, { timeout: PRAZO_DA_ENTRADA_MS })
    await tocar(noDialogo(page), 'Criar rede', hasTouch)
    await expect(page.getByRole('status').filter({ hasText: `Rede ${nomeDaRede} criada.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(page, 'Nova escola', hasTouch)
    await expect(noDialogo(page).getByLabel('Rede').locator('option:checked')).toHaveText(nomeDaRede, { timeout: PRAZO_DA_ENTRADA_MS })
    await noDialogo(page).getByLabel('Nome da escola').fill(nomeDaEscola)
    await noDialogo(page).getByLabel('Endereço da escola').fill(endereco)
    await tocar(noDialogo(page), 'Revisar', hasTouch)
    await expect(noDialogo(page)).toContainText(`/e/${endereco}`)
    await tocar(noDialogo(page), 'Criar escola', hasTouch)
    await expect(page.getByRole('status').filter({ hasText: `Escola ${nomeDaEscola} criada.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const escolaId = await idDaEscolaComOEndereco(endereco)

    // A escola nova, sem convite: só "Convidar", com o alvo de toque da ação principal, e a tela cabe a 360 px.
    const item = itemDaEscola(page, nomeDaEscola)
    await expect(item).toContainText('Sem convite', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(item.getByRole('button')).toHaveCount(1)
    await conferirAlvos(item)
    expect(await larguraExcedente(page)).toBe(0)

    // O formulário: o e-mail com o teclado de e-mail, e nada que o navegador guarde para completar depois.
    await tocar(item, `Convidar a coordenação de ${nomeDaEscola}`, hasTouch)
    const campoNome = noDialogo(page).getByLabel('Nome da coordenadora')
    const campoEmail = noDialogo(page).getByLabel('E-mail da coordenadora')
    await expect(campoNome).toBeFocused()
    await expect(campoNome).toHaveAttribute('autocomplete', 'off')
    await expect(campoEmail).toHaveAttribute('inputmode', 'email')
    await expect(campoEmail).toHaveAttribute('autocomplete', 'off')
    await conferirDialogo(page)
    await campoNome.fill('  Coordenadora sintética do W1 ')
    await campoEmail.fill(`Coord-W1-${marca}@Educa.INVALID`)
    await tocar(noDialogo(page), 'Revisar', hasTouch)

    // O resumo antes de enviar: a escola, o nome e o e-mail como vão ao servidor, a validade e o "aparece uma vez".
    await expect(noDialogo(page).getByRole('heading', { name: 'Confira antes de gerar' })).toBeFocused()
    await expect(noDialogo(page)).toContainText(nomeDaEscola)
    await expect(noDialogo(page)).toContainText('Coordenadora sintética do W1')
    await expect(noDialogo(page)).toContainText(`coord-w1-${marca}@educa.invalid`)
    await expect(noDialogo(page)).toContainText('O convite vale 72 horas e entra uma vez só.')
    await expect(noDialogo(page)).toContainText('O link aparece uma vez, logo depois de gerar.')
    await conferirDialogo(page)
    expect(await convitesEmAberto(escolaId)).toBe(0)

    // Gerar: o link com a origem desta web e o token no fragmento, num campo de leitura.
    await tocar(noDialogo(page), 'Gerar convite', hasTouch)
    await expect(noDialogo(page).getByRole('heading', { name: 'Copie o link do convite' })).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    const link = await linkNaTela(page)
    const origem = new URL(page.url()).origin
    expect(link).toMatch(new RegExp(`^${origem.replaceAll('.', '\\.')}/convite#[A-Za-z0-9_-]{43}$`))
    await expect(noDialogo(page).getByLabel('Link do convite')).toHaveAttribute('readonly', '')
    await conferirDialogo(page)

    // Copiar: "Link copiado." anunciado dentro do diálogo, e o link na área de transferência.
    await tocar(noDialogo(page), 'Copiar link', hasTouch)
    await expect(noDialogo(page).getByRole('status').filter({ hasText: 'Link copiado.' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link)
    // Copiado, o "Fechar" fecha sem perguntar.
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    await expect(item).toContainText('Convite enviado, ainda não aberto', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(item.getByRole('button', { name: `Refazer o convite de ${nomeDaEscola}` })).toBeVisible()
    await expect(item.getByRole('button', { name: `Revogar o convite de ${nomeDaEscola}` })).toBeVisible()
    await conferirAlvos(item)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await convitesEmAberto(escolaId)).toBe(1)

    // A coordenadora, no computador dela, abre o link e ativa a conta com a senha nova.
    const coordenadora = await outroNavegador(browser)
    await coordenadora.goto(link)
    await expect(coordenadora.getByRole('main')).toContainText(nomeDaEscola, { timeout: PRAZO_DA_ENTRADA_MS })
    await tocar(coordenadora.getByRole('main'), 'Aceitar o convite', hasTouch)
    await coordenadora.getByLabel('Senha nova').fill(SENHA_NOVA, { timeout: PRAZO_DA_ENTRADA_MS })
    await tocar(coordenadora.getByRole('main'), 'Definir a senha e continuar', hasTouch)
    await expect(coordenadora.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // A lista, recarregada, mostra a escola Ativa e, sem turma (nada foi importado ainda), "Sem turma ainda" no lugar das
    // três contagens, e sem ação.
    const recarregada = proximaLista(page)
    await page.reload()
    const lista = (await (await recarregada).json()) as EscolasDoPainelResponse
    const naLista = lista.itens.find((escola) => escola.id === escolaId)
    expect(naLista).toMatchObject({ estado: 'ativa', turmas: 0, professores: 0, alunos: 0 })
    await expect(item).toContainText('Ativa', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(item.getByText('Sem turma ainda')).toBeVisible()
    await expect(item.getByRole('button')).toHaveCount(0)
  })

  test('W2 e W10: um operador refaz; o outro, com a lista velha, vê "o convite mudou" e a lista recarrega; o revogar já revogado', async ({ page, browser, hasTouch }) => {
    test.slow()
    const escola = await semearEscolaDoConvite('pendente')
    const primeiro = await novoOperador()
    const segundo = await novoOperador()
    await entrarNaOperacao(page, primeiro, hasTouch)
    const outra = await outroNavegador(browser)
    await entrarNaOperacao(outra, segundo, hasTouch)
    for (const aba of [page, outra]) {
      await expect(itemDaEscola(aba, escola.nome)).toContainText('Convite enviado, ainda não aberto', { timeout: PRAZO_DA_ENTRADA_MS })
    }
    await conferirAlvos(itemDaEscola(page, escola.nome))
    expect(await larguraExcedente(page)).toBe(0)

    // O primeiro refaz, com a confirmação que diz que o link anterior para; o foco começa no texto, não no botão.
    await tocar(itemDaEscola(page, escola.nome), `Refazer o convite de ${escola.nome}`, hasTouch)
    await expect(noDialogo(page).getByText('O link mandado antes para de valer na hora.', { exact: false })).toBeFocused()
    await conferirDialogo(page)
    await tocar(noDialogo(page), 'Refazer convite', hasTouch)
    await expect(noDialogo(page).getByRole('heading', { name: 'Copie o link do convite' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const novo = await ultimoConviteDaEscola(escola.id)
    expect(novo).not.toBe(escola.conviteId)
    // Fecha sem copiar, pela pergunta.
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(pergunta(page)).toBeFocused()
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)

    // O segundo, com a lista de antes, refaz o mesmo convite: "o convite mudou", dentro do diálogo, e a lista recarrega
    // com o convite que o primeiro fez.
    const recarregada = proximaLista(outra)
    await tocar(itemDaEscola(outra, escola.nome), `Refazer o convite de ${escola.nome}`, hasTouch)
    await tocar(noDialogo(outra), 'Refazer convite', hasTouch)
    await expect(noDialogo(outra).getByRole('alert')).toHaveText(TEXTO_DO_CONVITE_QUE_MUDOU, { timeout: PRAZO_DA_ENTRADA_MS })
    const lista = (await (await recarregada).json()) as EscolasDoPainelResponse
    expect(lista.itens.find((item) => item.id === escola.id)).toMatchObject({ estado: 'pendente', conviteId: novo })
    await expect(noDialogo(outra).getByRole('button', { name: 'Refazer convite' })).toHaveCount(0)
    expect(await violacoesGraves(outra)).toEqual([])
    await tocar(noDialogo(outra), 'Fechar', hasTouch)
    await expect(noDialogo(outra)).toHaveCount(0)
    expect(await convitesEmAberto(escola.id)).toBe(1)
    expect(await ultimoConviteDaEscola(escola.id)).toBe(novo)

    // O primeiro revoga, com confirmação: a escola fica com o convite revogado, e o anúncio sai com o diálogo fechado.
    await tocar(itemDaEscola(page, escola.nome), `Revogar o convite de ${escola.nome}`, hasTouch)
    await expect(noDialogo(page).getByText('deixa de valer na hora', { exact: false })).toBeFocused()
    await conferirDialogo(page)
    await tocar(noDialogo(page), 'Revogar convite', hasTouch)
    await expect(page.getByRole('status').filter({ hasText: `Convite de ${escola.nome} revogado.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page)).toHaveCount(0)
    await expect(itemDaEscola(page, escola.nome)).toContainText('Convite revogado', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(itemDaEscola(page, escola.nome).getByRole('button', { name: `Convidar a coordenação de ${escola.nome}` })).toBeVisible()
    expect(await convitesEmAberto(escola.id)).toBe(0)

    // O segundo, com a lista de antes do revogar, revoga o mesmo: "esse convite já não vale", e a lista recarrega.
    const depoisDoRevogar = proximaLista(outra)
    await tocar(itemDaEscola(outra, escola.nome), `Revogar o convite de ${escola.nome}`, hasTouch)
    await tocar(noDialogo(outra), 'Revogar convite', hasTouch)
    await expect(noDialogo(outra).getByRole('alert')).toHaveText(TEXTO_DO_CONVITE_QUE_NAO_VALE, { timeout: PRAZO_DA_ENTRADA_MS })
    const revogada = (await (await depoisDoRevogar).json()) as EscolasDoPainelResponse
    expect(revogada.itens.find((item) => item.id === escola.id)?.estado).toBe('revogado')
    // O "Revogar" que abriu o diálogo saiu da linha com a lista recarregada: fechado o diálogo, o foco vai para o
    // "Convidar" da mesma escola.
    await expect(itemDaEscola(outra, escola.nome).getByRole('button', { name: `Revogar o convite de ${escola.nome}` })).toHaveCount(0)
    await tocar(noDialogo(outra), 'Fechar', hasTouch)
    await expect(itemDaEscola(outra, escola.nome)).toContainText('Convite revogado')
    await expect(itemDaEscola(outra, escola.nome).getByRole('button', { name: `Convidar a coordenação de ${escola.nome}` })).toBeFocused()
  })

  test('W3: fechar sem copiar pergunta, pelo botão, pelo Esc e pelo toque fora; fechando, refaz, e o link anterior não vale', async ({ page, browser, hasTouch }) => {
    test.slow()
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const escola = await semearEscolaDoConvite('sem_convite')
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)
    await expect(itemDaEscola(page, escola.nome)).toContainText('Sem convite', { timeout: PRAZO_DA_ENTRADA_MS })
    const anterior = await gerarPelaTela(page, escola.nome, hasTouch)

    // O "Fechar", o Esc e o toque no fundo, fora da caixa, caem na mesma pergunta; "Voltar ao convite" devolve o mesmo link.
    const pedidosDeFechar: ((page: Page) => Promise<void>)[] = [
      (aba) => tocar(noDialogo(aba), 'Fechar', hasTouch),
      (aba) => aba.keyboard.press('Escape'),
      (aba) => (hasTouch ? aba.touchscreen.tap(4, 4) : aba.mouse.click(4, 4)),
    ]
    for (const pedirParaFechar of pedidosDeFechar) {
      await pedirParaFechar(page)
      await expect(pergunta(page)).toBeFocused()
      await expect(noDialogo(page)).toContainText('Se fechar agora, ele não aparece de novo')
      expect(await violacoesGraves(page)).toEqual([])
      expect(await larguraExcedenteDoDialogo(page)).toBe(0)
      await tocar(noDialogo(page), 'Voltar ao convite', hasTouch)
      await expect(noDialogo(page).getByRole('heading', { name: 'Copie o link do convite' })).toBeFocused()
      expect(await linkNaTela(page)).toBe(anterior)
    }

    // Fecha sem copiar; a escola fica com o convite pendente, e o operador refaz.
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    await expect(itemDaEscola(page, escola.nome)).toContainText('Convite enviado, ainda não aberto', { timeout: PRAZO_DA_ENTRADA_MS })
    const novo = await refazerPelaTela(page, escola.nome, hasTouch)
    expect(novo).not.toBe(anterior)
    await tocar(noDialogo(page), 'Copiar link', hasTouch)
    await expect(noDialogo(page).getByRole('status').filter({ hasText: 'Link copiado.' })).toBeVisible()
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)

    // O link anterior abre a tela de convite inválido, sem o nome da escola; o novo abre o convite.
    const coordenadora = await outroNavegador(browser)
    await coordenadora.goto(anterior)
    await expect(coordenadora.getByRole('alert')).toHaveText(mensagemDoConvite('NAO_ENCONTRADO'), { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(coordenadora.locator('body')).not.toContainText(escola.nome)
    const outraAba = await coordenadora.context().newPage()
    await outraAba.goto(novo)
    await expect(outraAba.getByRole('main')).toContainText(escola.nome, { timeout: PRAZO_DA_ENTRADA_MS })
  })

  test('W4: recarregar não mostra o link; o operador que entra depois na mesma aba não vê a lista nem o diálogo do primeiro; o token não sai da tela', async ({ page, hasTouch }) => {
    test.slow()
    const escola = await semearEscolaDoConvite('sem_convite')
    const primeiro = await novoOperador()
    const segundo = await novoOperador()
    const semToken = vigiarAba(page)
    await entrarNaOperacao(page, primeiro, hasTouch)
    await expect(itemDaEscola(page, escola.nome)).toContainText('Sem convite', { timeout: PRAZO_DA_ENTRADA_MS })
    const gerado = tokenDo(await gerarPelaTela(page, escola.nome, hasTouch))

    // Recarregar: nada do link, nem o diálogo; a escola mostra o convite pendente, e o caminho é refazer.
    const recarregada = proximaLista(page)
    await page.reload()
    await recarregada
    await expect(itemDaEscola(page, escola.nome)).toContainText('Convite enviado, ainda não aberto', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('dialog')).toHaveCount(0)
    expect(await page.content()).not.toContain(gerado)
    await semToken(gerado)

    // Com o link do refazer aberto no diálogo, outra aba da operação sai: esta aba vai à entrada, sem o diálogo.
    const refeito = tokenDo(await refazerPelaTela(page, escola.nome, hasTouch))
    const aba = await page.context().newPage()
    await aba.goto('/operacao')
    await esperarCasca(aba, primeiro)
    await acionar(aba, 'Sair', hasTouch)
    await expect(page.getByRole('heading', { name: 'Entrar na operação' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('dialog')).toHaveCount(0)
    expect(await page.content()).not.toContain(refeito)
    await aba.close()

    // O segundo operador entra na mesma aba, sem recarregar: a lista é a dele, sem diálogo, e nada dos dois links.
    await page.getByLabel('E-mail').fill(segundo.email)
    await page.getByLabel('Senha').fill(segundo.senha)
    await acionar(page, /^Entrar$/, hasTouch)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await page.getByLabel('Código do aplicativo').fill(codigoDoOperador(segundo))
    await acionar(page, /^Entrar$/, hasTouch)
    await expect(page.getByRole('banner')).toContainText(segundo.nome, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(itemDaEscola(page, escola.nome)).toContainText('Convite enviado, ainda não aberto', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('dialog')).toHaveCount(0)
    const tela = await page.content()
    expect(tela).not.toContain(gerado)
    expect(tela).not.toContain(refeito)
    await semToken(gerado, refeito)
  })

  test('W8: convidar só com Tab e Enter, com o foco preso no diálogo; o Esc cai na pergunta, o segundo fecha, e o navegador fechando desmonta; o foco depois de revogar', async ({ page, hasTouch }) => {
    test.slow()
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const escola = await semearEscolaDoConvite('sem_convite')
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)
    const convidar = itemDaEscola(page, escola.nome).getByRole('button', { name: `Convidar a coordenação de ${escola.nome}` })
    await expect(convidar).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    await tabAte(page, convidar)
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByLabel('Nome da coordenadora')).toBeFocused()
    await page.keyboard.type('Coordenadora do teclado')
    await page.keyboard.press('Tab')
    await expect(noDialogo(page).getByLabel('E-mail da coordenadora')).toBeFocused()
    await page.keyboard.type(`teclado-${crypto.randomUUID().slice(0, 8)}@educa.invalid`)
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByRole('heading', { name: 'Confira antes de gerar' })).toBeFocused()
    for (let tecla = 0; tecla < 8; tecla++) {
      await page.keyboard.press('Tab')
      expect(await focoDentroDoDialogo(page)).toBe(true)
    }
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Gerar convite' }))
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByRole('heading', { name: 'Copie o link do convite' })).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    for (let tecla = 0; tecla < 8; tecla++) {
      await page.keyboard.press('Shift+Tab')
      expect(await focoDentroDoDialogo(page)).toBe(true)
    }

    // O Esc, com o link sem copiar, pergunta; "Voltar ao convite" pelo teclado devolve o link.
    await page.keyboard.press('Escape')
    await expect(pergunta(page)).toBeFocused()
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Voltar ao convite' }))
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByRole('heading', { name: 'Copie o link do convite' })).toBeFocused()

    // Copiar e fechar pelo teclado: fecha sem perguntar, e o foco volta ao botão da escola, que agora é o de refazer.
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Copiar link' }))
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByRole('status').filter({ hasText: 'Link copiado.' })).toBeVisible()
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Fechar', exact: true }))
    await page.keyboard.press('Enter')
    await expect(noDialogo(page)).toHaveCount(0)
    const refazer = itemDaEscola(page, escola.nome).getByRole('button', { name: `Refazer o convite de ${escola.nome}` })
    await expect(refazer).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })

    // Dois Esc seguidos, sem tecla nem clique entre eles: o primeiro pergunta, o segundo fecha — e fecha de verdade. O Chrome
    // não deixa o segundo `cancel` ser segurado sem um gesto entre os dois, e fecha o `dialog` sozinho; o diálogo precisa
    // sair da página (não só da árvore de acessibilidade), com o link junto.
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByText('O link mandado antes para de valer na hora.', { exact: false })).toBeFocused()
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Refazer convite' }))
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByRole('heading', { name: 'Copie o link do convite' })).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    const token = tokenDo(await linkNaTela(page))
    await page.keyboard.press('Escape')
    await expect(pergunta(page)).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog')).toHaveCount(0)
    expect(await page.content()).not.toContain(token)
    // A tela continua viva: o "Refazer" da escola abre o diálogo de novo, na confirmação.
    await tocar(itemDaEscola(page, escola.nome), `Refazer o convite de ${escola.nome}`, hasTouch)
    await expect(noDialogo(page).getByRole('button', { name: 'Refazer convite' })).toBeVisible()
    await expect(noDialogo(page).getByLabel('Link do convite')).toHaveCount(0)

    // O navegador fecha o `dialog` por conta própria (o segundo Esc sem gesto no Chrome que aplica a regra do `cancel`, que
    // o Chromium do teste não aplica): a tela desmonta o diálogo e o link, como no "Fechar sem copiar".
    await tocar(noDialogo(page), 'Refazer convite', hasTouch)
    await expect(noDialogo(page).getByRole('heading', { name: 'Copie o link do convite' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const fechadoPeloNavegador = tokenDo(await linkNaTela(page))
    await page.locator('dialog').evaluate((dialogo: HTMLDialogElement) => dialogo.close())
    await expect(page.locator('dialog')).toHaveCount(0)
    expect(await page.content()).not.toContain(fechadoPeloNavegador)

    // Revogar só pelo teclado: o "Revogar" sai da linha quando a lista recarrega (`revogado` só tem "Convidar"), e o foco
    // vai para o "Convidar" da mesma escola, não para o `body`.
    const revogar = itemDaEscola(page, escola.nome).getByRole('button', { name: `Revogar o convite de ${escola.nome}` })
    await expect(revogar).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await tabAte(page, revogar)
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByText('deixa de valer na hora', { exact: false })).toBeFocused()
    const listaDoRevogado = proximaLista(page)
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Revogar convite' }))
    await page.keyboard.press('Enter')
    await listaDoRevogado
    await expect(itemDaEscola(page, escola.nome)).toContainText('Convite revogado')
    await expect(itemDaEscola(page, escola.nome).getByRole('button', { name: `Convidar a coordenação de ${escola.nome}` })).toBeFocused()
  })

  test('W9: sem a área de transferência, Copiar seleciona o campo e pede a cópia; a cópia à mão conta; com ela, "Link copiado"', async ({ page, hasTouch }) => {
    test.slow()
    // Sem `navigator.clipboard`, como num endereço fora de contexto seguro.
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined, configurable: true }))
    const escola = await semearEscolaDoConvite('sem_convite')
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)
    await expect(itemDaEscola(page, escola.nome)).toContainText('Sem convite', { timeout: PRAZO_DA_ENTRADA_MS })
    const link = await gerarPelaTela(page, escola.nome, hasTouch)

    await tocar(noDialogo(page), 'Copiar link', hasTouch)
    await expect(noDialogo(page).getByRole('status')).toHaveText(TEXTO_DO_LINK_SELECIONADO)
    const campo = noDialogo(page).getByLabel('Link do convite')
    await expect(campo).toBeFocused()
    expect(await campo.evaluate((elemento: HTMLInputElement) => [elemento.selectionStart, elemento.selectionEnd, elemento.value.length])).toEqual([0, link.length, link.length])
    // Sem cópia confirmada, fechar ainda pergunta.
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(pergunta(page)).toBeVisible()
    await tocar(noDialogo(page), 'Voltar ao convite', hasTouch)

    // A pessoa copia à mão, no campo selecionado: conta como cópia, e o "Fechar" fecha direto.
    await campo.focus()
    await page.keyboard.press('ControlOrMeta+c')
    await expect(noDialogo(page).getByRole('status')).toHaveText('Link copiado.')
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)

    // Com a área de transferência (outra aba, sem o que a tirou), o Copiar copia e anuncia.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const aba = await page.context().newPage()
    await aba.goto('/operacao')
    await esperarCasca(aba, operador)
    await expect(itemDaEscola(aba, escola.nome)).toContainText('Convite enviado, ainda não aberto', { timeout: PRAZO_DA_ENTRADA_MS })
    const refeito = await refazerPelaTela(aba, escola.nome, hasTouch)
    await tocar(noDialogo(aba), 'Copiar link', hasTouch)
    await expect(noDialogo(aba).getByRole('status')).toHaveText('Link copiado.')
    expect(await aba.evaluate(() => navigator.clipboard.readText())).toBe(refeito)
  })

  test('clique duplo em "Gerar convite": um pedido só, um link só, e a escola com um convite em aberto', async ({ page, hasTouch }) => {
    test.slow()
    const escola = await semearEscolaDoConvite('sem_convite')
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)
    let pedidos = 0
    let soltar: () => void = () => undefined
    const seguro = new Promise<void>((resolver) => {
      soltar = resolver
    })
    const segurar = async (rota: Route) => {
      if (rota.request().method() !== 'POST') return rota.fallback()
      pedidos++
      await seguro
      return rota.fallback()
    }
    await page.route(ROTA_DO_GERAR, segurar)
    await tocar(itemDaEscola(page, escola.nome), `Convidar a coordenação de ${escola.nome}`, hasTouch)
    await noDialogo(page).getByLabel('Nome da coordenadora').fill('Coordenadora do clique duplo', { timeout: PRAZO_DA_ENTRADA_MS })
    await noDialogo(page).getByLabel('E-mail da coordenadora').fill(`duplo-${crypto.randomUUID().slice(0, 8)}@educa.invalid`)
    await tocar(noDialogo(page), 'Revisar', hasTouch)
    await noDialogo(page).getByRole('button', { name: 'Gerar convite' }).dblclick()
    await expect.poll(() => pedidos).toBe(1)
    await expect(noDialogo(page).getByRole('button', { name: 'Gerando…' })).toBeDisabled()
    soltar()
    await expect(noDialogo(page).getByRole('heading', { name: 'Copie o link do convite' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByLabel('Link do convite')).toHaveCount(1)
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    expect(pedidos).toBe(1)
    expect(await convitesEmAberto(escola.id)).toBe(1)
    await page.unroute(ROTA_DO_GERAR, segurar)
  })

  test('clique duplo em "Refazer convite" e em "Revogar convite": um pedido só; o link novo na tela, sem "o convite mudou"', async ({ page, hasTouch }) => {
    test.slow()
    const escola = await semearEscolaDoConvite('pendente')
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)
    await expect(itemDaEscola(page, escola.nome)).toContainText('Convite enviado, ainda não aberto', { timeout: PRAZO_DA_ENTRADA_MS })

    let pedidos = 0
    let soltar: () => void = () => undefined
    let seguro = new Promise<void>((resolver) => {
      soltar = resolver
    })
    const segurar = async (rota: Route) => {
      pedidos++
      await seguro
      return rota.fallback()
    }

    // Refazer: o segundo clique, com o primeiro no ar, receberia CONFLITO na mesma mutação, e o link novo — que aparece uma
    // vez só — se perderia sem ser mostrado.
    await page.route(ROTA_DO_REFAZER, segurar)
    await tocar(itemDaEscola(page, escola.nome), `Refazer o convite de ${escola.nome}`, hasTouch)
    const refeito = page.waitForResponse((resposta) => ROTA_DO_REFAZER(new URL(resposta.url())) && resposta.ok())
    await noDialogo(page).getByRole('button', { name: 'Refazer convite' }).dblclick()
    await expect.poll(() => pedidos).toBe(1)
    const listaDepois = proximaLista(page)
    soltar()
    const { conviteId, token } = (await (await refeito).json()) as ConviteDaCoordenacaoResponse
    await expect(noDialogo(page).getByRole('heading', { name: 'Copie o link do convite' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(tokenDo(await linkNaTela(page))).toBe(token)
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    expect(pedidos).toBe(1)
    expect(await ultimoConviteDaEscola(escola.id)).toBe(conviteId)
    expect(await convitesEmAberto(escola.id)).toBe(1)
    await page.unroute(ROTA_DO_REFAZER, segurar)
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await listaDepois

    // Revogar: um pedido só, e o anúncio do revogado, sem "esse convite já não vale".
    pedidos = 0
    seguro = new Promise<void>((resolver) => {
      soltar = resolver
    })
    await page.route(ROTA_DO_REVOGAR, segurar)
    await tocar(itemDaEscola(page, escola.nome), `Revogar o convite de ${escola.nome}`, hasTouch)
    await noDialogo(page).getByRole('button', { name: 'Revogar convite' }).dblclick()
    await expect.poll(() => pedidos).toBe(1)
    soltar()
    await expect(page.getByRole('status').filter({ hasText: `Convite de ${escola.nome} revogado.` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('dialog')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(pedidos).toBe(1)
    expect(await convitesEmAberto(escola.id)).toBe(0)
    await page.unroute(ROTA_DO_REVOGAR, segurar)
  })

  test('recomeço: a resposta atrasada do refazer não cai no diálogo aberto para outra escola, e a do revogar não o fecha', async ({ page, hasTouch }) => {
    test.slow()
    const primeira = await semearEscolaDoConvite('pendente')
    const outra = await semearEscolaDoConvite('pendente')
    const operador = await novoOperador()
    await entrarNaOperacao(page, operador, hasTouch)
    for (const escola of [primeira, outra]) {
      await expect(itemDaEscola(page, escola.nome)).toContainText('Convite enviado, ainda não aberto', { timeout: PRAZO_DA_ENTRADA_MS })
    }

    let soltar: () => void = () => undefined
    let seguro = new Promise<void>((resolver) => {
      soltar = resolver
    })
    const segurar = async (rota: Route) => {
      await seguro
      return rota.fallback()
    }
    /** O diálogo do refazer da outra escola, ainda na confirmação: o texto dela, e nenhum link. */
    async function outraNaConfirmacao(): Promise<void> {
      await expect(noDialogo(page).getByText('O link mandado antes para de valer na hora.', { exact: false })).toContainText(outra.nome)
      await expect(noDialogo(page).getByRole('button', { name: 'Refazer convite' })).toBeEnabled()
      await expect(noDialogo(page).getByLabel('Link do convite')).toHaveCount(0)
    }

    // O refazer da primeira sai e fica no ar; o operador fecha sem esperar (a pergunta avisa) e abre o refazer da outra
    // escola, o mesmo diálogo, na confirmação.
    await page.route(ROTA_DO_REFAZER, segurar)
    await tocar(itemDaEscola(page, primeira.nome), `Refazer o convite de ${primeira.nome}`, hasTouch)
    await tocar(noDialogo(page), 'Refazer convite', hasTouch)
    await expect(noDialogo(page).getByRole('button', { name: 'Refazendo…' })).toBeDisabled()
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(pergunta(page)).toBeFocused()
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    await tocar(itemDaEscola(page, outra.nome), `Refazer o convite de ${outra.nome}`, hasTouch)
    await outraNaConfirmacao()

    // A resposta da primeira chega: o diálogo da outra continua na confirmação dela, sem o link da primeira.
    const refeito = page.waitForResponse((resposta) => ROTA_DO_REFAZER(new URL(resposta.url())) && resposta.ok())
    // A resposta, mesmo sem diálogo, recarrega a lista: é por ela que a linha da primeira passa a ter o convite novo.
    const listaDepois = proximaLista(page)
    soltar()
    const { conviteId, token } = (await (await refeito).json()) as ConviteDaCoordenacaoResponse
    const lista = (await (await listaDepois).json()) as EscolasDoPainelResponse
    expect(lista.itens.find((item) => item.id === primeira.id)?.conviteId).toBe(conviteId)
    await outraNaConfirmacao()
    expect(await page.content()).not.toContain(token)
    await page.unroute(ROTA_DO_REFAZER, segurar)
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    expect(await ultimoConviteDaEscola(outra.id)).toBe(outra.conviteId)

    // O revogar da primeira sai e fica no ar; o operador cancela e abre o refazer da outra. A resposta não fecha este.
    seguro = new Promise<void>((resolver) => {
      soltar = resolver
    })
    await page.route(ROTA_DO_REVOGAR, segurar)
    await tocar(itemDaEscola(page, primeira.nome), `Revogar o convite de ${primeira.nome}`, hasTouch)
    await tocar(noDialogo(page), 'Revogar convite', hasTouch)
    await expect(noDialogo(page).getByRole('button', { name: 'Revogando…' })).toBeDisabled()
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    await tocar(itemDaEscola(page, outra.nome), `Refazer o convite de ${outra.nome}`, hasTouch)
    await outraNaConfirmacao()
    const revogado = page.waitForResponse((resposta) => ROTA_DO_REVOGAR(new URL(resposta.url())) && resposta.status() === 204)
    soltar()
    await revogado
    // O anúncio sai na tela, atrás do diálogo aberto (que a deixa inerte): pelo seletor, e não pelo papel.
    await expect(page.locator('[role="status"]').filter({ hasText: `Convite de ${primeira.nome} revogado.` })).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page)).toHaveCount(1)
    await outraNaConfirmacao()
    await page.unroute(ROTA_DO_REVOGAR, segurar)
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(itemDaEscola(page, primeira.nome)).toContainText('Convite revogado', { timeout: PRAZO_DA_ENTRADA_MS })
    expect(await convitesEmAberto(primeira.id)).toBe(0)
  })
})
