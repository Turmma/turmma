// @vitest-environment jsdom
import { MENSAGENS_DE_ERRO, montarTime, type ChaveDeFuncao } from '@educa/shared'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import { PROFESSOR_ROUTES } from '../../../paths'
import { TEXTO_DA_SUSPENSAO } from '../comum/avisos'
import { CaixaDoAssistente } from '../assistente/CaixaDoAssistente'
import Home from './Home'
import { CARTAO_DA_CONVERSA, CICLO_DA_CONVERSA, CONTEXTO_ESCOLHIDO } from '../assistente/memoria-do-professor'
import type { TurmaDaProfessora } from '../comum/turmas-da-professora'

/**
 * O Início da professora (telas do professor, 3.0; RF7, RF8 e RF22): os quatro estados, a saudação pela hora, o Assistente
 * que se apresenta com a função e o selo "IA", os atalhos de ferramenta e o que a tela não lê mais (o que espera a
 * professora está no sino). A rede é falsa; o cliente de consultas, a memória da aba, o roteador e a tela são os de verdade.
 * O tamanho nas duas larguras, o recomeço pela pessoa seguinte e os eixos do axe são do e2e (`e2e/professor-inicio.spec.ts`).
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const QUIMICA = { id: id(500), nome: 'Química' }
const FISICA = { id: id(501), nome: 'Física' }
const TURMA_A = { id: id(101), nome: '1º A' }
const TURMA_B = { id: id(102), nome: '2º B' }
const VALOR_DA_TURMA_A = `${TURMA_A.id}:${QUIMICA.id}`
const VALOR_DA_TURMA_B = `${TURMA_B.id}:${FISICA.id}`

const vinculo = (n: number, turma: { id: string; nome: string }, disciplina: { id: string; nome: string }, estado = 'confirmado') => ({ id: id(400 + n), turma, disciplina, estado })
const DUAS_TURMAS: FakeResponse = { status: 200, corpo: { itens: [vinculo(1, TURMA_A, QUIMICA), vinculo(2, TURMA_B, FISICA)] } }
const UMA_TURMA: FakeResponse = { status: 200, corpo: { itens: [vinculo(1, TURMA_A, QUIMICA)] } }
const PROFESSORA: FakeResponse = {
  status: 200,
  corpo: { usuarioId: id(900), papel: 'professor', nome: 'Camila Souza', escola: { id: id(800), nome: 'Escola Sintética', slug: 'escola-sintetica' }, inatividadeMin: 30, introducaoVistaEm: '2026-02-01T10:00:00.000Z', acessos: [] },
}
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
const NAO_ENCONTRADO = erro(404, 'NAO_ENCONTRADO')
const timeSem = (...suspensas: ChaveDeFuncao[]): FakeResponse => ({ status: 200, corpo: montarTime(new Set(suspensas)) })

/** Uma entrega pendente de adaptação: o que o sino mostra e o Início não lê. */
const ENTREGA_PENDENTE = {
  id: id(600),
  tipo: 'versao_adaptada',
  funcao: 'adaptacao',
  estado: 'pendente',
  turmaId: TURMA_A.id,
  titulo: 'Atividade de estequiometria (versão adaptada)',
  artefatoId: id(700),
  atividadeAplicadaId: null,
  criadaEm: '2026-10-05T09:00:00.000Z',
  decididaEm: null,
  decididaPor: null,
  justificativa: null,
}

interface Quem {
  readonly vinculos?: FakeResponse | (() => FakeResponse | Promise<FakeResponse>)
  readonly time?: FakeResponse
}

