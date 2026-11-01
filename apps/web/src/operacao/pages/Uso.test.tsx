// @vitest-environment jsdom
import type { UsoDaEscolaDoPainel } from '@educa/shared'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OPERATOR_TEST_AUTHORIZATION,
  janelaDe,
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

beforeEach(() => janelaDe(1366))
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
    expect(screen.queryByText('Nenhuma escola ainda.')).toBeNull()

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
    expect(screen.queryByText('Nenhuma escola ainda.')).toBeNull()

    rede.responder(lista([usoDaEscolaDoPainel(1)]))
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('table')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(rede.chamadas).toHaveLength(3)
  })

  it('sem escola nenhuma, o vazio convida a ir para Escolas, e o botão leva a /operacao', async () => {
    fakeNetwork().responder(lista([]))
    const tela = renderOperacaoScreen(<Uso />, { caminho: '/uso' })
    expect(await screen.findByText('Nenhuma escola ainda.')).toBeTruthy()
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
    expect(grupos).toEqual([
      'Escola',
      'Dia 23/09/2026',
      'Mês: setembro de 2026, até 23/09',
      'Requisições',
      'Tarefas em segundo plano',
      'Armazenamento',
      'Requisições',
      'Tarefas em segundo plano',
      'Armazenamento',
    ])
    const linhas = within(tabela).getAllByRole('row').slice(2)
    expect(linhas.map((linha) => ({ nome: within(linha).getByRole('rowheader').textContent, valores: within(linha).getAllByRole('cell').map((celula) => celula.textContent) }))).toEqual([
      { nome: 'Escola Sintética 1', valores: ['1.234', '12', '1,2 GB', '56.789', '345', '2 KB'] },
      { nome: 'Escola Sintética 2', valores: ['0', '0', '0 bytes', '7', '1', '1.023 bytes'] },
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
    expect(within(primeiro).getAllByRole('heading', { level: 3 }).map((titulo) => titulo.textContent)).toEqual(['Dia 23/09/2026', 'Mês: setembro de 2026, até 23/09'])
    expect(within(primeiro).getAllByRole('definition').map((valor) => valor.textContent)).toEqual(['1.234', '12', '1,2 GB', '56.789', '345', '2 KB'])
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
    await screen.findByRole('alert', {}, { timeout: 4000 })
    expect(screen.queryByRole('table')).toBeNull()
    expect(document.body.textContent).not.toContain('Joana Pereira')
  })
})
