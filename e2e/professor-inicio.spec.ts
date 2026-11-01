import { randomUUID } from 'node:crypto'
import { atividadeSintetica, versaoAdaptada } from './support/assistente.ts'
import { conferirAssinaturas } from './support/avatar.ts'
import { caixa } from './support/professor-flow.ts'
import { activate, entrar, irPara, SCREEN_TIMEOUT_MS } from './support/professor/scenario.ts'
import { esperarSino, listaDoSino } from './support/professor/sino.ts'
import { horizontalOverflow, seriousViolations } from './support/checks.ts'
import { expect, test } from './support/profiles.ts'

/**
 * A Home do professor, "Início" (A2 e telas do professor, 3.0; `docs/interface.md` 11.5): o fluxo. Os estados (carregando,
 * erro, com dado), a saudação pela hora, a assinatura do Assistente e os atalhos, um a um, são do teste de componente
 * (`apps/web/src/areas/professor/inicio/Home.test.tsx`); aqui está o que só o navegador mostra: a entrada pela API de verdade, o
 * atalho que leva ao cartão na conversa, a medida nas duas larguras. O recomeço pela pessoa seguinte (o texto que a primeira deixa
 * na caixa) é do caso de recomeço de `professor-sino.spec.ts`, que já sobe a segunda professora na mesma aba. Separado de
 * `professor-assistente.spec.ts` pela 2.5.
 */

