// @vitest-environment jsdom
import { MENSAGENS_DE_ERRO, montarTime, type ChaveDeFuncao } from '@educa/shared'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { prepararTela, redeFalsa, renderizarTela, type RedeFalsa, type RespostaFalsa } from '../../../__fixtures__/render-screen'
import type { CicloDeExecucao } from '../../../api/ciclo-de-execucao'
import { ROTAS_DO_PROFESSOR } from '../../../paths'
import { TEXTO_DA_SUSPENSAO } from '../comum/avisos'
import Conversa from './Conversa'
import { ESCOLHAS_DAS_PROPOSTAS, CARTAO_DA_CONVERSA, CICLO_DA_CONVERSA, CICLO_DA_FERRAMENTA, CONTEXTO_ESCOLHIDO, type PedidoDaConversa } from './memoria-do-professor'

/**
 * A conversa com o Assistente (telas do professor, 4.0; RF8, RF9 e RF22): os estados, a pergunta da D18 com as duas
 * opções do mesmo peso, o cartão que só abre com o "sim", a Adaptação que não lê a caixa, a IA que assina cada resposta e
 * o foco que acompanha a professora. A rede é falsa; o cliente de consultas, a memória da aba, o roteador e a tela são os
 * de verdade. O tamanho nas duas larguras, a caixa a 24 px do pé, o recomeço pela pessoa seguinte e os eixos do axe são do
 * e2e (`e2e/professor-conversa.spec.ts`).
 */
prepararTela()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const QUIMICA = { id: id(500), nome: 'Química' }
const TURMA_A = { id: id(101), nome: '1º A' }
const VALOR_DA_TURMA_A = `${TURMA_A.id}:${QUIMICA.id}`
const vinculo = (n: number, estado = 'confirmado') => ({ id: id(400 + n), turma: TURMA_A, disciplina: QUIMICA, estado })
const UMA_TURMA: RespostaFalsa = { status: 200, corpo: { itens: [vinculo(1)] } }
const SEM_CONFIRMADA: RespostaFalsa = { status: 200, corpo: { itens: [vinculo(1, 'pendente')] } }
const erro = (status: number, codigo: string): RespostaFalsa => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
const NAO_ENCONTRADO = erro(404, 'NAO_ENCONTRADO')
const timeSem = (...suspensas: ChaveDeFuncao[]): RespostaFalsa => ({ status: 200, corpo: montarTime(new Set(suspensas)) })

const FRASE_DE_IA = 'O Assistente é uma IA e pode errar · Nada chega à turma sem você aprovar'
const PERGUNTA = 'Posso fazer isso com a ferramenta Atividade objetiva, ou só conversar.'
const PEDIDO_DELA = 'monta uma atividade de estequiometria, dez questões'

const dela = (n: number, texto: string) => ({ id: id(n), criadaEm: '2026-10-05T13:00:00.000Z', autor: 'usuario', tipo: 'texto', texto, turmaId: TURMA_A.id, disciplinaId: QUIMICA.id })
const doAgente = (n: number, texto: string) => ({ id: id(n), criadaEm: '2026-10-05T13:00:05.000Z', autor: 'agente', tipo: 'texto', texto, citacoes: [{ materialId: id(900), pagina: 142, trecho: 'Na combustão completa, cada mol de carbono forma um mol de dióxido de carbono.' }] })
const proposta = (n: number) => ({
  id: id(n),
  criadaEm: '2026-10-05T13:00:05.000Z',
  autor: 'agente',
  tipo: 'proposta_de_ferramenta',
  texto: PERGUNTA,
  proposta: { ferramenta: 'atividade_objetiva', parametros: { turmaId: TURMA_A.id, disciplinaId: QUIMICA.id, tema: 'Estequiometria', quantidade: 10 } },
})
const CONVERSA_COM_PERGUNTA = [dela(1, PEDIDO_DELA), proposta(2)]

/** Uma atividade objetiva já gerada: o que a Adaptação precisa ter para abrir o formulário. */
const ATIVIDADE = { id: id(700), tipo: 'atividade_objetiva', titulo: 'Atividade de estequiometria', turmaId: TURMA_A.id, disciplinaId: QUIMICA.id, origemId: null, adaptacao: null, entrega: null, criadoEm: '2026-10-05T13:00:00.000Z' }

