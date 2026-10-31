// @vitest-environment jsdom
import { MENSAGENS_DE_ERRO, montarTime, type ChaveDeFuncao, type Ferramenta as NomeDeFerramenta } from '@educa/shared'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { prepararTela, redeFalsa, renderizarTela, type RedeFalsa, type RespostaFalsa } from '../../../__fixtures__/render-screen'
import { ROTAS_DO_PROFESSOR } from '../../../paths'
import Ferramenta from './Ferramenta'
import { TEXTO_DA_SUSPENSAO } from '../comum/avisos'
import { COMO_VAI_SAIR } from './ferramentas'
import { CICLO_DA_FERRAMENTA } from '../assistente/memoria-do-professor'

/**
 * O formulário de uma ferramenta, a página inteira (telas do professor, 8.0; RF11, RF21 e RF22): o motor de sempre e, ao
 * lado, **"Como vai sair"**, o texto fixo. O que este arquivo prova é o que a página acrescenta ao cartão: o texto fica à
 * vista em todos os estados, não muda ao preencher nem ao gerar, e vem depois do formulário. O motor, os campos e o pedido
 * são de `CartaoDeFerramenta.test.tsx`; as duas colunas a 1024 px e a uma a 360 px são do e2e (o `jsdom` não faz layout).
 */
prepararTela()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const QUIMICA = { id: id(500), nome: 'Química' }
const TURMA_A = { id: id(101), nome: '1º A' }
const VINCULO: RespostaFalsa = { status: 200, corpo: { itens: [{ id: id(401), turma: TURMA_A, disciplina: QUIMICA, estado: 'confirmado' }] } }
const SEM_VINCULO: RespostaFalsa = { status: 200, corpo: { itens: [] } }
const erro = (status: number, codigo: string): RespostaFalsa => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
const timeSem = (...suspensas: ChaveDeFuncao[]): RespostaFalsa => ({ status: 200, corpo: montarTime(new Set(suspensas)) })
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
  // A geração fica no ar, sem terminar: o teste olha a página enquanto ela acontece.
  rede.responderPor('/v1/ferramentas/atividade_objetiva/gerar', { status: 202, corpo: { execucaoId: id(950) } })
  rede.responderPor(/^\/v1\/execucoes\//, () => new Promise<RespostaFalsa>(() => undefined))
}

