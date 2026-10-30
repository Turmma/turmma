import { randomUUID } from 'node:crypto'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { atividadeSintetica, erroDaApi, loteSintetico, portao, versaoAdaptada } from './__fixtures__/assistente.ts'
import { principal } from './__fixtures__/fluxo-do-professor.ts'
import { acionar, entrar, irPara, PRAZO_DA_TELA_MS } from './__fixtures__/professor/cena.ts'
import { larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './__fixtures__/verificacoes.ts'
import { expect, test } from './__fixtures__/perfis.ts'

/**
 * Aplicar à turma e encerrar, no artefato (A3, pacote W). Separado de `professor-turma.spec.ts` pela 2.5.
 */

test.describe('aplicar à turma e encerrar, no artefato (A3)', () => {
  test('aplicar pede a escolha "é avaliativa?" e diz o que acontece com o Tutor; a atividade fica atribuída; encerrar diz o que acontece, e a correção fica para revisar', async ({ page, hasTouch }) => {
    test.slow()
    const { api, turmaId, turmaNome, disciplinaId } = await entrar(page, hasTouch)
    const atividade = atividadeSintetica(turmaId, disciplinaId)
    const pendente = versaoAdaptada(atividade)
    api.artefatos = [atividade, pendente.artefato]
    api.entregas = [pendente.entrega]
    api.loteAoEncerrar = loteSintetico

    // A versão adaptada que ainda espera a aprovação não vai à turma: a tela diz por quê, e não oferece o botão. A seção é a aba
    // "Na turma" do documento, que também abre pelo endereço (`?aba=turma`).
    await irPara(page, `/professor/artefatos/${pendente.artefato.id}?aba=turma`)
    const naTurma = page.locator('[data-aplicacao-do-artefato]')
    await expect(naTurma).toContainText('Esta versão adaptada só pode ser aplicada à turma depois que você aprovar.', { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('button', { name: 'Aplicar à turma' })).toHaveCount(0)

    // Carregando e com falha, a seção não afirma que a atividade não foi aplicada, nem oferece "Aplicar à turma".
    const segura = portao()
    api.trocar('aplicadas', async () => {
      await segura.aberta
      return erroDaApi(503, 'INDISPONIVEL_TENTE_DE_NOVO')
    })
    // A recarga esquece a lista que a versão adaptada já leu (é a mesma turma), e a tela lê de novo.
    await page.reload()
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeAttached({ timeout: PRAZO_DA_TELA_MS })
    await irPara(page, `/professor/artefatos/${atividade.id}`)
    // O documento abre em Conteúdo, que não oferece aplicar: a professora vai à aba "Na turma" pelo clique.
    await expect(page.getByRole('tab', { name: 'Conteúdo', selected: true })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('button', { name: 'Aplicar à turma' })).toHaveCount(0)
    await acionar(page.getByRole('tab', { name: 'Na turma' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/artefatos/${atividade.id}\\?aba=turma$`))
    await expect(naTurma.getByText('Carregando as aplicações desta atividade…')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(naTurma).not.toContainText('ainda não foi aplicada')
    await expect(page.getByRole('button', { name: 'Aplicar à turma' })).toHaveCount(0)
    segura.abrir()
    await expect(naTurma.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_TELA_MS })
    await expect(naTurma).not.toContainText('ainda não foi aplicada')
    await expect(page.getByRole('button', { name: 'Aplicar à turma' })).toHaveCount(0)
    api.trocar('aplicadas')
    await acionar(naTurma.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(naTurma).toContainText('Esta atividade ainda não foi aplicada.', { timeout: PRAZO_DA_TELA_MS })
    const aplicar = page.getByRole('button', { name: 'Aplicar à turma' })
    // Decisão da professora, registrada: o botão é o preto. O ponteiro sai de cima dele: o "Tentar de novo" estava ali.
    if (!hasTouch) await page.mouse.move(0, 0)
    expect(await aplicar.evaluate((botao) => getComputedStyle(botao).backgroundColor)).toBe('rgb(51, 51, 51)')
    await acionar(aplicar, hasTouch)
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
    await acionar(dialogo.getByRole('button', { name: 'Aplicar à turma' }), hasTouch)
    await expect(dialogo.getByText('Escolha se a atividade é prática ou avaliativa.')).toBeVisible()
    expect(api.pedidosEm(/atividades-aplicadas$/)).toHaveLength(0)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    await dialogo.getByRole('radio', { name: /^É avaliativa/ }).check()
    // Dois cliques em confirmar mandam um pedido só (regra 80, item 7).
    await dialogo.getByRole('button', { name: 'Aplicar à turma' }).dblclick()
    await expect(dialogo).toBeHidden({ timeout: PRAZO_DA_TELA_MS })
    expect(api.pedidosEm(/atividades-aplicadas$/).map((pedido) => pedido.corpo)).toEqual([{ artefatoId: atividade.id, turmaId, avaliativa: true }])
    const aplicada = naTurma.locator('[data-atividade-aplicada="aberta"]')
    await expect(aplicada).toContainText('Aberta para a turma · avaliativa · 0 de 30 alunos enviaram', { timeout: PRAZO_DA_TELA_MS })
    await expect(aplicada).toContainText('É avaliativa: o Tutor está pausado para a turma até você encerrar.')
    // Aberta para a turma, não se aplica de novo.
    await expect(page.getByRole('button', { name: 'Aplicar à turma' })).toHaveCount(0)
    await expect(naTurma).toBeFocused()

    // Encerrar diz o que vai acontecer antes de confirmar.
    await acionar(aplicada.getByRole('button', { name: 'Encerrar a atividade' }), hasTouch)
    const encerrar = page.getByRole('alertdialog', { name: 'Encerrar a atividade' })
    await expect(encerrar).toContainText('As respostas param agora')
    await expect(encerrar).toContainText('a correção fica esperando você revisar e aprovar')
    await expect(encerrar).toContainText('0 de 30 alunos')
    expect(api.pedidosEm(/encerrar$/)).toHaveLength(0)
    // Dois cliques em confirmar mandam um pedido só (regra 80, item 7).
    await encerrar.getByRole('button', { name: 'Encerrar a atividade' }).dblclick()
    await expect(encerrar).toBeHidden({ timeout: PRAZO_DA_TELA_MS })
    expect(api.pedidosEm(/encerrar$/)).toHaveLength(1)
    const encerrada = naTurma.locator('[data-atividade-aplicada="encerrada"]')
    await expect(encerrada).toContainText('Encerrada · avaliativa', { timeout: PRAZO_DA_TELA_MS })
    await expect(encerrada.getByRole('button', { name: 'Encerrar a atividade' })).toHaveCount(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await acionar(encerrada.getByRole('link', { name: 'Revisar a correção' }), hasTouch)
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
    await expect(naTurma).toContainText('Aberta para a turma · prática · 10 de 30 alunos enviaram', { timeout: PRAZO_DA_TELA_MS })
    await acionar(naTurma.getByRole('button', { name: 'Encerrar a atividade' }), hasTouch)
    await acionar(page.getByRole('alertdialog').getByRole('button', { name: 'Encerrar a atividade' }), hasTouch)
    const semCorrecao = naTurma.locator('[data-sem-correcao="correcao_suspensa"]')
    await expect(semCorrecao).toContainText('a coordenação suspendeu a correção de objetiva nesta escola', { timeout: PRAZO_DA_TELA_MS })
    await expect(naTurma.getByRole('link', { name: 'Revisar a correção' })).toHaveCount(0)
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    // O pedido de "Corrigir de novo" falha: a mensagem do catálogo fica na seção, sem o código, e a atividade continua como estava.
    api.trocar('encerrar', () => erroDaApi(503, 'INDISPONIVEL_TENTE_DE_NOVO'))
    await acionar(naTurma.getByRole('button', { name: 'Corrigir de novo' }), hasTouch)
    await expect(naTurma.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_TELA_MS })
    await expect(naTurma.getByRole('button', { name: 'Corrigir de novo' })).toBeEnabled()
    api.trocar('encerrar')
    // A função volta: "Corrigir de novo" encerra de novo, e agora a correção nasce.
    api.loteAoEncerrar = loteSintetico
    await acionar(naTurma.getByRole('button', { name: 'Corrigir de novo' }), hasTouch)
    await expect(naTurma.getByRole('link', { name: 'Revisar a correção' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(naTurma.getByRole('status')).toHaveText('Correção feita. Ela está esperando você revisar.')
    expect(api.pedidosEm(/encerrar$/)).toHaveLength(3)
    expect(await violacoesGraves(page)).toEqual([])
  })
})
