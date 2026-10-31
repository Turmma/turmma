import { randomUUID } from 'node:crypto'
import type { Browser, BrowserContext, BrowserContextOptions, Locator, Page, Route } from '@playwright/test'
import { PRAZO_DA_ENTRADA_MS } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import {
  criarEscolaSintetica,
  gerarAcessoDaSalaNoBanco,
  montarEstruturaNoBanco,
  pedidosPendentesDaTurma,
  porNaListaDaTurma,
  tomarNomeNoBanco,
  type AcessoDaSalaDeTeste,
  type EscolaDeTeste,
} from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, codigoCru, focoVisivel, larguraExcedente, violacoesGraves } from './support/checks.ts'

/**
 * A página pública da turma, `/e/<slug>/turma` (A1, tarefa 17.0; `tasks/prd-apresentacao-escola/cenarios.md`): W8, W11,
 * W4 e W12 da página pública, e o recomeço da tela. Tudo pela tela, nos projetos `chromebook` e `celular`, com escola,
 * turma e nomes inventados pelo teste; o acesso nasce no banco com link e código conhecidos, pelas peças da API. Os
 * textos esperados estão aqui por extenso: é o W9 visto pelo aluno.
 */

const TEXTO_DO_CODIGO = 'Não encontramos turma com este código. Confira as letras e os números; se estiver certo, peça o código atual ao professor.'
const TEXTO_DO_LINK = 'Este link não vale mais. Peça o código atual ao professor.'
const TEXTO_DA_RECUSA = 'Não foi possível enviar. Confira a matrícula; se estiver certa, chame o professor.'
const TEXTO_TENTANDO = 'O sistema está cheio agora. Tentando de novo…'
const TEXTO_CHEIO = 'O sistema está cheio agora.'
const TEXTO_DO_NOME_QUE_FALTA = 'Se o seu nome não aparece, chame o professor.'
const AVISO_DA_ESPERA = 'Até a aprovação, a entrada da escola responde “Matrícula ou senha incorretas”. Não é erro: é só esperar o professor aprovar.'
const TEXTO_DA_DECISAO = 'Quem aprova ou recusa é uma pessoa: o professor da turma ou a coordenação.'
const TEXTO_DA_RECUSA_DEPOIS = 'Se o pedido for recusado, o seu nome volta para a lista, e você pode pedir de novo.'
const SENHA = 'uma frase que só eu sei'

const erro = (codigo: string) => JSON.stringify({ erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })

const ehOAbrir = (url: string) => new URL(url).pathname === '/v1/salas/abrir'
const ehOReivindicar = (url: string) => new URL(url).pathname === '/v1/salas/reivindicar'

