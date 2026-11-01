import type { Locator, Page, Request, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { codigoDoOperador, criarOperadorComSegundoFator as criarOperador, encerrarSessoesDoOperador, removerOperador, type OperadorDeTeste } from './support/operacao.ts'
import { criarEquipeComSenha } from './support/seed.ts'
import { esperarNovaConversa } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { activate, entrarNaOperacao, esperarCasca, SIGN_IN_TIMEOUT_MS } from './support/operacao-screen.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, corDoToken, horizontalOverflow, seriousViolations } from './support/checks.ts'

const ROTA_EU_DO_OPERADOR = '**/v1/operacao/eu'
const CHUNK_DA_OPERACAO = /\/assets\/operacao-[^/]+\.js$/

const TEXTO_DA_SESSAO_ENCERRADA = MENSAGENS_DE_ERRO.SESSAO_ENCERRADA
const TEXTO_DO_503 = 'O Turmma está indisponível agora. Tente de novo em instantes.'
const AVISO_DE_INATIVIDADE = 'Sua sessão vai terminar em 2 minutos por falta de uso.'
/** O `foco` da 9.10 no claro: o anel de 3 px, o mesmo em toda peça, inclusive sobre o `fundo` claro da barra de topo (5,3:1). */
const FOCO = 'rgb(20, 110, 170)'
const FUNDO_CLARO = 'rgb(255, 255, 255)'

/** Minutos e segundos no formato do relógio simulado do Playwright. */
const tempo = (minutos: number, segundos = 0): string => `00:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`

/** Nada da sessão em armazenamento do navegador nem na barra (regra 50, item 7). */
async function semNadaGuardadoNoNavegador(page: Page): Promise<void> {
  const guardado = await page.evaluate(() => ({ local: Object.keys(localStorage), sessao: Object.keys(sessionStorage), url: location.href }))
  expect(guardado.local).toEqual([])
  expect(guardado.sessao).toEqual([])
  expect(guardado.url).not.toMatch(/token|desafio|codigo/i)
}

/** Os operadores criados por este teste, apagados no fim dele, passe ou falhe. */
const criados: string[] = []

async function criarOperadorComSegundoFator(): Promise<OperadorDeTeste> {
  const operador = await criarOperador()
  criados.push(operador.operadorId)
  return operador
}

test.afterEach(async () => {
  for (const operadorId of criados.splice(0)) await removerOperador(operadorId)
})

test.describe('área do operador Turmma', () => {
  test('entra por e-mail, senha e código, chega à casca da operação e sai a um clique', async ({ page, hasTouch }) => {
    const operador = await criarOperadorComSegundoFator()

    await page.goto('/operacao/entrar')
    await expect(page.getByRole('heading', { name: 'Entrar na operação' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page).toHaveTitle('Entrar · Operação Turmma')
    // A faixa diz que ali é a operação, para ninguém confundir com a tela de uma escola.
    await expect(page.getByRole('banner')).toContainText('Operação Turmma')
    await expect(page.getByLabel('E-mail')).toHaveAttribute('autocomplete', 'username')
    await expect(page.getByLabel('Senha')).toHaveAttribute('autocomplete', 'current-password')
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    // A senha errada diz o que fazer, e a tela fica.
    await page.getByLabel('E-mail').fill(operador.email)
    await page.getByLabel('Senha').fill('senha-que-nao-e-a-dela')
    await activate(page, /^Entrar$/, hasTouch)
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos', { timeout: SIGN_IN_TIMEOUT_MS })
    // A senha errada sai da tela junto com a resposta, e o foco volta ao campo dela para digitar de novo.
    await expect(page.getByLabel('Senha')).toHaveValue('')
    await expect(page.getByLabel('Senha')).toBeFocused()
    await expect(page.getByLabel('E-mail')).toHaveValue(operador.email)

    await page.getByLabel('Senha').fill(operador.senha)
    const entrar = page.getByRole('button', { name: /^Entrar$/ })
    const caixa = await entrar.boundingBox()
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    await activate(page, /^Entrar$/, hasTouch)

    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page).toHaveTitle('Segundo fator · Operação Turmma')
    await expect(page.getByLabel('Código do aplicativo')).toHaveAttribute('inputmode', 'numeric')
    await expect(page.getByLabel('Código do aplicativo')).toHaveAttribute('autocomplete', 'one-time-code')
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await semNadaGuardadoNoNavegador(page)

    await page.getByLabel('Código do aplicativo').fill(codigoDoOperador(operador))
    await activate(page, /^Entrar$/, hasTouch)

    await esperarCasca(page, operador)
    await expect(page).toHaveTitle('Escolas · Operação Turmma')
    // O título da página é "Operação", à vista, e a aba do navegador diz a tela; a navegação diz onde a pessoa está (X2: a casca abre em Escolas).
    await expect(page.getByRole('heading', { level: 1, name: 'Operação' })).toBeVisible()
    await expect(page.getByRole('main')).toContainText('A operação não vê dado de aluno nem de professor: nem nome, nem nota, nem conversa.')
    await expect(page.getByRole('navigation', { name: 'Operação' }).getByRole('link', { name: 'Escolas' })).toHaveAttribute('aria-current', 'page')
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    await semNadaGuardadoNoNavegador(page)

    // O "Sair" está à vista na barra de topo clara, sem abrir nada, com alvo de toque de 44 px, e o anel de foco dele é o
    // `foco` de 3 px, o mesmo de toda peça, sobre o `fundo` claro. Aqui na casca de verdade, e não numa face montada pelo
    // teste (A61, A62, A63).
    const sair = page.getByRole('banner').getByRole('button', { name: 'Sair' })
    const caixaDoSair = await sair.boundingBox()
    expect(caixaDoSair?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(caixaDoSair?.width ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    if (!hasTouch) {
      for (let tecla = 0; tecla < 10 && !(await sair.evaluate((elemento) => elemento === document.activeElement)); tecla++) await page.keyboard.press('Tab')
      const anel = await sair.evaluate((elemento) => {
        const estilo = getComputedStyle(elemento)
        return { visivel: elemento.matches(':focus-visible'), estilo: estilo.outlineStyle, largura: estilo.outlineWidth, cor: estilo.outlineColor }
      })
      expect(anel).toEqual({ visivel: true, estilo: 'solid', largura: '3px', cor: FOCO })
      const barra = await sair.evaluate((elemento) => {
        const estilo = getComputedStyle(elemento.closest('header') ?? elemento)
        return { fundo: estilo.backgroundColor, bordaDeBaixo: estilo.borderBottomWidth }
      })
      expect(barra).toEqual({ fundo: FUNDO_CLARO, bordaDeBaixo: '2px' })
    }

    await activate(page, 'Sair', hasTouch)
    await expect(page).toHaveURL(/\/operacao\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('heading', { name: 'Entrar na operação' })).toBeVisible()
    // Depois de sair, voltar a `/operacao` não devolve a sessão: o cookie foi apagado pela API.
    await page.goto('/operacao')
    await expect(page).toHaveURL(/\/operacao\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('a barra de topo é clara e tem a marca à vista na entrada, no segundo fator e no convite, a 360 e a 1366 px', async ({ page }) => {
    // Cada recarga custa a rede lenta do celular, e são doze: o prazo é o do caso do escuro de `aparencia.spec.ts`.
    test.setTimeout(90_000)
    const telas = [
      { endereco: '/operacao/entrar', titulo: 'Entrar na operação' },
      { endereco: '/operacao/mfa', titulo: 'Segundo fator' },
      { endereco: '/operacao/convite', titulo: 'Convite para a operação' },
    ]
    // Fora da sessão: a mesma barra, sem "Sair" e sem navegação, no fundo do tema (A60, A63), e no escuro sem violação
    // grave do axe: é onde o contraste da barra e do título muda de cor.
    for (const esquema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: esquema })
      for (const largura of [1366, 360]) {
        await page.setViewportSize({ width: largura, height: 800 })
        for (const { endereco, titulo } of telas) {
          const onde = `${endereco} a ${String(largura)} px, ${esquema}`
          await page.goto(endereco)
          // O título fixa a tela: um redirecionamento à entrada não passaria por "Segundo fator" nem pelo convite.
          await expect(page.getByRole('heading', { level: 1, name: titulo }), onde).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
          const banner = page.getByRole('banner')
          await expect(banner, onde).toContainText('Operação Turmma')
          await expect(banner.getByRole('button', { name: 'Sair' }), onde).toHaveCount(0)
          await expect(page.getByRole('navigation'), onde).toHaveCount(0)
          expect(await banner.evaluate((elemento) => getComputedStyle(elemento).backgroundColor), onde).toBe(await corDoToken(page, 'fundo'))
          expect(await horizontalOverflow(page), onde).toBe(0)
          if (esquema === 'dark') expect(await seriousViolations(page), onde).toEqual([])
        }
      }
    }
  })

  test('a barra de topo é clara e tem a marca e o "Sair" à vista em Escolas e em Uso, a 360 e a 1366 px, nos dois temas', async ({ page, hasTouch }) => {
    const operador = await criarOperadorComSegundoFator()
    await entrarNaOperacao(page, operador, hasTouch)
    const navegacao = page.getByRole('navigation', { name: 'Operação' })

    for (const esquema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: esquema })
      for (const largura of [1366, 360]) {
        await page.setViewportSize({ width: largura, height: 800 })
        // A troca de tela é pelo link da navegação, e não por `goto`: sem recarga, cada medida custa um instante.
        for (const tela of ['Escolas', 'Uso']) {
          const onde = `${tela} a ${String(largura)} px, ${esquema}`
          await navegacao.getByRole('link', { name: tela }).click()
          await expect(page, onde).toHaveTitle(`${tela} · Operação Turmma`, { timeout: SIGN_IN_TIMEOUT_MS })
          await expect(page.getByRole('heading', { level: 1, name: 'Operação' }), onde).toBeVisible()
          const banner = page.getByRole('banner')
          await expect(banner, onde).toContainText('Operação Turmma')

          // "Sair" à vista, dentro da barra, sem abrir nada (A60, A61).
          const sair = banner.getByRole('button', { name: 'Sair' })
          await expect(sair, onde).toBeVisible()
          const caixa = await sair.boundingBox()
          expect(caixa?.height ?? 0, onde).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
          expect(caixa?.width ?? 0, onde).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)

          // A barra é `fundo` do tema (e não a face `noite` de antes, que é preta no claro e clara no escuro), com a borda
          // de baixo de 2 px na cor `borda`, e mede 72 px no computador, contando a borda, e no mínimo 56 no celular (A63).
          const barra = await banner.evaluate((elemento) => {
            const estilo = getComputedStyle(elemento)
            return { fundo: estilo.backgroundColor, bordaDeBaixo: estilo.borderBottomWidth, corDaBorda: estilo.borderBottomColor, altura: elemento.getBoundingClientRect().height }
          })
          expect(barra.fundo, onde).toBe(await corDoToken(page, 'fundo'))
          expect(barra.bordaDeBaixo, onde).toBe('2px')
          expect(barra.corDaBorda, onde).toBe(await corDoToken(page, 'borda'))
          if (largura >= 768) expect(barra.altura, onde).toBe(72)
          else expect(barra.altura, onde).toBeGreaterThanOrEqual(56)

          // Uma tela só, sem lateral: a navegação "Operação" mora dentro do `main`, embaixo do título (a lista das escolas tem a
          // dela, as páginas), não há outra fora dele, e os links dela têm alvo de 44 px (A63, A97).
          await expect(page.getByRole('complementary'), onde).toHaveCount(0)
          expect(await page.locator('nav').evaluateAll((todas) => todas.filter((nav) => nav.closest('main') === null).map((nav) => nav.getAttribute('aria-label'))), onde).toEqual([])
          await expect(page.getByRole('main').getByRole('navigation', { name: 'Operação' }), onde).toHaveCount(1)
          for (const link of await navegacao.getByRole('link').all()) {
            expect((await link.boundingBox())?.height ?? 0, onde).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
          }

          // O item da tela se vê pela forma, e não só pela cor: o sublinhado de 3 px em `azul`, só no que leva o `aria-current`.
          const aceso = navegacao.locator('[aria-current="page"]')
          await expect(aceso, onde).toHaveCount(1)
          await expect(aceso, onde).toHaveText(tela)
          const sublinhado = await aceso.locator('span[aria-hidden="true"]').evaluate((elemento) => {
            const estilo = getComputedStyle(elemento)
            return { cor: estilo.backgroundColor, altura: estilo.height }
          })
          expect(sublinhado, onde).toEqual({ cor: await corDoToken(page, 'azul'), altura: '3px' })
          await expect(navegacao.locator('span[aria-hidden="true"]'), onde).toHaveCount(1)
          expect(await horizontalOverflow(page), onde).toBe(0)
        }
      }
    }
  })

  test('sair como um operador e entrar como outro na mesma aba, sem recarregar: nada do primeiro aparece', async ({ page, hasTouch }) => {
    const ana = await criarOperadorComSegundoFator()
    const bruno = await criarOperadorComSegundoFator()
    await entrarNaOperacao(page, ana, hasTouch)

    await activate(page, 'Sair', hasTouch)
    await expect(page.getByRole('heading', { name: 'Entrar na operação' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    // Sem `goto` nem recarga: a aba é a mesma, e o que sobrasse da Ana em memória apareceria aqui.
    await page.getByLabel('E-mail').fill(bruno.email)
    await page.getByLabel('Senha').fill(bruno.senha)
    await activate(page, /^Entrar$/, hasTouch)
    await page.getByLabel('Código do aplicativo').fill(codigoDoOperador(bruno))
    await activate(page, /^Entrar$/, hasTouch)

    await expect(page.getByRole('banner')).toContainText(bruno.nome, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('banner')).not.toContainText(ana.nome)
  })

  test('clique duplo em "Entrar" do segundo fator e em "Sair": um pedido cada, e o operador seguinte na mesma aba entra e sai de novo', async ({ page, hasTouch }) => {
    const ana = await criarOperadorComSegundoFator()
    const bruno = await criarOperadorComSegundoFator()
    const pedidos: string[] = []
    page.on('request', (pedido: Request) => {
      if (pedido.method() === 'POST') pedidos.push(new URL(pedido.url()).pathname)
    })
    const quantos = (caminho: string) => pedidos.filter((pedido) => pedido === caminho).length
    /**
     * Os dois cliques no mesmo instante, antes de a tela desenhar o botão desligado: é o caso que o `disabled` e o
     * estado da tela não seguram, porque o segundo clique ainda encontra o botão ligado. Quem segura é a sessão.
     */
    const cliqueDuplo = (botao: Locator) =>
      botao.evaluate((elemento: HTMLButtonElement) => {
        elemento.click()
        elemento.click()
      })

    await page.goto('/operacao/entrar')
    await page.getByLabel('E-mail').fill(ana.email, { timeout: SIGN_IN_TIMEOUT_MS })
    await page.getByLabel('Senha').fill(ana.senha)
    await activate(page, /^Entrar$/, hasTouch)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await page.getByLabel('Código do aplicativo').fill(codigoDoOperador(ana))
    await cliqueDuplo(page.getByRole('button', { name: /^Entrar$/ }))

    await esperarCasca(page, ana)
    expect(quantos('/v1/operacao/sessao/mfa')).toBe(1)
    await expect(page.getByRole('alert')).toHaveCount(0)

    await cliqueDuplo(page.getByRole('banner').getByRole('button', { name: 'Sair' }))
    await expect(page.getByRole('heading', { name: 'Entrar na operação' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(quantos('/v1/operacao/sessao/sair')).toBe(1)
    // A saída confirmada não deixa aviso: a segunda saída que falhasse diria "a saída não foi confirmada".
    await expect(page.getByRole('alert')).toHaveCount(0)

    // O recomeço, na mesma aba e sem recarregar: o Bruno entra, não vê nada da Ana, e o Sair dele sai de novo.
    await page.getByLabel('E-mail').fill(bruno.email)
    await page.getByLabel('Senha').fill(bruno.senha)
    await activate(page, /^Entrar$/, hasTouch)
    await page.getByLabel('Código do aplicativo').fill(codigoDoOperador(bruno), { timeout: SIGN_IN_TIMEOUT_MS })
    await activate(page, /^Entrar$/, hasTouch)
    await esperarCasca(page, bruno)
    await expect(page.getByRole('banner')).not.toContainText(ana.nome)
    await activate(page, 'Sair', hasTouch)
    await expect(page.getByRole('heading', { name: 'Entrar na operação' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(quantos('/v1/operacao/sessao/sair')).toBe(2)
    expect(quantos('/v1/operacao/sessao/mfa')).toBe(2)
  })

  test('código do segundo fator recusado volta à entrada explicando, porque a API gastou o desafio', async ({ page, hasTouch }) => {
    const operador = await criarOperadorComSegundoFator()
    await page.goto('/operacao/entrar')
    await page.getByLabel('E-mail').fill(operador.email)
    await page.getByLabel('Senha').fill(operador.senha)
    await activate(page, /^Entrar$/, hasTouch)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const certo = codigoDoOperador(operador)
    await page.getByLabel('Código do aplicativo').fill(certo === '000000' ? '111111' : '000000')
    await activate(page, /^Entrar$/, hasTouch)

    await expect(page).toHaveURL(/\/operacao\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('alert')).toContainText('O código não foi aceito')
    expect(await seriousViolations(page)).toEqual([])
  })

  test('E2: a sessão encerrada volta à entrada com a mensagem', async ({ page, hasTouch }) => {
    const operador = await criarOperadorComSegundoFator()
    await page.clock.install()
    await entrarNaOperacao(page, operador, hasTouch)

    // A sessão termina no servidor (outra máquina saiu, ou o operador foi desativado). A próxima ação da aba — a tecla,
    // passado o minuto em que o uso já foi contado — é recusada com `SESSAO_ENCERRADA`.
    await encerrarSessoesDoOperador(operador.operadorId)
    await page.clock.fastForward(tempo(1, 5))
    await page.keyboard.press('Shift')

    await expect(page).toHaveURL(/\/operacao\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('alert')).toHaveText(TEXTO_DA_SESSAO_ENCERRADA)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('E2: o 503 mostra a mensagem e fica na tela, com "Tentar de novo"', async ({ page, hasTouch }) => {
    const operador = await criarOperadorComSegundoFator()
    const falhar = (rota: Route) =>
      rota.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto da API que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }),
      })
    await page.route(ROTA_EU_DO_OPERADOR, falhar)

    await page.goto('/operacao/entrar')
    await page.getByLabel('E-mail').fill(operador.email)
    await page.getByLabel('Senha').fill(operador.senha)
    await activate(page, /^Entrar$/, hasTouch)
    await page.getByLabel('Código do aplicativo').fill(codigoDoOperador(operador))
    await activate(page, /^Entrar$/, hasTouch)

    await expect(page.getByRole('alert')).toHaveText(TEXTO_DO_503, { timeout: SIGN_IN_TIMEOUT_MS })
    // O `/eu` não segura a tela (A0b, tarefa 6.0): a tela de Escolas carrega embaixo do erro, junto dele.
    await expect(page.getByRole('main').getByRole('button', { name: 'Nova escola' })).toBeVisible()
    // Fica: nem a entrada, nem a mensagem de sessão encerrada.
    await expect(page).toHaveURL(/\/operacao$/)
    await expect(page.getByRole('banner').getByRole('button', { name: 'Sair' })).toBeVisible()
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    await page.unroute(ROTA_EU_DO_OPERADOR, falhar)
    await activate(page, 'Tentar de novo', hasTouch)
    await expect(page.getByRole('banner')).toContainText(operador.nome, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('E3: o aviso aparece 2 min antes do fim da sessão parada, e no fim a aba vai à entrada com a mensagem', async ({ page, hasTouch }) => {
    const operador = await criarOperadorComSegundoFator()
    await page.clock.install()
    await entrarNaOperacao(page, operador, hasTouch)
    const aviso = page.getByRole('region', { name: 'Aviso de inatividade' })

    // Aos 26 min e meio parada, nada: ninguém é interrompido antes da hora.
    await page.clock.fastForward(tempo(26, 30))
    await expect(aviso).toBeHidden()

    // Passados os 27 min (o fim desconta o minuto em que a API pode não ter gravado o uso), o aviso.
    await page.clock.fastForward(tempo(1))
    await expect(aviso).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(aviso.getByRole('alert')).toHaveText(AVISO_DE_INATIVIDADE)
    // "Continuar" e "Sair" do mesmo tamanho (D59), com alvo de toque de 44 px.
    const continuar = await aviso.getByRole('button', { name: 'Continuar na sessão' }).boundingBox()
    const sair = await aviso.getByRole('button', { name: 'Sair' }).boundingBox()
    expect(continuar?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(sair?.height ?? 0).toBe(continuar?.height ?? -1)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    // Continuar conta como uso no servidor, e o aviso sai.
    const uso = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/operacao/eu' && resposta.ok())
    if (hasTouch) await aviso.getByRole('button', { name: 'Continuar na sessão' }).tap()
    else await aviso.getByRole('button', { name: 'Continuar na sessão' }).click()
    await uso
    await expect(aviso).toBeHidden({ timeout: SIGN_IN_TIMEOUT_MS })

    // Parada de novo até o fim: a sessão é encerrada e a aba vai à entrada com a mensagem.
    await page.clock.fastForward(tempo(27, 30))
    await expect(aviso).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await page.clock.fastForward(tempo(2))
    await expect(page).toHaveURL(/\/operacao\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('alert')).toHaveText(TEXTO_DA_SESSAO_ENCERRADA)
  })

  test('E4: o chunk da operação que não chega mostra a fronteira de erro com "Tentar de novo" e o título dela na aba, e a nova tentativa carrega', async ({ page, hasTouch }) => {
    const abortar = (rota: Route) => rota.abort('internetdisconnected')
    await page.route(CHUNK_DA_OPERACAO, abortar)

    await page.goto('/operacao/entrar')
    await expect(page.getByRole('alert')).toContainText('Não foi possível carregar a área da operação', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
    // A falha assume com o foco no título dela, que é o que o leitor de tela anuncia (11.0 da A1).
    await expect(page.getByRole('heading', { name: 'Operação Turmma' })).toBeFocused()
    // A aba diz o que aconteceu, e não fica com o título da página de antes ("Turmma", do `index.html`).
    await expect(page).toHaveTitle('Não foi possível carregar · Operação Turmma')
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    await page.unroute(CHUNK_DA_OPERACAO, abortar)
    await activate(page, 'Tentar de novo', hasTouch)
    await expect(page.getByRole('heading', { name: 'Entrar na operação' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('B2: a web da escola nunca baixa o chunk da operação', async ({ page }) => {
    const pedidos: string[] = []
    page.on('request', (pedido: Request) => pedidos.push(pedido.url()))
    await page.goto('/entrar')
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await page.waitForLoadState('networkidle')
    expect(pedidos.some((url) => url.includes('/assets/index-'))).toBe(true)
    expect(pedidos.filter((url) => CHUNK_DA_OPERACAO.test(new URL(url).pathname))).toEqual([])
  })

  test('duas abas da operação: sair numa encerra a outra, e a sessão de escola aberta no mesmo navegador continua', async ({ page, context, hasTouch }) => {
    const operador = await criarOperadorComSegundoFator()
    const professora = await criarEquipeComSenha()

    // A aba da escola, com a professora dentro.
    const escola = await context.newPage()
    await escola.goto('/entrar')
    await escola.getByLabel('E-mail').fill(professora.email)
    await escola.getByLabel('Senha').fill(professora.senha)
    await activate(escola, /^Entrar$/, hasTouch)
    // A professora abre em "Nova conversa" (A2, D73).
    await esperarNovaConversa(escola, professora.nome)

    // Duas abas da operação: a segunda abre pelo cookie da primeira.
    await entrarNaOperacao(page, operador, hasTouch)
    const outra = await context.newPage()
    await outra.goto('/operacao')
    await esperarCasca(outra, operador)

    await activate(page, 'Sair', hasTouch)
    await expect(page).toHaveURL(/\/operacao\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    // A outra aba da operação sai junto, pelo canal próprio, sem ninguém tocar nela.
    await expect(outra).toHaveURL(/\/operacao\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(outra.getByRole('banner')).not.toContainText(operador.nome)

    // A escola não ouviu nada: a tela continua, e a sessão dela ainda vale no servidor (recarregar reabre pelo cookie).
    await esperarNovaConversa(escola, professora.nome, { timeout: 2_000 })
    await escola.reload()
    await esperarNovaConversa(escola, professora.nome)
  })
})
