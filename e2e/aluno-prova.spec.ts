import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { comecarPelaApi, enviarPelaApi, entrarComoAlunoPelaApi, lerAProvaPelaApi, responderPelaApiOriginal } from './support/aluno-api.ts'
import { ALTERNATIVA_CERTA_DA_QUESTAO_3, criarAtividadeNoBanco, GABARITO_DO_FLUXO, ProfessoraApiClient, respostasNoBanco } from './support/atividade-db.ts'
import { SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, rawCodePattern, seriousViolations } from './support/checks.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { activate } from './support/professor-flow.ts'
import { expect, test } from './support/profiles.ts'
import { colocarAlunoNaTurma, confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarAlunoComMatricula, criarEquipeComSenha, type AlunoDeTeste, type TurmaDoAlunoDeTeste } from './support/seed.ts'

/**
 * **A prova em foco, do lado do aluno** (avaliacao-e-correcao, 12.0; RF6, RF7, RF8; regra 80, item 6), contra a API real, nos projetos `chromebook` e `celular` (360 px), com axe.
 * A professora faz a parte dela pela API (`ProfessoraApiClient`); o aluno entra pela API e abre direto a tela que o caso prova: a carga do aplicativo no Chromebook com CPU ×4 já
 * custa uns 8 s, e por isso cada caso prova uma coisa. O fluxo inteiro, da lista ao diagnóstico, é de `aluno-fluxo.spec.ts`.
 */
const DISCIPLINA = 'Química'
const TITULO = 'Prova de estequiometria'
const PRAZO_MS = 15_000
/** A volta da rede espera de 0 a 5 s (o sorteio), e a fila segue em série: o teste espera com folga. */
const PRAZO_DA_VOLTA_MS = 25_000

interface Cena {
  readonly aluno: AlunoDeTeste
  readonly escolaId: string
  readonly dela: ProfessoraApiClient
  readonly atividadeId: string
  readonly nomeDaProfessora: string
  readonly turma: TurmaDoAlunoDeTeste
  /** O token do aluno (a mesma sessão do cookie), para a parte dele que o caso faz pela API. */
  readonly token: string
}

interface CenaOptions {
  readonly prova?: Parameters<ProfessoraApiClient['aplicar']>[3]
  /** O aluno já começou a prova (pela API): o caso abre direto a tela de foco, sem passar por "Antes de começar" (o que custa uns 2 s de um caso de 15 s). */
  readonly jaComecou?: boolean
}

/** A escola com a professora, a turma de Química, a aluna e a prova aplicada (aberta desde uma hora atrás, com 60 min), com a sessão da aluna aberta no contexto da página. */
async function montarCena(page: Page, request: APIRequestContext, { prova = { duracaoMin: 60 }, jaComecou = false }: CenaOptions = {}): Promise<Cena> {
  const professora = await criarEquipeComSenha()
  const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, [DISCIPLINA])
  await confirmarVinculosNoBanco(professora.escolaId, alocacao.vinculoIds)
  const aluno = await criarAlunoComMatricula({ escola: professora, nome: 'Ana Souza' })
  const turma = await colocarAlunoNaTurma(aluno, { turmaId: alocacao.turmaId, turmaNome: alocacao.turmaNome, serieNome: '' })
  const { artefatoId } = await criarAtividadeNoBanco(professora.escolaId, professora.usuarioId, alocacao.turmaId, DISCIPLINA, TITULO)
  const dela = await ProfessoraApiClient.entrar(request, professora)
  const atividadeId = await dela.aplicar(artefatoId, alocacao.turmaId, true, prova)
  // Os pedaços do aplicativo (`/assets/…`) são uns 40, e na rede lenta do perfil eles chegam em ondas de 0,5 s: a carga sozinha leva uns 10 s de um caso de 15 s. Eles vêm
  // direto (a carga do aplicativo na rede lenta é de `casca.spec.ts`); a CPU ×4 e a rede do perfil seguem para tudo o que estes casos provam: as chamadas à API, a fila e o relógio.
  await page.route('**/assets/**', async (rota) => rota.fulfill({ response: await rota.fetch() }))
  // A sessão da aluna abre pela API, no contexto da página: o cookie vai junto, e a tela já abre dentro dela.
  const token = await entrarComoAlunoPelaApi(page.request, aluno)
  if (jaComecou) await comecarPelaApi(request, token, atividadeId)
  return { aluno, escolaId: professora.escolaId, dela, atividadeId, nomeDaProfessora: professora.nome, turma, token }
}

/** Quantas aplicações o caso tenta até o sorteio tirar a certa da posição original: cada uma custa uns 0,4 s, e a chance de errar as seis é de 1 em 64⁶. */
const TENTATIVAS_DO_SORTEIO = 6

