import type { Locator, Page } from '@playwright/test'
import { montarEscolaComEntregas } from './support/governanca.ts'
import { abrirSeletorDeEscola, entrarComoCoordenacaoNaMesmaAba, entrarPorEmail, esperarPainel, linhaDoSeletor, nomeNoSeletor, SIGN_IN_TIMEOUT_MS } from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { campoCodigo } from './support/mfa.ts'
import { codigoDoAutenticador, codigoDoPassoAnterior, convidarProfessorNoBanco, criarEquipeComSenha, criarUsuarioEmOutraEscola } from './support/seed.ts'
import { horizontalOverflow, seriousViolations } from './support/checks.ts'

/**
 * O Painel da coordenação (telas da coordenação, 2.0; RF6, RF7 e RF22), pela tela, nos projetos `chromebook` e `celular`: os
 * números da escola, o que espera a coordenação, o que falta para terminar a escola, a escola vazia, a página que não rola a
 * 1366 × 768, a lista longa que rola por dentro e a pessoa seguinte na mesma aba. O item na lateral chega na 3.0: aqui a tela
 * se abre pelo endereço, sem recarregar a página (a coordenação já entrou). Nomes e e-mails inventados pelo teste.
 */

const principal = (page: Page) => page.getByRole('main')
/** O cartão do número de painel: o pai do rótulo. */
const numero = (page: Page, rotulo: string) => principal(page).getByText(rotulo, { exact: true }).first().locator('..')
const itensQueEsperam = (page: Page): Locator => principal(page).getByRole('region', { name: 'Itens que esperam você' })
const passosQueFaltam = (page: Page): Locator => principal(page).getByRole('region', { name: 'Passos que faltam' })

/** Abre o Painel como a lateral vai abrir: navegação dentro da aplicação, sem recarregar, com o cache e a sessão de pé. */
async function abrirPainel(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.history.pushState(null, '', '/coordenacao/painel')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page).toHaveURL(/\/coordenacao\/painel$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeAttached({ timeout: SIGN_IN_TIMEOUT_MS })
}

async function activate(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Quanto a página passa da janela, na vertical. Zero é "a página não rola". */
const rolagemDaPagina = (page: Page): Promise<number> => page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)

