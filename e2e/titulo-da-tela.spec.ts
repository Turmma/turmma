import type { Page, Route } from '@playwright/test'
import { MENSAGENS_DE_ERRO } from '../packages/shared/src/errors/messages.ts'
import {
  entrarComoAluno,
  entrarComoCoordenacaoNaMesmaAba,
  entrarComoProfessora,
  entrarComoProfessoraPelaApi,
  esperarPainel,
  irPelaNavegacao,
  PRAZO_DA_ENTRADA_MS,
} from './support/casca.ts'
import { expect, test } from './support/profiles.ts'
import { colocarAlunoNaTurma, criarAlunoComMatricula, criarEquipeComSenha } from './support/seed.ts'
import { larguraExcedente } from './support/checks.ts'

/**
 * O título de toda tela aberta pela lateral (X1, tarefa 11.0; RF12 e RF23; `docs/interface.md` 11.2): o `h1` aparece, com
 * o texto de hoje, em `t-titulo`, num cabeçalho de 64 px ou mais, e a aba do navegador diz a tela. A conversa é a exceção:
 * o `h1` existe, escondido, só para o leitor de tela.
 *
 * Mede-se a caixa que o navegador desenha, e não `toBeVisible`: o `h1` do leitor de tela (`sr-only`) tem uma caixa de 1 px
 * recortada, e passaria no `toBeVisible` do Playwright mesmo escondido.
 *
 * As listas abaixo repetem as de `areas.spec.ts` (o e2e não importa o fonte da web): a tarefa que acrescenta o item à
 * lateral o acrescenta lá e aqui.
 */

const ITENS_DO_PROFESSOR = [
  { rotulo: 'Início', escondido: true },
  { rotulo: 'Ferramentas', escondido: false },
  { rotulo: 'Turmas', escondido: false },
] as const
/** Criados chegou depois (telas do professor, 5.0), num caso próprio: o login do professor já leva a maior parte do prazo do caso. */
const ITEM_CRIADOS = [{ rotulo: 'Criados', escondido: false }] as const
/** Os quatro lugares da coordenação (X2): Escola e Registros abrem na primeira aba, e a aba do navegador diz de onde a tela é. */
const ITENS_DA_COORDENACAO = [
  { rotulo: 'Painel', escondido: false },
  { rotulo: 'Analista', escondido: false },
  { rotulo: 'Escola', escondido: false, titulo: 'Escola: turmas' },
  { rotulo: 'Registros', escondido: false, titulo: 'Registros: IA' },
] as const
/** Os três lugares do aluno (X4, 2.0): o Início é a conversa com o Tutor, e por isso o `h1` dele existe só para o leitor de tela. */
const ITENS_DO_ALUNO = [
  { rotulo: 'Início', escondido: true },
  { rotulo: 'Tarefas', escondido: false },
  { rotulo: 'Eu', escondido: false },
] as const

interface Item {
  readonly rotulo: string
  /** A conversa: o `h1` existe só para o leitor de tela. */
  readonly escondido: boolean
  /** A aba do navegador, quando não é o rótulo ("Escola: turmas"). */
  readonly titulo?: string
}

interface CaixaDoTitulo {
  readonly texto: string
  readonly largura: number
  readonly altura: number
  readonly fonte: string
  /** O recorte que o `sr-only` faz: `clip` (o antigo) ou `clip-path` (o do Tailwind 4). `auto` e `none`: sem recorte. */
  readonly recorte: string
  readonly recorteDoCaminho: string
  readonly posicao: string
  /** A altura do `header` da `Page` em que o `h1` está, ou `null` quando ele não está em um. */
  readonly cabecalho: number | null
}

/** O `h1` da tela aberta: um só, e a caixa que o navegador deu a ele. */
async function caixaDoTitulo(page: Page): Promise<CaixaDoTitulo> {
  const titulo = page.getByRole('main').getByRole('heading', { level: 1 })
  await expect(titulo).toHaveCount(1, { timeout: PRAZO_DA_ENTRADA_MS })
  return titulo.evaluate((elemento) => {
    const estilo = getComputedStyle(elemento)
    const caixa = elemento.getBoundingClientRect()
    const cabecalho = elemento.closest('header')
    return {
      texto: elemento.textContent ?? '',
      largura: caixa.width,
      altura: caixa.height,
      fonte: estilo.fontSize,
      recorte: estilo.clip,
      recorteDoCaminho: estilo.clipPath,
      posicao: estilo.position,
      cabecalho: cabecalho === null ? null : cabecalho.getBoundingClientRect().height,
    }
  })
}