/**
 * A cena de uma prova com "embaralhar" ligado **em que o sorteio deslocou a alternativa certa** (de qualquer questão, ou da `numero` pedida): sem isso, em 1 sorteio a cada 64 as três certas ficam onde estavam,
 * e a tela que manda a posição em vez do índice original acertaria igual e o caso não a distinguiria. Lê a prova do aluno pela API e, se o sorteio não deslocou, aplica outra.
 */
async function montarCenaEmbaralhada(page: Page, request: APIRequestContext, numero?: number): Promise<Cena> {
  for (let tentativa = 1; tentativa <= TENTATIVAS_DO_SORTEIO; tentativa += 1) {
    const cena = await montarCena(page, request, { prova: { duracaoMin: 60, embaralhar: { questoes: true, alternativas: true } }, jaComecou: true })
    const prova = await lerAProvaPelaApi(request, cena.token, cena.atividadeId)
    const deslocada = prova.questoes.some((questao) => {
      const gabarito = GABARITO_DO_FLUXO[questao.numero - 1]
      return (numero === undefined || questao.numero === numero) && gabarito !== undefined && questao.ordemDasAlternativas.indexOf(gabarito) !== gabarito
    })
    if (deslocada) return cena
  }
  throw new Error(`o sorteio deixou a alternativa certa na posição original em ${String(TENTATIVAS_DO_SORTEIO)} aplicações seguidas`)
}

const principal = (page: Page): Locator => page.getByRole('main')
const relogio = (page: Page): Locator => page.locator('[data-relogio]')
const salvo = (page: Page): Locator => page.locator('[data-salvo]')
const faixa = (page: Page): Locator => page.locator('[data-faixa-da-prova]')
const sairDaProva = (page: Page): Locator => faixa(page).getByRole('button', { name: 'Sair da prova' })
const radio = (page: Page, texto: string | RegExp): Locator => principal(page).getByRole('radio', { name: texto })
const minutos = (texto: string): number => Number(/\d+/.exec(texto)?.[0])

/** A caixa do elemento na página; se ele não está na tela o caso cai aqui, com o nome do problema. */
async function caixaDe(local: Locator): Promise<{ readonly x: number; readonly y: number; readonly width: number; readonly height: number }> {
  const caixa = await local.boundingBox()
  if (caixa === null) throw new Error('o elemento da faixa da prova não está na tela')
  return caixa
}

/** Abre a prova em foco direto pelo endereço, com o relógio já lido. */
async function abrirAProva(page: Page, atividadeId: string): Promise<void> {
  await page.goto(`/aluno/prova/${atividadeId}`)
  await expect(relogio(page)).toContainText(/^Faltam \d+ min$/, { timeout: SIGN_IN_TIMEOUT_MS })
}

