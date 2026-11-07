import { randomUUID } from 'node:crypto'
import type { Locator, Page, Request, Route } from '@playwright/test'
import { entrarPelaApiSemMedirAPrimeiraCarga, entrarPorEmail, escolherNoSeletor, esperarNovaConversa, nomeNoSeletor, recarregarSemMedirAPrimeiraCarga, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { expect, test } from './support/profiles.ts'
import { activate, irPara, soOPainelDaAbaRola } from './support/professor/scenario.ts'
import {
  abrirASemana,
  caminhoDaSemana,
  cartaoDaAula,
  diaDeHoje,
  diaPorExtenso,
  disciplinaDoVinculo,
  gradeDeHoje,
  hojeEmSaoPaulo,
  irAoDia,
  montarASemana,
  nomeDoDia,
  noCelular,
  registrarAulaNoBanco,
  segundaDe,
  somar,
  tituloDaSemana,
} from './support/professor/semana.ts'
import { criarEquipeComSenha, criarEventoDoCalendarioNoBanco, criarUsuarioEmOutraEscola } from './support/seed.ts'

/**
 * A aba **Semana** de Turmas (F2b, 6.0; RF1 a RF4, RF6, RF9, RF12, RF14, RF22): as aulas da professora na escola ativa, semana a semana
 * no computador e um dia por vez no celular. A API, o banco e a sessão são os de verdade; o relógio é o da máquina, por isso cada caso parte de
 * **hoje** e conta semanas dele (`e2e/support/professor/semana.ts`). Cada caso paga uma entrada da professora (pela API): prova uma coisa só.
 */

const ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const DATA = '\\d{4}-\\d{2}-\\d{2}'
const textoLongo = 'Frações equivalentes e comparação de frações com denominadores diferentes, usando a reta numérica, as barras de fração e três exercícios de fixação no caderno para fechar a aula com o grupo todo participando'

/** A grade padrão de `montarASemana`, que o T1 estende com a aula de hoje: a turma 0 e a 1 na terça, a 2 na quarta. */
const GRADE_DE_T1: readonly (readonly { dia: number; inicio: string; fim: string }[])[] = [
  [{ dia: 2, inicio: '07:30', fim: '08:20' }],
  [{ dia: 2, inicio: '08:20', fim: '09:10' }],
  [{ dia: 3, inicio: '07:30', fim: '08:20' }],
]

const proximaSemana = (page: Page): Locator => page.getByRole('button', { name: 'Semana seguinte' })
const semanaAnterior = (page: Page): Locator => page.getByRole('button', { name: 'Semana anterior' })

/** Os dias que a tela mostra: as colunas no computador, o único dia no celular. */
const diasNaTela = (page: Page): Locator => page.locator('[data-dia]')

async function tocar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Todo valor do endereço é id ou data, e nenhum texto de aula ou nome entra nele (regra 50, item 7; regra 20, item 9). */
function soIdsEDatas(endereco: string): void {
  const url = new URL(endereco)
  const permitidos = new Set(['ver', 'semana', 'turma', 'aula'])
  for (const [chave, valor] of url.searchParams) {
    expect(permitidos.has(chave), `parâmetro ${chave} no endereço`).toBe(true)
    const forma = {
      ver: /^semana$/,
      semana: new RegExp(`^${DATA}$`),
      turma: new RegExp(`^${ID}\\.${ID}$`),
      aula: new RegExp(`^${ID}\\.${DATA}\\.\\d{4}$`),
    }[chave as 'ver']
    expect(valor, `valor de ${chave}`).toMatch(forma)
  }
}

test.describe('a Semana: as aulas, o endereço e a navegação', () => {
  test('T1: as aulas de três turmas aparecem cada uma com o nome acessível, e "Semana seguinte", "Hoje" e "Semana anterior" levam a semana ao endereço', async ({ page, hasTouch }) => {
    // A turma 0 ganha uma aula às 12h30 no dia de hoje: é ela que dá ao "Hoje" um dia na tela, também no fim de semana.
    const cena = await montarASemana({
      grade: (indice) => [...(GRADE_DE_T1[indice] ?? []), ...(indice === 0 ? [{ dia: diaDeHoje(), inicio: '12:30', fim: '13:20' }] : [])],
    })
    const [matematica, historia, quimica] = cena.turmas
    await abrirASemana(page, cena, caminhoDaSemana(cena.proxima))

    await irAoDia(page, somar(cena.proxima, 1), hasTouch)
    await expect(cartaoDaAula(page, `Terça, 7h30, ${matematica?.turmaNome}, Matemática`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(cartaoDaAula(page, `Terça, 8h20, ${historia?.turmaNome}, História`)).toBeVisible()
    await irAoDia(page, somar(cena.proxima, 2), hasTouch)
    await expect(cartaoDaAula(page, `Quarta, 7h30, ${quimica?.turmaNome}, Química`)).toBeVisible()

    await tocar(proximaSemana(page), hasTouch)
    const seguinte = somar(cena.proxima, 7)
    await expect(page).toHaveURL(new RegExp(`\\?ver=semana&semana=${seguinte}$`))
    // No celular a semana nova abre na segunda; a terça é a que tem a aula.
    await irAoDia(page, somar(seguinte, 1), hasTouch)
    await expect(page.locator(`[data-dia="${somar(seguinte, 1)}"]`)).toBeVisible()
    await expect(cartaoDaAula(page, `Terça, 7h30, ${matematica?.turmaNome}, Matemática`)).toBeVisible()

    // "Hoje" volta à semana de hoje e tira `?semana=` do endereço; o dia de hoje traz a palavra "Hoje" escrita.
    await tocar(page.getByRole('button', { name: 'Hoje', exact: true }), hasTouch)
    await expect(page).toHaveURL(/\/professor\/turmas\?ver=semana$/)
    await expect(page.locator(`[data-dia="${cena.hoje}"]`).getByText('Hoje', { exact: true })).toBeVisible()
    // "Semana anterior" leva à semana de antes, e ela entra no endereço.
    await tocar(semanaAnterior(page), hasTouch)
    await expect(page).toHaveURL(new RegExp(`\\?ver=semana&semana=${cena.anterior}$`))
    await expect(tituloDaSemana(page)).toBeVisible()
  })

  test('a aba Turmas não lê a semana; abrir a Semana lê, guarda `?ver=semana` com `replace` e o Voltar sai de Turmas', async ({ page, hasTouch }) => {
    const cena = await montarASemana()
    const leituras: string[] = []
    page.on('request', (pedido) => {
      if (new URL(pedido.url()).pathname === '/v1/semana') leituras.push(pedido.url())
    })
    await entrarPelaApiSemMedirAPrimeiraCarga(page, cena.professora, '/professor/turmas', async () => {
      await expect(page.getByRole('region', { name: 'Suas turmas' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    })
    await expect(page.getByRole('tab', { name: 'Turmas', selected: true })).toBeVisible()
    expect(leituras, 'a aba Turmas não chama GET /v1/semana').toEqual([])

    await tocar(page.getByRole('tab', { name: 'Semana' }), hasTouch)
    await expect(page).toHaveURL(/\/professor\/turmas\?ver=semana$/)
    await expect(tituloDaSemana(page)).toBeVisible()
    await expect.poll(() => leituras.length).toBeGreaterThanOrEqual(1)

    await page.goBack()
    await expect(page).not.toHaveURL(/\/professor\/turmas/)
  })

  test('`?semana=` abre a semana pedida; data inválida e semana fora do ano abrem a de hoje', async ({ page }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    await abrirASemana(page, cena, caminhoDaSemana(cena.proxima))
    await expect(page.locator(`[data-dia="${cena.proxima}"]`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator(`[data-dia="${cena.hoje}"]`)).toHaveCount(0)

    await irPara(page, caminhoDaSemana('2026-02-30'))
    await expect(page.locator(`[data-dia="${cena.hoje}"]`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    await irPara(page, caminhoDaSemana(somar(cena.ano.inicio, -60)))
    await expect(page).not.toHaveURL(/semana=\d/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator(`[data-dia="${cena.hoje}"]`)).toBeVisible()
  })

  test('`?turma=` mostra só aquela turma e disciplina, e o endereço leva só ids e datas', async ({ page, hasTouch }) => {
    const cena = await montarASemana()
    const [matematica, historia] = cena.turmas
    const vinculoId = matematica?.vinculoIds[0] ?? ''
    await abrirASemana(page, cena, caminhoDaSemana(cena.proxima))
    await irAoDia(page, somar(cena.proxima, 1), hasTouch)
    await expect(cartaoDaAula(page, `Terça, 8h20, ${historia?.turmaNome}, História`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    await page.getByLabel('Turma e disciplina').selectOption({ label: `${matematica?.turmaNome} · Matemática` })
    const disciplinaId = await disciplinaDoVinculo(cena.professora.escolaId, vinculoId)
    await expect(page).toHaveURL(new RegExp(`turma=${matematica?.turmaId}\\.${disciplinaId}`))
    await expect(cartaoDaAula(page, `Terça, 7h30, ${matematica?.turmaNome}, Matemática`)).toBeVisible()
    await expect(cartaoDaAula(page, `Terça, 8h20, ${historia?.turmaNome}, História`)).toHaveCount(0)

    await tocar(cartaoDaAula(page, `Terça, 7h30, ${matematica?.turmaNome}, Matemática`), hasTouch)
    await expect(page).toHaveURL(new RegExp(`aula=${vinculoId}\\.${somar(cena.proxima, 1)}\\.0730`))
    soIdsEDatas(page.url())
  })

  test('`?turma=` de uma turma que não é dela mostra o vazio, com "Ver todas as turmas", que tira o filtro', async ({ page, hasTouch }) => {
    const cena = await montarASemana()
    const [matematica] = cena.turmas
    await abrirASemana(page, cena, `${caminhoDaSemana(cena.proxima)}&turma=${randomUUID()}.${randomUUID()}`)
    await expect(page.getByText('Sem aulas nesta semana')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('button', { name: /^(Terça|Quarta),/ })).toHaveCount(0)

    await tocar(page.getByRole('button', { name: 'Ver todas as turmas' }), hasTouch)
    await expect(page).not.toHaveURL(/turma=/)
    await irAoDia(page, somar(cena.proxima, 1), hasTouch)
    await expect(cartaoDaAula(page, `Terça, 7h30, ${matematica?.turmaNome}, Matemática`)).toBeVisible()
  })

  test('a navegação é presa ao ano: "Semana anterior" desligada na semana do começo, "Semana seguinte" na do fim', async ({ page }) => {
    const cena = await montarASemana({ ano: { inicio: somar(segundaDe(hojeEmSaoPaulo()), -10), fim: somar(segundaDe(hojeEmSaoPaulo()), 12) } })
    await abrirASemana(page, cena, caminhoDaSemana(somar(cena.segunda, -14)))
    await expect(semanaAnterior(page)).toBeDisabled({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(proximaSemana(page)).toBeEnabled()

    await irPara(page, caminhoDaSemana(somar(cena.segunda, 7)))
    await expect(proximaSemana(page)).toBeDisabled({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(semanaAnterior(page)).toBeEnabled()
  })

  test('chegar à ponta do ano pelo botão leva o foco ao título da semana, e não o perde', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ ano: { inicio: somar(segundaDe(hojeEmSaoPaulo()), -10), fim: somar(segundaDe(hojeEmSaoPaulo()), 12) } })
    await abrirASemana(page, cena, caminhoDaSemana(cena.segunda))
    await expect(proximaSemana(page)).toBeEnabled({ timeout: SIGN_IN_TIMEOUT_MS })
    await tocar(proximaSemana(page), hasTouch)
    await expect(proximaSemana(page)).toBeDisabled()
    await expect(tituloDaSemana(page)).toBeFocused()
  })
})

test.describe('o cartão e o dia', () => {
  test('o texto do cartão ocupa duas linhas, não mais', async ({ page, hasTouch }) => {
    const cena = await montarASemana()
    const [matematica] = cena.turmas
    await registrarAulaNoBanco(cena.professora.escolaId, matematica?.vinculoIds[0] ?? '', { data: somar(cena.proxima, 1), inicio: '07:30', fim: '08:20', texto: textoLongo })
    await abrirASemana(page, cena, caminhoDaSemana(cena.proxima))
    await irAoDia(page, somar(cena.proxima, 1), hasTouch)
    const texto = cartaoDaAula(page, `Terça, 7h30, ${matematica?.turmaNome}, Matemática`).locator('[data-texto-da-aula]')
    await expect(texto).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const medida = await texto.evaluate((elemento) => {
      const estilo = getComputedStyle(elemento)
      return { linhas: estilo.getPropertyValue('-webkit-line-clamp'), visivel: elemento.clientHeight, inteiro: elemento.scrollHeight, linha: parseFloat(estilo.lineHeight) }
    })
    expect(medida.linhas).toBe('2')
    expect(medida.inteiro, 'o texto é mais longo que o cartão mostra').toBeGreaterThan(medida.visivel)
    expect(medida.visivel).toBeLessThanOrEqual(medida.linha * 2 + 1)
  })

  test('S14 e T11: "Falta preencher" é por aula, num selo neutro, sem total; a aula com texto e a passada sem texto não o levam', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: (indice) => (indice === 0 ? [{ dia: 2, inicio: '07:30', fim: '08:20' }, { dia: 3, inicio: '07:30', fim: '08:20' }] : []) })
    const [matematica] = cena.turmas
    const vinculoId = matematica?.vinculoIds[0] ?? ''
    await registrarAulaNoBanco(cena.professora.escolaId, vinculoId, { data: somar(cena.proxima, 2), inicio: '07:30', fim: '08:20', texto: 'Equações do primeiro grau' })
    await abrirASemana(page, cena, caminhoDaSemana(cena.proxima))

    await irAoDia(page, somar(cena.proxima, 1), hasTouch)
    const semTexto = cartaoDaAula(page, `Terça, 7h30, ${matematica?.turmaNome}, Matemática`)
    await expect(semTexto).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(semTexto.getByText('Falta preencher')).toBeVisible()
    // O selo é cinza (`info`): nunca laranja nem vermelho, e nenhuma conta soma as aulas que faltam (D59, D64).
    await expect(semTexto.locator('[data-estado="info"]')).toHaveCount(1)
    await expect(page.locator('[data-estado="pendente"], [data-estado="erro"]')).toHaveCount(0)
    await expect(page.getByRole('main')).not.toContainText(/\d+\s+(aulas?\s+)?(sem texto|para preencher|faltam|a preencher)|faltam\s+\d+/i)

    await irAoDia(page, somar(cena.proxima, 2), hasTouch)
    const comTexto = cartaoDaAula(page, `Quarta, 7h30, ${matematica?.turmaNome}, Matemática`)
    await expect(comTexto).toContainText('Equações do primeiro grau')
    await expect(comTexto.getByText('Falta preencher')).toHaveCount(0)

    // A semana passada, sem texto: nem selo nem cobrança.
    await irPara(page, caminhoDaSemana(cena.anterior))
    await irAoDia(page, somar(cena.anterior, 1), hasTouch)
    await expect(cartaoDaAula(page, `Terça, 7h30, ${matematica?.turmaNome}, Matemática`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByText('Falta preencher')).toHaveCount(0)
  })

  test('RF14: a aula escrita que saiu da grade aparece com a marca "Fora da grade"', async ({ page, hasTouch }) => {
    const cena = await montarASemana()
    const [matematica] = cena.turmas
    const sexta = somar(cena.anterior, 4)
    await registrarAulaNoBanco(cena.professora.escolaId, matematica?.vinculoIds[0] ?? '', { data: sexta, inicio: '10:20', fim: '11:10', texto: 'Aula que saiu da grade' })
    await abrirASemana(page, cena, caminhoDaSemana(cena.anterior))
    await irAoDia(page, sexta, hasTouch)
    const cartao = cartaoDaAula(page, `Sexta, 10h20, ${matematica?.turmaNome}, Matemática`)
    await expect(cartao).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(cartao.getByText('Fora da grade')).toBeVisible()
    await expect(cartao).toContainText('Aula que saiu da grade')
  })

  test('RF3: feriado e recesso mostram o tipo e a descrição e tiram as aulas do dia; o evento aparece junto das aulas', async ({ page, hasTouch }) => {
    const cena = await montarASemana()
    const terca = somar(cena.proxima, 1)
    const quarta = somar(cena.proxima, 2)
    await criarEventoDoCalendarioNoBanco(cena.professora.escolaId, 'em_curso', { tipo: 'evento', inicio: terca, fim: terca, descricao: 'Reunião pedagógica' })
    await criarEventoDoCalendarioNoBanco(cena.professora.escolaId, 'em_curso', { tipo: 'recesso', inicio: quarta, fim: quarta, descricao: 'Recesso de teste' })
    await abrirASemana(page, cena, caminhoDaSemana(cena.proxima))

    await irAoDia(page, terca, hasTouch)
    const diaDoEvento = page.locator(`[data-dia="${terca}"]`)
    await expect(diaDoEvento).toContainText('Evento · Reunião pedagógica', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(diaDoEvento.getByRole('button')).toHaveCount(2)

    await irAoDia(page, quarta, hasTouch)
    const diaDoRecesso = page.locator(`[data-dia="${quarta}"]`)
    await expect(diaDoRecesso).toContainText('Recesso · Recesso de teste')
    await expect(diaDoRecesso.getByRole('button')).toHaveCount(0)
  })

  test('RF1: o fim de semana só aparece quando tem aula', async ({ page }) => {
    const cena = await montarASemana({ grade: (indice) => (indice === 0 ? [{ dia: 6, inicio: '09:00', fim: '09:50' }] : []) })
    await abrirASemana(page, cena, caminhoDaSemana(cena.proxima))
    await expect(diasNaTela(page).first()).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    if (noCelular(page)) {
      await expect(page.getByRole('radio')).toHaveCount(6)
      await expect(page.getByRole('radio', { name: nomeDoDia(somar(cena.proxima, 5)) })).toBeVisible()
      await expect(page.getByRole('radio', { name: nomeDoDia(somar(cena.proxima, 6)) })).toHaveCount(0)
    } else {
      await expect(diasNaTela(page)).toHaveCount(6)
      await expect(page.locator(`[data-dia="${somar(cena.proxima, 5)}"]`)).toContainText(diaPorExtenso(somar(cena.proxima, 5)))
      await expect(page.locator(`[data-dia="${somar(cena.proxima, 6)}"]`)).toHaveCount(0)
    }
  })
})

test.describe('os estados da Semana (RF12)', () => {
  test('T8: carregando não mostra vazio nem aviso; depois da leitura, o vazio diz por quê', async ({ page }) => {
    const cena = await montarASemana({ semGrade: true })
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route('**/v1/semana?*', async (rota: Route) => {
      await segurada
      await rota.continue().catch(() => undefined)
    })
    await abrirASemana(page, cena)
    await expect(page.getByText('Carregando a semana…')).toBeVisible()
    await expect(page.getByText('A coordenação ainda não importou a grade')).toHaveCount(0)
    await expect(page.getByText('O calendário da escola ainda não foi importado')).toHaveCount(0)
    liberar()
    await expect(page.getByText('A coordenação ainda não importou a grade')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByText('Carregando a semana…')).toHaveCount(0)
  })

  test('recomeço: a falha seguida de sucesso não deixa erro na tela, e o foco vai ao título da semana', async ({ page, hasTouch }) => {
    const cena = await montarASemana()
    let falhar = true
    await page.route('**/v1/semana?*', async (rota: Route) => {
      if (!falhar) return rota.continue()
      return rota.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'x', requisicaoId: randomUUID() } }) })
    })
    await abrirASemana(page, cena)
    const tentar = page.getByRole('button', { name: 'Tentar de novo' })
    // O cliente repete uma vez, um segundo depois, antes de mostrar o erro.
    await expect(tentar).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    falhar = false
    await tocar(tentar, hasTouch)
    await expect(tituloDaSemana(page)).toBeFocused({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(tentar).toHaveCount(0)
    await expect(diasNaTela(page).first()).toBeVisible()
  })

  test('o aviso do calendário aparece com a grade importada e sem calendário, junto das aulas', async ({ page, hasTouch }) => {
    const cena = await montarASemana()
    const [matematica] = cena.turmas
    await abrirASemana(page, cena, caminhoDaSemana(cena.proxima))
    await expect(page.getByText('O calendário da escola ainda não foi importado')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await irAoDia(page, somar(cena.proxima, 1), hasTouch)
    await expect(cartaoDaAula(page, `Terça, 7h30, ${matematica?.turmaNome}, Matemática`)).toBeVisible()
  })
})

test.describe('o celular e o computador pequeno (D51, RF22)', () => {
  test('T9: o celular mostra um dia por vez, abrindo em hoje, sem rolagem de lado; o computador mostra as colunas', async ({ page, hasTouch }) => {
    const hojeNaGrade = diaDeHoje()
    const cena = await montarASemana({ grade: gradeDeHoje })
    await abrirASemana(page, cena)
    await expect(page.locator(`[data-dia="${cena.hoje}"]`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(await horizontalOverflow(page)).toBe(0)
    if (!noCelular(page)) {
      await expect(diasNaTela(page)).toHaveCount(hojeNaGrade >= 6 ? 6 : 5)
      return
    }
    await expect(page.getByRole('radio', { checked: true })).toHaveAccessibleName(new RegExp(`^${nomeDoDia(cena.hoje)}$`))
    await expect(diasNaTela(page)).toHaveCount(1)
    const outro = somar(cena.segunda, hojeNaGrade === 1 ? 1 : 0)
    await tocar(page.getByRole('radio', { name: nomeDoDia(outro) }), hasTouch)
    await expect(page.locator(`[data-dia="${outro}"]`)).toBeVisible()
    await expect(diasNaTela(page)).toHaveCount(1)
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('os alvos de toque: 24 × 24 nos botões da barra e nos dias, 44 × 44 no cartão, a ação principal', async ({ page }) => {
    const cena = await montarASemana()
    const [matematica] = cena.turmas
    await abrirASemana(page, cena, caminhoDaSemana(cena.proxima))
    const cartao = cartaoDaAula(page, `Terça, 7h30, ${matematica?.turmaNome}, Matemática`)
    if (noCelular(page)) await page.getByRole('radio', { name: nomeDoDia(somar(cena.proxima, 1)) }).click()
    await expect(cartao).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const caixa = async (alvo: Locator) => {
      const medida = await alvo.boundingBox()
      expect(medida, 'alvo sem caixa').not.toBeNull()
      return { largura: medida?.width ?? 0, altura: medida?.height ?? 0 }
    }
    for (const alvo of [semanaAnterior(page), page.getByRole('button', { name: 'Hoje', exact: true }), proximaSemana(page)]) {
      const { largura, altura } = await caixa(alvo)
      expect(largura).toBeGreaterThanOrEqual(24)
      expect(altura).toBeGreaterThanOrEqual(24)
    }
    const principal = await caixa(cartao)
    expect(principal.largura).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(principal.altura).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    if (noCelular(page)) {
      for (const dia of await page.getByRole('radio').all()) {
        const { largura, altura } = await caixa(dia)
        expect(largura).toBeGreaterThanOrEqual(24)
        expect(altura).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      }
    }
  })

  test('T10: 45 aulas num Chromebook: a página fica parada a 1366 × 768 e só o painel da aba rola', async ({ page }) => {
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
    const cena = await montarASemana({
      grade: (indice) => [1, 2, 3, 4, 5].flatMap((dia) => [0, 1, 2].map((ordem) => ({ dia, inicio: horarios[indice * 3 + ordem]?.[0] ?? '', fim: horarios[indice * 3 + ordem]?.[1] ?? '' }))),
    })
    await abrirASemana(page, cena, caminhoDaSemana(cena.proxima))
    await expect(page.locator(`[data-dia="${cena.proxima}"]`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    if (!noCelular(page)) await expect(page.getByRole('button', { name: /^(Segunda|Terça|Quarta|Quinta|Sexta),/ })).toHaveCount(45)
    await soOPainelDaAbaRola(page)
    await paginaNaoRola(page)
  })

  test('axe: sem violação grave com dado e no vazio', async ({ page, hasTouch }) => {
    const cena = await montarASemana()
    await abrirASemana(page, cena, caminhoDaSemana(cena.proxima))
    await expect(diasNaTela(page).first()).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await irAoDia(page, somar(cena.proxima, 1), hasTouch)
    await expect(page.getByRole('button', { name: /^Terça,/ }).first()).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])

    await irPara(page, `${caminhoDaSemana(cena.proxima)}&turma=${randomUUID()}.${randomUUID()}`)
    await expect(page.getByText('Sem aulas nesta semana')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })
})

test.describe('o recomeço da Semana', () => {
  test('o mesmo endereço colado de novo abre a mesma entrada: as mesmas aulas, uma leitura só, sem laço', async ({ page, hasTouch }) => {
    const cena = await montarASemana()
    const [matematica] = cena.turmas
    const endereco = caminhoDaSemana(cena.proxima)
    await abrirASemana(page, cena, endereco)
    await irAoDia(page, somar(cena.proxima, 1), hasTouch)
    await expect(cartaoDaAula(page, `Terça, 7h30, ${matematica?.turmaNome}, Matemática`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    const leituras: string[] = []
    page.on('request', (pedido) => {
      if (new URL(pedido.url()).pathname === '/v1/semana') leituras.push(pedido.url())
    })
    await recarregarSemMedirAPrimeiraCarga(page, async () => {
      await expect(tituloDaSemana(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    })
    await irAoDia(page, somar(cena.proxima, 1), hasTouch)
    await expect(cartaoDaAula(page, `Terça, 7h30, ${matematica?.turmaNome}, Matemática`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(endereco)
    expect(leituras).toHaveLength(1)
  })

  test('a semana A segurada no ar não substitui a B, que a professora já abriu', async ({ page, hasTouch }) => {
    const cena = await montarASemana({ grade: gradeDeHoje })
    await abrirASemana(page, cena)
    await expect(page.locator(`[data-dia="${cena.hoje}"]`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(`**/v1/semana?segunda=${cena.proxima}`, async (rota: Route) => {
      await segurada
      await rota.continue().catch(() => undefined)
    })
    // A leitura da A termina de um jeito ou de outro (a tela pode abortá-la ao sair dela): só depois disso o caso olha a tela.
    const terminouAA = new Promise<void>((resolver) => {
      const fim = (pedido: Request) => pedido.url().includes(`segunda=${cena.proxima}`) && resolver()
      page.on('requestfinished', fim)
      page.on('requestfailed', fim)
    })
    await tocar(proximaSemana(page), hasTouch)
    await expect(page).toHaveURL(new RegExp(`semana=${cena.proxima}$`))
    await tocar(page.getByRole('button', { name: 'Hoje', exact: true }), hasTouch)
    await expect(page.locator(`[data-dia="${cena.hoje}"]`)).toBeVisible()

    liberar()
    await terminouAA
    await expect(page.locator(`[data-dia="${cena.hoje}"]`)).toBeVisible()
    await expect(page.locator(`[data-dia="${cena.proxima}"]`)).toHaveCount(0)
  })

  test('P30: a segunda professora na mesma aba não vê a semana da primeira', async ({ page, hasTouch }) => {
    const primeira = await montarASemana()
    const segunda = await criarEquipeComSenha()
    await abrirASemana(page, primeira, caminhoDaSemana(primeira.proxima))
    await irAoDia(page, somar(primeira.proxima, 1), hasTouch)
    await expect(cartaoDaAula(page, `Terça, 7h30, ${primeira.turmas[0]?.turmaNome}, Matemática`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    await activate(page.getByRole('button', { name: 'Sair' }).first(), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await entrarPorEmail(page, segunda, hasTouch)
    await esperarNovaConversa(page, segunda.nome)
    const nomeDaTurma = primeira.turmas[0]?.turmaNome ?? ''

    // A mesma semana que a primeira deixou no cache, aberta pela segunda com a leitura segurada: se o cache sobrevivesse à troca de
    // pessoa, a tela mostraria as aulas da primeira em vez de "Carregando".
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route('**/v1/semana?*', async (rota: Route) => {
      await segurada
      await rota.continue().catch(() => undefined)
    })
    await irPara(page, caminhoDaSemana(primeira.proxima))
    await expect(page.getByText('Carregando a semana…')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(nomeDaTurma)

    liberar()
    await expect(page.getByText('A coordenação ainda não alocou você').or(page.getByText('A coordenação ainda não importou a grade'))).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(nomeDaTurma)
  })

  test('RF9, P30: trocar de escola com a Semana aberta não deixa nada da primeira escola na tela da segunda', async ({ page, hasTouch }) => {
    const cena = await montarASemana()
    const emB = await criarUsuarioEmOutraEscola(cena.professora.contaId)
    await entrarPelaApiSemMedirAPrimeiraCarga(
      page,
      cena.professora,
      caminhoDaSemana(cena.proxima),
      async () => {
        await expect(tituloDaSemana(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
      },
      cena.professora.usuarioId,
    )
    await irAoDia(page, somar(cena.proxima, 1), hasTouch)
    const nomeDaTurma = cena.turmas[0]?.turmaNome ?? ''
    await expect(cartaoDaAula(page, `Terça, 7h30, ${nomeDaTurma}, Matemática`)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route('**/v1/semana?*', async (rota: Route) => {
      await segurada
      await rota.continue().catch(() => undefined)
    })
    await escolherNoSeletor(page, nomeNoSeletor(emB, 'professor'), hasTouch)
    await esperarNovaConversa(page, 'Professora sintética na outra escola', { escolaNome: emB.escolaNome })
    await irPara(page, caminhoDaSemana(cena.proxima))
    await expect(page.getByText('Carregando a semana…')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(nomeDaTurma)

    liberar()
    await expect(page.getByText('A coordenação ainda não importou a grade')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(nomeDaTurma)
  })
})
