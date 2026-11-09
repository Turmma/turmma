import type { Locator, Page, Route } from '@playwright/test'
import { lerAmbienteDeTeste, valorObrigatorio } from '../tools/ci/compose.ts'
import { abrirNavegacao, irPelaNavegacao, lateral, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, seriousViolations } from './support/checks.ts'
import { expect, loadUnthrottled, test } from './support/profiles.ts'
import { colocarAlunoNaTurma, criarAlunoComMatricula, liberarProvedorDaEscola, ligarContaExterna, type AlunoDeTeste } from './support/seed.ts'
import { memoriaDoAluno, resultadoAprovado, trabalhoNaMemoria } from './support/tutor-memory.ts'

/**
 * "Conta da escola" em "Eu" (acesso-e-convites, tarefa 15.0; RF14, RF18; `tasks/prd-acesso-e-convites/cenarios.md`, "E2E" e "Telas"): o aluno que entrou por matrícula liga a conta Google da escola,
 * volta a "Eu" com "Conta da escola ligada", e passa a ter a conta ligada. Com o `oidc-falso` do compose, no caminho inteiro (o botão, o provedor, o retorno); os estados que a rede do
 * provedor tornaria lentos (o botão ocupado, o recomeço, a queda) interceptam a navegação ao `iniciar` na própria página.
 */

/** O usuário sintético do `oidc-falso` (infra/oidc-falso/config.json), escolhido pelo nome digitado no login dele. */
const ALUNA_NO_PROVEDOR = 'google-aluna-a'
const SUJEITO_DA_ALUNA = 'google-sub-aluna-a'
const DOMINIO_DA_ESCOLA_A = 'escola-a.educa-sintetica.test'
/** O que o provedor devolve sobre a aluna e que nunca pode aparecer na tela (regra 20, item 2). */
const DADOS_DA_ALUNA_NO_PROVEDOR = ['aluna.ficticia.a@escola-a.educa-sintetica.test', 'Aluna Ficticia Sintetica', 'fotos.educa-sintetica.test']

/** O `iniciar` que o botão alcança (o endereço é o que a web monta: o teste o lê do pedido do clique). */
const ROTA_INICIAR = '**/google/iniciar**'
const ROTA_ACESSO = '**/v1/escolas/*/acesso'
const ROTA_MEMORIA = '**/v1/tutor/memoria'
const LIGAR = 'Ligar a conta da escola'
const LIGADA = 'Conta da escola ligada'
const CONFLITO = 'Esta conta já está ligada a outro aluno. Fale com o professor'
const REDE = 'Não foi possível ligar a conta agora. Tente de novo'
const HABILIDADE = { codigo: 'EF09CI01', descricao: 'Reconhecer o reagente limitante' }

/** Uma escola com o domínio do provedor falso liberado e um aluno com matrícula nela. */
async function alunoNaEscolaComProvedor(): Promise<AlunoDeTeste> {
  const aluno = await criarAlunoComMatricula()
  await liberarProvedorDaEscola(aluno.escolaId, 'google', DOMINIO_DA_ESCOLA_A)
  return aluno
}

/** O aluno entra pela API (a entrada pela tela tem os casos dela, e o caso de 15 s do portão não comporta o login e o provedor) e abre "Eu" pelo endereço. */
async function abrirEu(page: Page, aluno: AlunoDeTeste, endereco = '/aluno/eu'): Promise<void> {
  const entrada = await page.context().request.post('/v1/sessao/matricula', { data: { slug: aluno.slug, matricula: aluno.matricula, senha: aluno.senha } })
  expect(entrada.ok(), 'entrada do aluno pela API').toBe(true)
  await page.goto(endereco)
}

const section = (page: Page): Locator => page.getByRole('main').getByRole('region', { name: 'Conta da escola' })
const botaoDeLigar = (page: Page): Locator => section(page).getByRole('button', { name: LIGAR })

/** Onde o navegador guarda o que a seção mostrava logo depois do clique (o `sessionStorage` atravessa a navegação, e a tela do provedor em espera não deixa o teste lê-la). */
const CHAVE_APOS_O_CLIQUE = 'conta-da-escola:apos-o-clique'

