// @vitest-environment jsdom
import { NOMES_DOS_AGENTES } from '@educa/shared'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { prepararTela, redeFalsa, renderizarTela, type RedeFalsa, type RespostaFalsa } from '../../../__fixtures__/render-screen'
import Agentes from './Agentes'
import { NOME_DA_AUTONOMIA } from './textos-da-governanca'

/**
 * "Como cada IA trabalha" (telas da coordenação, 11.0; RF19 e RF22): o seletor "Qual IA" no endereço, uma IA por vez, o que cada função faz
 * sozinha e o que espera aprovação (o texto é o da API), o selo de alto risco, a função suspensa e o foco depois de suspender e de retomar.
 * A rede é falsa; o cliente de consultas, o roteador e a tela são os de verdade. O servidor que grava a suspensão, o recomeço pela pessoa
 * seguinte, o clique duplo e o tamanho nas duas larguras são do e2e (`e2e/agentes.spec.ts`).
 */
prepararTela()

/** A largura da janela, para a consulta `(min-width: 768px)` que o miolo lê; o `jsdom` não tem `matchMedia`. */
function janelaDe(largura: number): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta === '(min-width: 768px)' ? largura >= 768 : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

beforeEach(() => {
  janelaDe(1366)
  // O `jsdom` não abre `<dialog>` como modal: o diálogo de confirmação só ganha o atributo `open`, e `close` avisa como o navegador.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

const FORA: RespostaFalsa = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }

type Chave = 'conversa_e_ferramentas' | 'correcao_de_objetiva' | 'adaptacao' | 'tutor_com_o_aluno' | 'sinais_para_o_professor' | 'resumo_e_alerta'
type Autonomia = 1 | 2 | 3 | 4

interface FuncaoFalsa {
  chave: Chave
  nome: string
  autonomia: Autonomia
  altoRisco: boolean
  fazSozinha: string
  esperaAprovacao: string
  suspensa: boolean
  suspensao: { suspensaEm: string; motivo: string | null } | null
}

/** Textos que o catálogo não tem: se a tela mostrar o de baixo, e não o da resposta, o caso fica vermelho. */
function funcao(chave: Chave, nome: string, autonomia: Autonomia, altoRisco = false): FuncaoFalsa {
  return {
    chave,
    nome,
    autonomia,
    altoRisco,
    fazSozinha: `Faz sozinha, nas palavras da API: ${nome}`,
    esperaAprovacao: `Espera aprovação, nas palavras da API: ${nome}`,
    suspensa: false,
    suspensao: null,
  }
}

const SUSPENSAO = { suspensaEm: '2026-10-05T13:00:00.000Z', motivo: 'revisao_pedagogica' }

/** As funções como a API as devolve: três agentes, na ordem do catálogo. A correção de objetiva é a de alto risco. */
function lista(ajuste: (funcoes: FuncaoFalsa[]) => FuncaoFalsa[] = (funcoes) => funcoes): RespostaFalsa {
  const todas = ajuste([
    funcao('conversa_e_ferramentas', 'Conversa e ferramentas', 1),
    funcao('correcao_de_objetiva', 'Correção de objetiva', 2, true),
    funcao('adaptacao', 'Adaptação', 3),
    funcao('tutor_com_o_aluno', 'Tutor com o aluno', 2),
    funcao('sinais_para_o_professor', 'Sinais para o professor', 2),
    funcao('resumo_e_alerta', 'Resumo e alerta', 2),
  ])
  const de = (chaves: readonly Chave[]) => todas.filter(({ chave }) => chaves.includes(chave))
  return {
    status: 200,
    corpo: {
      agentes: [
        { agente: 'assistente_de_ensino', nome: NOMES_DOS_AGENTES.assistente_de_ensino, funcoes: de(['conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao']) },
        { agente: 'tutor', nome: NOMES_DOS_AGENTES.tutor, funcoes: de(['tutor_com_o_aluno', 'sinais_para_o_professor']) },
        { agente: 'analista_de_desempenho_escolar', nome: NOMES_DOS_AGENTES.analista_de_desempenho_escolar, funcoes: de(['resumo_e_alerta']) },
      ],
    },
  }
}

const comSuspensa = (chave: Chave) => lista((funcoes) => funcoes.map((item) => (item.chave === chave ? { ...item, suspensa: true, suspensao: SUSPENSAO } : item)))

/** Monta a tela no endereço. Devolve a localização (o histórico) e o `unmount`: o caso que percorre as três IAs desmonta uma para montar a outra. */
function montar(endereco = '/agentes') {
  const [caminho = '/agentes', busca = ''] = endereco.split('?')
  const localizacao = memoryLocation({ path: caminho, searchPath: busca, record: true })
  const { unmount } = renderizarTela(
    <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
      <Agentes />
    </Router>,
  )
  return { localizacao, unmount }
}

const cartoes = () => [...document.querySelectorAll('[data-cartao-do-agente]')].map((cartao) => cartao.getAttribute('data-cartao-do-agente'))
const funcoesNaTela = () => [...document.querySelectorAll('[data-funcao]')].map((item) => item.getAttribute('data-funcao'))
const itemDa = (chave: Chave): HTMLElement => {
  const item = document.querySelector<HTMLElement>(`[data-funcao="${chave}"]`)
  if (item === null) throw new Error(`a função ${chave} não está na tela`)
  return item
}
const seletor = () => screen.getByRole('radiogroup', { name: 'Qual IA' })
const chamadasDe = (rede: RedeFalsa, metodo: string) => rede.chamadas.filter((chamada) => chamada.metodo === metodo).map((chamada) => chamada.caminho)

describe('Como cada IA trabalha: os estados da tela', () => {
  it('carregando: o seletor já está à mão, e nenhum cartão aparece até a leitura terminar', async () => {
    const rede = redeFalsa()
    const lida = rede.segurar()
    montar()
    expect(await screen.findByText('Carregando os agentes…')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Como cada IA trabalha' })).toBeTruthy()
    // A aba do navegador e a largura de página de leitura (880 px) são as da tela, também enquanto ela carrega.
    expect(document.title).toBe('Como cada IA trabalha · Turmma')
    expect(document.querySelector('[data-tela="leitura"]')).not.toBeNull()
    expect(within(seletor()).getAllByRole('radio').map((opcao) => opcao.textContent)).toEqual(Object.values(NOMES_DOS_AGENTES))
    expect(cartoes()).toEqual([])
    lida.liberar(lista())
    await waitFor(() => expect(cartoes()).toEqual(['assistente_de_ensino']))
    expect(screen.queryByText('Carregando os agentes…')).toBeNull()
  })

  it('erro: diz o que fazer, o seletor continua, e "Tentar de novo" lê outra vez', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let leituras = 0
    rede.responderPor('/v1/governanca/funcoes', () => (++leituras === 1 ? FORA : lista()))
    montar()
    await screen.findByRole('alert')
    expect(cartoes()).toEqual([])
    expect(seletor()).toBeTruthy()
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(cartoes()).toEqual(['assistente_de_ensino'])
  })

  it('com dado, para cada uma das três IAs: o cartão dela, com o nome de função como título, o selo "IA" e as funções dela — e o "nunca faz" igual', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/governanca/funcoes', lista())
    const esperado = [
      { endereco: '/agentes', agente: 'assistente_de_ensino', funcoes: ['conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao'] },
      { endereco: '/agentes?ia=tutor', agente: 'tutor', funcoes: ['tutor_com_o_aluno', 'sinais_para_o_professor'] },
      { endereco: '/agentes?ia=analista_de_desempenho_escolar', agente: 'analista_de_desempenho_escolar', funcoes: ['resumo_e_alerta'] },
    ] as const
    for (const { endereco, agente, funcoes } of esperado) {
      const { unmount } = montar(endereco)
      await screen.findByRole('region', { name: NOMES_DOS_AGENTES[agente] })
      expect(cartoes(), endereco).toEqual([agente])
      expect(funcoesNaTela(), endereco).toEqual(funcoes)
      const cartao = screen.getByRole('region', { name: NOMES_DOS_AGENTES[agente] })
      expect(within(cartao).getByRole('heading', { level: 2, name: NOMES_DOS_AGENTES[agente] })).toBeTruthy()
      expect(cartao.querySelectorAll('[data-selo-ia]'), endereco).toHaveLength(1)
      const nunca = screen.getByRole('region', { name: 'O que a IA nunca faz' })
      expect(nunca.textContent).toContain('redação e discursiva')
      unmount()
    }
  })
})

