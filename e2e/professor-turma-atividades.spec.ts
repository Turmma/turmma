import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import type { AtividadeAplicada } from '../packages/shared/src/index.ts'
import { loteSintetico, portao, simularAssistente } from './support/assistente.ts'
import { PRAZO_DA_ENTRADA_MS } from './support/casca.ts'
import { acionar, irPara, PRAZO_DA_TELA_MS, VOCABULARIO_DE_NOTA } from './support/professor/scenario.ts'
import { principal } from './support/professor-flow.ts'
import { expect, test } from './support/profiles.ts'
import { confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarEquipeComSenha, type EquipeDeTeste } from './support/seed.ts'
import { larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './support/checks.ts'

/**
 * A aba Atividades da turma aberta (telas do professor, 11.0; RF17, RF22): a linha de cada atividade, o painel ao lado no
 * endereço, encerrar com a confirmação, "Aplicar uma atividade" e a troca de turma. A API das atividades é a simulada do Assistente; a
 * sessão, a turma e os vínculos são os de verdade. Cada caso paga a entrada da professora (cerca de 11 s na máquina), por isso cada
 * um prova uma coisa só e confere pouco depois dela. Recarregar com o painel no endereço é caso de componente (`AtividadesDaTurma.test.tsx`,
 * `?atividade=<id>` abre o painel): cada carga completa da página custa perto de 10 s, e um caso com duas passa de 15 s. A segunda pessoa na mesma aba está no
 * caso de recomeço de `professor-sino.spec.ts`: um caso com duas entradas passa de 15 s.
 */

/** A professora com a turma confirmada, a API do Assistente simulada, e a sessão ainda por abrir (`abrirJaEntrando`). */
async function preparar(page: Page) {
  const api = await simularAssistente(page)
  const professora = await criarEquipeComSenha()
  const turma = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Química'])
  await confirmarVinculosNoBanco(professora.escolaId, turma.vinculoIds)
  return { api, professora, turmaId: turma.turmaId, turmaNome: turma.turmaNome }
}

/** Entra pela API (o cookie fica na aba) e abre o endereço: uma carga de página só, sem passar pela tela de entrada. */
async function abrirJaEntrando(page: Page, professora: EquipeDeTeste, endereco: string): Promise<void> {
  const resposta = await page.request.post('/v1/sessao/email', { data: { email: professora.email, senha: professora.senha } })
  expect(resposta.ok(), 'a entrada pela API').toBe(true)
  await page.goto(endereco)
}

const TITULO = 'Atividade de estequiometria'
const lista = (page: Page) => page.getByRole('region', { name: 'Atividades da turma' })
const painelDa = (page: Page, titulo = TITULO) => page.getByRole('dialog', { name: titulo })

function atividade(turmaId: string, campos: Partial<AtividadeAplicada> = {}): AtividadeAplicada {
  return {
    id: randomUUID(),
    artefatoId: randomUUID(),
    turmaId,
    titulo: TITULO,
    avaliativa: false,
    estado: 'aberta',
    questoes: 2,
    aplicadaEm: '2026-10-05T13:00:00.000Z',
    encerradaEm: null,
    participacao: { alunos: 30, iniciaram: 12, enviaram: 10 },
    entrega: null,
    ...campos,
  }
}

test.describe('Atividades da turma: a linha, o painel e encerrar (X3, 11.0)', () => {
  test('a atividade avaliativa aberta diz que o Tutor está pausado até encerrar; encerrar diz o que acontece, manda um pedido só com dois cliques, e a linha vira Encerrada com o link da correção', async ({ page, hasTouch }) => {
    const { api, professora, turmaId, turmaNome } = await preparar(page)
    const aberta = atividade(turmaId, { avaliativa: true })
    api.aplicadas = [aberta]
    api.loteAoEncerrar = loteSintetico
    await abrirJaEntrando(page, professora, `/professor/turmas/${turmaId}?aba=atividades`)
    const linha = lista(page).getByRole('button', { name: new RegExp(TITULO) })
    await expect(linha).toContainText('Aberta para a turma · avaliativa · 10 de 30 alunos enviaram', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linha).toContainText('Aberta')

    await acionar(linha, hasTouch)
    await expect(page).toHaveURL(new RegExp(`\\?aba=atividades&atividade=${aberta.id}$`))
    const painel = painelDa(page)
    await expect(painel).toContainText('É avaliativa: o Tutor está pausado para a turma até você encerrar.', { timeout: PRAZO_DA_TELA_MS })
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // A confirmação diz o que vai acontecer antes de confirmar, e nada é pedido até a professora confirmar.
    await acionar(painel.getByRole('button', { name: 'Encerrar a atividade' }), hasTouch)
    const encerrar = page.getByRole('alertdialog', { name: 'Encerrar a atividade' })
    await expect(encerrar).toContainText('As respostas param agora')
    await expect(encerrar).toContainText('a correção fica esperando você revisar e aprovar')
    await expect(encerrar).toContainText('10 de 30 alunos')
    await expect(encerrar).toContainText(turmaNome)
    expect(api.pedidosEm(/encerrar$/)).toHaveLength(0)
    // Dois cliques em confirmar mandam um pedido só (regra 80, item 7).
    await encerrar.getByRole('button', { name: 'Encerrar a atividade' }).dblclick()
    await expect(encerrar).toBeHidden({ timeout: PRAZO_DA_TELA_MS })
    expect(api.pedidosEm(/encerrar$/)).toHaveLength(1)

    await expect(linha).toContainText('Encerrada · avaliativa', { timeout: PRAZO_DA_TELA_MS })
    await expect(linha).toContainText('Correção para revisar')
    await expect(painel.getByRole('link', { name: 'Revisar a correção' })).toBeVisible()
    await expect(painel.getByRole('button', { name: 'Encerrar a atividade' })).toHaveCount(0)
    await expect(painel).not.toContainText('Tutor está pausado')
    // O botão que tinha o foco saiu com o estado: o foco não se perde no corpo da página.
    await expect(painel.locator(':focus')).toHaveCount(1)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await expect(page.locator('body')).not.toContainText(VOCABULARIO_DE_NOTA)
  })

  test('"Aplicar uma atividade" leva a Criados já filtrado pela turma e pelo tipo, e o endereço só leva ids e o tipo', async ({ page, hasTouch }) => {
    const { api, professora, turmaId, turmaNome } = await preparar(page)
    api.aplicadas = [atividade(turmaId)]
    await abrirJaEntrando(page, professora, `/professor/turmas/${turmaId}?aba=atividades`)
    await expect(lista(page).getByRole('button', { name: new RegExp(TITULO) })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(lista(page).getByRole('link', { name: 'Aplicar uma atividade' }), hasTouch)

    await expect(page).toHaveURL(new RegExp(`/professor/criados\\?tipo=atividade_objetiva&turma=${turmaId}$`))
    await expect(principal(page).getByRole('heading', { level: 1, name: 'Criados' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    // No computador os filtros são menus com o valor escolhido; no celular, o botão "Filtrar (2)".
    if (hasTouch) await expect(principal(page).getByRole('button', { name: 'Filtrar (2)' })).toBeVisible()
    else await expect(principal(page)).toContainText(turmaNome)
    expect(new URL(page.url()).search).not.toContain(turmaNome)
  })

  test('trocar de turma fecha o painel, e a resposta atrasada de encerrar da primeira não aparece na lista da segunda (guarda de regressão; o recomeço por turma é provado no componente)', async ({ page, hasTouch }) => {
    const { api, professora, turmaId } = await preparar(page)
    const outra = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Física'], `8ºB sintética ${randomUUID().slice(0, 6)}`)
    await confirmarVinculosNoBanco(professora.escolaId, outra.vinculoIds)
    const daPrimeira = atividade(turmaId, { titulo: 'Atividade da primeira turma' })
    const daSegunda = atividade(outra.turmaId, { titulo: 'Atividade da segunda turma' })
    api.aplicadas = [daPrimeira, daSegunda]
    // O encerrar da primeira fica no ar até a professora estar na segunda turma.
    const segura = portao()
    api.trocar('encerrar', async () => {
      await segura.aberta
      return { status: 200, corpo: { atividade: { ...daPrimeira, estado: 'encerrada', encerradaEm: '2026-10-05T13:50:00.000Z', entrega: null }, execucaoId: null } }
    })
    await abrirJaEntrando(page, professora, `/professor/turmas/${turmaId}?aba=atividades&atividade=${daPrimeira.id}`)
    await acionar(painelDa(page, daPrimeira.titulo).getByRole('button', { name: 'Encerrar a atividade' }), hasTouch)
    await acionar(page.getByRole('alertdialog', { name: 'Encerrar a atividade' }).getByRole('button', { name: 'Encerrar a atividade' }), hasTouch)
    await expect.poll(() => api.pedidosEm(/encerrar$/).length).toBe(1)

    await irPara(page, `/professor/turmas/${outra.turmaId}?aba=atividades`)
    await expect(lista(page).getByRole('button', { name: /Atividade da segunda turma/ })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const respondeu = page.waitForResponse((resposta) => /encerrar$/.test(new URL(resposta.url()).pathname))
    // A resposta atrasada invalida as listas e a da turma aberta é lida de novo: a segunda turma segue como estava depois das duas.
    const releitura = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/atividades-aplicadas')
    segura.abrir()
    await respondeu
    await releitura
    await expect(lista(page).getByRole('button', { name: /Atividade da segunda turma/ })).toContainText('Aberta')
    await expect(lista(page).getByRole('button', { name: /Atividade da segunda turma/ })).not.toContainText('Encerrada')
    await expect(lista(page).getByRole('button', { name: /Atividade da primeira turma/ })).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test.describe('Atividades da turma: a lista (X3, 11.0)', () => {
  test('360 px: a lista e o painel em folha de baixo não rolam de lado e não têm violação grave', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    const { api, professora, turmaId } = await preparar(page)
    api.aplicadas = [atividade(turmaId)]
    await abrirJaEntrando(page, professora, `/professor/turmas/${turmaId}?aba=atividades`)
    const linha = lista(page).getByRole('button', { name: new RegExp(TITULO) })
    await expect(linha).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(await larguraExcedente(page)).toBe(0)
    await acionar(linha, hasTouch)
    await expect(painelDa(page)).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })
})
