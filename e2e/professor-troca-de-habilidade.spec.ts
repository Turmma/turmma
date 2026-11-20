import { randomUUID } from 'node:crypto'
import type { Locator, Page } from '@playwright/test'
import { atividadeSintetica, apiError, gate } from './support/assistente.ts'
import type { ArtefatoResponse } from '../packages/shared/src/index.ts'
import { entrarPelaApi, entrarPorEmail, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { horizontalOverflow, seriousViolations } from './support/checks.ts'
import { queryCache, semAcessosDaConta } from './support/query-cache.ts'
import { criarArtefatoDoVinculo, entrarEmCriados } from './support/professor/criados.ts'
import { activate, irPara, SCREEN_TIMEOUT_MS, VOCABULARIO_DE_NOTA } from './support/professor/scenario.ts'
import { confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarEquipeComSenha } from './support/seed.ts'
import { expect, loadUnthrottled, test } from './support/profiles.ts'

/**
 * A professora troca a habilidade da questão no artefato dela (classificacao-bncc, 11.0; RF9; `cenarios.md`, "Telas", artefato). A API das telas é simulada na página (o `PATCH`, a lista de candidatas e o `CONFLITO` são
 * dela: o que a API de verdade responde é de `apps/api/test/troca-de-habilidade.int.test.ts`); o caso do recomeço da segunda pessoa usa a API de verdade, com o artefato gravado no banco. O fluxo inteiro, do material à
 * atividade aplicada, é da 12.0.
 */

const CAPITULO = { capitulo: { numero: 3, titulo: 'Reações químicas' }, paginaInicial: 1, paginaFinal: 3, habilidades: [{ codigo: 'EM13CNT103', origem: 'ia' as const }, { codigo: 'EM13CNT104', origem: 'coordenacao' as const }] }
const BLOCO = { capitulo: null, paginaInicial: 4, paginaFinal: 6, habilidades: [] }
const TEXTO_DA_TROCA_FECHADA = 'Esta atividade já foi aplicada (ou tem versão adaptada). Gere a atividade de novo para mudar a habilidade.'

/** A atividade sintética com a primeira questão no capítulo 3 (com a habilidade `EM13CNT101`) e a segunda sem habilidade, no bloco de páginas. */
function atividade(turmaId: string, disciplinaId: string, campos: Partial<ArtefatoResponse> = {}): ArtefatoResponse {
  const base = atividadeSintetica(turmaId, disciplinaId)
  if (base.conteudo.tipo !== 'atividade_objetiva') throw new Error('a atividade sintética não é objetiva')
  const [primeira, segunda] = base.conteudo.questoes
  if (primeira === undefined || segunda === undefined) throw new Error('a atividade sintética tem duas questões')
  return { ...base, conteudo: { ...base.conteudo, questoes: [primeira, { ...segunda, habilidade: null }] }, secoesDasQuestoes: [CAPITULO, BLOCO], ...campos }
}

const aplicacao = (turmaId: string) => ({ id: randomUUID(), turmaId, estado: 'aberta' as const, aplicadaEm: '2026-11-20T10:00:00.000Z' })
const botaoDeTrocar = (page: Page, questao: number) => page.getByRole('button', { name: `Trocar a habilidade da questão ${String(questao)}` })
const seletorDa = (page: Page, questao: number) => page.getByRole('group', { name: `Habilidades para a questão ${String(questao)}` })
/** O aviso da troca que falhou: um `alert` ao lado do seletor, que segue aberto. */
const alertaDaTroca = (page: Page, texto: string): Locator => page.getByRole('alert').filter({ hasText: texto })

const abrirOArtefato = (page: Page, id: string) => irPara(page, `/professor/artefatos/${id}`)

async function entrarNoArtefato(page: Page, campos: (turmaId: string) => Partial<ArtefatoResponse> = () => ({})) {
  const id = randomUUID()
  const cena = await entrarEmCriados(page, {
    endereco: `/professor/artefatos/${id}`,
    semMedirACarga: true,
    antes: ({ api, turmaId, disciplinaId }) => void (api.artefatos = [atividade(turmaId, disciplinaId, { id, ...campos(turmaId) })]),
  })
  await expect(page.locator('[data-folha]').getByText('Qual a massa de CO₂ formada na queima completa de 24 g de carbono?')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
  return { ...cena, id, folha: page.locator('[data-folha]') }
}

/** Os códigos da lista do seletor, na ordem em que a tela os mostra. */
const codigosDaLista = (seletor: Locator): Promise<(string | undefined)[]> => seletor.getByRole('checkbox').evaluateAll((caixas) => caixas.map((caixa) => caixa.closest('label')?.textContent?.split(' ')[0]))

/** "Trocar" não é a ação cheia da tela: o fundo é transparente e o alvo é de 44 px no celular e de 24 px ou mais no computador. */
async function conferirOBotaoDeTrocar(trocar: Locator, hasTouch: boolean): Promise<void> {
  expect(await trocar.evaluate((botao) => getComputedStyle(botao).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  const caixaDoBotao = await trocar.boundingBox()
  expect(caixaDoBotao?.height ?? 0).toBeGreaterThanOrEqual(hasTouch ? 44 : 24)
  expect(caixaDoBotao?.width ?? 0).toBeGreaterThanOrEqual(24)
}

/** Alvo de 24 px em todo controle visível da tela (WCAG 2.5.8). */
async function conferirOsAlvosDeToque(page: Page): Promise<void> {
  for (const alvo of await page.getByRole('main').locator('input, button').all()) {
    if (!(await alvo.isVisible())) continue
    const caixa = await alvo.boundingBox()
    expect(caixa?.width ?? 0, 'largura do alvo').toBeGreaterThanOrEqual(24)
    expect(caixa?.height ?? 0, 'altura do alvo').toBeGreaterThanOrEqual(24)
  }
}

/** Com o seletor aberto: os alvos, "Deixar sem habilidade" de 44 px, sem rolar de lado e sem violação séria. */
async function conferirOSeletorAberto(page: Page): Promise<void> {
  await conferirOsAlvosDeToque(page)
  expect((await page.getByRole('button', { name: 'Deixar sem habilidade' }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  expect(await horizontalOverflow(page)).toBe(0)
  if ((page.viewportSize()?.width ?? 0) >= 768) await paginaNaoRola(page)
  expect(await seriousViolations(page)).toEqual([])
}

test.describe('a troca da habilidade da questão', () => {
  test('a questão diz a habilidade com o capítulo e "Sem habilidade"; "Trocar" abre o seletor com as do capítulo primeiro, sem rolar de lado e sem violação de acessibilidade', async ({ page, hasTouch }) => {
    const { folha } = await entrarNoArtefato(page)
    await expect(folha.getByText('Habilidade EM13CNT101:', { exact: false })).toBeVisible()
    await expect(folha.getByText('Capítulo 3 · Reações químicas (Páginas 1 a 3)')).toBeVisible()
    await expect(folha.getByText('Sem habilidade', { exact: true })).toBeVisible()
    await expect(folha.getByText('Páginas 4 a 6')).toBeVisible()
    // A tela inteira não fala em nota: é diagnóstico (D46). A seção é "capítulo" ou "páginas", nunca "seção".
    await expect(page.getByRole('main')).not.toContainText(VOCABULARIO_DE_NOTA)
    await expect(page.getByRole('main')).not.toContainText(/seção|trecho da/i)

    const trocar = botaoDeTrocar(page, 1)
    await conferirOBotaoDeTrocar(trocar, hasTouch)

    await activate(trocar, hasTouch)
    const seletor = seletorDa(page, 1)
    await expect(seletor).toBeVisible()
    // As do capítulo da questão primeiro (a da IA e a da coordenação), as outras do recorte depois, na ordem da API.
    await expect.poll(() => codigosDaLista(seletor)).toEqual(['EM13CNT103', 'EM13CNT104', 'EM13CNT101', 'EM13CNT102'])
    await conferirOSeletorAberto(page)
  })

  test('escolher a habilidade troca na hora e devolve o foco ao "Trocar"; "Deixar sem habilidade" a tira, e só a questão pedida muda', async ({ page, hasTouch }) => {
    const { api, folha } = await entrarNoArtefato(page)
    const trocar = botaoDeTrocar(page, 1)
    await activate(trocar, hasTouch)
    const seletor = seletorDa(page, 1)
    await expect(seletor).toBeVisible()
    await seletor.getByRole('checkbox', { name: /EM13CNT104/ }).click()
    await expect(folha.getByText('Habilidade EM13CNT104:', { exact: false })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(seletor).toBeHidden()
    // O foco volta ao botão de onde a professora veio.
    await expect(trocar).toBeFocused()
    expect(api.pedidosEm(/questoes\/\d+\/habilidade$/).map((pedido) => [pedido.caminho.split('/').at(-2), pedido.corpo])).toEqual([['0', { codigo: 'EM13CNT104' }]])
    // A outra questão não mudou, e "Deixar sem habilidade" a tira da que tinha.
    await expect(folha.getByText('Sem habilidade', { exact: true })).toBeVisible()
    await activate(botaoDeTrocar(page, 1), hasTouch)
    await activate(page.getByRole('button', { name: 'Deixar sem habilidade' }), hasTouch)
    await expect(folha.getByText('Sem habilidade', { exact: true })).toHaveCount(2, { timeout: SCREEN_TIMEOUT_MS })
    expect(api.pedidosEm(/questoes\/0\/habilidade$/).map((pedido) => pedido.corpo)).toEqual([{ codigo: 'EM13CNT104' }, { codigo: null }])
  })

  test('o teclado: o seletor abre com o foco no filtro, filtra por código e por texto, e o Esc o fecha devolvendo o foco ao "Trocar", sem trocar nada', async ({ page }) => {
    const { api } = await entrarNoArtefato(page)
    const trocar = botaoDeTrocar(page, 2)
    await trocar.focus()
    await page.keyboard.press('Enter')
    const seletor = seletorDa(page, 2)
    await expect(seletor).toBeVisible()
    const filtro = seletor.getByLabel('Filtrar por código ou texto')
    await expect(filtro).toBeFocused()
    await page.keyboard.type('cnt104')
    await expect.poll(() => codigosDaLista(seletor)).toEqual(['EM13CNT104'])
    await filtro.fill('radiações')
    await expect.poll(() => codigosDaLista(seletor)).toEqual(['EM13CNT103', 'EM13CNT104'])
    await filtro.fill('zzz')
    await expect(seletor.getByText('Nenhuma habilidade com esse código ou texto.')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(seletor).toBeHidden()
    await expect(trocar).toBeFocused()
    expect(api.pedidosEm(/habilidade$/)).toEqual([])
  })

  test('depois da aplicação o "Trocar" fica desligado em toda questão, com o motivo, e a leitura do artefato continua inteira', async ({ page }) => {
    await entrarNoArtefato(page, (turmaId) => ({ aplicacoes: [aplicacao(turmaId)] }))
    for (const questao of [1, 2]) await expect(botaoDeTrocar(page, questao)).toBeDisabled()
    await expect(page.getByText(TEXTO_DA_TROCA_FECHADA)).toHaveCount(2)
    await expect(page.getByText('Habilidade EM13CNT101:', { exact: false })).toBeVisible()
  })

  test('o `CONFLITO` (aplicada em outra aba) diz que a atividade já foi aplicada e desliga o "Trocar"; o 429 e a falha dizem a frase curta e deixam o seletor aberto para tentar de novo', async ({ page, hasTouch }) => {
    const { api, folha, id, turmaId } = await entrarNoArtefato(page)
    // A falha: a frase curta, o seletor continua aberto, e tentar de novo troca.
    api.trocar('trocarHabilidade', () => apiError(500, 'ERRO_INTERNO'))
    await activate(botaoDeTrocar(page, 1), hasTouch)
    await expect(seletorDa(page, 1)).toBeVisible()
    // O seletor abre sem o aviso: a frase só vem do clique que falha.
    await expect(alertaDaTroca(page, 'Não foi possível trocar a habilidade.')).toHaveCount(0)
    await seletorDa(page, 1).getByRole('checkbox', { name: /EM13CNT102/ }).click()
    await expect(alertaDaTroca(page, 'Não foi possível trocar a habilidade. Tente de novo.')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(folha.getByText('Habilidade EM13CNT101:', { exact: false })).toBeVisible()
    // O 429 diz que são muitas alterações seguidas.
    api.trocar('trocarHabilidade', () => apiError(429, 'LIMITE_EXCEDIDO'))
    await seletorDa(page, 1).getByRole('checkbox', { name: /EM13CNT102/ }).click()
    await expect(alertaDaTroca(page, 'Muitas alterações seguidas. Tente de novo em instantes.')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    // A resposta de sempre: a mesma escolha troca.
    api.trocar('trocarHabilidade')
    await seletorDa(page, 1).getByRole('checkbox', { name: /EM13CNT102/ }).click()
    await expect(folha.getByText('Habilidade EM13CNT102:', { exact: false })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(seletorDa(page, 1)).toBeHidden()

    // O `CONFLITO`: a atividade foi aplicada em outra aba depois de a tela ler; a leitura refeita traz a aplicação.
    api.trocar('trocarHabilidade', () => {
      api.artefatos = api.artefatos.map((item) => (item.id === id ? { ...item, aplicacoes: [aplicacao(turmaId)] } : item))
      return apiError(409, 'CONFLITO')
    })
    await activate(botaoDeTrocar(page, 2), hasTouch)
    await seletorDa(page, 2).getByRole('checkbox', { name: /EM13CNT103/ }).click()
    await expect(botaoDeTrocar(page, 2)).toBeDisabled({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByText(TEXTO_DA_TROCA_FECHADA)).toHaveCount(2)
    await expect(seletorDa(page, 2)).toBeHidden()
  })

  test('o `PATCH` no ar: a professora abre o seletor da outra questão sem perder o dele, e a resposta, quando chega, troca só a questão pedida', async ({ page, hasTouch }) => {
    const { api, folha } = await entrarNoArtefato(page)
    const segura = gate()
    api.trocar('trocarHabilidade', async (pedido) => {
      await segura.aberta
      return api.responder('trocarHabilidade', pedido)
    })
    await activate(botaoDeTrocar(page, 1), hasTouch)
    await seletorDa(page, 1).getByRole('checkbox', { name: /EM13CNT104/ }).click()
    await expect.poll(() => api.pedidosEm(/questoes\/0\/habilidade$/).length).toBe(1)
    // Com o pedido no ar, a outra questão abre o seletor dela.
    await activate(botaoDeTrocar(page, 2), hasTouch)
    await expect(seletorDa(page, 2)).toBeVisible()
    segura.abrir()
    await expect(folha.getByText('Habilidade EM13CNT104:', { exact: false })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(seletorDa(page, 1)).toBeHidden()
    // O seletor da segunda questão segue aberto, e a habilidade dela não mudou.
    await expect(seletorDa(page, 2)).toBeVisible()
    await expect(folha.getByText('Sem habilidade', { exact: true })).toBeVisible()
  })

  test('recomeço: o mesmo artefato reaberto volta com o seletor fechado e a habilidade que o servidor tem', async ({ page, hasTouch }) => {
    const { id, folha } = await entrarNoArtefato(page)
    await activate(botaoDeTrocar(page, 1), hasTouch)
    await seletorDa(page, 1).getByRole('checkbox', { name: /EM13CNT104/ }).click()
    await expect(folha.getByText('Habilidade EM13CNT104:', { exact: false })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await activate(botaoDeTrocar(page, 2), hasTouch)
    await expect(seletorDa(page, 2)).toBeVisible()
    await irPara(page, '/professor/criados')
    await expect(page.getByRole('heading', { level: 1, name: 'Criados' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await abrirOArtefato(page, id)
    await expect(folha.getByText('Habilidade EM13CNT104:', { exact: false })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(seletorDa(page, 2)).toHaveCount(0)
  })

  test('recomeço: a professora seguinte entra na mesma aba e o artefato da anterior no endereço não lhe aparece, nem a habilidade dele no cache', async ({ page, hasTouch }) => {
    const titulo = `Atividade confidencial ${randomUUID().slice(0, 8)}`
    const primeira = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(primeira.escolaId, primeira.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(primeira.escolaId, alocacao.vinculoIds)
    const documento = await criarArtefatoDoVinculo(primeira.escolaId, alocacao.vinculoIds[0] ?? '', primeira.usuarioId, titulo)
    const segunda = await criarEquipeComSenha()
    const alocacaoDaSegunda = await criarAlocacaoDoProfessor(segunda.escolaId, segunda.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(segunda.escolaId, alocacaoDaSegunda.vinculoIds)
    // Com a API de verdade: a leitura traz as seções das questões e a suspensão (o contrato novo), e a tela as lê.
    await loadUnthrottled(page, async () => {
      await entrarPelaApi(page, primeira, `/professor/artefatos/${documento.artefatoId}`)
      await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
      await expect(page.getByText('Habilidade EM13CNT102:', { exact: false })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
      await expect(botaoDeTrocar(page, 1)).toBeEnabled()
    })

    if (hasTouch) await page.getByRole('button', { name: 'Sair' }).tap()
    else await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await entrarPorEmail(page, segunda, hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await abrirOArtefato(page, documento.artefatoId)
    await expect(page.getByText('Este artefato não está disponível')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(titulo)
    await expect(botaoDeTrocar(page, 1)).toHaveCount(0)
    const cache = semAcessosDaConta(await queryCache(page))
    expect(cache).not.toContain(titulo)
    expect(cache).not.toContain('EM13CNT102')
  })
})
