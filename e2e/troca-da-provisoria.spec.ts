import type { Locator, Page, Route } from '@playwright/test'
import { SIGN_IN_TIMEOUT_MS, esperarInicioDoAluno } from './support/casca.ts'
import { entrarComoAlunoPelaApi } from './support/aluno-api.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'
import { expect, test } from './support/profiles.ts'
import { criarAlunoComMatricula, gerarProvisoriaNoBanco, vencerAProvisoriaNoBanco, type AlunoDeTeste, type ProvisoriaAnteriorDeTeste } from './support/seed.ts'

/**
 * "Crie a sua senha" (acesso-e-convites, tarefa 13.0; RF13 e RF18; `cenarios.md`, "Telas", linha "Trocar a provisória", e "E2E (RF18)"): o aluno entra pelo endereço da escola com a senha provisória,
 * vê as provisórias geradas antes e cria a dele; a sessão abre e ele cai em "Início". Pela tela, nos projetos `chromebook` e `celular`, com o login e a troca da API de verdade. A provisória é gravada
 * no banco (`gerarProvisoriaNoBanco`): quem a gera pela tela, pelo professor ou pela coordenação, é a 12.0. Os textos esperados estão aqui por extenso.
 */

const SENHA_NOVA = 'frase-sintetica-da-senha-nova-do-aluno'
const AVISO_QUE_NAO_VALE = 'Esta senha provisória não vale mais. Peça a senha de novo ao professor.'
const AVISO_SEM_BILHETE = 'Entre de novo com a sua matrícula e a senha provisória. Se ela não valer mais, peça a senha de novo ao professor.'
const PRIMEIRA_VEZ = 'É a primeira vez que você troca a senha.'
const SENHA_RECUSADA = 'A senha precisa ter pelo menos 12 caracteres.'
const ROTA_DAS_TROCAS = '**/v1/sessao/matricula/trocas'
const ROTA_DO_LOGIN = '**/v1/sessao/matricula'
const ROTA_DA_TROCA = '**/v1/sessao/matricula/trocar-senha'
const ALVO_MINIMO_PX = 24

const campoSenhaNova = (page: Page) => page.getByLabel(/^Senha nova/)
const botaoCriar = (page: Page) => page.getByRole('button', { name: /^(Criar a senha e entrar|Salvando…)$/ })
const voltarAEntrada = (page: Page) => page.getByRole('link', { name: 'Voltar à entrada' })
const tentarDeNovo = (page: Page) => page.getByRole('button', { name: 'Tentar de novo' })
const esqueleto = (page: Page) => page.locator('[data-esqueleto]')

/** Toque no celular, clique no Chromebook: a mesma ação pela tela que cada aparelho tem. */
async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Uma porta que segura a resposta até o teste abrir. */
function gate(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

/** O aluno entra pelo endereço da escola com a provisória e cai na troca: o login devolve o bilhete, e nenhuma sessão abre. */
async function entrarComAProvisoria(page: Page, aluno: Pick<AlunoDeTeste, 'slug' | 'matricula'>, provisoria: string, hasTouch: boolean): Promise<void> {
  await page.goto(`/e/${aluno.slug}`)
  await page.getByLabel('Matrícula').fill(aluno.matricula)
  await page.getByLabel('Senha').fill(provisoria)
  await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
  await expect(page).toHaveURL(new RegExp(`/e/${aluno.slug}/trocar-senha$`), { timeout: SIGN_IN_TIMEOUT_MS })
  await expect(campoSenhaNova(page)).toBeVisible()
}

/** Como a entrada da escola, pelo mesmo link "Voltar à entrada" da troca: o aluno seguinte chega sem recarregar a aba, que é o que o computador compartilhado faz. */
async function voltarEEntrarComOutra(page: Page, aluno: Pick<AlunoDeTeste, 'slug' | 'matricula'>, provisoria: string, hasTouch: boolean): Promise<void> {
  await activate(voltarAEntrada(page), hasTouch)
  await expect(page).toHaveURL(new RegExp(`/e/${aluno.slug}$`))
  await page.getByLabel('Matrícula').fill(aluno.matricula)
  await page.getByLabel('Senha').fill(provisoria)
  await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
  await expect(page).toHaveURL(new RegExp(`/e/${aluno.slug}/trocar-senha$`), { timeout: SIGN_IN_TIMEOUT_MS })
}

/** Dois quadros de animação: as continuações das promessas e a renderização que uma resposta atrasada poderia causar já correram. */
async function deixarAsContinuacoesCorrerem(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver()))))
}

