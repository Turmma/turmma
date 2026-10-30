import type { Page, Route } from '@playwright/test'
import { AVISO_DO_CONVITE_COM_SENHA_NOVA, AVISO_DO_CONVITE_PARA_CONTA_EXISTENTE, MENSAGENS_DE_ERRO, mensagemDoConvite } from '../packages/shared/src/errors/messages.ts'
import { criarConviteDeCoordenador, criarConviteDeProfessor, criarEquipeComSenha, revogarConvite } from './__fixtures__/sessao.ts'
import { esperarNovaConversa } from './__fixtures__/casca.ts'
import { expect, test } from './__fixtures__/perfis.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, larguraExcedente, violacoesGraves } from './__fixtures__/verificacoes.ts'

const ROTA_CONSULTAR = '**/v1/convites/consultar'
const ROTA_ACEITAR = '**/v1/convites/aceitar'
const INDISPONIVEL = JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
/** O que a tela diz quando o `#` do endereço não é um token: vazio, longo demais ou com `%` quebrado. */
const TEXTO_DO_ENDERECO_INCOMPLETO = 'O endereço do convite está incompleto. Abra o link inteiro que a escola enviou, ou peça um convite novo.'
const PRAZO_DA_TELA_MS = 20_000
/**
 * O que a consulta do link anterior responde quando enfim volta: o convite dele, que vale; a recusa de verdade da API (o convite
 * revogado); e a queda do servidor. Cada volta é um caso, com os 30 s dela: as três juntas num caso só levavam 27 s no celular da esteira.
 */
const voltas = ['vale', 'nao_vale', 'cai'] as const
const tituloDaConsultaAtrasada = (volta: (typeof voltas)[number]): string =>
  `recomeço, consulta atrasada (${volta}): a consulta do link anterior que responde depois de outro link chegar à aba não troca a tela do link novo`
/** Senha nova de coordenador: o mínimo do contrato é 12 caracteres. */
const SENHA_NOVA = 'frase-sintetica-do-convite'

/** Todo endereço por onde o navegador passou: nenhum pode carregar o token do convite (regra 20, item 8). */
function seguirEnderecos(page: Page): string[] {
  const enderecos: string[] = []
  page.on('request', (pedido) => enderecos.push(pedido.url()))
  return enderecos
}

/** Toque no celular, clique no Chromebook. */
async function acionar(page: Page, nome: string | RegExp, hasTouch: boolean): Promise<void> {
  const botao = page.getByRole('button', { name: nome })
  if (hasTouch) await botao.tap()
  else await botao.click()
}