/** O título que se vê: caixa de verdade, 24 px, sem recorte nem posição absoluta, num cabeçalho de 64 px ou mais. */
function conferirTituloVisivel(caixa: CaixaDoTitulo, texto: string): void {
  expect(caixa.texto).toBe(texto)
  expect(caixa.largura).toBeGreaterThan(1)
  expect(caixa.altura).toBeGreaterThan(1)
  expect(caixa.fonte).toBe('24px')
  expect(caixa.recorte).toBe('auto')
  expect(caixa.recorteDoCaminho).toBe('none')
  expect(caixa.posicao).not.toBe('absolute')
  expect(caixa.cabecalho).not.toBeNull()
  expect(caixa.cabecalho ?? 0).toBeGreaterThanOrEqual(64)
}

/** A exceção da conversa: o `h1` está na página, com o texto de hoje, e a pessoa não o vê (a caixa do `sr-only`). */
function conferirTituloEscondido(caixa: CaixaDoTitulo, texto: string): void {
  expect(caixa.texto).toBe(texto)
  expect(caixa.posicao).toBe('absolute')
  expect([caixa.recorte === 'auto', caixa.recorteDoCaminho === 'none']).not.toEqual([true, true])
  expect(caixa.largura).toBeLessThanOrEqual(1)
  expect(caixa.altura).toBeLessThanOrEqual(1)
  expect(caixa.cabecalho).toBeNull()
}

/** Percorre os itens da lateral do papel: o endereço não importa aqui, só o que o item abre. */
async function percorrer(page: Page, itens: readonly Item[], hasTouch: boolean): Promise<void> {
  for (const item of itens) {
    await irPelaNavegacao(page, item.rotulo, hasTouch)
    await expect(page).toHaveTitle(`${item.titulo ?? item.rotulo} · Turmma`, { timeout: PRAZO_DA_ENTRADA_MS })
    const caixa = await caixaDoTitulo(page)
    if (item.escondido) conferirTituloEscondido(caixa, item.rotulo)
    else conferirTituloVisivel(caixa, item.rotulo)
    // A 360 px o título maior não pode empurrar a página para o lado (RF23).
    expect(await larguraExcedente(page), item.rotulo).toBe(0)
  }
}

test.describe('o título de cada item da lateral', () => {
  test('professor: Ferramentas e Turmas mostram o título, e o Início o esconde, com o texto de "Início"', async ({ page, hasTouch }) => {
    await entrarComoProfessora(page, hasTouch)
    await percorrer(page, ITENS_DO_PROFESSOR, hasTouch)
  })

  test('professor: Criados mostra o título', async ({ page, hasTouch }) => {
    await entrarComoProfessora(page, hasTouch)
    await percorrer(page, ITEM_CRIADOS, hasTouch)
  })

  test('coordenação: os quatro lugares mostram o título, e a aba diz a tela ("Painel · Turmma" e os demais)', async ({ page, hasTouch }) => {
    const coordenadora = await criarEquipeComSenha('coordenador')
    await page.goto('/entrar')
    await entrarComoCoordenacaoNaMesmaAba(page, coordenadora, hasTouch)
    await esperarPainel(page)
    await expect(page).toHaveTitle('Painel · Turmma')
    await percorrer(page, ITENS_DA_COORDENACAO, hasTouch)
  })

  test('aluno: Tarefas e Eu mostram o título, e o Início o esconde, com o texto de hoje', async ({ page, hasTouch }) => {
    const aluno = await criarAlunoComMatricula()
    await colocarAlunoNaTurma(aluno)
    await entrarComoAluno(page, aluno, hasTouch)
    await percorrer(page, ITENS_DO_ALUNO, hasTouch)
  })
})

test.describe('o título nos estados da tela', () => {
  test('Turmas com a rota interceptada: o título está no vazio e no erro, e não só com dado', async ({ page, hasTouch }) => {
    let resposta: 'vazia' | 'falha' = 'vazia'
    await page.route('**/v1/meus-vinculos*', async (rota: Route) => {
      if (resposta === 'vazia') return rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [] }) })
      return rota.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }),
      })
    })
    await entrarComoProfessoraPelaApi(page)

    // Vazio: o título e, embaixo dele, o que a tela diz para quem ainda não foi alocado.
    await irPelaNavegacao(page, 'Turmas', hasTouch)
    await expect(page.getByText('A coordenação ainda não alocou você')).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    conferirTituloVisivel(await caixaDoTitulo(page), 'Turmas')

    // Erro: a mensagem do catálogo, com "Tentar de novo", e o título no lugar dele.
    resposta = 'falha'
    await page.reload()
    await expect(page.getByRole('alert')).toContainText(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, { timeout: PRAZO_DA_ENTRADA_MS })
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
    conferirTituloVisivel(await caixaDoTitulo(page), 'Turmas')
    expect(await larguraExcedente(page)).toBe(0)
  })
})
