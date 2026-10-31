import { randomUUID } from 'node:crypto'
import type { Locator, Page, Request } from '@playwright/test'
import { abrirNavegacao, entrarComoCoordenacaoPeloConvite, entrarPelaTelaComSegundoFator, esperarIntroducaoDaCoordenacao, esperarPainel, falaDoPassoDaCoordenacao, falasDaIntroducaoDaCoordenacao, lateral, PRAZO_DA_ENTRADA_MS } from './support/casca.ts'
import { paginaNaoRola } from './support/coordenacao.ts'
import { expect, test } from './support/profiles.ts'
import { abrirPelaApiSemMedirAPrimeiraCarga, configurarSegundoFatorPelaApi } from './support/mfa.ts'
import {
  confirmacaoDoIncidenteNoBanco,
  criarConviteDeCoordenador,
  criarEquipeComSenha,
  criarIncidenteNoBanco,
  criarProfessoraNaEscola,
  introducaoVistaEmDoUsuario,
} from './support/seed.ts'
import { ALVO_DE_TOQUE_PRINCIPAL_PX, larguraExcedente, violacoesGraves } from './support/checks.ts'

/**
 * A introdução da coordenação (telas do aluno e primeiro acesso, 11.0; RF12, RF15 a RF18, RF20; mockup 7): na primeira entrada, depois do
 * convite e do segundo fator, a coordenadora cai nela e passa por quatro passos até o Painel; pular grava a data e a entrada seguinte não
 * volta; rever pelo menu da pessoa fecha em todo passo sem mudar a data; o aviso de incidente aparece por cima dela sem marcá-la como vista;
 * a coordenação não sabe quem viu a introdução (D64); e a coordenadora seguinte no mesmo computador vê a dela. Os textos, os estados e as
 * ramificações estão em `textos-da-introducao.test.ts` e `BemVindo.test.tsx`; aqui está o que o navegador faz.
 *
 * Toda coordenadora dos casos nasce com `introducao: 'por_ver'` (a fixture de hoje a cria com a introdução vista). A entrada pela API,
 * com o segundo fator já configurado, é o atalho dos casos que provam outra coisa que não a entrada: a entrada pela tela (convite, senha,
 * segundo fator e login) tem o primeiro caso.
 */

const SENHA_NOVA = 'frase-sintetica-do-convite'
const TITULO_DO_AVISO = 'Aviso de incidente de segurança'

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  await (hasTouch ? alvo.tap() : alvo.click())
}

const continuar = (page: Page) => page.getByRole('button', { name: 'Continuar', exact: true })
const pular = (page: Page) => page.getByRole('button', { name: 'Pular', exact: true })
const fechar = (page: Page) => page.getByRole('button', { name: 'Fechar', exact: true })
const guardadoNoNavegador = (page: Page) => page.evaluate(() => JSON.stringify([...Object.entries(localStorage), ...Object.entries(sessionStorage)]))

/** Os pedidos de gravação da introdução que a página fez, desde que foi chamada. */
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

