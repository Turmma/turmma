import type { Browser, BrowserContext, BrowserContextOptions, Locator, Page, Request } from '@playwright/test'
import {
  abrirNavegacao,
  entrarComoAlunoNaPrimeiraVez,
  esperarInicioDoAluno,
  esperarIntroducaoDoAluno,
  FALAS_DA_INTRODUCAO_DO_ALUNO,
  falaDoPasso,
  lateral,
  SIGN_IN_TIMEOUT_MS,
  seguirAteOFimDaIntroducao,
} from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { criarAlunoComMatricula, criarEscolaSintetica } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * A introdução do aluno (telas do aluno e primeiro acesso, 9.0; RF11 a RF14, RF16 a RF18, RF20; mockup 2.8): na primeira entrada
 * o aluno cai nela, passa por quatro passos e vai ao Início; a segunda entrada, em outro computador, vai direto ao Início. Sair
 * ou fechar a aba no meio não grava, a gravação que falha não prende ninguém, rever fecha em todo passo sem mudar a data, e o
 * aluno seguinte no mesmo computador vê a introdução dele. O texto, os estados e as ramificações estão em
 * `textos-da-introducao.test.ts` e `BemVindo.test.tsx`; aqui está o que o navegador faz.
 *
 * Todo aluno dos casos nasce `introducao: 'por_ver'` (a fixture de hoje o cria com a introdução vista).
 */

const CHAVE_DA_LETRA = 'educa.letra'

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  await (hasTouch ? alvo.tap() : alvo.click())
}

const continuar = (page: Page) => page.getByRole('button', { name: 'Continuar', exact: true })
const guardadoNoNavegador = (page: Page) => page.evaluate(() => JSON.stringify([...Object.entries(localStorage), ...Object.entries(sessionStorage)]))
const letraDaPagina = (page: Page) =>
  page.evaluate(() => ({ atributo: document.documentElement.getAttribute('data-letra'), fonte: getComputedStyle(document.documentElement).fontSize }))

/** Os pedidos de gravação da introdução que a página fez, desde que foi chamada. */
function contarGravacoes(page: Page): Request[] {
  const feitos: Request[] = []
  page.on('request', (pedido) => {
    if (pedido.method() === 'POST' && new URL(pedido.url()).pathname === '/v1/eu/introducao') feitos.push(pedido)
  })
  return feitos
}