test.describe('a Home (11.5)', () => {
  test('sem turma confirmada, a tela diz o que falta e leva a Turmas; não há caixa de pedido', async ({ page, hasTouch }) => {
    // Entrada, troca de tela e recarga com a CPU ×4 e a rede lenta do perfil: o teste percorre vários estados da mesma tela.
    test.slow()
    await entrar(page, hasTouch, { comTurma: false })
    await irPara(page, '/professor/nova-conversa')
    await expect(page.getByText('Falta uma turma confirmada')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(caixa(page)).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await activate(page.getByRole('button', { name: 'Ir para Turmas' }), hasTouch)
    await expect(page).toHaveURL(/\/professor\/turmas$/)
  })

  test('com dado: o Assistente se apresenta e a caixa tem a turma e os três atalhos, sem o menu "Ferramenta" nem "Esperando você"', async ({ page, hasTouch }) => {
    const { turmaId, turmaNome, disciplinaId } = await entrar(page, hasTouch)

    // A saudação pela hora, com o primeiro nome, e o Assistente com a função e o selo "IA" no mesmo bloco.
    const principal = page.getByRole('main')
    await expect(page.getByText(/^(Bom dia|Boa tarde|Boa noite), Professora\.$/)).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(principal.getByRole('heading', { level: 1, name: 'Início' })).toBeAttached()
    expect(await conferirAssinaturas(principal)).toBe(1)
    await expect(principal.locator('[data-assinatura]')).toContainText('Assistente de ensino')
    await expect(caixa(page)).toBeVisible()
    await expect(page.getByLabel('Turma e disciplina')).toHaveValue(`${turmaId}:${disciplinaId}`)
    await expect(page.getByLabel('Turma e disciplina').locator('option')).toHaveText([`${turmaNome} · Química`])
    await expect(principal).toContainText('O Assistente é uma IA e pode errar · Nada chega à turma sem você aprovar')

    // Os atalhos são as três ferramentas que existem, e a caixa não tem mais o menu "Ferramenta".
    const atalhos = principal.getByRole('group', { name: 'Atalhos de ferramenta' })
    await expect(atalhos.getByRole('button')).toHaveText([/^Plano de aula/, /^Adaptação/, /^Atividade objetiva/])
    await expect(atalhos.getByRole('link', { name: 'Ferramentas' })).toHaveAttribute('href', '/professor/ferramentas')
    await expect(page.getByRole('button', { name: 'Ferramenta', exact: true })).toHaveCount(0)
    await expect(principal.getByRole('heading', { name: 'Esperando você' })).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('com entrega pendente, o sino a conta e a lista leva a ela; o Início não a mostra', async ({ page, hasTouch }) => {
    // A entrega já espera a professora quando ela entra: a Home abre sem recarregar e o sino já a tem.
    await entrar(page, hasTouch, { antes: (api, turmaId) => void (api.entregas = [versaoAdaptada(atividadeSintetica(turmaId, randomUUID())).entrega]) })
    const principal = page.getByRole('main')
    await esperarSino(page, 'Esperando você, 1')
    await expect(caixa(page)).toBeVisible()
    await expect(principal.getByRole('heading', { name: 'Esperando você' })).toHaveCount(0)
    await expect(principal).not.toContainText('Há mais entregas esperando você')
    await expect(principal).not.toContainText('Atividade de estequiometria (versão adaptada)')
    await expect(principal.getByRole('link', { name: /^Ver e decidir|^Revisar/ })).toHaveCount(0)
    await activate(page.getByRole('button', { name: /^Esperando você/ }), hasTouch)
    await expect(listaDoSino(page).getByRole('link', { name: /Versão adaptada para decidir.*Atividade de estequiometria \(versão adaptada\)/ })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
  })

  test('o atalho da atividade abre o cartão na conversa com o texto da caixa como tema', async ({ page, hasTouch }) => {
    const { api, turmaNome } = await entrar(page, hasTouch)
    await caixa(page).fill('Equilíbrio químico')
    await activate(page.getByRole('group', { name: 'Atalhos de ferramenta' }).getByRole('button', { name: /^Atividade objetiva/ }), hasTouch)
    await expect(page).toHaveURL(/\/professor\/conversa$/)
    const cartao = page.locator('[data-cartao-de-ferramenta="atividade_objetiva"]')
    await expect(cartao.getByLabel('Tema')).toHaveValue('Equilíbrio químico', { timeout: SCREEN_TIMEOUT_MS })
    await expect(cartao.getByLabel('Turma e disciplina').locator('option:checked')).toHaveText(`${turmaNome} · Química`)
    // Atalho é a escolha da ferramenta: nenhum pedido sai para o Assistente.
    expect(api.pedidosEm(/mensagens$/)).toHaveLength(0)
  })

  test('a medida: o grupo fica a um terço da altura livre, a caixa e os atalhos aparecem sem rolar, e nada passa da largura', async ({ page, hasTouch }) => {
    await entrar(page, hasTouch)
    const janela = page.viewportSize()
    if (janela === null) throw new Error('o projeto não declara a janela')
    const grupo = page.locator('[data-grupo-do-inicio]')
    await expect(grupo).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    const atalhos = page.getByRole('group', { name: 'Atalhos de ferramenta' })
    await expect(atalhos).toBeVisible()
    expect(await horizontalOverflow(page)).toBe(0)

    // A caixa e os atalhos cabem na primeira tela, e cada alvo dentro da largura da janela.
    const campo = await caixa(page).boundingBox()
    expect((campo?.y ?? 0) + (campo?.height ?? 0), 'o fim da caixa').toBeLessThanOrEqual(janela.height)
    const fimDosAtalhos = await atalhos.boundingBox()
    expect((fimDosAtalhos?.y ?? 0) + (fimDosAtalhos?.height ?? 0), 'o fim dos atalhos').toBeLessThanOrEqual(janela.height)
    const alvos = await atalhos.locator('button, a').evaluateAll((itens) => itens.map((item) => item.getBoundingClientRect()).map((caixaDoItem) => ({ topo: Math.round(caixaDoItem.top), esquerda: caixaDoItem.left, direita: caixaDoItem.right, altura: caixaDoItem.height })))
    expect(alvos).toHaveLength(4)
    for (const alvo of alvos) {
      expect(alvo.esquerda).toBeGreaterThanOrEqual(0)
      expect(alvo.direita).toBeLessThanOrEqual(janela.width)
      expect(alvo.altura).toBeGreaterThanOrEqual(44)
    }
    // Abaixo de 768 px os quatro não cabem numa linha: quebram em mais de uma, em vez de rolar de lado.
    if (janela.width < 768) expect(new Set(alvos.map((alvo) => alvo.topo)).size, 'linhas dos atalhos').toBeGreaterThan(1)

    // O espaço de baixo é o dobro do de cima, e a tela não rola no computador.
    const folga = await grupo.evaluate((no) => {
      const moldura = no.parentElement?.getBoundingClientRect()
      const caixaDoGrupo = no.getBoundingClientRect()
      return { emCima: caixaDoGrupo.top - (moldura?.top ?? 0), embaixo: (moldura?.bottom ?? 0) - caixaDoGrupo.bottom }
    })
    if (janela.width >= 768) {
      expect(Math.abs(folga.embaixo - 2 * folga.emCima), `em cima ${String(folga.emCima)}, embaixo ${String(folga.embaixo)}`).toBeLessThanOrEqual(2)
      const rolagem = await page.evaluate(() => (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight)
      expect(rolagem, 'a página rola').toBeLessThanOrEqual(0)
    }
  })
})
