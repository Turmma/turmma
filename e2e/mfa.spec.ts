import { AVISO_DO_SEGUNDO_FATOR_CONSUMIDO, mensagemDoSegundoFator } from '../packages/shared/src/errors/messages.ts'
import { QUANTIDADE_DE_CODIGOS_DE_RECUPERACAO } from '../packages/shared/src/sessao/mfa.ts'
import { entrarComoCoordenacaoNaMesmaAba, esperarPainel } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { campoCodigo, setUpMfa, configurarSegundoFatorPelaApi, entrarComSenha, gastarCodigoDeRecuperacaoPelaApi } from './support/mfa.ts'
import { codigoDoAutenticador, criarEquipeComSenha } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'

const SIGN_IN_TIMEOUT_MS = 20_000
/** Um passo do TOTP à frente: a ativação grava o passo usado, e só um passo maior entra depois (6.0). */
const PASSO_SEGUINTE_SEGUNDOS = 30

test.describe('segundo fator da coordenação, sem celular', () => {
  test('configura copiando o segredo em texto, ativa, vê os códigos uma vez e entra com o código do aplicativo', async ({ page, hasTouch }) => {
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

    const respostaDosCodigos = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/conta/mfa/ativar')
    await campoCodigo(page).fill(codigoDoAutenticador(segredo))
    const botaoAtivar = page.getByRole('button', { name: /Ativar o segundo fator|Ativando/ })
    const caixa = await botaoAtivar.boundingBox()
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
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

    // E o segundo fator agora vale: a senha sozinha para na tela do código.
    await entrarComSenha(page, renata)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoCodigo(page)).toHaveAttribute('autocomplete', 'one-time-code')
    await expect(campoCodigo(page)).toHaveAttribute('inputmode', 'numeric')
    // A tela do código é uma tela como outra qualquer: cabe em 360 px, passa no axe e tem alvo de 44 px.
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    const caixaDoEntrar = await page.getByRole('button', { name: /^Entrar$/ }).boundingBox()
    expect(caixaDoEntrar?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    await campoCodigo(page).fill(codigoDoAutenticador(segredo, PASSO_SEGUINTE_SEGUNDOS))
    await page.getByRole('button', { name: /^Entrar$/ }).click()
    // A coordenação abre em Governança (A5).
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
        return rota.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'texto da API que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }),
        })
      },
    )
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, renata, hasTouch)
    await esperarPainel(page)
    expect(pedidosDeAtivacao).toBe(2)
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
