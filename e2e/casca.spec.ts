import type { Locator, Page, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import { entrarComoCoordenacaoNaMesmaAba, entrarComoAluno, entrarComoProfessora, gaveta, PRAZO_DA_ENTRADA_MS, reservaDaBarraDeBaixo, secoes } from './support/casca.ts'
import { carregarSemRedeLenta, expect, test } from './support/profiles.ts'
import { instanteGravado, vigiarODado } from './support/screen-data-watch.ts'
import { colocarAlunoNaTurma, criarAlunoComMatricula, criarEquipeComSenha } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, codigoCru, focoVisivel, larguraExcedente, violacoesGraves } from './support/checks.ts'

const ROTA_ESTADO = '**/v1/sistema/estado'
const ROTA_AVISOS = '**/v1/sistema/avisos'
const PRAZO_DO_DADO_MS = 5_000
/** Da resposta entregue ao dado pintado, com a CPU ×4: ~15 ms na máquina; a espera do Playwright, no mesmo ponto, passa de 450. */
const PINTURA_DO_DADO_MS = 250

const envelope = (codigo: keyof typeof MENSAGENS_DE_ERRO) => ({
  erro: { codigo, mensagem: 'mensagem da API que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' },
})

function falharCom(status: number, codigo: keyof typeof MENSAGENS_DE_ERRO) {
  return (rota: Route) => rota.fulfill({ status, contentType: 'application/json', body: JSON.stringify(envelope(codigo)) })
}

function estadoFalso(sobreposicao: { versao?: string; ambiente?: string; banco?: 'disponivel' | 'indisponivel' } = {}) {
  return {
    versao: sobreposicao.versao ?? 'local',
    ambiente: sobreposicao.ambiente ?? 'local',
    componentes: [
      { nome: 'api', situacao: 'disponivel', verificadoEm: '2026-09-14T13:05:00.000Z' },
      { nome: 'banco', situacao: sobreposicao.banco ?? 'disponivel', verificadoEm: '2026-09-14T13:05:00.000Z' },
    ],
  }
}

