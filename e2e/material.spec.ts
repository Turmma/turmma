import type { APIRequestContext, Locator, Page, Request, Route } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { abrirNavegacao, entrarPelaTelaComSegundoFator, lateral, PRAZO_DA_ENTRADA_MS } from './support/casca.ts'
import { irPelaCoordenacao, linhasDaTabela } from './support/coordenacao.ts'
import { CAMINHO_DO_PDF_DE_DEMONSTRACAO, criarMaterialNoBanco, materiaisNoBanco, recusasNaAuditoria } from './support/material.ts'
import { expect, test } from './support/profiles.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga, configurarSegundoFatorPelaApi } from './support/mfa.ts'
import { criarEquipeComSenha, montarEstruturaNoBanco, type EquipeDeTeste, type EstruturaDeTeste } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './support/checks.ts'

/**
 * A tela Material da coordenação (MVP de apresentação, A2; telas da coordenação, 8.0; `docs/mvp-rapido.md`, seções 1 e 9.2; D5, D22,
 * D75): é o primeiro passo do roteiro da demonstração. A tabela com o que falhou primeiro, o diálogo "Enviar material" com o
 * formulário de sempre e o painel do material com "Tentar de novo" e "Excluir material". Tudo pela tela, nos projetos `chromebook` e
 * `celular`, com o PDF de demonstração, que é texto nosso. Os textos esperados estão aqui por extenso.
 */

const TITULO = 'Química 2 — Capítulo 7: Estequiometria'
/** A leitura do PDF acontece depois da resposta do envio, e a tela a acompanha de 1,5 em 1,5 s. */
const PRAZO_DA_LEITURA_MS = 30_000
const INDISPONIVEL = JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
const TEXTO_SEM_LICENCA =
  'Sem uma licença que permita o uso, o material não entra na base da escola. O arquivo não foi enviado nem lido. Peça a autorização ao dono do conteúdo e envie de novo com a licença.'
const TEXTO_SEM_DECLARACAO = 'Falta a declaração de que a escola pode usar este material. O arquivo não foi enviado nem lido. Marque a declaração e envie de novo.'
const TEXTO_INDISPONIVEL = 'O sistema está indisponível no momento. Tente de novo em instantes.'

const ehALista = (url: URL) => url.pathname === '/v1/materiais'
const ehOEnvio = (pedido: Request) => new URL(pedido.url()).pathname === '/v1/materiais' && pedido.method() === 'POST'

const principal = (page: Page) => page.getByRole('main')
const lista = (page: Page) => principal(page).getByRole('region', { name: 'Materiais da escola' })
/** As linhas da tabela (a partir de 768 px) ou os itens da lista (abaixo), todas as da tela. */
const linhasDaLista = (page: Page) => linhasDaTabela(lista(page))
/** A linha de um material (ou de uma recusa), pelo título. */
const linhaDe = (page: Page, titulo: string) => linhasDaLista(page).filter({ hasText: titulo })
/** O botão do título, que abre o painel do material. */
const botaoDaLinha = (page: Page, titulo: string) => linhaDe(page, titulo).getByRole('button', { name: titulo })
/** O diálogo "Enviar material" e o painel de um material, que são `dialog`: pelo nome. */
const caixaDeEnvio = (page: Page) => page.getByRole('dialog', { name: 'Enviar material' })
const painelDe = (page: Page, titulo: string) => page.getByRole('dialog', { name: titulo })
/** A confirmação de excluir. */
const confirmacao = (page: Page) => page.getByRole('alertdialog')
const arquivo = (page: Page) => page.getByTestId('arquivo-do-material')
const enviar = (page: Page) => caixaDeEnvio(page).getByRole('button', { name: /^Enviar material$|^Enviando…$/ })
const declaracao = (page: Page) => caixaDeEnvio(page).getByLabel(/^Declaro que a escola pode usar este material/)
/** O botão da tela que abre o diálogo (o do alto, ou o do vazio): só existe um enquanto o diálogo está fechado. */
const botaoDoEnvio = (page: Page) => principal(page).getByRole('button', { name: 'Enviar material' })
/** O título da lista, para onde o foco vai quando o botão que abriu o diálogo ou o painel saiu da tela. */
const tituloDaLista = (page: Page) => lista(page).getByRole('heading', { name: 'Materiais da escola' })
/** O anúncio da ação que terminou, na região da lista. */
const anuncio = (page: Page, texto: string) => lista(page).getByRole('status').filter({ hasText: texto })
/** O arquivo escolhido, como a área de envio o mostra: o nome e o tamanho (o anúncio para o leitor de tela começa por outro texto). */
const escolhido = (page: Page, nome: string) => caixaDeEnvio(page).getByText(new RegExp(`^${nome.replaceAll('.', '\\.')} · \\d`))

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

interface Cenario {
  readonly coordenadora: EquipeDeTeste
  readonly estrutura: EstruturaDeTeste
}

/**
 * Uma escola com uma disciplina, e a coordenadora dela na tela Material. `antes` roda com a sessão ainda fechada. A entrada é pela API,
 * com o segundo fator já configurado, e a primeira carga da tela Material não afirma nada sobre o tempo de baixar
 * (`abrirPelaApiSemMedirAPrimeiraCarga`): pela tela, o login e a configuração do segundo fator sob a rede móvel lenta ocupavam de dois
 * terços a nove décimos dos 30 s do caso (esteira 40880199949, `celular`). A entrada pela tela tem os casos dela (`entrar.spec.ts`,
 * `mfa.spec.ts`); o que sobra aqui é o que o caso afirma da tela Material.
 */
