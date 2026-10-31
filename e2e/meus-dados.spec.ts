import { readFile } from 'node:fs/promises'
import type { Browser, BrowserContext, BrowserContextOptions, Locator, Page, Request, Route } from '@playwright/test'
import {
  abrirNavegacao,
  entrarComoAluno,
  entrarPorEmail,
  escolherNoSeletor,
  esperarNovaConversa,
  irPelaNavegacao,
  lateral,
  naGaveta,
  nomeNoSeletor,
  PRAZO_DA_ENTRADA_MS,
  secoes,
} from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { doisCliquesNoMesmoInstante, entrarNosPedidos, hoje, registrarPeloFluxo } from './support/pedidos-do-titular.ts'
import {
  apagarArquivoDoTitularNoBanco,
  auditoriaDoPedidoNoBanco,
  colocarAlunoNaTurma,
  criarAlunoComMatricula,
  criarArquivoDoTitularNoBanco,
  criarCoordenadoraNaEscola,
  criarEquipeComSenha,
  criarPedidoDoTitularNoBanco,
  criarUsuarioEmOutraEscola,
  mudarEstadoDoPedidoNoBanco,
  pedidosDoTitularNoBanco,
  type AlunoDeTeste,
  type EquipeDeTeste,
} from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './support/checks.ts'

/**
 * "Meus dados" do aluno e do professor (F3, 18.0; RF12 e RF20; `docs/interface.md` 11.1): o aluno acha "Meus dados" em
 * Privacidade, uma linha de Eu (X4, 2.0); o professor, no menu da pessoa. A tela mostra os pedidos que a coordenação
 * registrou, o estado de cada um, o resumo por categoria e o aviso de computador compartilhado, e entrega o arquivo.
 * Contra a API real e o worker real, nos projetos `chromebook` e `celular`. O que o clique fez se confere **no banco** e na
 * auditoria, e não só no que a tela diz.
 */

const PRAZO_DO_WORKER_MS = 90_000
const LEITURA_DE_MEUS_DADOS = '**/v1/meus-dados'
const ehALeitura = (pedido: Request) => pedido.method() === 'GET' && new URL(pedido.url()).pathname === '/v1/meus-dados'

const principal = (page: Page) => page.getByRole('main')
const anuncios = (page: Page) => principal(page).getByRole('status')
const confirmacao = (page: Page) => page.getByRole('alertdialog', { name: 'Baixar os seus dados', exact: true })
const pedidosDaTela = (page: Page, tipo: string) => principal(page).getByRole('listitem').filter({ hasText: tipo })
const botaoDeBaixar = (page: Page) => principal(page).getByRole('button', { name: 'Baixar meus dados', exact: true })

const contextos: BrowserContext[] = []
/** Outro navegador, com as opções do projeto: o computador do aluno, o do professor. */
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

test.afterEach(async () => {
  for (const contexto of contextos.splice(0)) await contexto.close()
})

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Sem estouro de largura (a 360 px também), sem violação grave de acessibilidade. */
async function telaSemProblema(page: Page): Promise<void> {
  expect(await larguraExcedente(page)).toBe(0)
  expect(await violacoesGraves(page)).toEqual([])
}

interface Cenario {
  readonly coordenadora: EquipeDeTeste
  readonly aluno: AlunoDeTeste
}

/** A escola com a coordenadora e um aluno com turma, nomes inventados e únicos. */
async function montarEscola(): Promise<Cenario> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  const aluno = await criarAlunoComMatricula({ escola: coordenadora })
  await colocarAlunoNaTurma(aluno)
  return { coordenadora, aluno }
}

/** O aluno, por Eu (X4, 2.0): a linha Privacidade, no miolo da tela, e não mais o rodapé da lateral. Só leva até lá, sem esperar o conteúdo. */
async function irAPrivacidadeDoAluno(page: Page, hasTouch: boolean): Promise<void> {
  await irPelaNavegacao(page, 'Eu', hasTouch)
  await acionar(principal(page).getByRole('link', { name: 'Privacidade', exact: true }), hasTouch)
  await expect(page).toHaveURL(/\/aluno\/privacidade$/, { timeout: PRAZO_DA_ENTRADA_MS })
}