interface Quem {
  readonly conversa?: RespostaFalsa | (() => RespostaFalsa | Promise<RespostaFalsa>)
  readonly vinculos?: RespostaFalsa
  readonly time?: RespostaFalsa
}

function instalar(rede: RedeFalsa, quem: Quem = {}): void {
  rede.responderPor('/v1/assistente/conversa', quem.conversa ?? { status: 200, corpo: { mensagens: [] } })
  rede.responderPor('/v1/meus-vinculos', quem.vinculos ?? UMA_TURMA)
  rede.responderPor('/v1/time', quem.time ?? timeSem())
  rede.responderPor('/v1/materiais', { status: 200, corpo: { itens: [] } })
  rede.responderPor('/v1/artefatos', { status: 200, corpo: { itens: [ATIVIDADE] } })
  // O pedido ao Assistente e a geração: a execução fica no ar, sem terminar.
  rede.responderPor('/v1/assistente/mensagens', { status: 202, corpo: { execucaoId: id(950) } })
  rede.responderPor('/v1/ferramentas/atividade_objetiva/gerar', { status: 202, corpo: { execucaoId: id(951) } })
  rede.responderPor(/^\/v1\/execucoes\//, () => new Promise<RespostaFalsa>(() => undefined))
}

const conversaCom = (mensagens: readonly unknown[]): RespostaFalsa => ({ status: 200, corpo: { mensagens } })

function montar() {
  const localizacao = memoryLocation({ path: ROTAS_DO_PROFESSOR.conversa, record: true })
  renderizarTela(
    <Router hook={localizacao.hook}>
      <Conversa />
    </Router>,
  )
  return localizacao
}

let scrollIntoViewOriginal: Element['scrollIntoView'] | undefined

beforeEach(() => {
  // O `jsdom` não tem `matchMedia`: a caixa de pedido lê o ponteiro (dedo ou teclado) para decidir o que o Enter faz.
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }))
  // A barra presa mede a si mesma para reservar o lugar do foco: o `jsdom` não tem `ResizeObserver`.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  // O `jsdom` não rola: a conversa vai ao fim com `scrollIntoView`. O original volta no `afterEach`.
  scrollIntoViewOriginal = Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = () => undefined
  CARTAO_DA_CONVERSA.guardar(undefined)
  CONTEXTO_ESCOLHIDO.guardar(undefined)
  CICLO_DA_CONVERSA.guardar(undefined)
  ESCOLHAS_DAS_PROPOSTAS.guardar(undefined)
  for (const lugar of Object.values(CICLO_DA_FERRAMENTA)) lugar.guardar(undefined)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  if (scrollIntoViewOriginal === undefined) delete (Element.prototype as Partial<Element>).scrollIntoView
  else Element.prototype.scrollIntoView = scrollIntoViewOriginal
})

const caixa = () => screen.findByRole('textbox', { name: 'Pedido ao Assistente de ensino' })
const conversa = () => screen.getByRole('log', { name: 'Conversa com o Assistente de ensino' })
const barra = () => screen.getByRole('group', { name: 'Novo pedido' })
const pergunta = () => screen.getByRole('group', { name: PERGUNTA })
const botoesDaPergunta = () => within(pergunta()).getAllByRole('button') as HTMLButtonElement[]
/** A frase de IA sob a caixa: um parágrafo só, com o trecho final em negrito, e por isso procurado pelo texto inteiro dele. */
const frasesDeIA = (dentro: HTMLElement = document.body) => within(dentro).queryAllByText((_texto, elemento) => elemento instanceof HTMLParagraphElement && elemento.textContent === FRASE_DE_IA)
const fraseDeIA = (dentro: HTMLElement = document.body) => within(dentro).getByText((_texto, elemento) => elemento instanceof HTMLParagraphElement && elemento.textContent === FRASE_DE_IA)
const cartoes = () => document.querySelectorAll('[data-cartao-de-ferramenta]')
const chamadasA = (rede: RedeFalsa, caminho: string) => rede.chamadas.filter((chamada) => chamada.caminho.split('?')[0] === caminho)