describe('Como cada IA trabalha: o seletor "Qual IA" e o endereço', () => {
  it('abre no Assistente de ensino; um valor que não é de nenhuma IA também abre nele', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/governanca/funcoes', lista())
    for (const endereco of ['/agentes', '/agentes?ia=qualquer-coisa', '/agentes?ia=TUTOR']) {
      const { unmount } = montar(endereco)
      await screen.findByRole('region', { name: 'Assistente de ensino' })
      expect(cartoes(), endereco).toEqual(['assistente_de_ensino'])
      expect(within(seletor()).getByRole('radio', { name: 'Assistente de ensino' }).getAttribute('aria-checked'), endereco).toBe('true')
      unmount()
    }
  })

  it('escolher uma IA põe `?ia=` no endereço, sem empilhar histórico, e troca o cartão; a leitura das funções é uma só', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor('/v1/governanca/funcoes', lista())
    const { localizacao } = montar()
    await screen.findByRole('region', { name: 'Assistente de ensino' })

    await usuario.click(within(seletor()).getByRole('radio', { name: 'Tutor' }))
    await screen.findByRole('region', { name: 'Tutor' })
    expect(cartoes()).toEqual(['tutor'])
    expect(localizacao.history?.at(-1)).toBe('/agentes?ia=tutor')
    expect(localizacao.history).toHaveLength(1)

    await usuario.click(within(seletor()).getByRole('radio', { name: 'Analista de desempenho escolar' }))
    await screen.findByRole('region', { name: 'Analista de desempenho escolar' })
    expect(cartoes()).toEqual(['analista_de_desempenho_escolar'])
    expect(localizacao.history?.at(-1)).toBe('/agentes?ia=analista_de_desempenho_escolar')

    await usuario.click(within(seletor()).getByRole('radio', { name: 'Assistente de ensino' }))
    await screen.findByRole('region', { name: 'Assistente de ensino' })
    expect(cartoes()).toEqual(['assistente_de_ensino'])
    expect(chamadasDe(rede, 'GET')).toEqual(['/v1/governanca/funcoes'])
  })

  it('escolher a IA guarda os outros parâmetros do endereço', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor('/v1/governanca/funcoes', lista())
    const { localizacao } = montar('/agentes?estado=aprovada')
    await screen.findByRole('region', { name: 'Assistente de ensino' })
    await usuario.click(within(seletor()).getByRole('radio', { name: 'Tutor' }))
    await screen.findByRole('region', { name: 'Tutor' })
    expect(localizacao.history?.at(-1)).toBe('/agentes?estado=aprovada&ia=tutor')
  })

  it('com uma retomada no ar, trocar de IA não prende as retomadas seguintes, e a resposta que chega depois não anuncia na IA errada', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let liberar: (resposta: RespostaFalsa) => void = () => undefined
    const lenta = new Promise<RespostaFalsa>((resolver) => (liberar = resolver))
    rede.responderPor('/v1/governanca/funcoes/correcao_de_objetiva/retomar', () => lenta)
    rede.responderPor('/v1/governanca/funcoes/tutor_com_o_aluno/retomar', { status: 200, corpo: { ...funcao('tutor_com_o_aluno', 'Tutor com o aluno', 2), suspensao: null } })
    const suspensas = (chaves: readonly Chave[]) => lista((funcoes) => funcoes.map((item) => (chaves.includes(item.chave) ? { ...item, suspensa: true, suspensao: SUSPENSAO } : item)))
    // A 2ª leitura (a que a resposta da correção pede) é o sinal de que ela chegou: a correção já voltou, e o Tutor traz a mudança que se vê.
    let leituras = 0
    rede.responderPor('/v1/governanca/funcoes', () => {
      leituras += 1
      if (leituras === 1) return suspensas(['correcao_de_objetiva', 'tutor_com_o_aluno'])
      if (leituras === 2) return suspensas(['tutor_com_o_aluno', 'sinais_para_o_professor'])
      return suspensas(['sinais_para_o_professor'])
    })
    montar()
    await screen.findByRole('region', { name: 'Assistente de ensino' })

    await usuario.click(within(itemDa('correcao_de_objetiva')).getByRole('button', { name: 'Retomar esta função: Correção de objetiva' }))
    await usuario.click(within(seletor()).getByRole('radio', { name: 'Tutor' }))
    await screen.findByRole('region', { name: 'Tutor' })
    liberar({ status: 200, corpo: { ...funcao('correcao_de_objetiva', 'Correção de objetiva', 2, true), suspensao: null } })
    await within(itemDa('sinais_para_o_professor')).findByRole('button', { name: 'Retomar esta função: Sinais para o professor' })
    expect(screen.queryByText('A função "Correção de objetiva" voltou a funcionar nesta escola.')).toBeNull()

    await usuario.click(within(itemDa('tutor_com_o_aluno')).getByRole('button', { name: 'Retomar esta função: Tutor com o aluno' }))
    await screen.findByText('A função "Tutor com o aluno" voltou a funcionar nesta escola.')
    expect(chamadasDe(rede, 'POST')).toEqual(['/v1/governanca/funcoes/correcao_de_objetiva/retomar', '/v1/governanca/funcoes/tutor_com_o_aluno/retomar'])
  })

  it('trocar de IA, com a retomada já terminada, tira o aviso da que falhou e o anúncio da última ação, que eram de outra IA (a resposta ainda no ar é o caso de cima)', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor('/v1/governanca/funcoes/correcao_de_objetiva/retomar', FORA)
    rede.responderPor('/v1/governanca/funcoes/adaptacao/retomar', { status: 200, corpo: { ...funcao('adaptacao', 'Adaptação', 3), suspensao: null } })
    rede.responderPor('/v1/governanca/funcoes', lista((funcoes) => funcoes.map((item) => (item.chave === 'correcao_de_objetiva' || item.chave === 'adaptacao' ? { ...item, suspensa: true, suspensao: SUSPENSAO } : item))))
    montar()
    await screen.findByRole('region', { name: 'Assistente de ensino' })

    await usuario.click(within(itemDa('correcao_de_objetiva')).getByRole('button', { name: 'Retomar esta função: Correção de objetiva' }))
    await screen.findByRole('alert')
    await usuario.click(within(seletor()).getByRole('radio', { name: 'Tutor' }))
    await screen.findByRole('region', { name: 'Tutor' })
    expect(screen.queryByRole('alert')).toBeNull()

    await usuario.click(within(seletor()).getByRole('radio', { name: 'Assistente de ensino' }))
    await usuario.click(await within(await screen.findByRole('region', { name: 'Assistente de ensino' })).findByRole('button', { name: 'Retomar esta função: Adaptação' }))
    await screen.findByText('A função "Adaptação" voltou a funcionar nesta escola.')
    await usuario.click(within(seletor()).getByRole('radio', { name: 'Tutor' }))
    await screen.findByRole('region', { name: 'Tutor' })
    expect(screen.queryByText('A função "Adaptação" voltou a funcionar nesta escola.')).toBeNull()
  })

  it('o miolo que rola recebe foco a partir de 768 px, e abaixo disso a página é que rola', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/governanca/funcoes', lista())
    for (const [largura, foco] of [
      [1366, true],
      [360, false],
    ] as const) {
      janelaDe(largura)
      const { unmount } = montar('/agentes')
      const miolo = await screen.findByRole('region', { name: 'O que cada função da IA faz' })
      expect(miolo.getAttribute('tabindex'), `${String(largura)} px`).toBe(foco ? '0' : null)
      unmount()
    }
  })
})