/** O aluno, por Eu: a linha Privacidade, e a seção "Meus dados" dentro dela. */
async function abrirPrivacidadeDoAluno(page: Page, hasTouch: boolean): Promise<void> {
  await irAPrivacidadeDoAluno(page, hasTouch)
  await expect(principal(page).getByRole('heading', { level: 2, name: 'Meus dados', exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  // Os cartões ficam um nível abaixo da seção, e o título da aba é o da tela.
  await expect(principal(page).getByRole('heading', { level: 3, name: 'Seus pedidos', exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  await expect(page).toHaveTitle('Privacidade · Turmma')
}

/** O professor, pelo menu da pessoa: o link "Meus dados" fica antes do "Sair". */
async function abrirMeusDadosDoProfessor(page: Page, hasTouch: boolean): Promise<void> {
  await abrirNavegacao(page, hasTouch)
  await acionar(lateral(page).getByRole('navigation', { name: 'Sua conta', exact: true }).getByRole('link', { name: 'Meus dados', exact: true }), hasTouch)
  await expect(page).toHaveURL(/\/professor\/meus-dados$/, { timeout: PRAZO_DA_ENTRADA_MS })
  await expect(principal(page).getByRole('heading', { level: 2, name: 'Seus pedidos', exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  await expect(page).toHaveTitle('Meus dados · Turmma')
}

async function sair(page: Page, hasTouch: boolean): Promise<void> {
  await abrirNavegacao(page, hasTouch)
  await acionar(lateral(page).getByRole('button', { name: 'Sair' }), hasTouch)
  await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
}

/**
 * Abre o diálogo, confere o que ele diz e baixa o arquivo, com dois cliques no mesmo instante: devolve o conteúdo, o nome que
 * o navegador recebeu e quantas chamadas de download saíram (uma só, que é o que cada clique custa na auditoria).
 */
async function baixarPelaTela(page: Page): Promise<{ readonly nome: string; readonly conteudo: string; readonly chamadas: number }> {
  await acionar(botaoDeBaixar(page), test.info().project.use.hasTouch === true)
  const dialogo = confirmacao(page)
  await expect(dialogo).toBeVisible()
  // O que vai acontecer (regra 50, item 8) e o aviso do computador compartilhado (RF12).
  await expect(dialogo).toContainText('Pedido')
  await expect(dialogo).toContainText('Cópia dos seus dados')
  await expect(dialogo).toContainText('Chegou à escola em')
  await expect(dialogo).toContainText('Disponível até')
  await expect(dialogo).toContainText('em formato aberto (JSON)')
  await expect(dialogo).toContainText('as suas conversas com a IA')
  await expect(dialogo).toContainText('Se este computador é da escola, apague o arquivo dele depois de usar e saia da sua conta')
  await expect(dialogo).toContainText('O download fica registrado na escola')
  expect(await larguraExcedenteDoDialogo(page)).toBe(0)
  expect(await violacoesGraves(page)).toEqual([])
  let chamadas = 0
  page.on('request', (pedido) => {
    if (pedido.method() === 'POST' && /^\/v1\/meus-dados\/[0-9a-f-]{36}\/baixar$/.test(new URL(pedido.url()).pathname)) chamadas += 1
  })
  const confirmar = dialogo.getByRole('button', { name: 'Baixar o arquivo', exact: true })
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: PRAZO_DA_ENTRADA_MS }), doisCliquesNoMesmoInstante(confirmar)])
  const conteudo = await readFile(await download.path(), 'utf8')
  await expect(dialogo).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
  return { nome: download.suggestedFilename(), conteudo, chamadas }
}

/**
 * O aluno com o arquivo pronto abre o diálogo de baixar, o arquivo sai da escola enquanto ele lia, e a releitura que a falha
 * dispara fica **retida**: a lista só muda quando o teste chama `soltar`, e não quando a máquina responde. Devolve com o
 * diálogo já fechado e o foco no botão, que continua na lista velha.
 */
async function fecharODialogoComALeituraRetida(page: Page, hasTouch: boolean): Promise<{ readonly soltar: () => void }> {
  const { coordenadora, aluno } = await montarEscola()
  const pedidoId = await criarPedidoDoTitularNoBanco({
    escolaId: coordenadora.escolaId,
    titularId: aluno.usuarioId,
    registradoPor: coordenadora.usuarioId,
    tipo: 'acesso',
    estado: 'pronto',
    chegouHaDias: 1,
  })
  await criarArquivoDoTitularNoBanco(coordenadora.escolaId, pedidoId)
  await entrarComoAluno(page, aluno, hasTouch)
  await abrirPrivacidadeDoAluno(page, hasTouch)
  await expect(pedidosDaTela(page, 'Cópia dos seus dados')).toContainText('Pronto para baixar', { timeout: PRAZO_DA_ENTRADA_MS })

  await acionar(botaoDeBaixar(page), hasTouch)
  const dialogo = confirmacao(page)
  await expect(dialogo).toBeVisible()
  await apagarArquivoDoTitularNoBanco(coordenadora.escolaId, pedidoId)
  let soltar: () => void = () => undefined
  const retida = new Promise<void>((resolver) => (soltar = resolver))
  let releituras = 0
  await page.route(LEITURA_DE_MEUS_DADOS, async (rota: Route) => {
    if (rota.request().method() !== 'GET') return rota.continue()
    releituras += 1
    await retida
    return rota.continue()
  })
  await acionar(dialogo.getByRole('button', { name: 'Baixar o arquivo', exact: true }), hasTouch)
  await expect(dialogo.getByRole('alert')).toContainText('Este arquivo não está mais disponível', { timeout: PRAZO_DA_ENTRADA_MS })
  await expect.poll(() => releituras, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(1)
  await acionar(dialogo.getByRole('button', { name: 'Fechar', exact: true }), hasTouch)
  await expect(dialogo).toHaveCount(0)
  // A lista ainda é a velha: o botão continua nela, e o foco voltou a ele.
  await expect(botaoDeBaixar(page)).toBeFocused()
  return { soltar }
}

test.describe('Meus dados: o aluno e o professor baixam o que a coordenação registrou', () => {
  test('a coordenação registra o acesso, o worker monta o arquivo e o aluno e o professor baixam `meus-dados-AAAA-MM-DD.json`, cada um o seu, com o download na auditoria', async ({
    page,
    browser,
    hasTouch,
  }) => {
    test.setTimeout(300_000)
    // A professora, a coordenadora e o aluno são da mesma escola: a coordenadora é a que registra os dois pedidos.
    const professora = await criarEquipeComSenha('professor')
    const coordenadora = await criarCoordenadoraNaEscola(professora)
    const aluno = await criarAlunoComMatricula({ escola: professora })
    await colocarAlunoNaTurma(aluno)
    const coordenacaoDaEscola = professora

    await entrarNosPedidos(page, hasTouch, coordenadora)
    await registrarPeloFluxo(page, hasTouch, { nome: aluno.nome, pessoa: new RegExp(aluno.nome), tipo: 'Acesso aos dados', confirmar: 'Registrar pedido' })
    await registrarPeloFluxo(page, hasTouch, { nome: professora.nome, pessoa: new RegExp(professora.nome), tipo: 'Acesso aos dados', confirmar: 'Registrar pedido' })

    // O aluno entra no computador dele, acha Privacidade no rodapé e espera o arquivo ficar pronto sem recarregar.
    const alunoNaTela = await outroNavegador(browser)
    await entrarComoAluno(alunoNaTela, aluno, hasTouch)
    await abrirPrivacidadeDoAluno(alunoNaTela, hasTouch)
    await expect(alunoNaTela.getByRole('heading', { level: 1, name: 'Privacidade' })).toBeAttached()
    await expect(principal(alunoNaTela)).toContainText(`feitos em ${coordenacaoDaEscola.escolaNome}`)
    await expect(pedidosDaTela(alunoNaTela, 'Cópia dos seus dados')).toHaveCount(1)
    await expect(pedidosDaTela(alunoNaTela, 'Cópia dos seus dados')).toContainText('Pronto para baixar', { timeout: PRAZO_DO_WORKER_MS })
    await expect(principal(alunoNaTela).getByRole('region', { name: 'O que a escola guarda de você' })).toBeVisible()
    await telaSemProblema(alunoNaTela)

    const doAluno = await baixarPelaTela(alunoNaTela)
    // Dois cliques no mesmo instante: uma chamada, um arquivo, um registro.
    expect(doAluno.chamadas).toBe(1)
    expect(doAluno.nome).toBe(`meus-dados-${hoje()}.json`)
    expect(() => JSON.parse(doAluno.conteudo)).not.toThrow()
    expect(doAluno.conteudo).toContain(aluno.nome)
    expect(doAluno.conteudo).not.toContain(professora.nome)
    await expect(anuncios(alunoNaTela).filter({ hasText: `Arquivo baixado: meus-dados-${hoje()}.json.` })).toContainText('apague o arquivo dele depois de usar')

    // O download ficou na auditoria da escola, com o aluno como autor e a finalidade fixa (regra 20, item 10).
    const pedidos = await pedidosDoTitularNoBanco(coordenacaoDaEscola.escolaId)
    expect(pedidos).toHaveLength(2)
    const pedidoDoAluno = pedidos.find((pedido) => pedido.titularId === aluno.usuarioId)
    if (pedidoDoAluno === undefined) throw new Error('o pedido do aluno não está no banco')
    const baixados = (await auditoriaDoPedidoNoBanco(coordenacaoDaEscola.escolaId, pedidoDoAluno.id)).filter((linha) => linha.acao === 'titular.arquivo_baixado')
    expect(baixados).toHaveLength(1)
    expect(baixados[0]).toMatchObject({ autor: aluno.usuarioId, finalidade: 'acesso_do_proprio_titular' })

    // O arquivo saiu da escola enquanto o aluno lia: o clique diz isso, e a lista passa a mostrar o arquivo apagado.
    await acionar(botaoDeBaixar(alunoNaTela), hasTouch)
    const dialogo = confirmacao(alunoNaTela)
    await expect(dialogo).toBeVisible()
    await apagarArquivoDoTitularNoBanco(coordenacaoDaEscola.escolaId, pedidoDoAluno.id)
    await acionar(dialogo.getByRole('button', { name: 'Baixar o arquivo', exact: true }), hasTouch)
    await expect(dialogo.getByRole('alert')).toContainText('Este arquivo não está mais disponível', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogo.getByRole('button', { name: 'Baixar o arquivo', exact: true })).toBeDisabled()
    await acionar(dialogo.getByRole('button', { name: 'Fechar', exact: true }), hasTouch)
    await expect(dialogo).toHaveCount(0)
    // O botão que abriu o diálogo saiu da lista: o foco vai para a tela, e não se perde no corpo da página.
    expect(await alunoNaTela.evaluate(() => document.activeElement === document.body)).toBe(false)
    await expect(pedidosDaTela(alunoNaTela, 'Cópia dos seus dados')).toContainText('Arquivo apagado', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(pedidosDaTela(alunoNaTela, 'Cópia dos seus dados')).toContainText('peça à coordenação')
    await expect(botaoDeBaixar(alunoNaTela)).toHaveCount(0)
    // Depois de recarregar, o apagado continua apagado: o estado é o do servidor.
    await alunoNaTela.reload()
    await expect(pedidosDaTela(alunoNaTela, 'Cópia dos seus dados')).toContainText('Arquivo apagado', { timeout: PRAZO_DA_ENTRADA_MS })
    await telaSemProblema(alunoNaTela)

    // A professora, no computador dela, pelo menu da pessoa: o arquivo é o dela, e o do aluno nunca aparece.
    const professoraNaTela = await outroNavegador(browser)
    await professoraNaTela.goto('/entrar')
    await entrarPorEmail(professoraNaTela, professora, hasTouch)
    await esperarNovaConversa(professoraNaTela, professora.nome)
    await abrirMeusDadosDoProfessor(professoraNaTela, hasTouch)
    await expect(pedidosDaTela(professoraNaTela, 'Cópia dos seus dados')).toHaveCount(1)
    await expect(pedidosDaTela(professoraNaTela, 'Cópia dos seus dados')).toContainText('Pronto para baixar', { timeout: PRAZO_DO_WORKER_MS })
    await telaSemProblema(professoraNaTela)
    const daProfessora = await baixarPelaTela(professoraNaTela)
    expect(daProfessora.chamadas).toBe(1)
    expect(daProfessora.nome).toBe(`meus-dados-${hoje()}.json`)
    expect(daProfessora.conteudo).toContain(professora.nome)
    expect(daProfessora.conteudo).not.toContain(aluno.nome)
    const pedidoDaProfessora = pedidos.find((pedido) => pedido.titularId === professora.usuarioId)
    if (pedidoDaProfessora === undefined) throw new Error('o pedido da professora não está no banco')
    const baixadosDela = (await auditoriaDoPedidoNoBanco(coordenacaoDaEscola.escolaId, pedidoDaProfessora.id)).filter((linha) => linha.acao === 'titular.arquivo_baixado')
    expect(baixadosDela).toHaveLength(1)
    expect(baixadosDela[0]).toMatchObject({ autor: professora.usuarioId, finalidade: 'acesso_do_proprio_titular' })
  })
})

test.describe('Meus dados: onde cada pessoa os acha', () => {
  test('o aluno acha Privacidade em Eu, sem rolar e com alvo de 44 px a 360 px; fora da lista de seções e sem rodapé na lateral', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const { aluno } = await montarEscola()
    await entrarComoAluno(page, aluno, hasTouch)
    // A lista de seções do aluno está à vista sem abrir nada: no celular é a barra de baixo, fora da gaveta (A90).
    await expect(secoes(page).getByRole('link')).toHaveText(['Início', 'Tarefas', 'Eu'])
    await expect(secoes(page).getByRole('link', { name: 'Privacidade' })).toHaveCount(0)
    await irPelaNavegacao(page, 'Eu', hasTouch)
    const item = principal(page).getByRole('link', { name: 'Privacidade', exact: true })
    await expect(item).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(item).not.toHaveAttribute('aria-current', 'page')
    const caixa = await item.boundingBox()
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(await larguraExcedente(page)).toBe(0)
    await expect(item).toBeInViewport()
    // O rodapé fixo da lateral saiu: nem na gaveta (aberta antes) nem na lateral há o grupo "Rodapé".
    await abrirNavegacao(page, hasTouch)
    await expect(lateral(page).getByRole('navigation', { name: 'Rodapé', exact: true })).toHaveCount(0)
    // Na página toda há um só link "Privacidade": o da linha de Eu (na lateral, que no computador é o mesmo `body`, não há outro).
    await expect(page.getByRole('link', { name: 'Privacidade', exact: true })).toHaveCount(1)
    if (naGaveta(page)) await acionar(page.getByRole('button', { name: 'Fechar o menu' }), hasTouch)

    await acionar(item, hasTouch)
    await expect(page).toHaveURL(/\/aluno\/privacidade$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('heading', { level: 2, name: 'Meus dados', exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // Eu fica selecionado em Privacidade, e é o único: a lista de seções nunca marca duas telas. O controle positivo é a
    // própria lista à vista, com os três itens: sem ele a ausência passaria vazia se `Seções` saísse do lugar.
    await expect(secoes(page).getByRole('link')).toHaveCount(3)
    await expect(secoes(page).locator('[aria-current="page"]')).toHaveCount(1)
    await expect(secoes(page).getByRole('link', { name: 'Eu', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('o professor acha "Meus dados" no menu da pessoa, antes do "Sair", e o link fica selecionado na tela dele', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const professora = await criarEquipeComSenha('professor')
    await page.goto('/entrar')
    await entrarPorEmail(page, professora, hasTouch)
    await esperarNovaConversa(page, professora.nome)
    await abrirNavegacao(page, hasTouch)

    // O menu da pessoa tem os dois links ("Meus dados" e, desde a 10.0, "Rever a introdução") e o "Sair", nessa ordem; a lista de
    // seções não ganha item.
    const menu = lateral(page).getByRole('navigation', { name: 'Sua conta', exact: true })
    await expect(menu.getByRole('link')).toHaveText(['Meus dados', 'Rever a introdução'])
    const link = menu.getByRole('link', { name: 'Meus dados', exact: true })
    const sairDaLateral = lateral(page).getByRole('button', { name: 'Sair' })
    const [caixaDoLink, caixaDoSair] = [await link.boundingBox(), await sairDaLateral.boundingBox()]
    expect(caixaDoLink?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(caixaDoSair?.y ?? 0)
    expect((caixaDoLink?.height ?? 0) >= ALVO_DE_TOQUE_PRINCIPAL_PX).toBe(true)
    // A ausência de "Meus dados" em `Seções` precisa de controle positivo (A91): no celular `Seções` do professor é a barra de
    // baixo, e olhar dentro da gaveta passaria vazio. Com os três itens dele à vista, a negativa vale.
    await expect(secoes(page).getByRole('link')).toHaveText(['Início', 'Turmas', 'Ferramentas', 'Criados'])
    await expect(secoes(page).getByRole('link', { name: 'Meus dados' })).toHaveCount(0)

    await acionar(link, hasTouch)
    await expect(page).toHaveURL(/\/professor\/meus-dados$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('heading', { level: 1, name: 'Meus dados' })).toBeAttached()
    await abrirNavegacao(page, hasTouch)
    await expect(lateral(page).getByRole('navigation', { name: 'Sua conta', exact: true }).getByRole('link', { name: 'Meus dados', exact: true })).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('Meus dados: no trilho da lateral', () => {
  test('recolhida a lateral, o aluno ainda alcança Eu (e, por ele, Privacidade) e o professor, Meus dados, com o nome e o alvo de 44 px', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    const { aluno } = await montarEscola()
    // O trilho é do computador: abaixo de 768 px a lateral é a gaveta. No `celular` a aba ganha a largura do computador,
    // como em `casca.spec.ts` (W12), e o teste roda nos dois projetos.
    await page.setViewportSize({ width: 1366, height: 768 })
    await entrarComoAluno(page, aluno, hasTouch)
    await acionar(page.getByRole('button', { name: 'Recolher a lateral' }), hasTouch)
    const eu = page.getByRole('navigation', { name: 'Seções', exact: true }).getByRole('link', { name: 'Eu', exact: true })
    await expect(eu).toBeVisible()
    expect((await eu.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    await acionar(eu, hasTouch)
    await acionar(principal(page).getByRole('link', { name: 'Privacidade', exact: true }), hasTouch)
    await expect(page).toHaveURL(/\/aluno\/privacidade$/, { timeout: PRAZO_DA_ENTRADA_MS })

    // A mesma aba, a professora: o trilho guardado a recebe com o link do menu da pessoa.
    const professora = await criarEquipeComSenha('professor')
    await sair(page, hasTouch)
    await entrarPorEmail(page, professora, hasTouch)
    // O trilho esconde o nome da pessoa: a entrada se confere pelo endereço, e não pelo nome na lateral.
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: PRAZO_DA_ENTRADA_MS })
    const meusDados = page.getByRole('navigation', { name: 'Sua conta', exact: true }).getByRole('link', { name: 'Meus dados', exact: true })
    await expect(meusDados).toBeVisible()
    expect((await meusDados.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    await acionar(meusDados, hasTouch)
    await expect(page).toHaveURL(/\/professor\/meus-dados$/, { timeout: PRAZO_DA_ENTRADA_MS })
  })
})

test.describe('Meus dados: os estados', () => {
  test('o resumo por categoria: na ordem do catálogo, no singular e no plural, e a frase de quando não há nenhum registro', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const { aluno } = await montarEscola()
    let corpo: unknown = {
      pedidos: [],
      categorias: [
        { categoria: 'pessoa_desativada', quantidade: 1 },
        { categoria: 'trabalho_do_aluno', quantidade: 12 },
        { categoria: 'conversa_tutor', quantidade: 0 },
      ],
    }
    await page.route(LEITURA_DE_MEUS_DADOS, (rota: Route) =>
      rota.request().method() === 'GET' ? rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) }) : rota.continue(),
    )
    await entrarComoAluno(page, aluno, hasTouch)
    await abrirPrivacidadeDoAluno(page, hasTouch)

    const resumo = principal(page).getByRole('region', { name: 'O que a escola guarda de você' })
    const linhas = resumo.getByRole('listitem')
    await expect(linhas).toHaveCount(2, { timeout: PRAZO_DA_ENTRADA_MS })
    // A ordem é a do catálogo da coordenação (o trabalho vem antes do cadastro de quem saiu), e o que tem zero não aparece.
    await expect(linhas.nth(0)).toContainText('12 registros')
    await expect(linhas.nth(1)).toContainText('1 registro')
    await expect(linhas.nth(1)).not.toContainText('1 registros')
    // O texto é o do titular, na segunda pessoa: nunca a regra de guarda do catálogo da coordenação.
    await expect(linhas.nth(0)).toContainText('As suas respostas e as correções das suas atividades')
    await expect(linhas.nth(1)).toContainText('O seu cadastro na escola')
    await expect(resumo).not.toContainText('desativado')
    await expect(resumo).toContainText('O que há em cada um vem no arquivo.')

    corpo = { pedidos: [], categorias: [] }
    await page.reload()
    await expect(principal(page).getByRole('region', { name: 'O que a escola guarda de você' })).toContainText('A escola não guarda nenhum registro seu por categoria por enquanto.', {
      timeout: PRAZO_DA_ENTRADA_MS,
    })
    await telaSemProblema(page)
  })

  test('vazio: convida a pedir à coordenação e diz de que escola são os pedidos; sem pedido, o resumo diz o que a escola guarda', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const { coordenadora, aluno } = await montarEscola()
    await entrarComoAluno(page, aluno, hasTouch)
    await abrirPrivacidadeDoAluno(page, hasTouch)

    await expect(principal(page).getByText('Nenhum pedido ainda', { exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page)).toContainText('Para receber uma cópia dos seus dados, peça à coordenação da escola.')
    await expect(principal(page)).toContainText(`Aqui aparecem só os pedidos feitos em ${coordenadora.escolaNome}.`)
    // Sem pedido a tela não oferece ação nenhuma de baixar, e a pessoa não pede por ela: o pedido é da escola.
    await expect(botaoDeBaixar(page)).toHaveCount(0)
    await expect(principal(page).getByRole('button')).toHaveCount(0)
    await expect(principal(page).getByRole('region', { name: 'O que a escola guarda de você' })).toBeVisible()
    await telaSemProblema(page)
  })

  test('carregando e erro: a tela diz o que espera, e "Tentar de novo" lê de novo', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const { aluno } = await montarEscola()
    // A primeira leitura fica segurada (o carregando); depois toda leitura falha até o teste deixar passar. As leituras
    // automáticas que a consulta repete não gastam a falha: quem decide é a bandeira, e não a contagem.
    let falhando = true
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    let primeira = true
    let falhas = 0
    await page.route(LEITURA_DE_MEUS_DADOS, async (rota: Route) => {
      if (rota.request().method() !== 'GET') return rota.continue()
      if (primeira) {
        primeira = false
        await segurada
      }
      if (falhando) {
        falhas += 1
        return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
      }
      return rota.continue()
    })
    await entrarComoAluno(page, aluno, hasTouch)
    await irAPrivacidadeDoAluno(page, hasTouch)
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando os seus pedidos…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page)).not.toContainText('Nenhum pedido ainda')
    liberar()
    await expect(principal(page).getByRole('alert').filter({ hasText: 'O sistema está indisponível no momento' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await telaSemProblema(page)
    // Enquanto falha, "Tentar de novo" lê de novo: a tentativa e a repetição automática que vem um segundo depois falham,
    // e a tela volta ao erro. Só quando as duas passaram o servidor volta, e o botão leva ao dado.
    await expect.poll(() => falhas, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(2)
    const antes = falhas
    await acionar(principal(page).getByRole('button', { name: 'Tentar de novo', exact: true }), hasTouch)
    await expect.poll(() => falhas, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(antes + 2)
    await expect(principal(page).getByRole('status').filter({ hasText: 'Tentando de novo…' })).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('alert').filter({ hasText: 'O sistema está indisponível no momento' })).toBeVisible()
    falhando = false
    await acionar(principal(page).getByRole('button', { name: 'Tentar de novo', exact: true }), hasTouch)
    await expect(principal(page).getByText('Nenhum pedido ainda', { exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  })

  test('em preparação se relê a cada 10 s e vira pronto sem recarregar; com a aba escondida para, e ao voltar relê na hora', async ({ page, hasTouch }) => {
    test.slow()
    const { coordenadora, aluno } = await montarEscola()
    const pedidoId = await criarPedidoDoTitularNoBanco({
      escolaId: coordenadora.escolaId,
      titularId: aluno.usuarioId,
      registradoPor: coordenadora.usuarioId,
      tipo: 'acesso',
      estado: 'em_preparacao',
      chegouHaDias: 1,
    })
    // O relógio da aba é simulado: ninguém espera 10 s de verdade, e o servidor continua no tempo real.
    await page.clock.install()
    let leituras = 0
    page.on('request', (pedido) => {
      if (ehALeitura(pedido)) leituras += 1
    })
    await entrarComoAluno(page, aluno, hasTouch)
    await abrirPrivacidadeDoAluno(page, hasTouch)
    await expect(pedidosDaTela(page, 'Cópia dos seus dados')).toContainText('Em preparação', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(pedidosDaTela(page, 'Cópia dos seus dados')).toContainText('Estamos preparando o seu arquivo. Volte em alguns minutos.')
    await expect(botaoDeBaixar(page)).toHaveCount(0)
    await expect.poll(() => leituras).toBe(1)
    // O que prova que não houve recarga: um marcador posto na janela sobrevive a todas as leituras.
    await page.evaluate(() => {
      ;(window as unknown as { __semRecarga: boolean }).__semRecarga = true
    })

    // O relógio da aba corre também no tempo real: 5 s mais 5 s deixam a margem de uma máquina lenta em segundos, e o
    // valor exato do intervalo (10 s) é da unidade (`regras.test.ts`).
    await page.clock.fastForward('00:05')
    await esperarOQueJaSaiu(page)
    expect(leituras).toBe(1)
    await page.clock.fastForward('00:05')
    await expect.poll(() => leituras, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(2)
    await expect(pedidosDaTela(page, 'Cópia dos seus dados')).toContainText('Em preparação')

    // Com a aba escondida, nenhuma leitura sai, por mais que o tempo passe.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.clock.fastForward('01:00')
    await esperarOQueJaSaiu(page)
    expect(leituras).toBe(2)
    // Ao voltar, relê na hora, sem esperar os 10 s.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect.poll(() => leituras, { timeout: PRAZO_DA_ENTRADA_MS }).toBeGreaterThanOrEqual(3)
    await esperarOQueJaSaiu(page)
    expect(leituras).toBe(3)

    // A escola termina: na leitura seguinte a tela mostra pronto, anuncia, e para de reler.
    await mudarEstadoDoPedidoNoBanco(coordenadora.escolaId, pedidoId, 'pronto')
    await page.clock.fastForward('00:10')
    await expect(pedidosDaTela(page, 'Cópia dos seus dados')).toContainText('Pronto', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(pedidosDaTela(page, 'Cópia dos seus dados')).not.toContainText('Estamos preparando')
    await expect(anuncios(page).filter({ hasText: 'O seu arquivo ficou pronto.' })).toBeVisible()
    await esperarOQueJaSaiu(page)
    const depoisDePronto = leituras
    await page.clock.fastForward('01:00')
    await esperarOQueJaSaiu(page)
    expect(leituras).toBe(depoisDePronto)
    expect(await page.evaluate(() => (window as unknown as { __semRecarga?: boolean }).__semRecarga)).toBe(true)
    await expect(page).toHaveURL(/\/aluno\/privacidade$/)
  })

  test('o download que falha: o botão diz que prepara e fica desligado enquanto a chamada está no ar, a falha diz o que fazer e a pessoa pode tentar de novo ou cancelar', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const { coordenadora, aluno } = await montarEscola()
    const pedidoId = await criarPedidoDoTitularNoBanco({
      escolaId: coordenadora.escolaId,
      titularId: aluno.usuarioId,
      registradoPor: coordenadora.usuarioId,
      tipo: 'portabilidade',
      estado: 'pronto',
      chegouHaDias: 1,
    })
    await criarArquivoDoTitularNoBanco(coordenadora.escolaId, pedidoId)
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    let baixadas = 0
    await page.route('**/v1/meus-dados/*/baixar', async (rota: Route) => {
      baixadas += 1
      await segurada
      return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
    })
    await entrarComoAluno(page, aluno, hasTouch)
    await abrirPrivacidadeDoAluno(page, hasTouch)
    await expect(pedidosDaTela(page, 'Cópia para levar a outro serviço')).toContainText('Pronto para baixar', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(pedidosDaTela(page, 'Cópia para levar a outro serviço')).toContainText('O arquivo fica disponível até')

    await acionar(botaoDeBaixar(page), hasTouch)
    const dialogo = confirmacao(page)
    await expect(dialogo).toBeVisible()
    await acionar(dialogo.getByRole('button', { name: 'Baixar o arquivo', exact: true }), hasTouch)
    // A chamada está no ar: o botão diz o que acontece e fica desligado, e o diálogo continua aberto.
    await expect(dialogo.getByRole('button', { name: 'Preparando o arquivo…', exact: true })).toBeDisabled()
    await expect.poll(() => baixadas).toBe(1)
    liberar()
    await expect(dialogo.getByRole('alert')).toContainText('Tente de novo em instantes: o arquivo continua guardado', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogo.getByRole('button', { name: 'Baixar o arquivo', exact: true })).toBeEnabled()
    await expect(dialogo.getByRole('button', { name: 'Cancelar', exact: true })).toBeVisible()
    // Cancelar fecha sem mudar nada: o botão continua na lista, com o foco de volta nele, e nenhum download foi feito.
    await acionar(dialogo.getByRole('button', { name: 'Cancelar', exact: true }), hasTouch)
    await expect(dialogo).toHaveCount(0)
    await expect(botaoDeBaixar(page)).toBeFocused()
    expect(baixadas).toBe(1)
    expect((await auditoriaDoPedidoNoBanco(coordenadora.escolaId, pedidoId)).filter((linha) => linha.acao === 'titular.arquivo_baixado')).toHaveLength(0)
    await telaSemProblema(page)
  })

  test('o arquivo que saiu enquanto a pessoa lia e a lista que só é relida depois de o diálogo fechar: o botão sai com o foco nele, e o foco vai para a tela, e não para o corpo da página', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const { soltar } = await fecharODialogoComALeituraRetida(page, hasTouch)
    soltar()
    await expect(pedidosDaTela(page, 'Cópia dos seus dados')).toContainText('Arquivo apagado', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(botaoDeBaixar(page)).toHaveCount(0)
    // O botão que tinha o foco saiu da lista: o foco vai para o contêiner da tela (`div` com `tabIndex={-1}` que guarda a lista),
    // e não se perde no corpo da página nem fica em outro elemento qualquer (regra 50, item 11).
    await expect
      .poll(() =>
        page.evaluate(() => {
          const ativo = document.activeElement
          return ativo?.tagName === 'DIV' && ativo.getAttribute('tabindex') === '-1' && (ativo.textContent ?? '').includes('Arquivo apagado')
        }),
      )
      .toBe(true)
  })

  test('com a lista relida depois de o diálogo fechar, o foco que a pessoa já levou a outro controle fica onde ela o pôs', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const { soltar } = await fecharODialogoComALeituraRetida(page, hasTouch)
    // A pessoa já foi para outro controle antes de a releitura chegar: a tela não lhe toma o foco.
    await page.evaluate(() => {
      const janela = window as unknown as { __focos: string[] }
      janela.__focos = []
      const outro = document.createElement('button')
      outro.id = 'outro-controle-da-pessoa'
      outro.textContent = 'Outro controle'
      document.body.append(outro)
      // Cada elemento que recebe o foco: o foco que passa por outro e volta também é foco tomado, mesmo que o fim pareça o mesmo.
      document.addEventListener('focusin', (evento) => janela.__focos.push((evento.target as HTMLElement).id || (evento.target as HTMLElement).tagName))
      outro.focus()
    })
    soltar()
    await expect(pedidosDaTela(page, 'Cópia dos seus dados')).toContainText('Arquivo apagado', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(botaoDeBaixar(page)).toHaveCount(0)
    await expect(page.locator('#outro-controle-da-pessoa')).toBeFocused()
    expect(await page.evaluate(() => (window as unknown as { __focos: string[] }).__focos)).toEqual(['outro-controle-da-pessoa'])
  })

  test('o anúncio de "pronto" é só de quem estava em preparação e ficou pronto: o que já chegou pronto e o que foi cancelado não anunciam', async ({ page, hasTouch }) => {
    test.slow()
    const { coordenadora, aluno } = await montarEscola()
    const semear = (tipo: 'acesso' | 'correcao', estado: 'em_preparacao' | 'pronto', chegouHaDias: number) =>
      criarPedidoDoTitularNoBanco({ escolaId: coordenadora.escolaId, titularId: aluno.usuarioId, registradoPor: coordenadora.usuarioId, tipo, estado, chegouHaDias })
    const emPreparacao = await semear('acesso', 'em_preparacao', 1)
    await semear('correcao', 'pronto', 3)
    await page.clock.install()
    await entrarComoAluno(page, aluno, hasTouch)
    await abrirPrivacidadeDoAluno(page, hasTouch)
    await expect(pedidosDaTela(page, 'Correção dos seus dados')).toContainText('Pronto', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(pedidosDaTela(page, 'Cópia dos seus dados')).toContainText('Em preparação')
    // O que já chegou pronto não é novidade: nada é anunciado na abertura.
    await expect(anuncios(page).filter({ hasText: 'ficou pronto' })).toHaveCount(0)

    // O pedido em preparação é cancelado pela escola: a tela o mostra cancelado, e não diz que "ficou pronto".
    await mudarEstadoDoPedidoNoBanco(coordenadora.escolaId, emPreparacao, 'cancelado')
    await page.clock.fastForward('00:10')
    await expect(pedidosDaTela(page, 'Cópia dos seus dados')).toContainText('Cancelado', { timeout: PRAZO_DA_ENTRADA_MS })
    await esperarOQueJaSaiu(page)
    await expect(anuncios(page).filter({ hasText: 'ficou pronto' })).toHaveCount(0)
  })

  test('com o dado já na tela, a releitura que falha não troca a lista pelo erro: o que a pessoa lê continua lá', async ({ page, hasTouch }) => {
    test.slow()
    const { coordenadora, aluno } = await montarEscola()
    await criarPedidoDoTitularNoBanco({
      escolaId: coordenadora.escolaId,
      titularId: aluno.usuarioId,
      registradoPor: coordenadora.usuarioId,
      tipo: 'acesso',
      estado: 'em_preparacao',
      chegouHaDias: 1,
    })
    await page.clock.install()
    let falhando = false
    let falhas = 0
    await page.route(LEITURA_DE_MEUS_DADOS, (rota: Route) => {
      if (rota.request().method() !== 'GET' || !falhando) return rota.continue()
      falhas += 1
      return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
    })
    await entrarComoAluno(page, aluno, hasTouch)
    await abrirPrivacidadeDoAluno(page, hasTouch)
    await expect(pedidosDaTela(page, 'Cópia dos seus dados')).toContainText('Em preparação', { timeout: PRAZO_DA_ENTRADA_MS })

    falhando = true
    await page.clock.fastForward('00:10')
    await expect.poll(() => falhas, { timeout: PRAZO_DA_ENTRADA_MS }).toBeGreaterThan(0)
    // A repetição automática da consulta sai um segundo depois: o tempo corre na aba, e a tela continua com o pedido.
    await page.clock.fastForward('00:05')
    await esperarOQueJaSaiu(page)
    await expect(pedidosDaTela(page, 'Cópia dos seus dados')).toContainText('Em preparação')
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    await expect(principal(page).getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0)
  })

  test('cada pedido diz em que pé está, do mais recente ao mais antigo, e os que não geram arquivo não têm o que baixar', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const { coordenadora, aluno } = await montarEscola()
    const semear = (tipo: 'acesso' | 'compartilhamento' | 'correcao' | 'eliminacao', estado: 'recebido' | 'pronto' | 'agendado' | 'concluido' | 'cancelado', chegouHaDias: number) =>
      criarPedidoDoTitularNoBanco({ escolaId: coordenadora.escolaId, titularId: aluno.usuarioId, registradoPor: coordenadora.usuarioId, tipo, estado, chegouHaDias })
    // Semeados do mais recente ao mais antigo: o id (uuidv7) cresce na ordem contrária da chegada, e a API entrega pelo id.
    await semear('eliminacao', 'cancelado', 2)
    await semear('compartilhamento', 'recebido', 10)
    await semear('correcao', 'concluido', 30)
    await entrarComoAluno(page, aluno, hasTouch)
    await abrirPrivacidadeDoAluno(page, hasTouch)

    const itens = principal(page).getByRole('listitem').filter({ hasText: 'Chegou à escola em' })
    await expect(itens).toHaveCount(3, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(itens.nth(0)).toContainText('Eliminação dos seus dados')
    await expect(itens.nth(0)).toContainText('Cancelado')
    await expect(itens.nth(1)).toContainText('Quem recebeu os seus dados')
    await expect(itens.nth(1)).toContainText('Recebido')
    await expect(itens.nth(2)).toContainText('Correção dos seus dados')
    await expect(itens.nth(2)).toContainText('Concluído')
    // Nenhum desses gera arquivo: o botão de baixar não existe, e o estado nunca é só a cor (cada um leva o texto).
    await expect(botaoDeBaixar(page)).toHaveCount(0)
    await telaSemProblema(page)
  })
})

test.describe('Meus dados: só a escola ativa, e o recomeço', () => {
  test('a professora de duas escolas vê só os pedidos da escola em que entrou, e a troca não deixa os da outra', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    const emA = await criarEquipeComSenha('professor')
    const emB = await criarUsuarioEmOutraEscola(emA.contaId)
    await criarPedidoDoTitularNoBanco({
      escolaId: emA.escolaId,
      titularId: emA.usuarioId,
      registradoPor: emA.usuarioId,
      papelDoTitular: 'professor',
      tipo: 'correcao',
      estado: 'recebido',
      chegouHaDias: 3,
    })
    await criarPedidoDoTitularNoBanco({
      escolaId: emB.escolaId,
      titularId: emB.usuarioId,
      registradoPor: emB.usuarioId,
      papelDoTitular: 'professor',
      tipo: 'compartilhamento',
      estado: 'recebido',
      chegouHaDias: 1,
    })

    await page.goto('/entrar')
    await entrarPorEmail(page, emA, hasTouch)
    const escolherA = page.getByRole('button', { name: `${emA.escolaNome} · professor` })
    await acionar(escolherA, hasTouch)
    await esperarNovaConversa(page, emA.nome)
    await abrirMeusDadosDoProfessor(page, hasTouch)

    await expect(principal(page)).toContainText(`feitos em ${emA.escolaNome}`)
    await expect(pedidosDaTela(page, 'Correção dos seus dados')).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page)).not.toContainText('Quem recebeu os seus dados')

    // Troca para B pela lateral: a tela de B não herda nada de A, nem enquanto a leitura de B não chega.
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(LEITURA_DE_MEUS_DADOS, async (rota: Route) => {
      await segurada
      await rota.continue()
    })
    await escolherNoSeletor(page, nomeNoSeletor(emB, 'professor'), hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await abrirNavegacao(page, hasTouch)
    await acionar(lateral(page).getByRole('navigation', { name: 'Sua conta', exact: true }).getByRole('link', { name: 'Meus dados', exact: true }), hasTouch)
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando os seus pedidos…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText('Correção dos seus dados')
    await expect(page.locator('body')).not.toContainText(emA.escolaNome)
    liberar()
    await expect(pedidosDaTela(page, 'Quem recebeu os seus dados')).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page)).toContainText(`feitos em ${emB.escolaNome}`)
    await expect(page.locator('body')).not.toContainText('Correção dos seus dados')
    await telaSemProblema(page)
  })

  test('segunda pessoa: o aluno seguinte no mesmo computador vê os pedidos dele, e nunca o arquivo do anterior', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    const { coordenadora, aluno: primeiro } = await montarEscola()
    const segundo = await criarAlunoComMatricula({ escola: coordenadora })
    await colocarAlunoNaTurma(segundo)
    const pedidoId = await criarPedidoDoTitularNoBanco({
      escolaId: coordenadora.escolaId,
      titularId: primeiro.usuarioId,
      registradoPor: coordenadora.usuarioId,
      tipo: 'portabilidade',
      estado: 'pronto',
      chegouHaDias: 2,
    })
    await criarArquivoDoTitularNoBanco(coordenadora.escolaId, pedidoId)
    await entrarComoAluno(page, primeiro, hasTouch)
    await abrirPrivacidadeDoAluno(page, hasTouch)
    await expect(pedidosDaTela(page, 'Cópia para levar a outro serviço')).toContainText('Pronto para baixar', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(botaoDeBaixar(page)).toBeVisible()
    await sair(page, hasTouch)

    // O segundo entra na mesma aba, sem recarregar, e com a leitura segurada: é aí que o pedido do anterior apareceria,
    // se tivesse ficado no cache.
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(LEITURA_DE_MEUS_DADOS, async (rota: Route) => {
      await segurada
      await rota.continue()
    })
    await page.evaluate((slug) => {
      window.history.pushState(null, '', `/e/${slug}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, segundo.slug)
    await page.getByLabel('Matrícula').fill(segundo.matricula)
    await page.getByLabel('Senha').fill(segundo.senha)
    await acionar(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await expect(page).toHaveURL(/\/aluno\/inicio$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await irAPrivacidadeDoAluno(page, hasTouch)
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando os seus pedidos…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText('Cópia para levar a outro serviço')
    await expect(page.locator('body')).not.toContainText(primeiro.nome)
    liberar()
    await expect(principal(page).getByText('Nenhum pedido ainda', { exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(botaoDeBaixar(page)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('Pronto para baixar')
    await expect(page.locator('body')).not.toContainText('Cópia para levar a outro serviço')
    await expect(page.locator('body')).not.toContainText(primeiro.nome)
  })
})

const INDISPONIVEL = JSON.stringify({
  erro: {
    codigo: 'INDISPONIVEL_TENTE_DE_NOVO',
    mensagem: 'texto que a tela não usa',
    requisicaoId: '0190f5a0-0000-7000-8000-000000000001',
  },
})

/**
 * Conta só o que já saiu: uma requisição que não existe na API, feita pela própria página. As requisições chegam ao teste
 * em ordem, então, quando a desta passa, toda leitura que a página mandou antes dela já foi contada.
 */
async function esperarOQueJaSaiu(page: Page): Promise<void> {
  const chegou = page.waitForRequest((pedido) => new URL(pedido.url()).pathname === '/barreira-do-teste')
  await page.evaluate(() => fetch('/barreira-do-teste').then(() => undefined, () => undefined))
  await chegou
}
