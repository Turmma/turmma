// @vitest-environment jsdom
import type { RedeDoPainel, UsoDaEscolaDoPainel, UsoDeIaDaEscolaDoPainel } from '@educa/shared'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OPERATOR_TEST_AUTHORIZATION,
  janelaDe,
  redeDoPainel,
  setupOperacaoScreen,
  fakeNetwork,
  renderOperacaoScreen,
  usoDaEscolaDoPainel,
  type FakeResponse,
} from '../__fixtures__/render-operacao-screen'
import { Uso } from './Uso'

/**
 * O uso por escola da operação (telas da coordenação, 14.0; RF21 e RF22): os quatro estados, o dia e o mês de referência
 * no cabeçalho, a tabela que vira lista de cartões abaixo de 768 px, e nenhum dado de pessoa. A rede é falsa e tudo o mais
 * é o código de verdade. O espaço de verdade, a cor e a rolagem são do e2e (`e2e/operacao-uso.spec.ts`).
 */
setupOperacaoScreen()

beforeEach(() => {
  janelaDe(1366)
  // O `jsdom` não implementa o `dialog` modal: o teste instala o `showModal` e o `close`.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})
afterEach(() => vi.restoreAllMocks())

const REFERENCIA = { dia: '2026-09-23', mes: '2026-09' }
const lista = (itens: readonly UsoDaEscolaDoPainel[], extra: { total?: number; pagina?: number } = {}): FakeResponse => ({
  status: 200,
  corpo: { itens, pagina: extra.pagina ?? 1, total: extra.total ?? itens.length, ...REFERENCIA },
})
const FALHA_503: FakeResponse = { status: 503, corpo: { erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }

describe('Uso: os estados da tela (RF22)', () => {
  it('carrega e mostra a tabela, pela sessão do operador', async () => {
    const rede = fakeNetwork()
    const solta = rede.segurar()
    renderOperacaoScreen(<Uso />)
    expect(await screen.findByText('Carregando o uso das escolas…')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    // O vazio só vem com a leitura terminada e sem erro (RF22).
    expect(screen.queryByText('Nenhuma escola criada ainda.')).toBeNull()

    solta.liberar(lista([usoDaEscolaDoPainel(1)]))
    expect(await screen.findByRole('table')).toBeTruthy()
    expect(screen.queryByText('Carregando o uso das escolas…')).toBeNull()
    expect(rede.chamadas.map(({ caminho, autorizacao }) => ({ caminho, autorizacao }))).toEqual([
      { caminho: '/v1/operacao/uso?pagina=1&ordem=nome', autorizacao: OPERATOR_TEST_AUTHORIZATION },
    ])
  })

  it('o 503 mostra a mensagem dentro da tela, que fica; "Tentar de novo" lê outra vez e some com o erro', async () => {
    const rede = fakeNetwork()
    // O 503 é repetido sozinho uma vez; só depois a tela mostra o erro.
    rede.responder(FALHA_503)
    rede.responder(FALHA_503)
    renderOperacaoScreen(<Uso />)
    expect((await screen.findByRole('alert', {}, { timeout: 4000 })).textContent).toBe('O Turmma está indisponível agora. Tente de novo em instantes.')
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText('Nenhuma escola criada ainda.')).toBeNull()

    rede.responder(lista([usoDaEscolaDoPainel(1)]))
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('table')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(rede.chamadas).toHaveLength(3)
  })

  it('sem escola nenhuma, o vazio convida a ir para Escolas, e o botão leva a /operacao', async () => {
    fakeNetwork().responder(lista([]))
    const tela = renderOperacaoScreen(<Uso />, { caminho: '/uso' })
    expect(await screen.findByText('Nenhuma escola criada ainda.')).toBeTruthy()
    expect(screen.getByText('O uso de cada escola aparece aqui assim que ela é criada.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Páginas do uso' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Ir para Escolas' }))
    expect(tela.navegou).toEqual(['/operacao'])
  })

  it('na troca de página, a anterior fica na tela, ocupada, em vez de piscar o vazio; ao chegar, a nova entra', async () => {
    const rede = fakeNetwork()
    rede.responder(lista([usoDaEscolaDoPainel(1)], { total: 30 }))
    const tela = renderOperacaoScreen(<Uso />, { caminho: '/uso' })
    await screen.findByRole('table')
    const regiao = screen.getByRole('region', { name: 'Uso por escola' })
    expect(regiao.getAttribute('aria-busy')).toBe('false')

    const segunda = rede.segurar()
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(tela.navegou).toEqual(['/operacao/uso?pagina=2&ordem=nome'])
    await waitFor(() => expect(regiao.getAttribute('aria-busy')).toBe('true'))
    expect(screen.getByText('Escola Sintética 1')).toBeTruthy()
    expect(screen.queryByText('Carregando o uso das escolas…')).toBeNull()

    await act(async () => segunda.liberar(lista([usoDaEscolaDoPainel(26)], { total: 30, pagina: 2 })))
    expect(await screen.findByText('Escola Sintética 26')).toBeTruthy()
    expect(regiao.getAttribute('aria-busy')).toBe('false')
  })
})

describe('Uso: a tabela e a lista de cartões (RF21)', () => {
  const ESCOLAS = [
    usoDaEscolaDoPainel(1),
    usoDaEscolaDoPainel(2, { dia: { requisicoes: 0, jobs: 0, bytesStorage: 0 }, mes: { requisicoes: 7, jobs: 1, bytesStorage: 1023 } }),
  ]

  it('no computador, o dia e o mês de referência estão no cabeçalho, e cada escola tem as seis medidas na ordem da tela', async () => {
    fakeNetwork().responder(lista(ESCOLAS))
    renderOperacaoScreen(<Uso />)
    const tabela = await screen.findByRole('table')
    const grupos = within(tabela)
      .getAllByRole('columnheader')
      .map((cabecalho) => cabecalho.textContent)
    expect(grupos.slice(0, 4)).toEqual(['Escola', 'Dia 23/09/2026', 'Mês: setembro de 2026, até 23/09', 'IA (hoje, até agora, e mês)'])
    expect(grupos.slice(4, 10)).toEqual(['Requisições', 'Tarefas em segundo plano', 'Armazenamento', 'Requisições', 'Tarefas em segundo plano', 'Armazenamento'])
    const linhas = within(tabela).getAllByRole('row').slice(2)
    // Só as seis medidas da infra: as da IA são do grupo seguinte, e têm os casos delas.
    expect(linhas.map((linha) => ({ nome: within(linha).getByRole('rowheader').textContent?.startsWith('Escola Sintética '), valores: within(linha).getAllByRole('cell').slice(0, 6).map((celula) => celula.textContent) }))).toEqual([
      { nome: true, valores: ['1.234', '12', '1,2 GB', '56.789', '345', '2 KB'] },
      { nome: true, valores: ['0', '0', '0 bytes', '7', '1', '1.023 bytes'] },
    ])
  })

  it('abaixo de 768 px, cada escola vira um cartão com o dia e o mês empilhados, e a tabela não existe', async () => {
    janelaDe(360)
    fakeNetwork().responder(lista(ESCOLAS))
    renderOperacaoScreen(<Uso />)
    const cartoes = await screen.findAllByRole('listitem')
    expect(screen.queryByRole('table')).toBeNull()
    expect(cartoes.map((cartao) => within(cartao).getByRole('heading', { level: 2 }).textContent)).toEqual(['Escola Sintética 1', 'Escola Sintética 2'])
    const primeiro = cartoes[0]
    if (primeiro === undefined) throw new Error('sem cartão')
    expect(within(primeiro).getAllByRole('heading', { level: 3 }).map((titulo) => titulo.textContent)).toEqual(['Dia 23/09/2026', 'Mês: setembro de 2026, até 23/09', 'IA (hoje, até agora, e mês)'])
    expect(
      within(primeiro)
        .getAllByRole('definition')
        .slice(0, 6)
        .map((valor) => valor.textContent),
    ).toEqual(['1.234', '12', '1,2 GB', '56.789', '345', '2 KB'])
  })

  it('a data de referência é a que a API devolveu, não a de hoje no navegador', async () => {
    fakeNetwork().responder({ status: 200, corpo: { itens: [usoDaEscolaDoPainel(1)], pagina: 1, total: 1, dia: '2031-02-28', mes: '2031-02' } })
    renderOperacaoScreen(<Uso />)
    await screen.findByRole('table')
    expect(screen.getByText('Último dia fechado:', { exact: false }).textContent).toContain('28/02/2031')
    expect(screen.getByRole('columnheader', { name: 'Dia 28/02/2031' })).toBeTruthy()
  })

  it('a tabela que passa da largura rola na própria moldura, que então recebe foco; a que cabe não vira parada no Tab', async () => {
    const largura = vi.spyOn(Element.prototype, 'scrollWidth', 'get')
    const janela = vi.spyOn(Element.prototype, 'clientWidth', 'get')
    fakeNetwork().responder(lista(ESCOLAS))
    largura.mockReturnValue(900)
    janela.mockReturnValue(700)
    renderOperacaoScreen(<Uso />)
    const moldura = await screen.findByRole('region', { name: 'Medidas de cada escola' })
    expect(moldura.getAttribute('tabindex')).toBe('0')
    expect(within(moldura).getByRole('table')).toBeTruthy()
  })

  it('a tabela que cabe não tem região nem foco', async () => {
    const largura = vi.spyOn(Element.prototype, 'scrollWidth', 'get')
    const janela = vi.spyOn(Element.prototype, 'clientWidth', 'get')
    fakeNetwork().responder(lista(ESCOLAS))
    largura.mockReturnValue(700)
    janela.mockReturnValue(700)
    renderOperacaoScreen(<Uso />)
    await screen.findByRole('table')
    expect(screen.queryByRole('region', { name: 'Medidas de cada escola' })).toBeNull()
  })
})

// A garantia de que o Uso não vê pessoa é o contrato estrito do `@educa/shared`: a resposta que traz a pessoa é recusada (o teste
// abaixo). Procurar `@` ou "matrícula" no texto da tela não provaria nada, porque os dados daqui não têm nenhum dos dois.
describe('Uso: nenhum dado de pessoa (D76)', () => {
  it('uma resposta que traz o nome de um aluno é recusada: a tela mostra o erro, e o nome não aparece', async () => {
    const comPessoa = { ...usoDaEscolaDoPainel(1), aluno: 'Joana Pereira' }
    fakeNetwork().responderPor('/v1/operacao/uso', { status: 200, corpo: { itens: [comPessoa], pagina: 1, total: 1, ...REFERENCIA } })
    renderOperacaoScreen(<Uso />)
    expect((await screen.findByRole('alert', {}, { timeout: 4000 })).textContent).toBe('Atualize a página: esta tela ficou desatualizada em relação ao Turmma.')
    expect(screen.queryByRole('table')).toBeNull()
    expect(document.body.textContent).not.toContain('Joana Pereira')
  })
})

/** O grupo de IA do item: o que a API devolveu, com o que o caso muda. Os reais saem em micros (R$ 1,00 = 1_000_000). */
function comIa(n: number, ia: Partial<UsoDeIaDaEscolaDoPainel>, extra: Partial<UsoDaEscolaDoPainel> = {}): UsoDaEscolaDoPainel {
  const base = usoDaEscolaDoPainel(n)
  return usoDaEscolaDoPainel(n, { ia: { ...base.ia, ...ia }, ...extra })
}

/** As nove medidas de IA da linha da tabela, depois das seis da infra, como estão escritas na tela (o botão leva o nome acessível dentro da célula, e por isso o texto vem sem ele). */
function celulasDeIa(linha: HTMLElement): string[] {
  return within(linha)
    .getAllByRole('cell')
    .slice(6)
    .map((celula) => celula.firstElementChild?.textContent ?? celula.textContent ?? '')
}

describe('Uso: o grupo "IA" (camada-ia, 8.0; RF11)', () => {
  it('o grupo "IA (hoje, até agora, e mês)" e a infra com "último dia fechado": a tela diz os dois períodos', async () => {
    fakeNetwork().responder(lista([usoDaEscolaDoPainel(1)]))
    renderOperacaoScreen(<Uso />)
    const tabela = await screen.findByRole('table')
    expect(within(tabela).getByRole('columnheader', { name: 'IA (hoje, até agora, e mês)' }).getAttribute('colspan')).toBe('9')
    expect(within(tabela).getByRole('columnheader', { name: 'Dia 23/09/2026' })).toBeTruthy()
    expect(screen.getByText('Último dia fechado:', { exact: false }).textContent).toContain('23/09/2026')
    expect(screen.getByText('A infra mostra o último dia fechado; a IA mostra hoje, até agora, e o mês corrente.')).toBeTruthy()
  })

  it('a linha traz chamadas, tokens e reais de hoje e do mês, o custo por aluno contra o valor, a porcentagem e as chamadas da reserva', async () => {
    const definida = comIa(1, {
      hoje: { execucoes: 3, chamadas: 4, tokens: 1_200_000, custoMicros: 2_500_000, chamadasPeloProvedorDeReserva: 0 },
      mes: { execucoes: 30, chamadas: 1234, tokens: 12_345_678, custoMicros: 31_000_000, chamadasPeloProvedorDeReserva: 3 },
      alunosAtivos: 100,
      valorPorAlunoMicros: 5_000_000,
      origemDoValor: 'escola',
      porcentagem: 62,
      situacao: 'definido',
    })
    fakeNetwork().responder(lista([definida]))
    renderOperacaoScreen(<Uso />)
    const tabela = await screen.findByRole('table')
    const linha = within(tabela).getAllByRole('row')[2]
    if (linha === undefined) throw new Error('sem linha')
    // R$ 31,00 sobre 100 alunos: R$ 0,31 de R$ 5,00; a porcentagem é a da API, e a tela não a calcula.
    expect(celulasDeIa(linha)).toEqual(['4', '1.200.000', 'R$ 2,50', '1.234', '12.345.678', 'R$ 31,00', 'R$ 0,31 de R$ 5,00', '62% do orçamento', '3'])
    expect(within(linha).queryByRole('button', { name: /Definir orçamento/ })).toBeNull()
  })

  it('nenhuma tela calcula porcentagem: a que a API devolveu é a que aparece, mesmo quando a conta da tela daria outra', async () => {
    // R$ 31,00 sobre 100 alunos a R$ 5,00 daria 6,2%: a tela mostra os 62 que a API mandou.
    fakeNetwork().responder(
      lista([comIa(1, { mes: { execucoes: 1, chamadas: 1, tokens: 1, custoMicros: 31_000_000, chamadasPeloProvedorDeReserva: 0 }, alunosAtivos: 100, valorPorAlunoMicros: 5_000_000, origemDoValor: 'rede', porcentagem: 77, situacao: 'definido' })]),
    )
    renderOperacaoScreen(<Uso />)
    expect(await screen.findByText('77% do orçamento')).toBeTruthy()
    expect(screen.queryByText('6,2% do orçamento')).toBeNull()
  })

  it('o valor sem aluno ativo não divide: "sem aluno ativo", sem porcentagem, e os reais seguem à vista', async () => {
    fakeNetwork().responder(lista([comIa(1, { alunosAtivos: 0, valorPorAlunoMicros: 5_000_000, origemDoValor: 'escola', porcentagem: null, situacao: 'sem_aluno_ativo' })]))
    renderOperacaoScreen(<Uso />)
    const tabela = await screen.findByRole('table')
    const linha = within(tabela).getAllByRole('row')[2]
    if (linha === undefined) throw new Error('sem linha')
    const celulas = celulasDeIa(linha)
    expect(celulas.slice(5)).toEqual(['R$ 20,00', 'sem aluno ativo', 'sem porcentagem', '1'])
    expect(within(linha).queryByRole('button', { name: /Definir orçamento/ })).toBeNull()
    expect(within(linha).queryByText(/%/)).toBeNull()
  })

  it('sem valor em nenhum lugar: "sem orçamento definido", com "Definir orçamento" na célula; o custo por aluno aparece sem o valor', async () => {
    fakeNetwork().responder(lista([usoDaEscolaDoPainel(1)]))
    renderOperacaoScreen(<Uso />)
    const tabela = await screen.findByRole('table')
    const linha = within(tabela).getAllByRole('row')[2]
    if (linha === undefined) throw new Error('sem linha')
    // R$ 20,00 do mês sobre 112 alunos: R$ 0,18, e não há valor para pôr ao lado.
    expect(celulasDeIa(linha).slice(6, 8)).toEqual(['R$ 0,18', 'sem orçamento definido'])
    const botao = within(linha).getByRole('button', { name: /^Definir orçamento\s*da escola Escola Sintética 1$/ })
    expect(botao.textContent).toContain('Definir orçamento')
  })

  it('no celular, o cartão diz as mesmas nove medidas sob o título do grupo, com "Ver meses" e "Definir orçamento"', async () => {
    janelaDe(360)
    fakeNetwork().responder(lista([usoDaEscolaDoPainel(1)]))
    renderOperacaoScreen(<Uso />)
    const cartao = (await screen.findAllByRole('listitem'))[0]
    if (cartao === undefined) throw new Error('sem cartão')
    expect(screen.queryByRole('table')).toBeNull()
    expect(within(cartao).getByRole('heading', { level: 3, name: 'IA (hoje, até agora, e mês)' })).toBeTruthy()
    const rotulos = within(cartao)
      .getAllByRole('term')
      .map((termo) => termo.textContent)
    expect(rotulos.slice(6)).toEqual([
      'Chamadas hoje',
      'Tokens hoje',
      'Reais hoje',
      'Chamadas no mês',
      'Tokens no mês',
      'Reais no mês',
      'Custo por aluno no mês, contra o valor',
      'Orçamento do mês',
      'Chamadas da reserva no mês',
    ])
    expect(within(cartao).getByText('sem orçamento definido')).toBeTruthy()
    expect(within(cartao).getByRole('button', { name: /^Definir orçamento\s*da escola Escola Sintética 1$/ })).toBeTruthy()
    expect(within(cartao).getByRole('button', { name: /^Ver meses\s*de IA da escola Escola Sintética 1$/ })).toBeTruthy()
  })
})

describe('Uso: a ordem por custo (camada-ia, 8.0)', () => {
  it('a barra oferece nome, mais uso e mais custo de IA, com a escolhida marcada; a escolha vai ao endereço e volta à primeira página', async () => {
    fakeNetwork().responder(lista([usoDaEscolaDoPainel(1)], { total: 30, pagina: 2 }))
    const tela = renderOperacaoScreen(<Uso />, { caminho: '/uso', busca: 'pagina=2' })
    await screen.findByRole('table')
    const grupo = screen.getByRole('group', { name: 'Ordenar as escolas por' })
    expect(within(grupo).getAllByRole('button').map((botao) => botao.textContent)).toEqual(['Nome', 'Mais uso no mês', 'Mais custo de IA no mês'])
    expect(within(grupo).getByRole('button', { name: 'Nome' }).getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(within(grupo).getByRole('button', { name: 'Mais custo de IA no mês' }))
    expect(tela.navegou).toEqual(['/operacao/uso?pagina=1&ordem=custo'])
  })

  it('`?ordem=custo` no endereço pede `ordem=custo` à API e marca o botão', async () => {
    const rede = fakeNetwork()
    rede.responder(lista([usoDaEscolaDoPainel(1)]))
    renderOperacaoScreen(<Uso />, { caminho: '/uso', busca: 'ordem=custo' })
    await screen.findByRole('table')
    expect(rede.chamadas.map(({ caminho }) => caminho)).toEqual(['/v1/operacao/uso?pagina=1&ordem=custo'])
    expect(screen.getByRole('button', { name: 'Mais custo de IA no mês' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Nome' }).getAttribute('aria-pressed')).toBe('false')
  })
})

describe('Uso: "Definir orçamento" abre o diálogo da escola da linha (camada-ia, 8.0)', () => {
  const REDE: RedeDoPainel = redeDoPainel()

  it('o diálogo abre com a escola da linha, a rede e o orçamento que o item trouxe, sem outra leitura de escola; salvar anuncia, e o foco volta à linha', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/operacao/uso', lista([usoDaEscolaDoPainel(1), comIa(2, { porcentagem: 10, situacao: 'definido', valorPorAlunoMicros: 5_000_000, origemDoValor: 'rede' })]))
    rede.responderPor('/v1/operacao/redes', { status: 200, corpo: { itens: [REDE] } })
    rede.responderPor(/\/orcamento-ia$/, {
      status: 200,
      corpo: {
        proprio: { valorPorAlunoMicros: 4_000_000, tetoDeSegurancaPercentual: null },
        vigente: { valorPorAlunoMicros: 4_000_000, origemDoValor: 'escola', tetoDeSegurancaPercentual: 200, origemDoTeto: 'padrao' },
      },
    })
    renderOperacaoScreen(<Uso />)
    await screen.findByRole('table')
    // Só a escola sem orçamento tem a ação, e nada foi salvo ainda: a região do anúncio não tem parágrafo.
    expect(screen.getAllByRole('button', { name: /Definir orçamento/ })).toHaveLength(1)
    expect(screen.getAllByRole('status').flatMap((regiao) => [...regiao.querySelectorAll('p')])).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: /^Definir orçamento\s*da escola Escola Sintética 1$/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Orçamento de IA' })
    expect(within(dialogo).getByText('Escola Sintética 1')).toBeTruthy()
    // O que vale hoje é o do item (sem valor), e o diálogo leu só a lista de redes: a escola e a rede dela vieram da linha.
    expect(await within(dialogo).findByText('Vale hoje: sem valor por aluno.')).toBeTruthy()
    expect(rede.chamadas.map(({ caminho }) => caminho).filter((caminho) => caminho.startsWith('/v1/operacao/escolas'))).toEqual([])
    await userEvent.type(within(dialogo).getByLabelText('Valor por aluno por mês (R$)'), '4,00')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar orçamento' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(rede.chamadas.some(({ caminho, metodo }) => metodo === 'PUT' && caminho === '/v1/operacao/escolas/0197a1c0-0000-7000-8000-000000001001/orcamento-ia')).toBe(true)
    expect(screen.getAllByRole('status').map((regiao) => regiao.textContent)).toContain('Orçamento salvo.')
    // O Uso foi marcado para ler de novo: a primeira leitura mais a do salvar.
    await waitFor(() => expect(rede.chamadas.filter(({ caminho, metodo }) => metodo === 'GET' && caminho.startsWith('/v1/operacao/uso')).length).toBe(2))
  })

  it('o diálogo da escola usa a rede da linha, e não a primeira da lista', async () => {
    const outraRede = redeDoPainel({ id: '0197a1c0-0000-7000-8000-000000002999', nome: 'Outra Rede', orcamento: { ...REDE.orcamento, proprio: { valorPorAlunoMicros: 9_000_000, tetoDeSegurancaPercentual: null } } })
    const rede = fakeNetwork()
    rede.responderPor('/v1/operacao/uso', lista([usoDaEscolaDoPainel(1)]))
    rede.responderPor('/v1/operacao/redes', { status: 200, corpo: { itens: [outraRede, REDE] } })
    renderOperacaoScreen(<Uso />)
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: /^Definir orçamento\s*da escola Escola Sintética 1$/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Orçamento de IA' })
    await within(dialogo).findByLabelText('Valor por aluno por mês (R$)')
    // A escola sem valor próprio abre com "Usar o valor da rede" marcada: o "Depois" é o da rede dela (R$ 5,00), e não o da outra (R$ 9,00).
    expect((within(dialogo).getByLabelText('Usar o valor da rede') as HTMLInputElement).checked).toBe(true)
    expect(within(dialogo).getByText(/Depois: R\$ 5,00 por aluno/)).toBeTruthy()
    expect(within(dialogo).queryByText(/R\$ 9,00/)).toBeNull()
  })
})

describe('Uso: o foco depois de salvar o orçamento (camada-ia, 8.0)', () => {
  /** A rede responde `antes` até o `PUT` do orçamento e `depois` desde então: o Uso lido outra vez já traz o valor salvo. */
  function responderComOrcamentoSalvo(antes: UsoDaEscolaDoPainel[], depois: UsoDaEscolaDoPainel[]) {
    const rede = fakeNetwork()
    let salvo = false
    rede.responderPor('/v1/operacao/uso', () => lista(salvo ? depois : antes))
    rede.responderPor('/v1/operacao/redes', { status: 200, corpo: { itens: [redeDoPainel()] } })
    rede.responderPor(/\/orcamento-ia$/, () => {
      salvo = true
      return {
        status: 200,
        corpo: {
          proprio: { valorPorAlunoMicros: 4_000_000, tetoDeSegurancaPercentual: null },
          vigente: { valorPorAlunoMicros: 4_000_000, origemDoValor: 'escola', tetoDeSegurancaPercentual: 200, origemDoTeto: 'padrao' },
        },
      }
    })
    return rede
  }
  async function salvarOOrcamentoDaPrimeira() {
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: /^Definir orçamento\s*da escola Escola Sintética 1$/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Orçamento de IA' })
    await userEvent.type(await within(dialogo).findByLabelText('Valor por aluno por mês (R$)'), '4,00')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar orçamento' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  }

  it('o botão "Definir orçamento" sai da linha com o valor salvo, e o foco vai para o "Ver meses" da mesma escola', async () => {
    const comValor = comIa(1, { porcentagem: 0, situacao: 'definido', valorPorAlunoMicros: 4_000_000, origemDoValor: 'escola' })
    responderComOrcamentoSalvo([usoDaEscolaDoPainel(1)], [comValor])
    renderOperacaoScreen(<Uso />)
    await salvarOOrcamentoDaPrimeira()
    await waitFor(() => expect(screen.queryByRole('button', { name: /Definir orçamento/ })).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Ver meses\s*de IA da escola Escola Sintética 1$/ })))
  })

  it('a escola que saiu da página com o salvar: o foco vai para o anúncio "Orçamento salvo.", e não se perde no corpo', async () => {
    responderComOrcamentoSalvo([usoDaEscolaDoPainel(1)], [usoDaEscolaDoPainel(2)])
    renderOperacaoScreen(<Uso />)
    await salvarOOrcamentoDaPrimeira()
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Ver meses\s*de IA da escola Escola Sintética 1$/ })).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Orçamento salvo.').parentElement))
  })
})

describe('Uso: "Ver meses" (camada-ia, 8.0)', () => {
  it('abre os 12 meses da escola da linha, lê só a rota dela, e "Fechar" devolve o foco ao botão', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/operacao/uso', lista([usoDaEscolaDoPainel(1), usoDaEscolaDoPainel(2)]))
    rede.responderPor('/v1/operacao/escolas/0197a1c0-0000-7000-8000-000000001002/uso-ia', {
      status: 200,
      corpo: { meses: Array.from({ length: 12 }, (_, posicao) => mesDeIa(posicao)) },
    })
    renderOperacaoScreen(<Uso />)
    await screen.findByRole('table')
    const botao = screen.getByRole('button', { name: /^Ver meses\s*de IA da escola Escola Sintética 2$/ })
    await userEvent.click(botao)
    const dialogo = await screen.findByRole('dialog', { name: 'Meses de IA' })
    expect(await within(dialogo).findAllByRole('listitem')).toHaveLength(12)
    expect(rede.chamadas.filter(({ caminho }) => caminho.includes('uso-ia')).map(({ caminho }) => caminho)).toEqual(['/v1/operacao/escolas/0197a1c0-0000-7000-8000-000000001002/uso-ia'])
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(botao)
  })
})

/** Um mês fechado com retrato, do mais recente (posição 0, setembro de 2026) ao mais antigo. */
function mesDeIa(posicao: number) {
  return {
    mes: new Date(Date.UTC(2026, 8 - posicao, 1)).toISOString().slice(0, 7),
    execucoes: 1,
    chamadas: 2,
    tokens: 300,
    custoMicros: 1_000_000,
    chamadasPeloProvedorDeReserva: 0,
    alunosAtivos: 10,
    valorPorAlunoMicros: 5_000_000,
    origemDoValor: 'escola',
    porcentagem: 2,
    situacao: 'definido',
  }
}

describe('Uso: a resposta que a web não reconhece (camada-ia, 8.0)', () => {
  it('a API nova com a web antiga: "Atualize a página", sem "Tentar de novo", que traria a mesma resposta', async () => {
    fakeNetwork().responderPor('/v1/operacao/uso', { status: 200, corpo: { itens: [{ ...usoDaEscolaDoPainel(1), rede: undefined, ia: 'novo' }], pagina: 1, total: 1, ...REFERENCIA } })
    renderOperacaoScreen(<Uso />)
    expect((await screen.findByRole('alert', {}, { timeout: 4000 })).textContent).toBe('Atualize a página: esta tela ficou desatualizada em relação ao Turmma.')
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
