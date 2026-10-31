import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { entrarPelaTelaComSegundoFator, esperarPainel, PRAZO_DA_ENTRADA_MS } from './support/casca.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga, configurarSegundoFatorPelaApi } from './support/mfa.ts'
import { irPelaCoordenacao } from './support/coordenacao.ts'
import { conferirAssinaturas, conferirTamanhoDoAvatar } from './support/avatar.ts'
import { auditoriasNoBanco, montarEscolaComEntregas, type EscolaComEntregas } from './support/governanca.ts'
import { expect, test } from './support/profiles.ts'
import { criarEquipeComSenha, type EquipeDeTeste } from './support/seed.ts'
import { larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './support/checks.ts'

/**
 * O Analista e o pedido de dado nominal da coordenação (X2, 3.0 e 4.0; vieram de `governanca.spec.ts`): o resumo, o alerta como
 * hipótese com contexto, o recorte de um professor sem número e a leitura nominal, que mora no fim da página do Analista, com a
 * auditoria avisada antes. Dois recomeços: a pessoa seguinte na mesma aba e o pedido que sai da tela e responde depois.
 */

const principal = (page: Page) => page.getByRole('main')

const dialogo = (page: Page) => page.getByRole('alertdialog')

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

interface Cenario {
  readonly coordenadora: EquipeDeTeste
  readonly escola: EscolaComEntregas | undefined
}

/** A coordenadora entra e abre no Painel. Com `comEntregas`, a escola já tem o que o roteiro deixa até o passo 4. */
async function entrar(page: Page, request: APIRequestContext, comEntregas = true): Promise<Cenario> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  const escola = comEntregas ? await montarEscolaComEntregas(coordenadora.escolaId, coordenadora.usuarioId) : undefined
  await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/painel', () => esperarPainel(page))
  return { coordenadora, escola }
}

