import { readFile } from 'node:fs/promises'
import type { Page, Request, Route } from '@playwright/test'
import { PRAZO_DA_ENTRADA_MS } from './support/casca.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { expect, test } from './support/profiles.ts'
import {
  acionar,
  confirmacao,
  doisCliquesNoMesmoInstante,
  ELIMINADO,
  ENDERECO_DA_ABA,
  ENDERECO_DO_DETALHE,
  entrarNosPedidos,
  hoje,
  INDISPONIVEL,
  linhaDa,
  linkDoPedido,
  marca,
  portao,
  principal,
  registrarPeloFluxo,
  somarDiasAHoje,
  diaCurto,
} from './support/pedidos-do-titular.ts'
import {
  auditoriaDoPedidoNoBanco,
  cadastrarSuboperadorDeTeste,
  colocarAlunoNaTurma,
  criarAlunoComMatricula,
  criarEquipeComSenha,
  criarPedidoDeTitularEliminadoNoBanco,
  criarPedidoDoTitularNoBanco,
  desativarUsuario,
  mudarEstadoDoPedidoNoBanco,
  nomeDoUsuarioNoBanco,
  pedidosDoTitularNoBanco,
  situacaoDoPedidoNoBanco,
  type AlunoDeTeste,
  type EquipeDeTeste,
  type PedidoDoTitularSemeado,
} from './support/seed.ts'
import { larguraExcedente, larguraExcedenteDoDialogo, violacoesGraves } from './support/checks.ts'

/**
 * O detalhe do pedido de titular da coordenação (F3, 17.0; RF12, RF13, RF13b, RF14, RF16 e RF20; `docs/interface.md` 3): o
 * prazo, o compartilhamento, concluir, cancelar a eliminação, corrigir o nome e baixar a versão da escola, e a página que
 * acompanha o arquivo até ficar pronto. Contra a API real e o worker real, nos projetos `chromebook` e `celular`. O que o
 * clique fez se confere **no banco** e na auditoria, e não só no que a tela diz.
 */

const DETALHE = /^\/v1\/privacidade\/pedidos\/[0-9a-f-]{36}$/
const ehODetalhe = (url: URL) => DETALHE.test(url.pathname)
const ehAAcao = (acao: string) => (url: URL) => new RegExp(`^/v1/privacidade/pedidos/[0-9a-f-]{36}/${acao}$`).test(url.pathname)
const ehOGetDoDetalhe = (pedido: Request) => pedido.method() === 'GET' && ehODetalhe(new URL(pedido.url()))

const secaoDoPedido = (page: Page) => principal(page).getByRole('region', { name: 'O pedido', exact: true })
const secaoDoPrazo = (page: Page) => principal(page).getByRole('region', { name: 'Prazo da declaração completa', exact: true })
const secaoDasEmpresas = (page: Page) => principal(page).getByRole('region', { name: 'Empresas que receberam dado desta pessoa', exact: true })
const titulo = (page: Page, nome: string) => principal(page).getByRole('heading', { level: 1, name: nome, exact: true })
const anuncios = (page: Page) => principal(page).getByRole('status')

/**
 * Conta só o que já saiu: uma requisição que não existe na API, feita pela própria página. As requisições chegam ao teste
 * em ordem, então, quando a desta passa, toda leitura que a página mandou antes dela já foi contada. `fastForward` volta
 * antes de o evento da última leitura chegar, e contar logo depois deixaria passar a leitura que não devia sair.
 */
async function esperarOQueJaSaiu(page: Page): Promise<void> {
  const chegou = page.waitForRequest((pedido) => new URL(pedido.url()).pathname === '/barreira-do-teste')
  await page.evaluate(() => fetch('/barreira-do-teste').then(() => undefined, () => undefined))
  await chegou
}

interface Cenario {
  readonly coordenadora: EquipeDeTeste
  readonly aluno: AlunoDeTeste
}

/** A escola com a coordenadora e um aluno com turma, nomes inventados e únicos. */
async function montarEscola(prefixo: string, nome = `${prefixo} ${marca()} Prado`): Promise<Cenario> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  const aluno = await criarAlunoComMatricula({ escola: coordenadora, nome, matricula: `7${marca()}` })
  await colocarAlunoNaTurma(aluno)
  return { coordenadora, aluno }
}

/** Um pedido semeado direto no banco, da escola e da pessoa do cenário. */
function semear(cenario: Cenario, pedido: Pick<PedidoDoTitularSemeado, 'tipo' | 'estado'> & Partial<PedidoDoTitularSemeado>, aluno: AlunoDeTeste = cenario.aluno): Promise<string> {
  return criarPedidoDoTitularNoBanco({ escolaId: cenario.coordenadora.escolaId, titularId: aluno.usuarioId, registradoPor: cenario.coordenadora.usuarioId, ...pedido })
}

