import type { Page, Request, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO, mensagemDaEntrada } from '../packages/shared/src/errors/messages.ts'
import { criarEquipeComSenha, criarUsuarioEmOutraEscola, type EquipeDeTeste } from './__fixtures__/sessao.ts'
import { entrarPelaApiSemMedirAPrimeiraCarga, esperarNovaConversa } from './__fixtures__/casca.ts'
import { expect, test } from './__fixtures__/perfis.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, codigoCru, focoVisivel, larguraExcedente, violacoesGraves } from './__fixtures__/verificacoes.ts'

const ROTA_ENTRAR = '**/v1/sessao/email'
const ROTA_RENOVAR = '**/v1/sessao/renovar'
const ROTA_EU = '**/v1/eu'
const ROTA_SESSAO = '**/v1/sessao'
/** O Chromebook com CPU ×4 e rede Fast 3G carrega a página e ainda faz o hash da senha no servidor. */
const PRAZO_DA_ENTRADA_MS = 20_000
/**
 * O início de uma renovação (`request`) e o fim da anterior (`requestfinished`) chegam ao teste por duas abas, cada uma com a
 * sua sessão do CDP, e são datados na entrega, não no navegador: com a trava, a folga entre uma e a outra medida aqui foi de 1 a
 * 7 ms em 40 corridas, e a esteira (run 40006927589, 23/10/2026) pegou −1 ms. Sem a trava a sobreposição é de ~1 s (a espera de `ROTA_RENOVAR`
 * no caso), então 250 ms separa o relógio da corrida real com folga dos dois lados.
 */
const TOLERANCIA_DO_RELOGIO_MS = 250

const envelope = (codigo: keyof typeof MENSAGENS_DE_ERRO) => ({
  erro: { codigo, mensagem: 'mensagem da API que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' },
})

function falharCom(status: number, codigo: keyof typeof MENSAGENS_DE_ERRO, cabecalhos: Record<string, string> = {}) {
  return (rota: Route) =>
    rota.fulfill({ status, headers: { 'Content-Type': 'application/json', ...cabecalhos }, body: JSON.stringify(envelope(codigo)) })
}

const campoEmail = (page: Page) => page.getByLabel('E-mail')
const campoSenha = (page: Page) => page.getByLabel('Senha')
const botaoEntrar = (page: Page) => page.getByRole('button', { name: /Entrar|Entrando/ })