const principal = (page: Page) => page.getByRole('main')
const campoDoCodigo = (page: Page) => principal(page).getByLabel('Código da turma')
const campoDaMatricula = (page: Page) => principal(page).getByLabel('Matrícula')
const campoDaSenha = (page: Page) => principal(page).getByLabel('Crie uma senha')
const botaoMostrar = (page: Page) => principal(page).getByRole('button', { name: 'Mostrar a senha' })
const botaoEnviar = (page: Page) => principal(page).getByRole('button', { name: /^(Enviar pedido|Enviando…|Tentar de novo)$/ })
const tituloDaTurma = (page: Page, nome: string) => principal(page).getByRole('heading', { level: 2, name: `Turma ${nome}` })
const tituloDoPedido = (page: Page) => principal(page).getByRole('heading', { level: 2, name: 'Pedido enviado' })
const aviso = (page: Page) => principal(page).getByRole('alert')

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Uma porta que segura a resposta até o teste abrir. */
function portao(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

async function alvoDeToque(alvo: Locator, descricao: string): Promise<void> {
  const caixa = await alvo.boundingBox()
  expect(caixa, `${descricao} sem caixa`).not.toBeNull()
  expect(caixa?.height ?? 0, descricao).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
}

/** Os ids que descrevem um elemento, pelo `aria-describedby`. */
async function descritoPor(alvo: Locator): Promise<string[]> {
  return ((await alvo.getAttribute('aria-describedby')) ?? '').split(' ').filter((id) => id !== '')
}

interface Cenario {
  readonly escola: EscolaDeTeste
  readonly turma: { readonly id: string; readonly nome: string }
  readonly lista: ReadonlyArray<{ readonly nome: string; readonly matricula: string }>
  readonly acesso: AcessoDaSalaDeTeste
}

/** Uma escola com uma turma, os nomes livres dados (ou nenhum) e um acesso vigente com link e código conhecidos. */
async function criarCenario(quantos = 3, prefixo = 'Aluna sintética'): Promise<Cenario> {
  const escola = await criarEscolaSintetica()
  const estrutura = await montarEstruturaNoBanco(escola.escolaId, ['7A'])
  const turma = estrutura.turmas[0]
  if (turma === undefined) throw new Error('estrutura sem turma')
  const marca = randomUUID().slice(0, 8)
  const lista = Array.from({ length: quantos }, (_, indice) => ({ nome: `${prefixo} ${String(indice + 1)} ${marca}`, matricula: `M${String(indice + 1)}-${marca}` }))
  await porNaListaDaTurma(escola.escolaId, turma.id, lista)
  const acesso = await gerarAcessoDaSalaNoBanco(escola.escolaId, turma.id)
  return { escola, turma, lista, acesso }
}

const enderecoDaSala = (cenario: Pick<Cenario, 'escola'>) => `/e/${cenario.escola.slug}/turma`

/** Escolhe o nome, digita a matrícula e a senha, e envia. */
async function pedirONome(page: Page, nome: string, matricula: string, hasTouch: boolean): Promise<void> {
  await acionar(principal(page).getByRole('radio', { name: nome }), hasTouch)
  await campoDaMatricula(page).fill(matricula)
  await campoDaSenha(page).fill(SENHA)
  await acionar(botaoEnviar(page), hasTouch)
}

/** Outro navegador, com as opções do projeto: é o segundo computador da sala. */
const contextos: BrowserContext[] = []
async function outroNavegador(browser: Browser): Promise<Page> {
  const uso = test.info().project.use
  const opcoes: BrowserContextOptions = {}
  if (uso.baseURL !== undefined) opcoes.baseURL = uso.baseURL
  if (uso.viewport !== undefined) opcoes.viewport = uso.viewport
  if (uso.isMobile !== undefined) opcoes.isMobile = uso.isMobile
  if (uso.hasTouch !== undefined) opcoes.hasTouch = uso.hasTouch
  if (uso.userAgent !== undefined) opcoes.userAgent = uso.userAgent
  if (uso.deviceScaleFactor !== undefined) opcoes.deviceScaleFactor = uso.deviceScaleFactor
  if (uso.locale !== undefined) opcoes.locale = uso.locale
  if (uso.timezoneId !== undefined) opcoes.timezoneId = uso.timezoneId
  const contexto = await browser.newContext(opcoes)
  contextos.push(contexto)
  return contexto.newPage()
}

test.afterEach(async () => {
  for (const contexto of contextos.splice(0)) await contexto.close()
})

test.describe('W8, W11 e W4 (Pública): pelo link', () => {
  test('o token sai da barra antes da primeira chamada; os nomes livres; os campos; o pedido enviado e o aviso da espera; nada fica no navegador; o aluno seguinte não vê nada do anterior', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const cenario = await criarCenario(3)
    const [primeira, segunda, terceira] = cenario.lista
    if (primeira === undefined || segunda === undefined || terceira === undefined) throw new Error('lista sem os três nomes')
    // Um nome já pedido por outro aluno: a sala mostra só os livres.
    const tomado = `Aluno já pedido ${randomUUID().slice(0, 8)}`
    await porNaListaDaTurma(cenario.escola.escolaId, cenario.turma.id, [{ nome: tomado, matricula: `X-${randomUUID().slice(0, 8)}`, estado: 'reivindicado' }])
    const enderecos: string[] = []
    page.on('request', (pedido) => enderecos.push(pedido.url()))

    // A abertura fica segurada: é a janela em que o token ainda estaria na barra se a tela o tivesse deixado lá.
    const segurada = portao()
    let barraNaPrimeiraChamada = ''
    await page.route('**/v1/salas/abrir', async (rota: Route) => {
      if (barraNaPrimeiraChamada === '') barraNaPrimeiraChamada = page.url()
      await segurada.aberta
      await rota.continue()
    })
    await page.goto(`${enderecoDaSala(cenario)}#${cenario.acesso.token}`)
    await expect.poll(() => barraNaPrimeiraChamada, { timeout: PRAZO_DA_ENTRADA_MS }).not.toBe('')
    expect(barraNaPrimeiraChamada, 'o token precisa sair da barra antes de a primeira chamada sair').not.toContain('#')
    expect(barraNaPrimeiraChamada).not.toContain(cenario.acesso.token)
    // Carregando: o texto, e nada da turma ainda.
    await expect(principal(page).getByRole('status').filter({ hasText: 'Abrindo a turma…' })).toBeVisible()
    await expect(page).toHaveTitle('Entrar na turma · Turmma')
    segurada.abrir()

    // Com dado: a turma, com o foco no título, e só os nomes livres, sem matrícula.
    await expect(tituloDaTurma(page, cenario.turma.nome)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('radio')).toHaveCount(3)
    for (const { nome, matricula } of cenario.lista) {
      await expect(principal(page).getByRole('radio', { name: nome })).toBeVisible()
      await expect(principal(page)).not.toContainText(matricula)
    }
    await expect(principal(page)).not.toContainText(tomado)
    await expect(principal(page)).toContainText(TEXTO_DO_NOME_QUE_FALTA)

    // W11: matrícula com teclado de texto, sem preenchimento automático; a senha também, com os 12 caracteres avisados
    // e o "Mostrar".
    await expect(campoDaMatricula(page)).toHaveAttribute('inputmode', 'text')
    await expect(campoDaMatricula(page)).toHaveAttribute('autocomplete', 'off')
    await expect(campoDaSenha(page)).toHaveAttribute('autocomplete', 'off')
    await expect(campoDaSenha(page)).toHaveAttribute('type', 'password')
    await expect(campoDaSenha(page)).toHaveAttribute('minlength', '12')
    await expect(campoDaSenha(page)).toHaveAccessibleDescription(/Pelo menos 12 caracteres\./)
    await expect(botaoMostrar(page)).toHaveAttribute('aria-pressed', 'false')
    await campoDaSenha(page).fill(SENHA)
    await acionar(botaoMostrar(page), hasTouch)
    await expect(campoDaSenha(page)).toHaveAttribute('type', 'text')
    await expect(botaoMostrar(page)).toHaveAttribute('aria-pressed', 'true')
    await acionar(botaoMostrar(page), hasTouch)
    await expect(campoDaSenha(page)).toHaveAttribute('type', 'password')
    expect(await violacoesGraves(page)).toEqual([])
    expect(await larguraExcedente(page)).toBe(0)
    for (const alvo of [principal(page).getByRole('radio', { name: primeira.nome }).locator('xpath=ancestor::label'), botaoMostrar(page), botaoEnviar(page)])
      await alvoDeToque(alvo, (await alvo.textContent()) ?? 'alvo')

    // Sem o nome escolhido, nada sai: a tela diz o que falta, com o foco no primeiro nome, que o leitor de tela lê com o
    // aviso do grupo.
    let envios = 0
    page.on('request', (requisicao) => {
      if (ehOReivindicar(requisicao.url())) envios++
    })
    await campoDaMatricula(page).fill(segunda.matricula)
    await acionar(botaoEnviar(page), hasTouch)
    const faltaONome = principal(page).getByText('Escolha o seu nome na lista.')
    await expect(faltaONome).toBeVisible()
    await expect(principal(page).getByRole('radio').first()).toBeFocused()
    expect(await descritoPor(principal(page).getByRole('group', { name: 'Escolha o seu nome' }))).toContain(await faltaONome.getAttribute('id'))
    expect(envios).toBe(0)

    // O envio: um pedido, que espera a decisão de uma pessoa.
    const pedido = page.waitForRequest((requisicao) => ehOReivindicar(requisicao.url()))
    await pedirONome(page, segunda.nome, segunda.matricula, hasTouch)
    const corpo = (await pedido).postDataJSON() as { chaveEnvio: string; token?: string; codigo?: string; matricula: string }
    expect(corpo.token).toBe(cenario.acesso.token)
    expect(corpo.codigo).toBeUndefined()
    expect(corpo.matricula).toBe(segunda.matricula)
    await expect(tituloDoPedido(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page)).toContainText(AVISO_DA_ESPERA)
    await expect(principal(page)).toContainText(TEXTO_DA_DECISAO)
    await expect(principal(page)).toContainText(TEXTO_DA_RECUSA_DEPOIS)
    await expect(principal(page).getByRole('link', { name: 'Ir para a entrada da escola' })).toHaveAttribute('href', `/e/${cenario.escola.slug}`)
    // Nada do pedido na tela: nem o nome, nem a matrícula.
    await expect(principal(page)).not.toContainText(segunda.nome)
    await expect(principal(page)).not.toContainText(segunda.matricula)
    expect(await pedidosPendentesDaTurma(cenario.escola.escolaId, cenario.turma.id)).toBe(1)
    expect(await violacoesGraves(page)).toEqual([])

    // Sem rastro: nomes, matrícula, senha, token e chave fora do armazenamento do navegador, do endereço e de toda URL.
    const guardado = await page.evaluate(async () => ({
      texto: JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), location.href]),
      bancos: (await indexedDB.databases()).map((banco) => banco.name),
      caches: await caches.keys(),
    }))
    for (const dado of [...cenario.lista.map(({ nome }) => nome), segunda.matricula, SENHA, cenario.acesso.token, corpo.chaveEnvio]) expect(guardado.texto).not.toContain(dado)
    expect(guardado.bancos).toEqual([])
    expect(guardado.caches).toEqual([])
    for (const endereco of enderecos) {
      expect(endereco).not.toContain(cenario.acesso.token)
      expect(endereco).not.toContain(corpo.chaveEnvio)
    }

    // Segunda pessoa: o aluno seguinte, no mesmo computador, volta à lista sem nada do anterior, e o nome pedido saiu.
    await acionar(principal(page).getByRole('button', { name: 'Voltar à lista de nomes' }), hasTouch)
    await expect(tituloDaTurma(page, cenario.turma.nome)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('radio')).toHaveCount(2)
    await expect(principal(page).getByRole('radio', { name: segunda.nome })).toHaveCount(0)
    for (const radio of await principal(page).getByRole('radio').all()) await expect(radio).not.toBeChecked()
    await expect(campoDaMatricula(page)).toHaveValue('')
    await expect(campoDaSenha(page)).toHaveValue('')
    await expect(aviso(page)).toHaveCount(0)
    expect(page.url()).not.toContain('#')
  })
})

