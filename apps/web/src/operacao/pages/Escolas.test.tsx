// @vitest-environment jsdom
import { ESTADOS_DA_COORDENACAO, type EscolaDoPainel, type EstadoDaCoordenacao } from '@educa/shared'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { TEXTO_DO_ESTADO } from '../estados-da-escola'
import {
  AUTORIZACAO_DE_OPERADOR_DE_TESTE,
  CONVITE_DE_TESTE,
  escolaDoPainel,
  janelaDe,
  prepararTelaDaOperacao,
  redeFalsa,
  renderizarTelaDaOperacao,
  type RespostaFalsa,
} from '../__fixtures__/render-operacao-screen'
import { Escolas } from './Escolas'

/**
 * A lista de escolas da operação (telas da coordenação, 14.0; RF21 e RF22): os quatro estados, o estado da coordenação em
 * texto nos sete casos, e nenhum dado de pessoa. A rede é falsa e tudo o mais é o código de verdade. A medida e a cor de
 * verdade são do e2e (`e2e/operacao-escolas.spec.ts`).
 */
prepararTelaDaOperacao()

beforeEach(() => janelaDe(1366))

const lista = (itens: readonly EscolaDoPainel[], extra: { total?: number; pagina?: number } = {}): RespostaFalsa => ({
  status: 200,
  corpo: { itens, pagina: extra.pagina ?? 1, total: extra.total ?? itens.length },
})
const FALHA_503: RespostaFalsa = { status: 503, corpo: { erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }

/** A linha da tabela daquela escola, pelo cabeçalho de linha dela. */
function linhaDa(nome: string): HTMLElement {
  const linha = screen.getByRole('rowheader', { name: new RegExp(nome) }).closest('tr')
  if (linha === null) throw new Error(`sem linha para ${nome}`)
  return linha
}

describe('Escolas: os estados da tela (RF22)', () => {
  it('carrega, mostra a lista, e a página é a que a API deu, pela sessão do operador', async () => {
    const rede = redeFalsa()
    const solta = rede.segurar()
    renderizarTelaDaOperacao(<Escolas />)
    expect(await screen.findByText('Carregando as escolas…')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    // O vazio só vem com a leitura terminada e sem erro (RF22).
    expect(screen.queryByText('Nenhuma escola ainda.')).toBeNull()

    solta.liberar(lista([escolaDoPainel(1), escolaDoPainel(2)]))
    expect(await screen.findByRole('table')).toBeTruthy()
    expect(screen.queryByText('Carregando as escolas…')).toBeNull()
    expect(rede.chamadas.map(({ caminho, autorizacao }) => ({ caminho, autorizacao }))).toEqual([
      { caminho: '/v1/operacao/escolas?pagina=1&ordem=nome', autorizacao: AUTORIZACAO_DE_OPERADOR_DE_TESTE },
    ])
  })

  it('o 503 mostra a mensagem e a tela fica; "Tentar de novo" lê outra vez e some com o erro', async () => {
    const rede = redeFalsa()
    // O 503 é repetido sozinho uma vez (`deveTentarDeNovo`); só depois a tela mostra o erro.
    rede.responder(FALHA_503)
    rede.responder(FALHA_503)
    renderizarTelaDaOperacao(<Escolas />)
    expect((await screen.findByRole('alert', {}, { timeout: 4000 })).textContent).toBe('O Turmma está indisponível agora. Tente de novo em instantes.')
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText('Nenhuma escola ainda.')).toBeNull()
    expect(screen.getByRole('button', { name: 'Nova escola' })).toBeTruthy()

    rede.responder(lista([escolaDoPainel(1)]))
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('table')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(rede.chamadas).toHaveLength(3)
  })

  it('sem escola nenhuma, o vazio convida a criar a rede; não há tabela nem páginas', async () => {
    redeFalsa().responder(lista([]))
    renderizarTelaDaOperacao(<Escolas />)
    expect(await screen.findByText('Nenhuma escola ainda.')).toBeTruthy()
    expect(screen.getByText('Comece criando a rede.')).toBeTruthy()
    // Um só "Nova rede" (o do topo) e um só botão cheio: o vazio não repete o convite como um segundo primário.
    expect(screen.getAllByRole('button', { name: 'Nova rede' })).toHaveLength(1)
    const cheios = screen.getAllByRole('button').filter((botao) => botao.classList.contains('bg-laranja'))
    expect(cheios.map((botao) => botao.textContent)).toEqual(['Nova escola'])
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Páginas da lista' })).toBeNull()
  })

  it('a página além da última tem o vazio dela, com o caminho de volta à primeira', async () => {
    redeFalsa().responder(lista([], { total: 30, pagina: 9 }))
    const tela = renderizarTelaDaOperacao(<Escolas />, { busca: 'pagina=9&ordem=uso' })
    expect(await screen.findByText('Não há escolas nesta página.')).toBeTruthy()
    expect(screen.getByText('A lista tem 2 páginas.')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Ir para a primeira página' }))
    expect(tela.navegou).toEqual(['/operacao?pagina=1&ordem=uso'])
  })

  it('na troca de página, a anterior fica na tela, ocupada, em vez de piscar o vazio; ao chegar, a nova entra', async () => {
    const rede = redeFalsa()
    rede.responder(lista([escolaDoPainel(1)], { total: 30 }))
    const tela = renderizarTelaDaOperacao(<Escolas />)
    await screen.findByRole('table')
    const regiao = screen.getByRole('region', { name: 'Lista de escolas' })
    expect(regiao.getAttribute('aria-busy')).toBe('false')

    const segunda = rede.segurar()
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(tela.navegou).toEqual(['/operacao?pagina=2&ordem=nome'])
    await waitFor(() => expect(regiao.getAttribute('aria-busy')).toBe('true'))
    expect(screen.getByText('Escola Sintética 1')).toBeTruthy()
    expect(screen.queryByText('Carregando as escolas…')).toBeNull()
    expect((screen.getByRole('button', { name: 'Próxima' }) as HTMLButtonElement).disabled).toBe(true)

    await act(async () => segunda.liberar(lista([escolaDoPainel(26)], { total: 30, pagina: 2 })))
    expect(await screen.findByText('Escola Sintética 26')).toBeTruthy()
    expect(screen.queryByText('Escola Sintética 1')).toBeNull()
    expect(regiao.getAttribute('aria-busy')).toBe('false')
  })
})

type Acao = 'Convidar' | 'Refazer' | 'Revogar'
/** O que cada estado permite fazer na linha, escrito aqui por extenso (a matriz está em `acoes-do-convite.test.ts`). */
const ACOES_POR_ESTADO: Readonly<Record<EstadoDaCoordenacao, readonly Acao[]>> = {
  sem_convite: ['Convidar'],
  revogado: ['Convidar'],
  sem_coordenacao: ['Convidar'],
  aceito: ['Convidar', 'Revogar'],
  pendente: ['Refazer', 'Revogar'],
  vencido: ['Refazer', 'Revogar'],
  ativa: [],
}
const TODAS_AS_ACOES: readonly Acao[] = ['Convidar', 'Refazer', 'Revogar']
/** O resto do nome acessível de cada ação diz de que escola ela é (WCAG 2.5.3). O `jsdom` cola o rótulo ao resto sem o espaço que o navegador põe. */
const COMPLEMENTO: Readonly<Record<Acao, string>> = { Convidar: 'a coordenação de', Refazer: 'o convite de', Revogar: 'o convite de' }

/** A ação está na linha ou no cartão daquela escola? */
function temAcao(dentro: HTMLElement, acao: Acao, escola: EscolaDoPainel): boolean {
  return within(dentro).queryByRole('button', { name: new RegExp(`^${acao}\\s*${COMPLEMENTO[acao]} ${escola.nome}$`) }) !== null
}

const UMA_ESCOLA_POR_ESTADO = ESTADOS_DA_COORDENACAO.map((estado, posicao) => escolaDoPainel(posicao + 1, { estado, conviteId: CONVITE_DE_TESTE }))

describe('Escolas: o estado da coordenação em texto, nos sete estados (RF21)', () => {
  it('no computador, cada estado diz o texto dele, e só mostra a ação que ele permite', async () => {
    redeFalsa().responder(lista(UMA_ESCOLA_POR_ESTADO))
    renderizarTelaDaOperacao(<Escolas />)
    await screen.findByRole('table')

    for (const escola of UMA_ESCOLA_POR_ESTADO) {
      const linha = linhaDa(escola.nome)
      const estado = linha.querySelector('[data-estado]')
      expect(estado?.textContent, escola.estado).toBe(TEXTO_DO_ESTADO[escola.estado])
      // O identificador cru do contrato (`sem_convite`, `pendente`) nunca está na linha.
      expect(linha.textContent, escola.estado).not.toContain('_')
      for (const acao of TODAS_AS_ACOES) expect(temAcao(linha, acao, escola), `${escola.estado}: ${acao}`).toBe(ACOES_POR_ESTADO[escola.estado].includes(acao))
    }
  })

  it('no celular, a lista de cartões diz o mesmo texto e oferece as mesmas ações, sem tabela', async () => {
    janelaDe(360)
    redeFalsa().responder(lista(UMA_ESCOLA_POR_ESTADO))
    renderizarTelaDaOperacao(<Escolas />)
    const itens = await screen.findAllByRole('listitem')
    expect(screen.queryByRole('table')).toBeNull()
    expect(itens).toHaveLength(UMA_ESCOLA_POR_ESTADO.length)

    for (const escola of UMA_ESCOLA_POR_ESTADO) {
      const item = itens.find((candidato) => candidato.textContent.includes(escola.nome))
      if (item === undefined) throw new Error(`sem cartão para ${escola.nome}`)
      expect(item.querySelector('[data-estado]')?.textContent, escola.estado).toBe(TEXTO_DO_ESTADO[escola.estado])
      for (const acao of TODAS_AS_ACOES) expect(temAcao(item, acao, escola), `${escola.estado}: ${acao}`).toBe(ACOES_POR_ESTADO[escola.estado].includes(acao))
    }
  })

  it('o uso de cada escola é a contagem dela por extenso, e a escola sem turma diz "Sem turma ainda"', async () => {
    redeFalsa().responder(
      lista([
        escolaDoPainel(1, { turmas: 4, professores: 6, alunos: 112 }),
        escolaDoPainel(2, { turmas: 1, professores: 1, alunos: 1 }),
        escolaDoPainel(3, { turmas: 0, professores: 0, alunos: 0 }),
      ]),
    )
    renderizarTelaDaOperacao(<Escolas />)
    await screen.findByRole('table')
    expect(within(linhaDa('Escola Sintética 1')).getByText(/4 turmas/).closest('td')?.textContent).toBe('4 turmas · 6 professores · 112 alunos')
    expect(within(linhaDa('Escola Sintética 2')).getByText(/1 turma/).closest('td')?.textContent).toBe('1 turma · 1 professor · 1 aluno')
    const semTurma = within(linhaDa('Escola Sintética 3'))
    expect(semTurma.getByText('Sem turma ainda')).toBeTruthy()
    expect(semTurma.queryByText(/turmas|alunos/)).toBeNull()
  })
})

// A garantia de que a operação não vê pessoa é o contrato estrito do `@educa/shared` (o teste seguinte: a resposta que traz a
// pessoa é recusada). Procurar `@` ou "matrícula" no texto da tela não provaria nada: os dados daqui não têm nenhum dos dois.
describe('Escolas: nenhum dado de pessoa (D76)', () => {
  it('a tabela tem só escola, rede, coordenação (pelo estado) e uso: quatro colunas, nenhuma de pessoa', async () => {
    redeFalsa().responder(lista(UMA_ESCOLA_POR_ESTADO))
    renderizarTelaDaOperacao(<Escolas />)
    await screen.findByRole('table')
    const colunas = within(screen.getByRole('table'))
      .getAllByRole('columnheader')
      .map((coluna) => coluna.textContent)
    expect(colunas).toEqual(['Escola', 'Rede', 'Coordenação', 'Uso'])
  })

  it('uma resposta com o nome ou o e-mail da coordenação é recusada pelo contrato: a tela mostra o erro, e a pessoa não aparece', async () => {
    const comPessoa = { ...escolaDoPainel(1), coordenacao: { nome: 'Maria da Silva', email: 'maria@escola.example' } }
    redeFalsa().responderPor('/v1/operacao/escolas', { status: 200, corpo: { itens: [comPessoa], pagina: 1, total: 1 } })
    renderizarTelaDaOperacao(<Escolas />)
    await screen.findByRole('alert', {}, { timeout: 4000 })
    expect(screen.queryByRole('table')).toBeNull()
    expect(document.body.textContent).not.toContain('Maria da Silva')
    expect(document.body.textContent).not.toContain('maria@escola.example')
  })
})

describe('Escolas: as ações da página (RF21)', () => {
  it('"Nova escola" é o único botão cheio da tela; "Nova rede" e as ações da linha são secundários', async () => {
    redeFalsa().responder(lista(UMA_ESCOLA_POR_ESTADO))
    renderizarTelaDaOperacao(<Escolas />)
    await screen.findByRole('table')
    // A face laranja é só do `primario` (`button-variants.ts`): é o que o `Button` sem variante desenha.
    const cheios = screen.getAllByRole('button').filter((botao) => botao.classList.contains('bg-laranja'))
    expect(cheios.map((botao) => botao.textContent)).toEqual(['Nova escola'])
    expect(screen.getByRole('button', { name: 'Nova rede' }).classList.contains('bg-laranja')).toBe(false)
  })
})
