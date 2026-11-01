import type { Locator, Page, Route } from '@playwright/test'
import { minhaAtividade, mockAlunoApi } from './support/aluno.ts'
import { abrirNavegacao, entrarComoAluno, esperarInicioDoAluno, lateral, naGaveta, SIGN_IN_TIMEOUT_MS, secoes } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { colocarAlunoNaTurma, criarAlunoComMatricula } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * O Início do aluno (telas do aluno e primeiro acesso, 3.0; RF3, RF4, RF5): a faixa de supervisão presa, o aviso da avaliação
 * aberta com o caminho até o Tutor, o "Sair" do tamanho dos vizinhos e o recomeço da tela para o aluno seguinte no mesmo
 * computador. A API das tarefas é simulada na página (`support/aluno.ts`); a sessão, o `/v1/eu` e a turma são os de
 * verdade. Os quatro estados e o que o Início nunca lê estão no teste de componente (`Inicio.test.tsx`).
 */

const SCREEN_TIMEOUT_MS = 15_000
const TITULO_SEM_ESPACO = 'Exercícios_de_estequiometria_do_capítulo_três_parte_dois'
const SUPERVISAO = 'Quem dá a aula acompanha como você usa o Tutor.'
const AVISO_DA_AVALIACAO = 'Avaliação: o Tutor fica pausado até quem dá a aula encerrar.'

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  await (hasTouch ? alvo.tap() : alvo.click())
}

const principal = (page: Page) => page.getByRole('main')

/** O "Sair" da casca, fora do `main`: o da lateral ou o da gaveta. */
async function sairPelaCasca(page: Page, hasTouch: boolean): Promise<void> {
  await abrirNavegacao(page, hasTouch)
  const sair = lateral(page).getByRole('button', { name: 'Sair' }).and(page.locator(':not(main *)'))
  await expect(sair).toHaveCount(1)
  await activate(sair, hasTouch)
  await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
}

