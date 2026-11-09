import type { APIRequestContext, Locator, Page, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { lerAmbienteDeTeste, valorObrigatorio } from '../tools/ci/compose.ts'
import { SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'
import { expect, test } from './support/profiles.ts'
import { criarAlunoComMatricula, criarEquipeComSenha, type EquipeDeTeste } from './support/seed.ts'

/**
 * "Esqueci a senha" e "Redefinir" (acesso-e-convites, tarefa 6.0; RF12 e RF18; `cenarios.md`, "Telas", linhas Esqueci e Redefinir, e
 * "E2E (RF18)"): a equipe pede o link pela entrada, recebe o e-mail do Mailpit e define a senha nova; volta à entrada com o aviso, sem
 * login automático. Pela tela, nos projetos `chromebook` e `celular`, com o worker e o Mailpit do compose de teste. Os textos esperados
 * estão aqui por extenso.
 *
 * "Recomeço: a 2ª pessoa" não se aplica: as duas telas são anônimas, sem sessão, e não guardam nada de quem passou antes.
 */

const CONFIRMACAO = 'Se houver conta com este e-mail, mandamos um link. Ele vale 1 hora.'
const ALUNO = 'Aluno: peça a senha provisória ao professor.'
const SENHA_TROCADA = 'Senha trocada. Entre com a nova.'
const LINK_QUE_NAO_VALE = 'Este link não vale mais. Peça outro em Esqueci a senha.'
const REGRA = 'Pelo menos 12 caracteres. Use uma frase que só você saiba.'
const SENHA_RECUSADA = 'A senha precisa ter pelo menos 12 caracteres.'
const SENHA_NOVA = 'frase-sintetica-da-senha-nova'
/** Um token com o formato do link (43 caracteres) que a API nunca emitiu. */
const TOKEN_QUE_NUNCA_EXISTIU = 'A'.repeat(43)
const TOKEN_B = 'B'.repeat(43)
const ROTA_ESQUECI = '**/v1/senha/esqueci'
const ROTA_REDEFINIR = '**/v1/senha/redefinir'

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Uma porta que segura a resposta até o teste abrir. */
function gate(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

/** A API fora do ar para a web: a chamada cai na rede, e a tela diz o catálogo geral. */
const derrubar = (rota: Route) => rota.abort()

/** O Mailpit do compose de teste: o texto da mensagem que o worker entregou a um endereço, ou `undefined` se ela não chegou. */
async function textoDoMailpit(para: string): Promise<string | undefined> {
  const base = `http://127.0.0.1:${valorObrigatorio(lerAmbienteDeTeste(), 'MAILPIT_PORTA_HOST')}`
  const busca = (await (await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${para}`)}`)).json()) as { messages: { ID: string }[] }
  const primeira = busca.messages[0]
  if (primeira === undefined) return undefined
  const mensagem = (await (await fetch(`${base}/api/v1/message/${primeira.ID}`)).json()) as { Text: string }
  return mensagem.Text
}

/** O endereço do link do e-mail, só o caminho e o fragmento: a web do teste é a do `baseURL`. */
async function linkDoEmail(email: string): Promise<string> {
  await expect.poll(async () => (await textoDoMailpit(email)) !== undefined, { timeout: SIGN_IN_TIMEOUT_MS }).toBe(true)
  const link = new URL(/https?:\/\/\S+\/redefinir#[A-Za-z0-9_-]{43}/.exec((await textoDoMailpit(email)) ?? '')?.[0] ?? '')
  return `${link.pathname}${link.hash}`
}

/**
 * O pedido do link e a troca da senha pela API, sem tela: prepara o estado de quem já trocou a senha pelo link. Devolve o link do
 * e-mail, já usado.
 */
async function trocarPelaApi(request: APIRequestContext, equipe: EquipeDeTeste): Promise<string> {
  const pedido = await request.post('/v1/senha/esqueci', { data: { email: equipe.email } })
  expect(pedido.status()).toBe(202)
  const link = await linkDoEmail(equipe.email)
  const token = new URL(link, 'http://web.invalid').hash.slice(1)
  const troca = await request.post('/v1/senha/redefinir', { data: { token, senha: SENHA_NOVA } })
  expect(troca.status()).toBe(204)
  return link
}

const campoEmail = (page: Page) => page.getByLabel('E-mail')
const campoSenhaNova = (page: Page) => page.getByLabel('Senha nova')
const botaoEnviar = (page: Page) => page.getByRole('button', { name: /^(Enviar o link|Enviando…)$/ })
const botaoDefinir = (page: Page) => page.getByRole('button', { name: /^(Definir a senha|Salvando…)$/ })
const tentarDeNovo = (page: Page) => page.getByRole('button', { name: 'Tentar de novo' })
const endereco = (page: Page) => new URL(page.url())

/** O segundo envio do formulário que chega antes de o botão desligar: o Enter e o clique do teclado de tela não passam pelo botão desligado, e este sim. */
async function reenviarOFormulario(page: Page): Promise<void> {
  await page.evaluate(() => document.querySelector('form')?.requestSubmit())
}

/** A API fora do ar depois de a resposta ser liberada pela porta: o envio fica no ar, e o teste olha a tela nesse intervalo. */
async function derrubarDepoisDaPorta(page: Page, rota: string, porta: { aberta: Promise<void> }): Promise<void> {
  await page.unroute(rota)
  await page.route(rota, async (r) => {
    await porta.aberta
    await r.abort()
  })
}

/** A API que responde bem depois de a resposta ser liberada pela porta. */
async function responderDepoisDaPorta(page: Page, rota: string, porta: { aberta: Promise<void> }, status: number): Promise<void> {
  await page.unroute(rota)
  await page.route(rota, async (r) => {
    await porta.aberta
    await r.fulfill({ status })
  })
}

/** O alvo de toque mínimo de WCAG 2.5.8 para tudo o que não é a ação principal (regra 50, item 2a). */
const ALVO_MINIMO_PX = 24

/** O alvo tem a largura e a altura mínimas. */
async function esperarAlvo(alvo: Locator, minimoPx: number, onde: string): Promise<void> {
  const caixa = await alvo.boundingBox()
  expect(caixa, onde).not.toBeNull()
  expect(caixa?.width ?? 0, onde).toBeGreaterThanOrEqual(minimoPx)
  expect(caixa?.height ?? 0, onde).toBeGreaterThanOrEqual(minimoPx)
}

/** Cola o link de novo na aba: muda só o `#`, como quem cola outro endereço na barra sem recarregar. */
async function colarOLink(page: Page, token: string): Promise<void> {
  await page.evaluate((fragmento) => {
    window.location.hash = fragmento
  }, `#${token}`)
}

/** Dois quadros de animação: as continuações das promessas e a renderização que a resposta atrasada poderia causar já correram. */
async function deixarAsContinuacoesCorrerem(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver()))))
}