const DE_ANTES: readonly ProvisoriaAnteriorDeTeste[] = [
  { geradaEm: '2026-11-12T17:05:00.000Z', papel: 'coordenador', usada: true },
  { geradaEm: '2026-11-10T15:30:00.000Z', papel: 'professor', usada: false },
]

/** Dois alunos da mesma escola, cada um com a provisória dele: o colega que usa o mesmo computador em seguida. */
async function doisAlunosDaMesmaEscola(deA: readonly ProvisoriaAnteriorDeTeste[], deB: readonly ProvisoriaAnteriorDeTeste[] = []) {
  const a = await criarAlunoComMatricula()
  const b = await criarAlunoComMatricula({ escola: a, matricula: `${a.matricula}7` })
  return { a, b, provisoriaA: await gerarProvisoriaNoBanco(a, deA), provisoriaB: await gerarProvisoriaNoBanco(b, deB) }
}

test.describe('Trocar a provisória: a jornada', () => {
  test('provisória → troca → entra: a senha nova abre a sessão do aluno em "Início", e é ela que vale depois', async ({ page, request, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    const provisoria = await gerarProvisoriaNoBanco(aluno, [DE_ANTES[1] as ProvisoriaAnteriorDeTeste])
    await entrarComAProvisoria(page, aluno, provisoria, hasTouch)

    // A aba não tem sessão: a troca é antes de qualquer tela da área.
    await expect(page.getByRole('heading', { level: 1, name: 'Crie a sua senha' })).toBeVisible()
    await expect(campoSenhaNova(page)).toHaveAttribute('autocomplete', 'new-password')
    await expect(campoSenhaNova(page)).toBeFocused()
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await activate(botaoCriar(page), hasTouch)

    await esperarInicioDoAluno(page, aluno.nome, { escolaNome: aluno.escolaNome })
    expect(await entrarComoAlunoPelaApi(request, { ...aluno, senha: SENHA_NOVA })).not.toBe('')
  })

  test('clique repetido em "Criar a senha e entrar" não manda duas trocas: com o pedido em andamento, o botão fica desabilitado', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    const provisoria = await gerarProvisoriaNoBanco(aluno)
    const porta = gate()
    let pedidos = 0
    await page.route(ROTA_DA_TROCA, async (rota: Route) => {
      pedidos++
      await porta.aberta
      await rota.continue()
    })
    await entrarComAProvisoria(page, aluno, provisoria, hasTouch)
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await activate(botaoCriar(page), hasTouch)

    await expect(botaoCriar(page)).toBeDisabled()
    // Duas trocas da mesma provisória: a segunda leria a provisória já usada e mostraria "não vale mais" a quem acabou de criar a senha.
    await botaoCriar(page).dispatchEvent('click')
    porta.abrir()
    await esperarInicioDoAluno(page, aluno.nome, { escolaNome: aluno.escolaNome })
    expect(pedidos).toBe(1)
  })

  test('primeira troca: "É a primeira vez que você troca a senha", sem tabela e sem lista vazia', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    await entrarComAProvisoria(page, aluno, await gerarProvisoriaNoBanco(aluno), hasTouch)

    await expect(page.getByText(PRIMEIRA_VEZ)).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('listitem')).toHaveCount(0)
    await expect(esqueleto(page)).toHaveCount(0)
  })

  test('datas: "Gerada pela coordenação em 12/11/2026 às 14:05 · usada", da mais nova à mais antiga', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    await entrarComAProvisoria(page, aluno, await gerarProvisoriaNoBanco(aluno, DE_ANTES), hasTouch)

    const linhas = page.getByRole('listitem')
    await expect(linhas).toHaveText(['Gerada pela coordenação em 12/11/2026 às 14:05 · usada', 'Gerada pelo professor em 10/11/2026 às 12:30 · não usada'])
    await expect(page.getByText(PRIMEIRA_VEZ)).toHaveCount(0)
  })

  test('carregando: o esqueleto parado no lugar da lista, o campo de senha já livre, e ele some quando a lista chega', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    const provisoria = await gerarProvisoriaNoBanco(aluno, DE_ANTES)
    const porta = gate()
    await page.route(ROTA_DAS_TROCAS, async (rota: Route) => {
      await porta.aberta
      await rota.continue()
    })
    await entrarComAProvisoria(page, aluno, provisoria, hasTouch)

    await expect(esqueleto(page)).toBeVisible()
    await expect(page.getByText('Carregando as senhas provisórias de antes…')).toBeAttached()
    await expect(campoSenhaNova(page)).toBeEnabled()
    await expect(botaoCriar(page)).toBeEnabled()

    porta.abrir()
    await expect(page.getByRole('listitem')).toHaveCount(2)
    await expect(esqueleto(page)).toHaveCount(0)
  })

  test('lista falhou: o aviso com "Tentar de novo", o campo de senha segue, e o botão lê a lista de novo', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    const provisoria = await gerarProvisoriaNoBanco(aluno, DE_ANTES)
    await page.route(ROTA_DAS_TROCAS, (rota: Route) => rota.abort())
    await entrarComAProvisoria(page, aluno, provisoria, hasTouch)

    await expect(tentarDeNovo(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(campoSenhaNova(page)).toBeEnabled()
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await expect(campoSenhaNova(page)).toHaveValue(SENHA_NOVA)

    await page.unroute(ROTA_DAS_TROCAS)
    await activate(tentarDeNovo(page), hasTouch)
    await expect(page.getByRole('listitem')).toHaveCount(2)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(campoSenhaNova(page)).toHaveValue(SENHA_NOVA)
  })

  test('bilhete vencido: "Peça a senha de novo ao professor", e a tela já não tem formulário', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    await entrarComAProvisoria(page, aluno, await gerarProvisoriaNoBanco(aluno, DE_ANTES), hasTouch)
    await expect(page.getByRole('listitem')).toHaveCount(2)

    // A provisória vence com a tela aberta: o bilhete que a levava deixa de valer, e a API só diz isso quando a senha chega.
    await vencerAProvisoriaNoBanco(aluno)
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await activate(botaoCriar(page), hasTouch)

    await expect(page.getByRole('alert')).toHaveText(AVISO_QUE_NAO_VALE)
    await expect(campoSenhaNova(page)).toHaveCount(0)
    await expect(voltarAEntrada(page)).toBeVisible()
  })

  test('recarregar a tela perde o bilhete de propósito: pede para entrar de novo, e a mesma provisória ainda vale', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    const provisoria = await gerarProvisoriaNoBanco(aluno)
    await entrarComAProvisoria(page, aluno, provisoria, hasTouch)

    await page.reload()
    await expect(page.getByRole('alert')).toHaveText(AVISO_SEM_BILHETE)
    await expect(campoSenhaNova(page)).toHaveCount(0)

    await voltarEEntrarComOutra(page, aluno, provisoria, hasTouch)
    await expect(page.getByText(PRIMEIRA_VEZ)).toBeVisible()
  })
})

