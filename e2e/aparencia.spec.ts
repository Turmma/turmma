import type { Locator, Page } from '@playwright/test'
import { openGallery, activate, caixa } from './support/gallery.ts'
import { abrirNavegacao, entrarComoAluno, entrarComoCoordenacaoNaMesmaAba, entrarComoProfessora, entrarPorEmail, lateral, naGaveta, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { criarOperadorComSegundoFator, removerOperador, type OperadorDeTeste } from './support/operacao.ts'
import { expect, test } from './support/profiles.ts'
import { colocarAlunoNaTurma, criarAlunoComMatricula, criarEquipeComSenha } from './support/seed.ts'
import { entrarNaOperacao } from './support/operacao-screen.ts'
import { horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * A aparência da pessoa (X1, tarefa 2.0; RF3, RF4 e RF24; Tech Spec, seções 5 e 7): Sistema, Claro ou Escuro, no menu da
 * conta, valendo antes de a primeira tela desenhar. O que a escolha **muda** (as cores de cada peça) é do
 * `tokens.spec.ts` e das peças; aqui está o que a escolha **faz**: o `data-tema` do `<html>`, o que o navegador guarda e
 * quando ele guarda. A galeria (`/galeria`) tem a `Aparencia` no topo e não precisa de sessão.
 *
 * `playwright.config.ts` fixa `colorScheme: 'light'` (o aparelho de cada teste é claro, e o escuro vem de `emulateMedia` ou
 * da escolha), e nenhum projeto semeia `educa.aparencia`: o armazenamento começa vazio.
 */

/** O chão do tema escuro, `fundo` do escuro (`#131f24`), como o navegador o devolve. */
const FUNDO_DO_ESCURO = 'rgb(19, 31, 36)'
/** O chão do tema claro, `fundo` (`#ffffff`). */
const FUNDO_DO_CLARO = 'rgb(255, 255, 255)'

const temaDaPagina = (page: Page) => page.evaluate(() => document.documentElement.dataset['tema'] ?? null)
const esquemaDeCor = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
const guardadoNoNavegador = (page: Page) => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))

type Opcao = 'Sistema' | 'Claro' | 'Escuro'

/** A opção do grupo "Aparência" que está dentro de `dentro`: a página, a gaveta ou a faixa. */
const opcaoDaAparencia = (dentro: Locator, nome: Opcao) => dentro.getByRole('radiogroup', { name: 'Aparência' }).getByRole('radio', { name: nome, exact: true })

/** Escolhe pelo menu da conta da casca da escola, abrindo a gaveta antes quando a casca está nela. */
async function escolherNaCasca(page: Page, hasTouch: boolean, nome: Opcao): Promise<void> {
  await abrirNavegacao(page, hasTouch)
  await activate(opcaoDaAparencia(lateral(page), nome), hasTouch)
}

/** A tela de entrada, onde `Sair` termina: a pessoa seguinte começa dali. */
async function sair(page: Page, hasTouch: boolean): Promise<void> {
  await activate(lateral(page).getByRole('button', { name: 'Sair' }), hasTouch)
  await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
}