test.describe('o Painel da coordenação', () => {
  test('a escola com entregas: os quatro números da Governança, o consumo, "Esperando você" e a porta dos pedidos, sem número por professor e sem ler a lista de nomes nem os pedidos', async ({
    page,
    hasTouch,
  }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    const escola = await montarEscolaComEntregas(coordenadora.escolaId, coordenadora.usuarioId)
    const pedidos: string[] = []
    page.on('request', (pedido) => pedidos.push(new URL(pedido.url()).pathname))
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await esperarPainel(page)
    await abrirPainel(page)

    await expect(page).toHaveTitle('Painel · Turmma')
    // Quatro artefatos e três lotes; três aprovados, um esperando: os mesmos números da Governança.
    await expect(numero(page, 'Gerado por IA')).toContainText('7', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(numero(page, 'Aprovado por gente')).toContainText('3')
    await expect(numero(page, 'Esperando o professor')).toContainText('1')
    await expect(numero(page, 'Rejeitado')).toContainText('0')
    await expect(principal(page).getByRole('link', { name: 'Ver em Registros' })).toHaveAttribute('href', '/coordenacao/governanca')
    await expect(principal(page)).toContainText('Consumo do mês: 2.000 tokens · 3 execuções')
    await expect(principal(page)).not.toContainText('R$')

    // "Esperando você": a fila do sino e a porta fixa dos pedidos, sem número (contar seria ler a lista, que é auditada).
    await expect(principal(page).getByRole('heading', { name: 'Esperando você' })).toBeVisible()
    const porta = principal(page).getByRole('link', { name: /Pedidos dos titulares/ })
    await expect(porta).toBeVisible()
    await expect(porta).toContainText('Os prazos aparecem ao abrir. Cada leitura fica na auditoria.')
    await expect(porta).not.toContainText(/\d/)
    await expect(principal(page).getByRole('heading', { name: 'Para terminar a escola' })).toBeVisible()

    // Nenhum nome de professor, de aluno nem de turma em lugar nenhum da tela (D45, D64).
    for (const nome of [...Object.values(escola.professoras), escola.aluno, escola.turmas.doB.nome, escola.turmas.doC.nome]) await expect(principal(page)).not.toContainText(nome)

    // O Painel não lê a lista de nomes, os pedidos dos titulares nem as reivindicações: cada leitura iria para a auditoria.
    expect(pedidos.filter((caminho) => /\/v1\/privacidade\/pedidos|\/lista$|\/reivindicacoes/.test(caminho))).toEqual([])

    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('a escola sem ano letivo: "Comece pelo ano letivo", "Tudo em dia" e nenhuma chamada a turmas nem a vínculos', async ({ page, hasTouch }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador', { semAnoLetivo: true })
    const pedidos: string[] = []
    page.on('request', (pedido) => pedidos.push(new URL(pedido.url()).pathname))
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await esperarPainel(page)
    await abrirPainel(page)

    await expect(principal(page).getByText('Comece pelo ano letivo')).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByText('Tudo em dia')).toBeVisible()
    await expect(numero(page, 'Gerado por IA')).toContainText('0')
    await expect(principal(page).getByText('Nenhuma função da IA trabalhou neste mês.')).toBeVisible()
    await expect(principal(page).getByRole('button', { name: 'Criar o ano letivo' })).toBeVisible()
    expect(pedidos).toContain('/v1/anos-letivos')
    expect(pedidos.filter((caminho) => caminho === '/v1/turmas' || caminho === '/v1/vinculos')).toEqual([])

    // A escola vazia cabe na janela: a página não rola a 1366 × 768, e nos 360 px não rola de lado.
    if (!hasTouch) expect(await rolagemDaPagina(page), 'a página rola a 1366 × 768').toBeLessThanOrEqual(0)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('a lista longa rola por dentro, e a página não rola a 1366 × 768', async ({ page, hasTouch }) => {
    test.slow()
    const coordenadora = await criarEquipeComSenha('coordenador')
    // Oito convites vencidos: oito itens na fila, mais do que cabe na lista sem rolar.
    for (let indice = 0; indice < 8; indice += 1) await convidarProfessorNoBanco(coordenadora.escolaId, 'vencido')
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await esperarPainel(page)
    await abrirPainel(page)

    const lista = itensQueEsperam(page)
    await expect(lista).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(lista.getByRole('link')).toHaveCount(8)
    const medidas = await lista.evaluate((no) => ({ conteudo: no.scrollHeight, caixa: no.clientHeight, rola: getComputedStyle(no).overflowY }))
    expect(medidas.rola).toBe('auto')
    expect(medidas.conteudo, 'a lista longa não rola por dentro').toBeGreaterThan(medidas.caixa)
    // Quem usa teclado alcança a lista para rolar.
    await expect(lista).toHaveAttribute('tabindex', '0')
    if (!hasTouch) expect(await rolagemDaPagina(page), 'a página rola a 1366 × 768').toBeLessThanOrEqual(0)
    expect(await horizontalOverflow(page)).toBe(0)
    expect(await seriousViolations(page)).toEqual([])
    // A lista rola por dentro: o que não cabia chega à vista, e a página continua parada.
    await lista.evaluate((no) => no.scrollTo({ top: no.scrollHeight }))
    expect(await lista.evaluate((no) => no.scrollTop)).toBeGreaterThan(0)
  })

  test('o que falta para a escola: só os passos que faltam, cada um com o link da tela onde se faz', async ({ page, hasTouch }) => {
    test.slow()
    // Escola com o ano em curso e mais nada: faltam séries, disciplinas, turmas, a lista, os professores e a alocação.
    const coordenadora = await criarEquipeComSenha('coordenador')
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await esperarPainel(page)
    await abrirPainel(page)

    const faltam = passosQueFaltam(page)
    await expect(faltam).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await expect(faltam.getByRole('link', { name: /^Séries/ })).toHaveAttribute('href', '/coordenacao/estrutura?painel=ano')
    await expect(faltam.getByRole('link', { name: /^Professores/ })).toHaveAttribute('href', '/coordenacao/professores')
    await expect(faltam.getByRole('link', { name: /^Turmas/ })).toHaveAttribute('href', '/coordenacao/estrutura')
    // O ano já está em curso, e a lista de nomes nunca é medida: nenhum dos dois é "falta".
    await expect(faltam.getByRole('link', { name: /^Ano letivo/ })).toHaveCount(0)
    await expect(faltam.getByRole('link', { name: /^Lista de nomes/ })).toHaveCount(0)
    await expect(principal(page).getByText('A escola está montada')).toHaveCount(0)

    // O link leva à tela do passo, sem recarregar.
    await activate(faltam.getByRole('link', { name: /^Professores/ }), hasTouch)
    await expect(page).toHaveURL(/\/coordenacao\/professores$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Escola' })).toBeAttached({ timeout: SIGN_IN_TIMEOUT_MS })
  })
})

test.describe('recomeço: a pessoa seguinte na mesma aba', () => {
  test('o Painel da escola anterior não aparece para a coordenação que entra depois, sem recarregar a página', async ({ page, hasTouch }) => {
    test.slow()
    const primeira = await criarEquipeComSenha('coordenador')
    await montarEscolaComEntregas(primeira.escolaId, primeira.usuarioId)
    const professor = await convidarProfessorNoBanco(primeira.escolaId, 'vencido')
    const segunda = await criarEquipeComSenha('coordenador')

    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, primeira, hasTouch)
    await esperarPainel(page)
    await abrirPainel(page)
    await expect(numero(page, 'Gerado por IA')).toContainText('7', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(itensQueEsperam(page).getByRole('link', { name: new RegExp(professor.nome) })).toBeVisible()

    await activate(page.getByRole('button', { name: 'Sair' }).first(), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: SIGN_IN_TIMEOUT_MS })
    await entrarComoCoordenacaoNaMesmaAba(page, segunda, hasTouch)
    await esperarPainel(page)
    await abrirPainel(page)
    // Nem o número nem o item da anterior, nem durante a leitura: o que a segunda pessoa vê é só da escola dela.
    await expect(numero(page, 'Gerado por IA')).toContainText('0', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByText('Tudo em dia')).toBeVisible()
    expect(await page.content()).not.toContain(professor.nome)
  })
})

test.describe('recomeço: a troca de escola pelo seletor', () => {
  test('o Painel da escola B não traz os números nem o item da A, nem enquanto carrega', async ({ page, hasTouch }) => {
    test.slow()
    // A mesma conta coordena as duas escolas; só a A tem entregas e um convite vencido.
    const emA = await criarEquipeComSenha('coordenador')
    const emB = await criarUsuarioEmOutraEscola(emA.contaId, 'coordenador')
    await montarEscolaComEntregas(emA.escolaId, emA.usuarioId)
    const professor = await convidarProfessorNoBanco(emA.escolaId, 'vencido')

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
    await abrirPainel(page)
    await expect(numero(page, 'Gerado por IA')).toContainText('7', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(itensQueEsperam(page).getByRole('link', { name: new RegExp(professor.nome) })).toBeVisible()

    // Daqui em diante, qualquer momento em que a tela traz o nome do professor de A, ou o número de A no cartão "Gerado por IA",
    // é registrado. O cartão se lê pelo rótulo e pelo valor dele (7), e não por um "7" solto em qualquer lugar do corpo.
    await page.evaluate((nome) => {
      const vazamentos: string[] = []
      ;(window as unknown as { __vazamentos: string[] }).__vazamentos = vazamentos
      const ler = () => {
        if (document.body.textContent?.includes(nome) === true) vazamentos.push(nome)
        for (const valor of document.querySelectorAll('.t-numero')) {
          if (valor.previousElementSibling?.textContent === 'Gerado por IA' && valor.textContent === '7') vazamentos.push('Gerado por IA: 7')
        }
      }
      new MutationObserver(ler).observe(document.body, { subtree: true, childList: true, characterData: true })
    }, professor.nome)

    await abrirSeletorDeEscola(page, hasTouch)
    await activate(linhaDoSeletor(page, nomeNoSeletor(emB, 'coordenação')), hasTouch)
    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
    await campoCodigo(page).fill(codigoDoAutenticador(segredo, 30))
    await activate(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await esperarPainel(page)
    await expect(page.locator('body')).toContainText(emB.escolaNome)
    // A contagem se lê aqui: a tela de A já saiu, e tudo o que entra a partir daí é a tela de B. O Painel de B ainda não abriu, e
    // lida mais tarde (depois de ele mostrar o "0" e o "Tudo em dia") a janela que se confere seria quase vazia.
    const ultimo = await page.evaluate(() => (window as unknown as { __vazamentos: string[] }).__vazamentos.length)
    await abrirPainel(page)

    await expect(numero(page, 'Gerado por IA')).toContainText('0', { timeout: SIGN_IN_TIMEOUT_MS })
    await expect(principal(page).getByText('Tudo em dia')).toBeVisible()
    expect(await page.content()).not.toContain(professor.nome)
    // Nem o nome nem o 7 de A em nenhum momento da abertura do Painel de B: se o `resetQueries` de `main.tsx` virasse
    // `invalidateQueries`, o dado de A apareceria durante a releitura, e é aqui que o teste cai.
    const depois = await page.evaluate(() => (window as unknown as { __vazamentos: string[] }).__vazamentos.length)
    expect(depois, 'o nome do professor ou o número de A voltou à tela de B').toBe(ultimo)
  })
})
