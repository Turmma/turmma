import { randomUUID } from 'node:crypto'
import type { Locator, Page } from '@playwright/test'
import { atividadeSintetica, entregaDoLote, loteSintetico, mockAssistenteApi, type AssistenteApiMock } from './support/assistente.ts'
import { minhaAtividade, provaDa, mockAlunoApi } from './support/aluno.ts'
import { entrarComoAluno, entrarComoCoordenacaoNaMesmaAba, entrarPorEmail, esperarNovaConversa, gaveta, irPelaNavegacao, SIGN_IN_TIMEOUT_MS, reservaDaBarraDeBaixo, secoes } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { colocarAlunoNaTurma, confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarAlunoComMatricula, criarEquipeComSenha, renomearEscolaNoBanco } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * A casca da escola no celular (X1, 13.0; `docs/interface.md` 11.1; D80; RF14, RF15): a barra de topo de 56 px, a barra de
 * baixo de 68 px com os itens do professor e do aluno, e a gaveta com o resto. A coordenação, com quatro lugares, também usa a
 * barra (X2). A 360 px, a janela mais estreita (D51). A gaveta modal, o foco e a troca de largura estão em
 * `casca.spec.ts`; aqui é o que a barra de baixo reserva e o que cabe nela.
 */

const LARGURA = 360
const ALTURA_DA_JANELA = 800
/** Os 68 px da `docs/interface.md` 11.1, sem a área segura (nenhuma no navegador de teste). */
const ALTURA_DA_BARRA_PX = 68
const ALTURA_DO_TOPO_PX = 56
const SCREEN_TIMEOUT_MS = 15_000
/**
 * Quanto o `/v1/eu` demora a voltar no caso do ajudante de navegação: o toque no menu, contado do pedido e não do fim do
 * `page.reload()`, tem de acontecer antes da resposta mesmo num runner carregado, ou o caso passaria verde sem a correção. O
 * caso é novo e o portão cobra metade dos 30 s (`test.slow()` posto agora não conta): mais que isto ele passa dos 15 s.
 */
const ATRASO_DA_SESSAO_MS = 3_000
const PRAZO_DA_ACAO_MS = 15_000

const NOME_COMPRIDO = 'Colégio Estadual de Educação Básica Professora Maria das Dores Albuquerque de Sá e Silva do Vale do Itajaí'

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  await (hasTouch ? alvo.tap() : alvo.click())
}

async function irPara(page: Page, caminho: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState(null, '', destino)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, caminho)
}

async function caixaDe(alvo: Locator, o: string) {
  const caixa = await alvo.boundingBox()
  expect(caixa, `${o} sem caixa`).not.toBeNull()
  if (caixa === null) throw new Error(`${o} sem caixa`)
  return caixa
}

async function esperarAlvoDe44(alvo: Locator, o: string): Promise<void> {
  const caixa = await caixaDe(alvo, o)
  expect(caixa.width, `${o}: largura`).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  expect(caixa.height, `${o}: altura`).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
}

/** Rola a página até o fim, que é onde o último botão da tela precisa estar acima da barra. */
async function rolarAteOFim(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForFunction(() => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1)
}

/** Uma professora com a turma de Química confirmada e a API da fase 3 simulada, na janela do celular. */
async function entrarComoProfessoraDeTurma(page: Page, hasTouch: boolean, antes?: (api: AssistenteApiMock, turmaId: string) => void, nomeDaEscola?: string) {
  await page.setViewportSize({ width: LARGURA, height: ALTURA_DA_JANELA })
  const api = await mockAssistenteApi(page)
  const professora = await criarEquipeComSenha()
  if (nomeDaEscola !== undefined) await renomearEscolaNoBanco(professora.escolaId, nomeDaEscola)
  const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Química'])
  await confirmarVinculosNoBanco(professora.escolaId, alocacao.vinculoIds)
  antes?.(api, alocacao.turmaId)
  await page.goto('/entrar')
  await entrarPorEmail(page, professora, hasTouch)
  await esperarNovaConversa(page, professora.nome)
  return { api, turmaId: alocacao.turmaId }
}

