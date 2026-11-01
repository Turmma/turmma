import type { Locator, Page } from '@playwright/test'
import { abrirSeletorDeEscola, entrarComoCoordenacaoNaMesmaAba, entrarPorEmail, esperarPainel, linhaDoSeletor, nomeNoSeletor, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { campoCodigo } from './support/mfa.ts'
import { codigoDoAutenticador, codigoDoPassoAnterior, convidarProfessorNoBanco, criarEquipeComSenha, criarUsuarioEmOutraEscola } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, horizontalOverflow, larguraExcedenteDoDialogo, seriousViolations } from './support/checks.ts'

/**
 * O sino "Esperando você" da coordenação (telas da coordenação, 1.0; RF4 e RF5), pela tela, nos projetos `chromebook` e
 * `celular`: o item que leva à tela que o resolve e some quando o estado muda, o vazio, o foco, nada animado e os 360 px, e
 * a pessoa seguinte na mesma aba. Nomes e e-mails inventados pelo teste.
 */

const sinoDe = (page: Page): Locator => page.getByRole('button', { name: /^Esperando você/ })
const listaDe = (page: Page): Locator => page.getByRole('dialog', { name: 'Esperando você' })
/** O diálogo de cima: o do convite, aberto sobre o painel do professor (`data-painel-lado`), que fica por baixo. */
const noDialogo = (page: Page): Locator => page.locator('dialog[open]:not([data-painel-lado])')
/** O painel do professor (X2, 6.0), pelo nome dele no título. */
const painelDe = (page: Page, nome: string): Locator => page.getByRole('dialog', { name: nome })

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

async function tocar(lugar: Locator, nome: string, hasTouch: boolean): Promise<void> {
  await activate(lugar.getByRole('button', { name: nome, exact: true }), hasTouch)
}

/**
 * Nada se mexe sozinho (D59): nenhum `@keyframes` em andamento no elemento nem no que há dentro dele, e o número e o desenho do
 * sino sem transição. A transição de apertar do botão (o degrau, que desce com o toque) é a de todo botão e não é do sino.
 */
async function semAnimacao(alvo: Locator): Promise<void> {
  const animado = await alvo.evaluate((elemento) =>
    [elemento, ...elemento.querySelectorAll('*')].filter((no) => {
      const estilo = getComputedStyle(no)
      const doSino = no.matches('[data-contador], [data-contador] *, svg')
      return estilo.animationName !== 'none' || (doSino && estilo.transitionDuration.split(',').some((duracao) => parseFloat(duracao) > 0))
    }).map((no) => no.outerHTML.slice(0, 80)),
  )
  expect(animado).toEqual([])
}

