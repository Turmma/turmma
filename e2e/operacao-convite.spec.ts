import type { Page, Response, Route } from '@playwright/test'
import { QUANTIDADE_DE_CODIGOS_DE_RECUPERACAO } from '../packages/shared/src/sessao/mfa.ts'
import { criarOperadorConvidado as criarConvidado, removerOperador, type EstadoDoConviteDeTeste, type OperadorConvidado } from './support/operacao.ts'
import { codigoDoAutenticador } from './support/seed.ts'
import { expect, test } from './support/profiles.ts'
import { esperarCasca as esperarCascaDaOperacao } from './support/operacao-screen.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, isFocusVisible, horizontalOverflow, seriousViolations } from './support/checks.ts'

/** O Chromebook com CPU ×4 e Fast 3G carrega o chunk da operação, e o servidor ainda faz o hash da senha. */
const SCREEN_TIMEOUT_MS = 20_000
const ROTA_CONSULTAR = '**/v1/operacao/convite/consultar'
const ROTA_ACEITAR = '**/v1/operacao/convite/aceitar'
const CAMINHO_DO_CONFIGURAR = '/v1/operacao/sessao/mfa/configurar'
/** Senha nova do operador: o mínimo do contrato é 12 caracteres, como no F1. */
const SENHA_NOVA = 'frase-sintetica-do-operador'

const TEXTO_DO_CONVITE_INVALIDO = 'Este convite não vale mais. Peça um novo à equipe.'
const TEXTO_DO_CONFIGURE_DE_NOVO =
  'O segundo fator foi configurado de novo em outra aba, e o código QR desta não vale mais. Entre com o e-mail e a senha para configurar outra vez.'
const TEXTO_DO_CONFIGURAR_SEM_DESAFIO = 'Para configurar o segundo fator, entre de novo com o seu e-mail e a sua senha.'

/** O que a configuração devolveu uma vez só, lido da resposta que a tela recebeu. */
interface Configurado {
  readonly uri: string
  readonly segredo: string
  readonly codigosRecuperacao: readonly string[]
}

/** Os operadores criados por este teste, apagados no fim dele, passe ou falhe: o compose é o mesmo da integração. */
const criados: string[] = []

async function criarOperadorConvidado(estado?: EstadoDoConviteDeTeste): Promise<OperadorConvidado> {
  const operador = await criarConvidado(estado)
  criados.push(operador.operadorId)
  return operador
}

test.afterEach(async () => {
  for (const operadorId of criados.splice(0)) await removerOperador(operadorId)
})

