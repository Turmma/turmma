import type { Locator, Page, Request } from '@playwright/test'
import {
  abrirNavegacao,
  abrirSeletorDeEscola,
  entrarPelaApi,
  entrarPelaApiSemMedirAPrimeiraCarga,
  esperarIntroducaoDoProfessor,
  esperarNovaConversa,
  FALAS_DA_INTRODUCAO_DO_PROFESSOR,
  falaDoPassoDoProfessor,
  lateral,
  linhaDoSeletor,
  nomeNoSeletor,
  PRAZO_DA_ENTRADA_MS,
} from './support/casca.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { expect, test } from './support/profiles.ts'
import { criarConviteDeProfessor, criarEquipeComSenha, criarUsuarioEmOutraEscola, introducaoVistaEmDoUsuario } from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, larguraExcedente, violacoesGraves } from './support/checks.ts'

/**
 * A introdução do professor (telas do aluno e primeiro acesso, 10.0; RF12, RF15 a RF18, RF20; mockup 14): na primeira entrada,
 * depois do convite, a professora cai nela e passa por quatro passos até o primeiro lugar dela; pular grava a data e a entrada
 * seguinte não volta; rever pelo menu da pessoa fecha em todo passo sem mudar a data; a segunda escola da
 * mesma conta não a reabre; e a professora seguinte no mesmo computador vê a dela. Os textos, os estados e as ramificações estão
 * em `textos-da-introducao.test.ts` e `BemVindo.test.tsx`; aqui está o que o navegador faz.
 *
 * Toda professora dos casos nasce com `introducao: 'por_ver'` (a fixture de hoje a cria com a introdução vista).
 */

const SENHA_NOVA = 'Senha-sintetica-42!'
/** Quanto o servidor demora a responder à gravação da introdução, no caso do "Pular" que prova a corrida entre a tela e o banco. */
const ATRASO_DA_GRAVACAO_MS = 1000

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  await (hasTouch ? alvo.tap() : alvo.click())
}

const continuar = (page: Page) => page.getByRole('button', { name: 'Continuar', exact: true })
const pular = (page: Page) => page.getByRole('button', { name: 'Pular', exact: true })
const guardadoNoNavegador = (page: Page) => page.evaluate(() => JSON.stringify([...Object.entries(localStorage), ...Object.entries(sessionStorage)]))

/**
 * Os pedidos de gravação da introdução que a página fez, desde que foi chamada. O evento `request` dispara quando o navegador **envia** o pedido,
 * antes do handler de `page.route` e muito antes de o servidor gravar: por isso a contagem não prova a data no banco, e o caso do "Pular" só fica
 * vermelho com a resposta atrasada porque o pedido já foi contado enquanto o banco ainda está vazio.
 */
function contarGravacoes(page: Page): Request[] {
  const feitos: Request[] = []
  page.on('request', (pedido) => {
    if (pedido.method() === 'POST' && new URL(pedido.url()).pathname === '/v1/eu/introducao') feitos.push(pedido)
  })
  return feitos
}

/** "Rever a introdução", o link do menu da pessoa: no computador a lateral já está aberta, e no celular ele está na gaveta. */
async function reverPeloMenuDaPessoa(page: Page, hasTouch: boolean): Promise<void> {
  await abrirNavegacao(page, hasTouch)
  await acionar(lateral(page).getByRole('navigation', { name: 'Sua conta', exact: true }).getByRole('link', { name: 'Rever a introdução' }), hasTouch)
}

