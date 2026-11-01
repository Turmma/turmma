import { AVISO_DO_CONVITE_PARA_CONTA_EXISTENTE, mensagemDaEntrada, mensagemDoConvite, mensagemDoSegundoFator } from '../packages/shared/src/errors/messages.ts'
import { expect, test } from './support/profiles.ts'
import { campoCodigo, setUpMfa } from './support/mfa.ts'
import { codigoDoAutenticador, criarConviteDeCoordenador, criarEquipeComSenha, desativarUsuario, revogarConvite } from './support/seed.ts'
import { rawCodePattern, horizontalOverflow, seriousViolations } from './support/checks.ts'

const SCREEN_TIMEOUT_MS = 20_000

/** Um passo do TOTP à frente: a ativação do segundo fator gravou o passo de agora. */
const PASSO_SEGUINTE_SEGUNDOS = 30

/**
 * W10 (entrada da escola), da A0b (tarefa 4.0; `tasks/prd-apresentacao-painel/cenarios.md`): quem aceitou o convite com
 * uma conta que já tem senha e entra depois de o operador revogar o convite recebe, com a senha certa, o `NAO_ENCONTRADO`
 * da E16. A tela de entrada mostra o texto da tela de convite inválido do F1, sem dizer que a senha estava certa, e nada
 * da escola que convidou.
 */
test.describe('entrada com o convite que já não vale', () => {
  test('a senha certa com o convite revogado depois do aceite mostra o texto de convite inválido, sem falar da senha', async ({ page, hasTouch }) => {
    // A pessoa já trabalhou numa escola cliente: a conta tem senha, e nenhum usuário ativo.
    const pessoa = await criarEquipeComSenha('professor')
    await desativarUsuario(pessoa.usuarioId)
    const convite = await criarConviteDeCoordenador({ conta: pessoa })

    await page.goto(`/convite#${convite.token}`)
    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: SCREEN_TIMEOUT_MS })
    const botaoAceitar = page.getByRole('button', { name: /Aceitar o convite|Aceitando/ })
    if (hasTouch) await botaoAceitar.tap()
    else await botaoAceitar.click()
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('alert').filter({ hasText: AVISO_DO_CONVITE_PARA_CONTA_EXISTENTE })).toBeVisible()

    // Entre o aceite e a primeira entrada, o operador revoga o convite (estado `aceito` → `revogado`).
    await revogarConvite(convite)

    await page.getByLabel('E-mail').fill(pessoa.email)
    await page.getByLabel('Senha').fill(pessoa.senha)
    const resposta = page.waitForResponse((pedido) => new URL(pedido.url()).pathname === '/v1/sessao/email')
    if (hasTouch) await page.getByRole('button', { name: /^Entrar$/ }).tap()
    else await page.getByRole('button', { name: /^Entrar$/ }).click()
    expect((await resposta).status()).toBe(404)

    const texto = mensagemDaEntrada('NAO_ENCONTRADO')
    expect(texto).toBe(mensagemDoConvite('NAO_ENCONTRADO'))
    const alerta = page.getByRole('alert').filter({ hasText: texto })
    await expect(alerta).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    await expect(alerta).not.toContainText(/senha|e-mail|corret/i)
    // O aviso do aceite ("entre com a sua senha para concluir o convite") deixou de ser verdade e sai da tela.
    await expect(page.getByRole('alert').filter({ hasText: AVISO_DO_CONVITE_PARA_CONTA_EXISTENTE })).toHaveCount(0)
    // Nada da escola que convidou, nem código ou status do erro na tela.
    await expect(page.locator('body')).not.toContainText(convite.escolaNome)
    for (const proibido of ['NAO_ENCONTRADO', rawCodePattern('404')]) await expect(page.locator('body')).not.toContainText(proibido)
    await expect(page).toHaveURL(/\/entrar$/)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('com segundo fator: o código certo com o convite revogado leva à entrada com o texto de convite inválido, sem formulário que só daria "código incorreto"', async ({ page, hasTouch }) => {
    // A coordenadora já teve acesso e configurou o segundo fator; depois saiu da escola, e outra a convida.
    const pessoa = await criarEquipeComSenha('coordenador')
    const { segredo } = await setUpMfa(page, pessoa)
    await desativarUsuario(pessoa.usuarioId)
    const convite = await criarConviteDeCoordenador({ conta: pessoa })

    await page.goto(`/convite#${convite.token}`)
    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: SCREEN_TIMEOUT_MS })
    const botaoAceitar = page.getByRole('button', { name: /Aceitar o convite|Aceitando/ })
    if (hasTouch) await botaoAceitar.tap()
    else await botaoAceitar.click()
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SCREEN_TIMEOUT_MS })

    await page.getByLabel('E-mail').fill(pessoa.email)
    await page.getByLabel('Senha').fill(pessoa.senha)
    if (hasTouch) await page.getByRole('button', { name: /^Entrar$/ }).tap()
    else await page.getByRole('button', { name: /^Entrar$/ }).click()
    await expect(campoCodigo(page)).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })

    // Entre a senha e o código, o operador revoga o convite.
    await revogarConvite(convite)
    await campoCodigo(page).fill(codigoDoAutenticador(segredo, PASSO_SEGUINTE_SEGUNDOS))
    const resposta = page.waitForResponse((pedido) => new URL(pedido.url()).pathname === '/v1/sessao/mfa')
    if (hasTouch) await page.getByRole('button', { name: /^Entrar$/ }).tap()
    else await page.getByRole('button', { name: /^Entrar$/ }).click()
    expect((await resposta).status()).toBe(404)

    const texto = mensagemDoSegundoFator('NAO_ENCONTRADO')
    expect(texto).toBe(mensagemDoConvite('NAO_ENCONTRADO'))
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByRole('alert').filter({ hasText: texto })).toBeVisible()
    // O desafio gasto saiu da aba: não sobra campo de código, nem o "código incorreto" de quem repetisse.
    await expect(campoCodigo(page)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(/Código incorreto|senha estava/i)
    await expect(page.locator('body')).not.toContainText(convite.escolaNome)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })
})
