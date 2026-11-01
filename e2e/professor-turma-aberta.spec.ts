import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { desempenhoSintetico, mockAssistenteApi } from './support/assistente.ts'
import { SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { principal } from './support/professor-flow.ts'
import { activate, comLote, entrar, irPara, SCREEN_TIMEOUT_MS, soOPainelDaAbaRola, VOCABULARIO_DE_NOTA } from './support/professor/scenario.ts'
import { confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarEquipeComSenha, encerrarVinculosNoBanco } from './support/seed.ts'
import { expect, test } from './support/profiles.ts'

/**
 * A turma aberta em três abas, Hoje, Atividades e Alunos, no endereço (D69, X3 telas do professor, 10.0). Separado de
 * `professor-turma.spec.ts` pela 2.5. Os blocos do Tutor em Hoje ficam em `professor-tutor.spec.ts`. Cada caso paga a entrada
 * da professora (cerca de 11 s na máquina), por isso cada um prova uma coisa só: o caso que passa de 15 s o portão reprova.
 */

const TURMA_INDISPONIVEL = 'Esta turma não está disponível para você agora'
const abaSelecionada = (page: Page) => page.getByRole('tab', { selected: true })

test.describe('a turma aberta em três abas (D69)', () => {
  test('a turma abre em Hoje, com as três abas em ordem, o título e o caminho de volta', async ({ page, hasTouch }) => {
    const { turmaId, turmaNome } = await entrar(page, hasTouch)
    await irPara(page, `/professor/turmas/${turmaId}`)
    await expect(page.getByRole('tab')).toHaveText(['Hoje', 'Atividades', 'Alunos'], { timeout: SCREEN_TIMEOUT_MS })
    await expect(abaSelecionada(page)).toHaveText('Hoje')
    await expect(principal(page).getByRole('heading', { level: 1 })).toHaveText(`Turma ${turmaNome}`)
    await expect(principal(page).getByRole('link', { name: 'Voltar para Turmas' })).toBeVisible()
    await expect(page.getByText(/Seu time/)).toHaveCount(0)
  })

  test('a aba guardada no endereço vale ao abrir: `?aba=alunos` abre Alunos (recarregar a página a mantém: `acesso-da-turma.spec.ts`)', async ({ page, hasTouch }) => {
    const { turmaId } = await entrar(page, hasTouch)
    await irPara(page, `/professor/turmas/${turmaId}?aba=alunos`)
    await expect(abaSelecionada(page)).toHaveText('Alunos', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('heading', { name: 'Acesso dos alunos' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
  })

  test('um valor de aba que não existe, e o `visao-geral` de antes, abrem Hoje', async ({ page, hasTouch }) => {
    const { turmaId } = await entrar(page, hasTouch)
    await irPara(page, `/professor/turmas/${turmaId}?aba=qualquer-coisa`)
    await expect(abaSelecionada(page)).toHaveText('Hoje', { timeout: SCREEN_TIMEOUT_MS })
    await irPara(page, `/professor/turmas/${turmaId}?aba=visao-geral`)
    await expect(abaSelecionada(page)).toHaveText('Hoje')
    await expect(page.getByRole('region', { name: 'Sinais da turma' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
  })

  test('trocar de aba guarda a aba no endereço e não empilha histórico: o Voltar sai da turma, e não passa pelas abas', async ({ page, hasTouch }) => {
    const { turmaId } = await entrar(page, hasTouch)
    await irPara(page, `/professor/turmas/${turmaId}`)
    await expect(abaSelecionada(page)).toHaveText('Hoje', { timeout: SCREEN_TIMEOUT_MS })
    await activate(page.getByRole('tab', { name: 'Alunos' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/turmas/${turmaId}\\?aba=alunos$`))
    await activate(page.getByRole('tab', { name: 'Atividades' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`\\?aba=atividades$`))
    await page.goBack()
    await expect(page).not.toHaveURL(new RegExp(`/professor/turmas/${turmaId}`))
  })

  test('com lote aprovado, Hoje mostra o acerto por habilidade em barra neutra e sem nota, ranking nem aluno', async ({ page, hasTouch }) => {
    const { api, turmaId } = await entrar(page, hasTouch)
    api.desempenho = desempenhoSintetico(turmaId)
    comLote(api, turmaId)
    await irPara(page, `/professor/turmas/${turmaId}`)
    const habilidades = page.getByRole('region', { name: 'Acerto por habilidade' })
    await expect(habilidades).toContainText('QUI.EM.04', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(habilidades).toContainText('20 de 28')
    await expect(habilidades).toContainText('8 alunos acertaram menos da metade das questões desta habilidade nas atividades aprovadas.')
    await expect(habilidades).toContainText('Nenhum aluno acertou menos da metade das questões desta habilidade nas atividades aprovadas.')
    // A barra é neutra: cinza, nunca vermelha.
    expect(await habilidades.locator('svg rect').evaluateAll((retangulos) => [...new Set(retangulos.map((retangulo) => getComputedStyle(retangulo).fill))])).toEqual(['rgb(240, 240, 240)', 'rgb(93, 93, 93)'])
    await expect(principal(page)).not.toContainText(VOCABULARIO_DE_NOTA)
    await expect(principal(page)).not.toContainText(/ranking|pódio|posição|º lugar/i)
    await expect(principal(page).getByRole('region', { name: 'Por aluno' })).toHaveCount(0)
  })

  test('Hoje mantém a página parada a 1366 × 768: quem rola é o painel da aba, e as abas não saem do lugar', async ({ page }) => {
    // A professora entra pela API e abre a turma numa carga só: o caso paga uma entrada a menos (o portão reprova caso acima de 15 s).
    const api = await mockAssistenteApi(page)
    const professora = await criarEquipeComSenha()
    const turma = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(professora.escolaId, turma.vinculoIds)
    api.desempenho = desempenhoSintetico(turma.turmaId)
    comLote(api, turma.turmaId)
    const entrada = await page.request.post('/v1/sessao/email', { data: { email: professora.email, senha: professora.senha } })
    expect(entrada.ok(), 'a entrada pela API').toBe(true)
    await page.goto(`/professor/turmas/${turma.turmaId}`)
    await expect(page.getByRole('region', { name: 'Acerto por habilidade' })).toContainText('QUI.EM.04', { timeout: SIGN_IN_TIMEOUT_MS })
    await soOPainelDaAbaRola(page)
  })

  test('com lote aprovado, Atividades mostra a atividade encerrada e o caminho para a correção', async ({ page, hasTouch }) => {
    const { api, turmaId } = await entrar(page, hasTouch)
    comLote(api, turmaId)
    await irPara(page, `/professor/turmas/${turmaId}?aba=atividades`)
    const atividades = page.getByRole('region', { name: 'Atividades da turma' })
    await expect(atividades).toContainText('Encerrada · avaliativa · 26 de 30 alunos enviaram', { timeout: SIGN_IN_TIMEOUT_MS })
    // A linha abre o painel da atividade (11.0), e é nele que mora o caminho para a correção.
    await activate(atividades.getByRole('button', { name: /Atividade de estequiometria/ }), hasTouch)
    await expect(page.getByRole('dialog', { name: 'Atividade de estequiometria' }).getByRole('link', { name: 'Revisar a correção' })).toBeVisible()
  })
  // Alunos, com lote aprovado (ordem de nome, acertos, sem nota nem ranking), é de `professor-turma-alunos.spec.ts` (telas do professor, 12.0): a lista
  // de nomes vem da API de verdade, e o caso paga a entrada da professora uma vez só.
})

test.describe('a turma aberta: quem alcança e quem perde (regra 10)', () => {
  test('a turma de outra escola responde "Turma indisponível", sem o nome dela nem o que ela guarda', async ({ page, hasTouch }) => {
    await entrar(page, hasTouch)
    const outra = await criarEquipeComSenha()
    const dela = await criarAlocacaoDoProfessor(outra.escolaId, outra.usuarioId, ['Geografia'])
    await confirmarVinculosNoBanco(outra.escolaId, dela.vinculoIds)
    // Os pedidos da aba Hoje, vistos por quem os faz: nenhum sai para a turma de outra escola (a aba só monta com a turma lida).
    const pedidosDaAba: string[] = []
    page.on('request', (pedido) => {
      const url = new URL(pedido.url())
      if (url.pathname === '/v1/sinais' || url.pathname === '/v1/tutor/uso') pedidosDaAba.push(`${url.pathname}${url.search}`)
    })
    await irPara(page, `/professor/turmas/${dela.turmaId}?aba=hoje`)
    await expect(principal(page).getByRole('status').filter({ hasText: TURMA_INDISPONIVEL })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(dela.turmaNome)
    await expect(principal(page).getByRole('region', { name: 'Sinais da turma' })).toHaveCount(0)
    expect(pedidosDaAba.filter((pedido) => pedido.includes(dela.turmaId))).toEqual([])
  })

  test('a turma que não existe responde "Turma indisponível", igual à de outra escola', async ({ page, hasTouch }) => {
    await entrar(page, hasTouch)
    await irPara(page, `/professor/turmas/${randomUUID()}?aba=hoje`)
    await expect(principal(page).getByRole('status').filter({ hasText: TURMA_INDISPONIVEL })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('tab')).toHaveCount(0)
  })

  test('o vínculo encerrado tira a turma: a página responde "Turma indisponível"', async ({ page, hasTouch }) => {
    const { professora, turmaId } = await entrar(page, hasTouch)
    await encerrarVinculosNoBanco(professora.escolaId, turmaId, professora.usuarioId)
    await irPara(page, `/professor/turmas/${turmaId}`)
    await expect(principal(page).getByRole('status').filter({ hasText: TURMA_INDISPONIVEL })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('tab')).toHaveCount(0)
  })
})
