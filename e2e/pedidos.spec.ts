import type { Locator, Page, Request, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import type { PedidosDaTurmaResponse } from '../packages/shared/src/sala/pedidos.ts'
import { abrirNavegacao, entrarComoCoordenacaoNaMesmaAba, entrarPorEmail, abrirEstrutura, irPelaNavegacao, lateral, PRAZO_DA_ENTRADA_MS, esperarNovaConversa, abrirAbaAlunos } from './__fixtures__/casca.ts'
import { linhasDaTabela } from './__fixtures__/coordenacao.ts'
import { expect, test } from './__fixtures__/perfis.ts'
import {
  alunosDaTurmaNoBanco,
  apagarPedidoNoBanco,
  confirmarVinculosNoBanco,
  criarAlocacaoDoProfessor,
  criarCoordenadoraNaEscola,
  criarEquipeComSenha,
  criarPedidosNoBanco,
  encerrarAnoNoBanco,
  encerrarVinculosNoBanco,
  estadosDaListaNoBanco,
  leiturasDePedidosNaAuditoria,
  montarEstruturaNoBanco,
  porAprovadosNaListaDaTurma,
  porNaListaDaTurma,
  recusarPedidoNoBanco,
  type AlocacaoDeTeste,
  type EquipeDeTeste,
  type PedidoDeTeste,
} from './__fixtures__/sessao.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './__fixtures__/verificacoes.ts'

/**
 * Os pedidos de nome, com os diálogos de decisão, do professor e da coordenação (A1, tarefa 16.0;
 * `tasks/prd-apresentacao-escola/cenarios.md`): W6, W4 e W12 de Pedidos, a parte do W15 que é do navegador (o foco e a
 * região viva), e o recomeço da tela. Tudo pela tela, nos projetos `chromebook` e `celular`, com escola, turma e nomes
 * inventados pelo teste. Os textos esperados estão aqui por extenso.
 */

const INDISPONIVEL = JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })

const TEXTO_DA_MATRICULA_ERRADA = 'Houve tentativa com matrícula errada neste nome; pode ter sido erro de digitação'
const TEXTO_DE_COMO_DECIDIR = 'Marque os pedidos que você conferiu para aprovar ou recusar, até 40 por vez. Cada nome é conferido: não há como aprovar todos de uma vez.'
const TEXTO_DO_LIMITE = 'Você marcou 40 pedidos, o máximo de uma decisão. Decida estes para marcar os outros.'
const TEXTO_DE_QUE_HA_MAIS = 'Há mais pedidos esperando do que os que aparecem aqui. Os próximos aparecem depois que estes forem decididos.'
const EFEITO_DE_APROVAR =
  'Cada pedido aprovado vira a conta do aluno: ele passa a entrar no Turmma com a matrícula da lista e a senha que criou, já nesta turma. Confira se cada nome é mesmo de um aluno da turma antes de aprovar.'
const EFEITO_DE_RECUSAR = 'Cada pedido recusado é fechado, e o nome volta à lista da turma, livre para ser pedido de novo. A senha criada no pedido é apagada.'
const TEXTO_DA_AUDITORIA_DA_DECISAO = 'Esta decisão fica registrada na auditoria, em seu nome, como decisão da coordenação.'
const TEXTO_DA_AUDITORIA_DA_LEITURA = 'Cada consulta aos pedidos fica registrada na auditoria, em seu nome. Por isso a lista só é lida quando você clica em Atualizar.'
const TEXTO_ANTES_DA_LEITURA = 'Clique em Atualizar para ver os pedidos que esperam a decisão nesta turma.'
const TEXTO_DA_ATUALIZACAO_SOZINHA = 'A lista se atualiza sozinha a cada 15 segundos, enquanto esta aba estiver à vista.'
const APROVADO = 'Aprovado: já pode entrar com a matrícula e a senha'
const RECUSADO = 'Recusado: o nome voltou à lista'
const JA_DECIDIDO = 'Já decidido por outra pessoa'
const NAO_DISPONIVEL = 'Este pedido não está mais disponível'
const DEPOIS_DA_FALHA_DO_PROFESSOR = 'Alguns pedidos podem já ter sido decididos: a lista foi atualizada, e os que continuam aqui ainda esperam.'
const DEPOIS_DA_FALHA_DA_COORDENACAO = 'Alguns pedidos podem já ter sido decididos. Feche e clique em Atualizar para ver os que continuam esperando.'
const TEXTO_DA_TURMA_INDISPONIVEL =
  'Esta turma não está disponível para você agora: o seu vínculo com ela pode não estar confirmado, ou ela saiu do ano letivo em curso. Volte para Turmas; se ela deveria estar lá, fale com a coordenação.'
const DOS_APROVADOS = 'Eles contam entre os nomes da lista, mas não aparecem pelo nome: já entram com a matrícula e a senha.'
const TEXTO_DA_TURMA_FORA_DO_ANO = 'Esta turma não está no ano letivo em curso: ela pode ter sido excluída. Volte para Escola › Turmas e abra a turma de novo.'

/** O grafite da decisão oficial (`--color-grafite`, #333333) e o texto do `perigo` (`--color-vermelho-texto`, #b84045). */
const COR_DO_OFICIAL = 'rgb(51, 51, 51)'
const COR_DO_PERIGO = 'rgb(184, 64, 69)'
/** A face do perigo cheio (`--color-vermelho`, #f2545b): só o botão que confirma, dentro do diálogo. */
const COR_DO_PERIGO_CHEIO = 'rgb(242, 84, 91)'
/** O verde do que deu certo (`--color-ok`, #0b6b47) e o tom de atenção (`--color-pendente`, #8a3e0c). */
const COR_DO_OK = 'rgb(11, 107, 71)'
const COR_DA_ATENCAO = 'rgb(138, 62, 12)'

/** De quanto em quanto tempo a lista do professor é relida. */
const INTERVALO_MS = 15_000

/** A leitura dos pedidos (`GET /v1/turmas/:id/reivindicacoes`) e a decisão (`POST /v1/reivindicacoes/decidir`). */
const ehALeitura = (url: URL) => /^\/v1\/turmas\/[^/]+\/reivindicacoes$/.test(url.pathname)
const ehADecisao = (url: URL) => url.pathname === '/v1/reivindicacoes/decidir'
const ehUmaLeitura = (pedido: Request) => pedido.method() === 'GET' && ehALeitura(new URL(pedido.url()))

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Um botão, pelo nome exato, dentro de um lugar: toque no celular, clique no Chromebook. */
async function tocar(lugar: Locator, nome: string, hasTouch: boolean): Promise<void> {
  await acionar(lugar.getByRole('button', { name: nome, exact: true }), hasTouch)
}

/** Os dois cliques de um clique duplo no mesmo instante, antes de a tela desligar o botão. */
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
const dialogosDaTela = (page: Page) => principal(page).locator('dialog')
const noDialogo = (page: Page): Locator => page.getByRole('dialog')
/** A seção dos pedidos, pelo título dela, que é para onde o foco vai quando o botão que abriu o diálogo saiu da tela. */
const secao = (page: Page) => principal(page).getByRole('region', { name: 'Pedidos de nome' })
const tituloDaSecao = (page: Page) => principal(page).getByRole('heading', { name: 'Pedidos de nome' })
const lista = (page: Page) => secao(page).getByRole('list', { name: 'Pedidos esperando a decisão' })
const linhas = (page: Page) => lista(page).getByRole('listitem')
/** A caixa de um pedido, pelo nome do aluno: o nome acessível dela é o cartão inteiro (o nome, a hora e a marca). */
const caixa = (page: Page, nome: string) => lista(page).getByRole('checkbox', { name: nome })
const vazio = (page: Page) => secao(page).getByText('Nenhum pedido esperando', { exact: true })
/** A região viva que anuncia os pedidos novos, sem levar o foco. */
const regiaoViva = (page: Page) => secao(page).locator('p[aria-live="polite"]')
/** O texto que abre o diálogo, com o foco: o que vai ser decidido. */
const oQueVaiSerDecidido = (page: Page, texto: string) => noDialogo(page).getByText(texto, { exact: true })
const pedidosDoDialogo = (page: Page) => noDialogo(page).getByRole('list', { name: 'Pedidos desta decisão' }).getByRole('listitem')
const resultados = (page: Page) => noDialogo(page).getByRole('list', { name: 'Resultado de cada pedido' }).getByRole('listitem')
const tituloDoResultado = (page: Page) => noDialogo(page).getByRole('heading', { name: 'Resultado' })