function montar(ferramenta: string) {
  const localizacao = memoryLocation({ path: `/ferramentas/${ferramenta}`, record: true })
  renderizarTela(
    <Router hook={localizacao.hook}>
      <Ferramenta ferramenta={ferramenta} />
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

const comoVaiSair = () => document.querySelector('[data-como-vai-sair]') as HTMLElement | null
/** O texto do bloco, linha por linha, como a professora o lê. */
const linhasDe = (bloco: HTMLElement) => within(bloco).getAllByRole('listitem').map((linha) => linha.textContent)

describe('"Como vai sair" ao lado do formulário', () => {
  it.each(['atividade_objetiva', 'plano_de_aula', 'adaptacao'] as const)('%s: com dado, o formulário e o texto fixo da ferramenta, com o título e as linhas de COMO_VAI_SAIR', async (ferramenta: NomeDeFerramenta) => {
    const rede = redeFalsa()
    instalar(rede)
    montar(ferramenta)
    await waitFor(() => expect(document.querySelector('[data-motor="formulario"]')).not.toBeNull())
    const bloco = comoVaiSair()
    expect(bloco).not.toBeNull()
    expect(bloco?.getAttribute('data-como-vai-sair')).toBe(ferramenta)
    // Uma região com nome, e o nome é o título dela: o leitor de tela a acha.
    const regiao = screen.getByRole('complementary', { name: 'Como vai sair' })
    expect(regiao).toBe(bloco)
    expect(within(regiao).getByRole('heading', { level: 2, name: 'Como vai sair' })).toBeTruthy()
    expect(linhasDe(regiao as HTMLElement)).toEqual([...COMO_VAI_SAIR[ferramenta]])
    // O título da ferramenta continua o único `h1`, e o do formulário, um `h2`.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('vem depois do formulário no documento: no celular, a coluna única põe "Como vai sair" embaixo', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar('atividade_objetiva')
    await waitFor(() => expect(document.querySelector('[data-motor="formulario"]')).not.toBeNull())
    const formulario = document.querySelector('[data-cartao-de-ferramenta]') as HTMLElement
    const bloco = comoVaiSair() as HTMLElement
    expect(formulario.compareDocumentPosition(bloco) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // E está na mesma grade do formulário, fora dele: o e2e mede as duas colunas.
    const grade = bloco.parentElement
    expect(grade?.contains(formulario)).toBe(true)
    expect(formulario.contains(bloco)).toBe(false)
  })

  it.each(['atividade_objetiva', 'plano_de_aula', 'adaptacao'] as const)('%s: a grade do formulário é o miolo que rola a partir de 768 px, com o título fora dela e a medida do topo gravada nela', async (ferramenta: NomeDeFerramenta) => {
    const rede = redeFalsa()
    instalar(rede)
    montar(ferramenta)
    await waitFor(() => expect(document.querySelector('[data-motor="formulario"]')).not.toBeNull())
    const miolo = document.querySelector('[data-miolo-da-ferramenta]') as HTMLElement
    expect(miolo).not.toBeNull()
    // O formulário e "Como vai sair" estão dentro; o título e o "Voltar", fora: ficam parados enquanto a grade rola.
    expect(miolo.contains(document.querySelector('[data-cartao-de-ferramenta]'))).toBe(true)
    expect(miolo.contains(comoVaiSair())).toBe(true)
    expect(miolo.contains(screen.getByRole('heading', { level: 1 }))).toBe(false)
    expect(miolo.contains(screen.getByRole('link', { name: 'Voltar para Ferramentas' }))).toBe(false)
    // Rola por dentro só a partir de 768 px, limitada pela janela menos o topo medido; abaixo disso a página rola inteira.
    expect(miolo.className).toContain('md:overflow-y-auto')
    expect(miolo.className).toContain('md:max-h-[calc(100dvh-var(--topo-do-painel,24.5rem)-2.5rem)]')
    expect(miolo.className).toContain('md:relative')
    // O respiro de baixo: sem ele a borda do cartão fica colada no corte do miolo.
    expect(miolo.className).toContain('md:pb-1')
    expect(miolo.className.split(/\s+/).filter((classe) => /overflow|max-h/.test(classe) && !classe.startsWith('md:'))).toEqual([])
    // O topo é medido no próprio miolo (o `jsdom` não tem layout, e a medida é 0), e a variável sai com a tela.
    expect(miolo.style.getPropertyValue('--topo-do-painel')).toBe('0px')
    cleanup()
    expect(miolo.style.getPropertyValue('--topo-do-painel')).toBe('')
  })

  it('o topo do miolo é medido de novo quando a janela muda e quando a tela por cima muda de altura, e nenhuma das duas medidas sobrevive à tela', async () => {
    const observados: Element[] = []
    let avisar: () => void = () => undefined
    let desligado = false
    // O `jsdom` não tem `ResizeObserver`: o teste põe o dele, que guarda o que foi observado e deixa chamar o aviso.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(aviso: () => void) {
          avisar = aviso
        }
        observe(no: Element): void {
          observados.push(no)
        }
        disconnect(): void {
          desligado = true
        }
      },
    )
    try {
      const rede = redeFalsa()
      instalar(rede)
      montar('adaptacao')
      await waitFor(() => expect(document.querySelector('[data-motor="formulario"]')).not.toBeNull())
      const miolo = document.querySelector('[data-miolo-da-ferramenta]') as HTMLElement
      let topo = 120
      miolo.getBoundingClientRect = () => ({ top: topo }) as DOMRect
      // A janela muda de tamanho: o título pode quebrar, e o miolo começa em outro ponto.
      window.dispatchEvent(new Event('resize'))
      expect(miolo.style.getPropertyValue('--topo-do-painel')).toBe('120px')
      // A tela por cima muda de altura (a descrição, o aviso): quem avisa é o observador da tela, e não a janela.
      expect(observados).toEqual([document.querySelector('[data-tela]')])
      topo = 200
      avisar()
      expect(miolo.style.getPropertyValue('--topo-do-painel')).toBe('200px')
      // Ao sair, o observador se desliga e a janela deixa de ser ouvida: a variável não volta.
      cleanup()
      expect(desligado).toBe(true)
      topo = 300
      window.dispatchEvent(new Event('resize'))
      expect(miolo.style.getPropertyValue('--topo-do-painel')).toBe('')
    } finally {
      Reflect.deleteProperty(globalThis, 'ResizeObserver')
    }
  })

  it('sem prévia: o texto é o mesmo antes de preencher, ao preencher e enquanto gera', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar('atividade_objetiva')
    const usuario = userEvent.setup()
    await waitFor(() => expect(document.querySelector('[data-motor="formulario"]')).not.toBeNull())
    const antes = linhasDe(comoVaiSair() as HTMLElement)
    expect(antes).toEqual([...COMO_VAI_SAIR.atividade_objetiva])

    await usuario.type(screen.getByLabelText(/^Tema/), 'Reagente limitante')
    expect(linhasDe(comoVaiSair() as HTMLElement)).toEqual(antes)

    await usuario.click(screen.getByRole('button', { name: 'Gerar atividade' }))
    await waitFor(() => expect(document.querySelector('[data-motor="gerando"]')).not.toBeNull())
    // O pedido saiu uma vez, e o texto continua o mesmo: nada do que foi escrito entra nele.
    expect(rede.chamadas.filter((chamada) => chamada.caminho === '/v1/ferramentas/atividade_objetiva/gerar')).toHaveLength(1)
    expect(linhasDe(comoVaiSair() as HTMLElement)).toEqual(antes)
    expect(comoVaiSair()?.textContent).not.toContain('Reagente limitante')
  })
})

