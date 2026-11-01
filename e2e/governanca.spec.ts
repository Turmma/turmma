import type { APIRequestContext, Locator, Page, Request, Route } from '@playwright/test'
import { entrarPelaTelaComSegundoFator, esperarPainel, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga, configurarSegundoFatorPelaApi } from './support/mfa.ts'
import { irPelaCoordenacao, linhasDaTabela, paginaNaoRola } from './support/coordenacao.ts'
import { acrescentarSerieDeUmProfessorSo, montarEscolaComEntregas, type EscolaComEntregas } from './support/governanca.ts'
import { expect, test } from './support/profiles.ts'
import { criarEquipeComSenha, type EquipeDeTeste } from './support/seed.ts'
import { horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * A governança de IA da coordenação, na aba IA de Registros (MVP, A5; telas da coordenação, 10.0; `docs/interface.md` 11.7; D9, D45, D60, D64;
 * regra 70, itens 5, 6, 8 e 9), contra a API real com o adaptador falso, nos projetos `chromebook` e `celular`. É o passo 5 do roteiro: a
 * escola já tem entregas (`montarEscolaComEntregas`), e a coordenação chega à aba IA de Registros pela lateral. O filtro por estado é o
 * endereço (`?estado=`) e é a API quem filtra; os quatro números são sempre os da escola inteira.
 * Os Agentes estão em `agentes.spec.ts`, e o Analista e o dado nominal em `analista.spec.ts` (vieram daqui na X2, 3.0; na 4.0 o nominal ganhou casos próprios, e a asserção do botão no fim deste arquivo passou a dizer que ele não está aqui).
 */

const INDISPONIVEL = JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })
const COLUNAS = ['O que foi gerado', 'Agente e função', 'Série', 'Gerado em', 'Decisão']

const principal = (page: Page) => page.getByRole('main')
/** O cartão do número de painel: o pai do rótulo. */
const numero = (page: Page, rotulo: string) => principal(page).getByText(rotulo, { exact: true }).first().locator('..')

/** A região da tabela, com o nome que o leitor de tela ouve. */
const regiaoDaTabela = (page: Page) => principal(page).getByRole('region', { name: 'O que a IA gerou e quem aprovou' }).first()
/** O estado de cada linha da tabela (ou item da lista, no celular), na ordem em que estão: o selo da decisão leva `data-aprovacao`. */
const estadosDaLista = (page: Page) => regiaoDaTabela(page).locator('[data-aprovacao]')
const opcaoDoEstado = (page: Page, nome: string) => principal(page).getByRole('radio', { name: nome, exact: true })
const URL_DO_RESUMO = (url: URL) => url.pathname === '/v1/governanca/resumo'

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

function gate(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

interface Cenario {
  readonly coordenadora: EquipeDeTeste
  readonly escola: EscolaComEntregas | undefined
}

/**
 * A coordenadora entra, abre no Painel e vai à aba IA de Registros, que é a Governança. Com `comEntregas`, a escola já tem o que
 * o roteiro deixa até o passo 4.
 */
async function entrar(page: Page, request: APIRequestContext, hasTouch: boolean, comEntregas = true): Promise<Cenario> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  const escola = comEntregas ? await montarEscolaComEntregas(coordenadora.escolaId, coordenadora.usuarioId) : undefined
  await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/painel', () => esperarPainel(page))
  await irPelaCoordenacao(page, 'IA', hasTouch)
  return { coordenadora, escola }
}

