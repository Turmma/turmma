import type { Locator, Page, Route } from '@playwright/test'
import { AVISO_DO_CONVITE_PARA_CONTA_EXISTENTE, MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { lerAmbienteDeTeste, valorObrigatorio } from '../tools/ci/compose.ts'
import { SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'
import { expect, test } from './support/profiles.ts'
import { criarConviteDeProfessor, criarEquipeComSenha, desfazerAPosseDoEmail, type ConviteDeProfessorDeTeste, type EquipeDeTeste } from './support/seed.ts'

/**
 * "Verificar" e o aviso do aceite com `VERIFICACAO_PENDENTE` (acesso-e-convites, tarefa 8.0; RF12 e RF18; `cenarios.md`, "Telas", linhas
 * Verificar e Aceite com `VERIFICACAO_PENDENTE`, e "E2E (RF18)"): quem tem senha, trabalha em outra escola e ainda não provou o e-mail aceita
 * um convite copiado de uma escola nova, lê no aceite que o link foi ao e-mail, abre o link, vê "E-mail confirmado" e volta ao convite.
 * Pela tela, nos projetos `chromebook` e `celular`, com o worker e o Mailpit do compose de teste. Os textos esperados estão aqui por extenso.
 *
 * "Recomeço: a 2ª pessoa" não se aplica: a tela é anônima, sem sessão, e não guarda nada de quem passou antes.
 */

const PENDENTE = 'Mandamos um link para o seu e-mail. Abra-o e volte a este convite. Pode levar alguns minutos; se não chegar, abra o convite de novo para outro link.'
const CONFIRMADO = 'E-mail confirmado'
const CONFIRMANDO = 'Confirmando…'
const LINK_QUE_NAO_VALE = 'Este link não vale mais. Peça outro link abrindo o convite de novo.'
/** Um token com o formato do link (43 caracteres) que a API nunca emitiu. */
const TOKEN_QUE_NUNCA_EXISTIU = 'A'.repeat(43)
const TOKEN_B = 'B'.repeat(43)
const ROTA_VERIFICAR = '**/v1/conta/verificar'
const ROTA_ACEITAR = '**/v1/convites/aceitar'
const NAO_ENCONTRADO = JSON.stringify({ erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
const VERIFICACAO_PENDENTE = JSON.stringify({ erro: { codigo: 'VERIFICACAO_PENDENTE', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
/** O alvo de toque mínimo de WCAG 2.5.8 para tudo o que não é a ação principal (regra 50, item 2a). */
const ALVO_MINIMO_PX = 24

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

/** O que a API responde ao link: valeu (204), não vale mais (404, igual para vencido, usado e inventado), ou a rede caiu. */
type Resposta = 'vale' | 'nao_vale' | 'cai'

async function responder(rota: Route, resposta: Resposta): Promise<void> {
  if (resposta === 'cai') await rota.abort()
  else if (resposta === 'nao_vale') await rota.fulfill({ status: 404, contentType: 'application/json', body: NAO_ENCONTRADO })
  else await rota.fulfill({ status: 204 })
}

/** O Mailpit do compose de teste: o texto da mensagem que o worker entregou a um endereço, ou `undefined` se ela não chegou. */
async function textoDoMailpit(para: string): Promise<string | undefined> {
  const base = `http://127.0.0.1:${valorObrigatorio(lerAmbienteDeTeste(), 'MAILPIT_PORTA_HOST')}`
  const busca = (await (await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${para}`)}`)).json()) as { messages: { ID: string }[] }
  const primeira = busca.messages[0]
  if (primeira === undefined) return undefined
  const mensagem = (await (await fetch(`${base}/api/v1/message/${primeira.ID}`)).json()) as { Text: string }
  return mensagem.Text
}

/** O endereço do link de verificar do e-mail, só o caminho e o fragmento: a web do teste é a do `baseURL`. */
async function linkDoEmail(email: string): Promise<string> {
  await expect.poll(async () => (await textoDoMailpit(email)) !== undefined, { timeout: SIGN_IN_TIMEOUT_MS }).toBe(true)
  const link = new URL(/https?:\/\/\S+\/verificar#[A-Za-z0-9_-]{43}/.exec((await textoDoMailpit(email)) ?? '')?.[0] ?? '')
  return `${link.pathname}${link.hash}`
}

/**
 * A pessoa do caso: tem senha, trabalha numa escola e ainda não provou o e-mail, e recebe um convite **copiado** de outra escola. O
 * aceite dele é o que devolve `VERIFICACAO_PENDENTE`.
 */
async function pessoaComConviteDeOutraEscola(): Promise<{ equipe: EquipeDeTeste; convite: ConviteDeProfessorDeTeste }> {
  const equipe = await criarEquipeComSenha('professor')
  await desfazerAPosseDoEmail(equipe.contaId)
  const convite = await criarConviteDeProfessor({ conta: equipe })
  return { equipe, convite }
}

const status = (page: Page) => page.getByRole('status')
const confirmado = (page: Page) => page.getByRole('status').filter({ hasText: CONFIRMADO })
const tentarDeNovo = (page: Page) => page.getByRole('button', { name: 'Tentar de novo' })
const continuar = (page: Page) => page.getByRole('link', { name: 'Continuar' })
const endereco = (page: Page) => new URL(page.url())

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

/**
 * A cor de um token da paleta (`--color-<nome>`) como o navegador a devolve, lida da própria página por uma sonda: é o que a borda do aviso
 * tem de igualar. O ajudante de `support/checks.ts` faz o mesmo, mas o nome dele está nas exceções do mapa de renomeação da onda 10, por arquivo,
 * e um spec novo que o importa vira "resto" (`tools/renomear/restos.test.ts`).
 */
function corDaPaleta(page: Page, token: string): Promise<string> {
  return page.evaluate((nome) => {
    const sonda = document.createElement('span')
    sonda.style.color = `var(--color-${nome})`
    document.body.append(sonda)
    const cor = getComputedStyle(sonda).color
    sonda.remove()
    return cor
  }, token)
}

/** O alvo tem a largura e a altura mínimas. */
async function esperarAlvo(alvo: Locator, minimoPx: number, onde: string): Promise<void> {
  const caixa = await alvo.boundingBox()
  expect(caixa, onde).not.toBeNull()
  expect(caixa?.width ?? 0, onde).toBeGreaterThanOrEqual(minimoPx)
  expect(caixa?.height ?? 0, onde).toBeGreaterThanOrEqual(minimoPx)
}

// Três casos pedem o e-mail de verdade (o aceite pela tela, e pela API nos outros dois): o Mailpit é um só no compose de teste, e cada
// pessoa tem o próprio endereço, então nenhum caso lê o e-mail do outro.
test.describe('Verificar: do aceite ao e-mail confirmado', () => {
  test('aceite de convite copiado por quem não provou o e-mail: o aviso é o pendente, e não o vermelho de erro; o convite não é gasto e o link chega ao Mailpit', async ({ page, hasTouch }) => {
    test.slow()
    const { equipe, convite } = await pessoaComConviteDeOutraEscola()
    await page.goto(`/convite#${convite.token}`)
    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: SIGN_IN_TIMEOUT_MS })
    await activate(page.getByRole('button', { name: /^(Aceitar o convite|Aceitando…)$/ }), hasTouch)

    const aviso = page.getByRole('alert')
    await expect(aviso).toHaveText(PENDENTE, { timeout: SIGN_IN_TIMEOUT_MS })
    // Não é erro de ninguém: a borda é a do aviso `pendente` da tela do convite que não vale, e não a vermelha da falha.
    await expect(aviso).toHaveCSS('border-top-color', await corDaPaleta(page, 'pendente'))
    // O convite não foi gasto: a tela segue no aceite, com o botão livre para depois de verificar.
    await expect(page).toHaveURL(/\/convite$/)
    await expect(page.getByRole('button', { name: 'Aceitar o convite' })).toBeEnabled()
    expect(await linkDoEmail(equipe.email)).toMatch(/^\/verificar#[A-Za-z0-9_-]{43}$/)
  })

  test('verificar pelo Mailpit: "E-mail confirmado", o token fora da barra, "Continuar" leva ao convite e o aceite segue', async ({ page, request, hasTouch }) => {
    test.slow()
    const { equipe, convite } = await pessoaComConviteDeOutraEscola()
    // O aceite pela API: o aviso na tela é o caso de cima, e juntar os dois passa do prazo do e2e.
    const aceite = await request.post('/v1/convites/aceitar', { data: { token: convite.token } })
    expect(aceite.status()).toBe(409)
    const link = await linkDoEmail(equipe.email)

    await page.goto(link)
    await expect(confirmado(page)).toHaveText(CONFIRMADO, { timeout: SIGN_IN_TIMEOUT_MS })
    // O leitor de tela diz o resultado, e o foco não fica no "Confirmando…" que saiu; o token saiu da barra antes de qualquer chamada.
    await expect(confirmado(page)).toBeFocused()
    expect(endereco(page).hash).toBe('')
    await activate(continuar(page), hasTouch)
    await expect(page).toHaveURL(/\/convite$/)

    // Verificada, o mesmo convite vale: o aceite leva à entrada, com o aviso de quem já tem conta.
    await page.goto(`/convite#${convite.token}`)
    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: SIGN_IN_TIMEOUT_MS })
    await activate(page.getByRole('button', { name: /^(Aceitar o convite|Aceitando…)$/ }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('alert')).toHaveText(AVISO_DO_CONVITE_PARA_CONTA_EXISTENTE)
  })

  test('link usado: o mesmo link aberto depois de confirmar o e-mail não vale, com a saída para abrir o convite de novo', async ({ page, request, hasTouch }) => {
    test.slow()
    const { equipe, convite } = await pessoaComConviteDeOutraEscola()
    const aceite = await request.post('/v1/convites/aceitar', { data: { token: convite.token } })
    expect(aceite.status()).toBe(409)
    const link = await linkDoEmail(equipe.email)
    const verificacao = await request.post('/v1/conta/verificar', { data: { token: new URL(link, 'http://web.invalid').hash.slice(1) } })
    expect(verificacao.status()).toBe(204)

    await page.goto(link)
    await expect(page.getByRole('alert')).toHaveText(LINK_QUE_NAO_VALE, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(confirmado(page)).toHaveCount(0)
    await activate(page.getByRole('link', { name: 'Abrir o convite' }), hasTouch)
    await expect(page).toHaveURL(/\/convite$/)
  })
})

test.describe('Verificar: os estados da tela', () => {
  test('carregando: "Confirmando…" enquanto a API não responde, um pedido só, e depois "E-mail confirmado"', async ({ page }) => {
    const porta = gate()
    let pedidos = 0
    await page.route(ROTA_VERIFICAR, async (rota) => {
      pedidos++
      await porta.aberta
      await rota.fulfill({ status: 204 })
    })
    await page.goto(`/verificar#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await expect(status(page)).toHaveText(CONFIRMANDO)
    expect(endereco(page).hash).toBe('')
    porta.abrir()
    await expect(confirmado(page)).toHaveText(CONFIRMADO)
    await expect(status(page).filter({ hasText: CONFIRMANDO })).toHaveCount(0)
    expect(pedidos).toBe(1)
  })

  test('link vencido, usado ou inventado: o mesmo aviso, com a saída para abrir o convite; sem token nem se tenta', async ({ page, hasTouch }) => {
    await page.goto(`/verificar#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await expect(page.getByRole('alert')).toHaveText(LINK_QUE_NAO_VALE, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(confirmado(page)).toHaveCount(0)
    await activate(page.getByRole('link', { name: 'Abrir o convite' }), hasTouch)
    await expect(page).toHaveURL(/\/convite$/)

    // Endereço sem o fragmento (o link colado pela metade): o aviso vem na hora, sem pedido.
    let pedidos = 0
    await page.route(ROTA_VERIFICAR, async (rota) => {
      pedidos++
      await rota.fulfill({ status: 204 })
    })
    await page.goto('/verificar')
    await expect(page.getByRole('alert')).toHaveText(LINK_QUE_NAO_VALE)
    await expect(confirmado(page)).toHaveCount(0)
    expect(pedidos).toBe(0)
  })

  test('rede: o aviso diz o que fazer; "Tentar de novo" mantém o token na memória da tela e confirma quando a rede volta', async ({ page, hasTouch }) => {
    let resposta: Resposta = 'cai'
    const porta = gate()
    await page.route(ROTA_VERIFICAR, async (rota) => {
      if (resposta === 'vale') await porta.aberta
      await responder(rota, resposta)
    })
    await page.goto(`/verificar#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    // O token já saiu da barra: recarregar o perderia, e é o botão que repete o pedido.
    expect(endereco(page).hash).toBe('')
    resposta = 'vale'
    await activate(tentarDeNovo(page), hasTouch)
    await expect(status(page)).toHaveText(CONFIRMANDO)
    porta.abrir()
    await expect(confirmado(page)).toHaveText(CONFIRMADO)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})

test.describe('Verificar: o aviso do aceite e o link sem token', () => {
  test('aceite com outra falha: o aviso segue no vermelho de erro, e só a verificação pendente usa o aviso pendente', async ({ page, hasTouch }) => {
    const convite = await criarConviteDeProfessor()
    await page.route(ROTA_ACEITAR, (rota) => rota.abort())
    await page.goto(`/convite#${convite.token}`)
    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: SIGN_IN_TIMEOUT_MS })
    await activate(page.getByRole('button', { name: 'Aceitar o convite' }), hasTouch)
    const aviso = page.getByRole('alert')
    await expect(aviso).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    await expect(aviso).toHaveCSS('border-top-color', await corDaPaleta(page, 'erro'))
  })

  test('link colado sem token: o fragmento quebrado mostra o aviso do link que não vale, mesmo depois de uma falha de rede', async ({ page }) => {
    await page.route(ROTA_VERIFICAR, (rota) => rota.abort())
    await page.goto(`/verificar#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)

    // O `%` solto é o link colado pela metade: não é token nenhum, e o "Tentar de novo" do link anterior sai com ele.
    await colarOLink(page, '%')
    await expect(page.getByRole('alert')).toHaveText(LINK_QUE_NAO_VALE)
    await expect(tentarDeNovo(page)).toHaveCount(0)
  })
})

test.describe('Verificar: o recomeço da tela', () => {
  test('o mesmo link colado de novo: depois de uma falha recomeça e o token sai da barra; depois de confirmar não manda outro pedido', async ({ page }) => {
    let respostas: Resposta[] = ['nao_vale', 'vale']
    let pedidos = 0
    await page.route(ROTA_VERIFICAR, async (rota) => {
      pedidos++
      await responder(rota, respostas.shift() ?? 'nao_vale')
    })
    await page.goto(`/verificar#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await expect(page.getByRole('alert')).toHaveText(LINK_QUE_NAO_VALE)
    expect(endereco(page).hash).toBe('')

    // O mesmo link de novo, depois de o primeiro não valer: a tela não fica presa no aviso, e o pedido é refeito.
    await colarOLink(page, TOKEN_QUE_NUNCA_EXISTIU)
    await expect(confirmado(page)).toHaveText(CONFIRMADO)
    await expect.poll(() => endereco(page).hash).toBe('')
    expect(pedidos).toBe(2)

    // O mesmo link de novo, depois de confirmado: o link é de uso único, e a tela segue confirmada, sem outro pedido.
    respostas = ['nao_vale']
    await colarOLink(page, TOKEN_QUE_NUNCA_EXISTIU)
    await expect.poll(() => endereco(page).hash).toBe('')
    await deixarAsContinuacoesCorrerem(page)
    expect(pedidos).toBe(2)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(confirmado(page)).toHaveText(CONFIRMADO)
  })

  test('resposta atrasada: o pedido do link anterior que responde depois de outro link chegar não troca o estado da tela do link novo', async ({ page }) => {
    const porta = gate()
    const tokensEnviados: string[] = []
    await page.route(ROTA_VERIFICAR, async (rota) => {
      const { token } = rota.request().postDataJSON() as { token: string }
      tokensEnviados.push(token)
      if (token === TOKEN_QUE_NUNCA_EXISTIU) await porta.aberta
      await responder(rota, token === TOKEN_QUE_NUNCA_EXISTIU ? 'vale' : 'nao_vale')
    })
    await page.goto(`/verificar#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await expect(status(page)).toHaveText(CONFIRMANDO)

    // Outro link chega à aba com o pedido no ar: a tela recomeça por ele, e o dele não vale.
    await colarOLink(page, TOKEN_B)
    await expect(page.getByRole('alert')).toHaveText(LINK_QUE_NAO_VALE)
    const respondida = page.waitForResponse(ROTA_VERIFICAR)
    porta.abrir()
    await respondida
    await deixarAsContinuacoesCorrerem(page)

    // A resposta do link anterior é descartada: a tela segue no aviso do link novo.
    await expect(confirmado(page)).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveText(LINK_QUE_NAO_VALE)
    expect(tokensEnviados).toEqual([TOKEN_QUE_NUNCA_EXISTIU, TOKEN_B])
  })

  test('falha de rede: o aviso e o "Tentar de novo" saem na nova tentativa, que recomeça pelo "Confirmando…"', async ({ page }) => {
    let resposta: Resposta = 'cai'
    const porta = gate()
    await page.route(ROTA_VERIFICAR, async (rota) => {
      if (resposta === 'vale') await porta.aberta
      await responder(rota, resposta)
    })
    await page.goto(`/verificar#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    await tentarDeNovo(page).focus()

    resposta = 'vale'
    await colarOLink(page, TOKEN_B)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(tentarDeNovo(page)).toHaveCount(0)
    await expect(status(page)).toHaveText(CONFIRMANDO)
    porta.abrir()
    await expect(confirmado(page)).toHaveText(CONFIRMADO)
  })
})

/** As telas novas e a alterada, com a ação principal e o resto dos alvos de toque de cada uma. */
test.describe('Verificar: 360 px', () => {
  test('E-mail confirmado: sem rolagem horizontal, sem violação grave de acessibilidade, "Continuar" de 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.route(ROTA_VERIFICAR, (rota) => rota.fulfill({ status: 204 }))
    await page.goto(`/verificar#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await expect(confirmado(page)).toBeVisible()
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await esperarAlvo(continuar(page), ALVO_DE_TOQUE_PRINCIPAL_PX, 'Continuar')
  })

  test('o link que não vale: sem rolagem horizontal, sem violação grave e a saída de 24 px ou mais', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/verificar')
    await expect(page.getByRole('alert')).toHaveText(LINK_QUE_NAO_VALE)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await esperarAlvo(page.getByRole('link', { name: 'Abrir o convite' }), ALVO_MINIMO_PX, 'Abrir o convite')
  })

  test('Confirmando…: sem rolagem horizontal e sem violação grave', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.route(ROTA_VERIFICAR, async () => new Promise<never>(() => undefined))
    await page.goto(`/verificar#${TOKEN_QUE_NUNCA_EXISTIU}`)
    await expect(status(page)).toHaveText(CONFIRMANDO)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('o aceite com o aviso de verificação pendente: sem rolagem horizontal, sem violação grave e o "Aceitar o convite" de 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    const convite = await criarConviteDeProfessor()
    await page.route(ROTA_ACEITAR, (rota) => rota.fulfill({ status: 409, contentType: 'application/json', body: VERIFICACAO_PENDENTE }))
    await page.goto(`/convite#${convite.token}`)
    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: SIGN_IN_TIMEOUT_MS })
    await page.getByRole('button', { name: 'Aceitar o convite' }).click()
    await expect(page.getByRole('alert')).toHaveText(PENDENTE)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await esperarAlvo(page.getByRole('button', { name: 'Aceitar o convite' }), ALVO_DE_TOQUE_PRINCIPAL_PX, 'Aceitar o convite')
  })
})
