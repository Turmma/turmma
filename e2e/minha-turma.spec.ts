import type { Page, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { abrirNavegacao, irPelaNavegacao, lateral, PRAZO_DA_ENTRADA_MS, esperarInicioDoAluno, secoes } from './__fixtures__/casca.ts'
import { minhaAtividade } from './__fixtures__/aluno.ts'
import { expect, test } from './__fixtures__/perfis.ts'
import { colocarAlunoNaTurma, criarAlunoComMatricula, type AlunoDeTeste } from './__fixtures__/sessao.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, codigoCru, larguraExcedente, violacoesGraves } from './__fixtures__/verificacoes.ts'

/**
 * "Eu" do aluno (X4, tarefa 2.0; antes "Minha turma", A1, 12.0; RF13): a escola, a turma e a série dele, sem colegas, e as
 * linhas Privacidade e Sair. Os estados do W4 — carregando, com dado e erro com a rota interceptada —, o aluno sem turma no
 * ano, o "Sair" a um clique em cada lugar, e o W12 a 360 px. O arquivo guarda o nome de quando a tela era "Minha turma".
 */

const ROTA_MINHA_TURMA = '**/v1/minha-turma'
const SEM_TURMA_NO_ANO = 'Você ainda não está em uma turma neste ano letivo. Fale com quem dá a aula ou com a coordenação.'

/** O aluno entra pelo endereço da escola, com matrícula e senha, e chega a "Início", onde ele abre. */
async function entrarComoAluno(page: Page, aluno: AlunoDeTeste, hasTouch: boolean): Promise<void> {
  await page.goto(`/e/${aluno.slug}`)
  await page.getByLabel('Matrícula').fill(aluno.matricula)
  await page.getByLabel('Senha').fill(aluno.senha)
  const entrar = page.getByRole('button', { name: /^Entrar$/ })
  if (hasTouch) await entrar.tap()
  else await entrar.click()
  await esperarInicioDoAluno(page, aluno.nome)
}

/**
 * O "Sair" da casca: o da lateral (ou o da gaveta), que fica **fora do `main`**. Em Eu há dois "Sair", e o outro é a linha da
 * tela, dentro dele: o contêiner decide qual é qual, e não a ordem dos dois no documento.
 */
async function sairPelaCasca(page: Page, hasTouch: boolean): Promise<void> {
  await abrirNavegacao(page, hasTouch)
  const sair = lateral(page).getByRole('button', { name: 'Sair' }).and(page.locator(':not(main *)'))
  await expect(sair).toHaveCount(1)
  if (hasTouch) await sair.tap()
  else await sair.click()
  await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
}

/** Uma porta que segura a resposta até o teste abrir. */
function portao(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

test.describe('W4: os estados de "Eu"', () => {
  test('carregando e com dado — a turma, a série e a escola, sem colega', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    const turma = await colocarAlunoNaTurma(aluno)
    // Um colega na mesma turma: o nome dele não pode aparecer na tela do aluno (regra 50, item 9).
    const colega = await criarAlunoComMatricula({ escola: aluno })
    await colocarAlunoNaTurma(colega, turma)
    await entrarComoAluno(page, aluno, hasTouch)

    const segurado = portao()
    await page.route(ROTA_MINHA_TURMA, async (rota: Route) => {
      await segurado.aberta
      return rota.continue()
    })

    // Carregando: o texto, e nada da turma ainda.
    await irPelaNavegacao(page, 'Eu', hasTouch)
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Carregando a sua turma…' })).toHaveText('Carregando a sua turma…', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveTitle('Eu · Turmma')

    // Com dado: a turma, a série por extenso e a escola; o colega, não.
    segurado.abrir()
    const principal = page.getByRole('main')
    await expect(principal.locator('header').getByText(turma.turmaNome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal).toContainText(turma.serieNome)
    await expect(principal).toContainText(aluno.escolaNome)
    await expect(page.locator('body')).not.toContainText(colega.nome)
    await expect(principal.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0)
    await expect(principal).not.toContainText(SEM_TURMA_NO_ANO)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('o erro com "Tentar de novo", sem código nem status, e a turma que volta quando a API volta', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    const turma = await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)

    let falha = true
    await page.route(ROTA_MINHA_TURMA, async (rota: Route) => {
      if (falha)
        return rota.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }),
        })
      return rota.continue()
    })

    // Erro: a API cai, e a tela diz o que fazer, com "Tentar de novo", sem código nem status.
    await irPelaNavegacao(page, 'Eu', hasTouch)
    const principal = page.getByRole('main')
    await expect(principal.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal).not.toContainText(turma.turmaNome)
    for (const proibido of [codigoCru('503'), 'INDISPONIVEL']) await expect(page.locator('body')).not.toContainText(proibido)
    expect(await violacoesGraves(page)).toEqual([])

    // A API volta: "Tentar de novo" traz a turma.
    falha = false
    const tentar = principal.getByRole('button', { name: 'Tentar de novo' })
    if (hasTouch) await tentar.tap()
    else await tentar.click()
    await expect(principal).toContainText(turma.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
  })

  test('o aluno sem turma no ano letivo em curso vê a quem recorrer, e não um erro de rede', async ({ page, hasTouch }) => {
    // Sem vínculo confirmado no ano (a virada de ano, ou o vínculo que ainda não existe), a API responde `NAO_ENCONTRADO`.
    const aluno = await criarAlunoComMatricula()
    await entrarComoAluno(page, aluno, hasTouch)
    await irPelaNavegacao(page, 'Eu', hasTouch)
    const principal = page.getByRole('main')
    // Numa região de status: o leitor de tela anuncia a troca do "carregando" por este texto. "Como estou indo" também tem a dele
    // (carregando, depois o vazio), e por isso o filtro: o `main` pode ter duas regiões de status ao mesmo tempo.
    await expect(principal.getByRole('status').filter({ hasText: SEM_TURMA_NO_ANO })).toHaveText(SEM_TURMA_NO_ANO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0)
    await expect(principal).not.toContainText(MENSAGENS_DE_ERRO.NAO_ENCONTRADO)
    expect(await violacoesGraves(page)).toEqual([])
  })
})

