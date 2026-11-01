import type { Locator, Page, Route } from '@playwright/test'
import { abrirNavegacao, entrarComoAluno, esperarInicioDoAluno, irPelaNavegacao, lateral, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { memoriaDoAluno, resultadoAprovado, trabalhoNaMemoria } from './support/tutor-memory.ts'
import { expect, test } from './support/profiles.ts'
import { colocarAlunoNaTurma, criarAlunoComMatricula } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * "Como estou indo" em Eu (telas do aluno e primeiro acesso, 7.0; RF9, RF10, RF20): as tarefas de correção aprovada com
 * "N de M certas" e as habilidades a rever, o armazenamento do navegador vazio, o aluno seguinte no mesmo computador e a
 * 360 px. A memória do Tutor é simulada na página (`page.route`): a API de verdade devolve a do aluno recém-criado, que não
 * tem tarefa corrigida. A turma, a sessão e o `/v1/eu` continuam vindo da API de verdade.
 */

const ROTA_MEMORIA = '**/v1/tutor/memoria'
const HABILIDADE = { codigo: 'EF09CI01', descricao: 'Reconhecer o reagente limitante' }
const OUTRA_HABILIDADE = { codigo: 'EF09CI02', descricao: 'Calcular a massa de reagentes e produtos numa reação' }

function json(corpo: unknown): { status: number; contentType: string; body: string } {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(corpo) }
}

