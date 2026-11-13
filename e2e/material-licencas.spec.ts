import type { Locator, Page, Request, Route } from '@playwright/test'
import { abrirNavegacao, entrarPelaTelaComSegundoFator, lateral, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { irPelaCoordenacao, linhasDaTabela, paginaNaoRola } from './support/coordenacao.ts'
import { criarLicencaNoBanco, criarMaterialNoBanco, licencasNoBanco } from './support/material.ts'
import { expect, test } from './support/profiles.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga, configurarSegundoFatorPelaApi } from './support/mfa.ts'
import { criarEquipeComSenha, montarEstruturaNoBanco, type EquipeDeTeste, type EstruturaDeTeste } from './support/seed.ts'
import { horizontalOverflow, larguraExcedenteDoDialogo, seriousViolations } from './support/checks.ts'

/**
 * A aba Licenças de Material e o aviso `licenca-vencendo` do sino (ingestao-do-material, 6.0; RF16 e RF17), pela tela, nos projetos
 * `chromebook` e `celular`: registrar e ver na lista, o que a vigência nova faz com a busca antes de salvar, o aviso do sino que leva à
 * aba e some quando a vigência muda, o isolamento entre escolas (a lista e o sino), o professor que não alcança a aba e o recomeço da
 * tela (a falha com o diálogo aberto; a pessoa seguinte na mesma aba). As datas das licenças são relativas ao dia de São Paulo, o mesmo
 * por que a API calcula a situação: o caso não depende da hora em que roda. Nomes inventados pelo teste.
 */

const INDISPONIVEL = JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
const TEXTO_DA_FALHA_DO_REGISTRO = 'O registro não foi concluído. Confira a lista de licenças antes de tentar de novo.'
const TEXTO_DO_VENCIDO_NO_SINO = 'Uma licença de material venceu; os materiais dela saíram da busca'

const principal = (page: Page) => page.getByRole('main')
/** A aba Licenças aberta: a região dela, com a lista (ou o vazio) dentro. */
const aba = (page: Page) => principal(page).getByRole('region', { name: 'Licenças de material' })
const linhasDeLicencas = (page: Page) => linhasDaTabela(aba(page))
const linhaDe = (page: Page, licenciante: string) => linhasDeLicencas(page).filter({ hasText: licenciante })
const caixaDeRegistro = (page: Page) => page.getByRole('dialog', { name: 'Registrar licença' })
const caixaDaVigencia = (page: Page) => page.getByRole('dialog', { name: 'Mudar a vigência' })
const sinoDe = (page: Page): Locator => page.getByRole('button', { name: /^Esperando você/ })
const listaDoSino = (page: Page): Locator => page.getByRole('dialog', { name: 'Esperando você' })
const ehALista = (url: URL) => url.pathname === '/v1/licencas'

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** `AAAA-MM-DD` do dia de São Paulo daqui a `dias` dias (o Brasil não tem horário de verão desde 2019: 24 h por dia). */
function diaEm(dias: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + dias * 86_400_000))
}

/** `AAAA-MM-DD` → `dd/mm/aaaa`, como a lista diz. */
function dataBR(data: string): string {
  return data.split('-').reverse().join('/')
}

/** `AAAA-MM-DD` → `dd/mm`, como o sino diz. */
function diaEMes(data: string): string {
  const [, mes = '', dia = ''] = data.split('-')
  return `${dia}/${mes}`
}

/** Uma porta que segura a resposta até o teste abrir. */
function gate(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

interface Cenario {
  readonly coordenadora: EquipeDeTeste
  readonly estrutura: EstruturaDeTeste
}

/** A coordenadora de uma escola com uma disciplina, na aba Licenças, aberta pelo endereço, com a leitura da lista terminada. */
async function abrirLicencas(page: Page, request: Parameters<typeof abrirPelaApiSemMedirAPrimeiraCarga>[1], antes?: (cenario: Cenario) => Promise<void>): Promise<Cenario> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId)
  const cenario = { coordenadora, estrutura }
  await antes?.(cenario)
  await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/material?aba=licencas', async () => {
    await expect(page).toHaveURL(/\/coordenacao\/material\?aba=licencas$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(aba(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  })
  return cenario
}

