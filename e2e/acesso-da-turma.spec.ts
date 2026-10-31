import type { Locator, Page, Request, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import type { AcessoGeradoResponse } from '../packages/shared/src/sala/acesso.ts'
import { abrirNavegacao, entrarPorEmail, irPelaNavegacao, lateral, PRAZO_DA_ENTRADA_MS, esperarNovaConversa, abrirAbaAlunos, secoes } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import {
  acessosVigentesDaTurma,
  confirmarVinculosNoBanco,
  contestarVinculosNoBanco,
  criarAlocacaoDoProfessor,
  criarEquipeComSenha,
  definirInatividadeDaEscola,
  encerrarVinculosNoBanco,
  gerarAcessoNoBanco,
  porNaListaDaTurma,
  revogarAcessoNoBanco,
  type AlocacaoDeTeste,
  type EquipeDeTeste,
} from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, codigoCru, larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './support/checks.ts'

/**
 * O acesso da turma do professor (A1, tarefa 15.0; `tasks/prd-apresentacao-escola/cenarios.md`): W7, W4 e W12 de
 * Acesso, o clique duplo e o recomeço da tela. Tudo pela tela, nos projetos `chromebook` e `celular`, com escola, turma
 * e nomes inventados pelo teste. Os textos esperados estão aqui por extenso.
 *
 * Desde as telas do professor (13.0) o acesso mora no diálogo "Convidar alunos": a seção da aba Alunos é um resumo com o botão
 * que o abre (`abrirOConvite`), e gerar, gerar novo e revogar são passos do diálogo. O título de cada passo, o foco e o envio
 * único são os de antes; muda o clique que abre e o passo em que a professora está. O passo "Acesso gerado" é a janela inteira,
 * e por isso não há "fora" para tocar (o toque fora é provado no passo "Gerar novo acesso", que está na caixa de sempre).
 */

const INDISPONIVEL = JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
const CONFLITO = JSON.stringify({ erro: { codigo: 'CONFLITO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000002' } })

const TEXTO_DA_TURMA_INDISPONIVEL =
  'Esta turma não está disponível para você agora: o seu vínculo com ela pode não estar confirmado, ou ela saiu do ano letivo em curso. Volte para Turmas; se ela deveria estar lá, fale com a coordenação.'
/** Tudo o que `main` diz na turma indisponível, sem o sino: o aviso e o link de volta (a tela é a mesma nos três endereços). */
const TELA_DA_TURMA_INDISPONIVEL = `Voltar para TurmasTurma${TEXTO_DA_TURMA_INDISPONIVEL}`
const TEXTO_DO_ACESSO_NOVO = 'O link da sala e o código da turma levam os alunos à lista de nomes desta turma, onde cada um pede o próprio nome. Quem aprova é você.'
const TEXTO_DO_ACESSO_QUE_CAI =
  'O link e o código de agora deixam de valer na hora, também se quem gerou foi outro professor ou outra professora da turma. Os nomes que ficaram travados por tentativas com a matrícula errada destravam.'
const TEXTO_DO_ACESSO_UMA_VEZ = 'O link e o código aparecem uma vez, logo depois de gerar. Projete o código ou mande o link antes de fechar.'
const TEXTO_DO_REVOGAR =
  'O link da sala e o código da turma deixam de valer na hora: quem ainda não pediu o nome não entra mais por eles. Os pedidos já feitos continuam esperando a decisão. Para os alunos voltarem a entrar, gere um novo acesso.'
const TEXTO_DO_ACESSO_GERADO_EM_OUTRO_LUGAR =
  'Outro acesso para esta turma acabou de ser gerado, por outra pessoa ou em outra aba, e é ele que vale. A tela foi atualizada: se o link e o código não estão com você, gere um novo.'
const TEXTO_DO_ACESSO_QUE_JA_NAO_VALE = 'Esta turma já não tem acesso ativo. A tela foi atualizada.'
const TEXTO_DO_WHATSAPP_ABERTO = 'O WhatsApp abriu em outra aba, com o convite pronto para mandar.'
const TEXTO_DO_CONVITE_COPIADO = 'O WhatsApp não abriu aqui. O texto do convite foi copiado: cole onde a turma conversa.'
const TEXTO_DO_LINK_PARA_COPIAR = 'O WhatsApp não abriu aqui. O link está selecionado no campo: copie com Ctrl+C, ou toque e segure no campo e escolha Copiar.'
const TEXTO_DE_QUEM_VE_A_LISTA =
  'Quem tem o link ou o código vê os nomes da lista que ainda estão livres: mande só para a turma. Se o link ou o código forem parar onde não deviam, gere um novo acesso, e os anteriores deixam de valer na hora. Pelo WhatsApp vão o nome da escola e o link, sem nome de aluno.'
const TEXTO_DA_PERGUNTA = 'O link e o código aparecem uma vez só. Se fechar agora, eles não aparecem de novo, e para os alunos entrarem será preciso gerar um novo acesso.'

/** O código como a tela o projeta: dois grupos de quatro, só com o alfabeto de 31 (sem 0, 1, I, L e O). */
const CODIGO_EM_DOIS_GRUPOS = /^[2-9A-HJKMNP-Z]{4} [2-9A-HJKMNP-Z]{4}$/
/** O menor tamanho de letra do código, em px: é o `text-4xl`, o da tela de 360 px. */
const LETRA_GRANDE_PX = 36
/** O texto do perigo na seção (`--color-vermelho-texto`, #b84045) e a face do perigo cheio, só dentro da confirmação (`--color-vermelho`, #f2545b). */
const COR_DO_PERIGO = 'rgb(184, 64, 69)'
const COR_DO_PERIGO_CHEIO = 'rgb(242, 84, 91)'
/** A série da turma que `criarProfessoraComTurma` cria: a linha de apoio do título com a turma lida, e que sai com a turma perdida. */
const SERIE_DA_TURMA = '7º ano do Ensino Fundamental'

/** A leitura e o gerar (`GET` e `POST /v1/turmas/:id/acesso`), o revogar, e a turma aberta (`GET /v1/turmas/:id`). */
const ehOAcesso = (url: URL) => /^\/v1\/turmas\/[^/]+\/acesso$/.test(url.pathname)
const ehORevogar = (url: URL) => /^\/v1\/turmas\/[^/]+\/acesso\/revogar$/.test(url.pathname)
const ehATurma = (url: URL) => /^\/v1\/turmas\/[^/]+$/.test(url.pathname)
const ehOEu = (url: URL) => url.pathname === '/v1/eu'
const ehOsMeusVinculos = (url: URL) => url.pathname === '/v1/meus-vinculos'
const ehOGerar = (pedido: Request) => pedido.method() === 'POST' && ehOAcesso(new URL(pedido.url()))

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Um botão, pelo nome exato, dentro de um lugar: toque no celular, clique no Chromebook. */
async function tocar(lugar: Locator, nome: string, hasTouch: boolean): Promise<void> {
  await acionar(lugar.getByRole('button', { name: nome, exact: true }), hasTouch)
}

/**
 * Os dois cliques de um clique duplo no mesmo instante, antes de a tela desligar o botão: é o caso que o botão desligado
 * não segura, e que só a trava do pedido no ar segura.
 */
async function doisCliquesNoMesmoInstante(botao: Locator): Promise<void> {
  await botao.evaluate((elemento: HTMLButtonElement) => {
    elemento.click()
    elemento.click()
  })
}

/** Uma porta que segura a resposta até o teste abrir. */
function portao(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

const principal = (page: Page) => page.getByRole('main')
/** O botão do sino "Esperando você": o nome dele diz se a lista carregou e quantos esperam. */
const sinoDaProfessora = (page: Page) => page.getByRole('button', { name: /^Esperando você/ })
/** O texto de `main` sem o sino, que mora nele no computador: o que a tela diz, e não o que o sino leu até agora. */
const textoDaTelaSemOSino = (page: Page) =>
  principal(page).evaluate((elemento: HTMLElement) => {
    const copia = elemento.cloneNode(true) as HTMLElement
    copia.querySelectorAll('button[aria-label^="Esperando você"]').forEach((sino) => sino.remove())
    return copia.textContent ?? ''
  })
/** Os `dialog` abertos, pelo elemento e não pelo papel: a gaveta fechada da casca também é um `dialog`, abaixo de 768 px. */
const dialogosAbertos = (page: Page) => page.locator('dialog[open]')
/** Os `dialog` da turma aberta, abertos ou não: ela os desenha dentro do conteúdo, e só enquanto estão abertos. */
const dialogosDaTela = (page: Page) => principal(page).locator('dialog')
const noDialogo = (page: Page): Locator => page.getByRole('dialog')
/** A seção do acesso, pelo título dela, que é para onde o foco vai quando o botão que abriu o diálogo saiu da tela. */
const secao = (page: Page) => principal(page).getByRole('region', { name: 'Acesso dos alunos' })
const tituloDaSecao = (page: Page) => principal(page).getByRole('heading', { name: 'Acesso dos alunos' })
/** O botão da seção que abre o convite: o único dela com a leitura boa, e o que recebe o foco de volta quando o diálogo fecha. */
const botaoConvidar = (page: Page) => secao(page).getByRole('button', { name: 'Convidar alunos', exact: true })
const semAcesso = (page: Page) => secao(page).getByText('Sem acesso ativo')
const acessoAtivo = (page: Page) => secao(page).getByText('Acesso ativo', { exact: true })
/** O anúncio da ação que terminou. */
const anuncio = (page: Page, texto: string) => secao(page).getByRole('status').filter({ hasText: texto })
/** O texto que abre o diálogo de gerar, com o foco: o que vai acontecer. */
const oQueAcontece = (page: Page, texto: string) => noDialogo(page).getByText(texto, { exact: true })
/** O título da etapa do acesso gerado. */
const etapaDoAcesso = (page: Page) => noDialogo(page).getByRole('heading', { name: 'Acesso gerado' })
/** A pergunta de fechar sem o link copiado. */
const pergunta = (page: Page) => noDialogo(page).getByRole('heading', { name: 'Fechar sem copiar o link?' })
/** O código projetado e o link, no diálogo. */
const grupoDoCodigo = (page: Page) => noDialogo(page).getByRole('group', { name: 'Código da turma' })
const codigoNaTela = (page: Page) => grupoDoCodigo(page).locator('p[aria-hidden="true"]')
const campoDoLink = (page: Page) => noDialogo(page).getByLabel('Link da sala')
const linkNaTela = (page: Page) => campoDoLink(page).inputValue()
/** O token de um link da sala: o que vem depois do `#`. */
const tokenDo = (link: string) => new URL(link).hash.slice(1)
/** O código como o servidor o devolve, sem o espaço do meio. */
const semEspaco = (codigo: string) => codigo.replace(' ', '')
const validade = (page: Page, dias: string) => noDialogo(page).getByRole('radio', { name: dias, exact: true })

async function alvoDeToque(alvo: Locator, descricao: string): Promise<void> {
  const caixa = await alvo.boundingBox()
  expect(caixa, `${descricao} sem caixa`).not.toBeNull()
  expect(caixa?.height ?? 0, descricao).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  expect(caixa?.width ?? 0, descricao).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
}

/** Sem rolagem horizontal no documento nem no diálogo aberto, e o axe limpo. */
async function conferirDialogo(page: Page): Promise<void> {
  expect(await larguraExcedenteDoDialogo(page)).toBe(0)
  expect(await larguraExcedente(page)).toBe(0)
  expect(await violacoesGraves(page)).toEqual([])
}

/** Aperta Tab até o foco chegar no alvo, sem passar de 40 teclas. */
async function tabAte(page: Page, alvo: Locator): Promise<void> {
  for (let tecla = 0; tecla < 40; tecla++) {
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error('o Tab não chegou ao alvo')
}

const focoDentroDoDialogo = (page: Page) => page.evaluate(() => document.activeElement !== null && document.activeElement.closest('dialog[open]') !== null)

/** A data e a hora como a tela as escreve (`format.ts`), no fuso do navegador do teste. */
function dataNaTela(page: Page, iso: string): Promise<string> {
  return page.evaluate((valor) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor)), iso)
}

/** Quantos dias inteiros faltam até a data, contados de agora. */
const diasAte = (iso: string) => Math.round((Date.parse(iso) - Date.now()) / 86_400_000)

/** O texto que o WhatsApp recebe: a escola e o link, e mais nada. */
const textoDoConvite = (escolaNome: string, link: string) =>
  `${escolaNome} no Turmma.\nAbra o link, escolha o seu nome na lista da turma, informe a sua matrícula e crie a sua senha:\n${link}`

/** A resposta do gerar que a tela pede a partir de agora. */
function proximoAcessoGerado(page: Page) {
  return page.waitForResponse((resposta) => ehOGerar(resposta.request()))
}

/** A leitura do acesso que a tela pede a partir de agora, com a resposta inteira. */
function proximaLeitura(page: Page) {
  return page.waitForResponse((resposta) => resposta.request().method() === 'GET' && ehOAcesso(new URL(resposta.url())) && resposta.ok())
}

interface Cenario {
  readonly professora: EquipeDeTeste
  readonly turma: AlocacaoDeTeste
}

/** A professora com uma turma confirmada, e o que mais o teste pedir de disciplinas (a segunda fica pendente). */
async function criarProfessoraComTurma(disciplinas: readonly string[] = ['Matemática']): Promise<Cenario> {
  const professora = await criarEquipeComSenha()
  const turma = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, disciplinas)
  const [primeiro] = turma.vinculoIds
  if (primeiro === undefined) throw new Error('alocação do e2e sem vínculo')
  await confirmarVinculosNoBanco(professora.escolaId, [primeiro])
  return { professora, turma }
}

