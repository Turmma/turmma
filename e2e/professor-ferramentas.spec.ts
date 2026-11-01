import type { Locator, Page } from '@playwright/test'
import { ROTULOS_DA_ADAPTACAO, TIPOS_DE_ADAPTACAO } from '../packages/shared/src/assistente/conteudo.ts'
import { atividadeSintetica, apiError, mockAssistenteApi, versaoAdaptada } from './support/assistente.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { caixa } from './support/professor-flow.ts'
import { entrarPelaApi, entrarPorEmail, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { entrarEmCriados } from './support/professor/criados.ts'
import { activate, entrar, irPara, SCREEN_TIMEOUT_MS, recarregar, selosDeIA } from './support/professor/scenario.ts'
import { loadUnthrottled, expect, test } from './support/profiles.ts'
import { confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarEquipeComSenha } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * "Como vai sair" como a tela o escreve (`COMO_VAI_SAIR`, em `ferramentas.ts`). Copiado aqui de propósito: o e2e não importa o
 * módulo da web (ele puxa o React e os ícones), e o texto escrito duas vezes é o que prova que a tela mostra o que o catálogo
 * diz, e não o que ela leu de si mesma. O `plano_de_aula` não está aqui: o texto dele é coberto pela unidade (`ferramentas.test.ts`) e
 * pelo teste de componente (`Ferramenta.test.tsx`), e o e2e só abre a atividade objetiva e a Adaptação.
 */
const COMO_VAI_SAIR = {
  atividade_objetiva: [
    'Questões de múltipla escolha com gabarito, explicação e a página do material de onde cada uma saiu.',
    'Fica em Criados, para você revisar.',
    'Só vai à turma quando você escolher “Aplicar à turma”.',
  ],
  adaptacao: [
    'A mesma atividade em outra forma, cobrando o mesmo conteúdo.',
    'Nasce esperando a sua aprovação e fica em Criados. Só o tipo da adaptação é registrado.',
    'Depois de aprovada, vai à turma quando você escolher “Aplicar à turma”.',
  ],
} as const

/**
 * As ferramentas (D74) e o formulário (A2, pacote W). Separado de `professor-assistente.spec.ts` pela 2.5.
 */

test.describe('Ferramentas (D74) e o formulário', () => {
  test('o catálogo tem só as três ferramentas que existem, uma seção por categoria da D74, sem a lista do que foi gerado, que mora em Criados', async ({ page }) => {
    // Abre Ferramentas direto, pela API, com um documento já gerado: o login pela tela leva a maior parte dos 15 s do portão.
    await entrarEmCriados(page, {
      endereco: '/professor/ferramentas',
      antes: ({ api, turmaId, disciplinaId }) => {
        api.artefatos = [atividadeSintetica(turmaId, disciplinaId)]
      },
    })
    await expect(page).toHaveTitle('Ferramentas · Turmma', { timeout: SCREEN_TIMEOUT_MS })
    const principal = page.getByRole('main')
    await expect(principal.getByRole('heading', { level: 1 })).toHaveText('Ferramentas')
    await expect(principal.getByRole('heading', { level: 2 })).toHaveText(['Planejar', 'Preparar a aula', 'Avaliar'])
    await expect(page.locator('[data-ferramenta]')).toHaveCount(3)
    for (const fora of ['Prova', 'Apresentação', 'Simulado', 'Redação', 'Mapa mental', 'Corrigir', 'Também dá para só pedir', 'Que prova corrigir?']) {
      await expect(principal.getByText(fora, { exact: true })).toHaveCount(0)
    }
    await expect(principal.getByText(/em breve/i)).toHaveCount(0)
    // O que a professora já gerou saiu daqui (telas do professor, 5.0): nem o título da seção, nem o item.
    await expect(page.getByText('O que você já gerou')).toHaveCount(0)
    await expect(page.locator('[data-artefato]')).toHaveCount(0)

    // O cartão: o alvo é o link inteiro, o nome acessível é o da ferramenta e o ícone é decoração de 48 px.
    for (const [ferramenta, nome] of [
      ['plano_de_aula', 'Plano de aula'],
      ['adaptacao', 'Adaptação'],
      ['atividade_objetiva', 'Atividade objetiva'],
    ] as const) {
      const cartao = page.locator(`[data-ferramenta="${ferramenta}"]`)
      const link = cartao.getByRole('link')
      await expect(link).toHaveAttribute('href', `/professor/ferramentas/${ferramenta}`)
      await expect(link).toHaveAccessibleName(new RegExp(`^${nome}`))
      const icone = link.locator(`svg[data-icone-de-ferramenta="${ferramenta}"]`)
      await expect(icone).toHaveAttribute('aria-hidden', 'true')
      const caixaDoIcone = await icone.boundingBox()
      expect([caixaDoIcone?.width, caixaDoIcone?.height]).toEqual([48, 48])
      // 108 px de altura no mínimo, e o alvo de toque principal é a linha inteira.
      const caixaDoCartao = await cartao.boundingBox()
      expect(caixaDoCartao?.height ?? 0, `${nome}: altura do cartão`).toBeGreaterThanOrEqual(108)
      const caixaDoLink = await link.boundingBox()
      expect(caixaDoLink?.height ?? 0, `${nome}: alvo de toque`).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect(caixaDoLink?.width ?? 0, `${nome}: o link ocupa o cartão`).toBeGreaterThanOrEqual((caixaDoCartao?.width ?? 0) - 4)
    }

    // As colunas da grade: 3 a partir de 1280 px, 2 a partir de 768, 1 abaixo. O projeto mede a dele (1366 → 3, 360 → 1) e, em
    // seguida, a 800 px nos dois, que é a única largura em que as duas colunas existem.
    const colunasDaGrade = () => page.locator('[data-ferramenta]').first().locator('xpath=..').evaluate((lista) => getComputedStyle(lista).gridTemplateColumns.split(' ').length)
    const largura = page.viewportSize()?.width ?? 0
    expect(await colunasDaGrade()).toBe(largura >= 1280 ? 3 : largura >= 768 ? 2 : 1)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await page.setViewportSize({ width: 800, height: 900 })
    await expect.poll(colunasDaGrade).toBe(2)
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('cada cartão abre o formulário da ferramenta dele, e "Voltar para Ferramentas" traz de volta ao catálogo', async ({ page, hasTouch }) => {
    await entrarEmCriados(page, { endereco: '/professor/ferramentas' })
    const principal = page.getByRole('main')
    await expect(page.locator('[data-ferramenta]')).toHaveCount(3, { timeout: SCREEN_TIMEOUT_MS })
    for (const [ferramenta, nome] of [
      ['plano_de_aula', 'Plano de aula'],
      ['adaptacao', 'Adaptação'],
      ['atividade_objetiva', 'Atividade objetiva'],
    ] as const) {
      await activate(page.locator(`[data-ferramenta="${ferramenta}"]`).getByRole('link'), hasTouch)
      await expect(page).toHaveURL(new RegExp(`/professor/ferramentas/${ferramenta}$`), { timeout: SCREEN_TIMEOUT_MS })
      await expect(principal.getByRole('heading', { level: 1, name: nome })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
      await activate(page.getByRole('link', { name: 'Voltar para Ferramentas' }), hasTouch)
      await expect(page).toHaveURL(/\/professor\/ferramentas$/, { timeout: SCREEN_TIMEOUT_MS })
      await expect(principal.getByRole('heading', { level: 1, name: 'Ferramentas' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    }
  })

  test('a função suspensa tem o selo no cartão e a frase da suspensão, e os três cartões seguem abertos', async ({ page }) => {
    await entrarEmCriados(page, {
      endereco: '/professor/ferramentas',
      antes: ({ api }) => {
        api.suspensas.add('adaptacao')
      },
    })
    const selo = (ferramenta: string) => page.locator(`[data-ferramenta="${ferramenta}"]`).getByText('Suspensa pela coordenação')
    await expect(selo('adaptacao')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(selo('plano_de_aula')).toHaveCount(0)
    await expect(selo('atividade_objetiva')).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('note')).toContainText('A coordenação suspendeu a Adaptação nesta escola.')
    // Suspensa, o cartão continua um link que abre o formulário: quem explica o resto é o formulário.
    await expect(page.locator('[data-ferramenta]').getByRole('link')).toHaveCount(3)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('a leitura do time que falha não tira cartão: o aviso diz que não foi possível conferir, e "Tentar de novo" lê outra vez e põe o selo', async ({ page, hasTouch }) => {
    const { api } = await entrarEmCriados(page, {
      endereco: '/professor/ferramentas',
      antes: ({ api: simulada }) => {
        simulada.trocar('time', () => apiError(404, 'NAO_ENCONTRADO'))
      },
    })
    await expect(page.getByText('Não foi possível conferir se alguma ferramenta está suspensa')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('[data-ferramenta]').getByRole('link')).toHaveCount(3)
    await expect(page.getByText('Suspensa pela coordenação')).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    api.suspensas.add('adaptacao')
    api.trocar('time')
    await activate(page.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(page.locator('[data-ferramenta="adaptacao"]').getByText('Suspensa pela coordenação')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByText('Não foi possível conferir')).toHaveCount(0)
    await expect(page.locator('[data-ferramenta]').getByRole('link')).toHaveCount(3)

    // A ferramenta que não existe não tem formulário: o endereço responde como página não encontrada.
    await irPara(page, '/professor/ferramentas/prova')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
  })

  test('recomeço: a professora seguinte entra na mesma aba, sem recarregar, e vê o catálogo e o selo conforme a escola dela, não o da anterior', async ({ page, hasTouch }) => {
    const api = await mockAssistenteApi(page)
    api.suspensas.add('adaptacao')
    const primeira = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(primeira.escolaId, primeira.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(primeira.escolaId, alocacao.vinculoIds)
    // A segunda é de outra escola e ainda não tem turma confirmada.
    const segunda = await criarEquipeComSenha()
    await loadUnthrottled(page, async () => {
      await entrarPelaApi(page, primeira, '/professor/ferramentas')
      await expect(page.locator('[data-ferramenta="adaptacao"]').getByText('Suspensa pela coordenação')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    })
    await expect(page.getByText('Falta uma turma confirmada')).toHaveCount(0)

    if (hasTouch) await page.getByRole('button', { name: 'Sair' }).tap()
    else await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    api.suspensas.clear()
    // Pela tela, sem recarregar: a recarga apagaria o cache, e o cache é o que este caso quer ver esvaziado.
    await entrarPorEmail(page, segunda, hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await irPara(page, '/professor/ferramentas')
    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Ferramentas' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByText('Falta uma turma confirmada')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('[data-ferramenta]')).toHaveCount(3)
    await expect(page.getByText('Suspensa pela coordenação')).toHaveCount(0)
    await expect(page.locator('[data-funcao-suspensa]')).toHaveCount(0)
  })

  test('D35, D67: a Adaptação não tem campo de texto; pede a atividade, os tipos da lista fechada e o tempo extra; manda só isso; e a versão nasce esperando a professora', async ({ page, hasTouch }) => {
    // Entrada, troca de tela e recarga com a CPU ×4 e a rede lenta do perfil: o teste percorre vários estados da mesma tela.
    test.slow()
    const { api, turmaId, turmaNome, disciplinaId } = await entrar(page, hasTouch)

    // Vazio: sem atividade para adaptar, a tela diz o que falta e leva até lá.
    await irPara(page, '/professor/ferramentas/adaptacao')
    await expect(page.getByText('Ainda não há atividade para adaptar')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('button', { name: 'Gerar uma atividade' })).toBeVisible()

    const origem = atividadeSintetica(turmaId, disciplinaId)
    api.artefatos = [origem]
    await recarregar(page)
    await irPara(page, '/professor/ferramentas')
    await activate(page.locator('[data-ferramenta="adaptacao"]'), hasTouch)
    await expect(page).toHaveURL(/\/professor\/ferramentas\/adaptacao$/)
    await expect(page).toHaveTitle('Adaptação · Turmma')
    const formulario = page.locator('[data-motor="formulario"]')
    await expect(formulario).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    // Nenhum campo de texto: nem de uma linha, nem de várias. Só lista fechada.
    await expect(formulario.locator('textarea, input:not([type="checkbox"])')).toHaveCount(0)
    await expect(formulario.getByRole('textbox')).toHaveCount(0)
    await expect(formulario.getByRole('checkbox')).toHaveCount(TIPOS_DE_ADAPTACAO.length)
    for (const tipo of TIPOS_DE_ADAPTACAO) await expect(formulario.getByRole('checkbox', { name: ROTULOS_DA_ADAPTACAO[tipo], exact: true })).toBeVisible()
    await expect(formulario.getByLabel('Atividade de origem').locator('option')).toHaveText(['Escolha…', `${origem.titulo} · ${turmaNome}`])
    // Ao lado do formulário, "Como vai sair": a versão nasce esperando a aprovação e só o tipo é registrado, sem falar de aluno (D35).
    const comoVaiSair = page.locator('[data-como-vai-sair="adaptacao"]')
    await expect(comoVaiSair.getByRole('listitem')).toHaveText([...COMO_VAI_SAIR.adaptacao])
    await expect(comoVaiSair.getByText(/alun/i)).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    // Sem atividade e sem tipo, nada sai, e cada campo diz o que falta.
    await activate(formulario.getByRole('button', { name: 'Gerar versão adaptada' }), hasTouch)
    await expect(formulario.getByRole('alert')).toContainText('Para gerar, confira: Atividade de origem, Tipo de adaptação.')
    // O tempo extra só existe com "Tempo adicional" marcado: sem o tipo, o campo nem aparece, e não há o que recusar
    // depois de enviar. Marcado o tipo, o campo aparece; desmarcado, some de novo.
    await formulario.getByLabel('Atividade de origem').selectOption(origem.id)
    await formulario.getByRole('checkbox', { name: 'Fonte ampliada' }).check()
    await expect(formulario.getByLabel('Tempo extra')).toHaveCount(0)
    await formulario.getByRole('checkbox', { name: 'Tempo adicional' }).check()
    await formulario.getByLabel('Tempo extra').selectOption('50')
    await formulario.getByRole('checkbox', { name: 'Tempo adicional' }).uncheck()
    await expect(formulario.getByLabel('Tempo extra')).toHaveCount(0)
    expect(api.pedidosEm(/adaptar$/)).toHaveLength(0)

    // De volta com o tipo marcado, o campo volta com o que estava escolhido.
    await formulario.getByRole('checkbox', { name: 'Tempo adicional' }).check()
    await expect(formulario.getByLabel('Tempo extra')).toHaveValue('50')
    await activate(formulario.getByRole('button', { name: 'Gerar versão adaptada' }), hasTouch)
    await expect.poll(() => api.pedidosEm(/adaptar$/).length).toBe(1)
    const adaptar = api.pedidosEm(/adaptar$/)[0]
    expect(adaptar?.caminho).toBe(`/v1/artefatos/${origem.id}/adaptar`)
    const corpo = adaptar?.corpo as Record<string, unknown>
    // Só os tipos, o tempo extra e a chave: o pedido não tem onde levar texto.
    expect(Object.keys(corpo).sort()).toEqual(['chaveEnvio', 'tempoExtraPercentual', 'tipos'])
    expect(corpo).toMatchObject({ tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 50 })

    // A versão nasce pendente: a tela diz que espera a professora e onde decidir.
    const adaptada = versaoAdaptada(origem)
    api.artefatos = [adaptada.artefato, origem]
    api.entregas = [adaptada.entrega]
    api.concluir(api.ultimaExecucao(), { tipo: 'artefato', artefatoId: adaptada.artefato.id, entregaId: adaptada.entrega.id })
    const pronto = page.locator('[data-motor="pronto"]')
    await expect(pronto.getByText('Assistente · adaptação')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(selosDeIA(pronto)).toHaveCount(1)
    await expect(pronto.locator('[data-aprovacao="pendente"]')).toHaveText('Esperando você')
    await expect(pronto.getByText('Esta versão só pode ir aos alunos depois que você aprovar. Até lá, o PDF dela sai marcado como rascunho.')).toBeVisible()
    // Pendente, a versão só sai em PDF como rascunho, e o botão diz isso antes do clique.
    await expect(pronto.getByRole('button', { name: 'Exportar rascunho em PDF' })).toBeVisible()
    await expect(pronto.getByRole('button', { name: 'Exportar em PDF', exact: true })).toHaveCount(0)
    await expect(pronto.getByRole('link', { name: 'Ver e decidir' })).toBeVisible()
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    // O atalho da Adaptação, no Início, abre o cartão dela, e o que estava escrito na caixa não vai junto.
    await irPara(page, '/professor/nova-conversa')
    await caixa(page).fill('prova adaptada para um aluno com laudo')
    await activate(page.getByRole('group', { name: 'Atalhos de ferramenta' }).getByRole('button', { name: /^Adaptação/ }), hasTouch)
    await expect(page).toHaveURL(/\/professor\/conversa$/)
    const cartao = page.locator('[data-cartao-de-ferramenta="adaptacao"]')
    await expect(cartao.locator('[data-motor="formulario"]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(cartao.locator('textarea, input:not([type="checkbox"])')).toHaveCount(0)
    await expect(page.getByRole('main')).not.toContainText('laudo')
    expect(api.pedidosEm(/mensagens$/)).toHaveLength(0)
  })

  test('a função suspensa pela escola tira o formulário e explica, sem alarme', async ({ page, hasTouch }) => {
    // Entrada, troca de tela e recarga com a CPU ×4 e a rede lenta do perfil: o teste percorre vários estados da mesma tela.
    test.slow()
    const { api, turmaId, disciplinaId } = await entrar(page, hasTouch, { antes: (simulada) => simulada.suspensas.add('adaptacao') })
    api.artefatos = [atividadeSintetica(turmaId, disciplinaId)]
    await irPara(page, '/professor/ferramentas/adaptacao')
    await expect(page.getByRole('note')).toContainText('A coordenação suspendeu a Adaptação nesta escola.', { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('[data-motor]')).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
    // "Como vai sair" continua à vista no lugar do formulário que saiu.
    await expect(page.locator('[data-como-vai-sair="adaptacao"]').getByRole('listitem')).toHaveText([...COMO_VAI_SAIR.adaptacao])
    expect(await seriousViolations(page)).toEqual([])
    // A recusa do servidor, para quem tinha a tela aberta antes da suspensão, vira o mesmo aviso, e não um erro.
    api.suspensas.clear()
    api.trocar('gerar', () => apiError(409, 'FUNCAO_SUSPENSA'))
    await irPara(page, '/professor/ferramentas/plano_de_aula')
    const formulario = page.locator('[data-motor="formulario"]')
    await formulario.getByLabel('Tema').fill('Introdução à estequiometria')
    await activate(formulario.getByRole('button', { name: 'Gerar plano de aula' }), hasTouch)
    await expect(page.getByRole('note')).toContainText('A coordenação suspendeu a conversa e as ferramentas', { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('main')).not.toContainText('FUNCAO_SUSPENSA')
  })
})

/** Os dois cliques de um clique duplo no mesmo instante, antes de a tela desligar o botão: só a trava do pedido no ar os segura. */
async function doisCliquesNoMesmoInstante(botao: Locator): Promise<void> {
  await botao.evaluate((elemento: HTMLButtonElement) => {
    elemento.click()
    elemento.click()
  })
}

/** Quantas colunas tem a grade que leva o formulário e "Como vai sair". */
const colunasDoFormulario = (page: Page) => page.locator('[data-como-vai-sair]').locator('xpath=..').evaluate((grade) => getComputedStyle(grade).gridTemplateColumns.split(' ').length)

test.describe('O formulário da ferramenta com "Como vai sair" (telas do professor, 8.0)', () => {
  test('a 1366 px o formulário e, ao lado, "Como vai sair"; a 360 px uma coluna, com o texto depois do formulário e sem rolar de lado; o botão de gerar à vista', async ({ page }) => {
    // A atividade já gerada é o que deixa a Adaptação abrir o formulário dela, a única que rola a 1366 × 768.
    await loadUnthrottled(page, () =>
      entrarEmCriados(page, {
        endereco: '/professor/ferramentas/atividade_objetiva',
        antes: ({ api, turmaId, disciplinaId }) => {
          api.artefatos = [atividadeSintetica(turmaId, disciplinaId)]
        },
      }),
    )
    const formulario = page.locator('[data-cartao-de-ferramenta="atividade_objetiva"]')
    await expect(formulario.locator('[data-motor="formulario"]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    const bloco = page.locator('[data-como-vai-sair="atividade_objetiva"]')
    await expect(bloco.getByRole('heading', { level: 2, name: 'Como vai sair' })).toBeVisible()
    await expect(bloco.getByRole('listitem')).toHaveText([...COMO_VAI_SAIR.atividade_objetiva])
    const botao = formulario.getByRole('button', { name: 'Gerar atividade' })
    await expect(botao).toBeVisible()

    const largura = page.viewportSize()?.width ?? 0
    // A caixa do formulário, com o preenchimento dela: é ela, e não o cartão de dentro, que fica ao lado do texto.
    const caixaDoFormulario = await formulario.locator('xpath=..').boundingBox()
    const caixaDoBloco = await bloco.boundingBox()
    if (largura >= 1024) {
      // Duas colunas: o texto fica à direita do formulário, no alto, e o botão de gerar cabe nos 768 px de altura.
      expect(await colunasDoFormulario(page)).toBe(2)
      expect(caixaDoBloco?.x ?? 0).toBeGreaterThanOrEqual((caixaDoFormulario?.x ?? 0) + (caixaDoFormulario?.width ?? 0))
      expect(Math.abs((caixaDoBloco?.y ?? 0) - (caixaDoFormulario?.y ?? 0))).toBeLessThanOrEqual(2)
      // E tem a altura do texto, e não a do formulário: a coluna não se estica para acompanhá-lo.
      expect(caixaDoBloco?.height ?? 0).toBeLessThan(caixaDoFormulario?.height ?? 0)
      await expect(botao).toBeInViewport({ ratio: 1 })
      // A Adaptação é a que tem mais campos e a única que rola a 1366 × 768 com a escola cheia: o botão dela também fica à vista.
      await irPara(page, '/professor/ferramentas/adaptacao')
      await expect(page.locator('[data-cartao-de-ferramenta="adaptacao"]').getByRole('button', { name: 'Gerar versão adaptada' })).toBeInViewport({ ratio: 1, timeout: SCREEN_TIMEOUT_MS })
      await expect(page.locator('[data-como-vai-sair="adaptacao"]').getByRole('listitem')).toHaveText([...COMO_VAI_SAIR.adaptacao])
      await irPara(page, '/professor/ferramentas/atividade_objetiva')
      await expect(botao).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    } else {
      // Uma coluna: o texto vem depois do formulário, na mesma largura.
      expect(await colunasDoFormulario(page)).toBe(1)
      expect(caixaDoBloco?.y ?? 0).toBeGreaterThanOrEqual((caixaDoFormulario?.y ?? 0) + (caixaDoFormulario?.height ?? 0))
      expect(Math.round(caixaDoBloco?.x ?? 0)).toBe(Math.round(caixaDoFormulario?.x ?? 0))
      expect(Math.round(caixaDoBloco?.width ?? 0)).toBe(Math.round(caixaDoFormulario?.width ?? 0))
    }
    expect(await horizontalOverflow(page)).toBe(0)

    // O ponto da virada é 1024 px, a largura da janela e não a do contêiner: 1023 ainda é uma coluna, e 1024 já são duas.
    await page.setViewportSize({ width: 1023, height: 768 })
    await expect.poll(() => colunasDoFormulario(page)).toBe(1)
    await page.setViewportSize({ width: 1024, height: 768 })
    await expect.poll(() => colunasDoFormulario(page)).toBe(2)
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('a 1366 × 768 a página não rola em nenhum formulário: o cabeçalho fica parado, o formulário rola por dentro e o botão de gerar fica ao alcance (RF22, correção formulario-e-assistente-rolam-a-pagina)', async ({ page }) => {
    // Entrada, troca de tela e recarga com a CPU ×4 e a rede lenta do perfil: o teste percorre as três ferramentas.
    test.slow()
    await entrarEmCriados(page, {
      endereco: '/professor/ferramentas/adaptacao',
      antes: ({ api, turmaId, disciplinaId }) => {
        api.artefatos = [atividadeSintetica(turmaId, disciplinaId)]
      },
    })
    const largura = page.viewportSize()?.width ?? 0
    for (const [ferramenta, gerar] of [
      ['adaptacao', 'Gerar versão adaptada'],
      ['atividade_objetiva', 'Gerar atividade'],
      ['plano_de_aula', 'Gerar plano de aula'],
    ] as const) {
      await irPara(page, `/professor/ferramentas/${ferramenta}`)
      const botao = page.locator(`[data-cartao-de-ferramenta="${ferramenta}"]`).getByRole('button', { name: gerar })
      await expect(botao).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
      expect(await horizontalOverflow(page)).toBe(0)
      // A 360 px a página rola inteira, como qualquer outra: só se mede o miolo a partir de 768 px.
      if (largura < 768) continue

      await paginaNaoRola(page)
      const miolo = page.locator('[data-miolo-da-ferramenta]')
      const titulo = page.getByRole('main').getByRole('heading', { level: 1 })
      const tituloAntes = await titulo.boundingBox()
      expect(tituloAntes, `o título de ${ferramenta} tem caixa`).not.toBeNull()
      await miolo.evaluate((elemento) => elemento.scrollTo(0, elemento.scrollHeight))
      expect((await titulo.boundingBox())?.y, `o título de ${ferramenta} não sai do lugar com o formulário rolando`).toBe(tituloAntes?.y)
      await expect(botao, `o botão de gerar de ${ferramenta} chega à vista`).toBeInViewport({ ratio: 1 })
      await paginaNaoRola(page)
    }
  })

  test('o endereço de uma ferramenta que não existe responde como página não encontrada, sem formulário nem "Como vai sair"', async ({ page }) => {
    await loadUnthrottled(page, () => entrarEmCriados(page, { endereco: '/professor/ferramentas/xyz' }))
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('[data-como-vai-sair]')).toHaveCount(0)
    await expect(page.locator('[data-motor]')).toHaveCount(0)
  })

  test('dois cliques em "Gerar" mandam um pedido só, e o texto ao lado não muda enquanto gera', async ({ page }) => {
    const { api } = await loadUnthrottled(page, () => entrarEmCriados(page, { endereco: '/professor/ferramentas/atividade_objetiva' }))
    const formulario = page.locator('[data-motor="formulario"]')
    await expect(formulario).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    const bloco = page.locator('[data-como-vai-sair="atividade_objetiva"]')
    await formulario.getByLabel('Tema').fill('Estequiometria')
    await doisCliquesNoMesmoInstante(formulario.getByRole('button', { name: 'Gerar atividade' }))
    await expect(page.locator('[data-motor="gerando"]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect.poll(() => api.pedidosEm(/gerar$/).length).toBe(1)
    // Sem prévia: o texto ao lado é o mesmo enquanto gera, e não leva nada do que foi escrito.
    await expect(bloco.getByRole('listitem')).toHaveText([...COMO_VAI_SAIR.atividade_objetiva])
    await expect(bloco).not.toContainText('Estequiometria')
    // De novo, já num ponto estável: o segundo clique não mandou outro pedido um instante depois do primeiro.
    expect(api.pedidosEm(/gerar$/)).toHaveLength(1)
  })

  test('o formulário aberto de novo começa em branco, e o texto ao lado é o mesmo depois de gerar', async ({ page }) => {
    const { api, turmaId, disciplinaId } = await loadUnthrottled(page, () => entrarEmCriados(page, { endereco: '/professor/ferramentas/atividade_objetiva' }))
    const formulario = page.locator('[data-motor="formulario"]')
    await formulario.getByLabel('Tema').fill('Estequiometria')
    await formulario.getByRole('button', { name: 'Gerar atividade' }).click()
    await expect.poll(() => api.pedidosEm(/gerar$/).length, { timeout: SCREEN_TIMEOUT_MS }).toBe(1)
    const artefato = atividadeSintetica(turmaId, disciplinaId)
    api.artefatos = [artefato]
    api.concluir(api.ultimaExecucao(), { tipo: 'artefato', artefatoId: artefato.id, entregaId: null })
    await expect(page.locator('[data-motor="pronto"]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('[data-como-vai-sair="atividade_objetiva"]').getByRole('listitem')).toHaveText([...COMO_VAI_SAIR.atividade_objetiva])

    // Sai e volta: a geração que terminou fica em Criados, e o formulário começa em branco. Espera o catálogo no meio: as duas
    // navegações juntas se fundem, e o formulário nunca sairia da tela.
    await irPara(page, '/professor/ferramentas')
    await expect(page.locator('[data-ferramenta]')).toHaveCount(3, { timeout: SCREEN_TIMEOUT_MS })
    await irPara(page, '/professor/ferramentas/atividade_objetiva')
    await expect(page.locator('[data-motor="formulario"]').getByLabel('Tema')).toHaveValue('', { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('[data-motor="pronto"]')).toHaveCount(0)
  })

  test('recomeço: a segunda pessoa na mesma aba abre o formulário em branco, sem a geração que a primeira deixou no ar', async ({ page, hasTouch }) => {
    const api = await mockAssistenteApi(page)
    const primeira = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(primeira.escolaId, primeira.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(primeira.escolaId, alocacao.vinculoIds)
    const segunda = await criarEquipeComSenha()
    const alocacaoDaSegunda = await criarAlocacaoDoProfessor(segunda.escolaId, segunda.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(segunda.escolaId, alocacaoDaSegunda.vinculoIds)
    await loadUnthrottled(page, async () => {
      await entrarPelaApi(page, primeira, '/professor/ferramentas/atividade_objetiva')
      await expect(page.locator('[data-motor="formulario"]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    })
    // A primeira deixa uma geração no ar e sai.
    const formulario = page.locator('[data-motor="formulario"]')
    await formulario.getByLabel('Tema').fill('Tema da primeira pessoa')
    await activate(formulario.getByRole('button', { name: 'Gerar atividade' }), hasTouch)
    await expect(page.locator('[data-motor="gerando"]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect.poll(() => api.pedidosEm(/gerar$/).length).toBe(1)
    await activate(page.getByRole('button', { name: 'Sair' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })

    // Pela tela, sem recarregar: a recarga apagaria a memória da aba, e é ela que este caso quer ver esvaziada.
    await entrarPorEmail(page, segunda, hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await irPara(page, '/professor/ferramentas/atividade_objetiva')
    await expect(page.locator('[data-motor="formulario"]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('[data-motor="gerando"]')).toHaveCount(0)
    await expect(page.locator('[data-motor="pronto"]')).toHaveCount(0)
    await expect(page.locator('[data-motor="formulario"]').getByLabel('Tema')).toHaveValue('')
    await expect(page.getByRole('main')).not.toContainText('Tema da primeira pessoa')
    await expect(page.locator('[data-como-vai-sair="atividade_objetiva"]').getByRole('listitem')).toHaveText([...COMO_VAI_SAIR.atividade_objetiva])
  })
})
