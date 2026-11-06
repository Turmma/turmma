import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { APIRequestContext, Locator, Page, Route } from '@playwright/test'
import { CABECALHOS_DA_PLANILHA } from '../packages/shared/src/importacao/modelos.ts'
import { entrarPelaTelaComSegundoFator, secoes, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'
import { irPelaCoordenacao, linhasDaTabela, paginaNaoRola } from './support/coordenacao.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga, configurarSegundoFatorPelaApi } from './support/mfa.ts'
import { expect, test } from './support/profiles.ts'
import {
  aulasDaEscolaNoBanco,
  criarAlocacaoDoProfessor,
  criarAnoLetivoNoBanco,
  criarAulasNoBanco,
  criarEquipeComSenha,
  criarEventoDoCalendarioNoBanco,
  criarProfessoraNaEscola,
  eventosDaEscolaNoBanco,
  type EquipeDeTeste,
} from './support/seed.ts'

/**
 * A aba Grade e calendário de Escola (F2, 14.0; RF1, RF7, RF9, RF10 e RF16): os quatro modelos para baixar, a grade de cada turma
 * (dias × horários), o calendário do ano com o seletor do planejado, e a importação da grade e do calendário pelo painel da planilha.
 * Tudo pela tela, nos projetos `chromebook` e `celular`, com escolas e nomes inventados pelo teste.
 *
 * Cada caso entra pela API (`abrirPelaApiSemMedirAPrimeiraCarga`): o assunto aqui vem depois da entrada, e o login pela tela não cabe
 * nos 15 s do portão junto com a leitura e a importação. A planilha entra sempre por `setInputFiles` com `buffer`, como a coordenação
 * escolhe o arquivo, e **a do modelo é a que a própria tela baixou**, preenchida: é o que prova que o modelo entra sem erro.
 */

const ENDERECO = '/coordenacao/grade'
const CAMPO_DO_ARQUIVO = 'Arquivo da planilha (Excel ou CSV)'
const INDISPONIVEL = JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
const TEXTO_INDISPONIVEL = 'O sistema está indisponível no momento. Tente de novo em instantes.'

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

async function alvoDeToque(alvo: Locator, descricao: string, minimo: number): Promise<void> {
  const caixa = await alvo.boundingBox()
  expect(caixa, `${descricao} sem caixa`).not.toBeNull()
  expect(caixa?.height ?? 0, descricao).toBeGreaterThanOrEqual(minimo)
}

const principal = (page: Page): Locator => page.getByRole('main')
const secaoDaGrade = (page: Page): Locator => principal(page).getByRole('region', { name: 'Grade horária' })
/** O seletor da turma: o nome exato, porque a região "Grade da turma X" também leva "Turma" no nome. */
const seletorDeTurma = (page: Page): Locator => secaoDaGrade(page).getByLabel('Turma', { exact: true })
const secaoDoCalendario = (page: Page): Locator => principal(page).getByRole('region', { name: /^Calendário de \d{4}$/ })
const secaoDosModelos = (page: Page): Locator => principal(page).getByRole('region', { name: 'Modelos de planilha' })
const painelDe = (page: Page, nome: string): Locator => page.getByRole('dialog', { name: nome })

/** A escola da coordenadora, com uma professora e duas turmas de 7º ano, cada uma com a disciplina e as aulas dela. */
interface EscolaComGrade {
  readonly coordenadora: EquipeDeTeste
  readonly professora: EquipeDeTeste
  readonly turmaA: string
  readonly turmaB: string
}

async function escolaComGrade(opcoes: { readonly comAulas?: boolean } = {}): Promise<EscolaComGrade> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  const professora = await criarProfessoraNaEscola(coordenadora)
  const marca = randomUUID().slice(0, 6)
  const a = await criarAlocacaoDoProfessor(coordenadora.escolaId, professora.usuarioId, ['Matemática'], `7ºA ${marca}`)
  const b = await criarAlocacaoDoProfessor(coordenadora.escolaId, professora.usuarioId, ['Português'], `7ºB ${marca}`)
  const [vinculoA] = a.vinculoIds
  const [vinculoB] = b.vinculoIds
  if (vinculoA === undefined || vinculoB === undefined) throw new Error('o seed não criou os vínculos')
  if (opcoes.comAulas !== false) {
    await criarAulasNoBanco(coordenadora.escolaId, vinculoA, [
      { dia: 1, inicio: '07:30', fim: '08:20' },
      { dia: 3, inicio: '08:20', fim: '09:10', sala: 'Lab 2' },
    ])
    await criarAulasNoBanco(coordenadora.escolaId, vinculoB, [{ dia: 1, inicio: '07:30', fim: '08:20' }])
  }
  return { coordenadora, professora, turmaA: a.turmaNome, turmaB: b.turmaNome }
}

