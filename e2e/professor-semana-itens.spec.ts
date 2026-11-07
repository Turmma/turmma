import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { criarAtividadeNoBanco, ProfessoraApiClient } from './support/atividade-db.ts'
import { entrarComoAlunoPelaApi, responderPelaApi } from './support/aluno-api.ts'
import { entrarPelaApiSemMedirAPrimeiraCarga, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { horizontalOverflow } from './support/checks.ts'
import { expect, test } from './support/profiles.ts'
import { activate, irPara, soOPainelDaAbaRola, VOCABULARIO_DE_NOTA } from './support/professor/scenario.ts'
import { abrirASemana, cartaoDaAula, diaDeHoje, diaPorExtenso, disciplinaDoVinculo, gradeDeHoje, montarASemana, noCelular, tituloDaSemana, type CenaDaSemana, type CenaOptions } from './support/professor/semana.ts'
import { colocarAlunoNaTurma, confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarAlunoComMatricula, criarAulasNoBanco, type AlunoDeTeste } from './support/seed.ts'

/**
 * Os itens do dia na Semana e "Ver a semana desta turma" (F2b, 8.0; RF4, RF7; T5, T6): a atividade aplicada, a encerrada e a correção do
 * Assistente, no dia em que aconteceram, cada uma levando ao lugar dela; e o Hoje da turma aberta levando à Semana só com aquela turma e
 * disciplina. A API, o banco e a sessão são os de verdade: a atividade é aplicada pela professora, o aluno responde e ela encerra, tudo pela
 * API (`atividade-db.ts`, `aluno-api.ts`), e o relógio é o da máquina, por isso os itens são sempre de **hoje**. Cada caso paga uma entrada.
 */

const QUIMICA = 'Atividade de estequiometria'
const FRACOES = 'Atividade de frações'

const aplicada = (page: Page, titulo: string): Locator => page.getByRole('link', { name: `Atividade aplicada: ${titulo}`, exact: true })
const encerrada = (page: Page, titulo: string): Locator => page.getByRole('link', { name: `Atividade encerrada: ${titulo}`, exact: true })
const correcao = (page: Page, titulo: string): Locator => page.getByRole('link', { name: `Correção do Assistente · Para revisar, gerado por inteligência artificial: ${titulo}`, exact: true })

interface CenaDeItens {
  readonly cena: CenaDaSemana
  readonly aluno: AlunoDeTeste
  /** A atividade de Química, na turma 0. */
  readonly atividadeId: string
}

interface Opcoes {
  /** O aluno responde e a professora encerra: nascem os três itens (aplicada, encerrada e correção para revisar). Sem isso, só a aplicada. */
  readonly encerrar: boolean
  /** Uma atividade de Matemática aplicada à turma 1, para o filtro ter o que cortar. */
  readonly matematica?: boolean
  readonly grade?: CenaOptions['grade']
}

/** A professora com Química e Matemática, a atividade de Química aplicada (e encerrada, com um aluno que respondeu) e, se pedido, a de Matemática. */
async function montarOsItens(request: APIRequestContext, opcoes: Opcoes): Promise<CenaDeItens> {
  const cena = await montarASemana({ disciplinas: ['Química', 'Matemática', 'História'], grade: opcoes.grade ?? gradeDeHoje })
  const [quimica, matematica] = cena.turmas
  if (quimica === undefined || matematica === undefined) throw new Error('a cena não montou as turmas')
  const { escolaId, usuarioId } = cena.professora
  const aluno = await criarAlunoComMatricula({ escola: cena.professora })
  await colocarAlunoNaTurma(aluno, { turmaId: quimica.turmaId, turmaNome: quimica.turmaNome, serieNome: '' })
  const dela = await ProfessoraApiClient.entrar(request, cena.professora)
  const { artefatoId } = await criarAtividadeNoBanco(escolaId, usuarioId, quimica.turmaId, 'Química', QUIMICA)
  const atividadeId = await dela.aplicar(artefatoId, quimica.turmaId, true)
  if (opcoes.encerrar) {
    await responderPelaApi(request, await entrarComoAlunoPelaApi(request, aluno), atividadeId, [0, 1, null])
    await dela.encerrar(atividadeId)
  }
  if (opcoes.matematica === true) {
    const outra = await criarAtividadeNoBanco(escolaId, usuarioId, matematica.turmaId, 'Matemática', FRACOES)
    await dela.aplicar(outra.artefatoId, matematica.turmaId, false)
  }
  return { cena, aluno, atividadeId }
}

test.describe('os itens do dia: cada um leva ao lugar dele (T6, RF7)', () => {
  test('T6: o item da atividade abre o painel dela na turma certa; clicado duas vezes, abre o painel uma vez', async ({ page, request }) => {
    const { cena, atividadeId } = await montarOsItens(request, { encerrar: true })
    const [quimica] = cena.turmas
    await abrirASemana(page, cena)
    const item = aplicada(page, QUIMICA)
    await expect(item).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(item).toHaveAttribute('href', new RegExp(`^/professor/turmas/${quimica?.turmaId}\\?aba=atividades&atividade=${atividadeId}$`))

    await item.dblclick()
    await expect(page).toHaveURL(new RegExp(`/professor/turmas/${quimica?.turmaId}\\?aba=atividades&atividade=${atividadeId}$`))
    await expect(page.getByRole('dialog', { name: QUIMICA })).toHaveCount(1, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('tab', { name: 'Atividades', selected: true })).toBeVisible()
    // Uma entrada no histórico: o Voltar sai da turma e volta à Semana.
    await page.goBack()
    await expect(tituloDaSemana(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page).toHaveURL(/\/professor\/turmas\?ver=semana$/)
  })

  test('T6: o item da correção abre a revisão da correção', async ({ page, request, hasTouch }) => {
    const { cena, atividadeId } = await montarOsItens(request, { encerrar: true })
    await abrirASemana(page, cena)
    const item = correcao(page, QUIMICA)
    await expect(item).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(item).toHaveAttribute('href', `/professor/aprovar/${atividadeId}`)
    await activate(item, hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/aprovar/${atividadeId}$`))
    await expect(page.getByRole('heading', { level: 1, name: 'Revisar a correção' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('os três itens têm nome acessível (tipo, estado, título) e alvo de 24 × 24; sem palavra de nota nem nome de aluno', async ({ page, request }) => {
    const { cena, aluno } = await montarOsItens(request, { encerrar: true })
    await abrirASemana(page, cena)
    const itens = page.getByRole('list', { name: 'O que aconteceu neste dia' })
    await expect(itens).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(itens.getByRole('link')).toHaveCount(3)
    for (const link of [aplicada(page, QUIMICA), encerrada(page, QUIMICA), correcao(page, QUIMICA)]) {
      await expect(link).toBeVisible()
      const caixa = await link.boundingBox()
      expect(caixa?.width ?? 0, 'largura do alvo').toBeGreaterThanOrEqual(24)
      expect(caixa?.height ?? 0, 'altura do alvo').toBeGreaterThanOrEqual(24)
    }
    // Regra 70, item 7: nem nota, conceito ou pontuação, nem acerto, nem o nome de quem respondeu.
    await expect(itens).not.toContainText(VOCABULARIO_DE_NOTA)
    await expect(itens).not.toContainText(/\d+ de \d+|%|acert/i)
    await expect(page.locator('body')).not.toContainText(aluno.nome)
  })

  test('com `?turma=`, o item de outra turma, que também é de outra disciplina, some junto das aulas', async ({ page, request }) => {
    const { cena } = await montarOsItens(request, { encerrar: false, matematica: true })
    const [quimica, matematica] = cena.turmas
    await abrirASemana(page, cena)
    await expect(aplicada(page, QUIMICA)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(aplicada(page, FRACOES)).toBeVisible()

    const disciplinaId = await disciplinaDoVinculo(cena.professora.escolaId, quimica?.vinculoIds[0] ?? '')
    await irPara(page, `/professor/turmas?ver=semana&turma=${quimica?.turmaId}.${disciplinaId}`)
    await expect(aplicada(page, QUIMICA)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(aplicada(page, FRACOES)).toHaveCount(0)
    // A aula de Matemática, da outra turma, também saiu: o filtro corta as aulas e os itens juntos.
    await expect(page.getByRole('button', { name: new RegExp(`, ${matematica?.turmaNome}, Matemática$`) })).toHaveCount(0)
    await expect(cartaoDaAula(page, `${diaPorExtenso(cena.hoje)}, 7h30, ${quimica?.turmaNome}, Química`)).toBeVisible()
  })
})

test.describe('o computador e o celular com itens (RF22, D51)', () => {
  test('a 1366 × 768 só o painel da aba rola, e a 360 px não há rolagem de lado, com 45 aulas e os itens do dia', async ({ page, request }) => {
    const horarios = [
      ['07:30', '08:20'],
      ['08:20', '09:10'],
      ['09:10', '10:00'],
      ['10:20', '11:10'],
      ['11:10', '12:00'],
      ['12:00', '12:50'],
      ['13:30', '14:20'],
      ['14:20', '15:10'],
      ['15:10', '16:00'],
    ] as const
    const dias = [...new Set([1, 2, 3, 4, 5, diaDeHoje()])]
    const { cena } = await montarOsItens(request, {
      encerrar: true,
      grade: (indice) => dias.flatMap((dia) => [0, 1, 2].map((ordem) => ({ dia, inicio: horarios[indice * 3 + ordem]?.[0] ?? '', fim: horarios[indice * 3 + ordem]?.[1] ?? '' }))),
    })
    await abrirASemana(page, cena)
    await expect(correcao(page, QUIMICA)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(await horizontalOverflow(page)).toBe(0)
    if (noCelular(page)) {
      await expect(aplicada(page, QUIMICA)).toBeVisible()
      return
    }
    await soOPainelDaAbaRola(page)
  })
})

test.describe('"Ver a semana desta turma" no Hoje (T5, RF4)', () => {
  test('T5: o link leva à Semana só com a turma e disciplina, e o filtro mostra a opção dela', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    const [matematica, historia] = cena.turmas
    await entrarNoHoje(page, cena, matematica?.turmaId ?? '')
    const link = page.getByRole('link', { name: 'Ver a semana desta turma', exact: true })
    await expect(link).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const disciplinaId = await disciplinaDoVinculo(cena.professora.escolaId, matematica?.vinculoIds[0] ?? '')
    await expect(link).toHaveAttribute('href', `/professor/turmas?ver=semana&turma=${matematica?.turmaId}.${disciplinaId}`)

    await activate(link, hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/turmas\\?ver=semana&turma=${matematica?.turmaId}\\.${disciplinaId}$`))
    await expect(tituloDaSemana(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByLabel('Turma e disciplina')).toHaveValue(`${matematica?.turmaId}.${disciplinaId}`)
    await expect(page.getByRole('button', { name: new RegExp(`, ${matematica?.turmaNome}, Matemática$`) })).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(`, ${historia?.turmaNome}, História$`) })).toHaveCount(0)
  })

  test('T5: a turma aberta com duas disciplinas da professora tem um link para cada, e cada um leva à Semana da sua', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ disciplinas: ['Matemática'], grade: gradeDeHoje })
    const { escolaId, usuarioId } = cena.professora
    const dupla = await criarAlocacaoDoProfessor(escolaId, usuarioId, ['Física', 'História'])
    await confirmarVinculosNoBanco(escolaId, dupla.vinculoIds)
    const [fisicaVinculo = '', historiaVinculo = ''] = dupla.vinculoIds
    await criarAulasNoBanco(escolaId, fisicaVinculo, [{ dia: diaDeHoje(), inicio: '09:10', fim: '10:00' }])
    await criarAulasNoBanco(escolaId, historiaVinculo, [{ dia: diaDeHoje(), inicio: '10:20', fim: '11:10' }])
    await entrarNoHoje(page, cena, dupla.turmaId)

    const fisica = page.getByRole('link', { name: 'Ver a semana desta turma · Física', exact: true })
    const historia = page.getByRole('link', { name: 'Ver a semana desta turma · História', exact: true })
    await expect(fisica).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(historia).toBeVisible()
    // O texto com a disciplina é mais longo: no celular o link quebra em duas linhas, sem estourar a largura nem sair da tela.
    expect(await horizontalOverflow(page)).toBe(0)
    for (const link of [fisica, historia]) await esperarLinkInteiroEComAlvoGrande(page, link)
    await expect(page.getByRole('link', { name: 'Ver a semana desta turma', exact: true })).toHaveCount(0)

    const disciplinaId = await disciplinaDoVinculo(escolaId, fisicaVinculo)
    await activate(fisica, hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/turmas\\?ver=semana&turma=${dupla.turmaId}\\.${disciplinaId}$`))
    await expect(page.getByLabel('Turma e disciplina')).toHaveValue(`${dupla.turmaId}.${disciplinaId}`)
    await expect(page.getByRole('button', { name: new RegExp(`, ${dupla.turmaNome}, Física$`) })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('button', { name: new RegExp(`, ${dupla.turmaNome}, História$`) })).toHaveCount(0)
  })
})

/** O link cabe na largura da tela e o alvo dele tem pelo menos 44 px de altura. */
async function esperarLinkInteiroEComAlvoGrande(page: Page, link: Locator): Promise<void> {
  const caixa = await link.boundingBox()
  expect(caixa, 'o link tem caixa').not.toBeNull()
  expect((caixa?.x ?? 0) + (caixa?.width ?? 0), 'o link cabe na largura da tela').toBeLessThanOrEqual(page.viewportSize()?.width ?? 0)
  expect(caixa?.height ?? 0, 'o alvo do link tem pelo menos 44 px').toBeGreaterThanOrEqual(44)
}

/** A professora entra pela API e abre o Hoje da turma, numa carga só. */
async function entrarNoHoje(page: Page, cena: Pick<CenaDaSemana, 'professora'>, turmaId: string): Promise<void> {
  await entrarPelaApiSemMedirAPrimeiraCarga(page, cena.professora, `/professor/turmas/${turmaId}`, async () => {
    await expect(page.getByRole('region', { name: 'Sinais da turma' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  })
}