test.describe('recomeço de "Eu" e do Início', () => {
  test('segunda pessoa: o aluno seguinte no mesmo Chromebook vê a turma dele, e nunca a do anterior', async ({ page, hasTouch }) => {
    const primeiro = await criarAlunoComMatricula()
    const turmaDoPrimeiro = await colocarAlunoNaTurma(primeiro)
    const segundo = await criarAlunoComMatricula({ escola: primeiro })
    const turmaDoSegundo = await colocarAlunoNaTurma(segundo)
    // O primeiro entra pela API e abre Eu pelo endereço, como num retorno à aba (`entrarPelaApi`, em `casca.ts`): a entrada pela tela
    // tem os casos dela, e o caso de 15 s do portão não comporta dois logins pela tela.
    const entrada = await page.context().request.post('/v1/sessao/matricula', { data: { slug: primeiro.slug, matricula: primeiro.matricula, senha: primeiro.senha } })
    expect(entrada.ok(), 'entrada do primeiro aluno pela API').toBe(true)
    await page.goto('/aluno/eu')
    await expect(page.getByRole('main')).toContainText(turmaDoPrimeiro.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    await sairPelaCasca(page, hasTouch)

    // O segundo entra na mesma aba, sem recarregar, e com a leitura da turma segurada: é aí que a turma do anterior
    // apareceria, se tivesse ficado no cache.
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_MINHA_TURMA, async (rota: Route) => {
      await segurada
      await rota.continue()
    })
    await page.evaluate((slug) => {
      window.history.pushState(null, '', `/e/${slug}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, segundo.slug)
    await page.getByLabel('Matrícula').fill(segundo.matricula)
    await page.getByLabel('Senha').fill(segundo.senha)
    const entrar = page.getByRole('button', { name: /^Entrar$/ })
    if (hasTouch) await entrar.tap()
    else await entrar.click()
    await esperarInicioDoAluno(page, segundo.nome)
    await irPelaNavegacao(page, 'Eu', hasTouch)
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Carregando a sua turma…' })).toHaveText('Carregando a sua turma…', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText(turmaDoPrimeiro.turmaNome)
    liberar()
    await expect(page.getByRole('main')).toContainText(turmaDoSegundo.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText(turmaDoPrimeiro.turmaNome)
    await expect(page.locator('body')).not.toContainText(primeiro.nome)
  })

  test('segunda pessoa no Início: o aluno seguinte vê "Carregando as suas tarefas…" e depois a atividade dele, nunca a do anterior', async ({ page, hasTouch }) => {
    const primeiro = await criarAlunoComMatricula()
    const segundo = await criarAlunoComMatricula({ escola: primeiro })
    const atividadeDoPrimeiro = minhaAtividade({ titulo: 'Lista só do primeiro aluno' })
    const atividadeDoSegundo = minhaAtividade({ titulo: 'Lista só do segundo aluno' })
    let vez: 'primeiro' | 'segundo' = 'primeiro'
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route('**/v1/minhas-atividades', async (rota: Route) => {
      if (vez === 'segundo') await segurada
      const itens = [vez === 'primeiro' ? atividadeDoPrimeiro : atividadeDoSegundo]
      await rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens }) })
    })

    // O primeiro vê a atividade dele no Início e sai.
    await entrarComoAluno(page, primeiro, hasTouch)
    await expect(page.getByRole('main')).toContainText(atividadeDoPrimeiro.titulo, { timeout: PRAZO_DA_ENTRADA_MS })
    await sairPelaCasca(page, hasTouch)

    // O segundo entra na mesma aba, sem recarregar, e com a leitura das atividades segurada: é aí que a do anterior apareceria,
    // se tivesse ficado no cache.
    vez = 'segundo'
    await page.evaluate((slug) => {
      window.history.pushState(null, '', `/e/${slug}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, segundo.slug)
    await page.getByLabel('Matrícula').fill(segundo.matricula)
    await page.getByLabel('Senha').fill(segundo.senha)
    const entrar = page.getByRole('button', { name: /^Entrar$/ })
    if (hasTouch) await entrar.tap()
    else await entrar.click()
    await esperarInicioDoAluno(page, segundo.nome)
    await expect(page.getByRole('main').getByRole('status')).toHaveText('Carregando as suas tarefas…', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText(atividadeDoPrimeiro.titulo)

    // Liberada a leitura, aparece a do segundo, e a do primeiro continua ausente.
    liberar()
    await expect(page.getByRole('main')).toContainText(atividadeDoSegundo.titulo, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText(atividadeDoPrimeiro.titulo)
  })
})

test.describe('W12: "Eu" a 360 px', () => {
  test('sem rolagem horizontal e com o item de 44 px', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    const aluno = await criarAlunoComMatricula()
    const turma = await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)

    // A 360 px o item é da barra de baixo, numa coluna de 68 px, à vista sem abrir a gaveta (A93).
    const item = secoes(page).getByRole('link', { name: 'Eu', exact: true })
    const caixa = await item.boundingBox()
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    await irPelaNavegacao(page, 'Eu', hasTouch)
    await expect(page.getByRole('main')).toContainText(turma.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })
})

test.describe('RF3: "Sair" a um clique em cada lugar do aluno', () => {
  test('a casca tem o "Sair" à vista em Início, Tarefas e Eu, do tamanho dos vizinhos; a linha de Eu sai pela mesma saída', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)

    // A casca: no celular o botão está na barra do topo, e no computador, no pé da lateral. Nos três lugares, sem abrir nada além da gaveta.
    for (const lugar of ['Início', 'Tarefas', 'Eu']) {
      await irPelaNavegacao(page, lugar, hasTouch)
      await expect(secoes(page).getByRole('link', { name: lugar, exact: true })).toHaveAttribute('aria-current', 'page')
      const sairDaCasca = page.getByRole('banner').getByRole('button', { name: 'Sair' }).or(lateral(page).getByRole('button', { name: 'Sair' }))
      await expect(sairDaCasca.first(), lugar).toBeVisible()
      expect((await sairDaCasca.first().boundingBox())?.height ?? 0, lugar).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    }

    // A linha de Eu: no miolo da tela, do tamanho das outras (o "Sair" da casca é outro botão, de outro contêiner), e leva à entrada.
    await irPelaNavegacao(page, 'Eu', hasTouch)
    const principal = page.getByRole('main')
    const linha = principal.getByRole('button', { name: 'Sair' })
    await expect(linha).toHaveCount(1)
    const privacidade = principal.getByRole('link', { name: 'Privacidade', exact: true })
    const [caixaDoSair, caixaDaPrivacidade] = [await linha.boundingBox(), await privacidade.boundingBox()]
    expect(caixaDoSair?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(caixaDoSair?.height).toBe(caixaDaPrivacidade?.height)
    if (hasTouch) await linha.tap()
    else await linha.click()
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
  })

  test('o "Sair" de Eu continua à mão quando a leitura da turma falha', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)
    await page.route(ROTA_MINHA_TURMA, (rota: Route) =>
      rota.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }),
      }),
    )
    await irPelaNavegacao(page, 'Eu', hasTouch)
    const principal = page.getByRole('main')
    await expect(principal.getByRole('alert')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const linha = principal.getByRole('button', { name: 'Sair' })
    if (hasTouch) await linha.tap()
    else await linha.click()
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
  })
})