test.describe('a introdução da coordenação', () => {
  test('o convite aceito, com a senha e o segundo fator, leva à entrada, e a primeira entrada cai na introdução, no passo 1 e com "Pular"', async ({ page, hasTouch }) => {
    const convite = await criarConviteDeCoordenador({ introducao: 'por_ver' })
    await entrarComoCoordenacaoPeloConvite(page, convite, SENHA_NOVA, hasTouch)

    await esperarIntroducaoDaCoordenacao(page, convite.escolaNome)
    await expect(pular(page)).toBeVisible()
    await expect(fechar(page)).toHaveCount(0)
    // O nome da função assina embaixo da onça, com o selo "IA" (D17, D58).
    await expect(page.getByRole('main').locator('[data-onca]')).toContainText('Analista de desempenho escolar')
  })

  test('os quatro passos levam ao Painel, e "Continuar" no último é o "Começar": uma gravação só, e nada fica no navegador', async ({ page, hasTouch, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador', { introducao: 'por_ver' })
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/')
    await esperarIntroducaoDaCoordenacao(page, coordenadora.escolaNome)
    const gravacoes = contarGravacoes(page)

    // "onde fica cada coisa" só no último passo, um item por lugar da lateral.
    const total = falasDaIntroducaoDaCoordenacao(coordenadora.escolaNome).length
    for (let passo = 1; passo < total; passo++) {
      await expect(falaDoPassoDaCoordenacao(page, passo, coordenadora.escolaNome)).toBeVisible()
      await expect(page.getByRole('region', { name: 'Onde fica cada coisa' })).toHaveCount(0)
      await acionar(continuar(page), hasTouch)
    }
    await expect(falaDoPassoDaCoordenacao(page, total, coordenadora.escolaNome)).toBeVisible()
    // RF20: no computador (1366 × 768) o último passo cabe sem rolar a página, com as duas listas dentro da região que rola, e "Continuar" e
    // "Pular" já à vista, sem o clique ter de rolar até eles.
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await expect(page.getByRole('region', { name: 'Leia até o fim', exact: true })).toBeVisible()
      await expect(continuar(page)).toBeInViewport()
      await expect(pular(page)).toBeInViewport()
      await paginaNaoRola(page)
    }
    const lugares = page.getByRole('region', { name: 'Onde fica cada coisa' })
    await expect(lugares.getByRole('listitem')).toHaveCount(4)
    for (const lugar of ['Painel', 'Analista', 'Escola', 'Registros']) await expect(lugares).toContainText(lugar)
    await acionar(continuar(page), hasTouch)
    await esperarPainel(page)
    await expect.poll(() => gravacoes.length).toBe(1)
    // Nada da introdução fica no navegador: a data mora no servidor.
    expect(await guardadoNoNavegador(page)).toBe('[]')
    // Uma gravação só, e nenhuma tardia: a contagem final, e não o primeiro 1.
    expect(gravacoes).toHaveLength(1)
  })

  test('"Pular" no passo 1 grava a data, uma vez, e leva ao Painel; a entrada seguinte não volta', async ({ page, hasTouch, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador', { introducao: 'por_ver' })
    expect(await introducaoVistaEmDoUsuario(coordenadora.usuarioId)).toBeNull()
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/')
    await esperarIntroducaoDaCoordenacao(page, coordenadora.escolaNome)
    const gravacoes = contarGravacoes(page)

    await acionar(pular(page), hasTouch)
    // Só o endereço: esperar a tela do Painel soma uns 5 s ao caso (o Painel em si está provado no caso dos quatro passos).
    await expect(page).toHaveURL(/\/coordenacao\/painel$/, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect.poll(() => gravacoes.length).toBe(1)
    // A data está no servidor, e a entrada seguinte já não desvia para a introdução (o desvio em si está em `Inicio.test.tsx`).
    expect(await introducaoVistaEmDoUsuario(coordenadora.usuarioId)).not.toBeNull()
    await page.goto('/')
    // Só o endereço, como acima: esperar a tela do Painel não prova mais nada aqui.
    await expect(page).toHaveURL(/\/coordenacao\/painel$/, { timeout: PRAZO_DA_ENTRADA_MS })
    // A entrada seguinte não gravou de novo, e nenhuma gravação tardia chegou: a contagem final.
    expect(gravacoes).toHaveLength(1)
  })

  test('a coordenação não sabe quem viu a introdução: a lista de professores não traz a data de ninguém, nem o campo (D64)', async ({ page, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    // Um professor da escola que ainda não viu a dele, e outro que já viu: a lista não diz qual é qual.
    const semVer = await criarProfessoraNaEscola(coordenadora, { introducao: 'por_ver' })
    const jaViu = await criarProfessoraNaEscola(coordenadora)
    // A lista de professores é lida ao abrir a tela, e a tela se abre pelo endereço: a resposta é a que o navegador recebeu.
    const lista = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/professores' && resposta.request().method() === 'GET')
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/professores')
    const corpo = await (await lista).text()
    expect(corpo).toContain(semVer.nome)
    expect(corpo).toContain(jaViu.nome)
    expect(corpo.toLowerCase()).not.toContain('introducao')
  })

  test('rever pelo menu da pessoa: todo passo tem "Fechar", nada é gravado e a data não muda', async ({ page, hasTouch, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    const antes = await introducaoVistaEmDoUsuario(coordenadora.usuarioId)
    expect(antes).not.toBeNull()
    const gravacoes = contarGravacoes(page)
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/coordenacao/painel')
    await esperarPainel(page)

    await reverPeloMenuDaPessoa(page, hasTouch)
    await esperarIntroducaoDaCoordenacao(page, coordenadora.escolaNome)
    const falas = falasDaIntroducaoDaCoordenacao(coordenadora.escolaNome)
    // Revendo, nenhum passo é "Pular", e todo passo fecha.
    for (let passo = 1; passo <= falas.length; passo++) {
      await expect(falaDoPassoDaCoordenacao(page, passo, coordenadora.escolaNome)).toBeVisible()
      await expect(pular(page)).toHaveCount(0)
      await expect(fechar(page)).toBeVisible()
      if (passo < falas.length) await acionar(continuar(page), hasTouch)
    }
    await acionar(fechar(page), hasTouch)
    await esperarPainel(page)
    // Nenhuma gravação saiu, e a data que o servidor já tinha é a mesma.
    expect(gravacoes).toHaveLength(0)
    expect(await introducaoVistaEmDoUsuario(coordenadora.usuarioId)).toEqual(antes)
  })

  test('com um incidente pendente, o aviso aparece por cima da introdução; "Ver depois" o fecha e a introdução continua; confirmar o incidente não a marca como vista', async ({
    page,
    hasTouch,
    request,
  }) => {
    const coordenadora = await criarEquipeComSenha('coordenador', { introducao: 'por_ver' })
    const marca = `Marca ${randomUUID().slice(0, 8)}`
    const secoes = await criarIncidenteNoBanco({ escolas: [coordenadora.escolaId], circunstancias: `${marca}. Circunstâncias do incidente de teste.` })
    const secao = secoes[coordenadora.escolaId]
    if (secao === undefined) throw new Error('o incidente de teste não criou a seção da escola')
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/')
    await esperarIntroducaoDaCoordenacao(page, coordenadora.escolaNome)
    const gravacoes = contarGravacoes(page)

    // O aviso é da área, e não da tela: aparece por cima da introdução, que está atrás.
    const dialogo = page.getByRole('alertdialog', { name: TITULO_DO_AVISO, exact: true })
    await expect(dialogo).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page).toHaveURL(/\/coordenacao\/bem-vindo$/)

    // "Ver depois" fecha o aviso, deixa a faixa, e a introdução continua no passo em que estava.
    await acionar(dialogo.getByRole('button', { name: 'Ver depois', exact: true }), hasTouch)
    await expect(dialogo).toBeHidden()
    const faixa = page.getByRole('region', { name: TITULO_DO_AVISO, exact: true })
    await expect(faixa).toBeVisible()
    await expect(falaDoPassoDaCoordenacao(page, 1, coordenadora.escolaNome)).toBeVisible()
    await acionar(continuar(page), hasTouch)
    await expect(falaDoPassoDaCoordenacao(page, 2, coordenadora.escolaNome)).toBeVisible()
    if ((page.viewportSize()?.width ?? 0) >= 768) await paginaNaoRola(page)

    // Confirmar o incidente tira a faixa, grava a confirmação dele, e não toca na data da introdução.
    await acionar(faixa.getByRole('button', { name: 'Ver o aviso', exact: true }), hasTouch)
    await acionar(dialogo.getByRole('button', { name: 'Confirmo que recebi', exact: true }), hasTouch)
    await expect(dialogo).toHaveCount(0)
    await expect(faixa).toHaveCount(0)
    expect(await confirmacaoDoIncidenteNoBanco(secao)).not.toBeNull()
    expect(await introducaoVistaEmDoUsuario(coordenadora.usuarioId)).toBeNull()
    expect(gravacoes).toHaveLength(0)
    await expect(falaDoPassoDaCoordenacao(page, 2, coordenadora.escolaNome)).toBeVisible()
  })

  test('a coordenadora seguinte no mesmo computador vê a introdução dela, do passo 1: nada do cache da de antes sobra', async ({ page, hasTouch, request }) => {
    const primeira = await criarEquipeComSenha('coordenador')
    const segunda = await criarEquipeComSenha('coordenador', { introducao: 'por_ver' })
    const { segredo } = await configurarSegundoFatorPelaApi(request, segunda)
    // A primeira já viu a introdução (o `/v1/eu` dela, com a data, fica no cache da aba); a segunda ainda não.
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, primeira, '/coordenacao/agentes')
    await expect(page).toHaveURL(/\/coordenacao\/agentes$/, { timeout: PRAZO_DA_ENTRADA_MS })

    await abrirNavegacao(page, hasTouch)
    await acionar(lateral(page).getByRole('button', { name: 'Sair' }).and(page.locator(':not(main *)')), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })

    // Sem recarregar a página: a aplicação é a mesma, com o que a primeira deixou na memória dela, e a segunda entra pela tela.
    await entrarPelaTelaComSegundoFator(page, segunda, segredo, hasTouch)
    await esperarIntroducaoDaCoordenacao(page, segunda.escolaNome)
  })

  test('a 360 px, em cada passo, a página não rola de lado, os botões têm 44 px, "Pular" e "Continuar" são iguais e não há violação grave', async ({ page, hasTouch, request }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    const coordenadora = await criarEquipeComSenha('coordenador', { introducao: 'por_ver' })
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/')
    await esperarIntroducaoDaCoordenacao(page, coordenadora.escolaNome)

    const total = falasDaIntroducaoDaCoordenacao(coordenadora.escolaNome).length
    for (let passo = 1; passo <= total; passo++) {
      const rotulo = `passo ${String(passo)}`
      await expect(falaDoPassoDaCoordenacao(page, passo, coordenadora.escolaNome), rotulo).toBeVisible()
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
      if (passo === total) expect(await violacoesGraves(page), rotulo).toEqual([])
      else await acionar(continuar(page), hasTouch)
    }
  })

  test('"Sair" no meio não grava: a pessoa vai à entrada e nenhuma gravação sai', async ({ page, hasTouch, request }) => {
    const coordenadora = await criarEquipeComSenha('coordenador', { introducao: 'por_ver' })
    await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/')
    await esperarIntroducaoDaCoordenacao(page, coordenadora.escolaNome)
    const gravacoes = contarGravacoes(page)
    await acionar(continuar(page), hasTouch)
    await expect(falaDoPassoDaCoordenacao(page, 2, coordenadora.escolaNome)).toBeVisible()

    await acionar(page.getByRole('button', { name: 'Sair', exact: true }), hasTouch)
    await expect(page).toHaveURL(/\/entrar$/, { timeout: PRAZO_DA_ENTRADA_MS })
    expect(gravacoes).toHaveLength(0)
    expect(await introducaoVistaEmDoUsuario(coordenadora.usuarioId)).toBeNull()
  })
})
