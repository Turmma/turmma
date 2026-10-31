// @vitest-environment jsdom
import { MENSAGENS_DE_ERRO, montarTime, type ChaveDeFuncao } from '@educa/shared'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { prepararTela, redeFalsa, renderizarTela, type RedeFalsa, type RespostaFalsa } from '../../../__fixtures__/render-screen'
import { ROTAS_DO_PROFESSOR } from '../../../paths'
import { CartaoDeFerramenta } from './CartaoDeFerramenta'
import { TEXTO_DA_SUSPENSAO } from '../comum/avisos'
import type { IniciaisDaFerramenta } from './ferramentas'
import { CICLO_DA_FERRAMENTA } from '../assistente/memoria-do-professor'

/**
 * O cartão da ferramenta (telas do professor, 4.0; RF8 e RF9): o motor de sempre, com o ícone ilustrado de 32 px antes do
 * nome quando é o cartão da conversa (`comIcone`), e nada mais mudado. Os quatro estados do cartão, o ícone nos dois
 * estados do motor (formulário e pedido recolhido) e a Adaptação sem campo de texto. A rede é falsa; o cliente de consultas,
 * a memória da aba, o roteador e a tela são os de verdade. O cartão dentro da conversa, a pergunta que o abre e o foco são
 * de `Conversa.test.tsx`; o fluxo inteiro, de `e2e/professor-conversa.spec.ts`.
 */
prepararTela()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const QUIMICA = { id: id(500), nome: 'Química' }
const TURMA_A = { id: id(101), nome: '1º A' }
const VALOR_DA_TURMA_A = `${TURMA_A.id}:${QUIMICA.id}`
const VINCULO: RespostaFalsa = { status: 200, corpo: { itens: [{ id: id(401), turma: TURMA_A, disciplina: QUIMICA, estado: 'confirmado' }] } }
const SEM_VINCULO: RespostaFalsa = { status: 200, corpo: { itens: [] } }
const erro = (status: number, codigo: string): RespostaFalsa => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
const timeSem = (...suspensas: ChaveDeFuncao[]): RespostaFalsa => ({ status: 200, corpo: montarTime(new Set(suspensas)) })

/** Uma atividade objetiva já gerada: o que a Adaptação precisa ter para abrir o formulário. */
const ATIVIDADE = {
  id: id(700),
  tipo: 'atividade_objetiva',
  titulo: 'Atividade de estequiometria',
  turmaId: TURMA_A.id,
  disciplinaId: QUIMICA.id,
  origemId: null,
  adaptacao: null,
  entrega: null,
  criadoEm: '2026-10-05T13:00:00.000Z',
}

interface Quem {
  readonly vinculos?: RespostaFalsa | (() => RespostaFalsa | Promise<RespostaFalsa>)
  readonly time?: RespostaFalsa
  readonly artefatos?: RespostaFalsa
}