test.describe('Governança de IA', () => {
  test('a coordenação vai à aba IA de Registros e vê o que a IA gerou e se uma pessoa aprovou, sem professor, e o consumo em tokens', async ({ page, hasTouch, request }) => {
    const { escola } = await entrar(page, request, hasTouch)
    if (escola === undefined) throw new Error('escola sem entregas')
    await expect(page).toHaveTitle('Registros: IA · Turmma')
    // Quatro artefatos (três listas e uma versão adaptada) e três lotes; três aprovados, um esperando.
    await expect(numero(page, 'Gerado por IA')).toContainText('7', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(numero(page, 'Aprovado por gente')).toContainText('3')
    await expect(numero(page, 'Esperando o professor')).toContainText('1')
    await expect(numero(page, 'Rejeitado')).toContainText('0')

    const tabela = principal(page).getByRole('region', { name: 'O que a IA gerou e quem aprovou' }).first()
    await expect(tabela).toContainText('Correção de objetiva de uma turma')
    await expect(tabela).toContainText('Assistente de ensino · Adaptação')
    await expect(tabela).toContainText(escola.serieNome)
    await expect(tabela).toContainText('Aprovado por um professor')
    await expect(tabela).toContainText('Esperando o professor')
    // Estado nunca só em cor: o selo diz o estado em texto, na família dele.
    await expect(tabela.locator('[data-estado="ok"]').first()).toContainText('Aprovado por')
    await expect(tabela.locator('[data-estado="pendente"]').first()).toContainText('Esperando o professor')
    // Nenhuma coluna, filtro ou ordenação por professor (D45, D64). No computador é tabela; no celular, lista.
    if (!hasTouch) await expect(principal(page).getByRole('columnheader')).toHaveText(COLUNAS)
    await expect(principal(page).getByRole('columnheader', { name: /professor/i })).toHaveCount(0)
    await expect(principal(page).getByRole('combobox')).toHaveCount(0)
    // Nenhum nome de professor nem de aluno, nem turma, em lugar nenhum da tela.
    for (const nome of [...Object.values(escola.professoras), escola.aluno, escola.turmas.doB.nome, escola.turmas.doC.nome]) await expect(principal(page)).not.toContainText(nome)

    const consumo = principal(page).getByRole('region', { name: 'Consumo do mês por função' })
    await expect(consumo).toContainText('Assistente de ensino · Conversa e ferramentas')
    await expect(consumo).toContainText('1.500 tokens · 2 execuções')
    await expect(consumo).toContainText('Tutor · Tutor com o aluno')
    await expect(consumo).toContainText('não é medido')
    await expect(consumo).not.toContainText('R$')

    // O dado nominal de uma turma não abre aqui: mora no fim da página do Analista (X2, 4.0), e a Governança é só agregado.
    await expect(principal(page).getByRole('button', { name: 'Abrir dado nominal de uma turma' })).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('os quatro estados: carregando, erro com "Tentar de novo", com dado, e a escola sem nada gerado explica o que vai aparecer', async ({ page, hasTouch, request }) => {
    const segurada = gate()
    let falhar = true
    await page.route(
      (url) => url.pathname === '/v1/governanca/resumo',
      async (rota: Route) => {
        await segurada.aberta
        if (falhar) return rota.fulfill({ status: 503, contentType: 'application/json', body: INDISPONIVEL })
        return rota.continue()
      },
    )
    const coordenadora = await criarEquipeComSenha('coordenador')
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/painel', () => esperarPainel(page))
    await irPelaCoordenacao(page, 'IA', hasTouch)
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando a governança…' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    segurada.abrir()
    await expect(principal(page).getByRole('alert').filter({ hasText: 'O sistema está indisponível no momento. Tente de novo em instantes.' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(await seriousViolations(page)).toEqual([])
    falhar = false
    await activate(principal(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    // Vazio: a escola ainda não tem nada gerado, e a tela diz o que vai aparecer ali.
    await expect(principal(page)).toContainText('A IA ainda não gerou nada nesta escola', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page)).toContainText('primeiro esperando o professor e depois com a decisão dele')
    await expect(principal(page)).toContainText('Nenhuma função trabalhou neste mês')
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })
})

test.describe('Registros › IA: o filtro por estado', () => {
  test('o servidor filtra a lista pelo estado, o endereço o guarda, e os quatro números continuam os da escola inteira', async ({ page, hasTouch, request }) => {
    test.slow()
    const { escola } = await entrar(page, request, hasTouch)
    if (escola === undefined) throw new Error('escola sem entregas')
    await expect(numero(page, 'Gerado por IA')).toContainText('7', { timeout: SIGN_IN_TIMEOUT_MS })
    // A escola tem três correções aprovadas e uma versão adaptada esperando. Sem filtro, as quatro; "Todos" é a opção marcada.
    await expect(estadosDaLista(page)).toHaveCount(4)
    await expect(opcaoDoEstado(page, 'Todos')).toHaveAttribute('aria-checked', 'true')
    const numerosAntes = ['Gerado por IA', 'Aprovado por gente', 'Esperando o professor', 'Rejeitado']
    const textoDosNumeros = async () => Promise.all(numerosAntes.map((rotulo) => numero(page, rotulo).innerText()))
    const antes = await textoDosNumeros()

    await activate(opcaoDoEstado(page, 'Aprovados'), hasTouch)
    await expect(page).toHaveURL(/\/governanca\?estado=aprovada$/)
    await expect(estadosDaLista(page)).toHaveCount(3)
    for (const selo of await estadosDaLista(page).all()) await expect(selo).toHaveAttribute('data-aprovacao', 'aprovada')
    await expect(regiaoDaTabela(page)).toContainText('Aprovado por um professor')
    await expect(regiaoDaTabela(page)).not.toContainText('Assistente de ensino · Adaptação')

    await activate(opcaoDoEstado(page, 'Esperando o professor'), hasTouch)
    await expect(page).toHaveURL(/\/governanca\?estado=pendente$/)
    await expect(estadosDaLista(page)).toHaveCount(1)
    await expect(estadosDaLista(page).first()).toHaveAttribute('data-aprovacao', 'pendente')
    await expect(regiaoDaTabela(page)).toContainText('Assistente de ensino · Adaptação')
    await expect(regiaoDaTabela(page)).not.toContainText('Correção de objetiva de uma turma')

    // Nenhuma entrega foi rejeitada: o filtro diz isso, e a lista inteira não fica no lugar do vazio.
    await activate(opcaoDoEstado(page, 'Rejeitados'), hasTouch)
    await expect(page).toHaveURL(/\/governanca\?estado=rejeitada$/)
    await expect(principal(page)).toContainText('Nenhuma entrega rejeitada')
    await expect(estadosDaLista(page)).toHaveCount(0)
    await expect(principal(page)).not.toContainText('A IA ainda não gerou nada nesta escola')

    // Os números não se mexeram em nenhum filtro: são os da escola inteira, também com "Rejeitados" vazio.
    expect(await textoDosNumeros()).toEqual(antes)
    await expect(numero(page, 'Rejeitado')).toContainText('0')

    await activate(opcaoDoEstado(page, 'Todos'), hasTouch)
    await expect(page).toHaveURL(/\/governanca$/)
    await expect(estadosDaLista(page)).toHaveCount(4)
    for (const nome of [...Object.values(escola.professoras), escola.aluno, escola.turmas.doB.nome, escola.turmas.doC.nome]) await expect(principal(page)).not.toContainText(nome)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('o filtro pelo endereço: abre já filtrado, o recarregar o mantém, e valor desconhecido abre sem filtro', async ({ page, hasTouch, request }) => {
    test.slow()
    const { escola } = await entrar(page, request, hasTouch)
    if (escola === undefined) throw new Error('escola sem entregas')
    await expect(estadosDaLista(page)).toHaveCount(4, { timeout: SIGN_IN_TIMEOUT_MS })

    await page.goto('/coordenacao/governanca?estado=aprovada')
    await expect(opcaoDoEstado(page, 'Aprovados')).toHaveAttribute('aria-checked', 'true', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(estadosDaLista(page)).toHaveCount(3)
    await expect(numero(page, 'Gerado por IA')).toContainText('7')
    await page.reload()
    await expect(opcaoDoEstado(page, 'Aprovados')).toHaveAttribute('aria-checked', 'true', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(estadosDaLista(page)).toHaveCount(3)

    // O que não é estado é ignorado: abre sem filtro e a API nunca o recebe.
    const pedidos: string[] = []
    page.on('request', (pedido) => {
      const url = new URL(pedido.url())
      if (URL_DO_RESUMO(url)) pedidos.push(url.search)
    })
    await page.goto('/coordenacao/governanca?estado=professor')
    await expect(opcaoDoEstado(page, 'Todos')).toHaveAttribute('aria-checked', 'true', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(estadosDaLista(page)).toHaveCount(4)
    expect(pedidos.length).toBeGreaterThan(0)
    for (const consulta of pedidos) expect(consulta).not.toContain('estado')
  })

  test('a resposta do filtro antigo, que chega depois, não cai na lista do filtro novo', async ({ page, hasTouch, request }) => {
    test.slow()
    const { escola } = await entrar(page, request, hasTouch)
    if (escola === undefined) throw new Error('escola sem entregas')
    await expect(estadosDaLista(page)).toHaveCount(4, { timeout: SIGN_IN_TIMEOUT_MS })
    const segurada = gate()
    await page.route(
      (url) => URL_DO_RESUMO(url) && url.searchParams.get('estado') === 'aprovada',
      async (rota: Route) => {
        await segurada.aberta
        await rota.continue().catch(() => undefined)
      },
    )
    // O pedido do filtro antigo termina de um jeito ou de outro: a resposta chega (`requestfinished`) ou o TanStack o aborta ao trocar
    // de chave (`requestfailed`). Quem espera por ele é este evento, escutado antes de o pedido sair, e não um prazo.
    const pedidoAntigoTerminou = new Promise<void>((resolver) => {
      const aoTerminar = (pedido: Request) => {
        const url = new URL(pedido.url())
        if (URL_DO_RESUMO(url) && url.searchParams.get('estado') === 'aprovada') resolver()
      }
      page.on('requestfinished', aoTerminar)
      page.on('requestfailed', aoTerminar)
    })
    await activate(opcaoDoEstado(page, 'Aprovados'), hasTouch)
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando a lista…' })).toBeVisible()
    // Antes de a primeira voltar, a pessoa troca de filtro e a lista do novo chega.
    await activate(opcaoDoEstado(page, 'Esperando o professor'), hasTouch)
    await expect(estadosDaLista(page)).toHaveCount(1)
    await expect(estadosDaLista(page).first()).toHaveAttribute('data-aprovacao', 'pendente')
    segurada.abrir()
    // A resposta atrasada já teve a sua vez: agora a lista tem de continuar sendo a de "Esperando o professor".
    await pedidoAntigoTerminou
    await expect(estadosDaLista(page)).toHaveCount(1)
    await expect(estadosDaLista(page).first()).toHaveAttribute('data-aprovacao', 'pendente')
    await expect(opcaoDoEstado(page, 'Esperando o professor')).toHaveAttribute('aria-checked', 'true')
    await expect(page).toHaveURL(/\/governanca\?estado=pendente$/)
  })
})

test.describe('Registros › IA: a série com um professor só', () => {
  test('a entrega dela conta nos números e não entra na lista, nem no filtro', async ({ page, hasTouch, request }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const escola = await montarEscolaComEntregas(coordenadora.escolaId, coordenadora.usuarioId)
    const umSo = await acrescentarSerieDeUmProfessorSo(coordenadora.escolaId)
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/painel', () => esperarPainel(page))
    await irPelaCoordenacao(page, 'IA', hasTouch)
    // Os sete de antes, mais o artefato original e a versão adaptada; as duas esperando agora.
    await expect(numero(page, 'Gerado por IA')).toContainText('9', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(numero(page, 'Esperando o professor')).toContainText('2')
    await expect(estadosDaLista(page)).toHaveCount(4)
    await expect(regiaoDaTabela(page)).toContainText(escola.serieNome)
    await expect(regiaoDaTabela(page)).not.toContainText(umSo.serieNome)
    await activate(opcaoDoEstado(page, 'Esperando o professor'), hasTouch)
    await expect(estadosDaLista(page)).toHaveCount(1)
    await expect(regiaoDaTabela(page)).not.toContainText(umSo.serieNome)
    await expect(numero(page, 'Esperando o professor')).toContainText('2')
    await expect(principal(page)).not.toContainText(umSo.professora)
  })
})

test.describe('Registros › IA: o recomeço pela pessoa seguinte', () => {
  test('o filtro e a lista da escola anterior não aparecem para a coordenação que entra depois, na mesma aba', async ({ page, hasTouch, request }) => {
    test.slow()
    const primeira = await criarEquipeComSenha('coordenador')
    const escola = await montarEscolaComEntregas(primeira.escolaId, primeira.usuarioId)
    const segunda = await criarEquipeComSenha('coordenador')

    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, primeira, '/coordenacao/painel', () => esperarPainel(page))
    await irPelaCoordenacao(page, 'IA', hasTouch)
    await expect(estadosDaLista(page)).toHaveCount(4, { timeout: SIGN_IN_TIMEOUT_MS })
    await activate(opcaoDoEstado(page, 'Aprovados'), hasTouch)
    await expect(estadosDaLista(page)).toHaveCount(3)

    await activate(page.getByRole('button', { name: 'Sair' }).first(), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    // Da entrada da pessoa seguinte em diante, qualquer momento em que a tela mostra uma linha de decisão ou o número da escola anterior é registrado.
    await page.evaluate(() => {
      const vazamentos: string[] = []
      ;(window as unknown as { __vazamentos: string[] }).__vazamentos = vazamentos
      const ler = () => {
        if (document.querySelector('[data-aprovacao]') !== null) vazamentos.push('linha de decisão')
        if (document.body.textContent?.includes('Correção de objetiva de uma turma') === true) vazamentos.push('correção da escola anterior')
      }
      new MutationObserver(ler).observe(document.body, { subtree: true, childList: true, characterData: true })
    })

    // O segundo fator é configurado pela API: o caso é sobre o que a aba mostra da pessoa anterior, e o login pela tela continua.
    const { segredo } = await configurarSegundoFatorPelaApi(request, segunda)
    await entrarPelaTelaComSegundoFator(page, segunda, segredo, hasTouch)
    await esperarPainel(page)
    await irPelaCoordenacao(page, 'IA', hasTouch)
    // A escola da segunda pessoa não gerou nada: o vazio dela, sem filtro herdado, e os números dela.
    await expect(principal(page)).toContainText('A IA ainda não gerou nada nesta escola', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(numero(page, 'Gerado por IA')).toContainText('0')
    await expect(opcaoDoEstado(page, 'Todos')).toHaveAttribute('aria-checked', 'true')
    await expect(page).not.toHaveURL(/estado=/)
    await expect(estadosDaLista(page)).toHaveCount(0)
    expect(await page.content()).not.toContain(escola.serieNome)
    expect(await page.evaluate(() => (window as unknown as { __vazamentos: string[] }).__vazamentos)).toEqual([])
  })
})

test.describe('Registros › IA: o tamanho nas duas larguras', () => {
  test('a página não rola, a tabela vira lista no celular, e o consumo fica ao lado da tabela no computador e embaixo dela no celular', async ({ page, hasTouch, request }) => {
    test.slow()
    const { escola } = await entrar(page, request, hasTouch)
    if (escola === undefined) throw new Error('escola sem entregas')
    await expect(estadosDaLista(page)).toHaveCount(4, { timeout: SIGN_IN_TIMEOUT_MS })
    const consumo = principal(page).getByRole('region', { name: 'Consumo do mês por função' })
    await expect(consumo).toContainText('1.500 tokens · 2 execuções')

    await paginaNaoRola(page)
    const largura = page.viewportSize()?.width ?? 0
    // Os quatro rótulos do filtro cabem dentro do botão: nenhum texto sai da opção, a 360 px nem a 1366 px.
    const rotulosQueSaem = await principal(page)
      .getByRole('radiogroup', { name: 'Estado' })
      .getByRole('radio')
      .evaluateAll((opcoes) => opcoes.filter((opcao) => opcao.scrollWidth > opcao.clientWidth).map((opcao) => opcao.textContent))
    expect(rotulosQueSaem).toEqual([])
    const tabela = regiaoDaTabela(page)
    await expect(linhasDaTabela(tabela)).toHaveCount(4)
    if (largura < 768) {
      // No celular a tabela é uma lista, sem rolagem de lado, e o consumo vem depois dela.
      await expect(principal(page).locator('[data-tabela="lista"]')).toBeVisible()
      await expect(principal(page).locator('[data-tabela="tabela"]')).toHaveCount(0)
    } else {
      await expect(principal(page).locator('[data-tabela="tabela"]')).toBeVisible()
    }
    const caixaDaTabela = await tabela.boundingBox()
    const caixaDoConsumo = await consumo.boundingBox()
    if (caixaDaTabela === null || caixaDoConsumo === null) throw new Error('a tabela e o consumo precisam estar na tela')
    if (largura >= 1024) {
      // Ao lado: o consumo começa onde a tabela termina, e os dois se sobrepõem na altura.
      expect(caixaDoConsumo.x).toBeGreaterThanOrEqual(caixaDaTabela.x + caixaDaTabela.width - 1)
      expect(caixaDoConsumo.y).toBeLessThan(caixaDaTabela.y + caixaDaTabela.height)
    } else {
      // Embaixo: o consumo começa abaixo do fim da tabela.
      expect(caixaDoConsumo.y).toBeGreaterThanOrEqual(caixaDaTabela.y + caixaDaTabela.height - 1)
    }
    // Com um filtro e na lista vazia o tamanho também fecha.
    await activate(opcaoDoEstado(page, 'Rejeitados'), hasTouch)
    await expect(principal(page)).toContainText('Nenhuma entrega rejeitada')
    await paginaNaoRola(page)
    expect(await seriousViolations(page)).toEqual([])
  })
})