/** A professora entra, vai a Turmas pela lateral e abre a turma pelo cartão do vínculo confirmado. */
async function abrirATurma(page: Page, { professora, turma }: Cenario, hasTouch: boolean): Promise<void> {
  await page.goto('/entrar')
  await entrarPorEmail(page, professora, hasTouch)
  await esperarNovaConversa(page, professora.nome)
  await irPelaNavegacao(page, 'Turmas', hasTouch)
  await acionar(principal(page).getByRole('link', { name: `Abrir a turma ${turma.turmaNome}` }), hasTouch)
  await expect(page).toHaveURL(new RegExp(`/professor/turmas/${turma.turmaId}$`))
  // O acesso dos alunos fica na aba "Alunos" da turma aberta (A3).
  await abrirAbaAlunos(page, hasTouch)
}

/**
 * A professora entra pela API (`POST /v1/sessao/email`, o cookie fica na própria aba) e abre o endereço dado: a página
 * carrega uma vez só, sem passar pela tela de entrada. No Chromebook de teste (CPU ×4, Fast 3G) cada carga leva uns 7 s, e o
 * portão da tarefa reprova caso de e2e alterado que passa de 15 s. A entrada pela tela é provada em outros casos; aqui ela é só o meio.
 */
async function abrirJaEntrando(page: Page, professora: EquipeDeTeste, endereco: string): Promise<void> {
  const resposta = await page.request.post('/v1/sessao/email', { data: { email: professora.email, senha: professora.senha } })
  expect(resposta.ok(), 'a entrada pela API').toBe(true)
  await page.goto(endereco)
}

/** O clique novo (13.0): o botão "Convidar alunos" da seção abre o diálogo, que começa no passo que o acesso da turma pede. */
async function abrirOConvite(page: Page, hasTouch: boolean): Promise<void> {
  await acionar(botaoConvidar(page), hasTouch)
  await expect(noDialogo(page)).toBeVisible()
}

/**
 * Abre o convite e gera, com a validade dada (ou a que o diálogo propõe). Sem acesso o diálogo abre em "Gerar acesso"; com acesso
 * (`comAcesso`) abre em "Vigente", e "Gerar novo acesso" leva ao passo que diz o que cai. Devolve o que a API respondeu.
 */