/** Uma porta que segura a resposta até o teste abrir. */
function portao(): { aberta: Promise<void>; abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

const secaoComponentes = (page: Page) => page.getByRole('region', { name: 'Componentes' })
const secaoAvisos = (page: Page) => page.getByRole('region', { name: 'Avisos' })

/** O dado do estado na tela: a API e o banco com a situação por escrito. */
async function esperarEstadoComDado(page: Page, prazo = PRAZO_DO_DADO_MS): Promise<void> {
  const secao = secaoComponentes(page)
  await expect(secao.getByRole('listitem').filter({ hasText: 'API' })).toContainText('Disponível', { timeout: prazo })
  await expect(secao.getByRole('listitem').filter({ hasText: 'Banco de dados' })).toContainText('Disponível', { timeout: prazo })
}

/** O instante (`Date.now()`) em que o dado apareceu na tela, depois de `esperarEstadoComDado` confirmar que ele está lá. */
async function instanteDoDado(page: Page): Promise<number> {
  await esperarEstadoComDado(page)
  const instante = await instanteGravado(page)
  expect(instante, 'a página vigiada não gravou quando o dado apareceu: `vigiarODado` vem antes do `goto`').toBeDefined()
  return instante ?? 0
}

/** Toque no celular, clique no Chromebook: a mesma ação pela entrada que cada aparelho tem. */
async function acionar(page: Page, nome: string, hasTouch: boolean): Promise<void> {
  const botao = page.getByRole('button', { name: nome })
  if (hasTouch) await botao.tap()
  else await botao.click()
}

async function esperarAlvoDeToque(page: Page, nome: string): Promise<void> {
  const caixa = await page.getByRole('button', { name: nome }).boundingBox()
  expect(caixa, `${nome} sem caixa`).not.toBeNull()
  expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
}

// A casca do estado do sistema mora em `/sistema` desde a 18.0: com rotas e sessão, `/` passou a ser a área de
// quem entrou. Ela continua pública, porque é a tela que se abre justamente quando não se consegue entrar.
test.describe('casca da web', () => {
  test('com dado: versão e componentes vindos da API real, em até 5 s, sem rolagem horizontal e sem violação grave', async ({ page }) => {
    const respostaEstado = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/sistema/estado')
    await vigiarODado(page)
    const inicio = Date.now()
    await page.goto('/sistema')
    // O relógio é o instante em que o dado apareceu (`instanteDoDado`), e não `Date.now()` depois da asserção: o caso "o prazo do
    // dado conta quando o dado aparece…" trava a diferença, e ler `Date.now() - inicio` aqui de novo traz de volta o degrau da espera.
    const decorrido = (await instanteDoDado(page)) - inicio
    expect(decorrido, `dado na tela em ${decorrido} ms`).toBeLessThanOrEqual(PRAZO_DO_DADO_MS)

    const estado = await respostaEstado
    expect(estado.status()).toBe(200)
    const corpo = (await estado.json()) as { versao: string }
    await expect(secaoComponentes(page)).toContainText(`Versão ${corpo.versao}`)
    await expect(secaoComponentes(page)).toContainText('Ambiente Local')
    // Hora pelo Intl pt-BR: dd/mm/aaaa, hh:mm.
    await expect(secaoComponentes(page)).toContainText(/Verificado em \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/)

    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', 'width=device-width, initial-scale=1')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('o prazo do dado conta quando o dado aparece na tela, não quando o teste o percebe', async ({ page }) => {
    // O dado só sai 1,45 s depois de o pedido chegar, logo depois de um degrau da espera do Playwright (~1,36 s): quem mede quando o teste percebe lê ~1,87 s.
    let liberadoEm = 0
    await page.route(ROTA_ESTADO, async (rota) => {
      await new Promise((resolver) => setTimeout(resolver, 1_450))
      liberadoEm = Date.now()
      await rota.fulfill({ contentType: 'application/json', body: JSON.stringify(estadoFalso()) })
    })
    // Avisos que dizem "API" e "Disponível" chegam antes do estado: um vigia que olhasse a página inteira gravaria o instante deles.
    await page.route(ROTA_AVISOS, (rota) =>
      rota.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          itens: [
            { id: 'api-no-ar', texto: 'API Disponível', publicadoEm: '2026-09-13' },
            { id: 'banco-no-ar', texto: 'Banco de dados Disponível', publicadoEm: '2026-09-12' },
          ],
        }),
      }),
    )
    await vigiarODado(page)
    await page.goto('/sistema')
    const apareceuEm = await instanteDoDado(page)
    expect(liberadoEm, 'o pedido do estado não passou pela rota').toBeGreaterThan(0)
    const pintura = apareceuEm - liberadoEm
    expect(pintura, `o dado apareceu ${pintura} ms depois de liberado`).toBeGreaterThanOrEqual(0)
    expect(pintura, `o dado apareceu ${pintura} ms depois de liberado`).toBeLessThanOrEqual(PINTURA_DO_DADO_MS)
  })

  test('vazio: sem avisos na configuração, a seção convida a verificar de novo, e o botão busca de novo', async ({ page, hasTouch }) => {
    await page.goto('/sistema')
    const avisos = secaoAvisos(page)
    await expect(avisos).toContainText('Nenhum aviso por enquanto', { timeout: PRAZO_DO_DADO_MS })
    await expect(avisos).toContainText('Manutenção e atualização do sistema são avisadas aqui.')
    await esperarAlvoDeToque(page, 'Verificar de novo')

    // A nova busca fica segurada: o toque precisa dar sinal de que foi recebido.
    const segurada = portao()
    await page.route(ROTA_AVISOS, async (rota) => {
      await segurada.aberta
      await rota.continue()
    })
    const novaBusca = page.waitForRequest((pedido) => new URL(pedido.url()).pathname === '/v1/sistema/avisos')
    await acionar(page, 'Verificar de novo', hasTouch)
    await novaBusca
    await expect(avisos.getByRole('status')).toHaveText('Verificando…')
    segurada.abrir()
    await expect(avisos.getByRole('status')).toHaveText('')
    await expect(avisos).toContainText('Nenhum aviso por enquanto')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('com avisos: texto, data e quantidade pelo Intl pt-BR', async ({ page }) => {
    await page.route(ROTA_AVISOS, (rota) =>
      rota.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          itens: [
            { id: 'manutencao-sabado', texto: 'Manutenção programada no sábado, das 8h às 10h.', publicadoEm: '2026-09-13' },
            { id: 'nova-versao', texto: 'Uma versão nova entra no domingo à noite.', publicadoEm: '2026-09-01' },
          ],
        }),
      }),
    )
    await page.goto('/sistema')
    const avisos = secaoAvisos(page)
    await expect(avisos).toContainText('2 avisos', { timeout: PRAZO_DO_DADO_MS })
    await expect(avisos).toContainText('Manutenção programada no sábado, das 8h às 10h.')
    await expect(avisos).toContainText('Publicado em 13 de setembro de 2026')
    await expect(avisos).toContainText('Publicado em 1 de setembro de 2026')
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('carregando: com a resposta atrasada, a seção avisa que está carregando, e o dado substitui o aviso', async ({ page }) => {
    const segurada = portao()
    await page.route(ROTA_ESTADO, async (rota) => {
      await segurada.aberta
      await rota.continue()
    })
    // O caso afirma o que a tela diz enquanto o estado não chega, e não quanto a casca leva para baixar (isso o caso
    // "com dado: versão e componentes vindos da API real, em até 5 s" mede). A primeira carga vai sem a rede do perfil:
    // na esteira, uma vez, o documento chegou e os onze pedidos de script e estilo seguintes ficaram sem resposta por
    // trinta segundos, antes de a página buscar o estado.
    await carregarSemRedeLenta(page, () => page.goto('/sistema'))

    const carregando = secaoComponentes(page).getByRole('status')
    await expect(carregando).toHaveText('Carregando o estado do sistema…')
    expect(await violacoesGraves(page)).toEqual([])

    segurada.abrir()
    await esperarEstadoComDado(page)
    await expect(secaoComponentes(page).getByText('Carregando o estado do sistema…')).toHaveCount(0)
  })

  test('erro: a mensagem vem do catálogo pelo código, com "Tentar de novo", e nenhum status HTTP na tela', async ({ page }) => {
    await page.route(ROTA_ESTADO, falharCom(500, 'INDISPONIVEL_TENTE_DE_NOVO'))
    await page.route(ROTA_AVISOS, falharCom(429, 'LIMITE_EXCEDIDO'))
    await page.goto('/sistema')

    const erroEstado = secaoComponentes(page).getByRole('alert')
    const erroAvisos = secaoAvisos(page).getByRole('alert')
    // Mesmo status 500, a mensagem é a do código, e não a genérica.
    await expect(erroEstado).toContainText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DO_DADO_MS })
    await expect(erroAvisos).toContainText(MENSAGENS_DE_ERRO.LIMITE_EXCEDIDO, { timeout: PRAZO_DO_DADO_MS })
    await expect(secaoComponentes(page).getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
    await expect(secaoAvisos(page).getByRole('button', { name: 'Tentar de novo' })).toBeVisible()

    const tela = page.locator('body')
    for (const proibido of [codigoCru('500'), codigoCru('429'), 'INDISPONIVEL_TENTE_DE_NOVO', 'LIMITE_EXCEDIDO', 'mensagem da API']) {
      await expect(tela).not.toContainText(proibido)
    }
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('erro: sem rede até a API, a tela diz para tentar de novo em instantes', async ({ page }) => {
    await page.route(ROTA_ESTADO, (rota) => rota.abort('internetdisconnected'))
    await page.goto('/sistema')
    await expect(secaoComponentes(page).getByRole('alert')).toContainText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, {
      timeout: PRAZO_DO_DADO_MS,
    })
  })

  test('"Tentar de novo" com a rede de volta mostra o dado, sem recarregar a página', async ({ page, hasTouch }) => {
    let falhar = true
    const segurada = portao()
    await page.route(ROTA_ESTADO, async (rota) => {
      if (falhar) return falharCom(503, 'INDISPONIVEL_TENTE_DE_NOVO')(rota)
      await segurada.aberta
      return rota.continue()
    })
    await page.goto('/sistema')
    await expect(secaoComponentes(page).getByRole('alert')).toBeVisible({ timeout: PRAZO_DO_DADO_MS })
    await esperarAlvoDeToque(page, 'Tentar de novo')

    // Marca a página: se ela recarregar, a marca some.
    await page.evaluate(() => document.body.setAttribute('data-sem-recarga', 'sim'))
    falhar = false
    await acionar(page, 'Tentar de novo', hasTouch)
    // Sem dado ainda, a nova busca volta ao carregando: o toque foi recebido.
    await expect(secaoComponentes(page).getByRole('status')).toHaveText('Carregando o estado do sistema…')
    segurada.abrir()
    await esperarEstadoComDado(page)
    await expect(secaoComponentes(page).getByRole('alert')).toHaveCount(0)
    await expect(page.locator('body')).toHaveAttribute('data-sem-recarga', 'sim')
  })

  test('teclado: o percurso inteiro só com Tab, Enter e espaço, com foco visível em cada parada', async ({ page }) => {
    let falhar = true
    await page.route(ROTA_ESTADO, (rota) => (falhar ? falharCom(503, 'INDISPONIVEL_TENTE_DE_NOVO')(rota) : rota.continue()))
    await page.goto('/sistema')
    await expect(secaoComponentes(page).getByRole('alert')).toBeVisible({ timeout: PRAZO_DO_DADO_MS })
    await expect(secaoAvisos(page)).toContainText('Nenhum aviso por enquanto')

    // Primeira parada: o "Tentar de novo" do estado, que vem antes na ordem da tela.
    await page.keyboard.press('Tab')
    await expect(secaoComponentes(page).getByRole('button', { name: 'Tentar de novo' })).toBeFocused()
    expect(await focoVisivel(page)).toBe(true)

    falhar = false
    await page.keyboard.press('Enter')
    await esperarEstadoComDado(page)
    // O botão sumiu com o erro: o foco vai para o título da seção, e não se perde no body.
    await expect(page.getByRole('heading', { name: 'Componentes' })).toBeFocused()

    // Segunda parada: o convite do vazio. Espaço aciona o botão, como Enter.
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Verificar de novo' })).toBeFocused()
    expect(await focoVisivel(page)).toBe(true)
    const novaBusca = page.waitForRequest((pedido) => new URL(pedido.url()).pathname === '/v1/sistema/avisos')
    await page.keyboard.press('Space')
    await novaBusca
  })

  test('banco fora: a tela diz "Indisponível" no banco, por escrito, e não mostra o banco como disponível', async ({ page }) => {
    await page.route(ROTA_ESTADO, (rota) =>
      rota.fulfill({ contentType: 'application/json', body: JSON.stringify(estadoFalso({ banco: 'indisponivel', ambiente: 'producao' })) }),
    )
    await page.goto('/sistema')
    const banco = secaoComponentes(page).getByRole('listitem').filter({ hasText: 'Banco de dados' })
    await expect(banco).toContainText('Indisponível', { timeout: PRAZO_DO_DADO_MS })
    await expect(banco).not.toContainText(/Disponível/)
    await expect(secaoComponentes(page).getByRole('listitem').filter({ hasText: 'API' })).toContainText('Disponível')
    await expect(secaoComponentes(page)).toContainText('Ambiente Produção')
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('texto longo sem espaço (versão de 64 caracteres e aviso de 280) não cria rolagem horizontal', async ({ page }) => {
    const versao = 'a'.repeat(64)
    const texto = 'x'.repeat(280)
    await page.route(ROTA_ESTADO, (rota) => rota.fulfill({ contentType: 'application/json', body: JSON.stringify(estadoFalso({ versao, ambiente: 'staging' })) }))
    await page.route(ROTA_AVISOS, (rota) =>
      rota.fulfill({ contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'longo', texto, publicadoEm: '2026-09-13' }] }) }),
    )
    await page.goto('/sistema')
    await expect(secaoComponentes(page)).toContainText(versao, { timeout: PRAZO_DO_DADO_MS })
    await expect(secaoComponentes(page)).toContainText('Ambiente Homologação')
    await expect(secaoAvisos(page)).toContainText(texto)
    expect(await larguraExcedente(page)).toBe(0)
  })

  test('falha passageira depois do dado não apaga o dado: o erro aparece junto, com "Tentar de novo"', async ({ page, hasTouch }) => {
    await page.goto('/sistema')
    const avisos = secaoAvisos(page)
    await expect(avisos).toContainText('Nenhum aviso por enquanto', { timeout: PRAZO_DO_DADO_MS })

    let falhar = true
    let pedidos = 0
    const segurada = portao()
    await page.route(ROTA_AVISOS, async (rota) => {
      if (falhar) return falharCom(503, 'INDISPONIVEL_TENTE_DE_NOVO')(rota)
      pedidos++
      await segurada.aberta
      return rota.continue()
    })
    await acionar(page, 'Verificar de novo', hasTouch)
    await expect(avisos.getByRole('alert')).toContainText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DO_DADO_MS })
    await expect(avisos).toContainText('Nenhum aviso por enquanto')

    // Com a rede de volta mas lenta: o toque dá sinal, e toques repetidos não reiniciam a busca em andamento.
    falhar = false
    await acionar(page, 'Tentar de novo', hasTouch)
    await expect(avisos.getByText('Tentando de novo…')).toBeVisible()
    await acionar(page, 'Tentar de novo', hasTouch)
    await acionar(page, 'Tentar de novo', hasTouch)
    segurada.abrir()
    await expect(avisos.getByRole('alert')).toHaveCount(0)
    await expect(avisos).toContainText('Nenhum aviso por enquanto')
    expect(pedidos).toBe(1)
  })

  test('E5: o CSS servido tem os hex da pele, não usa o que o Chrome 109 não entende, e pinta o aviso de atenção', async ({ page }) => {
    await page.goto('/sistema')
    const folhas = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href))
    expect(folhas.length).toBeGreaterThan(0)
    const css = (await Promise.all(folhas.map(async (folha) => (await page.request.get(folha)).text()))).join('\n')
    // Os hex que as telas do F1 pintam: o laranja do botão, o texto, a borda de campo e as duas famílias de aviso.
    for (const hex of ['#e8732e', '#0d0d0d', '#8f8f8f', '#fdf0e8', '#8a3e0c', '#fdecec', '#b42318']) expect(css, `${hex} fora do CSS servido`).toContain(hex)
    // Os que as peças da D80 pintam: o grafite do oficial, a família vermelha, o foco, o selecionado e a borda. O
    // build encurta o hex de dígitos repetidos (`#333333` chega como `#333`), e por isso o grafite é procurado assim.
    expect(css, '#333333 fora do CSS servido').toMatch(/#333(?![0-9a-f])/)
    for (const hex of ['#f2545b', '#b84045', '#146eaa', '#dff1fd', '#99d2f8', '#e5e5e5']) expect(css, `${hex} fora do CSS servido`).toContain(hex)
    // Os do escuro (D80): o chão, o texto e a borda de campo, que só existem no bloco `[data-tema=escuro]`.
    for (const hex of ['#131f24', '#f1f7fb', '#6b7f88']) expect(css, `${hex} fora do CSS servido`).toContain(hex)
    // O Chrome 109 do laboratório descarta a declaração inteira com qualquer um dos dois: `oklch()` é a paleta de
    // fábrica do Tailwind 4, e `color-mix()` é o que o modificador de opacidade (`bg-tinta/40`) vira (9.9).
    expect(css).not.toContain('oklch(')
    expect(css).not.toContain('color-mix(')
    // `:has()` não existe antes do Chrome 105, e `scrollbar-width`, antes do 121: nada na pele depende deles.
    expect(css).not.toContain(':has(')
    expect(css).not.toContain('scrollbar-width')
    // Nada se mexe sozinho (D59): nenhuma animação em laço chega ao navegador.
    expect(css).not.toContain('infinite')
    // A paleta anterior saiu inteira do `@theme`, e nenhuma fonte é baixada: o logotipo vem em curvas (9.6).
    expect(css).not.toMatch(/--color-(?:slate|blue|amber|red|emerald)-/)
    expect(css).not.toContain('@font-face')
    // A paleta zerada do `@theme` faz classe com cor fora da lista não gerar regra nenhuma, caladamente: a caixa
    // de aviso fica sem fundo e sem borda, e o axe não vê, porque o texto herda o contraste da página. O teste de
    // unidade `apps/web/src/estilos.test.ts` cobre o fonte; esta linha cobre o que o navegador recebe.
    for (const classe of ['.bg-pendente-cx', '.border-pendente', '.text-pendente', '.bg-erro-cx', '.border-erro', '.text-erro']) expect(css, `${classe} sem regra no CSS servido`).toContain(classe)
  })

  test('o aviso de atenção aparece com fundo e borda, na cor da D72 e com contraste AA', async ({ page }) => {
    // O segundo fator aberto sem desafio: "entre de novo", o aviso que sumiu calado no F0 quando a cor não tinha regra.
    await page.goto('/mfa')
    const aviso = page.getByRole('alert').filter({ hasText: 'entre de novo' })
    await expect(aviso).toBeVisible()
    const pintura = await aviso.evaluate((elemento) => {
      const estilo = getComputedStyle(elemento)
      return { fundo: estilo.backgroundColor, borda: estilo.borderTopColor, larguraDaBorda: estilo.borderTopWidth, estiloDaBorda: estilo.borderTopStyle, texto: estilo.color }
    })
    // `pendente-cx` de fundo, `pendente` na borda e no texto (6,8:1 na 9.1): sem a regra, o fundo seria transparente.
    expect(pintura).toEqual({ fundo: 'rgb(253, 240, 232)', borda: 'rgb(138, 62, 12)', larguraDaBorda: '1px', estiloDaBorda: 'solid', texto: 'rgb(138, 62, 12)' })
    expect(await violacoesGraves(page)).toEqual([])
  })
})