test.describe('a casca da escola no celular', () => {
  test('o professor tem os três itens na barra de baixo, à vista sem abrir nada, de 44 px, e a gaveta fica com o resto', async ({ page, hasTouch }) => {
    await entrarComoProfessoraDeTurma(page, hasTouch)

    // `Seções` é uma só (A14, negativa), à vista com a gaveta fechada, e a gaveta nem abriu.
    await expect(page.getByRole('navigation', { name: 'Seções' })).toHaveCount(1)
    await expect(gaveta(page)).toBeHidden()
    await expect(secoes(page).getByRole('link')).toHaveText(['Início', 'Turmas', 'Ferramentas', 'Criados'])
    await expect(secoes(page).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')

    // A barra: fixa no pé da janela, com 68 px, e cada item é um alvo de 44 px ou mais (A13, A93, A95).
    const barra = await caixaDe(secoes(page), 'a barra de baixo')
    expect(Math.round(barra.height)).toBe(ALTURA_DA_BARRA_PX)
    expect(Math.round(barra.y + barra.height)).toBe(ALTURA_DA_JANELA)
    expect(Math.round(barra.width)).toBe(LARGURA)
    for (const rotulo of ['Início', 'Turmas', 'Ferramentas', 'Criados']) await esperarAlvoDe44(secoes(page).getByRole('link', { name: rotulo }), rotulo)
    // A pílula que segura o ícone é de 48 × 36 (13.1), e a borda de 2 px entra nessa conta.
    for (const rotulo of ['Início', 'Turmas', 'Ferramentas', 'Criados']) {
      const pilula = await caixaDe(secoes(page).getByRole('link', { name: rotulo }).locator('[data-pilula]'), `a pílula de ${rotulo}`)
      expect([Math.round(pilula.width), Math.round(pilula.height)], `a pílula de ${rotulo}`).toEqual([48, 36])
    }
    // O `<main>` guarda os 68 px dela mais os 32 px de sempre.
    expect((await reservaDaBarraDeBaixo(page)).paddingDoMain).toBe(`${String(ALTURA_DA_BARRA_PX + 32)}px`)

    // A barra de topo: 56 px, com o menu e o "Sair" também de 44 px.
    const topo = await caixaDe(page.getByRole('banner'), 'a barra de topo')
    expect(Math.round(topo.height)).toBe(ALTURA_DO_TOPO_PX)
    await esperarAlvoDe44(page.getByRole('button', { name: 'Abrir o menu' }), 'Abrir o menu')
    await esperarAlvoDe44(page.getByRole('banner').getByRole('button', { name: 'Sair' }), 'Sair')
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    // A gaveta leva escola e "Sua conta", e já não leva `Seções`, que é da barra, nem "Seu time", que saiu da lateral (telas do professor, 2.0).
    await activate(page.getByRole('button', { name: 'Abrir o menu' }), hasTouch)
    await expect(gaveta(page)).toBeVisible()
    await expect(gaveta(page).getByRole('navigation', { name: 'Seções' })).toHaveCount(0)
    await expect(gaveta(page).getByRole('navigation', { name: 'Seu time' })).toHaveCount(0)
    await expect(gaveta(page).getByRole('navigation', { name: 'Sua conta', exact: true })).toHaveCount(1)
    // A gaveta fica por cima da barra de topo e deixa fora uma faixa da janela para o toque que a fecha (A16).
    const painel = await caixaDe(gaveta(page), 'a gaveta')
    expect(painel.width).toBeLessThan(LARGURA)
  })

  test('o nome comprido da escola é cortado com reticências na barra de topo, e o "Sair" continua à vista a 360 px', async ({ page, hasTouch }) => {
    await entrarComoProfessoraDeTurma(page, hasTouch, undefined, NOME_COMPRIDO)

    const topo = page.getByRole('banner')
    const escola = topo.getByText(NOME_COMPRIDO)
    await expect(escola).toBeVisible()
    const corte = await escola.evaluate((elemento) => ({ cortado: elemento.scrollWidth > elemento.clientWidth, estilo: getComputedStyle(elemento).textOverflow }))
    expect(corte).toEqual({ cortado: true, estilo: 'ellipsis' })
    expect(await horizontalOverflow(page)).toBe(0)

    const sair = await caixaDe(topo.getByRole('button', { name: 'Sair' }), 'o "Sair"')
    expect(sair.x).toBeGreaterThanOrEqual(0)
    expect(sair.x + sair.width).toBeLessThanOrEqual(LARGURA)
    await esperarAlvoDe44(topo.getByRole('button', { name: 'Sair' }), 'Sair')
  })

  test('com o lote para aprovar, o último botão termina acima da barra e a barra presa da aprovação fica à vista, acima dela (A75)', async ({ page, hasTouch }) => {
    test.slow()
    const { api } = await entrarComoProfessoraDeTurma(page, hasTouch, (simulada, turmaId) => {
      const aplicada = { id: randomUUID(), titulo: 'Atividade de estequiometria' }
      const lote = loteSintetico(aplicada)
      simulada.correcoes.set(aplicada.id, lote)
      simulada.entregas = [entregaDoLote(lote, turmaId)]
    })
    const atividadeId = [...api.correcoes.keys()][0] ?? ''
    await irPara(page, `/professor/aprovar/${atividadeId}`)

    const aprovacao = page.getByRole('group', { name: 'Aprovação do lote' })
    await expect(aprovacao).toBeVisible({ timeout: SCREEN_TIMEOUT_MS })
    const barra = await caixaDe(secoes(page), 'a barra de baixo')

    // Em qualquer ponto da rolagem a barra presa está à vista e termina acima da de navegação.
    for (const rolar of [false, true]) {
      if (rolar) await rolarAteOFim(page)
      const presa = await caixaDe(aprovacao, 'a barra presa da aprovação')
      expect(presa.y, 'a aprovação à vista').toBeGreaterThanOrEqual(0)
      expect(presa.y + presa.height, `a aprovação acima da barra de baixo (rolou: ${String(rolar)})`).toBeLessThanOrEqual(barra.y + 1)
    }

    // No fim da página, o último botão não fica atrás da barra: o `<main>` guarda os 68 px dela (RF14).
    const ultimo = await page.evaluate(() => {
      const principal = document.querySelector('main')
      const botoes = [...(principal?.querySelectorAll<HTMLElement>('button, a[href]') ?? [])].filter((elemento) => elemento.getClientRects().length > 0)
      const fundo = Math.max(...botoes.map((elemento) => elemento.getBoundingClientRect().bottom))
      return { fundo, limite: (document.querySelector('nav[aria-label="Seções"]') as HTMLElement | null)?.getBoundingClientRect().top ?? Number.NaN }
    })
    expect(ultimo.fundo).toBeLessThanOrEqual(ultimo.limite + 1)
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('o aluno tem os três itens na barra de baixo, e a faixa do Tutor e o "Hoje: N de 60" ficam à vista, acima dela (A54, A55)', async ({ page, hasTouch }) => {
    test.slow()
    await page.setViewportSize({ width: LARGURA, height: ALTURA_DA_JANELA })
    const api = await mockAlunoApi(page)
    const atividade = minhaAtividade()
    api.atividades = [atividade]
    api.provas.set(atividade.id, provaDa(atividade))
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)

    await expect(page.getByRole('navigation', { name: 'Seções' })).toHaveCount(1)
    await expect(secoes(page).getByRole('link')).toHaveText(['Início', 'Tarefas', 'Eu'])
    for (const rotulo of ['Início', 'Tarefas', 'Eu']) await esperarAlvoDe44(secoes(page).getByRole('link', { name: rotulo, exact: true }), rotulo)

    // O aluno abre no Início (X4, 3.0): a tarefa para fazer e a faixa já estão ali, e o Tutor da atividade é o próximo toque.
    await expect(page).toHaveURL(/\/aluno\/inicio$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await activate(page.getByRole('main').getByRole('link', { name: 'Pedir ajuda ao Tutor' }), hasTouch)
    await expect(page).toHaveURL(new RegExp(`/aluno/tutor/${atividade.id}$`), { timeout: SCREEN_TIMEOUT_MS })

    const faixa = page.getByRole('main').locator('[data-faixa-de-supervisao]')
    const uso = page.getByRole('main').locator('[data-uso-do-dia]')
    await expect(uso).toContainText('Hoje: 12 de 60 perguntas', { timeout: SCREEN_TIMEOUT_MS })
    const barra = await caixaDe(secoes(page), 'a barra de baixo')
    const doTopo = await caixaDe(page.getByRole('banner'), 'a barra de topo')

    await rolarAteOFim(page)
    // A faixa não fecha (D47): presa logo abaixo da barra de topo, à vista com a página no fim.
    const supervisao = await caixaDe(faixa, 'a faixa de supervisão')
    expect(supervisao.y).toBeGreaterThanOrEqual(doTopo.y + doTopo.height - 1)
    expect(supervisao.y + supervisao.height).toBeLessThanOrEqual(barra.y + 1)
    // O uso do dia termina acima da barra de baixo, não atrás dela.
    const usoDoDia = await caixaDe(uso, 'o uso do dia')
    expect(usoDoDia.y + usoDoDia.height).toBeLessThanOrEqual(barra.y + 1)
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('a coordenação tem os quatro lugares na barra de baixo, à vista sem abrir nada, de 44 px, e a gaveta nem abre', async ({ page, hasTouch }) => {
    test.slow()
    await page.setViewportSize({ width: LARGURA, height: ALTURA_DA_JANELA })
    const coordenadora = await criarEquipeComSenha('coordenador')
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)

    // Com quatro itens a coordenação cabe na barra (X2, RF1): `Seções` é uma só, à vista, e a gaveta continua fechada.
    await expect(page.getByRole('navigation', { name: 'Seções' })).toHaveCount(1)
    await expect(gaveta(page)).toBeHidden()
    const itens = secoes(page).getByRole('link')
    await expect(itens).toHaveText(['Painel', 'Analista', 'Escola', 'Registros'])
    await expect(secoes(page).getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page')

    // A barra: fixa no pé da janela, com 68 px, e o conteúdo reserva o lugar dela.
    const barra = await caixaDe(secoes(page), 'a barra de baixo')
    expect(Math.round(barra.height)).toBe(ALTURA_DA_BARRA_PX)
    expect(Math.round(barra.y + barra.height)).toBe(ALTURA_DA_JANELA)
    expect(Math.round(barra.width)).toBe(LARGURA)
    expect((await reservaDaBarraDeBaixo(page)).paddingDoMain).toBe(`${String(ALTURA_DA_BARRA_PX + 32)}px`)
    for (let indice = 0; indice < 4; indice++) await esperarAlvoDe44(itens.nth(indice), `item ${String(indice)}`)
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('o ajudante de navegação espera a sessão depois do recarregamento: com o /v1/eu atrasado, a gaveta não fica aberta por cima da barra de baixo', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: LARGURA, height: ALTURA_DA_JANELA })
    const professora = await criarEquipeComSenha()
    await page.goto('/entrar')
    await entrarPorEmail(page, professora, hasTouch)
    await expect(page).toHaveURL(/\/professor\//, { timeout: SIGN_IN_TIMEOUT_MS })

    // CPU lenta e rede de escola: a barra do topo e o botão do menu já estão na tela, e os itens só chegam com a sessão.
    // O toque que a gaveta intercepta não passa: com o prazo curto de ação o caso cai em segundos, e não no teto do teste.
    // Vale só para a página deste caso: não copie para um `beforeEach`, que encurtaria o prazo dos outros sem aviso.
    page.setDefaultTimeout(PRAZO_DA_ACAO_MS)
    await page.route('**/v1/eu', async (rota) => {
      await new Promise((resolver) => setTimeout(resolver, ATRASO_DA_SESSAO_MS))
      await rota.continue()
    })
    await page.reload()
    await irPelaNavegacao(page, 'Criados', hasTouch)

    await expect(page).toHaveURL(/\/professor\/criados$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(gaveta(page)).toBeHidden()
  })

  /**
   * "Criados" com dezesseis coisas já geradas: uma tela comprida, **sem `StickyFooter`**. É isso que prova a reserva da barra de
   * baixo, e não a da barra presa: a `StickyFooter` sobe sozinha e grava a reserva dela em linha, e com ela na tela o `<main>`
   * e o `scroll-padding` do `<html>` nunca seriam o que falha. A lista termina num controle (o último artefato).
   */
  async function entrarNaTelaComprida(page: Page, hasTouch: boolean): Promise<void> {
    await entrarComoProfessoraDeTurma(page, hasTouch, (simulada, turmaId) => {
      simulada.artefatos = Array.from({ length: 16 }, (_, indice) => atividadeSintetica(turmaId, randomUUID(), { titulo: `Atividade de estequiometria ${String(indice + 1)}` }))
    })
    await activate(secoes(page).getByRole('link', { name: 'Criados' }), hasTouch)
    await expect(page).toHaveURL(/\/professor\/criados$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('[data-artefato]')).toHaveCount(16, { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.locator('[data-barra-presa]')).toHaveCount(0)
    const rola = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
    expect(rola, 'a tela de teste precisa rolar bem mais que a barra de baixo').toBeGreaterThan(ALTURA_DA_BARRA_PX * 2)
  }

  test('sem barra presa, rolada até o fim, o último controle termina acima da barra de baixo (A75, RF14)', async ({ page, hasTouch }) => {
    test.slow()
    await entrarNaTelaComprida(page, hasTouch)
    await rolarAteOFim(page)

    const barra = await caixaDe(secoes(page), 'a barra de baixo')
    const ultimo = await caixaDe(page.locator('[data-artefato]').last(), 'o último artefato')
    expect(ultimo.y + ultimo.height, 'o último controle acima da barra de baixo').toBeLessThanOrEqual(barra.y + 1)
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('o foco do teclado no meio da tela comprida para acima da barra de baixo, e não atrás dela (WCAG 2.4.11, RF23)', async ({ page, hasTouch }) => {
    test.slow()
    await entrarNaTelaComprida(page, hasTouch)
    const barra = await caixaDe(secoes(page), 'a barra de baixo')

    // Do botão do menu, o Tab percorre a barra de topo e o `<main>`, até chegar à barra de baixo. Cada controle do `<main>`
    // que o navegador rola para a vista termina acima dela.
    await page.getByRole('button', { name: 'Abrir o menu' }).focus()
    let noMain = 0
    let rolouParaChegar = false
    let anelDoItem: { visivel: boolean; largura: string; afastamento: string } | null = null
    for (let tecla = 0; tecla < 40; tecla++) {
      await page.keyboard.press('Tab')
      // O navegador rola o controle para a vista no próprio quadro; dois quadros deixam a rolagem assentar.
      await page.evaluate(() => new Promise<void>((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver()))))
      const foco = await page.evaluate(() => {
        const elemento = document.activeElement
        const caixa = elemento?.getBoundingClientRect()
        return {
          naBarraDeBaixo: elemento?.closest('nav[aria-label="Seções"]') != null,
          noMain: elemento?.closest('main') != null,
          fundo: caixa?.bottom ?? Number.NaN,
          rolagem: window.scrollY,
          anel: elemento === null ? null : { visivel: elemento.matches(':focus-visible'), largura: getComputedStyle(elemento).outlineWidth, afastamento: getComputedStyle(elemento).outlineOffset },
        }
      })
      if (foco.naBarraDeBaixo) {
        anelDoItem = foco.anel
        break
      }
      if (!foco.noMain) continue
      noMain += 1
      if (foco.rolagem > 0) rolouParaChegar = true
      expect(foco.fundo, `o ${String(noMain)}º controle do <main> termina acima da barra de baixo`).toBeLessThanOrEqual(barra.y + 1)
    }
    expect(noMain, 'o Tab passou por todos os controles da tela').toBeGreaterThanOrEqual(15)
    expect(rolouParaChegar, 'a tela rolou para levar o foco: sem rolagem, a prova não prova nada').toBe(true)
    // O primeiro item da barra, chegado pelo Tab: o anel de 3 px vai por dentro (−3 px). A barra encosta no pé e nas
    // laterais da janela, e o anel por fora seria cortado (`docs/interface.md` 10.1; `cenarios.md` A5, no celular).
    expect(anelDoItem, 'o Tab chegou à barra de baixo').toEqual({ visivel: true, largura: '3px', afastamento: '-3px' })
  })

  /**
   * A auditoria de alvo de toque (`seriousViolations`) não depende de onde a rolagem parou. O axe tira do alvo a área que um
   * elemento sobreposto cobre, e a barra de topo, presa por `sticky`, cobre o pedaço de um controle que passa por baixo
   * dela; com um vizinho ao lado e só 8 px à vista, o botão de 28 px reprova o `target-size`, embora nada esteja errado com
   * ele, que a pessoa rola para a vista. Foi isso que deixou o W6 e o A2 vermelhos no celular (correção
   * `2026-10-16-alvo-de-toque-sob-a-barra-de-baixo`: a causa era a barra de topo, e não a de baixo). Que o último controle
   * termina acima da barra de baixo é provado nos testes de cima, por medida. Os controles são da própria prova (três
   * botões de 28 px, lado a lado), postos na tela comprida: a rolagem é a que o teste manda, e não a que a tela calhou de ter.
   */
  test('o controle cortado pela barra de topo no meio da rolagem não reprova a auditoria de alvo de toque, e a auditoria devolve as barras como estavam', async ({ page, hasTouch }) => {
    test.slow()
    await entrarNaTelaComprida(page, hasTouch)
    // Uma fileira de controles pequenos antes do 3º artefato.
    await page.evaluate(() => {
      const linha = document.createElement('li')
      linha.setAttribute('data-sonda', '')
      linha.style.cssText = 'display:flex;gap:4px;height:28px'
      for (const rotulo of ['a', 'b', 'c']) {
        const botao = document.createElement('button')
        botao.type = 'button'
        botao.textContent = rotulo
        botao.style.cssText = 'min-width:28px;min-height:28px;border:2px solid currentColor;border-radius:6px'
        linha.append(botao)
      }
      document.querySelectorAll<HTMLElement>('[data-artefato]')[2]?.closest('li')?.before(linha)
      // Duas barras presas com o que a auditoria tem de devolver: a de topo com um `pointer-events` em linha, e uma sem nenhum.
      document.querySelector<HTMLElement>('header')?.style.setProperty('pointer-events', 'auto', 'important')
      const semValor = document.createElement('div')
      semValor.setAttribute('data-presa-sem-valor', '')
      semValor.style.cssText = 'position:sticky;top:0;height:0'
      document.querySelector('main')?.append(semValor)
    })

    // Rola até a base da fileira ficar 8 px abaixo da barra de topo: só esses 8 px estão à vista, o resto está por baixo dela.
    const fileira = await page.locator('[data-sonda]').evaluate((linha, aVer) => {
      window.scrollBy(0, linha.getBoundingClientRect().bottom - (aVer.topo + aVer.vista))
      const caixa = linha.getBoundingClientRect()
      return { topo: caixa.top, base: caixa.bottom }
    }, { topo: ALTURA_DO_TOPO_PX, vista: 8 })
    expect(fileira.base, 'a fileira termina 8 px abaixo da barra de topo').toBeCloseTo(ALTURA_DO_TOPO_PX + 8, 0)
    expect(fileira.topo, 'e começa por baixo dela').toBeLessThan(ALTURA_DO_TOPO_PX - 8)
    expect(await seriousViolations(page), 'cortada pela barra de topo').toEqual([])

    // A auditoria devolve as barras como estavam: a que tinha valor em linha, com a prioridade, e a que não tinha, sem nenhum;
    // e nada fica marcado na página.
    expect(await page.getByRole('banner').evaluate((topo) => [topo.style.getPropertyValue('pointer-events'), topo.style.getPropertyPriority('pointer-events')])).toEqual(['auto', 'important'])
    expect(await page.locator('[data-presa-sem-valor]').evaluate((presa) => [presa.style.getPropertyValue('pointer-events'), getComputedStyle(presa).pointerEvents])).toEqual(['', 'auto'])
    expect(await page.evaluate(() => 'barrasPresasDaAuditoria' in window)).toBe(false)
  })
})