test.describe('aparência: Sistema, Claro e Escuro', () => {
  test('RF3: a escolha vale no primeiro quadro, antes de o React montar: o data-tema e o chão já são os do escuro', async ({ page, hasTouch }) => {
    await openGallery(page)
    await activate(opcaoDaAparencia(page.locator('body'), 'Escuro'), hasTouch)
    await expect.poll(() => temaDaPagina(page)).toBe('escuro')
    expect(await guardadoNoNavegador(page)).toEqual({ 'educa.aparencia': 'escuro' })

    // O pacote da entrada fica preso: nenhuma linha do React roda, e o que se vê é só o que o HTML e o CSS fizeram.
    let soltar: () => void = () => undefined
    const preso = new Promise<void>((resolver) => {
      soltar = resolver
    })
    await page.route('**/assets/index-*.js', async (rota) => {
      await preso
      await rota.continue()
    })
    try {
      await page.reload({ waitUntil: 'commit' })
      await page.waitForFunction(() => document.documentElement.hasAttribute('data-tema'))
      expect(await page.evaluate(() => document.getElementById('raiz')?.childElementCount)).toBe(0)
      expect(await temaDaPagina(page)).toBe('escuro')
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(FUNDO_DO_ESCURO)
      expect(await esquemaDeCor(page)).toBe('dark')
    } finally {
      soltar()
    }
    await expect(opcaoDaAparencia(page.locator('body'), 'Escuro')).toHaveAttribute('aria-checked', 'true', { timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('RF3: em Sistema a página aberta acompanha o aparelho; com Claro escolhido, não, e o documento continua claro', async ({ page, hasTouch }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await openGallery(page)
    await expect(opcaoDaAparencia(page.locator('body'), 'Sistema')).toHaveAttribute('aria-checked', 'true')
    expect(await temaDaPagina(page)).toBe('claro')
    // Sem escolha, nada foi gravado: ver a página não é escolher.
    expect(await guardadoNoNavegador(page)).toEqual({})

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => temaDaPagina(page)).toBe('escuro')
    expect(await esquemaDeCor(page)).toBe('dark')
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(FUNDO_DO_ESCURO)
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => temaDaPagina(page)).toBe('claro')

    // Claro escolhido com o aparelho no escuro: a escolha vence, e o navegador (barra de rolagem, controles) também fica claro.
    await activate(opcaoDaAparencia(page.locator('body'), 'Claro'), hasTouch)
    await page.emulateMedia({ colorScheme: 'dark' })
    // Dois quadros: a mudança do aparelho já foi entregue.
    await page.evaluate(() => new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver(null)))))
    expect(await temaDaPagina(page)).toBe('claro')
    expect(await esquemaDeCor(page)).toBe('light')
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(FUNDO_DO_CLARO)
  })

  test('RF3 e RF24: voltar a Sistema apaga a chave, e o armazenamento volta a nada', async ({ page, hasTouch }) => {
    await openGallery(page)
    expect(await guardadoNoNavegador(page)).toEqual({})

    await activate(opcaoDaAparencia(page.locator('body'), 'Escuro'), hasTouch)
    expect(await guardadoNoNavegador(page)).toEqual({ 'educa.aparencia': 'escuro' })
    await activate(opcaoDaAparencia(page.locator('body'), 'Claro'), hasTouch)
    expect(await guardadoNoNavegador(page)).toEqual({ 'educa.aparencia': 'claro' })

    await activate(opcaoDaAparencia(page.locator('body'), 'Sistema'), hasTouch)
    expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).toBe('[]')
    expect(await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)))).toBe('[]')
  })

  test('duas abas do mesmo navegador: a escolha feita numa chega à outra, que está em Sistema', async ({ page, hasTouch }) => {
    await openGallery(page)
    const outra = await page.context().newPage()
    try {
      await outra.goto('/galeria')
      await expect(outra.getByRole('heading', { level: 1, name: 'Galeria de peças' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
      expect(await temaDaPagina(outra)).toBe('claro')

      await activate(opcaoDaAparencia(page.locator('body'), 'Escuro'), hasTouch)
      await expect.poll(() => temaDaPagina(outra)).toBe('escuro')
      await expect(opcaoDaAparencia(outra.locator('body'), 'Escuro')).toHaveAttribute('aria-checked', 'true')

      // E a volta a Sistema, que apaga a chave, também chega.
      await activate(opcaoDaAparencia(page.locator('body'), 'Sistema'), hasTouch)
      await expect.poll(() => temaDaPagina(outra)).toBe('claro')
      await expect(opcaoDaAparencia(outra.locator('body'), 'Sistema')).toHaveAttribute('aria-checked', 'true')
    } finally {
      await outra.close()
    }
  })

  test('alvo de toque: cada opção da Aparência tem 44 px de altura no toque e 36 px no computador, e o grupo cabe na tela', async ({ page, hasTouch }) => {
    await openGallery(page)
    const opcoes = page.getByRole('radiogroup', { name: 'Aparência' }).getByRole('radio')
    await expect(opcoes).toHaveCount(3)
    for (const opcao of await opcoes.all()) {
      const medida = await caixa(opcao)
      expect(medida.height).toBeGreaterThanOrEqual(hasTouch ? 44 : 36)
      expect(medida.x + medida.width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0)
    }
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('RF24: duas pessoas no mesmo computador: o navegador guarda só a aparência, a lateral recolhida e a letra do aluno, a segunda pessoa herda as três e nada mais, e entra na largura do projeto', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    const primeira = await entrarComoProfessora(page, hasTouch)
    const larguraDoProjeto = page.viewportSize()
    // Abaixo de 1024 px não há lateral para recolher: no celular, este passo é na largura do computador, e só ele.
    await page.setViewportSize({ width: 1024, height: 768 })
    await escolherNaCasca(page, hasTouch, 'Escuro')
    expect(await temaDaPagina(page)).toBe('escuro')
    await activate(page.getByRole('button', { name: 'Recolher a lateral' }), hasTouch)
    await expect(page.getByRole('button', { name: 'Abrir a lateral' })).toBeVisible()
    // A terceira chave da lista fechada (telas do aluno, 8.0): quem a escolhe é o aluno, em Eu › Ajustes (`tamanho-da-letra.spec.ts`);
    // aqui ela é posta à mão, para provar que fica na lista e que a professora que entra depois não a aplica.
    await page.evaluate(() => window.localStorage.setItem('educa.letra', 'maior'))
    await sair(page, hasTouch)

    // Quem sai não leva nem deixa nada além dessas três chaves, e o tema continua o do computador.
    expect(await guardadoNoNavegador(page)).toEqual({ 'educa.aparencia': 'escuro', 'educa.lateral-recolhida': 'sim', 'educa.letra': 'maior' })
    expect(await temaDaPagina(page)).toBe('escuro')

    // A segunda pessoa chega na tela do projeto: no celular, a 360 px, onde a lateral é a gaveta.
    if (larguraDoProjeto !== null) await page.setViewportSize(larguraDoProjeto)
    const segunda = await criarEquipeComSenha()
    await entrarPorEmail(page, segunda, hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByText(/^(Bom dia|Boa tarde|Boa noite), /)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const depois = await page.evaluate(() => ({ local: Object.fromEntries(Object.entries(localStorage)), sessao: Object.fromEntries(Object.entries(sessionStorage)) }))
    // Nenhuma chave nem valor leva pessoa, escola ou papel; o `sessionStorage` não tem nada.
    expect(depois.local).toEqual({ 'educa.aparencia': 'escuro', 'educa.lateral-recolhida': 'sim', 'educa.letra': 'maior' })
    expect(depois.sessao).toEqual({})
    expect(await temaDaPagina(page)).toBe('escuro')
    // A letra é do aluno: a professora herda a chave, mas não a letra.
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-letra'))).toBeNull()

    // Na mesma aba, é a segunda pessoa que está na tela: nada da primeira ficou no cache (regra 20, itens 4 e 5).
    if (naGaveta(page)) await abrirNavegacao(page, hasTouch)
    else await activate(page.getByRole('button', { name: 'Abrir a lateral' }), hasTouch)
    await expect(page.locator('body')).toContainText(segunda.nome, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(primeira.nome)
  })
})

test.describe('aparência em cada área', () => {
  test('o professor acha a Aparência em "Sua conta", antes do "Sair", e a escolha vale na hora', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    await entrarComoProfessora(page, hasTouch)
    // Abaixo de 768 px a Aparência mora na gaveta: com ela fechada, a barra de cima é só o menu, a marca, a escola e o "Sair".
    if (naGaveta(page)) await expect(page.getByRole('radiogroup', { name: 'Aparência' })).toHaveCount(0)
    await abrirNavegacao(page, hasTouch)
    const conta = lateral(page).getByRole('navigation', { name: 'Sua conta', exact: true })
    const grupo = lateral(page).getByRole('radiogroup', { name: 'Aparência' })
    await expect(grupo).toBeVisible()
    // A conta (os links dela), depois a Aparência, depois o "Sair": o "Sair" é sempre o último (D59).
    const [daConta, daAparencia, doSair] = [await caixa(conta), await caixa(grupo), await caixa(lateral(page).getByRole('button', { name: 'Sair' }))]
    expect(daConta.y).toBeLessThan(daAparencia.y)
    expect(daAparencia.y).toBeLessThan(doSair.y)

    await escolherNaCasca(page, hasTouch, 'Escuro')
    expect(await temaDaPagina(page)).toBe('escuro')
    await expect(opcaoDaAparencia(lateral(page), 'Escuro')).toHaveAttribute('aria-checked', 'true')
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('a coordenação acha a Aparência no menu da conta, e a escolha vale', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await escolherNaCasca(page, hasTouch, 'Escuro')
    expect(await temaDaPagina(page)).toBe('escuro')
    await expect(opcaoDaAparencia(lateral(page), 'Escuro')).toHaveAttribute('aria-checked', 'true')
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('o aluno acha a Aparência no menu da conta, e a escolha vale', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    const aluno = await criarAlunoComMatricula({ escola: coordenadora })
    await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)
    await escolherNaCasca(page, hasTouch, 'Escuro')
    expect(await temaDaPagina(page)).toBe('escuro')
    await expect(opcaoDaAparencia(lateral(page), 'Escuro')).toHaveAttribute('aria-checked', 'true')
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('na operação, a Aparência fica na faixa de cima, ao lado do "Sair", sem passar da largura; as telas públicas seguem o sistema, sem controle', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    // As páginas de fora da sessão não têm o controle e seguem o aparelho.
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/operacao/entrar')
    await expect(page.getByRole('heading', { name: 'Entrar na operação' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('radiogroup', { name: 'Aparência' })).toHaveCount(0)
    expect(await temaDaPagina(page)).toBe('escuro')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => temaDaPagina(page)).toBe('claro')

    let operador: OperadorDeTeste | undefined
    try {
      operador = await criarOperadorComSegundoFator()
      await entrarNaOperacao(page, operador, hasTouch)
      const faixa = page.getByRole('banner')
      const grupo = faixa.getByRole('radiogroup', { name: 'Aparência' })
      await expect(grupo).toBeVisible()
      await expect(faixa.getByRole('button', { name: 'Sair' })).toBeVisible()
      expect(await horizontalOverflow(page)).toBe(0)

      await activate(opcaoDaAparencia(faixa, 'Escuro'), hasTouch)
      expect(await temaDaPagina(page)).toBe('escuro')
      await expect(opcaoDaAparencia(faixa, 'Escuro')).toHaveAttribute('aria-checked', 'true')
      expect(await horizontalOverflow(page)).toBe(0)
      expect(await seriousViolations(page)).toEqual([])
    } finally {
      if (operador !== undefined) await removerOperador(operador.operadorId)
    }
  })
})
