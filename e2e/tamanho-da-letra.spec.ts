import type { Locator, Page, Request } from '@playwright/test'
import { minhaAtividade, provaDa, simularAluno } from './support/aluno.ts'
import { abrirGaleria, secao } from './support/gallery.ts'
import { entrarComoAluno, entrarComoCoordenacaoNaMesmaAba, entrarComoProfessora, irPelaNavegacao, PRAZO_DA_ENTRADA_MS } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { colocarAlunoNaTurma, criarAlunoComMatricula, criarEquipeComSenha } from './support/seed.ts'
import { larguraExcedente, larguraExcedenteDoDialogo } from './support/checks.ts'

/**
 * O tamanho da letra do aluno (telas do aluno e primeiro acesso, 8.0; RF11, RF20; Tech Spec, seção 5): Padrão, Grande ou
 * Maior, em Eu › Ajustes. Aqui está o que a escolha **faz** no navegador: o `data-letra` e os px do `<html>` antes do
 * primeiro quadro, o que o navegador guarda e quando, o que nunca sai para a API, a área em que vale, o aluno seguinte no
 * mesmo computador e o 360 px com a letra Maior. O que a peça faz com o teclado e com um armazenamento que recusa está em
 * `TamanhoDaLetra.test.tsx` e `text-size.test.ts`.
 *
 * `playwright.config.ts` não semeia `educa.letra`: o armazenamento começa vazio, e os casos que precisam de uma escolha
 * anterior a escrevem antes de a página carregar (`addInitScript`).
 */

const PRAZO_DA_TELA_MS = 15_000
const CHAVE = 'educa.letra'
const TITULO_SEM_ESPACO = 'Exercícios_de_estequiometria_do_capítulo_três_parte_dois'

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  await (hasTouch ? alvo.tap() : alvo.click())
}

const principal = (page: Page) => page.getByRole('main')
const dialogo = (page: Page) => page.getByRole('dialog', { name: 'Ajustes' })
const linhaAjustes = (page: Page) => principal(page).getByRole('button', { name: 'Ajustes' })

/** O que o `<html>` diz agora: o atributo e o tamanho que o navegador calculou. */
const letraDaPagina = (page: Page) =>
  page.evaluate(() => ({ atributo: document.documentElement.getAttribute('data-letra'), fonte: getComputedStyle(document.documentElement).fontSize }))

const guardadoNoNavegador = (page: Page) => page.evaluate(() => JSON.stringify(Object.entries(localStorage)))

/** Guarda a letra antes de qualquer página carregar, como se uma pessoa a tivesse escolhido neste computador. */
async function guardarAntesDeCarregar(page: Page, valor: string): Promise<void> {
  await page.addInitScript(
    ([chave, escolha]) => {
      window.localStorage.setItem(chave ?? '', escolha ?? '')
    },
    [CHAVE, valor],
  )
}

/** Abre Eu pela navegação e o diálogo "Ajustes" pela linha. */
async function abrirAjustes(page: Page, hasTouch: boolean): Promise<void> {
  await irPelaNavegacao(page, 'Eu', hasTouch)
  await acionar(linhaAjustes(page), hasTouch)
  await expect(dialogo(page)).toBeVisible()
}

type Nome = 'Padrão' | 'Grande' | 'Maior'
/** O rádio, para conferir o estado: o `<input>` é escondido só da vista (`sr-only`), e o clique vai no rótulo que o cobre. */
const opcao = (page: Page, nome: Nome) => dialogo(page).getByRole('group', { name: 'Tamanho da letra' }).getByRole('radio', { name: nome, exact: true })
const rotuloDe = (page: Page, nome: Nome) => dialogo(page).getByRole('group', { name: 'Tamanho da letra' }).locator('label').filter({ has: page.getByRole('radio', { name: nome, exact: true }) })

/** O "Sair" da linha de Eu, que é o do aluno a um clique. */
async function sairPelaLinha(page: Page, hasTouch: boolean): Promise<void> {
  await acionar(principal(page).getByRole('button', { name: 'Sair' }), hasTouch)
  await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
}

