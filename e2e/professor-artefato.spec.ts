import { randomUUID } from 'node:crypto'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { atividadeSintetica, apiError, gate, QUEM_DECIDE, resumoDoArtefato, TITULO_DO_MATERIAL, versaoAdaptada } from './support/assistente.ts'
import { entrarPelaApi, entrarPorEmail, SIGN_IN_TIMEOUT_MS, secoes } from './support/casca.ts'
import { queryCache, semAcessosDaConta } from './support/query-cache.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { activate, entrar, irPara, SCREEN_TIMEOUT_MS, recarregar, selosDeIA } from './support/professor/scenario.ts'
import { criarArtefatoDoVinculo, entrarEmCriados } from './support/professor/criados.ts'
import { confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarEquipeComSenha, encerrarSessoesDoUsuario } from './support/seed.ts'
import { horizontalOverflow, seriousViolations } from './support/checks.ts'
import { loadUnthrottled, expect, test } from './support/profiles.ts'

/**
 * O artefato (A2, pacote W). Separado de `professor-assistente.spec.ts` pela 2.5.
 */

test.describe('o artefato', () => {
  test('os quatro estados; a atividade com gabarito, explicação e a página de cada questão; renomear; exportar em PDF; pedir versão adaptada; e a versão com quem aprovou', async ({ page, hasTouch }) => {
    // Entrada, troca de tela e recarga com a CPU ×4 e a rede lenta do perfil: o teste percorre vários estados da mesma tela.
    test.slow()
    const { api, turmaId, turmaNome, disciplinaId } = await entrar(page, hasTouch)
    const origem = atividadeSintetica(turmaId, disciplinaId)
    const pendente = versaoAdaptada(origem)
    const aprovada = versaoAdaptada(origem, 'aprovada')
    const rejeitada = versaoAdaptada(origem, 'rejeitada')
    const comVersoes = { ...origem, versoesAdaptadas: [resumoDoArtefato(pendente.artefato), resumoDoArtefato(aprovada.artefato), resumoDoArtefato(rejeitada.artefato)] }
    api.artefatos = [comVersoes, pendente.artefato, aprovada.artefato, rejeitada.artefato]
    api.entregas = [pendente.entrega, aprovada.entrega, rejeitada.entrega]

    // Carregando, erro e o que não existe (ou é de outra turma), que respondem igual.
    const segura = gate()
    api.trocar('artefato', async () => {
      await segura.aberta
      return apiError(503, 'INDISPONIVEL_TENTE_DE_NOVO')
    })
    await irPara(page, `/professor/artefatos/${origem.id}`)
    await expect(page.getByText('Carregando o artefato…')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    segura.abrir()
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: SCREEN_TIMEOUT_MS })
    api.trocar('artefato', () => apiError(404, 'NAO_ENCONTRADO'))
    await activate(page.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(page.getByText('Este artefato não está disponível')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    api.trocar('artefato')
    await irPara(page, '/professor/criados')
    await activate(page.locator('[data-artefato]').filter({ hasText: 'Atividade objetiva' }), hasTouch)

    // Com dado: o nome da coisa, a assinatura da IA, as questões com gabarito em texto, a explicação e a página.
    await expect(page.getByRole('heading', { level: 1, name: origem.titulo })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page).toHaveTitle(`${origem.titulo} · Turmma`)
    await expect(page.getByRole('link', { name: 'Voltar para Criados' })).toHaveAttribute('href', '/professor/criados')
    await expect(page.getByRole('tab')).toHaveText(['Conteúdo', 'Versões adaptadas', 'Na turma'])
    await expect(page.getByRole('main')).toContainText(`Atividade objetiva · ${turmaNome} · Química`)
    await expect(page.getByText('Assistente · conversa e ferramentas')).toBeVisible()
    await expect(selosDeIA(page.getByRole('main'))).toHaveCount(1)
    await expect(page.getByText('Qual a massa de CO₂ formada na queima completa de 24 g de carbono?')).toBeVisible()
    await expect(page.locator('[data-folha]').getByText('Gabarito', { exact: true })).toHaveCount(2)
    await expect(page.getByText('24 g de carbono são 2 mol, que formam 2 mol de CO₂, ou 88 g.')).toBeVisible()
    await expect(page.getByRole('button', { name: `Fonte: ${TITULO_DO_MATERIAL}, p. 142` })).toBeVisible()
    await expect(page.getByText(`Página 142 · ${TITULO_DO_MATERIAL}`)).toBeVisible()
    // Aplicar à turma (fase 3): um botão só, na aba "Na turma"; o fluxo dele está em `professor-aplicacao.spec.ts`.
    await expect(page.getByRole('button', { name: /Aplicar/ })).toHaveCount(0)
    await activate(page.getByRole('tab', { name: 'Na turma' }), hasTouch)
    await expect(page.getByRole('button', { name: /Aplicar/ })).toHaveCount(1, { timeout: SCREEN_TIMEOUT_MS })
    // As versões adaptadas, cada uma com a situação dela: a pendente espera, a aprovada diz quem e quando.
    const versoes = page.getByRole('region', { name: 'Versões adaptadas' })
    const abrirAsVersoes = () => activate(page.getByRole('tab', { name: 'Versões adaptadas' }), hasTouch)
    await abrirAsVersoes()
    await expect(versoes.locator('[data-aprovacao="pendente"]')).toHaveText('Esperando você')
    await expect(versoes.locator('[data-aprovacao="aprovada"]')).toContainText(`Aprovada por ${QUEM_DECIDE.nome} · 05/10`)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    // Renomear manda só o título, e o foco volta ao botão que abriu o campo.
    await activate(page.getByRole('tab', { name: 'Conteúdo' }), hasTouch)
    await activate(page.getByRole('button', { name: 'Renomear' }), hasTouch)
    await page.getByLabel('Novo título').fill('Lista 3: estequiometria')
    await activate(page.getByRole('button', { name: 'Salvar o título' }), hasTouch)
    await expect(page.getByRole('heading', { level: 1, name: 'Lista 3: estequiometria' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('button', { name: 'Renomear' })).toBeFocused()
    expect(api.pedidosEm(/artefatos\/[^/]+$/).map(({ metodo, corpo }) => ({ metodo, corpo }))).toEqual([{ metodo: 'PATCH', corpo: { titulo: 'Lista 3: estequiometria' } }])

    // Exportar em PDF entrega o arquivo que a API mandou.
    const baixado = page.waitForEvent('download')
    await activate(page.getByRole('button', { name: 'Exportar em PDF' }), hasTouch)
    expect((await baixado).suggestedFilename()).toBe('atividade-sintetica.pdf')

    // A versão que ainda espera a decisão só sai em PDF como rascunho, e a tela diz isso antes do clique.
    await abrirAsVersoes()
    await activate(versoes.getByRole('link').nth(0), hasTouch)
    await expect(page.locator('[data-aprovacao="pendente"]')).toHaveText('Esperando você', { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('button', { name: 'Exportar rascunho em PDF' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Exportar em PDF', exact: true })).toHaveCount(0)
    await expect(page.getByRole('main')).toContainText('o PDF sai marcado como rascunho em todas as páginas')
    // A pendente leva a decidir pelo sino, na tela do Assistente, e nenhum texto diz "Seu time".
    await expect(page.getByRole('link', { name: 'Ver e decidir' })).toHaveAttribute('href', '/professor/time/assistente')
    await expect(page.getByText(/Seu time/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Renomear' })).toBeVisible()
    await activate(page.getByRole('link', { name: 'Abrir a atividade de origem' }), hasTouch)
    // A origem foi lida no começo do caso e continua em cache, então abre com o botão na tela: o foco só volta ao "Renomear" quando o renomear fecha, nunca ao montar.
    await expect(page.getByRole('button', { name: 'Pedir versão adaptada' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('button', { name: 'Renomear' })).not.toBeFocused()

    // A rejeitada não sai em PDF, e a tela diz por quê; decidida, também não muda de nome.
    await abrirAsVersoes()
    await activate(versoes.getByRole('link').nth(2), hasTouch)
    await expect(page.locator('[data-aprovacao="rejeitada"]')).toContainText(`${QUEM_DECIDE.nome} rejeitou`, { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('button', { name: /Exportar/ })).toHaveCount(0)
    await expect(page.getByText(/Seu time/)).toHaveCount(0)
    await expect(page.locator('[data-sem-pdf]')).toHaveText('Esta versão foi rejeitada e não pode ser exportada: ela não vai aos alunos. Peça outra versão adaptada a partir da atividade de origem.')
    await expect(page.getByRole('button', { name: 'Renomear' })).toHaveCount(0)
    // O cabeçalho da rejeitada é o mais alto (a situação, o motivo, o texto sem PDF): mesmo assim a página não rola, rola a mesa.
    await paginaNaoRola(page)
    expect(await seriousViolations(page)).toEqual([])
    await activate(page.getByRole('link', { name: 'Abrir a atividade de origem' }), hasTouch)

    // A versão adaptada aprovada: a adaptação pelo tipo, a aprovação com quem e quando, e o PDF limpo.
    await abrirAsVersoes()
    await activate(versoes.getByRole('link').nth(1), hasTouch)
    await expect(page.getByRole('heading', { level: 1, name: aprovada.artefato.titulo })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByText('Fonte ampliada + Tempo adicional (50% a mais)')).toBeVisible()
    await expect(page.getByText('Assistente · adaptação')).toBeVisible()
    await expect(page.locator('[data-aprovacao="aprovada"]')).toContainText(`Aprovada por ${QUEM_DECIDE.nome}`)
    await expect(page.getByRole('button', { name: 'Exportar em PDF', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Renomear' })).toHaveCount(0)
    // Versão adaptada não se adapta de novo.
    await expect(page.getByRole('button', { name: 'Pedir versão adaptada' })).toHaveCount(0)
    await paginaNaoRola(page)
    expect(await seriousViolations(page)).toEqual([])
    // Sem a leitura das entregas da turma, a decisão só é afirmada com quem decidiu: a tela diz onde ver, pelo sino.
    api.entregas = []
    // A aba está no endereço: recarregar a mantém (a recarga é a deste caso, que já a faz, e custa o que o prazo dele comporta).
    await activate(page.getByRole('tab', { name: 'Na turma' }), hasTouch)
    await expect(page).toHaveURL(/\?aba=turma$/)
    await recarregar(page)
    await expect(page.getByRole('tab', { name: 'Na turma', selected: true })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByText('A decisão desta versão está em “O que o Assistente fez”, pelo sino.')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByText(/Seu time/)).toHaveCount(0)

    // "Pedir versão adaptada", na atividade, abre a Adaptação já com ela escolhida.
    await activate(page.getByRole('link', { name: 'Abrir a atividade de origem' }), hasTouch)
    await activate(page.getByRole('button', { name: 'Pedir versão adaptada' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/ferramentas/adaptacao\\?origem=${origem.id}$`))
    await expect(page.locator('[data-motor="formulario"]').getByLabel('Atividade de origem')).toHaveValue(origem.id, { timeout: SCREEN_TIMEOUT_MS })
  })

  test('a folha e a página: a folha de 760 px sobre a mesa no computador e sem mesa a 360 px; cada questão diz a página de onde saiu; "Gabarito" liga e desliga; nada rola de lado', async ({ page, hasTouch }) => {
    const id = randomUUID()
    await entrarEmCriados(page, {
      endereco: `/professor/artefatos/${id}`,
      antes: ({ api, turmaId, disciplinaId }) => void (api.artefatos = [atividadeSintetica(turmaId, disciplinaId, { id })]),
    })
    const folha = page.locator('[data-folha]')
    const mesa = page.locator('[data-mesa]')
    await expect(folha).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    // Cada questão mostra a página de origem (D6): a miniatura diz a página e o material.
    await expect(folha.getByText(`Página 142 · ${TITULO_DO_MATERIAL}`)).toBeVisible()
    await expect(folha.getByText(`Página 145 · ${TITULO_DO_MATERIAL}`)).toBeVisible()
    await expect(folha.getByRole('button', { name: `Fonte: ${TITULO_DO_MATERIAL}, p. 142` })).toBeVisible()

    const largura = page.viewportSize()?.width ?? 0
    const caixaDaFolha = await folha.boundingBox()
    const pintura = await page.evaluate(() => {
      // A cor do token `mesa` no tema de agora: um elemento de prova pinta com ela, e o navegador diz o rgb.
      const sonda = document.createElement('div')
      sonda.style.backgroundColor = 'var(--color-mesa)'
      document.body.append(sonda)
      const doToken = getComputedStyle(sonda).backgroundColor
      sonda.remove()
      return {
        doToken,
        mesa: getComputedStyle(document.querySelector('[data-mesa]') as Element).backgroundColor,
        folha: getComputedStyle(document.querySelector('[data-folha]') as Element).backgroundColor,
        borda: getComputedStyle(document.querySelector('[data-folha]') as Element).borderTopWidth,
      }
    })
    if (largura >= 768) {
      // No computador: a folha é a coluna de 760 px, centrada, e a mesa tem outra cor que a dela.
      expect(caixaDaFolha?.width ?? 0).toBeLessThanOrEqual(760.5)
      expect(caixaDaFolha?.width ?? 0).toBeGreaterThan(600)
      expect(pintura.mesa).toBe(pintura.doToken)
      expect(pintura.mesa).not.toBe(pintura.folha)
      expect(pintura.borda).toBe('2px')
    } else {
      // A 360 px a folha é a própria coluna: sem mesa pintada, sem borda, e dentro da janela.
      expect(pintura.mesa).toBe('rgba(0, 0, 0, 0)')
      expect(pintura.borda).toBe('0px')
      expect((caixaDaFolha?.x ?? -1) + (caixaDaFolha?.width ?? 0)).toBeLessThanOrEqual(largura)
    }
    await expect(mesa).toHaveCount(1)
    expect(await horizontalOverflow(page)).toBe(0)
    if (largura >= 768) {
      // A página não rola, rola a mesa (RF22, `mockup.md` 10.2): o painel da aba é quem tem mais do que mostra, e o cabeçalho e as abas ficam parados.
      await paginaNaoRola(page)
      const painel = page.getByRole('tabpanel')
      expect(await painel.evaluate((elemento) => elemento.scrollHeight - elemento.clientHeight), 'o painel da aba rola por dentro').toBeGreaterThan(0)
      const abas = page.getByRole('tab', { name: 'Conteúdo' })
      const antes = await abas.boundingBox()
      expect(antes, 'as abas têm caixa antes de a mesa rolar').not.toBeNull()
      await painel.evaluate((elemento) => elemento.scrollTo(0, elemento.scrollHeight))
      expect((await abas.boundingBox())?.y, 'as abas não saem do lugar com a mesa rolando').toBe(antes?.y)
      await painel.evaluate((elemento) => elemento.scrollTo(0, 0))
      // O formulário de renomear aparece acima das abas depois de a tela montar: o topo do painel é medido de novo (`useTopoDoPainel`).
      await activate(page.getByRole('button', { name: 'Renomear' }), hasTouch)
      await expect(page.getByLabel('Novo título')).toBeVisible()
      await paginaNaoRola(page)
      await activate(page.getByRole('button', { name: 'Cancelar' }), hasTouch)
    }

    // O gabarito é um modo de ver: ligado de início, e desligado tira a marca da certa e a explicação, e deixa a página.
    const interruptor = page.getByRole('switch', { name: 'Gabarito' })
    await expect(interruptor).toHaveAttribute('aria-checked', 'true')
    await expect(folha.getByText('Gabarito', { exact: true })).toHaveCount(2)
    await activate(interruptor, hasTouch)
    await expect(interruptor).toHaveAttribute('aria-checked', 'false')
    await expect(folha.getByText('Gabarito', { exact: true })).toHaveCount(0)
    await expect(folha.getByText('24 g de carbono são 2 mol, que formam 2 mol de CO₂, ou 88 g.')).toHaveCount(0)
    await expect(folha.getByText(`Página 142 · ${TITULO_DO_MATERIAL}`)).toBeVisible()
    await activate(interruptor, hasTouch)
    await expect(folha.getByText('Gabarito', { exact: true })).toHaveCount(2)

    // A 360 px o último controle da página termina acima da barra de baixo da casca, também no fim da rolagem.
    if (hasTouch) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const ultimo = await page.getByRole('main').locator('a, button').last().boundingBox()
      const debaixo = await secoes(page).boundingBox()
      expect(ultimo, 'o último controle sem caixa').not.toBeNull()
      expect(debaixo, 'a barra de baixo sem caixa').not.toBeNull()
      expect((ultimo?.y ?? 0) + (ultimo?.height ?? 0), 'o último controle acima da barra de baixo').toBeLessThanOrEqual((debaixo?.y ?? 0) + 1)
    }
    expect(await seriousViolations(page)).toEqual([])
  })

  test('recomeço: o endereço com a aba abre nela, e trocar de aba não empilha histórico', async ({ page, hasTouch }) => {
    const id = randomUUID()
    await entrarEmCriados(page, {
      endereco: `/professor/artefatos/${id}?aba=versoes`,
      antes: ({ api, turmaId, disciplinaId }) => {
        const origem = atividadeSintetica(turmaId, disciplinaId, { id })
        const pendente = versaoAdaptada(origem)
        api.artefatos = [{ ...origem, versoesAdaptadas: [resumoDoArtefato(pendente.artefato)] }, pendente.artefato]
        api.entregas = [pendente.entrega]
      },
    })
    await expect(page.getByRole('tab', { name: 'Versões adaptadas', selected: true })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('region', { name: 'Versões adaptadas' })).toBeVisible()

    const passos = await page.evaluate(() => window.history.length)
    await activate(page.getByRole('tab', { name: 'Na turma' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/artefatos/${id}\\?aba=turma$`))
    expect(await page.evaluate(() => window.history.length)).toBe(passos)
  })

  test('recomeço: a sessão que vence no meio do renomear devolve o texto digitado, e o pedido que falhou não é repetido sozinho', async ({ page, hasTouch }) => {
    const id = randomUUID()
    const cena = await entrarEmCriados(page, {
      endereco: `/professor/artefatos/${id}`,
      antes: ({ api, turmaId, disciplinaId }) => void (api.artefatos = [atividadeSintetica(turmaId, disciplinaId, { id })]),
    })
    await expect(page.getByRole('button', { name: 'Renomear' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await activate(page.getByRole('button', { name: 'Renomear' }), hasTouch)
    await page.getByLabel('Novo título').fill('Lista 3 revisada')

    // A API recusa o pedido e a renovação também (a sessão foi encerrada): a tela pede a entrada por cima, e o campo fica como está.
    const antes = cena.api.pedidosEm(/artefatos\/[^/]+$/).filter(({ metodo }) => metodo === 'PATCH').length
    cena.api.trocar('renomear', () => apiError(401, 'NAO_AUTENTICADO'))
    await encerrarSessoesDoUsuario(cena.professora.usuarioId)
    await activate(page.getByRole('button', { name: 'Salvar o título' }), hasTouch)
    const login = page.getByRole('dialog', { name: 'Sua sessão expirou' })
    await expect(login).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    cena.api.trocar('renomear')
    await login.getByLabel('E-mail').fill(cena.professora.email)
    await login.getByLabel('Senha').fill(cena.professora.senha)
    await activate(login.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await expect(login).toBeHidden({ timeout: SIGN_IN_TIMEOUT_MS })

    // O texto digitado continua no campo, nada foi renomeado e o pedido que falhou não saiu de novo por conta própria.
    await expect(page.getByLabel('Novo título')).toHaveValue('Lista 3 revisada', { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('heading', { level: 1, name: 'Atividade de estequiometria' })).toBeVisible()
    expect(cena.api.pedidosEm(/artefatos\/[^/]+$/).filter(({ metodo }) => metodo === 'PATCH')).toHaveLength(antes + 1)
  })

  test('isolamento (regra 10): o documento de outra escola e o que não existe respondem com a mesma tela, e o de outra escola não aparece', async ({ page }) => {
    // A API de verdade, sem simulação: é o repositório que impede o vazamento, e uma API simulada não o provaria.
    const marca = randomUUID().slice(0, 8)
    const tituloDela = `Atividade da professora ${marca}`
    const tituloDeFora = `Atividade da escola vizinha ${marca}`
    const professora = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(professora.escolaId, alocacao.vinculoIds)
    const dela = await criarArtefatoDoVinculo(professora.escolaId, alocacao.vinculoIds[0] ?? '', professora.usuarioId, tituloDela)
    const vizinha = await criarEquipeComSenha()
    const alocacaoDaVizinha = await criarAlocacaoDoProfessor(vizinha.escolaId, vizinha.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(vizinha.escolaId, alocacaoDaVizinha.vinculoIds)
    const deFora = await criarArtefatoDoVinculo(vizinha.escolaId, alocacaoDaVizinha.vinculoIds[0] ?? '', vizinha.usuarioId, tituloDeFora)

    await entrarPelaApi(page, professora, `/professor/artefatos/${dela.artefatoId}`)
    await expect(page.getByRole('heading', { level: 1, name: tituloDela })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })

    await irPara(page, `/professor/artefatos/${deFora.artefatoId}`)
    await expect(page.getByText('Este artefato não está disponível')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(tituloDeFora)
    await expect(page.locator('body')).not.toContainText(tituloDela)
    await expect(page.getByRole('tab')).toHaveCount(0)
    const deOutraEscola = await page.getByRole('main').innerText()

    // O que não existe em lugar nenhum responde igual (regra 10, item 6): o texto da tela é o mesmo.
    await irPara(page, `/professor/artefatos/${randomUUID()}`)
    await expect(page.getByText('Este artefato não está disponível')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    expect(await page.getByRole('main').innerText()).toBe(deOutraEscola)
  })

  test('recomeço: a professora seguinte entra pela tela, na mesma aba e sem recarregar, e o documento da anterior no endereço não lhe aparece', async ({ page, hasTouch }) => {
    const titulo = `Atividade confidencial ${randomUUID().slice(0, 8)}`
    const primeira = await criarEquipeComSenha()
    const alocacao = await criarAlocacaoDoProfessor(primeira.escolaId, primeira.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(primeira.escolaId, alocacao.vinculoIds)
    const documento = await criarArtefatoDoVinculo(primeira.escolaId, alocacao.vinculoIds[0] ?? '', primeira.usuarioId, titulo)
    const segunda = await criarEquipeComSenha()
    const alocacaoDaSegunda = await criarAlocacaoDoProfessor(segunda.escolaId, segunda.usuarioId, ['Química'])
    await confirmarVinculosNoBanco(segunda.escolaId, alocacaoDaSegunda.vinculoIds)
    // A primeira carga não afirma nada sobre o tempo de baixar (`loadUnthrottled`); o que vem depois, sim.
    await loadUnthrottled(page, async () => {
      await entrarPelaApi(page, primeira, `/professor/artefatos/${documento.artefatoId}`)
      await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    })

    if (hasTouch) await page.getByRole('button', { name: 'Sair' }).tap()
    else await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    // Pela tela, sem recarregar: a recarga apagaria o cache, e o cache é o que este caso quer ver esvaziado.
    await entrarPorEmail(page, segunda, hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await irPara(page, `/professor/artefatos/${documento.artefatoId}`)
    await expect(page.getByText('Este artefato não está disponível')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(titulo)
    expect(semAcessosDaConta(await queryCache(page))).not.toContain(titulo)
  })
})