test.describe('O pedido de dado nominal, no fim do Analista', () => {
  test('o pedido de dado nominal avisa da auditoria antes, pede turma e finalidade, e grava uma auditoria por leitura', async ({ page, hasTouch, request }) => {
    const { coordenadora, escola } = await entrar(page, request)
    if (escola === undefined) throw new Error('escola sem entregas')
    await irPelaCoordenacao(page, 'Analista', hasTouch)
    await expect(principal(page).getByRole('button', { name: 'Abrir dado nominal de uma turma' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(principal(page).getByRole('button', { name: 'Abrir dado nominal de uma turma' }), hasTouch)
    await expect(dialogo(page)).toContainText('Esta abertura fica na auditoria da escola')
    const confirmar = dialogo(page).getByRole('button', { name: 'Abrir dado nominal' })
    // Sem turma e sem finalidade, não confirma.
    await expect(confirmar).toBeDisabled()
    await dialogo(page).getByLabel('Turma').selectOption({ label: `${escola.turmas.doB.nome} · ${escola.serieNome}` })
    await expect(confirmar).toBeDisabled()
    await dialogo(page).getByLabel('Finalidade').selectOption({ label: 'Conversa pedagógica com o professor, a pedido dele' })
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    // Cancelar não lê nada.
    await acionar(dialogo(page).getByRole('button', { name: 'Cancelar' }), hasTouch)
    expect(await auditoriasNoBanco(coordenadora.escolaId, 'analista.nominal_lido')).toEqual([])

    await acionar(principal(page).getByRole('button', { name: 'Abrir dado nominal de uma turma' }), hasTouch)
    await dialogo(page).getByLabel('Turma').selectOption({ label: `${escola.turmas.doB.nome} · ${escola.serieNome}` })
    await dialogo(page).getByLabel('Finalidade').selectOption({ label: 'Conversa pedagógica com o professor, a pedido dele' })
    await acionar(dialogo(page).getByRole('button', { name: 'Abrir dado nominal' }), hasTouch)
    const dado = principal(page).getByRole('region', { name: `Dado nominal da turma ${escola.turmas.doB.nome}` })
    await expect(dado).toContainText('Esta abertura foi registrada na auditoria da escola.', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dado).toContainText(escola.professoras.quimicaDoB)
    await expect(dado).toContainText(escola.professoras.fisicaDoB)
    await expect(dado).not.toContainText(escola.aluno)
    expect(await auditoriasNoBanco(coordenadora.escolaId, 'analista.nominal_lido')).toEqual([
      { autor: coordenadora.usuarioId, entidadeId: escola.turmas.doB.id, finalidade: 'conversa_pedagogica_a_pedido_do_professor' },
    ])
    await acionar(dado.getByRole('button', { name: 'Fechar dado nominal' }), hasTouch)
    await expect(dado).toHaveCount(0)
    // O botão que tinha o foco sumiu com o resultado: o foco volta para quem abriu, e não cai no `body`.
    await expect(principal(page).getByRole('button', { name: 'Abrir dado nominal de uma turma' })).toBeFocused()
  })

  test('abrir duas vezes grava duas auditorias: a confirmação nasce vazia, e sair da página não guarda a leitura', async ({ page, hasTouch, request }) => {
    test.slow()
    const { coordenadora, escola } = await entrar(page, request)
    if (escola === undefined) throw new Error('escola sem entregas')
    await irPelaCoordenacao(page, 'Analista', hasTouch)
    const abrir = principal(page).getByRole('button', { name: 'Abrir dado nominal de uma turma' })
    const dado = principal(page).getByRole('region', { name: /^Dado nominal da turma/ })
    for (const vez of [1, 2]) {
      await acionar(abrir, hasTouch)
      // A turma e a finalidade da leitura anterior não ficam escolhidas, e a leitura anterior sai da tela ao reabrir.
      await expect(dialogo(page).getByLabel('Turma')).toHaveValue('')
      await expect(dialogo(page).getByLabel('Finalidade')).toHaveValue('')
      await expect(dialogo(page).getByRole('button', { name: 'Abrir dado nominal' })).toBeDisabled()
      await expect(dado).toHaveCount(0)
      await dialogo(page).getByLabel('Turma').selectOption({ label: `${escola.turmas.doB.nome} · ${escola.serieNome}` })
      await dialogo(page).getByLabel('Finalidade').selectOption({ label: 'Conversa pedagógica com o professor, a pedido dele' })
      await acionar(dialogo(page).getByRole('button', { name: 'Abrir dado nominal' }), hasTouch)
      await expect(dado).toContainText('Esta abertura foi registrada na auditoria da escola.', { timeout: PRAZO_DA_ENTRADA_MS })
      expect(await auditoriasNoBanco(coordenadora.escolaId, 'analista.nominal_lido')).toHaveLength(vez)
    }
    // O resultado vive enquanto a seção está na tela: sair e voltar não o guarda, e não lê de novo.
    await irPelaCoordenacao(page, 'Painel', hasTouch)
    await irPelaCoordenacao(page, 'Analista', hasTouch)
    await expect(abrir).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dado).toHaveCount(0)
    expect(await auditoriasNoBanco(coordenadora.escolaId, 'analista.nominal_lido')).toHaveLength(2)
  })

  test('a falha da leitura fica no diálogo, não grava auditoria, e o aviso da tentativa anterior sai ao reabrir', async ({ page, hasTouch, request }) => {
    test.slow()
    const { coordenadora, escola } = await entrar(page, request)
    if (escola === undefined) throw new Error('escola sem entregas')
    await irPelaCoordenacao(page, 'Analista', hasTouch)
    // A turma some da escola entre o pedido e a leitura: o servidor responde "não encontrado".
    await page.route('**/v1/analista/nominal*', (rota) =>
      rota.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }) }),
    )
    const abrir = principal(page).getByRole('button', { name: 'Abrir dado nominal de uma turma' })
    await acionar(abrir, hasTouch)
    await dialogo(page).getByLabel('Turma').selectOption({ label: `${escola.turmas.doB.nome} · ${escola.serieNome}` })
    await dialogo(page).getByLabel('Finalidade').selectOption({ label: 'Conversa pedagógica com o professor, a pedido dele' })
    await acionar(dialogo(page).getByRole('button', { name: 'Abrir dado nominal' }), hasTouch)
    await expect(dialogo(page).getByRole('alert')).toContainText('Esta turma não está mais na escola', { timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(dialogo(page).getByRole('button', { name: 'Cancelar' }), hasTouch)
    await acionar(abrir, hasTouch)
    // O aviso da tentativa anterior não vem junto da confirmação nova.
    await expect(dialogo(page)).toBeVisible()
    await expect(dialogo(page)).not.toContainText('Esta turma não está mais na escola')
    expect(await auditoriasNoBanco(coordenadora.escolaId, 'analista.nominal_lido')).toEqual([])
  })
})