/** Da lista de pedidos ao detalhe do pedido da pessoa, pelo nome dela, que é o link (a linha inteira o estende, 12.0). */
async function abrirODetalhe(page: Page, hasTouch: boolean, nome: string, filtro?: string | RegExp): Promise<void> {
  const linha = filtro === undefined ? linhaDa(page, nome) : linhaDa(page, nome).filter({ hasText: filtro })
  await acionar(linkDoPedido(linha, nome), hasTouch)
  await expect(page).toHaveURL(ENDERECO_DO_DETALHE, { timeout: PRAZO_DA_ENTRADA_MS })
  await expect(titulo(page, nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
}

async function voltarParaALista(page: Page, hasTouch: boolean): Promise<void> {
  await acionar(principal(page).getByRole('link', { name: 'Voltar para Pedidos', exact: true }), hasTouch)
  await expect(page).toHaveURL(ENDERECO_DA_ABA, { timeout: PRAZO_DA_ENTRADA_MS })
}

/** O único pedido da escola do cenário: o que a tela registrou, lido do banco. */
async function unicoPedidoNoBanco(escolaId: string) {
  const pedidos = await pedidosDoTitularNoBanco(escolaId)
  expect(pedidos).toHaveLength(1)
  const [pedido] = pedidos
  if (pedido === undefined) throw new Error('o pedido não está no banco')
  return pedido
}

/** Sem estouro de largura (a 360 px também), sem violação grave de acessibilidade. */
async function telaSemProblema(page: Page): Promise<void> {
  expect(await larguraExcedente(page)).toBe(0)
  expect(await violacoesGraves(page)).toEqual([])
}

test.describe('Detalhe do pedido: prazo e compartilhamento', () => {
  test('o prazo diz quantos dias faltam, o vencido diz há quantos dias e leva o ícone, e o concluído não tem prazo; cada abertura é uma leitura auditada', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    const cenario = await montarEscola('Prazo')
    const { coordenadora } = cenario
    const noPrazo = cenario.aluno
    const vencida = await criarAlunoComMatricula({ escola: coordenadora, nome: `Vencida ${marca()} Lopes`, matricula: `6${marca()}` })
    const concluida = await criarAlunoComMatricula({ escola: coordenadora, nome: `Concluída ${marca()} Dias`, matricula: `5${marca()}` })
    const pedidoNoPrazo = await semear(cenario, { tipo: 'acesso', estado: 'recebido', chegouHaDias: 11 })
    const pedidoVencido = await semear(cenario, { tipo: 'correcao', estado: 'recebido', chegouHaDias: 20 }, vencida)
    await semear(cenario, { tipo: 'portabilidade', estado: 'concluido', chegouHaDias: 40 }, concluida)
    // A lista das empresas só é lida quando o pedido tem linha de compartilhamento: nenhum dos três tem.
    const leiturasDasEmpresas: string[] = []
    page.on('request', (pedido) => {
      if (pedido.url().includes('/v1/privacidade/suboperadores')) leiturasDasEmpresas.push(pedido.url())
    })
    await entrarNosPedidos(page, hasTouch, coordenadora)

    // 11 dias depois da chegada, faltam 4 dos 15: o texto diz quantos e até que dia.
    await abrirODetalhe(page, hasTouch, noPrazo.nome)
    await expect(secaoDoPrazo(page)).toContainText(`Faltam 4 dias, até ${diaCurto(somarDiasAHoje(4))}`, { timeout: PRAZO_DA_ENTRADA_MS })
    // O pedido recebido, sem arquivo, é o estado mais curto da tela, e já passava da janela de 1366 × 768 (88 px): só o miolo rola.
    await paginaNaoRola(page)
    await expect(secaoDoPrazo(page).locator('[data-estado="pendente"]')).toBeVisible()
    await expect(secaoDoPedido(page)).toContainText('Acesso aos dados')
    await expect(secaoDoPedido(page)).toContainText('Recebido')
    await expect(secaoDoPedido(page)).toContainText('A própria pessoa')
    // O pedido aberto não tem "Concluído em": a linha só existe quando alguém o concluiu.
    await expect(secaoDoPedido(page)).not.toContainText('Concluído em')
    // Sem orientação nem aviso a dar, a seção não deixa parágrafo vazio para o leitor de tela.
    await expect(secaoDoPedido(page).locator('p:empty')).toHaveCount(0)
    await telaSemProblema(page)
    await voltarParaALista(page, hasTouch)

    // Vencido há 5 dias: o texto diz que venceu, o selo é de erro e leva o ícone, e o prazo não depende só da cor.
    await abrirODetalhe(page, hasTouch, vencida.nome)
    await expect(secaoDoPrazo(page)).toContainText(`Prazo vencido há 5 dias (venceu em ${diaCurto(somarDiasAHoje(-5))})`, { timeout: PRAZO_DA_ENTRADA_MS })
    const seloVencido = secaoDoPrazo(page).locator('[data-estado="erro"]')
    await expect(seloVencido).toBeVisible()
    await expect(seloVencido.locator('svg')).toHaveCount(1)
    await telaSemProblema(page)
    await voltarParaALista(page, hasTouch)

    await abrirODetalhe(page, hasTouch, concluida.nome)
    await expect(secaoDoPrazo(page)).toContainText('Pedido concluído: não há prazo a cumprir', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secaoDoPedido(page)).toContainText('Concluído em')
    // O pedido concluído não oferece nenhuma ação.
    await expect(principal(page).getByRole('group', { name: 'O que fazer com este pedido' })).toHaveCount(0)
    expect(leiturasDasEmpresas).toHaveLength(0)

    // Cada abertura foi uma leitura, e cada uma ficou na auditoria com a finalidade fixa (regra 20, item 10).
    const lidos = (await auditoriaDoPedidoNoBanco(coordenadora.escolaId, pedidoVencido)).filter((linha) => linha.acao === 'pedido.lido')
    expect(lidos).toHaveLength(1)
    expect(lidos[0]).toMatchObject({ autor: coordenadora.usuarioId, finalidade: 'atender_o_pedido_do_titular' })
    expect((await auditoriaDoPedidoNoBanco(coordenadora.escolaId, pedidoNoPrazo)).filter((linha) => linha.acao === 'pedido.lido')).toHaveLength(1)
  })

  test('o compartilhamento lista as empresas pelo nome que a escola cadastrou, diz a que não está cadastrada e avisa que a escola precisa avisá-las', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const cenario = await montarEscola('Empresas')
    const hospedagem = `Hospedagem ${marca()}`
    const chave = await cadastrarSuboperadorDeTeste({ nome: hospedagem, escolas: [cenario.coordenadora.escolaId] })
    await semear(cenario, {
      tipo: 'compartilhamento',
      estado: 'recebido',
      chegouHaDias: 2,
      compartilhamento: [
        { suboperadorId: '0197f3b0-6f3e-7c11-9a3e-5d1c2b7a8e41', chave, primeiroEm: '2026-09-10T13:00:00.000Z', ultimoEm: '2026-09-20T13:00:00.000Z', origem: 'rastro' },
        { suboperadorId: null, chave: 'provedor-sem-cadastro', primeiroEm: '2026-09-15T13:00:00.000Z', ultimoEm: '2026-09-15T14:00:00.000Z', origem: 'periodo' },
      ],
    })
    await entrarNosPedidos(page, hasTouch, cenario.coordenadora)
    await abrirODetalhe(page, hasTouch, cenario.aluno.nome)

    const empresas = secaoDasEmpresas(page)
    await expect(empresas).toContainText(hospedagem, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(empresas).toContainText('Provedor não cadastrado: provedor-sem-cadastro')
    await expect(empresas).toContainText('Recebeu chamadas com dado da pessoa')
    await expect(empresas).toContainText('A escola usava esta empresa enquanto a pessoa estava nela')
    await expect(empresas).toContainText('avisar cada empresa desta lista')
    // A chave interna do cadastro nunca é o texto da tela quando há nome.
    await expect(empresas).not.toContainText(chave)
    await expect(secaoDoPedido(page)).toContainText('Compartilhamento dos dados')
    await telaSemProblema(page)
  })
})

test.describe('Detalhe do pedido: concluir', () => {
  test('Concluir mostra o que faz, desliga o botão no envio, o clique duplo conclui uma vez e fica na auditoria com quem concluiu', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    const cenario = await montarEscola('Concluir', `Conclusão ${marca()} ${'Albuquerquemedeiros'.repeat(5)}`)
    const { coordenadora, aluno } = cenario
    const pedidoId = await semear(cenario, { tipo: 'compartilhamento', estado: 'recebido', chegouHaDias: 1 })
    const segurada = portao()
    let conclusoes = 0
    await page.route(ehAAcao('concluir'), async (rota: Route) => {
      conclusoes += 1
      await segurada.aberta
      return rota.continue()
    })
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await abrirODetalhe(page, hasTouch, aluno.nome)

    await acionar(principal(page).getByRole('button', { name: 'Concluir', exact: true }), hasTouch)
    const dialogo = confirmacao(page, 'Concluir o pedido: Compartilhamento dos dados')
    await expect(dialogo).toBeVisible()
    // O que vai acontecer, antes de confirmar: quem, o quê, quem pediu e a situação; e que fica registrado. Sem arquivo, não fala de arquivo.
    await expect(dialogo).toContainText(aluno.nome)
    await expect(dialogo).toContainText('Compartilhamento dos dados')
    await expect(dialogo).toContainText('Recebido')
    await expect(dialogo).not.toContainText('Não apaga o arquivo')
    await expect(dialogo).toContainText('fica registrada na auditoria')
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    const confirmar = dialogo.getByRole('button', { name: 'Concluir pedido', exact: true })
    await expect(confirmar).not.toBeFocused()

    await doisCliquesNoMesmoInstante(confirmar)
    // Com o pedido no ar, o botão diz o que acontece e fica desligado: o segundo clique não sai.
    await expect(dialogo.getByRole('button', { name: 'Concluindo…', exact: true })).toBeDisabled()
    await expect.poll(() => conclusoes, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(1)
    segurada.abrir()
    await expect(dialogo).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(conclusoes).toBe(1)

    await expect(secaoDoPedido(page).getByText('Concluído', { exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(anuncios(page).filter({ hasText: 'Pedido concluído.' })).toBeVisible()
    await expect(principal(page).getByRole('button', { name: 'Concluir', exact: true })).toHaveCount(0)
    await expect(secaoDoPrazo(page)).toContainText('não há prazo a cumprir')
    // O foco não cai no `body`: o botão saiu com a ação, e o foco ficou na página.
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true)
    await telaSemProblema(page)

    expect(await situacaoDoPedidoNoBanco(coordenadora.escolaId, pedidoId)).toEqual({ estado: 'concluido', concluidoPor: coordenadora.usuarioId, canceladoPor: null })
    const concluidos = (await auditoriaDoPedidoNoBanco(coordenadora.escolaId, pedidoId)).filter((linha) => linha.acao === 'pedido.concluido')
    expect(concluidos).toHaveLength(1)
    expect(concluidos[0]).toMatchObject({ autor: coordenadora.usuarioId, antes: { estado: 'recebido' }, depois: { estado: 'concluido' } })
  })

  test('outra pessoa concluiu antes: a falha diz o que mudou, o botão some e fica só "Fechar", e a página mostra a situação de agora', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const cenario = await montarEscola('Segunda')
    const { coordenadora, aluno } = cenario
    const pedidoId = await semear(cenario, { tipo: 'correcao', estado: 'recebido', chegouHaDias: 3 })
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await abrirODetalhe(page, hasTouch, aluno.nome)

    await acionar(principal(page).getByRole('button', { name: 'Concluir', exact: true }), hasTouch)
    const dialogo = confirmacao(page, 'Concluir o pedido: Correção de dados')
    await expect(dialogo).toBeVisible()
    // A segunda pessoa da coordenação concluiu enquanto este diálogo estava aberto.
    await mudarEstadoDoPedidoNoBanco(coordenadora.escolaId, pedidoId, 'concluido')
    await acionar(dialogo.getByRole('button', { name: 'Concluir pedido', exact: true }), hasTouch)

    await expect(dialogo.getByRole('alert')).toContainText('já foi concluído ou mudou de situação', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogo.getByRole('button', { name: 'Concluir pedido', exact: true })).toBeDisabled()
    await expect(dialogo.getByRole('button', { name: 'Fechar', exact: true })).toBeVisible()
    // A página, por trás, já foi relida: o pedido está como o servidor o tem.
    await expect(secaoDoPedido(page).getByText('Concluído', { exact: true }).first()).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(dialogo.getByRole('button', { name: 'Fechar', exact: true }), hasTouch)
    await expect(dialogo).toHaveCount(0)
    await expect(principal(page).getByRole('button', { name: 'Concluir', exact: true })).toHaveCount(0)
    // O segundo clique não concluiu nada: a conclusão é a da outra pessoa, e a auditoria não tem uma de quem recebeu a falha.
    expect((await auditoriaDoPedidoNoBanco(coordenadora.escolaId, pedidoId)).filter((linha) => linha.acao === 'pedido.concluido')).toHaveLength(0)
  })

  test('a leitura que estava no ar quando a ação terminou não desfaz o resultado: a resposta atrasada é descartada', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const cenario = await montarEscola('Atrasada')
    const { coordenadora, aluno } = cenario
    const pedidoId = await semear(cenario, { tipo: 'acesso', estado: 'pronto', chegouHaDias: 2 })
    let segurar = false
    const segurada = portao()
    const entregue = portao()
    await page.route(
      (url) => ehODetalhe(url),
      async (rota: Route) => {
        if (rota.request().method() !== 'GET' || !segurar) return rota.continue()
        segurar = false
        // Responde com o estado de antes da conclusão, mas só depois de a conclusão terminar.
        const antiga = await rota.fetch()
        await segurada.aberta
        await rota.fulfill({ response: antiga }).catch(() => undefined)
        entregue.abrir()
      },
    )
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await abrirODetalhe(page, hasTouch, aluno.nome)
    await expect(secaoDoPedido(page).getByText('Pronto', { exact: true })).toBeVisible()
    // O pedido que já abre pronto não anuncia "ficou pronto": o anúncio é só de quem viu a preparação acabar.
    await expect(anuncios(page).filter({ hasText: 'O arquivo ficou pronto.' })).toHaveCount(0)
    // O pedido pronto tem orientação e nenhum aviso de troca de nome: a caixa do aviso não aparece vazia.
    await expect(secaoDoPedido(page).locator('p:empty')).toHaveCount(0)

    segurar = true
    await acionar(principal(page).getByRole('button', { name: 'Atualizar', exact: true }), hasTouch)
    await expect(principal(page).getByRole('button', { name: 'Atualizando…', exact: true })).toBeVisible()
    await acionar(principal(page).getByRole('button', { name: 'Concluir', exact: true }), hasTouch)
    const dialogo = confirmacao(page, 'Concluir o pedido: Acesso aos dados')
    await expect(dialogo).toContainText('Não apaga o arquivo')
    await acionar(dialogo.getByRole('button', { name: 'Concluir pedido', exact: true }), hasTouch)
    await expect(dialogo).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secaoDoPedido(page).getByText('Concluído', { exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    // A resposta de antes chega agora, e a página continua como está.
    segurada.abrir()
    await entregue.aberta
    // Dois quadros depois, qualquer coisa que a chegada fosse pintar já estaria na tela.
    await page.evaluate(() => new Promise<void>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto()))))
    await expect(secaoDoPedido(page).getByText('Concluído', { exact: true })).toBeVisible()
    await expect(secaoDoPedido(page).getByText('Pronto', { exact: true })).toHaveCount(0)
    expect((await situacaoDoPedidoNoBanco(coordenadora.escolaId, pedidoId)).estado).toBe('concluido')
  })
})