describe('os estados do formulário, com "Como vai sair" à vista', () => {
  it('carregando: o cartão diz que está carregando, e o texto já está na tela', async () => {
    const rede = redeFalsa()
    let liberar: (resposta: RespostaFalsa) => void = () => undefined
    instalar(rede, { vinculos: () => new Promise<RespostaFalsa>((resolver) => (liberar = resolver)) })
    montar('atividade_objetiva')
    expect(await screen.findByText('Carregando a ferramenta…')).toBeTruthy()
    expect(document.querySelector('[data-motor]')).toBeNull()
    expect(linhasDe(comoVaiSair() as HTMLElement)).toEqual([...COMO_VAI_SAIR.atividade_objetiva])
    liberar(VINCULO)
    await waitFor(() => expect(document.querySelector('[data-motor="formulario"]')).not.toBeNull())
    expect(screen.queryByText('Carregando a ferramenta…')).toBeNull()
  })

  it('erro: a mensagem do catálogo, sem o código; "Tentar de novo" lê de novo; o texto fica na tela o tempo todo', async () => {
    const rede = redeFalsa()
    let leituras = 0
    instalar(rede, { vinculos: () => (++leituras === 1 ? erro(404, 'NAO_ENCONTRADO') : VINCULO) })
    montar('plano_de_aula')
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain(MENSAGENS_DE_ERRO.NAO_ENCONTRADO)
    expect(alerta.textContent).not.toContain('NAO_ENCONTRADO')
    expect(document.querySelector('[data-motor]')).toBeNull()
    expect(linhasDe(comoVaiSair() as HTMLElement)).toEqual([...COMO_VAI_SAIR.plano_de_aula])
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(document.querySelector('[data-motor="formulario"]')).not.toBeNull())
    expect(leituras).toBe(2)
    expect(linhasDe(comoVaiSair() as HTMLElement)).toEqual([...COMO_VAI_SAIR.plano_de_aula])
  })

  it('sem turma confirmada: diz o que falta, "Ir para Turmas" leva a Turmas, e o texto fica na tela', async () => {
    const rede = redeFalsa()
    instalar(rede, { vinculos: SEM_VINCULO })
    const localizacao = montar('atividade_objetiva')
    expect(await screen.findByText('Falta uma turma confirmada')).toBeTruthy()
    expect(document.querySelector('[data-motor]')).toBeNull()
    expect(linhasDe(comoVaiSair() as HTMLElement)).toEqual([...COMO_VAI_SAIR.atividade_objetiva])
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ir para Turmas' }))
    expect(localizacao.history.at(-1)).toBe(ROTAS_DO_PROFESSOR.turmas)
  })

  it('função suspensa: o aviso entra no lugar do formulário, sem alarme, e o texto da Adaptação continua à vista', async () => {
    const rede = redeFalsa()
    instalar(rede, { time: timeSem('adaptacao') })
    montar('adaptacao')
    await waitFor(() => expect(document.querySelector('[data-funcao-suspensa="adaptacao"]')).not.toBeNull())
    expect(document.querySelector('[data-funcao-suspensa="adaptacao"]')?.textContent).toBe(TEXTO_DA_SUSPENSAO.adaptacao)
    expect(document.querySelector('[data-motor]')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(linhasDe(comoVaiSair() as HTMLElement)).toEqual([...COMO_VAI_SAIR.adaptacao])
  })
})

describe('a Adaptação sem campo de texto (D35, D67)', () => {
  it('pede só a atividade, os tipos da lista fechada e o tempo extra; nenhum campo livre; o texto ao lado não fala de aluno', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar('adaptacao')
    await waitFor(() => expect(document.querySelector('[data-motor="formulario"]')).not.toBeNull())
    const formulario = document.querySelector('[data-motor="formulario"]') as HTMLElement
    expect(within(formulario).queryAllByRole('textbox')).toHaveLength(0)
    expect(formulario.querySelectorAll('textarea, input:not([type="checkbox"])')).toHaveLength(0)
    expect(within(formulario).getByLabelText(/Atividade de origem/)).toBeTruthy()
    expect(within(formulario).getAllByRole('checkbox').length).toBeGreaterThan(0)
    // O tempo extra só existe com "Tempo adicional" marcado.
    expect(within(formulario).queryByLabelText(/Tempo extra/)).toBeNull()
    await userEvent.setup().click(within(formulario).getByRole('checkbox', { name: 'Tempo adicional' }))
    expect(within(formulario).getByLabelText(/Tempo extra/)).toBeTruthy()
    // E o campo que apareceu também é lista fechada: continua sem campo de texto.
    expect(within(formulario).queryAllByRole('textbox')).toHaveLength(0)
    expect(formulario.querySelectorAll('textarea, input:not([type="checkbox"])')).toHaveLength(0)
    // Nada da página, ao lado ou no formulário, oferece escrever sobre o aluno.
    expect(within(comoVaiSair() as HTMLElement).queryByText(/alun/i)).toBeNull()
  })
})

describe('o endereço de uma ferramenta que não existe', () => {
  it('responde como página não encontrada, sem formulário nem "Como vai sair"', () => {
    const rede = redeFalsa()
    instalar(rede)
    montar('xyz')
    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeTruthy()
    expect(comoVaiSair()).toBeNull()
    expect(document.querySelector('[data-motor]')).toBeNull()
    expect(rede.chamadas).toEqual([])
  })
})