/** Toque no celular, clique no Chromebook: a mesma ação pela entrada que cada aparelho tem. */
async function activate(page: Page, nome: string | RegExp, hasTouch: boolean): Promise<void> {
  const alvo = page.getByRole('button', { name: nome })
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

const respostaDoConfigurar = (page: Page): Promise<Response> => page.waitForResponse((resposta) => new URL(resposta.url()).pathname === CAMINHO_DO_CONFIGURAR)

/** Abre o link do convite, cria a senha e chega ao configurar. Devolve o que a configuração entregou. */
async function aceitarConvite(page: Page, operador: OperadorConvidado, hasTouch: boolean): Promise<Configurado> {
  const configurar = respostaDoConfigurar(page)
  await page.goto(`/operacao/convite#${operador.token}`)
  await page.getByLabel('Senha nova').fill(SENHA_NOVA, { timeout: SCREEN_TIMEOUT_MS })
  await activate(page, /Criar a senha e continuar|Salvando/, hasTouch)
  await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
  const configurado = (await (await configurar).json()) as Configurado
  await expect(page.getByRole('main')).toContainText(configurado.segredo, { timeout: SCREEN_TIMEOUT_MS })
  return configurado
}

/** A entrada por e-mail e senha, que devolve a etapa de configurar enquanto o segundo fator não está ativo. */
async function entrarAteOConfigurar(page: Page, operador: OperadorConvidado, hasTouch: boolean): Promise<Configurado> {
  const configurar = respostaDoConfigurar(page)
  await page.getByLabel('E-mail').fill(operador.email, { timeout: SCREEN_TIMEOUT_MS })
  await page.getByLabel('Senha').fill(SENHA_NOVA)
  await activate(page, /^Entrar$/, hasTouch)
  await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
  const configurado = (await (await configurar).json()) as Configurado
  await expect(page.getByRole('main')).toContainText(configurado.segredo, { timeout: SCREEN_TIMEOUT_MS })
  return configurado
}

const campoDoCodigo = (page: Page) => page.getByLabel('3. Digite o código que o aplicativo mostra')

async function esperarCasca(page: Page, operador: OperadorConvidado): Promise<void> {
  await esperarCascaDaOperacao(page, operador)
  await expect(page.getByRole('navigation', { name: 'Operação' }).getByRole('link', { name: 'Escolas' })).toHaveAttribute('aria-current', 'page')
}

/** Nada do convite, da senha, do segredo nem dos códigos no armazenamento do navegador ou na barra. */
async function nadaSensivelNoNavegador(page: Page, sensiveis: readonly string[]): Promise<void> {
  const guardado = await page.evaluate(() => ({
    local: JSON.stringify(Object.entries(localStorage)),
    sessao: JSON.stringify(Object.entries(sessionStorage)),
    url: location.href,
  }))
  expect(guardado.local).toBe('[]')
  expect(guardado.sessao).toBe('[]')
  for (const sensivel of sensiveis) expect(guardado.url).not.toContain(sensivel)
}

test.describe('convite do operador Turmma e o segundo fator pela web', () => {
  test('E1: convite, senha, configurar (QR, chave, otpauth, códigos com "Copiar") e código, até a casca — com o token fora da barra antes da primeira chamada', async ({
    page,
    hasTouch,
  }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const operador = await criarOperadorConvidado()
    const enderecos: string[] = []
    page.on('request', (pedido) => enderecos.push(pedido.url()))

    // A consulta fica segurada: é a janela em que o token ainda estaria na barra se a tela o tivesse deixado lá.
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    let barraNaPrimeiraChamada = ''
    await page.route(ROTA_CONSULTAR, async (rota: Route) => {
      barraNaPrimeiraChamada = page.url()
      await segurada
      await rota.continue()
    })

    await page.goto(`/operacao/convite#${operador.token}`)
    await expect.poll(() => barraNaPrimeiraChamada, { timeout: SCREEN_TIMEOUT_MS }).not.toBe('')
    expect(barraNaPrimeiraChamada, 'o token precisa sair da barra antes de a primeira chamada sair').not.toContain(operador.token)
    expect(barraNaPrimeiraChamada).toMatch(/\/operacao\/convite$/)
    // Enquanto a consulta não volta, a tela diz o que está fazendo.
    await expect(page.getByRole('status').filter({ hasText: 'Conferindo o convite' })).toBeVisible()
    liberar()

    await expect(page.getByLabel('Senha nova')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page).toHaveTitle('Convite · Operação Turmma')
    await expect(page.getByRole('banner')).toContainText('Operação Turmma')
    await expect(page.getByLabel('Senha nova')).toHaveAttribute('autocomplete', 'new-password')
    await expect(page.getByLabel('Senha nova')).toHaveAttribute('minlength', '12')
    // Quem tem o link ainda não provou nada: a tela não mostra quem foi convidado.
    await expect(page.locator('body')).not.toContainText(operador.nome)
    await expect(page.locator('body')).not.toContainText(operador.email)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    const botaoCriar = page.getByRole('button', { name: /Criar a senha e continuar|Salvando/ })
    expect((await botaoCriar.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)

    const configurar = respostaDoConfigurar(page)
    await page.getByLabel('Senha nova').fill(SENHA_NOVA)
    await activate(page, /Criar a senha e continuar|Salvando/, hasTouch)
    await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page).toHaveURL(/\/operacao\/mfa\/configurar$/)
    await expect(page).toHaveTitle('Configurar o segundo fator · Operação Turmma')
    const respostaDaConfiguracao = await configurar
    // A resposta com o segredo e os códigos não fica em cache nenhum do navegador.
    expect(respostaDaConfiguracao.headers()['cache-control']).toContain('no-store')
    const configurado = (await respostaDaConfiguracao.json()) as Configurado
    expect(configurado.codigosRecuperacao).toHaveLength(QUANTIDADE_DE_CODIGOS_DE_RECUPERACAO)

    // O QR, a chave em texto (o caminho sem celular) e o link `otpauth://`, para configurar no próprio aparelho.
    const main = page.getByRole('main')
    await expect(main.getByRole('img', { name: 'Código QR com a chave do segundo fator' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(main).toContainText(configurado.segredo)
    await expect(main.getByRole('link', { name: 'Abrir no aplicativo autenticador deste aparelho' })).toHaveAttribute('href', configurado.uri)
    expect(configurado.uri).toMatch(/^otpauth:\/\/totp\//)
    await activate(page, 'Copiar a chave', hasTouch)
    await expect(page.getByRole('status').filter({ hasText: 'Chave copiada.' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(configurado.segredo)

    // Os códigos de recuperação, uma vez, num campo selecionável e com "Copiar" anunciado em região viva.
    const campoDosCodigos = page.getByRole('textbox', { name: 'Códigos de recuperação' })
    await expect(campoDosCodigos).toHaveValue(configurado.codigosRecuperacao.join('\n'))
    await expect(campoDosCodigos).toHaveAttribute('readonly', '')
    await expect(main).toContainText('não voltam')
    await activate(page, 'Copiar os códigos', hasTouch)
    await expect(page.getByRole('status').filter({ hasText: 'Códigos copiados.' })).toBeVisible()
    expect((await page.evaluate(() => navigator.clipboard.readText())).split('\n')).toEqual(configurado.codigosRecuperacao)

    await expect(campoDoCodigo(page)).toHaveAttribute('inputmode', 'numeric')
    await expect(campoDoCodigo(page)).toHaveAttribute('autocomplete', 'one-time-code')
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await nadaSensivelNoNavegador(page, [operador.token, SENHA_NOVA, configurado.segredo, ...configurado.codigosRecuperacao])
    const botaoAtivar = page.getByRole('button', { name: /Ativar e entrar|Ativando/ })
    expect((await botaoAtivar.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)

    await campoDoCodigo(page).fill(codigoDoAutenticador(configurado.segredo))
    await activate(page, /Ativar e entrar|Ativando/, hasTouch)
    await esperarCasca(page, operador)
    expect(await seriousViolations(page)).toEqual([])

    // Ao sair da tela, segredo e códigos saem junto: nada deles na casca, na barra, no navegador ou em chamada alguma.
    await expect(page.locator('body')).not.toContainText(configurado.segredo)
    for (const codigo of configurado.codigosRecuperacao) await expect(page.locator('body')).not.toContainText(codigo)
    await nadaSensivelNoNavegador(page, [operador.token, SENHA_NOVA, configurado.segredo, ...configurado.codigosRecuperacao])
    for (const endereco of enderecos) {
      expect(endereco, 'token do convite numa URL').not.toContain(operador.token)
      expect(endereco, 'segredo numa URL').not.toContain(configurado.segredo)
    }
  })

  test('convite usado, vencido, revogado e inexistente mostram a mesma tela, sem dizer qual', async ({ page }) => {
    const convites = await Promise.all((['usado', 'vencido', 'revogado'] as const).map((estado) => criarOperadorConvidado(estado)))
    const telas: string[] = []

    for (const token of [...convites.map((convite) => convite.token), 'token-que-nunca-existiu-no-e2e']) {
      await page.goto(`/operacao/convite#${token}`)
      await expect(page.getByRole('alert')).toHaveText(TEXTO_DO_CONVITE_INVALIDO, { timeout: SCREEN_TIMEOUT_MS })
      await expect(page.getByLabel('Senha nova')).toHaveCount(0)
      expect(page.url()).not.toContain(token)
      telas.push(await page.getByRole('main').innerText())
      for (const convite of convites) {
        await expect(page.locator('body')).not.toContainText(convite.nome)
        await expect(page.locator('body')).not.toContainText(convite.email)
      }
      expect(await horizontalOverflow(page)).toBe(0)
      expect(await seriousViolations(page)).toEqual([])
    }
    // As quatro telas são a mesma, letra por letra.
    expect(new Set(telas).size).toBe(1)
  })

  test('o mesmo link aberto de novo na aba recomeça a tela e tira o token da barra; um fragmento quebrado dá a tela do convite que não vale', async ({ page }) => {
    const operador = await criarOperadorConvidado()
    const consultas: string[] = []
    page.on('request', (pedido) => {
      if (new URL(pedido.url()).pathname === '/v1/operacao/convite/consultar') consultas.push(page.url())
    })

    await page.goto(`/operacao/convite#${operador.token}`)
    await page.getByLabel('Senha nova').fill(SENHA_NOVA, { timeout: SCREEN_TIMEOUT_MS })
    expect(consultas).toHaveLength(1)

    // O mesmo link de novo: só o `#` muda, sem recarregar. A tela consulta outra vez, e a senha digitada sai da memória.
    await page.goto(`/operacao/convite#${operador.token}`)
    await expect.poll(() => consultas.length, { timeout: SCREEN_TIMEOUT_MS }).toBe(2)
    await expect(page.getByLabel('Senha nova')).toHaveValue('', { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByLabel('Senha nova')).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Conferindo o convite' })).toHaveCount(0)
    expect(page.url()).not.toContain(operador.token)
    for (const barra of consultas) expect(barra, 'o token precisa sair da barra antes da consulta').not.toContain(operador.token)

    // Um fragmento que não é token (o link colado pela metade): a mesma tela do convite que não vale, com a barra limpa.
    await page.goto('/operacao/convite#%E0%A4%A')
    await expect(page.getByRole('alert')).toHaveText(TEXTO_DO_CONVITE_INVALIDO, { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByLabel('Senha nova')).toHaveCount(0)
    expect(page.url()).toMatch(/\/operacao\/convite$/)
    expect(consultas).toHaveLength(2)
    await expect(page.getByRole('link', { name: 'Entrar na operação' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('o aceite ainda no ar quando outro link chega à aba é descartado: a tela fica no link novo, que segue até o configurar', async ({ page, hasTouch }) => {
    const anterior = await criarOperadorConvidado()
    const novo = await criarOperadorConvidado()
    // Só o primeiro aceite fica segurado: é o que ainda está no ar quando o link novo chega.
    let aceites = 0
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_ACEITAR, async (rota: Route) => {
      aceites++
      if (aceites === 1) await segurada
      await rota.continue()
    })

    await page.goto(`/operacao/convite#${anterior.token}`)
    await page.getByLabel('Senha nova').fill(SENHA_NOVA, { timeout: SCREEN_TIMEOUT_MS })
    await activate(page, /Criar a senha e continuar|Salvando/, hasTouch)
    await expect.poll(() => aceites, { timeout: SCREEN_TIMEOUT_MS }).toBe(1)

    // O link novo muda só o `#`: a tela confere o convite dele e mostra o formulário vazio, com o aceite anterior no ar.
    await page.goto(`/operacao/convite#${novo.token}`)
    await expect(page.getByLabel('Senha nova')).toHaveValue('', { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('status').filter({ hasText: 'Conferindo o convite' })).toHaveCount(0, { timeout: SCREEN_TIMEOUT_MS })
    const respostaDoAnterior = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/operacao/convite/aceitar')
    liberar()
    // O aceite anterior valeu no servidor (200, com o desafio de configurar), e mesmo assim a tela não segue com ele.
    expect((await respostaDoAnterior).status()).toBe(200)
    const botao = page.getByRole('button', { name: 'Criar a senha e continuar' })
    await expect(botao).toBeEnabled({ timeout: SCREEN_TIMEOUT_MS })
    await expect(page).toHaveURL(/\/operacao\/convite$/)
    await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)

    // A tela é a do link novo, e segue: a senha dele leva ao configurar do segundo fator dele.
    const configurar = respostaDoConfigurar(page)
    await page.getByLabel('Senha nova').fill(SENHA_NOVA)
    await activate(page, 'Criar a senha e continuar', hasTouch)
    await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    expect(aceites).toBe(2)
    expect((await configurar).status()).toBe(200)
  })

  test('clique repetido em "Criar a senha e continuar" manda um aceite só', async ({ page, hasTouch }) => {
    const operador = await criarOperadorConvidado()
    let aceites = 0
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_ACEITAR, async (rota: Route) => {
      aceites++
      await segurada
      await rota.continue()
    })

    await page.goto(`/operacao/convite#${operador.token}`)
    await page.getByLabel('Senha nova').fill(SENHA_NOVA, { timeout: SCREEN_TIMEOUT_MS })
    const botao = page.getByRole('button', { name: /Criar a senha e continuar|Salvando/ })
    if (hasTouch) await botao.tap()
    else await botao.click()
    await expect(botao).toBeDisabled()
    await botao.dispatchEvent('click')
    await page.getByLabel('Senha nova').press('Enter')
    liberar()
    await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    expect(aceites).toBe(1)
  })

  test('recarregar o configurar pergunta antes, e depois não mostra os códigos de novo', async ({ page, hasTouch }) => {
    const operador = await criarOperadorConvidado()
    const configurado = await aceitarConvite(page, operador, hasTouch)

    // Os códigos estão na tela: o navegador pergunta antes de recarregar, porque eles não voltam.
    const perguntas: string[] = []
    page.on('dialog', (dialogo) => {
      perguntas.push(dialogo.type())
      void dialogo.accept()
    })
    await page.reload()
    expect(perguntas).toEqual(['beforeunload'])

    await expect(page.getByRole('alert')).toHaveText(TEXTO_DO_CONFIGURAR_SEM_DESAFIO, { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('link', { name: 'Ir para a entrada' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(configurado.segredo)
    for (const codigo of configurado.codigosRecuperacao) await expect(page.locator('body')).not.toContainText(codigo)
    await expect(page.getByRole('textbox', { name: 'Códigos de recuperação' })).toHaveCount(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('desafio de configurar recusado pela API volta à entrada, com o que fazer', async ({ page, hasTouch }) => {
    const operador = await criarOperadorConvidado()
    // O desafio venceu entre o aceite e a configuração (5 min): a API recusa, e a tela não mostra erro cru.
    await page.route(`**${CAMINHO_DO_CONFIGURAR}`, (rota: Route) =>
      rota.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'texto da API que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }),
      }),
    )
    await page.goto(`/operacao/convite#${operador.token}`)
    await page.getByLabel('Senha nova').fill(SENHA_NOVA, { timeout: SCREEN_TIMEOUT_MS })
    await activate(page, /Criar a senha e continuar|Salvando/, hasTouch)

    await expect(page).toHaveURL(/\/operacao\/entrar$/, { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('alert')).toHaveText(TEXTO_DO_CONFIGURAR_SEM_DESAFIO)
    await expect(page.locator('body')).not.toContainText('texto da API')
    expect(await seriousViolations(page)).toEqual([])
  })

  test('duas abas configurando: a vencida recebe "configure de novo", recomeça pela entrada, e o QR novo funciona', async ({ page, context, hasTouch }) => {
    const operador = await criarOperadorConvidado()
    const primeira = await aceitarConvite(page, operador, hasTouch)

    // Outra aba configura depois: o segredo da primeira deixa de ser o da conta.
    const outra = await context.newPage()
    await outra.goto('/operacao/entrar')
    await entrarAteOConfigurar(outra, operador, hasTouch)

    // A primeira aba manda o código do segredo dela: a API responde "configure de novo" sem conferir o código.
    await campoDoCodigo(page).fill(codigoDoAutenticador(primeira.segredo))
    await activate(page, /Ativar e entrar|Ativando/, hasTouch)
    await expect(page).toHaveURL(/\/operacao\/entrar$/, { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('alert')).toHaveText(TEXTO_DO_CONFIGURE_DE_NOVO)
    await expect(page.locator('body')).not.toContainText(primeira.segredo)
    expect(await seriousViolations(page)).toEqual([])

    // Recomeça: o e-mail e a senha levam de volta ao configurar, com um QR novo, e o código dele abre a sessão.
    const nova = await entrarAteOConfigurar(page, operador, hasTouch)
    expect(nova.segredo).not.toBe(primeira.segredo)
    await campoDoCodigo(page).fill(codigoDoAutenticador(nova.segredo))
    await activate(page, /Ativar e entrar|Ativando/, hasTouch)
    await esperarCasca(page, operador)
  })

  test('teclado do começo ao fim, com foco visível e o "Copiado" anunciado', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const operador = await criarOperadorConvidado()
    const configurar = respostaDoConfigurar(page)
    await page.goto(`/operacao/convite#${operador.token}`)
    await expect(page.getByLabel('Senha nova')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })

    /** Tab até o elemento, conferindo a cada parada que o foco aparece. */
    async function tabAte(alvo: ReturnType<Page['getByLabel']>): Promise<void> {
      for (let tecla = 0; tecla < 30 && !(await alvo.evaluate((elemento) => elemento === document.activeElement)); tecla++) {
        await page.keyboard.press('Tab')
        expect(await isFocusVisible(page), 'foco sem contorno visível').toBe(true)
      }
      await expect(alvo).toBeFocused()
    }

    await tabAte(page.getByLabel('Senha nova'))
    await page.keyboard.type(SENHA_NOVA)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    const configurado = (await (await configurar).json()) as Configurado
    await expect(page.getByRole('main')).toContainText(configurado.segredo, { timeout: SCREEN_TIMEOUT_MS })

    await tabAte(page.getByRole('button', { name: 'Copiar os códigos' }))
    await page.keyboard.press('Enter')
    // A região viva do botão diz que copiou: é o que o leitor de tela anuncia.
    await expect(page.getByRole('status').filter({ hasText: 'Códigos copiados.' })).toBeVisible()
    expect((await page.evaluate(() => navigator.clipboard.readText())).split('\n')).toEqual(configurado.codigosRecuperacao)

    await tabAte(campoDoCodigo(page))
    await page.keyboard.type(codigoDoAutenticador(configurado.segredo))
    await page.keyboard.press('Enter')
    await esperarCasca(page, operador)
  })
})