test.describe('Analista', () => {
  test('gera o resumo: o alerta é hipótese com contexto, e o recorte de um professor só aparece sem número', async ({ page, hasTouch, request }) => {
    const { escola } = await entrar(page, request)
    if (escola === undefined) throw new Error('escola sem entregas')
    await irPelaCoordenacao(page, 'Analista', hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/analista$/)
    // Vazio: nenhum resumo gerado ainda.
    await expect(principal(page)).toContainText('Nenhum resumo gerado ainda', { timeout: PRAZO_DA_ENTRADA_MS })
    // O Analista assina com o avatar, o nome da função e o selo "IA" no mesmo bloco (RF10).
    expect(await conferirAssinaturas(principal(page))).toBe(1)
    expect(await conferirTamanhoDoAvatar(principal(page), 48)).toBe(1)
    expect(await violacoesGraves(page)).toEqual([])

    await acionar(principal(page).getByRole('button', { name: 'Gerar resumo' }), hasTouch)
    const resumo = principal(page).locator('[data-resumo-do-analista]')
    await expect(resumo).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('button', { name: 'Gerar resumo' })).toBeEnabled()
    // O foco vai para o resumo que chegou.
    await expect(resumo.getByText(/^Resumo gerado em/)).toBeFocused()

    const alerta = resumo.locator('[data-alerta="habilidade_com_acerto_baixo"]')
    await expect(alerta).toHaveCount(1)
    await expect(alerta).toContainText(`Em ${escola.serieNome} · Química, o acerto em "Identificar o reagente limitante" (QUI.EM.06) ficou em 50%, abaixo de 60%, um limite provisório desta versão, a definir com a escola.`)
    await expect(alerta).toContainText('Hipóteses a conferir')
    // O selo diz "Hipótese" em texto, e a coluna é a de leitura (880 px).
    await expect(alerta.locator('[data-estado="info"]')).toHaveText('Hipótese')
    await expect(page.locator('[data-tela="leitura"]')).toHaveCount(1)
    await expect(resumo).toContainText('É uma hipótese a conferir, não uma conclusão')
    // Química tem duas professoras: tem número. Física, uma só: aparece sem número, dito como tal.
    const quimica = resumo.getByRole('region', { name: `${escola.serieNome} · Química` })
    await expect(quimica).toContainText('2 correções aprovadas')
    // O recorte não diz quantos professores tem: nem os com vínculo, nem os com correção.
    await expect(quimica).not.toContainText('professor')
    const semNumero = resumo.locator('[data-recorte-nominal]')
    await expect(semNumero).toHaveCount(1)
    await expect(semNumero).toContainText(`${escola.serieNome} · Física`)
    await expect(semNumero).toContainText('Menos de dois professores')
    await expect(resumo.getByRole('region', { name: `${escola.serieNome} · Física` })).toHaveCount(0)
    // Nenhum nome de professor nem de aluno no agregado.
    for (const nome of [...Object.values(escola.professoras), escola.aluno, escola.turmas.doB.nome]) await expect(principal(page)).not.toContainText(nome)
    // O dado nominal também está aqui, à parte, com o mesmo aviso.
    await acionar(principal(page).getByRole('button', { name: 'Abrir dado nominal de uma turma' }), hasTouch)
    await expect(dialogo(page)).toContainText('Esta abertura fica na auditoria da escola')
    await acionar(dialogo(page).getByRole('button', { name: 'Cancelar' }), hasTouch)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })
})