test.describe('Esqueci a senha: o pedido do link', () => {
  test('a entrada da equipe leva ao "Esqueci"; a tela inicial pede o e-mail e manda o aluno ao professor', async ({ page, hasTouch }) => {
    await page.goto('/entrar')
    await activate(page.getByRole('link', { name: 'Esqueci a senha' }), hasTouch)
    await expect(page).toHaveURL(/\/esqueci$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Esqueci a senha' })).toBeVisible()
    await expect(campoEmail(page)).toBeVisible()
    await expect(campoEmail(page)).toHaveAttribute('type', 'email')
    await expect(page.getByText(ALUNO)).toBeVisible()
    await expect(botaoEnviar(page)).toHaveText('Enviar o link')
    // A saída: de volta à entrada, sem enviar nada.
    await activate(page.getByRole('link', { name: 'Voltar para Entrar' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/)
  })

  test('a entrada do aluno, pelo endereço da escola, não leva "Esqueci a senha": o aluno não tem e-mail e pede a senha provisória ao professor', async ({ page }) => {
    const aluno = await criarAlunoComMatricula()
    await page.goto(`/e/${aluno.slug}`)
    // Espera a tela montar (o nome da escola e o campo da matrícula) antes de provar que o link não existe.
    await expect(page.getByRole('heading', { name: aluno.escolaNome })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByLabel('Matrícula')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Esqueci a senha' })).toHaveCount(0)
  })

  test('enviado: a mesma frase para quem tem conta e para quem não tem, sem repetir o e-mail', async ({ page, hasTouch }) => {
    // A API responde 202 igual nos dois casos (5.0); aqui só a tela. A resposta é simulada porque o balde de 10 pedidos por minuto do
    // IP, que a escola inteira compartilha, responde 202 sem mandar e-mail, e os casos que precisam do e-mail de verdade gastam o balde.
    await page.route(ROTA_ESQUECI, (rota) => rota.fulfill({ status: 202 }))
    for (const email of ['com-conta@educa.invalid', 'sem-conta@educa.invalid']) {
      await page.goto('/esqueci')
      await campoEmail(page).fill(email)
      await activate(botaoEnviar(page), hasTouch)
      const confirmacao = page.getByRole('status').filter({ hasText: CONFIRMACAO })
      await expect(confirmacao).toHaveText(CONFIRMACAO)
      // O formulário saiu, o foco foi para a frase (quem usa leitor de tela a ouve) e o e-mail digitado não volta à tela.
      await expect(confirmacao).toBeFocused()
      await expect(campoEmail(page)).toHaveCount(0)
      await expect(page.getByText(email)).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Voltar para Entrar' })).toBeVisible()
    }
  })

  test('botão ocupado: "Enviando…" desligado enquanto a API não responde, e uma resposta só', async ({ page, hasTouch }) => {
    const porta = gate()
    let pedidos = 0
    await page.route(ROTA_ESQUECI, async (rota) => {
      pedidos++
      await porta.aberta
      await rota.fulfill({ status: 202 })
    })
    await page.goto('/esqueci')
    await campoEmail(page).fill('equipe@educa.invalid')
    await activate(botaoEnviar(page), hasTouch)
    await expect(botaoEnviar(page)).toHaveText('Enviando…')
    await expect(botaoEnviar(page)).toBeDisabled()
    // O leitor de tela ouve o mesmo que a tela mostra.
    await expect(page.getByRole('status')).toHaveText('Enviando…')
    // Um segundo envio do formulário durante o envio (o clique duplo que chega antes de o botão desligar) não manda outro pedido.
    await reenviarOFormulario(page)
    porta.abrir()
    await expect(page.getByRole('status').filter({ hasText: CONFIRMACAO })).toBeVisible()
    expect(pedidos).toBe(1)
  })

  test('rede: o aviso diz o que fazer e o e-mail fica; o envio comum o tira na hora, e "Tentar de novo" o mantém até a resposta', async ({ page, hasTouch }) => {
    await page.route(ROTA_ESQUECI, derrubar)
    await page.goto('/esqueci')
    await campoEmail(page).fill('equipe@educa.invalid')
    await activate(botaoEnviar(page), hasTouch)
    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    await expect(campoEmail(page)).toHaveValue('equipe@educa.invalid')
    await expect(botaoEnviar(page)).toBeEnabled()

    // O envio pelo botão do formulário: o aviso anterior sai na hora, e volta se a rede continua fora.
    const porta = gate()
    await derrubarDepoisDaPorta(page, ROTA_ESQUECI, porta)
    await activate(botaoEnviar(page), hasTouch)
    await expect(botaoEnviar(page)).toHaveText('Enviando…')
    await expect(page.getByRole('alert')).toHaveCount(0)
    porta.abrir()
    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)

    // O "Tentar de novo": o aviso e o botão ficam até a resposta, e o foco não sai da tela com eles.
    const outra = gate()
    await responderDepoisDaPorta(page, ROTA_ESQUECI, outra, 202)
    await activate(tentarDeNovo(page), hasTouch)
    await expect(page.getByText('Tentando de novo…')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    outra.abrir()
    await expect(page.getByRole('status').filter({ hasText: CONFIRMACAO })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})

// Quatro casos deste bloco pedem um link de verdade (o pedido pela tela, e a troca pela API nos três outros), nos dois projetos: são 8
// pedidos por execução do arquivo contra o balde `rl:ip:senha`, de 10 por minuto, do IP que o compose de teste compartilha. Rodar o arquivo
// duas vezes no mesmo minuto, com `--manter-ambiente`, recebe 202 sem e-mail, e o `linkDoEmail` estoura o prazo. Os demais casos
// simulam a resposta (`page.route`) justamente para não gastar o balde.
test.describe('Redefinir: a senha nova pelo link do e-mail', () => {
  test('esqueci → e-mail: o pedido pela tela faz chegar o link da redefinição', async ({ page, hasTouch }) => {
    const equipe = await criarEquipeComSenha('professor')
    await page.goto('/entrar')
    await activate(page.getByRole('link', { name: 'Esqueci a senha' }), hasTouch)
    await campoEmail(page).fill(equipe.email)
    await activate(botaoEnviar(page), hasTouch)
    await expect(page.getByRole('status').filter({ hasText: CONFIRMACAO })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(await linkDoEmail(equipe.email)).toMatch(/^\/redefinir#[A-Za-z0-9_-]{43}$/)
  })

  test('esqueci → e-mail → senha nova: volta à entrada com o aviso, sem login automático e sem sessão aberta', async ({ page, request, hasTouch }) => {
    const equipe = await criarEquipeComSenha('professor')
    // O pedido do link pela API: a tela do pedido é a prova do caso de cima, e juntar as duas passa do prazo do e2e.
    const pedido = await request.post('/v1/senha/esqueci', { data: { email: equipe.email } })
    expect(pedido.status()).toBe(202)
    const link = await linkDoEmail(equipe.email)

    await page.goto(link)
    await expect(campoSenhaNova(page)).toBeFocused({ timeout: SIGN_IN_TIMEOUT_MS })
    // O token sai da barra antes de qualquer chamada (regra 20, item 8).
    expect(endereco(page).hash).toBe('')
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await activate(botaoDefinir(page), hasTouch)

    // Sem login automático: a entrada, com o aviso, e nenhuma área aberta.
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('alert')).toHaveText(SENHA_TROCADA)
    // Sem sessão aberta, de verdade (a entrada nunca tem "Sair", e olhar por ele passaria com sessão): a área do professor, aberta
    // pelo endereço, devolve à entrada, porque não há sessão a renovar.
    await page.goto('/professor/turmas')
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('depois de trocada pelo link, a senha nova entra', async ({ page, request, hasTouch }) => {
    const equipe = await criarEquipeComSenha('professor')
    await trocarPelaApi(request, equipe)
    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(equipe.email)
    await page.getByLabel('Senha', { exact: true }).fill(SENHA_NOVA)
    await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    // Entrou com a senha nova: a área do papel abriu (a casca inteira carregar é prova de outra tela, e custa segundos de CPU ×4).
    await expect(page).toHaveURL(/\/professor\//, { timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('o mesmo link, aberto de novo depois de usado, não vale: a tela só descobre quando a senha chega', async ({ page, request, hasTouch }) => {
    const equipe = await criarEquipeComSenha('professor')
    const link = await trocarPelaApi(request, equipe)
    await page.goto(link)
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await activate(botaoDefinir(page), hasTouch)
    await expect(page.getByRole('alert')).toHaveText(LINK_QUE_NAO_VALE, { timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('tela inicial: a regra à vista, "Mostrar a senha" e o preenchimento de senha nova do navegador', async ({ page, hasTouch }) => {
    await page.goto(`/redefinir#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Redefinir a senha' })).toBeVisible()
    await expect(page.getByText(REGRA)).toBeVisible()
    await expect(campoSenhaNova(page)).toHaveAttribute('autocomplete', 'new-password')
    await expect(campoSenhaNova(page)).toHaveAttribute('type', 'password')
    const mostrar = page.getByRole('button', { name: 'Mostrar a senha' })
    await activate(mostrar, hasTouch)
    await expect(campoSenhaNova(page)).toHaveAttribute('type', 'text')
    await expect(mostrar).toHaveAttribute('aria-pressed', 'true')
    await activate(mostrar, hasTouch)
    await expect(campoSenhaNova(page)).toHaveAttribute('type', 'password')
  })

  test('link vencido, usado ou inventado: o mesmo aviso, com a saída para pedir outro; sem token nem se tenta', async ({ page, hasTouch }) => {
    await page.goto(`/redefinir#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await activate(botaoDefinir(page), hasTouch)
    await expect(page.getByRole('alert')).toHaveText(LINK_QUE_NAO_VALE, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoSenhaNova(page)).toHaveCount(0)
    await activate(page.getByRole('link', { name: 'Esqueci a senha' }), hasTouch)
    await expect(page).toHaveURL(/\/esqueci$/)

    // Endereço sem o fragmento (o link colado pela metade): o aviso vem na hora, sem formulário.
    await page.goto('/redefinir')
    await expect(page.getByRole('alert')).toHaveText(LINK_QUE_NAO_VALE)
    await expect(campoSenhaNova(page)).toHaveCount(0)
  })

  test('senha recusada: a regra aparece no campo, o foco volta a ele e o link continua na tela', async ({ page, hasTouch }) => {
    await page.goto(`/redefinir#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await campoSenhaNova(page).fill('curta')
    await activate(botaoDefinir(page), hasTouch)
    await expect(page.getByText(SENHA_RECUSADA)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoSenhaNova(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(campoSenhaNova(page)).toBeFocused()
    // O aviso sai quando a pessoa volta a digitar.
    await campoSenhaNova(page).fill('curta-demais')
    await expect(page.getByText(SENHA_RECUSADA)).toHaveCount(0)
  })

  test('botão ocupado: "Salvando…" desligado enquanto a API não responde, e uma resposta só', async ({ page, hasTouch }) => {
    const porta = gate()
    let pedidos = 0
    await page.route(ROTA_REDEFINIR, async (rota) => {
      pedidos++
      await porta.aberta
      await rota.fulfill({ status: 204 })
    })
    await page.goto(`/redefinir#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await activate(botaoDefinir(page), hasTouch)
    await expect(botaoDefinir(page)).toHaveText('Salvando…')
    await expect(botaoDefinir(page)).toBeDisabled()
    await expect(page.getByRole('status')).toHaveText('Salvando…')
    await reenviarOFormulario(page)
    porta.abrir()
    await expect(page).toHaveURL(/\/entrar$/)
    await expect(page.getByRole('alert')).toHaveText(SENHA_TROCADA)
    expect(pedidos).toBe(1)
  })

  test('rede: o aviso diz o que fazer e a senha fica; o envio comum o tira na hora, e "Tentar de novo" o mantém até a resposta', async ({ page, hasTouch }) => {
    await page.route(ROTA_REDEFINIR, derrubar)
    await page.goto(`/redefinir#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await activate(botaoDefinir(page), hasTouch)
    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    await expect(campoSenhaNova(page)).toHaveValue(SENHA_NOVA)
    await expect(botaoDefinir(page)).toBeEnabled()

    // O envio pelo botão do formulário: o aviso anterior sai na hora, e volta se a rede continua fora.
    const porta = gate()
    await derrubarDepoisDaPorta(page, ROTA_REDEFINIR, porta)
    await activate(botaoDefinir(page), hasTouch)
    await expect(botaoDefinir(page)).toHaveText('Salvando…')
    await expect(page.getByRole('alert')).toHaveCount(0)
    porta.abrir()
    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)

    // O "Tentar de novo": o aviso e o botão ficam até a resposta, e o foco não sai da tela com eles.
    const outra = gate()
    await responderDepoisDaPorta(page, ROTA_REDEFINIR, outra, 204)
    await activate(tentarDeNovo(page), hasTouch)
    await expect(page.getByText('Tentando de novo…')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    outra.abrir()
    await expect(page).toHaveURL(/\/entrar$/)
    await expect(page.getByRole('alert')).toHaveText(SENHA_TROCADA)
  })
})

test.describe('Redefinir: o recomeço da tela', () => {
  test('o mesmo link colado de novo: o estado volta ao início, o token fora da barra e o foco no campo', async ({ page }) => {
    await page.goto(`/redefinir#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await expect(campoSenhaNova(page)).toBeFocused()
    expect(endereco(page).hash).toBe('')
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await page.getByRole('button', { name: 'Mostrar a senha' }).focus()

    await colarOLink(page, TOKEN_QUE_NUNCA_EXISTIU)
    await expect(campoSenhaNova(page)).toHaveValue('')
    await expect(campoSenhaNova(page)).toBeFocused()
    // O token saiu da barra outra vez, sem recarregar a página.
    await expect.poll(() => endereco(page).hash).toBe('')
  })

  test('falha de rede: o aviso e o botão "Tentar de novo" saem na nova tentativa, que recomeça com o campo vazio e o foco nele', async ({ page, hasTouch }) => {
    await page.route(ROTA_REDEFINIR, derrubar)
    await page.goto(`/redefinir#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await activate(botaoDefinir(page), hasTouch)
    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    await tentarDeNovo(page).focus()

    await colarOLink(page, TOKEN_QUE_NUNCA_EXISTIU)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(tentarDeNovo(page)).toHaveCount(0)
    await expect(campoSenhaNova(page)).toHaveValue('')
    await expect(campoSenhaNova(page)).toBeFocused()
  })

  test('resposta atrasada: o envio do link anterior que responde depois de outro link chegar não troca a tela do link novo', async ({ page, hasTouch }) => {
    const porta = gate()
    const tokensEnviados: string[] = []
    await page.route(ROTA_REDEFINIR, async (rota) => {
      tokensEnviados.push((rota.request().postDataJSON() as { token: string }).token)
      await porta.aberta
      await rota.fulfill({ status: 204 })
    })
    await page.goto(`/redefinir#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await activate(botaoDefinir(page), hasTouch)
    await expect(botaoDefinir(page)).toHaveText('Salvando…')

    // Outro link chega à aba com o envio no ar: a tela recomeça, com o botão livre para o link novo.
    await colarOLink(page, TOKEN_B)
    await expect(botaoDefinir(page)).toHaveText('Definir a senha')
    await expect(botaoDefinir(page)).toBeEnabled()
    const respondida = page.waitForResponse(ROTA_REDEFINIR)
    porta.abrir()
    await respondida
    await deixarAsContinuacoesCorrerem(page)

    // A resposta do link anterior é descartada: a tela segue no link novo, sem navegar e sem o aviso da entrada.
    await expect(page).toHaveURL(/\/redefinir$/)
    await expect(campoSenhaNova(page)).toHaveValue('')
    await expect(botaoDefinir(page)).toBeEnabled()
    await expect(page.getByRole('alert')).toHaveCount(0)

    // O link novo é o que vale daqui em diante: o envio seguinte leva o token dele, e é ele que volta à entrada.
    await campoSenhaNova(page).fill(SENHA_NOVA)
    await activate(botaoDefinir(page), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/)
    expect(tokensEnviados).toEqual([TOKEN_QUE_NUNCA_EXISTIU, TOKEN_B])
  })
})

/** As telas novas e a alterada, com a ação principal e o resto dos alvos de toque de cada uma. */
const TELAS_A_360_PX = [
  {
    nome: 'Entrar, com o link "Esqueci a senha"',
    endereco: '/entrar',
    principal: (page: Page) => page.getByRole('button', { name: /^Entrar$/ }),
    outros: (page: Page) => [page.getByRole('link', { name: 'Esqueci a senha' })],
  },
  {
    nome: 'Esqueci a senha',
    endereco: '/esqueci',
    principal: botaoEnviar,
    outros: (page: Page) => [page.getByRole('link', { name: 'Voltar para Entrar' })],
  },
  {
    nome: 'Redefinir',
    endereco: `/redefinir#${TOKEN_QUE_NUNCA_EXISTIU}`,
    principal: botaoDefinir,
    outros: (page: Page) => [page.getByRole('button', { name: 'Mostrar a senha' })],
  },
]

test.describe('Esqueci e Redefinir: 360 px', () => {
  for (const tela of TELAS_A_360_PX) {
    test(`${tela.nome}: sem rolagem horizontal, sem violação grave de acessibilidade, ação principal de 44 px e o resto de 24 px`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 })
      await page.goto(tela.endereco)
      await expect(tela.principal(page)).toBeVisible()
      expect(await horizontalOverflow(page)).toBe(0)
      expect(await seriousViolations(page)).toEqual([])
      await esperarAlvo(tela.principal(page), ALVO_DE_TOQUE_PRINCIPAL_PX, `${tela.nome} principal`)
      for (const outro of tela.outros(page)) await esperarAlvo(outro, ALVO_MINIMO_PX, tela.nome)
    })
  }

  test('o aviso do link que não vale, sem fragmento', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/redefinir')
    await expect(page.getByRole('alert')).toHaveText(LINK_QUE_NAO_VALE)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await esperarAlvo(page.getByRole('link', { name: 'Esqueci a senha' }), ALVO_MINIMO_PX, 'link do aviso')
  })
})
