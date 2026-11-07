import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import type { Locator, Page, Request, Route } from '@playwright/test'
import { urlDoBancoDeTeste } from '../tools/ci/compose.ts'
import { entrarPelaApiSemMedirAPrimeiraCarga, esperarNovaConversa, recarregarSemMedirAPrimeiraCarga, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { horizontalOverflow, seriousViolations, ALVO_DE_TOQUE_PRINCIPAL_PX } from './support/checks.ts'
import { expect, test } from './support/profiles.ts'
import { irPara } from './support/professor/scenario.ts'
import {
  abrirASemana,
  caminhoDaSemana,
  cartaoDaAula,
  diaPorExtenso,
  gradeDeHoje,
  montarASemana,
  nomeDoDia,
  noCelular,
  registrarAulaNoBanco,
  tituloDaSemana,
  type CenaDaSemana,
} from './support/professor/semana.ts'
import { criarEquipeComSenha, criarUsuarioEmOutraEscola, definirInatividadeDaEscola } from './support/seed.ts'

/**
 * O painel da aula e o "Preparar esta aula" (F2b, 7.0; RF5, RF6, RF8, RF9, RF15, T2, T3, T4, T7): a professora escreve e corrige o que vai dar
 * na aula, e abre o Início com a turma. A API, o banco e a sessão são os de verdade; o relógio é o da máquina (`e2e/support/professor/semana.ts`),
 * e o caso parte de **hoje**. Cada caso paga uma entrada pela API e prova uma coisa só. A grade tem uma aula em hoje por turma: a turma 0 às
 * 7h30, a 1 às 8h30 e a 2 às 9h30 (`gradeDeHoje`).
 */

const SENTINELA = 'SENTINELA-do-texto-da-aula'
const DISCIPLINAS = ['Matemática', 'História', 'Química'] as const

/** O nome acessível do cartão de hoje da turma `indice`: "Terça, 7h30, 7ºA, Matemática". */
const cartaoDeHoje = (page: Page, cena: CenaDaSemana, indice = 0): Locator =>
  cartaoDaAula(page, `${diaPorExtenso(cena.hoje)}, ${String(7 + indice)}h30, ${cena.turmas[indice]?.turmaNome}, ${DISCIPLINAS[indice]}`)

/** O painel da aula de hoje: o `dialog` leva o dia por título ("Terça, 10 de novembro"). */
const painelDeHoje = (page: Page, cena: CenaDaSemana): Locator => page.getByRole('dialog', { name: nomeDoDia(cena.hoje) })
const campoDe = (painel: Locator): Locator => painel.getByRole('textbox')
const salvarEm = (painel: Locator): Locator => painel.getByRole('button', { name: /^Salv/ })

async function tocar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** A chave da aula de hoje da turma `indice`, como o `?aula=` a leva. */
const chaveDeHoje = (cena: CenaDaSemana, indice = 0): string => `${cena.turmas[indice]?.vinculoIds[0]}.${cena.hoje}.0${String(7 + indice)}30`

/** A professora entra, abre a Semana de hoje e o painel da aula da turma `indice`. */
async function abrirOPainel(page: Page, cena: CenaDaSemana, hasTouch: boolean, indice = 0): Promise<Locator> {
  await abrirASemana(page, cena)
  await tocar(cartaoDeHoje(page, cena, indice), hasTouch)
  const painel = painelDeHoje(page, cena)
  await expect(painel).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  return painel
}

/** As requisições a uma rota, enquanto o caso corre. */
function contarPedidos(page: Page, caminho: string, metodo: string): string[] {
  const pedidos: string[] = []
  page.on('request', (pedido: Request) => {
    if (new URL(pedido.url()).pathname === caminho && pedido.method() === metodo) pedidos.push(pedido.postData() ?? '')
  })
  return pedidos
}

async function comBanco<T>(tarefa: (banco: Client) => Promise<T>): Promise<T> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    return await tarefa(banco)
  } finally {
    await banco.end()
  }
}