/** Gera o resumo da escola pela tela, do vazio ao resumo à vista. */
async function gerarResumo(page: Page, hasTouch: boolean): Promise<void> {
  await expect(principal(page)).toContainText('Nenhum resumo gerado ainda', { timeout: PRAZO_DA_ENTRADA_MS })
  await acionar(principal(page).getByRole('button', { name: 'Gerar resumo' }), hasTouch)
  await expect(principal(page).locator('[data-resumo-do-analista]')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
}

const sair = (page: Page) => page.getByRole('button', { name: 'Sair' }).first()

test.describe('recomeço: a pessoa seguinte na mesma aba', () => {
  test('o resumo e o dado nominal da escola anterior não aparecem para a coordenação que entra depois, sem recarregar a página', async ({ page, hasTouch, request }) => {
    test.slow()
    const primeira = await criarEquipeComSenha('coordenador')
    const escola = await montarEscolaComEntregas(primeira.escolaId, primeira.usuarioId)
    const segunda = await criarEquipeComSenha('coordenador')

    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, primeira, '/coordenacao/painel', () => esperarPainel(page))
    await irPelaCoordenacao(page, 'Analista', hasTouch)
    await gerarResumo(page, hasTouch)
    await acionar(principal(page).getByRole('button', { name: 'Abrir dado nominal de uma turma' }), hasTouch)
    await dialogo(page).getByLabel('Turma').selectOption({ label: `${escola.turmas.doB.nome} · ${escola.serieNome}` })
    await dialogo(page).getByLabel('Finalidade').selectOption({ label: 'Conversa pedagógica com o professor, a pedido dele' })
    await acionar(dialogo(page).getByRole('button', { name: 'Abrir dado nominal' }), hasTouch)
    await expect(principal(page).getByRole('region', { name: `Dado nominal da turma ${escola.turmas.doB.nome}` })).toContainText(escola.professoras.quimicaDoB, { timeout: PRAZO_DA_ENTRADA_MS })

    await acionar(sair(page), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    // Da entrada da pessoa seguinte em diante (a tela da anterior já saiu), qualquer momento em que a tela traz o resumo ou o nome de professor da escola anterior é registrado.
    await page.evaluate((nome) => {
      const vazamentos: string[] = []
      ;(window as unknown as { __vazamentos: string[] }).__vazamentos = vazamentos
      const ler = () => {
        if (document.querySelector('[data-resumo-do-analista], [data-dado-nominal]') !== null) vazamentos.push('resumo ou dado nominal')
        if (document.body.textContent?.includes(nome) === true) vazamentos.push(nome)
      }
      new MutationObserver(ler).observe(document.body, { subtree: true, childList: true, characterData: true })
    }, escola.professoras.quimicaDoB)

    // O segundo fator é configurado pela API: o caso é sobre o que a aba mostra da pessoa anterior, e o login pela tela continua.
    const { segredo } = await configurarSegundoFatorPelaApi(request, segunda)
    await entrarPelaTelaComSegundoFator(page, segunda, segredo, hasTouch)
    await esperarPainel(page)
    await irPelaCoordenacao(page, 'Analista', hasTouch)
    // O que a segunda pessoa vê é só da escola dela: sem resumo, sem leitura nominal, e o botão de gerar disponível.
    await expect(principal(page)).toContainText('Nenhum resumo gerado ainda', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).locator('[data-resumo-do-analista]')).toHaveCount(0)
    await expect(principal(page).locator('[data-dado-nominal]')).toHaveCount(0)
    await expect(principal(page).getByRole('button', { name: 'Gerar resumo' })).toBeEnabled()
    expect(await page.content()).not.toContain(escola.professoras.quimicaDoB)
    expect(await page.evaluate(() => (window as unknown as { __vazamentos: string[] }).__vazamentos)).toEqual([])
  })
})