/** A coordenação entra pela API e cai na aba, com a seção dos modelos à vista. */
async function abrirAAba(page: Page, request: APIRequestContext, coordenadora: EquipeDeTeste, endereco = ENDERECO): Promise<string> {
  return abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, endereco, () => expect(secaoDosModelos(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS }))
}

/** O texto do arquivo que a tela baixou, sem o BOM. */
async function textoBaixado(page: Page, acionar: () => Promise<void>): Promise<{ readonly nome: string; readonly texto: string }> {
  const baixando = page.waitForEvent('download')
  await acionar()
  const arquivo = await baixando
  return { nome: arquivo.suggestedFilename(), texto: readFileSync(await arquivo.path(), 'utf8').replace(/^\uFEFF/, '') }
}

/** Escolhe o arquivo no campo do painel, como o navegador o entrega. */
async function escolher(painel: Locator, nome: string, texto: string): Promise<void> {
  await painel.getByLabel(CAMPO_DO_ARQUIVO).setInputFiles({ name: nome, mimeType: 'text/csv', buffer: Buffer.from(texto, 'utf8') })
}

const resumoDaPrevia = (painel: Locator, texto: string | RegExp): Locator => painel.getByRole('status').filter({ hasText: texto })

test.describe('RF1 (14.0): a aba, os modelos e os estados', () => {
  test('a aba fica ao lado de Turmas, Professores e Material e acende Escola; cada modelo baixa o cabeçalho de packages/shared', async ({ page, request, hasTouch }) => {
    const { coordenadora } = await escolaComGrade()
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/estrutura', () => expect(principal(page).getByRole('tab', { name: 'Turmas' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS }))
    await irPelaCoordenacao(page, 'Grade e calendário', hasTouch)

    // A quarta aba, depois das três, no endereço dela, com o lugar aceso e o título da aba do navegador.
    await expect(principal(page).getByRole('tab')).toHaveText(['Turmas', 'Professores', 'Material', 'Grade e calendário'])
    await expect(principal(page).getByRole('tab', { name: 'Grade e calendário' })).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/\/coordenacao\/grade$/)
    await expect(page).toHaveTitle('Escola: grade e calendário · Turmma')
    await expect(secoes(page).getByRole('link', { name: 'Escola', exact: true })).toHaveAttribute('aria-current', 'page')

    // Os quatro modelos, cada um com o nome do arquivo e o cabeçalho que a prévia confere.
    const modelos = secaoDosModelos(page)
    const esperados = [
      ['Baixar modelo de alunos', 'modelo-alunos.csv', CABECALHOS_DA_PLANILHA.alunos],
      ['Baixar modelo de professores', 'modelo-professores.csv', CABECALHOS_DA_PLANILHA.professores],
      ['Baixar modelo da grade', 'modelo-grade.csv', CABECALHOS_DA_PLANILHA.grade],
      ['Baixar modelo do calendário', 'modelo-calendario.csv', CABECALHOS_DA_PLANILHA.calendario],
    ] as const
    for (const [botao, arquivo, cabecalho] of esperados) {
      const baixado = await textoBaixado(page, () => activate(modelos.getByRole('button', { name: botao }), hasTouch))
      expect(baixado.nome).toBe(arquivo)
      expect(baixado.texto).toBe(`${cabecalho.join(';')}\r\n`)
    }
  })

  test('o vazio convida a baixar o modelo; a tela cabe, tem alvos, uma ação cheia e axe limpo', async ({ page, request, hasTouch }) => {
    const { coordenadora } = await escolaComGrade({ comAulas: false })
    await abrirAAba(page, request, coordenadora)

    // Grade vazia, com turma: o convite diz o que fazer, e "Baixar modelo" baixa o da grade. O calendário vazio diz o mesmo, sem ação cheia.
    const grade = secaoDaGrade(page)
    await expect(grade.getByText(/ainda não tem aula na grade/)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const baixado = await textoBaixado(page, () => activate(grade.getByRole('button', { name: 'Baixar modelo', exact: true }), hasTouch))
    expect(baixado.nome).toBe('modelo-grade.csv')
    await expect(secaoDoCalendario(page).getByText('Nenhum evento no calendário de 2026')).toBeVisible()

    // A tela cabe (a página não rola a 1366 × 768 e nada rola de lado a 360 px), tem uma só ação cheia e os alvos pedidos.
    await paginaNaoRola(page)
    await expect(principal(page).locator('button.bg-laranja:visible')).toHaveCount(1)
    for (const botao of ['Baixar modelo de alunos', 'Baixar modelo de professores', 'Baixar modelo da grade', 'Baixar modelo do calendário']) {
      await alvoDeToque(secaoDosModelos(page).getByRole('button', { name: botao }), botao, 24)
    }
    await alvoDeToque(grade.getByRole('button', { name: 'Baixar modelo', exact: true }), 'Baixar modelo', ALVO_DE_TOQUE_PRINCIPAL_PX)
    await alvoDeToque(grade.getByRole('button', { name: 'Importar grade' }), 'Importar grade', 24)
    await alvoDeToque(secaoDoCalendario(page).getByRole('button', { name: 'Importar calendário' }), 'Importar calendário', 24)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('a leitura da grade carrega e falha com "Tentar de novo": o servidor volta e a tabela chega', async ({ page, request, hasTouch }) => {
    const { coordenadora, turmaA } = await escolaComGrade()
    const segurada = gate()
    let falhar = true
    await page.route(
      (url) => url.pathname === '/v1/grade',
      async (rota: Route) => {
        await segurada.aberta
        if (falhar) return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
        return rota.continue()
      },
    )
    await abrirAAba(page, request, coordenadora)

    // Carregando: a grade ainda não chegou, e a moldura e os modelos já estão à vista.
    await expect(secaoDaGrade(page).getByRole('status').filter({ hasText: 'Carregando a grade…' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    segurada.abrir()
    // Erro: diz o que fazer, e o calendário, que não falhou, segue de pé.
    await expect(secaoDaGrade(page).getByRole('alert').filter({ hasText: TEXTO_INDISPONIVEL })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(secaoDoCalendario(page)).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    falhar = false
    await activate(secaoDaGrade(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(secaoDaGrade(page).getByRole('region', { name: `Grade da turma ${turmaA}` })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(secaoDaGrade(page).getByRole('alert')).toHaveCount(0)
  })
})

test.describe('RF1 (14.0): a grade por turma e o calendário do ano', () => {
  test('a grade é uma tabela com cabeçalhos de dias e horários; trocar de turma mostra a outra, e a resposta atrasada da anterior não toma o lugar', async ({ page, request, hasTouch }) => {
    const { coordenadora, professora, turmaA, turmaB } = await escolaComGrade()
    // A grade da turma B fica retida: a pessoa troca para B, volta para A, e só então a resposta de B chega.
    const segurada = gate()
    const entregue = gate()
    const retida = new Set<string>()
    await page.route(
      (url) => url.pathname === '/v1/grade',
      async (rota: Route) => {
        if (!retida.has(new URL(rota.request().url()).searchParams.get('turmaId') ?? '')) return rota.continue()
        // A resposta retida é buscada no servidor e entregue à página depois que a porta abre. A tela pode já ter cancelado o pedido
        // (a leitura usa o `signal`): aí a entrega não encontra a quem entregar, e o que importa é que ela aconteceu.
        await segurada.aberta
        const resposta = await rota.fetch()
        await rota.fulfill({ response: resposta }).catch(() => undefined)
        entregue.abrir()
      },
    )
    await abrirAAba(page, request, coordenadora)

    // A turma A: cabeçalhos de coluna (Horário e os cinco dias), cabeçalho de linha com o horário, e cada aula na célula do dia dela.
    const regiaoA = secaoDaGrade(page).getByRole('region', { name: `Grade da turma ${turmaA}` })
    await expect(regiaoA).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(regiaoA.getByRole('columnheader')).toHaveText(['Horário', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'])
    await expect(regiaoA.getByRole('rowheader')).toHaveText(['07:30 – 08:20', '08:20 – 09:10'])
    const linhaDeManha = regiaoA.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '07:30 – 08:20' }) })
    await expect(linhaDeManha.getByRole('cell').nth(0)).toContainText(`Matemática${professora.nome}`)
    await expect(linhaDeManha.getByRole('cell').nth(1)).toContainText('Sem aula')
    const linhaDaTarde = regiaoA.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '08:20 – 09:10' }) })
    await expect(linhaDaTarde.getByRole('cell').nth(2)).toContainText('Sala Lab 2')
    // A grade traz o nome do professor e nunca o e-mail dele.
    await expect(regiaoA).not.toContainText('@')

    // Troca de turma com a resposta de B atrasada: a tela volta para A, e a de B, ao chegar, não toma o lugar.
    const idDeB = await turmaIdDaOpcao(page, turmaB)
    retida.add(idDeB)
    await seletorDeTurma(page).selectOption({ label: turmaB })
    await expect(secaoDaGrade(page).getByRole('status').filter({ hasText: 'Carregando a grade…' })).toBeVisible()
    await seletorDeTurma(page).selectOption({ label: turmaA })
    await expect(regiaoA).toBeVisible()
    // As asserções abaixo já eram verdade antes de a resposta de B existir: só valem depois que ela foi entregue à página e a tela teve
    // dois quadros para pintá-la.
    segurada.abrir()
    await entregue.aberta
    await page.evaluate(() => new Promise<void>((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver()))))
    await expect(secaoDaGrade(page).getByRole('region', { name: `Grade da turma ${turmaB}` })).toHaveCount(0)
    await expect(seletorDeTurma(page)).toHaveValue(await turmaIdDaOpcao(page, turmaA))
    await expect(regiaoA).toContainText('Matemática')
    await expect(linhaDeManha.getByRole('cell').nth(0)).toContainText(`Matemática${professora.nome}`)
    // De A para B, depois que a resposta de B já chegou: a tela mostra a B.
    retida.clear()
    await seletorDeTurma(page).selectOption({ label: turmaB })
    const regiaoB = secaoDaGrade(page).getByRole('region', { name: `Grade da turma ${turmaB}` })
    await expect(regiaoB).toContainText('Português', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(regiaoB).not.toContainText('Lab 2')

    // A 360 px a tabela rola dentro do cartão e a página não rola de lado; a 1366 px ela cabe, e o cartão não entra no Tab à toa.
    expect(await horizontalOverflow(page)).toBe(0)
    const rola = await regiaoB.evaluate((elemento) => elemento.scrollWidth > elemento.clientWidth)
    if (hasTouch) {
      expect(rola, 'a grade tem de rolar dentro do cartão a 360 px').toBe(true)
      await expect(regiaoB).toHaveAttribute('tabindex', '0')
    } else {
      expect(rola).toBe(false)
      await expect(regiaoB).not.toHaveAttribute('tabindex')
    }
    await paginaNaoRola(page)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('o calendário do ano em curso lista os eventos, e o seletor mostra o planejado só para ler', async ({ page, request }) => {
    const { coordenadora } = await escolaComGrade({ comAulas: false })
    await criarAnoLetivoNoBanco(coordenadora.escolaId, 2027, 'planejado')
    await criarEventoDoCalendarioNoBanco(coordenadora.escolaId, 'em_curso', { tipo: 'feriado', inicio: '2026-11-15', fim: '2026-11-15', descricao: 'Proclamação da República' })
    await criarEventoDoCalendarioNoBanco(coordenadora.escolaId, 'planejado', { tipo: 'recesso', inicio: '2027-07-05', fim: '2027-07-16', descricao: 'Recesso de julho' })
    await abrirAAba(page, request, coordenadora)

    const calendario = secaoDoCalendario(page)
    await expect(calendario.getByRole('heading', { name: 'Calendário de 2026' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(linhasDaTabela(calendario)).toHaveCount(1)
    await expect(calendario).toContainText('15 de novembro de 2026')
    await expect(calendario).toContainText('Feriado')
    await expect(calendario).toContainText('Proclamação da República')
    await expect(calendario).not.toContainText('Recesso de julho')
    await expect(calendario.getByRole('button', { name: 'Importar calendário' })).toBeVisible()

    // O planejado: só se lê. O evento dele aparece com o período, o do ano em curso sai, e a importação, que grava no ano em curso, some.
    await calendario.getByLabel('Ano letivo').selectOption({ label: '2027 (planejado)' })
    const doPlanejado = secaoDoCalendario(page)
    await expect(doPlanejado.getByRole('heading', { name: 'Calendário de 2027' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(doPlanejado).toContainText('5 de julho de 2027 a 16 de julho de 2027')
    await expect(doPlanejado).toContainText('Recesso de julho')
    await expect(doPlanejado).not.toContainText('Proclamação da República')
    await expect(doPlanejado).toContainText('só para ler')
    await expect(doPlanejado.getByRole('button', { name: 'Importar calendário' })).toHaveCount(0)
    await paginaNaoRola(page)

    await doPlanejado.getByLabel('Ano letivo').selectOption({ label: '2026 (em curso)' })
    await expect(secaoDoCalendario(page).getByRole('heading', { name: 'Calendário de 2026' })).toBeVisible()
    await expect(secaoDoCalendario(page).getByRole('button', { name: 'Importar calendário' })).toBeVisible()
  })

  test('a segunda pessoa na mesma aba: a coordenação de outra escola não vê a grade nem o calendário da anterior', async ({ page, request, hasTouch }) => {
    test.slow()
    const { coordenadora, turmaA } = await escolaComGrade()
    await criarEventoDoCalendarioNoBanco(coordenadora.escolaId, 'em_curso', { tipo: 'evento', inicio: '2026-09-10', fim: '2026-09-10', descricao: 'Feira de ciências da escola A' })
    await abrirAAba(page, request, coordenadora)
    await expect(secaoDaGrade(page).getByRole('region', { name: `Grade da turma ${turmaA}` })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(secaoDoCalendario(page)).toContainText('Feira de ciências da escola A')
    await activate(page.getByRole('button', { name: 'Sair' }).first(), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })

    // A de B entra na mesma aba, sem recarregar, com a leitura da grade retida: é aí que a grade de A apareceria.
    const deB = await criarEquipeComSenha('coordenador')
    const segurada = gate()
    await page.route(
      (url) => url.pathname === '/v1/grade' || url.pathname === '/v1/calendario',
      async (rota: Route) => {
        await segurada.aberta
        return rota.fallback()
      },
    )
    const { segredo } = await configurarSegundoFatorPelaApi(request, deB)
    await entrarPelaTelaComSegundoFator(page, deB, segredo, hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/painel$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await irPelaCoordenacao(page, 'Grade e calendário', hasTouch)
    await expect(principal(page).getByRole('status').filter({ hasText: /^Carregando/ }).first()).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(turmaA)
    await expect(page.locator('body')).not.toContainText('Feira de ciências da escola A')
    segurada.abrir()
    await expect(secaoDaGrade(page).getByText('Nenhuma turma ainda')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(secaoDoCalendario(page).getByText('Nenhum evento no calendário de 2026')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(turmaA)
    await expect(page.locator('body')).not.toContainText('Feira de ciências da escola A')
  })
})

/** O id da turma que a opção do seletor carrega, para o teste reter a leitura dela. */
async function turmaIdDaOpcao(page: Page, nome: string): Promise<string> {
  const valor = await seletorDeTurma(page).locator('option', { hasText: nome }).getAttribute('value')
  if (valor === null) throw new Error(`a turma ${nome} não está no seletor`)
  return valor
}

test.describe('RF7 e RF9 (14.0): importar a grade', () => {
  /** O arquivo da grade: o cabeçalho que a tela baixou no modelo, e as linhas. */
  const grade = (cabecalho: string, ...linhas: string[]): string => [cabecalho, ...linhas].join('\r\n') + '\r\n'

  test('o modelo baixado e preenchido entra sem erro; os avisos de horário aparecem e a grade grava; o mesmo arquivo de novo não muda nada, e o arquivo sem uma aula a tira do ano', async ({
    page,
    request,
    hasTouch,
  }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const marca = randomUUID().slice(0, 6)
    await abrirAAba(page, request, coordenadora)
    // A escola não tem turma: a seção da grade convida a importar, e é o botão dela que abre o painel.
    await expect(secaoDaGrade(page).getByText('Nenhuma turma ainda')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const modelo = await textoBaixado(page, () => activate(secaoDosModelos(page).getByRole('button', { name: 'Baixar modelo da grade' }), hasTouch))
    const cabecalho = modelo.texto.trim()
    expect(cabecalho).toBe(CABECALHOS_DA_PLANILHA.grade.join(';'))
    const ana = `ana-${marca}@educa.invalid`
    const bia = `bia-${marca}@educa.invalid`
    const aulaAnaA = `8º A;Matemática;Ana Prof ${marca};${ana};segunda;07:30;08:20;Sala 1`
    const aulaAnaB = `8º B;Matemática;Ana Prof ${marca};${ana};segunda;07:30;08:20;`
    const aulaBia = `8º A;Física;Bia Prof ${marca};${bia};terça;08:20;09:10;`
    const completa = grade(cabecalho, aulaAnaA, aulaAnaB, aulaBia)

    await activate(secaoDaGrade(page).getByRole('button', { name: 'Importar grade' }), hasTouch)
    const painel = painelDe(page, 'Importar grade')
    await expect(painel).toBeVisible()
    await expect(page).toHaveURL(/\?painel=importar-grade$/)
    await escolher(painel, 'grade.csv', completa)

    // A prévia: zero erro, o professor em duas turmas no mesmo horário é aviso nas duas linhas, e o que nasce vem em contagem.
    await expect(resumoDaPrevia(painel, '3 linhas lidas · 0 com erro · 2 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const avisos = painel.getByRole('region', { name: 'Linhas com aviso (2)' })
    await expect(avisos).toContainText('Linha 2: O mesmo professor tem aula em duas turmas neste horário')
    await expect(avisos).toContainText('Linha 3: O mesmo professor tem aula em duas turmas neste horário')
    const resto = painel.getByRole('region', { name: 'O resto da planilha' })
    await expect(resto).toContainText('2 turmas novas serão criadas.')
    await expect(resto).toContainText('2 disciplinas novas serão criadas.')
    await expect(resto).toContainText('2 professores novos serão cadastrados, com convite para copiar.')
    await expect(resto).toContainText('3 vínculos de professor serão criados e esperam a confirmação deles.')
    // A prévia não grava nada.
    expect(await aulasDaEscolaNoBanco(coordenadora.escolaId)).toBe(0)

    await painel.getByRole('button', { name: 'Gravar grade' }).click()
    await expect(painel.getByRole('region', { name: 'Planilha gravada' })).toContainText(
      '3 aulas gravadas. 2 turmas novas foram criadas. 2 disciplinas novas foram criadas. 2 professores novos foram cadastrados. 3 vínculos de professor esperam a confirmação deles.',
      { timeout: SIGN_IN_TIMEOUT_MS },
    )
    expect(await aulasDaEscolaNoBanco(coordenadora.escolaId)).toBe(3)

    // O mesmo arquivo de novo: tudo já existe, nada muda, e o botão de gravar não aparece. O foco volta ao título da prévia.
    await escolher(painel, 'grade.csv', completa)
    await expect(resumoDaPrevia(painel, '3 linhas lidas · 0 com erro · 2 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(painel.getByRole('heading', { name: 'Prévia' })).toBeFocused()
    await expect(painel.getByText(/Nada novo para gravar/)).toBeVisible()
    await expect(painel.getByRole('button', { name: 'Gravar grade' })).toHaveCount(0)
    await expect(painel.getByRole('region', { name: 'Planilha gravada' })).toHaveCount(0)

    // O arquivo sem a aula da Bia: ela sai do ano ao gravar, e o vínculo dela fica à escolha da coordenação (a marca "Saem da grade nova").
    await escolher(painel, 'grade-sem-bia.csv', grade(cabecalho, aulaAnaA, aulaAnaB))
    await expect(resumoDaPrevia(painel, '2 linhas lidas · 0 com erro · 2 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(painel.getByRole('region', { name: 'O resto da planilha' })).toContainText('1 aula já gravada sai do ano, porque a planilha não a traz.')
    const marcas = painel.getByRole('region', { name: 'Você decide' })
    await expect(marcas).toContainText(`Bia Prof ${marca} · 8º A · Física`)
    await expect(marcas.getByRole('checkbox', { name: `Bia Prof ${marca} · 8º A · Física` })).not.toBeChecked()
    await painel.getByRole('button', { name: 'Gravar grade' }).click()
    await expect(painel.getByRole('region', { name: 'Planilha gravada' })).toContainText('0 aulas gravadas. 1 aula saiu da grade.', { timeout: SIGN_IN_TIMEOUT_MS })
    expect(await aulasDaEscolaNoBanco(coordenadora.escolaId)).toBe(2)

    // A grade de trás já está atualizada: a 8º A tem só a aula de segunda, da Ana.
    await page.keyboard.press('Escape')
    await expect(painel).toHaveCount(0)
    await expect(seletorDeTurma(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await seletorDeTurma(page).selectOption({ label: '8º A' })
    const regiao = secaoDaGrade(page).getByRole('region', { name: 'Grade da turma 8º A' })
    await expect(regiao).toContainText(`Ana Prof ${marca}`, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(regiao).toContainText('Sala Sala 1')
    await expect(regiao).not.toContainText(`Bia Prof ${marca}`)
  })

  test('o painel da grade cabe, tem alvos e uma ação cheia; a prévia com erro não grava, e a falha da gravação com o painel aberto deixa gravar de novo', async ({ page, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    await abrirAAba(page, request, coordenadora)
    await activate(secaoDaGrade(page).getByRole('button', { name: 'Importar grade' }), hasTouch)
    const painel = painelDe(page, 'Importar grade')
    const cabecalho = CABECALHOS_DA_PLANILHA.grade.join(';')

    // Três linhas erradas: a prévia aponta as três, com o que fazer, o botão de gravar nem aparece, e o banco não muda.
    await escolher(
      painel,
      'suja.csv',
      [cabecalho, '8º A;Matemática;Ana;ana@educa.invalid;domingão;07:30;08:20;', '8º A;Matemática;Ana;ana@educa.invalid;segunda;09:00;08:00;', '8º A;Matemática;Ana;sem-arroba;segunda;07:30;08:20;'].join('\n') + '\n',
    )
    await expect(resumoDaPrevia(painel, '3 linhas lidas · 3 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const erros = painel.getByRole('region', { name: 'Linhas com erro (3)' })
    await expect(erros).toContainText('Linha 2: Não entendi o dia.')
    await expect(erros).toContainText('Linha 3: O fim vem antes do início')
    await expect(erros).toContainText('Linha 4: O e-mail do professor não parece um e-mail.')
    await expect(painel.getByRole('button', { name: 'Gravar grade' })).toHaveCount(0)
    expect(await aulasDaEscolaNoBanco(coordenadora.escolaId)).toBe(0)

    // Uma planilha boa: a tela cabe, tem uma só ação cheia (o gravar) e os alvos pedidos, e o axe não acha nada.
    await escolher(painel, 'boa.csv', [cabecalho, '8º A;Matemática;Ana;ana-14@educa.invalid;segunda;07:30;08:20;'].join('\n') + '\n')
    await expect(resumoDaPrevia(painel, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(await horizontalOverflow(page)).toBe(0)
    await expect(painel.locator('button.bg-laranja:visible')).toHaveCount(1)
    await alvoDeToque(painel.getByRole('button', { name: 'Gravar grade' }), 'Gravar grade', ALVO_DE_TOQUE_PRINCIPAL_PX)
    await alvoDeToque(painel.getByRole('button', { name: 'Baixar modelo' }), 'Baixar modelo', 24)
    await alvoDeToque(painel.getByRole('button', { name: 'Trocar arquivo' }), 'Trocar arquivo', 24)
    expect(await seriousViolations(page)).toEqual([])

    // A gravação falha com o painel aberto: o texto diz que nada foi gravado, o painel segue aberto e a prévia vale; com o servidor de volta, grava.
    let falhar = true
    await page.route('**/v1/importacoes/grade', (rota: Route) => (falhar && rota.request().method() === 'POST' ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.continue()))
    await activate(painel.getByRole('button', { name: 'Gravar grade' }), hasTouch)
    await expect(painel.getByRole('alert').filter({ hasText: TEXTO_INDISPONIVEL })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(painel).toBeVisible()
    expect(await aulasDaEscolaNoBanco(coordenadora.escolaId)).toBe(0)
    falhar = false
    await activate(painel.getByRole('button', { name: 'Gravar grade' }), hasTouch)
    await expect(painel.getByRole('region', { name: 'Planilha gravada' })).toContainText('1 aula gravada.', { timeout: SIGN_IN_TIMEOUT_MS })
    expect(await aulasDaEscolaNoBanco(coordenadora.escolaId)).toBe(1)
  })
})

test.describe('RF10 (14.0): importar o calendário', () => {
  test('a data fora do ano é erro e nada grava; o calendário novo substitui o do ano, e a prévia diz o que entra e o que sai', async ({ page, request, hasTouch }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    await criarEventoDoCalendarioNoBanco(coordenadora.escolaId, 'em_curso', { tipo: 'feriado', inicio: '2026-04-21', fim: '2026-04-21', descricao: 'Tiradentes' })
    await abrirAAba(page, request, coordenadora)
    const modelo = await textoBaixado(page, () => activate(secaoDosModelos(page).getByRole('button', { name: 'Baixar modelo do calendário' }), hasTouch))
    const cabecalho = modelo.texto.trim()
    expect(cabecalho).toBe(CABECALHOS_DA_PLANILHA.calendario.join(';'))
    const republica = '15/11/2026;15/11/2026;feriado;Proclamação da República'
    const de2027 = '2027-01-10;2027-01-10;feriado;Feriado de 2027'

    await activate(secaoDoCalendario(page).getByRole('button', { name: 'Importar calendário' }), hasTouch)
    const painel = painelDe(page, 'Importar calendário')
    await expect(painel).toBeVisible()
    await expect(page).toHaveURL(/\?painel=importar-calendario$/)

    // Feriado de 2027 no ano de 2026: erro na linha, sem botão de gravar, e o banco não muda.
    await escolher(painel, 'calendario.csv', [cabecalho, republica, de2027].join('\r\n') + '\r\n')
    await expect(resumoDaPrevia(painel, '2 linhas lidas · 1 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(painel.getByRole('region', { name: 'Linhas com erro (1)' })).toContainText('Linha 3: A data cai fora do ano letivo.')
    await expect(painel.getByRole('button', { name: 'Gravar calendário' })).toHaveCount(0)
    expect(await eventosDaEscolaNoBanco(coordenadora.escolaId)).toBe(1)

    // Sem a linha de 2027: um evento entra e o Tiradentes, que a planilha não traz, sai. A prévia diz os dois, e o modelo preenchido entra sem erro.
    await escolher(painel, 'calendario-certo.csv', [cabecalho, republica].join('\r\n') + '\r\n')
    await expect(resumoDaPrevia(painel, '1 linha lida · 0 com erro · 0 com aviso')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const resto = painel.getByRole('region', { name: 'O resto da planilha' })
    await expect(resto).toContainText('1 linha entra')
    await expect(resto).toContainText('1 evento já gravado sai do ano, porque a planilha não o traz.')
    expect(await eventosDaEscolaNoBanco(coordenadora.escolaId)).toBe(1)
    await activate(painel.getByRole('button', { name: 'Gravar calendário' }), hasTouch)
    await expect(painel.getByRole('region', { name: 'Planilha gravada' })).toContainText('1 evento entrou no calendário. 1 evento saiu do calendário.', { timeout: SIGN_IN_TIMEOUT_MS })
    expect(await eventosDaEscolaNoBanco(coordenadora.escolaId)).toBe(1)

    // O calendário de trás já está atualizado: a República entrou e o Tiradentes saiu.
    await page.keyboard.press('Escape')
    await expect(painel).toHaveCount(0)
    await expect(secaoDoCalendario(page)).toContainText('Proclamação da República', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(secaoDoCalendario(page)).not.toContainText('Tiradentes')
    // O mesmo arquivo de novo: nada novo e nada a tirar.
    await activate(secaoDoCalendario(page).getByRole('button', { name: 'Importar calendário' }), hasTouch)
    await escolher(painelDe(page, 'Importar calendário'), 'calendario-certo.csv', [cabecalho, republica].join('\r\n') + '\r\n')
    await expect(painelDe(page, 'Importar calendário').getByText(/Nada novo para gravar/)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(painelDe(page, 'Importar calendário').getByRole('button', { name: 'Gravar calendário' })).toHaveCount(0)
  })
})
