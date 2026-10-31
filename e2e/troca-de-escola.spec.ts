import type { Locator, Page, Request, Response, Route } from '@playwright/test'
import { AVISO_DA_TROCA_RECUSADA } from '../packages/shared/src/errors/messages.ts'
import {
  abrirNavegacao,
  abrirSeletorDeEscola,
  botaoDoSeletor,
  entrarComoProfessora,
  entrarPorEmail,
  escolherNoSeletor,
  gaveta,
  irPelaNavegacao,
  lateral,
  linhaDoSeletor,
  naGaveta,
  nomeNoSeletor,
  PRAZO_DA_ENTRADA_MS,
  esperarNovaConversa,
  esperarInicioDoAluno,
  entrarPelaApi,
} from './support/casca.ts'
import { cacheDeConsultas, semAcessosDaConta } from './support/query-cache.ts'
import { expect, test } from './support/profiles.ts'
import { abrirEntregasDoAssistente } from './support/professor/entregas.ts'
import { criarAlocacaoDoProfessor, criarAlunoComMatricula, criarEquipeComSenha, criarUsuarioEmOutraEscola, type EquipeDeTeste } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, focoVisivel, larguraExcedente, violacoesGraves } from './support/checks.ts'

/**
 * O seletor de escola (P30; A1, tarefa 12.0): a troca que não deixa nada da escola anterior no cliente (W3), o formato de
 * espaço de trabalho com a escola, a rede e o papel (W13), o teclado, o toque e os 360 px (W12), e o recomeço da tela —
 * outra pessoa na mesma aba, a escola de agora escolhida de novo, a resposta de A que chega depois da troca e a troca
 * recusada com a lista aberta.
 */

const CAMINHO_DA_TROCA = '/v1/sessao/escola'
const ROTA_MEUS_VINCULOS = '**/v1/meus-vinculos*'
const NOME_DA_PROFESSORA_EM_B = 'Professora sintética na outra escola'

/**
 * O `POST /v1/sessao/escola`. É o mesmo da escolha no login, que leva o desafio `escolher` no lugar do token: quem conta
 * as trocas pelo seletor só começa a contar depois de a pessoa estar dentro da escola.
 */
function ehTroca(pedido: Request): boolean {
  return pedido.method() === 'POST' && new URL(pedido.url()).pathname === CAMINHO_DA_TROCA
}

/** O token de acesso que a requisição leva, ou `undefined`. */
function tokenDe(pedido: Request): string | undefined {
  const cabecalho = pedido.headers()['authorization']
  return cabecalho?.startsWith('Bearer ') ? cabecalho.slice('Bearer '.length) : undefined
}

/** Toque no celular, clique no Chromebook. */
async function acionar(page: Page, nome: string | RegExp, hasTouch: boolean): Promise<void> {
  const alvo = page.getByRole('button', { name: nome })
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** A professora de A e B entra por e-mail e escolhe A na tela da escolha do login. */
async function entrarEmA(page: Page, emA: EquipeDeTeste, hasTouch: boolean): Promise<void> {
  await page.goto('/entrar')
  await entrarPorEmail(page, emA, hasTouch)
  const escolherA = page.getByRole('button', { name: `${emA.escolaNome} · professor` })
  if (hasTouch) await escolherA.tap({ timeout: PRAZO_DA_ENTRADA_MS })
  else await escolherA.click({ timeout: PRAZO_DA_ENTRADA_MS })
  await esperarNovaConversa(page, emA.nome)
}

/** Caminha pelo teclado até o alvo, e falha se ele não estiver na ordem de foco ou se o foco não aparecer. */
async function tabAte(page: Page, alvo: Locator, descricao: string, maximoDeTeclas = 20): Promise<void> {
  for (let tecla = 0; tecla < maximoDeTeclas; tecla++) {
    await page.keyboard.press('Tab')
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) {
      expect(await focoVisivel(page), `foco invisível em ${descricao}`).toBe(true)
      return
    }
  }
  throw new Error(`${descricao} não foi alcançado pelo teclado em ${String(maximoDeTeclas)} teclas`)
}

