import type { Page, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO, mensagemDaEntradaPorMatricula, mensagemDaFalhaExterna, mensagemDoAcessoDaEscola } from '../packages/shared/src/errors/messages.ts'
import { criarAlunoComMatricula, criarEscolaSintetica, liberarProvedorDaEscola, ligarContaExterna, type AlunoDeTeste } from './__fixtures__/sessao.ts'
import { esperarInicioDoAluno } from './__fixtures__/casca.ts'
import { expect, test } from './__fixtures__/perfis.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, codigoCru, focoVisivel, larguraExcedente, violacoesGraves } from './__fixtures__/verificacoes.ts'

const ROTA_MATRICULA = '**/v1/sessao/matricula'
/** O Chromebook com CPU ×4 e rede Fast 3G carrega a página e ainda faz o hash da senha no servidor. */
const PRAZO_DA_ENTRADA_MS = 20_000
/** O login pela conta da escola passa por três navegações e o discovery do provedor. */
const PRAZO_DO_LOGIN_EXTERNO_MS = 40_000
/** Quantas senhas erradas seguidas seguram a conta (`FALHAS_ANTES_DE_SEGURAR`, apps/api/src/credencial/contador-de-tentativas.ts). */
const FALHAS_ATE_SEGURAR = 5

/** Os usuários sintéticos do `oidc-falso` (infra/oidc-falso/config.json), escolhidos pelo nome digitado no login dele. */
const ALUNA_NO_PROVEDOR = 'google-aluna-a'
const SUJEITO_DA_ALUNA = 'google-sub-aluna-a'
const DOMINIO_DA_ESCOLA_A = 'escola-a.educa-sintetica.test'
/** O que o provedor devolve sobre a aluna e que nunca pode aparecer na tela (regra 20, item 2). */
const DADOS_DA_ALUNA_NO_PROVEDOR = ['aluna.ficticia.a@escola-a.educa-sintetica.test', 'Aluna Ficticia Sintetica', 'fotos.educa-sintetica.test']

const campoMatricula = (page: Page) => page.getByLabel('Matrícula')
const campoSenha = (page: Page) => page.getByLabel('Senha')
const botaoEntrar = (page: Page) => page.getByRole('button', { name: /Entrar|Entrando/ })

/** Toque no celular, clique no Chromebook: a mesma ação pela entrada que cada aparelho tem. */
async function acionar(page: Page, nome: string | RegExp, hasTouch: boolean, papel: 'button' | 'link' = 'button'): Promise<void> {
  const alvo = page.getByRole(papel, { name: nome })
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

async function esperarAlvoDeToque(page: Page, nome: string | RegExp, papel: 'button' | 'link' = 'button'): Promise<void> {
  const caixa = await page.getByRole(papel, { name: nome }).boundingBox()
  expect(caixa, `${String(nome)} sem caixa`).not.toBeNull()
  expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
}

/** A área autenticada, em "Início", onde o aluno abre, com o nome dele e o da escola na lateral: é o que prova que a sessão vale de verdade. */
async function esperarAreaAutenticada(page: Page, aluno: AlunoDeTeste): Promise<void> {
  await esperarInicioDoAluno(page, aluno.nome, { timeout: PRAZO_DO_LOGIN_EXTERNO_MS, escolaNome: aluno.escolaNome })
}

async function entrar(page: Page, matricula: string, senha: string, hasTouch: boolean): Promise<void> {
  await campoMatricula(page).fill(matricula)
  await campoSenha(page).fill(senha)
  await acionar(page, /^Entrar$/, hasTouch)
}

/**
 * O formulário do `oidc-falso`, que faz o papel da tela do Google: o nome digitado ali é o `subject` do usuário
 * sintético. A fonte externa da página dele é bloqueada, para a rede lenta do perfil não esperar por ela.
 */
async function entrarNoProvedorFalso(page: Page, sujeito: string): Promise<void> {
  await page.route('**://fonts.googleapis.com/**', (rota: Route) => rota.abort())
  await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: PRAZO_DO_LOGIN_EXTERNO_MS })
  await page.locator('input[name="username"]').fill(sujeito)
  await page.locator('input[type="submit"]').click()
}