/**
 * W12 da casca da escola (A1, tarefa 11.0; `docs/interface.md` 11.1): a lateral aberta a partir de 1024 px, o trilho de
 * 768 a 1023 px e a gaveta abaixo de 768 px, sem rolagem horizontal a 360 px, com alvos de 44 px e percorrida pelo
 * teclado.
 */
test.describe('casca da escola', () => {
  test('W12: abaixo de 768 px, a barra do topo com o "Sair" a um toque, e a gaveta modal que prende e devolve o foco', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await entrarComoProfessora(page, hasTouch)

    // Sem lateral: a barra do topo tem o menu, a pinta, a escola e o "Sair", e nada passa da largura. Os três itens do
    // professor estão na barra de baixo, à vista com a gaveta fechada, e `Seções` existe uma vez só (A14, 13.0).
    const menu = page.getByRole('button', { name: 'Abrir o menu' })
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('navigation', { name: 'Seções' })).toHaveCount(1)
    await expect(secoes(page).getByRole('link')).toHaveText(['Início', 'Turmas', 'Ferramentas', 'Criados'])
    await expect(page.locator('html')).toHaveAttribute('data-barra-de-baixo', '')
    await esperarAlvoDeToqueEm(secoes(page).getByRole('link', { name: 'Turmas' }))
    for (const alvo of [menu, page.getByRole('button', { name: 'Sair' }), page.getByRole('link', { name: 'Turmma, página inicial' })]) await esperarAlvoDeToqueEm(alvo)
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // A gaveta abre por cima, com o foco dentro, e o Tab não chega à tela atrás dela: depois do último item ele vai para
    // o navegador (o `body`, visto de dentro da página) e volta ao primeiro, como em todo `dialog` modal.
    await menu.focus()
    await page.keyboard.press('Enter')
    await expect(gaveta(page)).toBeVisible()
    await expect(menu).toHaveAttribute('aria-expanded', 'true')
    expect(await gaveta(page).evaluate((dialogo) => dialogo.contains(document.activeElement))).toBe(true)
    const ondeFoi: string[] = []
    for (let tecla = 0; tecla < 12; tecla++) {
      await page.keyboard.press('Tab')
      ondeFoi.push(
        await gaveta(page).evaluate((dialogo) => (dialogo.contains(document.activeElement) ? 'gaveta' : document.activeElement === document.body ? 'navegador' : 'atrás')),
      )
    }
    expect(ondeFoi).not.toContain('atrás')
    expect(ondeFoi).toContain('gaveta')
    // A15: `Seções` saiu da gaveta e foi para a barra de baixo, que fica fora dela (irmã, e inerte com ela aberta). O
    // controle positivo é a gaveta ter as outras navegações dela, logo adiante.
    await expect(gaveta(page).getByRole('navigation', { name: 'Seções' })).toHaveCount(0)
    await expect(gaveta(page).getByRole('navigation', { name: 'Sua conta', exact: true })).toHaveCount(1)
    // F3 (18.0): o "Meus dados" do professor, no menu da pessoa, é alvo de 44 px na gaveta, como o "Sair" que vem depois dele.
    await esperarAlvoDeToqueEm(gaveta(page).getByRole('navigation', { name: 'Sua conta', exact: true }).getByRole('link', { name: 'Meus dados' }))
    await esperarAlvoDeToqueEm(gaveta(page).getByRole('navigation', { name: 'Sua conta', exact: true }).getByRole('link', { name: 'Rever a introdução' }))
    await esperarAlvoDeToqueEm(gaveta(page).getByRole('button', { name: 'Sair' }))
    await esperarAlvoDeToqueEm(gaveta(page).getByRole('button', { name: 'Fechar o menu' }))
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // Esc fecha, e o foco volta ao botão que abriu.
    await page.keyboard.press('Escape')
    await expect(gaveta(page)).toBeHidden()
    await expect(menu).toBeFocused()
    await expect(menu).toHaveAttribute('aria-expanded', 'false')

    // O toque fora da lateral também fecha (A16): a gaveta tem 260 px, e o 350 px está depois da borda dela.
    if (hasTouch) await menu.tap()
    else await menu.click()
    await expect(gaveta(page)).toBeVisible()
    const largura = (await gaveta(page).boundingBox())?.width ?? 0
    expect(largura).toBeLessThan(350)
    await page.mouse.click(350, 400)
    await expect(gaveta(page)).toBeHidden()

    // A barra de baixo fica inerte com a gaveta aberta: o toque em cima dela só fecha a gaveta, não navega. O item é o último
    // da barra ("Criados", o quarto lugar, telas do professor 5.0), que cai depois da borda da gaveta; um do meio cairia dentro dela.
    const ultimo = await secoes(page).getByRole('link', { name: 'Criados' }).boundingBox()
    if (ultimo === null) throw new Error('o item Criados da barra de baixo sem caixa')
    const antes = page.url()
    if (hasTouch) await menu.tap()
    else await menu.click()
    await expect(gaveta(page)).toBeVisible()
    await page.mouse.click(ultimo.x + ultimo.width / 2, ultimo.y + ultimo.height / 2)
    await expect(gaveta(page)).toBeHidden()
    expect(page.url()).toBe(antes)
  })

  test('W12: no computador, a lateral aberta percorrida só com Tab, com o "Sair" a um clique e do tamanho dos itens', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    const professora = await entrarComoProfessora(page, hasTouch)

    await expect(page.getByRole('button', { name: 'Abrir o menu' })).toHaveCount(0)
    const paradas = [
      page.getByRole('link', { name: 'Turmma, página inicial' }),
      page.getByRole('button', { name: 'Recolher a lateral' }),
      // Os quatro itens do professor, na ordem da D80: Início, Turmas, Ferramentas e Criados. "Seu time" saiu da lateral (telas do professor,
      // 2.0): o Assistente e o Tutor abrem pelo pé do sino.
      page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Início' }),
      page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Turmas' }),
      page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Ferramentas' }),
      page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Criados' }),
      // F3 (18.0): o menu da pessoa tem "Meus dados" antes do "Sair", no pé da lateral.
      page.getByRole('navigation', { name: 'Sua conta', exact: true }).getByRole('link', { name: 'Meus dados' }),
      // X4 (10.0): "Rever a introdução" vem logo depois, também antes do "Sair".
      page.getByRole('navigation', { name: 'Sua conta', exact: true }).getByRole('link', { name: 'Rever a introdução' }),
      // X1 (2.0): a Aparência é uma parada só, a opção marcada, entre os links da conta e o "Sair", que continua o último.
      page.getByRole('radiogroup', { name: 'Aparência' }).getByRole('radio', { checked: true }),
      page.getByRole('button', { name: 'Sair' }),
    ]
    await page.locator('body').focus()
    for (const parada of paradas) {
      await page.keyboard.press('Tab')
      await expect(parada).toBeFocused()
      expect(await focoVisivel(page)).toBe(true)
    }
    // O "Sair" tem a altura e a largura da linha dos itens (P18, D59), e está à vista, sem menu para abrir.
    const [item, sair] = await Promise.all([page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Turmas' }).boundingBox(), page.getByRole('button', { name: 'Sair' }).boundingBox()])
    expect(sair?.height).toBe(item?.height)
    expect(sair?.width).toBe(item?.width)
    expect(item?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    await expect(page.getByText(professora.nome, { exact: true })).toBeVisible()
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])

    // O anel de foco inteiro no alto que rola, numa janela baixa (regra 50, item 11): o `overflow` corta o que passa do
    // contêiner, e a folga dele precisa ser maior que o contorno mais o afastamento do anel.
    await page.setViewportSize({ width: 1366, height: ALTURA_BAIXA_PX })
    // O foco ainda está no "Sair", a última parada da volta de cima, e o navegador continua dali: o percurso recomeça na
    // marca por `focus()` (a última entrada foi o teclado, e o anel aparece), e as outras quatro são Tab. São as cinco do alto
    // que rola: a marca, o recolher e os três itens; "Meus dados", "Rever a introdução", a Aparência e o "Sair" ficam no pé, fora dele.
    for (const [indice, parada] of paradas.slice(0, 5).entries()) {
      if (indice === 0) await parada.focus()
      else await page.keyboard.press('Tab')
      await expect(parada).toBeFocused()
      const corte = await anelCortadoPeloQueRola(page)
      expect(corte, 'a parada mora no alto que rola').toBeDefined()
      expect(corte?.esquerda, 'anel cortado à esquerda').toBeLessThanOrEqual(0)
      expect(corte?.direita, 'anel cortado à direita').toBeLessThanOrEqual(0)
      // O alto só na primeira parada: as seguintes podem ter rolado o contêiner até elas, e aí a borda de cima é a da rolagem.
      if (indice === 0) expect(corte?.alto, 'anel cortado no alto').toBeLessThanOrEqual(0)
    }
  })

  test('W12: recolher a lateral dá o trilho, que dá a dica pelo teclado e tem alvos do tamanho do toque', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await entrarComoProfessora(page, hasTouch)

    const recolher = page.getByRole('button', { name: 'Recolher a lateral' })
    if (hasTouch) await recolher.tap()
    else await recolher.click()
    const abrir = page.getByRole('button', { name: 'Abrir a lateral' })
    // O botão que tinha o foco saiu com a lateral: o foco vai para o que faz o contrário, e não se perde.
    await expect(abrir).toBeFocused()
    await expect(abrir).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByText('Turmma', { exact: true })).toHaveCount(0)

    // No trilho, o item é só o ícone, com o nome para o leitor de tela e a dica que aparece ao chegar pelo teclado.
    const turmas = page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Turmas' })
    // "Turmas" é o segundo item do professor desde a ordem da D80 (telas do professor, 2.0): antes dele vem "Início".
    for (const anterior of ['Início']) {
      await page.keyboard.press('Tab')
      await expect(page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: anterior })).toBeFocused()
    }
    await page.keyboard.press('Tab')
    await expect(turmas).toBeFocused()
    await expect(turmas.getByText('Turmas', { exact: true }).last()).toBeVisible()
    await esperarAlvoDeToqueEm(turmas)
    await esperarAlvoDeToqueEm(page.getByRole('button', { name: 'Sair' }))
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
  })

  test('W12: a lateral recolhida fica guardada neste navegador, e abrir desfaz', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await entrarComoProfessora(page, hasTouch)

    const recolher = page.getByRole('button', { name: 'Recolher a lateral' })
    if (hasTouch) await recolher.tap()
    else await recolher.click()
    await expect(page.getByRole('button', { name: 'Abrir a lateral' })).toBeFocused()

    // A escolha fica guardada neste navegador.
    await carregarSemRedeLenta(page, () => page.reload())
    await expect(page.getByRole('button', { name: 'Abrir a lateral' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('button', { name: 'Recolher a lateral' })).toHaveCount(0)

    if (hasTouch) await page.getByRole('button', { name: 'Abrir a lateral' }).tap()
    else await page.getByRole('button', { name: 'Abrir a lateral' }).click()
    await expect(page.getByRole('button', { name: 'Recolher a lateral' })).toBeFocused()
    await carregarSemRedeLenta(page, () => page.reload())
    await expect(page.getByRole('button', { name: 'Recolher a lateral' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  })

  test('W12: de 768 a 1023 px, o trilho, e a lateral abre por cima do conteúdo, sem mudar a escolha do computador', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 900, height: 768 })
    await entrarComoProfessora(page, hasTouch)

    const abrir = page.getByRole('button', { name: 'Abrir a lateral' })
    await expect(abrir).toBeVisible()
    await expect(page.getByRole('button', { name: 'Recolher a lateral' })).toHaveCount(0)
    if (hasTouch) await abrir.tap()
    else await abrir.click()
    await expect(gaveta(page)).toBeVisible()
    await expect(abrir).toHaveAttribute('aria-expanded', 'true')
    // A20: de 768 a 1023 px a gaveta do trilho leva os itens, e não há barra de baixo (ela é do celular).
    await expect(gaveta(page).getByRole('navigation', { name: 'Seções' }).getByRole('link')).toHaveText(['Início', 'Turmas', 'Ferramentas', 'Criados'])
    await expect(page.locator('html')).not.toHaveAttribute('data-barra-de-baixo', '')
    // E a página não reserva o lugar de uma barra que não existe: a variável vale zero, e o `<main>` guarda só os 32 px.
    expect(await reservaDaBarraDeBaixo(page)).toEqual({ variavel: '0px', paddingDoMain: '32px' })
    expect(await larguraExcedente(page)).toBe(0)
    expect(await violacoesGraves(page)).toEqual([])
    await page.keyboard.press('Escape')
    await expect(gaveta(page)).toBeHidden()
    await expect(abrir).toBeFocused()

    // Entre o trilho e o celular (o celular deitado que é girado) a gaveta continua montada: aberta, ela segue aberta, e
    // o botão de cada largura diz isso.
    if (hasTouch) await abrir.tap()
    else await abrir.click()
    await expect(gaveta(page)).toBeVisible()
    await page.setViewportSize({ width: 360, height: 800 })
    await expect(gaveta(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abrir o menu' })).toHaveAttribute('aria-expanded', 'true')
    // A20: a 360 px os itens são da barra de baixo, e a gaveta que seguiu aberta já não leva `Seções`.
    await expect(gaveta(page).getByRole('navigation', { name: 'Seções' })).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute('data-barra-de-baixo', '')
    await page.setViewportSize({ width: 900, height: 768 })
    await expect(gaveta(page)).toBeVisible()
    await expect(abrir).toHaveAttribute('aria-expanded', 'true')
    // De volta aos 900 px, a gaveta tem os itens de novo (o controle positivo da asserção de cima), e a barra some.
    await expect(gaveta(page).getByRole('navigation', { name: 'Seções' })).toHaveCount(1)
    await expect(page.locator('html')).not.toHaveAttribute('data-barra-de-baixo', '')
    await page.keyboard.press('Escape')
    await expect(gaveta(page)).toBeHidden()

    // Abrir por cima aqui não recolhe nem abre a lateral do computador.
    if (hasTouch) await abrir.tap()
    else await abrir.click()
    await expect(gaveta(page)).toBeVisible()
    await page.setViewportSize({ width: 1366, height: 768 })
    await expect(page.getByRole('button', { name: 'Recolher a lateral' })).toBeVisible()

    // A gaveta aberta que saiu com a troca de largura não volta aberta, nem o botão diz que ela está.
    await page.setViewportSize({ width: 900, height: 768 })
    await expect(abrir).toHaveAttribute('aria-expanded', 'false')
    await expect(gaveta(page)).toBeHidden()
  })

  test('W12: as medidas da D80 no computador: a lateral de 256 px e o trilho de 88, a borda de 2 px, os lugares de 52 px e a moldura de 1200', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await entrarComoProfessora(page, hasTouch)

    const secoes = page.getByRole('navigation', { name: 'Seções' })
    // A lateral aberta: 256 px de largura e a borda direita de 2 px em `borda` (#E5E5E5). Ela é o ancestral fixo de "Seções".
    const lateral = await secoes.evaluate((nav) => {
      const caixa = nav.closest('div.sticky')
      if (caixa === null) return undefined
      const estilo = getComputedStyle(caixa)
      return { largura: caixa.getBoundingClientRect().width, borda: estilo.borderRightWidth, cor: estilo.borderRightColor, fundo: estilo.backgroundColor }
    })
    expect(lateral).toEqual({ largura: 256, borda: '2px', cor: 'rgb(229, 229, 229)', fundo: 'rgb(255, 255, 255)' })
    // Cada lugar tem 52 px de altura (o ícone numa caixa de 36, e o rótulo em caixa-alta), e a moldura começa onde a lateral termina.
    for (const rotulo of ['Início', 'Turmas', 'Ferramentas', 'Criados']) expect((await secoes.getByRole('link', { name: rotulo }).boundingBox())?.height, rotulo).toBe(52)
    expect((await page.getByRole('main').boundingBox())?.x).toBe(256)
    // O ícone do lugar é decoração: o ilustrado a 32 px em Início, Turmas, Ferramentas e Criados, e o nome do link é só o rótulo.
    for (const rotulo of ['Início', 'Turmas', 'Ferramentas', 'Criados']) {
      const icone = secoes.getByRole('link', { name: rotulo, exact: true }).locator('svg[data-icone]')
      await expect(icone).toHaveCount(1)
      await expect(icone).toHaveAttribute('aria-hidden', 'true')
      expect((await icone.boundingBox())?.width).toBe(32)
    }

    // O trilho: 88 px, a mesma borda, e os lugares viram quadrados de 52 px.
    await page.getByRole('button', { name: 'Recolher a lateral' }).click()
    await expect(page.getByRole('button', { name: 'Abrir a lateral' })).toBeFocused()
    const trilho = await secoes.evaluate((nav) => {
      const caixa = nav.closest('div.sticky')
      if (caixa === null) return undefined
      return { largura: caixa.getBoundingClientRect().width, borda: getComputedStyle(caixa).borderRightWidth }
    })
    expect(trilho).toEqual({ largura: 88, borda: '2px' })
    expect(await secoes.getByRole('link', { name: 'Turmas' }).boundingBox()).toMatchObject({ width: 52, height: 52 })
    // O trilho não anima a largura (D59): a duração da transição é zero, e o `all` que o navegador devolve sem regra não conta.
    expect(await secoes.evaluate((nav) => getComputedStyle(nav.closest('div.sticky') ?? nav).transitionDuration)).toBe('0s')
  })

  test('W12: a moldura de 1200 px, com a margem de 32 px, e de 16 px abaixo de 768 px (A84)', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 1920, height: 900 })
    await entrarComoProfessora(page, hasTouch)

    const principal = page.getByRole('main')
    // Numa janela larga o `main` para em 1200 px, com a margem de 32 px dos dois lados, centrado ao lado da lateral.
    const larga = await principal.evaluate((main) => ({ largura: main.getBoundingClientRect().width, esquerda: getComputedStyle(main).paddingLeft, direita: getComputedStyle(main).paddingRight }))
    expect(larga).toEqual({ largura: 1200, esquerda: '32px', direita: '32px' })
    // Abaixo de 768 px a margem é de 16 px, e nada passa da janela.
    await page.setViewportSize({ width: 360, height: 800 })
    await expect.poll(() => principal.evaluate((main) => getComputedStyle(main).paddingLeft)).toBe('16px')
    expect(await larguraExcedente(page)).toBe(0)
  })
})

