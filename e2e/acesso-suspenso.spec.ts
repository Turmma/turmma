import type { BrowserContext, Locator, Page, Request, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { entrarComoAluno, entrarPelaApi, entrarPorEmail, esperarInicioDoAluno, esperarNovaConversa, irPelaNavegacao, PRAZO_DA_ENTRADA_MS } from './__fixtures__/casca.ts'
import { carregarSemRedeLenta, expect, test } from './__fixtures__/perfis.ts'
import {
  agendarEliminacaoNoBanco,
  cancelarEliminacaoNoBanco,
  criarAlunoComMatricula,
  criarEquipeComSenha,
  criarUsuarioEmOutraEscola,
} from './__fixtures__/sessao.ts'
import { larguraExcedente, violacoesGraves } from './__fixtures__/verificacoes.ts'

/**
 * A tela "Acesso suspenso" (F3, 20.0; Tech Spec, seção 9, "Login suspenso"): a renovação da sessão responde
 * `ACESSO_SUSPENSO`, e a aba para de tentar. O 403 vem da API de verdade, com o cookie que ela apagou, e por isso aqui
 * nada é simulado com `route.fulfill(403)`: isso esconderia justamente o cookie apagado, de que a segunda aba depende.
 *
 * A marca é posta no banco com a sessão da aba ainda aberta, como a coordenação faz ao registrar o pedido; a
 * requisição seguinte da aba é recusada (401), a renovação responde 403, e a tela toma o lugar da área.
 */

const ROTA_EU = '**/v1/eu'
const TEXTO_DA_SUSPENSAO = MENSAGENS_DE_ERRO.ACESSO_SUSPENSO
const INTERVALO_DA_ATIVIDADE_MIN = 5
/** A esteira responde mais devagar que a máquina; aqui a lentidão é forçada, e não esperada. */
const ATRASO_DA_REDE_LENTA_MS = 500

const dialogo = (page: Page) => page.getByRole('dialog')
const tituloDaTela = (page: Page) => page.getByRole('heading', { level: 1, name: 'Acesso suspenso' })
const tituloDeFerramentas = (page: Page) => page.getByRole('heading', { level: 1, name: 'Ferramentas' })
const linkDaEntrada = (page: Page) => page.getByRole('link', { name: 'Ir para a entrada' })

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Minutos no formato que o relógio simulado do Playwright entende. */
const minutos = (quantidade: number): string => `${String(Math.floor(quantidade / 60)).padStart(2, '0')}:${String(quantidade % 60).padStart(2, '0')}:00`

/** O que a tela suspensa nunca mostra: botão de tentar de novo, campo de entrada, aviso de sessão vencida. */
async function esperarSemSaidaFalsa(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: /Tentar de novo/ })).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.locator('input')).toHaveCount(0)
  await expect(dialogo(page)).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Sua sessão expirou')
}

/**
 * A segunda aba da mesma professora, aberta com **toda leitura da API atrasada** e devolvida só quando **nenhuma
 * requisição dela está a caminho**. O título espera apenas o `/v1/eu`; ao montar, a tela dispara a leitura dela (e a
 * Nova conversa, outras três: vínculos, time e entregas pendentes), e a casca ainda pode ganhar mais. Na esteira elas chegaram depois da marca
 * posta no banco: a segunda aba levou o 403 primeiro e apagou o cookie, e a primeira renovou sem ele (401) e mostrou o
 * login por cima, e não a tela. O teste afirma que a primeira aba pede primeiro, e isso só vale sem nada da segunda a
 * caminho, qualquer que seja a leitura: por isso conta o que saiu e ainda não voltou, em vez de listar as consultas.
 */