/** Quantas conversas do Assistente a escola tem: o "Preparar" não pode criar nenhuma. */
async function conversasDaEscola(escolaId: string): Promise<number> {
  return comBanco(async (banco) => Number((await banco.query<{ n: string }>('select count(*) as n from thread_agente where escola_id = $1', [escolaId])).rows[0]?.n ?? 0))
}

/** O texto da aula no banco, ou `undefined` sem registro. */
async function textoNoBanco(escolaId: string, vinculoId: string): Promise<string | undefined> {
  return comBanco(async (banco) => (await banco.query<{ conteudo: string }>('select conteudo from aula where escola_id = $1 and vinculo_id = $2', [escolaId, vinculoId])).rows[0]?.conteudo)
}

/**
 * A professora na Semana de hoje com o painel da aula aberto e o rascunho digitado, e a sessão vencida por inatividade: o login abre por cima. O relógio
 * da aba é o simulado (ninguém espera meia hora), e a entrada é pela API, sem a tela de entrada (o argon2 com a CPU ×4 gasta o prazo do portão).
 */
async function painelAbertoComASessaoVencida(page: Page, cena: CenaDaSemana, hasTouch: boolean, usuarioId?: string): Promise<void> {
  await definirInatividadeDaEscola(cena.professora.escolaId, { equipe: 30 })
  await page.clock.install()
  // Sem a rede e a CPU do perfil na primeira carga (como `abrirASemana`): o assunto aqui é o que sobra do painel depois do login, não o tempo de abrir.
  await entrarPelaApiSemMedirAPrimeiraCarga(
    page,
    cena.professora,
    caminhoDaSemana(),
    async () => {
      await expect(tituloDaSemana(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    },
    usuarioId,
  )
  await tocar(cartaoDeHoje(page, cena), hasTouch)
  await campoDe(painelDeHoje(page, cena)).fill(SENTINELA)
  await page.clock.fastForward('00:31:00')
  await expect(page.getByRole('dialog', { name: 'Sua sessão expirou' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
}

test.describe('escrever e salvar (RF5, RF6, RF15)', () => {
  test('T2: escrever, salvar, reabrir e achar o texto; o cartão mostra o texto sem recarregar e o selo some; o aviso está no painel', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const leituras = contarPedidos(page, '/v1/semana', 'GET')
    const painel = await abrirOPainel(page, cena, hasTouch)
    await expect(painel.getByLabel('O que vou dar')).toBeVisible()
    await expect(painel).toContainText('Não escreva o nome de nenhum aluno')
    await expect(cartaoDeHoje(page, cena)).toContainText('Falta preencher')

    await campoDe(painel).fill('Frações equivalentes')
    await tocar(salvarEm(painel), hasTouch)
    await expect(painel).toBeHidden()
    expect(await textoNoBanco(cena.professora.escolaId, cena.turmas[0]?.vinculoIds[0] ?? '')).toBe('Frações equivalentes')
    await expect(cartaoDeHoje(page, cena)).toContainText('Frações equivalentes')
    await expect(cartaoDeHoje(page, cena)).not.toContainText('Falta preencher')
    expect(leituras, 'o cartão mostra o texto sem uma leitura nova da semana').toHaveLength(1)

    await tocar(cartaoDeHoje(page, cena), hasTouch)
    await expect(campoDe(painelDeHoje(page, cena))).toHaveValue('Frações equivalentes')
  })

  test('RF15: o clique duplo em "Salvar" manda um PUT só', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const gravacoes = contarPedidos(page, '/v1/aulas', 'PUT')
    const painel = await abrirOPainel(page, cena, hasTouch)
    await campoDe(painel).fill('Frações')
    // Dois cliques na mesma tarefa: o segundo chega antes de a tela se redesenhar e desligar o botão, e quem o segura é a trava do painel (o `isPending` do TanStack vem depois).
    await salvarEm(painel).evaluate((botao: HTMLElement) => {
      botao.click()
      botao.click()
    })
    await expect(painel).toBeHidden()
    expect(gravacoes).toHaveLength(1)
  })

  test('T3: a falha diz a frase e guarda o texto; salvar de novo tira a frase, e reabrir não a traz de volta', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const painel = await abrirOPainel(page, cena, hasTouch)
    await page.route('**/v1/aulas', (rota: Route) => rota.fulfill({ status: 500, json: { erro: { codigo: 'ERRO_INTERNO' } } }))
    await campoDe(painel).fill('Frações')
    await tocar(salvarEm(painel), hasTouch)
    await expect(painel.getByRole('alert')).toHaveText('Não foi possível salvar. Tente de novo em instantes.')
    await expect(campoDe(painel)).toHaveValue('Frações')
    await expect(painel).toBeVisible()

    await page.unroute('**/v1/aulas')
    await tocar(salvarEm(painel), hasTouch)
    await expect(painel).toBeHidden()
    await tocar(cartaoDeHoje(page, cena), hasTouch)
    await expect(painelDeHoje(page, cena)).toBeVisible()
    await expect(painelDeHoje(page, cena).getByRole('alert')).toHaveCount(0)
  })

  test('T3: `NAO_ENCONTRADO` diz que a aula saiu da grade e que o texto não foi salvo, e o texto fica no campo', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const painel = await abrirOPainel(page, cena, hasTouch)
    await page.route('**/v1/aulas', (rota: Route) => rota.fulfill({ status: 404, json: { erro: { codigo: 'NAO_ENCONTRADO' } } }))
    await campoDe(painel).fill('Frações')
    await tocar(salvarEm(painel), hasTouch)
    await expect(painel.getByRole('alert')).toContainText('saiu da grade')
    await expect(painel.getByRole('alert')).toContainText('o texto não foi salvo')
    await expect(campoDe(painel)).toHaveValue('Frações')
    expect(await textoNoBanco(cena.professora.escolaId, cena.turmas[0]?.vinculoIds[0] ?? '')).toBeUndefined()
  })

  test('fechar sem salvar descarta o rascunho, sem diálogo do navegador: reabrir mostra o texto gravado', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const vinculo = cena.turmas[0]?.vinculoIds[0] ?? ''
    await registrarAulaNoBanco(cena.professora.escolaId, vinculo, { data: cena.hoje, inicio: '07:30', fim: '08:20', texto: 'Gravado' })
    const dialogosDoNavegador: string[] = []
    page.on('dialog', (dialogo) => {
      dialogosDoNavegador.push(dialogo.message())
      void dialogo.dismiss()
    })
    const painel = await abrirOPainel(page, cena, hasTouch)
    await expect(campoDe(painel)).toHaveValue('Gravado')
    await campoDe(painel).fill('Rascunho que não vai ser salvo')
    await tocar(painel.getByRole('button', { name: 'Fechar' }), hasTouch)
    await expect(painel).toBeHidden()

    await tocar(cartaoDeHoje(page, cena), hasTouch)
    await expect(campoDe(painelDeHoje(page, cena))).toHaveValue('Gravado')
    expect(dialogosDoNavegador).toEqual([])
  })

  test('recomeço: a gravação de A segurada no ar, B aberta: nada de A em B, e o texto de A chega ao cartão dela', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const painelA = await abrirOPainel(page, cena, hasTouch, 0)
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route('**/v1/aulas', async (rota: Route) => {
      await segurada
      await rota.continue().catch(() => undefined)
    })
    await campoDe(painelA).fill('texto de A')
    await tocar(salvarEm(painelA), hasTouch)
    await expect(painelA.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
    // O painel é modal: fecha-se A com Esc, e só então se abre B.
    await page.keyboard.press('Escape')
    await expect(painelA).toBeHidden()
    await tocar(cartaoDeHoje(page, cena, 1), hasTouch)
    const painelB = page.getByRole('dialog', { name: nomeDoDia(cena.hoje) })
    await expect(painelB).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`aula=${cena.turmas[1]?.vinculoIds[0]}`))

    const terminou = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/aulas' && resposta.request().method() === 'PUT')
    liberar()
    await terminou
    await expect(cartaoDeHoje(page, cena, 0)).toContainText('texto de A')
    await expect(painelB).toBeVisible()
    await expect(campoDe(painelB)).toHaveValue('')
    await expect(painelB.getByRole('alert')).toHaveCount(0)
    await expect(painelB).not.toContainText('texto de A')
    await expect(page).toHaveURL(new RegExp(`aula=${cena.turmas[1]?.vinculoIds[0]}`))
    await expect(cartaoDeHoje(page, cena, 1)).not.toContainText('texto de A')
  })
})

