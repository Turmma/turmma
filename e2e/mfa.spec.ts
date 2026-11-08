import type { Route } from '@playwright/test'
import { AVISO_DO_SEGUNDO_FATOR_CONSUMIDO, mensagemDoSegundoFator } from '../packages/shared/src/errors/messages.ts'
import { QUANTIDADE_DE_CODIGOS_DE_RECUPERACAO } from '../packages/shared/src/sessao/mfa.ts'
import { digitarOCodigoDaEntrada, entrarComoCoordenacaoNaMesmaAba, entrarPelaTelaComSegundoFator, entrarPorEmail, esperarPainel, pedirOSegredo } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { campoCodigo, setUpMfa, configurarSegundoFatorPelaApi, entrarComSenha, gastarCodigoDeRecuperacaoPelaApi } from './support/mfa.ts'
import { codigoDoAutenticador, criarEquipeComSenha } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'

const SIGN_IN_TIMEOUT_MS = 20_000
/** Um passo do TOTP à frente: a ativação grava o passo usado, e só um passo maior entra depois (6.0). */
const PASSO_SEGUINTE_SEGUNDOS = 30
/** O corpo da recusa que a API dá ao desafio sem a marca do Redis de fila: o mesmo `NAO_AUTENTICADO` de qualquer código errado. */
const RECUSA_DA_API = { erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'texto da API que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }

/**
 * A rota que recusa com o 401 do desafio por `DURACAO_DA_RECUSA_MS` a partir do primeiro pedido e depois deixa passar: o relógio da API que confere o
 * desafio atrás do que o emitiu recusa até alcançá-lo (até 2 s no portão da 4.0). Conta os pedidos, para o caso afirmar que houve uma repetição só: a
 * repetição na hora cairia dentro da recusa e daria três.
 *
 * A recusa é medida no relógio **monotônico** (`performance.now()`), e a espera da fixture, no de parede (`Date.now()`), que é o que a API lê. O de parede
 * desta máquina recua e avança aos saltos (0,8 a 2 s, `timesyncd`): medindo a recusa por ele, um recuo entre o primeiro pedido e a repetição a mantinha
 * dentro da recusa, e o caso contava três pedidos (visto duas vezes: 1 de 84 e 1 de 36, na repetição às 4,9 s e 8,2 s do relógio do teste). A espera de 3 s de parede
 * dura pelo menos 1,3 s de monotônico mesmo com um avanço de 1,7 s do relógio, e a recusa é de 1 s.
 */
const DURACAO_DA_RECUSA_MS = 1_000
function recusarPorUmTempo() {
  let primeiroPedidoEm: number | undefined
  let pedidos = 0
  return {
    pedidos: () => pedidos,
    rota: async (rota: Route) => {
      pedidos += 1
      primeiroPedidoEm ??= performance.now()
      if (performance.now() - primeiroPedidoEm >= DURACAO_DA_RECUSA_MS) return rota.continue()
      return rota.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify(RECUSA_DA_API) })
    },
  }
}

