import { randomUUID } from 'node:crypto'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { atividadeSintetica, apiError, loteSintetico, gate, versaoAdaptada } from './support/assistente.ts'
import { preencherAJanelaDaProva, principal } from './support/professor-flow.ts'
import { colocarAlunoNaTurma, criarAlunoComMatricula } from './support/seed.ts'
import { activate, entrar, irPara, SCREEN_TIMEOUT_MS } from './support/professor/scenario.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { horizontalOverflow, larguraExcedenteDoDialogo, seriousViolations } from './support/checks.ts'
import { expect, test } from './support/profiles.ts'

/**
 * Aplicar à turma e encerrar, no artefato (A3, pacote W). Separado de `professor-turma.spec.ts` pela 2.5.
 */

test.describe('aplicar à turma e encerrar, no artefato (A3)', () => {
  test('aplicar pede a escolha "é avaliativa?" e diz o que acontece com o Tutor; a atividade fica atribuída; encerrar diz o que acontece, e a correção fica para revisar', async ({ page, hasTouch }) => {
    test.slow()
    const { api, professora, turmaId, turmaNome, disciplinaId } = await entrar(page, hasTouch)
    // Dois alunos de verdade na turma: a lista do tempo adicional lê `GET /v1/turmas/:id/alunos`, que esta tela não simula.
    const aluna = await criarAlunoComMatricula({ escola: professora, nome: 'Ana Souza' })
    await colocarAlunoNaTurma(aluna, { turmaId, turmaNome, serieNome: '7º ano do Ensino Fundamental' })
    await colocarAlunoNaTurma(await criarAlunoComMatricula({ escola: professora, nome: 'Bia Lima' }), { turmaId, turmaNome, serieNome: '7º ano do Ensino Fundamental' })
    const atividade = atividadeSintetica(turmaId, disciplinaId)
    const pendente = versaoAdaptada(atividade)
    api.artefatos = [atividade, pendente.artefato]
    api.entregas = [pendente.entrega]
    api.loteAoEncerrar = loteSintetico

    // A versão adaptada que ainda espera a aprovação não vai à turma: a tela diz por quê, e não oferece o botão. A seção é a aba
    // "Na turma" do documento, que também abre pelo endereço (`?aba=turma`).
    await irPara(page, `/professor/artefatos/${pendente.artefato.id}?aba=turma`)
    const naTurma = page.locator('[data-aplicacao-do-artefato]')
    await expect(naTurma).toContainText('Esta versão adaptada só pode ser aplicada à turma depois que você aprovar.', { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('button', { name: 'Aplicar à turma' })).toHaveCount(0)

    // Carregando e com falha, a seção não afirma que a atividade não foi aplicada, nem oferece "Aplicar à turma".
    const segura = gate()
    api.trocar('aplicadas', async () => {
      await segura.aberta
      return apiError(503, 'INDISPONIVEL_TENTE_DE_NOVO')
    })
    // A recarga esquece a lista que a versão adaptada já leu (é a mesma turma), e a tela lê de novo.
    await page.reload()
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeAttached({ timeout: SCREEN_TIMEOUT_MS })
    await irPara(page, `/professor/artefatos/${atividade.id}`)
    // O documento abre em Conteúdo, que não oferece aplicar: a professora vai à aba "Na turma" pelo clique.
    await expect(page.getByRole('tab', { name: 'Conteúdo', selected: true })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('button', { name: 'Aplicar à turma' })).toHaveCount(0)
    await activate(page.getByRole('tab', { name: 'Na turma' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/artefatos/${atividade.id}\\?aba=turma$`))
    await expect(naTurma.getByText('Carregando as aplicações desta atividade…')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(naTurma).not.toContainText('ainda não foi aplicada')
    await expect(page.getByRole('button', { name: 'Aplicar à turma' })).toHaveCount(0)
    segura.abrir()
    await expect(naTurma.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: SCREEN_TIMEOUT_MS })
    await expect(naTurma).not.toContainText('ainda não foi aplicada')
    await expect(page.getByRole('button', { name: 'Aplicar à turma' })).toHaveCount(0)
    api.trocar('aplicadas')
    await activate(naTurma.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(naTurma).toContainText('Esta atividade ainda não foi aplicada.', { timeout: SCREEN_TIMEOUT_MS })
    const aplicar = page.getByRole('button', { name: 'Aplicar à turma' })
    // Decisão da professora, registrada: o botão é o preto. O ponteiro sai de cima dele: o "Tentar de novo" estava ali.
    if (!hasTouch) await page.mouse.move(0, 0)
    expect(await aplicar.evaluate((botao) => getComputedStyle(botao).backgroundColor)).toBe('rgb(51, 51, 51)')
    await activate(aplicar, hasTouch)
    const dialogo = page.getByRole('alertdialog', { name: 'Aplicar à turma' })
    await expect(dialogo).toContainText(atividade.titulo)
    await expect(dialogo).toContainText(turmaNome)
    await expect(dialogo).toContainText('Os alunos da turma passam a ver a atividade e podem responder.')
    // As duas escolhas dizem o que acontece com o Tutor, e nenhuma vem marcada.
    await expect(dialogo.getByRole('radio')).toHaveCount(2)
    await expect(dialogo.getByRole('radio', { checked: true })).toHaveCount(0)
    await expect(dialogo).toContainText('O Tutor continua disponível para a turma, conduzindo por perguntas.')
    await expect(dialogo).toContainText('O Tutor fica pausado para a turma até você encerrar a atividade.')
    // Sem escolher, nada é aplicado.
    await activate(dialogo.getByRole('button', { name: 'Aplicar à turma' }), hasTouch)
    await expect(dialogo.getByText('Escolha se a atividade é prática ou avaliativa.')).toBeVisible()
    expect(api.pedidosEm(/atividades-aplicadas$/)).toHaveLength(0)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    // A primeira leitura dos alunos fica no ar e depois falha (429, que a tela não repete sozinha); a seguinte vai à API de verdade.
    const seguraOsAlunos = gate()
    let leituras = 0
    await page.route('**/v1/turmas/*/alunos*', async (route) => {
      leituras += 1
      if (leituras > 1) return route.fallback()
      await seguraOsAlunos.aberta
      const { status, corpo } = apiError(429, 'LIMITE_EXCEDIDO')
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) })
    })
    await dialogo.getByRole('radio', { name: /^É avaliativa/ }).check()
    // Carregando: a lista diz que lê, e os campos da janela já estão na tela. Com falha: a mensagem em português e o botão, nunca a lista vazia.
    await expect(dialogo.getByText('Carregando os alunos da turma…')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(dialogo.getByLabel('Abre em')).toBeVisible()
    seguraOsAlunos.abrir()
    await expect(dialogo.getByRole('alert').filter({ hasText: MENSAGENS_DE_ERRO.LIMITE_EXCEDIDO })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(dialogo).not.toContainText('Esta turma ainda não tem alunos.')
    await activate(dialogo.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    // A avaliativa é uma prova (avaliacao-e-correcao, 10.0): os campos aparecem com rótulo, e a lista do tempo adicional traz os alunos da turma, um por linha, numa coluna só.
    for (const rotulo of ['Abre em', 'Fecha em', 'Duração (minutos)', 'Embaralhar questões', 'Embaralhar alternativas']) await expect(dialogo.getByLabel(rotulo, { exact: true })).toBeAttached()
    const tempoAdicional = dialogo.getByRole('group', { name: 'Tempo adicional' })
    const ana = tempoAdicional.getByRole('combobox', { name: 'Ana Souza' })
    const bia = tempoAdicional.getByRole('combobox', { name: 'Bia Lima' })
    await expect(ana).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    const [caixaDeAna, caixaDeBia] = [await ana.boundingBox(), await bia.boundingBox()]
    expect(caixaDeAna?.x).toBe(caixaDeBia?.x)
    expect(caixaDeAna?.y).toBeLessThan(caixaDeBia?.y ?? 0)
    expect(caixaDeAna?.height).toBeGreaterThanOrEqual(24)
    // Nenhum campo de texto livre (sem motivo, sem laudo): só os dois horários, a duração, as caixas e um seletor por aluno.
    await expect(dialogo.locator('textarea, input[type="text"], input:not([type])')).toHaveCount(0)
    await paginaNaoRola(page)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    // Sem a janela, nada sai: o erro de cada campo aparece ligado a ele, e o botão de confirmar tem o alvo de 44 px.
    const confirmar = dialogo.getByRole('button', { name: 'Aplicar à turma' })
    expect((await confirmar.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    await activate(confirmar, hasTouch)
    await expect(dialogo.getByText('Diga quando a prova abre.')).toBeVisible()
    await expect(dialogo.getByLabel('Abre em')).toHaveAttribute('aria-invalid', 'true')
    expect(api.pedidosEm(/atividades-aplicadas$/)).toHaveLength(0)

    // O tempo que não cabe: 50 min de janela, 40 de duração e a Ana com +50%.
    await preencherAJanelaDaProva(dialogo, { abre: '2030-03-12T10:00', fecha: '2030-03-12T10:50', duracao: '40' })
    await ana.selectOption('50')
    await activate(confirmar, hasTouch)
    await expect(dialogo.getByText('O tempo adicional não cabe na janela: com 40 min e +50%, a janela precisa de 60 min.')).toBeVisible()
    expect(api.pedidosEm(/atividades-aplicadas$/)).toHaveLength(0)

    // Recomeço: o servidor falha com o diálogo aberto; fechar e abrir de novo limpa o erro e o que foi escrito.
    await dialogo.getByLabel('Fecha em').fill('2030-03-12T11:40')
    api.trocar('aplicar', () => apiError(503, 'INDISPONIVEL_TENTE_DE_NOVO'))
    await activate(confirmar, hasTouch)
    await expect(dialogo.getByRole('alert').filter({ hasText: MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await activate(dialogo.getByRole('button', { name: 'Cancelar' }), hasTouch)
    await expect(dialogo).toBeHidden()
    api.trocar('aplicar')
    await activate(page.getByRole('button', { name: 'Aplicar à turma' }), hasTouch)
    await expect(dialogo.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0)
    await expect(dialogo.getByRole('radio', { checked: true })).toHaveCount(0)
    await dialogo.getByRole('radio', { name: /^É avaliativa/ }).check()
    await expect(dialogo.getByLabel('Abre em')).toHaveValue('')

    // O resumo diz a prova no horário da escola, antes de confirmar, e a Ana com tempo adicional entra só na contagem.
    await preencherAJanelaDaProva(dialogo, { abre: '2030-03-12T10:00', fecha: '2030-03-12T11:40', duracao: '40' })
    await ana.selectOption('50')
    await expect(dialogo).toContainText('abre 12/03 às 10:00 · fecha às 11:40 · 40 min · 1 aluno com tempo adicional')
    // Dois cliques em confirmar mandam um pedido só (regra 80, item 7): o da falha de antes já está registrado, e o dobrado soma um.
    const jaMandados = api.pedidosEm(/atividades-aplicadas$/).length
    await dialogo.getByRole('button', { name: 'Aplicar à turma' }).dblclick()
    await expect(dialogo).toBeHidden({ timeout: SCREEN_TIMEOUT_MS })
    expect(api.pedidosEm(/atividades-aplicadas$/).slice(jaMandados).map((pedido) => pedido.corpo)).toEqual([
      {
        artefatoId: atividade.id,
        turmaId,
        avaliativa: true,
        janela: { abreEm: '2030-03-12T13:00:00.000Z', fechaEm: '2030-03-12T14:40:00.000Z' },
        duracaoMin: 40,
        embaralhar: { questoes: false, alternativas: false },
        tempoAdicional: [{ alunoId: aluna.usuarioId, percentual: 50 }],
      },
    ])
    const aplicada = naTurma.locator('[data-atividade-aplicada="aberta"]')
    await expect(aplicada).toContainText('Aberta para a turma · avaliativa · 0 de 30 alunos enviaram', { timeout: SCREEN_TIMEOUT_MS })
    await expect(aplicada).toContainText('É avaliativa: o Tutor está pausado para a turma até você encerrar.')
    // Aberta para a turma, não se aplica de novo.
    await expect(page.getByRole('button', { name: 'Aplicar à turma' })).toHaveCount(0)
    await expect(naTurma).toBeFocused()

    // Encerrar diz o que vai acontecer antes de confirmar.
    await activate(aplicada.getByRole('button', { name: 'Encerrar a atividade' }), hasTouch)
    const encerrar = page.getByRole('alertdialog', { name: 'Encerrar a atividade' })
    await expect(encerrar).toContainText('As respostas param agora')
    await expect(encerrar).toContainText('a correção fica esperando você revisar e aprovar')
    await expect(encerrar).toContainText('0 de 30 alunos')
    expect(api.pedidosEm(/encerrar$/)).toHaveLength(0)
    // Dois cliques em confirmar mandam um pedido só (regra 80, item 7).
    await encerrar.getByRole('button', { name: 'Encerrar a atividade' }).dblclick()
    await expect(encerrar).toBeHidden({ timeout: SCREEN_TIMEOUT_MS })
    expect(api.pedidosEm(/encerrar$/)).toHaveLength(1)
    const encerrada = naTurma.locator('[data-atividade-aplicada="encerrada"]')
    await expect(encerrada).toContainText('Encerrada · avaliativa', { timeout: SCREEN_TIMEOUT_MS })
    await expect(encerrada.getByRole('button', { name: 'Encerrar a atividade' })).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await activate(encerrada.getByRole('link', { name: 'Revisar a correção' }), hasTouch)
    await expect(page).toHaveURL(/\/professor\/aprovar\/[0-9a-f-]+$/)
  })

  test('com a correção suspensa pela escola, a atividade encerra sem corrigir, e a tela diz por quê e como pedir a correção de novo', async ({ page, hasTouch }) => {
    test.slow()
    const { api, turmaId, disciplinaId } = await entrar(page, hasTouch)
    const atividade = atividadeSintetica(turmaId, disciplinaId)
    api.artefatos = [atividade]
    api.aplicadas = [
      { id: randomUUID(), artefatoId: atividade.id, turmaId, titulo: atividade.titulo, avaliativa: false, estado: 'aberta', questoes: 2, aplicadaEm: '2026-10-05T13:00:00.000Z', encerradaEm: null, participacao: { alunos: 30, iniciaram: 12, enviaram: 10 }, entrega: null },
    ]
    await irPara(page, `/professor/artefatos/${atividade.id}?aba=turma`)
    const naTurma = page.locator('[data-aplicacao-do-artefato]')
    await expect(naTurma).toContainText('Aberta para a turma · prática · 10 de 30 alunos enviaram', { timeout: SCREEN_TIMEOUT_MS })
    await activate(naTurma.getByRole('button', { name: 'Encerrar a atividade' }), hasTouch)
    await activate(page.getByRole('alertdialog').getByRole('button', { name: 'Encerrar a atividade' }), hasTouch)
    const semCorrecao = naTurma.locator('[data-sem-correcao="correcao_suspensa"]')
    await expect(semCorrecao).toContainText('a coordenação suspendeu a correção de objetiva nesta escola', { timeout: SCREEN_TIMEOUT_MS })
    await expect(naTurma.getByRole('link', { name: 'Revisar a correção' })).toHaveCount(0)
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    // O pedido de "Corrigir de novo" falha: a mensagem do catálogo fica na seção, sem o código, e a atividade continua como estava.
    api.trocar('encerrar', () => apiError(503, 'INDISPONIVEL_TENTE_DE_NOVO'))
    await activate(naTurma.getByRole('button', { name: 'Corrigir de novo' }), hasTouch)
    await expect(naTurma.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: SCREEN_TIMEOUT_MS })
    await expect(naTurma.getByRole('button', { name: 'Corrigir de novo' })).toBeEnabled()
    api.trocar('encerrar')
    // A função volta: "Corrigir de novo" encerra de novo, e agora a correção nasce.
    api.loteAoEncerrar = loteSintetico
    await activate(naTurma.getByRole('button', { name: 'Corrigir de novo' }), hasTouch)
    await expect(naTurma.getByRole('link', { name: 'Revisar a correção' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(naTurma.getByRole('status')).toHaveText('Correção feita. Ela está esperando você revisar.')
    expect(api.pedidosEm(/encerrar$/)).toHaveLength(3)
    expect(await seriousViolations(page)).toEqual([])
  })
})