describe('os estados da conversa', () => {
  it('carregando: a conversa ainda não veio, e a tela diz que está carregando, sem o convite do vazio', async () => {
    const rede = redeFalsa()
    let liberar: (resposta: RespostaFalsa) => void = () => undefined
    instalar(rede, { conversa: () => new Promise<RespostaFalsa>((resolver) => (liberar = resolver)) })
    montar()
    expect(await screen.findByText('Carregando a conversa…')).toBeTruthy()
    expect(screen.queryByText('Nenhuma conversa ainda')).toBeNull()
    expect(screen.queryByRole('log')).toBeNull()
    liberar(conversaCom([dela(1, PEDIDO_DELA)]))
    expect(await within(await screen.findByRole('log', { name: 'Conversa com o Assistente de ensino' })).findByText(PEDIDO_DELA)).toBeTruthy()
    expect(screen.queryByText('Carregando a conversa…')).toBeNull()
  })

  it('erro: a mensagem do catálogo, sem o código, e "Tentar de novo" lê de novo e traz a conversa', async () => {
    const rede = redeFalsa()
    let leituras = 0
    instalar(rede, { conversa: () => (++leituras === 1 ? NAO_ENCONTRADO : conversaCom([dela(1, PEDIDO_DELA)])) })
    montar()
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain(MENSAGENS_DE_ERRO.NAO_ENCONTRADO)
    expect(alerta.textContent).not.toContain('NAO_ENCONTRADO')
    expect(screen.queryByRole('log')).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await within(await screen.findByRole('log', { name: 'Conversa com o Assistente de ensino' })).findByText(PEDIDO_DELA)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(leituras).toBe(2)
  })

  it('vazio: "Nenhuma conversa ainda" convida a pedir, e a caixa já está lá com a frase embaixo', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar()
    expect(await screen.findByText('Nenhuma conversa ainda')).toBeTruthy()
    expect(screen.queryByRole('log')).toBeNull()
    expect(await caixa()).toBeTruthy()
    expect(fraseDeIA(barra())).toBeTruthy()
  })

  it('sem turma confirmada: diz o que falta, sem caixa nem frase de IA, e "Ir para Turmas" leva a Turmas', async () => {
    const rede = redeFalsa()
    // A pendente não conta: a API a responderia como inexistente.
    instalar(rede, { vinculos: SEM_CONFIRMADA })
    const localizacao = montar()
    expect(await screen.findByText('Falta uma turma confirmada')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Novo pedido' })).toBeNull()
    expect(screen.queryByText(/O Assistente é uma IA e pode errar/)).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ir para Turmas' }))
    expect(localizacao.history.at(-1)).toBe(ROTAS_DO_PROFESSOR.turmas)
  })

  it('função suspensa pela escola: o aviso que explica, a caixa desligada e o menu "Ferramenta" desligado, sem pedido', async () => {
    const rede = redeFalsa()
    instalar(rede, { conversa: conversaCom(CONVERSA_COM_PERGUNTA), time: timeSem('conversa_e_ferramentas') })
    montar()
    const campo = (await caixa()) as HTMLTextAreaElement
    await waitFor(() => expect(document.querySelector('[data-funcao-suspensa="conversa_e_ferramentas"]')).not.toBeNull())
    expect(document.querySelector('[data-funcao-suspensa="conversa_e_ferramentas"]')?.textContent).toBe(TEXTO_DA_SUSPENSAO.conversa_e_ferramentas)
    expect(campo.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Ferramenta' }) as HTMLButtonElement).disabled).toBe(true)
    // A pergunta que ficou aberta também não aceita resposta: as duas opções desligam juntas.
    expect(botoesDaPergunta().map((botao) => botao.disabled)).toEqual([true, true])
    expect(screen.queryByRole('alert')).toBeNull()
    expect(fraseDeIA(barra())).toBeTruthy()
  })

  it('com dado: o `log` com o nome de sempre, as mensagens na ordem, a caixa presa embaixo com o menu "Ferramenta" e a frase de IA depois dela', async () => {
    const rede = redeFalsa()
    instalar(rede, { conversa: conversaCom([dela(1, 'o que é reagente limitante?'), doAgente(2, 'O reagente limitante é o que acaba primeiro.')]) })
    montar()
    const campo = await caixa()
    const falas = within(conversa()).getAllByRole('article')
    expect(falas.map((fala) => fala.textContent)).toEqual([expect.stringContaining('o que é reagente limitante?'), expect.stringContaining('O reagente limitante é o que acaba primeiro.')])
    // O título da tela é só para o leitor de tela: a conversa começa pelo que o Assistente diz.
    expect(screen.getByRole('heading', { level: 1, name: 'Conversa com o Assistente de ensino' }).className).toContain('sr-only')
    // A caixa, o menu e a turma estão na barra presa; a frase vem depois da caixa, dentro da mesma barra.
    expect(within(barra()).getByRole('button', { name: 'Ferramenta' })).toBeTruthy()
    expect(barra().contains(campo)).toBe(true)
    const frase = fraseDeIA(barra())
    expect(frase.textContent).toBe(FRASE_DE_IA)
    expect(campo.compareDocumentPosition(frase) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Sem link: o trecho em negrito é texto.
    expect(frase.querySelector('a, button')).toBeNull()
    // A frase não está no `log`: não é uma fala do Assistente.
    expect(conversa().contains(frase)).toBe(false)
    expect(frasesDeIA()).toHaveLength(1)
  })
})

describe('a pergunta da D18', () => {
  it('o pedido sem ferramenta recebe a pergunta com "Usar a ferramenta…" e "Só conversar" do mesmo desenho e do mesmo tamanho, e nenhuma vem escolhida', async () => {
    const rede = redeFalsa()
    instalar(rede, { conversa: conversaCom(CONVERSA_COM_PERGUNTA) })
    montar()
    await caixa()
    await waitFor(() => expect(document.querySelector('[data-escolha="aberta"]')).not.toBeNull())
    const [usar, soConversar] = botoesDaPergunta()
    expect(usar?.textContent).toContain('Usar a ferramenta Atividade objetiva')
    expect(soConversar?.textContent).toContain('Só conversar')
    // Mesmo desenho: a mesma classe, a mesma variante, e nenhuma com o estado de escolhida, de primária ou com o foco.
    expect(usar?.className).toBe(soConversar?.className)
    expect(usar?.getAttribute('aria-pressed')).toBe(soConversar?.getAttribute('aria-pressed'))
    expect(usar?.getAttribute('aria-pressed')).toBeNull()
    expect(botoesDaPergunta().map((botao) => botao === document.activeElement)).toEqual([false, false])
    expect(document.querySelector('[data-escolha="feita"]')).toBeNull()
    expect(ESCOLHAS_DAS_PROPOSTAS.ler()).toBeUndefined()
  })
})

describe('nenhum cartão sem o "sim"', () => {
  it('enquanto a pergunta está aberta, não há cartão de ferramenta, nem a caixa o abre sozinha', async () => {
    const rede = redeFalsa()
    instalar(rede, { conversa: conversaCom(CONVERSA_COM_PERGUNTA) })
    montar()
    await caixa()
    await waitFor(() => expect(document.querySelector('[data-escolha="aberta"]')).not.toBeNull())
    expect(cartoes()).toHaveLength(0)
    expect(CARTAO_DA_CONVERSA.ler()).toBeUndefined()
    // Escrever e enviar sem escolher ferramenta manda o pedido ao Assistente e não abre cartão nenhum.
    const usuario = userEvent.setup()
    await usuario.type(await caixa(), 'e uma de equilíbrio químico')
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(chamadasA(rede, '/v1/assistente/mensagens')).toHaveLength(1))
    expect(cartoes()).toHaveLength(0)
    expect(CARTAO_DA_CONVERSA.ler()).toBeUndefined()
  })

  it('"Só conversar" manda o pedido ao Assistente e não abre cartão', async () => {
    const rede = redeFalsa()
    instalar(rede, { conversa: conversaCom(CONVERSA_COM_PERGUNTA) })
    montar()
    await caixa()
    await waitFor(() => expect(document.querySelector('[data-escolha="aberta"]')).not.toBeNull())
    await userEvent.setup().click(within(pergunta()).getByRole('button', { name: /Só conversar/ }))
    await waitFor(() => expect(chamadasA(rede, '/v1/assistente/mensagens')).toHaveLength(1))
    expect(cartoes()).toHaveLength(0)
    expect(CARTAO_DA_CONVERSA.ler()).toBeUndefined()
    // A escolha ficou marcada na linha que encolheu, e a pergunta não volta.
    expect(ESCOLHAS_DAS_PROPOSTAS.ler()).toEqual({ [id(2)]: 'conversa' })
    expect(document.querySelector('[data-escolha="aberta"]')).toBeNull()
    expect(document.querySelector('[data-escolha="feita"]')?.textContent).toContain('Só conversar')
  })

  it('só "Usar a ferramenta" abre o cartão, com a turma e o que o Assistente entendeu do pedido', async () => {
    const rede = redeFalsa()
    instalar(rede, { conversa: conversaCom(CONVERSA_COM_PERGUNTA) })
    montar()
    await caixa()
    await waitFor(() => expect(document.querySelector('[data-escolha="aberta"]')).not.toBeNull())
    await userEvent.setup().click(within(pergunta()).getByRole('button', { name: /Usar a ferramenta Atividade objetiva/ }))
    await waitFor(() => expect(cartoes()).toHaveLength(1))
    expect(CARTAO_DA_CONVERSA.ler()).toEqual({ ferramenta: 'atividade_objetiva', iniciais: { turma: VALOR_DA_TURMA_A, tema: 'Estequiometria', quantidade: 10 } })
    // A escolha de "usar" não gasta um pedido ao Assistente.
    expect(chamadasA(rede, '/v1/assistente/mensagens')).toHaveLength(0)
    expect(((await screen.findByLabelText(/^Tema/)) as HTMLInputElement).value).toBe('Estequiometria')
  })
})

describe('a Adaptação', () => {
  it('o cartão da Adaptação abre pelo menu sem o texto da caixa (D35, D67): ele não chega ao cartão por caminho nenhum', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar()
    const usuario = userEvent.setup()
    await usuario.type(await caixa(), 'prova adaptada para um aluno com laudo')
    await usuario.click(within(barra()).getByRole('button', { name: 'Ferramenta' }))
    await usuario.click(await screen.findByRole('menuitemradio', { name: /Adaptação/ }))
    await waitFor(() => expect(cartoes()).toHaveLength(1))
    expect(CARTAO_DA_CONVERSA.ler()).toEqual({ ferramenta: 'adaptacao', iniciais: {} })
    const cartao = document.querySelector('[data-cartao-de-ferramenta="adaptacao"]') as HTMLElement
    expect(cartao.textContent).not.toContain('laudo')
    expect(within(cartao).queryAllByRole('textbox')).toHaveLength(0)
    expect(JSON.stringify(rede.chamadas)).not.toContain('laudo')
    expect(chamadasA(rede, '/v1/assistente/mensagens')).toHaveLength(0)
  })
})