function instalar(rede: FakeNetwork, quem: Quem = {}): void {
  rede.responderPor('/v1/eu', PROFESSORA)
  rede.responderPor('/v1/meus-vinculos', quem.vinculos ?? UMA_TURMA)
  rede.responderPor('/v1/time', quem.time ?? timeSem())
  // O que espera a professora é do sino. A resposta existe para o caso provar que a Home não a mostra, mesmo se a lesse.
  rede.responderPor('/v1/entregas', { status: 200, corpo: { itens: [ENTREGA_PENDENTE] } })
  // O pedido ao Assistente: a execução fica no ar, sem terminar.
  rede.responderPor('/v1/assistente/mensagens', { status: 202, corpo: { execucaoId: id(950) } })
  rede.responderPor(/^\/v1\/execucoes\//, () => new Promise<FakeResponse>(() => undefined))
}

function montar() {
  const localizacao = memoryLocation({ path: PROFESSOR_ROUTES.novaConversa, record: true })
  renderScreen(
    <Router hook={localizacao.hook}>
      <Home />
    </Router>,
  )
  return localizacao
}

beforeEach(() => {
  // O `jsdom` não tem `matchMedia`: a caixa de pedido lê o ponteiro (dedo ou teclado) para decidir o que o Enter faz.
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }))
  CARTAO_DA_CONVERSA.guardar(undefined)
  CONTEXTO_ESCOLHIDO.guardar(undefined)
  CICLO_DA_CONVERSA.guardar(undefined)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const caixa = () => screen.findByRole('textbox', { name: 'Pedido ao Assistente de ensino' })
const atalhos = () => screen.getByRole('group', { name: 'Atalhos de ferramenta' })
const botoesDosAtalhos = () => within(atalhos()).getAllByRole('button') as HTMLButtonElement[]
const atalho = (nome: string) => within(atalhos()).getByRole('button', { name: nome }) as HTMLButtonElement
const chamadasA = (rede: FakeNetwork, caminho: string) => rede.chamadas.filter((chamada) => chamada.caminho.split('?')[0] === caminho)

describe('os quatro estados do Início', () => {
  it('carregando: as turmas ainda não vieram, e a tela diz que está carregando, sem caixa nem atalho', async () => {
    const rede = fakeNetwork()
    let liberar: (resposta: FakeResponse) => void = () => undefined
    instalar(rede, { vinculos: () => new Promise<FakeResponse>((resolver) => (liberar = resolver)) })
    montar()
    expect(await screen.findByText('Carregando as suas turmas…')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Atalhos de ferramenta' })).toBeNull()
    liberar(UMA_TURMA)
    expect(await caixa()).toBeTruthy()
    expect(screen.queryByText('Carregando as suas turmas…')).toBeNull()
  })

  it('erro: a mensagem do catálogo e "Tentar de novo", que lê de novo e traz a caixa', async () => {
    const rede = fakeNetwork()
    let leituras = 0
    instalar(rede, { vinculos: () => (++leituras === 1 ? NAO_ENCONTRADO : UMA_TURMA) })
    montar()
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain(MENSAGENS_DE_ERRO.NAO_ENCONTRADO)
    expect(alerta.textContent).not.toContain('NAO_ENCONTRADO')
    expect(screen.queryByRole('textbox')).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await caixa()).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(leituras).toBe(2)
  })

  it('sem turma confirmada: diz o que falta, sem caixa nem atalho, e "Ir para Turmas" leva a Turmas', async () => {
    const rede = fakeNetwork()
    // Pendente e contestada não contam: a API responderia como inexistente.
    instalar(rede, { vinculos: { status: 200, corpo: { itens: [vinculo(1, TURMA_A, QUIMICA, 'pendente'), vinculo(2, TURMA_B, FISICA, 'contestado')] } } })
    const localizacao = montar()
    expect(await screen.findByText('Falta uma turma confirmada')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Atalhos de ferramenta' })).toBeNull()
    expect(screen.queryByText(/O Assistente é uma IA e pode errar/)).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ir para Turmas' }))
    expect(localizacao.history.at(-1)).toBe(PROFESSOR_ROUTES.turmas)
  })

  it('com dado: a caixa com a turma, os atalhos, o aviso de IA e o link para a conversa; o título da tela é só para o leitor de tela', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: DUAS_TURMAS })
    montar()
    expect(await caixa()).toBeTruthy()
    const turma = screen.getByLabelText('Turma e disciplina') as HTMLSelectElement
    expect(turma.value).toBe(VALOR_DA_TURMA_A)
    expect([...turma.options].map((opcao) => opcao.textContent)).toEqual(['1º A · Química', '2º B · Física'])
    expect(screen.getByText('O que vamos preparar hoje?')).toBeTruthy()
    const aviso = screen.getByText(/O Assistente é uma IA e pode errar/)
    expect(aviso.textContent).toBe('O Assistente é uma IA e pode errar · Nada chega à turma sem você aprovar')
    // Sem link no aviso: o trecho em negrito é texto (o mockup o liga a Configurações, que não é desta tela).
    expect(aviso.querySelector('a, button')).toBeNull()
    const conversa = screen.getByRole('link', { name: 'Abrir a conversa com o Assistente' })
    expect(conversa.getAttribute('href')).toBe(PROFESSOR_ROUTES.conversa)
    const titulo = screen.getByRole('heading', { level: 1, name: 'Início' })
    expect(titulo.className).toContain('sr-only')
    // O menu "Ferramenta" saiu da caixa: os atalhos tomaram o lugar dele.
    expect(screen.queryByRole('button', { name: 'Ferramenta' })).toBeNull()
  })
})

