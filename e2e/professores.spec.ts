import type { Browser, BrowserContextOptions, Locator, Page, Route } from '@playwright/test'
import { AVISO_DO_CONVITE_COM_SENHA_NOVA, MENSAGENS_DE_ERRO, mensagemDoConvite } from '../packages/shared/src/errors/messages.ts'
import type { ConviteDeProfessorResponse } from '../packages/shared/src/professores/professores.ts'
import { abrirNavegacao, entrarComoCoordenacaoNaMesmaAba, abrirEstrutura, irPelaNavegacao, lateral, PRAZO_DA_ENTRADA_MS, passarPelaIntroducaoDoProfessor, secoes } from './__fixtures__/casca.ts'
import { abrirOQueFalta, irPelaCoordenacao, linhasDaTabela, paginaNaoRola } from './__fixtures__/coordenacao.ts'
import { expect, test } from './__fixtures__/perfis.ts'
import {
  convidarProfessorNoBanco,
  convitesDeProfessorEmAberto,
  criarEquipeComSenha,
  definirInatividadeDaEscola,
  montarEstruturaNoBanco,
  revogarConvite,
  type EquipeDeTeste,
  type EstadoDoProfessorDeTeste,
  type ProfessorDeTeste,
} from './__fixtures__/sessao.ts'
import { desenho } from './__fixtures__/galeria.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, corDoToken, larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './__fixtures__/verificacoes.ts'

/**
 * A tela Professores da coordenação (A1, tarefa 14.0; `tasks/prd-apresentacao-escola/cenarios.md`): W4 e W12 de
 * Professores, o W14 pelo link que a tela dá, o clique duplo e o recomeço da tela. Tudo pela tela, nos projetos
 * `chromebook` e `celular`, com nomes e e-mails inventados pelo teste. Os textos esperados estão aqui por extenso.
 */

const INDISPONIVEL = JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
/** Senha nova do professor sintético: o mínimo do contrato é 12 caracteres. */
const SENHA_NOVA = 'frase-sintetica-do-professor'

/** O que a lista diz de cada estado do convite, em texto. */
const TEXTO_DO_ESTADO: Readonly<Record<EstadoDoProfessorDeTeste, string>> = {
  pendente: 'Convite em aberto, ainda não aceito.',
  vencido: 'Convite vencido. Refaça o convite para gerar um link novo.',
  revogado: 'Convite revogado. Para convidar de novo, cadastre o mesmo e-mail.',
  aceito: 'Convite aceito.',
  ativo: 'Ativo.',
  desativado: 'Desativado. Para convidar de novo, cadastre o mesmo e-mail.',
}

/** As ações que cada estado oferece no painel do professor, pela matriz da Tech Spec, seção 4: só o convite em aberto refaz e revoga. */
const ACOES_DO_ESTADO: Readonly<Record<EstadoDoProfessorDeTeste, readonly string[]>> = {
  pendente: ['Refazer convite', 'Revogar convite'],
  vencido: ['Refazer convite', 'Revogar convite'],
  revogado: [],
  aceito: [],
  ativo: [],
  desativado: [],
}

const TEXTO_DO_CONVITE_QUE_MUDOU = 'O convite mudou. A lista foi atualizada.'
const TEXTO_DO_CONVITE_QUE_NAO_VALE = 'Esse convite já não vale. A lista foi atualizada.'
const TEXTO_DO_EMAIL_JA_CADASTRADO =
  'Este e-mail já é de um professor desta escola, ativo ou com o convite em aberto. Confira o e-mail; para um link novo, use Refazer na lista.'

/** A lista (`GET /v1/professores?…`), o cadastro (`POST /v1/professores`) e o refazer e o revogar de um professor. */
const ehALista = (url: URL) => url.pathname === '/v1/professores'
const ROTA_DO_REFAZER = (url: URL) => url.pathname.startsWith('/v1/professores/') && url.pathname.endsWith('/convite/refazer')
const ROTA_DO_REVOGAR = (url: URL) => url.pathname.startsWith('/v1/professores/') && url.pathname.endsWith('/convite/revogar')

const contextos: { close: () => Promise<void> }[] = []

test.afterEach(async () => {
  for (const contexto of contextos.splice(0)) await contexto.close()
})

/** Outro navegador (o professor, no computador dele), com a tela e o toque do projeto. */
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

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Um botão, pelo nome exato, dentro de um lugar: toque no celular, clique no Chromebook. */
async function tocar(lugar: Locator, nome: string, hasTouch: boolean): Promise<void> {
  await acionar(lugar.getByRole('button', { name: nome, exact: true }), hasTouch)
}

/**
 * Os dois cliques de um clique duplo no mesmo instante, antes de a tela desligar o botão: é o caso que o botão desligado
 * não segura, e que só a trava do pedido no ar segura.
 */
async function doisCliquesNoMesmoInstante(botao: Locator): Promise<void> {
  await botao.evaluate((elemento: HTMLButtonElement) => {
    elemento.click()
    elemento.click()
  })
}

