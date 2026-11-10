import { randomUUID } from 'node:crypto'
import type { Browser, BrowserContextOptions, Locator, Page, Route } from '@playwright/test'
import { AVISO_DO_CONVITE_COM_SENHA_NOVA, MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import type { EstadoDoEnvio } from '../packages/shared/src/professores/professores.ts'
import { lerAmbienteDeTeste, valorObrigatorio } from '../tools/ci/compose.ts'
import { entrarPorEmail, esperarNovaConversa, irPelaNavegacao, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { linhasDaTabela, paginaNaoRola } from './support/coordenacao.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga } from './support/mfa.ts'
import { expect, test } from './support/profiles.ts'
import { convidarProfessorNoBanco, criarAlocacaoDoProfessor, criarAulasNoBanco, criarEquipeComSenha, definirOEnvioDoConvite, revogarConvite, type EquipeDeTeste, type ProfessorDeTeste } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, larguraExcedenteDoDialogo, seriousViolations } from './support/checks.ts'

/**
 * O envio do convite por e-mail na tela Professores (acesso-e-convites, tarefa 4.0; RF11 e RF18; `cenarios.md`, "Telas", linha "Professores,
 * envio", e "E2E (RF18)"): o diálogo "Enviar convites", o aviso do "Reenviar" e do "Copiar link", o rótulo dos cinco estados, a releitura
 * enquanto há envio e o recomeço da tela. Pela tela, nos projetos `chromebook` e `celular`, com o worker e o Mailpit do compose de teste. Os
 * textos esperados estão aqui por extenso.
 */

const INDISPONIVEL = JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
const LIMITE = JSON.stringify({ erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000002' } })
const TEXTO_DO_429 = 'Muitos convites enviados em pouco tempo. Espere alguns minutos e envie de novo.'
const LINKS_ANTERIORES = 'Os links enviados ou copiados antes deixam de valer na hora.'
const ENVIADO = /Enviado em \d{2}\/\d{2} às \d{2}:\d{2}/
/** 17h05 UTC é 14h05 em São Paulo (sem horário de verão desde 2019): o "12/11 às 14:05" da tela. */
const ENVIADO_EM_UTC = '2026-11-12T17:05:00.000Z'
const SENHA_NOVA = 'frase-sintetica-do-professor'
const TEXTO_DO_FALHOU = 'Não chegou. Corrija o e-mail e reenvie, ou copie o link'
const EMAIL_QUE_NAO_SERVE =
  'Este e-mail já é de um professor da escola, ou este professor já entrou antes e não troca de e-mail por aqui. Confira o e-mail, ou revogue o convite e cadastre o certo'
const CONVITE_QUE_MUDOU = 'O convite mudou. A lista foi atualizada.'
const ehACorrecao = (url: URL) => /^\/v1\/professores\/[^/]+\/email$/.test(url.pathname)

const ehALista = (url: URL) => url.pathname === '/v1/professores'
const ehOEnvio = (url: URL) => url.pathname === '/v1/professores/convites/enviar'

const contextos: { close: () => Promise<void> }[] = []

test.afterEach(async () => {
  for (const contexto of contextos.splice(0)) await contexto.close()
})

/** Outro navegador (o professor, no computador dele), com a tela e o toque do projeto. */
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

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

async function tocar(lugar: Locator, nome: string, hasTouch: boolean): Promise<void> {
  await activate(lugar.getByRole('button', { name: nome, exact: true }), hasTouch)
}

/** Uma porta que segura a resposta até o teste abrir. */
function gate(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

const principal = (page: Page) => page.getByRole('main')
/** Os `dialog` abertos que não são o painel do professor: o do envio, do refazer, do revogar. */
const noDialogo = (page: Page): Locator => page.locator('dialog[open]:not([data-painel-lado])')
const painelDe = (page: Page, nome: string) => page.getByRole('dialog', { name: nome })
const paineisAbertos = (page: Page) => page.locator('dialog[data-painel-lado][open]')
const linhasDaLista = (page: Page) => linhasDaTabela(principal(page))
const linhaDe = (page: Page, nome: string) => linhasDaLista(page).filter({ hasText: nome })
const botaoDaLinha = (page: Page, nome: string) => linhaDe(page, nome).getByRole('button', { name: nome })
/** O envio de uma linha: a região que anuncia a mudança sem tirar o foco. */
const envioDe = (page: Page, nome: string) => linhaDe(page, nome).locator('[aria-live="polite"]')
const botaoDeEnviar = (page: Page) => principal(page).getByRole('button', { name: 'Enviar convites', exact: true })
const tituloDaLista = (page: Page) => principal(page).getByRole('heading', { name: 'Professores da escola' })

async function alvoDeToque(alvo: Locator, descricao: string, minimo = ALVO_DE_TOQUE_PRINCIPAL_PX): Promise<void> {
  const caixa = await alvo.boundingBox()
  expect(caixa, `${descricao} sem caixa`).not.toBeNull()
  expect(caixa?.height ?? 0, descricao).toBeGreaterThanOrEqual(minimo)
  expect(caixa?.width ?? 0, descricao).toBeGreaterThanOrEqual(minimo)
}

/** Sem rolagem horizontal no documento nem no diálogo aberto, e o axe limpo. */
async function conferirDialogo(page: Page): Promise<void> {
  expect(await larguraExcedenteDoDialogo(page)).toBe(0)
  expect(await horizontalOverflow(page)).toBe(0)
  expect(await seriousViolations(page)).toEqual([])
}

async function abrirPainel(page: Page, nome: string, hasTouch: boolean): Promise<Locator> {
  await activate(botaoDaLinha(page, nome), hasTouch)
  const painel = painelDe(page, nome)
  await expect(painel).toBeVisible()
  return painel
}

async function fecharPainel(page: Page, hasTouch: boolean): Promise<void> {
  await activate(paineisAbertos(page).getByRole('button', { name: 'Fechar', exact: true }), hasTouch)
  await expect(paineisAbertos(page)).toHaveCount(0)
}

/** O Mailpit do compose de teste: a mensagem que o worker entregou a um endereço, ou `undefined` se ela não chegou. */
async function mensagemDoMailpit(para: string): Promise<{ assunto: string; texto: string } | undefined> {
  const base = `http://127.0.0.1:${valorObrigatorio(lerAmbienteDeTeste(), 'MAILPIT_PORTA_HOST')}`
  const busca = (await (await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${para}`)}`)).json()) as { messages: { ID: string }[] }
  const primeira = busca.messages[0]
  if (primeira === undefined) return undefined
  const mensagem = (await (await fetch(`${base}/api/v1/message/${primeira.ID}`)).json()) as { Subject: string; Text: string }
  return { assunto: mensagem.Subject, texto: mensagem.Text }
}

const mensagemChegou = (para: string) => async () => (await mensagemDoMailpit(para)) !== undefined

/** O envio de um professor da lista (`definirOEnvioDoConvite`), pelo professor que o seed devolveu. */
const definirOEnvio = (professor: Pick<ProfessorDeTeste, 'usuarioId'>, envio: EstadoDoEnvio, enviadoEm: string | null = null) => definirOEnvioDoConvite(professor.usuarioId, envio, enviadoEm)

/** A coordenadora com uma lista de professores, na tela Professores, pela API. */
async function abrirProfessores(page: Page, request: Parameters<typeof abrirPelaApiSemMedirAPrimeiraCarga>[1], coordenadora: EquipeDeTeste, linhas: number): Promise<void> {
  await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/professores', () => expect(linhasDaLista(page)).toHaveCount(linhas, { timeout: SIGN_IN_TIMEOUT_MS }))
}

test.describe('Professores: o diálogo "Enviar convites" e o e-mail', () => {
  test('o diálogo diz quantos recebem e que os links anteriores caducam; o e-mail chega só a quem esperava, e a linha vai a "Enviado em …"', async ({ page, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    const bia = await convidarProfessorNoBanco(coordenadora.escolaId, 'vencido', 'Bia')
    const caio = await convidarProfessorNoBanco(coordenadora.escolaId, 'revogado', 'Caio')
    const davi = await convidarProfessorNoBanco(coordenadora.escolaId, 'ativo', 'Davi')
    await abrirProfessores(page, request, coordenadora, 4)

    // Antes de confirmar: quantos recebem (só o pendente e o vencido), o aviso dos links, o foco no texto e não no botão que envia.
    await activate(botaoDeEnviar(page), hasTouch)
    const dialogo = noDialogo(page)
    await expect(page.getByRole('dialog', { name: 'Enviar convites' })).toBeVisible()
    await expect(dialogo).toContainText('Enviar o convite por e-mail a 2 professores. Cada um recebe um e-mail com o link para criar a senha.')
    await expect(dialogo).toContainText(LINKS_ANTERIORES)
    await expect(dialogo.locator('div[tabindex="-1"]')).toBeFocused()
    await conferirDialogo(page)

    // Enviar: a contagem que o servidor devolveu, e só "Fechar" depois; o foco volta ao botão que abriu.
    await tocar(dialogo, 'Enviar convites', hasTouch)
    await expect(dialogo).toContainText('2 convites entraram na fila', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(dialogo.getByRole('button', { name: 'Enviar convites', exact: true })).toHaveCount(0)
    await tocar(dialogo, 'Fechar', hasTouch)
    await expect(dialogo).toHaveCount(0)
    await expect(botaoDeEnviar(page)).toBeFocused()

    // O worker entrega ao Mailpit, e a lista, relida sozinha, troca "Enviando" pela hora do envio. Revogado e ativo não recebem nada.
    await expect.poll(mensagemChegou(ana.email), { timeout: SIGN_IN_TIMEOUT_MS }).toBe(true)
    await expect.poll(mensagemChegou(bia.email), { timeout: SIGN_IN_TIMEOUT_MS }).toBe(true)
    const paraAna = await mensagemDoMailpit(ana.email)
    expect(paraAna?.assunto).toContain(coordenadora.escolaNome)
    expect(paraAna?.texto).toMatch(/\/convite#[A-Za-z0-9_-]{43}/)
    expect(paraAna?.texto).not.toContain(ana.nome)
    await expect(envioDe(page, ana.nome)).toHaveText(ENVIADO, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(envioDe(page, bia.nome)).toHaveText(ENVIADO, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(envioDe(page, caio.nome)).toHaveText('')
    await expect(envioDe(page, davi.nome)).toHaveText('')
    expect(await mensagemDoMailpit(caio.email)).toBeUndefined()
    expect(await mensagemDoMailpit(davi.email)).toBeUndefined()
  })

  test('o professor abre o link do e-mail, cria a senha e aceita', async ({ page, browser, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    await abrirProfessores(page, request, coordenadora, 1)
    await activate(botaoDeEnviar(page), hasTouch)
    await expect(noDialogo(page)).toContainText('a 1 professor.')
    await tocar(noDialogo(page), 'Enviar convites', hasTouch)
    await expect(noDialogo(page)).toContainText('1 convite entrou na fila', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect.poll(mensagemChegou(ana.email), { timeout: SIGN_IN_TIMEOUT_MS }).toBe(true)

    const link = new URL(/https?:\/\/\S+\/convite#[A-Za-z0-9_-]{43}/.exec((await mensagemDoMailpit(ana.email))?.texto ?? '')?.[0] ?? '')
    const professor = await outroNavegador(browser)
    await professor.goto(`${link.pathname}${link.hash}`)
    await expect(professor.getByRole('main')).toContainText(coordenadora.escolaNome, { timeout: SIGN_IN_TIMEOUT_MS })
    await tocar(professor.getByRole('main'), 'Aceitar o convite', hasTouch)
    await professor.getByLabel('Senha nova').fill(SENHA_NOVA, { timeout: SIGN_IN_TIMEOUT_MS })
    await tocar(professor.getByRole('main'), 'Definir a senha e continuar', hasTouch)
    await expect(professor).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(professor.getByRole('alert')).toHaveText(AVISO_DO_CONVITE_COM_SENHA_NOVA)
  })
})

test.describe('Professores: o rótulo do envio de cada estado', () => {
  test('na_fila e enviando dizem "Enviando"; enviado diz a hora da escola; falhou não culpa o professor; cancelado e o convite copiado não dizem nada', async ({
    page,
    request,
    hasTouch,
  }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const naFila = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    const enviando = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Bia')
    const enviado = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Caio')
    const falhou = await convidarProfessorNoBanco(coordenadora.escolaId, 'vencido', 'Davi')
    const cancelado = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Eva')
    const copiado = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Fábio')
    await definirOEnvio(naFila, 'na_fila')
    await definirOEnvio(enviando, 'enviando')
    await definirOEnvio(enviado, 'enviado', ENVIADO_EM_UTC)
    await definirOEnvio(falhou, 'falhou')
    await definirOEnvio(cancelado, 'cancelado')
    await abrirProfessores(page, request, coordenadora, 6)

    await expect(envioDe(page, naFila.nome)).toHaveText('Enviando')
    await expect(envioDe(page, enviando.nome)).toHaveText('Enviando')
    await expect(envioDe(page, enviado.nome)).toHaveText('Enviado em 12/11 às 14:05')
    await expect(envioDe(page, falhou.nome)).toHaveText('Não chegou. Corrija o e-mail e reenvie, ou copie o link')
    await expect(envioDe(page, falhou.nome)).not.toContainText(/professor|erro|culpa/i)
    // Cancelado vale o estado do convite, que a linha já diz; o copiado nunca teve envio.
    await expect(envioDe(page, cancelado.nome)).toHaveText('')
    await expect(envioDe(page, copiado.nome)).toHaveText('')
    await expect(linhaDe(page, cancelado.nome)).toContainText('Convite em aberto, ainda não aceito.')
    await expect(botaoDeEnviar(page)).toBeVisible()

    // O painel repete o envio em texto, e o "Reenviar" só existe para quem já teve envio: o copiado ainda não tem.
    const doFalhou = await abrirPainel(page, falhou.nome, hasTouch)
    await expect(doFalhou).toContainText('Não chegou. Corrija o e-mail e reenvie, ou copie o link')
    await expect(doFalhou.getByRole('button', { name: 'Reenviar', exact: true })).toBeVisible()
    await fecharPainel(page, hasTouch)
    const doCopiado = await abrirPainel(page, copiado.nome, hasTouch)
    await expect(doCopiado.getByRole('button', { name: 'Reenviar', exact: true })).toHaveCount(0)
    await expect(doCopiado.getByRole('button', { name: 'Refazer convite', exact: true })).toBeVisible()
  })

  test('a mudança de estado vem pela releitura de 5 s, na mesma região `aria-live="polite"`, sem recarregar a página', async ({ page, request }) => {
    // O relógio da página anda sozinho; `runFor` pula os 5 s da releitura sem o teste esperá-los.
    await page.clock.install()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    await definirOEnvio(ana, 'na_fila')
    await abrirProfessores(page, request, coordenadora, 1)
    const regiao = envioDe(page, ana.nome)
    await expect(regiao).toHaveAttribute('aria-live', 'polite')
    await expect(regiao).toHaveText('Enviando')
    // A região é a mesma depois da mudança: um leitor de tela só anuncia o que muda numa região que já estava na página.
    await regiao.evaluate((elemento) => elemento.setAttribute('data-mesma-regiao', 'sim'))
    await definirOEnvio(ana, 'enviado', ENVIADO_EM_UTC)
    await page.clock.runFor(5_000)
    await expect(regiao).toHaveText('Enviado em 12/11 às 14:05', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(regiao).toHaveAttribute('data-mesma-regiao', 'sim')
    await expect(regiao).toHaveAttribute('aria-live', 'polite')
  })
})

test.describe('Professores: "Reenviar" e "Copiar link"', () => {
  test('o aviso do "Reenviar" e o do "Copiar link" dizem que o link anterior caduca; reenviar leva à linha o envio novo', async ({ page, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    await definirOEnvio(ana, 'falhou')
    await abrirProfessores(page, request, coordenadora, 1)

    // "Copiar link": é o "Refazer convite" do painel, e o aviso, antes de confirmar, vale para o link enviado e para o copiado.
    const painel = await abrirPainel(page, ana.nome, hasTouch)
    await tocar(painel, 'Refazer convite', hasTouch)
    await expect(noDialogo(page).getByText('O link mandado antes para de valer na hora.', { exact: false })).toBeFocused()
    await expect(noDialogo(page)).toContainText('Isso vale para o link enviado por e-mail e para o copiado.')
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)

    // "Reenviar": o aviso dos links anteriores, o nome de quem recebe, e o foco no texto.
    await tocar(painel, 'Reenviar', hasTouch)
    const dialogo = page.getByRole('dialog', { name: 'Reenviar o convite' })
    await expect(dialogo).toBeVisible()
    await expect(dialogo).toContainText(`Um e-mail novo, com um link novo, para ${ana.nome}.`)
    await expect(dialogo).toContainText(LINKS_ANTERIORES)
    await expect(dialogo.locator('div[tabindex="-1"]')).toBeFocused()
    await conferirDialogo(page)
    await tocar(dialogo, 'Reenviar', hasTouch)
    await expect(dialogo).toContainText('1 convite entrou na fila', { timeout: SIGN_IN_TIMEOUT_MS })
    await tocar(dialogo, 'Fechar', hasTouch)
    await expect(dialogo).toHaveCount(0)
    // O envio velho (`falhou`) não volta: a linha mostra o novo, em fila ou já entregue.
    await expect(envioDe(page, ana.nome)).toHaveText(/^(Enviando|Enviado em \d{2}\/\d{2} às \d{2}:\d{2})$/, { timeout: SIGN_IN_TIMEOUT_MS })
  })
})

test.describe('Professores: estados do envio', () => {
  test('a lista carregando, o erro de rede e o 429 do envio dizem o texto e o foco; a nova tentativa apaga o aviso, e fechar devolve o foco ao botão', async ({
    page,
    request,
    hasTouch,
  }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Bia')
    // A leitura da lista, segurada na primeira vez (o carregando); o envio, recusado como o teste pede (rede, depois cota, depois passa).
    const segurada = gate()
    let leituras = 0
    const respostas: ('503' | '429' | 'passa')[] = ['503', '429', 'passa']
    await page.route(ehALista, async (rota: Route) => {
      if (rota.request().method() !== 'GET') return rota.fallback()
      leituras += 1
      if (leituras === 1) await segurada.aberta
      return rota.fallback()
    })
    await page.route(ehOEnvio, async (rota: Route) => {
      const vez = respostas.shift() ?? 'passa'
      if (vez === '503') return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
      if (vez === '429') return rota.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '120' }, body: LIMITE })
      return rota.fallback()
    })
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/professores', () =>
      expect(principal(page).getByRole('status').filter({ hasText: 'Carregando os professores…' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS }),
    )
    await expect(botaoDeEnviar(page)).toHaveCount(0)
    segurada.abrir()
    await expect(linhasDaLista(page)).toHaveCount(2, { timeout: SIGN_IN_TIMEOUT_MS })

    // 1ª tentativa: a rede cai. O aviso diz o que fazer, com o foco nele, e o botão segue para tentar de novo.
    await activate(botaoDeEnviar(page), hasTouch)
    const dialogo = noDialogo(page)
    await tocar(dialogo, 'Enviar convites', hasTouch)
    await expect(dialogo.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    await expect(dialogo.getByRole('alert')).toBeFocused()
    await expect(dialogo.getByRole('button', { name: 'Enviar convites', exact: true })).toBeEnabled()
    // 2ª: a cota da hora. O aviso da primeira sai, o da cota entra, também com o foco nele.
    await tocar(dialogo, 'Enviar convites', hasTouch)
    await expect(dialogo.getByRole('alert')).toHaveText(TEXTO_DO_429)
    await expect(dialogo.getByRole('alert')).toBeFocused()
    // 3ª: passa. O aviso some, o diálogo diz quantos entraram.
    await tocar(dialogo, 'Enviar convites', hasTouch)
    await expect(dialogo).toContainText('2 convites entraram na fila', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(dialogo.getByRole('alert')).toHaveCount(0)
    await tocar(dialogo, 'Fechar', hasTouch)
    await expect(botaoDeEnviar(page)).toBeFocused()

    // Aberto de novo, o diálogo recomeça: sem o aviso nem o resultado da abertura anterior.
    await activate(botaoDeEnviar(page), hasTouch)
    await expect(noDialogo(page)).toContainText('a 2 professores.')
    await expect(noDialogo(page)).not.toContainText('entraram na fila')
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
  })
})

test.describe('Professores: o recomeço da tela', () => {
  test('abrir o diálogo de novo conta quem espera agora: depois de revogar um convite, a contagem cai', async ({ page, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Bia')
    await abrirProfessores(page, request, coordenadora, 2)

    await activate(botaoDeEnviar(page), hasTouch)
    await expect(noDialogo(page)).toContainText('a 2 professores.')
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)

    // A coordenação revoga o convite da Ana pelo painel; a lista relida tem uma pessoa a menos esperando.
    const painel = await abrirPainel(page, ana.nome, hasTouch)
    await tocar(painel, 'Revogar convite', hasTouch)
    await tocar(noDialogo(page), 'Revogar convite', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0, { timeout: SIGN_IN_TIMEOUT_MS })
    await fecharPainel(page, hasTouch)

    await activate(botaoDeEnviar(page), hasTouch)
    await expect(noDialogo(page)).toContainText('a 1 professor.')
    await expect(noDialogo(page)).not.toContainText('2 professores')
  })

  test('a leitura atrasada de antes do "Reenviar" não devolve o rótulo velho à linha', async ({ page, request, hasTouch }) => {
    await page.clock.install()
    const coordenadora = await criarEquipeComSenha('coordenador')
    // A Ana está em envio (é o que mantém a releitura de 5 s), e o Bia falhou: é a linha dele que o "Reenviar" muda.
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    const bia = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Bia')
    await definirOEnvio(ana, 'na_fila')
    await definirOEnvio(bia, 'falhou')
    // A primeira releitura depois da armação: a resposta verdadeira é buscada agora (com a Bia em `falhou`) e entregue só quando o teste abre.
    const porta = gate()
    let armada = false
    let segurou: () => void = () => undefined
    const seguraram = new Promise<void>((resolver) => {
      segurou = resolver
    })
    let entregou: () => void = () => undefined
    const entregue = new Promise<void>((resolver) => {
      entregou = resolver
    })
    await page.route(ehALista, async (rota: Route) => {
      if (rota.request().method() !== 'GET' || !armada) return rota.fallback()
      armada = false
      const velha = await rota.fetch()
      segurou()
      await porta.aberta
      await rota.fulfill({ response: velha })
      entregou()
    })
    await abrirProfessores(page, request, coordenadora, 2)
    await expect(envioDe(page, bia.nome)).toHaveText('Não chegou. Corrija o e-mail e reenvie, ou copie o link')
    armada = true
    await page.clock.runFor(5_000)
    await seguraram

    // Com a leitura velha no ar, "Reenviar" a Bia: o envio dela sai de `falhou`.
    const painel = await abrirPainel(page, bia.nome, hasTouch)
    await tocar(painel, 'Reenviar', hasTouch)
    await tocar(noDialogo(page), 'Reenviar', hasTouch)
    await expect(noDialogo(page)).toContainText('1 convite entrou na fila', { timeout: SIGN_IN_TIMEOUT_MS })
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(envioDe(page, bia.nome)).toHaveText(/^(Enviando|Enviado em \d{2}\/\d{2} às \d{2}:\d{2})$/, { timeout: SIGN_IN_TIMEOUT_MS })

    // A resposta velha chega agora, depois da nova: a linha não volta a "Não chegou".
    // Espera a entrega da resposta velha (a rota a devolveu à página), e não a próxima releitura de 5 s, que levava uns 4 s a mais e não era a resposta velha.
    porta.abrir()
    await entregue
    await page.evaluate(() => new Promise<void>((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver()))))
    // A resposta velha, se fosse aplicada, trocaria a linha em um ou dois quadros; 250 ms sobram para ver que não trocou. O relógio da página (`clock.install()`
    // sem `pauseAt`) anda sozinho, e a espera é de relógio real do mesmo jeito: o que garante a prova é a resposta já entregue e os dois quadros de antes, não o relógio.
    await page.waitForTimeout(250)
    await expect(envioDe(page, bia.nome)).not.toContainText('Não chegou')
    await expect(envioDe(page, bia.nome)).toHaveText(/^(Enviando|Enviado em \d{2}\/\d{2} às \d{2}:\d{2})$/)
  })
})

test.describe('Professores: o envio a 360 px e a 1366 × 768', () => {
  test('a 360 px não rola de lado; as ações principais têm 44 px e o resto 24 px, na lista e no diálogo "Enviar convites"', async ({ page, request, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    const coordenadora = await criarEquipeComSenha('coordenador')
    // O nome longo, sem espaço, e o rótulo mais comprido: nada pode esticar a tela.
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', `Ana${'a'.repeat(120)}`)
    await definirOEnvio(ana, 'falhou')
    await abrirProfessores(page, request, coordenadora, 1)
    await alvoDeToque(botaoDeEnviar(page), 'Enviar convites')
    await alvoDeToque(botaoDaLinha(page, ana.nome), 'o nome do professor')
    await expect(envioDe(page, ana.nome)).toBeVisible()
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    await activate(botaoDeEnviar(page), hasTouch)
    for (const botao of ['Enviar convites', 'Cancelar']) await alvoDeToque(noDialogo(page).getByRole('button', { name: botao, exact: true }), botao)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
  })

  test('a 360 px não rola de lado; as ações principais têm 44 px e o resto 24 px, no painel e no diálogo "Reenviar"', async ({ page, request, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    const coordenadora = await criarEquipeComSenha('coordenador')
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', `Ana${'a'.repeat(120)}`)
    await definirOEnvio(ana, 'falhou')
    await abrirProfessores(page, request, coordenadora, 1)
    const painel = await abrirPainel(page, ana.nome, hasTouch)
    for (const botao of ['Reenviar', 'Refazer convite', 'Revogar convite', 'Fechar']) await alvoDeToque(painel.getByRole('button', { name: botao, exact: true }), botao)
    expect(await horizontalOverflow(page)).toBe(0)
    await tocar(painel, 'Reenviar', hasTouch)
    for (const botao of ['Reenviar', 'Cancelar']) await alvoDeToque(noDialogo(page).getByRole('button', { name: botao, exact: true }), botao)
    await conferirDialogo(page)
    // O resto da tela, dentro do diálogo e fora dele, passa dos 24 px do WCAG 2.5.8 (o axe `target-size` está em `conferirDialogo`).
    for (const alvo of await noDialogo(page).getByRole('button').all()) await alvoDeToque(alvo, 'botão do diálogo', 24)
  })

  test('com envio em todas as linhas, a página cabe: a 1366 × 768 não rola, e a 360 px não rola de lado (`paginaNaoRola`)', async ({ page, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estados: EstadoDoEnvio[] = ['na_fila', 'enviando', 'enviado', 'falhou', 'cancelado']
    for (const [indice, envio] of estados.entries()) {
      const professor = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', `Prof${String(indice)}`)
      await definirOEnvio(professor, envio, ENVIADO_EM_UTC)
    }
    await abrirProfessores(page, request, coordenadora, 5)
    await expect(tituloDaLista(page)).toBeVisible()
    await paginaNaoRola(page)
    expect(await seriousViolations(page)).toEqual([])
  })
})

test.describe('Professores: "Corrigir o e-mail"', () => {
  const corrigirOEmail = (page: Page) => page.getByRole('dialog', { name: 'Corrigir o e-mail' })
  const campoDoEmail = (page: Page) => corrigirOEmail(page).getByLabel(/E-mail certo/)

  test('o envio falhou: a coordenação corrige o e-mail, envia pelo "Reenviar", o e-mail chega ao endereço certo, o professor aceita e vê a turma da grade', async ({
    page,
    browser,
    request,
    hasTouch,
  }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    // A grade deu a ele uma turma e uma aula: corrigir o e-mail mantém o professor, e com ele a turma.
    const grade = await criarAlocacaoDoProfessor(coordenadora.escolaId, ana.usuarioId, ['Matemática'])
    await criarAulasNoBanco(coordenadora.escolaId, grade.vinculoIds[0] ?? '', [{ dia: 2, inicio: '07:30', fim: '08:20' }])
    await definirOEnvio(ana, 'falhou')
    await abrirProfessores(page, request, coordenadora, 1)
    await expect(envioDe(page, ana.nome)).toHaveText(TEXTO_DO_FALHOU)

    const painel = await abrirPainel(page, ana.nome, hasTouch)
    await tocar(painel, 'Corrigir o e-mail', hasTouch)
    await expect(campoDoEmail(page)).toBeFocused()
    await expect(corrigirOEmail(page)).toContainText('O link anterior deixa de valer.')
    await expect(campoDoEmail(page)).toHaveValue('')
    const certo = `certo-${randomUUID()}@educa.invalid`
    await campoDoEmail(page).fill(certo)
    await tocar(corrigirOEmail(page), 'Corrigir o e-mail', hasTouch)
    await expect(corrigirOEmail(page)).toContainText('E-mail corrigido', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(corrigirOEmail(page).getByLabel('Link do convite')).toHaveValue(/\/convite#[A-Za-z0-9_-]{43}$/)
    // A lista relida: o mesmo professor, pendente e sem envio (o `falhou` era do e-mail velho).
    await expect(envioDe(page, ana.nome)).toHaveText('')
    await expect(linhasDaLista(page)).toHaveCount(1)

    // "Enviar por e-mail" é o "Reenviar" deste professor, que diz que o link mostrado deixa de valer.
    await tocar(corrigirOEmail(page), 'Enviar por e-mail', hasTouch)
    const reenviar = page.getByRole('dialog', { name: 'Reenviar o convite' })
    await expect(reenviar).toBeVisible()
    await expect(corrigirOEmail(page)).toHaveCount(0)
    await expect(reenviar).toContainText(`Um e-mail novo, com um link novo, para ${ana.nome}.`)
    await expect(reenviar).toContainText(LINKS_ANTERIORES)
    await tocar(reenviar, 'Reenviar', hasTouch)
    await expect(reenviar).toContainText('1 convite entrou na fila', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect.poll(mensagemChegou(certo), { timeout: SIGN_IN_TIMEOUT_MS }).toBe(true)
    expect(await mensagemDoMailpit(ana.email)).toBeUndefined()

    // O professor abre o link do e-mail novo, cria a senha, entra com o e-mail certo e vê a turma da grade para confirmar.
    const link = new URL(/https?:\/\/\S+\/convite#[A-Za-z0-9_-]{43}/.exec((await mensagemDoMailpit(certo))?.texto ?? '')?.[0] ?? '')
    const professor = await outroNavegador(browser)
    await professor.goto(`${link.pathname}${link.hash}`)
    await expect(professor.getByRole('main')).toContainText(coordenadora.escolaNome, { timeout: SIGN_IN_TIMEOUT_MS })
    await tocar(professor.getByRole('main'), 'Aceitar o convite', hasTouch)
    await professor.getByLabel('Senha nova').fill(SENHA_NOVA, { timeout: SIGN_IN_TIMEOUT_MS })
    await tocar(professor.getByRole('main'), 'Definir a senha e continuar', hasTouch)
    await expect(professor).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await entrarPorEmail(professor, { email: certo, senha: SENHA_NOVA }, hasTouch)
    // A sessão chegou (o professor é o mesmo, com o nome que a coordenação cadastrou) antes de ir às turmas: a gaveta do celular não abre sem ela.
    await esperarNovaConversa(professor, ana.nome)
    await irPelaNavegacao(professor, 'Turmas', hasTouch)
    await expect(principal(professor).getByRole('region', { name: 'Confirme suas turmas', exact: true })).toContainText(grade.turmaNome, { timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('o e-mail de outro professor da escola não serve e o campo segue com o foco; se o convite é revogado antes (direto no banco), o diálogo diz que o convite mudou, com a lista relida', async ({
    page,
    request,
    hasTouch,
  }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    const bia = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Bia')
    await abrirProfessores(page, request, coordenadora, 2)

    const painel = await abrirPainel(page, ana.nome, hasTouch)
    await tocar(painel, 'Corrigir o e-mail', hasTouch)
    await campoDoEmail(page).fill(bia.email)
    await tocar(corrigirOEmail(page), 'Corrigir o e-mail', hasTouch)
    await expect(corrigirOEmail(page)).toContainText(EMAIL_QUE_NAO_SERVE, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoDoEmail(page)).toBeFocused()
    await expect(corrigirOEmail(page).getByRole('alert')).toHaveCount(0)
    await expect(tituloDaLista(page)).toBeVisible()

    // O convite da Ana é revogado enquanto o diálogo está aberto, direto no banco (como se outra pessoa o tivesse feito): o estado muda no servidor, sem segunda aba.
    await revogarConvite({ escolaId: coordenadora.escolaId, usuarioId: ana.usuarioId })
    await campoDoEmail(page).fill(`certo-${randomUUID()}@educa.invalid`)
    await tocar(corrigirOEmail(page), 'Corrigir o e-mail', hasTouch)
    await expect(corrigirOEmail(page).getByRole('alert')).toHaveText(CONVITE_QUE_MUDOU, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(campoDoEmail(page)).toHaveCount(0)
    await expect(corrigirOEmail(page).getByRole('button', { name: 'Corrigir o e-mail', exact: true })).toHaveCount(0)
    await expect(linhaDe(page, ana.nome)).toContainText('Convite revogado.')
    await tocar(corrigirOEmail(page), 'Fechar', hasTouch)
    await expect(corrigirOEmail(page)).toHaveCount(0)
    await expect(painel.getByRole('heading', { name: 'Situação do convite' })).toBeFocused()
  })

  test('a resposta atrasada de uma correção com o diálogo já fechado não reabre nada nem mostra o link, e a lista é relida', async ({ page, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', 'Ana')
    await definirOEnvio(ana, 'falhou')
    // A API corrige agora; a resposta chega à página só quando o teste abre a porta.
    const porta = gate()
    let segurou: () => void = () => undefined
    const seguraram = new Promise<void>((resolver) => {
      segurou = resolver
    })
    let entregou: () => void = () => undefined
    const entregue = new Promise<void>((resolver) => {
      entregou = resolver
    })
    await page.route(ehACorrecao, async (rota: Route) => {
      const verdadeira = await rota.fetch()
      segurou()
      await porta.aberta
      await rota.fulfill({ response: verdadeira })
      entregou()
    })
    await abrirProfessores(page, request, coordenadora, 1)
    const painel = await abrirPainel(page, ana.nome, hasTouch)
    await tocar(painel, 'Corrigir o e-mail', hasTouch)
    await campoDoEmail(page).fill(`certo-${randomUUID()}@educa.invalid`)
    await tocar(corrigirOEmail(page), 'Corrigir o e-mail', hasTouch)
    await expect(corrigirOEmail(page).getByRole('button', { name: 'Corrigindo…', exact: true })).toBeDisabled()
    await seguraram

    // Fechar com o pedido no ar pergunta antes; "Fechar sem copiar" fecha, e a resposta que chega depois não encontra diálogo nenhum.
    await tocar(corrigirOEmail(page), 'Cancelar', hasTouch)
    await expect(corrigirOEmail(page)).toContainText('O e-mail ainda está sendo corrigido')
    await tocar(corrigirOEmail(page), 'Fechar sem copiar', hasTouch)
    await expect(corrigirOEmail(page)).toHaveCount(0)
    porta.abrir()
    await entregue
    // A lista relida: o professor está pendente e sem o envio que falhou. O link, que só existiria no diálogo, não está em lugar nenhum.
    await expect(envioDe(page, ana.nome)).toHaveText('', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(noDialogo(page)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('/convite#')
    expect(await page.evaluate(() => `${window.location.href} ${JSON.stringify({ ...window.localStorage })} ${JSON.stringify({ ...window.sessionStorage })}`)).not.toContain('convite#')
  })

  test('a 1366 × 768 a página não rola e a 360 px não rola de lado, no painel e no diálogo; as ações principais têm 44 px e o resto 24 px', async ({ page, request, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    // O nome longo, sem espaço: nada pode esticar a tela.
    const ana = await convidarProfessorNoBanco(coordenadora.escolaId, 'pendente', `Ana${'a'.repeat(120)}`)
    await definirOEnvio(ana, 'falhou')
    await page.setViewportSize({ width: 1366, height: 768 })
    await abrirProfessores(page, request, coordenadora, 1)
    await paginaNaoRola(page)
    const painel = await abrirPainel(page, ana.nome, hasTouch)
    await tocar(painel, 'Corrigir o e-mail', hasTouch)
    await expect(corrigirOEmail(page)).toBeVisible()
    await paginaNaoRola(page)
    await conferirDialogo(page)

    await page.setViewportSize({ width: 360, height: 800 })
    await alvoDeToque(painel.getByRole('button', { name: 'Corrigir o e-mail', exact: true }), 'Corrigir o e-mail no painel')
    for (const botao of ['Corrigir o e-mail', 'Cancelar']) await alvoDeToque(corrigirOEmail(page).getByRole('button', { name: botao, exact: true }), botao)
    await alvoDeToque(campoDoEmail(page), 'o campo do e-mail')
    await conferirDialogo(page)
    // O link e as três ações da etapa do sucesso, com o nome comprido no texto.
    await campoDoEmail(page).fill(`certo-${randomUUID()}@educa.invalid`)
    await tocar(corrigirOEmail(page), 'Corrigir o e-mail', hasTouch)
    await expect(corrigirOEmail(page)).toContainText('E-mail corrigido', { timeout: SIGN_IN_TIMEOUT_MS })
    for (const botao of ['Copiar link', 'Enviar por e-mail', 'Fechar']) await alvoDeToque(corrigirOEmail(page).getByRole('button', { name: botao, exact: true }), botao)
    await conferirDialogo(page)
    for (const alvo of await corrigirOEmail(page).getByRole('button').all()) await alvoDeToque(alvo, 'botão do diálogo', 24)
  })
})