test.describe('o Início do aluno', () => {
  test('a faixa de supervisão fica presa e à vista depois de rolar, a 360 px, sem como fechá-la, e a página não rola de lado', async ({ page, hasTouch }) => {
    test.slow()
    await page.setViewportSize({ width: 360, height: 520 })
    const api = await mockAlunoApi(page)
    // O primeiro título é uma palavra longa sem espaço, como o professor pode escrever: a 360 px ela tem de quebrar dentro do cartão.
    api.atividades = [1, 2, 3, 4].map((numero) => minhaAtividade({ titulo: numero === 1 ? TITULO_SEM_ESPACO : `Lista sintética ${String(numero)}` }))
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)

    const faixa = principal(page).locator('[data-faixa-de-supervisao]')
    const verTodas = principal(page).getByRole('link', { name: 'Ver todas as tarefas' })
    await expect(principal(page).getByRole('link', { name: 'Pedir ajuda ao Tutor' })).toHaveCount(3, { timeout: SCREEN_TIMEOUT_MS })
    await expect(principal(page).getByText(TITULO_SEM_ESPACO)).toBeVisible()
    await expect(principal(page).getByText('Lista sintética 4')).toHaveCount(0)
    await expect(faixa.getByRole('note')).toHaveText(SUPERVISAO)
    await expect(faixa.getByRole('button')).toHaveCount(0)

    // Só vale se a página rolou de verdade: o fim dela não cabia na janela antes.
    await expect(verTodas).not.toBeInViewport()
    await verTodas.scrollIntoViewIfNeeded()
    await expect(verTodas).toBeInViewport()
    await expect(faixa).toBeInViewport()
    const topo = await page.getByRole('banner').boundingBox()
    const presa = await faixa.boundingBox()
    if (topo === null || presa === null) throw new Error('a barra de topo e a faixa precisam estar na tela')
    expect(presa.y).toBeGreaterThanOrEqual(topo.y + topo.height - 1)
    expect(presa.y).toBeLessThan(topo.y + topo.height + 8)

    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('com três tarefas "Para fazer", o Início cabe em 1366 × 768 (RF20), com "Pedir ajuda ao Tutor" na linha do título; abaixo de 768 px o link desce para baixo do título', async ({ page, hasTouch }) => {
    test.slow()
    const api = await mockAlunoApi(page)
    // As três avaliativas: cada cartão leva a linha de aviso a mais, que é o pior caso de altura do Início.
    api.atividades = [1, 2, 3].map((numero) => minhaAtividade({ titulo: `Lista sintética ${String(numero)}`, avaliativa: true }))
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)

    const ajudas = principal(page).getByRole('link', { name: 'Pedir ajuda ao Tutor' })
    await expect(ajudas).toHaveCount(3, { timeout: SCREEN_TIMEOUT_MS })
    await expect(principal(page).getByRole('link', { name: 'Ver todas as tarefas' })).toBeVisible()
    const largura = page.viewportSize()?.width ?? 0
    const altura = page.viewportSize()?.height ?? 0

    const titulo = await principal(page).getByRole('link', { name: 'Lista sintética 1' }).boundingBox()
    const ajuda = await ajudas.first().boundingBox()
    if (titulo === null || ajuda === null) throw new Error('o título e o "Pedir ajuda ao Tutor" da primeira tarefa precisam estar na tela')
    if (largura >= 768) {
      // Na linha do título: o link fica ao lado dele, não abaixo.
      expect(ajuda.x).toBeGreaterThanOrEqual(titulo.x + titulo.width - 1)
      expect(ajuda.y).toBeLessThan(titulo.y + titulo.height)
      // A página não rola: a altura medida cabe na janela (1366 × 768 no Chromebook).
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(altura)
    } else {
      // No celular a página rola, e o link desce para baixo do título, na largura do cartão.
      expect(ajuda.y).toBeGreaterThanOrEqual(titulo.y + titulo.height - 1)
    }
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('com título longo de várias palavras, a 1366 px, "Pedir ajuda ao Tutor" fica numa linha só, à direita do título, e a página não rola de lado', async ({ page, hasTouch }) => {
    test.slow()
    // A largura é a da janela de teste do computador, nos dois projetos: o ramo em linha só existe a partir de 768 px.
    await page.setViewportSize({ width: 1366, height: 768 })
    const api = await mockAlunoApi(page)
    const tituloLongo = 'Exercícios de estequiometria e balanceamento de equações químicas do capítulo três, parte dois, para entregar até a sexta-feira da semana que vem'
    api.atividades = [minhaAtividade({ titulo: tituloLongo })]
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)

    const ajuda = principal(page).getByRole('link', { name: 'Pedir ajuda ao Tutor' })
    await expect(ajuda).toHaveCount(1, { timeout: SCREEN_TIMEOUT_MS })
    const titulo = await principal(page).getByRole('link', { name: tituloLongo }).boundingBox()
    const caixa = await ajuda.boundingBox()
    if (titulo === null || caixa === null) throw new Error('o título e o "Pedir ajuda ao Tutor" precisam estar na tela')
    // O título ocupa mais de uma linha, para o caso valer: sem isso o link nunca seria apertado.
    expect(titulo.height).toBeGreaterThan(ALVO_DE_TOQUE_PRINCIPAL_PX + 1)
    // O link continua numa linha só (44 px de alto) e ao lado do título, não abaixo.
    expect(caixa.height).toBeLessThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX + 1)
    expect(caixa.x).toBeGreaterThanOrEqual(titulo.x + titulo.width - 1)
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('"Sair" está à vista no Início e tem o tamanho de toque dos vizinhos, a 360 px e no computador', async ({ page, hasTouch }) => {
    test.slow()
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    await mockAlunoApi(page)
    await entrarComoAluno(page, aluno, hasTouch)

    // No celular o "Sair" a um toque é o da barra do topo, sem abrir a gaveta (a dois toques fica o da gaveta); no computador, o da lateral.
    const sair = naGaveta(page) ? page.getByRole('banner').getByRole('button', { name: 'Sair' }) : lateral(page).getByRole('button', { name: 'Sair' }).and(page.locator(':not(main *)'))
    await expect(sair).toBeVisible()
    await expect(sair).toHaveCount(1)
    const caixa = await sair.boundingBox()
    if (caixa === null) throw new Error('o "Sair" precisa estar na tela')
    expect(caixa.height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX - 1)
    // Os vizinhos: os lugares da navegação (a lateral no computador, a barra de baixo no celular), que também são alvos de 44 px.
    const vizinho = await secoes(page).getByRole('link', { name: 'Eu', exact: true }).boundingBox()
    if (vizinho === null) throw new Error('o lugar "Eu" precisa estar na tela')
    expect(caixa.height).toBeGreaterThanOrEqual(Math.min(vizinho.height, ALVO_DE_TOQUE_PRINCIPAL_PX) - 1)
  })

  test('avaliação aberta: o Início avisa com o texto de hoje, o link "Pedir ajuda ao Tutor" continua e leva ao Tutor, que pausa mas mantém a caixa', async ({ page, hasTouch }) => {
    test.slow()
    const atividade = minhaAtividade({ titulo: 'Prova de estequiometria', avaliativa: true })
    const api = await mockAlunoApi(page)
    const leiturasDoTutor: string[] = []
    page.on('request', (pedido) => {
      if (new URL(pedido.url()).pathname.startsWith('/v1/tutor')) leiturasDoTutor.push(pedido.url())
    })
    api.atividades = [atividade]
    api.tutor = { estado: 'avaliacao', uso: { hoje: 12, limiteDoDia: 60 }, avaliacaoAberta: { titulo: 'Prova de estequiometria' } }
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)

    const linha = principal(page).getByRole('listitem').filter({ hasText: 'Prova de estequiometria' })
    await expect(linha).toContainText(AVISO_DA_AVALIACAO, { timeout: SCREEN_TIMEOUT_MS })
    const ajuda = linha.getByRole('link', { name: 'Pedir ajuda ao Tutor' })
    await expect(ajuda).toHaveAttribute('href', `/aluno/tutor/${atividade.id}`)
    // O Início não lê a conversa: o estado do Tutor só chega quando o aluno abre a dele.
    expect(leiturasDoTutor).toEqual([])

    await activate(ajuda, hasTouch)
    await expect(page).toHaveURL(new RegExp(`/aluno/tutor/${atividade.id}$`), { timeout: SCREEN_TIMEOUT_MS })
    await expect(principal(page).locator('[data-pausa-do-tutor]')).toHaveAttribute('data-pausa-do-tutor', 'avaliacao', { timeout: SCREEN_TIMEOUT_MS })
    // A caixa existe em todo estado (D36): o aluno que escrever um assunto delicado ainda recebe o encaminhamento.
    await expect(page.getByRole('textbox', { name: 'Pergunta para o Tutor' })).toBeEnabled()
  })

  test('recomeço: o aluno seguinte no mesmo computador vê o Início dele, e a resposta atrasada do anterior nunca aparece', async ({ page, hasTouch }) => {
    test.slow()
    const primeiro = await criarAlunoComMatricula()
    const segundo = await criarAlunoComMatricula({ escola: primeiro })
    const doPrimeiro = minhaAtividade({ titulo: 'Lista só do primeiro aluno' })
    const doSegundo = minhaAtividade({ titulo: 'Lista só do segundo aluno' })
    let leituras = 0
    let liberarAPrimeira: () => void = () => undefined
    const primeiraSegurada = new Promise<void>((resolver) => (liberarAPrimeira = resolver))
    let primeiraEntregue: Promise<void> = Promise.resolve()
    await page.route('**/v1/minhas-atividades', async (rota: Route) => {
      leituras += 1
      if (leituras === 1) {
        // A leitura do primeiro fica no ar até depois de o segundo ter entrado; a resposta que chegar depois é a atrasada.
        primeiraEntregue = primeiraSegurada.then(() => rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [doPrimeiro] }) })).catch(() => undefined)
        await primeiraEntregue
        return
      }
      await rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [doSegundo] }) })
    })

    await entrarComoAluno(page, primeiro, hasTouch)
    await expect(principal(page).getByRole('status')).toHaveText('Carregando as suas tarefas…', { timeout: SCREEN_TIMEOUT_MS })
    await sairPelaCasca(page, hasTouch)

    // O segundo entra na mesma aba, sem recarregar.
    await page.evaluate((slug) => {
      window.history.pushState(null, '', `/e/${slug}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, segundo.slug)
    await page.getByLabel('Matrícula').fill(segundo.matricula)
    await page.getByLabel('Senha').fill(segundo.senha)
    await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await esperarInicioDoAluno(page, segundo.nome)
    await expect(principal(page)).toContainText(doSegundo.titulo, { timeout: SCREEN_TIMEOUT_MS })

    // Agora chega a resposta do primeiro, atrasada: a tela do segundo não a mostra, nem o nome do primeiro.
    liberarAPrimeira()
    await primeiraEntregue
    await page.evaluate(() => new Promise<void>((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver()))))
    await expect(page.locator('body')).not.toContainText(doPrimeiro.titulo)
    await expect(page.locator('body')).not.toContainText(primeiro.nome)
    await expect(principal(page)).toContainText(doSegundo.titulo)
  })
})