/**
 * Com a navegação ao provedor em espera, o localizador e o `page.evaluate` do Playwright esperam o fim dela, e o estado "Ligando…" não se vê pelo teste. O navegador anota, no instante
 * em que o clique termina (depois do tratador da tela, que já atualizou o botão), o que a seção mostra; o teste lê a anotação quando a volta chega a "Eu".
 */
async function anotarASecaoAposOClique(page: Page): Promise<void> {
  await page.addInitScript((chave) => {
    window.addEventListener('click', () => {
      const section = document.querySelector('main section[aria-labelledby="titulo-conta-da-escola"]')
      if (section === null) return
      const botoes = Array.from(section.querySelectorAll('button')).map((botao) => ({ texto: botao.textContent?.trim() ?? '', desabilitado: botao.disabled }))
      sessionStorage.setItem(chave, JSON.stringify({ botoes, avisos: section.querySelectorAll('[role="alert"]').length }))
    })
  }, CHAVE_APOS_O_CLIQUE)
}

async function secaoAposOClique(page: Page): Promise<unknown> {
  const anotado = await page.evaluate((chave) => sessionStorage.getItem(chave), CHAVE_APOS_O_CLIQUE)
  return anotado === null ? null : JSON.parse(anotado)
}

/**
 * O aluno acionou com o dedo no celular e com o clique no computador. `noWaitAfter`: o clique que vai ao provedor começa uma navegação que o teste segura em espera, e sem ele o
 * Playwright só devolve o clique quando ela termina.
 */
async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap({ noWaitAfter: true })
  else await alvo.click({ noWaitAfter: true })
}

/** O `iniciar` que não leva a lugar nenhum: a resposta 204 deixa a página onde está, e o botão no estado em que o clique o deixou. */
const semNavegar = (rota: Route) => rota.fulfill({ status: 204 })

/** O "Sair" da casca (o da lateral ou da gaveta, fora do `main`), e não a linha de Eu, que é outro botão dentro dele. */
async function sairPelaCasca(page: Page, hasTouch: boolean): Promise<void> {
  await abrirNavegacao(page, hasTouch)
  const sair = lateral(page).getByRole('button', { name: 'Sair' }).and(page.locator(':not(main *)'))
  await expect(sair).toHaveCount(1)
  await activate(sair, hasTouch)
  await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
}

/**
 * A ida ao `oidc-falso` (o papel da tela do Google: o nome digitado ali é o `subject` do usuário sintético) e a volta, pela API do contexto do navegador, que guarda o cookie do login em
 * andamento que o `iniciar` deixa. Devolve o endereço de retorno que o navegador do aluno abriria. O botão e o `iniciar` pela tela têm o caso deles; fazer o formulário do provedor pela
 * tela, com o perfil lento do Chromebook, passa dos 15 s que o portão cobra do caso. O endereço do `iniciar` é o do pedido que o clique no botão faz (respondido em 204, para a página ficar
 * onde está), e é ele que a API do contexto repete.
 */
async function voltaDoProvedor(page: Page, aluno: AlunoDeTeste, sujeito: string, hasTouch: boolean): Promise<string> {
  const api = page.context().request
  await page.route(ROTA_INICIAR, semNavegar)
  await loadUnthrottled(page, () => abrirEu(page, aluno))
  const [pedido] = await Promise.all([page.waitForRequest(ROTA_INICIAR), activate(botaoDeLigar(page), hasTouch)])
  await page.unroute(ROTA_INICIAR)
  const inicio = await api.get(pedido.url(), { maxRedirects: 0 })
  expect(inicio.status(), 'o `iniciar` leva ao provedor').toBe(302)
  // O provedor anuncia o próprio nome no compose (`oidc-falso:8080`): na máquina, a porta publicada, com o `Host` que ele espera.
  const ambiente = lerAmbienteDeTeste()
  const anunciado = new URL(inicio.headers()['location'] ?? '')
  const publicado = `http://127.0.0.1:${valorObrigatorio(ambiente, 'OIDC_FALSO_PORTA_HOST')}${anunciado.pathname}${anunciado.search}`
  const autorizada = await api.post(publicado, { headers: { Host: anunciado.host }, form: { username: sujeito, claims: '' }, maxRedirects: 0 })
  expect(autorizada.status(), 'o provedor devolve o navegador ao retorno').toBe(302)
  return autorizada.headers()['location'] ?? ''
}