async function abrirSegundaAbaQuieta(context: BrowserContext, endereco: string): Promise<Page> {
  const aba = await context.newPage()
  const eUmaLeitura = (url: URL): boolean => url.pathname.startsWith('/v1/')
  await aba.route(eUmaLeitura, async (rota: Route) => {
    if (rota.request().method() === 'GET') await new Promise((resolver) => setTimeout(resolver, ATRASO_DA_REDE_LENTA_MS))
    await rota.continue()
  })
  const aCaminho = new Set<Request>()
  aba.on('request', (pedido: Request) => aCaminho.add(pedido))
  aba.on('requestfinished', (pedido: Request) => aCaminho.delete(pedido))
  aba.on('requestfailed', (pedido: Request) => aCaminho.delete(pedido))
  await aba.goto(endereco)
  await expect(tituloDeFerramentas(aba)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  await expect.poll(() => aCaminho.size, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(0)
  await aba.unroute(eUmaLeitura)
  return aba
}

test.describe('acesso suspenso pela eliminação agendada', () => {
  test('o aluno com a aba aberta vê a tela, sem saída falsa nem o nome dele; a senha certa mostra o texto e não entra, e cancelada entra', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    await page.clock.install()
    await entrarComoAluno(page, aluno, hasTouch)

    // A coordenação registrou o pedido: a requisição seguinte da aba já não vale (401), e a renovação responde 403.
    await agendarEliminacaoNoBanco(aluno.usuarioId)
    await page.clock.fastForward(minutos(INTERVALO_DA_ATIVIDADE_MIN + 1))
    await page.mouse.move(30, 30)

    await expect(tituloDaTela(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('alert')).toHaveText(TEXTO_DA_SUSPENSAO)
    await expect(page).toHaveTitle('Acesso suspenso · Turmma')
    await esperarSemSaidaFalsa(page)
    // No Chromebook do carrinho a próxima pessoa pode olhar a tela: nada de quem estava aqui.
    await expect(page.locator('body')).not.toContainText(aluno.nome)
    await expect(page.locator('body')).not.toContainText(aluno.escolaNome)
    // O aluno não tem e-mail: o caminho de volta é o endereço da escola dele, e não a entrada da equipe.
    await expect(linkDaEntrada(page)).toHaveAttribute('href', `/e/${aluno.slug}`)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Pelo teclado: o link é o único alvo da tela, e o Enter leva à entrada da escola.
    const entradasDoHistorico = await page.evaluate(() => history.length)
    await page.keyboard.press('Tab')
    await expect(linkDaEntrada(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/e/${aluno.slug}$`), { timeout: PRAZO_DA_ENTRADA_MS })
    // O link troca a entrada do histórico em vez de acrescentar uma: o Voltar não leva à área de quem estava aqui.
    expect(await page.evaluate(() => history.length)).toBe(entradasDoHistorico)
    // E a aba deixou de ser suspensa: um endereço protegido aberto sem recarregar leva à entrada, e não à tela outra vez.
    await page.evaluate(() => history.pushState(null, '', '/aluno/atividades'))
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(tituloDaTela(page)).toHaveCount(0)
  })

  test('a senha certa, com a eliminação ainda agendada, mostra o texto e não abre sessão; cancelada dentro do prazo, entra', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    await agendarEliminacaoNoBanco(aluno.usuarioId)
    await page.goto(`/e/${aluno.slug}`)

    // A senha certa, com a eliminação ainda agendada, mostra o mesmo texto e não abre sessão.
    await page.getByLabel('Matrícula').fill(aluno.matricula)
    await page.getByLabel('Senha').fill(aluno.senha)
    await acionar(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await expect(page.getByRole('alert')).toContainText(TEXTO_DA_SUSPENSAO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveURL(new RegExp(`/e/${aluno.slug}$`))

    // Cancelado dentro do prazo, a mesma senha entra.
    await cancelarEliminacaoNoBanco(aluno.usuarioId)
    await acionar(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await esperarInicioDoAluno(page, aluno.nome)
  })

  test('recomeço no Chromebook do carrinho: o colega entra na mesma aba, com o /v1/eu segurado, e nada do anterior aparece', async ({ page, hasTouch }) => {
    const anterior = await criarAlunoComMatricula()
    const colega = await criarAlunoComMatricula({ escola: anterior })
    await page.clock.install()
    await entrarComoAluno(page, anterior, hasTouch)

    await agendarEliminacaoNoBanco(anterior.usuarioId)
    await page.clock.fastForward(minutos(INTERVALO_DA_ATIVIDADE_MIN + 1))
    await page.mouse.move(30, 30)
    await expect(tituloDaTela(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // O colega chega pelo link da tela. A leitura de quem ele é fica segurada: é a janela em que o cache da pessoa
    // anterior, se existisse, apareceria no lugar do dele.
    let liberarEu: () => void = () => undefined
    const euLiberado = new Promise<void>((resolver) => (liberarEu = resolver))
    await page.route(ROTA_EU, async (rota: Route) => {
      await euLiberado
      await rota.continue()
    })
    await acionar(linkDaEntrada(page), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/e/${anterior.slug}$`), { timeout: PRAZO_DA_ENTRADA_MS })
    await page.getByLabel('Matrícula').fill(colega.matricula)
    await page.getByLabel('Senha').fill(colega.senha)
    await acionar(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)

    // Sem o `/v1/eu`, a página inicial ainda não sabe para onde levar o colega: o que importa é que saiu da entrada.
    await expect(page).not.toHaveURL(/\/e\//, { timeout: PRAZO_DA_ENTRADA_MS })
    // Com o `/v1/eu` segurado, a página só pode mostrar o que já estava em memória: o nome do anterior aqui seria o
    // cache da pessoa que saiu, e é isso que a asserção prova.
    await expect(page.locator('body')).not.toContainText(anterior.nome)
    await expect(page.locator('body')).not.toContainText(TEXTO_DA_SUSPENSAO)
    await expect(page.locator('body')).not.toContainText('Acesso suspenso')

    liberarEu()
    await esperarInicioDoAluno(page, colega.nome)
    await expect(page.locator('body')).not.toContainText(anterior.nome)
  })

  test('a professora suspensa na escola A e ativa na B recarrega e vê a tela; o segundo F5 cai na entrada, e não na tela outra vez', async ({ page }) => {
    const emA = await criarEquipeComSenha()
    await criarUsuarioEmOutraEscola(emA.contaId)
    // A entrada é só o ponto de partida: sai pela API, com a escola A escolhida, e abre em Ferramentas, que não lê nada
    // além do que a casca já lê. A primeira carga da página não afirma nada sobre o tempo de baixar (`carregarSemRedeLenta`);
    // as recargas, que são o que o caso prova, ficam na rede do perfil. Com a entrada pela tela, a saudação do Início e as
    // duas recargas na rede lenta, o caso inteiro levava 25,7 s (chromebook) e 27,4 s (celular), contra os 30 s que o
    // runner da esteira leva em dobro. A entrada pela tela e o seletor ausente ficam no caso seguinte.
    await carregarSemRedeLenta(page, async () => {
      await entrarPelaApi(page, emA, '/professor/ferramentas', emA.usuarioId)
      await expect(tituloDeFerramentas(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    })

    await agendarEliminacaoNoBanco(emA.usuarioId)
    await page.reload()

    // A aba recém-aberta não sabe quem estava: o caminho é a entrada da equipe.
    await expect(tituloDaTela(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('alert')).toHaveText(TEXTO_DA_SUSPENSAO)
    await esperarSemSaidaFalsa(page)
    await expect(linkDaEntrada(page)).toHaveAttribute('href', '/entrar')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await expect(page.locator('body')).not.toContainText(emA.nome)

    // O 403 apagou o cookie: a mesma entrada de novo, que é o segundo F5, cai na entrada, e não na tela outra vez.
    await page.reload()
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(tituloDaTela(page)).toHaveCount(0)
  })

  test('a professora suspensa na escola A e ativa na B entra pelo e-mail direto em B, sem A no seletor', async ({ page, hasTouch }) => {
    const emA = await criarEquipeComSenha()
    const emB = await criarUsuarioEmOutraEscola(emA.contaId)
    await agendarEliminacaoNoBanco(emA.usuarioId)

    // Sem sessão nenhuma, como a aba que o segundo F5 deixou na entrada: a conta continua valendo em B, o e-mail entra
    // direto nela, e a escola suspensa não é oferecida.
    await carregarSemRedeLenta(page, () => page.goto('/entrar'))
    await entrarPorEmail(page, emA, hasTouch)
    await esperarNovaConversa(page, 'Professora sintética na outra escola', { escolaNome: emB.escolaNome })
    await expect(page).not.toHaveURL(/\/escolher-escola$/)
    await expect(page.locator('body')).not.toContainText(emA.escolaNome)
    await expect(page.getByRole('button', { name: /^Escola: / })).toHaveCount(0)
  })

  test('duas abas: a primeira mostra a tela, e a segunda recebe o login por cima, em que a senha certa mostra o texto e não abre sessão', async ({ page, context, hasTouch }) => {
    const professora = await criarEquipeComSenha()
    // As duas abas abrem em Ferramentas, que não lê nada além do que a casca já lê: o caso gasta o tempo no que prova, não na saudação.
    // A primeira carga não afirma nada sobre o tempo de baixar (`carregarSemRedeLenta`); a lentidão que o caso quer vem da segunda aba.
    await carregarSemRedeLenta(page, async () => {
      await entrarPelaApi(page, professora, '/professor/ferramentas')
      await expect(tituloDeFerramentas(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    })
    const segundaAba = await abrirSegundaAbaQuieta(context, '/professor/ferramentas')

    await agendarEliminacaoNoBanco(professora.usuarioId)
    // A primeira aba é a que pede primeiro: é o 403 dela que apaga o cookie. "Criados" ainda não foi aberta, então a
    // consulta sai; "Turmas" estaria no cache (30 s de `staleTime`), e a aba só mostraria o que já tinha.
    await irPelaNavegacao(page, 'Criados', hasTouch)
    await expect(tituloDaTela(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // A aba sabia que era a professora: o caminho de volta é a entrada da equipe, e não o endereço da escola.
    await expect(linkDaEntrada(page)).toHaveAttribute('href', '/entrar')

    // A segunda renova com o cookie que já não existe: 401, e a sessão vence com o login por cima da tela dela.
    await irPelaNavegacao(segundaAba, 'Criados', hasTouch)
    await expect(dialogo(segundaAba)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogo(segundaAba)).toContainText('Sua sessão expirou')
    await expect(tituloDaTela(segundaAba)).toHaveCount(0)

    await dialogo(segundaAba).getByLabel('E-mail').fill(professora.email)
    await dialogo(segundaAba).getByLabel('Senha').fill(professora.senha)
    await acionar(dialogo(segundaAba).getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await expect(dialogo(segundaAba)).toContainText(TEXTO_DA_SUSPENSAO, { timeout: PRAZO_DA_ENTRADA_MS })
    // Nenhuma sessão abriu: o diálogo continua, e o cookie de renovação não voltou.
    await expect(dialogo(segundaAba)).toBeVisible()
    expect((await context.cookies()).filter((cookie) => cookie.name === 'educa_sessao')).toEqual([])
  })
})