/** Uma porta que segura a resposta até o teste abrir. */
function portao(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

test.describe('W3: a troca de escola não deixa nada de A no cliente', () => {
  test('depois da troca para B, nenhuma requisição leva o token de A, nenhuma resposta traz id de A, e o cache não guarda nada de A', async ({ page, hasTouch }) => {
    const emA = await criarEquipeComSenha()
    const emB = await criarUsuarioEmOutraEscola(emA.contaId)
    const deA = await criarAlocacaoDoProfessor(emA.escolaId, emA.usuarioId)
    const deB = await criarAlocacaoDoProfessor(emB.escolaId, emB.usuarioId, ['História'])

    // Tudo o que a aba mandou com token antes da troca é credencial de A; o que ela recebeu depois, é o que B mostrou.
    const tokensAntes = new Set<string>()
    const tokensDepois: string[] = []
    const respostasDepois: Array<Promise<string>> = []
    let tokenDeB: string | undefined
    let dentroDeA = false
    let trocou = false
    page.on('request', (pedido: Request) => {
      const token = tokenDe(pedido)
      if (token === undefined || ehTroca(pedido)) return
      if (trocou) tokensDepois.push(token)
      else tokensAntes.add(token)
    })
    page.on('response', (resposta: Response) => {
      const pedido = resposta.request()
      if (ehTroca(pedido) && dentroDeA) {
        // Daqui em diante, tudo é da escola B: a resposta da troca é o momento em que o token de B passa a existir.
        trocou = true
        respostasDepois.push(resposta.text().then((corpo) => ((tokenDeB = (JSON.parse(corpo) as { token?: string }).token), '')))
        return
      }
      if (trocou && new URL(resposta.url()).pathname.startsWith('/v1/')) respostasDepois.push(resposta.text().catch(() => ''))
    })

    await entrarEmA(page, emA, hasTouch)
    dentroDeA = true
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(page.getByRole('main')).toContainText(deA.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    // O controle: antes da troca, o cache guarda de fato a turma de A. Sem isto, a ausência depois não provaria nada.
    expect(semAcessosDaConta(await cacheDeConsultas(page))).toContain(deA.turmaId)

    // A troca sai da tela de Turmas de A, com a lista dela montada e no cache.
    await escolherNoSeletor(page, nomeNoSeletor(emB, 'professor'), hasTouch)
    await esperarNovaConversa(page, NOME_DA_PROFESSORA_EM_B)
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(page.getByRole('main')).toContainText(deB.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    const corpos = await Promise.all(respostasDepois)

    // Nenhuma requisição depois da troca levou o token de A: a limpeza refez as buscas já com o de B.
    expect(tokenDeB).toBeDefined()
    expect(tokensAntes.size).toBeGreaterThan(0)
    expect(tokensDepois.length).toBeGreaterThan(0)
    expect(tokensDepois.filter((token) => tokensAntes.has(token))).toEqual([])
    expect(tokensDepois).toContain(tokenDeB)

    // Nenhuma resposta depois da troca trouxe id, nome ou turma de A. A única citação de A é a lista `acessos`, que é o
    // seletor da própria conta, e ela sai da conta antes de procurar.
    const deEscolaA = [emA.escolaId, emA.usuarioId, emA.escolaNome, emA.nome, deA.turmaId, deA.turmaNome, ...deA.vinculoIds]
    const semAcessos = corpos.map((corpo) => (corpo === '' ? '' : semAcessosDaConta(JSON.parse(corpo) as unknown))).join('\n')
    expect(semAcessos).toContain(deB.turmaId)
    for (const deA_ of deEscolaA) expect(semAcessos).not.toContain(deA_)

    // E o cache do TanStack, lido de dentro da página: só B, fora a lista `acessos`.
    const cache = semAcessosDaConta(await cacheDeConsultas(page))
    expect(cache).toContain(deB.turmaId)
    for (const deA_ of deEscolaA) expect(cache).not.toContain(deA_)
  })
})

test.describe('W13: o seletor no formato de espaço de trabalho', () => {
  test('cada escola com a rede e o papel, a de agora marcada, e nada de dentro da outra escola', async ({ page, hasTouch }) => {
    const emA = await criarEquipeComSenha()
    const emB = await criarUsuarioEmOutraEscola(emA.contaId, 'coordenador')
    // B tem turma: nem o nome dela nem a quantidade podem aparecer no seletor visto de A.
    const deB = await criarAlocacaoDoProfessor(emB.escolaId, emB.usuarioId)
    await entrarEmA(page, emA, hasTouch)

    await abrirNavegacao(page, hasTouch)
    // O botão diz onde a pessoa está: a escola, a rede e o papel dela ali.
    await expect(botaoDoSeletor(page)).toHaveAccessibleName(`Escola: ${nomeNoSeletor(emA, 'professor')}`)
    await expect(botaoDoSeletor(page)).toHaveAttribute('aria-expanded', 'false')
    await abrirSeletorDeEscola(page, hasTouch)

    const lista = lateral(page).getByRole('list', { name: 'Suas escolas' })
    // As duas escolas da conta, em ordem de nome, e só elas; na tela, o nome em cima e a rede com o papel embaixo.
    await expect(lista.getByRole('button')).toHaveCount(2)
    await expect(lista.getByRole('button').nth(0)).toHaveAccessibleName(nomeNoSeletor(emA, 'professor'))
    await expect(lista.getByRole('button').nth(1)).toHaveAccessibleName(nomeNoSeletor(emB, 'coordenação'))
    for (const [acesso, papel] of [
      [emA, 'professor'],
      [emB, 'coordenação'],
    ] as const) {
      const linha = linhaDoSeletor(page, nomeNoSeletor(acesso, papel))
      await expect(linha.getByText(acesso.escolaNome, { exact: true })).toBeVisible()
      await expect(linha.getByText(`${acesso.redeNome} · ${papel}`, { exact: true })).toBeVisible()
    }
    // A marca de escolhido é da escola de agora, e só dela: o ícone e o `aria-current`.
    await expect(linhaDoSeletor(page, nomeNoSeletor(emA, 'professor'))).toHaveAttribute('aria-current', 'true')
    await expect(linhaDoSeletor(page, nomeNoSeletor(emA, 'professor')).locator('svg')).toHaveCount(1)
    await expect(linhaDoSeletor(page, nomeNoSeletor(emB, 'coordenação'))).not.toHaveAttribute('aria-current', 'true')
    await expect(linhaDoSeletor(page, nomeNoSeletor(emB, 'coordenação')).locator('svg')).toHaveCount(0)
    // Nada de dentro de B: nem a turma, nem um número de turmas.
    await expect(lateral(page)).not.toContainText(deB.turmaNome)
    await expect(lista).not.toContainText(/\d+ turmas?/)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('com uma escola só, mostra o nome e não abre', async ({ page, hasTouch }) => {
    const professora = await entrarComoProfessora(page, hasTouch)
    await abrirNavegacao(page, hasTouch)
    await expect(lateral(page)).toContainText(`Escola: ${professora.escolaNome}`)
    // Só o nome: a rede vem nos acessos, e com uma escola só não há lista para mostrá-la.
    await expect(lateral(page)).not.toContainText(professora.redeNome)
    await expect(botaoDoSeletor(page)).toHaveCount(0)
    await expect(lateral(page).getByRole('list', { name: 'Suas escolas' })).toHaveCount(0)
    // Nada ali abre: o nome é texto, e não um controle. O sino "Esperando você" (X3) também tem `aria-expanded` e, no computador,
    // `lateral` é a página inteira: ele é de outra peça, e fica de fora da conta.
    await expect(lateral(page).locator('[aria-expanded]:not([aria-label^="Esperando você"])')).toHaveCount(0)
    expect(await violacoesGraves(page)).toEqual([])
  })
})

test.describe('W12: o seletor pelo teclado, pelo toque e a 360 px', () => {
  test('abre e escolhe só com teclado; o Esc fecha a lista sem fechar a gaveta; alvos de 44 px e nada passa da largura', async ({ page, hasTouch }) => {
    const emA = await criarEquipeComSenha()
    const emB = await criarUsuarioEmOutraEscola(emA.contaId)
    await entrarEmA(page, emA, hasTouch)

    if (naGaveta(page)) {
      await page.getByRole('button', { name: 'Abrir o menu' }).focus()
      await page.keyboard.press('Enter')
      await expect(gaveta(page)).toBeVisible()
    }
    const botao = botaoDoSeletor(page)
    await tabAte(page, botao, 'o seletor de escola')
    await page.keyboard.press('Enter')
    await expect(botao).toHaveAttribute('aria-expanded', 'true')
    // O foco vai para a escola de agora, e o Tab chega à outra.
    const linhaDeA = linhaDoSeletor(page, nomeNoSeletor(emA, 'professor'))
    const linhaDeB = linhaDoSeletor(page, nomeNoSeletor(emB, 'professor'))
    await expect(linhaDeA).toBeFocused()
    for (const alvo of [botao, linhaDeA, linhaDeB]) {
      const caixa = await alvo.boundingBox()
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    }
    await page.setViewportSize({ width: 360, height: 800 })
    if (naGaveta(page) && !(await gaveta(page).isVisible())) await abrirNavegacao(page, hasTouch)
    if ((await botao.getAttribute('aria-expanded')) !== 'true') await abrirSeletorDeEscola(page, hasTouch)
    // De novo a 360 px: no Chromebook, a medida de cima foi na lateral aberta, e aqui é a gaveta.
    for (const alvo of [botao, linhaDeA, linhaDeB]) {
      const caixa = await alvo.boundingBox()
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    }
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // O Esc fecha a lista e devolve o foco ao botão; a gaveta continua aberta.
    await linhaDoSeletor(page, nomeNoSeletor(emA, 'professor')).focus()
    await page.keyboard.press('Escape')
    await expect(botao).toHaveAttribute('aria-expanded', 'false')
    await expect(botao).toBeFocused()
    await expect(gaveta(page)).toBeVisible()

    // E de novo, só com Enter e Tab, até a outra escola.
    await page.keyboard.press('Enter')
    await expect(linhaDoSeletor(page, nomeNoSeletor(emA, 'professor'))).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(linhaDoSeletor(page, nomeNoSeletor(emB, 'professor'))).toBeFocused()
    expect(await focoVisivel(page)).toBe(true)
    await page.keyboard.press('Enter')
    await esperarNovaConversa(page, NOME_DA_PROFESSORA_EM_B)
  })
})

test.describe('recomeço da tela do seletor', () => {
  test('segunda pessoa: sai a professora de A e B, entra o aluno na mesma aba, sem seletor nem cache dela', async ({ page, hasTouch }) => {
    // As preparações que não dependem uma da outra vão em paralelo: o caso gasta a da mais lenta (cada uma cria conta, com o hash da senha).
    const [emA, aluno] = await Promise.all([criarEquipeComSenha(), criarAlunoComMatricula()])
    const [emB, deA] = await Promise.all([criarUsuarioEmOutraEscola(emA.contaId), criarAlocacaoDoProfessor(emA.escolaId, emA.usuarioId)])
    // A entrada da professora não é o assunto do caso: pela API, e o segundo login (o do aluno, pelo formulário) é o que cabe nos 15 s.
    await entrarPelaApi(page, emA, '/professor/turmas', emA.usuarioId)
    await expect(page.getByRole('main')).toContainText(deA.turmaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    // A lista fica aberta quando ela sai: é o estado que a pessoa seguinte não pode herdar.
    await abrirSeletorDeEscola(page, hasTouch)
    const sair = lateral(page).getByRole('button', { name: 'Sair' })
    if (hasTouch) await sair.tap()
    else await sair.click()
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })

    // O aluno entra na mesma aba, sem recarregar: o módulo da web continua na memória da página.
    await page.evaluate((slug) => {
      window.history.pushState(null, '', `/e/${slug}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, aluno.slug)
    await page.getByLabel('Matrícula').fill(aluno.matricula)
    await page.getByLabel('Senha').fill(aluno.senha)
    await acionar(page, /^Entrar$/, hasTouch)
    await esperarInicioDoAluno(page, aluno.nome)

    // Contagem de nós, e não de nós à vista: vale com a gaveta fechada, e abri-la só gastaria o tempo do caso.
    await expect(botaoDoSeletor(page)).toHaveCount(0)
    await expect(lateral(page).getByRole('list', { name: 'Suas escolas' })).toHaveCount(0)
    // Um só texto lido, e cada nome conferido nele: seis esperas em sequência seriam seis idas ao navegador.
    const tela = (await page.locator('body').textContent()) ?? ''
    for (const daProfessora of [emA.escolaNome, emB.escolaNome, emA.redeNome, emB.redeNome, emA.nome, deA.turmaNome]) expect(tela).not.toContain(daProfessora)
    const cache = semAcessosDaConta(await cacheDeConsultas(page))
    for (const daProfessora of [emA.usuarioId, emB.usuarioId, emA.escolaId, deA.turmaId]) expect(cache).not.toContain(daProfessora)
    expect(cache).toContain(aluno.usuarioId)
  })

  test('mesma entrada: escolher a escola em que já se está fecha a lista, sem troca nem token novo', async ({ page, hasTouch }) => {
    const emA = await criarEquipeComSenha()
    await criarUsuarioEmOutraEscola(emA.contaId)
    // O token com que a página leu o `/v1/eu` dentro de A, e os que ela mandou depois de entrar.
    let tokenDeA: string | undefined
    let dentroDeA = false
    const tokens: string[] = []
    let trocas = 0
    page.on('request', (pedido: Request) => {
      if (!dentroDeA) {
        if (new URL(pedido.url()).pathname === '/v1/eu') tokenDeA = tokenDe(pedido)
        return
      }
      // A escolha da escola no login é o mesmo `POST`: só depois de entrar ele seria troca pelo seletor.
      if (ehTroca(pedido)) trocas++
      const token = tokenDe(pedido)
      if (token !== undefined) tokens.push(token)
    })
    await entrarEmA(page, emA, hasTouch)
    dentroDeA = true
    expect(tokenDeA).toBeDefined()

    await escolherNoSeletor(page, nomeNoSeletor(emA, 'professor'), hasTouch)
    await expect(botaoDoSeletor(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(botaoDoSeletor(page)).toBeFocused()
    await esperarNovaConversa(page, emA.nome)

    // As telas seguintes ainda falam com o mesmo token: nenhuma sessão nova foi gravada. Turmas pode não pedir nada (a
    // Nova conversa já leu os vínculos, e o cache das consultas os serve); a tela do Assistente, aberta pelo pé do sino, lê a lista inteira das
    // entregas, que a Nova conversa não lê, e por isso sempre sai ao menos um pedido observado depois da escolha.
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(page.getByText('A coordenação ainda não alocou você')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    const listaDasEntregas = page.waitForRequest((pedido) => {
      const url = new URL(pedido.url())
      return url.pathname === '/v1/entregas' && !url.searchParams.has('estado')
    })
    await abrirEntregasDoAssistente(page, hasTouch)
    await listaDasEntregas
    expect(trocas).toBe(0)
    expect(tokens.length).toBeGreaterThan(0)
    expect(new Set(tokens)).toEqual(new Set([tokenDeA]))
  })

  test('resposta atrasada: a lista de A que chega depois da troca não aparece em B', async ({ page, hasTouch }) => {
    const emA = await criarEquipeComSenha()
    const emB = await criarUsuarioEmOutraEscola(emA.contaId)
    const deA = await criarAlocacaoDoProfessor(emA.escolaId, emA.usuarioId)

    // Só a primeira leitura, a de A, fica presa; a de B, depois da troca, passa. A rota entra antes da entrada: a Nova
    // conversa já lê os vínculos, e com a leitura dela livre a de Turmas saía do cache, sem janela nenhuma de
    // carregamento (falhou assim no celular, esteira `37250031803`). Só telas do professor leem os vínculos.
    const segurada = portao()
    let leituras = 0
    await page.route(ROTA_MEUS_VINCULOS, async (rota: Route) => {
      leituras++
      if (leituras === 1) await segurada.aberta
      // A leitura de A pode ter sido cancelada pela troca: aí não há mais a quem responder.
      await rota.continue().catch(() => undefined)
    })
    await entrarEmA(page, emA, hasTouch)
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(page.getByText('Carregando as suas turmas…')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })

    await escolherNoSeletor(page, nomeNoSeletor(emB, 'professor'), hasTouch)
    await esperarNovaConversa(page, NOME_DA_PROFESSORA_EM_B)
    // A lista de A chega agora, com B na tela. Dois quadros depois, o que ela fosse pintar já estaria lá.
    segurada.abrir()
    await page.evaluate(() => new Promise<void>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto()))))
    await expect(page.locator('body')).not.toContainText(deA.turmaNome)

    // E em "Turmas" de B, que é onde a lista de A cairia se tivesse ficado no cache.
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(page.getByText('A coordenação ainda não alocou você')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.locator('body')).not.toContainText(deA.turmaNome)
    expect(semAcessosDaConta(await cacheDeConsultas(page))).not.toContain(deA.turmaId)
  })

  test('falha com o seletor aberto: dois toques mandam uma troca só, a recusada mostra o aviso, e ao reabrir o aviso sai e o foco vai para a escola de agora', async ({
    page,
    hasTouch,
  }) => {
    const emA = await criarEquipeComSenha()
    const emB = await criarUsuarioEmOutraEscola(emA.contaId)
    await entrarEmA(page, emA, hasTouch)
    const segurada = portao()
    let trocas = 0
    await page.route(`**${CAMINHO_DA_TROCA}`, async (rota: Route) => {
      trocas++
      await segurada.aberta
      await rota.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }),
      })
    })

    // Dois toques na mesma escola enquanto a troca está no ar: abririam duas sessões no destino. No Chromebook, o clique
    // duplo; no celular, o segundo toque logo depois do primeiro, sem esperar a tela (`force`: o Playwright esperaria o
    // `aria-disabled` sair, e a pessoa não espera).
    await abrirSeletorDeEscola(page, hasTouch)
    const escolherB = linhaDoSeletor(page, nomeNoSeletor(emB, 'professor'))
    if (hasTouch) {
      await escolherB.tap()
      await linhaDoSeletor(page, `Abrindo ${emB.escolaNome}…`).tap({ force: true })
    } else await escolherB.dblclick()
    const linhaDeB = linhaDoSeletor(page, `Abrindo ${emB.escolaNome}…`)
    await expect(linhaDeB).toHaveAttribute('aria-disabled', 'true')
    // A troca no ar é anunciada numa região de status, e não só pelo nome da linha com o foco, que cada leitor lê de um jeito.
    await expect(lateral(page).getByRole('status').filter({ hasText: `Abrindo ${emB.escolaNome}…` })).toHaveCount(1)
    // O foco não se perde no `body` enquanto a troca está no ar: fica na linha que a pessoa escolheu.
    await expect(linhaDeB).toBeFocused()
    segurada.abrir()

    const aviso = lateral(page).getByRole('alert')
    await expect(aviso).toHaveText(AVISO_DA_TROCA_RECUSADA, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(trocas).toBe(1)
    await expect(linhaDoSeletor(page, nomeNoSeletor(emB, 'professor'))).toBeFocused()
    await expect(page.locator('body')).not.toContainText('NAO_ENCONTRADO')
    expect(await violacoesGraves(page)).toEqual([])

    // Fecha e reabre: o aviso era da tentativa anterior, e o foco vai para a escola de agora, e não para a que falhou.
    await page.keyboard.press('Escape')
    await expect(botaoDoSeletor(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(aviso).toHaveCount(0)
    await expect(linhaDoSeletor(page, nomeNoSeletor(emA, 'professor'))).toBeFocused()
    // E ela continua em A, com a sessão de pé.
    await esperarNovaConversa(page, emA.nome)
  })
})