/** Uma porta que segura a resposta até o teste abrir. */
function portao(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

const principal = (page: Page) => page.getByRole('main')
/**
 * Os `dialog` abertos que não são o painel do professor, pelo elemento e não pelo papel: a gaveta fechada da casca também é um
 * `dialog`, abaixo de 768 px, e o painel do professor fica aberto por baixo dos diálogos do convite (dois `<dialog>` modais empilhados).
 */
const dialogosAbertos = (page: Page) => page.locator('dialog[open]:not([data-painel-lado])')
/**
 * Os `dialog` da tela Professores, abertos ou não, fora o painel: ela os desenha dentro do conteúdo, e só enquanto estão abertos. O
 * diálogo que o navegador fechou e a tela não desmontou continuaria aqui, fechado, com o que guardava.
 */
const dialogosDaTela = (page: Page) => principal(page).locator('dialog:not([data-painel-lado])')
/** O diálogo do convite aberto (cadastrar, refazer, revogar): o que está por cima do painel, quando há um. */
const noDialogo = (page: Page): Locator => dialogosAbertos(page)
/** O painel do professor, pelo nome dele no título. */
const painelDe = (page: Page, nome: string) => page.getByRole('dialog', { name: nome })
/** Qualquer painel do professor aberto. */
const paineisAbertos = (page: Page) => page.locator('dialog[data-painel-lado][open]')
/** As linhas da tabela (a partir de 768 px) ou os itens da lista (abaixo), todas as da tela. */
const linhasDaLista = (page: Page) => linhasDaTabela(principal(page))
/** A linha de um professor, pelo nome. */
const linhaDe = (page: Page, nome: string) => linhasDaLista(page).filter({ hasText: nome })
/** O botão do nome, que abre o painel do professor. */
const botaoDaLinha = (page: Page, nome: string) => linhaDe(page, nome).getByRole('button', { name: nome })
/** O título da lista, para onde o foco vai quando o botão que abriu o diálogo saiu da tela. */
const tituloDaLista = (page: Page) => principal(page).getByRole('heading', { name: 'Professores da escola' })
/** O anúncio da ação que terminou, no painel do professor. */
const anuncio = (page: Page, texto: string) => principal(page).getByRole('status').filter({ hasText: texto })
/** Os botões de ação do painel (o rodapé), sem o "Fechar" do cabeçalho. */
const acoesDoPainel = (painel: Locator) => painel.locator('button:not([aria-label="Fechar"])')
/** A pergunta de fechar sem o link copiado. */
const pergunta = (page: Page) => noDialogo(page).getByRole('heading', { name: 'Fechar sem copiar o link?' })
/** O título da etapa do link. */
const etapaDoLink = (page: Page) => noDialogo(page).getByRole('heading', { name: 'Copie o link do convite' })
/** O link que o diálogo mostra, no campo de leitura. */
const linkNaTela = (page: Page) => noDialogo(page).getByLabel('Link do convite').inputValue()
/** O token de um link de convite: o que vem depois do `#`. */
const tokenDo = (link: string) => new URL(link).hash.slice(1)

async function alvoDeToque(alvo: Locator, descricao: string): Promise<void> {
  const caixa = await alvo.boundingBox()
  expect(caixa, `${descricao} sem caixa`).not.toBeNull()
  expect(caixa?.height ?? 0, descricao).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  expect(caixa?.width ?? 0, descricao).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
}

/** Sem rolagem horizontal no documento nem no diálogo aberto, e o axe limpo. */
async function conferirDialogo(page: Page): Promise<void> {
  expect(await larguraExcedenteDoDialogo(page)).toBe(0)
  expect(await larguraExcedente(page)).toBe(0)
  expect(await violacoesGraves(page)).toEqual([])
}

/** Aperta Tab até o foco chegar no alvo, sem passar de 40 teclas. */
async function tabAte(page: Page, alvo: Locator): Promise<void> {
  for (let tecla = 0; tecla < 40; tecla++) {
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error('o Tab não chegou ao alvo')
}

const focoDentroDoDialogo = (page: Page) => page.evaluate(() => document.activeElement !== null && document.activeElement.closest('dialog[open]') !== null)

/** A lista de professores que a tela pede a partir de agora. */
function proximaLista(page: Page) {
  return page.waitForResponse((resposta) => ehALista(new URL(resposta.url())) && resposta.request().method() === 'GET' && resposta.ok())
}

/** A coordenadora entra e abre Professores pela lateral. */
async function abrirProfessores(page: Page, coordenadora: EquipeDeTeste, hasTouch: boolean): Promise<void> {
  await page.goto('/entrar')
  await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
  await abrirEstrutura(page, hasTouch)
  await irPelaCoordenacao(page, 'Professores', hasTouch)
  await expect(page).toHaveURL(/\/coordenacao\/professores$/)
}

/** Abre o painel do professor pelo botão do nome na linha dele e devolve o painel, já à vista. */
async function abrirPainel(page: Page, nome: string, hasTouch: boolean): Promise<Locator> {
  await acionar(botaoDaLinha(page, nome), hasTouch)
  const painel = painelDe(page, nome)
  await expect(painel).toBeVisible()
  return painel
}

/** Fecha o painel aberto pelo "Fechar" dele: a página por trás é inerte enquanto ele está aberto. */
async function fecharPainel(page: Page, hasTouch: boolean): Promise<void> {
  await acionar(paineisAbertos(page).getByRole('button', { name: 'Fechar', exact: true }), hasTouch)
  await expect(paineisAbertos(page)).toHaveCount(0)
}

/** Refaz pelo painel do professor (que abre se ainda não está aberto), com a confirmação, até o link novo aparecer. Devolve o link. */
async function refazerPelaTela(page: Page, nome: string, hasTouch: boolean): Promise<string> {
  if ((await paineisAbertos(page).count()) === 0) await abrirPainel(page, nome, hasTouch)
  await tocar(painelDe(page, nome), 'Refazer convite', hasTouch)
  await tocar(noDialogo(page), 'Refazer convite', hasTouch)
  await expect(etapaDoLink(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  return linkNaTela(page)
}

const emailSintetico = (inicio: string) => `${inicio}-${crypto.randomUUID().slice(0, 8)}@educa.invalid`

/**
 * Tudo por onde o token poderia sair da tela (regra 20, item 8): endereços pedidos, endereços por onde a aba passou,
 * mensagens do console. `semToken` confere, e confere também o armazenamento, o histórico da aba, o IndexedDB e o Cache
 * Storage.
 */
function vigiarAba(page: Page) {
  const rastros: string[] = []
  page.on('request', (pedido) => rastros.push(pedido.url()))
  page.on('framenavigated', (quadro) => rastros.push(quadro.url()))
  page.on('console', (mensagem) => rastros.push(mensagem.text()))
  return async function semToken(...tokens: string[]): Promise<void> {
    const guardado = await page.evaluate(async () => ({
      local: JSON.stringify(Object.entries(localStorage)),
      sessao: JSON.stringify(Object.entries(sessionStorage)),
      historico: JSON.stringify(history.state),
      endereco: location.href,
      bancos: (await indexedDB.databases()).map((banco) => banco.name),
      caches: await caches.keys(),
    }))
    // A tela não cria banco nem cache no navegador: não há onde o link ficar.
    expect(guardado.bancos).toEqual([])
    expect(guardado.caches).toEqual([])
    for (const token of tokens) {
      for (const rastro of rastros) expect(rastro, 'token numa URL, numa navegação ou no console').not.toContain(token)
      expect(guardado.local).not.toContain(token)
      expect(guardado.sessao).not.toContain(token)
      expect(guardado.historico).not.toContain(token)
      expect(guardado.endereco).not.toContain(token)
    }
  }
}

test.describe('W4 (Professores): os quatro estados', () => {
  test('carregando; o vazio "Nenhum professor ainda" com o Cadastrar; o erro com "Tentar de novo"; e com dado, pelo nome, o estado de cada convite e só as ações que ele permite', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    // A leitura da lista, segurada na primeira vez (o carregando) e depois recusada quando o teste pede (o erro).
    const segurada = portao()
    let falhar = false
    // E, no fim, a lista que não acaba: cada página com um professor só e a marca de que há outra.
    let semFim = false
    let paginasSemFim = 0
    await page.route(ehALista, async (rota: Route) => {
      if (rota.request().method() !== 'GET') return rota.fallback()
      await segurada.aberta
      if (falhar) return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
      if (semFim) {
        paginasSemFim++
        const item = { usuarioId: crypto.randomUUID(), nome: `Professor da página ${String(paginasSemFim)}`, estado: 'ativo' }
        return rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [item], proxima: crypto.randomUUID() }) })
      }
      return rota.fallback()
    })
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await abrirEstrutura(page, hasTouch)

    // W2: o item da lateral leva à tela, com o título dela na aba e as pistas do selecionado.
    await irPelaCoordenacao(page, 'Professores', hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/professores$/)
    await expect(page).toHaveTitle('Escola: professores · Turmma')
    await expect(principal(page).getByRole('heading', { level: 1, name: 'Escola' })).toBeAttached()

    // Carregando.
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando os professores…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    segurada.abrir()

    // Vazio: o convite para agir, com um Cadastrar só.
    await expect(principal(page).getByText('Nenhum professor ainda')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const cadastrar = principal(page).getByRole('button', { name: 'Cadastrar professor' })
    await expect(cadastrar).toHaveCount(1)
    await alvoDeToque(cadastrar, 'Cadastrar professor')
    await expect(linhasDaLista(page)).toHaveCount(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    // Os quatro lugares são a lateral no computador e a barra de baixo no celular: `secoes` acha a navegação onde ela estiver, sem abrir a gaveta.
    await expect(secoes(page).getByRole('link', { name: 'Escola' })).toHaveAttribute('aria-current', 'page')
    await expect(secoes(page).getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current', 'page')

    // O erro com a lista ainda vazia: o primeiro cadastro dá certo, e a releitura depois dele cai. A tela não afirma
    // "Nenhum professor ainda", que negaria o cadastro: mostra o erro, com "Tentar de novo", e o foco não cai no `body`.
    falhar = true
    const primeira = `Yara do primeiro cadastro ${crypto.randomUUID().slice(0, 8)}`
    await acionar(cadastrar, hasTouch)
    await noDialogo(page).getByLabel('Nome do professor').fill(primeira)
    await noDialogo(page).getByLabel('E-mail do professor').fill(emailSintetico('primeira'))
    await tocar(noDialogo(page), 'Revisar', hasTouch)
    await tocar(noDialogo(page), 'Cadastrar e gerar o link', hasTouch)
    await expect(etapaDoLink(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // O link só aparece com a releitura já terminada, em erro: a mutação espera o `recarregar` (o `onSettled` de
    // `api/professores.ts` devolve a promessa dele). Por isso o que vem a seguir não depende de tempo; se o
    // `recarregar` deixar de ser esperado, o foco no título da tela passa a depender.
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    await expect(principal(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    await expect(principal(page).getByText('Nenhum professor ainda')).toHaveCount(0)
    await expect(principal(page).getByRole('heading', { level: 1, name: 'Escola' })).toBeFocused()
    expect(await violacoesGraves(page)).toEqual([])
    falhar = false
    await acionar(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(linhaDe(page, primeira)).toContainText(TEXTO_DO_ESTADO.pendente, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('alert')).toHaveCount(0)

    // Erro: a leitura cai, a tela diz o que fazer, e "Tentar de novo" traz a lista. Um professor em cada estado do
    // convite, criados fora da ordem do nome.
    const nomes: Readonly<Record<EstadoDoProfessorDeTeste, string>> = { pendente: 'Zuleica', vencido: 'Bia', revogado: 'Caio', aceito: 'Ana', ativo: 'Érica', desativado: 'Davi' }
    const professores = {} as Record<EstadoDoProfessorDeTeste, ProfessorDeTeste>
    for (const estado of Object.keys(nomes) as EstadoDoProfessorDeTeste[]) professores[estado] = await convidarProfessorNoBanco(coordenadora.escolaId, estado, nomes[estado])
    falhar = true
    await page.reload()
    await expect(principal(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhasDaLista(page)).toHaveCount(0)
    await expect(principal(page).getByText('Nenhum professor ainda')).toHaveCount(0)
    expect(await violacoesGraves(page)).toEqual([])
    falhar = false
    await acionar(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)

    // Com dado: pelo nome, em português (a Érica entre o Davi e a Zuleica), e não na ordem em que a API os entrega.
    await expect(linhasDaLista(page)).toHaveCount(7, { timeout: PRAZO_DA_ENTRADA_MS })
    const naOrdemDoNome: EstadoDoProfessorDeTeste[] = ['aceito', 'vencido', 'revogado', 'desativado', 'ativo', 'pendente']
    const titulos = await linhasDaLista(page).evaluateAll((itens) => itens.map((item) => item.querySelector('button')?.textContent ?? ''))
    // A Yara do primeiro cadastro, criada antes de todos, fica entre a Érica e a Zuleica.
    const nomesNaOrdem = naOrdemDoNome.map((estado) => professores[estado].nome)
    expect(titulos).toEqual([...nomesNaOrdem.slice(0, 5), primeira, ...nomesNaOrdem.slice(5)])
    // A contagem ao lado do título.
    await expect(principal(page).getByText('7 professores', { exact: true })).toBeVisible()
    // O estado de cada convite em texto na tabela, e só as ações que a matriz permite no painel dele.
    for (const estado of naOrdemDoNome) {
      await expect(linhaDe(page, professores[estado].nome), estado).toContainText(TEXTO_DO_ESTADO[estado])
      const painel = await abrirPainel(page, professores[estado].nome, hasTouch)
      await expect(painel, estado).toContainText(TEXTO_DO_ESTADO[estado])
      await expect(acoesDoPainel(painel), estado).toHaveText([...ACOES_DO_ESTADO[estado]])
      await fecharPainel(page, hasTouch)
    }
    // Com dado, o Cadastrar fica no topo da lista, um só.
    await expect(cadastrar).toHaveCount(1)
    await alvoDeToque(cadastrar, 'Cadastrar professor')
    // A lista não mostra o e-mail de ninguém (E11).
    const conteudo = await page.content()
    for (const professor of Object.values(professores)) expect(conteudo).not.toContain(professor.email)
    expect(await larguraExcedente(page)).toBe(0)
    // A página não rola a partir de 768 px: só o miolo da moldura (RF23). A tabela com sete linhas e o painel por cima não a fazem crescer.
    await paginaNaoRola(page)
    expect(await violacoesGraves(page)).toEqual([])

    // O convite vencido se refaz pelo painel: o link novo aparece, e a linha passa a convite em aberto. O painel continua aberto, com a situação nova.
    const daBia = linhaDe(page, professores.vencido.nome)
    const refeito = await refazerPelaTela(page, professores.vencido.nome, hasTouch)
    expect(tokenDo(refeito)).toMatch(/^[A-Za-z0-9_-]{43}$/)
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(daBia).toContainText(TEXTO_DO_ESTADO.pendente, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(daBia).not.toContainText('Convite vencido.')
    await expect(painelDe(page, professores.vencido.nome)).toContainText(TEXTO_DO_ESTADO.pendente)
    await expect(painelDe(page, professores.vencido.nome)).not.toContainText('Convite vencido.')
    await fecharPainel(page, hasTouch)

    // O erro com a lista na tela: a releitura depois de revogar cai, a lista de antes fica, com o erro e o "Tentar de
    // novo" por cima, e a nova tentativa traz o estado novo.
    falhar = true
    const daZuleica = linhaDe(page, professores.pendente.nome)
    await abrirPainel(page, professores.pendente.nome, hasTouch)
    await tocar(painelDe(page, professores.pendente.nome), 'Revogar convite', hasTouch)
    await tocar(noDialogo(page), 'Revogar convite', hasTouch)
    await expect(anuncio(page, `Convite de ${professores.pendente.nome} revogado.`)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    await expect(linhasDaLista(page)).toHaveCount(7)
    await expect(daZuleica).toContainText(TEXTO_DO_ESTADO.pendente)
    expect(await violacoesGraves(page)).toEqual([])
    // O "Tentar de novo" é da página, que fica inerte com o painel aberto: fecha-se o painel para ele.
    await fecharPainel(page, hasTouch)
    falhar = false
    await acionar(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(daZuleica).toContainText(TEXTO_DO_ESTADO.revogado, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    await acionar(botaoDaLinha(page, professores.pendente.nome), hasTouch)
    await expect(acoesDoPainel(painelDe(page, professores.pendente.nome))).toHaveCount(0)
    await fecharPainel(page, hasTouch)

    // A lista maior do que a tela lê: toda página diz que há outra, a tela para no teto de dez e avisa que mostra só os
    // primeiros.
    semFim = true
    await page.reload()
    await expect(principal(page)).toContainText('A lista é maior do que esta tela mostra: aparecem só os primeiros.', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhasDaLista(page)).toHaveCount(10)
    expect(paginasSemFim).toBe(10)
  })
})

test.describe('cadastrar, copiar o link e o aceite do professor', () => {
  test('W14: o resumo antes de enviar, o link uma vez com "Link copiado"; fechar sem copiar pergunta; o link refeito mostra o convite inválido, e o novo leva o professor a criar a senha, entrar e chegar a Turmas', async ({
    page,
    browser,
    hasTouch,
  }) => {
    test.slow()
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const coordenadora = await criarEquipeComSenha('coordenador')
    const semToken = vigiarAba(page)
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await abrirEstrutura(page, hasTouch)
    // O caminho até Professores pelo roteiro da Estrutura (herdado da 13.0).
    const roteiro = await abrirOQueFalta(page, hasTouch)
    await acionar(roteiro.getByRole('link', { name: 'Professores' }), hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/professores$/)
    await expect(principal(page).getByText('Nenhum professor ainda')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // O formulário: nada que o navegador guarde para completar depois, e o e-mail com o teclado de e-mail.
    const marca = crypto.randomUUID().slice(0, 8)
    const nome = `Professora sintética ${marca}`
    await acionar(principal(page).getByRole('button', { name: 'Cadastrar professor' }), hasTouch)
    const campoNome = noDialogo(page).getByLabel('Nome do professor')
    const campoEmail = noDialogo(page).getByLabel('E-mail do professor')
    await expect(page.getByRole('dialog', { name: 'Cadastrar professor' })).toBeVisible()
    await expect(campoNome).toBeFocused()
    await expect(campoNome).toHaveAttribute('autocomplete', 'off')
    await expect(campoEmail).toHaveAttribute('autocomplete', 'off')
    await expect(campoEmail).toHaveAttribute('inputmode', 'email')
    await conferirDialogo(page)

    // O que o contrato recusa fica no campo, em texto, e nada sai.
    const cadastros: string[] = []
    page.on('request', (pedido) => {
      if (pedido.method() === 'POST' && ehALista(new URL(pedido.url()))) cadastros.push(pedido.url())
    })
    await campoEmail.fill('sem-arroba')
    await tocar(noDialogo(page), 'Revisar', hasTouch)
    await expect(noDialogo(page).getByText('Escreva o nome, com até 200 caracteres.')).toBeVisible()
    await expect(noDialogo(page).getByText('Escreva o e-mail inteiro, com @ e o domínio, com até 254 caracteres.')).toBeVisible()
    await expect(campoNome).toHaveAttribute('aria-invalid', 'true')
    await expect(noDialogo(page).getByRole('heading', { name: 'Confira antes de cadastrar' })).toHaveCount(0)

    // O resumo antes de enviar: o nome e o e-mail como vão ao servidor, o prazo e o "aparece uma vez".
    await campoNome.fill(`  ${nome} `)
    await campoEmail.fill(`Prof-${marca}@Educa.INVALID`)
    await tocar(noDialogo(page), 'Revisar', hasTouch)
    await expect(noDialogo(page).getByRole('heading', { name: 'Confira antes de cadastrar' })).toBeFocused()
    await expect(noDialogo(page)).toContainText(nome)
    await expect(noDialogo(page)).toContainText(`prof-${marca}@educa.invalid`)
    await expect(noDialogo(page)).toContainText('O convite vale 7 dias e entra uma vez só.')
    await expect(noDialogo(page)).toContainText('O link aparece uma vez, logo depois de gerar.')
    await conferirDialogo(page)
    expect(cadastros).toEqual([])
    expect(await convitesDeProfessorEmAberto(coordenadora.escolaId)).toBe(0)

    // Cadastrar: o link com a origem desta web e o token no fragmento, num campo de leitura.
    await tocar(noDialogo(page), 'Cadastrar e gerar o link', hasTouch)
    await expect(etapaDoLink(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    const anterior = await linkNaTela(page)
    const origem = new URL(page.url()).origin
    expect(anterior).toMatch(new RegExp(`^${origem.replaceAll('.', '\\.')}/convite#[A-Za-z0-9_-]{43}$`))
    await expect(noDialogo(page).getByLabel('Link do convite')).toHaveAttribute('readonly', '')
    // O campo do link tem a pele da D80, a mesma do campo de escrita: borda de 2 px em `borda-campo` e fundo `campo`.
    expect(await desenho(noDialogo(page).getByLabel('Link do convite'))).toMatchObject({
      borda: `2px solid ${await corDoToken(page, 'borda-campo')}`,
      fundo: await corDoToken(page, 'campo'),
    })
    // A quem mandar, com o e-mail com que a pessoa entra: a tela do convite e a entrada não o dizem.
    await expect(noDialogo(page)).toContainText(`Mande o link a ${nome}, que entra com o e-mail prof-${marca}@educa.invalid. O convite vale 7 dias e entra uma vez só.`)
    await conferirDialogo(page)

    // Copiar: "Link copiado." anunciado dentro do diálogo, e o link na área de transferência. Copiado, fecha sem perguntar.
    await tocar(noDialogo(page), 'Copiar link', hasTouch)
    await expect(noDialogo(page).getByRole('status').filter({ hasText: 'Link copiado.' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(anterior)
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    // O "Cadastrar" do vazio saiu com a lista: o foco vai para o título dela, e não para o `body`.
    await expect(tituloDaLista(page)).toBeFocused()
    // Fechado o diálogo, o e-mail que a etapa do link dizia não fica na página: a lista não mostra e-mail (E11).
    expect(await page.content()).not.toContain(`prof-${marca}@educa.invalid`)
    await expect(linhaDe(page, nome)).toContainText(TEXTO_DO_ESTADO.pendente)
    expect(await convitesDeProfessorEmAberto(coordenadora.escolaId)).toBe(1)

    // Refazer, pelo painel do professor, com a confirmação que diz que o link anterior para; o foco começa no texto, não no botão.
    await abrirPainel(page, nome, hasTouch)
    await tocar(painelDe(page, nome), 'Refazer convite', hasTouch)
    await expect(noDialogo(page).getByText('O link mandado antes para de valer na hora.', { exact: false })).toBeFocused()
    await expect(noDialogo(page)).toContainText(nome)
    await expect(noDialogo(page)).toContainText('O convite vale 7 dias e entra uma vez só.')
    await expect(noDialogo(page)).toContainText('O link aparece uma vez, logo depois de gerar.')
    await conferirDialogo(page)
    await tocar(noDialogo(page), 'Refazer convite', hasTouch)
    await expect(etapaDoLink(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    const novo = await linkNaTela(page)
    expect(novo).not.toBe(anterior)
    // No refazer a lista não traz o e-mail, e a frase vai só com o nome.
    await expect(noDialogo(page)).toContainText(`Mande o link a ${nome}. O convite vale 7 dias e entra uma vez só.`)
    // Fechar sem copiar pergunta, pelo botão e pelo toque fora; "Voltar ao convite" devolve o mesmo link.
    const pedidosDeFechar: (() => Promise<void>)[] = [() => tocar(noDialogo(page), 'Fechar', hasTouch), () => (hasTouch ? page.touchscreen.tap(4, 4) : page.mouse.click(4, 4))]
    for (const pedirParaFechar of pedidosDeFechar) {
      await pedirParaFechar()
      await expect(pergunta(page)).toBeFocused()
      await expect(noDialogo(page)).toContainText('para a pessoa convidada entrar será preciso refazer o convite')
      await conferirDialogo(page)
      await tocar(noDialogo(page), 'Voltar ao convite', hasTouch)
      await expect(etapaDoLink(page)).toBeFocused()
      expect(await linkNaTela(page)).toBe(novo)
    }
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    expect(await page.content()).not.toContain(tokenDo(novo))
    expect(await convitesDeProfessorEmAberto(coordenadora.escolaId)).toBe(1)
    await semToken(tokenDo(anterior), tokenDo(novo))
    // O painel não guarda nem repete o link (regra 20, item 8): fechados os diálogos, ele só diz a situação.
    await expect(painelDe(page, nome)).not.toContainText(tokenDo(novo))
    await fecharPainel(page, hasTouch)

    // O professor, no computador dele: o link refeito mostra o convite inválido, sem o nome da escola.
    const professor = await outroNavegador(browser)
    await professor.goto(anterior)
    await expect(professor.getByRole('alert')).toHaveText(mensagemDoConvite('NAO_ENCONTRADO'), { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(professor.getByRole('alert')).toContainText('Peça outro à coordenação da sua escola.')
    await expect(professor.locator('body')).not.toContainText(coordenadora.escolaNome)

    // O link novo: a escola que convida, a senha nova, e a entrada — sem segundo fator, que o professor não tem.
    await professor.goto(novo)
    await expect(professor.getByRole('main')).toContainText(coordenadora.escolaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    await tocar(professor.getByRole('main'), 'Aceitar o convite', hasTouch)
    await professor.getByLabel('Senha nova').fill(SENHA_NOVA, { timeout: PRAZO_DA_ENTRADA_MS })
    await tocar(professor.getByRole('main'), 'Definir a senha e continuar', hasTouch)
    await expect(professor).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(professor.getByRole('alert')).toHaveText(AVISO_DO_CONVITE_COM_SENHA_NOVA)
    await expect(professor.getByRole('heading', { name: 'Configurar o segundo fator' })).toHaveCount(0)
    await professor.getByLabel('E-mail').fill(`prof-${marca}@educa.invalid`)
    await professor.getByLabel('Senha').fill(SENHA_NOVA)
    await acionar(professor.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    // Criado pela tela, o professor ainda não viu a introdução: ela é a primeira coisa que encontra (X4, 10.0), e depois dela ele abre em "Início".
    await passarPelaIntroducaoDoProfessor(professor, nome, hasTouch)
    // Ele abre em "Nova conversa" (A2); Turmas, onde ele confirma o que a coordenação alocar, está na lateral.
    await irPelaNavegacao(professor, 'Turmas', hasTouch)
    await expect(professor).toHaveURL(/\/professor\/turmas$/)
    await expect(professor.getByRole('main')).toContainText('A coordenação ainda não alocou você', { timeout: PRAZO_DA_ENTRADA_MS })

    // A lista da coordenação, recarregada: o convite aceito, sem ação nenhuma no painel dele.
    await page.reload()
    await expect(linhaDe(page, nome)).toContainText(TEXTO_DO_ESTADO.aceito, { timeout: PRAZO_DA_ENTRADA_MS })
    const doAceito = await abrirPainel(page, nome, hasTouch)
    await expect(doAceito).toContainText(TEXTO_DO_ESTADO.aceito)
    await expect(acoesDoPainel(doAceito)).toHaveCount(0)
    expect(await convitesDeProfessorEmAberto(coordenadora.escolaId)).toBe(0)
  })
})

test.describe('W12 (Professores): a 360 px e só com teclado', () => {
  test('sem rolagem horizontal, também no diálogo; cartões e alvos de 44 px; cadastrar e copiar só com Tab e Enter, com o foco preso; o Esc cai na pergunta, e o segundo fecha', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    await page.setViewportSize({ width: 360, height: 800 })
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const coordenadora = await criarEquipeComSenha('coordenador')
    await abrirProfessores(page, coordenadora, hasTouch)
    const cadastrar = principal(page).getByRole('button', { name: 'Cadastrar professor' })
    await expect(cadastrar).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // Cadastrar só com o teclado: Enter abre, o foco começa no nome e não sai do diálogo.
    // O nome longo, sem espaço, para provar que nada estica a tela nem o diálogo.
    const nome = `Prof${'a'.repeat(150)}${crypto.randomUUID().slice(0, 8)}`
    await cadastrar.focus()
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByLabel('Nome do professor')).toBeFocused()
    await page.keyboard.insertText(nome)
    await page.keyboard.press('Tab')
    await expect(noDialogo(page).getByLabel('E-mail do professor')).toBeFocused()
    await page.keyboard.insertText(emailSintetico('teclado'))
    for (const botao of ['Revisar', 'Cancelar']) await alvoDeToque(noDialogo(page).getByRole('button', { name: botao, exact: true }), botao)
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByRole('heading', { name: 'Confira antes de cadastrar' })).toBeFocused()
    await conferirDialogo(page)
    for (const botao of ['Cadastrar e gerar o link', 'Voltar e corrigir', 'Cancelar']) await alvoDeToque(noDialogo(page).getByRole('button', { name: botao, exact: true }), botao)
    for (let tecla = 0; tecla < 8; tecla++) {
      await page.keyboard.press('Tab')
      expect(await focoDentroDoDialogo(page)).toBe(true)
    }
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Cadastrar e gerar o link' }))
    await page.keyboard.press('Enter')
    await expect(etapaDoLink(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await conferirDialogo(page)
    for (let tecla = 0; tecla < 8; tecla++) {
      await page.keyboard.press('Shift+Tab')
      expect(await focoDentroDoDialogo(page)).toBe(true)
    }
    for (const botao of ['Copiar link', 'Fechar']) await alvoDeToque(noDialogo(page).getByRole('button', { name: botao, exact: true }), botao)

    // Copiar e fechar pelo teclado: fecha sem perguntar, e o foco vai para o título da lista, que acabou de nascer.
    const link = await linkNaTela(page)
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Copiar link' }))
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByRole('status').filter({ hasText: 'Link copiado.' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link)
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Fechar', exact: true }))
    await page.keyboard.press('Enter')
    await expect(noDialogo(page)).toHaveCount(0)
    await expect(tituloDaLista(page)).toBeFocused()

    // A tabela vira lista a 360 px: um cartão por professor, o alvo do nome de 44 px, e nada passa da largura com o nome longo.
    const linha = linhaDe(page, nome)
    await expect(linha).toContainText(TEXTO_DO_ESTADO.pendente, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).locator('[data-tabela="lista"]')).toHaveCount(1)
    await expect(principal(page).locator('[data-tabela="tabela"]')).toHaveCount(0)
    await alvoDeToque(cadastrar, 'Cadastrar professor')
    await alvoDeToque(botaoDaLinha(page, nome), 'o nome do professor')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // O painel só com o teclado: Tab até o nome da linha e Enter abrem a folha de baixo, com os alvos de 44 px.
    await tabAte(page, botaoDaLinha(page, nome))
    await page.keyboard.press('Enter')
    const painel = painelDe(page, nome)
    await expect(painel).toBeVisible()
    const refazer = painel.getByRole('button', { name: 'Refazer convite', exact: true })
    const revogar = painel.getByRole('button', { name: 'Revogar convite', exact: true })
    await alvoDeToque(refazer, 'Refazer convite')
    await alvoDeToque(revogar, 'Revogar convite')
    await alvoDeToque(painel.getByRole('button', { name: 'Fechar', exact: true }), 'Fechar')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Dois Esc seguidos, sem tecla nem clique entre eles: o primeiro pergunta, o segundo fecha — e fecha de verdade, com
    // o link junto. O foco volta ao "Refazer convite" do painel, que abriu o diálogo.
    await tabAte(page, refazer)
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByText('O link mandado antes para de valer na hora.', { exact: false })).toBeFocused()
    await conferirDialogo(page)
    for (const botao of ['Refazer convite', 'Cancelar']) await alvoDeToque(noDialogo(page).getByRole('button', { name: botao, exact: true }), botao)
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Refazer convite' }))
    await page.keyboard.press('Enter')
    await expect(etapaDoLink(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await conferirDialogo(page)
    const token = tokenDo(await linkNaTela(page))
    await page.keyboard.press('Escape')
    await expect(pergunta(page)).toBeFocused()
    await conferirDialogo(page)
    // Voltar e fechar do mesmo tamanho: sair nunca é menor que ficar (D59).
    for (const botao of ['Voltar ao convite', 'Fechar sem copiar']) await alvoDeToque(noDialogo(page).getByRole('button', { name: botao, exact: true }), botao)
    await page.keyboard.press('Escape')
    await expect(dialogosDaTela(page)).toHaveCount(0)
    expect(await page.content()).not.toContain(token)
    await expect(refazer).toBeFocused()

    // O navegador fecha o `dialog` por conta própria (o segundo Esc sem gesto, no Chrome que aplica a regra do `cancel`):
    // a tela desmonta o diálogo e o link, como no "Fechar sem copiar".
    await page.keyboard.press('Enter')
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Refazer convite' }))
    await page.keyboard.press('Enter')
    await expect(etapaDoLink(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const fechadoPeloNavegador = tokenDo(await linkNaTela(page))
    await dialogosAbertos(page).evaluate((dialogo: HTMLDialogElement) => dialogo.close())
    await expect(dialogosDaTela(page)).toHaveCount(0)
    expect(await page.content()).not.toContain(fechadoPeloNavegador)

    // Revogar só pelo teclado, com a confirmação que diz o que acontece; o foco começa no texto. Revogado, os botões saem
    // do rodapé do painel, e o foco vai para a situação, no próprio painel.
    await tabAte(page, revogar)
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByText('deixa de valer na hora', { exact: false })).toBeFocused()
    // O que acontece com o que já foi alocado, e como convidar de novo, ditos antes de confirmar (regra 50, item 8).
    await expect(noDialogo(page)).toContainText('As turmas já alocadas a essa pessoa continuam esperando. Para convidar de novo, cadastre o mesmo e-mail.')
    await conferirDialogo(page)
    await alvoDeToque(noDialogo(page).getByRole('button', { name: 'Revogar convite' }), 'Revogar convite')
    await alvoDeToque(noDialogo(page).getByRole('button', { name: 'Cancelar' }), 'Cancelar')
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Revogar convite' }))
    await page.keyboard.press('Enter')
    await expect(anuncio(page, 'Convite de')).toContainText('revogado.', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page)).toHaveCount(0)
    await expect(linha).toContainText(TEXTO_DO_ESTADO.revogado)
    await expect(painel).toContainText(TEXTO_DO_ESTADO.revogado)
    await expect(acoesDoPainel(painel)).toHaveCount(0)
    await expect(painel.getByRole('heading', { name: 'Situação do convite' })).toBeFocused()
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })
})

test.describe('clique duplo', () => {
  test('dois cliques em cadastrar mostram um link só, e a lista termina com um convite em aberto; em refazer, o link da única resposta; em revogar, um pedido só', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    // Com turma e disciplina, e sem professor: a escola vai direto à tela Professores, que ainda está vazia (a alocação mora no painel do professor, 7.0).
    await montarEstruturaNoBanco(coordenadora.escolaId)
    await abrirProfessores(page, coordenadora, hasTouch)
    await expect(principal(page).getByText('Nenhum professor ainda')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    let pedidos = 0
    let seguro = portao()
    const segurar = async (rota: Route) => {
      if (rota.request().method() !== 'POST') return rota.fallback()
      pedidos++
      await seguro.aberta
      return rota.fallback()
    }

    // Cadastrar: o segundo clique, com o primeiro no ar, receberia CONFLITO, e o link — que aparece uma vez só — se
    // perderia sem ser mostrado.
    const nome = `Professor do clique duplo ${crypto.randomUUID().slice(0, 8)}`
    await page.route(ehALista, segurar)
    await acionar(principal(page).getByRole('button', { name: 'Cadastrar professor' }), hasTouch)
    await noDialogo(page).getByLabel('Nome do professor').fill(nome)
    await noDialogo(page).getByLabel('E-mail do professor').fill(emailSintetico('duplo'))
    await tocar(noDialogo(page), 'Revisar', hasTouch)
    const cadastrado = page.waitForResponse((resposta) => ehALista(new URL(resposta.url())) && resposta.request().method() === 'POST')
    await doisCliquesNoMesmoInstante(noDialogo(page).getByRole('button', { name: 'Cadastrar e gerar o link' }))
    await expect.poll(() => pedidos).toBe(1)
    await expect(noDialogo(page).getByRole('button', { name: 'Cadastrando…' })).toBeDisabled()
    await expect(noDialogo(page).getByRole('button', { name: 'Voltar e corrigir' })).toBeDisabled()
    // "Cancelar" com o pedido no ar pergunta. O pedido que dá certo com a pergunta aberta não a tira: o link agora
    // existe, a pergunta passa a falar dele, e "Voltar ao convite" o mostra.
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(pergunta(page)).toBeFocused()
    await expect(noDialogo(page)).toContainText('O convite ainda está sendo gerado')
    seguro.abrir()
    const doCadastro = (await (await cadastrado).json()) as ConviteDeProfessorResponse
    await expect(noDialogo(page)).toContainText('O link aparece uma vez só. Se fechar agora, ele não aparece de novo', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(pergunta(page)).toBeVisible()
    await expect(noDialogo(page).getByLabel('Link do convite')).toHaveCount(0)
    await tocar(noDialogo(page), 'Voltar ao convite', hasTouch)
    await expect(etapaDoLink(page)).toBeFocused()
    await expect(noDialogo(page).getByLabel('Link do convite')).toHaveCount(1)
    expect(tokenDo(await linkNaTela(page))).toBe(doCadastro.token)
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    expect(pedidos).toBe(1)
    await page.unroute(ehALista, segurar)
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(linhasDaLista(page)).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhaDe(page, nome)).toContainText(TEXTO_DO_ESTADO.pendente)
    expect(await convitesDeProfessorEmAberto(coordenadora.escolaId)).toBe(1)

    // Refazer (herdado da 3.0): dois pedidos seguidos dariam dois links, e o primeiro já nasceria revogado pelo segundo.
    // A tela trava o botão com o pedido no ar e mostra o link da única resposta.
    pedidos = 0
    seguro = portao()
    await page.route(ROTA_DO_REFAZER, segurar)
    await abrirPainel(page, nome, hasTouch)
    await tocar(painelDe(page, nome), 'Refazer convite', hasTouch)
    const refeito = page.waitForResponse((resposta) => ROTA_DO_REFAZER(new URL(resposta.url())))
    await doisCliquesNoMesmoInstante(noDialogo(page).getByRole('button', { name: 'Refazer convite' }))
    await expect.poll(() => pedidos).toBe(1)
    await expect(noDialogo(page).getByRole('button', { name: 'Refazendo…' })).toBeDisabled()
    seguro.abrir()
    const doRefazer = (await (await refeito).json()) as ConviteDeProfessorResponse
    await expect(etapaDoLink(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(tokenDo(await linkNaTela(page))).toBe(doRefazer.token)
    expect(doRefazer.token).not.toBe(doCadastro.token)
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    expect(pedidos).toBe(1)
    expect(await convitesDeProfessorEmAberto(coordenadora.escolaId)).toBe(1)
    await page.unroute(ROTA_DO_REFAZER, segurar)
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)

    // Revogar, com o painel ainda aberto no mesmo professor: um pedido só, e o anúncio do revogado, sem "esse convite já não vale".
    pedidos = 0
    seguro = portao()
    await page.route(ROTA_DO_REVOGAR, segurar)
    await tocar(painelDe(page, nome), 'Revogar convite', hasTouch)
    await doisCliquesNoMesmoInstante(noDialogo(page).getByRole('button', { name: 'Revogar convite' }))
    await expect.poll(() => pedidos).toBe(1)
    seguro.abrir()
    await expect(anuncio(page, `Convite de ${nome} revogado.`)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(pedidos).toBe(1)
    expect(await convitesDeProfessorEmAberto(coordenadora.escolaId)).toBe(0)
    await page.unroute(ROTA_DO_REVOGAR, segurar)
    // O painel fica com o anúncio e sem ação; fechado, a página volta. Abrir outro diálogo apaga o anúncio da ação anterior: ao reabrir o
    // painel do mesmo professor, ele já não diz "revogado.".
    await expect(acoesDoPainel(painelDe(page, nome))).toHaveCount(0)
    await fecharPainel(page, hasTouch)
    await acionar(principal(page).getByRole('button', { name: 'Cadastrar professor' }), hasTouch)
    await expect(page.getByRole('dialog', { name: 'Cadastrar professor' })).toBeVisible()
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    await abrirPainel(page, nome, hasTouch)
    await expect(anuncio(page, 'revogado.')).toHaveCount(0)
  })
})

test.describe('recomeço da tela Professores', () => {
  test('falha com o diálogo aberto: o CONFLITO do refazer e o revogar já revogado recarregam a lista e deixam só "Fechar"; reabrindo, o aviso e o foco da tentativa anterior saem; o e-mail já cadastrado volta para corrigir', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    const bruno = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Bruno')
    const caio = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Caio')
    await abrirProfessores(page, coordenadora, hasTouch)
    await expect(linhasDaLista(page)).toHaveCount(3, { timeout: PRAZO_DA_ENTRADA_MS })

    // Outra pessoa da coordenação revoga o convite da Ana com esta tela aberta: o refazer daqui, pelo painel dela, recebe CONFLITO,
    // dentro do diálogo, com o foco no aviso; a lista recarrega com o estado novo, e sobra só "Fechar".
    await revogarConvite({ escolaId: coordenadora.escolaId, usuarioId: ana.usuarioId })
    const recarregada = proximaLista(page)
    await abrirPainel(page, ana.nome, hasTouch)
    await tocar(painelDe(page, ana.nome), 'Refazer convite', hasTouch)
    await tocar(noDialogo(page), 'Refazer convite', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveText(TEXTO_DO_CONVITE_QUE_MUDOU, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('alert')).toBeFocused()
    await recarregada
    await expect(noDialogo(page).getByRole('button', { name: 'Refazer convite' })).toHaveCount(0)
    await expect(noDialogo(page).getByRole('button', { name: 'Cancelar' })).toHaveCount(0)
    await expect(noDialogo(page).getByLabel('Link do convite')).toHaveCount(0)
    expect(await violacoesGraves(page)).toEqual([])
    // O "Refazer convite" que abriu o diálogo saiu do rodapé do painel com a lista recarregada: fechado o diálogo, o foco vai para a
    // situação, no painel, e não para a página inerte atrás dele.
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    await expect(linhaDe(page, ana.nome)).toContainText(TEXTO_DO_ESTADO.revogado)
    await expect(acoesDoPainel(painelDe(page, ana.nome))).toHaveCount(0)
    await expect(painelDe(page, ana.nome).getByRole('heading', { name: 'Situação do convite' })).toBeFocused()
    await fecharPainel(page, hasTouch)

    // Reabrindo o refazer de outro professor: sem o aviso da tentativa anterior, com o foco no texto da confirmação.
    await abrirPainel(page, bruno.nome, hasTouch)
    await tocar(painelDe(page, bruno.nome), 'Refazer convite', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    await expect(noDialogo(page).getByText('O link mandado antes para de valer na hora.', { exact: false })).toBeFocused()
    await expect(noDialogo(page)).toContainText(bruno.nome)
    await expect(noDialogo(page)).not.toContainText(ana.nome)
    await expect(noDialogo(page).getByRole('button', { name: 'Refazer convite' })).toBeEnabled()
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    expect(await convitesDeProfessorEmAberto(coordenadora.escolaId)).toBe(2)
    await fecharPainel(page, hasTouch)

    // O revogar do convite que outra pessoa já revogou: "esse convite já não vale", e a lista recarrega.
    await revogarConvite({ escolaId: coordenadora.escolaId, usuarioId: caio.usuarioId })
    await abrirPainel(page, caio.nome, hasTouch)
    await tocar(painelDe(page, caio.nome), 'Revogar convite', hasTouch)
    await tocar(noDialogo(page), 'Revogar convite', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveText(TEXTO_DO_CONVITE_QUE_NAO_VALE, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('button', { name: 'Revogar convite' })).toHaveCount(0)
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(linhaDe(page, caio.nome)).toContainText(TEXTO_DO_ESTADO.revogado)
    await expect(painelDe(page, caio.nome).getByRole('heading', { name: 'Situação do convite' })).toBeFocused()
    await expect(anuncio(page, 'revogado.')).toHaveCount(0)
    await fecharPainel(page, hasTouch)

    // O cadastro com o e-mail de quem já tem convite em aberto: o aviso diz o que fazer, e a pessoa volta e corrige.
    await acionar(principal(page).getByRole('button', { name: 'Cadastrar professor' }), hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    await expect(noDialogo(page).getByLabel('Nome do professor')).toBeFocused()
    const novo = `Professora nova ${crypto.randomUUID().slice(0, 8)}`
    const TEXTO_DO_NOME_REPETIDO = 'Já há um professor com este nome na lista. Se é a mesma pessoa voltando, pode seguir. Se é outra, acrescente um sobrenome: a lista mostra só o nome.'
    // O nome que já está na lista (sem contar maiúscula) é avisado no resumo, sem impedir: a lista só mostra o nome, e
    // duas linhas iguais levariam o link refeito de uma pessoa à outra.
    await noDialogo(page).getByLabel('Nome do professor').fill(` ${bruno.nome.toUpperCase()} `)
    await noDialogo(page).getByLabel('E-mail do professor').fill(bruno.email)
    await tocar(noDialogo(page), 'Revisar', hasTouch)
    await expect(noDialogo(page)).toContainText(TEXTO_DO_NOME_REPETIDO)
    await expect(noDialogo(page).getByRole('button', { name: 'Cadastrar e gerar o link' })).toBeEnabled()
    await conferirDialogo(page)
    await tocar(noDialogo(page), 'Voltar e corrigir', hasTouch)
    await noDialogo(page).getByLabel('Nome do professor').fill(novo)
    await tocar(noDialogo(page), 'Revisar', hasTouch)
    await expect(noDialogo(page)).not.toContainText(TEXTO_DO_NOME_REPETIDO)
    await tocar(noDialogo(page), 'Cadastrar e gerar o link', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveText(TEXTO_DO_EMAIL_JA_CADASTRADO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('alert')).toBeFocused()
    await expect(noDialogo(page).getByLabel('Link do convite')).toHaveCount(0)
    // "Voltar e corrigir" com o aviso na tela: o foco vai para o campo do nome, com o que foi digitado, e não para o
    // `body` com o alerta que saiu.
    await tocar(noDialogo(page), 'Voltar e corrigir', hasTouch)
    await expect(noDialogo(page).getByLabel('Nome do professor')).toBeFocused()
    await expect(noDialogo(page).getByLabel('Nome do professor')).toHaveValue(novo)
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    await noDialogo(page).getByLabel('E-mail do professor').fill(emailSintetico('corrigido'))
    await tocar(noDialogo(page), 'Revisar', hasTouch)
    // O aviso da tentativa anterior não volta com a revisão nova.
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    await tocar(noDialogo(page), 'Cadastrar e gerar o link', hasTouch)
    await expect(etapaDoLink(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(linhaDe(page, novo)).toContainText(TEXTO_DO_ESTADO.pendente, { timeout: PRAZO_DA_ENTRADA_MS })
    // O Bruno e a professora nova: dois convites em aberto, e nenhum a mais pelo cadastro recusado.
    expect(await convitesDeProfessorEmAberto(coordenadora.escolaId)).toBe(2)

    // O que a linha do revogado promete: cadastrar de novo o mesmo e-mail chama a mesma pessoa de volta, com o nome
    // digitado agora, numa linha só, com o convite em aberto.
    const deVolta = `Ana de volta ${crypto.randomUUID().slice(0, 8)}`
    await acionar(principal(page).getByRole('button', { name: 'Cadastrar professor' }), hasTouch)
    await noDialogo(page).getByLabel('Nome do professor').fill(deVolta)
    await noDialogo(page).getByLabel('E-mail do professor').fill(ana.email)
    await tocar(noDialogo(page), 'Revisar', hasTouch)
    await tocar(noDialogo(page), 'Cadastrar e gerar o link', hasTouch)
    await expect(etapaDoLink(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(linhaDe(page, deVolta)).toContainText(TEXTO_DO_ESTADO.pendente, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhaDe(page, ana.nome)).toHaveCount(0)
    await expect(linhasDaLista(page)).toHaveCount(4)
    expect(await convitesDeProfessorEmAberto(coordenadora.escolaId)).toBe(3)
  })

  test('falha com a pergunta de fechar aberta: o pedido recusado, no cadastro e no refazer, tira a pergunta e volta à etapa dele, com o aviso e o foco nele; fechar já não pergunta', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const professor = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente')
    await abrirProfessores(page, coordenadora, hasTouch)
    await expect(linhaDe(page, professor.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // O pedido fica segurado, e responde 503 quando o teste solta: é a recusa que chega com a pergunta na tela.
    let seguro = portao()
    const derrubar = async (rota: Route) => {
      if (rota.request().method() !== 'POST') return rota.fallback()
      await seguro.aberta
      return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
    }

    // Cadastro: "Cancelar" com o pedido no ar pergunta; a recusa chega, a pergunta sai, e o resumo volta com o aviso.
    await page.route(ehALista, derrubar)
    await acionar(principal(page).getByRole('button', { name: 'Cadastrar professor' }), hasTouch)
    await noDialogo(page).getByLabel('Nome do professor').fill(`Professora da recusa ${crypto.randomUUID().slice(0, 8)}`)
    await noDialogo(page).getByLabel('E-mail do professor').fill(emailSintetico('recusa'))
    await tocar(noDialogo(page), 'Revisar', hasTouch)
    await tocar(noDialogo(page), 'Cadastrar e gerar o link', hasTouch)
    await expect(noDialogo(page).getByRole('button', { name: 'Cadastrando…' })).toBeDisabled()
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(pergunta(page)).toBeFocused()
    await expect(noDialogo(page)).toContainText('O convite ainda está sendo gerado')
    seguro.abrir()
    await expect(noDialogo(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('alert')).toBeFocused()
    await expect(pergunta(page)).toHaveCount(0)
    await expect(noDialogo(page)).not.toContainText('O link aparece uma vez só. Se fechar agora')
    await expect(noDialogo(page).getByRole('heading', { name: 'Confira antes de cadastrar' })).toBeVisible()
    await expect(noDialogo(page).getByRole('button', { name: 'Cadastrar e gerar o link' })).toBeEnabled()
    expect(await violacoesGraves(page)).toEqual([])
    // Sem link em risco, fechar fecha na hora; e a pergunta não volta sozinha numa abertura nova.
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await page.unroute(ehALista, derrubar)
    expect(await convitesDeProfessorEmAberto(coordenadora.escolaId)).toBe(1)

    // Refazer: o mesmo, na confirmação.
    seguro = portao()
    await page.route(ROTA_DO_REFAZER, derrubar)
    await abrirPainel(page, professor.nome, hasTouch)
    await tocar(painelDe(page, professor.nome), 'Refazer convite', hasTouch)
    await tocar(noDialogo(page), 'Refazer convite', hasTouch)
    await expect(noDialogo(page).getByRole('button', { name: 'Refazendo…' })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(pergunta(page)).toBeFocused()
    seguro.abrir()
    await expect(noDialogo(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('alert')).toBeFocused()
    await expect(pergunta(page)).toHaveCount(0)
    await expect(noDialogo(page).getByText('O link mandado antes para de valer na hora.', { exact: false })).toBeVisible()
    await page.unroute(ROTA_DO_REFAZER, derrubar)
    // A nova tentativa, agora sem a queda, não cai de volta na pergunta de antes: mostra o link.
    await tocar(noDialogo(page), 'Refazer convite', hasTouch)
    await expect(etapaDoLink(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(pergunta(page)).toHaveCount(0)
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
  })

  test('a sessão vence com o link na tela: o diálogo sai com o link, e não fica atrás do login por cima; "Entrar com outra conta" não deixa nada do professor', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const INATIVIDADE_MIN = 30
    const coordenadora = await criarEquipeComSenha('coordenador')
    await definirInatividadeDaEscola(coordenadora.escolaId, { equipe: INATIVIDADE_MIN })
    const professor = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente')
    // O relógio da aba é simulado: ninguém espera meia hora no e2e, e o servidor continua no tempo real.
    await page.clock.install()
    await abrirProfessores(page, coordenadora, hasTouch)
    const token = tokenDo(await refazerPelaTela(page, professor.nome, hasTouch))
    expect(await page.content()).toContain(token)

    await page.clock.fastForward(`00:${String(INATIVIDADE_MIN + 1)}:00`)
    await expect(page.getByRole('dialog', { name: 'Sua sessão expirou' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // Só o login por cima: o diálogo do convite saiu da página, e o link com ele. O painel do professor sai junto, porque a lista que o
    // sustentava deixou de valer com a sessão (a tela volta ao erro de leitura), e o nome do professor não fica atrás do login.
    await expect(dialogosAbertos(page)).toHaveCount(1)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(paineisAbertos(page)).toHaveCount(0)
    expect(await page.content()).not.toContain(token)

    await acionar(page.getByRole('button', { name: 'Entrar com outra conta' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(professor.nome)
    expect(await page.content()).not.toContain(token)
  })

  test('segunda pessoa: a coordenação de B entra na aba da de A, e não vê a lista nem o diálogo dela', async ({ page, hasTouch }) => {
    test.slow()
    const deA = await criarEquipeComSenha('coordenador')
    const professorDeA = await convidarProfessorNoBanco(deA.escolaId, 'pendente')
    await abrirProfessores(page, deA, hasTouch)
    const token = tokenDo(await refazerPelaTela(page, professorDeA.nome, hasTouch))
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    // O painel de A fica aberto por baixo: a página, e a lateral com ela, só voltam quando ele fecha.
    await expect(paineisAbertos(page)).toHaveCount(1)
    await fecharPainel(page, hasTouch)
    await abrirNavegacao(page, hasTouch)
    await acionar(lateral(page).getByRole('button', { name: 'Sair' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })

    // A de B entra na mesma aba, sem recarregar, com a leitura da lista segurada: é aí que a lista de A apareceria.
    const deB = await criarEquipeComSenha('coordenador')
    const professorDeB = await convidarProfessorNoBanco(deB.escolaId, 'pendente')
    const segurada = portao()
    await page.route(ehALista, async (rota: Route) => {
      if (rota.request().method() === 'GET') await segurada.aberta
      return rota.fallback()
    })
    await entrarComoCoordenacaoNaMesmaAba(page, deB, hasTouch)
    await irPelaCoordenacao(page, 'Professores', hasTouch)
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando os professores…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText(professorDeA.nome)
    await expect(dialogosAbertos(page)).toHaveCount(0)
    segurada.abrir()
    await expect(linhaDe(page, professorDeB.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhasDaLista(page)).toHaveCount(1)
    await expect(page.locator('body')).not.toContainText(professorDeA.nome)
    await expect(dialogosAbertos(page)).toHaveCount(0)
    expect(await page.content()).not.toContain(token)

    // O endereço do professor de A, aberto na sessão de B: a lista de B não o tem, e a tela não abre painel nem diz que ele existe.
    await page.goto(`/coordenacao/professores?professor=${professorDeA.usuarioId}`)
    await expect(linhaDe(page, professorDeB.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(paineisAbertos(page)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(professorDeA.nome)
  })
})

test.describe('o painel do professor', () => {
  test('a linha inteira abre o painel, no endereço, com o id e mais nada; o Esc fecha e tira o parâmetro; o Voltar não o reabre', async ({ page, hasTouch }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const professor = await convidarProfessorNoBanco(coordenadora.escolaId, 'vencido', 'Zoé')
    await abrirProfessores(page, coordenadora, hasTouch)
    await expect(linhaDe(page, professor.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // Um toque no canto de baixo da linha, longe do nome: o botão do nome se estende pela linha (e pelo cartão, no celular).
    const caixa = await linhaDe(page, professor.nome).boundingBox()
    expect(caixa, 'a linha sem caixa').not.toBeNull()
    const x = (caixa?.x ?? 0) + (caixa?.width ?? 0) - 12
    const y = (caixa?.y ?? 0) + (caixa?.height ?? 0) - 12
    if (hasTouch) await page.touchscreen.tap(x, y)
    else await page.mouse.click(x, y)
    const painel = painelDe(page, professor.nome)
    await expect(painel).toBeVisible()
    // O endereço leva só o id do usuário, nunca o nome nem o e-mail (regra 20, item 9).
    await expect(page).toHaveURL(new RegExp(`/coordenacao/professores\\?professor=${professor.usuarioId}$`))
    expect(page.url()).not.toContain(encodeURIComponent(professor.nome))
    expect(page.url()).not.toContain(professor.email)
    await expect(painel).toContainText(TEXTO_DO_ESTADO.vencido)
    await expect(acoesDoPainel(painel)).toHaveText([...ACOES_DO_ESTADO.vencido])
    await expect(painel.getByRole('heading', { name: 'Situação do convite' })).toBeAttached()
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    for (const acao of ACOES_DO_ESTADO.vencido) await alvoDeToque(painel.getByRole('button', { name: acao, exact: true }), acao)

    // O Esc fecha, tira o parâmetro sem passo novo no histórico, e o foco volta ao botão da linha que abriu o painel.
    await page.keyboard.press('Escape')
    await expect(paineisAbertos(page)).toHaveCount(0)
    await expect(page).toHaveURL(/\/coordenacao\/professores$/)
    await expect(botaoDaLinha(page, professor.nome)).toBeFocused()

    // O Voltar não reabre o painel: fechar trocou o endereço do passo que abrir tinha empurrado.
    await page.goBack()
    await expect(paineisAbertos(page)).toHaveCount(0)
    expect(page.url()).not.toContain('professor=')
  })

  test('aberto pelo endereço, sem botão que o tenha aberto: fecha com o foco no título da lista; o id de outra escola não abre nada nem diz que existe', async ({ page, hasTouch }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const outraEscola = await criarEquipeComSenha('coordenador')
    const professor = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Zoé')
    const deOutra = await convidarProfessorNoBanco(outraEscola.escolaId, 'pendente', 'Yan')
    await abrirProfessores(page, coordenadora, hasTouch)
    await expect(linhaDe(page, professor.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    await page.goto(`/coordenacao/professores?professor=${professor.usuarioId}`)
    const painel = painelDe(page, professor.nome)
    await expect(painel).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(painel).toContainText(TEXTO_DO_ESTADO.pendente)
    await tocar(painel, 'Fechar', hasTouch)
    await expect(paineisAbertos(page)).toHaveCount(0)
    await expect(page).toHaveURL(/\/coordenacao\/professores$/)
    await expect(tituloDaLista(page)).toBeFocused()

    // O id de um professor de outra escola, na mão: a tela não abre painel nenhum e não deixa ver que o id existe (regra 10, item 6).
    await page.goto(`/coordenacao/professores?professor=${deOutra.usuarioId}`)
    await expect(linhaDe(page, professor.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(paineisAbertos(page)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(deOutra.nome)
    expect(await violacoesGraves(page)).toEqual([])
  })
})