test.describe('Trocar a provisória: o bilhete', () => {
  test('o bilhete fica fora da URL, do armazenamento e dos cookies legíveis: só vai no Authorization', async ({ page, context, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    const provisoria = await gerarProvisoriaNoBanco(aluno, DE_ANTES)
    let bilhete = ''
    await page.route(ROTA_DO_LOGIN, async (rota: Route) => {
      const resposta = await rota.fetch()
      bilhete = ((await resposta.json()) as { bilhete?: string }).bilhete ?? ''
      await rota.fulfill({ response: resposta })
    })
    const pedidos: { url: string; autorizacao: string | undefined }[] = []
    page.on('request', (pedido) => {
      if (/\/v1\/sessao\/matricula\/(trocas|trocar-senha)/.test(pedido.url())) pedidos.push({ url: pedido.url(), autorizacao: pedido.headers()['authorization'] })
    })
    await entrarComAProvisoria(page, aluno, provisoria, hasTouch)
    await expect(page.getByRole('listitem')).toHaveCount(2)
    await campoSenhaNova(page).fill(SENHA_NOVA)
    expect(bilhete).not.toBe('')

    const guardado = await page.evaluate(() => JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage }) + document.cookie)
    const cookies = JSON.stringify(await context.cookies())
    for (const lugar of [page.url(), guardado, cookies]) {
      expect(lugar).not.toContain(bilhete)
      expect(lugar).not.toContain(SENHA_NOVA)
      expect(lugar).not.toContain(provisoria)
    }
    // Nas chamadas da troca, ele vai só no Authorization: nenhuma URL o leva, e a senha nova nem sai da tela antes de enviar.
    expect(pedidos.map((pedido) => new URL(pedido.url).pathname)).toEqual(['/v1/sessao/matricula/trocas'])
    expect(pedidos.map((pedido) => pedido.autorizacao)).toEqual([`Bearer ${bilhete}`])
    await activate(botaoCriar(page), hasTouch)
    await esperarInicioDoAluno(page, aluno.nome, { escolaNome: aluno.escolaNome })
    expect(pedidos.map((pedido) => pedido.autorizacao)).toEqual([`Bearer ${bilhete}`, `Bearer ${bilhete}`])
    expect(pedidos.every((pedido) => !pedido.url.includes(bilhete) && !pedido.url.includes(SENHA_NOVA))).toBe(true)
    const depois = await page.evaluate(() => JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage }) + document.cookie)
    expect(depois).not.toContain(bilhete)
  })
})