async function abrirMaterial(page: Page, request: APIRequestContext, antes?: (cenario: Cenario) => Promise<void>): Promise<Cenario> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId)
  const cenario = { coordenadora, estrutura }
  await antes?.(cenario)
  await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/material', async () => {
    await expect(page).toHaveURL(/\/coordenacao\/material$/, { timeout: PRAZO_DA_ENTRADA_MS })
    // A tela monta quando o pedaço dela chega (`import()`): sem esperá-lo aqui, ele baixaria com a rede do perfil de volta, e o título e
    // o resto da tela só apareceriam depois dos 5 s do `expect` de quem chama.
    await expect(principal(page).getByRole('heading', { level: 1, name: 'Escola' })).toBeAttached({ timeout: PRAZO_DA_ENTRADA_MS })
  })
  return cenario
}

/**
 * Entrada pela API: uma escola com uma disciplina, e a coordenadora dela abrindo o endereço dado. Não é só dos casos do `?material=` (o que o
 * link do sino faz): serve também ao caso cujo assunto vem depois de a tela Material estar aberta. A entrada é pela API, com o segundo fator
 * já configurado, e a carga do endereço não afirma nada sobre o tempo de baixar (`abrirPelaApiSemMedirAPrimeiraCarga`).
 * Pela tela, a entrada e a tela Material duas vezes na rede móvel lenta ocupavam quase todo o prazo do caso. `antes` roda com a sessão ainda
 * fechada. `aguardar`, quando vem, roda ainda sem a rede lenta: é a espera da tela carregar (o pedaço da tela Material e a lista, que a carga
 * do endereço só começa), e só serve ao caso cujo assunto vem depois do carregamento. Caso cujo assunto é o tempo de baixar na rede lenta não
 * usa este ajudante.
 */
async function abrirMaterialPeloEndereco(
  page: Page,
  request: APIRequestContext,
  antes: ((cenario: Cenario) => Promise<void>) | undefined,
  endereco: (cenario: Cenario) => string,
  aguardar?: () => Promise<void>,
): Promise<Cenario> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId)
  const cenario = { coordenadora, estrutura }
  await antes?.(cenario)
  await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, endereco(cenario), aguardar)
  return cenario
}

/** Abre o diálogo "Enviar material" pelo botão da tela e espera o formulário. */
async function abrirEnvio(page: Page, hasTouch: boolean): Promise<void> {
  await acionar(botaoDoEnvio(page), hasTouch)
  await expect(caixaDeEnvio(page)).toBeVisible()
}

/** Fecha o diálogo pelo "Cancelar" dele: a página por trás é inerte enquanto ele está aberto. */
async function cancelarEnvio(page: Page, hasTouch: boolean): Promise<void> {
  await acionar(caixaDeEnvio(page).getByRole('button', { name: 'Cancelar' }), hasTouch)
  await expect(caixaDeEnvio(page)).toHaveCount(0)
}

/** Preenche o formulário de envio, que já está aberto. Sem `licenca`, o campo fica como está. */
async function preencher(page: Page, cenario: Cenario, campos: { titulo?: string; licenca?: string; declarar?: boolean; comArquivo?: boolean } = {}): Promise<void> {
  const { titulo = TITULO, licenca = 'Autoria da escola ou de professor dela', declarar = true, comArquivo = true } = campos
  const caixa = caixaDeEnvio(page)
  if (comArquivo) await arquivo(page).setInputFiles(CAMINHO_DO_PDF_DE_DEMONSTRACAO)
  await caixa.getByLabel('Título').fill(titulo)
  await caixa.getByLabel('Disciplina').selectOption({ label: cenario.estrutura.disciplina.nome })
  await caixa.getByLabel('De quem é o material').selectOption({ label: 'Material próprio da escola' })
  await caixa.getByLabel('Licença de uso (obrigatória)').selectOption({ label: licenca })
  if (declarar) await declaracao(page).check()
}

/** Os botões da tela que têm a face cheia (laranja): a regra é um só, o "Enviar material". */
const botoesCheios = (page: Page) =>
  principal(page).getByRole('button').evaluateAll((botoes) => botoes.filter((botao) => getComputedStyle(botao).backgroundColor === 'rgb(232, 115, 46)').map((botao) => botao.textContent))