async function gerarPelaTela(page: Page, comAcesso: boolean, hasTouch: boolean, dias?: string): Promise<AcessoGeradoResponse> {
  await abrirOConvite(page, hasTouch)
  if (comAcesso) {
    await tocar(noDialogo(page), 'Gerar novo acesso', hasTouch)
    await expect(oQueAcontece(page, TEXTO_DO_ACESSO_QUE_CAI)).toBeFocused()
  }
  if (dias !== undefined) await validade(page, dias).check()
  const resposta = proximoAcessoGerado(page)
  await tocar(noDialogo(page), comAcesso ? 'Gerar novo acesso' : 'Gerar acesso', hasTouch)
  const gerado = (await (await resposta).json()) as AcessoGeradoResponse
  await expect(etapaDoAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  return gerado
}

/** Fecha o diálogo do acesso sem copiar: o botão, e a pergunta. */
async function fecharSemCopiar(page: Page, hasTouch: boolean): Promise<void> {
  await tocar(noDialogo(page), 'Fechar', hasTouch)
  await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
  await expect(dialogosDaTela(page)).toHaveCount(0)
}

/**
 * Tudo por onde o link e o código poderiam sair da tela (regra 20, item 8): endereços pedidos, endereços por onde a aba
 * passou, mensagens do console. `semRastro` confere, e confere também o armazenamento, o histórico da aba, o IndexedDB, o
 * Cache Storage e o que está na página.
 */
function vigiarAba(page: Page) {
  const rastros: string[] = []
  page.on('request', (pedido) => rastros.push(pedido.url()))
  page.on('framenavigated', (quadro) => rastros.push(quadro.url()))
  page.on('console', (mensagem) => rastros.push(mensagem.text()))
  return async function semRastro(...acessos: AcessoGeradoResponse[]): Promise<void> {
    const guardado = await page.evaluate(async () => ({
      local: JSON.stringify(Object.entries(localStorage)),
      sessao: JSON.stringify(Object.entries(sessionStorage)),
      historico: JSON.stringify(history.state),
      endereco: location.href,
      bancos: (await indexedDB.databases()).map((banco) => banco.name),
      caches: await caches.keys(),
    }))
    // A tela não cria banco nem cache no navegador: não há onde o link ficar.
    expect(guardado.bancos).toEqual([])
    expect(guardado.caches).toEqual([])
    const conteudo = await page.content()
    for (const { token, codigo } of acessos) {
      for (const rastro of rastros) expect(rastro, 'token numa URL, numa navegação ou no console').not.toContain(token)
      for (const segredo of [token, codigo]) {
        expect(guardado.local).not.toContain(segredo)
        expect(guardado.sessao).not.toContain(segredo)
        expect(guardado.historico).not.toContain(segredo)
        expect(guardado.endereco).not.toContain(segredo)
        expect(conteudo).not.toContain(segredo)
      }
      // O código, como a tela o projeta, também não sobra na página.
      expect(conteudo).not.toContain(`${codigo.slice(0, 4)} ${codigo.slice(4)}`)
    }
  }
}

test.describe('W4 (Acesso): os quatro estados', () => {
  /*
   * Os quatro estados do acesso, em casos separados: o portão da tarefa reprova caso de e2e alterado que passa de 15 s
   * (`tools/ci/duracao-do-e2e.ts`), e o caso único dos quatro estados levava mais de 60 s (correção
   * 2026-10-18-textos-da-turma-indisponivel-diferem). Cada caso começa do seu próprio cenário, e o que um deixava de pé para o
   * seguinte (o acesso gerado, a leitura que falha) é semeado no banco ou preparado no começo do caso.
   */
  test('a turma abre pelo cartão do vínculo confirmado, e só por ele; com o título, o nome, a série e "Turmas" ainda selecionado', async ({ page, hasTouch }) => {
    test.slow()
    // Duas disciplinas na mesma turma: Matemática confirmada, História contestada. Outra turma, só pendente. E uma
    // terceira, que ela confirmou e a coordenação encerrou depois.
    const cenario = await criarProfessoraComTurma(['Matemática', 'História'])
    const { professora, turma } = cenario
    await contestarVinculosNoBanco(professora.escolaId, turma.vinculoIds.slice(1))
    const pendente = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Ciências'])
    const encerrada = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Artes'])
    await confirmarVinculosNoBanco(professora.escolaId, encerrada.vinculoIds)
    await encerrarVinculosNoBanco(professora.escolaId, encerrada.turmaId, professora.usuarioId)
    await abrirJaEntrando(page, professora, '/professor/turmas')

    // Só o cartão do vínculo confirmado leva à turma: o que espera a decisão dela é faixa, e o contestado e o encerrado não
    // oferecem o que a API recusaria.
    const paraConfirmar = principal(page).getByRole('region', { name: 'Confirme suas turmas', exact: true })
    const decididas = principal(page).getByRole('region', { name: 'Suas turmas', exact: true })
    await expect(paraConfirmar.getByRole('listitem')).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(paraConfirmar.getByRole('listitem').filter({ hasText: pendente.turmaNome })).toContainText(`Confirme sua turma · ${pendente.turmaNome} · Ciências`)
    await expect(paraConfirmar.getByRole('link')).toHaveCount(0)
    const abrir = decididas.getByRole('link', { name: `Abrir a turma ${turma.turmaNome}` })
    await expect(decididas.getByRole('listitem')).toHaveCount(3)
    await expect(decididas.getByRole('listitem').filter({ hasText: `${turma.turmaNome} · História` })).toContainText('Contestado por você')
    await expect(decididas.getByRole('listitem').filter({ hasText: encerrada.turmaNome })).toContainText('Encerrado pela escola')
    await expect(decididas.getByRole('link')).toHaveCount(1)
    await alvoDeToque(abrir, 'Abrir a turma')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await acionar(abrir, hasTouch)

    // A turma aberta: o endereço, o título na aba, o nome e a série, e "Turmas" ainda selecionado na lateral.
    await expect(page).toHaveURL(new RegExp(`/professor/turmas/${turma.turmaId}$`))
    await expect(page).toHaveTitle(`Turma ${turma.turmaNome} · Turmma`, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${turma.turmaNome}` })).toBeVisible()
    await expect(principal(page)).toContainText(SERIE_DA_TURMA)
    // A turma abre em Hoje (X3, 10.0); o acesso dos alunos está na aba "Alunos".
    await expect(page.getByRole('tab')).toHaveText(['Hoje', 'Atividades', 'Alunos'])
    await abrirAbaAlunos(page, hasTouch)
    await expect(secoes(page).getByRole('link', { name: 'Turmas' })).toHaveAttribute('aria-current', 'page')
    // A aba fica no endereço, e recarregar a página a mantém (X3, 10.0; RF15).
    await expect(page).toHaveURL(new RegExp(`/professor/turmas/${turma.turmaId}\\?aba=alunos$`))
    await page.reload()
    await expect(page.getByRole('tab', { selected: true })).toHaveText('Alunos', { timeout: PRAZO_DA_ENTRADA_MS })
  })

  test('carregando; "Sem acesso ativo" com o "Convidar alunos", sem link nem código; e o diálogo do primeiro acesso diz o que ele faz, com 7 dias já escolhidos', async ({ page, hasTouch }) => {
    test.slow()
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    // A leitura do acesso, segurada na primeira vez (o carregando).
    const segurada = portao()
    await page.route(ehOAcesso, async (rota: Route) => {
      if (rota.request().method() !== 'GET') return rota.fallback()
      await segurada.aberta
      return rota.fallback()
    })
    // Direto na aba Alunos: o clique na aba é provado nos outros casos, e o portão mede este em 15 s.
    await abrirJaEntrando(page, professora, `/professor/turmas/${turma.turmaId}?aba=alunos`)

    // Carregando.
    await expect(secao(page).getByRole('status').filter({ hasText: 'Carregando o acesso da turma…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(semAcesso(page)).toHaveCount(0)
    segurada.abrir()

    // Vazio: o convite para agir, com um "Convidar alunos" só, e nada de link nem de código.
    await expect(semAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const convidar = botaoConvidar(page)
    await expect(secao(page).getByRole('button')).toHaveCount(1)
    await alvoDeToque(convidar, 'Convidar alunos')
    await expect(acessoAtivo(page)).toHaveCount(0)

    // O primeiro acesso: o diálogo abre no passo "Gerar acesso", que diz o que ele faz, sem falar de acesso que cai, com 7 dias já escolhidos.
    await acionar(convidar, hasTouch)
    await expect(page.getByRole('dialog', { name: 'Gerar acesso' })).toBeVisible()
    await expect(oQueAcontece(page, TEXTO_DO_ACESSO_NOVO)).toBeFocused()
    await expect(noDialogo(page)).not.toContainText('deixam de valer')
    await expect(noDialogo(page)).toContainText(TEXTO_DO_ACESSO_UMA_VEZ)
    await expect(noDialogo(page).getByRole('radio')).toHaveCount(3)
    await expect(validade(page, '7 dias')).toBeChecked()
    await expect(validade(page, '1 dia')).not.toBeChecked()
    await expect(validade(page, '30 dias')).not.toBeChecked()
    // O axe e o 360 px deste passo estão no W12, que abre o mesmo passo.
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(0)
  })

  test('o erro logo depois de gerar mostra "Tentar de novo" e não afirma falta de acesso', async ({ page, hasTouch }) => {
    test.slow()
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    // A leitura do acesso, recusada quando o teste pede (o erro).
    let falhar = false
    await page.route(ehOAcesso, (rota: Route) =>
      rota.request().method() === 'GET' && falhar ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.fallback(),
    )
    await abrirJaEntrando(page, professora, `/professor/turmas/${turma.turmaId}`)
    await abrirAbaAlunos(page, hasTouch)
    await expect(semAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await abrirOConvite(page, hasTouch)
    await expect(page.getByRole('dialog', { name: 'Gerar acesso' })).toBeVisible()

    // O erro logo depois de gerar: o gerar dá certo, e a releitura depois dele cai. A seção não afirma "Sem acesso
    // ativo", que negaria o acesso que acabou de nascer: mostra o erro, com "Tentar de novo".
    falhar = true
    const pedido = page.waitForRequest(ehOGerar)
    const resposta = proximoAcessoGerado(page)
    await tocar(noDialogo(page), 'Gerar acesso', hasTouch)
    expect((await pedido).postDataJSON()).toEqual({ validadeDias: 7 })
    const gerado = (await (await resposta).json()) as AcessoGeradoResponse
    expect(diasAte(gerado.expiraEm)).toBe(7)
    // O acesso só aparece com a releitura já terminada, em erro: a mutação espera a releitura (`api/acesso.ts`).
    await expect(etapaDoAcesso(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page)).toContainText(`Vale até ${await dataNaTela(page, gerado.expiraEm)}.`)
    await fecharSemCopiar(page, hasTouch)
    await expect(secao(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)
    await expect(semAcesso(page)).toHaveCount(0)
    await expect(acessoAtivo(page)).toHaveCount(0)
    // A leitura em erro tirou o "Convidar alunos" da seção: o foco vai para o título dela, e não para o `body`.
    await expect(botaoConvidar(page)).toHaveCount(0)
    await expect(tituloDaSecao(page)).toBeFocused()
    for (const proibido of [codigoCru('503'), 'INDISPONIVEL_TENTE_DE_NOVO']) await expect(principal(page)).not.toContainText(proibido)
    expect(await violacoesGraves(page)).toEqual([])
    falhar = false
    await tocar(secao(page), 'Tentar de novo', hasTouch)
    await expect(acessoAtivo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // O erro sai com o "Tentar de novo": a seção não fica com o alerta de antes.
    await expect(secao(page).getByRole('alert')).toHaveCount(0)
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(1)
  })

  test('com dado, a seção mostra só até quando o acesso vale e o "Convidar alunos", e o diálogo abre no passo "Vigente" com as duas ações; o link e o código não voltam', async ({ page, hasTouch }) => {
    test.slow()
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    // O acesso que o caso anterior deixava de pé, semeado: o gerar pela tela é provado em W7 e em `convidar-alunos.spec.ts`, e o
    // portão reprova caso de e2e alterado acima de 15 s. O link e o código sorteados não saem do banco: o que se prova aqui é que o
    // passo "Vigente" não tem onde mostrar um e outro.
    const expiraEm = await gerarAcessoNoBanco(professora.escolaId, turma.turmaId, 7)
    expect(diasAte(expiraEm)).toBe(7)
    // Direto na aba Alunos: o clique na aba é provado nos outros casos, e o portão mede este em 15 s.
    await abrirJaEntrando(page, professora, `/professor/turmas/${turma.turmaId}?aba=alunos`)

    // Com dado, na seção: só até quando vale, e o mesmo botão que abre o convite. O link e o código não voltam.
    await expect(acessoAtivo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const vale = `Vale até ${await dataNaTela(page, expiraEm)}.`
    await expect(secao(page)).toContainText(vale)
    await expect(secao(page).getByRole('alert')).toHaveCount(0)
    await expect(secao(page).getByRole('button')).toHaveText(['Convidar alunos'])
    await expect(secao(page).getByRole('textbox')).toHaveCount(0)
    // O diálogo abre no passo "Vigente": o título do convite, até quando vale e as duas ações; nada de campo, link nem código.
    await abrirOConvite(page, hasTouch)
    await expect(page.getByRole('dialog', { name: 'Convidar alunos' })).toBeVisible()
    await expect(noDialogo(page).getByText(vale, { exact: true })).toBeFocused()
    await expect(noDialogo(page).getByRole('button')).toHaveText(['Gerar novo acesso', 'Revogar o acesso', 'Fechar'])
    await expect(noDialogo(page).getByRole('textbox')).toHaveCount(0)
    await expect(noDialogo(page).getByRole('radio')).toHaveCount(0)
    await expect(grupoDoCodigo(page)).toHaveCount(0)
    await expect(campoDoLink(page)).toHaveCount(0)
    // Que o link e o código aparecem uma vez e não voltam está provado onde eles existem: no W7 (`semRastro`), no W12 e em `ConvidarAlunos.test.tsx`.
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(1)
    // O axe e o 360 px deste passo estão no W12, que abre o mesmo passo; o foco devolvido, no W7.
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
  })

  test('o erro na primeira leitura não afirma acesso nem falta dele, e "Tentar de novo" traz a validade', async ({ page, hasTouch }) => {
    test.slow()
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    // O acesso que o caso anterior deixava de pé, semeado: o que interessa aqui é a leitura que cai.
    await gerarAcessoNoBanco(professora.escolaId, turma.turmaId, 7)
    // A leitura do acesso falha desde a primeira vez: a página abre já sem saber se há acesso.
    let falhar = true
    await page.route(ehOAcesso, (rota: Route) =>
      rota.request().method() === 'GET' && falhar ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.fallback(),
    )
    await abrirJaEntrando(page, professora, `/professor/turmas/${turma.turmaId}`)
    // A turma abre em Hoje: o acesso está na aba "Alunos".
    await abrirAbaAlunos(page, hasTouch)
    await expect(secao(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(acessoAtivo(page)).toHaveCount(0)
    await expect(semAcesso(page)).toHaveCount(0)
    falhar = false
    await tocar(secao(page), 'Tentar de novo', hasTouch)
    await expect(acessoAtivo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secao(page)).toContainText('Vale até')
    // O erro sai com o "Tentar de novo": a seção não fica com o alerta de antes.
    await expect(secao(page).getByRole('alert')).toHaveCount(0)
  })

  test('a turma que não chega tem o erro no lugar da tela, com "Tentar de novo", e a turma volta', async ({ page, hasTouch }) => {
    test.slow()
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    await gerarAcessoNoBanco(professora.escolaId, turma.turmaId, 7)
    let derrubarATurma = true
    await page.route(ehATurma, (rota: Route) => (derrubarATurma ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.fallback()))
    await abrirJaEntrando(page, professora, `/professor/turmas/${turma.turmaId}`)
    await expect(principal(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('heading', { name: 'Acesso dos alunos' })).toHaveCount(0)
    await expect(principal(page).getByRole('link', { name: 'Voltar para Turmas' })).toBeVisible()
    derrubarATurma = false
    await tocar(principal(page), 'Tentar de novo', hasTouch)
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${turma.turmaNome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await abrirAbaAlunos(page, hasTouch)
    await expect(acessoAtivo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  })

  /*
   * A turma com o vínculo ainda pendente, a do vínculo encerrado e a que não existe respondem igual, pelo endereço: a tela diz a
   * quem recorrer, sem o nome da turma, sem seção de acesso e sem "Tentar de novo". Cada endereço é um caso (uma carga de página
   * cada, e o portão reprova caso de e2e alterado acima de 15 s), e os três têm de dar o **mesmo** texto de tela,
   * `TELA_DA_TURMA_INDISPONIVEL`, escrito por extenso: dois endereços que dessem textos diferentes não passariam os dois por ele.
   *
   * O sino "Esperando você" (X3) carrega por conta própria e, no computador, mora em `main`: o primeiro endereço abre com a
   * leitura dos vínculos presa (o sino diz "carregando") e os outros com ela terminada (o sino diz quantos esperam). A tela
   * tem de ser a mesma nos dois estados do sino, e por isso o texto comparado é o da tela, sem o sino.
   */
  for (const [endereco, sinoSegurado] of [
    ['com o vínculo pendente', true],
    ['com o vínculo encerrado', false],
    ['que não existe', false],
  ] as const) {
    test(`a turma ${endereco} responde com o aviso da turma indisponível, igual às outras, ${sinoSegurado ? 'com o sino ainda carregando' : 'com o sino já lido'}`, async ({ page, hasTouch }) => {
      test.slow()
      const professora = await criarEquipeComSenha()
      const pendente = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Ciências'])
      const encerrada = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Artes'])
      await confirmarVinculosNoBanco(professora.escolaId, encerrada.vinculoIds)
      await encerrarVinculosNoBanco(professora.escolaId, encerrada.turmaId, professora.usuarioId)
      const turmaId = endereco === 'com o vínculo pendente' ? pendente.turmaId : endereco === 'com o vínculo encerrado' ? encerrada.turmaId : crypto.randomUUID()
      const leituraDoSino = portao()
      await page.route(ehOsMeusVinculos, async (rota: Route) => {
        if (!sinoSegurado) return rota.fallback()
        await leituraDoSino.aberta
        await rota.fallback().catch(() => undefined)
      })
      await abrirJaEntrando(page, professora, `/professor/turmas/${turmaId}`)
      await expect(principal(page).getByRole('status').filter({ hasText: 'Esta turma não está disponível' })).toHaveText(TEXTO_DA_TURMA_INDISPONIVEL, {
        timeout: PRAZO_DA_ENTRADA_MS,
      })
      for (const nome of [pendente.turmaNome, encerrada.turmaNome]) await expect(principal(page)).not.toContainText(nome)
      await expect(principal(page).getByRole('heading', { name: 'Acesso dos alunos' })).toHaveCount(0)
      // O sino "Esperando você" (X3) mora em main no computador: ele não é botão da tela da turma.
      await expect(principal(page).getByRole('button', { name: /^(?!Esperando você)/ })).toHaveCount(0)
      await expect(page).toHaveTitle('Turma · Turmma')
      // Na página que já abre sem a turma, o aviso não puxa o foco: ele fica antes do "Voltar para Turmas".
      await expect(principal(page).getByRole('status').filter({ hasText: 'Esta turma não está disponível' })).not.toBeFocused()
      if (sinoSegurado) await expect(sinoDaProfessora(page)).toHaveAccessibleName('Esperando você, carregando')
      else await expect(sinoDaProfessora(page)).toHaveAccessibleName(/^Esperando você, \d+$/)
      expect(await textoDaTelaSemOSino(page)).toBe(TELA_DA_TURMA_INDISPONIVEL)
      leituraDoSino.abrir()
      expect(await violacoesGraves(page)).toEqual([])
      await acionar(principal(page).getByRole('link', { name: 'Voltar para Turmas' }), hasTouch)
      await expect(page).toHaveURL(/\/professor\/turmas$/)
    })
  }
})

test.describe('W7: gerar, projetar, copiar, compartilhar e trocar o acesso', () => {
  test('o código em dois grupos, grande; "Gerar novo" confirma, diz o que cai e o que destrava; fechar sem copiar pergunta; o WhatsApp leva a escola e o link, e sem ele o botão copia o texto; revogar com perigo', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    // O WhatsApp de mentira: nenhum teste sai para a internet, e o que interessa é o endereço que a tela abre.
    await page.context().route('https://wa.me/**', (rota: Route) => rota.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>WhatsApp de mentira</title>' }))
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    // Os nomes da lista da turma, que nenhum texto de convite pode levar.
    const nomesDaLista = [`Aluna da lista ${crypto.randomUUID().slice(0, 8)}`, `Aluno da lista ${crypto.randomUUID().slice(0, 8)}`]
    await porNaListaDaTurma(
      professora.escolaId,
      turma.turmaId,
      nomesDaLista.map((nome, posicao) => ({ nome, matricula: `M${String(posicao)}-${crypto.randomUUID().slice(0, 8)}` })),
    )
    const semRastro = vigiarAba(page)
    await abrirATurma(page, cenario, hasTouch)
    await expect(semAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const origem = new URL(page.url()).origin

    // Gerar com 1 dia, e não com os 7 que o diálogo propõe: a validade escolhida é a que vai ao servidor.
    await abrirOConvite(page, hasTouch)
    await validade(page, '1 dia').check()
    const pedido = page.waitForRequest(ehOGerar)
    const resposta = proximoAcessoGerado(page)
    await tocar(noDialogo(page), 'Gerar acesso', hasTouch)
    expect((await pedido).postDataJSON()).toEqual({ validadeDias: 1 })
    const primeiro = (await (await resposta).json()) as AcessoGeradoResponse
    expect(diasAte(primeiro.expiraEm)).toBe(1)
    await expect(etapaDoAcesso(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })

    // O código em dois grupos de quatro, grande, e o endereço onde o aluno o digita.
    await expect(codigoNaTela(page)).toHaveText(CODIGO_EM_DOIS_GRUPOS)
    expect(semEspaco(await codigoNaTela(page).innerText())).toBe(primeiro.codigo)
    expect(await codigoNaTela(page).evaluate((elemento) => Number.parseFloat(getComputedStyle(elemento).fontSize))).toBeGreaterThanOrEqual(LETRA_GRANDE_PX)
    // Para o leitor de tela, o código vai soletrado, com a pausa entre os dois grupos, e não como duas palavras.
    await expect(grupoDoCodigo(page).locator('p.sr-only')).toHaveText(`${[...primeiro.codigo.slice(0, 4)].join(' ')}, ${[...primeiro.codigo.slice(4)].join(' ')}`)
    await expect(noDialogo(page)).toContainText(`${new URL(origem).host}/e/${professora.slug}/turma`)
    // O link com a origem desta web, o endereço da escola e o token no fragmento, num campo de leitura.
    const link = await linkNaTela(page)
    expect(link).toBe(`${origem}/e/${professora.slug}/turma#${primeiro.token}`)
    await expect(campoDoLink(page)).toHaveAttribute('readonly', '')
    await expect(noDialogo(page)).toContainText(`Vale até ${await dataNaTela(page, primeiro.expiraEm)}. Depois de fechar, o link e o código não aparecem de novo.`)
    // O que o link abre, e o que o WhatsApp leva, ditos antes de a professora mandar.
    await expect(noDialogo(page)).toContainText(TEXTO_DE_QUEM_VE_A_LISTA)
    await conferirDialogo(page)

    // Copiar: "Link copiado." anunciado dentro do diálogo, e o link na área de transferência. Copiado, fecha sem perguntar.
    await tocar(noDialogo(page), 'Copiar link', hasTouch)
    await expect(noDialogo(page).getByRole('status').filter({ hasText: 'Link copiado.' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link)
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(botaoConvidar(page)).toBeFocused()
    await expect(secao(page)).toContainText(`Vale até ${await dataNaTela(page, primeiro.expiraEm)}.`, { timeout: PRAZO_DA_ENTRADA_MS })

    // "Gerar novo acesso" pede confirmação: diz que o de agora cai, também o de outro professor, e que os nomes travados
    // destravam. O foco começa no texto, e não no botão. O toque fora, que não existe na tela inteira, fecha este passo sem gerar.
    await abrirOConvite(page, hasTouch)
    await tocar(noDialogo(page), 'Gerar novo acesso', hasTouch)
    await expect(page.getByRole('dialog', { name: 'Gerar novo acesso' })).toBeVisible()
    await expect(oQueAcontece(page, TEXTO_DO_ACESSO_QUE_CAI)).toBeFocused()
    await expect(noDialogo(page)).toContainText(TEXTO_DO_ACESSO_UMA_VEZ)
    await expect(validade(page, '7 dias')).toBeChecked()
    await conferirDialogo(page)
    // Nada sai antes de confirmar: o acesso de agora continua valendo.
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(1)
    await (hasTouch ? page.touchscreen.tap(4, 4) : page.mouse.click(4, 4))
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(botaoConvidar(page)).toBeFocused()
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(1)
    await abrirOConvite(page, hasTouch)
    await tocar(noDialogo(page), 'Gerar novo acesso', hasTouch)
    await expect(oQueAcontece(page, TEXTO_DO_ACESSO_QUE_CAI)).toBeFocused()
    const respostaDoSegundo = proximoAcessoGerado(page)
    await tocar(noDialogo(page), 'Gerar novo acesso', hasTouch)
    const segundo = (await (await respostaDoSegundo).json()) as AcessoGeradoResponse
    await expect(etapaDoAcesso(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(semEspaco(await codigoNaTela(page).innerText())).toBe(segundo.codigo)
    expect(segundo.codigo).not.toBe(primeiro.codigo)
    expect(segundo.token).not.toBe(primeiro.token)
    // O anterior caiu na hora: a turma continua com um acesso só.
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(1)

    // Fechar sem copiar pergunta, pelo botão e pelo Esc; "Voltar ao acesso" devolve o mesmo link e código. O toque no canto da
    // tela inteira cai dentro da caixa, que é a janela: não fecha nada e não pergunta.
    const linkDoSegundo = await linkNaTela(page)
    await (hasTouch ? page.touchscreen.tap(4, 4) : page.mouse.click(4, 4))
    await expect(etapaDoAcesso(page)).toBeVisible()
    await expect(pergunta(page)).toHaveCount(0)
    const pedidosDeFechar: (() => Promise<void>)[] = [() => tocar(noDialogo(page), 'Fechar', hasTouch), () => page.keyboard.press('Escape')]
    for (const pedirParaFechar of pedidosDeFechar) {
      await pedirParaFechar()
      await expect(pergunta(page)).toBeFocused()
      await expect(noDialogo(page)).toContainText(TEXTO_DA_PERGUNTA)
      await expect(codigoNaTela(page)).toHaveCount(0)
      await conferirDialogo(page)
      await tocar(noDialogo(page), 'Voltar ao acesso', hasTouch)
      await expect(etapaDoAcesso(page)).toBeFocused()
      expect(await linkNaTela(page)).toBe(linkDoSegundo)
      expect(semEspaco(await codigoNaTela(page).innerText())).toBe(segundo.codigo)
    }

    // O WhatsApp: a aba nova abre o wa.me com o texto, que leva o nome da escola e o link, e nenhum nome da lista. A aba
    // nova não fica com a referência da tela do professor.
    const [whatsApp] = await Promise.all([page.waitForEvent('popup'), tocar(noDialogo(page), 'Compartilhar pelo WhatsApp', hasTouch)])
    await whatsApp.waitForLoadState()
    const endereco = new URL(whatsApp.url())
    expect(`${endereco.origin}${endereco.pathname}`).toBe('https://wa.me/')
    const texto = endereco.searchParams.get('text') ?? ''
    expect(texto).toBe(textoDoConvite(professora.escolaNome, linkDoSegundo))
    for (const nome of [...nomesDaLista, turma.turmaNome, professora.nome]) expect(texto).not.toContain(nome)
    expect(await whatsApp.evaluate(() => window.opener === null)).toBe(true)
    await whatsApp.close()
    await page.bringToFront()
    await expect(noDialogo(page).getByRole('status').filter({ hasText: TEXTO_DO_WHATSAPP_ABERTO })).toBeVisible()
    // O convite saiu pela mão da professora: fechar já não pergunta.
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    // O "Convidar alunos" que abriu continua na seção, e o foco volta para ele.
    await expect(botaoConvidar(page)).toBeFocused()

    // Sem o WhatsApp (o navegador não abre a aba nova): o mesmo botão copia o texto, e diz o que fazer com ele.
    const terceiro = await gerarPelaTela(page, true, hasTouch)
    const linkDoTerceiro = await linkNaTela(page)
    let abasNovas = 0
    page.on('popup', () => abasNovas++)
    await page.evaluate(() => {
      window.open = () => null
    })
    await tocar(noDialogo(page), 'Compartilhar pelo WhatsApp', hasTouch)
    await expect(noDialogo(page).getByRole('status').filter({ hasText: TEXTO_DO_CONVITE_COPIADO })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(textoDoConvite(professora.escolaNome, linkDoTerceiro))
    expect(abasNovas).toBe(0)
    await conferirDialogo(page)
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)

    // Sem o WhatsApp e sem área de transferência: o link fica selecionado no campo, com o que fazer; nada foi copiado, e
    // fechar ainda pergunta.
    const quarto = await gerarPelaTela(page, true, hasTouch)
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    })
    await tocar(noDialogo(page), 'Compartilhar pelo WhatsApp', hasTouch)
    await expect(noDialogo(page).getByRole('status').filter({ hasText: TEXTO_DO_LINK_PARA_COPIAR })).toBeVisible()
    await expect(campoDoLink(page)).toBeFocused()
    expect(await campoDoLink(page).evaluate((campo: HTMLInputElement) => campo.selectionStart === 0 && campo.selectionEnd === campo.value.length)).toBe(true)
    expect(abasNovas).toBe(0)
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(pergunta(page)).toBeFocused()
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(1)

    // Revogar com `perigo`: o texto em vermelho no passo "Vigente", a confirmação que diz o que acontece com o foco no texto, e o
    // botão cheio só no passo de revogar.
    await abrirOConvite(page, hasTouch)
    const revogar = noDialogo(page).getByRole('button', { name: 'Revogar o acesso', exact: true })
    expect(await revogar.evaluate((botao) => getComputedStyle(botao).color)).toBe(COR_DO_PERIGO)
    await acionar(revogar, hasTouch)
    await expect(page.getByRole('dialog', { name: 'Revogar o acesso' })).toBeVisible()
    await expect(noDialogo(page).getByText(TEXTO_DO_REVOGAR, { exact: true })).toBeFocused()
    const confirmar = noDialogo(page).getByRole('button', { name: 'Revogar acesso', exact: true })
    expect(await confirmar.evaluate((botao) => getComputedStyle(botao).backgroundColor)).toBe(COR_DO_PERIGO_CHEIO)
    await conferirDialogo(page)
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(1)
    await acionar(confirmar, hasTouch)
    await expect(anuncio(page, 'Acesso revogado. O link e o código não valem mais.')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(semAcesso(page)).toBeVisible()
    await expect(botaoConvidar(page)).toBeFocused()
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(0)
    // Abrir o diálogo apaga o anúncio da ação anterior.
    await abrirOConvite(page, hasTouch)
    await expect(page.locator('[role="status"]').filter({ hasText: 'Acesso revogado.' })).toHaveCount(0)
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)

    // Nada do link nem do código ficou na aba: nem em endereço, nem no console, nem no armazenamento, nem na página.
    await semRastro(primeiro, segundo, terceiro, quarto)
  })
})

test.describe('W12 (Acesso): a 360 px e só com teclado', () => {
  test('sem rolagem horizontal, também no diálogo com o código grande; alvos de 44 px; gerar, copiar, trocar e revogar só com o teclado, com o foco preso e devolvido', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    await page.setViewportSize({ width: 360, height: 800 })
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    // O nome da turma com os 40 caracteres que a escola pode dar, sem espaço, para provar que nada estica a tela.
    const professora = await criarEquipeComSenha()
    const turma = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Matemática'], `T${'a'.repeat(31)}${crypto.randomUUID().slice(0, 8)}`)
    expect(turma.turmaNome).toHaveLength(40)
    await confirmarVinculosNoBanco(professora.escolaId, turma.vinculoIds)
    await page.goto('/entrar')
    await entrarPorEmail(page, professora, hasTouch)
    await esperarNovaConversa(page, professora.nome)
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    // A lista de Turmas, com o cartão do nome comprido e o link da turma, também cabe em 360 px.
    const abrir = principal(page).getByRole('link', { name: `Abrir a turma ${turma.turmaNome}` })
    await alvoDeToque(abrir, 'Abrir a turma')
    expect(await larguraExcedente(page)).toBe(0)
    await acionar(abrir, hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/turmas/${turma.turmaId}$`))
    await abrirAbaAlunos(page, hasTouch)
    const gerar = botaoConvidar(page)
    await expect(gerar).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await alvoDeToque(principal(page).getByRole('link', { name: 'Voltar para Turmas' }), 'Voltar para Turmas')
    await alvoDeToque(gerar, 'Convidar alunos')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Gerar só com o teclado: Enter abre, o foco começa no texto e não sai do diálogo; a validade troca pelas setas.
    await gerar.focus()
    await page.keyboard.press('Enter')
    await expect(oQueAcontece(page, TEXTO_DO_ACESSO_NOVO)).toBeFocused()
    await conferirDialogo(page)
    for (const dias of ['1 dia', '7 dias', '30 dias']) {
      const linha = noDialogo(page).locator('label').filter({ hasText: new RegExp(`^${dias}$`) })
      expect((await linha.boundingBox())?.height ?? 0, dias).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    }
    for (const botao of ['Gerar acesso', 'Cancelar']) await alvoDeToque(noDialogo(page).getByRole('button', { name: botao, exact: true }), botao)
    await tabAte(page, validade(page, '7 dias'))
    await page.keyboard.press('ArrowDown')
    await expect(validade(page, '30 dias')).toBeChecked()
    for (let tecla = 0; tecla < 8; tecla++) {
      await page.keyboard.press('Tab')
      expect(await focoDentroDoDialogo(page)).toBe(true)
    }
    const pedido = page.waitForRequest(ehOGerar)
    const resposta = proximoAcessoGerado(page)
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Gerar acesso', exact: true }))
    await page.keyboard.press('Enter')
    expect((await pedido).postDataJSON()).toEqual({ validadeDias: 30 })
    const primeiro = (await (await resposta).json()) as AcessoGeradoResponse
    await expect(etapaDoAcesso(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })

    // O acesso a 360 px: o código grande, em dois grupos, cabe no diálogo, e os alvos têm 44 px.
    await expect(codigoNaTela(page)).toHaveText(CODIGO_EM_DOIS_GRUPOS)
    expect(await codigoNaTela(page).evaluate((elemento) => Number.parseFloat(getComputedStyle(elemento).fontSize))).toBeGreaterThanOrEqual(LETRA_GRANDE_PX)
    await conferirDialogo(page)
    for (const botao of ['Copiar link', 'Compartilhar pelo WhatsApp', 'Fechar']) await alvoDeToque(noDialogo(page).getByRole('button', { name: botao, exact: true }), botao)
    for (let tecla = 0; tecla < 8; tecla++) {
      await page.keyboard.press('Shift+Tab')
      expect(await focoDentroDoDialogo(page)).toBe(true)
    }

    // Copiar e fechar pelo teclado: fecha sem perguntar, e o foco volta para o "Convidar alunos" que abriu.
    const link = await linkNaTela(page)
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Copiar link' }))
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByRole('status').filter({ hasText: 'Link copiado.' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link)
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Fechar', exact: true }))
    await page.keyboard.press('Enter')
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(botaoConvidar(page)).toBeFocused()

    // A seção com o acesso, a 360 px: o botão com 44 px, e nada passa da largura. O diálogo abre no passo "Vigente", com os
    // dois botões de 44 px.
    await expect(acessoAtivo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await alvoDeToque(botaoConvidar(page), 'Convidar alunos')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    const gerarNovo = noDialogo(page).getByRole('button', { name: 'Gerar novo acesso', exact: true })
    const revogar = noDialogo(page).getByRole('button', { name: 'Revogar o acesso', exact: true })
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByText(/^Vale até/)).toBeFocused()
    await alvoDeToque(gerarNovo, 'Gerar novo acesso')
    await alvoDeToque(revogar, 'Revogar o acesso')
    await conferirDialogo(page)

    // "Gerar novo acesso" pelo teclado, e dois Esc seguidos, sem tecla nem clique entre eles: o primeiro pergunta, o segundo
    // fecha — e fecha de verdade, com o link e o código junto. O foco volta ao "Convidar alunos" que abriu.
    await tabAte(page, gerarNovo)
    await page.keyboard.press('Enter')
    await expect(oQueAcontece(page, TEXTO_DO_ACESSO_QUE_CAI)).toBeFocused()
    await conferirDialogo(page)
    for (const botao of ['Gerar novo acesso', 'Cancelar']) await alvoDeToque(noDialogo(page).getByRole('button', { name: botao, exact: true }), botao)
    // No celular baixo (360 × 640) a confirmação cabe inteira: o "Cancelar" não fica abaixo da dobra.
    await page.setViewportSize({ width: 360, height: 640 })
    const cancelar = await noDialogo(page).getByRole('button', { name: 'Cancelar', exact: true }).boundingBox()
    expect((cancelar?.y ?? 640) + (cancelar?.height ?? 0)).toBeLessThanOrEqual(640)
    await page.setViewportSize({ width: 360, height: 800 })
    const respostaDoSegundo = proximoAcessoGerado(page)
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Gerar novo acesso' }))
    await page.keyboard.press('Enter')
    const segundo = (await (await respostaDoSegundo).json()) as AcessoGeradoResponse
    await expect(etapaDoAcesso(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await page.keyboard.press('Escape')
    await expect(pergunta(page)).toBeFocused()
    await conferirDialogo(page)
    // Voltar e fechar do mesmo tamanho: sair nunca é menor que ficar (D59).
    for (const botao of ['Voltar ao acesso', 'Fechar sem copiar']) await alvoDeToque(noDialogo(page).getByRole('button', { name: botao, exact: true }), botao)
    await page.keyboard.press('Escape')
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(botaoConvidar(page)).toBeFocused()
    for (const segredo of [segundo.token, segundo.codigo, primeiro.token, primeiro.codigo]) expect(await page.content()).not.toContain(segredo)

    // O navegador fecha o `dialog` por conta própria (o segundo Esc sem gesto, no Chrome que aplica a regra do `cancel`):
    // a tela desmonta o diálogo, com o link e o código, como no "Fechar sem copiar".
    await page.keyboard.press('Enter')
    await tabAte(page, gerarNovo)
    await page.keyboard.press('Enter')
    await expect(oQueAcontece(page, TEXTO_DO_ACESSO_QUE_CAI)).toBeFocused()
    const respostaDoTerceiro = proximoAcessoGerado(page)
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Gerar novo acesso' }))
    await page.keyboard.press('Enter')
    const terceiro = (await (await respostaDoTerceiro).json()) as AcessoGeradoResponse
    await expect(etapaDoAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await dialogosAbertos(page).evaluate((dialogo: HTMLDialogElement) => dialogo.close())
    await expect(dialogosDaTela(page)).toHaveCount(0)
    for (const segredo of [terceiro.token, terceiro.codigo]) expect(await page.content()).not.toContain(segredo)

    // Revogar só pelo teclado, com a confirmação que diz o que acontece; o foco começa no texto. Revogado, o diálogo fecha, a
    // seção volta ao vazio e o foco fica no "Convidar alunos".
    await expect(botaoConvidar(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await tabAte(page, revogar)
    await page.keyboard.press('Enter')
    await expect(noDialogo(page).getByText(TEXTO_DO_REVOGAR, { exact: true })).toBeFocused()
    await conferirDialogo(page)
    for (const botao of ['Revogar acesso', 'Cancelar']) await alvoDeToque(noDialogo(page).getByRole('button', { name: botao, exact: true }), botao)
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Revogar acesso', exact: true }))
    await page.keyboard.press('Enter')
    await expect(anuncio(page, 'Acesso revogado.')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(semAcesso(page)).toBeVisible()
    await expect(botaoConvidar(page)).toBeFocused()
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(0)
  })
})

test.describe('clique duplo', () => {
  test('dois cliques em Gerar mandam um pedido só: um acesso vigente, e a tela mostra o código que ficou; em revogar, um pedido só', async ({ page, hasTouch }) => {
    test.slow()
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    await abrirATurma(page, cenario, hasTouch)
    await expect(semAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    let pedidos = 0
    let seguro = portao()
    const segurar = async (rota: Route) => {
      if (rota.request().method() !== 'POST') return rota.fallback()
      pedidos++
      await seguro.aberta
      return rota.fallback()
    }

    // Gerar: o segundo clique, com o primeiro no ar, receberia CONFLITO, e a tela poderia ficar com a recusa, sem o
    // código — que aparece uma vez só — do acesso que passou a valer.
    await page.route(ehOAcesso, segurar)
    await abrirOConvite(page, hasTouch)
    const resposta = proximoAcessoGerado(page)
    await doisCliquesNoMesmoInstante(noDialogo(page).getByRole('button', { name: 'Gerar acesso', exact: true }))
    await expect.poll(() => pedidos).toBe(1)
    await expect(noDialogo(page).getByRole('button', { name: 'Gerando…' })).toBeDisabled()
    await expect(noDialogo(page).getByRole('status').filter({ hasText: 'Gerando o acesso…' })).toBeAttached()
    // Com o pedido no ar, a validade não muda mais: o que está marcado é o que foi pedido.
    for (const dias of ['1 dia', '7 dias', '30 dias']) await expect(validade(page, dias)).toBeDisabled()
    // "Cancelar" com o pedido no ar pergunta. O pedido que dá certo com a pergunta aberta não a tira: o acesso agora
    // existe, a pergunta passa a falar dele, e "Voltar ao acesso" o mostra.
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(pergunta(page)).toBeFocused()
    await expect(noDialogo(page)).toContainText('O acesso ainda está sendo gerado')
    seguro.abrir()
    const gerado = (await (await resposta).json()) as AcessoGeradoResponse
    await expect(noDialogo(page)).toContainText(TEXTO_DA_PERGUNTA, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(pergunta(page)).toBeVisible()
    await expect(campoDoLink(page)).toHaveCount(0)
    await tocar(noDialogo(page), 'Voltar ao acesso', hasTouch)
    await expect(etapaDoAcesso(page)).toBeFocused()
    expect(semEspaco(await codigoNaTela(page).innerText())).toBe(gerado.codigo)
    expect(tokenDo(await linkNaTela(page))).toBe(gerado.token)
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    expect(pedidos).toBe(1)
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(1)
    await page.unroute(ehOAcesso, segurar)
    await fecharSemCopiar(page, hasTouch)
    await expect(acessoAtivo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // Revogar: um pedido só, e o anúncio do revogado, sem "já não tem acesso ativo".
    pedidos = 0
    seguro = portao()
    await page.route(ehORevogar, segurar)
    await abrirOConvite(page, hasTouch)
    await tocar(noDialogo(page), 'Revogar o acesso', hasTouch)
    await doisCliquesNoMesmoInstante(noDialogo(page).getByRole('button', { name: 'Revogar acesso', exact: true }))
    await expect.poll(() => pedidos).toBe(1)
    seguro.abrir()
    await expect(anuncio(page, 'Acesso revogado.')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(pedidos).toBe(1)
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(0)
  })
})

test.describe('recomeço da tela do acesso', () => {
  test('falha com o diálogo aberto: o CONFLITO do gerar recarrega a seção e deixa só "Fechar"; reabrindo, o aviso e o foco da tentativa anterior saem; a recusa com a pergunta de fechar aberta volta à etapa do pedido; a turma que saiu do alcance', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    await abrirATurma(page, cenario, hasTouch)
    await expect(semAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // Outro professor da turma gera o acesso com esta tela aberta, e o gerar daqui chega junto com o dele: CONFLITO. O
    // aviso fica dentro do diálogo, com o foco nele; a seção recarrega com o acesso que passou a valer, e sobra só "Fechar".
    const doOutro = await gerarAcessoNoBanco(professora.escolaId, turma.turmaId, 30)
    const recusar = (rota: Route) => (rota.request().method() === 'POST' ? rota.fulfill({ status: 409, contentType: 'application/json', body: CONFLITO }) : rota.fallback())
    await page.route(ehOAcesso, recusar)
    const recarregada = proximaLeitura(page)
    await abrirOConvite(page, hasTouch)
    await tocar(noDialogo(page), 'Gerar acesso', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveText(TEXTO_DO_ACESSO_GERADO_EM_OUTRO_LUGAR, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('alert')).toBeFocused()
    expect(((await (await recarregada).json()) as { expiraEm: string | null }).expiraEm).toBe(doOutro)
    await expect(noDialogo(page).getByRole('button')).toHaveText(['Fechar'])
    for (const dias of ['1 dia', '7 dias', '30 dias']) await expect(validade(page, dias)).toBeDisabled()
    await expect(campoDoLink(page)).toHaveCount(0)
    await expect(noDialogo(page)).not.toContainText('CONFLITO')
    await expect(noDialogo(page)).not.toContainText(codigoCru('409'))
    await conferirDialogo(page)
    await page.unroute(ehOAcesso, recusar)
    // Sem link em risco, "Fechar" fecha na hora. A seção recarregou com o acesso do outro: o foco volta ao "Convidar alunos".
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(acessoAtivo(page)).toBeVisible()
    await expect(secao(page)).toContainText(`Vale até ${await dataNaTela(page, doOutro)}.`)
    await expect(botaoConvidar(page)).toBeFocused()

    // Reabrindo: sem o aviso da tentativa anterior, com o foco no texto, que agora diz que o acesso do outro cai.
    await abrirOConvite(page, hasTouch)
    await tocar(noDialogo(page), 'Gerar novo acesso', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    await expect(oQueAcontece(page, TEXTO_DO_ACESSO_QUE_CAI)).toBeFocused()
    await expect(noDialogo(page).getByRole('button', { name: 'Gerar novo acesso' })).toBeEnabled()
    await expect(validade(page, '7 dias')).toBeEnabled()

    // A recusa que chega com a pergunta de fechar aberta: o pedido fica segurado e responde 503. A pergunta sai, a etapa
    // do pedido volta com o aviso e o foco nele, e a nova tentativa mostra o acesso.
    const seguro = portao()
    const derrubar = async (rota: Route) => {
      if (rota.request().method() !== 'POST') return rota.fallback()
      await seguro.aberta
      return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
    }
    await page.route(ehOAcesso, derrubar)
    await tocar(noDialogo(page), 'Gerar novo acesso', hasTouch)
    await expect(noDialogo(page).getByRole('button', { name: 'Gerando…' })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(pergunta(page)).toBeFocused()
    await expect(noDialogo(page)).toContainText('O acesso ainda está sendo gerado')
    seguro.abrir()
    await expect(noDialogo(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('alert')).toBeFocused()
    await expect(pergunta(page)).toHaveCount(0)
    await expect(noDialogo(page)).not.toContainText(TEXTO_DA_PERGUNTA)
    await expect(noDialogo(page).getByText(TEXTO_DO_ACESSO_QUE_CAI, { exact: true })).toBeVisible()
    // A queda não muda a seção: o mesmo botão tenta de novo, e a validade continua escolhível.
    await expect(noDialogo(page).getByRole('button', { name: 'Gerar novo acesso' })).toBeEnabled()
    await expect(validade(page, '7 dias')).toBeEnabled()
    expect(await violacoesGraves(page)).toEqual([])
    await page.unroute(ehOAcesso, derrubar)
    await tocar(noDialogo(page), 'Gerar novo acesso', hasTouch)
    await expect(etapaDoAcesso(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    await expect(pergunta(page)).toHaveCount(0)
    await fecharSemCopiar(page, hasTouch)
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(1)

    // O revogar do acesso que outra pessoa já revogou com esta tela aberta: "já não tem acesso ativo", dentro do diálogo;
    // a seção recarrega, e sobra só "Fechar". O diálogo abre antes, com o acesso ainda vigente: ele lê o que a tela tem.
    await expect(acessoAtivo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await abrirOConvite(page, hasTouch)
    await revogarAcessoNoBanco(professora.escolaId, turma.turmaId)
    await tocar(noDialogo(page), 'Revogar o acesso', hasTouch)
    await tocar(noDialogo(page), 'Revogar acesso', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveText(TEXTO_DO_ACESSO_QUE_JA_NAO_VALE, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('alert')).toBeFocused()
    await expect(noDialogo(page).getByRole('button')).toHaveText(['Fechar'])
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(semAcesso(page)).toBeVisible()
    await expect(anuncio(page, 'Acesso revogado.')).toHaveCount(0)
    await expect(botaoConvidar(page)).toBeFocused()

    // A coordenação encerra o vínculo com a tela aberta (o professor realocado em março): o gerar responde como a turma
    // que não existe, o diálogo diz a quem recorrer e só oferece "Fechar", e a seção deixa de oferecer o que a API recusa.
    await encerrarVinculosNoBanco(professora.escolaId, turma.turmaId, professora.usuarioId)
    await abrirOConvite(page, hasTouch)
    await tocar(noDialogo(page), 'Gerar acesso', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveText(TEXTO_DA_TURMA_INDISPONIVEL, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('alert')).toBeFocused()
    await expect(noDialogo(page).getByRole('button')).toHaveText(['Fechar'])
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(secao(page).getByRole('status').filter({ hasText: 'Esta turma não está disponível' })).toHaveText(TEXTO_DA_TURMA_INDISPONIVEL)
    await expect(secao(page).getByRole('button')).toHaveCount(0)
    await expect(acessoAtivo(page)).toHaveCount(0)
    await expect(tituloDaSecao(page)).toBeFocused()
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('resposta atrasada: o gerar anterior que responde depois do gerar seguinte não troca o código novo, e a validade na seção é a do servidor', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    await abrirATurma(page, cenario, hasTouch)
    await expect(semAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // O primeiro gerar chega ao servidor e é atendido; é a resposta dele que fica segurada no caminho de volta.
    const seguro = portao()
    let primeiroPedido = true
    let doPrimeiro: AcessoGeradoResponse | undefined
    let primeiroEntregue = false
    await page.route(ehOAcesso, async (rota: Route) => {
      if (rota.request().method() !== 'POST' || !primeiroPedido) return rota.fallback()
      primeiroPedido = false
      const resposta = await rota.fetch()
      doPrimeiro = (await resposta.json()) as AcessoGeradoResponse
      await seguro.aberta
      await rota.fulfill({ response: resposta })
      primeiroEntregue = true
    })
    await abrirOConvite(page, hasTouch)
    await validade(page, '1 dia').check()
    await tocar(noDialogo(page), 'Gerar acesso', hasTouch)
    await expect.poll(() => doPrimeiro).toBeDefined()
    // Sem resposta, a professora desiste: fecha com o pedido no ar, e a seção ainda não sabe do acesso.
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await tocar(noDialogo(page), 'Fechar sem copiar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(semAcesso(page)).toBeVisible()

    // E gera de novo, com 30 dias: este derruba o primeiro no servidor, e é o código dele que vale.
    const segundo = await gerarPelaTela(page, false, hasTouch, '30 dias')
    expect(diasAte(segundo.expiraEm)).toBe(30)
    const linkDoSegundo = await linkNaTela(page)

    // A resposta do primeiro chega agora: o diálogo continua com o link e o código do segundo.
    const relida = proximaLeitura(page)
    seguro.abrir()
    await expect.poll(() => primeiroEntregue).toBe(true)
    // A releitura que a resposta atrasada dispara termina com o diálogo aberto.
    expect(((await (await relida).json()) as { expiraEm: string | null }).expiraEm).toBe(segundo.expiraEm)
    expect(doPrimeiro?.codigo).not.toBe(segundo.codigo)
    expect(semEspaco(await codigoNaTela(page).innerText())).toBe(segundo.codigo)
    expect(await linkNaTela(page)).toBe(linkDoSegundo)
    expect(tokenDo(linkDoSegundo)).toBe(segundo.token)
    await expect(etapaDoAcesso(page)).toBeVisible()
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    expect(await page.content()).not.toContain(doPrimeiro?.token ?? '')
    await fecharSemCopiar(page, hasTouch)

    // A validade na seção é a do acesso que o servidor tem (30 dias), e não a da resposta que chegou por último (1 dia).
    await expect(acessoAtivo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secao(page)).toContainText(`Vale até ${await dataNaTela(page, segundo.expiraEm)}.`)
    expect(await dataNaTela(page, doPrimeiro?.expiraEm ?? '')).not.toBe(await dataNaTela(page, segundo.expiraEm))
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(1)
  })

  test('outra turma, mesma entrada e segunda pessoa: a outra turma não fica com o diálogo da primeira; abrir de novo a mesma turma não mostra o link já fechado; outro professor na mesma aba não vê o link, o código nem o acesso do primeiro', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    const segunda = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Física'])
    await confirmarVinculosNoBanco(professora.escolaId, segunda.vinculoIds)
    const semRastro = vigiarAba(page)
    // A professora passa pela segunda turma, que fica lida, e volta para abrir a primeira.
    await abrirATurma(page, { professora, turma: segunda }, hasTouch)
    await expect(semAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(principal(page).getByRole('link', { name: 'Voltar para Turmas' }), hasTouch)
    await acionar(principal(page).getByRole('link', { name: `Abrir a turma ${turma.turmaNome}` }), hasTouch)
    await abrirAbaAlunos(page, hasTouch)
    await expect(semAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const gerado = await gerarPelaTela(page, false, hasTouch)

    // Outra turma é outra tela: o endereço muda para a segunda turma com o diálogo da primeira aberto (o histórico do
    // navegador), e o link e o código da primeira não ficam por cima dela.
    await page.evaluate((caminho) => history.pushState(null, '', caminho), `/professor/turmas/${segunda.turmaId}`)
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${segunda.turmaNome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogosDaTela(page)).toHaveCount(0)
    // Outra turma é outra tela, e abre em Hoje: o acesso está na aba "Alunos".
    await abrirAbaAlunos(page, hasTouch)
    await expect(semAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(acessoAtivo(page)).toHaveCount(0)
    await semRastro(gerado)
    await page.goBack()
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${turma.turmaNome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await abrirAbaAlunos(page, hasTouch)
    await expect(acessoAtivo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // Mesma entrada: voltar para Turmas e abrir a mesma turma de novo. Só a validade; o link e o código não voltam.
    await acionar(principal(page).getByRole('link', { name: 'Voltar para Turmas' }), hasTouch)
    await expect(page).toHaveURL(/\/professor\/turmas$/)
    await acionar(principal(page).getByRole('link', { name: `Abrir a turma ${turma.turmaNome}` }), hasTouch)
    await abrirAbaAlunos(page, hasTouch)
    await expect(acessoAtivo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secao(page)).toContainText(`Vale até ${await dataNaTela(page, gerado.expiraEm)}.`)
    await expect(dialogosAbertos(page)).toHaveCount(0)
    await expect(secao(page).getByRole('textbox')).toHaveCount(0)
    await semRastro(gerado)

    // Segunda pessoa: outro professor, de outra escola, com a turma dele, entra na mesma aba, sem recarregar. A leitura do
    // acesso dele fica segurada: é aí que o "Acesso ativo" da turma do primeiro apareceria.
    await abrirNavegacao(page, hasTouch)
    await acionar(lateral(page).getByRole('button', { name: 'Sair' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    const outro = await criarEquipeComSenha()
    const turmaDoOutro = await criarAlocacaoDoProfessor(outro.escolaId, outro.usuarioId, ['Geografia'])
    await confirmarVinculosNoBanco(outro.escolaId, turmaDoOutro.vinculoIds)
    const segurada = portao()
    await page.route(ehOAcesso, async (rota: Route) => {
      if (rota.request().method() === 'GET') await segurada.aberta
      return rota.fallback()
    })
    await entrarPorEmail(page, outro, hasTouch)
    await esperarNovaConversa(page, outro.nome)
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(principal(page).getByRole('link', { name: `Abrir a turma ${turma.turmaNome}` })).toHaveCount(0)
    await acionar(principal(page).getByRole('link', { name: `Abrir a turma ${turmaDoOutro.turmaNome}` }), hasTouch)
    await abrirAbaAlunos(page, hasTouch)
    await expect(secao(page).getByRole('status').filter({ hasText: 'Carregando o acesso da turma…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(acessoAtivo(page)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(turma.turmaNome)
    await expect(dialogosAbertos(page)).toHaveCount(0)
    segurada.abrir()
    await expect(semAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(acessoAtivo(page)).toHaveCount(0)
    await semRastro(gerado)
    expect(await acessosVigentesDaTurma(professora.escolaId, turma.turmaId)).toBe(1)
    expect(await acessosVigentesDaTurma(outro.escolaId, turmaDoOutro.turmaId)).toBe(0)

    // E a turma do primeiro, pelo endereço dela: para o segundo ela responde como a que não existe.
    await page.goto(`/professor/turmas/${turma.turmaId}`)
    await expect(principal(page).getByRole('status').filter({ hasText: 'Esta turma não está disponível' })).toHaveText(TEXTO_DA_TURMA_INDISPONIVEL, {
      timeout: PRAZO_DA_ENTRADA_MS,
    })
    await expect(page.locator('body')).not.toContainText(turma.turmaNome)
    await expect(principal(page).getByRole('heading', { name: 'Acesso dos alunos' })).toHaveCount(0)
  })

  test('a releitura que cai com o código projetado não tira o diálogo da tela: a turma e o acesso ficam, e a seção mostra o erro por trás; a turma que a releitura deixa de achar sai inteira', async ({ page, hasTouch }) => {
    test.slow()
    const cenario = await criarProfessoraComTurma()
    const { turma } = cenario
    // O relógio da aba é simulado, para as leituras envelhecerem sem o teste esperar.
    await page.clock.install()
    await abrirATurma(page, cenario, hasTouch)
    await expect(semAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const gerado = await gerarPelaTela(page, false, hasTouch)

    // A professora projeta o código, vai a outra aba e volta: a web relê o que envelheceu, e a rede da escola caiu.
    let falhasDaTurma = 0
    await page.route(ehATurma, (rota: Route) => {
      falhasDaTurma++
      return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
    })
    await page.route(ehOAcesso, (rota: Route) => rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }))
    await page.clock.fastForward('00:01:00')
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
    // A leitura da turma falhou, e a nova tentativa automática também; a do acesso, idem, e a seção já mostra o erro.
    await expect.poll(() => falhasDaTurma, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(2)
    await expect(secao(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    // O diálogo continua aberto, com o mesmo código e o mesmo link, e a turma continua na tela.
    await expect(etapaDoAcesso(page)).toBeVisible()
    expect(semEspaco(await codigoNaTela(page).innerText())).toBe(gerado.codigo)
    expect(tokenDo(await linkNaTela(page))).toBe(gerado.token)
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${turma.turmaNome}` })).toBeAttached()
    await expect(dialogosAbertos(page)).toHaveCount(1)

    // Já a turma que a API deixa de achar na releitura (a coordenação encerrou o vínculo com a tela aberta) sai da
    // página inteira, com o diálogo, o link e o código: o título não continua afirmando a turma.
    await page.unroute(ehATurma)
    await page.unroute(ehOAcesso)
    await encerrarVinculosNoBanco(cenario.professora.escolaId, turma.turmaId, cenario.professora.usuarioId)
    await page.clock.fastForward('00:01:00')
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
    await expect(principal(page).getByRole('status').filter({ hasText: 'Esta turma não está disponível' })).toHaveText(TEXTO_DA_TURMA_INDISPONIVEL, {
      timeout: PRAZO_DA_ENTRADA_MS,
    })
    // A tela continua com o título da 11.0, mas só "Turma": sem o nome nem a série da turma que saiu.
    await expect(principal(page).getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(principal(page).getByRole('heading', { level: 1 })).toHaveText('Turma')
    await expect(page.locator('body')).not.toContainText(turma.turmaNome)
    await expect(principal(page)).not.toContainText(SERIE_DA_TURMA)
    await expect(principal(page).getByRole('heading', { name: 'Acesso dos alunos' })).toHaveCount(0)
    await expect(dialogosAbertos(page)).toHaveCount(0)
    // O título da aba deixa de dizer a turma, e o foco, que estava no diálogo, vem para o aviso, e não cai no `body`.
    await expect(page).toHaveTitle('Turma · Turmma')
    await expect(principal(page).getByRole('status').filter({ hasText: 'Esta turma não está disponível' })).toBeFocused()
    for (const segredo of [gerado.token, gerado.codigo]) expect(await page.content()).not.toContain(segredo)
  })

  test('a sessão vence com o acesso na tela: o diálogo sai com o link e o código, e não fica atrás do login por cima; a professora volta, e a turma volta sem eles', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const INATIVIDADE_MIN = 30
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    await definirInatividadeDaEscola(professora.escolaId, { equipe: INATIVIDADE_MIN })
    // O relógio da aba é simulado: ninguém espera meia hora no e2e, e o servidor continua no tempo real.
    await page.clock.install()
    await abrirATurma(page, cenario, hasTouch)
    await expect(semAcesso(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const gerado = await gerarPelaTela(page, false, hasTouch)
    expect(await page.content()).toContain(gerado.token)
    expect(semEspaco(await codigoNaTela(page).innerText())).toBe(gerado.codigo)

    await page.clock.fastForward(`00:${String(INATIVIDADE_MIN + 1)}:00`)
    await expect(page.getByRole('dialog', { name: 'Sua sessão expirou' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // Só o login por cima: o diálogo do acesso saiu da página, com o link e o código.
    await expect(dialogosAbertos(page)).toHaveCount(1)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    for (const segredo of [gerado.token, gerado.codigo, `${gerado.codigo.slice(0, 4)} ${gerado.codigo.slice(4)}`]) expect(await page.content()).not.toContain(segredo)

    // A mesma pessoa volta, e a leitura de quem está na sessão cai: a turma não aparece pela metade, e a tela diz o que
    // fazer. Com a nova tentativa, a turma volta só com a validade.
    let derrubarOEu = true
    await page.route(ehOEu, (rota: Route) => (derrubarOEu ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.fallback()))
    await page.getByLabel('E-mail').fill(professora.email)
    await page.getByLabel('Senha').fill(professora.senha)
    await acionar(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await expect(page.getByRole('dialog', { name: 'Sua sessão expirou' })).toBeHidden({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('heading', { name: 'Acesso dos alunos' })).toHaveCount(0)
    derrubarOEu = false
    await tocar(principal(page), 'Tentar de novo', hasTouch)
    await expect(page).toHaveURL(new RegExp(`/professor/turmas/${turma.turmaId}(\\?aba=alunos)?$`))
    await expect(acessoAtivo(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secao(page)).toContainText(`Vale até ${await dataNaTela(page, gerado.expiraEm)}.`)
    await expect(dialogosAbertos(page)).toHaveCount(0)
    for (const segredo of [gerado.token, gerado.codigo]) expect(await page.content()).not.toContain(segredo)
  })
})