function instalar(rede: RedeFalsa, quem: Quem = {}): void {
  rede.responderPor('/v1/meus-vinculos', quem.vinculos ?? VINCULO)
  rede.responderPor('/v1/time', quem.time ?? timeSem())
  rede.responderPor('/v1/artefatos', quem.artefatos ?? { status: 200, corpo: { itens: [ATIVIDADE] } })
  // O pedido de geração: a execução fica no ar, sem terminar.
  rede.responderPor('/v1/ferramentas/atividade_objetiva/gerar', { status: 202, corpo: { execucaoId: id(950) } })
  rede.responderPor(/^\/v1\/execucoes\//, () => new Promise<RespostaFalsa>(() => undefined))
}

const INICIAIS: IniciaisDaFerramenta = { turma: VALOR_DA_TURMA_A, tema: 'Estequiometria' }

function montar(ferramenta: 'atividade_objetiva' | 'plano_de_aula' | 'adaptacao', props: { comIcone?: boolean; iniciais?: IniciaisDaFerramenta } = {}) {
  const localizacao = memoryLocation({ path: ROTAS_DO_PROFESSOR.conversa, record: true })
  renderizarTela(
    <Router hook={localizacao.hook}>
      <CartaoDeFerramenta ferramenta={ferramenta} nivel={2} {...(props.iniciais === undefined ? {} : { iniciais: props.iniciais })} {...(props.comIcone === undefined ? {} : { comIcone: props.comIcone })} />
    </Router>,
  )
  return localizacao
}

beforeEach(() => {
  for (const lugar of Object.values(CICLO_DA_FERRAMENTA)) lugar.guardar(undefined)
})

afterEach(() => {
  cleanup()
})

const cartao = (ferramenta: string) => document.querySelector(`[data-cartao-de-ferramenta="${ferramenta}"]`) as HTMLElement
const iconesDe = (dentro: ParentNode) => Array.from(dentro.querySelectorAll('[data-icone-de-ferramenta]'))

describe('os estados do cartão', () => {
  it('carregando: as turmas ainda não vieram, e o cartão diz que está carregando, sem formulário', async () => {
    const rede = redeFalsa()
    let liberar: (resposta: RespostaFalsa) => void = () => undefined
    instalar(rede, { vinculos: () => new Promise<RespostaFalsa>((resolver) => (liberar = resolver)) })
    montar('atividade_objetiva', { comIcone: true, iniciais: INICIAIS })
    expect(await screen.findByText('Carregando a ferramenta…')).toBeTruthy()
    expect(document.querySelector('[data-cartao-de-ferramenta]')).toBeNull()
    expect(iconesDe(document.body)).toHaveLength(0)
    liberar(VINCULO)
    expect(await screen.findByRole('heading', { level: 2, name: 'Atividade objetiva' })).toBeTruthy()
    expect(screen.queryByText('Carregando a ferramenta…')).toBeNull()
  })

  it('erro: a mensagem do catálogo, sem o código, e "Tentar de novo" lê de novo e traz o formulário', async () => {
    const rede = redeFalsa()
    let leituras = 0
    instalar(rede, { vinculos: () => (++leituras === 1 ? erro(404, 'NAO_ENCONTRADO') : VINCULO) })
    montar('atividade_objetiva', { comIcone: true, iniciais: INICIAIS })
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain(MENSAGENS_DE_ERRO.NAO_ENCONTRADO)
    expect(alerta.textContent).not.toContain('NAO_ENCONTRADO')
    expect(document.querySelector('[data-cartao-de-ferramenta]')).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Atividade objetiva' })).toBeTruthy()
    expect(leituras).toBe(2)
  })

  it('vazio: sem turma confirmada diz o que falta, sem formulário nem ícone, e "Ir para Turmas" leva a Turmas', async () => {
    const rede = redeFalsa()
    instalar(rede, { vinculos: SEM_VINCULO })
    const localizacao = montar('atividade_objetiva', { comIcone: true })
    expect(await screen.findByText('Falta uma turma confirmada')).toBeTruthy()
    expect(document.querySelector('[data-cartao-de-ferramenta]')).toBeNull()
    expect(iconesDe(document.body)).toHaveLength(0)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ir para Turmas' }))
    expect(localizacao.history.at(-1)).toBe(ROTAS_DO_PROFESSOR.turmas)
  })

  it('vazio: a Adaptação sem atividade gerada diz o que fazer, e o botão leva à Atividade objetiva', async () => {
    const rede = redeFalsa()
    instalar(rede, { artefatos: { status: 200, corpo: { itens: [] } } })
    const localizacao = montar('adaptacao', { comIcone: true })
    expect(await screen.findByText('Ainda não há atividade para adaptar')).toBeTruthy()
    expect(iconesDe(document.body)).toHaveLength(0)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Gerar uma atividade' }))
    expect(localizacao.history.at(-1)).toBe('/ferramentas/atividade_objetiva')
  })

  it('função suspensa pela escola: o aviso que explica, sem formulário e sem ícone', async () => {
    const rede = redeFalsa()
    instalar(rede, { time: timeSem('conversa_e_ferramentas') })
    montar('atividade_objetiva', { comIcone: true, iniciais: INICIAIS })
    await waitFor(() => expect(document.querySelector('[data-funcao-suspensa="conversa_e_ferramentas"]')).not.toBeNull())
    expect(document.querySelector('[data-funcao-suspensa="conversa_e_ferramentas"]')?.textContent).toBe(TEXTO_DA_SUSPENSAO.conversa_e_ferramentas)
    expect(document.querySelector('[data-cartao-de-ferramenta]')).toBeNull()
    expect(iconesDe(document.body)).toHaveLength(0)
  })
})

describe('o ícone e o nome no cabeçalho do cartão da conversa', () => {
  it.each([
    ['atividade_objetiva', 'Atividade objetiva'],
    ['plano_de_aula', 'Plano de aula'],
    ['adaptacao', 'Adaptação'],
  ] as const)('%s: o título é o nome da ferramenta, com o ícone ilustrado dela de 32 px dentro dele, só para os olhos', async (ferramenta, nome) => {
    const rede = redeFalsa()
    instalar(rede)
    montar(ferramenta, { comIcone: true, ...(ferramenta === 'adaptacao' ? {} : { iniciais: INICIAIS }) })
    const titulo = await screen.findByRole('heading', { level: 2, name: nome })
    const icones = iconesDe(titulo)
    expect(icones).toHaveLength(1)
    const icone = icones[0] as SVGElement
    expect(icone.getAttribute('data-icone-de-ferramenta')).toBe(ferramenta)
    expect(icone.getAttribute('width')).toBe('32')
    expect(icone.getAttribute('height')).toBe('32')
    expect(icone.getAttribute('aria-hidden')).toBe('true')
    // O nome está escrito uma vez só: o ícone não repete o nome para o leitor de tela.
    expect(titulo.textContent).toBe(nome)
    expect(screen.getAllByText(nome, { selector: 'h2' })).toHaveLength(1)
    // O ícone está no cartão da própria ferramenta, e em nenhum outro lugar da tela.
    expect(iconesDe(cartao(ferramenta))).toHaveLength(1)
    expect(iconesDe(document.body)).toHaveLength(1)
  })

  it('o formulário de Ferramentas, que não pede o ícone, fica sem ele: o nome já é o título da página', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar('atividade_objetiva', { iniciais: INICIAIS })
    const titulo = await screen.findByRole('heading', { level: 2, name: 'Atividade objetiva' })
    expect(iconesDe(titulo)).toHaveLength(0)
    expect(iconesDe(document.body)).toHaveLength(0)
  })

  it('gerando: o pedido recolhido continua com o ícone e o nome, e o resumo do que foi pedido', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar('atividade_objetiva', { comIcone: true, iniciais: INICIAIS })
    const usuario = userEvent.setup()
    await usuario.click(await screen.findByRole('button', { name: 'Gerar atividade' }))
    await waitFor(() => expect(document.querySelector('[data-motor="gerando"]')).not.toBeNull())
    const recolhido = document.querySelector('[data-motor="gerando"]') as HTMLElement
    const icones = iconesDe(recolhido)
    expect(icones).toHaveLength(1)
    expect((icones[0] as SVGElement).getAttribute('data-icone-de-ferramenta')).toBe('atividade_objetiva')
    expect(icones[0]?.getAttribute('width')).toBe('32')
    expect(within(recolhido).getByText('Atividade objetiva')).toBeTruthy()
    expect(recolhido.textContent).toContain('Estequiometria')
    // A geração saiu uma vez, para a ferramenta do cartão.
    expect(rede.chamadas.filter((chamada) => chamada.caminho === '/v1/ferramentas/atividade_objetiva/gerar')).toHaveLength(1)
  })
})

describe('a Adaptação não tem onde receber texto (D35, D67)', () => {
  it('o cartão da Adaptação abre só com a atividade e os tipos de adaptação, sem campo de texto nem tema', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar('adaptacao', { comIcone: true })
    expect(await screen.findByRole('heading', { level: 2, name: 'Adaptação' })).toBeTruthy()
    expect(within(cartao('adaptacao')).queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryByLabelText('Tema')).toBeNull()
    // O que o cartão pede é o que a Adaptação precisa: a atividade de origem e os tipos de adaptação.
    expect(within(cartao('adaptacao')).getByLabelText(/Atividade/)).toBeTruthy()
    expect(within(cartao('adaptacao')).getAllByRole('checkbox').length).toBeGreaterThan(0)
  })
})