describe('Como cada IA trabalha: o que cada função diz', () => {
  it('"faz sozinha" e "espera aprovação" são os da resposta, sem texto da tela no lugar, e nenhuma frase diz que o agente é uma pessoa', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/governanca/funcoes', lista())
    montar()
    const cartao = await screen.findByRole('region', { name: 'Assistente de ensino' })
    for (const chave of ['conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao'] as const) {
      const item = itemDa(chave)
      const nome = item.querySelector('h3')?.textContent ?? ''
      const campos = [...item.querySelectorAll('dd')].map((dd) => dd.textContent)
      expect(campos, chave).toEqual([`Faz sozinha, nas palavras da API: ${nome}`, `Espera aprovação, nas palavras da API: ${nome}`])
      expect([...item.querySelectorAll('dt')].map((dt) => dt.textContent), chave).toEqual(['Faz sozinha', 'Espera aprovação'])
    }
    // O agente se apresenta como função e como IA: nenhum texto do cartão fala em primeira pessoa nem se diz humano (D58; regra 70, item 4a).
    expect(cartao.textContent ?? '').not.toMatch(/(?<!\p{L})(eu|sou|meu|minha|nós|human[oa]s?|colegas?|amig[oa]s?)(?!\p{L})/iu)
  })

  it('cada função mostra a autonomia da API, e só a de alto risco mostra o selo "Alto risco"', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/governanca/funcoes', lista())
    montar()
    await screen.findByRole('region', { name: 'Assistente de ensino' })
    const esperado = [
      { chave: 'conversa_e_ferramentas', autonomia: 1, altoRisco: false },
      { chave: 'correcao_de_objetiva', autonomia: 2, altoRisco: true },
      { chave: 'adaptacao', autonomia: 3, altoRisco: false },
    ] as const
    for (const { chave, autonomia, altoRisco } of esperado) {
      const item = itemDa(chave)
      expect(within(item).getByText(NOME_DA_AUTONOMIA[autonomia]), chave).toBeTruthy()
      expect(within(item).queryByText(/Alto risco/) !== null, chave).toBe(altoRisco)
    }
  })

  it('a função suspensa diz desde quando e o motivo, e só oferece retomar; a que funciona só oferece suspender', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/governanca/funcoes', comSuspensa('correcao_de_objetiva'))
    montar()
    await screen.findByRole('region', { name: 'Assistente de ensino' })
    const suspensa = itemDa('correcao_de_objetiva')
    expect(within(suspensa).getByText(/^Suspensa nesta escola desde 05\/10\/2026/)).toBeTruthy()
    expect(within(suspensa).getByText('Motivo: A escola está revendo o uso pedagógico')).toBeTruthy()
    expect(within(suspensa).queryByText('Funcionando')).toBeNull()
    expect(within(suspensa).getByRole('button', { name: 'Retomar esta função: Correção de objetiva' })).toBeTruthy()
    expect(within(suspensa).queryByRole('button', { name: /^Suspender esta função/ })).toBeNull()

    const funcionando = itemDa('adaptacao')
    expect(within(funcionando).getByText('Funcionando')).toBeTruthy()
    expect(within(funcionando).queryByText(/Suspensa/)).toBeNull()
    expect(within(funcionando).getByRole('button', { name: 'Suspender esta função: Adaptação' })).toBeTruthy()
    expect(within(funcionando).queryByRole('button', { name: /^Retomar/ })).toBeNull()
  })
})