test.describe('o endereço e o foco', () => {
  test('`?aula=` reabre o painel no recarregar com o texto gravado; fechar tira do endereço', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const vinculo = cena.turmas[0]?.vinculoIds[0] ?? ''
    await registrarAulaNoBanco(cena.professora.escolaId, vinculo, { data: cena.hoje, inicio: '07:30', fim: '08:20', texto: 'Gravado antes' })
    const painel = await abrirOPainel(page, cena, hasTouch)
    await expect(campoDe(painel)).toHaveValue('Gravado antes')
    await campoDe(painel).fill('Rascunho que a recarga leva')
    await expect(page).toHaveURL(new RegExp(`aula=${chaveDeHoje(cena)}$`))
    expect(page.url()).not.toContain('Rascunho')

    await recarregarSemMedirAPrimeiraCarga(page, async () => {
      await expect(painelDeHoje(page, cena)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    })
    await expect(campoDe(painelDeHoje(page, cena))).toHaveValue('Gravado antes')
    await tocar(painelDeHoje(page, cena).getByRole('button', { name: 'Fechar' }), hasTouch)
    await expect(painelDeHoje(page, cena)).toBeHidden()
    await expect(page).not.toHaveURL(/aula=/)
    await expect(page).toHaveURL(/ver=semana/)
  })

  test('recomeço: o mesmo `?aula=` colado de novo com o painel aberto não abre dois, não lê de novo e mantém o endereço', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const leituras = contarPedidos(page, '/v1/semana', 'GET')
    await abrirOPainel(page, cena, hasTouch)
    const endereco = page.url()
    await irPara(page, new URL(endereco).pathname + new URL(endereco).search)
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await expect(painelDeHoje(page, cena)).toBeVisible()
    expect(page.url()).toBe(endereco)
    expect(leituras).toHaveLength(1)
  })

  test('RF9, regra 10: `?aula=` de aula que não é dela (de outra escola, ou que não existe) não abre painel, não diz se existe e sai do endereço', async ({ page }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const outra = await montarASemana({ grade: gradeDeHoje })
    await abrirASemana(page, cena)
    await expect(page.locator(`[data-dia="${cena.hoje}"]`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    for (const vinculoId of [outra.turmas[0]?.vinculoIds[0] ?? '', randomUUID()]) {
      await irPara(page, `${caminhoDaSemana()}&aula=${vinculoId}.${cena.hoje}.0730`)
      await expect(page).not.toHaveURL(/aula=/)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByRole('alert')).toHaveCount(0)
      await expect(page.locator('body')).not.toContainText(outra.turmas[0]?.turmaNome ?? 'sem-turma')
    }
  })

  test('o foco volta ao cartão da aula com Esc e com o botão "Fechar"', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const painel = await abrirOPainel(page, cena, hasTouch)
    await page.keyboard.press('Escape')
    await expect(painel).toBeHidden()
    await expect(cartaoDeHoje(page, cena)).toBeFocused()

    await tocar(cartaoDeHoje(page, cena), hasTouch)
    await tocar(painelDeHoje(page, cena).getByRole('button', { name: 'Fechar' }), hasTouch)
    await expect(painelDeHoje(page, cena)).toBeHidden()
    await expect(cartaoDeHoje(page, cena)).toBeFocused()
  })
})