test.describe('Detalhe do pedido: trocar de pedido', () => {
  test('ir a outro pedido pelo histórico fecha o diálogo aberto e deixa o aviso para trás: nada do primeiro vale para o segundo', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const cenario = await montarEscola('Troca')
    const outra = await criarAlunoComMatricula({ escola: cenario.coordenadora, nome: `Outra ${marca()} Reis`, matricula: `4${marca()}` })
    const primeiro = await semear(cenario, { tipo: 'acesso', estado: 'pronto', chegouHaDias: 2 })
    const segundo = await semear(cenario, { tipo: 'acesso', estado: 'pronto', chegouHaDias: 3 }, outra)
    await entrarNosPedidos(page, hasTouch, cenario.coordenadora)
    await abrirODetalhe(page, hasTouch, cenario.aluno.nome)
    await acionar(principal(page).getByRole('button', { name: 'Concluir', exact: true }), hasTouch)
    const dialogo = confirmacao(page, 'Concluir o pedido: Acesso aos dados')
    await expect(dialogo).toBeVisible()

    // O endereço do outro pedido, sem passar pela lista: a mesma tela troca de pedido.
    await page.evaluate((id) => {
      window.history.pushState(null, '', `/coordenacao/privacidade/pedidos/${id}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, segundo)
    await expect(titulo(page, outra.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogo).toHaveCount(0)
    await expect(principal(page).getByRole('button', { name: 'Concluir', exact: true })).toBeVisible()
    expect((await situacaoDoPedidoNoBanco(cenario.coordenadora.escolaId, primeiro)).estado).toBe('pronto')
    expect((await situacaoDoPedidoNoBanco(cenario.coordenadora.escolaId, segundo)).estado).toBe('pronto')

    // O aviso do que terminou num pedido não vai para o outro: "Pedido concluído." é do segundo, e some ao voltar ao primeiro.
    await acionar(principal(page).getByRole('button', { name: 'Concluir', exact: true }), hasTouch)
    await acionar(dialogo.getByRole('button', { name: 'Concluir pedido', exact: true }), hasTouch)
    await expect(dialogo).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(anuncios(page).filter({ hasText: 'Pedido concluído.' })).toBeVisible()
    await page.evaluate((id) => {
      window.history.pushState(null, '', `/coordenacao/privacidade/pedidos/${id}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, primeiro)
    await expect(titulo(page, cenario.aluno.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(anuncios(page).filter({ hasText: 'Pedido concluído.' })).toHaveCount(0)
    expect((await situacaoDoPedidoNoBanco(cenario.coordenadora.escolaId, segundo)).estado).toBe('concluido')
    expect((await situacaoDoPedidoNoBanco(cenario.coordenadora.escolaId, primeiro)).estado).toBe('pronto')
  })
})

test.describe('Detalhe do pedido: corrigir o nome', () => {
  test('mostra o nome atual e o novo antes de confirmar, avisa do nome anterior, corrige no cadastro e não leva nenhum dos dois nomes à auditoria', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    const cenario = await montarEscola('Correção')
    const { coordenadora, aluno } = cenario
    const pedidoId = await semear(cenario, { tipo: 'correcao', estado: 'recebido', chegouHaDias: 1 })
    const novoNome = `Corrigida ${marca()} Almeida`
    await entrarNosPedidos(page, hasTouch, coordenadora)
    const envios: string[] = []
    page.on('request', (pedido) => {
      if (pedido.method() === 'POST' && pedido.url().includes('/corrigir-nome')) envios.push(pedido.url())
    })
    await abrirODetalhe(page, hasTouch, aluno.nome)

    // A correção de turma ou de vínculo não é deste pedido: o caminho é a turma, em Escola › Turmas.
    await expect(principal(page).getByRole('link', { name: 'Ir para as turmas', exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(principal(page).getByRole('button', { name: 'Corrigir nome', exact: true }), hasTouch)
    const dialogo = confirmacao(page, 'Corrigir o nome')
    await expect(dialogo).toBeVisible()
    // Antes de digitar, o nome novo é um traço, e confirmar está desligado.
    await expect(dialogo).toContainText(aluno.nome)
    const confirmar = dialogo.getByRole('button', { name: 'Corrigir o nome', exact: true })
    await expect(confirmar).toBeDisabled()
    await expect(dialogo).toContainText('nome anterior que tenha ficado em texto livre')
    await expect(dialogo).toContainText('não é refeito')

    // O mesmo nome não é correção, e o campo diz isso.
    const campo = dialogo.getByLabel('Nome correto')
    await campo.fill(aluno.nome)
    await expect(dialogo).toContainText('igual ao atual')
    await expect(confirmar).toBeDisabled()
    // Enter no campo não contorna o botão desligado: nada é enviado com o nome igual ao atual.
    await campo.press('Enter')
    await expect(dialogo).toBeVisible()
    await campo.fill(novoNome)
    // O resumo mostra o antes e o depois, e o botão liga.
    await expect(dialogo.getByText('Nome atual', { exact: true })).toBeVisible()
    await expect(dialogo.getByText('Nome novo', { exact: true })).toBeVisible()
    await expect(dialogo).toContainText(novoNome)
    await expect(confirmar).toBeEnabled()
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    await acionar(confirmar, hasTouch)
    await expect(dialogo).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(titulo(page, novoNome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(anuncios(page).filter({ hasText: 'Nome corrigido.' })).toBeVisible()
    expect(await nomeDoUsuarioNoBanco(coordenadora.escolaId, aluno.usuarioId)).toBe(novoNome)
    // Uma só chamada saiu: a do botão, e não a do Enter com o nome igual.
    expect(envios).toHaveLength(1)

    // A auditoria diz que houve correção, em qual pedido e por quem, sem nome nenhum (regra 20, itens 9 e 10).
    const auditoria = await auditoriaDoPedidoNoBanco(coordenadora.escolaId, pedidoId)
    const correcoes = auditoria.filter((linha) => linha.acao === 'pedido.nome_corrigido')
    expect(correcoes).toHaveLength(1)
    expect(correcoes[0]?.autor).toBe(coordenadora.usuarioId)
    expect(JSON.stringify(correcoes)).not.toContain(aluno.nome)
    expect(JSON.stringify(correcoes)).not.toContain(novoNome)
  })

  test('o pedido que não é de correção não oferece "Corrigir nome", e o de correção depois de concluído também não', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const cenario = await montarEscola('SemCorrecao')
    const outra = await criarAlunoComMatricula({ escola: cenario.coordenadora, nome: `Outra ${marca()} Reis`, matricula: `4${marca()}` })
    await semear(cenario, { tipo: 'acesso', estado: 'recebido', chegouHaDias: 1 })
    await semear(cenario, { tipo: 'correcao', estado: 'concluido', chegouHaDias: 1 }, outra)
    await entrarNosPedidos(page, hasTouch, cenario.coordenadora)

    await abrirODetalhe(page, hasTouch, cenario.aluno.nome)
    await expect(principal(page).getByRole('button', { name: 'Concluir', exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('button', { name: 'Corrigir nome', exact: true })).toHaveCount(0)
    await expect(principal(page).getByRole('link', { name: 'Ir para as turmas', exact: true })).toHaveCount(0)
    await voltarParaALista(page, hasTouch)
    await abrirODetalhe(page, hasTouch, outra.nome)
    await expect(secaoDoPedido(page)).toContainText('Concluído', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('button', { name: 'Corrigir nome', exact: true })).toHaveCount(0)
    await expect(principal(page).getByRole('link', { name: 'Ir para as turmas', exact: true })).toHaveCount(0)
  })
})

test.describe('Detalhe do pedido: eliminação agendada', () => {
  test('registra a eliminação, o detalhe diz que o acesso está suspenso e o cancelamento o devolve, com o aviso dos 7 dias e sem apagar nada', async ({ page, hasTouch }) => {
    test.setTimeout(150_000)
    const { coordenadora, aluno } = await montarEscola('Eliminação')
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await registrarPeloFluxo(page, hasTouch, { nome: aluno.nome, pessoa: new RegExp(aluno.nome), tipo: 'Eliminação dos dados', confirmar: 'Registrar a eliminação' })
    await expect(linhaDa(page, aluno.nome)).toContainText('Eliminação agendada', { timeout: PRAZO_DA_ENTRADA_MS })
    await abrirODetalhe(page, hasTouch, aluno.nome)

    await expect(secaoDoPedido(page)).toContainText('Eliminação agendada')
    await expect(secaoDoPedido(page)).toContainText('o acesso da pessoa está suspenso')
    await expect(secaoDoPedido(page)).toContainText('7 dias')
    await expect(secaoDoPrazo(page)).toContainText('Faltam 15 dias')
    // A eliminação não se conclui pela tela: o que existe é cancelar.
    await expect(principal(page).getByRole('button', { name: 'Concluir', exact: true })).toHaveCount(0)
    await telaSemProblema(page)

    await acionar(principal(page).getByRole('button', { name: 'Cancelar eliminação', exact: true }), hasTouch)
    const dialogo = confirmacao(page, 'Cancelar a eliminação')
    await expect(dialogo).toBeVisible()
    await expect(dialogo).toContainText('O acesso da pessoa volta com a mesma senha')
    await expect(dialogo).toContainText('Nenhum dado é apagado')
    // O botão que fecha diz o que mantém: "Cancelar" ao lado de "Cancelar a eliminação" não diria qual desfaz o quê.
    await expect(dialogo.getByRole('button', { name: 'Manter a eliminação', exact: true })).toBeVisible()
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await acionar(dialogo.getByRole('button', { name: 'Cancelar a eliminação', exact: true }), hasTouch)
    await expect(dialogo).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })

    await expect(secaoDoPedido(page).getByText('Cancelado', { exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(anuncios(page).filter({ hasText: 'Eliminação cancelada: o acesso da pessoa voltou.' })).toBeVisible()
    await expect(principal(page).getByRole('button', { name: 'Cancelar eliminação', exact: true })).toHaveCount(0)
    const pedido = await unicoPedidoNoBanco(coordenadora.escolaId)
    expect(pedido).toMatchObject({ titularId: aluno.usuarioId, tipo: 'eliminacao', estado: 'cancelado' })
    expect(await nomeDoUsuarioNoBanco(coordenadora.escolaId, aluno.usuarioId)).toBe(aluno.nome)
    const cancelados = (await auditoriaDoPedidoNoBanco(coordenadora.escolaId, pedido.id)).filter((linha) => linha.acao === 'pedido.cancelado')
    expect(cancelados).toHaveLength(1)
    expect(cancelados[0]).toMatchObject({ autor: coordenadora.usuarioId, antes: { estado: 'agendado' } })
  })

  test('o cancelamento que já não vale (o prazo passou ou outra pessoa cancelou) diz por quê, e o diálogo não oferece de novo', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const cenario = await montarEscola('JaCancelada')
    const { coordenadora, aluno } = cenario
    const pedidoId = await semear(cenario, { tipo: 'eliminacao', estado: 'agendado', chegouHaDias: 1 })
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await abrirODetalhe(page, hasTouch, aluno.nome)

    await acionar(principal(page).getByRole('button', { name: 'Cancelar eliminação', exact: true }), hasTouch)
    const dialogo = confirmacao(page, 'Cancelar a eliminação')
    await expect(dialogo).toBeVisible()
    await mudarEstadoDoPedidoNoBanco(coordenadora.escolaId, pedidoId, 'cancelado')
    await acionar(dialogo.getByRole('button', { name: 'Cancelar a eliminação', exact: true }), hasTouch)

    await expect(dialogo.getByRole('alert')).toContainText('já não pode ser cancelada', { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(dialogo.getByRole('button', { name: 'Cancelar a eliminação', exact: true })).toBeDisabled()
    await expect(dialogo.getByRole('button', { name: 'Fechar', exact: true })).toBeVisible()
    await expect(secaoDoPedido(page).getByText('Cancelado', { exact: true }).first()).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  })
})

test.describe('Detalhe do pedido: a página acompanha o arquivo em preparação', () => {
  test('em preparação se relê a cada 10 s e vira pronto sem recarregar; com a aba escondida para, e ao voltar relê na hora', async ({ page, hasTouch }) => {
    test.slow()
    const cenario = await montarEscola('Preparacao')
    const { coordenadora, aluno } = cenario
    const pedidoId = await semear(cenario, { tipo: 'acesso', estado: 'em_preparacao', chegouHaDias: 1 })
    // O relógio da aba é simulado: ninguém espera 10 s de verdade, e o servidor continua no tempo real.
    await page.clock.install()
    let leituras = 0
    page.on('request', (pedido) => {
      if (ehOGetDoDetalhe(pedido)) leituras += 1
    })
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await abrirODetalhe(page, hasTouch, aluno.nome)
    await expect(secaoDoPedido(page).getByText('Em preparação', { exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secaoDoPedido(page)).toContainText('Esta página se atualiza sozinha')
    await expect.poll(() => leituras).toBe(1)
    // O que prova que não houve recarga: um marcador posto na janela sobrevive a todas as leituras.
    await page.evaluate(() => {
      ;(window as unknown as { __semRecarga: boolean }).__semRecarga = true
    })

    await page.clock.fastForward('00:10')
    await expect.poll(() => leituras, { timeout: PRAZO_DA_ENTRADA_MS }).toBe(2)
    await expect(secaoDoPedido(page).getByText('Em preparação', { exact: true })).toBeVisible()

    // Com a aba escondida, nenhuma leitura sai, por mais que o tempo passe.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.clock.fastForward('01:00')
    await esperarOQueJaSaiu(page)
    expect(leituras).toBe(2)
    // Ao voltar, relê na hora, sem esperar os 10 s.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect.poll(() => leituras, { timeout: PRAZO_DA_ENTRADA_MS }).toBeGreaterThanOrEqual(3)
    await esperarOQueJaSaiu(page)
    expect(leituras).toBe(3)

    // O worker termina: na leitura seguinte a página mostra pronto, anuncia, e para de reler.
    await mudarEstadoDoPedidoNoBanco(coordenadora.escolaId, pedidoId, 'pronto')
    await page.clock.fastForward('00:10')
    await expect(secaoDoPedido(page).getByText('Pronto', { exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(anuncios(page).filter({ hasText: 'O arquivo ficou pronto.' })).toBeVisible()
    await esperarOQueJaSaiu(page)
    const depoisDePronto = leituras
    await page.clock.fastForward('01:00')
    await esperarOQueJaSaiu(page)
    expect(leituras).toBe(depoisDePronto)
    expect(await page.evaluate(() => (window as unknown as { __semRecarga?: boolean }).__semRecarga)).toBe(true)
    await expect(page).toHaveURL(ENDERECO_DO_DETALHE)
  })

  test('as quatro situações da página: carregando, erro com nova tentativa, pedido que não existe e o dado', async ({ page, hasTouch }) => {
    test.setTimeout(120_000)
    const cenario = await montarEscola('Estados')
    const { coordenadora, aluno } = cenario
    await semear(cenario, { tipo: 'acesso', estado: 'recebido', chegouHaDias: 1 })
    let modo: 'segurar' | 'falhar' | 'passar' = 'segurar'
    const segurada = portao()
    await page.route(
      (url) => ehODetalhe(url),
      async (rota: Route) => {
        if (rota.request().method() !== 'GET') return rota.continue()
        if (modo === 'segurar') {
          await segurada.aberta
          modo = 'falhar'
          return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
        }
        if (modo === 'falhar') {
          modo = 'passar'
          return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
        }
        return rota.continue()
      },
    )
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await acionar(linkDoPedido(linhaDa(page, aluno.nome), aluno.nome), hasTouch)
    // Carregando: a tela diz o que espera, sem nome nem dado do titular.
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando o pedido…' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page)).not.toContainText(aluno.nome)
    segurada.abrir()
    // Erro: texto do catálogo e "Tentar de novo".
    await expect(principal(page).getByRole('alert').filter({ hasText: 'O sistema está indisponível no momento' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(principal(page).getByRole('button', { name: 'Tentar de novo', exact: true }), hasTouch)
    // O dado.
    await expect(titulo(page, aluno.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(principal(page).getByRole('alert')).toHaveCount(0)
    await telaSemProblema(page)

    // O pedido que não se acha (o id que não existe): a tela diz o mesmo texto para qualquer código de "não encontrado"; que outra escola e inexistente respondem igual é da API (`apps/api/test/pedido-titular.int.test.ts`, isolamento). O título da aba não diz nome.
    await page.goto('/coordenacao/privacidade/pedidos/0197f3b0-6f3e-7c11-9a3e-5d1c2b7a8e99')
    await expect(principal(page).getByRole('status').filter({ hasText: 'Este pedido não está mais disponível nesta escola' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveTitle('Pedido de titular · Turmma')
    await expect(principal(page).getByRole('link', { name: 'Voltar para Pedidos', exact: true })).toBeVisible()
  })

  test('o pedaço do detalhe que demora a chegar mostra "Carregando…", e não uma área em branco', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const cenario = await montarEscola('Pedaco')
    const { coordenadora, aluno } = cenario
    await semear(cenario, { tipo: 'acesso', estado: 'recebido', chegouHaDias: 1 })
    const segurada = portao()
    await page.route(/\/tela-coordenacao-DetalheDoPedido-[^/]*\.js$/, async (rota: Route) => {
      await segurada.aberta
      return rota.continue()
    })
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await acionar(linkDoPedido(linhaDa(page, aluno.nome), aluno.nome), hasTouch)
    // O pedaço não chegou: a tela diz que está carregando, e não fica vazia.
    await expect(page.getByText('Carregando…', { exact: true })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    segurada.abrir()
    await expect(titulo(page, aluno.nome)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  })

  test('o titular que já foi eliminado aparece como tal no detalhe: sem nome nem turma, e sem as ações de quem ainda existe', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const coordenadora = await criarEquipeComSenha('coordenador')
    const pedidoId = await criarPedidoDeTitularEliminadoNoBanco(coordenadora.escolaId, coordenadora.usuarioId, 9)
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await acionar(linkDoPedido(linhaDa(page, ELIMINADO), ELIMINADO), hasTouch)
    await expect(page).toHaveURL(ENDERECO_DO_DETALHE, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(titulo(page, ELIMINADO)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(secaoDoPedido(page)).toContainText('Eliminação dos dados')
    await expect(secaoDoPedido(page)).toContainText('Os dados da pessoa foram eliminados')
    await expect(secaoDoPrazo(page)).toContainText('não há prazo a cumprir')
    await expect(principal(page).getByRole('group', { name: 'O que fazer com este pedido' })).toHaveCount(0)
    await telaSemProblema(page)
    expect((await auditoriaDoPedidoNoBanco(coordenadora.escolaId, pedidoId)).filter((linha) => linha.acao === 'pedido.lido')).toHaveLength(1)
  })
})

test.describe('Detalhe do pedido: baixar a versão da escola', () => {
  test('pede a finalidade, avisa que fica registrado e que o arquivo se entrega e se apaga, e baixa o arquivo do pedido pronto, com o nome certo e na auditoria', async ({ page, hasTouch }) => {
    test.setTimeout(180_000)
    const { coordenadora, aluno } = await montarEscola('Arquivo')
    // A versão da escola só existe para quem já não tem conta ativa nela: o aluno saiu da escola, e o pedido chegou depois.
    await desativarUsuario(aluno.usuarioId)
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await registrarPeloFluxo(page, hasTouch, { nome: aluno.nome, pessoa: new RegExp(aluno.nome), tipo: 'Acesso aos dados', confirmar: 'Registrar pedido' })
    await abrirODetalhe(page, hasTouch, aluno.nome)

    // O arquivo é montado pelo worker, fora da requisição: a página o espera sozinha e mostra pronto sem ninguém recarregar.
    await expect(secaoDoPedido(page).getByText('Pronto', { exact: true })).toBeVisible({ timeout: 90_000 })
    await expect(principal(page).getByRole('button', { name: 'Baixar a versão da escola', exact: true })).toBeVisible()
    await telaSemProblema(page)

    await acionar(principal(page).getByRole('button', { name: 'Baixar a versão da escola', exact: true }), hasTouch)
    const dialogo = confirmacao(page, 'Baixar a versão da escola')
    await expect(dialogo).toBeVisible()
    // O que o arquivo traz, que traz a conversa do Tutor, que fica registrado e o que fazer com ele depois.
    await expect(dialogo).toContainText('conversa dele com o Tutor')
    await expect(dialogo).toContainText('Nunca traz a conversa do professor')
    await expect(dialogo).toContainText('fica registrado na auditoria da escola, com a finalidade')
    await expect(dialogo).toContainText('apague-o deste computador')
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    // A finalidade é uma escolha da lista, e sem ela não se baixa.
    const baixar = dialogo.getByRole('button', { name: 'Baixar o arquivo', exact: true })
    await expect(baixar).toBeDisabled()
    await expect(dialogo.getByRole('radio')).toHaveCount(2)
    await dialogo.getByRole('radio', { name: 'Entregar ao responsável legal' }).check()
    await expect(baixar).toBeEnabled()

    const chamadasDeArquivo: string[] = []
    page.on('request', (pedido) => {
      if (pedido.method() === 'POST' && ehAAcao('arquivo')(new URL(pedido.url()))) chamadasDeArquivo.push(pedido.url())
    })
    const resposta = page.waitForResponse((r) => r.request().method() === 'POST' && ehAAcao('arquivo')(new URL(r.url())), { timeout: PRAZO_DA_ENTRADA_MS })
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: PRAZO_DA_ENTRADA_MS }), doisCliquesNoMesmoInstante(baixar)])
    const assinada = new URL(((await (await resposta).json()) as { url: string }).url)
    expect(download.suggestedFilename()).toBe(`meus-dados-${hoje()}.json`)
    const conteudo = await readFile(await download.path(), 'utf8')
    // É o arquivo de quem foi pedido, em JSON, e nunca uma página.
    expect(() => JSON.parse(conteudo)).not.toThrow()
    expect(conteudo).toContain(aluno.nome)

    await expect(dialogo).toHaveCount(0, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(anuncios(page).filter({ hasText: `Arquivo baixado: meus-dados-${hoje()}.json.` })).toContainText('apague-o deste computador')
    // A tela não guarda o endereço assinado em lugar nenhum: nem o caminho do objeto, que só a resposta da API trouxe.
    expect(assinada.pathname.length).toBeGreaterThan(1)
    expect(await page.content()).not.toContain(assinada.pathname)
    await expect(page).toHaveURL(ENDERECO_DO_DETALHE)

    // O que o download deixou: um registro com a finalidade escolhida e a versão da escola, por quem baixou.
    const pedido = await unicoPedidoNoBanco(coordenadora.escolaId)
    const baixados = (await auditoriaDoPedidoNoBanco(coordenadora.escolaId, pedido.id)).filter((linha) => linha.acao === 'titular.arquivo_baixado')
    // Dois cliques no mesmo instante: uma chamada, um arquivo, um registro.
    expect(chamadasDeArquivo).toHaveLength(1)
    expect(baixados).toHaveLength(1)
    expect(baixados[0]).toMatchObject({ autor: coordenadora.usuarioId, finalidade: 'entregar_ao_responsavel_legal', depois: { versao: 'coordenacao' } })
  })

  test('com o titular ainda com conta ativa não há versão da escola: a falha diz que ele baixa o dele, sem expor o arquivo', async ({ page, hasTouch }) => {
    test.setTimeout(90_000)
    const cenario = await montarEscola('ContaAtiva')
    const { coordenadora, aluno } = cenario
    // Pronto semeado, sem arquivo nenhum no armazém: é o que a API responde igual ao de conta ativa (`NAO_ENCONTRADO`).
    const pedidoId = await semear(cenario, { tipo: 'portabilidade', estado: 'pronto', chegouHaDias: 1 })
    await entrarNosPedidos(page, hasTouch, coordenadora)
    await abrirODetalhe(page, hasTouch, aluno.nome)

    await acionar(principal(page).getByRole('button', { name: 'Baixar a versão da escola', exact: true }), hasTouch)
    const dialogo = confirmacao(page, 'Baixar a versão da escola')
    await dialogo.getByRole('radio', { name: 'Entregar à própria pessoa' }).check()
    await acionar(dialogo.getByRole('button', { name: 'Baixar o arquivo', exact: true }), hasTouch)
    await expect(dialogo.getByRole('alert')).toContainText('ainda tem conta ativa nesta escola', { timeout: PRAZO_DA_ENTRADA_MS })
    // A tentativa que não baixou nada não deixa registro de download.
    expect((await auditoriaDoPedidoNoBanco(coordenadora.escolaId, pedidoId)).filter((linha) => linha.acao === 'titular.arquivo_baixado')).toHaveLength(0)
    await telaSemProblema(page)
  })
})