/**
 * A casca nos três papéis (RF15, RF16, RF17; D59): os nomes acessíveis que o e2e usa não mudam, o "Sair" está à vista
 * sem abrir nada e é do tamanho do vizinho, aberta a lateral e recolhida, a 1366 px e a 900 px.
 */
type PapelDaCasca = 'professor' | 'aluno' | 'coordenacao'

/** A altura de um Chromebook com a barra do navegador e a de downloads abertas: o "Sair" tem de caber nela (D59). */
const ALTURA_BAIXA_PX = 600

const PAPEIS_DA_CASCA: readonly { readonly papel: PapelDaCasca; readonly navegacoes: readonly string[]; readonly ausentes: readonly string[]; readonly primeiro: string }[] = [
  { papel: 'professor', navegacoes: ['Seções', 'Sua conta'], ausentes: ['Seu time', 'Rodapé'], primeiro: 'Início' },
  // X4 (2.0): o aluno tem Início, Tarefas e Eu, e o rodapé dele é vazio (`SIDEBAR_FOOTER.aluno`), então a casca não desenha "Rodapé".
  { papel: 'aluno', navegacoes: ['Seções'], ausentes: ['Seu time', 'Rodapé', 'Sua conta'], primeiro: 'Início' },
  // X4 (11.0): a coordenação tem o link "Rever a introdução" no menu da pessoa, e por isso a casca desenha "Sua conta".
  { papel: 'coordenacao', navegacoes: ['Seções', 'Sua conta'], ausentes: ['Seu time', 'Rodapé'], primeiro: 'Painel' },
]