test.describe('entrada do aluno pelo endereço da escola', () => {
  test('caminho feliz só com teclado: o aluno vê o nome da escola, digita matrícula e senha e entra, com foco visível', async ({ page }) => {
    const aluno = await criarAlunoComMatricula()
    await page.goto(`/e/${aluno.slug}`)

    // O topo é o nome da escola: é ele que diz ao aluno que está no endereço certo.
    await expect(page.getByRole('heading', { name: aluno.escolaNome })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // Teclado numérico no celular e preenchimento automático do identificador (regra 50, item 2a).
    await expect(campoMatricula(page)).toHaveAttribute('inputmode', 'numeric')
    await expect(campoMatricula(page)).toHaveAttribute('autocomplete', 'username')
    await expect(campoSenha(page)).toHaveAttribute('autocomplete', 'current-password')

    await page.keyboard.press('Tab')
    await expect(campoMatricula(page)).toBeFocused()
    expect(await focoVisivel(page)).toBe(true)
    await page.keyboard.type(aluno.matricula)
    await page.keyboard.press('Tab')
    await expect(campoSenha(page)).toBeFocused()
    expect(await focoVisivel(page)).toBe(true)
    await page.keyboard.type(aluno.senha)
    await page.keyboard.press('Enter')

    await esperarAreaAutenticada(page, aluno)
    // O aluno sai do endereço da escola e abre em "Início" (X4, 2.0): o endereço é só o da tela, sem nada do login.
    expect(new URL(page.url()).pathname).toBe('/aluno/inicio')
    expect(new URL(page.url()).search).toBe('')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('escola sem provedor liberado não mostra botão de conta nenhuma: só aparece o que a escola liberou', async ({ page }) => {
    // É também o caso de borda "escola revoga o app no meio do ano" (PRD): o botão some e a matrícula continua.
    const aluno = await criarAlunoComMatricula()
    await page.goto(`/e/${aluno.slug}`)

    await expect(campoMatricula(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('link', { name: /Entrar com a conta/ })).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('precisa liberar este aplicativo')
  })

  test('caminho feliz só com toque: campos e botão alcançados por toque, com alvo de 44 px e sem rolagem horizontal', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    await page.goto(`/e/${aluno.slug}`)
    await expect(campoMatricula(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await esperarAlvoDeToque(page, /^Entrar$/)

    if (hasTouch) await campoMatricula(page).tap()
    else await campoMatricula(page).click()
    await page.keyboard.type(aluno.matricula)
    if (hasTouch) await campoSenha(page).tap()
    else await campoSenha(page).click()
    await page.keyboard.type(aluno.senha)
    await acionar(page, /^Entrar$/, hasTouch)

    await esperarAreaAutenticada(page, aluno)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('isolamento: a matrícula 1234 da escola A, com a senha de A, é recusada no endereço da escola B, e entra na A', async ({ page, hasTouch }) => {
    const escolaB = await criarEscolaSintetica()
    const alunoA = await criarAlunoComMatricula({ matricula: '1234' })
    // A mesma matrícula na escola B é outra pessoa, com outra senha (RF7, regra 60, item 6).
    await criarAlunoComMatricula({ escola: escolaB, matricula: '1234', senha: `senha-de-b-${alunoA.usuarioId}` })

    await page.goto(`/e/${escolaB.slug}`)
    await expect(campoMatricula(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await entrar(page, '1234', alunoA.senha, hasTouch)
    // A mesma mensagem da senha errada: a tela não diz que a matrícula existe na outra escola.
    await expect(page.getByRole('alert')).toHaveText(mensagemDaEntradaPorMatricula('NAO_AUTENTICADO'), { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveURL(new RegExp(`/e/${escolaB.slug}$`))
    await expect(page.locator('body')).not.toContainText(alunoA.escolaNome)

    await page.goto(`/e/${alunoA.slug}`)
    await expect(campoMatricula(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await entrar(page, '1234', alunoA.senha, hasTouch)
    await esperarAreaAutenticada(page, alunoA)
  })

  test('endereço que não existe diz o que fazer e não lista escola nenhuma', async ({ page }) => {
    const aluno = await criarAlunoComMatricula()
    await page.goto('/e/endereco-que-nao-existe-no-e2e')

    await expect(page.getByRole('alert')).toHaveText(mensagemDoAcessoDaEscola('NAO_ENCONTRADO'), { timeout: PRAZO_DA_ENTRADA_MS })
    // Nem o nome de uma escola de verdade, nem formulário que faça o aluno digitar a matrícula à toa.
    await expect(page.locator('body')).not.toContainText(aluno.escolaNome)
    await expect(campoMatricula(page)).toHaveCount(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('conta segurada de verdade: a tela diz em português quanto esperar, e o colega entra no mesmo computador', async ({ page, hasTouch }) => {
    const enzo = await criarAlunoComMatricula()
    const colega = await criarAlunoComMatricula({ escola: enzo })

    await page.goto(`/e/${enzo.slug}`)
    await expect(campoMatricula(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // Sem mock: quem segura a conta é o contador da API, depois de cinco senhas erradas seguidas (RF11).
    const alerta = page.getByRole('alert')
    for (let tentativa = 1; tentativa <= FALHAS_ATE_SEGURAR; tentativa++) {
      await entrar(page, enzo.matricula, `senha-errada-${String(tentativa)}`, hasTouch)
      await expect(alerta).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
      if (tentativa < FALHAS_ATE_SEGURAR) await expect(alerta).toHaveText(mensagemDaEntradaPorMatricula('NAO_AUTENTICADO'))
    }
    // A mensagem da conta segurada diz a espera por extenso, e nunca o código nem o status.
    await expect(alerta).toContainText('Muitas tentativas com senha errada nesta conta')
    await expect(alerta).toContainText(/segundos|minutos/)
    for (const proibido of [codigoCru('429'), 'CONTA_SEGURADA', 'Retry-After']) {
      await expect(page.locator('body')).not.toContainText(proibido)
    }

    // O bloqueio é da conta, nunca do IP nem do computador: o colega entra no mesmo Chromebook, no mesmo minuto.
    await entrar(page, colega.matricula, colega.senha, hasTouch)
    await esperarAreaAutenticada(page, colega)
  })

  test('clique repetido em "Entrar" não manda dois logins: com o pedido em andamento, o botão fica desabilitado', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    let pedidos = 0
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_MATRICULA, async (rota: Route) => {
      pedidos++
      await segurada
      await rota.continue()
    })

    await page.goto(`/e/${aluno.slug}`)
    await expect(campoMatricula(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await campoMatricula(page).fill(aluno.matricula)
    await campoSenha(page).fill(aluno.senha)
    await acionar(page, /^Entrar$/, hasTouch)

    await expect(botaoEntrar(page)).toBeDisabled()
    // Dois logins da mesma pessoa gravariam duas sessões e duas linhas de registro de acesso.
    await botaoEntrar(page).dispatchEvent('click')
    liberar()
    await esperarAreaAutenticada(page, aluno)
    expect(pedidos).toBe(1)
  })
})

test.describe('entrada do aluno pela conta Google da escola', () => {
  /** Uma escola com o domínio do provedor falso liberado e um aluno nela. */
  async function escolaComProvedor(): Promise<AlunoDeTeste> {
    const aluno = await criarAlunoComMatricula()
    await liberarProvedorDaEscola(aluno.escolaId, 'google', DOMINIO_DA_ESCOLA_A)
    return aluno
  }

  test('aluno com a conta ligada entra pelo botão, e nada do provedor (e-mail, nome ou foto) aparece na tela', async ({ page, hasTouch }) => {
    const aluno = await escolaComProvedor()
    await ligarContaExterna(aluno.escolaId, aluno.usuarioId, { provedor: 'google', sujeito: SUJEITO_DA_ALUNA })

    await page.goto(`/e/${aluno.slug}`)
    const botao = page.getByRole('link', { name: /Entrar com a conta Google/ })
    await expect(botao).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // O aviso da TI vem antes do botão: é o que explica o caso de a escola não ter liberado o aplicativo.
    await expect(page.getByRole('main')).toContainText('precisa liberar este aplicativo')
    await esperarAlvoDeToque(page, /Entrar com a conta Google/, 'link')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    await acionar(page, /Entrar com a conta Google/, hasTouch, 'link')
    await entrarNoProvedorFalso(page, ALUNA_NO_PROVEDOR)

    await esperarAreaAutenticada(page, aluno)
    // O provedor mandou e-mail, nome e foto da aluna: nada disso pode ter chegado ao banco nem à tela (RF8).
    const corpo = await page.evaluate(() => ({ html: document.body.innerHTML, url: location.href }))
    for (const dado of DADOS_DA_ALUNA_NO_PROVEDOR) {
      expect(corpo.html, `dado do provedor na tela: ${dado}`).not.toContain(dado)
      expect(corpo.url, `dado do provedor na URL: ${dado}`).not.toContain(dado)
    }
  })

  test('aluno sem ligação volta ao endereço da escola orientado a usar a matrícula, e o parâmetro da falha some da barra', async ({ page, hasTouch }) => {
    // Conta válida do domínio da escola, mas sem ligação com nenhum aluno: não cria usuário (RF10).
    const aluno = await escolaComProvedor()

    await page.goto(`/e/${aluno.slug}`)
    await expect(page.getByRole('link', { name: /Entrar com a conta Google/ })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(page, /Entrar com a conta Google/, hasTouch, 'link')
    await entrarNoProvedorFalso(page, ALUNA_NO_PROVEDOR)

    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.CONTA_EXTERNA_NAO_LIGADA, { timeout: PRAZO_DO_LOGIN_EXTERNO_MS })
    // A recusa não vira endereço que o aluno guarda no histórico e reabre achando que errou de novo.
    await expect(page).toHaveURL(new RegExp(`/e/${aluno.slug}$`))
    // E a matrícula continua ali, que é o caminho que a mensagem oferece.
    await entrar(page, aluno.matricula, aluno.senha, hasTouch)
    await esperarAreaAutenticada(page, aluno)
  })

  test('qualquer falha do provedor vira a mesma mensagem, que oferece a matrícula, e o parâmetro sai da barra', async ({ page }) => {
    const aluno = await escolaComProvedor()

    // O Google e a Microsoft não documentam o valor que devolvem quando a escola não liberou o aplicativo
    // (Tech Spec, seção 12): a API transforma todo `error` em `?falha=provedor`, e a tela trata qualquer valor igual.
    for (const valor of ['provedor', 'admin_policy_enforced']) {
      await page.goto(`/e/${aluno.slug}?falha=${valor}`)
      await expect(page.getByRole('alert')).toHaveText(mensagemDaFalhaExterna('provedor'), { timeout: PRAZO_DA_ENTRADA_MS })
      await expect(page).toHaveURL(new RegExp(`/e/${aluno.slug}$`))
      expect(new URL(page.url()).search, 'o parâmetro da falha precisa sair da barra').toBe('')
      expect(await violacoesGraves(page)).toEqual([])
      expect(await larguraExcedente(page)).toBe(0)
    }
  })
})