/** Toque no celular, clique no Chromebook: a mesma ação pela entrada que cada aparelho tem. */
async function acionar(page: Page, nome: string | RegExp, hasTouch: boolean): Promise<void> {
  const alvo = page.getByRole('button', { name: nome })
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

async function esperarAlvoDeToque(page: Page, nome: string | RegExp): Promise<void> {
  const caixa = await page.getByRole('button', { name: nome }).boundingBox()
  expect(caixa, `${String(nome)} sem caixa`).not.toBeNull()
  expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
}

/**
 * A área autenticada com a pessoa e a escola na tela: é o que prova que o token da sessão vale. Quem entra aqui é a
 * professora, que abre em "Nova conversa" (A2; D73), com o nome dela e o da escola na casca.
 */
async function esperarAreaAutenticada(page: Page, equipe: EquipeDeTeste): Promise<void> {
  await esperarNovaConversa(page, equipe.nome, { escolaNome: equipe.escolaNome })
  // No celular há dois "Sair": o da barra do topo, à vista, e o da lateral, na gaveta fechada.
  await expect(page.getByRole('button', { name: 'Sair' }).first()).toBeVisible()
}

/** O que a aba guardou depois de uma etapa que ainda não gravou sessão: precisa ser nada. */
async function nadaGuardado(page: Page): Promise<void> {
  const guardado = await page.evaluate(() => ({
    local: JSON.stringify(Object.entries(localStorage)),
    sessao: JSON.stringify(Object.entries(sessionStorage)),
  }))
  expect(guardado.local).toBe('[]')
  expect(guardado.sessao).toBe('[]')
  expect(await page.context().cookies()).not.toContainEqual(expect.objectContaining({ name: 'educa_sessao' }))
}

/** Entra pelo formulário, do jeito que o aparelho do projeto permite. */
async function entrar(page: Page, equipe: EquipeDeTeste, hasTouch: boolean): Promise<void> {
  await campoEmail(page).fill(equipe.email)
  await campoSenha(page).fill(equipe.senha)
  await acionar(page, /^Entrar$/, hasTouch)
}

test.describe('entrada da equipe por e-mail e senha', () => {
  test('caminho feliz só com teclado: Tab, Tab e Enter levam da entrada à área autenticada, com foco visível', async ({ page }) => {
    const equipe = await criarEquipeComSenha()
    await page.goto('/entrar')

    await page.keyboard.press('Tab')
    await expect(campoEmail(page)).toBeFocused()
    expect(await focoVisivel(page)).toBe(true)
    await page.keyboard.type(equipe.email)

    await page.keyboard.press('Tab')
    await expect(campoSenha(page)).toBeFocused()
    expect(await focoVisivel(page)).toBe(true)
    await page.keyboard.type(equipe.senha)

    // Enter dentro do formulário envia: ninguém precisa alcançar o botão para entrar.
    await page.keyboard.press('Enter')
    await esperarAreaAutenticada(page, equipe)
    expect(new URL(page.url()).pathname).toBe('/professor/nova-conversa')

    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('caminho feliz só com toque: campos e botão alcançados por toque, com alvo de 44 px e sem rolagem horizontal', async ({ page, hasTouch }) => {
    const equipe = await criarEquipeComSenha()
    await page.goto('/entrar')

    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await esperarAlvoDeToque(page, /^Entrar$/)

    if (hasTouch) await campoEmail(page).tap()
    else await campoEmail(page).click()
    await page.keyboard.type(equipe.email)
    if (hasTouch) await campoSenha(page).tap()
    else await campoSenha(page).click()
    await page.keyboard.type(equipe.senha)
    await acionar(page, /^Entrar$/, hasTouch)

    await esperarAreaAutenticada(page, equipe)
    await esperarAlvoDeToque(page, 'Sair')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('etapa configurar_mfa: a coordenadora sem segundo fator chega à tela do MFA, e não à área autenticada nem de volta à entrada', async ({
    page,
    hasTouch,
  }) => {
    const equipe = await criarEquipeComSenha('coordenador')
    await page.goto('/entrar')
    await entrar(page, equipe, hasTouch)

    // Quem decide a compra é ela, e é ela que passa por esta etapa no primeiro acesso (RF12).
    await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveURL(/\/mfa\/configurar$/)
    // A tela da etapa chegou na 19.0: o que ela mostra e o que faz está em `mfa.spec.ts`; aqui vale que a etapa leva
    // a ela, e que nada da escola aparece antes da sessão existir.
    await expect(page.getByRole('main')).toContainText('1. Guarde o segredo no seu aplicativo', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText(equipe.escolaNome)
    // Nenhuma sessão foi gravada nesta etapa: nem token, nem cookie de renovação.
    await nadaGuardado(page)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('etapa escolher: a professora com vínculo em duas escolas chega à escolha de escola, sem sessão gravada', async ({ page, hasTouch }) => {
    const equipe = await criarEquipeComSenha()
    await criarUsuarioEmOutraEscola(equipe.contaId)
    await page.goto('/entrar')
    await entrar(page, equipe, hasTouch)

    await expect(page.getByRole('heading', { name: 'Escolher a escola' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveURL(/\/escolher-escola$/)
    // A tela da escolha chegou na 20.0: o que ela mostra e o que faz está em `escola-e-vinculos.spec.ts`; aqui vale
    // que a etapa leva a ela e que nenhuma sessão foi gravada antes de a escola ser escolhida.
    await expect(page.getByRole('main')).toContainText('Escolha por onde quer entrar agora')
    await nadaGuardado(page)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('privacidade: depois de entrar, o token não está em localStorage, sessionStorage, cookie legível nem na URL', async ({ page, hasTouch }) => {
    const equipe = await criarEquipeComSenha()
    await page.goto('/entrar')
    const respostaDoLogin = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/sessao/email')
    await entrar(page, equipe, hasTouch)
    await esperarAreaAutenticada(page, equipe)

    const corpo = (await (await respostaDoLogin).json()) as { token: string }
    expect(corpo.token.length).toBeGreaterThan(20)

    const guardado = await page.evaluate(() => ({
      local: JSON.stringify(Object.entries(localStorage)),
      sessao: JSON.stringify(Object.entries(sessionStorage)),
      cookies: document.cookie,
      url: location.href,
      corpo: document.body.innerHTML,
    }))
    // O Chromebook do carrinho passa por quatro turmas: nada do token pode sobrar onde a próxima pessoa alcance.
    for (const [onde, conteudo] of Object.entries(guardado)) {
      expect(conteudo, `token encontrado em ${onde}`).not.toContain(corpo.token)
    }
    expect(guardado.local).toBe('[]')
    expect(guardado.sessao).toBe('[]')
    // O cookie de renovação é HttpOnly: o JavaScript da página não o enxerga.
    expect(guardado.cookies).not.toContain('educa_sessao')
    expect(await page.context().cookies()).toContainEqual(expect.objectContaining({ name: 'educa_sessao', httpOnly: true, path: '/v1/sessao' }))
  })

  test('concorrência: duas abas com o token só no cookie renovam uma de cada vez, e nenhuma cai na entrada', async ({ page, context, hasTouch }) => {
    const equipe = await criarEquipeComSenha()
    await page.goto('/entrar')
    await entrar(page, equipe, hasTouch)
    await esperarAreaAutenticada(page, equipe)

    // A renovação segurada por 1 s: sem a trava das Web Locks, as duas abas se cruzariam aqui, e uma delas
    // apresentaria o cookie que a outra acabou de rotacionar (reuso de refresh, que encerra a família).
    await context.route(ROTA_RENOVAR, async (rota) => {
      await new Promise((resolver) => setTimeout(resolver, 1_000))
      await rota.continue()
    })
    const janelas: { inicio: number; fim: number }[] = []
    const abertas = new Map<Request, number>()
    const ehRenovacao = (pedido: Request) => new URL(pedido.url()).pathname === '/v1/sessao/renovar'
    context.on('request', (pedido) => {
      if (ehRenovacao(pedido)) abertas.set(pedido, Date.now())
    })
    context.on('requestfinished', (pedido) => {
      const inicio = abertas.get(pedido)
      if (inicio !== undefined) janelas.push({ inicio, fim: Date.now() })
    })

    const abaB = await context.newPage()
    const abaC = await context.newPage()
    await Promise.all([abaB.goto('/'), abaC.goto('/')])
    await Promise.all([esperarAreaAutenticada(abaB, equipe), esperarAreaAutenticada(abaC, equipe)])

    expect(janelas.length, 'as duas abas renovaram pelo cookie').toBeGreaterThanOrEqual(2)
    const ordenadas = [...janelas].sort((a, b) => a.inicio - b.inicio)
    for (const [posicao, janela] of ordenadas.entries()) {
      const anterior = ordenadas[posicao - 1]
      if (anterior) expect(janela.inicio, 'duas renovações ao mesmo tempo').toBeGreaterThanOrEqual(anterior.fim - TOLERANCIA_DO_RELOGIO_MS)
    }
    for (const aba of [abaB, abaC]) await expect(aba).not.toHaveURL(/\/entrar$/)
  })

  test('falha: sem rede, a entrada mostra o que fazer, guarda o que foi digitado, e ao religar entra', async ({ page, hasTouch }) => {
    const equipe = await criarEquipeComSenha()
    await page.goto('/entrar')
    await campoEmail(page).fill(equipe.email)
    await campoSenha(page).fill(equipe.senha)

    // A rede é cortada abortando o pedido, como em `casca.spec.ts`: o `context.setOffline` disputaria o
    // `Network.emulateNetworkConditions` que o perfil do projeto já aplica pelo CDP, e o pedido ficaria pendurado.
    let semRede = true
    await page.route(ROTA_ENTRAR, (rota) => (semRede ? rota.abort('internetdisconnected') : rota.continue()))
    await acionar(page, /^Entrar$/, hasTouch)
    await expect(page.getByRole('alert')).toContainText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    // O que a pessoa digitou fica, os dois campos: perder o formulário por causa da rede da escola é o mesmo erro de
    // perder resposta de prova.
    await expect(campoEmail(page)).toHaveValue(equipe.email)
    await expect(campoSenha(page)).toHaveValue(equipe.senha)
    await expect(page).toHaveURL(/\/entrar$/)

    semRede = false
    await acionar(page, /^Entrar$/, hasTouch)
    await esperarAreaAutenticada(page, equipe)
  })

  test('falha: 503 numa consulta da área autenticada mantém a tela e o "Sair", sem mandar ninguém para a entrada', async ({ page, hasTouch }) => {
    const equipe = await criarEquipeComSenha()
    await entrarPelaApiSemMedirAPrimeiraCarga(page, equipe, '/professor/nova-conversa', () => esperarAreaAutenticada(page, equipe))

    let fora = true
    await page.route(ROTA_EU, (rota) => (fora ? falharCom(503, 'INDISPONIVEL_TENTE_DE_NOVO')(rota) : rota.continue()))
    // Recarregar é o caso real: a sessão volta pelo cookie, e é a consulta da tela que cai.
    await page.reload()
    await expect(page.getByRole('alert')).toContainText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).not.toHaveURL(/\/entrar$/)
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

    fora = false
    await acionar(page, 'Tentar de novo', hasTouch)
    await esperarAreaAutenticada(page, equipe)
  })

  test('rajada das 7h30: o 503 do semáforo vira "Entrando…", e a entrada acontece sozinha, sem erro na tela', async ({ page, hasTouch }) => {
    const equipe = await criarEquipeComSenha()
    let recusas = 2
    await page.route(ROTA_ENTRAR, (rota) => {
      if (recusas-- > 0) return falharCom(503, 'INDISPONIVEL_TENTE_DE_NOVO', { 'Retry-After': '1' })(rota)
      return rota.continue()
    })

    await page.goto('/entrar')
    await entrar(page, equipe, hasTouch)
    // Enquanto a web repete sozinha, o botão diz "Entrando…" e nenhuma mensagem de erro aparece.
    await expect(botaoEntrar(page)).toHaveText('Entrando…')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await esperarAreaAutenticada(page, equipe)
    expect(recusas, 'o 503 precisa ter sido repetido pela web').toBeLessThanOrEqual(0)
  })

  test('clique repetido em "Entrar" não manda dois logins: com o pedido em andamento, o botão fica desabilitado', async ({ page, hasTouch }) => {
    const equipe = await criarEquipeComSenha()
    let pedidos = 0
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_ENTRAR, async (rota) => {
      pedidos++
      await segurada
      await rota.continue()
    })

    await page.goto('/entrar')
    await campoEmail(page).fill(equipe.email)
    await campoSenha(page).fill(equipe.senha)
    await acionar(page, /^Entrar$/, hasTouch)

    await expect(botaoEntrar(page)).toBeDisabled()
    // Dois logins da mesma pessoa gravariam duas sessões e duas linhas de registro de acesso.
    await botaoEntrar(page).dispatchEvent('click')
    liberar()
    await esperarAreaAutenticada(page, equipe)
    expect(pedidos).toBe(1)
  })

  test('clique repetido em "Sair" não manda dois encerramentos: o segundo cairia na sessão que o primeiro já encerrou', async ({
    page,
    hasTouch,
  }) => {
    const equipe = await criarEquipeComSenha()
    await page.goto('/entrar')
    await entrar(page, equipe, hasTouch)
    await esperarAreaAutenticada(page, equipe)

    let encerramentos = 0
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_SESSAO, async (rota) => {
      if (rota.request().method() !== 'DELETE') return rota.continue()
      encerramentos++
      await segurada
      await rota.continue()
    })

    await acionar(page, 'Sair', hasTouch)
    await expect(page.getByRole('button', { name: /Saindo/ })).toBeDisabled()
    await page.getByRole('button', { name: /Saindo/ }).dispatchEvent('click')
    liberar()
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(encerramentos).toBe(1)
  })

  test('Chromebook do carrinho: depois que a primeira pessoa sai, a seguinte nunca vê o nome nem a escola dela', async ({ page, hasTouch }) => {
    const primeira = await criarEquipeComSenha()
    const segunda = await criarEquipeComSenha()
    await page.goto('/entrar')
    await entrar(page, primeira, hasTouch)
    await esperarAreaAutenticada(page, primeira)

    await acionar(page, 'Sair', hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })

    // A consulta de quem entrou fica segurada: é a janela em que o cache da pessoa anterior apareceria, e sem
    // limpá-lo o TanStack Query a devolveria pronta, sem nem refazer a chamada.
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_EU, async (rota) => {
      await segurada
      await rota.continue()
    })

    // Mesma aba, sem recarregar a página: é assim que o aluno seguinte usa o computador do carrinho.
    await entrar(page, segunda, hasTouch)
    await expect(page.getByText('Carregando a sua escola…')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText(primeira.nome)
    await expect(page.locator('body')).not.toContainText(primeira.escolaNome)

    liberar()
    await esperarAreaAutenticada(page, segunda)
    await expect(page.locator('body')).not.toContainText(primeira.nome)
    await expect(page.locator('body')).not.toContainText(primeira.escolaNome)
  })

  test('"Sair" que a API não confirma avisa na entrada, porque a sessão continua viva no servidor', async ({ page, hasTouch }) => {
    const equipe = await criarEquipeComSenha()
    await entrarPelaApiSemMedirAPrimeiraCarga(page, equipe, '/professor/nova-conversa', () => esperarAreaAutenticada(page, equipe))

    let encerramentos = 0
    await page.route(ROTA_SESSAO, (rota) => {
      if (rota.request().method() !== 'DELETE') return rota.continue()
      encerramentos++
      return rota.abort('internetdisconnected')
    })
    const renovacoesDepoisDaSaida: string[] = []
    page.on('request', (pedido) => {
      if (new URL(pedido.url()).pathname === '/v1/sessao/renovar' && encerramentos > 0) renovacoesDepoisDaSaida.push(pedido.url())
    })

    await acionar(page, 'Sair', hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    // Apresentar a saída como feita é o que põe a pessoa seguinte na sessão desta.
    await expect(page.getByRole('alert')).toContainText('Não foi possível encerrar a sessão anterior neste computador')
    expect(encerramentos, 'a saída precisa ser repetida uma vez antes de avisar').toBe(2)
    await expect(page.locator('body')).not.toContainText(equipe.nome)
    // Uma renovação aqui reabriria, pelo cookie que sobreviveu, a sessão que a pessoa acabou de encerrar.
    expect(renovacoesDepoisDaSaida, 'renovação depois do "Sair" ressuscita a sessão').toEqual([])
    // A entrada com o aviso é uma variante de layout como outra qualquer.
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // E o aviso não é decorativo: o cookie de renovação sobreviveu, e a sessão volta inteira.
    await page.unroute(ROTA_SESSAO)
    await page.goto('/')
    await esperarAreaAutenticada(page, equipe)
  })

  test('conta segurada: a tela diz em português quanto esperar, sem código nem status HTTP', async ({ page, hasTouch }) => {
    const equipe = await criarEquipeComSenha()
    await page.route(ROTA_ENTRAR, falharCom(429, 'CONTA_SEGURADA', { 'Retry-After': '90' }))
    await page.goto('/entrar')
    await entrar(page, equipe, hasTouch)

    const alerta = page.getByRole('alert')
    await expect(alerta).toHaveText(mensagemDaEntrada('CONTA_SEGURADA', 90), { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(alerta).toContainText('2 minutos')
    const tela = page.locator('body')
    for (const proibido of [codigoCru('429'), 'CONTA_SEGURADA', 'mensagem da API']) {
      await expect(tela).not.toContainText(proibido)
    }
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('senha errada e e-mail que não existe dizem a mesma coisa, sem revelar se a conta existe', async ({ page, hasTouch }) => {
    const equipe = await criarEquipeComSenha()
    await page.goto('/entrar')

    await campoEmail(page).fill(equipe.email)
    await campoSenha(page).fill('senha-que-nao-e-dela')
    await acionar(page, /^Entrar$/, hasTouch)
    const comSenhaErrada = await page.getByRole('alert').textContent({ timeout: PRAZO_DA_ENTRADA_MS })

    await page.reload()
    await campoEmail(page).fill(`ninguem-${Date.now().toString()}@educa.invalid`)
    await campoSenha(page).fill(equipe.senha)
    await acionar(page, /^Entrar$/, hasTouch)
    const comEmailInexistente = await page.getByRole('alert').textContent({ timeout: PRAZO_DA_ENTRADA_MS })

    expect(comSenhaErrada).toBe(comEmailInexistente)
    expect(comSenhaErrada).toBe(mensagemDaEntrada('NAO_AUTENTICADO'))
    await expect(page).toHaveURL(/\/entrar$/)
  })

  test('permissão: sem sessão a rota autenticada leva à entrada; "Sair" encerra, e Voltar não traz a tela com dado', async ({ page, hasTouch }) => {
    const equipe = await criarEquipeComSenha()
    await page.goto('/')
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(campoSenha(page)).toBeVisible()

    await entrar(page, equipe, hasTouch)
    await esperarAreaAutenticada(page, equipe)

    await acionar(page, 'Sair', hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText(equipe.nome)

    await page.goBack()
    await expect(page.locator('body')).not.toContainText(equipe.nome)
    await expect(page.locator('body')).not.toContainText(equipe.escolaNome)

    // O cookie de renovação foi apagado no "Sair": recarregar a área autenticada volta para a entrada.
    await page.goto('/')
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
  })
})