describe('a IA se identifica', () => {
  it('cada resposta do Assistente tem o nome da função e o selo "IA" no mesmo bloco, a pergunta da D18 inclusive', async () => {
    const rede = redeFalsa()
    instalar(rede, { conversa: conversaCom([dela(1, 'o que é reagente limitante?'), doAgente(2, 'O reagente limitante é o que acaba primeiro.'), dela(3, PEDIDO_DELA), proposta(4)]) })
    montar()
    await caixa()
    await waitFor(() => expect(within(conversa()).getAllByRole('article')).toHaveLength(4))
    const falas = within(conversa()).getAllByRole('article')
    const doAssistente = falas.filter((fala) => fala.querySelector('[data-assinatura]') !== null)
    expect(doAssistente).toHaveLength(2)
    for (const fala of doAssistente) {
      const assinaturas = fala.querySelectorAll('[data-assinatura]')
      expect(assinaturas).toHaveLength(1)
      const assinatura = assinaturas[0] as HTMLElement
      expect(within(assinatura).getByText('Assistente de ensino')).toBeTruthy()
      expect(assinatura.querySelectorAll('[data-selo-ia]')).toHaveLength(1)
    }
    // A fala dela não tem assinatura: só a IA assina.
    expect(falas.filter((fala) => fala.querySelector('[data-assinatura]') === null)).toHaveLength(2)
  })

  it('o cartão da ferramenta tem o ícone ilustrado e o nome da ferramenta no cabeçalho, dentro de uma região com o nome dela', async () => {
    const rede = redeFalsa()
    instalar(rede)
    CARTAO_DA_CONVERSA.guardar({ ferramenta: 'plano_de_aula', iniciais: { turma: VALOR_DA_TURMA_A, tema: 'Estequiometria' } })
    montar()
    const regiao = await screen.findByRole('region', { name: 'Ferramenta Plano de aula' })
    const titulo = await within(regiao).findByRole('heading', { level: 2, name: 'Plano de aula' })
    const icone = titulo.querySelector('[data-icone-de-ferramenta="plano_de_aula"]')
    expect(icone).not.toBeNull()
    expect(icone?.getAttribute('width')).toBe('32')
    // O cartão está na conversa, e é o único cartão da tela.
    expect(conversa().contains(regiao)).toBe(true)
    expect(cartoes()).toHaveLength(1)
  })
})