describe('a saudação e o Assistente que se apresenta', () => {
  it.each([
    [8, 'Bom dia, Camila.'],
    [14, 'Boa tarde, Camila.'],
    [20, 'Boa noite, Camila.'],
  ])('às %ih a saudação é "%s", com o primeiro nome e o ponto', async (hora, texto) => {
    // Só o relógio é falso, e num dia anterior ao de hoje: a sessão de teste vale 10 minutos a partir do relógio real, e um
    // dia depois dela a tela a veria vencida. Os temporizadores do cliente de consultas seguem reais.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 0, 5, hora, 0, 0))
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    expect(await screen.findByText(texto)).toBeTruthy()
  })

  it('o Assistente de ensino aparece com a onça, o nome da função e o selo "IA" num bloco só, e a saudação fica fora dele', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    const saudacao = await screen.findByText(/^(Bom dia|Boa tarde|Boa noite), Camila\.$/)
    const assinaturas = document.querySelectorAll('[data-assinatura]')
    expect(assinaturas).toHaveLength(1)
    const assinatura = assinaturas[0] as HTMLElement
    expect(within(assinatura).getByText('Assistente de ensino')).toBeTruthy()
    expect(assinatura.querySelectorAll('[data-selo-ia]')).toHaveLength(1)
    expect(assinatura.querySelector('[data-agente="assistente_de_ensino"]')).not.toBeNull()
    // A saudação é o texto de um elemento só dela: `esperarNovaConversa` (e2e) a lê por texto exato.
    expect(saudacao.closest('[data-assinatura]')).toBeNull()
    expect(assinatura.contains(saudacao)).toBe(false)
  })

  it('sem o nome ainda lido, a saudação é só o cumprimento', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    rede.responderPor('/v1/eu', NAO_ENCONTRADO)
    montar()
    expect(await screen.findByText(/^(Bom dia|Boa tarde|Boa noite)\.$/)).toBeTruthy()
  })
})