async function entrarNaCasca(page: Page, papel: PapelDaCasca, hasTouch: boolean): Promise<void> {
  if (papel === 'professor') {
    await entrarComoProfessora(page, hasTouch)
    return
  }
  if (papel === 'aluno') {
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)
    return
  }
  const coordenadora = await criarEquipeComSenha('coordenador')
  await page.goto('/entrar')
  await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
}

/** Quantos px do anel de foco do elemento focado o contêiner que rola corta (o `overflow` recorta o que passa dele). */
function anelCortadoPeloQueRola(page: Page): Promise<{ esquerda: number; direita: number; alto: number } | undefined> {
  return page.evaluate(() => {
    const elemento = document.activeElement
    const rola = elemento?.closest('.overflow-y-auto')
    if (!elemento || !rola) return undefined
    const estilo = getComputedStyle(elemento)
    const anel = Number.parseFloat(estilo.outlineWidth) + Number.parseFloat(estilo.outlineOffset)
    const caixa = elemento.getBoundingClientRect()
    const limite = rola.getBoundingClientRect()
    return { esquerda: limite.left - (caixa.left - anel), direita: caixa.right + anel - limite.right, alto: limite.top - (caixa.top - anel) }
  })
}

/** O "Sair" à vista, sem abrir nada, com a altura e a largura do primeiro lugar da navegação dentro de `raiz` (A18; RF15). */
async function conferirOSair(raiz: Locator, page: Page, primeiro: string, quadrado: boolean): Promise<void> {
  const sair = raiz.getByRole('button', { name: 'Sair' })
  await expect(sair).toBeVisible()
  // Inteiro dentro da janela: `toBeInViewport()` sozinho aprova o botão cortado pela metade (a coordenação a 1366 × 768).
  await expect(sair).toBeInViewport({ ratio: 1 })
  // O primeiro lugar da navegação é o que a tabela `PAPEIS_DA_CASCA` diz. Sem esta linha, navegação reordenada só aparece
  // como o estouro de 120 s do `boundingBox()` logo abaixo, sem dizer o motivo (foi o que escondeu a quebra da 3.0).
  await expect(raiz.getByRole('navigation', { name: 'Seções' }).getByRole('link').first(), 'o primeiro lugar de "Seções" não é o da tabela PAPEIS_DA_CASCA').toHaveAccessibleName(primeiro)
  const [vizinho, caixa] = await Promise.all([raiz.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: primeiro, exact: true }).boundingBox(), sair.boundingBox()])
  expect(caixa?.height, 'altura do "Sair"').toBe(vizinho?.height)
  expect(caixa?.width, 'largura do "Sair"').toBe(vizinho?.width)
  expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  if (quadrado) expect(caixa?.width).toBe(caixa?.height)
  expect(await larguraExcedente(page)).toBe(0)
}