test.describe('recomeço: o pedido de "Gerar resumo"', () => {
  test('com o pedido no ar, outro toque não manda um segundo: um pedido por vez, do vazio e depois do resumo', async ({ page, hasTouch, request }) => {
    test.slow()
    const { escola } = await entrar(page, request)
    if (escola === undefined) throw new Error('escola sem entregas')
    await irPelaCoordenacao(page, 'Analista', hasTouch)
    let pedidos = 0
    let segurar = false
    let soltar: () => void = () => undefined
    const solta = new Promise<void>((resolver) => (soltar = resolver))
    await page.route('**/v1/analista/gerar', async (rota) => {
      pedidos += 1
      if (segurar) await solta
      await rota.continue()
    })

    // Do vazio: um pedido, que termina.
    await gerarResumo(page, hasTouch)
    expect(pedidos).toBe(1)

    // Do resumo: o pedido fica no ar, o botão se desliga e diz o que acontece, e nenhum outro toque vale.
    segurar = true
    await acionar(principal(page).getByRole('button', { name: 'Gerar resumo' }), hasTouch)
    const gerando = principal(page).getByRole('button', { name: 'Gerando o resumo…' })
    await expect(gerando).toBeDisabled()
    await gerando.dispatchEvent('click')
    await gerando.dispatchEvent('click')
    await expect(principal(page).getByText('O Analista está montando o resumo. Você pode continuar nesta tela.')).toBeVisible()
    expect(pedidos).toBe(2)
    soltar()
    await expect(principal(page).getByRole('button', { name: 'Gerar resumo' })).toBeEnabled({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(pedidos).toBe(2)
  })

  test('a resposta que chega depois de a coordenação sair não mexe na tela da pessoa seguinte', async ({ page, hasTouch, request }) => {
    test.slow()
    const primeira = await criarEquipeComSenha('coordenador')
    await montarEscolaComEntregas(primeira.escolaId, primeira.usuarioId)
    const segunda = await criarEquipeComSenha('coordenador')

    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, primeira, '/coordenacao/painel', () => esperarPainel(page))
    await irPelaCoordenacao(page, 'Analista', hasTouch)
    await expect(principal(page)).toContainText('Nenhum resumo gerado ainda', { timeout: PRAZO_DA_ENTRADA_MS })

    // O servidor aceita o pedido, mas a resposta fica retida até a segunda pessoa estar na tela.
    let soltar: () => void = () => undefined
    const solta = new Promise<void>((resolver) => (soltar = resolver))
    let entregue: () => void = () => undefined
    let entregaAbortada = false
    const foiEntregue = new Promise<void>((resolver) => (entregue = resolver))
    await page.route('**/v1/analista/gerar', async (rota) => {
      const resposta = await rota.fetch()
      await solta
      // A aba pode ter abortado o pedido ao sair: nesse caso não há o que entregar.
      await rota.fulfill({ response: resposta }).catch(() => {
        entregaAbortada = true
      })
      entregue()
    })
    await acionar(principal(page).getByRole('button', { name: 'Gerar resumo' }), hasTouch)
    await expect(principal(page).getByRole('button', { name: 'Gerando o resumo…' })).toBeDisabled()

    await acionar(sair(page), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    // O segundo fator é configurado pela API: o caso é sobre o que a aba mostra da pessoa anterior, e o login pela tela continua.
    const { segredo } = await configurarSegundoFatorPelaApi(request, segunda)
    await entrarPelaTelaComSegundoFator(page, segunda, segredo, hasTouch)
    await esperarPainel(page)
    await irPelaCoordenacao(page, 'Analista', hasTouch)
    await expect(principal(page)).toContainText('Nenhum resumo gerado ainda', { timeout: PRAZO_DA_ENTRADA_MS })
    // O pedido da anterior não é da segunda pessoa: o botão dela está livre.
    await expect(principal(page).getByRole('button', { name: 'Gerar resumo' })).toBeEnabled()

    // Daqui até a resposta atrasada chegar à aba, qualquer momento em que a tela da segunda pessoa mostre o pedido da anterior
    // (o aviso de que está gerando, um resumo ou um alerta de falha) é registrado.
    await page.evaluate(() => {
      const vazamentos: string[] = []
      ;(window as unknown as { __vazamentos: string[] }).__vazamentos = vazamentos
      const ler = () => {
        if (document.querySelector('main')?.textContent?.includes('O Analista está montando o resumo') === true) vazamentos.push('gerando')
        if (document.querySelector('[data-resumo-do-analista]') !== null) vazamentos.push('resumo')
        if (document.querySelector('main [role="alert"]:not(:empty)') !== null) vazamentos.push('alerta')
      }
      new MutationObserver(ler).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
    })
    // A aba só viu a resposta quando o navegador a anuncia: sem ela o teste não esperou nada (sem anúncio, a aba abortou o pedido).
    const chegouNaAba = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/analista/gerar', { timeout: PRAZO_DA_ENTRADA_MS }).catch(() => undefined)
    soltar()
    await foiEntregue
    const anunciada = (await chegouNaAba) !== undefined
    // O relatório diz qual dos dois caminhos o teste exercitou: a resposta chegou à aba, ou a aba já tinha abortado o pedido.
    test.info().annotations.push({ type: 'resposta atrasada', description: anunciada ? 'chegou à aba' : entregaAbortada ? 'a aba abortou o pedido ao sair' : 'sem anúncio no prazo' })
    // Dois quadros depois do anúncio: o que a aba fosse fazer com a resposta já aconteceu.
    await page.evaluate(() => new Promise<void>((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver()))))
    expect(await page.evaluate(() => (window as unknown as { __vazamentos: string[] }).__vazamentos)).toEqual([])
    await expect(principal(page)).toContainText('Nenhum resumo gerado ainda')
    await expect(principal(page).getByText('O Analista está montando o resumo')).toHaveCount(0)
    await expect(principal(page).locator('[data-resumo-do-analista]')).toHaveCount(0)
    await expect(principal(page).getByRole('button', { name: 'Gerar resumo' })).toBeEnabled()
  })
})