describe('os atalhos de ferramenta', () => {
  it('um por ferramenta que existe, na ordem do catálogo, cada um com o ícone ilustrado, mais o link "Ferramentas"', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await caixa()
    expect(botoesDosAtalhos().map((botao) => botao.textContent)).toEqual(['Plano de aula', 'Adaptação', 'Atividade objetiva'])
    expect(botoesDosAtalhos().map((botao) => botao.querySelector('[data-icone-de-ferramenta]')?.getAttribute('data-icone-de-ferramenta'))).toEqual(['plano_de_aula', 'adaptacao', 'atividade_objetiva'])
    for (const botao of botoesDosAtalhos()) {
      expect(botao.type).toBe('button')
      expect(botao.disabled).toBe(false)
    }
    const link = within(atalhos()).getByRole('link', { name: 'Ferramentas' })
    expect(link.getAttribute('href')).toBe(PROFESSOR_ROUTES.ferramentas)
  })

  it('a atividade e o plano abrem o cartão na conversa com a turma escolhida e, como tema, o que está na caixa', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: DUAS_TURMAS })
    const localizacao = montar()
    const usuario = userEvent.setup()
    await usuario.selectOptions(await screen.findByLabelText('Turma e disciplina'), VALOR_DA_TURMA_B)
    await usuario.type(await caixa(), 'Equilíbrio químico')
    await usuario.click(atalho('Atividade objetiva'))
    expect(CARTAO_DA_CONVERSA.ler()).toEqual({ ferramenta: 'atividade_objetiva', iniciais: { turma: VALOR_DA_TURMA_B, tema: 'Equilíbrio químico' } })
    expect(localizacao.history.at(-1)).toBe(PROFESSOR_ROUTES.conversa)

    await usuario.click(atalho('Plano de aula'))
    expect(CARTAO_DA_CONVERSA.ler()).toEqual({ ferramenta: 'plano_de_aula', iniciais: { turma: VALOR_DA_TURMA_B, tema: 'Equilíbrio químico' } })
    // Atalho é a escolha da ferramenta: nenhum pedido sai para o Assistente.
    expect(chamadasA(rede, '/v1/assistente/mensagens')).toHaveLength(0)
  })

  it('a caixa vazia abre o cartão só com a turma, sem tema', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await caixa()
    await userEvent.setup().click(atalho('Plano de aula'))
    expect(CARTAO_DA_CONVERSA.ler()).toEqual({ ferramenta: 'plano_de_aula', iniciais: { turma: VALOR_DA_TURMA_A } })
  })

  it('a Adaptação abre sem ler a caixa: o que foi escrito não chega a ela por caminho nenhum (D35)', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    const localizacao = montar()
    const usuario = userEvent.setup()
    await usuario.type(await caixa(), 'prova adaptada para um aluno com laudo')
    await usuario.click(atalho('Adaptação'))
    expect(CARTAO_DA_CONVERSA.ler()).toEqual({ ferramenta: 'adaptacao', iniciais: {} })
    expect(JSON.stringify(CARTAO_DA_CONVERSA.ler())).not.toContain('laudo')
    expect(localizacao.history.at(-1)).toBe(PROFESSOR_ROUTES.conversa)
    expect(chamadasA(rede, '/v1/assistente/mensagens')).toHaveLength(0)
  })

  it('o pedido escrito e enviado não abre cartão: vai ao Assistente, que pergunta antes (D18)', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: DUAS_TURMAS })
    const localizacao = montar()
    const usuario = userEvent.setup()
    await usuario.type(await caixa(), 'Faça uma atividade sobre equilíbrio químico')
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(chamadasA(rede, '/v1/assistente/mensagens')).toHaveLength(1))
    expect(CARTAO_DA_CONVERSA.ler()).toBeUndefined()
    expect(localizacao.history.at(-1)).toBe(PROFESSOR_ROUTES.conversa)
    expect(((await caixa()) as HTMLTextAreaElement).value).toBe('')
  })
})

describe('o que espera a professora não está no Início', () => {
  it('com entrega pendente, a tela não tem "Esperando você" nem lê a lista de entregas', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await caixa()
    expect(document.querySelector('[data-esperando-voce]')).toBeNull()
    expect(screen.queryByText(/Esperando você/)).toBeNull()
    expect(screen.queryByText(/Há mais entregas/)).toBeNull()
    expect(screen.queryByText(ENTREGA_PENDENTE.titulo)).toBeNull()
    // A entrega é do sino: a Home nem a pergunta à API.
    expect(chamadasA(rede, '/v1/entregas')).toHaveLength(0)
  })
})