async function preencherORegistro(page: Page, licenciante: string, comFim: string): Promise<void> {
  const caixa = caixaDeRegistro(page)
  await caixa.getByLabel('Quem deu a licença').fill(licenciante)
  await caixa.getByLabel('O que a licença cobre').fill('Coleção de Química, 1º ao 3º ano')
  await caixa.getByLabel('Documento da licença').fill('Termo 2026/07')
  await caixa.getByLabel('Começa em').fill(diaEm(-5))
  await caixa.getByLabel('Termina em').fill(comFim)
}

test.describe('Licenças de material da coordenação', () => {
  test('a aba abre pelo caminho da pessoa, o vazio convida a registrar, e o formulário incompleto diz o que falta sem pedido à API', async ({ page, hasTouch, request }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    await montarEstruturaNoBanco(coordenadora.escolaId)
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/painel', async () => {
      await expect(page).toHaveURL(/\/coordenacao\/painel$/, { timeout: SIGN_IN_TIMEOUT_MS })
    })
    await irPelaCoordenacao(page, 'Material', hasTouch)
    const abaDasLicencas = principal(page).getByRole('tab', { name: 'Licenças', exact: true })
    await activate(abaDasLicencas, hasTouch)
    await expect(abaDasLicencas).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/\/coordenacao\/material\?aba=licencas$/)

    // O vazio é um convite para agir, e só aparece com a leitura terminada.
    await expect(aba(page).getByText('Nenhuma licença registrada')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(aba(page).getByRole('button', { name: 'Registrar licença' }), hasTouch)
    await expect(caixaDeRegistro(page)).toBeVisible()

    // O formulário incompleto diz o que falta, sem pedido à API.
    await activate(caixaDeRegistro(page).getByRole('button', { name: 'Registrar licença' }), hasTouch)
    await expect(caixaDeRegistro(page).getByText('Diga quem deu a licença: a editora, o sistema de ensino ou o autor.')).toBeVisible()
    expect(await licencasNoBanco(coordenadora.escolaId)).toEqual([])
  })

  test('o registro entra na lista com a situação em texto, e a página não rola', async ({ page, hasTouch, request }) => {
    test.slow()
    const { coordenadora } = await abrirLicencas(page, request)
    await expect(aba(page).getByText('Nenhuma licença registrada')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await activate(aba(page).getByRole('button', { name: 'Registrar licença' }), hasTouch)
    await expect(caixaDeRegistro(page)).toBeVisible()

    await preencherORegistro(page, 'Editora Orquídea', diaEm(200))
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await activate(caixaDeRegistro(page).getByRole('button', { name: 'Registrar licença' }), hasTouch)
    await expect(caixaDeRegistro(page)).toHaveCount(0, { timeout: SIGN_IN_TIMEOUT_MS })

    const linha = linhaDe(page, 'Editora Orquídea')
    await expect(linha).toHaveCount(1, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(linha).toContainText('Vigente')
    await expect(linha).toContainText('Nenhum material')
    await expect(linha).toContainText('Documento: Termo 2026/07')
    await expect(principal(page).getByText('Licença registrada. Ela já pode ser escolhida no envio de material de terceiro.')).toBeAttached()
    const noBanco = await licencasNoBanco(coordenadora.escolaId)
    expect(noBanco.map((licenca) => licenca.licenciante)).toEqual(['Editora Orquídea'])
    expect(noBanco[0]?.vigenteAte).toBe(diaEm(200))

    await paginaNaoRola(page)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('cada situação em texto, a vigência mostra o que muda na busca antes de salvar, e o aviso do sino leva à aba e some quando a vigência muda', async ({ page, hasTouch, request }) => {
    test.slow()
    const em10 = diaEm(10)
    const { coordenadora } = await abrirLicencas(page, request, async ({ coordenadora: dona, estrutura }) => {
      const vencendo = await criarLicencaNoBanco(dona.escolaId, { licenciante: 'Editora Girassol', desdeEmDias: -100, ateEmDias: 10 })
      const vencida = await criarLicencaNoBanco(dona.escolaId, { licenciante: 'Editora Jacarandá', desdeEmDias: -100, ateEmDias: -3 })
      await criarLicencaNoBanco(dona.escolaId, { licenciante: 'Editora Ipê', desdeEmDias: -100, ateEmDias: -3 })
      await criarLicencaNoBanco(dona.escolaId, { licenciante: 'Editora Cedro', desdeEmDias: -100, ateEmDias: 45 })
      await criarLicencaNoBanco(dona.escolaId, { licenciante: 'Editora Buriti', desdeEmDias: 20, ateEmDias: null })
      await criarLicencaNoBanco(dona.escolaId, { licenciante: 'Editora Migrada', referencia: 'registrada antes da F4', desdeEmDias: -400, ateEmDias: null })
      await criarMaterialNoBanco(dona.escolaId, estrutura.disciplina.id, { titulo: 'Capítulo da Girassol', estado: 'pronto', licencaId: vencendo })
      await criarMaterialNoBanco(dona.escolaId, estrutura.disciplina.id, { titulo: 'Capítulo da Jacarandá', estado: 'pronto', licencaId: vencida })
    })

    // As situações, uma de cada, em texto (a cor é só reforço) e com a data dd/mm/aaaa.
    await expect(linhasDeLicencas(page)).toHaveCount(6, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(linhaDe(page, 'Editora Girassol')).toContainText(`Vence em ${dataBR(diaEm(10))}`)
    await expect(linhaDe(page, 'Editora Girassol')).toContainText('1 material')
    await expect(linhaDe(page, 'Editora Jacarandá')).toContainText(`Vencida em ${dataBR(diaEm(-3))}`)
    await expect(linhaDe(page, 'Editora Jacarandá')).toContainText('Os materiais dela saíram da busca')
    await expect(linhaDe(page, 'Editora Cedro')).toContainText('Vigente')
    await expect(linhaDe(page, 'Editora Buriti')).toContainText(`Começa em ${dataBR(diaEm(20))}`)
    await expect(linhaDe(page, 'Editora Migrada')).toContainText('Criada automaticamente · revise')
    await expect(linhaDe(page, 'Editora Migrada')).toContainText('Documento: não informado')
    await expect(linhaDe(page, 'Editora Migrada')).not.toContainText('F4')
    await expect(linhaDe(page, 'Editora Migrada')).toContainText('Sem data de fim')
    await expect(aba(page).getByText('Uma licença foi criada a partir do nome da editora de cada material')).toBeVisible()

    // O sino: o que vence em 10 dias e o que venceu com material avisam; o que venceu sem material, não. Nenhum nome de licenciante.
    await activate(sinoDe(page), hasTouch)
    await expect(listaDoSino(page)).toBeVisible()
    const venceEm = listaDoSino(page).getByRole('link', { name: new RegExp(`Uma licença de material vence em ${diaEMes(em10)}`) })
    const venceu = listaDoSino(page).getByRole('link', { name: new RegExp(TEXTO_DO_VENCIDO_NO_SINO) })
    await expect(venceEm).toHaveCount(1)
    await expect(venceu).toHaveCount(1)
    await expect(listaDoSino(page).getByRole('link', { name: /Uma licença de material/ })).toHaveCount(2)
    await expect(listaDoSino(page)).not.toContainText('Editora')
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    await page.keyboard.press('Escape')
    await expect(listaDoSino(page)).toHaveCount(0)

    // A vigência da vencida com material: o que acontece com a busca vem antes de salvar.
    await activate(linhaDe(page, 'Editora Jacarandá').getByRole('button', { name: /Mudar a vigência/ }), hasTouch)
    const caixa = caixaDaVigencia(page)
    await expect(caixa).toBeVisible()
    await caixa.getByLabel('Termina em').fill(diaEm(60))
    await expect(caixa.getByRole('status').filter({ hasText: 'volta' })).toContainText('1 material volta à busca do Assistente e do Tutor, sem reenviar.')
    expect(await licencasNoBanco(coordenadora.escolaId).then((todas) => todas.find((licenca) => licenca.licenciante === 'Editora Jacarandá')?.vigenteAte)).toBe(diaEm(-3))
    await activate(caixa.getByRole('button', { name: 'Salvar vigência' }), hasTouch)
    await expect(caixa).toHaveCount(0, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(linhaDe(page, 'Editora Jacarandá')).toContainText('Vigente')
    expect(await licencasNoBanco(coordenadora.escolaId).then((todas) => todas.find((licenca) => licenca.licenciante === 'Editora Jacarandá')?.vigenteAte)).toBe(diaEm(60))

    // O item do "venceu" some do sino sem recarregar a página; o "vence em" fica e leva à aba.
    await activate(sinoDe(page), hasTouch)
    // A ausência só depois da presença: o "vence em" prova que a lista do sino já chegou.
    const venceEmDeNovo = listaDoSino(page).getByRole('link', { name: new RegExp(`Uma licença de material vence em ${diaEMes(em10)}`) })
    await expect(venceEmDeNovo).toHaveCount(1)
    await expect(listaDoSino(page).getByRole('link', { name: new RegExp(TEXTO_DO_VENCIDO_NO_SINO) })).toHaveCount(0)
    await activate(venceEmDeNovo, hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/material\?aba=licencas$/)
    await expect(principal(page).getByRole('tab', { name: 'Licenças', exact: true })).toHaveAttribute('aria-selected', 'true')
    await paginaNaoRola(page)
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('a falha do registro fica no diálogo, com o que foi digitado; fechar e reabrir começa de um formulário novo, e o botão não manda dois pedidos', async ({ page, hasTouch, request }) => {
    test.slow()
    // Um só desvio, com o modo mudando no meio do caso: derruba o registro e depois o segura.
    let modo: 'derrubar' | 'segurar' = 'derrubar'
    const resposta = gate()
    const pedidos: string[] = []
    await page.route(
      (url) => ehALista(url),
      async (rota: Route) => {
        const pedido: Request = rota.request()
        if (pedido.method() !== 'POST') return rota.fallback()
        pedidos.push(pedido.postData() ?? '')
        if (modo === 'derrubar') return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
        if (modo === 'segurar') await resposta.aberta
        return rota.fallback()
      },
    )
    const { coordenadora } = await abrirLicencas(page, request, async ({ coordenadora: dona }) => {
      await criarLicencaNoBanco(dona.escolaId, { licenciante: 'Editora Cedro', desdeEmDias: -100, ateEmDias: 45 })
    })
    await expect(linhasDeLicencas(page)).toHaveCount(1, { timeout: SIGN_IN_TIMEOUT_MS })
    await activate(aba(page).getByRole('button', { name: 'Registrar licença' }), hasTouch)
    await preencherORegistro(page, 'Editora Orquídea', diaEm(90))
    await activate(caixaDeRegistro(page).getByRole('button', { name: 'Registrar licença' }), hasTouch)

    const alerta = caixaDeRegistro(page).getByRole('alert').filter({ hasText: TEXTO_DA_FALHA_DO_REGISTRO })
    await expect(alerta).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(caixaDeRegistro(page).getByLabel('Quem deu a licença')).toHaveValue('Editora Orquídea')
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    expect((await licencasNoBanco(coordenadora.escolaId)).map((licenca) => licenca.licenciante)).toEqual(['Editora Cedro'])

    // Fechar e reabrir: o formulário é novo, e o aviso da tentativa anterior não volta.
    modo = 'segurar'
    await activate(caixaDeRegistro(page).getByRole('button', { name: 'Cancelar' }), hasTouch)
    await expect(caixaDeRegistro(page)).toHaveCount(0)
    await activate(aba(page).getByRole('button', { name: 'Registrar licença' }), hasTouch)
    await expect(caixaDeRegistro(page).getByLabel('Quem deu a licença')).toHaveValue('')
    await expect(caixaDeRegistro(page).getByRole('alert').filter({ hasText: TEXTO_DA_FALHA_DO_REGISTRO })).toHaveCount(0)

    // Agora a resposta demora: o botão fica desligado (o clique duplo em si é do teste de unidade), e o pedido que saiu é um só.
    pedidos.length = 0
    await preencherORegistro(page, 'Editora Orquídea', diaEm(90))
    const enviar = caixaDeRegistro(page).getByRole('button', { name: /Registrar licença|Registrando…/ })
    await activate(enviar, hasTouch)
    await expect(enviar).toBeDisabled()
    await expect(enviar).toHaveText('Registrando…')
    await expect.poll(() => pedidos.length).toBe(1)
    resposta.abrir()
    await expect(caixaDeRegistro(page)).toHaveCount(0, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(linhaDe(page, 'Editora Orquídea')).toHaveCount(1, { timeout: SIGN_IN_TIMEOUT_MS })
    expect(pedidos).toHaveLength(1)
    expect((await licencasNoBanco(coordenadora.escolaId)).map((licenca) => licenca.licenciante).sort()).toEqual(['Editora Cedro', 'Editora Orquídea'])
  })

  test('segunda pessoa: a coordenação de B entra na aba da de A, e nem a lista nem o sino de B trazem a licença de A', async ({ page, hasTouch, request }) => {
    test.slow()
    await abrirLicencas(page, request, async ({ coordenadora: dona, estrutura }) => {
      const licenca = await criarLicencaNoBanco(dona.escolaId, { licenciante: 'Editora da escola A', desdeEmDias: -100, ateEmDias: 10 })
      await criarMaterialNoBanco(dona.escolaId, estrutura.disciplina.id, { titulo: 'Capítulo da escola A', estado: 'pronto', licencaId: licenca })
    })
    await expect(linhaDe(page, 'Editora da escola A')).toHaveCount(1, { timeout: SIGN_IN_TIMEOUT_MS })
    await abrirNavegacao(page, hasTouch)
    await activate(lateral(page).getByRole('button', { name: 'Sair' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })

    // A de B entra na mesma aba, sem recarregar, com a leitura da lista segurada: é aí que a lista de A apareceria.
    const deB = await criarEquipeComSenha('coordenador')
    await montarEstruturaNoBanco(deB.escolaId)
    const segurada = gate()
    await page.route(
      (url) => ehALista(url),
      async (rota: Route) => {
        if (rota.request().method() === 'GET') await segurada.aberta
        return rota.fallback()
      },
    )
    const { segredo } = await configurarSegundoFatorPelaApi(request, deB)
    await entrarPelaTelaComSegundoFator(page, deB, segredo, hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/painel$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await irPelaCoordenacao(page, 'Material', hasTouch)
    await activate(principal(page).getByRole('tab', { name: 'Licenças', exact: true }), hasTouch)
    await expect(aba(page).getByText('Carregando as licenças…')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText('Editora da escola A')
    segurada.abrir()
    await expect(aba(page).getByText('Nenhuma licença registrada')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText('Editora da escola A')

    // O sino de B: sem aviso de licença, que é de A.
    await activate(sinoDe(page), hasTouch)
    await expect(listaDoSino(page)).toBeVisible()
    await expect(listaDoSino(page).getByRole('link', { name: /Uma licença de material/ })).toHaveCount(0)
    await expect(listaDoSino(page)).not.toContainText('licença de material')
  })

  test('o professor não alcança a aba: o endereço cai em "não encontrada", sem pedido de licenças', async ({ page }) => {
    const professora = await criarEquipeComSenha()
    const pedidosDeLicencas: string[] = []
    page.on('request', (pedido: Request) => {
      if (new URL(pedido.url()).pathname === '/v1/licencas') pedidosDeLicencas.push(pedido.method())
    })
    const entrada = await page.request.post('/v1/sessao/email', { data: { email: professora.email, senha: professora.senha } })
    expect(entrada.ok(), 'a entrada pela API').toBe(true)
    await page.goto('/coordenacao/material?aba=licencas')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('tab', { name: 'Licenças', exact: true })).toHaveCount(0)
    expect(pedidosDeLicencas).toEqual([])
  })
})