test.describe('"Preparar esta aula" (RF8)', () => {
  test('T4: abre o Início com a turma marcada; o número de conversas é o mesmo antes e depois', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    // A turma da última aula (por nome) é a que o seletor do Início não escolheria sozinho: a primeira da lista é a que ele já traz.
    const rotulos = cena.turmas.map((turma, indice) => ({ indice, rotulo: `${turma.turmaNome} · ${DISCIPLINAS[indice]}` })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR', { numeric: true }))
    const escolhida = rotulos.at(-1)
    expect(escolhida).toBeDefined()
    const indice = escolhida?.indice ?? 0
    const painel = await abrirOPainel(page, cena, hasTouch, indice)
    const antes = await conversasDaEscola(cena.professora.escolaId)

    await tocar(painel.getByRole('button', { name: 'Preparar esta aula' }), hasTouch)
    await esperarNovaConversa(page, cena.professora.nome)
    const turma = cena.turmas[indice]
    const disciplinaId = await comBanco(async (banco) => (await banco.query<{ disciplina_id: string }>('select disciplina_id from vinculo where id = $1', [turma?.vinculoIds[0]])).rows[0]?.disciplina_id)
    await expect(page.getByLabel('Turma e disciplina')).toHaveValue(`${turma?.turmaId}:${disciplinaId}`)
    expect(await conversasDaEscola(cena.professora.escolaId)).toBe(antes)
  })

  test('"Preparar" não manda o texto a requisição nenhuma, nem grava a aula', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const painel = await abrirOPainel(page, cena, hasTouch)
    await campoDe(painel).fill(SENTINELA)
    const saidas: string[] = []
    page.on('request', (pedido: Request) => saidas.push(`${pedido.method()} ${pedido.url()} ${pedido.postData() ?? ''}`))
    await tocar(painel.getByRole('button', { name: 'Preparar esta aula' }), hasTouch)
    await esperarNovaConversa(page, cena.professora.nome)
    await expect(page.getByLabel('Turma e disciplina')).toBeVisible()
    expect(saidas.filter((saida) => saida.includes(SENTINELA))).toEqual([])
    expect(saidas.filter((saida) => saida.startsWith('PUT') && saida.includes('/v1/aulas'))).toEqual([])
    expect(await textoNoBanco(cena.professora.escolaId, cena.turmas[0]?.vinculoIds[0] ?? '')).toBeUndefined()
  })
})