test.describe('do sino à tela', () => {
  test('convite vencido: o sino conta 1, a lista leva a Professores e, refeito o convite, o item some; foco devolvido; nada animado; 360 px', async ({ page, hasTouch }) => {
    test.slow()
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const coordenadora = await criarEquipeComSenha('coordenador')
    const professor = await convidarProfessorNoBanco(coordenadora.escolaId, 'vencido')
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await esperarPainel(page)

    // O sino está em toda tela da coordenação, e conta o convite vencido.
    const sino = sinoDe(page)
    await expect(sino).toHaveAccessibleName('Esperando você, 1', { timeout: SIGN_IN_TIMEOUT_MS })
    const caixa = await sino.boundingBox()
    expect(caixa?.height ?? 0, 'alvo do sino').toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    expect(caixa?.width ?? 0, 'alvo do sino').toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
    await semAnimacao(sino)

    // A lista abre sem nada animado, cabe nos 360 px e não tem violação grave; o item diz o que fazer e leva à tela.
    await activate(sino, hasTouch)
    await expect(listaDe(page)).toBeVisible()
    await expect(sino).toHaveAttribute('aria-expanded', 'true')
    const item = listaDe(page).getByRole('link', { name: new RegExp(`Refazer o convite de ${professor.nome}`) })
    await expect(item).toBeVisible()
    await expect(listaDe(page).getByRole('region', { name: 'Da escola' })).toBeVisible()
    await expect(listaDe(page).getByRole('region', { name: 'Urgente' })).toHaveCount(0)
    await semAnimacao(listaDe(page))
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])

    // O Esc fecha, e o foco volta ao sino: não cai no `body`.
    await page.keyboard.press('Escape')
    await expect(listaDe(page)).toHaveCount(0)
    await expect(sino).toBeFocused()

    // O item leva a Professores, com o professor no endereço (só o id), e a lista sai da frente da tela.
    await activate(sino, hasTouch)
    await activate(item, hasTouch)
    await expect(page).toHaveURL(new RegExp(`/coordenacao/professores\\?professor=${professor.usuarioId}$`))
    await expect(page.getByRole('heading', { level: 1, name: 'Escola' })).toBeAttached({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(listaDe(page)).toHaveCount(0)

    // O item abre o painel daquele professor (6.0), e é nele que está o "Refazer convite" do vencido.
    await expect(painelDe(page, professor.nome)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    // Refeito o convite, o professor deixa de estar vencido e o item sai da lista, sem recarregar a página.
    await tocar(painelDe(page, professor.nome), 'Refazer convite', hasTouch)
    await tocar(noDialogo(page), 'Refazer convite', hasTouch)
    await expect(noDialogo(page).getByRole('heading', { name: 'Copie o link do convite' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await tocar(noDialogo(page), 'Copiar link', hasTouch)
    await expect(noDialogo(page).getByRole('status').filter({ hasText: 'Link copiado.' })).toBeVisible()
    await tocar(noDialogo(page), 'Fechar', hasTouch)
    await expect(noDialogo(page)).toHaveCount(0)
    // O painel fica aberto por baixo, e a página atrás dele, o sino com ela, só volta quando ele fecha.
    await tocar(painelDe(page, professor.nome), 'Fechar', hasTouch)
    await expect(painelDe(page, professor.nome)).toHaveCount(0)
    await expect(sino).toHaveAccessibleName('Esperando você, nada', { timeout: SIGN_IN_TIMEOUT_MS })
    await activate(sino, hasTouch)
    await expect(listaDe(page).getByText('Tudo em dia')).toBeVisible()
    await expect(listaDe(page).getByRole('link', { name: /Refazer o convite/ })).toHaveCount(0)
  })

  test('escola sem nada esperando: o vazio é "Tudo em dia", com ícone ilustrado e sem mascote, e o link do que falta para a escola', async ({ page, hasTouch }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await esperarPainel(page)

    const sino = sinoDe(page)
    await expect(sino).toHaveAccessibleName('Esperando você, nada', { timeout: SIGN_IN_TIMEOUT_MS })
    // Sem item, o número nem aparece.
    await expect(sino.locator('[data-contador]')).toHaveCount(0)
    await activate(sino, hasTouch)
    const vazio = listaDe(page).locator('[data-vazio-do-sino]')
    await expect(vazio.getByText('Tudo em dia')).toBeVisible()
    await expect(vazio.locator('svg[data-icone]')).toHaveCount(1)
    await expect(listaDe(page).locator('img')).toHaveCount(0)
    await expect(vazio.getByRole('link', { name: 'Ver o que falta para a escola' })).toHaveAttribute('href', '/coordenacao/estrutura?painel=falta')
    expect(await larguraExcedenteDoDialogo(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('escola sem ano letivo: "Tudo em dia", e a fila nem chama turmas nem vínculos', async ({ page, hasTouch }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador', { semAnoLetivo: true })
    const pedidos: string[] = []
    page.on('request', (pedido) => pedidos.push(new URL(pedido.url()).pathname))
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await esperarPainel(page)

    const sino = sinoDe(page)
    await expect(sino).toHaveAccessibleName('Esperando você, nada', { timeout: SIGN_IN_TIMEOUT_MS })
    await activate(sino, hasTouch)
    await expect(listaDe(page).getByText('Tudo em dia')).toBeVisible()
    // As outras leituras da fila andaram (a espera do nome acessível prova que a fila terminou); turmas e vínculos não.
    expect(pedidos).toContain('/v1/anos-letivos')
    expect(pedidos).toContain('/v1/professores')
    expect(pedidos.filter((caminho) => caminho === '/v1/turmas' || caminho === '/v1/vinculos')).toEqual([])
  })
})

test.describe('recomeço: a pessoa seguinte na mesma aba', () => {
  test('a fila da escola anterior não aparece para a coordenação que entra depois, sem recarregar a página', async ({ page, hasTouch }) => {
    test.slow()
    const primeira = await criarEquipeComSenha('coordenador')
    const professor = await convidarProfessorNoBanco(primeira.escolaId, 'vencido')
    const segunda = await criarEquipeComSenha('coordenador')

    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, primeira, hasTouch)
    await esperarPainel(page)
    await expect(sinoDe(page)).toHaveAccessibleName('Esperando você, 1', { timeout: SIGN_IN_TIMEOUT_MS })

    // "Sair" a um toque, e a outra pessoa entra na mesma aba: o sino dela não traz o item da primeira, nem enquanto carrega.
    await activate(page.getByRole('button', { name: 'Sair' }).first(), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await entrarComoCoordenacaoNaMesmaAba(page, segunda, hasTouch)
    await esperarPainel(page)
    await expect(sinoDe(page)).toHaveAccessibleName('Esperando você, nada', { timeout: SIGN_IN_TIMEOUT_MS })
    await activate(sinoDe(page), hasTouch)
    await expect(listaDe(page).getByText('Tudo em dia')).toBeVisible()
    expect(await page.content()).not.toContain(professor.nome)
  })
})

test.describe('recomeço: a troca de escola pelo seletor', () => {
  test('o sino da escola B não traz o item da A, nem enquanto carrega, nem a página o nome do professor de A', async ({ page, hasTouch }) => {
    test.slow()
    // A mesma conta coordena as duas escolas; só a A tem um convite vencido.
    const emA = await criarEquipeComSenha('coordenador')
    const emB = await criarUsuarioEmOutraEscola(emA.contaId, 'coordenador')
    const professor = await convidarProfessorNoBanco(emA.escolaId, 'vencido')

    // Primeiro acesso: o segundo fator é da conta. Ativado com o código do passo anterior, para que o login (agora) e a troca
    // (um passo à frente) entrem sem esperar meio minuto de relógio.
    const respostaDoSegredo = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/conta/mfa/configurar')
    await page.goto('/entrar')
    await entrarPorEmail(page, emA, hasTouch)
    await activate(page.getByRole('button', { name: `${emA.escolaNome} · coordenação` }), hasTouch)
    await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    const { segredo } = (await (await respostaDoSegredo).json()) as { segredo: string }
    await campoCodigo(page).fill(await codigoDoPassoAnterior(segredo))
    await activate(page.getByRole('button', { name: /Ativar o segundo fator|Ativando/ }), hasTouch)
    await activate(page.getByRole('link', { name: 'Ir para a entrada' }), hasTouch)
    await entrarPorEmail(page, emA, hasTouch)
    await activate(page.getByRole('button', { name: `${emA.escolaNome} · coordenação` }), hasTouch)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await campoCodigo(page).fill(codigoDoAutenticador(segredo))
    await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await esperarPainel(page)
    await expect(sinoDe(page)).toHaveAccessibleName('Esperando você, 1', { timeout: SIGN_IN_TIMEOUT_MS })

    // Daqui em diante, o sino registra cada nome que teve, na ordem.
    await page.evaluate(() => {
      const nomes: string[] = []
      ;(window as unknown as { __nomesDoSino: string[] }).__nomesDoSino = nomes
      const ler = () => {
        const nome = document.querySelector('[data-ancora-do-sino] button')?.getAttribute('aria-label')
        if (nome !== null && nome !== undefined) nomes.push(nome)
      }
      new MutationObserver(ler).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label'] })
    })

    await abrirSeletorDeEscola(page, hasTouch)
    await activate(linhaDoSeletor(page, nomeNoSeletor(emB, 'coordenação')), hasTouch)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await campoCodigo(page).fill(codigoDoAutenticador(segredo, 30))
    await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await esperarPainel(page)
    await expect(page.locator('body')).toContainText(emB.escolaNome)

    await expect(sinoDe(page)).toHaveAccessibleName('Esperando você, nada', { timeout: SIGN_IN_TIMEOUT_MS })
    const nomes = await page.evaluate(() => (window as unknown as { __nomesDoSino: string[] }).__nomesDoSino)
    // Até o recomeço o sino ainda é o de A (o seletor e o segundo fator mexem na tela com ele ao fundo). Do primeiro "carregando"
    // em diante, o sino é o de B: nenhum nome dali pode trazer o item de A.
    const doRecomeco = nomes.indexOf('Esperando você, carregando')
    expect(doRecomeco).toBeGreaterThanOrEqual(0)
    expect(nomes.slice(doRecomeco)).not.toContain('Esperando você, 1')
    await activate(sinoDe(page), hasTouch)
    await expect(listaDe(page).getByText('Tudo em dia')).toBeVisible()
    expect(await page.content()).not.toContain(professor.nome)
  })
})
