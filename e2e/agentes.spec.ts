import type { Locator, Page, Request, Route } from '@playwright/test'
import { abrirNavegacao, entrarComoCoordenacaoNaMesmaAba, esperarPainel, lateral, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { irPelaCoordenacao, paginaNaoRola } from './support/coordenacao.ts'
import { conferirAssinaturas, conferirQueAOncaNaoTemNome, conferirTamanhoDoAvatar } from './support/avatar.ts'
import { auditoriasNoBanco, montarEscolaComEntregas, suspensoesNoBanco, suspenderFuncaoPorOutraPessoa, type EscolaComEntregas } from './support/governanca.ts'
import { expect, test } from './support/profiles.ts'
import { criarEquipeComSenha, type EquipeDeTeste } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, larguraExcedenteDoDialogo, seriousViolations } from './support/checks.ts'

/**
 * "Como cada IA trabalha" (X2, 11.0; RF19): a página dos agentes da coordenação, dentro de Registros, no link "Como cada IA trabalha" da
 * aba IA. Uma IA por vez, escolhida no seletor "Qual IA" e guardada no endereço (`?ia=`), com as funções dela; a suspensão da correção
 * de objetiva pelo diálogo e a retomada, com o registro no banco; a função que outra pessoa já suspendeu; o recomeço (a falha com o
 * diálogo aberto, o clique duplo e a coordenação seguinte na mesma aba); e o tamanho nas duas larguras.
 */

const principal = (page: Page) => page.getByRole('main')

const dialogo = (page: Page) => page.getByRole('alertdialog')

/** O cartão do agente escolhido: um só por vez. */
const cartoes = (page: Page) => principal(page).locator('[data-cartao-do-agente]')
const cartaoDe = (page: Page, agente: string) => principal(page).locator(`[data-cartao-do-agente="${agente}"]`)

/** A opção do seletor "Qual IA", pelo nome de função do agente. */
const opcaoDe = (page: Page, nome: string) => principal(page).getByRole('radio', { name: nome, exact: true })

const IAS = [
  { agente: 'assistente_de_ensino', nome: 'Assistente de ensino', funcoes: 3 },
  { agente: 'tutor', nome: 'Tutor', funcoes: 2 },
  { agente: 'analista_de_desempenho_escolar', nome: 'Analista de desempenho escolar', funcoes: 1 },
] as const

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/**
 * Os dois cliques de um clique duplo no mesmo instante, antes de a tela desligar o botão: é o caso que o botão desligado não segura,
 * e que só a trava do pedido no ar segura.
 */
async function doisCliquesNoMesmoInstante(botao: Locator): Promise<void> {
  await botao.evaluate((elemento: HTMLButtonElement) => {
    elemento.click()
    elemento.click()
  })
}

/** Uma porta que segura a resposta até o teste abrir. */
function gate(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

/** O pedido de suspender uma função, de qualquer uma. */
const ehSuspender = (url: URL): boolean => /^\/v1\/governanca\/funcoes\/[^/]+\/suspender$/.test(url.pathname)
/** A leitura das funções da governança. */
const ehALeituraDasFuncoes = (url: URL): boolean => url.pathname === '/v1/governanca/funcoes'

interface Cenario {
  readonly coordenadora: EquipeDeTeste
  readonly escola: EscolaComEntregas | undefined
}

/**
 * A coordenadora entra, abre no Painel e vai à aba IA de Registros, que é a Governança. Com `comEntregas`, a escola já tem o que
 * o roteiro deixa até o passo 4.
 */
async function entrar(page: Page, hasTouch: boolean, comEntregas = true): Promise<Cenario> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  const escola = comEntregas ? await montarEscolaComEntregas(coordenadora.escolaId, coordenadora.usuarioId) : undefined
  await page.goto('/entrar')
  await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
  await esperarPainel(page)
  await irPelaCoordenacao(page, 'IA', hasTouch)
  return { coordenadora, escola }
}