test.describe('aceite do convite, do coordenador e do professor', () => {
  test('o token sai da barra antes da primeira chamada, e o aceite da conta nova leva ao segundo fator', async ({ page, hasTouch }) => {
    const convite = await criarConviteDeCoordenador()
    const enderecos = seguirEnderecos(page)

    // A consulta fica segurada: é a janela em que o token ainda estaria na barra se a tela o tivesse deixado lá.
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    let barraNaPrimeiraChamada = ''
    await page.route(ROTA_CONSULTAR, async (rota: Route) => {
      barraNaPrimeiraChamada = page.url()
      await segurada
      await rota.continue()
    })

    await page.goto(`/convite#${convite.token}`)
    await expect.poll(() => barraNaPrimeiraChamada, { timeout: PRAZO_DA_TELA_MS }).not.toBe('')
    expect(barraNaPrimeiraChamada, 'o token precisa sair da barra antes de a primeira chamada sair').not.toContain(convite.token)
    liberar()

    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: PRAZO_DA_TELA_MS })
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    const caixa = await page.getByRole('button', { name: /Aceitar o convite/ }).boundingBox()
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)

    // A tela tenta o aceite sem senha: a conta nova é recusada sem gastar o convite, e só então a senha é pedida.
    const botaoAceitar = page.getByRole('button', { name: /Aceitar o convite|Aceitando/ })
    if (hasTouch) await botaoAceitar.tap()
    else await botaoAceitar.click()
    await expect(page.getByLabel('Senha nova')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByLabel('Senha nova')).toHaveAttribute('autocomplete', 'new-password')
    await page.getByLabel('Senha nova').fill(SENHA_NOVA)
    if (hasTouch) await page.getByRole('button', { name: /Definir a senha e continuar|Salvando/ }).tap()
    else await page.getByRole('button', { name: /Definir a senha e continuar|Salvando/ }).click()

    // Aceitar não abre sessão: o coordenador vai configurar o segundo fator antes de entrar (RF12).
    await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(page).toHaveURL(/\/mfa\/configurar$/)

    // Nem na barra, nem em chamada nenhuma, nem em armazenamento do navegador: o link some do computador da escola.
    expect(page.url()).not.toContain(convite.token)
    for (const endereco of enderecos) expect(endereco, 'token do convite numa URL').not.toContain(convite.token)
    const guardado = await page.evaluate(() => ({ local: JSON.stringify(Object.entries(localStorage)), sessao: JSON.stringify(Object.entries(sessionStorage)) }))
    expect(guardado.local).toBe('[]')
    expect(guardado.sessao).toBe('[]')
  })

  test('clique repetido em "Aceitar o convite" não manda dois aceites: o convite vale uma vez só', async ({ page }) => {
    const convite = await criarConviteDeCoordenador()
    let aceites = 0
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route('**/v1/convites/aceitar', async (rota: Route) => {
      aceites++
      await segurada
      await rota.continue()
    })

    await page.goto(`/convite#${convite.token}`)
    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: PRAZO_DA_TELA_MS })
    const botaoAceitar = page.getByRole('button', { name: /Aceitar o convite|Aceitando/ })
    // Os dois cliques no mesmo instante, antes de a tela desligar o botão: é o caso que o botão desligado não segura.
    await botaoAceitar.evaluate((botao: HTMLButtonElement) => {
      botao.click()
      botao.click()
    })

    await expect(botaoAceitar).toBeDisabled()
    await botaoAceitar.dispatchEvent('click')
    await expect.poll(() => aceites, { timeout: PRAZO_DA_TELA_MS }).toBe(1)
    liberar()
    await expect(page.getByLabel('Senha nova')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    expect(aceites).toBe(1)
    // O aceite terminou: o botão da senha não fica preso no "Salvando…" do pedido anterior.
    await expect(page.getByRole('button', { name: 'Definir a senha e continuar' })).toBeEnabled()
  })

  test('W14: convite expirado, revogado, já usado e inexistente, do coordenador e do professor, mostram a mesma tela, com "peça outro à coordenação" e o caminho de quem já aceitou', async ({
    page,
    hasTouch,
  }) => {
    const convites = [
      await criarConviteDeCoordenador({ expirado: true }),
      await criarConviteDeCoordenador({ revogado: true }),
      await criarConviteDeProfessor({ expirado: true }),
      await criarConviteDeProfessor({ revogado: true }),
      // O link que o professor abre de novo depois de já ter aceitado: é para ele o "Já aceitou o convite? Entrar".
      await criarConviteDeProfessor({ usado: true }),
    ]
    const mensagem = mensagemDoConvite('NAO_ENCONTRADO')
    expect(mensagem).toContain('Peça outro à coordenação da sua escola.')

    const telas: string[] = []
    for (const token of [...convites.map((convite) => convite.token), 'token-que-nunca-existiu-no-e2e']) {
      await page.goto(`/convite#${token}`)
      await expect(page.getByRole('alert')).toHaveText(mensagem, { timeout: PRAZO_DA_TELA_MS })
      // Nem o nome da escola aparece: a tela não confirma que aquele convite já existiu.
      for (const convite of convites) await expect(page.locator('body')).not.toContainText(convite.escolaNome)
      expect(page.url()).not.toContain(token)
      expect(await larguraExcedente(page)).toBe(0)
      expect(await violacoesGraves(page)).toEqual([])
      telas.push(await page.getByRole('main').innerText())
    }
    // As seis telas são a mesma, letra por letra: nada diz se o convite existiu, nem de que tipo era.
    expect(new Set(telas).size).toBe(1)
    // Quem abriu de novo o convite que já aceitou só precisa entrar: é a única ação da tela, com o alvo de 44 px.
    const entrar = page.getByRole('main').getByRole('link', { name: 'Entrar' })
    const caixaDoEntrar = await entrar.boundingBox()
    expect(caixaDoEntrar?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(caixaDoEntrar?.width ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    if (hasTouch) await entrar.tap()
    else await entrar.click()
    await expect(page).toHaveURL(/\/entrar$/)
  })

  test('W14: o professor com a conta nova cria a senha, vai à entrada sem segundo fator, entra e chega a Turmas', async ({ page, hasTouch }) => {
    const convite = await criarConviteDeProfessor()
    const enderecos = seguirEnderecos(page)
    await page.goto(`/convite#${convite.token}`)
    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: PRAZO_DA_TELA_MS })
    // A consulta diz só a escola: o texto vale para o professor e para a coordenação, e não promete o segundo fator.
    await expect(page.getByRole('main')).toContainText(`Você foi convidado para entrar em ${convite.escolaNome}.`)
    await expect(page.locator('body')).not.toContainText(convite.nome)
    expect(page.url()).not.toContain(convite.token)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Pelo teclado: o botão que tinha o foco sai da tela com o passo da senha, e o foco vai para o campo, e não para o
    // `body`.
    await page.getByRole('button', { name: 'Aceitar o convite' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Senha nova')).toBeFocused({ timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByLabel('Senha nova')).toHaveAttribute('autocomplete', 'new-password')
    await expect(page.getByRole('main')).not.toContainText('segundo fator')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await page.getByLabel('Senha nova').fill(SENHA_NOVA)
    // A senha digitada uma vez só, às cegas, se confere com o "Mostrar" (herdado da 14.0, a peça da 17.0).
    const mostrar = page.getByRole('button', { name: 'Mostrar a senha' })
    await expect(mostrar).toHaveAttribute('aria-pressed', 'false')
    await acionar(page, 'Mostrar a senha', hasTouch)
    await expect(page.getByLabel('Senha nova')).toHaveAttribute('type', 'text')
    await expect(mostrar).toHaveAttribute('aria-pressed', 'true')
    await acionar(page, 'Mostrar a senha', hasTouch)
    await expect(page.getByLabel('Senha nova')).toHaveAttribute('type', 'password')
    await acionar(page, /Definir a senha e continuar|Salvando/, hasTouch)

    // O professor não configura segundo fator: vai à entrada, com o aviso de que a senha foi criada.
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('alert')).toHaveText(AVISO_DO_CONVITE_COM_SENHA_NOVA)
    await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toHaveCount(0)
    expect(await violacoesGraves(page)).toEqual([])
    await page.getByLabel('E-mail').fill(convite.email)
    await page.getByLabel('Senha').fill(SENHA_NOVA)
    await acionar(page, /^Entrar$/, hasTouch)
    // O professor abre em "Nova conversa" (A2), com o nome dele e o da escola na casca.
    await esperarNovaConversa(page, convite.nome, { timeout: PRAZO_DA_TELA_MS, escolaNome: convite.escolaNome })
    // Sem turma confirmada, a tela em que ele abre aponta para Turmas, a um toque.
    const paraTurmas = page.getByRole('main').getByRole('button', { name: 'Ir para Turmas' })
    if (hasTouch) await paraTurmas.tap()
    else await paraTurmas.click()
    await expect(page).toHaveURL(/\/professor\/turmas$/)
    await expect(page.getByRole('main')).toContainText('A coordenação ainda não alocou você', { timeout: PRAZO_DA_TELA_MS })

    // Nem na barra, nem em chamada nenhuma, nem em armazenamento do navegador.
    for (const endereco of enderecos) expect(endereco, 'token do convite numa URL').not.toContain(convite.token)
    const guardado = await page.evaluate(() => ({ local: JSON.stringify(Object.entries(localStorage)), sessao: JSON.stringify(Object.entries(sessionStorage)) }))
    expect(guardado.local).not.toContain(convite.token)
    expect(guardado.sessao).not.toContain(convite.token)
  })

  test('o professor que já tem conta em outra escola aceita sem senha nova, e o login com a senha dele abre a escolha entre as duas', async ({ page, hasTouch }) => {
    const camila = await criarEquipeComSenha('professor')
    const convite = await criarConviteDeProfessor({ conta: camila })
    await page.goto(`/convite#${convite.token}`)
    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: PRAZO_DA_TELA_MS })
    await acionar(page, /Aceitar o convite|Aceitando/, hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_TELA_MS })
    // O aviso é o de quem já tem conta, e não o da senha criada: o link não trocou a senha dela.
    await expect(page.getByRole('alert')).toHaveText(AVISO_DO_CONVITE_PARA_CONTA_EXISTENTE)
    await expect(page.getByLabel('Senha nova')).toHaveCount(0)
    await page.getByLabel('E-mail').fill(camila.email)
    await page.getByLabel('Senha').fill(camila.senha)
    await acionar(page, /^Entrar$/, hasTouch)
    await expect(page.getByRole('heading', { name: 'Escolher a escola' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('main')).toContainText(convite.escolaNome)
    await expect(page.getByRole('main')).toContainText(camila.escolaNome)
  })

  test('quem já tem conta em outra escola vai para a entrada, sem campo de senha nova, e o login ativa a escola do convite', async ({ page, hasTouch }) => {
    // A professora já trabalha numa escola cliente: a conta dela tem senha, e o link não pode trocá-la.
    const camila = await criarEquipeComSenha('professor')
    const convite = await criarConviteDeCoordenador({ conta: camila })

    await page.goto(`/convite#${convite.token}`)
    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: PRAZO_DA_TELA_MS })
    const botaoAceitar = page.getByRole('button', { name: /Aceitar o convite|Aceitando/ })
    if (hasTouch) await botaoAceitar.tap()
    else await botaoAceitar.click()

    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('alert')).toContainText(AVISO_DO_CONVITE_PARA_CONTA_EXISTENTE)
    // A tela nunca pede senha nova a quem já tem conta: o que falta é a senha que ela já usa.
    await expect(page.getByLabel('Senha nova')).toHaveCount(0)
    expect(await violacoesGraves(page)).toEqual([])

    await page.getByLabel('E-mail').fill(camila.email)
    await page.getByLabel('Senha').fill(camila.senha)
    if (hasTouch) await page.getByRole('button', { name: /^Entrar$/ }).tap()
    else await page.getByRole('button', { name: /^Entrar$/ }).click()

    // Com o bilhete guardado em memória, o login ativa o usuário da escola que convidou: agora são duas escolas
    // ativas, e a etapa passa a ser a escolha. Sem o bilhete, ela entraria direto na escola antiga.
    await expect(page.getByRole('heading', { name: 'Escolher a escola' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(page).toHaveURL(/\/escolher-escola$/)
  })

  test('a consulta que cai por rede ou servidor tem "Tentar de novo", com o token que continua na memória da tela', async ({ page, hasTouch }) => {
    const convite = await criarConviteDeProfessor()
    let falhar = true
    let consultas = 0
    // A nova tentativa fica segurada: é a janela em que a tela diz que está conferindo, em vez de manter o erro.
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_CONSULTAR, async (rota: Route) => {
      consultas++
      if (falhar) return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
      await segurada
      return rota.continue()
    })
    await page.goto(`/convite#${convite.token}`)
    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_TELA_MS })
    // Não é a tela do convite que não vale: a pessoa não é mandada pedir outro convite por causa de uma queda de rede.
    await expect(page.locator('body')).not.toContainText('não vale mais')
    expect(page.url()).not.toContain(convite.token)
    expect(await violacoesGraves(page)).toEqual([])
    expect(consultas).toBe(1)
    falhar = false
    await acionar(page, 'Tentar de novo', hasTouch)
    await expect(page.getByRole('status').filter({ hasText: 'Conferindo o convite…' })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    liberar()
    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: PRAZO_DA_TELA_MS })
    expect(consultas).toBe(2)
    expect(page.url()).not.toContain(convite.token)
  })

  test('recomeço, mesmo link: colar de novo o mesmo convite na aba recomeça a tela e tira o token da barra; um fragmento quebrado diz que o endereço está incompleto', async ({
    page,
    hasTouch,
  }) => {
    const convite = await criarConviteDeProfessor()
    const barraNasConsultas: string[] = []
    page.on('request', (pedido) => {
      if (new URL(pedido.url()).pathname === '/v1/convites/consultar') barraNasConsultas.push(page.url())
    })
    // A segunda consulta, a do mesmo link colado de novo, fica segurada: é a janela em que a senha digitada ainda
    // estaria na tela se o recomeço esperasse a resposta.
    let consultas = 0
    let liberarASegunda: () => void = () => undefined
    const segundaSegurada = new Promise<void>((resolver) => (liberarASegunda = resolver))
    await page.route(ROTA_CONSULTAR, async (rota: Route) => {
      if (++consultas === 2) await segundaSegurada
      await rota.continue()
    })
    // O aceite com a senha cai uma vez (503): o aviso da falha fica na tela, com a senha digitada.
    let derrubar = true
    await page.route(ROTA_ACEITAR, async (rota: Route) => {
      const comSenha = 'senha' in (rota.request().postDataJSON() as object)
      if (comSenha && derrubar) {
        derrubar = false
        return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
      }
      return rota.continue()
    })
    await page.goto(`/convite#${convite.token}`)
    await acionar(page, /Aceitar o convite|Aceitando/, hasTouch)
    await page.getByLabel('Senha nova').fill(SENHA_NOVA, { timeout: PRAZO_DA_TELA_MS })
    await acionar(page, /Definir a senha e continuar|Salvando/, hasTouch)
    await expect(page.getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByLabel('Senha nova')).toHaveValue(SENHA_NOVA)
    expect(barraNasConsultas).toHaveLength(1)

    // O mesmo link de novo: só o `#` muda, sem recarregar. A tela consulta outra vez, e a senha digitada e o aviso da
    // tentativa anterior saem.
    await page.goto(`/convite#${convite.token}`)
    await expect.poll(() => barraNasConsultas.length, { timeout: PRAZO_DA_TELA_MS }).toBe(2)
    // Com a consulta ainda no ar, a tela já recomeçou: confere o convite, sem o campo da senha nem o aviso.
    await expect(page.getByRole('status').filter({ hasText: 'Conferindo o convite…' })).toBeVisible()
    await expect(page.getByLabel('Senha nova')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    liberarASegunda()
    await expect(page.getByRole('button', { name: 'Aceitar o convite' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByLabel('Senha nova')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(page.url()).not.toContain(convite.token)
    for (const barra of barraNasConsultas) expect(barra, 'o token precisa sair da barra antes da consulta').not.toContain(convite.token)
    // O convite continua valendo: recomeçar não o gastou, e a senha volta vazia.
    await acionar(page, /Aceitar o convite|Aceitando/, hasTouch)
    await expect(page.getByLabel('Senha nova')).toHaveValue('', { timeout: PRAZO_DA_TELA_MS })

    // Um fragmento que não é token (o link colado pela metade): a tela diz que o endereço está incompleto, com a barra
    // limpa, sem consultar nada e sem quebrar.
    await page.goto('/convite#%E0%A4%A')
    await expect(page.getByRole('alert')).toHaveText(TEXTO_DO_ENDERECO_INCOMPLETO, { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByLabel('Senha nova')).toHaveCount(0)
    expect(page.url()).toMatch(/\/convite$/)
    expect(barraNasConsultas).toHaveLength(2)
    expect(await violacoesGraves(page)).toEqual([])
    // E a página carregada já com o fragmento quebrado também abre, na mesma tela.
    await page.goto('/sistema')
    await page.goto('/convite#%E0%A4%A')
    await expect(page.getByRole('alert')).toHaveText(TEXTO_DO_ENDERECO_INCOMPLETO, { timeout: PRAZO_DA_TELA_MS })
  })

  test('recomeço, resposta atrasada: o aceite do link anterior que responde depois de outro link chegar à aba não entra; a tela fica no link novo, que segue até a entrada', async ({
    page,
    hasTouch,
  }) => {
    // O link anterior é de quem já tem conta: o aceite dele, sem senha, dá certo e levaria a aba à entrada.
    const camila = await criarEquipeComSenha('professor')
    const anterior = await criarConviteDeProfessor({ conta: camila })
    const novo = await criarConviteDeProfessor()
    // Os dois primeiros aceites ficam segurados, cada um na sua porta: o do link anterior, que ainda está no ar quando o
    // link novo chega, e o primeiro do link novo, que sai com o anterior ainda no ar.
    let aceites = 0
    const liberar: (() => void)[] = []
    const seguradas = [0, 1].map((posicao) => new Promise<void>((resolver) => (liberar[posicao] = resolver)))
    await page.route(ROTA_ACEITAR, async (rota: Route) => {
      const segurada = seguradas[aceites++]
      if (segurada !== undefined) await segurada
      await rota.continue()
    })

    await page.goto(`/convite#${anterior.token}`)
    await expect(page.getByRole('main')).toContainText(anterior.escolaNome, { timeout: PRAZO_DA_TELA_MS })
    await acionar(page, /Aceitar o convite|Aceitando/, hasTouch)
    await expect.poll(() => aceites, { timeout: PRAZO_DA_TELA_MS }).toBe(1)
    await expect(page.getByRole('button', { name: 'Aceitando…' })).toBeDisabled()

    // O link novo muda só o `#`: a tela confere o convite dele e mostra a escola dele, com o aceite anterior no ar. O
    // botão do link novo não fica preso no "Aceitando…" de um pedido que não é dele.
    await page.goto(`/convite#${novo.token}`)
    await expect(page.getByRole('main')).toContainText(novo.escolaNome, { timeout: PRAZO_DA_TELA_MS })
    await expect(page.locator('body')).not.toContainText(anterior.escolaNome)
    await expect(page.getByRole('button', { name: 'Aceitar o convite' })).toBeEnabled()

    // O aceite do link novo sai com o anterior ainda no ar, e fica no ar também.
    await acionar(page, 'Aceitar o convite', hasTouch)
    await expect.poll(() => aceites, { timeout: PRAZO_DA_TELA_MS }).toBe(2)
    const aceitandoONovo = page.getByRole('button', { name: 'Aceitando…' })
    await expect(aceitandoONovo).toBeDisabled()
    const respostaDoAnterior = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/convites/aceitar')
    liberar[0]?.()
    // O aceite anterior valeu no servidor (200, com o bilhete), e mesmo assim a tela não segue com ele: fica no link
    // novo, sem aviso, e a volta dele não solta o botão do aceite que é do link novo.
    expect((await respostaDoAnterior).status()).toBe(200)
    await expect(page).toHaveURL(/\/convite$/)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('main')).toContainText(novo.escolaNome)
    await expect(aceitandoONovo).toBeDisabled()
    expect(aceites).toBe(2)

    // A tela é a do link novo, e segue: a conta dele é nova, e a senha leva à entrada com o aviso da senha criada, e
    // não com o de quem já tinha conta, que seria o do aceite anterior.
    liberar[1]?.()
    await page.getByLabel('Senha nova').fill(SENHA_NOVA, { timeout: PRAZO_DA_TELA_MS })
    await acionar(page, /Definir a senha e continuar|Salvando/, hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_TELA_MS })
    await expect(page.getByRole('alert')).toHaveText(AVISO_DO_CONVITE_COM_SENHA_NOVA)
    expect(aceites).toBe(3)
    await page.getByLabel('E-mail').fill(novo.email)
    await page.getByLabel('Senha').fill(SENHA_NOVA)
    await acionar(page, /^Entrar$/, hasTouch)
    await esperarNovaConversa(page, novo.nome, { timeout: PRAZO_DA_TELA_MS, escolaNome: novo.escolaNome })
  })

  voltas.forEach((volta) => test(tituloDaConsultaAtrasada(volta), async ({ page, hasTouch }) => {
    const anterior = await criarConviteDeProfessor({ revogado: volta === 'nao_vale' })
    const novo = await criarConviteDeProfessor()
    // Só a consulta do link anterior fica segurada: é a que ainda está no ar quando o link novo chega.
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    const segurar = async (rota: Route) => {
      if ((rota.request().postDataJSON() as { token: string }).token !== anterior.token) return rota.continue()
      await segurada
      if (volta === 'cai') return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
      return rota.continue()
    }
    await page.route(ROTA_CONSULTAR, segurar)
    // Uma carga nova da página: o link anterior é o que a página leu ao abrir.
    await page.goto('/sistema')
    await page.goto(`/convite#${anterior.token}`)
    await expect(page.getByRole('status').filter({ hasText: 'Conferindo o convite…' })).toBeVisible({ timeout: PRAZO_DA_TELA_MS })

    // O link novo muda só o `#`: a consulta dele responde, com a do anterior ainda no ar.
    await page.goto(`/convite#${novo.token}`)
    await expect(page.getByRole('main')).toContainText(novo.escolaNome, { timeout: PRAZO_DA_TELA_MS })
    const respostaDoAnterior = page.waitForResponse(
      (resposta) => new URL(resposta.url()).pathname === '/v1/convites/consultar' && (resposta.request().postDataJSON() as { token: string }).token === anterior.token,
    )
    liberar()
    await (await respostaDoAnterior).finished()
    // A resposta chegou, e a página teve tempo de fazer o que fosse fazer com ela. Se esta espera um dia ficar curta,
    // o teste ainda pega a guarda que saiu pelo token do aceite, mais abaixo, ou pelo botão que some.
    await page.evaluate(() => new Promise<void>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto()))))

    // A tela continua a do link novo: a escola dele, sem a do anterior, sem "não vale" nem erro.
    await expect(page.getByRole('main'), volta).toContainText(novo.escolaNome)
    await expect(page.locator('body'), volta).not.toContainText(anterior.escolaNome)
    await expect(page.getByRole('alert'), volta).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Aceitar o convite' }), volta).toBeEnabled()
    // E o aceite seguinte leva o token do link novo, e não o do anterior.
    const aceite = page.waitForRequest((pedido) => new URL(pedido.url()).pathname === '/v1/convites/aceitar')
    await acionar(page, 'Aceitar o convite', hasTouch)
    expect((await aceite).postDataJSON(), volta).toEqual({ token: novo.token })
    await expect(page.getByLabel('Senha nova')).toBeVisible({ timeout: PRAZO_DA_TELA_MS })
  }))

  test('o convite usado entre a consulta e o aceite mostra a tela do convite que não vale, sem o nome da escola', async ({ page, hasTouch }) => {
    const convite = await criarConviteDeProfessor()
    await page.goto(`/convite#${convite.token}`)
    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: PRAZO_DA_TELA_MS })
    // Outra pessoa da coordenação revoga o convite com esta tela aberta.
    await revogarConvite(convite)
    await acionar(page, /Aceitar o convite|Aceitando/, hasTouch)
    await expect(page.getByRole('alert')).toHaveText(mensagemDoConvite('NAO_ENCONTRADO'), { timeout: PRAZO_DA_TELA_MS })
    await expect(page.locator('body')).not.toContainText(convite.escolaNome)
    await expect(page.getByRole('button', { name: 'Aceitar o convite' })).toHaveCount(0)
  })
})