describe('o foco acompanha a professora (regra 50, item 11)', () => {
  it('o cartão que abre recebe o foco, "Cancelar" o fecha e devolve o foco à caixa de pedido', async () => {
    const rede = redeFalsa()
    instalar(rede, { conversa: conversaCom(CONVERSA_COM_PERGUNTA) })
    montar()
    await caixa()
    await waitFor(() => expect(document.querySelector('[data-escolha="aberta"]')).not.toBeNull())
    const usuario = userEvent.setup()
    await usuario.click(within(pergunta()).getByRole('button', { name: /Usar a ferramenta Atividade objetiva/ }))
    const regiao = await screen.findByRole('region', { name: 'Ferramenta Atividade objetiva' })
    await waitFor(() => expect(document.activeElement).toBe(regiao))
    // Com o cartão aberto, a ação da tela é a dele: a caixa espera.
    expect(((await caixa()) as HTMLTextAreaElement).disabled).toBe(true)
    await usuario.click(within(regiao).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(cartoes()).toHaveLength(0))
    const campo = (await caixa()) as HTMLTextAreaElement
    expect(campo.disabled).toBe(false)
    await waitFor(() => expect(document.activeElement).toBe(campo))
  })

  it('quem chega à conversa com o pedido no ar continua na caixa, pronta para o pedido seguinte', async () => {
    const rede = redeFalsa()
    instalar(rede)
    const pedido: PedidoDaConversa = { texto: PEDIDO_DELA, turmaId: TURMA_A.id, disciplinaId: QUIMICA.id }
    const noAr: CicloDeExecucao<PedidoDaConversa> = { etapa: 'esperando', pedido, chaveEnvio: 'chave-1', desde: Date.now(), execucaoId: id(950) }
    CICLO_DA_CONVERSA.guardar(noAr)
    montar()
    const campo = await caixa()
    await waitFor(() => expect(document.activeElement).toBe(campo))
    // O pedido que saiu da Home aparece na hora, com o "pensando".
    expect(await within(conversa()).findByText(PEDIDO_DELA)).toBeTruthy()
    expect(conversa().querySelector('[data-pensando]')).not.toBeNull()
  })

  it('o pedido enviado da própria conversa deixa o foco na caixa, limpa e pronta', async () => {
    const rede = redeFalsa()
    instalar(rede)
    montar()
    const usuario = userEvent.setup()
    const campo = (await caixa()) as HTMLTextAreaElement
    await usuario.type(campo, 'o que é mol?')
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(chamadasA(rede, '/v1/assistente/mensagens')).toHaveLength(1))
    expect(campo.value).toBe('')
    await waitFor(() => expect(document.activeElement).toBe(campo))
  })
})
