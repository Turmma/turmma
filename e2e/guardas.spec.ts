import { expect, test } from './support/profiles.ts'
import {
  PAGINA_BOTOES_DE_16_PX,
  PAGINA_BOTOES_DE_44_PX,
  PAGINA_COM_503_NO_NOME_DA_ESCOLA,
  PAGINA_COM_CONTRASTE,
  PAGINA_COM_O_503_COLADO_AO_BOTAO,
  PAGINA_COM_O_503_CRU,
  PAGINA_DENTRO_DA_LARGURA,
  PAGINA_MAIS_LARGA,
  PAGINA_SEM_CONTRASTE,
} from './support/html-pages.ts'
import { codigoCru, larguraExcedente, violacoesGraves } from './support/checks.ts'

// As verificações que a casca usa, aplicadas a páginas com a violação de propósito. Se uma delas deixar
// de pegar, este spec fica vermelho, e não a casca verde por engano.

test.describe('guardas de celular e acessibilidade pegam de fato', () => {
  test('página mais larga que 360 px faz a verificação de rolagem horizontal falhar; a mesma, contida, passa', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.setContent(PAGINA_MAIS_LARGA)
    expect(await larguraExcedente(page)).toBeGreaterThan(0)

    await page.setContent(PAGINA_DENTRO_DA_LARGURA)
    expect(await larguraExcedente(page)).toBe(0)
  })

  test('botões de 16 px encostados fazem o axe reprovar target-size; os de 44 px não', async ({ page }) => {
    await page.setContent(PAGINA_BOTOES_DE_16_PX)
    const violacoes = await violacoesGraves(page)
    expect(violacoes.map((violacao) => violacao.regra)).toContain('target-size')

    await page.setContent(PAGINA_BOTOES_DE_44_PX)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('página com violação serious faz o axe falhar; a mesma, corrigida, passa', async ({ page }) => {
    await page.setContent(PAGINA_SEM_CONTRASTE)
    expect(await violacoesGraves(page)).toContainEqual(expect.objectContaining({ regra: 'color-contrast', impacto: 'serious' }))

    await page.setContent(PAGINA_COM_CONTRASTE)
    expect(await violacoesGraves(page)).toEqual([])
  })
})

test.describe('a guarda do código cru de erro', () => {
  test('o 503 que mora no nome sintético da escola não conta; o da tela, em linha própria ou colado ao botão, conta', async ({ page }) => {
    // O nome sintético vem de oito caracteres hexadecimais, e dois deles trouxeram "503" na esteira de 12/10/2026
    // (`fa5030ac`, `a2503562`). A busca pela substring acusa a escola; a guarda procura o código, e não o pedaço.
    await page.setContent(PAGINA_COM_503_NO_NOME_DA_ESCOLA)
    await expect(page.locator('body')).toContainText('503')
    await expect(page.locator('body')).not.toContainText(codigoCru('503'))

    for (const comErro of [PAGINA_COM_O_503_CRU, PAGINA_COM_O_503_COLADO_AO_BOTAO]) {
      await page.setContent(comErro)
      await expect(page.locator('body')).toContainText(codigoCru('503'))
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

  test('a rede tem a latência do perfil e a CPU fica mais lenta', async ({ page, perfil }, testInfo) => {
    if (!perfil) throw new Error('projeto sem perfil')
    if (testInfo.retry > 0) testInfo.annotations.push({ type: 'nova-tentativa', description: `tentativa ${testInfo.retry + 1} da medição de CPU` })
    await page.goto('/')

    // Rede: a ida e volta de um pedido pequeno à web leva pelo menos a latência declarada.
    const idaEVolta = await page.evaluate(async () => {
      const inicio = performance.now()
      await fetch(`/?sem-cache=${Math.random()}`, { cache: 'no-store' })
      return performance.now() - inicio
    })
    expect(idaEVolta).toBeGreaterThanOrEqual(perfil.rede.latenciaMs * 0.9)

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
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: perfil.cpuMaisLenta })
    const limitadoAgora = await menorDeCinco()

    const separacao = limitadoAgora / livre
    expect(separacao, `máquina ocupada demais para medir a CPU: separação de ${separacao.toFixed(2)}`).toBeGreaterThanOrEqual(SEPARACAO_MINIMA)
    const medida = `perfil ${doPerfil.toFixed(1)} ms, livre ${livre.toFixed(1)} ms, limitado agora ${limitadoAgora.toFixed(1)} ms`
    expect(doPerfil, `a página não está com a CPU do perfil (${medida})`).toBeGreaterThanOrEqual(Math.sqrt(livre * limitadoAgora))
  })
})