/** Outro computador: um contexto novo, com as opções do projeto, sem nada do navegador anterior. */
const contextos: BrowserContext[] = []
async function outroComputador(browser: Browser): Promise<Page> {
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

/**
 * Entra pela API (`POST /v1/sessao/matricula`) no contexto da página e abre o endereço dado (a raiz, por padrão): o cookie fica
 * no contexto e a aplicação restaura a sessão a partir dele. É o atalho do caso que prova outra coisa que a entrada: com o argon2
 * e a CPU ×4, dois logins pela tela não cabem nos 15 s que o portão cobra de um caso novo.
 */
async function entrarPelaApi(page: Page, aluno: { readonly slug: string; readonly matricula: string; readonly senha: string }, endereco = '/'): Promise<void> {
  const resposta = await page.context().request.post('/v1/sessao/matricula', { data: { slug: aluno.slug, matricula: aluno.matricula, senha: aluno.senha } })
  expect(resposta.ok(), 'entrada do aluno pela API').toBe(true)
  await page.goto(endereco)
}

test.describe('a introdução do aluno', () => {
  test('na primeira entrada cai na introdução, passa pelos quatro passos e vai ao Início; a segunda entrada, em outro computador, vai direto ao Início', async ({ page, browser, hasTouch }) => {
    const aluno = await criarAlunoComMatricula({ introducao: 'por_ver' })
    await entrarComoAlunoNaPrimeiraVez(page, aluno, hasTouch)

    // Os três primeiros passos são avisos: sem "Pular" nem "Fechar", e o Esc não sai.
    await expect(falaDoPasso(page, 1)).toBeVisible()
    await expect(page.getByRole('button', { name: /^(Pular|Fechar)$/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(falaDoPasso(page, 1)).toBeVisible()
    await expect(page).toHaveURL(/\/aluno\/bem-vindo$/)
    await seguirAteOFimDaIntroducao(page, hasTouch)
    await esperarInicioDoAluno(page, aluno.nome)

    // Nada da introdução fica no navegador: a data mora no servidor.
    expect(await guardadoNoNavegador(page)).toBe('[]')

    // Outro computador, nenhuma marca no armazenamento: a pessoa não vê a introdução de novo.
    const outro = await outroComputador(browser)
    await entrarPelaApi(outro, aluno)
    await esperarInicioDoAluno(outro, aluno.nome)
    expect(await guardadoNoNavegador(outro)).toBe('[]')
  })

  test('passo 4: pular sem escolher a letra deixa o armazenamento vazio', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula({ introducao: 'por_ver' })
    await entrarComoAlunoNaPrimeiraVez(page, aluno, hasTouch)
    for (let passo = 1; passo < FALAS_DA_INTRODUCAO_DO_ALUNO.length; passo++) {
      await expect(falaDoPasso(page, passo)).toBeVisible()
      await activate(continuar(page), hasTouch)
    }
    await expect(falaDoPasso(page, 4)).toBeVisible()
    expect(await guardadoNoNavegador(page)).toBe('[]')
    expect(await letraDaPagina(page)).toEqual({ atributo: null, fonte: '16px' })
    // "Pular" tem o mesmo tamanho que "Continuar" (RF16, D59).
    const [caixaContinuar, caixaPular] = await Promise.all([continuar(page).boundingBox(), page.getByRole('button', { name: 'Pular', exact: true }).boundingBox()])
    expect(caixaPular?.height).toBe(caixaContinuar?.height)
    expect(caixaPular?.width).toBe(caixaContinuar?.width)

    await activate(page.getByRole('button', { name: 'Pular', exact: true }), hasTouch)
    await esperarInicioDoAluno(page, aluno.nome)
    expect(await guardadoNoNavegador(page)).toBe('[]')
  })

  test('passo 4: escolher "Maior" aplica na hora e guarda; a 360 px a página não rola de lado e "Continuar" e "Pular" estão ao alcance, com 44 px', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    const aluno = await criarAlunoComMatricula({ introducao: 'por_ver' })
    await entrarComoAlunoNaPrimeiraVez(page, aluno, hasTouch)
    for (let passo = 1; passo < FALAS_DA_INTRODUCAO_DO_ALUNO.length; passo++) await activate(continuar(page), hasTouch)
    await expect(falaDoPasso(page, 4)).toBeVisible()

    await activate(page.getByRole('radio', { name: 'Maior', exact: true }).locator('xpath=ancestor::label[1]'), hasTouch)
    await expect.poll(() => letraDaPagina(page)).toEqual({ atributo: 'maior', fonte: '20px' })
    expect(await guardadoNoNavegador(page)).toBe(JSON.stringify([[CHAVE_DA_LETRA, 'maior']]))

    expect(await horizontalOverflow(page)).toBe(0)
    for (const nome of ['Continuar', 'Pular']) {
      const alvo = page.getByRole('button', { name: nome, exact: true })
      await alvo.scrollIntoViewIfNeeded()
      await expect(alvo, nome).toBeInViewport()
      const caixa = await alvo.boundingBox()
      expect(caixa?.height, nome).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect(caixa?.width, nome).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    }
    await activate(continuar(page), hasTouch)
    await esperarInicioDoAluno(page, aluno.nome)
    // A letra escolhida fica na área do aluno e a chave é a única coisa que o navegador guarda.
    await expect.poll(() => letraDaPagina(page)).toEqual({ atributo: 'maior', fonte: '20px' })
    expect(await guardadoNoNavegador(page)).toBe(JSON.stringify([[CHAVE_DA_LETRA, 'maior']]))
  })

  test('a 360 px, em cada passo, a página não rola de lado, os botões têm 44 px e o aviso de privacidade não tem violação grave', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    const aluno = await criarAlunoComMatricula({ introducao: 'por_ver' })
    await entrarComoAlunoNaPrimeiraVez(page, aluno, hasTouch)

    for (let passo = 1; passo <= FALAS_DA_INTRODUCAO_DO_ALUNO.length; passo++) {
      await expect(falaDoPasso(page, passo), `passo ${String(passo)}`).toBeVisible()
      expect(await horizontalOverflow(page), `passo ${String(passo)}`).toBe(0)
      const caixa = await continuar(page).boundingBox()
      expect(caixa?.height, `passo ${String(passo)}`).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      if (passo === 3) expect(await seriousViolations(page)).toEqual([])
      if (passo < FALAS_DA_INTRODUCAO_DO_ALUNO.length) await activate(continuar(page), hasTouch)
    }
  })

  test('fechar a aba no meio não grava: a introdução volta do começo na aba seguinte', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula({ introducao: 'por_ver' })
    await entrarComoAlunoNaPrimeiraVez(page, aluno, hasTouch)
    // Ligado antes do primeiro "Continuar": a asserção cobre o caminho todo, e não só o que sairia ao descarregar a aba.
    const gravacoes = contarGravacoes(page)
    await activate(continuar(page), hasTouch)
    await expect(falaDoPasso(page, 2)).toBeVisible()
    const contexto = page.context()
    await page.close()
    expect(gravacoes).toHaveLength(0)

    // O cookie de renovação fica no contexto: a aba nova restaura a sessão, e a pessoa que não terminou recomeça.
    const nova = await contexto.newPage()
    await nova.goto('/')
    await esperarIntroducaoDoAluno(nova)
  })

  test('"Sair" no meio não grava: a pessoa vai à entrada e nenhuma gravação sai', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula({ introducao: 'por_ver' })
    await entrarComoAlunoNaPrimeiraVez(page, aluno, hasTouch)
    const gravacoes = contarGravacoes(page)
    await activate(continuar(page), hasTouch)
    await expect(falaDoPasso(page, 2)).toBeVisible()
    await activate(page.getByRole('button', { name: 'Sair', exact: true }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    expect(gravacoes).toHaveLength(0)
  })

  test('a gravação que falha não prende ninguém: a pessoa chega ao Início do mesmo jeito', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula({ introducao: 'por_ver' })
    await entrarPelaApi(page, aluno)
    await esperarIntroducaoDoAluno(page)
    const gravacoes = contarGravacoes(page)
    await page.route('**/v1/eu/introducao', (rota) => rota.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }) }))
    await seguirAteOFimDaIntroducao(page, hasTouch)

    // A pessoa segue ao Início assim mesmo. Que a introdução volta na entrada seguinte, com a data ainda nula no servidor e no
    // cache, está em `BemVindo.test.tsx`; que uma aba nova sem gravação recomeça, no caso de fechar a aba, acima.
    await expect(page).toHaveURL(/\/aluno\/inicio$/, { timeout: SIGN_IN_TIMEOUT_MS })
    expect(gravacoes.length).toBeGreaterThan(0)
  })

  // A trava do segundo clique está provada em `BemVindo.test.tsx` (a gravação fica no ar, e o segundo clique chega a tempo de gravar
  // de novo, se a trava faltar). Aqui, no navegador, a navegação pode engolir o segundo clique sozinha: este caso prova só que o
  // gesto inteiro termina com uma gravação e a pessoa no Início.
  test('dois cliques seguidos no último "Continuar" fazem uma gravação só', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula({ introducao: 'por_ver' })
    await entrarComoAlunoNaPrimeiraVez(page, aluno, hasTouch)
    const gravacoes = contarGravacoes(page)
    for (let passo = 1; passo < FALAS_DA_INTRODUCAO_DO_ALUNO.length; passo++) await activate(continuar(page), hasTouch)
    await expect(falaDoPasso(page, 4)).toBeVisible()

    await continuar(page).dblclick()
    await expect(page).toHaveURL(/\/aluno\//)
    await expect(page).not.toHaveURL(/bem-vindo/)
    await expect.poll(() => gravacoes.length).toBe(1)
    // Um quadro de folga para o segundo clique, se ele existisse, chegar.
    await page.evaluate(() => new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(resolver))))
    expect(gravacoes).toHaveLength(1)
  })

  test('rever pela linha de Eu: "Fechar" no passo 1 volta a Eu, nada é gravado e a data não muda', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    const gravacoes = contarGravacoes(page)
    const euLido = () => page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/eu' && resposta.request().method() === 'GET')
    const dataDe = async (lida: ReturnType<typeof euLido>) => ((await (await lida).json()) as { introducaoVistaEm: string | null }).introducaoVistaEm
    const primeiraLeitura = euLido()
    await entrarPelaApi(page, aluno, '/aluno/eu')
    const antes = await dataDe(primeiraLeitura)
    expect(antes).not.toBeNull()

    await activate(page.getByRole('main').getByRole('link', { name: 'Rever a introdução' }), hasTouch)
    await esperarIntroducaoDoAluno(page)
    // O passo 1 é obrigatório na primeira vez: revendo, é ele que mostra que "Fechar" existe e que "Pular" não. Que todo passo
    // tem "Fechar" está em `BemVindo.test.tsx`.
    await expect(falaDoPasso(page, 1)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pular', exact: true })).toHaveCount(0)
    await activate(page.getByRole('button', { name: 'Fechar', exact: true }), hasTouch)
    await expect(page).toHaveURL(/\/aluno\/eu$/)
    expect(gravacoes).toHaveLength(0)

    const segundaLeitura = euLido()
    await page.reload()
    expect(await dataDe(segundaLeitura)).toBe(antes)
  })

  test('a linha "Rever a introdução" de Eu cabe inteira a 360 px, sem reticências', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    const aluno = await criarAlunoComMatricula()
    await entrarPelaApi(page, aluno, '/aluno/eu')

    const titulo = page.getByRole('main').getByRole('link', { name: 'Rever a introdução' }).locator('[title="Rever a introdução"]')
    await expect(titulo).toBeVisible()
    const corte = await titulo.evaluate((elemento) => ({ aLargura: elemento.scrollWidth - elemento.clientWidth, aAltura: elemento.scrollHeight - elemento.clientHeight }))
    expect(corte).toEqual({ aLargura: 0, aAltura: 0 })
  })

  test('o aluno seguinte no mesmo computador vê a introdução dele, do passo 1: nada do cache do aluno de antes sobra', async ({ page, hasTouch }) => {
    const escola = await criarEscolaSintetica()
    // O primeiro já viu a introdução (o `/v1/eu` dele, com a data, fica no cache da aba); o segundo ainda não.
    const primeiro = await criarAlunoComMatricula({ escola, matricula: '1001' })
    const segundo = await criarAlunoComMatricula({ escola, matricula: '1002', introducao: 'por_ver' })
    await entrarPelaApi(page, primeiro)
    await expect(page).toHaveURL(/\/aluno\/inicio$/, { timeout: SIGN_IN_TIMEOUT_MS })

    await abrirNavegacao(page, hasTouch)
    await activate(lateral(page).getByRole('button', { name: 'Sair' }).and(page.locator(':not(main *)')), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })

    // Sem recarregar a página: a aplicação é a mesma, com o que o primeiro deixou na memória dela, e o segundo entra pela tela.
    await page.evaluate((endereco) => {
      window.history.pushState({}, '', endereco)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, `/e/${segundo.slug}`)
    await page.getByLabel('Matrícula').fill(segundo.matricula)
    await page.getByLabel('Senha').fill(segundo.senha)
    await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await esperarIntroducaoDoAluno(page)
  })
})