test.describe('Trocar a provisória: o recomeço', () => {
  test('o colega no mesmo computador: nada do anterior, nem a senha digitada, nem a lista dele', async ({ page, hasTouch }) => {
    const { a, b, provisoriaA, provisoriaB } = await doisAlunosDaMesmaEscola(DE_ANTES)
    await entrarComAProvisoria(page, a, provisoriaA, hasTouch)
    await expect(page.getByRole('listitem')).toHaveCount(2)
    await campoSenhaNova(page).fill('senha-do-colega-a-que-saiu')

    await voltarEEntrarComOutra(page, b, provisoriaB, hasTouch)

    await expect(page.getByText(PRIMEIRA_VEZ)).toBeVisible()
    await expect(page.getByRole('listitem')).toHaveCount(0)
    await expect(page.getByText(/Gerada pel/)).toHaveCount(0)
    await expect(campoSenhaNova(page)).toHaveValue('')
    await expect(campoSenhaNova(page)).toBeFocused()
  })

  test('resposta atrasada: a lista do aluno que saiu, chegando depois, não troca a lista de quem entrou', async ({ page, hasTouch }) => {
    const { a, b, provisoriaA, provisoriaB } = await doisAlunosDaMesmaEscola(DE_ANTES)
    const porta = gate()
    let leituras = 0
    await page.route(ROTA_DAS_TROCAS, async (rota: Route) => {
      if (++leituras > 1) return rota.continue()
      // A primeira leitura, a de A, fica no ar até o teste a abrir, e então responde com a lista dele.
      await porta.aberta
      return rota.fulfill({ status: 200, contentType: 'application/json', json: { anteriores: [{ geradaEm: '2026-11-12T17:05:00.000Z', papel: 'coordenador', usada: true }] } })
    })
    await entrarComAProvisoria(page, a, provisoriaA, hasTouch)
    await expect(esqueleto(page)).toBeVisible()

    await voltarEEntrarComOutra(page, b, provisoriaB, hasTouch)
    await expect(page.getByText(PRIMEIRA_VEZ)).toBeVisible()
    porta.abrir()
    await deixarAsContinuacoesCorrerem(page)

    await expect(page.getByText(PRIMEIRA_VEZ)).toBeVisible()
    await expect(page.getByText(/Gerada pel/)).toHaveCount(0)
  })

  test('erro: o aviso da senha recusada sai na nova tentativa, que recomeça com o campo vazio e o foco nele', async ({ page, hasTouch }) => {
    const { a, b, provisoriaA, provisoriaB } = await doisAlunosDaMesmaEscola([], [])
    await entrarComAProvisoria(page, a, provisoriaA, hasTouch)
    await campoSenhaNova(page).fill('curta')
    await activate(botaoCriar(page), hasTouch)
    await expect(page.getByText(SENHA_RECUSADA)).toBeVisible()
    await expect(campoSenhaNova(page)).toBeFocused()

    await voltarEEntrarComOutra(page, b, provisoriaB, hasTouch)

    await expect(page.getByText(PRIMEIRA_VEZ)).toBeVisible()
    await expect(page.getByText(SENHA_RECUSADA)).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(campoSenhaNova(page)).toHaveValue('')
    await expect(campoSenhaNova(page)).toBeFocused()
  })
})