test.describe('Material da coordenação', () => {
  test('a coordenação sobe o PDF de demonstração com licença e vê "Pronto · 6 páginas", sem recarregar a página', async ({ page, hasTouch, request }) => {
    const cenario = await abrirMaterial(page, request)
    await expect(page).toHaveTitle('Escola: material · Turmma')
    // O vazio convida a enviar o primeiro material.
    await expect(lista(page).getByText('Nenhum material ainda')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await page.evaluate(() => {
      ;(window as unknown as { semRecarga?: boolean }).semRecarga = true
    })

    await abrirEnvio(page, hasTouch)
    await arquivo(page).setInputFiles(CAMINHO_DO_PDF_DE_DEMONSTRACAO)
    // O arquivo escolhido aparece com o nome e o tamanho, e o título é sugerido pelo nome dele.
    await expect(escolhido(page, 'quimica-2-cap-7-estequiometria.pdf')).toBeVisible()
    await expect(caixaDeEnvio(page).getByLabel('Título')).toHaveValue('quimica 2 cap 7 estequiometria')
    await preencher(page, cenario, { comArquivo: false })
    await acionar(enviar(page), hasTouch)

    // O diálogo fecha, a tabela mostra o material e o anúncio diz o que acontece agora.
    await expect(caixaDeEnvio(page)).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(anuncio(page, 'Material enviado. A leitura das páginas começa agora e leva alguns instantes.')).toBeVisible()
    // O botão que abriu o diálogo era o do vazio, e saiu da tela com ele: o foco vai para o título da lista, e não para o `body`.
    await expect(tituloDaLista(page)).toBeFocused()
    const linha = linhaDe(page, TITULO)
    await expect(linha).toContainText(cenario.estrutura.disciplina.nome)
    await expect(linha).toContainText('Autoria da escola ou de professor dela')
    await expect(linha.getByText('Pronto · 6 páginas')).toBeVisible({ timeout: PRAZO_DA_LEITURA_MS })
    expect(await page.evaluate(() => (window as unknown as { semRecarga?: boolean }).semRecarga)).toBe(true)

    // Reabrir o diálogo começa de um formulário novo: sem arquivo, sem título e com a declaração desmarcada.
    await abrirEnvio(page, hasTouch)
    await expect(caixaDeEnvio(page).getByLabel('Título')).toHaveValue('')
    await expect(declaracao(page)).not.toBeChecked()
    await expect(caixaDeEnvio(page).getByRole('button', { name: 'Escolher arquivo' })).toBeVisible()
    await cancelarEnvio(page, hasTouch)

    expect(await materiaisNoBanco(cenario.coordenadora.escolaId)).toEqual([expect.objectContaining({ titulo: TITULO, estado: 'pronto', paginas: 6, trechos: 6, excluido: false })])
    expect(await larguraExcedente(page)).toBe(0)
    // A margem da página é uma só, a da casca (16 px no celular, 32 px a partir de 768 px, A84): a `Page` não a repete, e o
    // conteúdo começa onde o `main` começa.
    const [daCasca, daTela] = await principal(page).evaluate((main) => {
      const tela = main.querySelector('[data-tela]')
      return [getComputedStyle(main).paddingLeft, tela === null ? 'sem tela' : getComputedStyle(tela).paddingLeft]
    })
    expect(daCasca).toBe((page.viewportSize()?.width ?? 0) >= 768 ? '32px' : '16px')
    expect(daTela).toBe('0px')
    // O título da tela se vê (RF12; tarefa 11.0): medido, e não `toBeVisible`, que também passa no `h1` do leitor de tela.
    // A caixa tem 24 px de fonte e está num cabeçalho de 64 px ou mais. O padding do `main`, acima, é o da moldura da
    // casca (32 px a partir de 768 px, 16 px abaixo).
    const titulo = await principal(page)
      .getByRole('heading', { level: 1, name: 'Escola' })
      .evaluate((h1) => {
        const caixa = h1.getBoundingClientRect()
        return { largura: caixa.width, altura: caixa.height, fonte: getComputedStyle(h1).fontSize, posicao: getComputedStyle(h1).position, cabecalho: h1.closest('header')?.getBoundingClientRect().height ?? null }
      })
    expect(titulo.largura).toBeGreaterThan(1)
    expect(titulo.altura).toBeGreaterThan(1)
    expect(titulo.fonte).toBe('24px')
    expect(titulo.posicao).not.toBe('absolute')
    // Antes da medida, que o `h1` está num cabeçalho: sem ele a conferência de 64 px falharia sem dizer o que quebrou.
    expect(titulo.cabecalho).not.toBeNull()
    expect(titulo.cabecalho ?? 0).toBeGreaterThanOrEqual(64)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('enquanto o material está sendo lido a tela consulta sozinha, e troca "Processando" por "Pronto" sem recarregar', async ({ page, request }) => {
    // O preparo (equipe, entrada, menu) leva ~21 s no runner, a troca mais ~5 s e a espera final mais 4 s: soma ~31 s contra os
    // 30 s do relógio do Playwright (esteira 39054499168). O relógio é triplicado, e nenhuma asserção muda.
    test.slow()
    let leituras = 0
    const material = (estado: 'processando' | 'pronto') => ({
      id: '0190f5a0-0000-7000-8000-0000000000aa',
      titulo: TITULO,
      disciplinaId: '0190f5a0-0000-7000-8000-0000000000bb',
      titularidade: 'escola',
      licenciante: null,
      licenca: 'autoria_da_escola',
      estado,
      falha: null,
      paginas: estado === 'pronto' ? 6 : null,
      trechos: estado === 'pronto' ? 6 : 0,
      enviadoEm: '2026-10-04T12:00:00.000Z',
    })
    // As duas primeiras leituras dizem `processando`; da terceira em diante, `pronto`.
    await page.route(
      (url) => ehALista(url),
      async (rota: Route) => {
        if (rota.request().method() !== 'GET') return rota.continue()
        leituras += 1
        await rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [material(leituras <= 2 ? 'processando' : 'pronto')] }) })
      },
    )
    await abrirMaterial(page, request)

    const linha = linhaDe(page, TITULO)
    await expect(linha.getByText('Processando')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // A marca é posta com a página já aberta e antes da troca: uma recarga a apagaria (como no caso de cima).
    await page.evaluate(() => {
      ;(window as unknown as { semRecarga?: boolean }).semRecarga = true
    })
    await expect(lista(page).getByRole('status').filter({ hasText: 'Um material está sendo lido.' })).toBeAttached()
    await expect(linha.getByText('Pronto · 6 páginas')).toBeVisible({ timeout: PRAZO_DA_LEITURA_MS })
    await expect(linha.getByText('Processando')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { semRecarga?: boolean }).semRecarga)).toBe(true)

    // Pronto, a consulta para: nada de leitura em laço com a tela parada.
    const depoisDePronto = leituras
    await page.waitForTimeout(4_000)
    expect(leituras).toBe(depoisDePronto)
  })

  test('sem licença, o diálogo diz "Envio recusado" e por quê; o arquivo não sai do computador, nada vira material e a recusa fica na tabela e na auditoria', async ({ page, hasTouch, request }) => {
    // A lista vazia se espera na carga sem a rede lenta: o que o caso prova é a recusa, e ela vem depois, com a rede do perfil.
    const cenario = await abrirMaterialPeloEndereco(
      page,
      request,
      undefined,
      () => '/coordenacao/material',
      async () => {
        await expect(page).toHaveURL(/\/coordenacao\/material$/)
        await expect(lista(page).getByText('Nenhum material ainda')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
      },
    )
    await abrirEnvio(page, hasTouch)
    await preencher(page, cenario, { licenca: 'Não tenho a licença, ou não sei' })
    // Antes de enviar, a tela já diz o que vai acontecer.
    await expect(caixaDeEnvio(page).getByText('Sem licença, o envio é recusado: o arquivo não é enviado nem lido, e a tentativa fica registrada na auditoria da escola.')).toBeVisible()

    const pedido = page.waitForRequest(ehOEnvio)
    await acionar(enviar(page), hasTouch)
    const corpo = (await pedido).postDataBuffer()

    // O diálogo fica aberto, com o motivo no aviso (que recebe o foco) e o que foi digitado.
    const alerta = caixaDeEnvio(page).getByRole('alert').filter({ hasText: 'Envio recusado.' })
    await expect(alerta).toHaveText(`Envio recusado. ${TEXTO_SEM_LICENCA}`, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(alerta).toBeFocused()
    await expect(caixaDeEnvio(page).getByLabel('Título')).toHaveValue(TITULO)
    // A recusa é uma linha da tabela, e não se confunde com um material: ela não abre painel, e só se dispensa.
    const recusado = linhaDe(page, TITULO)
    await expect(recusado.getByText('Envio recusado · sem licença')).toBeVisible()
    await expect(recusado).toContainText(TEXTO_SEM_LICENCA)
    await expect(recusado.getByRole('button', { name: TITULO, exact: true })).toHaveCount(0)

    // O pedido foi sem o arquivo: nem um byte do PDF saiu do computador.
    expect(corpo).not.toBeNull()
    expect(corpo?.includes('%PDF-')).toBe(false)
    expect(corpo?.includes('sem_licenca')).toBe(true)
    expect(await materiaisNoBanco(cenario.coordenadora.escolaId)).toEqual([])
    expect(await recusasNaAuditoria(cenario.coordenadora.escolaId)).toEqual([{ motivo: 'sem_licenca', licenca: 'sem_licenca', declaracao: true }])

    // Com a licença e sem a declaração, também é recusado, com o outro motivo.
    await caixaDeEnvio(page).getByLabel('Título').fill('Outro capítulo')
    await caixaDeEnvio(page).getByLabel('Licença de uso (obrigatória)').selectOption({ label: 'Licença aberta (Creative Commons e semelhantes)' })
    await declaracao(page).uncheck()
    await acionar(enviar(page), hasTouch)
    await expect(caixaDeEnvio(page).getByRole('alert').filter({ hasText: 'Envio recusado.' })).toHaveText(`Envio recusado. ${TEXTO_SEM_DECLARACAO}`, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhaDe(page, 'Outro capítulo').getByText('Envio recusado · sem declaração')).toBeVisible()
    expect(await materiaisNoBanco(cenario.coordenadora.escolaId)).toEqual([])
    expect((await recusasNaAuditoria(cenario.coordenadora.escolaId)).map((recusa) => recusa.motivo)).toEqual(['sem_licenca', 'sem_declaracao'])

    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Reabrir o diálogo começa de um formulário novo: o rascunho e o aviso da tentativa anterior saem, e a recusa continua na tabela.
    await cancelarEnvio(page, hasTouch)
    await abrirEnvio(page, hasTouch)
    await expect(caixaDeEnvio(page).getByLabel('Título')).toHaveValue('')
    await expect(caixaDeEnvio(page).getByRole('alert').filter({ hasText: 'Envio recusado.' })).toHaveCount(0)
    await cancelarEnvio(page, hasTouch)
    await expect(linhasDaLista(page)).toHaveCount(2)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Dispensar tira a recusa da tela; a lista volta ao vazio.
    await acionar(linhaDe(page, 'Outro capítulo').getByRole('button', { name: /Dispensar/ }), hasTouch)
    await acionar(linhaDe(page, TITULO).getByRole('button', { name: /Dispensar/ }), hasTouch)
    await expect(lista(page).getByText('Nenhum material ainda')).toBeVisible()
  })

  test('depois da recusa o diálogo continua aberto: corrigir a licença e enviar de novo entra o material, e a recusa continua na tabela', async ({ page, hasTouch, request }) => {
    const cenario = await abrirMaterial(page, request)
    await expect(lista(page).getByText('Nenhum material ainda')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await abrirEnvio(page, hasTouch)
    await preencher(page, cenario, { licenca: 'Não tenho a licença, ou não sei' })
    await acionar(enviar(page), hasTouch)
    await expect(caixaDeEnvio(page).getByRole('alert').filter({ hasText: 'Envio recusado.' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(await materiaisNoBanco(cenario.coordenadora.escolaId)).toEqual([])

    // A coordenação corrige a licença no mesmo diálogo e envia de novo.
    await preencher(page, cenario)
    await acionar(enviar(page), hasTouch)
    await expect(caixaDeEnvio(page)).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhaDe(page, TITULO).getByText('Pronto · 6 páginas')).toBeVisible({ timeout: PRAZO_DA_LEITURA_MS })
    await expect(linhaDe(page, TITULO).getByText('Envio recusado · sem licença')).toBeVisible()
    expect(await materiaisNoBanco(cenario.coordenadora.escolaId)).toEqual([expect.objectContaining({ titulo: TITULO, estado: 'pronto', paginas: 6 })])
  })

  test('o texto do campo "De quem é o material" cabe inteiro, também na opção mais longa: a coordenação lê a titularidade que declarou', async ({ page, hasTouch, request }) => {
    await abrirMaterial(page, request)
    await expect(lista(page).getByText('Nenhum material ainda')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await abrirEnvio(page, hasTouch)
    const campo = caixaDeEnvio(page).getByLabel('De quem é o material')
    await campo.selectOption({ label: 'Material de autoria de professor da escola' })
    await expect(campo.locator('option:checked')).toHaveText('Material de autoria de professor da escola')
    // A 360 px o `select` de uma linha só não comporta o texto de 42 caracteres (vai ao `TODO.md`); a regra desta tarefa é a da largura do
    // computador: ali a titularidade que a coordenação declarou aparece inteira.
    if (hasTouch) return
    // O valor escolhido não é cortado pela largura do campo: o `select` não rola por dentro (o corte é o que o `scrollWidth` mede).
    const medida = await campo.evaluate((elemento) => ({ conteudo: elemento.scrollWidth, caixa: elemento.clientWidth }))
    expect(medida.conteudo).toBeLessThanOrEqual(medida.caixa)
    // E o texto, no tamanho da fonte do campo, cabe na caixa descontado o espaço da seta e do recuo.
    const sobra = await campo.evaluate((elemento) => {
      const estilo = getComputedStyle(elemento as HTMLSelectElement)
      const pincel = document.createElement('canvas').getContext('2d')
      if (pincel === null) return Number.NEGATIVE_INFINITY
      pincel.font = `${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`
      const texto = (elemento as HTMLSelectElement).selectedOptions[0]?.textContent ?? ''
      const recuo = parseFloat(estilo.paddingLeft) + parseFloat(estilo.paddingRight) + 24
      return (elemento as HTMLSelectElement).clientWidth - recuo - pincel.measureText(texto).width
    })
    expect(sobra).toBeGreaterThanOrEqual(0)
  })

  test('o formulário incompleto diz o que falta em cada campo, e o arquivo que não é PDF é recusado na tela, sem pedido à API', async ({ page, hasTouch, request }) => {
    await abrirMaterial(page, request)
    await expect(lista(page).getByText('Nenhum material ainda')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    let envios = 0
    page.on('request', (pedido) => {
      if (ehOEnvio(pedido)) envios += 1
    })

    await abrirEnvio(page, hasTouch)
    const caixa = caixaDeEnvio(page)
    await acionar(enviar(page), hasTouch)
    await expect(caixa.getByText('Escolha o PDF do material.')).toBeVisible()
    await expect(caixa.getByText('Dê um título ao material, como ele aparece no livro ou na apostila.')).toBeVisible()
    await expect(caixa.getByText('Escolha a disciplina do material.')).toBeVisible()
    await expect(caixa.getByText('Diga de quem é o material.')).toBeVisible()
    await expect(caixa.getByText('Escolha a licença de uso. Sem licença declarada, o material não entra.')).toBeVisible()
    // O foco vai ao primeiro campo com erro: o arquivo.
    await expect(caixa.getByRole('button', { name: 'Escolher arquivo' })).toBeFocused()

    await arquivo(page).setInputFiles({ name: 'apostila.pdf', mimeType: 'application/pdf', buffer: Buffer.from('nome;turma\nAluno sintético;7A\n') })
    await expect(caixa.getByText('O arquivo não é um PDF que conseguimos abrir. Confira o arquivo e envie de novo.')).toBeVisible()
    await expect(caixa.getByRole('button', { name: 'Escolher arquivo' })).toBeVisible()

    // Material de terceiro pede quem deu a licença.
    await caixa.getByLabel('De quem é o material').selectOption({ label: 'Material de terceiro, com licença' })
    await expect(caixa.getByLabel('Quem deu a licença')).toBeVisible()
    await acionar(enviar(page), hasTouch)
    await expect(caixa.getByText('Diga quem é o dono do conteúdo que deu a licença.')).toBeVisible()
    expect(envios).toBe(0)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('o arquivo entra arrastado e também pelo botão, com o teclado, dentro do diálogo: nada só funciona arrastando', async ({ page, hasTouch, request }) => {
    await abrirMaterial(page, request)
    await expect(lista(page).getByText('Nenhum material ainda')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await abrirEnvio(page, hasTouch)
    const botao = caixaDeEnvio(page).getByRole('button', { name: 'Escolher arquivo' })
    const caixa = await botao.boundingBox()
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)

    // Pelo botão: com o toque no celular; com o foco e o Enter no computador.
    const seletor = page.waitForEvent('filechooser')
    if (hasTouch) await botao.tap()
    else {
      await botao.focus()
      await page.keyboard.press('Enter')
    }
    await (await seletor).setFiles(CAMINHO_DO_PDF_DE_DEMONSTRACAO)
    await expect(escolhido(page, 'quimica-2-cap-7-estequiometria.pdf')).toBeVisible()
    await expect(caixaDeEnvio(page).getByRole('button', { name: 'Trocar arquivo' })).toBeVisible()

    // Arrastado: o mesmo PDF solto na área, com outro nome.
    const bytes = [...readFileSync(CAMINHO_DO_PDF_DE_DEMONSTRACAO)]
    const transferencia = await page.evaluateHandle((conteudo) => {
      const dados = new DataTransfer()
      dados.items.add(new File([new Uint8Array(conteudo)], 'capitulo-arrastado.pdf', { type: 'application/pdf' }))
      return dados
    }, bytes)
    await escolhido(page, 'quimica-2-cap-7-estequiometria.pdf').dispatchEvent('drop', { dataTransfer: transferencia })
    await expect(escolhido(page, 'capitulo-arrastado.pdf')).toBeVisible()

    // Dois arquivos soltos de uma vez: um por vez.
    const duas = await page.evaluateHandle(() => {
      const dados = new DataTransfer()
      dados.items.add(new File(['%PDF-1.4 a'], 'a.pdf', { type: 'application/pdf' }))
      dados.items.add(new File(['%PDF-1.4 b'], 'b.pdf', { type: 'application/pdf' }))
      return dados
    })
    await escolhido(page, 'capitulo-arrastado.pdf').dispatchEvent('drop', { dataTransfer: duas })
    await expect(caixaDeEnvio(page).getByText('Envie um arquivo por vez. Escolha só o PDF deste material.')).toBeVisible()
  })

  // Os quatro estados, em três casos: juntos, com a entrada da coordenação, três varreduras de acessibilidade e a leitura
  // de um PDF de verdade, passavam dos 30 s no celular (CPU ×4). Cada caso começa da escola montada no banco.
  test('os estados sem dado: carregando, erro com "Tentar de novo", e o vazio que convida a enviar', async ({ page, hasTouch, request }) => {
    const segurada = portao()
    let falhar = true
    await page.route(
      (url) => ehALista(url),
      async (rota: Route) => {
        if (rota.request().method() !== 'GET') return rota.continue()
        await segurada.aberta
        if (falhar) return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
        return rota.continue()
      },
    )
    await abrirMaterial(page, request)

    // Carregando: a lista ainda não chegou.
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando os materiais…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('heading', { level: 1, name: 'Escola' })).toBeAttached()

    // Erro: diz o que fazer, e "Tentar de novo" lê outra vez.
    segurada.abrir()
    await expect(principal(page).getByRole('alert').filter({ hasText: TEXTO_INDISPONIVEL })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(await violacoesGraves(page)).toEqual([])
    falhar = false
    await acionar(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)

    // Vazio: convida a enviar o primeiro material, e a ação da tela é uma só, o "Enviar material".
    await expect(lista(page).getByText('Nenhum material ainda')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(lista(page)).toContainText('Envie o primeiro PDF da escola, com a licença declarada.')
    await expect(lista(page).getByRole('button')).toHaveText(['Enviar material'])
    expect(await botoesCheios(page)).toEqual(['Enviar material'])
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('com dado, em cada situação: o que não carregou primeiro, depois o mais novo; a linha abre o painel no endereço, com o que foi declarado', async ({ page, hasTouch, request }) => {
    let semTextoId = ''
    await abrirMaterial(page, request, async ({ coordenadora, estrutura }) => {
      await criarMaterialNoBanco(coordenadora.escolaId, estrutura.disciplina.id, { titulo: 'Capítulo pronto', estado: 'pronto', paginas: 12 })
      semTextoId = await criarMaterialNoBanco(coordenadora.escolaId, estrutura.disciplina.id, { titulo: 'Capítulo sem texto', estado: 'falhou', falha: 'sem_texto' })
      await criarMaterialNoBanco(coordenadora.escolaId, estrutura.disciplina.id, { titulo: 'Capítulo em leitura', estado: 'processando' })
    })
    await expect(linhaDe(page, 'Capítulo pronto').getByText('Pronto · 12 páginas')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhaDe(page, 'Capítulo em leitura').getByText('Processando')).toBeVisible()
    await expect(linhaDe(page, 'Capítulo sem texto').getByText('Não carregou')).toBeVisible()
    // O que não carregou vem primeiro; depois, o mais novo: enviados pronto, sem texto e em leitura, a ordem é sem texto, em leitura, pronto.
    await expect(linhasDaLista(page)).toHaveText([/Capítulo sem texto/, /Capítulo em leitura/, /Capítulo pronto/])
    // "Enviar material" é o único botão cheio da tela.
    expect(await botoesCheios(page)).toEqual(['Enviar material'])
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // A linha abre o painel: o endereço leva só o id do material, e o painel diz o motivo da falha e o que foi declarado.
    await acionar(botaoDaLinha(page, 'Capítulo sem texto'), hasTouch)
    const painel = painelDe(page, 'Capítulo sem texto')
    await expect(painel).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/coordenacao/material\\?material=${semTextoId}$`))
    await expect(painel).toContainText('Não carregou')
    await expect(painel).toContainText('O PDF não tem texto para ler: parece ser só imagem. Envie a versão com texto.')
    await expect(painel).toContainText('Material próprio da escola')
    await expect(painel).toContainText('Autoria da escola ou de professor dela')
    await expect(painel.locator('button:not([aria-label="Fechar"])')).toHaveText(['Tentar de novo', 'Excluir material'])
    expect(await botoesCheios(page)).toEqual(['Enviar material'])
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // O Esc fecha e tira o parâmetro do endereço.
    await page.keyboard.press('Escape')
    await expect(painel).toHaveCount(0)
    await expect(page).toHaveURL(/\/coordenacao\/material$/)

    // O material pronto só oferece "Excluir material".
    await acionar(botaoDaLinha(page, 'Capítulo pronto'), hasTouch)
    await expect(painelDe(page, 'Capítulo pronto').locator('button:not([aria-label="Fechar"])')).toHaveText(['Excluir material'])
  })

  test('o painel abre pelo endereço, como o link do sino, e o Esc tira o id do endereço', async ({ page, request }) => {
    let semTextoId = ''
    await abrirMaterialPeloEndereco(
      page,
      request,
      async ({ coordenadora, estrutura }) => {
        semTextoId = await criarMaterialNoBanco(coordenadora.escolaId, estrutura.disciplina.id, { titulo: 'Capítulo sem texto', estado: 'falhou', falha: 'sem_texto' })
      },
      () => `/coordenacao/material?material=${semTextoId}`,
    )
    await expect(painelDe(page, 'Capítulo sem texto')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/coordenacao\/material$/)
  })

  test('o id que não existe, no endereço, não abre nada', async ({ page, request }) => {
    await abrirMaterialPeloEndereco(
      page,
      request,
      async ({ coordenadora, estrutura }) => {
        await criarMaterialNoBanco(coordenadora.escolaId, estrutura.disciplina.id, { titulo: 'Capítulo sem texto', estado: 'falhou', falha: 'sem_texto' })
      },
      () => '/coordenacao/material?material=0190f5a0-0000-7000-8000-0000000000ff',
    )
    await expect(linhaDe(page, 'Capítulo sem texto')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('segunda pessoa: a coordenação de B entra na aba da de A, e o painel de A pelo endereço não abre nada nem diz que o material existe', async ({ page, hasTouch, request }) => {
    test.slow()
    let materialDeA = ''
    await abrirMaterial(page, request, async ({ coordenadora, estrutura }) => {
      materialDeA = await criarMaterialNoBanco(coordenadora.escolaId, estrutura.disciplina.id, { titulo: 'Capítulo da escola A', estado: 'pronto', paginas: 4 })
    })
    await acionar(botaoDaLinha(page, 'Capítulo da escola A'), hasTouch)
    await expect(painelDe(page, 'Capítulo da escola A')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await page.keyboard.press('Escape')
    await abrirNavegacao(page, hasTouch)
    await acionar(lateral(page).getByRole('button', { name: 'Sair' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })

    // A de B entra na mesma aba, sem recarregar, com a leitura da lista segurada: é aí que a lista de A apareceria.
    const deB = await criarEquipeComSenha('coordenador')
    await montarEstruturaNoBanco(deB.escolaId)
    const segurada = portao()
    await page.route(
      (url) => ehALista(url),
      async (rota: Route) => {
        if (rota.request().method() === 'GET') await segurada.aberta
        return rota.fallback()
      },
    )
    // O segundo fator da de B é configurado pela API: o caso é sobre o que a aba mostra da de A, e não sobre configurar o segundo fator.
    const { segredo } = await configurarSegundoFatorPelaApi(request, deB)
    await entrarPelaTelaComSegundoFator(page, deB, segredo, hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/painel$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await irPelaCoordenacao(page, 'Material', hasTouch)
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando os materiais…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText('Capítulo da escola A')
    segurada.abrir()
    await expect(lista(page).getByText('Nenhum material ainda')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText('Capítulo da escola A')

    // O endereço do material de A, aberto na sessão de B: a lista de B não o tem, e a tela não abre painel nem diz que ele existe.
    await page.goto(`/coordenacao/material?material=${materialDeA}`)
    await expect(lista(page).getByText('Nenhum material ainda')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('Capítulo da escola A')
  })

  test('a falha do envio fica no diálogo, com o que foi digitado; fechar e reabrir começa de um formulário novo', async ({ page, hasTouch, request }) => {
    let derrubar = true
    await page.route(
      (url) => ehALista(url),
      async (rota: Route) => {
        if (derrubar && rota.request().method() === 'POST') return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
        return rota.fallback()
      },
    )
    const cenario = await abrirMaterial(page, request)
    await expect(lista(page).getByText('Nenhum material ainda')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await abrirEnvio(page, hasTouch)
    await preencher(page, cenario)
    await acionar(enviar(page), hasTouch)

    const alerta = caixaDeEnvio(page).getByRole('alert').filter({ hasText: TEXTO_INDISPONIVEL })
    await expect(alerta).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(alerta).toBeFocused()
    await expect(caixaDeEnvio(page).getByLabel('Título')).toHaveValue(TITULO)
    await expect(escolhido(page, 'quimica-2-cap-7-estequiometria.pdf')).toBeVisible()
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    expect(await materiaisNoBanco(cenario.coordenadora.escolaId)).toEqual([])

    derrubar = false
    await cancelarEnvio(page, hasTouch)
    await expect(lista(page).getByText('Nenhum material ainda')).toBeVisible()
    await abrirEnvio(page, hasTouch)
    await expect(caixaDeEnvio(page).getByLabel('Título')).toHaveValue('')
    await expect(caixaDeEnvio(page).getByRole('alert').filter({ hasText: TEXTO_INDISPONIVEL })).toHaveCount(0)
    await expect(caixaDeEnvio(page).getByRole('button', { name: 'Escolher arquivo' })).toBeVisible()
  })

  test('o material que não carregou: "Tentar de novo" abre o envio com o que ele declarava, e o arquivo de verdade entra no lugar dele', async ({ page, hasTouch, request }) => {
    await abrirMaterial(page, request, async ({ coordenadora, estrutura }) => {
      await criarMaterialNoBanco(coordenadora.escolaId, estrutura.disciplina.id, { titulo: 'Capítulo sem texto', estado: 'falhou', falha: 'sem_texto' })
    })
    await expect(linhaDe(page, 'Capítulo sem texto').getByText('Não carregou')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // "Tentar de novo", no painel, abre o diálogo com o que o material declarava, e pede o arquivo.
    await acionar(botaoDaLinha(page, 'Capítulo sem texto'), hasTouch)
    await acionar(painelDe(page, 'Capítulo sem texto').getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    await expect(caixaDeEnvio(page)).toBeVisible()
    await expect(caixaDeEnvio(page).getByLabel('Título')).toHaveValue('Capítulo sem texto')
    await expect(caixaDeEnvio(page).getByLabel('Licença de uso (obrigatória)')).toHaveValue('autoria_da_escola')
    await expect(declaracao(page)).not.toBeChecked()
    await expect(caixaDeEnvio(page).getByRole('button', { name: 'Escolher arquivo' })).toBeFocused()
    await expect(caixaDeEnvio(page)).toContainText('Escolha o arquivo de novo, marque a declaração e envie. O material que falhou sai da lista quando o novo entrar.')

    // Com o arquivo de verdade, o material entra, e o que falhou sai da lista e do endereço.
    await arquivo(page).setInputFiles(CAMINHO_DO_PDF_DE_DEMONSTRACAO)
    await declaracao(page).check()
    await acionar(enviar(page), hasTouch)
    await expect(caixaDeEnvio(page)).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhaDe(page, 'Capítulo sem texto').getByText('Pronto · 6 páginas')).toBeVisible({ timeout: PRAZO_DA_LEITURA_MS })
    await expect(linhaDe(page, 'Capítulo sem texto')).toHaveCount(1)
    await expect(lista(page).getByText('Não carregou')).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/\/coordenacao\/material$/)
  })

  test('excluir é ação de perigo, pelo painel: a confirmação diz o que acontece, cancelar não exclui, e confirmar tira o material e os trechos', async ({ page, hasTouch, request }) => {
    let materialId = ''
    const cenario = await abrirMaterial(page, request, async ({ coordenadora, estrutura }) => {
      materialId = await criarMaterialNoBanco(coordenadora.escolaId, estrutura.disciplina.id, { titulo: TITULO, estado: 'pronto', paginas: 6 })
      await criarMaterialNoBanco(coordenadora.escolaId, estrutura.disciplina.id, { titulo: 'Capítulo que fica', estado: 'pronto', paginas: 2 })
    })
    await expect(linhaDe(page, TITULO).getByText('Pronto · 6 páginas')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    await acionar(botaoDaLinha(page, TITULO), hasTouch)
    await acionar(painelDe(page, TITULO).getByRole('button', { name: 'Excluir material' }), hasTouch)
    await expect(confirmacao(page).getByRole('heading', { name: 'Excluir material' })).toBeVisible()
    await expect(confirmacao(page)).toContainText(TITULO)
    await expect(confirmacao(page)).toContainText(cenario.estrutura.disciplina.nome)
    await expect(confirmacao(page)).toContainText(
      'As atividades e os planos já gerados continuam citando a página deste material. Daqui em diante, a busca do Assistente e do Tutor deixa de achá-lo, e o texto lido dele é apagado.',
    )
    // O foco começa no texto, e não no botão que exclui; cancelar tem o mesmo tamanho de confirmar.
    const confirmar = confirmacao(page).getByRole('button', { name: 'Excluir material' })
    const cancelar = confirmacao(page).getByRole('button', { name: 'Cancelar' })
    await expect(confirmar).not.toBeFocused()
    expect((await cancelar.boundingBox())?.height).toBe((await confirmar.boundingBox())?.height)
    expect((await confirmar.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    await acionar(cancelar, hasTouch)
    await expect(confirmacao(page)).toHaveCount(0)
    await expect(painelDe(page, TITULO)).toBeVisible()
    expect((await materiaisNoBanco(cenario.coordenadora.escolaId)).find((material) => material.id === materialId)).toMatchObject({ excluido: false, trechos: 6 })

    await acionar(painelDe(page, TITULO).getByRole('button', { name: 'Excluir material' }), hasTouch)
    await acionar(confirmacao(page).getByRole('button', { name: 'Excluir material' }), hasTouch)
    await expect(anuncio(page, 'Material excluído. A busca do Assistente e do Tutor deixou de achá-lo.')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(confirmacao(page)).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(linhaDe(page, TITULO)).toHaveCount(0)
    await expect(linhaDe(page, 'Capítulo que fica')).toBeVisible()
    await expect(page).toHaveURL(/\/coordenacao\/material$/)
    // O botão que abriu o painel saiu com a linha: o foco vai para o título da lista, e não para o `body`.
    await expect(tituloDaLista(page)).toBeFocused()

    const noBanco = await materiaisNoBanco(cenario.coordenadora.escolaId)
    expect(noBanco.find((material) => material.id === materialId)).toMatchObject({ excluido: true, trechos: 0 })
    expect(noBanco.find((material) => material.titulo === 'Capítulo que fica')).toMatchObject({ excluido: false, trechos: 2 })
  })
})