test.describe('casca da escola: os três papéis (RF15 a RF17)', () => {
  for (const { papel, navegacoes, ausentes, primeiro } of PAPEIS_DA_CASCA) {
    test(`W12: ${papel}: os nomes acessíveis não mudam, e o "Sair" está à vista e do tamanho do vizinho, aberta e recolhida, a 1366 e a 900 px`, async ({ page, hasTouch }) => {
      test.setTimeout(120_000)
      await page.setViewportSize({ width: 1366, height: 768 })
      await entrarNaCasca(page, papel, hasTouch)

      // Os nomes da Tech Spec 9 (X1): as navegações de cada papel, e só elas, o link da marca e o botão que recolhe.
      for (const nome of navegacoes) await expect(page.getByRole('navigation', { name: nome, exact: true }), nome).toBeVisible()
      for (const nome of ausentes) await expect(page.getByRole('navigation', { name: nome, exact: true }), nome).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Turmma, página inicial' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Abrir o menu' })).toHaveCount(0)
      // A lateral aberta: o "Sair" do tamanho do primeiro lugar.
      await conferirOSair(page.locator('body'), page, primeiro, false)
      expect(await violacoesGraves(page)).toEqual([])
      // Numa janela baixa (o Chromebook com a barra do navegador cheia) só o alto da lateral rola: o pé, com o "Sair",
      // continua inteiro à vista. Sem isso o botão sai da janela e a pessoa não tem como rolar até ele (D59).
      await page.setViewportSize({ width: 1366, height: ALTURA_BAIXA_PX })
      await conferirOSair(page.locator('body'), page, primeiro, false)
      await page.setViewportSize({ width: 1366, height: 768 })

      // Recolhida (1366 px): o trilho, com o "Sair" quadrado como os lugares, e o nome para o leitor de tela.
      await page.getByRole('button', { name: 'Recolher a lateral' }).click()
      await expect(page.getByRole('button', { name: 'Abrir a lateral' })).toBeVisible()
      for (const nome of navegacoes) await expect(page.getByRole('navigation', { name: nome, exact: true }), `${nome} (trilho)`).toBeVisible()
      await conferirOSair(page.locator('body'), page, primeiro, true)
      expect(await violacoesGraves(page)).toEqual([])
      // O trilho dá o nome e a dica nos três papéis (A19, A92): o foco sai do "Abrir a lateral" para o primeiro lugar, e a
      // dica, que existe só para quem não vê o rótulo, aparece com ele.
      await expect(page.getByRole('button', { name: 'Abrir a lateral' })).toBeFocused()
      await page.keyboard.press('Tab')
      const primeiroNoTrilho = page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: primeiro, exact: true })
      await expect(primeiroNoTrilho).toBeFocused()
      await expect(primeiroNoTrilho.getByText(primeiro, { exact: true }).last()).toBeVisible()
      await page.setViewportSize({ width: 1366, height: ALTURA_BAIXA_PX })
      await conferirOSair(page.locator('body'), page, primeiro, true)
      await page.setViewportSize({ width: 1366, height: 768 })

      // 900 px é o trilho, com a escolha de recolher guardada (e a de abrir por cima, que não a muda), na altura de um
      // Chromebook e na baixa.
      for (const altura of [768, ALTURA_BAIXA_PX]) {
        await page.setViewportSize({ width: 900, height: altura })
        await expect(page.getByRole('button', { name: 'Abrir a lateral' })).toBeVisible()
        await conferirOSair(page.locator('body'), page, primeiro, true)
        // Aberta por cima, a lateral é a mesma: o "Sair" dentro dela tem o tamanho do primeiro lugar dela.
        await page.getByRole('button', { name: 'Abrir a lateral' }).click()
        await expect(gaveta(page)).toBeVisible()
        for (const nome of navegacoes) await expect(gaveta(page).getByRole('navigation', { name: nome, exact: true }), `${nome} (por cima)`).toBeVisible()
        await conferirOSair(gaveta(page), page, primeiro, false)
        await expect(gaveta(page).getByRole('button', { name: 'Fechar o menu' })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(gaveta(page)).toBeHidden()
      }
    })
  }
})

async function esperarAlvoDeToqueEm(alvo: Locator): Promise<void> {
  const caixa = await alvo.boundingBox()
  expect(caixa, 'alvo sem caixa').not.toBeNull()
  expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
  expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
}