/** Um alvo tem a largura e a altura mínimas. */
async function esperarAlvo(alvo: Locator, minimoPx: number, onde: string): Promise<void> {
  const caixa = await alvo.boundingBox()
  expect(caixa, onde).not.toBeNull()
  expect(caixa?.width ?? 0, onde).toBeGreaterThanOrEqual(minimoPx)
  expect(caixa?.height ?? 0, onde).toBeGreaterThanOrEqual(minimoPx)
}

test.describe('Trocar a provisória: 360 px', () => {
  test('a troca com a lista: sem rolagem horizontal, sem violação grave de acessibilidade, ação principal de 44 px e o resto de 24 px', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    const aluno = await criarAlunoComMatricula()
    await entrarComAProvisoria(page, aluno, await gerarProvisoriaNoBanco(aluno, DE_ANTES), hasTouch)
    await expect(page.getByRole('listitem')).toHaveCount(2)

    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await esperarAlvo(botaoCriar(page), ALVO_DE_TOQUE_PRINCIPAL_PX, 'Criar a senha e entrar')
    await esperarAlvo(page.getByRole('button', { name: 'Mostrar a senha' }), ALVO_MINIMO_PX, 'Mostrar a senha')
    await esperarAlvo(voltarAEntrada(page), ALVO_MINIMO_PX, 'Voltar à entrada')
  })

  test('o aviso da lista que falhou e o do bilhete que não vale, também sem rolagem horizontal', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    const aluno = await criarAlunoComMatricula()
    await page.route(ROTA_DAS_TROCAS, (rota: Route) => rota.abort())
    await entrarComAProvisoria(page, aluno, await gerarProvisoriaNoBanco(aluno), hasTouch)
    await expect(tentarDeNovo(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await esperarAlvo(tentarDeNovo(page), ALVO_MINIMO_PX, 'Tentar de novo')

    await page.unroute(ROTA_DAS_TROCAS)
    await vencerAProvisoriaNoBanco(aluno)
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await activate(botaoCriar(page), hasTouch)
    await expect(page.getByRole('alert')).toHaveText(AVISO_QUE_NAO_VALE)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await esperarAlvo(voltarAEntrada(page), ALVO_MINIMO_PX, 'Voltar à entrada do aviso')
  })
})