test.describe('o tamanho da letra do aluno', () => {
  test('antes do primeiro quadro: com Maior guardado, o data-letra já está no DOMContentLoaded e a letra é 20 px; a entrada, sem sessão, não a herda', async ({ page }) => {
    await guardarAntesDeCarregar(page, 'maior')
    // O que a página tinha no `DOMContentLoaded`. Esse evento só dispara depois dos scripts de módulo, então aqui o `LetraDoAluno` do
    // React também já escreveria `maior`: quem prova que o script em linha sozinho o escreve antes de qualquer módulo é o
    // `text-size.test.ts › o <script> do index.html`. Este caso prova o que a pessoa vê: a letra já é 20 px quando a página termina de carregar.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        Object.assign(window, { __letraNoPrimeiroQuadro: { atributo: document.documentElement.getAttribute('data-letra'), fonte: getComputedStyle(document.documentElement).fontSize } })
      })
    })
    await page.goto('/aluno/inicio')
    // Sem sessão a área do aluno nunca monta e o endereço vira a entrada: a letra do primeiro quadro sai com ele.
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })

    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>)['__letraNoPrimeiroQuadro'])).toEqual({ atributo: 'maior', fonte: '20px' })
    await expect.poll(() => letraDaPagina(page)).toEqual({ atributo: null, fonte: '16px' })
  })

  test('só grava ao escolher: o login, Eu e o diálogo não escrevem; Maior vale na hora (20 px), Grande são 18 px e Padrão apaga a chave', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    await entrarComoAluno(page, aluno, hasTouch)
    expect(await guardadoNoNavegador(page)).toBe('[]')
    expect(await letraDaPagina(page)).toEqual({ atributo: null, fonte: '16px' })

    await abrirAjustes(page, hasTouch)
    expect(await guardadoNoNavegador(page)).toBe('[]')
    await expect(opcao(page, 'Padrão')).toBeChecked()
    await expect(dialogo(page).getByText('Assim fica a minha letra.')).toBeVisible()
    expect(await letraDaPagina(page)).toEqual({ atributo: null, fonte: '16px' })

    await acionar(rotuloDe(page, 'Maior'), hasTouch)
    await expect.poll(() => letraDaPagina(page)).toEqual({ atributo: 'maior', fonte: '20px' })
    expect(await guardadoNoNavegador(page)).toBe(JSON.stringify([[CHAVE, 'maior']]))

    await acionar(rotuloDe(page, 'Grande'), hasTouch)
    await expect.poll(() => letraDaPagina(page)).toEqual({ atributo: 'grande', fonte: '18px' })
    expect(await guardadoNoNavegador(page)).toBe(JSON.stringify([[CHAVE, 'grande']]))

    await acionar(rotuloDe(page, 'Padrão'), hasTouch)
    await expect.poll(() => letraDaPagina(page)).toEqual({ atributo: null, fonte: '16px' })
    expect(await guardadoNoNavegador(page)).toBe('[]')
  })

  test('a escolha não sai do navegador; o Esc fecha o diálogo devolvendo o foco à linha "Ajustes"; ao sair da área a letra volta ao normal e a chave fica', async ({ page, hasTouch }) => {
    const saidas: Request[] = []
    page.on('request', (pedido) => saidas.push(pedido))
    const aluno = await criarAlunoComMatricula()
    await entrarComoAluno(page, aluno, hasTouch)
    await abrirAjustes(page, hasTouch)
    const antes = saidas.length
    await acionar(rotuloDe(page, 'Maior'), hasTouch)
    await expect.poll(() => letraDaPagina(page)).toEqual({ atributo: 'maior', fonte: '20px' })

    await page.keyboard.press('Escape')
    await expect(dialogo(page)).toBeHidden()
    await expect(linhaAjustes(page)).toBeFocused()

    // Ao sair do /aluno o atributo sai; a escolha fica, porque é do computador.
    await sairPelaLinha(page, hasTouch)
    expect(await letraDaPagina(page)).toEqual({ atributo: null, fonte: '16px' })
    expect(await guardadoNoNavegador(page)).toBe(JSON.stringify([[CHAVE, 'maior']]))

    // Tudo o que a página mandou à API, antes e depois da escolha: nem a chave nem o valor, em endereço, cabeçalho ou corpo.
    const daApi = saidas.filter((pedido) => new URL(pedido.url()).pathname.startsWith('/v1/'))
    expect(saidas.slice(antes).filter((pedido) => new URL(pedido.url()).pathname.startsWith('/v1/')).length, 'a saída chamou a API depois da escolha: sem pedido, a prova abaixo não olhou nada').toBeGreaterThan(0)
    for (const pedido of daApi) {
      // `allHeaders()` traz também `cookie` e `authorization`, que `headers()` esconde: um `document.cookie = 'educa.letra=maior'` é o
      // caminho mais provável de uma preferência local chegar ao servidor. Os dois são da sessão e podem existir; o que não podem
      // é carregar a chave nem o valor da escolha.
      const cabecalhos = await pedido.allHeaders()
      for (const nome of ['cookie', 'authorization']) {
        const valor = cabecalhos[nome] ?? ''
        expect(valor, `${nome} de ${pedido.url()}`).not.toContain(CHAVE)
        expect(valor, `${nome} de ${pedido.url()}`).not.toMatch(/letra=|=maior|=grande/i)
      }
      const demais = Object.entries(cabecalhos).filter(([nome]) => !['cookie', 'authorization'].includes(nome))
      const tudo = JSON.stringify({ url: pedido.url(), cabecalhos: demais, corpo: pedido.postData() })
      expect(tudo, pedido.url()).not.toContain(CHAVE)
      expect(tudo, pedido.url()).not.toMatch(/maior/i)
    }
  })

  test('o aluno seguinte no mesmo computador herda a letra do anterior, e o navegador guarda só essa chave: nada do primeiro aparece', async ({ page, hasTouch }) => {
    // A escolha que o aluno de antes deixou (a escolha e a saída dele são do caso acima): o computador a guarda sem saber de quem é.
    await guardarAntesDeCarregar(page, 'maior')
    const segundo = await criarAlunoComMatricula()
    await entrarComoAluno(page, segundo, hasTouch)
    await expect.poll(() => letraDaPagina(page)).toEqual({ atributo: 'maior', fonte: '20px' })
    const depois = await page.evaluate(() => ({ local: JSON.stringify(Object.entries(localStorage)), sessao: JSON.stringify(Object.entries(sessionStorage)) }))
    expect(depois).toEqual({ local: JSON.stringify([[CHAVE, 'maior']]), sessao: '[]' })
    await abrirAjustes(page, hasTouch)
    await expect(opcao(page, 'Maior')).toBeChecked()
  })

  test('duas abas do mesmo navegador: a escolha feita numa chega à outra, e a última vence', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    const outra = await page.context().newPage()
    try {
      await outra.goto('/galeria')
      await expect(outra.getByRole('heading', { level: 1, name: 'Galeria de peças' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
      const daGaleria = (aba: Page, nome: Nome) => secao(aba, 'tamanho-da-letra').getByRole('radio', { name: nome, exact: true })
      const rotuloDaGaleria = (aba: Page, nome: Nome) => secao(aba, 'tamanho-da-letra').locator('label').filter({ has: aba.getByRole('radio', { name: nome, exact: true }) })
      await expect(daGaleria(outra, 'Padrão')).toBeChecked()

      await acionar(rotuloDaGaleria(page, 'Maior'), hasTouch)
      await expect(daGaleria(outra, 'Maior')).toBeChecked()
      // A outra aba escolhe depois: a última vence, e a primeira acompanha.
      await acionar(rotuloDaGaleria(outra, 'Grande'), hasTouch)
      await expect(daGaleria(page, 'Grande')).toBeChecked()
      // Padrão apaga a chave nas duas.
      await acionar(rotuloDaGaleria(page, 'Padrão'), hasTouch)
      await expect(daGaleria(outra, 'Padrão')).toBeChecked()
      expect(await guardadoNoNavegador(outra)).toBe('[]')
    } finally {
      await outra.close()
    }
  })

  test('a letra é só do aluno: com Maior guardado, a professora abre com a letra de sempre', async ({ page, hasTouch }) => {
    await guardarAntesDeCarregar(page, 'maior')
    await entrarComoProfessora(page, hasTouch)
    expect(await letraDaPagina(page)).toEqual({ atributo: null, fonte: '16px' })
    expect(await guardadoNoNavegador(page)).toBe(JSON.stringify([[CHAVE, 'maior']]))
  })

  test('a letra é só do aluno: com Maior guardado, a coordenação abre com a letra de sempre', async ({ page, hasTouch }) => {
    test.slow()
    await guardarAntesDeCarregar(page, 'maior')
    const coordenadora = await criarEquipeComSenha('coordenador')
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    expect(await letraDaPagina(page)).toEqual({ atributo: null, fonte: '16px' })
  })

  test('a 360 px com Maior: Início, Tarefas, Eu, o diálogo e a tarefa aberta não rolam de lado', async ({ page, hasTouch }) => {
    test.slow()
    await page.setViewportSize({ width: 360, height: 640 })
    await guardarAntesDeCarregar(page, 'maior')
    const api = await simularAluno(page)
    const atividade = minhaAtividade({ titulo: TITULO_SEM_ESPACO, situacao: 'em_andamento', respondidas: 1 })
    api.atividades = [atividade, minhaAtividade({ titulo: 'Lista de mol com um título bem comprido para quebrar' })]
    api.provas.set(atividade.id, provaDa(atividade, { respostas: [{ questao: 1, alternativa: 1, sequencia: 1 }] }))
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)

    const semRolagem = async (onde: string) => {
      expect(await letraDaPagina(page), onde).toEqual({ atributo: 'maior', fonte: '20px' })
      expect(await larguraExcedente(page), onde).toBe(0)
    }
    await expect(principal(page).getByText(TITULO_SEM_ESPACO)).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await semRolagem('Início')

    await irPelaNavegacao(page, 'Tarefas', hasTouch)
    await expect(principal(page).getByRole('heading', { level: 1, name: 'Tarefas' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await semRolagem('Tarefas')

    await irPelaNavegacao(page, 'Eu', hasTouch)
    await expect(linhaAjustes(page)).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await semRolagem('Eu')

    await acionar(linhaAjustes(page), hasTouch)
    await expect(dialogo(page)).toBeVisible()
    await semRolagem('o diálogo')
    expect(await larguraExcedenteDoDialogo(page), 'o diálogo').toBe(0)
    await expect(opcao(page, 'Maior')).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(dialogo(page)).toBeHidden()

    await page.evaluate((destino) => {
      window.history.pushState(null, '', destino)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, `/aluno/atividades/${atividade.id}`)
    await expect(principal(page)).toContainText('Questão 1 de 3', { timeout: PRAZO_DA_TELA_MS })
    await semRolagem('a tarefa aberta')
  })

  test('o enunciado da tarefa aberta acompanha a letra: 17 px no Padrão e 21,25 px com Maior escolhida no diálogo, com a tarefa aberta pelo endereço', async ({ page, hasTouch }) => {
    const atividade = minhaAtividade({ situacao: 'em_andamento', respondidas: 0 })
    const api = await simularAluno(page)
    api.atividades = [atividade]
    api.provas.set(atividade.id, provaDa(atividade))
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)

    const enunciado = principal(page).getByRole('heading', { level: 2 }).filter({ hasText: 'Qual é a massa molar da água' })
    const tamanhoDoEnunciado = () => enunciado.evaluate((no) => Number.parseFloat(getComputedStyle(no).fontSize))
    const abrirATarefa = async () => {
      await page.evaluate((destino) => {
        window.history.pushState(null, '', destino)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, `/aluno/atividades/${atividade.id}`)
      await expect(enunciado).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    }

    await abrirATarefa()
    await expect.poll(tamanhoDoEnunciado, { message: 'Padrão' }).toBe(17)

    await abrirAjustes(page, hasTouch)
    await acionar(rotuloDe(page, 'Maior'), hasTouch)
    await expect(opcao(page, 'Maior')).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(dialogo(page)).toBeHidden()
    await abrirATarefa()
    await expect.poll(tamanhoDoEnunciado, { message: 'Maior' }).toBe(21.25)
  })
})
