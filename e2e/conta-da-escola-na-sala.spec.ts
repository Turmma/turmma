import { randomUUID } from 'node:crypto'
import type { APIRequestContext, Locator, Page, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { esperarIntroducaoDoAluno, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { tokenDaEquipe } from './support/roteiro.ts'
import {
  alunosDaTurmaNoBanco,
  confirmarVinculosNoBanco,
  criarAlocacaoDoProfessor,
  criarEquipeComSenha,
  criarEscolaSintetica,
  criarPedidosNoBanco,
  gerarAcessoDaSalaNoBanco,
  liberarProvedorDaEscola,
  montarEstruturaNoBanco,
  pedidosDaTurmaNoBanco,
  porNaListaDaTurma,
  trocarASenhaPelaContaNoBanco,
  type AcessoDaSalaDeTeste,
  type EscolaDeTeste,
} from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * "Entrar com a conta da escola" na página da sala (acesso-e-convites, 16.0; RF14 e RF18; `cenarios.md`, "Telas" e "Conta da escola do aluno"): o aluno prova a conta no
 * `oidc-falso`, volta à sala e pede o nome sem criar senha; depois da aprovação, entra pela conta. Os dois projetos, `chromebook` e `celular` (360 px). A ida ao provedor de
 * verdade custa uns 10 s por caso: só o primeiro (o clique e a volta) a faz clicando; o pedido sem senha e a entrada depois da aprovação abrem o `iniciar` direto, e os demais semeiam o
 * caminho guardado e a volta (`?conta=provada`), porque o caso de 15 s não tem de sobra. O que a API faz com a conta (o cookie, o `ENTRADA_INVALIDA`, a aprovação) tem os testes de integração da 14.0.
 */

/** O domínio do `oidc-falso` para a aluna sintética (`infra/oidc-falso/config.json`): a escola o libera, ou libera outro e recusa a conta. */
const ALUNA_NO_PROVEDOR = 'google-aluna-a'
const SUJEITO_DA_ALUNA = 'google-sub-aluna-a'
const DOMINIO_DA_ESCOLA_A = 'escola-a.educa-sintetica.test'
const OUTRO_DOMINIO = 'outro-dominio.educa-sintetica.test'
/** O que o provedor devolve sobre a aluna e que nunca pode aparecer na tela, no endereço nem no armazenamento (regra 20, item 2). */
const DADOS_DA_ALUNA_NO_PROVEDOR = ['aluna.ficticia.a@escola-a.educa-sintetica.test', 'Aluna Ficticia Sintetica', 'fotos.educa-sintetica.test']
/** A ida ao provedor e a volta passam por três navegações e o discovery do provedor. */
const PRAZO_DO_LOGIN_EXTERNO_MS = 40_000

/** O prefixo da rota do login externo da API: o `iniciar` que o botão alcança, aberto direto quando o caso não quer pagar a carga da sala para clicar. */
const PREFIXO_DO_LOGIN_EXTERNO = ['', 'v1', 'sessao', 'externa'].join('/')
const CHAVE_DO_CAMINHO = 'educa.caminho-da-sala'
const TEXTO_DA_CONTA_PERDIDA = 'Comece de novo pelo link ou pelo código da sala'
const TEXTO_DA_CONTA_CONFIRMADA = 'Conta da escola confirmada. Escolha o seu nome e informe a matrícula: não precisa criar senha.'
const TEXTO_DA_RECUSA = 'Não foi possível enviar. Confira a matrícula; se estiver certa, chame o professor.'
const TEXTO_DO_SERVIDOR_CHEIO = 'O sistema está cheio agora.'
const TEXTO_SEM_ARMAZENAMENTO = 'Não foi possível entrar com a conta da escola agora. Use a matrícula e a senha.'
const TEXTO_DA_ESPERA = 'Espere o professor aprovar. Até lá, entrar com a conta da escola diz que ela não está liberada. Não é erro: depois da aprovação você entra por ela.'

const erro = (codigo: string) => JSON.stringify({ erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
const ehOAbrir = (url: string) => new URL(url).pathname === '/v1/salas/abrir'
const ehOReivindicar = (url: string) => new URL(url).pathname === '/v1/salas/reivindicar'

const principal = (page: Page) => page.getByRole('main')
const botaoDaConta = (page: Page) => principal(page).getByRole('button', { name: /^(Entrar com a conta da escola|Entrando…)$/ })
const campoDoCodigo = (page: Page) => principal(page).getByLabel('Código da turma')
const campoDaMatricula = (page: Page) => principal(page).getByLabel('Matrícula')
const campoDaSenha = (page: Page) => principal(page).getByLabel('Crie uma senha')
const botaoEnviar = (page: Page) => principal(page).getByRole('button', { name: /^(Enviar pedido|Enviando…|Tentar de novo)$/ })
const tituloDaTurma = (page: Page, nome: string) => principal(page).getByRole('heading', { level: 2, name: `Turma ${nome}` })
const tituloDoPedido = (page: Page) => principal(page).getByRole('heading', { level: 2, name: 'Pedido enviado' })
const avisoDaTela = (page: Page) => principal(page).getByRole('alert')

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

interface Cenario {
  readonly escola: EscolaDeTeste
  readonly turma: { readonly id: string; readonly nome: string }
  readonly lista: ReadonlyArray<{ readonly nome: string; readonly matricula: string }>
  readonly acesso: AcessoDaSalaDeTeste
  readonly endereco: string
}

/** Uma escola com o Google liberado para o domínio dado, uma turma com dois nomes livres e um acesso vigente com link e código conhecidos. */
async function criarCenario(dominio: string = DOMINIO_DA_ESCOLA_A): Promise<Cenario> {
  const escola = await criarEscolaSintetica()
  const estrutura = await montarEstruturaNoBanco(escola.escolaId, ['7A'])
  const turma = estrutura.turmas[0]
  if (turma === undefined) throw new Error('estrutura sem turma')
  const marca = randomUUID().slice(0, 8)
  const lista = [1, 2].map((indice) => ({ nome: `Aluna sintética ${String(indice)} ${marca}`, matricula: `M${String(indice)}-${marca}` }))
  await porNaListaDaTurma(escola.escolaId, turma.id, lista)
  const acesso = await gerarAcessoDaSalaNoBanco(escola.escolaId, turma.id)
  await liberarProvedorDaEscola(escola.escolaId, 'google', dominio)
  return { escola, turma, lista, acesso, endereco: `/e/${escola.slug}/turma` }
}

/**
 * O que a ida ao provedor deixaria no `sessionStorage` da aba, semeado antes da primeira carga (e só uma vez: a segunda carga não repõe o que a primeira apagou). `minutosAtras` é a idade
 * do caminho. Evita a ida ao provedor, que custa uma carga da página.
 */
async function semearOCaminho(page: Page, guardado: { readonly slug: string; readonly tipo: 'link' | 'codigo'; readonly valor: string; readonly minutosAtras?: number }): Promise<void> {
  const texto = JSON.stringify({ slug: guardado.slug, tipo: guardado.tipo, valor: guardado.valor, em: Date.now() - (guardado.minutosAtras ?? 0) * 60_000 })
  await page.addInitScript(
    ({ chave, conteudo }) => {
      if (window.sessionStorage.getItem('e2e.semeado') !== null) return
      window.sessionStorage.setItem('e2e.semeado', '1')
      window.sessionStorage.setItem(chave, conteudo)
    },
    { chave: CHAVE_DO_CAMINHO, conteudo: texto },
  )
}

/** O que o navegador guarda: a chave do caminho da sala no `sessionStorage` e as chaves do `localStorage`. */
async function oQueFicouNoNavegador(page: Page): Promise<{ readonly caminho: string | null; readonly local: string[]; readonly tudo: string }> {
  return page.evaluate((chave) => {
    const sessao = Object.entries(window.sessionStorage)
    return { caminho: window.sessionStorage.getItem(chave), local: Object.keys(window.localStorage), tudo: JSON.stringify([sessao, Object.entries(window.localStorage), window.location.href]) }
  }, CHAVE_DO_CAMINHO)
}

/** O formulário do `oidc-falso`, que faz o papel da tela do Google. */
async function entrarNoProvedorFalso(page: Page, sujeito: string): Promise<void> {
  await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: PRAZO_DO_LOGIN_EXTERNO_MS })
  await page.locator('input[name="username"]').fill(sujeito)
  await page.locator('input[type="submit"]').click()
}

/** A sala aberta pela volta do provedor: a tela da conta confirmada, sem campo de senha. */
async function esperarASalaComAConta(page: Page, cenario: Cenario): Promise<void> {
  await expect(tituloDaTurma(page, cenario.turma.nome)).toBeVisible({ timeout: PRAZO_DO_LOGIN_EXTERNO_MS })
  await expect(principal(page).getByText(TEXTO_DA_CONTA_CONFIRMADA)).toBeVisible()
  await expect(campoDaSenha(page)).toHaveCount(0)
  await expect(botaoDaConta(page)).toHaveCount(0)
}

/** Escolhe o nome, digita a matrícula e envia o pedido, sem senha. */
async function pedirONomeSemSenha(page: Page, nome: string, matricula: string, hasTouch: boolean): Promise<void> {
  await activate(principal(page).getByRole('radio', { name: nome }), hasTouch)
  await campoDaMatricula(page).fill(matricula)
  await activate(botaoEnviar(page), hasTouch)
}

// A fonte externa da página do provedor falso é bloqueada desde o começo do caso, para a rede lenta do perfil não esperar por ela na ida.
test.beforeEach(async ({ page }) => {
  await page.route('**://fonts.googleapis.com/**', (rota: Route) => rota.abort())
})

test.describe('a conta da escola na sala', () => {
  test('o aluno clica no botão, prova a conta no provedor e volta à sala com a conta confirmada: o caminho atravessou a ida e foi apagado na volta', async ({ page, hasTouch }) => {
    const cenario = await criarCenario()
    await page.goto(`${cenario.endereco}#${cenario.acesso.token}`)
    await expect(botaoDaConta(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(botaoDaConta(page), hasTouch)
    await entrarNoProvedorFalso(page, ALUNA_NO_PROVEDOR)
    await esperarASalaComAConta(page, cenario)

    // Na volta: o parâmetro da conta saiu da barra, e o caminho foi lido e apagado; o `localStorage` nunca foi usado.
    expect(new URL(page.url()).pathname).toBe(cenario.endereco)
    expect(new URL(page.url()).search).toBe('')
    const naVolta = await oQueFicouNoNavegador(page)
    expect(naVolta.caminho).toBeNull()
    expect(naVolta.local).toEqual([])
    await expect(principal(page).getByRole('radio', { name: cenario.lista[0]?.nome ?? '' })).toBeVisible()
  })

  test('com a conta provada, o pedido do nome sai sem senha, com o token que atravessou a ida; nada do provedor aparece e o banco guarda só a conta', async ({ page, hasTouch }) => {
    const cenario = await criarCenario()
    const [aluna] = cenario.lista
    if (aluna === undefined) throw new Error('lista sem nome')
    const enderecosVistos: string[] = []
    page.on('request', (pedido) => enderecosVistos.push(pedido.url()))
    // O caminho que o botão guarda (o caso anterior e o do botão o provam), e a ida pelo endereço que o botão abre: um carregamento da sala a menos.
    await semearOCaminho(page, { slug: cenario.escola.slug, tipo: 'link', valor: cenario.acesso.token })
    await page.goto(`${PREFIXO_DO_LOGIN_EXTERNO}/google/iniciar?slug=${cenario.escola.slug}&intencao=reivindicar&token=${encodeURIComponent(cenario.acesso.token)}`)
    await entrarNoProvedorFalso(page, ALUNA_NO_PROVEDOR)
    await esperarASalaComAConta(page, cenario)

    const pedido = page.waitForRequest((requisicao) => ehOReivindicar(requisicao.url()))
    await pedirONomeSemSenha(page, aluna.nome, aluna.matricula, hasTouch)
    const corpo = (await pedido).postDataJSON() as Record<string, unknown>
    expect(corpo).toMatchObject({ slug: cenario.escola.slug, token: cenario.acesso.token, matricula: aluna.matricula })
    expect(corpo).not.toHaveProperty('senha')
    await expect(tituloDoPedido(page)).toBeFocused({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page)).toContainText(TEXTO_DA_ESPERA)
    await expect(principal(page)).not.toContainText(aluna.nome)
    await expect(principal(page)).not.toContainText(aluna.matricula)

    // O banco: um pedido pendente, com a conta no lugar do hash, e o identificador opaco, sem e-mail, nome nem foto.
    expect(await pedidosDaTurmaNoBanco(cenario.escola.escolaId, cenario.turma.id)).toEqual([
      { estado: 'pendente', temSenha: false, contaExterna: { provedor: 'google', tenant: null, sujeito: SUJEITO_DA_ALUNA } },
    ])
    // Nada do provedor na tela, no endereço, no armazenamento nem na conversa com a API.
    const depois = await oQueFicouNoNavegador(page)
    const html = await page.evaluate(() => document.body.innerHTML)
    for (const dado of DADOS_DA_ALUNA_NO_PROVEDOR) {
      expect(html, `dado do provedor na tela: ${dado}`).not.toContain(dado)
      expect(depois.tudo, `dado do provedor no navegador: ${dado}`).not.toContain(dado)
      expect(JSON.stringify(corpo), `dado do provedor no pedido: ${dado}`).not.toContain(dado)
      for (const endereco of enderecosVistos.filter((visto) => new URL(visto).pathname.startsWith('/v1/'))) expect(endereco, `dado do provedor no endereço: ${dado}`).not.toContain(dado)
    }
  })

  test('domínio não liberado: a recusa volta à entrada da escola com o texto dela, nenhum pedido é gravado e a sala não é alcançada', async ({ page, hasTouch }) => {
    const cenario = await criarCenario(OUTRO_DOMINIO)

    await page.goto(`${cenario.endereco}#${cenario.acesso.token}`)
    await expect(botaoDaConta(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(botaoDaConta(page), hasTouch)
    await entrarNoProvedorFalso(page, ALUNA_NO_PROVEDOR)

    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.CONTA_EXTERNA_NAO_LIGADA, { timeout: PRAZO_DO_LOGIN_EXTERNO_MS })
    await expect(page).toHaveURL(new RegExp(`/e/${cenario.escola.slug}$`))
    await expect(page.getByRole('heading', { level: 2, name: /^Turma / })).toHaveCount(0)
    expect(await pedidosDaTurmaNoBanco(cenario.escola.escolaId, cenario.turma.id)).toEqual([])
  })

  /** A escola com a professora, a turma e o pedido que a página da sala deixaria (a conta no lugar do hash), já aprovado pela professora. */
  async function aprovarOPedidoDeConta(request: APIRequestContext) {
    const professora = await criarEquipeComSenha()
    const turma = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Matemática'])
    await confirmarVinculosNoBanco(professora.escolaId, turma.vinculoIds)
    await liberarProvedorDaEscola(professora.escolaId, 'google', DOMINIO_DA_ESCOLA_A)
    const marca = randomUUID().slice(0, 8)
    const [pedido] = await criarPedidosNoBanco(professora.escolaId, turma.turmaId, [{ nome: `Aluna aprovada ${marca}`, matricula: `M-${marca}` }])
    if (pedido === undefined) throw new Error('pedido não criado')
    await trocarASenhaPelaContaNoBanco(professora.escolaId, pedido, { provedor: 'google', sujeito: SUJEITO_DA_ALUNA })
    const sessao = await tokenDaEquipe(request, professora.email, professora.senha)
    const decisao = await request.post('/v1/reivindicacoes/decidir', { headers: { Authorization: `Bearer ${sessao}` }, data: { ids: [pedido.id], decisao: 'aprovar' } })
    expect(decisao.ok(), 'a professora aprova o pedido').toBe(true)
    return { professora, turma }
  }

  test('aprovado o pedido de conta, a aprovação tira a conta do pedido e cria o aluno na turma', async ({ request }) => {
    const { professora, turma } = await aprovarOPedidoDeConta(request)

    expect(await alunosDaTurmaNoBanco(professora.escolaId, turma.turmaId)).toBe(1)
    expect(await pedidosDaTurmaNoBanco(professora.escolaId, turma.turmaId)).toEqual([{ estado: 'aprovada', temSenha: false, contaExterna: null }])
  })

  test('aprovado o pedido de conta, o aluno entra pela conta da escola, sem matrícula nem senha', async ({ page, request }) => {
    const { professora } = await aprovarOPedidoDeConta(request)

    // O botão "Entrar com a conta Google" da entrada da escola é um link para este endereço (13.0); abri-lo direto poupa a carga da página.
    await page.goto(`${PREFIXO_DO_LOGIN_EXTERNO}/google/iniciar?slug=${professora.slug}`)
    await entrarNoProvedorFalso(page, ALUNA_NO_PROVEDOR)

    // Primeira entrada do aluno aprovado: a introdução, com a sessão aberta pela conta, sem matrícula nem senha digitadas.
    await esperarIntroducaoDoAluno(page, { timeout: PRAZO_DO_LOGIN_EXTERNO_MS })
  })

  test('o botão, ocupado ao clicar ("Entrando…"), a 360 px sem rolagem horizontal e com alvo de 44 px', async ({ page, hasTouch }) => {
    const cenario = await criarCenario()
    const idas: string[] = []
    // Um 204 não navega: a página fica onde está, com o botão como o clique o deixou e o que a tela guardou à vista.
    await page.route('**/google/iniciar*', async (rota: Route) => {
      idas.push(rota.request().url())
      await rota.fulfill({ status: 204 })
    })

    await page.goto(`${cenario.endereco}#${cenario.acesso.token}`)
    await expect(botaoDaConta(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(botaoDaConta(page)).toHaveText('Entrar com a conta da escola')
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    const caixa = await botaoDaConta(page).boundingBox()
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)

    await activate(botaoDaConta(page), hasTouch)
    await expect(botaoDaConta(page)).toHaveText('Entrando…')
    await expect(botaoDaConta(page)).toBeDisabled()
    await expect(principal(page).getByRole('status').filter({ hasText: 'Entrando com a conta da escola…' })).toBeAttached()
    // O segundo clique, no botão já ocupado, não abre uma segunda ida: o `disabled` é a única trava (um clique despachado alcança o botão onde o toque real não alcançaria).
    await botaoDaConta(page).dispatchEvent('click')
    await page.evaluate(() => new Promise((resolver) => requestAnimationFrame(() => resolver(undefined))))
    // A ida levou a sala e a intenção; a tela guardou o slug, o tipo, o token e a hora, e nada mais, só no `sessionStorage`.
    expect(idas).toHaveLength(1)
    const iniciar = new URL(idas[0] ?? '')
    expect(iniciar.searchParams.get('slug')).toBe(cenario.escola.slug)
    expect(iniciar.searchParams.get('intencao')).toBe('reivindicar')
    expect(iniciar.searchParams.get('token')).toBe(cenario.acesso.token)
    const aoSair = await oQueFicouNoNavegador(page)
    const guardado = JSON.parse(aoSair.caminho ?? 'null') as Record<string, unknown>
    expect(Object.keys(guardado).sort()).toEqual(['em', 'slug', 'tipo', 'valor'])
    expect(guardado).toMatchObject({ slug: cenario.escola.slug, tipo: 'link', valor: cenario.acesso.token })
    expect(aoSair.local).toEqual([])
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('sem sessionStorage a tela não sai: o aviso manda usar a matrícula e a senha, nenhum pedido ao provedor sai e o botão continua livre', async ({ page, hasTouch }) => {
    const cenario = await criarCenario()
    let idas = 0
    await page.route('**/iniciar*', async (rota: Route) => {
      idas++
      await rota.abort()
    })
    await page.addInitScript((chave) => {
      const gravar = Storage.prototype.setItem
      Storage.prototype.setItem = function (this: Storage, nome: string, valor: string) {
        if (nome === chave) throw new DOMException('cheio', 'QuotaExceededError')
        gravar.call(this, nome, valor)
      }
    }, CHAVE_DO_CAMINHO)

    await page.goto(`${cenario.endereco}#${cenario.acesso.token}`)
    await expect(botaoDaConta(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(botaoDaConta(page), hasTouch)

    await expect(avisoDaTela(page)).toHaveText(TEXTO_SEM_ARMAZENAMENTO)
    await expect(botaoDaConta(page)).toBeEnabled()
    await expect(botaoDaConta(page)).toHaveText('Entrar com a conta da escola')
    await expect(campoDaSenha(page)).toBeVisible()
    expect(idas).toBe(0)
    expect(new URL(page.url()).pathname).toBe(cenario.endereco)
  })
})

test.describe('a volta do provedor, com o caminho semeado', () => {
  test('a conta que o servidor não reconhece (cookie vencido ou ausente): "Comece de novo pelo link ou pelo código da sala", sem pedido gravado; o código novo abre a sala e o aviso sai', async ({ page, hasTouch }) => {
    const cenario = await criarCenario()
    const [aluna] = cenario.lista
    if (aluna === undefined) throw new Error('lista sem nome')
    await semearOCaminho(page, { slug: cenario.escola.slug, tipo: 'link', valor: cenario.acesso.token })

    // Sem passar pelo provedor, o cookie da conta provada não existe: é a resposta real da API ao cookie vencido.
    await page.goto(`${cenario.endereco}?conta=provada`)
    await esperarASalaComAConta(page, cenario)
    await pedirONomeSemSenha(page, aluna.nome, aluna.matricula, hasTouch)

    await expect(avisoDaTela(page)).toHaveText(TEXTO_DA_CONTA_PERDIDA, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoDoCodigo(page)).toBeFocused()
    await expect(tituloDoPedido(page)).toHaveCount(0)
    expect(await pedidosDaTurmaNoBanco(cenario.escola.escolaId, cenario.turma.id)).toEqual([])
    // O recomeço: o código digitado abre a sala de novo, com a matrícula e a senha, e o aviso da tentativa anterior não fica.
    await campoDoCodigo(page).fill(cenario.acesso.codigo)
    await activate(principal(page).getByRole('button', { name: 'Abrir a turma' }), hasTouch)
    await expect(tituloDaTurma(page, cenario.turma.nome)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(avisoDaTela(page)).toHaveCount(0)
    await expect(campoDaSenha(page)).toBeVisible()
    await expect(botaoDaConta(page)).toBeVisible()
  })

  test('o caminho guardado há 16 minutos venceu: o aviso e o foco no código, e a API nem é chamada', async ({ page }) => {
    const cenario = await criarCenario()
    const aberturas: string[] = []
    page.on('request', (pedido) => {
      if (ehOAbrir(pedido.url())) aberturas.push(pedido.url())
    })
    await semearOCaminho(page, { slug: cenario.escola.slug, tipo: 'link', valor: cenario.acesso.token, minutosAtras: 16 })

    await page.goto(`${cenario.endereco}?conta=provada`)

    await expect(avisoDaTela(page)).toHaveText(TEXTO_DA_CONTA_PERDIDA, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoDoCodigo(page)).toBeFocused()
    expect(aberturas).toEqual([])
    expect(new URL(page.url()).search).toBe('')
    expect((await oQueFicouNoNavegador(page)).caminho).toBeNull()
  })

  test('o caminho guardado de outra sala não vale: o mesmo aviso, sem chamar a API', async ({ page }) => {
    const cenario = await criarCenario()
    const aberturas: string[] = []
    page.on('request', (pedido) => {
      if (ehOAbrir(pedido.url())) aberturas.push(pedido.url())
    })
    await semearOCaminho(page, { slug: `${cenario.escola.slug}-outra`, tipo: 'link', valor: cenario.acesso.token })

    await page.goto(`${cenario.endereco}?conta=provada`)

    await expect(avisoDaTela(page)).toHaveText(TEXTO_DA_CONTA_PERDIDA, { timeout: SIGN_IN_TIMEOUT_MS })
    expect(aberturas).toEqual([])
    expect((await oQueFicouNoNavegador(page)).caminho).toBeNull()
  })

  test('voltar do provedor de novo, na mesma aba: o parâmetro já saiu da barra, o caminho foi usado uma vez, e o colega que chega depois recomeça pelo link ou pelo código', async ({ page }) => {
    const cenario = await criarCenario()
    const aberturas: string[] = []
    page.on('request', (pedido) => {
      if (ehOAbrir(pedido.url())) aberturas.push(pedido.url())
    })
    await semearOCaminho(page, { slug: cenario.escola.slug, tipo: 'link', valor: cenario.acesso.token })

    await page.goto(`${cenario.endereco}?conta=provada`)
    await esperarASalaComAConta(page, cenario)
    expect(new URL(page.url()).search).toBe('')
    expect((await oQueFicouNoNavegador(page)).caminho).toBeNull()
    expect(aberturas).toHaveLength(1)

    // O mesmo endereço outra vez: nada sobrou do anterior, e a API não é chamada de novo.
    await page.goto(`${cenario.endereco}?conta=provada`)
    await expect(avisoDaTela(page)).toHaveText(TEXTO_DA_CONTA_PERDIDA, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoDoCodigo(page)).toBeFocused()
    expect(aberturas).toHaveLength(1)
  })

  test('a rede que cai ao abrir a sala pela volta mostra "Tentar de novo", que a abre ainda com a conta provada; a recusa do nome segue sem senha, com o foco na matrícula', async ({ page, hasTouch }) => {
    const cenario = await criarCenario()
    const [aluna] = cenario.lista
    if (aluna === undefined) throw new Error('lista sem nome')
    await semearOCaminho(page, { slug: cenario.escola.slug, tipo: 'codigo', valor: cenario.acesso.codigo })
    await page.route('**/v1/salas/abrir', (rota: Route) => rota.fulfill({ status: 503, contentType: 'application/json', headers: { 'Retry-After': '2' }, body: erro('INDISPONIVEL_TENTE_DE_NOVO') }), {
      times: 1,
    })

    await page.goto(`${cenario.endereco}?conta=provada`)
    // O aluno não digitou nada: a tela não o manda ao campo do código, oferece tentar de novo.
    await expect(avisoDaTela(page)).toHaveText(TEXTO_DO_SERVIDOR_CHEIO, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoDoCodigo(page)).toHaveCount(0)
    await activate(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await esperarASalaComAConta(page, cenario)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    await page.route('**/v1/salas/reivindicar', (rota: Route) => rota.fulfill({ status: 409, contentType: 'application/json', body: erro('REIVINDICACAO_RECUSADA') }), { times: 1 })
    await pedirONomeSemSenha(page, aluna.nome, aluna.matricula, hasTouch)
    await expect(avisoDaTela(page)).toHaveText(TEXTO_DA_RECUSA, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoDaMatricula(page)).toBeFocused()
    await expect(principal(page).getByText(TEXTO_DA_CONTA_CONFIRMADA)).toBeVisible()
    await expect(campoDaSenha(page)).toHaveCount(0)
  })

  test('depois do pedido da conta, "Voltar à lista de nomes" é o formulário de matrícula e senha, com o botão da conta e nada do aluno anterior', async ({ page, hasTouch }) => {
    const cenario = await criarCenario()
    const [aluna] = cenario.lista
    if (aluna === undefined) throw new Error('lista sem nome')
    await semearOCaminho(page, { slug: cenario.escola.slug, tipo: 'link', valor: cenario.acesso.token })
    await page.route('**/v1/salas/reivindicar', (rota: Route) => rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ resultado: 'enviado' }) }))

    await page.goto(`${cenario.endereco}?conta=provada`)
    await esperarASalaComAConta(page, cenario)
    await pedirONomeSemSenha(page, aluna.nome, aluna.matricula, hasTouch)
    await expect(tituloDoPedido(page)).toBeFocused({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page)).toContainText(TEXTO_DA_ESPERA)
    expect(await seriousViolations(page)).toEqual([])
    expect(await horizontalOverflow(page)).toBe(0)

    await activate(principal(page).getByRole('button', { name: 'Voltar à lista de nomes' }), hasTouch)
    await expect(tituloDaTurma(page, cenario.turma.nome)).toBeFocused({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoDaSenha(page)).toBeVisible()
    await expect(botaoDaConta(page)).toBeVisible()
    await expect(campoDaMatricula(page)).toHaveValue('')
    for (const radio of await principal(page).getByRole('radio').all()) await expect(radio).not.toBeChecked()
    await expect(principal(page).getByText(TEXTO_DA_CONTA_CONFIRMADA)).toHaveCount(0)
    await expect(avisoDaTela(page)).toHaveCount(0)
    expect((await oQueFicouNoNavegador(page)).caminho).toBeNull()
  })
})