test.describe('W8 e W4 (Pública): pelo código, e o texto de cada caminho', () => {
  test('o código fora do formato não sai da página; o NAO_ENCONTRADO diz o texto do código, com o campo preenchido e o foco nele; pelo link, o texto do link e o campo do código com o foco; o código certo, minúsculo e com espaço, abre a turma vazia, que diz chamar o professor', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const cenario = await criarCenario(0)
    const aberturas: string[] = []
    page.on('request', (pedido) => {
      if (ehOAbrir(pedido.url())) aberturas.push(pedido.postData() ?? '')
    })
    await page.goto(enderecoDaSala(cenario))
    await expect(campoDoCodigo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // A página abre sem puxar o foco para o campo: quem usa leitor de tela começa pelo título, e o celular não abre o
    // teclado por cima do texto.
    await expect(campoDoCodigo(page)).not.toBeFocused()
    // W11: o teclado do celular abre nas maiúsculas, sem corretor nem preenchimento automático.
    await expect(campoDoCodigo(page)).toHaveAttribute('autocapitalize', 'characters')
    await expect(campoDoCodigo(page)).toHaveAttribute('autocomplete', 'off')
    await expect(campoDoCodigo(page)).toHaveAttribute('spellcheck', 'false')
    expect(await violacoesGraves(page)).toEqual([])

    // Em branco, e fora do alfabeto (o 0 e o O se confundem na lousa, e o código não os usa): nada sai da página.
    await acionar(principal(page).getByRole('button', { name: 'Abrir a turma' }), hasTouch)
    await expect(aviso(page)).toHaveText('Digite o código da turma que o professor mostrou.')
    await campoDoCodigo(page).fill('ABCD 0000')
    await acionar(principal(page).getByRole('button', { name: 'Abrir a turma' }), hasTouch)
    await expect(aviso(page)).toHaveText(TEXTO_DO_CODIGO)
    await expect(campoDoCodigo(page)).toBeFocused()
    expect(aberturas).toEqual([])

    // O servidor responde o mesmo NAO_ENCONTRADO aos dois caminhos; a página escolhe o texto pelo caminho que usou.
    // O clique duplo em "Abrir a turma" manda uma abertura só.
    const segurada = portao()
    await page.route('**/v1/salas/abrir', async (rota: Route) => {
      await segurada.aberta
      await rota.fulfill({ status: 404, contentType: 'application/json', body: erro('NAO_ENCONTRADO') })
    })
    await campoDoCodigo(page).fill('wxyz-2345')
    await principal(page)
      .getByRole('button', { name: 'Abrir a turma' })
      .evaluate((botao: HTMLButtonElement) => {
        botao.click()
        botao.click()
      })
    await expect(principal(page).getByRole('button', { name: 'Abrindo…' })).toBeDisabled()
    await expect.poll(() => aberturas.length).toBe(1)
    segurada.abrir()
    await expect(aviso(page)).toHaveText(TEXTO_DO_CODIGO, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(aberturas).toHaveLength(1)
    await expect(campoDoCodigo(page)).toHaveValue('wxyz-2345')
    await expect(campoDoCodigo(page)).toBeFocused()
    // O aviso descreve o campo: o leitor de tela o lê de novo ao voltar a ele.
    expect(await descritoPor(campoDoCodigo(page))).toContain(await aviso(page).getAttribute('id'))
    // O código vai normalizado, como a API o confere: sem espaço nem hífen, em maiúsculas.
    expect(JSON.parse(aberturas.at(-1) ?? '{}')).toEqual({ slug: cenario.escola.slug, codigo: 'WXYZ2345' })

    // O link colado na mesma aba, com o código digitado ainda no campo: o texto do link, e o campo do código limpo, com
    // o foco.
    await page.evaluate((token) => {
      window.location.hash = token
    }, cenario.acesso.token)
    await expect(aviso(page)).toHaveText(TEXTO_DO_LINK, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(campoDoCodigo(page)).toHaveValue('')
    await expect(campoDoCodigo(page)).toBeFocused()
    expect(page.url()).not.toContain('#')
    expect(JSON.parse(aberturas.at(-1) ?? '{}')).toEqual({ slug: cenario.escola.slug, token: cenario.acesso.token })
    // E o link aberto do zero, numa aba nova: o mesmo.
    await page.goto(`${enderecoDaSala(cenario)}#${cenario.acesso.token}`)
    await expect(aviso(page)).toHaveText(TEXTO_DO_LINK, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(campoDoCodigo(page)).toBeFocused()
    await expect(campoDoCodigo(page)).toHaveValue('')
    expect(page.url()).not.toContain('#')
    expect(await violacoesGraves(page)).toEqual([])
    await page.unroute('**/v1/salas/abrir')
    // O link colado pela metade (`%` solto) não é token: o campo do código, sem chamada nenhuma.
    const antesDoQuebrado = aberturas.length
    await page.evaluate(() => {
      window.location.hash = '%E0%A4%A'
    })
    await expect(aviso(page)).toHaveCount(0)
    await expect(campoDoCodigo(page)).toBeFocused()
    expect(page.url()).not.toContain('#')
    expect(aberturas).toHaveLength(antesDoQuebrado)

    // O código certo, como o aluno digita: minúsculo e com o espaço do meio. A turma sem nome livre diz o que fazer.
    const digitado = `${cenario.acesso.codigo.slice(0, 4).toLowerCase()} ${cenario.acesso.codigo.slice(4).toLowerCase()}`
    await campoDoCodigo(page).fill(digitado)
    await acionar(principal(page).getByRole('button', { name: 'Abrir a turma' }), hasTouch)
    await expect(tituloDaTurma(page, cenario.turma.nome)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page)).toContainText('Nenhum nome livre nesta turma.')
    await expect(principal(page)).toContainText(TEXTO_DO_NOME_QUE_FALTA)
    await expect(principal(page).getByRole('radio')).toHaveCount(0)
    await expect(principal(page).getByRole('button', { name: /Enviar/ })).toHaveCount(0)
    expect(JSON.parse(aberturas.at(-1) ?? '{}')).toEqual({ slug: cenario.escola.slug, codigo: cenario.acesso.codigo })
    expect(await violacoesGraves(page)).toEqual([])
    expect(await larguraExcedente(page)).toBe(0)

    // "Usar outro código" volta ao campo vazio, com o foco nele.
    await acionar(principal(page).getByRole('button', { name: 'Não é a sua turma? Usar outro código' }), hasTouch)
    await expect(campoDoCodigo(page)).toBeFocused()
    await expect(campoDoCodigo(page)).toHaveValue('')
  })

  test('o limite pelo rl:ip na abertura pelo código diz os minutos do Retry-After; a abertura pelo link que cai por servidor tem "Tentar de novo", com o token da memória', async ({
    page,
    hasTouch,
  }) => {
    const cenario = await criarCenario(1)
    let resposta: 'limite' | 'cheio' | 'normal' = 'limite'
    await page.route('**/v1/salas/abrir', (rota: Route) => {
      if (resposta === 'limite') return rota.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '60' }, body: erro('LIMITE_EXCEDIDO') })
      if (resposta === 'cheio') return rota.fulfill({ status: 503, contentType: 'application/json', headers: { 'Retry-After': '2' }, body: erro('INDISPONIVEL_TENTE_DE_NOVO') })
      return rota.continue()
    })
    await page.goto(enderecoDaSala(cenario))
    await campoDoCodigo(page).fill(cenario.acesso.codigo)
    await acionar(principal(page).getByRole('button', { name: 'Abrir a turma' }), hasTouch)
    await expect(aviso(page)).toHaveText('Muitas tentativas agora. Espere 1 minuto ou chame o professor.', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(campoDoCodigo(page)).toHaveValue(cenario.acesso.codigo)

    // O 503 na abertura não se repete sozinho: o texto não promete "Tentando de novo…", e o botão do código tenta.
    resposta = 'cheio'
    await acionar(principal(page).getByRole('button', { name: 'Abrir a turma' }), hasTouch)
    await expect(aviso(page)).toHaveText(TEXTO_CHEIO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(campoDoCodigo(page)).toHaveValue(cenario.acesso.codigo)

    // Pelo link, o limite e o 503 têm "Tentar de novo", com o token da memória.
    resposta = 'limite'
    await page.goto(`${enderecoDaSala(cenario)}#${cenario.acesso.token}`)
    await expect(aviso(page)).toHaveText('Muitas tentativas agora. Espere 1 minuto ou chame o professor.', { timeout: PRAZO_DA_ENTRADA_MS })
    resposta = 'cheio'
    await acionar(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(aviso(page)).toHaveText(TEXTO_CHEIO, { timeout: PRAZO_DA_ENTRADA_MS })
    for (const proibido of [codigoCru('503'), 'INDISPONIVEL', 'computador']) await expect(page.locator('body')).not.toContainText(proibido)
    expect(page.url()).not.toContain('#')
    resposta = 'normal'
    await acionar(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(tituloDaTurma(page, cenario.turma.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  })
})

test.describe('W8: um envio no ar, e o sistema cheio', () => {
  test('clique duplo em enviar manda um pedido só, e o botão fica em carregamento até a resposta, também na espera de 1 s', async ({ page, hasTouch }) => {
    const cenario = await criarCenario(1)
    const [aluna] = cenario.lista
    if (aluna === undefined) throw new Error('lista sem nome')
    let envios = 0
    const segurado = portao()
    await page.route('**/v1/salas/reivindicar', async (rota: Route) => {
      envios++
      await segurado.aberta
      await rota.continue()
    })
    await page.goto(`${enderecoDaSala(cenario)}#${cenario.acesso.token}`)
    await acionar(principal(page).getByRole('radio', { name: aluna.nome }), hasTouch)
    await campoDaMatricula(page).fill(aluna.matricula)
    await campoDaSenha(page).fill(SENHA)
    // Os dois cliques no mesmo instante, antes de a tela desligar o botão: é o caso que o botão desligado não segura.
    await botaoEnviar(page).evaluate((botao: HTMLButtonElement) => {
      botao.click()
      botao.click()
    })
    await expect(botaoEnviar(page)).toHaveText('Enviando…')
    await expect(botaoEnviar(page)).toBeDisabled()
    // A resposta que demora mais de 1 s (a espera do servidor no teto da escola, ou a vez no semáforo): o botão continua
    // em carregamento até ela chegar.
    await page.waitForTimeout(1_200)
    await expect(botaoEnviar(page)).toHaveText('Enviando…')
    await expect(botaoEnviar(page)).toBeDisabled()
    await botaoEnviar(page).dispatchEvent('click')
    await expect.poll(() => envios).toBe(1)
    segurado.abrir()
    await expect(tituloDoPedido(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(envios).toBe(1)
    expect(await pedidosPendentesDaTurma(cenario.escola.escolaId, cenario.turma.id)).toBe(1)
  })

  test('o 503 reenvia a mesma chave até 3 vezes, nunca antes do Retry-After e com a variação de cada computador; o quarto mostra "Tentar de novo", sem reenviar sozinho; "Tentar de novo" manda a mesma chave e entra', async ({
    page,
    browser,
    hasTouch,
  }) => {
    test.slow()
    const cenario = await criarCenario(2)
    const [primeira, segunda] = cenario.lista
    if (primeira === undefined || segunda === undefined) throw new Error('lista sem os dois nomes')

    /** Um computador da sala com o sorteio dado e o relógio falso, que responde 503 nas primeiras `quantos503` vezes. */
    async function computador(pagina: Page, sorteio: number, quantos503: number) {
      await pagina.addInitScript((valor) => {
        Math.random = () => valor
      }, sorteio)
      // O relógio corre enquanto a página carrega, e fica parado daí em diante: só o teste o avança.
      await pagina.clock.install({ time: new Date('2026-10-05T07:30:00-03:00') })
      const chaves: string[] = []
      await pagina.route('**/v1/salas/reivindicar', (rota: Route) => {
        chaves.push((rota.request().postDataJSON() as { chaveEnvio: string }).chaveEnvio)
        if (chaves.length <= quantos503)
          return rota.fulfill({ status: 503, contentType: 'application/json', headers: { 'Retry-After': '5' }, body: erro('INDISPONIVEL_TENTE_DE_NOVO') })
        return rota.continue()
      })
      await pagina.goto(`${enderecoDaSala(cenario)}#${cenario.acesso.token}`)
      await expect(principal(pagina).getByRole('radio').first()).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
      await pagina.clock.pauseAt(new Date('2026-10-05T09:30:00-03:00'))
      return chaves
    }

    // O primeiro computador sorteia 0,5: cada reenvio sai 5 s (o Retry-After) e meio depois do 503.
    const chaves = await computador(page, 0.5, 4)
    await pedirONome(page, primeira.nome, primeira.matricula, hasTouch)
    await expect.poll(() => chaves.length, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(1)
    const status = principal(page).getByRole('status').filter({ hasText: TEXTO_TENTANDO })
    for (let reenvio = 2; reenvio <= 4; reenvio++) {
      await expect(status).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
      await expect(botaoEnviar(page)).toBeDisabled()
      // "Tentando de novo…" numa região `role="status"`, ligada ao campo da matrícula, e à vista, não só para o leitor.
      expect(await descritoPor(campoDaMatricula(page))).toContain(await status.getAttribute('id'))
      expect((await status.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      await page.clock.runFor(5_499)
      // A entrega do evento de rota tem um atraso: o teste espera antes de afirmar que nada saiu.
      await page.waitForTimeout(300)
      expect(chaves, 'nenhum reenvio antes do Retry-After somado à variação').toHaveLength(reenvio - 1)
      await page.clock.runFor(1)
      await expect.poll(() => chaves.length, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(reenvio)
    }
    // O quarto 503: o texto e "Tentar de novo", e mais nada sai sozinho.
    await expect(aviso(page)).toHaveText(TEXTO_CHEIO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(botaoEnviar(page)).toHaveText('Tentar de novo')
    await expect(botaoEnviar(page)).toBeEnabled()
    await expect(status).toHaveCount(0)
    expect(await descritoPor(campoDaMatricula(page))).toContain(await aviso(page).getAttribute('id'))
    await page.clock.runFor(60_000)
    expect(chaves).toHaveLength(4)
    expect(new Set(chaves).size, 'o mesmo pedido, com a mesma chave').toBe(1)
    expect(await pedidosPendentesDaTurma(cenario.escola.escolaId, cenario.turma.id)).toBe(0)

    // "Tentar de novo" manda o mesmo pedido, com a mesma chave, e agora entra.
    await acionar(botaoEnviar(page), hasTouch)
    await expect(tituloDoPedido(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(chaves).toHaveLength(5)
    expect(new Set(chaves).size).toBe(1)
    expect(await pedidosPendentesDaTurma(cenario.escola.escolaId, cenario.turma.id)).toBe(1)

    // O segundo computador sorteia 0,9: o reenvio dele sai 400 ms depois do do primeiro, e não no mesmo instante.
    const outro = await outroNavegador(browser)
    const chavesDoOutro = await computador(outro, 0.9, 1)
    await pedirONome(outro, segunda.nome, segunda.matricula, hasTouch)
    await expect.poll(() => chavesDoOutro.length, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(1)
    await expect(principal(outro).getByRole('status').filter({ hasText: TEXTO_TENTANDO })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await outro.clock.runFor(5_500)
    await outro.waitForTimeout(300)
    expect(chavesDoOutro).toHaveLength(1)
    await outro.clock.runFor(399)
    await outro.waitForTimeout(300)
    expect(chavesDoOutro).toHaveLength(1)
    await outro.clock.runFor(1)
    await expect.poll(() => chavesDoOutro.length, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(2)
    await expect(tituloDoPedido(outro)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(await pedidosPendentesDaTurma(cenario.escola.escolaId, cenario.turma.id)).toBe(2)
  })
})

test.describe('W8: a recusa e o limite', () => {
  test('a recusa diz o texto, relê os nomes e tira a senha, com o foco na matrícula; a 6ª matrícula errada no nome segura o nome pelos minutos do Retry-After, também com a matrícula certa; o rl:ip diz o mesmo texto', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const cenario = await criarCenario(3)
    const [aluna, colega, outra] = cenario.lista
    if (aluna === undefined || colega === undefined || outra === undefined) throw new Error('lista sem os três nomes')
    let aberturas = 0
    page.on('request', (pedido) => {
      if (ehOAbrir(pedido.url())) aberturas++
    })
    await page.goto(`${enderecoDaSala(cenario)}#${cenario.acesso.token}`)
    await expect(tituloDaTurma(page, cenario.turma.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(aberturas).toBe(1)
    // Outro aluno pede o nome da colega com a página aberta.
    await tomarNomeNoBanco(cenario.escola.escolaId, (await principal(page).getByRole('radio', { name: colega.nome }).getAttribute('value')) ?? '')

    // A matrícula de outro nome: a recusa, sem dizer qual dos dois errou.
    await pedirONome(page, aluna.nome, outra.matricula, hasTouch)
    await expect(aviso(page)).toHaveText(TEXTO_DA_RECUSA, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(campoDaMatricula(page)).toBeFocused()
    expect(await descritoPor(campoDaMatricula(page))).toContain(await aviso(page).getAttribute('id'))
    await expect(campoDaSenha(page)).toHaveValue('')
    await expect(campoDaMatricula(page)).toHaveValue(outra.matricula)
    // A lista foi relida: o nome que a colega pediu saiu, e o escolhido continua escolhido.
    await expect.poll(() => aberturas, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(2)
    await expect(principal(page).getByRole('radio', { name: colega.nome })).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('radio', { name: aluna.nome })).toBeChecked()
    expect(await violacoesGraves(page)).toEqual([])

    // O aviso da tentativa anterior sai com o envio seguinte, e mais quatro matrículas erradas no mesmo nome.
    for (let tentativa = 2; tentativa <= 5; tentativa++) {
      // Na segunda, a releitura da lista cai: a tela fica com a lista de antes e com o que estava digitado.
      if (tentativa === 2)
        await page.route('**/v1/salas/abrir', (rota: Route) => rota.fulfill({ status: 503, contentType: 'application/json', headers: { 'Retry-After': '2' }, body: erro('INDISPONIVEL_TENTE_DE_NOVO') }), {
          times: 1,
        })
      await campoDaMatricula(page).fill(`errada-${String(tentativa)}`)
      await campoDaSenha(page).fill(SENHA)
      const resposta = page.waitForResponse((r) => ehOReivindicar(r.url()))
      await acionar(botaoEnviar(page), hasTouch)
      await expect(aviso(page)).toHaveCount(0)
      expect((await resposta).status()).toBe(409)
      await expect(aviso(page)).toHaveText(TEXTO_DA_RECUSA, { timeout: PRAZO_DA_ENTRADA_MS })
      if (tentativa === 2) {
        await expect.poll(() => aberturas, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(3)
        await expect(principal(page).getByRole('radio')).toHaveCount(2)
        await expect(campoDaMatricula(page)).toHaveValue('errada-2')
        await expect(principal(page).getByRole('radio', { name: aluna.nome })).toBeChecked()
      }
    }
    // A 6ª, já com a matrícula certa: o nome está segurado, pelo que falta da janela de 10 min.
    await campoDaMatricula(page).fill(aluna.matricula)
    await campoDaSenha(page).fill(SENHA)
    await acionar(botaoEnviar(page), hasTouch)
    await expect(aviso(page)).toHaveText('Muitas tentativas agora. Espere 10 minutos ou chame o professor.', { timeout: PRAZO_DA_ENTRADA_MS })
    expect(await pedidosPendentesDaTurma(cenario.escola.escolaId, cenario.turma.id)).toBe(0)

    // O nome escolhido é tomado por outro aluno antes do envio: a recusa relê a lista, o nome sai da escolha, e o envio
    // seguinte pede o nome de novo, sem chamada.
    await acionar(principal(page).getByRole('radio', { name: outra.nome }), hasTouch)
    await tomarNomeNoBanco(cenario.escola.escolaId, (await principal(page).getByRole('radio', { name: outra.nome }).getAttribute('value')) ?? '')
    await campoDaMatricula(page).fill(outra.matricula)
    await campoDaSenha(page).fill(SENHA)
    await acionar(botaoEnviar(page), hasTouch)
    await expect(aviso(page)).toHaveText(TEXTO_DA_RECUSA, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('radio', { name: outra.nome })).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    let enviosDepois = 0
    page.on('request', (pedido) => {
      if (ehOReivindicar(pedido.url())) enviosDepois++
    })
    await campoDaSenha(page).fill(SENHA)
    await acionar(botaoEnviar(page), hasTouch)
    await expect(principal(page).getByText('Escolha o seu nome na lista.')).toBeVisible()
    expect(enviosDepois).toBe(0)

    // O rl:ip responde o mesmo LIMITE_EXCEDIDO, e o texto é o mesmo, com os minutos do Retry-After dele.
    await page.route('**/v1/salas/reivindicar', (rota: Route) => rota.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '61' }, body: erro('LIMITE_EXCEDIDO') }))
    await acionar(principal(page).getByRole('radio', { name: aluna.nome }), hasTouch)
    await campoDaMatricula(page).fill(outra.matricula)
    await campoDaSenha(page).fill(SENHA)
    await acionar(botaoEnviar(page), hasTouch)
    await expect(aviso(page)).toHaveText('Muitas tentativas agora. Espere 2 minutos ou chame o professor.', { timeout: PRAZO_DA_ENTRADA_MS })
  })
})

test.describe('W8: a página que sai no meio dos reenvios', () => {
  test('o aluno sai da página com o sistema cheio: nenhum reenvio sai depois', async ({ page, hasTouch }) => {
    const cenario = await criarCenario(1)
    const [aluna] = cenario.lista
    if (aluna === undefined) throw new Error('lista sem nome')
    await page.clock.install({ time: new Date('2026-10-05T07:30:00-03:00') })
    let envios = 0
    await page.route('**/v1/salas/reivindicar', (rota: Route) => {
      envios++
      return rota.fulfill({ status: 503, contentType: 'application/json', headers: { 'Retry-After': '5' }, body: erro('INDISPONIVEL_TENTE_DE_NOVO') })
    })
    await page.goto(`${enderecoDaSala(cenario)}#${cenario.acesso.token}`)
    await expect(tituloDaTurma(page, cenario.turma.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await page.clock.pauseAt(new Date('2026-10-05T09:30:00-03:00'))
    await pedirONome(page, aluna.nome, aluna.matricula, hasTouch)
    await expect(principal(page).getByRole('status').filter({ hasText: TEXTO_TENTANDO })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // Outra tela da web, sem recarregar a página: a da sala sai, com o reenvio esperando o relógio.
    await page.evaluate(() => {
      window.history.pushState(null, '', '/sistema')
    })
    await expect(campoDaMatricula(page)).toHaveCount(0)
    await page.clock.runFor(60_000)
    expect(envios).toBe(1)
  })
})

test.describe('W8: o pedido sem resposta e o acesso que cai', () => {
  test('mexer num campo depois do sistema cheio faz o envio seguinte ser um pedido novo, com chave nova; o acesso que cai entre abrir e enviar leva ao código, com o texto do caminho', async ({
    page,
    hasTouch,
  }) => {
    const cenario = await criarCenario(2)
    const [aluna, colega] = cenario.lista
    if (aluna === undefined || colega === undefined) throw new Error('lista sem os dois nomes')
    // Sem espera: o Retry-After de zero e o sorteio zero fazem os três reenvios saírem na hora.
    await page.addInitScript(() => {
      Math.random = () => 0
    })
    const corpos: Array<{ chaveEnvio: string; listaNomeId: string; matricula: string; senha: string }> = []
    let resposta: 'cheio' | 'recusa' | 'normal' | 'sem-acesso' = 'cheio'
    await page.route('**/v1/salas/reivindicar', (rota: Route) => {
      corpos.push(rota.request().postDataJSON() as { chaveEnvio: string; listaNomeId: string; matricula: string; senha: string })
      if (resposta === 'cheio') return rota.fulfill({ status: 503, contentType: 'application/json', headers: { 'Retry-After': '0' }, body: erro('INDISPONIVEL_TENTE_DE_NOVO') })
      if (resposta === 'recusa') return rota.fulfill({ status: 409, contentType: 'application/json', body: erro('REIVINDICACAO_RECUSADA') })
      if (resposta === 'sem-acesso') return rota.fulfill({ status: 404, contentType: 'application/json', body: erro('NAO_ENCONTRADO') })
      return rota.continue()
    })
    await page.goto(`${enderecoDaSala(cenario)}#${cenario.acesso.token}`)
    await expect(tituloDaTurma(page, cenario.turma.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const idDe = async (nome: string) => (await principal(page).getByRole('radio', { name: nome }).getAttribute('value')) ?? ''

    // Cada campo, um de cada vez: o nome, a matrícula e a senha. Depois do quarto 503, mexer naquele campo volta o botão a
    // "Enviar pedido", e o envio seguinte é um pedido novo, com chave nova e com o que está na tela — e não o pedido antigo.
    const mudancas: ReadonlyArray<{ campo: string; mudar: () => Promise<void>; nome: string; matricula: string; senha: string }> = [
      { campo: 'o nome', mudar: () => acionar(principal(page).getByRole('radio', { name: colega.nome }), hasTouch), nome: colega.nome, matricula: aluna.matricula, senha: SENHA },
      { campo: 'a matrícula', mudar: () => campoDaMatricula(page).fill(colega.matricula), nome: aluna.nome, matricula: colega.matricula, senha: SENHA },
      { campo: 'a senha', mudar: () => campoDaSenha(page).fill(`${SENHA} nova`), nome: aluna.nome, matricula: aluna.matricula, senha: `${SENHA} nova` },
    ]
    // Cada volta recomeça do mesmo pedido: a recusa da volta anterior tira a senha e zera o pedido sem resposta, e o
    // `pedirONome` preenche tudo de novo.
    for (const mudanca of mudancas) {
      resposta = 'cheio'
      const antes = corpos.length
      await pedirONome(page, aluna.nome, aluna.matricula, hasTouch)
      await expect(aviso(page)).toHaveText(TEXTO_CHEIO, { timeout: PRAZO_DA_ENTRADA_MS })
      await expect(botaoEnviar(page)).toHaveText('Tentar de novo')
      expect(corpos).toHaveLength(antes + 4)
      const antigo = corpos.at(-1)
      resposta = 'recusa'
      await mudanca.mudar()
      await expect(botaoEnviar(page), mudanca.campo).toHaveText('Enviar pedido')
      await acionar(botaoEnviar(page), hasTouch)
      await expect(aviso(page)).toHaveText(TEXTO_DA_RECUSA, { timeout: PRAZO_DA_ENTRADA_MS })
      const novo = corpos.at(-1)
      expect(corpos, mudanca.campo).toHaveLength(antes + 5)
      expect(novo?.chaveEnvio, mudanca.campo).not.toBe(antigo?.chaveEnvio)
      expect(novo?.listaNomeId, mudanca.campo).toBe(await idDe(mudanca.nome))
      expect(novo?.matricula, mudanca.campo).toBe(mudanca.matricula)
      expect(novo?.senha, mudanca.campo).toBe(mudanca.senha)
    }

    // Sem mexer em nada, o "Tentar de novo" manda o mesmo pedido, e agora entra.
    resposta = 'cheio'
    await pedirONome(page, aluna.nome, aluna.matricula, hasTouch)
    await expect(botaoEnviar(page)).toHaveText('Tentar de novo', { timeout: PRAZO_DA_ENTRADA_MS })
    const semResposta = corpos.at(-1)
    resposta = 'normal'
    await acionar(botaoEnviar(page), hasTouch)
    await expect(tituloDoPedido(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(corpos.at(-1)).toEqual(semResposta)
    expect(await pedidosPendentesDaTurma(cenario.escola.escolaId, cenario.turma.id)).toBe(1)

    // O professor gerou outro acesso com a página aberta: o envio responde NAO_ENCONTRADO, e a página leva ao código, com o
    // texto do link.
    resposta = 'sem-acesso'
    await acionar(principal(page).getByRole('button', { name: 'Voltar à lista de nomes' }), hasTouch)
    await expect(tituloDaTurma(page, cenario.turma.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await pedirONome(page, colega.nome, colega.matricula, hasTouch)
    await expect(aviso(page)).toHaveText(TEXTO_DO_LINK, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(campoDoCodigo(page)).toBeFocused()
    await expect(principal(page).getByRole('radio')).toHaveCount(0)
  })

  test('o envio no ar quando o aluno troca de código não muda a tela que ele abriu depois', async ({ page, hasTouch }) => {
    const cenario = await criarCenario(1)
    const [aluna] = cenario.lista
    if (aluna === undefined) throw new Error('lista sem nome')
    let segurado = portao()
    let respondeu = false
    await page.route('**/v1/salas/reivindicar', async (rota: Route) => {
      await segurado.aberta
      await rota.fulfill({ status: 404, contentType: 'application/json', body: erro('NAO_ENCONTRADO') })
      respondeu = true
    })
    await page.goto(`${enderecoDaSala(cenario)}#${cenario.acesso.token}`)
    await pedirONome(page, aluna.nome, aluna.matricula, hasTouch)
    await expect(botaoEnviar(page)).toHaveText('Enviando…')
    await acionar(principal(page).getByRole('button', { name: 'Não é a sua turma? Usar outro código' }), hasTouch)
    await expect(campoDoCodigo(page)).toBeFocused()
    segurado.abrir()
    await expect.poll(() => respondeu, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(true)
    await page.waitForTimeout(1_000)
    // A resposta do envio anterior chegou e não pôs aviso nenhum no campo do código.
    await expect(aviso(page)).toHaveCount(0)
    await expect(campoDoCodigo(page)).toHaveValue('')

    // O mesmo com o link colado pela metade na aba, no lugar do "Usar outro código".
    segurado = portao()
    respondeu = false
    await campoDoCodigo(page).fill(cenario.acesso.codigo)
    await acionar(principal(page).getByRole('button', { name: 'Abrir a turma' }), hasTouch)
    await pedirONome(page, aluna.nome, aluna.matricula, hasTouch)
    await expect(botaoEnviar(page)).toHaveText('Enviando…')
    await page.evaluate(() => {
      window.location.hash = '%E0%A4%A'
    })
    await expect(campoDoCodigo(page)).toBeFocused()
    segurado.abrir()
    await expect.poll(() => respondeu, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(true)
    await page.waitForTimeout(1_000)
    await expect(aviso(page)).toHaveCount(0)
  })
})

test.describe('recomeço da página pública', () => {
  test('mesma entrada: o mesmo link colado de novo na aba abre a turma, sem o token na barra e sem o que estava digitado', async ({ page, hasTouch }) => {
    const cenario = await criarCenario(1)
    const [aluna] = cenario.lista
    if (aluna === undefined) throw new Error('lista sem nome')
    await page.goto(`${enderecoDaSala(cenario)}#${cenario.acesso.token}`)
    await expect(tituloDaTurma(page, cenario.turma.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(principal(page).getByRole('radio', { name: aluna.nome }), hasTouch)
    await campoDaMatricula(page).fill(aluna.matricula)
    await campoDaSenha(page).fill(SENHA)
    const abertura = page.waitForRequest((pedido) => ehOAbrir(pedido.url()))
    await page.evaluate((token) => {
      window.location.hash = token
    }, cenario.acesso.token)
    await abertura
    await expect(tituloDaTurma(page, cenario.turma.nome)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(page.url()).not.toContain('#')
    await expect(campoDaMatricula(page)).toHaveValue('')
    await expect(campoDaSenha(page)).toHaveValue('')
    await expect(principal(page).getByRole('radio', { name: aluna.nome })).not.toBeChecked()
  })

  test('resposta atrasada: a abertura de um código anterior que responde depois de outro link chegar à aba não troca a turma, dê certo ou não', async ({ page, hasTouch }) => {
    const primeiro = await criarCenario(1, 'Aluna da primeira')
    const estrutura = await montarEstruturaNoBanco(primeiro.escola.escolaId, ['8B'])
    const outraTurma = estrutura.turmas[0]
    if (outraTurma === undefined) throw new Error('estrutura sem turma')
    await porNaListaDaTurma(primeiro.escola.escolaId, outraTurma.id, [{ nome: `Aluno da segunda ${randomUUID().slice(0, 8)}`, matricula: `S-${randomUUID().slice(0, 8)}` }])
    const outroAcesso = await gerarAcessoDaSalaNoBanco(primeiro.escola.escolaId, outraTurma.id)
    // O código da primeira turma fica segurado; na primeira vez responde que não acha, na segunda abre de verdade.
    let segurada = portao()
    let respostas = 0
    let vez = 0
    await page.route('**/v1/salas/abrir', async (rota: Route) => {
      if ((rota.request().postDataJSON() as { codigo?: string }).codigo !== primeiro.acesso.codigo) return rota.continue()
      const minha = ++vez
      await segurada.aberta
      if (minha === 1) await rota.fulfill({ status: 404, contentType: 'application/json', body: erro('NAO_ENCONTRADO') })
      else await rota.continue()
      respostas++
    })
    await page.goto(enderecoDaSala(primeiro))

    for (const rodada of [1, 2]) {
      await campoDoCodigo(page).fill(primeiro.acesso.codigo)
      await acionar(principal(page).getByRole('button', { name: 'Abrir a turma' }), hasTouch)
      await expect(principal(page).getByRole('button', { name: 'Abrindo…' })).toBeDisabled()
      // O link da outra turma chega à aba com o código ainda no ar.
      await page.evaluate((token) => {
        window.location.hash = token
      }, outroAcesso.token)
      await expect(tituloDaTurma(page, outraTurma.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
      const chegou = page.waitForResponse((r) => ehOAbrir(r.url()) && (r.request().postDataJSON() as { codigo?: string }).codigo === primeiro.acesso.codigo)
      segurada.abrir()
      await chegou
      await expect.poll(() => respostas, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(rodada)
      // A página tem tempo de tratar a resposta antes de o teste olhar: "nada mudou" não tem evento para esperar.
      await page.waitForTimeout(1_000)
      // A resposta do código anterior chegou — a que não achou e a que achou — e não mudou nada.
      await expect(tituloDaTurma(page, outraTurma.nome)).toBeVisible()
      await expect(tituloDaTurma(page, primeiro.turma.nome)).toHaveCount(0)
      await expect(aviso(page)).toHaveCount(0)
      await expect(principal(page)).not.toContainText(primeiro.lista[0]?.nome ?? 'sem nome')
      segurada = portao()
      await acionar(principal(page).getByRole('button', { name: 'Não é a sua turma? Usar outro código' }), hasTouch)
    }
  })
})

test.describe('W12 (Pública): a 360 px e só com teclado', () => {
  test('sem rolagem horizontal com nome comprido; alvos de 44 px; do código ao pedido enviado só com Tab, Espaço, setas e Enter, com o foco visível', async ({ page }) => {
    test.slow()
    await page.setViewportSize({ width: 360, height: 800 })
    const cenario = await criarCenario(2)
    const comprido = `Maria${'Eduarda'.repeat(12)}DaSilvaSemEspaco`
    await porNaListaDaTurma(cenario.escola.escolaId, cenario.turma.id, [{ nome: comprido, matricula: `C-${randomUUID().slice(0, 8)}` }])
    // O segundo nome da lista, para a seta precisar andar.
    const [, aluna] = cenario.lista
    if (aluna === undefined) throw new Error('lista sem nome')

    await page.goto(enderecoDaSala(cenario))
    await expect(campoDoCodigo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await page.keyboard.press('Tab')
    for (let tecla = 0; tecla < 10 && !(await campoDoCodigo(page).evaluate((elemento) => elemento === document.activeElement)); tecla++) await page.keyboard.press('Tab')
    await expect(campoDoCodigo(page)).toBeFocused()
    await page.keyboard.type(cenario.acesso.codigo)
    await page.keyboard.press('Enter')
    await expect(tituloDaTurma(page, cenario.turma.nome)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(await larguraExcedente(page)).toBe(0)
    await alvoDeToque(principal(page).getByText(comprido).locator('xpath=ancestor::label'), 'o nome comprido')

    // Os nomes: o Tab entra no grupo, e as setas escolhem.
    await page.keyboard.press('Tab')
    const primeiroRadio = principal(page).getByRole('radio').first()
    await expect(primeiroRadio).toBeFocused()
    await page.keyboard.press('Space')
    await expect(primeiroRadio).toBeChecked()
    const radios = await principal(page).getByRole('radio').all()
    let escolhido = 0
    while ((await radios[escolhido]?.getAttribute('value')) !== (await principal(page).getByRole('radio', { name: aluna.nome }).getAttribute('value'))) {
      await page.keyboard.press('ArrowDown')
      escolhido++
      if (escolhido > radios.length) throw new Error('a seta não chegou ao nome')
    }
    await expect(principal(page).getByRole('radio', { name: aluna.nome })).toBeChecked()
    expect(await focoVisivel(page)).toBe(true)

    await page.keyboard.press('Tab')
    await expect(campoDaMatricula(page)).toBeFocused()
    await page.keyboard.type(aluna.matricula)
    await page.keyboard.press('Tab')
    await expect(campoDaSenha(page)).toBeFocused()
    await page.keyboard.type(SENHA)
    await page.keyboard.press('Tab')
    await expect(botaoMostrar(page)).toBeFocused()
    expect(await focoVisivel(page)).toBe(true)
    await page.keyboard.press('Space')
    await expect(campoDaSenha(page)).toHaveAttribute('type', 'text')
    await page.keyboard.press('Tab')
    await expect(botaoEnviar(page)).toBeFocused()
    expect(await focoVisivel(page)).toBe(true)
    expect(await larguraExcedente(page)).toBe(0)
    await page.keyboard.press('Enter')
    await expect(tituloDoPedido(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(await larguraExcedente(page)).toBe(0)
    for (const alvo of [principal(page).getByRole('link', { name: 'Ir para a entrada da escola' }), principal(page).getByRole('button', { name: 'Voltar à lista de nomes' })])
      await alvoDeToque(alvo, (await alvo.textContent()) ?? 'alvo')
    expect(await violacoesGraves(page)).toEqual([])
  })
})
