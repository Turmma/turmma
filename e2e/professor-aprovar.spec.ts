import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { ALUNOS_DO_LOTE, erroDaApi, portao, QUEM_DECIDE } from './support/assistente.ts'
import { abrirNavegacao, entrarPorEmail, esperarNovaConversa, lateral, PRAZO_DA_ENTRADA_MS, secoes } from './support/casca.ts'
import { cacheDeConsultas, semAcessosDaConta } from './support/query-cache.ts'
import { principal } from './support/professor-flow.ts'
import { expect, test } from './support/profiles.ts'
import { abrirODestaque, fecharOPainel, painelDoDestaque } from './support/professor/aprovar.ts'
import { acionar, comLote, entrar, irPara, PRAZO_DA_TELA_MS, recarregar } from './support/professor/scenario.ts'
import { confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarProfessoraNaEscola, encerrarSessoesDoUsuario } from './support/seed.ts'
import { larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './support/checks.ts'

/**
 * Aprovar a correção (11.5, A3, pacote W; telas do professor, 14.0). Separado de `professor-turma.spec.ts` pela 2.5. Nos dois
 * projetos: a faixa de números, as três abas no endereço, o painel do destaque aberto, a barra presa com o único botão oficial,
 * e o recomeço (recarregar, a sessão que vence com a confirmação aberta, a segunda pessoa na mesma aba).
 */

/** O que nenhuma tela do professor diz de uma correção: nota, conceito, pontuação, média, ranking (D46, D57, D64). */
const VOCABULARIO_PROIBIDO = /\bnotas?\b|\bconceitos?\b|pontuaç|\bmédia\b|ranking/i

/** O que o portão do e2e reprova: o nome de um aluno do lote em qualquer linha de console da web (regra 20, item 9). */
function semNomeDeAluno(rastros: readonly string[]): void {
  for (const rastro of rastros) for (const aluno of ALUNOS_DO_LOTE) expect(rastro, 'nome de aluno no console da web').not.toContain(aluno.nome)
}

test.describe('aprovar a correção (11.5)', () => {
  test('carregando, erro e a correção que não existe; e, com dado, o resumo assinado pela IA, sem falar em nota', async ({ page, hasTouch }) => {
    test.slow()
    const { api, professora, turmaId, turmaNome } = await entrar(page, hasTouch, { antes: (simulada, turma) => void comLote(simulada, turma) })
    const atividadeId = [...api.correcoes.keys()][0] ?? ''
    const segura = portao()
    api.trocar('correcao', async () => {
      await segura.aberta
      return erroDaApi(503, 'INDISPONIVEL_TENTE_DE_NOVO')
    })
    await irPara(page, `/professor/aprovar/${atividadeId}`)
    await expect(page.getByText('Carregando a correção…')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    segura.abrir()
    await expect(principal(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_TELA_MS })
    api.trocar('correcao', () => erroDaApi(404, 'NAO_ENCONTRADO'))
    await acionar(page.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(page.getByText('Esta correção não está disponível')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    // Nenhum texto diz "Seu time", e sem a turma da correção o caminho de volta é a lista de turmas.
    await expect(page.getByText(/Seu time/)).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Voltar para a turma' })).toHaveAttribute('href', '/professor/turmas')
    api.trocar('correcao')
    // Sai e volta: a tela de aprovar só desmonta quando a outra aparece, e é a volta que relê a correção.
    await irPara(page, '/professor/time/assistente')
    await expect(page.getByRole('heading', { level: 1, name: 'Assistente de ensino' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await irPara(page, `/professor/aprovar/${atividadeId}`)

    await expect(page.getByRole('heading', { level: 1, name: 'Revisar a correção' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(page).toHaveTitle('Revisar a correção · Turmma')
    await expect(principal(page)).toContainText(`Atividade de estequiometria · ${turmaNome}`)
    // A correção é saída de IA: a função assina, com o selo.
    await expect(page.getByText('Assistente · correção de objetiva')).toBeVisible()
    await expect(principal(page).locator('[data-selo-ia]')).toHaveCount(1)
    // Com a entrega lida, "Voltar para a turma" leva à turma da correção, e nenhum texto diz "Seu time".
    await expect(page.getByRole('link', { name: 'Voltar para a turma' })).toHaveAttribute('href', `/professor/turmas/${turmaId}`, { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByText(/Seu time/)).toHaveCount(0)
    const faixa = page.getByRole('group', { name: 'Números da correção' })
    await expect(faixa).toContainText('Corrigidas')
    await expect(faixa).toContainText('28')
    await expect(faixa).toContainText('Na turma hoje: 30')
    await expect(faixa).toContainText('Destaques abertos')
    await expect(faixa).toContainText('0 de 2')
    await expect(faixa).toContainText('Acerto médio')
    await expect(faixa).toContainText('1,3 de 2 questões')
    await expect(page.locator('[data-situacao-do-lote="pendente"] [data-aprovacao="pendente"]')).toHaveText('Esperando você')

    // As três abas, no endereço: trocar de aba troca o último passo do histórico (`replace`), e a barra presa fica nas três.
    const abas = page.getByRole('tablist', { name: 'Seções da correção' })
    const barra = page.getByRole('group', { name: 'Aprovação do lote' })
    await expect(abas.getByRole('tab')).toHaveText(['Destaques', 'Outras', 'Resumo'])
    await expect(abas.getByRole('tab', { name: 'Destaques' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('region', { name: 'Abra estes 2 antes de aprovar' })).toBeVisible()
    await expect(barra).toBeVisible()
    await expect(principal(page)).not.toContainText(VOCABULARIO_PROIBIDO)
    const passos = await page.evaluate(() => window.history.length)

    await acionar(abas.getByRole('tab', { name: 'Outras' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/aprovar/${atividadeId}\\?aba=outras$`))
    await expect(page.getByRole('region', { name: 'As outras 2 correções' })).toContainText('Caio Sintético')
    await expect(page.getByRole('region', { name: 'As outras 2 correções' })).toContainText('Dora Sintética')
    await expect(barra).toBeVisible()
    await expect(principal(page)).not.toContainText(VOCABULARIO_PROIBIDO)

    await acionar(abas.getByRole('tab', { name: 'Resumo' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/aprovar/${atividadeId}\\?aba=resumo$`))
    await expect(page.getByRole('region', { name: 'Distribuição dos acertos' })).toContainText('2 acertos')
    await expect(page.getByRole('region', { name: 'Acerto por habilidade' })).toContainText('QUI.EM.05')
    await expect(page.getByRole('region', { name: 'Acerto por habilidade' })).toContainText('15 de 28')
    await expect(page.getByRole('region', { name: 'Por questão' })).toContainText('a: 8 · b: 2 · c: 15 · d: 2')
    await expect(page.getByRole('region', { name: 'Por questão' })).toContainText('pode ter o gabarito errado')
    await expect(barra).toBeVisible()
    // A 360 px a barra presa fica acima da barra de baixo, na aba mais comprida e no fim da rolagem.
    if (hasTouch) {
      for (const rolar of [false, true]) {
        if (rolar) await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        const presa = await barra.boundingBox()
        const debaixo = await secoes(page).boundingBox()
        expect(presa, 'a barra presa sem caixa').not.toBeNull()
        expect(debaixo, 'a barra de baixo sem caixa').not.toBeNull()
        expect((presa?.y ?? 0) + (presa?.height ?? 0), `a barra presa acima da barra de baixo (rolou: ${String(rolar)})`).toBeLessThanOrEqual((debaixo?.y ?? 0) + 1)
        expect(presa?.y ?? -1, 'a barra presa à vista').toBeGreaterThanOrEqual(0)
      }
    }
    // D46: é diagnóstico, não nota. A tela inteira fala em acertos e habilidades.
    await expect(principal(page)).not.toContainText(VOCABULARIO_PROIBIDO)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    expect(await page.evaluate(() => window.history.length)).toBe(passos)

    // O que não é aba cai em Destaques, sem erro.
    await irPara(page, `/professor/aprovar/${atividadeId}?aba=todas`)
    await expect(abas.getByRole('tab', { name: 'Destaques' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('region', { name: 'Abra estes 2 antes de aprovar' })).toBeVisible()
    expect(await violacoesGraves(page)).toEqual([])

    // Recarregar com o endereço de um destaque ainda fechado não abre o painel nem registra abertura: abrir é o clique.
    await irPara(page, `/professor/aprovar/${atividadeId}?ver=${ALUNOS_DO_LOTE[0]?.alunoId ?? ''}`)
    await recarregar(page)
    await expect(page.locator('[data-destaque="fechado"]')).toHaveCount(2, { timeout: PRAZO_DA_TELA_MS })
    await expect(painelDoDestaque(page)).toHaveCount(0)
    expect(api.pedidosEm(/abrir$/)).toHaveLength(0)

    // A segunda professora, na mesma aba, não encontra o lote da primeira: a API responde como a correção que não existe, e nada
    // do que a primeira leu (nome de aluno, título) fica na tela nem no cache de consultas.
    const segunda = await criarProfessoraNaEscola(professora)
    const dela = await criarAlocacaoDoProfessor(segunda.escolaId, segunda.usuarioId, ['Biologia'])
    await confirmarVinculosNoBanco(segunda.escolaId, dela.vinculoIds)
    await abrirNavegacao(page, hasTouch)
    await acionar(lateral(page).getByRole('button', { name: 'Sair' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    api.correcoes.delete(atividadeId)
    api.entregas = []
    await entrarPorEmail(page, segunda, hasTouch)
    await esperarNovaConversa(page, segunda.nome)
    await irPara(page, `/professor/aprovar/${atividadeId}`)
    await expect(page.getByText('Esta correção não está disponível')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    const cache = semAcessosDaConta(await cacheDeConsultas(page))
    const corpo = page.locator('body')
    for (const aluno of ALUNOS_DO_LOTE) {
      await expect(corpo).not.toContainText(aluno.nome)
      expect(cache).not.toContain(aluno.nome)
      expect(cache).not.toContain(aluno.alunoId)
    }
    await expect(corpo).not.toContainText(professora.nome)
    expect(cache).not.toContain('Atividade de estequiometria')
  })

  test('o botão de aprovar fica desligado até o último destaque ser aberto, com o contador dizendo por quê; abrir fica registrado; a confirmação diz o que acontece; e a tela mostra a validação registrada', async ({ page, hasTouch }) => {
    test.slow()
    const rastros: string[] = []
    page.on('console', (mensagem) => rastros.push(mensagem.text()))
    const { api, turmaNome } = await entrar(page, hasTouch, { antes: (simulada, turma) => void comLote(simulada, turma) })
    const atividadeId = [...api.correcoes.keys()][0] ?? ''
    const entregaId = api.correcoes.get(atividadeId)?.entrega.id ?? ''
    const [anaDoLote, brunoDoLote] = ALUNOS_DO_LOTE
    await irPara(page, `/professor/aprovar/${atividadeId}`)

    const destaques = page.getByRole('region', { name: 'Abra estes 2 antes de aprovar' })
    await expect(destaques.locator('[data-destaque="fechado"]')).toHaveCount(2, { timeout: PRAZO_DA_TELA_MS })
    // Cada destaque diz o motivo em texto, como fato do trabalho, e está fechado como pendente.
    const ana = destaques.getByRole('listitem').filter({ hasText: 'Ana Sintética' })
    await expect(ana).toContainText('Em branco')
    await expect(ana).toContainText('0 de 2 acertos · 2 em branco')
    await expect(ana).toContainText('Falta abrir')
    const bruno = destaques.getByRole('listitem').filter({ hasText: 'Bruno Sintético' })
    await expect(bruno).toContainText('Falta abrir')

    // O único `oficial` da tela, preso embaixo e desligado, com o contador ao lado dizendo por quê.
    const barra = page.getByRole('group', { name: 'Aprovação do lote' })
    expect(await barra.evaluate((elemento) => getComputedStyle(elemento).position)).toBe('sticky')
    const aprovar = barra.getByRole('button', { name: 'Aprovar 28 correções' })
    await expect(aprovar).toBeDisabled()
    const contador = barra.locator('[data-contador-dos-destaques]')
    await expect(contador).toHaveText('0 de 2 destaques abertos. Abra os 2 destaques que faltam para liberar a aprovação.')
    // O leitor de tela lê o porquê junto do botão desligado.
    await expect(aprovar).toHaveAccessibleDescription('0 de 2 destaques abertos. Abra os 2 destaques que faltam para liberar a aprovação.')
    expect(await principal(page).getByRole('button').evaluateAll((botoes) => botoes.filter((botao) => getComputedStyle(botao).backgroundColor === 'rgb(232, 115, 46)').length)).toBe(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Abrir: dois cliques seguidos mandam uma abertura só, e o painel ao lado mostra as respostas e o histórico do aluno.
    await ana.getByRole('button').evaluate((botao: HTMLButtonElement) => {
      botao.click()
      botao.click()
    })
    const painel = painelDoDestaque(page)
    await expect(painel.locator('[data-destaque-aberto]')).toContainText('Em branco', { timeout: PRAZO_DA_TELA_MS })
    await expect(painel.locator('[data-destaque-aberto]')).toContainText('Nenhuma questão foi respondida.')
    await expect(painel.locator('[data-destaque-aberto]')).toContainText('Atividade de balanceamento: 4 de 5 acertos')
    await expect(page).toHaveURL(new RegExp(`\\?ver=${anaDoLote?.alunoId ?? ''}$`))
    expect(api.pedidosEm(/abrir$/).map(({ caminho, corpo }) => ({ caminho, corpo }))).toEqual([{ caminho: `/v1/atividades-aplicadas/${atividadeId}/correcao/destaques/${anaDoLote?.alunoId ?? ''}/abrir`, corpo: {} }])
    // No computador o painel é uma coluna de 480 px colada à direita; no celular, uma folha de baixo que não passa de 88% da altura.
    const janela = page.viewportSize()
    const caixa = await painel.boundingBox()
    if (janela === null || caixa === null) throw new Error('faltou a medida do painel')
    if (hasTouch) {
      expect(caixa.width).toBeCloseTo(janela.width, 0)
      expect(caixa.y + caixa.height).toBeCloseTo(janela.height, 0)
      expect(caixa.y).toBeGreaterThan(0)
      expect(caixa.height).toBeLessThanOrEqual(janela.height * 0.88 + 1)
    } else {
      expect(caixa.width).toBeCloseTo(480, 0)
      expect(caixa.x + caixa.width).toBeCloseTo(janela.width, 0)
      expect(caixa.height).toBeCloseTo(janela.height, 0)
    }
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await fecharOPainel(page, hasTouch)
    await expect(page).not.toHaveURL(/ver=/)
    await expect(ana).toContainText(/Aberto · \d{2}\/\d{2}, \d{2}h\d{2}/, { timeout: PRAZO_DA_TELA_MS })
    await expect(contador).toHaveText('1 de 2 destaques abertos. Abra o destaque que falta para liberar a aprovação.')
    await expect(aprovar).toBeDisabled()

    const doBruno = await abrirODestaque(page, bruno, hasTouch)
    await expect(doBruno).toContainText('Os acertos ficaram bem acima ou bem abaixo dos que ele teve nas correções aprovadas desta disciplina.')
    // Abaixo de 768 px a tabela vira lista, com o mesmo nome.
    await expect(doBruno.getByRole(hasTouch ? 'list' : 'table', { name: `Respostas de ${brunoDoLote?.nome ?? ''}` })).toBeVisible()
    await fecharOPainel(page, hasTouch)
    await expect(contador).toHaveText('2 de 2 destaques abertos. Tudo aberto: a aprovação está liberada.', { timeout: PRAZO_DA_TELA_MS })
    await expect(aprovar).toBeEnabled()
    expect(await aprovar.evaluate((botao) => getComputedStyle(botao).backgroundColor)).toBe('rgb(51, 51, 51)')

    // Recarregar mantém a aba e os destaques já abertos, e o endereço do painel de um destaque aberto o traz de volta.
    await irPara(page, `/professor/aprovar/${atividadeId}?aba=resumo&ver=${anaDoLote?.alunoId ?? ''}`)
    await recarregar(page)
    await expect(painelDoDestaque(page).locator('[data-destaque-aberto]')).toContainText('Em branco', { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('tab', { name: 'Resumo' })).toHaveAttribute('aria-selected', 'true')
    await fecharOPainel(page, hasTouch)
    await expect(page).toHaveURL(new RegExp(`\\?aba=resumo$`))
    await expect(page.getByRole('region', { name: 'Distribuição dos acertos' })).toBeVisible()
    await expect(contador).toHaveText('2 de 2 destaques abertos. Tudo aberto: a aprovação está liberada.')
    await expect(aprovar).toBeEnabled()

    // A confirmação diz a atividade, a turma, quantas correções, e que o diagnóstico chega aos alunos.
    await acionar(aprovar, hasTouch)
    const dialogo = page.getByRole('alertdialog', { name: 'Aprovar 28 correções' })
    await expect(dialogo).toContainText('Atividade de estequiometria')
    await expect(dialogo).toContainText(turmaNome)
    await expect(dialogo).toContainText('28 alunos responderam · 30 na turma hoje')
    await expect(dialogo).toContainText('O diagnóstico por habilidade chega aos alunos da turma.')
    await expect(dialogo).not.toContainText(VOCABULARIO_PROIBIDO)
    expect(api.pedidosEm(/aprovar-lote$/)).toHaveLength(0)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Dois cliques em confirmar: uma aprovação só, de corpo vazio (a tela não manda o que mostrou).
    const segura = portao()
    api.trocar('aprovarLote', async (pedido) => {
      await segura.aberta
      return api.responder('aprovarLote', pedido)
    })
    await dialogo.getByRole('button', { name: 'Aprovar 28 correções' }).evaluate((botao: HTMLButtonElement) => {
      botao.click()
      botao.click()
    })
    await expect(dialogo.getByRole('button', { name: 'Aprovando…' })).toBeDisabled()
    segura.abrir()
    await expect(dialogo).toBeHidden({ timeout: PRAZO_DA_TELA_MS })
    expect(api.pedidosEm(/aprovar-lote$/).map(({ caminho, corpo }) => ({ caminho, corpo }))).toEqual([{ caminho: `/v1/entregas/${entregaId}/aprovar-lote`, corpo: {} }])

    // Depois: a validação registrada, com quem e quando; a barra de decisão sai; o foco fica na situação.
    const situacao = page.locator('[data-situacao-do-lote="aprovada"]')
    await expect(situacao.locator('[data-aprovacao="aprovada"]')).toContainText(new RegExp(`^Validação registrada por ${QUEM_DECIDE.nome} · \\d{2}/\\d{2}, \\d{2}h\\d{2}$`), { timeout: PRAZO_DA_TELA_MS })
    await expect(situacao).toBeFocused()
    await expect(barra).toHaveCount(0)
    await expect(principal(page)).not.toContainText(VOCABULARIO_PROIBIDO)
    expect(await violacoesGraves(page)).toEqual([])
    semNomeDeAluno(rastros)
  })

  test('rejeitar a correção exige justificativa; e a aprovação recusada porque o lote mudou vira aviso calmo, com a tela relida', async ({ page, hasTouch }) => {
    test.slow()
    const { api, professora } = await entrar(page, hasTouch, { antes: (simulada, turma) => void comLote(simulada, turma) })
    const atividadeId = [...api.correcoes.keys()][0] ?? ''
    const lote = api.correcoes.get(atividadeId)
    if (lote === undefined) throw new Error('faltou o lote')
    // Todos os destaques já abertos: a aprovação está liberada.
    api.correcoes.set(atividadeId, { ...lote, destaques: lote.destaques.map((destaque) => ({ ...destaque, abertoEm: '2026-10-05T14:10:00.000Z' })), destaquesAbertos: 2, podeAprovar: true })
    await irPara(page, `/professor/aprovar/${atividadeId}`)
    const barra = page.getByRole('group', { name: 'Aprovação do lote' })
    const aprovar = barra.getByRole('button', { name: 'Aprovar 28 correções' })
    await expect(aprovar).toBeEnabled({ timeout: PRAZO_DA_TELA_MS })

    // O lote mudou desde a leitura: a API recusa com conflito, e a tela relê e pede para conferir de novo, sem erro cru.
    api.trocar('aprovarLote', () => erroDaApi(409, 'CONFLITO'))
    await acionar(aprovar, hasTouch)
    await acionar(page.getByRole('alertdialog').getByRole('button', { name: 'Aprovar 28 correções' }), hasTouch)
    await expect(page.getByRole('alertdialog')).toBeHidden({ timeout: PRAZO_DA_TELA_MS })
    await expect(principal(page).getByRole('status').filter({ hasText: 'A correção mudou desde que você abriu esta tela, e nada foi aprovado.' })).toBeVisible()
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    await expect(principal(page)).not.toContainText('CONFLITO')
    // O lote continua pendente e liberado: o foco volta ao botão que abriu o diálogo, e não se perde no `body`.
    await expect(page.locator('[data-situacao-do-lote="pendente"]')).toBeVisible()
    await expect(aprovar).toBeFocused()
    api.trocar('aprovarLote')

    // A sessão vence com a confirmação aberta: a decisão não sai sozinha quando a pessoa volta a entrar. A API de aprovar
    // responde 401 e a renovação também (a sessão foi encerrada); depois do login, a rota volta a aceitar, e se a tela repetisse
    // a decisão por conta própria ela passaria agora.
    await acionar(aprovar, hasTouch)
    const confirmacao = page.getByRole('alertdialog', { name: 'Aprovar 28 correções' })
    await expect(confirmacao).toBeVisible()
    const antesDaSessao = api.pedidosEm(/aprovar-lote$/).length
    api.trocar('aprovarLote', () => erroDaApi(401, 'NAO_AUTENTICADO'))
    await encerrarSessoesDoUsuario(professora.usuarioId)
    await acionar(confirmacao.getByRole('button', { name: 'Aprovar 28 correções' }), hasTouch)
    const login = page.getByRole('dialog', { name: 'Sua sessão expirou' })
    await expect(login).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    api.trocar('aprovarLote')
    await login.getByLabel('E-mail').fill(professora.email)
    await login.getByLabel('Senha').fill(professora.senha)
    await acionar(login.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await expect(login).toBeHidden({ timeout: PRAZO_DA_ENTRADA_MS })
    // Só a tentativa que falhou saiu, nada foi aprovado, e o lote continua esperando a professora.
    await expect(page.locator('[data-situacao-do-lote="pendente"]')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    expect(api.pedidosEm(/aprovar-lote$/)).toHaveLength(antesDaSessao + 1)
    expect(api.correcoes.get(atividadeId)?.entrega.estado).toBe('pendente')
    if (await confirmacao.isVisible()) await acionar(confirmacao.getByRole('button', { name: 'Cancelar' }), hasTouch)
    await expect(confirmacao).toBeHidden()

    // Rejeitar é `perigo`, e pede a justificativa antes de mandar.
    await acionar(barra.getByRole('button', { name: 'Rejeitar a correção' }), hasTouch)
    const dialogo = page.getByRole('alertdialog', { name: 'Rejeitar a correção' })
    await expect(dialogo).toContainText('Nenhum aluno recebe o diagnóstico desta correção.')
    await acionar(dialogo.getByRole('button', { name: 'Rejeitar a correção' }), hasTouch)
    await expect(dialogo.getByText('Escreva pelo menos 8 caracteres.')).toBeVisible()
    expect(api.pedidosEm(/decidir$/)).toHaveLength(0)
    await dialogo.getByLabel(/Por que você está rejeitando\?/).fill('O gabarito da questão 2 está errado.')
    await acionar(dialogo.getByRole('button', { name: 'Rejeitar a correção' }), hasTouch)
    await expect(dialogo).toBeHidden({ timeout: PRAZO_DA_TELA_MS })
    expect(api.pedidosEm(/decidir$/).map((pedido) => pedido.corpo)).toEqual([{ decisao: 'rejeitar', justificativa: 'O gabarito da questão 2 está errado.' }])
    const situacao = page.locator('[data-situacao-do-lote="rejeitada"]')
    await expect(situacao.locator('[data-aprovacao="rejeitada"]')).toContainText(`${QUEM_DECIDE.nome} rejeitou`, { timeout: PRAZO_DA_TELA_MS })
    await expect(situacao.locator('[data-aprovacao="rejeitada"]')).toContainText('Motivo: O gabarito da questão 2 está errado.')
    await expect(barra).toHaveCount(0)
    await expect(page.getByText(/Seu time/)).toHaveCount(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Sem a leitura das entregas, a decisão só é afirmada com quem decidiu: a tela diz onde ver, pelo sino, sem "Seu time".
    api.entregas = []
    await recarregar(page)
    await expect(principal(page)).toContainText('Esta correção foi rejeitada. Quem rejeitou e por quê está em “O que o Assistente fez”, pelo sino.', { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByText(/Seu time/)).toHaveCount(0)
    const decidida = api.correcoes.get(atividadeId)
    if (decidida === undefined) throw new Error('faltou o lote')
    api.correcoes.set(atividadeId, { ...decidida, entrega: { ...decidida.entrega, estado: 'aprovada' } })
    await recarregar(page)
    await expect(principal(page)).toContainText('Esta correção já foi decidida. A decisão está em “O que o Assistente fez”, pelo sino.', { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByText(/Seu time/)).toHaveCount(0)
  })
})
