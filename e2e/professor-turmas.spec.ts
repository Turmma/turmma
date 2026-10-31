import type { Locator, Page, Request } from '@playwright/test'
import { AVISO_DO_COMPLEMENTO, EFEITO_DA_CONTESTACAO, NOME_DA_CONTESTACAO } from '../packages/shared/src/estrutura/vinculo.ts'
import { confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarEquipeComSenha, criarPedidosNoBanco, type EquipeDeTeste } from './support/seed.ts'
import { PRAZO_DA_ENTRADA_MS } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, larguraExcedente, violacoesGraves } from './support/checks.ts'

/**
 * Turmas do professor, na pele nova (telas do professor, 9.0; RF14, RF22): os cartões com o que espera em cada turma e a
 * contestação no painel ao lado. O fluxo de confirmar e contestar, os quatro estados, o teclado e o recomeço da sessão
 * estão em `escola-e-vinculos.spec.ts`, `areas.spec.ts` e `inatividade.spec.ts`; aqui está o que é só da tela nova.
 */

const PAINEL = 'dialog[data-painel-lado]'
const painel = (page: Page): Locator => page.locator(PAINEL)

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** A professora entra pela API (o cookie fica na aba) e abre o endereço: uma carga só, sem passar pela tela de entrada. */
async function abrirJaEntrando(page: Page, professora: EquipeDeTeste, endereco: string): Promise<void> {
  const resposta = await page.request.post('/v1/sessao/email', { data: { email: professora.email, senha: professora.senha } })
  expect(resposta.ok(), 'a entrada pela API').toBe(true)
  await page.goto(endereco)
}

async function alvoDeToque(alvo: Locator, descricao: string): Promise<void> {
  const caixa = await alvo.boundingBox()
  expect(caixa, `${descricao} sem caixa`).not.toBeNull()
  expect(caixa?.width ?? 0, `${descricao}: largura`).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  expect(caixa?.height ?? 0, `${descricao}: altura`).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
}