test.describe('a prova em foco, contra a API real (12.0)', () => {
  test('antes de começar diz a duração e o aviso da aba, sem a palavra "adicional" nem questão nenhuma, com o botão de 44 px e sem violação', async ({ page, request }) => {
    const { atividadeId } = await montarCena(page, request)
    await page.goto(`/aluno/atividades/${atividadeId}`)

    await expect(page.getByRole('heading', { name: 'Antes de começar' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page)).toContainText('Esta prova tem 60 minutos, contados a partir de Começar.')
    await expect(principal(page)).toContainText('Se você sair desta aba, isso aparece para o professor. Nada acontece com a sua prova.')
    await expect(principal(page)).toContainText('Para sair, use Sair da prova. O tempo continua.')
    await expect(principal(page)).not.toContainText(/adicional/i)
    await expect(principal(page).getByRole('radio')).toHaveCount(0)
    expect((await page.getByRole('button', { name: 'Começar' }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    await paginaNaoRola(page)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('"Começar" abre a prova sem lateral nem Tutor, com o relógio e sem violação de acessibilidade', async ({ page, hasTouch, request }) => {
    const { atividadeId } = await montarCena(page, request)
    await page.goto(`/aluno/atividades/${atividadeId}`)
    await activate(page.getByRole('button', { name: 'Começar' }), hasTouch)

    await expect(page).toHaveURL(new RegExp(`/aluno/prova/${atividadeId}$`), { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(relogio(page)).toContainText(/^Faltam \d+ min$/, { timeout: PRAZO_MS })
    // Tela de foco: nada de lateral, de barra de baixo, de Tutor.
    await expect(page.getByRole('navigation', { name: 'Seções', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Tutor/ })).toHaveCount(0)
    await expect(principal(page)).not.toContainText(/Tutor/)
    await expect(radio(page, /^A\./)).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    for (const cru of [rawCodePattern('503'), 'INDISPONIVEL']) await expect(page.locator('body')).not.toContainText(cru)
  })

  test('a faixa é de uma linha, "Sair da prova" tem 44 px e a página não rola de lado (360 px e 1366 × 768)', async ({ page, request }) => {
    const { atividadeId } = await montarCena(page, request, { jaComecou: true })
    await abrirAProva(page, atividadeId)

    const caixaDaFaixa = await caixaDe(faixa(page))
    const caixaDoRelogio = await caixaDe(relogio(page))
    const caixaDoSair = await caixaDe(sairDaProva(page))
    // Uma linha: a faixa não passa de um botão de 44 px com folga, e o relógio e o botão estão na mesma altura.
    expect(caixaDaFaixa.height).toBeLessThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX + 24)
    expect(caixaDoSair.height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(caixaDoSair.width).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(Math.abs(caixaDoRelogio.y - caixaDoSair.y)).toBeLessThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    await paginaNaoRola(page)
  })

  test('a rede cai: "Sem conexão", três respostas guardadas; a rede volta e cada uma é gravada uma vez, com o mesmo relógio', async ({ page, hasTouch, request, context }) => {
    // A espera sorteada da volta da rede (0 a 5 s, `ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS`) é provada na unidade (`respostas.test.ts`); aqui o sorteio dá 0 para o caso caber nos 15 s.
    await page.addInitScript(() => {
      Math.random = () => 0
    })
    const { atividadeId, aluno, escolaId } = await montarCena(page, request, { jaComecou: true })
    await abrirAProva(page, atividadeId)
    const antesDaQueda = await relogio(page).innerText()

    await context.setOffline(true)
    for (const [indice, letra] of ['B', 'C', 'A'].entries()) {
      await activate(radio(page, new RegExp(`^${letra}\\.`)), hasTouch)
      if (indice < 2) await activate(principal(page).getByRole('button', { name: /Próxima/ }), hasTouch)
    }
    await expect(page.getByText(/^Sem conexão\./)).toBeVisible({ timeout: PRAZO_MS })
    await expect(salvo(page)).toHaveText('Salvando…')
    // O relógio não parou com a queda: é o do servidor.
    await expect(relogio(page)).toContainText(/^Faltam \d+ min$/)

    await context.setOffline(false)
    await expect(salvo(page)).toHaveText('Salvo', { timeout: PRAZO_DA_VOLTA_MS })
    await expect(page.getByText(/^Sem conexão\./)).toHaveCount(0)
    // Cada uma chegou, e uma vez só: o servidor tem as três, nas alternativas que o aluno marcou (B, C e A).
    expect(await respostasNoBanco(escolaId, atividadeId, aluno.usuarioId)).toEqual([
      { questao: 1, alternativa: 1 },
      { questao: 2, alternativa: 2 },
      { questao: 3, alternativa: 0 },
    ])
    expect(minutos(await relogio(page).innerText())).toBeLessThanOrEqual(minutos(antesDaQueda))
    expect(minutos(await relogio(page).innerText())).toBeGreaterThanOrEqual(minutos(antesDaQueda) - 2)
  })

  test('"Sair da prova" é um clique, sem confirmação, e leva à lista com a resposta já salva', async ({ page, hasTouch, request }) => {
    const { atividadeId, aluno, escolaId } = await montarCena(page, request, { jaComecou: true })
    await abrirAProva(page, atividadeId)
    await activate(radio(page, /^B\./), hasTouch)
    await expect(salvo(page)).toHaveText('Salvo', { timeout: PRAZO_MS })

    await activate(sairDaProva(page), hasTouch)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page).toHaveURL(/\/aluno\/atividades$/, { timeout: PRAZO_MS })
    expect(await respostasNoBanco(escolaId, atividadeId, aluno.usuarioId)).toEqual([{ questao: 1, alternativa: 1 }])
  })

  test('voltar pela lista abre a mesma prova que já começou, com o relógio do servidor e a resposta marcada, sem "Antes de começar"', async ({ page, hasTouch, request }) => {
    const { atividadeId, token } = await montarCena(page, request, { jaComecou: true })
    await responderPelaApiOriginal(request, token, atividadeId, 1, 1)
    await page.goto('/aluno/atividades')

    await activate(principal(page).getByRole('link', { name: new RegExp(TITULO) }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/aluno/prova/${atividadeId}$`), { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('heading', { name: 'Antes de começar' })).toHaveCount(0)
    await expect(radio(page, /^B\./)).toBeChecked({ timeout: PRAZO_MS })
    await expect(relogio(page)).toContainText(/^Faltam (59|60) min$/, { timeout: PRAZO_MS })
  })

  test('sair da aba durante a prova vai ao servidor, e a tela não mostra a contagem', async ({ page, request }) => {
    const { atividadeId } = await montarCena(page, request, { jaComecou: true })
    await abrirAProva(page, atividadeId)

    const saida = page.waitForResponse((resposta) => resposta.url().endsWith(`/v1/atividades-aplicadas/${atividadeId}/saidas-da-aba`) && resposta.request().method() === 'POST', { timeout: PRAZO_MS })
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    expect((await saida).status()).toBe(204)
    await expect(principal(page)).not.toContainText(/saiu da aba|saída/i)
  })

  test('o endereço da prova digitado antes de começar leva ao "Antes de começar": o aviso não se pula', async ({ page, request }) => {
    const { atividadeId } = await montarCena(page, request)
    await page.goto(`/aluno/prova/${atividadeId}`)
    await expect(page.getByRole('heading', { name: 'Antes de começar' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page).toHaveURL(new RegExp(`/aluno/atividades/${atividadeId}$`))
  })

  test('a prova embaralhada: o aluno marca pelo texto a alternativa certa, e o que o servidor guarda é o índice original (o gabarito)', async ({ page, hasTouch, request }) => {
    const { atividadeId, aluno, escolaId } = await montarCenaEmbaralhada(page, request)
    await abrirAProva(page, atividadeId)

    // A ordem das questões é a do aluno: cada uma se reconhece pelo enunciado, e a alternativa certa pelo texto, em qualquer posição.
    const certas: Record<string, string> = {
      'Qual é a massa molar da água': '18 g/mol',
      'Na reação N2': '4 mol',
      'Em uma reação química': ALTERNATIVA_CERTA_DA_QUESTAO_3,
    }
    for (let posicao = 1; posicao <= 3; posicao += 1) {
      const enunciado = await principal(page).getByRole('heading', { level: 2 }).innerText()
      const chave = Object.keys(certas).find((inicio) => enunciado.includes(inicio))
      if (chave === undefined) throw new Error(`questão que o teste não conhece: ${enunciado}`)
      await activate(radio(page, new RegExp(`^[A-D]\\. ${escapar(certas[chave] ?? '')}$`)), hasTouch)
      if (posicao < 3) await activate(principal(page).getByRole('button', { name: /Próxima/ }), hasTouch)
    }
    await expect(salvo(page)).toHaveText('Salvo', { timeout: PRAZO_MS })
    // O que o servidor guardou é o índice original de cada alternativa certa, na questão de número original: é o gabarito.
    await expect
      .poll(() => respostasNoBanco(escolaId, atividadeId, aluno.usuarioId), { timeout: PRAZO_MS })
      .toEqual(GABARITO_DO_FLUXO.map((alternativa, indice) => ({ questao: indice + 1, alternativa })))
  })

  test('o diagnóstico da prova embaralhada diz a resposta certa na letra em que o aluno a viu, e conta o acerto pelo índice original', async ({ page, request }) => {
    // A certa da questão 1 tem de ter saído da posição original: é a letra dela que o diagnóstico diz.
    const { atividadeId, token, dela, nomeDaProfessora } = await montarCenaEmbaralhada(page, request, 1)
    // O aluno acerta a 2 e a 3 e erra a 1 (marca o índice original 0, "16 g/mol"), tudo pela API, em índice original, como a tela manda.
    for (const [questao, alternativa] of [[1, 0], [2, GABARITO_DO_FLUXO[1]], [3, GABARITO_DO_FLUXO[2]]] as const) await responderPelaApiOriginal(request, token, atividadeId, questao, alternativa)
    await enviarPelaApi(request, token, atividadeId)
    const prova = await lerAProvaPelaApi(request, token, atividadeId)
    const primeira = prova.questoes.find((questao) => questao.numero === 1)
    if (primeira === undefined) throw new Error('a prova do aluno não tem a questão 1')
    const letraDaCerta = 'ABCD'[primeira.alternativas.indexOf('18 g/mol')]
    await dela.encerrarEAprovar(atividadeId)

    await page.goto(`/aluno/atividades/${atividadeId}`)
    const resultado = principal(page).getByRole('region', { name: 'Seu resultado' })
    await expect(resultado).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(resultado).toContainText('Você acertou 2 de 3 questões.')
    await expect(resultado).toContainText(`Correção aprovada por ${nomeDaProfessora}`)
    await expect(resultado.locator('[data-questao-corrigida="outra"]')).toContainText(`A resposta é: ${String(letraDaCerta)}. 18 g/mol`)
  })
})

const escapar = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