/** Do Painel ou da IA até a página, pelo link "Como cada IA trabalha", com o cartão do Assistente (o primeiro) já na tela. */
async function abrirAgentes(page: Page, hasTouch: boolean): Promise<void> {
  await irPelaCoordenacao(page, 'Agentes', hasTouch)
  await expect(page).toHaveURL(/\/coordenacao\/agentes$/)
  await expect(cartaoDe(page, 'assistente_de_ensino')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
}

test.describe('Como cada IA trabalha', () => {
  test('a página, o seletor "Qual IA" e uma IA por vez: o endereço guarda a escolha, e cada uma aparece com o nome de função, o selo "IA" e o avatar', async ({ page, hasTouch }) => {
    test.slow()
    await entrar(page, hasTouch, false)
    await abrirAgentes(page, hasTouch)
    await expect(page).toHaveTitle('Como cada IA trabalha · Turmma')
    await expect(page.getByRole('heading', { level: 1, name: 'Como cada IA trabalha' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Voltar para Registros' })).toBeVisible()
    await expect(principal(page).getByRole('radiogroup', { name: 'Qual IA' }).getByRole('radio')).toHaveText(IAS.map(({ nome }) => nome))
    // Abre no Assistente de ensino, o primeiro, sem nada no endereço.
    await expect(opcaoDe(page, 'Assistente de ensino')).toHaveAttribute('aria-checked', 'true')
    await expect(cartoes(page)).toHaveCount(1)

    // O Assistente por último: escolher o que já está marcado não muda o endereço, e é voltando a ele que o `?ia=` dele aparece.
    for (const { agente, nome, funcoes } of [IAS[1], IAS[2], IAS[0]]) {
      await activate(opcaoDe(page, nome), hasTouch)
      await expect(opcaoDe(page, nome)).toHaveAttribute('aria-checked', 'true')
      await expect(page).toHaveURL(new RegExp(`/coordenacao/agentes\\?ia=${agente}$`))
      // Uma IA por vez: só o cartão dela, com o nome de função como título, o avatar e o selo "IA" no mesmo bloco (RF10).
      await expect(cartoes(page)).toHaveCount(1)
      await expect(cartaoDe(page, agente).getByRole('heading', { level: 2, name: nome })).toBeVisible()
      await expect(cartaoDe(page, agente).locator('[data-selo-ia]')).toHaveCount(1)
      await expect(cartaoDe(page, agente).locator(`[data-agente="${agente}"]`)).toHaveCount(1)
      await expect(cartaoDe(page, agente).locator('[data-funcao]')).toHaveCount(funcoes)
      expect(await conferirAssinaturas(principal(page))).toBe(1)
      // O avatar do cartão é o de 48 px, e a tela inteira não chama nada de "onça" (A28).
      expect(await conferirTamanhoDoAvatar(principal(page), 48)).toBe(1)
      await conferirQueAOncaNaoTemNome(page)
    }

    // O endereço com a IA abre direto nela, e um valor que não é de nenhuma abre no Assistente.
    await page.goto('/coordenacao/agentes?ia=tutor')
    await expect(cartaoDe(page, 'tutor')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(opcaoDe(page, 'Tutor')).toHaveAttribute('aria-checked', 'true')
    await page.goto('/coordenacao/agentes?ia=qualquer-coisa')
    await expect(cartaoDe(page, 'assistente_de_ensino')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(cartoes(page)).toHaveCount(1)
  })

  test('o seletor pelas setas, os alvos de 44 px no celular, nada rola de lado e a página não rola; o axe não acusa nada em nenhuma das três', async ({ page, hasTouch }) => {
    test.slow()
    await entrar(page, hasTouch, false)
    await abrirAgentes(page, hasTouch)
    // O Tab chega à opção marcada, e as setas escolhem a seguinte e levam o foco junto, como num rádio nativo.
    await opcaoDe(page, 'Assistente de ensino').focus()
    await page.keyboard.press('ArrowRight')
    await expect(opcaoDe(page, 'Tutor')).toBeFocused()
    await expect(opcaoDe(page, 'Tutor')).toHaveAttribute('aria-checked', 'true')
    await expect(page).toHaveURL(/\/coordenacao\/agentes\?ia=tutor$/)
    await expect(cartaoDe(page, 'tutor')).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(opcaoDe(page, 'Analista de desempenho escolar')).toBeFocused()
    await expect(cartaoDe(page, 'analista_de_desempenho_escolar')).toBeVisible()
    await page.keyboard.press('Home')
    await expect(opcaoDe(page, 'Assistente de ensino')).toBeFocused()
    await expect(cartaoDe(page, 'assistente_de_ensino')).toBeVisible()

    for (const { agente, nome } of IAS) {
      await activate(opcaoDe(page, nome), hasTouch)
      await expect(cartaoDe(page, agente)).toBeVisible()
      if (hasTouch) {
        for (const alvo of [opcaoDe(page, nome), ...(await cartaoDe(page, agente).getByRole('button').all())]) {
          const caixa = await alvo.boundingBox()
          expect(caixa, `${nome}: um alvo sem caixa`).not.toBeNull()
          expect(caixa?.height ?? 0, `${nome}: um alvo de toque`).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
        }
      }
      expect(await seriousViolations(page), nome).toEqual([])
      // O corte da página acontece com a leitura terminada: o cartão do agente já está na tela.
      await paginaNaoRola(page)
    }
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('`paginaNaoRola` não aceita a tela ainda carregando: a medida só vale com a leitura terminada', async ({ page, hasTouch }) => {
    // O caso gasta de propósito os 5 s da espera de `paginaNaoRola` (que tem de rejeitar), depois de entrar (14 s no celular, CPU ×4) e de
    // esperar o "Carregando…" da página recarregada, e ainda falta o cartão aparecer: no runner isso passa dos 30 s, sem nada travado.
    test.slow()
    await entrar(page, hasTouch, false)
    // A leitura das funções fica segurada: a página recarregada mostra "Carregando os agentes…", curta, e passaria em qualquer medida.
    const segurada = gate()
    await page.route(
      (url) => ehALeituraDasFuncoes(url),
      async (rota: Route) => {
        if (rota.request().method() === 'GET') await segurada.aberta
        return rota.fallback()
      },
    )
    await page.goto('/coordenacao/agentes')
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando os agentes…' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(paginaNaoRola(page)).rejects.toThrow(/ainda está carregando/)
    segurada.abrir()
    await expect(cartaoDe(page, 'assistente_de_ensino')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await paginaNaoRola(page)
  })

  test('três funções no Assistente, e cada função com o que faz sozinha, o que espera aprovação e a autonomia, no texto da API; suspender a correção de objetiva pelo diálogo e retomar, com o registro no banco', async ({
    page,
    hasTouch,
  }) => {
    // O caso entra, abre a aba, suspende e retoma uma função e confere o banco: 21 s aqui e 25,5 s na esteira, no celular (CPU ×4), contra os 30 s do relógio padrão.
    test.slow()
    const { coordenadora } = await entrar(page, hasTouch, false)
    await abrirAgentes(page, hasTouch)
    const correcao = principal(page).locator('[data-funcao="correcao_de_objetiva"]')
    await expect(correcao).toContainText('Faz sozinha')
    await expect(correcao).toContainText('Espera aprovação')
    await expect(correcao).toContainText('Alto risco')
    await expect(correcao).toContainText('Faz e avisa')
    await expect(correcao).toContainText('Funcionando')
    await expect(principal(page).getByRole('region', { name: 'O que a IA nunca faz' })).toContainText('redação e discursiva')
    expect(await seriousViolations(page)).toEqual([])

    await activate(correcao.getByRole('button', { name: 'Suspender esta função: Correção de objetiva' }), hasTouch)
    await expect(dialogo(page)).toContainText('fica sem correção até a função voltar')
    await expect(dialogo(page)).toContainText('continua podendo ser aprovado ou rejeitado')
    await expect(dialogo(page)).toContainText('auditoria')
    await dialogo(page).getByLabel('Motivo').selectOption({ label: 'A escola está revendo o uso pedagógico' })
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await activate(dialogo(page).getByRole('button', { name: 'Suspender Correção de objetiva' }), hasTouch)
    await expect(dialogo(page)).toHaveCount(0)
    await expect(correcao).toContainText('Suspensa nesta escola desde', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(correcao).toContainText('Motivo: A escola está revendo o uso pedagógico')
    await expect(principal(page).getByRole('status').filter({ hasText: 'A função "Correção de objetiva" está suspensa nesta escola.' })).toBeVisible()
    // O foco vai para o botão que tomou o lugar do que abriu a confirmação.
    await expect(correcao.getByRole('button', { name: 'Retomar esta função: Correção de objetiva' })).toBeFocused()
    // Só ela: a Adaptação, do mesmo agente, continua.
    await expect(principal(page).locator('[data-funcao="adaptacao"]')).toContainText('Funcionando')
    expect(await suspensoesNoBanco(coordenadora.escolaId, 'correcao_de_objetiva')).toEqual([{ suspensaPor: coordenadora.usuarioId, motivo: 'revisao_pedagogica', retomada: false }])

    await activate(correcao.getByRole('button', { name: 'Retomar esta função: Correção de objetiva' }), hasTouch)
    await expect(correcao).toContainText('Funcionando', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(correcao.getByRole('button', { name: 'Suspender esta função: Correção de objetiva' })).toBeFocused()
    expect(await suspensoesNoBanco(coordenadora.escolaId, 'correcao_de_objetiva')).toEqual([{ suspensaPor: coordenadora.usuarioId, motivo: 'revisao_pedagogica', retomada: true }])
    expect((await auditoriasNoBanco(coordenadora.escolaId, 'funcao.suspensa')).map((registro) => registro.autor)).toEqual([coordenadora.usuarioId])
    expect((await auditoriasNoBanco(coordenadora.escolaId, 'funcao.retomada')).map((registro) => registro.autor)).toEqual([coordenadora.usuarioId])
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('a função que outra pessoa já suspendeu: a tela mostra o estado de agora, e o botão que ficou na tela velha não cria segunda suspensão', async ({ page, hasTouch }) => {
    test.slow()
    const { coordenadora } = await entrar(page, hasTouch, false)
    await abrirAgentes(page, hasTouch)
    const correcao = principal(page).locator('[data-funcao="correcao_de_objetiva"]')
    await expect(correcao).toContainText('Funcionando')

    // Outra pessoa da coordenação suspende, por fora desta aba: a tela daqui ainda diz "Funcionando", e o botão dela ainda está lá.
    const outra = await suspenderFuncaoPorOutraPessoa(coordenadora.escolaId, 'correcao_de_objetiva')
    await activate(correcao.getByRole('button', { name: 'Suspender esta função: Correção de objetiva' }), hasTouch)
    await activate(dialogo(page).getByRole('button', { name: 'Suspender Correção de objetiva' }), hasTouch)
    await expect(dialogo(page)).toHaveCount(0)
    await expect(correcao).toContainText('Suspensa nesta escola desde', { timeout: SIGN_IN_TIMEOUT_MS })
    // A suspensão vigente continua sendo a da outra pessoa: o servidor devolveu a que já existia, e não gravou uma segunda.
    expect(await suspensoesNoBanco(coordenadora.escolaId, 'correcao_de_objetiva')).toEqual([{ suspensaPor: outra.usuarioId, motivo: null, retomada: false }])

    // A tela lida de novo mostra o estado de agora, e a única ação é retomar: a função suspensa não oferece "Suspender" nem o diálogo.
    await page.reload()
    await expect(cartaoDe(page, 'assistente_de_ensino')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(correcao).toContainText('Suspensa nesta escola desde')
    await expect(correcao.getByRole('button', { name: 'Retomar esta função: Correção de objetiva' })).toBeVisible()
    await expect(correcao.getByRole('button', { name: /^Suspender esta função/ })).toHaveCount(0)
    await expect(dialogo(page)).toHaveCount(0)
    await expect(principal(page).locator('[data-funcao="adaptacao"]')).toContainText('Funcionando')
  })

  test('recomeço: a falha com o diálogo aberto fica nele e sai ao reabrir, e o clique duplo em confirmar manda uma suspensão só', async ({ page, hasTouch }) => {
    test.slow()
    const { coordenadora } = await entrar(page, hasTouch, false)
    await abrirAgentes(page, hasTouch)
    const adaptacao = principal(page).locator('[data-funcao="adaptacao"]')
    const suspender = adaptacao.getByRole('button', { name: 'Suspender esta função: Adaptação' })
    const confirmar = () => dialogo(page).getByRole('button', { name: 'Suspender Adaptação' })

    // A primeira tentativa não chega ao servidor: o diálogo continua aberto, diz o que fazer, e nada foi gravado.
    const pedidos: Request[] = []
    let falhar = true
    const segurada = gate()
    await page.route(
      (url) => ehSuspender(url),
      async (rota: Route) => {
        pedidos.push(rota.request())
        if (!falhar) {
          await segurada.aberta
          return rota.continue()
        }
        return rota.abort('internetdisconnected')
      },
    )
    await activate(suspender, hasTouch)
    await activate(confirmar(), hasTouch)
    await expect(dialogo(page).getByRole('alert')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(dialogo(page)).toBeVisible()
    expect(await suspensoesNoBanco(coordenadora.escolaId, 'adaptacao')).toEqual([])

    // Fecha e reabre: o aviso da tentativa anterior não volta.
    await activate(dialogo(page).getByRole('button', { name: 'Cancelar' }), hasTouch)
    await expect(dialogo(page)).toHaveCount(0)
    await expect(suspender).toBeFocused()
    await activate(suspender, hasTouch)
    await expect(dialogo(page)).toBeVisible()
    await expect(dialogo(page).getByRole('alert')).toHaveCount(0)

    // O clique duplo, com o primeiro pedido ainda no ar: um pedido só, e uma suspensão só no banco.
    falhar = false
    pedidos.length = 0
    await doisCliquesNoMesmoInstante(confirmar())
    await expect(dialogo(page).getByRole('button', { name: 'Suspendendo…' })).toBeDisabled()
    // O pedido só chega à interceptação depois de passar pelo processo de rede: a conta espera por ele, e não depende da máquina folgada.
    await expect.poll(() => pedidos.length).toBe(1)
    segurada.abrir()
    await expect(dialogo(page)).toHaveCount(0, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(adaptacao).toContainText('Suspensa nesta escola desde')
    expect(pedidos).toHaveLength(1)
    expect(await suspensoesNoBanco(coordenadora.escolaId, 'adaptacao')).toEqual([{ suspensaPor: coordenadora.usuarioId, motivo: null, retomada: false }])
  })

  test('recomeço: a coordenação de B entra na aba da de A e não vê a suspensão dela nem o diálogo aberto', async ({ page, hasTouch }) => {
    test.slow()
    const deA = await entrar(page, hasTouch, false)
    await abrirAgentes(page, hasTouch)
    const correcao = principal(page).locator('[data-funcao="correcao_de_objetiva"]')
    await activate(correcao.getByRole('button', { name: 'Suspender esta função: Correção de objetiva' }), hasTouch)
    await activate(dialogo(page).getByRole('button', { name: 'Suspender Correção de objetiva' }), hasTouch)
    await expect(correcao).toContainText('Suspensa nesta escola desde', { timeout: SIGN_IN_TIMEOUT_MS })
    // A de A deixa um diálogo aberto na Adaptação e sai.
    await activate(principal(page).locator('[data-funcao="adaptacao"]').getByRole('button', { name: 'Suspender esta função: Adaptação' }), hasTouch)
    await expect(dialogo(page)).toBeVisible()
    await activate(dialogo(page).getByRole('button', { name: 'Cancelar' }), hasTouch)
    await abrirNavegacao(page, hasTouch)
    await activate(lateral(page).getByRole('button', { name: 'Sair' }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })

    // A de B entra na mesma aba, sem recarregar, com a leitura das funções segurada: é aí que a suspensão de A apareceria.
    const deB = await criarEquipeComSenha('coordenador')
    const segurada = gate()
    await page.route(
      (url) => ehALeituraDasFuncoes(url),
      async (rota: Route) => {
        if (rota.request().method() === 'GET') await segurada.aberta
        return rota.fallback()
      },
    )
    await entrarComoCoordenacaoNaMesmaAba(page, deB, hasTouch)
    await esperarPainel(page)
    await irPelaCoordenacao(page, 'IA', hasTouch)
    await irPelaCoordenacao(page, 'Agentes', hasTouch)
    await expect(principal(page).getByRole('status').filter({ hasText: 'Carregando os agentes…' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.locator('body')).not.toContainText('Suspensa nesta escola')
    await expect(dialogo(page)).toHaveCount(0)
    segurada.abrir()
    await expect(cartaoDe(page, 'assistente_de_ensino')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).locator('[data-funcao="correcao_de_objetiva"]')).toContainText('Funcionando')
    await expect(page.locator('body')).not.toContainText('Suspensa nesta escola')
    expect(await suspensoesNoBanco(deB.escolaId, 'correcao_de_objetiva')).toEqual([])
    expect(await suspensoesNoBanco(deA.coordenadora.escolaId, 'correcao_de_objetiva')).toHaveLength(1)
  })
})