test.describe('segundo fator da coordenação, sem celular', () => {
  test('configura: o segredo aparece em texto, copia-se, nada dele fica no navegador, e a tela cabe, passa no axe e tem alvo de 44 px', async ({ page, hasTouch }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const renata = await criarEquipeComSenha('coordenador')

    const respostaDoSegredo = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/conta/mfa/configurar')
    await entrarComSenha(page, renata)
    await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const { segredo } = (await (await respostaDoSegredo).json()) as { segredo: string }

    // O segredo aparece em texto, que é o caminho de quem não tem celular: o QR é só conveniência (regra 50, item 2).
    await expect(page.getByRole('main')).toContainText(segredo)
    await expect(page.getByRole('main')).toContainText(/KeePassXC|Bitwarden/)
    if (hasTouch) await page.getByRole('button', { name: 'Copiar o segredo' }).tap()
    else await page.getByRole('button', { name: 'Copiar o segredo' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Segredo copiado' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(segredo)

    // Nada do segredo em armazenamento do navegador nem na barra: o computador da coordenação também é compartilhado.
    const guardado = await page.evaluate(() => ({ local: JSON.stringify(Object.entries(localStorage)), sessao: JSON.stringify(Object.entries(sessionStorage)), url: location.href }))
    expect(guardado.local).toBe('[]')
    expect(guardado.sessao).toBe('[]')
    expect(guardado.url).not.toContain(segredo)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    const caixa = await page.getByRole('button', { name: /Ativar o segundo fator|Ativando/ }).boundingBox()
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  })

  test('ativa com o código do segredo, vê os códigos uma vez, e a conta passa a pedir o código desse segredo', async ({ page, hasTouch }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const renata = await criarEquipeComSenha('coordenador')

    const respostaDoSegredo = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/conta/mfa/configurar')
    await entrarComSenha(page, renata)
    await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const { segredo } = (await (await respostaDoSegredo).json()) as { segredo: string }

    const respostaDosCodigos = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/conta/mfa/ativar')
    await campoCodigo(page).fill(codigoDoAutenticador(segredo))
    const botaoAtivar = page.getByRole('button', { name: /Ativar o segundo fator|Ativando/ })
    if (hasTouch) await botaoAtivar.tap()
    else await botaoAtivar.click()

    const { codigosRecuperacao } = (await (await respostaDosCodigos).json()) as { codigosRecuperacao: string[] }
    expect(codigosRecuperacao).toHaveLength(QUANTIDADE_DE_CODIGOS_DE_RECUPERACAO)
    for (const codigo of codigosRecuperacao) await expect(page.getByRole('main')).toContainText(codigo)
    await expect(page.getByRole('main')).toContainText('não aparecem de novo')
    if (hasTouch) await page.getByRole('button', { name: 'Copiar os códigos' }).tap()
    else await page.getByRole('button', { name: 'Copiar os códigos' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Códigos copiados' })).toBeVisible()
    expect((await page.evaluate(() => navigator.clipboard.readText())).split('\n')).toEqual(codigosRecuperacao)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    // Sair da tela, por dentro da web e sem recarregar, já apaga segredo e códigos: eles vivem só no estado do
    // componente, e não num cache que a próxima tela devolveria.
    await page.getByRole('link', { name: 'Ir para a entrada' }).click()
    await expect(page).toHaveURL(/\/entrar$/)
    await expect(page.locator('body')).not.toContainText(segredo)
    for (const codigo of codigosRecuperacao) await expect(page.locator('body')).not.toContainText(codigo)
    // E voltar à tela não os traz de volta: o desafio foi consumido na ativação, e não há o que remontar.
    await page.goto('/mfa/configurar')
    await expect(page.getByRole('alert')).toContainText('entre de novo', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText(segredo)

    // E o segundo fator agora vale, o que a tela mostrou: a API aceita, para a senha desta conta, o código do passo seguinte desse segredo (a ativação gastou o de agora).
    const pedidos = page.context().request
    const entrada = await pedidos.post('/v1/sessao/email', { data: { email: renata.email, senha: renata.senha } })
    const { etapa, desafio } = (await entrada.json()) as { etapa?: string; desafio?: string }
    expect(etapa).toBe('mfa')
    const segundo = await pedidos.post('/v1/sessao/mfa', { headers: { Authorization: `Bearer ${desafio ?? ''}` }, data: { codigo: codigoDoAutenticador(segredo, PASSO_SEGUINTE_SEGUNDOS) } })
    expect(((await segundo.json()) as { etapa?: string }).etapa).toBe('pronta')
  })

  // O que o primeiro caso fazia depois da ativação, em dois casos: a conta já nasce com o segundo fator, pela API, e a tela de configuração é provada no caso de cima.
  test('o segundo fator ativado: a senha sozinha para na tela do código, que cabe em 360 px, passa no axe e tem alvo de 44 px', async ({ page, request }) => {
    const renata = await criarEquipeComSenha('coordenador')
    await configurarSegundoFatorPelaApi(request, renata)
    await entrarComSenha(page, renata)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoCodigo(page)).toHaveAttribute('autocomplete', 'one-time-code')
    await expect(campoCodigo(page)).toHaveAttribute('inputmode', 'numeric')
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    const caixaDoEntrar = await page.getByRole('button', { name: /^Entrar$/ }).boundingBox()
    expect(caixaDoEntrar?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  })

  test('o segundo fator ativado: o código do aplicativo, do passo seguinte, entra e a coordenação abre no Painel', async ({ page, request, hasTouch }) => {
    const renata = await criarEquipeComSenha('coordenador')
    const { segredo } = await configurarSegundoFatorPelaApi(request, renata)
    await page.goto('/entrar')
    await entrarPelaTelaComSegundoFator(page, renata, segredo, hasTouch)
    // A coordenação abre no Painel (A5).
    await esperarPainel(page)
  })

  test('código de recuperação entra sem o aplicativo', async ({ page, request }) => {
    // A conta já nasce com o segundo fator, pela API: a tela de configuração é provada no primeiro caso do arquivo, e aqui custaria uns 8 s.
    const renata = await criarEquipeComSenha('coordenador')
    const { codigosDeRecuperacao } = await configurarSegundoFatorPelaApi(request, renata)
    const [primeiro] = codigosDeRecuperacao
    expect(primeiro).toBeDefined()

    await entrarComSenha(page, renata)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await page.getByRole('button', { name: 'Usar um código de recuperação' }).click()
    await page.getByLabel('Código de recuperação').fill(primeiro ?? '')
    await page.getByRole('button', { name: /^Entrar$/ }).click()
    // A coordenação abre em Governança (A5).
    await esperarPainel(page)
  })

  test('o código de recuperação já usado não passa de novo, e um ainda não usado entra', async ({ page, request }) => {
    const renata = await criarEquipeComSenha('coordenador')
    const { codigosDeRecuperacao } = await configurarSegundoFatorPelaApi(request, renata)
    const [primeiro, segundo] = codigosDeRecuperacao
    expect(primeiro).toBeDefined()
    expect(segundo).toBeDefined()

    // O primeiro valeu uma vez, gasto pela API: a aba só vê o que vem depois (RF12).
    await gastarCodigoDeRecuperacaoPelaApi(request, renata, primeiro ?? '')

    await entrarComSenha(page, renata)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await page.getByRole('button', { name: 'Usar um código de recuperação' }).click()
    await page.getByLabel('Código de recuperação').fill(primeiro ?? '')
    await page.getByRole('button', { name: /^Entrar$/ }).click()
    await expect(page.getByRole('alert')).toHaveText(mensagemDoSegundoFator('NAO_AUTENTICADO'), { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page).toHaveURL(/\/mfa$/)

    // E um código ainda não usado entra: o que valeu uma vez foi aquele, não o segundo fator inteiro.
    await page.getByLabel('Código de recuperação').fill(segundo ?? '')
    await page.getByRole('button', { name: /^Entrar$/ }).click()
    // A coordenação abre em Governança (A5).
    await esperarPainel(page)
  })

  test('a ativação recusada uma vez com o código certo, porque o Redis de fila não respondeu: a entrada do teste tenta de novo e a coordenação entra', async ({ page, hasTouch }) => {
    // A entrada de ponta a ponta (configurar, ativar, a senha de novo e o código) leva 13 s aqui e perto do dobro na esteira, contra os 30 s do relógio padrão.
    test.slow()
    const renata = await criarEquipeComSenha('coordenador')
    // A API recusa o desafio sem a marca do Redis de fila (`login.desafio_sem_redis`) antes de gastar o código e o desafio, e a tela
    // mostra o mesmo aviso do código errado. Parar o Redis de verdade pararia os outros casos que rodam ao mesmo tempo; a recusa é a da rede.
    let pedidosDeAtivacao = 0
    await page.route(
      (url) => url.pathname === '/v1/conta/mfa/ativar',
      async (rota) => {
        pedidosDeAtivacao += 1
        if (pedidosDeAtivacao > 1) return rota.continue()
        return rota.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify(RECUSA_DA_API) })
      },
    )
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, renata, hasTouch)
    await esperarPainel(page)
    expect(pedidosDeAtivacao).toBe(2)
  })

  test('a configuração com o desafio recusado por um tempo: o passo da entrada do teste espera e pede o segredo de novo, e a tela mostra o que ele devolveu', async ({ page, hasTouch }) => {
    const renata = await criarEquipeComSenha('coordenador')
    // A recusa do desafio no primeiro passo (o Redis de fila sem resposta, ou o `iat` do desafio à frente do relógio da API que o confere): a resposta não
    // traz o segredo e a tela oferece "Tentar de novo". Ela dura mais que uma repetição na hora, como o relógio atrás: só a que espera passa.
    // Só o passo do segredo, e não a entrada inteira (que passaria de metade do prazo do caso com a espera).
    const recusa = recusarPorUmTempo()
    await page.route((url) => url.pathname === '/v1/conta/mfa/configurar', recusa.rota)
    await page.goto('/entrar')
    const segredo = await pedirOSegredo(page, () => entrarPorEmail(page, renata, hasTouch), hasTouch)
    expect(recusa.pedidos()).toBe(2)
    // O segredo é o da tela, e a conta guarda só um: o recusado nunca foi gravado.
    await expect(page.getByRole('main')).toContainText(segredo)
  })

  test('o código da entrada com o desafio recusado por um tempo: o passo da entrada do teste espera, digita o código de novo e a coordenação entra', async ({ page, request, hasTouch }) => {
    const renata = await criarEquipeComSenha('coordenador')
    // A recusa vem antes de gastar o código e o desafio (`MfaService.entrar`: `#desafioLivre` antes do contador e do passo): a tela fica em
    // `/mfa` com o aviso do código errado, e o mesmo código vale na tentativa seguinte. Dura mais que uma repetição na hora (o `iat` do desafio à
    // frente do relógio da API): só a que espera passa. O segundo fator vem pela API, e só este passo é pela tela.
    const { segredo } = await configurarSegundoFatorPelaApi(request, renata)
    const recusa = recusarPorUmTempo()
    await page.route((url) => url.pathname === '/v1/sessao/mfa', recusa.rota)
    await page.goto('/entrar')
    await entrarPorEmail(page, renata, hasTouch)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await digitarOCodigoDaEntrada(page, segredo, hasTouch)
    // Entrou: a aba saiu de `/mfa` para o endereço do Painel. O Painel carregado inteiro é de outros casos e passaria de metade do prazo deste.
    await expect(page).toHaveURL(/\/coordenacao\/painel$/, { timeout: SIGN_IN_TIMEOUT_MS })
    expect(recusa.pedidos()).toBe(2)
  })

  test('cinco códigos errados gastam o desafio: a tela volta à entrada explicando, e o código certo não entra sem refazer a senha', async ({ page }) => {
    const renata = await criarEquipeComSenha('coordenador')
    const { segredo } = await setUpMfa(page, renata)

    await entrarComSenha(page, renata)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    for (let tentativa = 1; tentativa <= 4; tentativa++) {
      await campoCodigo(page).fill('000000')
      await page.getByRole('button', { name: /^Entrar$/ }).click()
      // Os quatro primeiros erros não gastam o desafio: a pessoa continua na tela do código.
      await expect(page.getByRole('alert')).toHaveText(mensagemDoSegundoFator('NAO_AUTENTICADO'), { timeout: SIGN_IN_TIMEOUT_MS })
      await expect(page).toHaveURL(/\/mfa$/)
    }

    await campoCodigo(page).fill('000000')
    await page.getByRole('button', { name: /^Entrar$/ }).click()
    // O quinto gasta o desafio: insistir com outro código só seguraria mais a conta.
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('alert')).toContainText(AVISO_DO_SEGUNDO_FATOR_CONSUMIDO)
    expect(await seriousViolations(page)).toEqual([])

    // O sexto código, mesmo certo, não tem por onde entrar: a tela do segundo fator nem formulário mostra.
    await page.goto('/mfa')
    await expect(page.getByRole('alert')).toContainText('entre de novo', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoCodigo(page)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(codigoDoAutenticador(segredo, PASSO_SEGUINTE_SEGUNDOS))
  })
})
