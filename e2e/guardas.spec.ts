import type { Page, TestInfo } from '@playwright/test'
import { avisoDaEsteira, descricaoDaTelaTravada, expect, linhaDoAviso, test } from './support/profiles.ts'
import { esperarPainel } from './support/casca.ts'
import { activateQuandoAparecer } from './support/coordenacao.ts'
import {
  HTML_PAGE_16_PX_BUTTONS,
  HTML_PAGE_44_PX_BUTTONS,
  HTML_PAGE_503_GLUED_TO_BUTTON,
  HTML_PAGE_503_IN_SCHOOL_NAME,
  HTML_PAGE_GOOD_CONTRAST,
  HTML_PAGE_LOW_CONTRAST,
  HTML_PAGE_RAW_503,
  HTML_PAGE_WITHIN_WIDTH,
  WIDE_PAGE,
} from './support/html-pages.ts'
import { horizontalOverflow, rawCodePattern, seriousViolations } from './support/checks.ts'

// As verificações que a casca usa, aplicadas a páginas com a violação de propósito. Se uma delas deixar
// de pegar, este spec fica vermelho, e não a casca verde por engano.

test.describe('guardas de celular e acessibilidade pegam de fato', () => {
  test('página mais larga que 360 px faz a verificação de rolagem horizontal falhar; a mesma, contida, passa', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.setContent(WIDE_PAGE)
    expect(await horizontalOverflow(page)).toBeGreaterThan(0)

    await page.setContent(HTML_PAGE_WITHIN_WIDTH)
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('botões de 16 px encostados fazem o axe reprovar target-size; os de 44 px não', async ({ page }) => {
    await page.setContent(HTML_PAGE_16_PX_BUTTONS)
    const violacoes = await seriousViolations(page)
    expect(violacoes.map((violacao) => violacao.regra)).toContain('target-size')

    await page.setContent(HTML_PAGE_44_PX_BUTTONS)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('página com violação serious faz o axe falhar; a mesma, corrigida, passa', async ({ page }) => {
    await page.setContent(HTML_PAGE_LOW_CONTRAST)
    expect(await seriousViolations(page)).toContainEqual(expect.objectContaining({ regra: 'color-contrast', impacto: 'serious' }))

    await page.setContent(HTML_PAGE_GOOD_CONTRAST)
    expect(await seriousViolations(page)).toEqual([])
  })
})

test.describe('a guarda do código cru de erro', () => {
  test('o 503 que mora no nome sintético da escola não conta; o da tela, em linha própria ou colado ao botão, conta', async ({ page }) => {
    // O nome sintético vem de oito caracteres hexadecimais, e dois deles trouxeram "503" na esteira de 12/10/2026
    // (`fa5030ac`, `a2503562`). A busca pela substring acusa a escola; a guarda procura o código, e não o pedaço.
    await page.setContent(HTML_PAGE_503_IN_SCHOOL_NAME)
    await expect(page.locator('body')).toContainText('503')
    await expect(page.locator('body')).not.toContainText(rawCodePattern('503'))

    for (const comErro of [HTML_PAGE_RAW_503, HTML_PAGE_503_GLUED_TO_BUTTON]) {
      await page.setContent(comErro)
      await expect(page.locator('body')).toContainText(rawCodePattern('503'))
    }
  })
})

/**
 * Separação mínima entre a aba limitada e a livre, medidas agora, para a medição da CPU decidir alguma coisa.
 * Abaixo dela a máquina está ocupada demais: a limitação quase não aparece, e o teste tenta de novo.
 */
const SEPARACAO_MINIMA = 1.5

test.describe('o perfil do projeto está aplicado', () => {
  // Só este teste do e2e tem nova tentativa. Ela existe para o runner ocupado demais para medir a CPU (a
  // separação abaixo do mínimo), mas o Playwright repete qualquer falha, e o que passa na segunda tentativa sai
  // como "flaky", sem ficar vermelho. O que segura isso é o defeito que a guarda vigia ser determinístico: uma
  // fixture sem a limitação reprova em toda tentativa (três de três, nos dois projetos, na correção de
  // 2026-09-18). Cada nova tentativa fica anotada no relatório, para a retrospectiva contar quantas houve.
  test.describe.configure({ retries: 2 })

  test('a rede tem a latência do perfil e a CPU fica mais lenta', async ({ page, profile }, testInfo) => {
    if (!profile) throw new Error('projeto sem perfil')
    if (testInfo.retry > 0) testInfo.annotations.push({ type: 'nova-tentativa', description: `tentativa ${testInfo.retry + 1} da medição de CPU` })
    await page.goto('/')

    // Rede: a ida e volta de um pedido pequeno à web leva pelo menos a latência declarada.
    const idaEVolta = await page.evaluate(async () => {
      const inicio = performance.now()
      await fetch(`/?sem-cache=${Math.random()}`, { cache: 'no-store' })
      return performance.now() - inicio
    })
    expect(idaEVolta).toBeGreaterThanOrEqual(profile.rede.latenciaMs * 0.9)

    // CPU. A limitação do Chromium é um teto na fatia de CPU da aba (1/cpuMaisLenta), e não um atraso fixo.
    // Com o runner disputado, a aba já recebe menos CPU que o teto, e a razão contra a aba livre cai junto:
    // na esteira ela chegou a 1,32 e 1,35 com a limitação aplicada, abaixo dos 2 que o teste exigia. Um número
    // fixo reprova a máquina, e não a configuração.
    //
    // Por isso a comparação é com referências medidas agora, na mesma máquina e na mesma carga: o estado que a
    // fixture deixou, medido antes de qualquer outra coisa, tem de parecer com a aba limitada por esta sessão
    // e não com a aba livre, isto é, ficar acima da média geométrica das duas. Sem a limitação da fixture, ele
    // fica igual ao livre e reprova. Vale o menor de cinco de cada lado: a ocupação só aumenta o tempo.
    const laco = () =>
      page.evaluate(() => {
        let acumulado = 0
        const inicio = performance.now()
        for (let indice = 0; indice < 5_000_000; indice++) acumulado = (acumulado + indice * 7) % 1_000_003
        return performance.now() - inicio + acumulado * 0
      })
    const menorDeCinco = async () => {
      await laco()
      let menor = Number.POSITIVE_INFINITY
      for (let vez = 0; vez < 5; vez++) menor = Math.min(menor, await laco())
      return menor
    }
    const doPerfil = await menorDeCinco()
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    const livre = await menorDeCinco()
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuMaisLenta })
    const limitadoAgora = await menorDeCinco()

    const separacao = limitadoAgora / livre
    expect(separacao, `máquina ocupada demais para medir a CPU: separação de ${separacao.toFixed(2)}`).toBeGreaterThanOrEqual(SEPARACAO_MINIMA)
    const medida = `perfil ${doPerfil.toFixed(1)} ms, livre ${livre.toFixed(1)} ms, limitado agora ${limitadoAgora.toFixed(1)} ms`
    expect(doPerfil, `a página não está com a CPU do perfil (${medida})`).toBeGreaterThanOrEqual(Math.sqrt(livre * limitadoAgora))
  })
})

/** Uma porta que o caso abre quando quer: o que está esperando nela segue. */
function porta(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

const ANOTACAO_DA_TRAVA = 'primeira-carga-travou'
const PRAZO_ENCURTADO_MS = 1_500

/**
 * A trava da primeira carga (casca 17/10, areas 26/10, incidentes 08/11): o documento chega, os scripts não, e o `load` não vem. Aqui os
 * scripts de cada navegação que o caso nomeia ficam presos na rota, até a porta que ele dá, o que dá ao `page.goto` o mesmo sintoma, sem
 * esperar que a trava de verdade aconteça. O tempo é o da rota, e não a folga da máquina.
 */
test.describe('a primeira carga que trava ganha uma nova tentativa, uma só, e fica anotada', () => {
  // O aviso do fixture vai para `avisosGuardados`, e não para o stdout: nenhum caso deste bloco escreve `::warning` na saída da esteira.
  const avisosGuardados: string[] = []
  test.use({ prazoDaNavegacaoMs: PRAZO_ENCURTADO_MS, avisoDaEsteira: { escrever: (linha) => avisosGuardados.push(linha) } })
  test.beforeEach(() => {
    avisosGuardados.length = 0
  })

  /** Prende os scripts da navegação de número `n` até `segurar[n]()` terminar. Devolve quantos documentos a página pediu até agora. */
  async function segurarOsScripts(page: Page, segurar: Record<number, () => Promise<void>>): Promise<() => number> {
    let documentos = 0
    page.on('request', (pedido) => {
      if (pedido.isNavigationRequest()) documentos += 1
    })
    await page.route('**/assets/*.js', async (rota) => {
      await segurar[documentos]?.()
      await rota.fallback().catch(() => undefined)
    })
    return () => documentos
  }

  const anotacoesDaTrava = (testInfo: TestInfo) => testInfo.annotations.filter((anotacao) => anotacao.type === ANOTACAO_DA_TRAVA)

  test('o goto que não termina no prazo é refeito, termina, anota só o caminho e avisa a esteira', async ({ page }, testInfo) => {
    const { aberta, abrir } = porta()
    const documentos = await segurarOsScripts(page, { 1: () => aberta })
    // A prova de que nada vai ao stdout real: o espião só guarda, não repassa, e é restaurado logo depois do `goto`.
    const escritasNoStdout: string[] = []
    const escrever = process.stdout.write.bind(process.stdout)
    process.stdout.write = ((trecho: string | Uint8Array) => {
      escritasNoStdout.push(String(trecho))
      return true
    }) as typeof process.stdout.write
    let resposta: Awaited<ReturnType<typeof page.goto>>
    try {
      // O fragmento e a query são onde moram o token do convite e o do bilhete: nem a anotação nem o aviso os levam.
      resposta = await page.goto('/#token-do-convite?convite=a')
    } finally {
      process.stdout.write = escrever as typeof process.stdout.write
      abrir()
    }
    expect(resposta?.status()).toBe(200)
    expect(documentos()).toBe(2)
    const anotacoes = anotacoesDaTrava(testInfo)
    expect(anotacoes).toHaveLength(1)
    expect(anotacoes[0]?.description).toBe(`/: sem load em ${PRAZO_ENCURTADO_MS} ms; uma nova tentativa`)
    expect(avisosGuardados).toHaveLength(1)
    expect(avisosGuardados[0]).toMatch(/^::warning title=primeira-carga-travou::/)
    expect(avisosGuardados[0]).toContain('e2e/guardas.spec.ts:')
    expect(avisosGuardados[0]).toContain(`/: sem load em ${PRAZO_ENCURTADO_MS} ms; uma nova tentativa`)
    expect(avisosGuardados[0]).not.toMatch(/token-do-convite|convite=a/)
    expect(escritasNoStdout.filter((linha) => linha.includes('primeira-carga-travou'))).toHaveLength(0)
  })

  test('a segunda tentativa é uma só e não tem prazo próprio: ela espera o que a rota segurar, além do prazo da primeira', async ({ page }, testInfo) => {
    const { aberta, abrir } = porta()
    // A segunda navegação só tem os scripts liberados 2,5 s depois: mais que o prazo da primeira (1,5 s). Com prazo próprio, ou com uma
    // terceira tentativa, ela terminaria em outra conta.
    const documentos = await segurarOsScripts(page, { 1: () => aberta, 2: () => new Promise((resolver) => setTimeout(resolver, 2 * PRAZO_ENCURTADO_MS - 500)) })
    try {
      const resposta = await page.goto('/')
      expect(resposta?.status()).toBe(200)
      expect(documentos()).toBe(2)
      expect(anotacoesDaTrava(testInfo)).toHaveLength(1)
    } finally {
      abrir()
    }
  })

  test('quem passa o próprio prazo não ganha nova tentativa', async ({ page }, testInfo) => {
    const { aberta, abrir } = porta()
    const documentos = await segurarOsScripts(page, { 1: () => aberta })
    try {
      await expect(page.goto('/', { timeout: 1_000 })).rejects.toThrow(/Timeout 1000ms/)
      expect(documentos()).toBe(1)
      expect(anotacoesDaTrava(testInfo)).toHaveLength(0)
    } finally {
      abrir()
    }
  })

  test('erro de rede que não é de prazo não é refeito nem anotado', async ({ page }, testInfo) => {
    let documentos = 0
    await page.route('**/', async (rota) => {
      documentos += 1
      if (documentos === 1) await rota.abort('connectionrefused')
      else await rota.fallback()
    })
    await expect(page.goto('/')).rejects.toThrow(/net::ERR_CONNECTION_REFUSED/)
    expect(documentos).toBe(1)
    expect(anotacoesDaTrava(testInfo)).toHaveLength(0)
  })
})

test.describe('o aviso padrão da trava só escreve na esteira do GitHub', () => {
  const saidaFalsa = () => {
    const linhas: string[] = []
    return { linhas, saida: { write: (linha: string) => linhas.push(linha) } }
  }

  // Um caso só, e não um por sentido: cada caso de e2e custa 7 s na conta do teto da fatia (`tools/ci/prazo-do-e2e.ts`), e a fatia 1 está no limite.
  test('o aviso padrão escreve a linha na esteira e não escreve nada fora dela', async ({ avisoDaEsteira: padrao }) => {
    const naEsteira = saidaFalsa()
    avisoDaEsteira({ GITHUB_ACTIONS: 'true' }, naEsteira.saida).escrever(linhaDoAviso('e2e/x.spec.ts:1', 'chromebook', 'd'))
    expect(naEsteira.linhas).toEqual(['::warning title=primeira-carga-travou::e2e/x.spec.ts:1 (chromebook) d\n'])

    const foraDela = saidaFalsa()
    avisoDaEsteira({}, foraDela.saida).escrever('x')
    avisoDaEsteira({ GITHUB_ACTIONS: 'false' }, foraDela.saida).escrever('x')
    expect(foraDela.linhas).toEqual([])

    // O padrão que o fixture usa, com o ambiente e a saída reais da execução: ligado o `GITHUB_ACTIONS`, a linha chega ao `stdout`. O espião só guarda.
    const escritasNoStdout: string[] = []
    const escrever = process.stdout.write.bind(process.stdout)
    const ambiente = process.env['GITHUB_ACTIONS']
    process.env['GITHUB_ACTIONS'] = 'true'
    process.stdout.write = ((trecho: string | Uint8Array) => {
      escritasNoStdout.push(String(trecho))
      return true
    }) as typeof process.stdout.write
    try {
      padrao.escrever(linhaDoAviso('e2e/x.spec.ts:1', 'chromebook', 'd'))
    } finally {
      process.stdout.write = escrever as typeof process.stdout.write
      if (ambiente === undefined) delete process.env['GITHUB_ACTIONS']
      else process.env['GITHUB_ACTIONS'] = ambiente
    }
    expect(escritasNoStdout).toEqual(['::warning title=primeira-carga-travou::e2e/x.spec.ts:1 (chromebook) d\n'])
  })
})

const PRAZO_DA_TELA_ENCURTADO_MS = 1_000
const TELA_CARREGANDO = '<!doctype html><html lang="pt-BR"><body><main><p role="status">Carregando…</p></main></body></html>'
const TELA_DO_PAINEL = '<!doctype html><html lang="pt-BR"><body><main><h1>Painel</h1></main></body></html>'
// Uma tela com `status` que não é a de "Carregando…": a falha de outra natureza, que o filtro do `esperarATela` tem de distinguir.
const TELA_COM_ERRO = '<!doctype html><html lang="pt-BR"><body><main><p role="status">Não foi possível carregar</p></main></body></html>'
const TELA_DO_PAINEL_AINDA_CARREGANDO = '<!doctype html><html lang="pt-BR"><body><main><h1>Painel</h1><p role="status">Carregando…</p></main></body></html>'
const TELA_DO_PAINEL_COM_A_ABA =
  '<!doctype html><html lang="pt-BR"><body><main><h1>Painel</h1><div role="tablist"><button role="tab" aria-selected="false" onclick="this.setAttribute(\'aria-selected\', \'true\')">Pedidos</button></div></main></body></html>'

/**
 * A trava da rede do navegador depois do `load` (pedidos-do-titular 15/11): a casca monta, e os pedaços e as leituras da tela, criados numa
 * rajada, nunca saem do navegador. A tela fica em "Carregando…" até o prazo do caso. Aqui a rota serve o endereço do Painel com essa tela
 * e, no pedido seguinte, com a tela de verdade: o tempo é o da rota, e não a folga da máquina.
 */
test.describe('a tela que fica em Carregando… depois da entrada ganha uma recarga, uma só, e fica anotada', () => {
  const avisosGuardados: string[] = []
  test.use({ prazoDaTelaMs: PRAZO_DA_TELA_ENCURTADO_MS, avisoDaEsteira: { escrever: (linha) => avisosGuardados.push(linha) } })
  test.beforeEach(() => {
    avisosGuardados.length = 0
  })

  /** Serve o Painel com a tela de cada pedido, na ordem; o último vale para os que vierem depois. Devolve quantos documentos pediram. */
  async function servirOPainel(page: Page, telas: readonly string[]): Promise<() => number> {
    let pedidos = 0
    await page.route('**/coordenacao/painel', async (rota) => {
      const tela = telas[Math.min(pedidos, telas.length - 1)] ?? TELA_CARREGANDO
      pedidos += 1
      await rota.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: tela })
    })
    return () => pedidos
  }

  const anotacoesDaTrava = (testInfo: TestInfo) => testInfo.annotations.filter((anotacao) => anotacao.type === ANOTACAO_DA_TRAVA)

  test('o Painel preso em Carregando… é recarregado, abre, anota e avisa a esteira', async ({ page }, testInfo) => {
    const pedidos = await servirOPainel(page, [TELA_CARREGANDO, TELA_DO_PAINEL])
    const enderecos: string[] = []
    page.on('framenavigated', (quadro) => {
      if (quadro === page.mainFrame()) enderecos.push(quadro.url())
    })
    await page.goto('/coordenacao/painel')
    await esperarPainel(page)
    expect(pedidos()).toBe(2)
    // A recarga passa por `about:blank`, que larga o documento preso e os pedidos dele.
    expect(enderecos.map((endereco) => (endereco.startsWith('about:') ? endereco : new URL(endereco).pathname))).toEqual([
      '/coordenacao/painel',
      'about:blank',
      '/coordenacao/painel',
    ])
    const anotacoes = anotacoesDaTrava(testInfo)
    expect(anotacoes).toHaveLength(1)
    expect(anotacoes[0]?.description).toBe(`/coordenacao/painel: a tela ficou em Carregando… por ${PRAZO_DA_TELA_ENCURTADO_MS} ms; uma recarga`)
    // A linha é pública na execução do GitHub: nada da query nem do fragmento vai a ela.
    expect(descricaoDaTelaTravada('http://x/coordenacao/painel?token=a#b', 1)).toBe('/coordenacao/painel: a tela ficou em Carregando… por 1 ms; uma recarga')
    expect(avisosGuardados).toHaveLength(1)
    expect(avisosGuardados[0]).toMatch(/^::warning title=primeira-carga-travou::/)
    expect(avisosGuardados[0]).toContain(`/coordenacao/painel: a tela ficou em Carregando… por ${PRAZO_DA_TELA_ENCURTADO_MS} ms; uma recarga`)
  })

  test('só a tela em Carregando… é recarregada, e a recarga é uma só: a falha de outra natureza e a segunda trava reprovam', async ({ page }, testInfo) => {
    // A espera falha e a tela NÃO está em Carregando…: não é a trava, e o caso reprova na primeira, sem recarga nem anotação.
    const outraTela = await servirOPainel(page, [TELA_COM_ERRO])
    await page.goto('/coordenacao/painel')
    await expect(esperarPainel(page)).rejects.toThrow(/toBeAttached/)
    expect(outraTela()).toBe(1)
    expect(anotacoesDaTrava(testInfo)).toHaveLength(0)

    // A tela volta a ficar em Carregando… na recarga: uma recarga só, e o caso reprova com o erro da espera.
    await page.unrouteAll({ behavior: 'wait' })
    const presa = await servirOPainel(page, [TELA_CARREGANDO])
    await page.goto('/coordenacao/painel')
    await expect(esperarPainel(page)).rejects.toThrow(/toBeAttached/)
    expect(presa()).toBe(2)
    expect(anotacoesDaTrava(testInfo)).toHaveLength(1)
    expect(avisosGuardados).toHaveLength(1)
  })

  test('a página de um contexto novo do navegador também ganha a recarga: no título do Painel e na aba que o clique espera', async ({ browser }, testInfo) => {
    // A trava é do caso, e não da página da fixture: a de outro navegador (roteiro da demonstração, incidentes) não pode lançar nem ficar sem a recarga.
    const contexto = await browser.newContext()
    try {
      const outra = await contexto.newPage()
      const pedidos = await servirOPainel(outra, [TELA_CARREGANDO, TELA_DO_PAINEL_AINDA_CARREGANDO, TELA_DO_PAINEL_COM_A_ABA])
      await outra.goto('/coordenacao/painel')
      await esperarPainel(outra)
      expect(pedidos()).toBe(2)
      // O título veio, e a aba, não: o clique (`activateQuandoAparecer`) espera a aba, e a tela em "Carregando…" é recarregada outra vez.
      const aba = outra.getByRole('tab', { name: 'Pedidos' })
      await activateQuandoAparecer(outra, aba, false)
      expect(pedidos()).toBe(3)
      await expect(aba).toHaveAttribute('aria-selected', 'true')
      expect(anotacoesDaTrava(testInfo)).toHaveLength(2)
      expect(avisosGuardados).toHaveLength(2)
    } finally {
      await contexto.close()
    }
  })
})