async function alvoDeToque(alvo: Locator, descricao: string): Promise<void> {
  const caixaDoAlvo = await alvo.boundingBox()
  expect(caixaDoAlvo, `${descricao} sem caixa`).not.toBeNull()
  expect(caixaDoAlvo?.height ?? 0, descricao).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  expect(caixaDoAlvo?.width ?? 0, descricao).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
}

/** Sem rolagem horizontal no documento nem no diálogo aberto, e o axe limpo. */
async function conferirDialogo(page: Page): Promise<void> {
  expect(await larguraExcedenteDoDialogo(page)).toBe(0)
  expect(await larguraExcedente(page)).toBe(0)
  expect(await violacoesGraves(page)).toEqual([])
}

/** Aperta Tab até o foco chegar no alvo, sem passar de 60 teclas. */
async function tabAte(page: Page, alvo: Locator): Promise<void> {
  for (let tecla = 0; tecla < 60; tecla++) {
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error('o Tab não chegou ao alvo')
}

const focoDentroDoDialogo = (page: Page) => page.evaluate(() => document.activeElement !== null && document.activeElement.closest('dialog[open]') !== null)

/** A data e a hora como a tela as escreve (`formatar.ts`), no fuso do navegador do teste. */
function dataNaTela(page: Page, iso: string): Promise<string> {
  return page.evaluate((valor) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor)), iso)
}

/** Nomes inventados, com uma marca única por teste: é por eles que o teste procura o que não devia estar na tela. */
function nomesDeTeste(quantos: number, prefixo = 'Aluno'): Array<{ nome: string; matricula: string }> {
  const marca = crypto.randomUUID().slice(0, 8)
  return Array.from({ length: quantos }, (_, indice) => ({ nome: `${prefixo} ${String(indice + 1).padStart(2, '0')} sintético ${marca}`, matricula: `${marca}-${String(indice + 1)}` }))
}

interface Cenario {
  readonly professora: EquipeDeTeste
  readonly turma: AlocacaoDeTeste
}

/** A professora com uma turma confirmada. */
async function criarProfessoraComTurma(nomeDaTurma?: string): Promise<Cenario> {
  const professora = await criarEquipeComSenha()
  const turma = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Matemática'], nomeDaTurma)
  await confirmarVinculosNoBanco(professora.escolaId, turma.vinculoIds)
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
  // Os pedidos de nome ficam na aba "Alunos" da turma aberta (A3).
  await abrirAbaAlunos(page, hasTouch)
}

/**
 * Passa os 15 s do intervalo no relógio da aba (que o teste instalou): a lista do professor é relida sem o teste esperar.
 * O que a releitura traz é conferido pela tela, com prazo: uma leitura que já estava no ar pode responder antes.
 */
async function passarOIntervalo(page: Page): Promise<void> {
  await page.clock.fastForward(INTERVALO_MS)
}

/** Marca os pedidos pelo nome, com toque ou clique. */
async function marcar(page: Page, nomes: readonly string[], hasTouch: boolean): Promise<void> {
  for (const nome of nomes) {
    await acionar(caixa(page, nome), hasTouch)
    await expect(caixa(page, nome)).toBeChecked()
  }
}

