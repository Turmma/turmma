import type { Page } from '@playwright/test'
import { carregarSemRedeLenta, expect, test, type PerfilDeMaquina } from './support/profiles.ts'
import { abrirGaleria, acionar, conferirQueCabeNaJanela, desenho, desenhos, medirBlocosDaGaleria, secao } from './support/gallery.ts'
import { larguraExcedente, violacoesGraves } from './support/checks.ts'

/**
 * As peças do MVP de apresentação (`docs/mvp-rapido.md` 9.3; `docs/interface.md` 11.1 e 11.3), na galeria (`/galeria`),
 * nos projetos `chromebook` e `celular`: o que a regra de cada peça promete, visto no navegador. A galeria não chama a
 * API e não tem sessão; o dado é inventado, escrito nela.
 *
 * Este arquivo é o grupo `galeria` do antigo `pecas.spec.ts` (tarefa 2.0 da X1): cada caso veio inteiro, com a mesma
 * asserção, e só mudou de arquivo. Os auxiliares comuns estão em `support/gallery.ts`.
 */

test.describe('peças do MVP de apresentação, na galeria', () => {
  // Este caso era um só, de 9,9 s na máquina e 31,9 s no runner do celular (execução 40880199949, 1ª tentativa); são três, que
  // abrem a galeria cada um e dividem o que ele afirmava, sem tirar asserção. O runner leva uns três vezes o tempo da máquina
  // nos casos que são só CPU ×4 (a galeria não chama a API).
  test('nenhuma peça passa da largura da janela, e o axe não acha violação na galeria', async ({ page }) => {
    await abrirGaleria(page)
    expect(await larguraExcedente(page)).toBe(0)
    // Cada bloco da galeria cabe na janela e não rola por dentro: uma peça que estourasse dentro de um contêiner com rolagem
    // passaria na conta do documento.
    const blocos = await medirBlocosDaGaleria(page)
    expect(blocos.total).toBeGreaterThanOrEqual(15)
    expect(blocos.passamDaJanela, 'blocos que passam da janela').toEqual([])
    expect(blocos.comRolagemPropria, 'blocos com rolagem horizontal própria').toEqual([])
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('o menu de ferramenta da caixa de pedido abre, cabe na janela, não tem violação e escolhe um item só', async ({ page, hasTouch }) => {
    await abrirGaleria(page)
    // O menu de ferramenta da caixa de pedido: abre, cabe na janela a 360 px, e continua sem violação.
    const ferramenta = secao(page, 'caixa-pedido').getByRole('button', { name: 'Ferramenta: Só conversar' })
    await acionar(ferramenta, hasTouch)
    const menu = page.getByRole('menu', { name: 'Ferramenta: Só conversar' })
    await expect(menu).toBeVisible()
    await conferirQueCabeNaJanela(page, menu)
    expect(await violacoesGraves(page)).toEqual([])
    // A Adaptação não fica ao lado de uma caixa de texto livre: ela abre o formulário de tipos, e não leva o texto (D35).
    await expect(menu.getByRole('menuitemradio')).toHaveCount(3)
    await expect(menu.getByRole('menuitemradio', { name: /Adaptação/ })).toHaveCount(0)
    // É menu de escolha única: o item de agora vem marcado, e escolher outro troca o texto do botão.
    await expect(menu.getByRole('menuitemradio', { name: /Só conversar/ })).toHaveAttribute('aria-checked', 'true')
    await acionar(menu.getByRole('menuitemradio', { name: /Atividade objetiva/ }), hasTouch)
    await expect(menu).toHaveCount(0)
    await expect(secao(page, 'caixa-pedido').getByRole('button', { name: 'Ferramenta: Atividade objetiva' })).toBeFocused()
  })

  test('os selos de estado dizem o estado em texto, a faixa do aluno não fecha e o número de painel vem no formato local', async ({ page }) => {
    await abrirGaleria(page)
    // Os selos de estado dizem o estado em texto, e não só na cor.
    const estado = secao(page, 'estado')
    for (const texto of ['Esperando você', 'Aprovado', 'Rejeitado', 'Faz e avisa']) await expect(estado.getByText(texto, { exact: true })).toBeVisible()
    // A faixa do aluno não fecha: não tem botão nenhum.
    const faixa = estado.getByRole('note')
    await expect(faixa).toHaveText('Seu professor acompanha como você usa o Tutor.')
    await expect(faixa.getByRole('button')).toHaveCount(0)
    // A barra diz o valor em texto, e o número de painel vem no formato local.
    await expect(secao(page, 'painel').getByText('12 de 60 perguntas')).toBeVisible()
    await expect(secao(page, 'painel').getByText('72%')).toBeVisible()
    await expect(secao(page, 'painel').getByText('1.412')).toBeVisible()
  })
})

/**
 * Os dois verificadores em lote da galeria, com uma página montada com cada defeito (correção
 * `2026-10-16-galeria-da-onca-estoura-o-prazo`): quem confere em lote tem de continuar vendo o que o laço via.
 */
test.describe('os verificadores em lote da galeria', () => {
  test('medirBlocosDaGaleria acusa o bloco que passa da janela (largo, ou deslocado à direita), ainda que dentro de um contêiner com rolagem, e o que rola por dentro', async ({ page }) => {
    await page.setContent(`<meta name="viewport" content="width=device-width"><body>
      <div style="overflow-x:auto;width:200px"><section data-galeria="largo" style="width:2500px">x</section></div>
      <section data-galeria="com-rolagem" style="width:100px;overflow-x:auto"><div style="width:900px">y</div></section>
      <section data-galeria="deslocado" style="margin-left:1500px;width:100px">z</section>
      <section data-galeria="ok">ok</section>
    </body>`)
    expect(await medirBlocosDaGaleria(page)).toEqual({ total: 4, passamDaJanela: ['largo', 'deslocado'], comRolagemPropria: ['com-rolagem'] })
  })

  test('medirBlocosDaGaleria deixa passar o bloco que cabe, e conta os blocos', async ({ page }) => {
    await page.setContent('<meta name="viewport" content="width=device-width"><body><section data-galeria="a">a</section><section data-galeria="b">b</section></body>')
    expect(await medirBlocosDaGaleria(page)).toEqual({ total: 2, passamDaJanela: [], comRolagemPropria: [] })
  })

  test('desenhos devolve o desenho de cada peça, na ordem, com os sete campos do `desenho` de uma só', async ({ page }) => {
    // Duas peças que diferem em todos os campos: se um campo de `desenhos` for zerado, trocado de propriedade ou sair da
    // ordem, a comparação com o `desenho` de cada peça (que é o de uma ida por peça) reprova.
    await page.setContent(`<body>
      <p id="a" style="background:rgb(1, 2, 3);color:rgb(4, 5, 6);border:2px solid rgb(7, 8, 9);font-weight:700;font-size:15px;border-radius:12px;padding:3px">a</p>
      <p id="b" style="background:rgb(11, 12, 13);color:rgb(14, 15, 16);border:4px dashed rgb(17, 18, 19);font-weight:400;font-size:20px;border-radius:4px;padding:9px">b</p>
    </body>`)
    const [a, b] = [await desenho(page.locator('#a')), await desenho(page.locator('#b'))]
    for (const campo of Object.keys(a) as Array<keyof typeof a>) expect(a[campo], `o campo ${String(campo)} tem de diferir entre as duas peças, ou não prova nada`).not.toBe(b[campo])
    expect(await desenhos(page.locator('p'))).toEqual([a, b])
  })
})

/**
 * A abertura da galeria não paga a latência do perfil (correção `2026-10-16-pecas-sobrepor-estoura-o-prazo`). Os pedaços
 * da galeria são umas cinquenta ida e volta pequenas, e cada rodada custava a latência da rede do perfil inteira (562,5 ms
 * no Fast 3G, 600 no celular): mais de seis segundos por caso, antes de o caso fazer qualquer coisa. O piso é fixo, e é
 * ele que estes casos medem: com a rede do perfil ligada, nenhum pedido termina antes dele.
 */
const PISO_DA_LATENCIA_DO_PERFIL_MS = 500

/**
 * Quanto cada pedaço de JS que a página baixou levou do pedido ao fim da resposta (`PerformanceResourceTiming.duration`). É
 * a duração, e não o primeiro byte, que carrega a latência emulada: o navegador a conta depois do primeiro byte, e o que
 * espera na fila das seis conexões também entra.
 */
function duracaoDosPedacosDeJs(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((pedido) => new URL(pedido.name).pathname.startsWith('/assets/') && pedido.name.endsWith('.js'))
      .map((pedido) => pedido.duration),
  )
}

/** O que um pedido novo, que não vem do cache, levou até chegar, e quantos bytes baixou (o que o servidor mandou, comprimido). */
interface PedidoMedido {
  ms: number
  baixados: number
}

/**
 * Pede de novo o maior pedaço de JS que a página baixou, pelo mesmo caminho dos pedaços da galeria, e mede quanto leva. Com
 * `enviar`, manda esse tanto de bytes no corpo (um POST, que o servidor recusa depois de receber): é o que mede a subida.
 */
function pedidoNovo(page: Page, enviar = 0): Promise<PedidoMedido> {
  return page.evaluate(async (bytesEnviados) => {
    const pedacos = performance
      .getEntriesByType('resource')
      .filter((pedido) => new URL(pedido.name).pathname.startsWith('/assets/') && pedido.name.endsWith('.js')) as PerformanceResourceTiming[]
    const maior = pedacos.reduce<PerformanceResourceTiming | undefined>((atual, pedaco) => (atual === undefined || pedaco.encodedBodySize > atual.encodedBodySize ? pedaco : atual), undefined)
    if (maior === undefined) throw new Error('a página não baixou nenhum pedaço de JS')
    const inicio = performance.now()
    const resposta = await fetch(maior.name, bytesEnviados === 0 ? { cache: 'no-store' } : { method: 'POST', body: new Uint8Array(bytesEnviados) })
    await resposta.arrayBuffer()
    return { ms: performance.now() - inicio, baixados: maior.encodedBodySize }
  }, enviar)
}

/** Os 500 ms são o piso da latência; a vazão do perfil soma ao piso o tempo de passar os bytes, com 20% de folga para baixo. */
function tempoMinimoDoPerfil(perfil: PerfilDeMaquina | undefined, baixados: number, enviados: number): number {
  if (perfil === undefined) throw new Error('o projeto não tem perfil')
  const rede = perfil.rede
  return 0.8 * (rede.latenciaMs + (baixados / rede.downloadBytesPorSegundo) * 1000 + (enviados / rede.uploadBytesPorSegundo) * 1000)
}

const BYTES_ENVIADOS = 120_000

/**
 * O quanto da descida tem de ser do perfil, e não da latência, para a medida da descida provar a vazão: com a rede livre o
 * pedido leva a latência (562,5 ms) e mais nada, e o piso de 80% só se distingue dela se os bytes somarem pelo menos
 * 0,2 × 562,5 ÷ 0,8 ≈ 140 ms. Os 200 ms vêm do perfil de cada projeto (`baixados ÷ descida`), e não de um tamanho de pedaço:
 * o corte dos chunks do build pode mudar sem derrubar o caso, desde que o maior pedaço continue passando de uns 36 kB (Fast 3G).
 */
const DESCIDA_MINIMA_DO_PERFIL_MS = 200

test.describe('a abertura da galeria não paga a latência do perfil', () => {
  test('nenhum pedaço da galeria espera a latência do perfil para chegar', async ({ page }) => {
    await abrirGaleria(page)
    const duracoes = await duracaoDosPedacosDeJs(page)
    // A galeria são dezenas de pedaços: se ela virasse um só, ou o filtro não achasse nenhum, o teste passaria vazio.
    expect(duracoes.length, 'pedaços de JS que a galeria baixou').toBeGreaterThanOrEqual(20)
    // Todos, o da entrada também: a página inteira abre dentro do auxiliar, e um só pedaço que pagasse a latência já passa do piso.
    expect(Math.max(...duracoes), 'o pedaço que mais demorou, em ms').toBeLessThan(PISO_DA_LATENCIA_DO_PERFIL_MS)
  })

  // Um caso só para as três medidas e para o erro de `carregar`, e não um por medida: o teto de casos de cada fatia do e2e
  // (`tools/ci/esteira.test.ts`) não deixa dobrar os casos de uma correção de tempo.
  test('depois de aberta, e também depois de um carregamento que falha, a rede do perfil está de volta: latência, descida e subida', async ({ page, perfil }) => {
    await abrirGaleria(page)
    const descida = await pedidoNovo(page)
    expect((descida.baixados / (perfil?.rede.downloadBytesPorSegundo ?? 1)) * 1000, 'o maior pedaço, em ms de descida do perfil').toBeGreaterThanOrEqual(DESCIDA_MINIMA_DO_PERFIL_MS)
    expect(descida.ms, 'a latência do perfil').toBeGreaterThanOrEqual(PISO_DA_LATENCIA_DO_PERFIL_MS)
    expect(descida.ms, 'a descida do perfil').toBeGreaterThanOrEqual(tempoMinimoDoPerfil(perfil, descida.baixados, 0))
    expect((await pedidoNovo(page, BYTES_ENVIADOS)).ms, 'a subida do perfil').toBeGreaterThanOrEqual(tempoMinimoDoPerfil(perfil, 0, BYTES_ENVIADOS))

    // O que carrega lança: o erro sobe, e a rede do perfil volta do mesmo jeito.
    await expect(carregarSemRedeLenta(page, () => Promise.reject(new Error('o carregamento falhou')))).rejects.toThrow('o carregamento falhou')
    expect((await pedidoNovo(page)).ms, 'depois do erro').toBeGreaterThanOrEqual(PISO_DA_LATENCIA_DO_PERFIL_MS)
  })

  test('dentro de carregarSemRedeLenta o pedido não paga a latência, a descida nem a subida; numa página que não veio do `test` do perfil, falha alto', async ({ page, browser }) => {
    await abrirGaleria(page)
    const dentro = await carregarSemRedeLenta(page, async () => [(await pedidoNovo(page)).ms, (await pedidoNovo(page, BYTES_ENVIADOS)).ms])
    for (const ms of dentro) expect(ms).toBeLessThan(PISO_DA_LATENCIA_DO_PERFIL_MS)

    // Sem o perfil não há rede para tirar nem para devolver: falhar alto, e não seguir sem limitação nenhuma.
    const semPerfil = await browser.newPage()
    try {
      await expect(carregarSemRedeLenta(semPerfil, () => Promise.resolve())).rejects.toThrow('não veio do `test` de profiles.ts')
    } finally {
      await semPerfil.close()
    }
  })
})