/** O aluno acionou com o dedo no celular e com o clique no computador. */
async function activate(alvo: ReturnType<Page['locator']>, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** O "Sair" da casca (o da lateral ou da gaveta, fora do `main`), e não a linha de Eu, que é outro botão dentro dele. */
async function sairPelaCasca(page: Page, hasTouch: boolean): Promise<void> {
  await abrirNavegacao(page, hasTouch)
  const sair = lateral(page).getByRole('button', { name: 'Sair' }).and(page.locator(':not(main *)'))
  await expect(sair).toHaveCount(1)
  await activate(sair, hasTouch)
  await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
}

test.describe('"Como estou indo": o que a memória do Tutor mostra', () => {
  test('a tarefa corrigida com "N de M certas" e as habilidades a rever; a pendente e os sinais ficam de fora, e o navegador não guarda nada', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    const turma = await colocarAlunoNaTurma(aluno)
    const aprovada = trabalhoNaMemoria({ titulo: 'Lista corrigida de reações', resultado: resultadoAprovado({ acertos: 7, total: 8, aReforcar: [HABILIDADE] }) })
    const pendente = trabalhoNaMemoria({ titulo: 'Lista que espera quem dá a aula' })
    await page.route(ROTA_MEMORIA, (rota: Route) => rota.fulfill(json(memoriaDoAluno([pendente, aprovada]))))
    await entrarComoAluno(page, aluno, hasTouch)

    await irPelaNavegacao(page, 'Eu', hasTouch)
    const principal = page.getByRole('main')
    const secao = principal.getByRole('region', { name: 'Como estou indo' })
    await expect(secao).toContainText('Lista corrigida de reações', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(secao).toContainText('7 de 8 certas')
    await expect(secao).toContainText(`${HABILIDADE.codigo} · ${HABILIDADE.descricao}`)
    await expect(secao).toContainText('Achou algo errado? Fale com quem dá a aula.')
    await expect(page.locator('body')).not.toContainText('Lista que espera quem dá a aula')
    await expect(page.locator('body')).not.toContainText(/resposta_pronta|resposta pronta|travou/i)
    // A ordem na página: o título com a turma, "Como estou indo", as linhas.
    await expect(principal.getByRole('heading', { level: 2 })).toHaveText(['Como estou indo'])
    await expect(principal.locator('header')).toContainText(turma.turmaNome)
    expect(await seriousViolations(page)).toEqual([])

    // O que o aluno vê não vai ao navegador: nem `localStorage`, nem `sessionStorage`, nem IndexedDB, nem Cache Storage.
    const guardado = await page.evaluate(async () => ({
      local: Object.keys(localStorage),
      sessao: Object.keys(sessionStorage),
      bancos: (await indexedDB.databases()).map((banco) => banco.name),
      caches: await caches.keys(),
    }))
    expect(guardado).toEqual({ local: [], sessao: [], bancos: [], caches: [] })
  })

  test('o aluno sem tarefa corrigida vê "Nada corrigido ainda", com o convite escrito, e as linhas à mão', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    // A API de verdade: o aluno recém-criado não tem tarefa nenhuma.
    await entrarComoAluno(page, aluno, hasTouch)

    await irPelaNavegacao(page, 'Eu', hasTouch)
    const principal = page.getByRole('main')
    const secao = principal.getByRole('region', { name: 'Como estou indo' })
    await expect(secao).toContainText('Nada corrigido ainda', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(secao).toContainText('Depois que quem dá a aula aprovar a primeira correção, ela aparece aqui.')
    await expect(principal.getByRole('button', { name: 'Sair' })).toHaveCount(1)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('o aluno sem turma no ano: o texto da turma e "Nada corrigido ainda", sem erro', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    await entrarComoAluno(page, aluno, hasTouch)

    await irPelaNavegacao(page, 'Eu', hasTouch)
    const principal = page.getByRole('main')
    await expect(principal).toContainText('Você ainda não está em uma turma neste ano letivo.', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal.getByRole('region', { name: 'Como estou indo' })).toContainText('Nada corrigido ainda', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal.getByRole('alert')).toHaveCount(0)
    expect(await seriousViolations(page)).toEqual([])
  })
})

test.describe('"Como estou indo": o recomeço da tela', () => {
  test('o aluno seguinte no mesmo computador vê o Eu dele, e a resposta atrasada do anterior não aparece', async ({ page, hasTouch }) => {
    const primeiro = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(primeiro)
    const segundo = await criarAlunoComMatricula({ escola: primeiro })
    await colocarAlunoNaTurma(segundo)
    const corpos = {
      primeiro: memoriaDoAluno([trabalhoNaMemoria({ titulo: 'Lista só do primeiro aluno', resultado: resultadoAprovado() })]),
      segundo: memoriaDoAluno([trabalhoNaMemoria({ titulo: 'Lista só do segundo aluno', resultado: resultadoAprovado({ acertos: 3, total: 4 }) })]),
    }
    let vez: 'primeiro' | 'segundo' = 'primeiro'
    // O primeiro: a leitura fica segurada até depois de o segundo estar na tela. O segundo: segurada só até o teste ver o carregando.
    let abrirOPrimeiro: () => void = () => undefined
    let abrirOSegundo: () => void = () => undefined
    let entregueDoPrimeiro: () => void = () => undefined
    const portaDoPrimeiro = new Promise<void>((resolver) => (abrirOPrimeiro = resolver))
    const portaDoSegundo = new Promise<void>((resolver) => (abrirOSegundo = resolver))
    const primeiroEntregue = new Promise<void>((resolver) => (entregueDoPrimeiro = resolver))
    await page.route(ROTA_MEMORIA, async (rota: Route) => {
      const dono = vez
      await (dono === 'primeiro' ? portaDoPrimeiro : portaDoSegundo)
      // A leitura do primeiro foi cancelada quando a sessão acabou: entregá-la depois pode falhar, e o que importa é a tela.
      await rota.fulfill(json(corpos[dono])).catch(() => undefined)
      if (dono === 'primeiro') entregueDoPrimeiro()
    })

    // O primeiro entra pela API e abre Eu pelo endereço, como num retorno à aba: a entrada pela tela tem os casos dela, e o caso de 15 s do portão não comporta dois logins pela tela.
    const entrada = await page.context().request.post('/v1/sessao/matricula', { data: { slug: primeiro.slug, matricula: primeiro.matricula, senha: primeiro.senha } })
    expect(entrada.ok(), 'entrada do primeiro aluno pela API').toBe(true)
    await page.goto('/aluno/eu')
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Carregando as suas tarefas corrigidas…' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await sairPelaCasca(page, hasTouch)

    // O segundo entra na mesma aba, sem recarregar, com a leitura dele segurada: é aí que a lista do anterior apareceria.
    vez = 'segundo'
    await page.evaluate((slug) => {
      window.history.pushState(null, '', `/e/${slug}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, segundo.slug)
    await page.getByLabel('Matrícula').fill(segundo.matricula)
    await page.getByLabel('Senha').fill(segundo.senha)
    await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await esperarInicioDoAluno(page, segundo.nome)
    await irPelaNavegacao(page, 'Eu', hasTouch)
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Carregando as suas tarefas corrigidas…' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText('Lista só do primeiro aluno')

    abrirOSegundo()
    await expect(page.getByRole('main')).toContainText('Lista só do segundo aluno', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('main')).toContainText('3 de 4 certas')

    // Só agora a resposta do primeiro chega: ela já não é de ninguém que esteja na tela.
    abrirOPrimeiro()
    await primeiroEntregue
    await expect(page.getByRole('main')).toContainText('Lista só do segundo aluno')
    await expect(page.locator('body')).not.toContainText('Lista só do primeiro aluno')
    await expect(page.locator('body')).not.toContainText(primeiro.nome)
  })
})

test.describe('"Como estou indo" a 360 px', () => {
  test('sem rolagem lateral, mesmo com habilidade de nome comprido, e "Privacidade" e "Sair" com 44 px', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    const comprida = { codigo: 'EF09CI01', descricao: 'Reconhecer e aplicar o conceito de reagente limitante em reações químicas do cotidiano e da indústria' }
    const trabalhos = [
      trabalhoNaMemoria({ titulo: 'Uma lista com um título bastante comprido para conferir a quebra de linha no celular', resultado: resultadoAprovado({ acertos: 2, total: 9, aReforcar: [comprida, HABILIDADE] }) }),
      trabalhoNaMemoria({ titulo: 'Lista curta', resultado: resultadoAprovado({ acertos: 5, total: 5 }) }),
    ]
    await page.route(ROTA_MEMORIA, (rota: Route) => rota.fulfill(json(memoriaDoAluno(trabalhos))))
    await entrarComoAluno(page, aluno, hasTouch)

    await irPelaNavegacao(page, 'Eu', hasTouch)
    const principal = page.getByRole('main')
    await expect(principal).toContainText('2 de 9 certas', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal).toContainText('5 de 5 certas')
    expect(await horizontalOverflow(page)).toBe(0)
    for (const [nome, alvo] of [
      ['Privacidade', principal.getByRole('link', { name: 'Privacidade', exact: true })],
      ['Sair', principal.getByRole('button', { name: 'Sair' })],
    ] as const) {
      const caixa = await alvo.boundingBox()
      expect(caixa?.height ?? 0, nome).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    }
    expect(await seriousViolations(page)).toEqual([])
  })
})

/** A caixa do elemento na tela; sem ela o caso falha dizendo qual era. */
async function caixaDe(alvo: Locator, nome: string): Promise<{ x: number; y: number; width: number }> {
  const caixa = await alvo.boundingBox()
  if (caixa === null) throw new Error(`${nome} não tem caixa na tela`)
  return caixa
}

/** O Chromebook, 1366 × 768: a conta em grade 2 × 2, as duas tarefas lado a lado, e a página inteira na janela, com o "Sair" à vista. */
async function conferirAJanelaDoChromebook(page: Page): Promise<void> {
  expect(page.viewportSize()).toEqual({ width: 1366, height: 768 })
  const principal = page.getByRole('main')
  const conta = principal.getByRole('list', { name: 'Conta' })
  const privacidade = await caixaDe(conta.getByRole('link', { name: 'Privacidade' }), 'Privacidade')
  const ajustes = await caixaDe(conta.getByRole('button', { name: 'Ajustes' }), 'Ajustes')
  const rever = await caixaDe(conta.getByRole('link', { name: 'Rever a introdução' }), 'Rever a introdução')
  const sair = await caixaDe(conta.getByRole('button', { name: 'Sair' }), 'Sair')
  expect(Math.abs(privacidade.y - ajustes.y), 'Privacidade e Ajustes na mesma linha').toBeLessThan(2)
  expect(ajustes.x, 'Ajustes à direita de Privacidade').toBeGreaterThan(privacidade.x + privacidade.width - 1)
  expect(Math.abs(rever.y - sair.y), 'Rever a introdução e Sair na mesma linha').toBeLessThan(2)
  const tarefas = principal.getByRole('region', { name: 'Como estou indo' }).getByRole('listitem').filter({ hasText: 'de 4 certas' })
  const primeira = await caixaDe(tarefas.nth(0), 'a primeira tarefa')
  const segunda = await caixaDe(tarefas.nth(1), 'a segunda tarefa')
  expect(Math.abs(primeira.y - segunda.y), 'as duas tarefas lado a lado').toBeLessThan(2)
  expect(await horizontalOverflow(page), 'a página rola para o lado').toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollHeight), 'a página rola').toBeLessThanOrEqual(768)
  await expect(conta.getByRole('button', { name: 'Sair' })).toBeInViewport()
}

/** O celular, 360 px: a conta e as duas tarefas em uma coluna só, e a página rola, mas nunca para o lado. */
async function conferirAJanelaDoCelular(page: Page): Promise<void> {
  const principal = page.getByRole('main')
  const conta = principal.getByRole('list', { name: 'Conta' })
  const privacidade = await caixaDe(conta.getByRole('link', { name: 'Privacidade' }), 'Privacidade')
  const ajustes = await caixaDe(conta.getByRole('button', { name: 'Ajustes' }), 'Ajustes')
  expect(ajustes.y, 'Ajustes abaixo de Privacidade').toBeGreaterThan(privacidade.y + 1)
  const tarefas = principal.getByRole('region', { name: 'Como estou indo' }).getByRole('listitem').filter({ hasText: 'de 4 certas' })
  const primeira = await caixaDe(tarefas.nth(0), 'a primeira tarefa')
  const segunda = await caixaDe(tarefas.nth(1), 'a segunda tarefa')
  expect(segunda.y, 'a segunda tarefa abaixo da primeira').toBeGreaterThan(primeira.y + 1)
  expect(await horizontalOverflow(page), 'a página rola para o lado').toBe(0)
}

test.describe('"Eu" na janela do aluno', () => {
  test('a página com duas tarefas corrigidas e três habilidades a rever cabe em 1366 × 768 sem rolar', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    const turma = await colocarAlunoNaTurma(aluno)
    const trabalhos = [
      trabalhoNaMemoria({ titulo: 'Lista corrigida de reações', resultado: resultadoAprovado({ acertos: 1, total: 4, aReforcar: [HABILIDADE, OUTRA_HABILIDADE] }) }),
      trabalhoNaMemoria({ titulo: 'Lista corrigida de estequiometria', resultado: resultadoAprovado({ acertos: 3, total: 4, aReforcar: [HABILIDADE] }) }),
    ]
    await page.route(ROTA_MEMORIA, (rota: Route) => rota.fulfill(json(memoriaDoAluno(trabalhos))))
    await entrarComoAluno(page, aluno, hasTouch)

    await irPelaNavegacao(page, 'Eu', hasTouch)
    const principal = page.getByRole('main')
    await expect(principal).toContainText('1 de 4 certas', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal).toContainText('3 de 4 certas')
    // A turma também carregou: com ela a página é a de verdade, e não a do "Carregando a sua turma…", que tem outra altura.
    await expect(principal.locator('header')).toContainText(turma.turmaNome, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal.getByText(/^Carregando/)).toHaveCount(0)
    // A medida de altura vale na janela larga; o celular rola a página, mas nunca para o lado.
    if ((page.viewportSize()?.width ?? 0) >= 1024) await conferirAJanelaDoChromebook(page)
    else await conferirAJanelaDoCelular(page)
  })
})
