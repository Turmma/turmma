import type { Locator, Page } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { atividadeSintetica, erroDaApi, mensagemDela, portao, propostaDeAtividade, respostaComPagina, TITULO_DO_MATERIAL } from './__fixtures__/assistente.ts'
import { PRAZO_DA_ENTRADA_MS } from './__fixtures__/casca.ts'
import { caixa } from './__fixtures__/fluxo-do-professor.ts'
import { acionar, entrar, irPara, PRAZO_DA_TELA_MS, recarregar, selosDeIA, UUID } from './__fixtures__/professor/cena.ts'
import { larguraExcedente, violacoesGraves } from './__fixtures__/verificacoes.ts'
import { expect, test } from './__fixtures__/perfis.ts'

/**
 * A conversa com o Assistente (11.3, A2, pacote W), com a pergunta da D18. Separado de `professor-assistente.spec.ts` pela 2.5.
 */

async function enviarPedido(page: Page, texto: string, hasTouch: boolean): Promise<void> {
  await caixa(page).fill(texto)
  await acionar(page.getByRole('button', { name: 'Enviar' }), hasTouch)
}

test.describe('a conversa (11.3)', () => {
  test('o pedido aparece na hora, o Assistente pensa, pergunta se ela quer a ferramenta com duas opções do mesmo tamanho, abre o cartão preenchido, gera e responde com a página citada', async ({ page, hasTouch }) => {
    // Entrada, troca de tela e recarga com a CPU ×4 e a rede lenta do perfil: o teste percorre vários estados da mesma tela.
    test.slow()
    const { api, turmaId, disciplinaId } = await entrar(page, hasTouch)
    await irPara(page, '/professor/nova-conversa')
    await expect(caixa(page)).toBeVisible({ timeout: PRAZO_DA_TELA_MS })

    const pedido = 'monta uma atividade de estequiometria, dez questões'
    await enviarPedido(page, pedido, hasTouch)
    // Enviando e pensando: o pedido dela na tela, a caixa limpa e a assinatura da IA com o texto de quem está preparando.
    await expect(page).toHaveURL(/\/professor\/conversa$/)
    const conversa = page.getByRole('log', { name: 'Conversa com o Assistente de ensino' })
    await expect(conversa.getByText(pedido)).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(conversa.locator('[data-pensando]')).toContainText('Assistente de ensino')
    await expect(selosDeIA(conversa.locator('[data-pensando]'))).toHaveCount(1)
    await expect(caixa(page)).toHaveValue('')
    // O enviar da Home saiu da tela com ela: o foco chega na caixa da conversa, e não no `body`.
    await expect(caixa(page)).toBeFocused()
    // A caixa presa embaixo, com a frase de IA depois dela, e 24 px entre a frase e o pé da barra (telas do professor, 4.1).
    const barra = page.getByRole('group', { name: 'Novo pedido' })
    const [caixaDaBarra, caixaDoCampo, caixaDaFrase] = await Promise.all([barra.boundingBox(), caixa(page).boundingBox(), barra.getByText('O Assistente é uma IA e pode errar').boundingBox()])
    expect(caixaDaFrase?.y ?? 0).toBeGreaterThanOrEqual((caixaDoCampo?.y ?? Infinity) + (caixaDoCampo?.height ?? 0))
    expect(Math.round((caixaDaBarra?.y ?? 0) + (caixaDaBarra?.height ?? 0) - ((caixaDaFrase?.y ?? 0) + (caixaDaFrase?.height ?? 0)))).toBe(24)
    await expect(barra.getByText('Nada chega à turma sem você aprovar')).toBeVisible()
    // O pedido saiu uma vez, com a chave do envio, o texto e a turma; nada de escola nem de pessoa.
    await expect.poll(() => api.pedidosEm(/mensagens$/).length).toBe(1)
    const enviado = api.pedidosEm(/mensagens$/)[0]?.corpo as Record<string, unknown>
    expect(Object.keys(enviado).sort()).toEqual(['chaveEnvio', 'disciplinaId', 'texto', 'turmaId'])
    expect(enviado).toMatchObject({ texto: pedido, turmaId, disciplinaId })
    expect(enviado['chaveEnvio']).toMatch(UUID)

    // A execução conclui com a proposta de ferramenta: a pergunta da D18.
    const proposta = propostaDeAtividade(turmaId, disciplinaId)
    api.conversa = [mensagemDela(pedido, turmaId, disciplinaId), proposta]
    // A releitura da conversa demora: enquanto ela não volta, a resposta que a execução trouxe aparece **depois** do
    // pedido, e não acima dele.
    const releitura = portao()
    api.trocar('conversa', async (lido) => {
      await releitura.aberta
      return api.responder('conversa', lido)
    })
    api.concluir(api.ultimaExecucao(), { tipo: 'mensagem', mensagem: proposta })
    const escolha = conversa.getByRole('group', { name: proposta.texto })
    await expect(escolha).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(conversa.locator('article')).toHaveText([new RegExp(`^Você: ${pedido}$`), /Posso fazer isso com a ferramenta Atividade objetiva/])
    releitura.abrir()
    api.trocar('conversa')
    await expect(conversa.locator('[data-pensando]')).toHaveCount(0)
    // O pedido não aparece duas vezes quando a conversa lida o traz.
    await expect(conversa.getByText(pedido)).toHaveCount(1)
    const opcoes = escolha.getByRole('button')
    await expect(opcoes).toHaveText([/^Usar a ferramenta Atividade objetiva/, /^Só conversar/])
    // Duas opções do mesmo peso (D59): mesmo tamanho e mesmo desenho, e nenhuma com o foco.
    const [usar, soConversar] = await Promise.all([opcoes.nth(0).boundingBox(), opcoes.nth(1).boundingBox()])
    expect(Math.round(usar?.width ?? 0)).toBe(Math.round(soConversar?.width ?? -1))
    expect(Math.round(usar?.height ?? 0)).toBe(Math.round(soConversar?.height ?? -1))
    const desenho = (alvo: Locator) => alvo.evaluate((elemento) => [getComputedStyle(elemento).backgroundColor, getComputedStyle(elemento).color, getComputedStyle(elemento).borderTopColor, getComputedStyle(elemento).fontWeight])
    expect(await desenho(opcoes.nth(0))).toEqual(await desenho(opcoes.nth(1)))
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    // A consulta da execução parou quando ela concluiu.
    const consultas = api.consultasDeExecucao.length
    await page.waitForTimeout(2_500)
    expect(api.consultasDeExecucao.length).toBe(consultas)

    // Com o sim, o cartão da ferramenta abre dentro da conversa, com o que o Assistente entendeu.
    await acionar(opcoes.nth(0), hasTouch)
    await expect(conversa.getByText('Você escolheu:')).toContainText('Usar a ferramenta Atividade objetiva')
    const cartao = page.locator('[data-cartao-de-ferramenta="atividade_objetiva"]')
    await expect(cartao.getByLabel('Tema')).toHaveValue('Estequiometria')
    // A opção escolhida saiu da tela: o foco vai para o cartão que abriu.
    const regiao = page.getByRole('region', { name: 'Ferramenta Atividade objetiva' })
    await expect(regiao).toBeFocused()
    // O cabeçalho do cartão: o ícone ilustrado de 32 px e o nome, na borda de 2 px (telas do professor, 4.2).
    const icone = regiao.locator('[data-icone-de-ferramenta="atividade_objetiva"]')
    await expect(icone).toBeVisible()
    const caixaDoIcone = await icone.boundingBox()
    expect([Math.round(caixaDoIcone?.width ?? 0), Math.round(caixaDoIcone?.height ?? 0)]).toEqual([32, 32])
    await expect(regiao.getByRole('heading', { level: 2, name: 'Atividade objetiva' })).toBeVisible()
    expect(await regiao.evaluate((elemento) => getComputedStyle(elemento).borderTopWidth)).toBe('2px')
    // E na cor do token `borda`, a mesma da linha "Você escolheu:" que a pergunta deixou (`border-2 border-borda`).
    const corDaBorda = (alvo: Locator) => alvo.evaluate((elemento) => getComputedStyle(elemento).borderTopColor)
    expect(await corDaBorda(regiao)).toBe(await corDaBorda(conversa.locator('[data-escolha="feita"]')))
    await expect(cartao.getByLabel('Questões')).toHaveValue('10')
    await expect(cartao.getByLabel('Turma e disciplina')).toHaveValue(`${turmaId}:${disciplinaId}`)
    // Com o cartão aberto, a ação da tela é a dele: a caixa de pedido espera.
    await expect(caixa(page)).toBeDisabled()
    await cartao.getByLabel('Questões').fill('2')
    await acionar(cartao.getByRole('button', { name: 'Gerar atividade' }), hasTouch)
    await expect(cartao.getByRole('status').filter({ hasText: 'Gerando' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    // O botão de gerar deu lugar ao pedido recolhido: o foco fica dentro do cartão.
    expect(await page.evaluate(() => document.activeElement?.closest('[data-motor]') !== null && document.activeElement !== document.body)).toBe(true)
    await expect.poll(() => api.pedidosEm(/gerar$/).length).toBe(1)
    const gerar = api.pedidosEm(/gerar$/)[0]
    expect(gerar?.caminho).toBe('/v1/ferramentas/atividade_objetiva/gerar')
    expect(gerar?.corpo).toMatchObject({ turmaId, disciplinaId, tema: 'Estequiometria', quantidade: 2 })

    // A geração conclui: a resposta com a assinatura, a página de cada questão, as fontes e as ações à vista.
    const artefato = atividadeSintetica(turmaId, disciplinaId)
    api.artefatos = [artefato]
    api.concluir(api.ultimaExecucao(), { tipo: 'artefato', artefatoId: artefato.id, entregaId: null })
    await expect(cartao.getByText(artefato.titulo)).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    // A troca de "Gerando…" pelo resultado é anunciada a quem não vê a tela.
    await expect(cartao.locator('[data-anuncio-do-resultado]')).toHaveText('Atividade objetiva: geração concluída. O resultado está logo abaixo do pedido.')
    await expect(cartao.getByText('Assistente · conversa e ferramentas')).toBeVisible()
    await expect(selosDeIA(cartao)).toHaveCount(1)
    await expect(cartao.getByRole('button', { name: `Fonte: ${TITULO_DO_MATERIAL}, p. 142` })).toBeVisible()
    await expect(cartao.getByText(`Fontes (2): ${TITULO_DO_MATERIAL}, p. 142 · p. 145`)).toBeVisible()
    await expect(cartao.getByRole('link', { name: 'Abrir o artefato' })).toBeVisible()
    await expect(cartao.getByRole('button', { name: 'Exportar em PDF' })).toBeVisible()
    // Toda saída de IA da tela leva o selo: a proposta e o que a ferramenta gerou.
    await expect(selosDeIA(page.getByRole('main'))).toHaveCount(2)
    await expect(page.getByText(/Seu time/)).toHaveCount(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await acionar(cartao.getByRole('link', { name: 'Abrir o artefato' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/artefatos/${artefato.id}$`))
  })

  test('"Ver mensagens anteriores" traz as antigas, em ordem, sem jogar a tela para o fim da conversa', async ({ page, hasTouch }) => {
    test.slow()
    const { api, turmaId, disciplinaId } = await entrar(page, hasTouch)
    const troca = (numero: number, quando: string) => [mensagemDela(`pergunta ${quando} ${String(numero)}`, turmaId, disciplinaId), respostaComPagina(`Resposta ${quando} ${String(numero)}, com algumas linhas de texto para a conversa ficar mais alta que a janela.`)]
    api.conversaAnterior = [1, 2, 3, 4, 5, 6].flatMap((numero) => troca(numero, 'antiga'))
    api.conversa = [1, 2, 3, 4, 5, 6].flatMap((numero) => troca(numero, 'recente'))
    await irPara(page, '/professor/conversa')
    const conversa = page.getByRole('log')
    const ultima = conversa.getByText('Resposta recente 6,')
    // A conversa abre no fim: a última mensagem à vista.
    await expect(ultima).toBeInViewport({ timeout: PRAZO_DA_TELA_MS })
    await expect(conversa.getByText('Você: pergunta antiga 1')).toHaveCount(0)

    const anteriores = page.getByRole('button', { name: 'Ver mensagens anteriores' })
    await anteriores.scrollIntoViewIfNeeded()
    await expect(ultima).not.toBeInViewport()
    await acionar(anteriores, hasTouch)
    await expect(conversa.getByText('Você: pergunta antiga 1')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(anteriores).toHaveCount(0)
    // Ela foi ler o começo: a tela fica onde ela está, e não volta para o fim.
    await page.evaluate(() => new Promise<void>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto()))))
    await expect(ultima).not.toBeInViewport()
    // As antigas vêm antes das recentes, cada pergunta antes da resposta dela.
    const falas = await conversa.locator('article').allInnerTexts()
    expect(falas).toHaveLength(24)
    expect(falas[0]).toContain('pergunta antiga 1')
    expect(falas[1]).toContain('Resposta antiga 1,')
    expect(falas[12]).toContain('pergunta recente 1')
    expect(falas[23]).toContain('Resposta recente 6,')
    expect(await larguraExcedente(page)).toBe(0)
  })

  test('os quatro estados da conversa; a resposta com chip de página e fontes; a falha vira aviso com "Tentar de novo", nunca código; a função suspensa vira aviso que explica', async ({ page, hasTouch }) => {
    // Entrada, troca de tela e recarga com a CPU ×4 e a rede lenta do perfil: o teste percorre vários estados da mesma tela.
    test.slow()
    const { api, turmaId, disciplinaId } = await entrar(page, hasTouch)

    // Carregando e erro.
    const segura = portao()
    api.trocar('conversa', async () => {
      await segura.aberta
      return erroDaApi(503, 'INDISPONIVEL_TENTE_DE_NOVO')
    })
    await irPara(page, '/professor/conversa')
    await expect(page.getByText('Carregando a conversa…')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    segura.abrir()
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_TELA_MS })
    // Vazio: o convite para pedir.
    api.trocar('conversa')
    await acionar(page.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(page.getByText('Nenhuma conversa ainda')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    expect(await violacoesGraves(page)).toEqual([])

    // A execução falha: aviso dentro da conversa, com "Tentar de novo", e nenhum código na tela.
    // O 13º pedido do minuto: a API recusa com 429, e a tela diz com calma que é só esperar, sem alarme e sem código.
    api.trocar('mensagens', () => erroDaApi(429, 'LIMITE_EXCEDIDO'))
    await enviarPedido(page, 'o que é reagente limitante?', hasTouch)
    const limite = page.locator('[data-limite-de-pedidos]')
    await expect(limite).toContainText('Você fez muitos pedidos ao Assistente em pouco tempo.', { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('main')).not.toContainText('LIMITE_EXCEDIDO')
    await expect(page.getByRole('log').getByText('o que é reagente limitante?')).toBeVisible()
    // "Pedir de novo" manda o mesmo pedido com a mesma chave: o recusado não chegou a virar execução.
    api.trocar('mensagens')
    await acionar(limite.getByRole('button', { name: 'Pedir de novo' }), hasTouch)
    await expect.poll(() => api.pedidosEm(/mensagens$/).length).toBe(2)
    const [recusado, repetido] = api.pedidosEm(/mensagens$/).map((pedido) => pedido.corpo as { texto: string; chaveEnvio: string })
    expect(repetido).toEqual(recusado)
    await expect(limite).toHaveCount(0)

    api.falhar(api.ultimaExecucao(), 'IA_INDISPONIVEL')
    const aviso = page.locator('[data-aviso-fila="falha"]')
    await expect(aviso).toContainText('Não foi possível responder agora.', { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('main')).not.toContainText('IA_INDISPONIVEL')
    await expect(page.getByRole('log').getByText('o que é reagente limitante?')).toBeVisible()
    // "Tentar de novo" manda o mesmo pedido com chave nova: a antiga devolveria a execução que falhou.
    await acionar(aviso.getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect.poll(() => api.pedidosEm(/mensagens$/).length).toBe(3)
    const [, primeiro, segundo] = api.pedidosEm(/mensagens$/).map((pedido) => pedido.corpo as { texto: string; chaveEnvio: string })
    expect(segundo?.texto).toBe(primeiro?.texto)
    expect(segundo?.chaveEnvio).not.toBe(primeiro?.chaveEnvio)

    // Com dado: a resposta em texto, com a assinatura, o chip de página e as fontes.
    const resposta = respostaComPagina('O reagente limitante é o que acaba primeiro.\n<b>Ele</b> determina quanto produto se forma.')
    api.conversa = [mensagemDela('o que é reagente limitante?', turmaId, disciplinaId), resposta]
    api.concluir(api.ultimaExecucao(), { tipo: 'mensagem', mensagem: resposta })
    const conversa = page.getByRole('log')
    await expect(conversa.getByText('O reagente limitante é o que acaba primeiro.')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    // O texto do modelo entra como texto: a marcação aparece escrita, e não vira elemento.
    await expect(conversa.locator('[data-texto-da-ia] b')).toHaveCount(0)
    await expect(conversa.getByText('Assistente de ensino', { exact: true })).toHaveCount(1)
    await expect(selosDeIA(conversa)).toHaveCount(1)
    const chip = conversa.getByRole('button', { name: `Fonte: ${TITULO_DO_MATERIAL}, p. 142` })
    await acionar(chip, hasTouch)
    await expect(page.getByRole('group', { name: `Fonte: ${TITULO_DO_MATERIAL}, p. 142` })).toContainText('cada mol de carbono')
    expect(await larguraExcedente(page)).toBe(0)
    await page.keyboard.press('Escape')
    await expect(conversa.getByText(`Fontes (1): ${TITULO_DO_MATERIAL}, p. 142`)).toBeVisible()
    await expect(conversa.getByText('o que é reagente limitante?')).toHaveCount(1)
    await expect(page.getByText(/Seu time/)).toHaveCount(0)
    expect(await violacoesGraves(page)).toEqual([])

    // A escola suspende a função: aviso que explica, sem alerta, e a caixa não aceita pedido.
    api.suspensas.add('conversa_e_ferramentas')
    await recarregar(page)
    const explicacao = page.getByRole('note')
    await expect(explicacao).toContainText('A coordenação suspendeu a conversa e as ferramentas do Assistente nesta escola.', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(caixa(page)).toBeDisabled()
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('main')).not.toContainText('FUNCAO_SUSPENSA')
    expect(await violacoesGraves(page)).toEqual([])
  })
})