test.describe('"Conta da escola" em "Eu": o aluno liga a conta e passa a entrar por ela', () => {
  test('a volta do provedor: "Conta da escola ligada" em "Eu", sem dado do provedor na tela nem no endereço, e o botão some', async ({ page, hasTouch }) => {
    const aluno = await alunoNaEscolaComProvedor()
    const retorno = await voltaDoProvedor(page, aluno, ALUNA_NO_PROVEDOR, hasTouch)

    await loadUnthrottled(page, () => page.goto(retorno))

    await expect(section(page).getByRole('status').filter({ hasText: LIGADA })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    // O endereço volta limpo: o resultado não fica no histórico do computador, e o F5 não o repete.
    await expect(page).toHaveURL(/\/aluno\/eu$/)
    await expect(botaoDeLigar(page)).toHaveCount(0)
    const corpo = await page.evaluate(() => ({ html: document.body.innerHTML, url: location.href }))
    for (const dado of DADOS_DA_ALUNA_NO_PROVEDOR) {
      expect(corpo.html, `dado do provedor na tela: ${dado}`).not.toContain(dado)
      expect(corpo.url, `dado do provedor na URL: ${dado}`).not.toContain(dado)
    }
  })

  test('a conta que é de outro aluno: a volta diz "Esta conta já está ligada a outro aluno", sem dizer a quem, e o botão segue à mão', async ({ page, hasTouch }) => {
    const aluno = await alunoNaEscolaComProvedor()
    const outro = await criarAlunoComMatricula({ escola: aluno })
    await ligarContaExterna(aluno.escolaId, outro.usuarioId, { provedor: 'google', sujeito: SUJEITO_DA_ALUNA })
    const retorno = await voltaDoProvedor(page, aluno, ALUNA_NO_PROVEDOR, hasTouch)

    await loadUnthrottled(page, () => page.goto(retorno))

    await expect(section(page).getByRole('alert')).toHaveText(CONFLITO, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page).toHaveURL(/\/aluno\/eu$/)
    await expect(botaoDeLigar(page)).toBeVisible()
    await expect(page.locator('body')).not.toContainText(outro.nome)
    await expect(page.locator('body')).not.toContainText(outro.matricula)
  })

  test('carregando: o clique deixa o botão ocupado, e o clique repetido não manda um segundo pedido; o `iniciar` leva o endereço da escola e a intenção, com o cookie de renovação', async ({ page, hasTouch }) => {
    const aluno = await alunoNaEscolaComProvedor()
    const pedidos: Array<{ url: string; cookie: string | undefined }> = []
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_INICIAR, async (rota: Route) => {
      pedidos.push({ url: rota.request().url(), cookie: (await rota.request().allHeaders())['cookie'] })
      await segurada
      await semNavegar(rota)
    })
    // Todo pedido ao `iniciar`, no instante em que o navegador o emite (antes de a rota o atender): o segundo, se houvesse, apareceria aqui.
    const emitidos: string[] = []
    page.on('request', (pedido) => {
      if (pedido.url().includes('/google/iniciar')) emitidos.push(pedido.url())
    })
    await anotarASecaoAposOClique(page)
    await abrirEu(page, aluno)
    await expect(botaoDeLigar(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    await activate(botaoDeLigar(page), hasTouch)
    liberar()

    // No instante do clique o botão já estava ocupado e desabilitado, e continua: o aluno impaciente não manda um segundo pedido.
    await expect(section(page).getByRole('button', { name: 'Ligando…' })).toBeDisabled({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(await secaoAposOClique(page)).toEqual({ botoes: [{ texto: 'Ligando…', desabilitado: true }], avisos: 0 })
    await section(page).getByRole('button', { name: 'Ligando…' }).dispatchEvent('click')
    // Uma ida e volta à página: os eventos do navegador chegam em ordem, e o pedido que o clique repetido tivesse emitido já foi visto.
    await page.evaluate(() => undefined)
    expect(emitidos).toHaveLength(1)
    expect(pedidos).toHaveLength(1)
    const consulta = new URL(pedidos[0]?.url ?? '').searchParams
    expect(consulta.get('slug')).toBe(aluno.slug)
    expect(consulta.get('intencao')).toBe('ligar')
    // Quem liga é o cookie de renovação, que vai na navegação da própria web: nada de sessão na URL.
    expect(pedidos[0]?.cookie ?? '').toContain('educa_sessao=')
    expect(pedidos[0]?.url).not.toMatch(/token|bilhete|sessao=/i)
  })

  test('rede: a leitura dos provedores que falha mostra o erro com "Tentar de novo", e o botão de ligar aparece quando a leitura volta', async ({ page, hasTouch }) => {
    const aluno = await alunoNaEscolaComProvedor()
    let falhar = true
    await page.route(ROTA_ACESSO, (rota: Route) => (falhar ? rota.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: { codigo: 'SERVICO_INDISPONIVEL', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }) }) : rota.continue()))
    await abrirEu(page, aluno)

    const tentar = page.getByRole('main').getByRole('button', { name: 'Tentar de novo' })
    await expect(tentar).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(botaoDeLigar(page)).toHaveCount(0)
    falhar = false
    await activate(tentar, hasTouch)
    await expect(botaoDeLigar(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  })

  test('recomeço: o aviso sai quando o aluno tenta de novo, e o botão "Tentar de novo" vira o ocupado', async ({ page, hasTouch }) => {
    const aluno = await alunoNaEscolaComProvedor()
    let liberar: () => void = () => undefined
    const segurada = new Promise<void>((resolver) => (liberar = resolver))
    await page.route(ROTA_INICIAR, async (rota: Route) => {
      await segurada
      await semNavegar(rota)
    })
    await anotarASecaoAposOClique(page)
    await abrirEu(page, aluno, '/aluno/eu?ligacao=provedor')
    await expect(section(page).getByRole('alert')).toHaveText(REDE, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page).toHaveURL(/\/aluno\/eu$/)

    await activate(section(page).getByRole('button', { name: 'Tentar de novo' }), hasTouch)
    liberar()

    // No instante do novo clique o aviso antigo já tinha saído e o botão estava ocupado; e a tela segue assim até o provedor responder.
    await expect(section(page).getByRole('button', { name: 'Ligando…' })).toBeDisabled({ timeout: SIGN_IN_TIMEOUT_MS })
    expect(await secaoAposOClique(page)).toEqual({ botoes: [{ texto: 'Ligando…', desabilitado: true }], avisos: 0 })
    await expect(section(page).getByRole('alert')).toHaveCount(0)
  })

  test('recomeço: o aluno seguinte no mesmo computador vê o "Eu" dele, sem o aviso do anterior', async ({ page, hasTouch }) => {
    const primeiro = await alunoNaEscolaComProvedor()
    const segundo = await criarAlunoComMatricula({ escola: primeiro })
    await abrirEu(page, primeiro, '/aluno/eu?ligacao=conflito')
    await expect(section(page).getByRole('alert')).toHaveText(CONFLITO, { timeout: SIGN_IN_TIMEOUT_MS })
    await sairPelaCasca(page, hasTouch)

    // O segundo entra na mesma aba, sem recarregar.
    await page.evaluate((slug) => {
      window.history.pushState(null, '', `/e/${slug}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, segundo.slug)
    await page.getByLabel('Matrícula').fill(segundo.matricula)
    await page.getByLabel('Senha').fill(segundo.senha)
    await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await expect(page).toHaveURL(/\/aluno\/inicio$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await irPelaNavegacao(page, 'Eu', hasTouch)

    await expect(botaoDeLigar(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(CONFLITO)
  })

  test('recomeço: a resposta atrasada da escola do aluno que saiu não troca o estado do seguinte', async ({ page, hasTouch }) => {
    const primeiro = await alunoNaEscolaComProvedor()
    const segundo = await criarAlunoComMatricula({ escola: primeiro })
    let vez: 'primeiro' | 'segundo' = 'primeiro'
    let abrirOPrimeiro: () => void = () => undefined
    const portaDoPrimeiro = new Promise<void>((resolver) => (abrirOPrimeiro = resolver))
    let atrasadaRespondida: () => void = () => undefined
    const atrasada = new Promise<void>((resolver) => (atrasadaRespondida = resolver))
    await page.route(ROTA_ACESSO, async (rota: Route) => {
      if (vez === 'segundo') return rota.continue()
      // A resposta do primeiro, que chegaria depois de o segundo estar na tela, diria que a escola não tem provedor.
      await portaDoPrimeiro
      await rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nome: primeiro.escolaNome, provedores: [] }) }).catch(() => undefined)
      atrasadaRespondida()
    })
    await abrirEu(page, primeiro)
    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Eu' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await sairPelaCasca(page, hasTouch)

    vez = 'segundo'
    await page.evaluate((slug) => {
      window.history.pushState(null, '', `/e/${slug}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, segundo.slug)
    await page.getByLabel('Matrícula').fill(segundo.matricula)
    await page.getByLabel('Senha').fill(segundo.senha)
    await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await expect(page).toHaveURL(/\/aluno\/inicio$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await irPelaNavegacao(page, 'Eu', hasTouch)
    await expect(botaoDeLigar(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

    abrirOPrimeiro()
    // A resposta atrasada é entregue (ou recusada, se a consulta já foi cancelada), e a página tem dois quadros para aplicá-la: ela não muda o que o segundo vê.
    await atrasada
    await page.evaluate(() => new Promise<void>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto()))))
    await expect(botaoDeLigar(page)).toBeVisible()
  })

  test('escola sem provedor liberado: a seção não existe, e "Eu" é o de sempre', async ({ page }) => {
    const aluno = await criarAlunoComMatricula()
    await abrirEu(page, aluno)

    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Eu' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(page.getByRole('main').getByRole('list', { name: 'Conta' })).toBeVisible()
    await expect(section(page)).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('button', { name: LIGAR })).toHaveCount(0)
  })

  test('360 px: sem rolagem horizontal, com o botão de 44 px, também com o aviso na tela', async ({ page }) => {
    const aluno = await alunoNaEscolaComProvedor()
    await abrirEu(page, aluno, '/aluno/eu?ligacao=conflito')
    await expect(section(page).getByRole('alert')).toHaveText(CONFLITO, { timeout: SIGN_IN_TIMEOUT_MS })

    const caixa = await botaoDeLigar(page).boundingBox()
    expect(caixa, 'o botão de ligar sem caixa').not.toBeNull()
    expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('1366 × 768: com a seção e duas tarefas corrigidas, a página cabe sem rolar', async ({ page }) => {
    const aluno = await alunoNaEscolaComProvedor()
    const turma = await colocarAlunoNaTurma(aluno)
    const trabalhos = [
      trabalhoNaMemoria({ titulo: 'Lista corrigida de reações', resultado: resultadoAprovado({ acertos: 1, total: 4, aReforcar: [HABILIDADE] }) }),
      trabalhoNaMemoria({ titulo: 'Lista corrigida de estequiometria', resultado: resultadoAprovado({ acertos: 3, total: 4, aReforcar: [HABILIDADE] }) }),
    ]
    await page.route(ROTA_MEMORIA, (rota: Route) => rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(memoriaDoAluno(trabalhos)) }))
    await abrirEu(page, aluno, '/aluno/eu?ligacao=conflito')

    const principal = page.getByRole('main')
    await expect(principal).toContainText('1 de 4 certas', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal.locator('header')).toContainText(turma.turmaNome, { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(section(page).getByRole('alert')).toHaveText(CONFLITO)
    await expect(principal.getByText(/^Carregando/)).toHaveCount(0)
    // A medida de altura vale na janela larga; o celular rola a página, mas nunca para o lado.
    expect(await horizontalOverflow(page), 'a página rola para o lado').toBe(0)
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      expect(page.viewportSize()).toEqual({ width: 1366, height: 768 })
      expect(await page.evaluate(() => document.documentElement.scrollHeight), 'a página rola').toBeLessThanOrEqual(768)
    }
    if ((page.viewportSize()?.width ?? 0) >= 1024) await expect(principal.getByRole('list', { name: 'Conta' }).getByRole('button', { name: 'Sair' })).toBeInViewport()
  })
})