test.describe('a introdução do professor', () => {
  test('o convite aceito leva à entrada, e a primeira entrada cai na introdução, no passo 1 e com "Pular"', async ({ page, hasTouch }) => {
    const convite = await criarConviteDeProfessor({ introducao: 'por_ver' })
    await page.goto(`/convite#${convite.token}`)
    await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(page.getByRole('button', { name: 'Aceitar o convite' }), hasTouch)
    await page.getByLabel('Senha nova').fill(SENHA_NOVA, { timeout: PRAZO_DA_ENTRADA_MS })
    await acionar(page.getByRole('button', { name: /Definir a senha e continuar|Salvando/ }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await page.getByLabel('E-mail').fill(convite.email)
    await page.getByLabel('Senha').fill(SENHA_NOVA)
    await acionar(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)

    await esperarIntroducaoDoProfessor(page)
    await expect(pular(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fechar', exact: true })).toHaveCount(0)
    // O nome da função assina embaixo da onça, com o selo "IA" (D17, D58).
    await expect(page.getByRole('main').locator('[data-onca]')).toContainText('Assistente de ensino')
  })

  test('os quatro passos levam ao primeiro lugar, e "Continuar" no último é o "Começar": uma gravação só, e nada fica no navegador', async ({ page, hasTouch }) => {
    const professora = await criarEquipeComSenha('professor', { introducao: 'por_ver' })
    await entrarPelaApi(page, professora, '/')
    await esperarIntroducaoDoProfessor(page)
    const gravacoes = contarGravacoes(page)

    // "onde fica cada coisa" só no último passo, um item por lugar da lateral.
    for (let passo = 1; passo < FALAS_DA_INTRODUCAO_DO_PROFESSOR.length; passo++) {
      await expect(falaDoPassoDoProfessor(page, passo)).toBeVisible()
      await expect(page.getByRole('region', { name: 'Onde fica cada coisa' })).toHaveCount(0)
      await acionar(continuar(page), hasTouch)
    }
    await expect(falaDoPassoDoProfessor(page, FALAS_DA_INTRODUCAO_DO_PROFESSOR.length)).toBeVisible()
    // RF20: no computador (1366 × 768) o último passo cabe sem rolar a página, com a lista dentro da região que rola, e "Continuar" e
    // "Pular" já à vista, sem o clique ter de rolar até eles. Sem a região a página media 917 px.
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await expect(page.getByRole('region', { name: 'Leia até o fim', exact: true })).toBeVisible()
      await expect(continuar(page)).toBeInViewport()
      await expect(pular(page)).toBeInViewport()
      await paginaNaoRola(page)
    }
    const lugares = page.getByRole('region', { name: 'Onde fica cada coisa' })
    await expect(lugares.getByRole('listitem')).toHaveCount(4)
    for (const lugar of ['Início', 'Turmas', 'Ferramentas', 'Criados']) await expect(lugares).toContainText(lugar)
    await acionar(continuar(page), hasTouch)
    await esperarNovaConversa(page, professora.nome)
    await expect.poll(() => gravacoes.length).toBe(1)
    // Nada da introdução fica no navegador: a data mora no servidor.
    expect(await guardadoNoNavegador(page)).toBe('[]')
  })

  test('"Pular" no passo 1 grava a data, uma vez, e leva a "Início"', async ({ page, hasTouch }) => {
    const professora = await criarEquipeComSenha('professor', { introducao: 'por_ver' })
    expect(await introducaoVistaEmDoUsuario(professora.usuarioId)).toBeNull()
    // A primeira carga fora da rede lenta: o assunto do caso vem depois dela, e a rede lenta soma uns 5 s que não provam nada aqui.
    await entrarPelaApiSemMedirAPrimeiraCarga(page, professora, '/', () => esperarIntroducaoDoProfessor(page))
    const gravacoes = contarGravacoes(page)

    // O servidor demora a gravar: o pedido já saiu e a tela já seguiu, e o banco ainda não tem a data. É a corrida da esteira, feita à vista.
    await page.route('**/v1/eu/introducao', async (rota) => {
      await new Promise((fim) => setTimeout(fim, ATRASO_DA_GRAVACAO_MS))
      await rota.continue()
    })
    await acionar(pular(page), hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect.poll(() => gravacoes.length).toBe(1)
    // Quem prova a gravação é este poll do banco: o pedido saiu e a tela já seguiu, mas o servidor pode ainda não ter gravado. A data no servidor
    // é o que faz a entrada seguinte não desviar para a introdução (o desvio em si está em `Inicio.test.tsx`); a contagem acima só diz que o pedido saiu.
    await expect.poll(() => introducaoVistaEmDoUsuario(professora.usuarioId), { timeout: PRAZO_DA_ENTRADA_MS }).not.toBeNull()
    // O atraso só valia para a gravação do "Pular": a entrada seguinte volta ao servidor sem ele.
    await page.unroute('**/v1/eu/introducao')
    await page.goto('/')
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: PRAZO_DA_ENTRADA_MS })
  })

  test('rever pelo menu da pessoa: todo passo tem "Fechar", nada é gravado e a data não muda', async ({ page, hasTouch }) => {
    const professora = await criarEquipeComSenha('professor')
    const antes = await introducaoVistaEmDoUsuario(professora.usuarioId)
    expect(antes).not.toBeNull()
    const gravacoes = contarGravacoes(page)
    await entrarPelaApi(page, professora, '/professor/turmas')
    await expect(page.getByRole('heading', { level: 1, name: 'Turmas' })).toBeAttached({ timeout: PRAZO_DA_ENTRADA_MS })

    await reverPeloMenuDaPessoa(page, hasTouch)
    await esperarIntroducaoDoProfessor(page)
    // Revendo, nenhum passo é "Pular", e todo passo fecha.
    for (let passo = 1; passo <= FALAS_DA_INTRODUCAO_DO_PROFESSOR.length; passo++) {
      await expect(falaDoPassoDoProfessor(page, passo)).toBeVisible()
      await expect(pular(page)).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Fechar', exact: true })).toBeVisible()
      if (passo < FALAS_DA_INTRODUCAO_DO_PROFESSOR.length) await acionar(continuar(page), hasTouch)
    }
    await acionar(page.getByRole('button', { name: 'Fechar', exact: true }), hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: PRAZO_DA_ENTRADA_MS })
    // Nenhuma gravação saiu, e a data que o servidor já tinha é a mesma.
    expect(gravacoes).toHaveLength(0)
    expect(await introducaoVistaEmDoUsuario(professora.usuarioId)).toEqual(antes)
  })

  test('concluída na escola A, a troca para a escola B pelo seletor não reabre a introdução', async ({ page, hasTouch }) => {
    const emA = await criarEquipeComSenha('professor', { introducao: 'por_ver' })
    // A mesma conta e o mesmo papel em B, e em B a introdução ainda por ver: só a data de A a faz valer.
    const emB = await criarUsuarioEmOutraEscola(emA.contaId, 'professor', { introducao: 'por_ver' })
    await entrarPelaApi(page, emA, '/', emA.usuarioId)
    await esperarIntroducaoDoProfessor(page)
    const gravouEmA = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/eu/introducao' && resposta.request().method() === 'POST')
    await acionar(pular(page), hasTouch)
    expect((await gravouEmA).ok()).toBe(true)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: PRAZO_DA_ENTRADA_MS })

    await abrirNavegacao(page, hasTouch)
    await abrirSeletorDeEscola(page, hasTouch)
    const leituraDeB = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/eu' && resposta.request().method() === 'GET')
    await acionar(linhaDoSeletor(page, nomeNoSeletor(emB, 'professor')), hasTouch)
    // A troca leva à raiz, que lê o `/v1/eu` de B: com a data de A emprestada, ela abre "Início" de B.
    await esperarNovaConversa(page, 'Professora sintética na outra escola', { escolaNome: emB.escolaNome })
    await expect(page).not.toHaveURL(/bem-vindo/)
    // E o que a abriu foi a resposta de B, com a data na mão, e não o `['eu']` de A que sobrou no cache.
    const euDeB = (await (await leituraDeB).json()) as { introducaoVistaEm: string | null }
    expect(euDeB.introducaoVistaEm).not.toBeNull()
  })

  test('a professora seguinte no mesmo computador vê a introdução dela, do passo 1: nada do cache da de antes sobra', async ({ page, hasTouch }) => {
    const primeira = await criarEquipeComSenha('professor')
    const segunda = await criarEquipeComSenha('professor', { introducao: 'por_ver' })
    // A primeira já viu a introdução (o `/v1/eu` dela, com a data, fica no cache da aba); a segunda ainda não.
    await entrarPelaApi(page, primeira, '/')
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout: PRAZO_DA_ENTRADA_MS })

    await abrirNavegacao(page, hasTouch)
    await acionar(lateral(page).getByRole('button', { name: 'Sair' }).and(page.locator(':not(main *)')), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })

    // Sem recarregar a página: a aplicação é a mesma, com o que a primeira deixou na memória dela, e a segunda entra pela tela.
    await page.getByLabel('E-mail').fill(segunda.email)
    await page.getByLabel('Senha').fill(segunda.senha)
    await acionar(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
    await esperarIntroducaoDoProfessor(page)
  })

  test('a 360 px, em cada passo, a página não rola de lado, os botões têm 44 px, "Pular" e "Continuar" são iguais e não há violação grave', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    const professora = await criarEquipeComSenha('professor', { introducao: 'por_ver' })
    await entrarPelaApi(page, professora, '/')
    await esperarIntroducaoDoProfessor(page)

    for (let passo = 1; passo <= FALAS_DA_INTRODUCAO_DO_PROFESSOR.length; passo++) {
      const rotulo = `passo ${String(passo)}`
      await expect(falaDoPassoDoProfessor(page, passo), rotulo).toBeVisible()
      expect(await larguraExcedente(page), rotulo).toBe(0)
      for (const botao of [continuar(page), pular(page)]) {
        await botao.scrollIntoViewIfNeeded()
        await expect(botao, rotulo).toBeInViewport()
        const caixa = await botao.boundingBox()
        expect(caixa?.height, rotulo).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
        expect(caixa?.width, rotulo).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      }
      const [caixaContinuar, caixaPular] = await Promise.all([continuar(page).boundingBox(), pular(page).boundingBox()])
      // "Pular" tem o mesmo tamanho que "Continuar" (RF16, D59).
      expect(caixaPular?.height, rotulo).toBe(caixaContinuar?.height)
      expect(caixaPular?.width, rotulo).toBe(caixaContinuar?.width)
      if (passo === FALAS_DA_INTRODUCAO_DO_PROFESSOR.length) expect(await violacoesGraves(page), rotulo).toEqual([])
      else await acionar(continuar(page), hasTouch)
    }
  })

  test('revendo, a 360 px, em cada passo, a página não rola de lado e o "Fechar" tem 44 px', async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    const professora = await criarEquipeComSenha('professor')
    expect(await introducaoVistaEmDoUsuario(professora.usuarioId)).not.toBeNull()
    await entrarPelaApi(page, professora, '/professor/bem-vindo')
    await esperarIntroducaoDoProfessor(page)

    for (let passo = 1; passo <= FALAS_DA_INTRODUCAO_DO_PROFESSOR.length; passo++) {
      const rotulo = `passo ${String(passo)}`
      await expect(falaDoPassoDoProfessor(page, passo), rotulo).toBeVisible()
      expect(await larguraExcedente(page), rotulo).toBe(0)
      const fechar = page.getByRole('button', { name: 'Fechar', exact: true })
      await expect(fechar, rotulo).toBeInViewport()
      const caixa = await fechar.boundingBox()
      expect(caixa?.height, rotulo).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      expect(caixa?.width, rotulo).toBeGreaterThanOrEqual(ALVO_DE_TOQUE_PRINCIPAL_PX)
      if (passo < FALAS_DA_INTRODUCAO_DO_PROFESSOR.length) await acionar(continuar(page), hasTouch)
    }
  })

  test('"Sair" no meio não grava: a pessoa vai à entrada e nenhuma gravação sai', async ({ page, hasTouch }) => {
    const professora = await criarEquipeComSenha('professor', { introducao: 'por_ver' })
    await entrarPelaApi(page, professora, '/')
    await esperarIntroducaoDoProfessor(page)
    const gravacoes = contarGravacoes(page)
    await acionar(continuar(page), hasTouch)
    await expect(falaDoPassoDoProfessor(page, 2)).toBeVisible()

    await acionar(page.getByRole('button', { name: 'Sair', exact: true }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(gravacoes).toHaveLength(0)
  })
})