describe('a função suspensa pela escola', () => {
  it('a conversa e as ferramentas suspensas: o aviso de hoje, a caixa e os três atalhos desligados, e o link de Ferramentas segue', async () => {
    const rede = fakeNetwork()
    instalar(rede, { time: timeSem('conversa_e_ferramentas') })
    montar()
    const campo = (await caixa()) as HTMLTextAreaElement
    await waitFor(() => expect(document.querySelector('[data-funcao-suspensa="conversa_e_ferramentas"]')).not.toBeNull())
    expect(document.querySelector('[data-funcao-suspensa="conversa_e_ferramentas"]')?.textContent).toBe(TEXTO_DA_SUSPENSAO.conversa_e_ferramentas)
    expect(campo.disabled).toBe(true)
    expect(botoesDosAtalhos().map((botao) => botao.disabled)).toEqual([true, true, true])
    expect(within(atalhos()).getByRole('link', { name: 'Ferramentas' })).toBeTruthy()
    expect(document.querySelector('[data-funcao-suspensa="adaptacao"]')).toBeNull()
  })

  it('a conversa e a Adaptação suspensas juntas: os dois avisos e os três atalhos desligados', async () => {
    const rede = fakeNetwork()
    instalar(rede, { time: timeSem('conversa_e_ferramentas', 'adaptacao') })
    montar()
    const campo = (await caixa()) as HTMLTextAreaElement
    await waitFor(() => expect(document.querySelector('[data-funcao-suspensa="adaptacao"]')).not.toBeNull())
    expect(document.querySelector('[data-funcao-suspensa="conversa_e_ferramentas"]')?.textContent).toBe(TEXTO_DA_SUSPENSAO.conversa_e_ferramentas)
    expect(document.querySelector('[data-funcao-suspensa="adaptacao"]')?.textContent).toBe(TEXTO_DA_SUSPENSAO.adaptacao)
    expect(campo.disabled).toBe(true)
    expect(botoesDosAtalhos().map((botao) => botao.disabled)).toEqual([true, true, true])
  })

  it('só a Adaptação suspensa: o atalho dela desliga e o aviso explica; a caixa e os outros atalhos seguem', async () => {
    const rede = fakeNetwork()
    instalar(rede, { time: timeSem('adaptacao') })
    montar()
    const campo = (await caixa()) as HTMLTextAreaElement
    await waitFor(() => expect(document.querySelector('[data-funcao-suspensa="adaptacao"]')).not.toBeNull())
    expect(document.querySelector('[data-funcao-suspensa="adaptacao"]')?.textContent).toBe(TEXTO_DA_SUSPENSAO.adaptacao)
    expect(document.querySelector('[data-funcao-suspensa="conversa_e_ferramentas"]')).toBeNull()
    expect(campo.disabled).toBe(false)
    expect(botoesDosAtalhos().map((botao) => [botao.textContent, botao.disabled])).toEqual([
      ['Plano de aula', false],
      ['Adaptação', true],
      ['Atividade objetiva', false],
    ])
    // O desligado não aciona: nada abre.
    await userEvent.setup().click(atalho('Adaptação'))
    expect(CARTAO_DA_CONVERSA.ler()).toBeUndefined()
  })
})

describe('a mesma caixa na conversa, sem `semMenu`', () => {
  it('mantém o menu "Ferramenta" à esquerda e não desenha atalho nenhum: os atalhos são do Início', () => {
    const turma: TurmaDaProfessora = { valor: VALOR_DA_TURMA_A, turmaId: TURMA_A.id, disciplinaId: QUIMICA.id, turmaNome: TURMA_A.nome, rotulo: '1º A · Química' }
    renderScreen(
      <Router hook={memoryLocation({ path: PROFESSOR_ROUTES.conversa }).hook}>
        <CaixaDoAssistente turmas={[turma]} turma={turma} iniciar={() => true} respondendo={false} desligada={false} />
      </Router>,
    )
    expect(screen.getByRole('button', { name: 'Ferramenta' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Atalhos de ferramenta' })).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Pedido ao Assistente de ensino' })).toBeTruthy()
  })
})