describe('Como cada IA trabalha: suspender e retomar', () => {
  it('suspender pede confirmação, grava o motivo escolhido, anuncia, e o foco vai ao botão "Retomar" da mesma função — e não ao body', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let suspensa = false
    rede.responderPor('/v1/governanca/funcoes/correcao_de_objetiva/suspender', () => {
      suspensa = true
      return { status: 200, corpo: { ...(comSuspensaCorpo('correcao_de_objetiva')) } }
    })
    rede.responderPor('/v1/governanca/funcoes', () => (suspensa ? comSuspensa('correcao_de_objetiva') : lista()))
    montar()
    await screen.findByRole('region', { name: 'Assistente de ensino' })
    await usuario.click(within(itemDa('correcao_de_objetiva')).getByRole('button', { name: 'Suspender esta função: Correção de objetiva' }))
    const confirmacao = await screen.findByRole('alertdialog')
    expect(within(confirmacao).getByRole('heading', { name: 'Suspender a função Correção de objetiva' })).toBeTruthy()
    // Cancelar não grava nada.
    await usuario.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(chamadasDe(rede, 'POST')).toEqual([])

    await usuario.click(within(itemDa('correcao_de_objetiva')).getByRole('button', { name: 'Suspender esta função: Correção de objetiva' }))
    const segunda = await screen.findByRole('alertdialog')
    await usuario.selectOptions(within(segunda).getByLabelText('Motivo'), 'revisao_pedagogica')
    await usuario.click(within(segunda).getByRole('button', { name: 'Suspender Correção de objetiva' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(chamadasDe(rede, 'POST')).toEqual(['/v1/governanca/funcoes/correcao_de_objetiva/suspender'])
    expect(screen.getByText('A função "Correção de objetiva" está suspensa nesta escola.')).toBeTruthy()
    const retomar = within(itemDa('correcao_de_objetiva')).getByRole('button', { name: 'Retomar esta função: Correção de objetiva' })
    await waitFor(() => expect(document.activeElement).toBe(retomar))
    // Só ela: a Adaptação, do mesmo agente, continua funcionando.
    expect(within(itemDa('adaptacao')).getByText('Funcionando')).toBeTruthy()
  })

  it('retomar anuncia, e o foco vai ao botão "Suspender" da mesma função — e não ao body', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let retomada = false
    rede.responderPor('/v1/governanca/funcoes/correcao_de_objetiva/retomar', () => {
      retomada = true
      return { status: 200, corpo: { ...funcao('correcao_de_objetiva', 'Correção de objetiva', 2, true), suspensao: null } }
    })
    rede.responderPor('/v1/governanca/funcoes', () => (retomada ? lista() : comSuspensa('correcao_de_objetiva')))
    montar()
    await screen.findByRole('region', { name: 'Assistente de ensino' })
    await usuario.click(within(itemDa('correcao_de_objetiva')).getByRole('button', { name: 'Retomar esta função: Correção de objetiva' }))
    const suspender = await within(itemDa('correcao_de_objetiva')).findByRole('button', { name: 'Suspender esta função: Correção de objetiva' })
    await waitFor(() => expect(document.activeElement).toBe(suspender))
    expect(chamadasDe(rede, 'POST')).toEqual(['/v1/governanca/funcoes/correcao_de_objetiva/retomar'])
    expect(screen.getByText('A função "Correção de objetiva" voltou a funcionar nesta escola.')).toBeTruthy()
    expect(within(itemDa('correcao_de_objetiva')).getByText('Funcionando')).toBeTruthy()
  })

  it('a função que já tinha sido retomada em outra aba: diz o que houve, e a lista é lida de novo', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let leituras = 0
    rede.responderPor('/v1/governanca/funcoes/correcao_de_objetiva/retomar', FORA)
    rede.responderPor('/v1/governanca/funcoes', () => (++leituras === 1 ? comSuspensa('correcao_de_objetiva') : lista()))
    montar()
    await screen.findByRole('region', { name: 'Assistente de ensino' })
    await usuario.click(within(itemDa('correcao_de_objetiva')).getByRole('button', { name: 'Retomar esta função: Correção de objetiva' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Esta função já não estava suspensa. A lista foi atualizada.')
    await within(itemDa('correcao_de_objetiva')).findByRole('button', { name: 'Suspender esta função: Correção de objetiva' })
    expect(leituras).toBe(2)
  })

  it('suspender: a falha fica no diálogo, que continua aberto; ao fechar e reabrir, o aviso da tentativa anterior não volta', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor('/v1/governanca/funcoes/adaptacao/suspender', { status: 503, corpo: { erro: { codigo: 'INDISPONIVEL', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
    rede.responderPor('/v1/governanca/funcoes', lista())
    montar()
    await screen.findByRole('region', { name: 'Assistente de ensino' })
    await usuario.click(within(itemDa('adaptacao')).getByRole('button', { name: 'Suspender esta função: Adaptação' }))
    const confirmacao = await screen.findByRole('alertdialog')
    await usuario.click(within(confirmacao).getByRole('button', { name: 'Suspender Adaptação' }))
    await waitFor(() => expect(within(confirmacao).getByRole('alert').textContent).not.toBe(''))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(within(itemDa('adaptacao')).getByText('Funcionando')).toBeTruthy()

    await usuario.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }))
    await usuario.click(within(itemDa('adaptacao')).getByRole('button', { name: 'Suspender esta função: Adaptação' }))
    const reaberto = await screen.findByRole('alertdialog')
    expect(within(reaberto).getByRole('alert').textContent).toBe('')
  })
})

/** O corpo que `POST …/suspender` devolve: a função como ficou, com a suspensão vigente. */
function comSuspensaCorpo(chave: Chave): FuncaoFalsa {
  const corpo = (comSuspensa(chave).corpo as { agentes: { funcoes: FuncaoFalsa[] }[] }).agentes.flatMap((agente) => agente.funcoes).find((item) => item.chave === chave)
  if (corpo === undefined) throw new Error(`a função ${chave} não está no catálogo do teste`)
  return corpo
}