test.describe('o rascunho só em memória e o recomeço (T7, RF9)', () => {
  test('T7: o rascunho nunca está em `localStorage` nem em `sessionStorage`, nem no endereço', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const painel = await abrirOPainel(page, cena, hasTouch)
    await campoDe(painel).fill(SENTINELA)
    const guardado = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, sessao: { ...sessionStorage }, endereco: window.location.href }))
    expect(guardado).not.toContain(SENTINELA)
  })

  test('T7, RF9: a sessão que vence com o painel aberto e o rascunho digitado, e entra outra pessoa: nada da primeira fica', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const segunda = await criarEquipeComSenha()
    await painelAbertoComASessaoVencida(page, cena, hasTouch)
    const login = page.getByRole('dialog', { name: 'Sua sessão expirou' })
    await login.getByLabel('E-mail').fill(segunda.email)
    await login.getByLabel('Senha').fill(segunda.senha)
    await tocar(login.getByRole('button', { name: /^Entrar$/ }), hasTouch)

    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).toContainText(segunda.nome, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(SENTINELA)
    await expect(page.locator('body')).not.toContainText(cena.turmas[0]?.turmaNome ?? 'sem-turma')
  })

  test('T7, RF9: a troca de escola com o painel aberto e o rascunho digitado: o painel fecha e nada da escola anterior fica', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const emB = await criarUsuarioEmOutraEscola(cena.professora.contaId)
    await painelAbertoComASessaoVencida(page, cena, hasTouch, cena.professora.usuarioId)
    // O painel é modal e esconde o seletor de escola: a troca que a professora alcança com ele aberto é a do login por cima, que lhe oferece as duas escolas.
    const login = page.getByRole('dialog', { name: 'Sua sessão expirou' })
    await login.getByLabel('E-mail').fill(cena.professora.email)
    await login.getByLabel('Senha').fill(cena.professora.senha)
    await tocar(login.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await tocar(page.getByRole('button', { name: `${emB.escolaNome} · professor` }), hasTouch)

    // A escolha de escola é uma tela própria (o login por cima sai de cena): a professora cai na raiz, já na escola B, sem `?aula=` no endereço.
    await expect(page.locator('body')).toContainText(emB.escolaNome, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page).not.toHaveURL(/aula=/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(SENTINELA)
    await expect(page.locator('body')).not.toContainText(cena.turmas[0]?.turmaNome ?? 'sem-turma')
  })
})