test.describe('Turmas na pele nova (9.0)', () => {
  test('o cartão diz o que espera na turma: o número dos pedidos, "Em dia" na que não tem nada, e a faixa a confirmar não entra na conta', async ({ page, hasTouch }) => {
    const professora = await criarEquipeComSenha()
    const comPedidos = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Matemática'], '8ºA sintética')
    const semPedidos = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['História'], '9ºB sintética')
    const aConfirmar = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Ciências'], '6ºC sintética')
    await confirmarVinculosNoBanco(professora.escolaId, [...comPedidos.vinculoIds, ...semPedidos.vinculoIds])
    await criarPedidosNoBanco(professora.escolaId, comPedidos.turmaId, [
      { nome: 'Aluna sintética Um', matricula: 'M-9001' },
      { nome: 'Aluno sintético Dois', matricula: 'M-9002' },
    ])
    await abrirJaEntrando(page, professora, '/professor/turmas')

    const principal = page.getByRole('main')
    const faixas = principal.getByRole('region', { name: 'Confirme suas turmas', exact: true })
    const cartoes = principal.getByRole('region', { name: 'Suas turmas', exact: true })
    await expect(principal.getByRole('heading', { level: 1, name: 'Turmas' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // A faixa: a turma e a disciplina no texto, e os dois botões.
    await expect(faixas.getByRole('listitem')).toHaveText([/Confirme sua turma · 6ºC sintética · Ciências/], { timeout: PRAZO_DA_ENTRADA_MS })
    await alvoDeToque(faixas.getByRole('button', { name: 'Confirmar' }), 'o botão de confirmar')
    await alvoDeToque(faixas.getByRole('button', { name: 'Contestar' }), 'o botão de contestar')
    // A faixa quebra a 360 px: os botões descem para baixo do texto; no computador ficam ao lado dele, na mesma linha.
    const textoDaFaixa = await faixas.getByText(/Confirme sua turma ·/).boundingBox()
    const botaoDaFaixa = await faixas.getByRole('button', { name: 'Confirmar' }).boundingBox()
    expect(textoDaFaixa).not.toBeNull()
    expect(botaoDaFaixa).not.toBeNull()
    if ((page.viewportSize()?.width ?? 0) < 640) expect(botaoDaFaixa?.y ?? 0).toBeGreaterThanOrEqual((textoDaFaixa?.y ?? 0) + (textoDaFaixa?.height ?? 0) - 1)
    else expect(botaoDaFaixa?.x ?? 0).toBeGreaterThanOrEqual((textoDaFaixa?.x ?? 0) + (textoDaFaixa?.width ?? 0) - 1)
    // Os cartões: um por turma e disciplina confirmada. A turma lida inteira diz o número, ou "Em dia"; nunca os dois.
    const doOito = cartoes.getByRole('listitem').filter({ hasText: comPedidos.turmaNome })
    const doNove = cartoes.getByRole('listitem').filter({ hasText: semPedidos.turmaNome })
    await expect(doOito).toContainText('2 esperando você', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(doNove).toContainText('Em dia', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(doOito).not.toContainText('Em dia')
    await expect(doNove).not.toContainText('esperando você')
    // O vínculo a confirmar não vira cartão e não entra na soma de ninguém.
    await expect(cartoes.getByRole('listitem').filter({ hasText: aConfirmar.turmaNome })).toHaveCount(0)
    await expect(cartoes.getByRole('listitem')).toHaveCount(2)
    await alvoDeToque(doOito.getByRole('link', { name: /Abrir a turma/ }), 'Abrir a turma')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await acionar(doOito.getByRole('link', { name: /Abrir a turma/ }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/turmas/${comPedidos.turmaId}$`), { timeout: PRAZO_DA_ENTRADA_MS })
  })

  test('a contestação abre num painel: ao lado no computador, folha de baixo a 360 px, sem rolar de lado; o aviso e o efeito vêm antes do envio; Esc devolve o foco', async ({
    page,
    hasTouch,
  }) => {
    const professora = await criarEquipeComSenha()
    await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['História'])
    await abrirJaEntrando(page, professora, '/professor/turmas')

    const contestar = page.getByRole('button', { name: 'Contestar' })
    await expect(contestar).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(contestar, hasTouch)
    const aberto = page.getByRole('dialog', { name: 'Contestar a turma' })
    await expect(aberto).toBeVisible()
    // O que a coordenação vai ler e o que vai acontecer, antes do envio (regra 50, item 8; regra 20).
    await expect(aberto).toContainText(AVISO_DO_COMPLEMENTO)
    await expect(aberto).toContainText(EFEITO_DA_CONTESTACAO)
    // E à vista, sem rolar: a folha de baixo a 360 px rola, e o efeito abaixo da dobra deixava enviar sem tê-lo visto.
    await expect(aberto.getByText(EFEITO_DA_CONTESTACAO)).toBeInViewport({ ratio: 1 })
    await expect(aberto.getByRole('radio')).toHaveCount(4)
    await alvoDeToque(aberto.getByRole('button', { name: 'Enviar a contestação' }), 'Enviar a contestação')
    await alvoDeToque(aberto.getByRole('button', { name: 'Fechar' }), 'Fechar')

    const janela = page.viewportSize()
    const caixa = await painel(page).boundingBox()
    expect(janela).not.toBeNull()
    expect(caixa).not.toBeNull()
    const larguraDaJanela = janela?.width ?? 0
    const alturaDaJanela = janela?.height ?? 0
    if (larguraDaJanela < 768) {
      // Folha de baixo: a largura toda, colada embaixo, e nunca mais alta que 88% da janela.
      expect(Math.round(caixa?.x ?? -1)).toBe(0)
      expect(Math.round(caixa?.width ?? 0)).toBe(larguraDaJanela)
      expect(Math.round((caixa?.y ?? 0) + (caixa?.height ?? 0))).toBe(alturaDaJanela)
      expect(caixa?.height ?? 0).toBeLessThanOrEqual(alturaDaJanela * 0.88 + 1)
    } else {
      // Ao lado: 480 px colados à direita, na altura da janela.
      expect(Math.round(caixa?.width ?? 0)).toBe(480)
      expect(Math.round((caixa?.x ?? 0) + (caixa?.width ?? 0))).toBe(larguraDaJanela)
      expect(Math.round(caixa?.height ?? 0)).toBe(alturaDaJanela)
    }
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Esc fecha, e o foco volta ao botão que abriu.
    await page.keyboard.press('Escape')
    await expect(aberto).toHaveCount(0)
    await expect(contestar).toBeFocused()
  })

  test('o complemento da contestação nunca vai ao endereço, a um registro do navegador nem a uma requisição que não seja a da contestação', async ({ page, hasTouch }) => {
    const professora = await criarEquipeComSenha()
    await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['História'])
    const escrito = 'texto-livre-que-so-a-coordenacao-le'
    const consoles: string[] = []
    page.on('console', (mensagem) => consoles.push(mensagem.text()))
    const requisicoes: Request[] = []
    page.on('request', (requisicao) => requisicoes.push(requisicao))
    await abrirJaEntrando(page, professora, '/professor/turmas')

    await acionar(page.getByRole('button', { name: 'Contestar' }), hasTouch)
    const aberto = page.getByRole('dialog', { name: 'Contestar a turma' })
    await aberto.getByRole('radio', { name: NOME_DA_CONTESTACAO.outro }).check()
    await aberto.getByRole('textbox').fill(escrito)
    // Com o texto escrito e o painel aberto, o endereço continua sendo o da tela.
    expect(new URL(page.url()).pathname).toBe('/professor/turmas')
    expect(page.url()).not.toContain(escrito)
    await acionar(aberto.getByRole('button', { name: 'Enviar a contestação' }), hasTouch)
    await expect(aberto).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })

    // Só a requisição da contestação leva o texto, e no corpo: nenhuma outra o carrega, nem no endereço.
    const comTexto = requisicoes.filter((requisicao) => requisicao.url().includes(escrito) || (requisicao.postData() ?? '').includes(escrito))
    expect(comTexto.map((requisicao) => `${requisicao.method()} ${new URL(requisicao.url()).pathname}`)).toEqual([expect.stringMatching(/^POST \/v1\/vinculos\/[^/]+\/contestar$/)])
    expect(comTexto.every((requisicao) => !requisicao.url().includes(escrito))).toBe(true)
    expect(consoles.filter((linha) => linha.includes(escrito))).toEqual([])
    expect(page.url()).not.toContain(escrito)
  })
})