test.describe('W4 (Pedidos) e W15, pelo professor', () => {
  test('carregando; "Nenhum pedido esperando" com o passo para o Acesso; o erro com "Tentar de novo", e não o vazio; com dado, o nome, a hora e a marca; os pedidos novos chegam sozinhos, anunciados, sem tirar o foco nem a marcação; a turma que sai do alcance', async ({
    page,
    hasTouch,
  }) => {
    test.setTimeout(240_000)
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    // A leitura dos pedidos, segurada na primeira vez (o carregando) e recusada quando o teste pede (o erro).
    const segurada = portao()
    let falhar = false
    await page.route(ehALeitura, async (rota: Route) => {
      await segurada.aberta
      if (falhar) return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
      return rota.fallback()
    })
    // O relógio da aba é simulado: o teste passa os 15 s sem esperar, e o servidor continua no tempo real.
    await page.clock.install()
    await abrirATurma(page, cenario, hasTouch)

    // Carregando.
    await expect(secao(page).getByRole('status').filter({ hasText: 'Carregando os pedidos…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(vazio(page)).toHaveCount(0)
    segurada.abrir()

    // Vazio: o texto manda conferir o acesso dos alunos, que está logo acima, e não leva botão: o "Convidar alunos" é o único
    // botão cheio da aba (docs/interface.md, R4). Sem "Atualizar": a lista do professor se atualiza sozinha, e a tela diz isso.
    await expect(vazio(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secao(page)).toContainText(TEXTO_DA_ATUALIZACAO_SOZINHA)
    await expect(secao(page).getByRole('button')).toHaveCount(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    const tituloDoAcesso = principal(page).getByRole('heading', { name: 'Acesso dos alunos' })
    await expect(regiaoViva(page)).toHaveText('')

    // Erro: a releitura cai com a lista ainda vazia, e a tela não afirma "Nenhum pedido esperando".
    falhar = true
    await passarOIntervalo(page)
    await expect(secao(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(vazio(page)).toHaveCount(0)
    await expect(secao(page).getByRole('button')).toHaveText(['Tentar de novo'])
    falhar = false
    await tocar(secao(page), 'Tentar de novo', hasTouch)
    await expect(vazio(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // Com dado: dois pedidos chegam, e a lista os traz sozinha, 15 s depois. O foco, que o teste deixou no título do
    // acesso, não sai de lá, e a região viva diz quantos chegaram.
    await tituloDoAcesso.focus()
    const [ana, bruno, carla] = nomesDeTeste(3)
    if (ana === undefined || bruno === undefined || carla === undefined) throw new Error('faltou nome de teste')
    await criarPedidosNoBanco(professora.escolaId, turma.turmaId, [{ ...ana, teveMatriculaErrada: true }, bruno])
    const leitura = page.waitForResponse(
      async (resposta) => {
        if (!ehUmaLeitura(resposta.request()) || !resposta.ok()) return false
        return ((await resposta.json()) as PedidosDaTurmaResponse).itens.length === 2
      },
      { timeout: PRAZO_DA_ENTRADA_MS },
    )
    await passarOIntervalo(page)
    const { itens } = (await (await leitura).json()) as PedidosDaTurmaResponse
    await expect(linhas(page)).toHaveCount(2, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(regiaoViva(page)).toHaveText('2 pedidos novos na lista.')
    await expect(tituloDoAcesso).toBeFocused()
    await expect(secao(page)).toContainText('2 pedidos esperando a decisão')
    const [daAna, doBruno] = itens
    if (daAna === undefined || doBruno === undefined) throw new Error('a leitura não trouxe os dois pedidos')
    // O nome, a hora e, só no pedido que a teve, a marca da tentativa com matrícula errada, sem número nem hora dela.
    await expect(linhas(page).nth(0)).toHaveText(`${ana.nome}Pediu em ${await dataNaTela(page, daAna.solicitadaEm)}${TEXTO_DA_MATRICULA_ERRADA}`)
    await expect(linhas(page).nth(1)).toHaveText(`${bruno.nome}Pediu em ${await dataNaTela(page, doBruno.solicitadaEm)}`)
    // A matrícula não aparece em lugar nenhum da tela do professor.
    for (const { matricula } of [ana, bruno]) await expect(page.locator('body')).not.toContainText(matricula)
    await expect(secao(page)).toContainText(TEXTO_DE_COMO_DECIDIR)
    await expect(secao(page).getByRole('button')).toHaveCount(0)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // A professora marca o segundo pedido, e chega um terceiro: a marcação e o foco continuam no mesmo pedido, e o novo
    // é anunciado sem levar o foco.
    await caixa(page, bruno.nome).focus()
    await page.keyboard.press('Space')
    await expect(caixa(page, bruno.nome)).toBeChecked()
    await expect(secao(page).getByRole('button')).toHaveText(['Aprovar 1 pedido', 'Recusar 1 pedido'])
    await criarPedidosNoBanco(professora.escolaId, turma.turmaId, [carla])
    await passarOIntervalo(page)
    await expect(linhas(page)).toHaveCount(3, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(regiaoViva(page)).toHaveText('1 pedido novo na lista.')
    await expect(caixa(page, bruno.nome)).toBeChecked()
    await expect(caixa(page, bruno.nome)).toBeFocused()
    await expect(caixa(page, ana.nome)).not.toBeChecked()
    await expect(caixa(page, carla.nome)).not.toBeChecked()
    await expect(secao(page).getByRole('button')).toHaveText(['Aprovar 1 pedido', 'Recusar 1 pedido'])

    // A releitura que cai com a lista na tela deixa a lista e a marcação, com o erro por cima.
    falhar = true
    await passarOIntervalo(page)
    await expect(secao(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(linhas(page)).toHaveCount(3)
    await expect(caixa(page, bruno.nome)).toBeChecked()
    falhar = false
    await tocar(secao(page), 'Tentar de novo', hasTouch)
    await expect(secao(page).getByRole('alert')).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })

    // A coordenação encerra o vínculo com a tela aberta: a leitura seguinte deixa de achar a turma, e a página inteira
    // passa a dizer isso, com um aviso só, o foco nele, e nenhum nome de aluno na tela.
    await encerrarVinculosNoBanco(professora.escolaId, turma.turmaId, professora.usuarioId)
    await passarOIntervalo(page)
    const aviso = principal(page).getByRole('status').filter({ hasText: 'Esta turma não está disponível' })
    await expect(aviso).toHaveText(TEXTO_DA_TURMA_INDISPONIVEL, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(aviso).toBeFocused()
    await expect(principal(page).getByRole('heading', { name: 'Pedidos de nome' })).toHaveCount(0)
    await expect(page).toHaveTitle('Turma · Turmma')
    for (const { nome } of [ana, bruno, carla]) await expect(page.locator('body')).not.toContainText(nome)
  })
})

test.describe('W4 (Pedidos) e W6, pela coordenação', () => {
  test('nenhuma leitura sem o clique em "Atualizar", nem em 60 s; a leitura manda a finalidade e fica na auditoria; o vazio próprio, sem botão; o erro; aprovar avisa da auditoria; a falha tira a lista da tela; recusar devolve o nome; a turma que sai do ano', async ({
    page,
    hasTouch,
  }) => {
    test.setTimeout(300_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId)
    const turma = estrutura.turmas[0]
    if (turma === undefined) throw new Error('estrutura sem turma')
    const [livre] = nomesDeTeste(1, 'Livre')
    if (livre === undefined) throw new Error('faltou nome de teste')
    await porNaListaDaTurma(coordenadora.escolaId, turma.id, [livre])
    const leituras: string[] = []
    page.on('request', (pedido) => {
      if (ehUmaLeitura(pedido)) leituras.push(new URL(pedido.url()).search)
    })
    await page.clock.install()
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await abrirEstrutura(page, hasTouch)
    await acionar(principal(page).getByRole('link', { name: `Lista de nomes da turma ${turma.nome}` }), hasTouch)
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${turma.nome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // Antes do clique: a seção diz o que fazer e por quê, e nada foi lido, nem com a aba à vista por um minuto.
    await expect(secao(page)).toContainText(TEXTO_ANTES_DA_LEITURA, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secao(page)).toContainText(TEXTO_DA_AUDITORIA_DA_LEITURA)
    await expect(secao(page)).not.toContainText(TEXTO_DA_ATUALIZACAO_SOZINHA)
    const atualizar = secao(page).getByRole('button', { name: 'Atualizar os pedidos' })
    await expect(secao(page).getByRole('button')).toHaveCount(1)
    await alvoDeToque(atualizar, 'Atualizar')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    for (let volta = 0; volta < 4; volta++) await page.clock.fastForward(INTERVALO_MS)
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(secao(page)).toContainText(TEXTO_ANTES_DA_LEITURA)
    expect(leituras).toEqual([])
    expect(await leiturasDePedidosNaAuditoria(coordenadora.escolaId, turma.id)).toEqual([])

    // O erro: a leitura cai (a rota responde no lugar da API, e nada chega à auditoria), e a tela diz o que fazer.
    const segurada = portao()
    let falhar = true
    await page.route(ehALeitura, async (rota: Route) => {
      if (falhar) return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
      await segurada.aberta
      return rota.fallback()
    })
    await acionar(atualizar, hasTouch)
    await expect(secao(page).getByRole('alert')).toHaveText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(await leiturasDePedidosNaAuditoria(coordenadora.escolaId, turma.id)).toEqual([])

    // Carregando, e então o vazio da coordenação: sem botão, porque ela não alcança o acesso da turma.
    falhar = false
    leituras.length = 0
    await tocar(secao(page), 'Tentar de novo', hasTouch)
    await expect(secao(page).getByRole('status').filter({ hasText: 'Carregando os pedidos…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secao(page).getByRole('status').filter({ hasText: 'Atualizando…' })).toBeVisible()
    segurada.abrir()
    await expect(vazio(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secao(page)).toContainText('Os pedidos chegam quando o professor da turma gerar o acesso e os alunos pedirem o nome.')
    await expect(secao(page).getByRole('button')).toHaveText(['Atualizar os pedidos'])
    // A leitura levou a finalidade, e ficou na auditoria em nome dela: uma leitura, um registro.
    expect(leituras).toEqual(['?limite=100&finalidade=conferencia_de_cadastro'])
    const umaLeitura = { autor: coordenadora.usuarioId, finalidade: 'conferencia_de_cadastro' }
    expect(await leiturasDePedidosNaAuditoria(coordenadora.escolaId, turma.id)).toEqual([umaLeitura])
    expect(await violacoesGraves(page)).toEqual([])

    // Chegam três pedidos. A lista não se atualiza sozinha: só no clique.
    const [ana, bruno, carla] = nomesDeTeste(3)
    if (ana === undefined || bruno === undefined || carla === undefined) throw new Error('faltou nome de teste')
    await criarPedidosNoBanco(coordenadora.escolaId, turma.id, [ana, { ...bruno, teveMatriculaErrada: true }, carla])
    for (let volta = 0; volta < 4; volta++) await page.clock.fastForward(INTERVALO_MS)
    await expect(vazio(page)).toBeVisible()
    expect(leituras).toHaveLength(1)
    // Dois cliques no mesmo instante em "Atualizar": uma leitura só, e um registro só na auditoria.
    await doisCliquesNoMesmoInstante(atualizar)
    await expect(linhas(page)).toHaveCount(3, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(regiaoViva(page)).toHaveText('3 pedidos novos na lista.')
    expect(await leiturasDePedidosNaAuditoria(coordenadora.escolaId, turma.id)).toEqual([umaLeitura, umaLeitura])
    expect(leituras).toHaveLength(2)

    // Aprovar dois: o diálogo diz a turma, os nomes, a marca, o efeito e, para a coordenação, que fica na auditoria.
    await marcar(page, [ana.nome, bruno.nome], hasTouch)
    const aprovar = secao(page).getByRole('button', { name: 'Aprovar 2 pedidos' })
    expect(await aprovar.evaluate((botao) => getComputedStyle(botao).backgroundColor)).toBe(COR_DO_OFICIAL)
    await acionar(aprovar, hasTouch)
    await expect(page.getByRole('dialog', { name: 'Aprovar pedidos' })).toBeVisible()
    await expect(oQueVaiSerDecidido(page, `Você vai aprovar 2 pedidos da turma ${turma.nome}.`)).toBeFocused()
    await expect(pedidosDoDialogo(page)).toHaveText([ana.nome, `${bruno.nome}${TEXTO_DA_MATRICULA_ERRADA}`])
    await expect(noDialogo(page)).toContainText(EFEITO_DE_APROVAR)
    await expect(noDialogo(page)).toContainText(TEXTO_DA_AUDITORIA_DA_DECISAO)
    await conferirDialogo(page)
    await tocar(noDialogo(page), 'Aprovar 2 pedidos', hasTouch)
    await expect(tituloDoResultado(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(resultados(page)).toHaveText([`${ana.nome}${APROVADO}`, `${bruno.nome}${APROVADO}`])
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(tituloDaSecao(page)).toBeFocused()
    // Os aprovados saíram da lista dos pedidos sem leitura nova, e a lista de nomes da turma os conta, sem o nome.
    await expect(linhas(page)).toHaveText([new RegExp(`^${carla.nome}`)])
    expect(leituras).toHaveLength(2)
    expect(await alunosDaTurmaNoBanco(coordenadora.escolaId, turma.id)).toBe(2)
    const nomesDaTurma = principal(page).getByRole('region', { name: 'Nomes da turma' })
    await expect(nomesDaTurma).toContainText(`Aprovados nesta turma: 2. ${DOS_APROVADOS}`, {
      timeout: PRAZO_DA_ENTRADA_MS,
    })
    await expect(linhasDaTabela(nomesDaTurma)).toHaveCount(2)
    await expect(nomesDaTurma).not.toContainText('Aluno aprovado')
    for (const { nome } of [ana, bruno]) await expect(nomesDaTurma).not.toContainText(nome)

    // A decisão que falha: um erro no meio do lote não diz o que foi decidido. A lista sai da tela, sem leitura nova, e
    // o diálogo só deixa fechar, dizendo o que fazer.
    await page.route(ehADecisao, (rota: Route) => rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }))
    await marcar(page, [carla.nome], hasTouch)
    const recusar = secao(page).getByRole('button', { name: 'Recusar 1 pedido' })
    expect(await recusar.evaluate((botao) => getComputedStyle(botao).color)).toBe(COR_DO_PERIGO)
    await acionar(recusar, hasTouch)
    await expect(noDialogo(page)).toContainText(TEXTO_DA_AUDITORIA_DA_DECISAO)
    await tocar(noDialogo(page), 'Recusar 1 pedido', hasTouch)
    const falha = noDialogo(page).getByRole('alert')
    await expect(falha).toHaveText(`${MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO} ${DEPOIS_DA_FALHA_DA_COORDENACAO}`, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(falha).toBeFocused()
    await expect(noDialogo(page).getByRole('button')).toHaveText(['Fechar'])
    await expect(noDialogo(page)).not.toContainText(carla.nome)
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(tituloDaSecao(page)).toBeFocused()
    await expect(secao(page)).toContainText(TEXTO_ANTES_DA_LEITURA)
    await expect(secao(page)).not.toContainText(carla.nome)
    expect(leituras).toHaveLength(2)
    await page.unroute(ehADecisao)

    // Ela atualiza, e o pedido continua lá, desmarcado: a marcação de antes da falha saiu com a lista, e não há decisão
    // a um clique.
    await acionar(atualizar, hasTouch)
    await expect(linhas(page)).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(caixa(page, carla.nome)).not.toBeChecked()
    await expect(secao(page).getByRole('button')).toHaveText(['Atualizar os pedidos'])
    expect(leituras).toHaveLength(3)

    // Recusa de novo, e desta vez a decisão chega ao servidor e é a resposta que se perde. O diálogo diz que o nome volta
    // à lista; a tela não sabe o que foi decidido, mas a lista de nomes da turma é relida, e o nome está livre.
    await page.route(ehADecisao, async (rota: Route) => {
      await rota.fetch()
      return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
    })
    await marcar(page, [carla.nome], hasTouch)
    await tocar(secao(page), 'Recusar 1 pedido', hasTouch)
    await expect(page.getByRole('dialog', { name: 'Recusar pedidos' })).toBeVisible()
    await expect(oQueVaiSerDecidido(page, `Você vai recusar 1 pedido da turma ${turma.nome}.`)).toBeFocused()
    await expect(noDialogo(page)).toContainText(EFEITO_DE_RECUSAR)
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    await tocar(noDialogo(page), 'Recusar 1 pedido', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(linhasDaTabela(nomesDaTurma).filter({ hasText: carla.nome })).toContainText('Livre: esperando o aluno pedir o nome', { timeout: PRAZO_DA_ENTRADA_MS })
    await page.unroute(ehADecisao)
    expect(await alunosDaTurmaNoBanco(coordenadora.escolaId, turma.id)).toBe(2)
    expect(leituras).toHaveLength(3)
    await acionar(atualizar, hasTouch)
    await expect(vazio(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    expect(leituras).toHaveLength(4)
    expect(await leiturasDePedidosNaAuditoria(coordenadora.escolaId, turma.id)).toHaveLength(4)

    // O ano letivo é encerrado com a tela aberta: o "Atualizar" deixa de achar a turma, e a página diz isso, com o foco
    // no aviso, e não no botão que saiu.
    await encerrarAnoNoBanco(coordenadora.escolaId)
    await acionar(atualizar, hasTouch)
    const aviso = principal(page).getByRole('status').filter({ hasText: 'Esta turma não está no ano letivo em curso' })
    await expect(aviso).toHaveText(TEXTO_DA_TURMA_FORA_DO_ANO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(aviso).toBeFocused()
    await expect(page).toHaveTitle('Turma · Turmma')
    await expect(principal(page).getByRole('heading', { name: 'Pedidos de nome' })).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(carla.nome)
  })
})

test.describe('W6: a decisão do professor', () => {
  test('o 41º pedido não é marcável, com o texto do limite; não existe "aprovar todos"; "Aprovar 40" revisa a turma, os nomes, a marca e o efeito; dois cliques em confirmar mandam um pedido só; cada pedido termina com o resultado em texto; "Recusar" confirma e diz que o nome volta', async ({
    page,
    hasTouch,
  }) => {
    test.setTimeout(300_000)
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    const nomes = nomesDeTeste(41)
    const pedidos = await criarPedidosNoBanco(
      professora.escolaId,
      turma.turmaId,
      nomes.map((nome, indice) => ({ ...nome, teveMatriculaErrada: indice === 0 })),
    )
    const pedido = (indice: number): PedidoDeTeste => {
      const achado = pedidos[indice]
      if (achado === undefined) throw new Error('faltou pedido de teste')
      return achado
    }
    // A leitura como o teste a quer: com `proxima` (há mais pedidos que os de uma leitura), ou parada no que a tela já
    // tem (para o que outra pessoa decide com o diálogo aberto não sair dele antes de confirmar).
    let haMais = true
    let parar = false
    let ultima = JSON.stringify({ itens: [] })
    let noAr = 0
    await page.route(ehALeitura, async (rota: Route) => {
      if (parar) return rota.fulfill({ status: 200, contentType: 'application/json', body: ultima })
      noAr++
      try {
        const resposta = await rota.fetch()
        const corpo = (await resposta.json()) as PedidosDaTurmaResponse
        ultima = JSON.stringify(haMais ? { ...corpo, proxima: pedido(40).id } : corpo)
        await rota.fulfill({ response: resposta, body: ultima })
      } finally {
        noAr--
      }
    })
    let decisoes = 0
    page.on('request', (enviado) => {
      if (enviado.method() === 'POST' && ehADecisao(new URL(enviado.url()))) decisoes++
    })
    await page.clock.install()
    await abrirATurma(page, cenario, hasTouch)
    await expect(linhas(page)).toHaveCount(41, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secao(page)).toContainText('41 pedidos esperando a decisão')

    // Há mais pedidos do que os de uma leitura: a tela diz. Sem o `proxima`, não diz.
    await expect(secao(page)).toContainText(TEXTO_DE_QUE_HA_MAIS)
    haMais = false
    await passarOIntervalo(page)
    await expect(secao(page)).not.toContainText(TEXTO_DE_QUE_HA_MAIS, { timeout: PRAZO_DA_ENTRADA_MS })

    // Não existe "aprovar todos", nem "marcar todos": só a caixa de cada pedido.
    await expect(secao(page)).toContainText(TEXTO_DE_COMO_DECIDIR)
    await expect(secao(page).getByRole('button')).toHaveCount(0)
    await expect(secao(page).getByRole('checkbox')).toHaveCount(41)
    await expect(secao(page).getByRole('checkbox', { name: /todos/i })).toHaveCount(0)

    // Quarenta marcados: o 41º fica desligado, com o texto do limite ligado a ele.
    for (let indice = 0; indice < 40; indice++) await secao(page).getByRole('checkbox').nth(indice).check()
    const aUltima = caixa(page, pedido(40).nome)
    await expect(aUltima).toBeDisabled()
    await expect(aUltima).not.toBeChecked()
    await expect(secao(page)).toContainText(TEXTO_DO_LIMITE)
    await expect(aUltima).toHaveAccessibleDescription(TEXTO_DO_LIMITE)
    await expect(secao(page).getByRole('button')).toHaveText(['Aprovar 40 pedidos', 'Recusar 40 pedidos'])
    // Desmarcar um abre lugar: o 41º volta a poder ser marcado, e o texto do limite sai.
    await caixa(page, pedido(39).nome).uncheck()
    await expect(aUltima).toBeEnabled()
    await expect(secao(page)).not.toContainText(TEXTO_DO_LIMITE)
    await caixa(page, pedido(39).nome).check()
    await expect(aUltima).toBeDisabled()
    expect(await violacoesGraves(page)).toEqual([])

    // "Aprovar 40": o preto da decisão oficial, na seção e no diálogo, que revisa a turma, cada nome e o efeito.
    const aprovar = secao(page).getByRole('button', { name: 'Aprovar 40 pedidos' })
    expect(await aprovar.evaluate((botao) => getComputedStyle(botao).backgroundColor)).toBe(COR_DO_OFICIAL)
    await acionar(aprovar, hasTouch)
    await expect(page.getByRole('dialog', { name: 'Aprovar pedidos' })).toBeVisible()
    await expect(oQueVaiSerDecidido(page, `Você vai aprovar 40 pedidos da turma ${turma.turmaNome}.`)).toBeFocused()
    await expect(pedidosDoDialogo(page)).toHaveCount(40)
    // A marca da tentativa com matrícula errada, também no diálogo, só no pedido que a teve.
    await expect(pedidosDoDialogo(page).nth(0)).toHaveText(`${pedido(0).nome}${TEXTO_DA_MATRICULA_ERRADA}`)
    await expect(pedidosDoDialogo(page).nth(1)).toHaveText(pedido(1).nome)
    await expect(noDialogo(page)).toContainText(EFEITO_DE_APROVAR)
    // O aviso de auditoria é da coordenação: o professor não o vê.
    await expect(noDialogo(page)).not.toContainText('auditoria')
    const confirmar = noDialogo(page).getByRole('button', { name: 'Aprovar 40 pedidos' })
    expect(await confirmar.evaluate((botao) => getComputedStyle(botao).backgroundColor)).toBe(COR_DO_OFICIAL)
    await conferirDialogo(page)

    // Com o diálogo aberto, outra pessoa recusa o segundo pedido, e o terceiro deixa de existir. A lista da tela fica
    // parada no que tinha: o diálogo ainda os mostra, e é a resposta da decisão que diz o que houve com cada um.
    parar = true
    await expect.poll(() => noAr).toBe(0)
    await recusarPedidoNoBanco(professora.escolaId, pedido(1))
    await apagarPedidoNoBanco(professora.escolaId, pedido(2))
    await doisCliquesNoMesmoInstante(confirmar)
    // Com a decisão no ar, o botão diz isso e fica desligado, e o leitor de tela ouve o mesmo.
    await expect(noDialogo(page).getByRole('button', { name: 'Aprovando…' })).toBeDisabled()
    await expect(noDialogo(page).getByRole('status').filter({ hasText: 'Aprovando…' })).toHaveCount(1)
    await expect(tituloDoResultado(page)).toBeFocused({ timeout: 60_000 })
    expect(decisoes).toBe(1)
    await expect(resultados(page)).toHaveCount(40)
    await expect(resultados(page).nth(0)).toHaveText(`${pedido(0).nome}${APROVADO}`)
    await expect(resultados(page).nth(1)).toHaveText(`${pedido(1).nome}${JA_DECIDIDO}`)
    await expect(resultados(page).nth(2)).toHaveText(`${pedido(2).nome}${NAO_DISPONIVEL}`)
    await expect(resultados(page).filter({ hasText: APROVADO })).toHaveCount(38)
    // O que foi decidido agora em `ok`; o que não foi, no tom de atenção, para não se perder entre os outros.
    const corDoTexto = (linha: Locator) => linha.locator('span').nth(1).evaluate((texto) => getComputedStyle(texto).color)
    expect(await corDoTexto(resultados(page).nth(0))).toBe(COR_DO_OK)
    expect(await corDoTexto(resultados(page).nth(1))).toBe(COR_DA_ATENCAO)
    expect(await corDoTexto(resultados(page).nth(2))).toBe(COR_DA_ATENCAO)
    await expect(noDialogo(page).getByRole('button')).toHaveText(['Fechar'])
    await conferirDialogo(page)
    // Um aluno por pedido aprovado, e nenhum em dobro: 38.
    expect(await alunosDaTurmaNoBanco(professora.escolaId, turma.turmaId)).toBe(38)

    // Fechado, o foco vai ao título da seção (os botões saíram com a marcação), e a lista fica com o pedido que sobrou.
    parar = false
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(tituloDaSecao(page)).toBeFocused()
    await expect(linhas(page)).toHaveText([new RegExp(`^${pedido(40).nome}`)], { timeout: PRAZO_DA_ENTRADA_MS })

    // "Recusar": o `perigo`, texto em vermelho na seção e cheio só na confirmação, que diz que o nome volta à lista.
    await marcar(page, [pedido(40).nome], hasTouch)
    const recusar = secao(page).getByRole('button', { name: 'Recusar 1 pedido' })
    expect(await recusar.evaluate((botao) => getComputedStyle(botao).color)).toBe(COR_DO_PERIGO)
    await acionar(recusar, hasTouch)
    await expect(page.getByRole('dialog', { name: 'Recusar pedidos' })).toBeVisible()
    await expect(oQueVaiSerDecidido(page, `Você vai recusar 1 pedido da turma ${turma.turmaNome}.`)).toBeFocused()
    await expect(pedidosDoDialogo(page)).toHaveText([pedido(40).nome])
    await expect(noDialogo(page)).toContainText(EFEITO_DE_RECUSAR)
    const confirmarRecusa = noDialogo(page).getByRole('button', { name: 'Recusar 1 pedido' })
    expect(await confirmarRecusa.evaluate((botao) => getComputedStyle(botao).backgroundColor)).toBe(COR_DO_PERIGO_CHEIO)
    // Nada foi recusado antes de confirmar.
    expect(decisoes).toBe(1)
    await acionar(confirmarRecusa, hasTouch)
    await expect(resultados(page)).toHaveText([`${pedido(40).nome}${RECUSADO}`], { timeout: PRAZO_DA_ENTRADA_MS })
    expect(decisoes).toBe(2)
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(vazio(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const estados = await estadosDaListaNoBanco(professora.escolaId, turma.turmaId)
    expect(estados.find(({ nome }) => nome === pedido(40).nome)?.estado).toBe('livre')
    expect(estados.filter(({ estado }) => estado === 'aprovado')).toHaveLength(38)
    expect(await alunosDaTurmaNoBanco(professora.escolaId, turma.turmaId)).toBe(38)
  })
})

test.describe('W12 (Pedidos): a 360 px e só com teclado', () => {
  test('sem rolagem horizontal, também no diálogo, com nome comprido; cartões e alvos de 44 px; marcar e decidir só com Tab, Espaço e Enter, com o foco preso no diálogo e devolvido', async ({
    page,
    hasTouch,
  }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 360, height: 800 })
    // O nome da turma com os 40 caracteres que a escola pode dar, e um nome de aluno comprido, os dois sem espaço.
    const cenario = await criarProfessoraComTurma(`T${'a'.repeat(31)}${crypto.randomUUID().slice(0, 8)}`)
    const { professora, turma } = cenario
    expect(turma.turmaNome).toHaveLength(40)
    const [ana, bruno, carla] = nomesDeTeste(3)
    if (ana === undefined || bruno === undefined || carla === undefined) throw new Error('faltou nome de teste')
    const comprido = { nome: `${'Ab'.repeat(40)}${crypto.randomUUID().slice(0, 8)}`, matricula: bruno.matricula }
    await criarPedidosNoBanco(professora.escolaId, turma.turmaId, [{ ...ana, teveMatriculaErrada: true }, comprido, carla])
    await abrirATurma(page, cenario, hasTouch)
    await expect(linhas(page)).toHaveCount(3, { timeout: PRAZO_DA_ENTRADA_MS })

    // Cartões, um embaixo do outro, cada um com 44 px ou mais de altura e a largura da tela, sem rolagem horizontal.
    const caixas = await Promise.all([0, 1, 2].map((indice) => linhas(page).nth(indice).locator('label').boundingBox()))
    for (const caixaDoCartao of caixas) {
      expect(caixaDoCartao).not.toBeNull()
      expect(caixaDoCartao?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect((caixaDoCartao?.x ?? 0) + (caixaDoCartao?.width ?? 361)).toBeLessThanOrEqual(360)
    }
    expect((caixas[1]?.y ?? 0) >= (caixas[0]?.y ?? 0) + (caixas[0]?.height ?? 0)).toBe(true)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Marcar só com o teclado: Tab até a caixa, Espaço marca; os botões da decisão aparecem depois da lista.
    await tituloDaSecao(page).focus()
    await tabAte(page, caixa(page, ana.nome))
    await page.keyboard.press('Space')
    await expect(caixa(page, ana.nome)).toBeChecked()
    await page.keyboard.press('Tab')
    await expect(caixa(page, comprido.nome)).toBeFocused()
    await page.keyboard.press('Space')
    await expect(caixa(page, comprido.nome)).toBeChecked()
    const aprovar = secao(page).getByRole('button', { name: 'Aprovar 2 pedidos' })
    const recusar = secao(page).getByRole('button', { name: 'Recusar 2 pedidos' })
    await alvoDeToque(aprovar, 'Aprovar 2 pedidos')
    await alvoDeToque(recusar, 'Recusar 2 pedidos')
    expect(await larguraExcedente(page)).toBe(0)

    // O Esc fecha sem decidir, e o foco volta ao botão que abriu o diálogo.
    await tabAte(page, recusar)
    await page.keyboard.press('Enter')
    await expect(oQueVaiSerDecidido(page, `Você vai recusar 2 pedidos da turma ${turma.turmaNome}.`)).toBeFocused()
    await conferirDialogo(page)
    await page.keyboard.press('Escape')
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(recusar).toBeFocused()
    await expect(linhas(page)).toHaveCount(3)
    await expect(caixa(page, ana.nome)).toBeChecked()

    // Aprovar só com o teclado: Enter abre, o foco começa no texto e não sai do diálogo; Enter confirma.
    await page.keyboard.press('Shift+Tab')
    await expect(aprovar).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(oQueVaiSerDecidido(page, `Você vai aprovar 2 pedidos da turma ${turma.turmaNome}.`)).toBeFocused()
    await conferirDialogo(page)
    for (const botao of ['Aprovar 2 pedidos', 'Cancelar']) await alvoDeToque(noDialogo(page).getByRole('button', { name: botao, exact: true }), botao)
    for (let tecla = 0; tecla < 6; tecla++) {
      await page.keyboard.press('Tab')
      expect(await focoDentroDoDialogo(page)).toBe(true)
    }
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Aprovar 2 pedidos' }))
    await page.keyboard.press('Enter')
    await expect(tituloDoResultado(page)).toBeFocused({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(resultados(page)).toHaveText([`${ana.nome}${APROVADO}`, `${comprido.nome}${APROVADO}`])
    await conferirDialogo(page)
    await tabAte(page, noDialogo(page).getByRole('button', { name: 'Fechar' }))
    await alvoDeToque(noDialogo(page).getByRole('button', { name: 'Fechar' }), 'Fechar')
    await page.keyboard.press('Enter')
    await expect(dialogosDaTela(page)).toHaveCount(0)
    // O botão que abriu saiu com a marcação: o foco vai ao título da seção, e não ao `body`.
    await expect(tituloDaSecao(page)).toBeFocused()
    await expect(linhas(page)).toHaveText([new RegExp(`^${carla.nome}`)], { timeout: PRAZO_DA_ENTRADA_MS })
    expect(await alunosDaTurmaNoBanco(professora.escolaId, turma.turmaId)).toBe(2)
    expect(await larguraExcedente(page)).toBe(0)
  })
})

test.describe('recomeço da tela dos pedidos', () => {
  test('lista recarregada com o diálogo aberto: o pedido que outra pessoa decidiu sai do diálogo; falha com o diálogo aberto: reabrindo, o aviso e o foco da tentativa anterior saem; mesma entrada: confirmar de novo o mesmo lote mostra "Já decidido por outra pessoa", sem aluno em dobro', async ({
    page,
    hasTouch,
  }) => {
    test.setTimeout(240_000)
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    const [ana, bruno, carla] = nomesDeTeste(3)
    if (ana === undefined || bruno === undefined || carla === undefined) throw new Error('faltou nome de teste')
    const [, , pedidoDaCarla] = await criarPedidosNoBanco(professora.escolaId, turma.turmaId, [ana, bruno, carla])
    if (pedidoDaCarla === undefined) throw new Error('faltou pedido de teste')
    await page.clock.install()
    await abrirATurma(page, cenario, hasTouch)
    await expect(linhas(page)).toHaveCount(3, { timeout: PRAZO_DA_ENTRADA_MS })
    // A primeira leitura não anuncia pedido novo: a região viva fala só do que chega depois.
    await expect(regiaoViva(page)).toHaveText('')
    await marcar(page, [ana.nome, bruno.nome, carla.nome], hasTouch)
    await tocar(secao(page), 'Aprovar 3 pedidos', hasTouch)
    await expect(pedidosDoDialogo(page)).toHaveText([ana.nome, bruno.nome, carla.nome])

    // Lista recarregada com o diálogo aberto: a coordenação recusa o pedido da Carla, e a atualização o tira da lista,
    // da marcação e do diálogo, que diz que ele saiu. O que vai no envio são os dois que continuam.
    await recusarPedidoNoBanco(professora.escolaId, pedidoDaCarla)
    await passarOIntervalo(page)
    await expect(pedidosDoDialogo(page)).toHaveText([ana.nome, bruno.nome], { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(noDialogo(page).getByRole('status').filter({ hasText: 'saiu desta decisão' })).toHaveText('1 pedido saiu desta decisão: outra pessoa decidiu antes.')
    await expect(oQueVaiSerDecidido(page, `Você vai aprovar 2 pedidos da turma ${turma.turmaNome}.`)).toBeVisible()
    await expect(focoDentroDoDialogo(page)).resolves.toBe(true)

    // A decisão chega ao servidor, que aprova os dois, e a resposta se perde no caminho; a releitura também cai. A tela
    // não sabe o que foi decidido: diz isso, com o foco no aviso, e a lista continua como estava.
    let perderAResposta = true
    const corpos: unknown[] = []
    await page.route(ehADecisao, async (rota: Route) => {
      corpos.push(rota.request().postDataJSON())
      if (!perderAResposta) return rota.fallback()
      await rota.fetch()
      return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
    })
    let derrubarALeitura = true
    await page.route(ehALeitura, (rota: Route) => (derrubarALeitura ? rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL }) : rota.fallback()))
    await tocar(noDialogo(page), 'Aprovar 2 pedidos', hasTouch)
    const falha = noDialogo(page).getByRole('alert')
    await expect(falha).toHaveText(`${MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO} ${DEPOIS_DA_FALHA_DO_PROFESSOR}`, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(falha).toBeFocused()
    expect(await alunosDaTurmaNoBanco(professora.escolaId, turma.turmaId)).toBe(2)

    // Falha com o diálogo aberto: fechar e abrir de novo é outra abertura, sem o aviso e com o foco no texto.
    await tocar(noDialogo(page), 'Cancelar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await tocar(secao(page), 'Aprovar 2 pedidos', hasTouch)
    await expect(noDialogo(page).getByRole('alert')).toHaveCount(0)
    await expect(oQueVaiSerDecidido(page, `Você vai aprovar 2 pedidos da turma ${turma.turmaNome}.`)).toBeFocused()

    // Mesma entrada: o mesmo lote confirmado de novo. O servidor diz que os dois já estavam decididos, e nenhum aluno
    // nasce em dobro.
    perderAResposta = false
    await tocar(noDialogo(page), 'Aprovar 2 pedidos', hasTouch)
    await expect(resultados(page)).toHaveText([`${ana.nome}${JA_DECIDIDO}`, `${bruno.nome}${JA_DECIDIDO}`], { timeout: PRAZO_DA_ENTRADA_MS })
    expect(corpos).toHaveLength(2)
    expect(corpos[1]).toEqual(corpos[0])
    expect(await alunosDaTurmaNoBanco(professora.escolaId, turma.turmaId)).toBe(2)
    derrubarALeitura = false
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(tituloDaSecao(page)).toBeFocused()
    // Os dois saíram da lista com a resposta, e a leitura seguinte, que já passa, confirma: nenhum pedido esperando.
    await expect(linhas(page)).toHaveCount(0)
    await passarOIntervalo(page)
    await expect(vazio(page)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // O único pedido do diálogo sai da lista com ele aberto: não há o que enviar, a tela diz por quê, com o foco no
    // texto, e só deixa fechar.
    const [dani] = nomesDeTeste(1, 'Dani')
    if (dani === undefined) throw new Error('faltou nome de teste')
    const [pedidoDaDani] = await criarPedidosNoBanco(professora.escolaId, turma.turmaId, [dani])
    if (pedidoDaDani === undefined) throw new Error('faltou pedido de teste')
    await passarOIntervalo(page)
    await expect(linhas(page)).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
    await marcar(page, [dani.nome], hasTouch)
    await tocar(secao(page), 'Recusar 1 pedido', hasTouch)
    await expect(oQueVaiSerDecidido(page, `Você vai recusar 1 pedido da turma ${turma.turmaNome}.`)).toBeFocused()
    await recusarPedidoNoBanco(professora.escolaId, pedidoDaDani)
    await passarOIntervalo(page)
    const todosSairam = noDialogo(page).getByText('Os pedidos que você marcou não estão mais esperando: outra pessoa decidiu antes. Nada foi enviado.', { exact: true })
    await expect(todosSairam).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(todosSairam).toBeFocused()
    await expect(noDialogo(page).getByRole('button')).toHaveText(['Fechar'])
    await expect(noDialogo(page)).not.toContainText(dani.nome)
    await conferirDialogo(page)
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(tituloDaSecao(page)).toBeFocused()
    expect(corpos).toHaveLength(2)
  })

  test('resposta atrasada: a atualização que chega depois da decisão não traz de volta o pedido decidido; segunda pessoa: a coordenação da mesma escola entra na mesma aba, sem os pedidos nem a marcação do professor, e sem leitura nenhuma até clicar', async ({
    page,
    hasTouch,
  }) => {
    test.setTimeout(300_000)
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    const [ana, bruno] = nomesDeTeste(2)
    if (ana === undefined || bruno === undefined) throw new Error('faltou nome de teste')
    // A Ana vem depois do Bruno na lista: o pedido marcado não é o primeiro, e o diálogo precisa achá-lo pelo id.
    await criarPedidosNoBanco(professora.escolaId, turma.turmaId, [bruno, ana])
    // Uma leitura segurada, quando o teste pede: a API a responde na hora (antes da decisão), e a resposta só chega à
    // tela quando o teste abre a porta (depois da decisão).
    let segurar = false
    const fotografada = portao()
    const porta = portao()
    const entregue = portao()
    await page.route(ehALeitura, async (rota: Route) => {
      if (!segurar) return rota.fallback()
      segurar = false
      const resposta = await rota.fetch()
      fotografada.abrir()
      await porta.aberta
      // A tela descartou esta leitura quando a decisão respondeu: a resposta dela pode já não ter quem a receba.
      await rota.fulfill({ response: resposta }).catch(() => undefined)
      entregue.abrir()
    })
    await page.clock.install()
    await abrirATurma(page, cenario, hasTouch)
    await expect(linhas(page)).toHaveCount(2, { timeout: PRAZO_DA_ENTRADA_MS })
    await marcar(page, [ana.nome], hasTouch)

    // A atualização de 15 s sai, e fica no ar com os dois pedidos ainda pendentes.
    segurar = true
    await passarOIntervalo(page)
    await fotografada.aberta
    // A professora aprova a Ana, e a decisão responde antes daquela leitura.
    await tocar(secao(page), 'Aprovar 1 pedido', hasTouch)
    await tocar(noDialogo(page), 'Aprovar 1 pedido', hasTouch)
    await expect(resultados(page)).toHaveText([`${ana.nome}${APROVADO}`], { timeout: PRAZO_DA_ENTRADA_MS })
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(linhas(page)).toHaveText([new RegExp(`^${bruno.nome}`)], { timeout: PRAZO_DA_ENTRADA_MS })
    // A leitura atrasada chega agora, com a Ana ainda pendente. Ela não volta à lista: nem na hora, nem depois de dar
    // tempo de a tela se redesenhar, nem na atualização seguinte.
    porta.abrir()
    await entregue.aberta
    // A ausência não tem evento a esperar: a resposta já foi entregue, e o tempo é o de a tela redesenhar, se fosse.
    await page.waitForTimeout(2_000)
    await expect(linhas(page)).toHaveText([new RegExp(`^${bruno.nome}`)])
    await expect(lista(page)).not.toContainText(ana.nome)
    await passarOIntervalo(page)
    await expect(linhas(page)).toHaveText([new RegExp(`^${bruno.nome}`)])

    // Segunda pessoa: a professora deixa o Bruno marcado e sai. A coordenadora da mesma escola entra na mesma aba, sem
    // recarregar, e abre a mesma turma.
    await marcar(page, [bruno.nome], hasTouch)
    await abrirNavegacao(page, hasTouch)
    await acionar(lateral(page).getByRole('button', { name: 'Sair' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    const coordenadora = await criarCoordenadoraNaEscola(professora)
    const leituras: string[] = []
    page.on('request', (pedido) => {
      if (ehUmaLeitura(pedido)) leituras.push(new URL(pedido.url()).search)
    })
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await abrirEstrutura(page, hasTouch)
    await acionar(principal(page).getByRole('link', { name: `Lista de nomes da turma ${turma.turmaNome}` }), hasTouch)
    await expect(principal(page).getByRole('heading', { level: 1, name: `Turma ${turma.turmaNome}` })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    // Nada do que o professor leu ou marcou: a seção espera o clique dela, e nenhuma leitura saiu.
    await expect(secao(page)).toContainText(TEXTO_ANTES_DA_LEITURA, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secao(page).getByRole('checkbox')).toHaveCount(0)
    await expect(secao(page)).not.toContainText(bruno.nome)
    await expect(secao(page).getByRole('button')).toHaveText(['Atualizar os pedidos'])
    await page.clock.fastForward(INTERVALO_MS)
    expect(leituras).toEqual([])
    expect(await leiturasDePedidosNaAuditoria(professora.escolaId, turma.turmaId)).toEqual([])

    // No clique, a leitura é dela, com a finalidade, e o pedido vem sem a marcação do professor.
    await tocar(secao(page), 'Atualizar os pedidos', hasTouch)
    await expect(linhas(page)).toHaveText([new RegExp(`^${bruno.nome}`)], { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(caixa(page, bruno.nome)).not.toBeChecked()
    await expect(secao(page).getByRole('button')).toHaveText(['Atualizar os pedidos'])
    expect(leituras).toEqual(['?limite=100&finalidade=conferencia_de_cadastro'])
    expect(await leiturasDePedidosNaAuditoria(professora.escolaId, turma.turmaId)).toEqual([{ autor: coordenadora.usuarioId, finalidade: 'conferencia_de_cadastro' }])
  })

  test('decisão e releitura desenhadas juntas: o pedido decidido sai da marcação mesmo que a tela nunca desenhe a lista sem ele, e ao fechar o foco vai ao título da seção', async ({
    page,
    hasTouch,
  }) => {
    test.setTimeout(180_000)
    const cenario = await criarProfessoraComTurma()
    const { professora, turma } = cenario
    const [ana, bruno] = nomesDeTeste(2)
    if (ana === undefined || bruno === undefined) throw new Error('faltou nome de teste')
    await criarPedidosNoBanco(professora.escolaId, turma.turmaId, [ana, bruno])
    // A leitura parada no que a tela já tem: a releitura que a decisão pede ainda traz a Ana pendente. É o pior caso da
    // tela, e não precisa de servidor atrasado para acontecer: basta a resposta da decisão e a da releitura serem
    // desenhadas na mesma vez (correção 2026-10-03-decididos-continuam-marcados).
    let parar = false
    let ultima = ''
    // Só conta a releitura pedida pela decisão: uma de 15 s que saia antes dela não prova a ordem que o teste quer.
    let decidido = false
    const releu = portao()
    page.on('response', (resposta) => {
      if (resposta.request().method() === 'POST' && ehADecisao(new URL(resposta.url()))) decidido = true
    })
    await page.route(ehALeitura, async (rota: Route) => {
      if (parar) {
        await rota.fulfill({ status: 200, contentType: 'application/json', body: ultima })
        if (decidido) releu.abrir()
        return
      }
      const resposta = await rota.fetch()
      ultima = await resposta.text()
      return rota.fulfill({ response: resposta, body: ultima })
    })
    await page.clock.install()
    await abrirATurma(page, cenario, hasTouch)
    await expect(linhas(page)).toHaveCount(2, { timeout: PRAZO_DA_ENTRADA_MS })
    await marcar(page, [ana.nome], hasTouch)
    await tocar(secao(page), 'Aprovar 1 pedido', hasTouch)
    await expect(oQueVaiSerDecidido(page, `Você vai aprovar 1 pedido da turma ${turma.turmaNome}.`)).toBeFocused()

    // Com o relógio da aba parado, o TanStack Query não entrega nada à tela (ele agenda a entrega num `setTimeout`): a
    // decisão responde, a lista é tirada da Ana e relida, e só então a tela desenha tudo de uma vez. Foi o que a esteira
    // fez sozinha no Chromebook (run 37080632880): a lista sem a Ana nunca chegou à tela.
    parar = true
    const decidiu = page.waitForResponse((resposta) => resposta.request().method() === 'POST' && ehADecisao(new URL(resposta.url())))
    await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1_000))
    await tocar(noDialogo(page), 'Aprovar 1 pedido', hasTouch)
    await decidiu
    await releu.aberta
    await page.clock.resume()
    await expect(resultados(page)).toHaveText([`${ana.nome}${APROVADO}`], { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(tituloDoResultado(page)).toBeFocused()

    // A Ana está na lista velha, mas não marcada: na seção, o único botão é o "Fechar" do diálogo (que mora nela), sem o
    // de decisão que o abriu; o foco, ao fechar, vai ao título.
    await expect(caixa(page, ana.nome)).not.toBeChecked()
    await expect(secao(page).getByRole('button')).toHaveText(['Fechar'])
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(dialogosDaTela(page)).toHaveCount(0)
    await expect(tituloDaSecao(page)).toBeFocused()
    // A releitura seguinte, que já vem do servidor, tira a Ana; o foco continua no título.
    parar = false
    await passarOIntervalo(page)
    await expect(linhas(page)).toHaveText([new RegExp(`^${bruno.nome}`)], { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(tituloDaSecao(page)).toBeFocused()
    expect(await alunosDaTurmaNoBanco(professora.escolaId, turma.turmaId)).toBe(1)
  })
})

test.describe('os aprovados na lista de nomes da coordenação', () => {
  test('com mais de uma página de nomes, a contagem dos aprovados diz que é dos nomes mostrados, e o total só com a lista inteira', async ({ page, hasTouch }) => {
    test.setTimeout(180_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    const estrutura = await montarEstruturaNoBanco(coordenadora.escolaId)
    const turma = estrutura.turmas[0]
    if (turma === undefined) throw new Error('estrutura sem turma')
    // Um aprovado na primeira página, cem nomes livres, e outro aprovado, que só vem na segunda página.
    await porAprovadosNaListaDaTurma(coordenadora.escolaId, turma.id, 1)
    await porNaListaDaTurma(coordenadora.escolaId, turma.id, nomesDeTeste(100, 'Livre'))
    await porAprovadosNaListaDaTurma(coordenadora.escolaId, turma.id, 1)
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await abrirEstrutura(page, hasTouch)
    await acionar(principal(page).getByRole('link', { name: `Lista de nomes da turma ${turma.nome}` }), hasTouch)
    const nomesDaTurma = principal(page).getByRole('region', { name: 'Nomes da turma' })
    await expect(nomesDaTurma).toContainText('Mostrando os primeiros 100 nomes', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(nomesDaTurma).toContainText(`Aprovados entre os primeiros 100 nomes: 1. ${DOS_APROVADOS}`)
    await expect(nomesDaTurma).not.toContainText('Aprovados nesta turma')
    await expect(linhasDaTabela(nomesDaTurma)).toHaveCount(99)
    await tocar(nomesDaTurma, 'Ver mais nomes', hasTouch)
    await expect(nomesDaTurma).toContainText('102 nomes na lista', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(nomesDaTurma).toContainText(`Aprovados nesta turma: 2. ${DOS_APROVADOS}`)
    await expect(linhasDaTabela(nomesDaTurma)).toHaveCount(100)
  })
})