type Janela = { readonly width: number; readonly height: number }

/** A folha de baixo (abaixo de 768 px): a largura da janela, colada embaixo, com até 88% da altura. */
function conferirFolhaDeBaixo(caixa: { readonly y: number; readonly width: number; readonly height: number }, janela: Janela): void {
  expect(caixa.width).toBeCloseTo(janela.width, 0)
  expect(caixa.y + caixa.height).toBeCloseTo(janela.height, 0)
  expect(caixa.height).toBeLessThanOrEqual(janela.height * 0.88 + 1)
}

/** O painel ao lado (768 px ou mais): 480 px colados à direita, na altura da janela. */
function conferirPainelLateral(caixa: { readonly width: number; readonly height: number }, janela: Janela): void {
  expect(caixa.width).toBeCloseTo(480, 0)
  expect(caixa.height).toBeCloseTo(janela.height, 0)
}

test.describe('o painel no computador e no celular (D51, T9)', () => {
  test('o painel é lateral no computador e folha de baixo a 360 px, sem rolagem de lado', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const painel = await abrirOPainel(page, cena, hasTouch)
    const janela = page.viewportSize() ?? { width: 0, height: 0 }
    const caixa = await painel.boundingBox()
    expect(caixa, 'o painel tem caixa').not.toBeNull()
    const { x, y, width, height } = caixa ?? { x: 0, y: 0, width: 0, height: 0 }
    expect(x + width).toBeCloseTo(janela.width, 0)
    if (noCelular(page)) conferirFolhaDeBaixo({ y, width, height }, janela)
    else conferirPainelLateral({ width, height }, janela)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await painel.evaluate((elemento) => elemento.scrollWidth <= elemento.clientWidth)).toBe(true)
  })

  test('os alvos: "Salvar" e "Preparar" com 44 × 44, e "Fechar" com 24 × 24 ou mais', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const painel = await abrirOPainel(page, cena, hasTouch)
    const medir = async (alvo: Locator) => {
      const caixa = await alvo.boundingBox()
      expect(caixa, 'alvo sem caixa').not.toBeNull()
      return { largura: caixa?.width ?? 0, altura: caixa?.height ?? 0 }
    }
    for (const alvo of [salvarEm(painel), painel.getByRole('button', { name: 'Preparar esta aula' })]) {
      const { largura, altura } = await medir(alvo)
      expect(largura).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect(altura).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    }
    const fechar = await medir(painel.getByRole('button', { name: 'Fechar' }))
    expect(fechar.largura).toBeGreaterThanOrEqual(24)
    expect(fechar.altura).toBeGreaterThanOrEqual(24)
  })

  test('axe: sem violação grave com o painel aberto', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const painel = await abrirOPainel(page, cena, hasTouch)
    await campoDe(painel).fill('Frações')
    expect(await seriousViolations(page)).toEqual([])
  })
})
