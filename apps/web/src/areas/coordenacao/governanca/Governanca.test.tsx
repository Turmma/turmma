// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import Governanca from './Governanca'

/**
 * Registros › IA (telas da coordenação, 10.0; RF18, RF22 e RF23): os quatro números, o filtro por estado no endereço, a tabela e o
 * consumo. A rede é falsa; o cliente de consultas, o roteador e a tela são os de verdade. O servidor que filtra, o recomeço pela
 * pessoa seguinte e o tamanho nas duas larguras são do e2e (`e2e/governanca.spec.ts`).
 */
setupScreen()

/** A largura da janela, para a consulta `(min-width: 768px)` que a `Table` lê; o `jsdom` não tem `matchMedia`. */
function janelaDe(largura: number): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta === '(min-width: 768px)' ? largura >= 768 : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

beforeEach(() => {
  janelaDe(1366)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const SERIE = { id: id(200), etapa: 'em', ano: 2 }
const FORA: FakeResponse = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }

type Estado = 'pendente' | 'aprovada' | 'rejeitada'
const NUMEROS_DA_ESCOLA = { geradoPorIa: 41, aprovadoPorPessoa: 7, rejeitado: 3, esperando: 5 }
/** Números que só uma resposta de filtro devolveria: se aparecerem na tela, ela leu os números do lugar errado. */
const NUMEROS_DO_FILTRO = { geradoPorIa: 900, aprovadoPorPessoa: 901, rejeitado: 902, esperando: 903 }

function item(n: number, estado: Estado) {
  return {
    id: id(n),
    funcao: 'correcao_de_objetiva',
    tipo: 'lote_de_correcao',
    estado,
    serie: SERIE,
    criadaEm: '2026-10-04T13:00:00.000Z',
    decididaEm: estado === 'pendente' ? null : '2026-10-05T13:00:00.000Z',
  }
}
const resumo = (numeros: typeof NUMEROS_DA_ESCOLA, itens: readonly ReturnType<typeof item>[], proxima?: string): FakeResponse => ({
  status: 200,
  corpo: { numeros, itens, ...(proxima === undefined ? {} : { proxima }) },
})
/** O consumo do mês como a API o devolve (camada-ia 6.0): o orçamento, a parte de cada função e o pacote do Tutor, sem token e sem real. */
const consumoCom = (orcamento: unknown = { situacao: 'definido', porcentagem: 0, aviso: null }, porFuncao: readonly unknown[] = []): FakeResponse => ({
  status: 200,
  corpo: { mes: '2026-10', orcamento, porFuncao, tutor: { trocasNoMes: 12, pacoteDoMes: 9600, trocasPorDiaPorAluno: 60, trocasPorMesPorAluno: 300 } },
})
const CONSUMO: FakeResponse = consumoCom()

/** As respostas de cada estado. Registrar os filtros antes do geral: o primeiro que casa responde. */
function responderPorEstado(rede: FakeNetwork, porEstado: Readonly<Partial<Record<Estado, FakeResponse | (() => FakeResponse | Promise<FakeResponse>)>>>, geral: FakeResponse): void {
  for (const [estado, resposta] of Object.entries(porEstado)) rede.responderPor(new RegExp(`^/v1/governanca/resumo\\?estado=${estado}(&|$)`), resposta)
  rede.responderPor('/v1/governanca/resumo', geral)
  rede.responderPor('/v1/governanca/consumo', CONSUMO)
}

const TODAS = [item(1, 'pendente'), item(2, 'aprovada'), item(3, 'rejeitada'), item(4, 'aprovada')]
const caminhosDoResumo = (rede: FakeNetwork) => rede.chamadas.filter((chamada) => chamada.caminho.startsWith('/v1/governanca/resumo')).map((chamada) => chamada.caminho)
/** O estado de cada linha da tabela, na ordem: o selo da decisão carrega `data-aprovacao`. */
const selosDaLista = () => [...document.querySelectorAll('[data-aprovacao]')].map((selo) => selo.getAttribute('data-aprovacao'))
const numero = (rotulo: string) => screen.getAllByText(rotulo, { exact: true })[0]?.parentElement?.textContent ?? ''

function montar(endereco = '/governanca') {
  const [caminho = '/governanca', busca = ''] = endereco.split('?')
  const localizacao = memoryLocation({ path: caminho, searchPath: busca, record: true })
  renderScreen(
    <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
      <Governanca />
    </Router>,
  )
  return localizacao
}

describe('Registros › IA: os estados da tela', () => {
  it('carregando: só o aviso de leitura, e nenhum dos vazios enquanto a leitura não terminou', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/governanca/consumo', CONSUMO)
    const lida = rede.segurar()
    montar()
    expect(await screen.findByText('Carregando a governança…')).toBeTruthy()
    for (const vazio of ['A IA ainda não gerou nada nesta escola', 'Nenhuma linha para mostrar ainda']) expect(screen.queryByText(vazio), vazio).toBeNull()
    lida.liberar(resumo({ geradoPorIa: 0, aprovadoPorPessoa: 0, rejeitado: 0, esperando: 0 }, []))
    expect(await screen.findByText('A IA ainda não gerou nada nesta escola')).toBeTruthy()
  })

  it('erro: diz o que fazer, "Tentar de novo" lê outra vez, e nenhum vazio aparece com a leitura falha', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let respostas = 0
    rede.responderPor('/v1/governanca/resumo', () => (++respostas === 1 ? FORA : resumo(NUMEROS_DA_ESCOLA, TODAS)))
    rede.responderPor('/v1/governanca/consumo', CONSUMO)
    montar()
    await screen.findByRole('alert')
    for (const vazio of ['A IA ainda não gerou nada nesta escola', 'Nenhuma linha para mostrar ainda']) expect(screen.queryByText(vazio), vazio).toBeNull()
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(selosDaLista()).toHaveLength(4)
  })

  it('vazio da escola sem nada gerado, e vazio da escola que já gerou mas não tem linha (série de um professor só)', async () => {
    const rede = fakeNetwork()
    responderPorEstado(rede, {}, resumo({ geradoPorIa: 0, aprovadoPorPessoa: 0, rejeitado: 0, esperando: 0 }, []))
    montar()
    expect(await screen.findByText('A IA ainda não gerou nada nesta escola')).toBeTruthy()
    expect(screen.getByText(/primeiro esperando o professor e depois com a decisão dele e a data/)).toBeTruthy()
    expect(await screen.findByText('Nenhuma função trabalhou neste mês')).toBeTruthy()
  })

  it('com o dado nos números mas sem linha: "Nenhuma linha para mostrar ainda", e o que já foi gerado está nos números', async () => {
    const rede = fakeNetwork()
    responderPorEstado(rede, {}, resumo(NUMEROS_DA_ESCOLA, []))
    montar()
    expect(await screen.findByText('Nenhuma linha para mostrar ainda')).toBeTruthy()
    expect(screen.queryByText('A IA ainda não gerou nada nesta escola')).toBeNull()
    expect(numero('Gerado por IA')).toContain('41')
  })

  it('o filtro que não acha nada diz o que vai aparecer ali, por estado, e não repete o vazio da escola', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    responderPorEstado(
      rede,
      { pendente: resumo(NUMEROS_DA_ESCOLA, []), aprovada: resumo(NUMEROS_DA_ESCOLA, []), rejeitada: resumo(NUMEROS_DA_ESCOLA, []) },
      resumo(NUMEROS_DA_ESCOLA, TODAS),
    )
    montar()
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    for (const [opcao, titulo] of [
      ['Esperando o professor', 'Nenhuma entrega esperando o professor'],
      ['Aprovados', 'Nenhuma entrega aprovada ainda'],
      ['Rejeitados', 'Nenhuma entrega rejeitada'],
    ] as const) {
      await usuario.click(screen.getByRole('radio', { name: opcao }))
      expect(await screen.findByText(titulo), titulo).toBeTruthy()
      expect(screen.queryByText('Nenhuma linha para mostrar ainda')).toBeNull()
      expect(screen.queryByText('A IA ainda não gerou nada nesta escola')).toBeNull()
    }
  })

  it('com o filtro lendo, a tabela mostra a leitura e nenhum vazio: o vazio só vem com a resposta', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let soltar: (resposta: FakeResponse) => void = () => undefined
    const segurada = new Promise<FakeResponse>((resolver) => (soltar = resolver))
    responderPorEstado(rede, { aprovada: () => segurada }, resumo(NUMEROS_DA_ESCOLA, TODAS))
    montar()
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    await usuario.click(screen.getByRole('radio', { name: 'Aprovados' }))
    expect(await screen.findByText('Carregando a lista…')).toBeTruthy()
    for (const vazio of ['Nenhuma entrega aprovada ainda', 'Nenhuma linha para mostrar ainda', 'A IA ainda não gerou nada nesta escola']) expect(screen.queryByText(vazio), vazio).toBeNull()
    // Os números e o filtro não somem enquanto a lista lê.
    expect(numero('Gerado por IA')).toContain('41')
    expect(screen.getByRole('radio', { name: 'Aprovados' })).toBeTruthy()
    soltar(resumo(NUMEROS_DA_ESCOLA, []))
    expect(await screen.findByText('Nenhuma entrega aprovada ainda')).toBeTruthy()
  })

  it('o filtro que falha mostra o erro com "Tentar de novo" na lista, sem derrubar os números nem o filtro', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let respostas = 0
    responderPorEstado(rede, { aprovada: () => (++respostas === 1 ? FORA : resumo(NUMEROS_DA_ESCOLA, [item(2, 'aprovada')])) }, resumo(NUMEROS_DA_ESCOLA, TODAS))
    montar()
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    await usuario.click(screen.getByRole('radio', { name: 'Aprovados' }))
    await screen.findByRole('alert')
    expect(numero('Gerado por IA')).toContain('41')
    expect(screen.getByRole('radio', { name: 'Aprovados' }).getAttribute('aria-checked')).toBe('true')
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(selosDaLista()).toEqual(['aprovada']))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('com dado: cinco colunas, a decisão no selo e "Carregar mais" lê a página seguinte com o cursor da API', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor(`/v1/governanca/resumo?pagina=${id(99)}`, resumo(NUMEROS_DA_ESCOLA, [item(5, 'aprovada')]))
    responderPorEstado(rede, {}, resumo(NUMEROS_DA_ESCOLA, TODAS, id(99)))
    montar()
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    expect(screen.getAllByRole('columnheader').map((coluna) => coluna.textContent)).toEqual(['O que foi gerado', 'Agente e função', 'Série', 'Gerado em', 'Decisão'])
    expect(selosDaLista()).toEqual(['pendente', 'aprovada', 'rejeitada', 'aprovada'])
    expect(screen.getAllByText('Esperando o professor').length).toBeGreaterThan(0)
    await usuario.click(screen.getByRole('button', { name: 'Carregar mais' }))
    await waitFor(() => expect(selosDaLista()).toHaveLength(5))
    expect(caminhosDoResumo(rede)).toEqual(['/v1/governanca/resumo', `/v1/governanca/resumo?pagina=${id(99)}`])
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull()
  })

  it('a falha de "Carregar mais" não apaga o que já foi lido: o aviso fica ao lado, e tentar de novo traz a página', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let tentativas = 0
    rede.responderPor(`/v1/governanca/resumo?pagina=${id(99)}`, () => (++tentativas === 1 ? FORA : resumo(NUMEROS_DA_ESCOLA, [item(5, 'aprovada')])))
    responderPorEstado(rede, {}, resumo(NUMEROS_DA_ESCOLA, TODAS, id(99)))
    montar()
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    await usuario.click(screen.getByRole('button', { name: 'Carregar mais' }))
    await screen.findByRole('alert')
    // Só o aviso da página: a lista lida continua, e não há segundo erro nem o erro da tela inteira.
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(selosDaLista()).toHaveLength(4)
    await usuario.click(within(screen.getByRole('alert').parentElement as HTMLElement).getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(selosDaLista()).toHaveLength(5))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a falha de "Carregar mais" de um filtro fica ao lado das linhas dele, e "Tentar de novo" lê a página do mesmo filtro', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let tentativas = 0
    rede.responderPor(new RegExp(`^/v1/governanca/resumo\\?estado=aprovada&pagina=${id(98)}$`), () => (++tentativas === 1 ? FORA : resumo(NUMEROS_DA_ESCOLA, [item(6, 'aprovada')])))
    responderPorEstado(rede, { aprovada: resumo(NUMEROS_DA_ESCOLA, [item(2, 'aprovada'), item(4, 'aprovada')], id(98)) }, resumo(NUMEROS_DA_ESCOLA, TODAS))
    montar('/governanca?estado=aprovada')
    await waitFor(() => expect(selosDaLista()).toEqual(['aprovada', 'aprovada']))
    await usuario.click(screen.getByRole('button', { name: 'Carregar mais' }))
    await screen.findByRole('alert')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(selosDaLista()).toEqual(['aprovada', 'aprovada'])
    await usuario.click(within(screen.getByRole('alert').parentElement as HTMLElement).getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(selosDaLista()).toEqual(['aprovada', 'aprovada', 'aprovada']))
    expect(screen.queryByRole('alert')).toBeNull()
    // A página que falhou foi pedida duas vezes, as duas dentro do filtro: nunca a da lista inteira.
    expect(caminhosDoResumo(rede).filter((caminho) => caminho === `/v1/governanca/resumo?estado=aprovada&pagina=${id(98)}`)).toHaveLength(2)
    expect(caminhosDoResumo(rede).filter((caminho) => caminho.includes('pagina=') && !caminho.includes('estado=aprovada'))).toEqual([])
  })
})

describe('Registros › IA: sem professor e sem turma (D45, D64)', () => {
  it('a tabela não tem coluna, filtro nem ordem por professor ou por turma, e nada disso vai à API', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    responderPorEstado(rede, { pendente: resumo(NUMEROS_DA_ESCOLA, [item(1, 'pendente')], id(97)), aprovada: resumo(NUMEROS_DA_ESCOLA, [item(2, 'aprovada')]) }, resumo(NUMEROS_DA_ESCOLA, TODAS, id(99)))
    rede.responderPor(/pagina=/, resumo(NUMEROS_DA_ESCOLA, []))
    montar()
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    expect(screen.queryAllByRole('columnheader', { name: /professor|turma/i })).toHaveLength(0)
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    expect(screen.queryAllByRole('button', { name: /ordenar|professor|turma/i })).toHaveLength(0)
    // O único filtro é o estado, com as quatro opções.
    expect(screen.getAllByRole('radio').map((opcao) => opcao.textContent)).toEqual(['Todos', 'Esperando o professor', 'Aprovados', 'Rejeitados'])
    await usuario.click(screen.getByRole('button', { name: 'Carregar mais' }))
    await usuario.click(screen.getByRole('radio', { name: 'Esperando o professor' }))
    await waitFor(() => expect(selosDaLista()).toEqual(['pendente']))
    await usuario.click(screen.getByRole('button', { name: 'Carregar mais' }))
    await usuario.click(screen.getByRole('radio', { name: 'Aprovados' }))
    await waitFor(() => expect(selosDaLista()).toEqual(['aprovada']))
    // Cada pedido ao resumo leva no máximo `estado` e `pagina`: nunca professor, turma, ordem ou texto de pessoa.
    const chamados = caminhosDoResumo(rede)
    expect(chamados.length).toBeGreaterThanOrEqual(5)
    for (const caminho of chamados) {
      const parametros = [...new URLSearchParams(caminho.split('?')[1] ?? '').keys()]
      expect(parametros.filter((nome) => nome !== 'estado' && nome !== 'pagina'), caminho).toEqual([])
    }
  })
})

describe('Registros › IA: o filtro por estado, no endereço', () => {
  it('escolher "Aprovados" chama resumo?estado=aprovada, põe o estado no endereço sem passo novo no histórico, e a tela mantém os quatro números da escola', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    responderPorEstado(rede, { aprovada: resumo(NUMEROS_DO_FILTRO, [item(2, 'aprovada'), item(4, 'aprovada')]) }, resumo(NUMEROS_DA_ESCOLA, TODAS))
    const localizacao = montar()
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    expect(caminhosDoResumo(rede)).toEqual(['/v1/governanca/resumo'])
    await usuario.click(screen.getByRole('radio', { name: 'Aprovados' }))
    await waitFor(() => expect(selosDaLista()).toEqual(['aprovada', 'aprovada']))
    expect(caminhosDoResumo(rede)).toEqual(['/v1/governanca/resumo', '/v1/governanca/resumo?estado=aprovada'])
    expect(localizacao.history?.at(-1)).toBe('/governanca?estado=aprovada')
    expect(localizacao.history).toHaveLength(1)
    expect(screen.getByRole('radio', { name: 'Aprovados' }).getAttribute('aria-checked')).toBe('true')
    // Os números são os da escola inteira, e não os da resposta do filtro.
    expect(numero('Gerado por IA')).toContain('41')
    expect(numero('Aprovado por gente')).toContain('7')
    expect(numero('Esperando o professor')).toContain('5')
    expect(numero('Rejeitado')).toContain('3')
    expect(document.body.textContent).not.toContain('900')
    expect(document.body.textContent).not.toContain('903')
  })

  it('"Todos" tira o estado do endereço e volta à lista inteira, e cada estado traz só as linhas dele', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    responderPorEstado(
      rede,
      { pendente: resumo(NUMEROS_DA_ESCOLA, [item(1, 'pendente')]), rejeitada: resumo(NUMEROS_DA_ESCOLA, [item(3, 'rejeitada')]) },
      resumo(NUMEROS_DA_ESCOLA, TODAS),
    )
    const localizacao = montar()
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    await usuario.click(screen.getByRole('radio', { name: 'Esperando o professor' }))
    await waitFor(() => expect(selosDaLista()).toEqual(['pendente']))
    expect(localizacao.history?.at(-1)).toBe('/governanca?estado=pendente')
    await usuario.click(screen.getByRole('radio', { name: 'Rejeitados' }))
    await waitFor(() => expect(selosDaLista()).toEqual(['rejeitada']))
    expect(localizacao.history?.at(-1)).toBe('/governanca?estado=rejeitada')
    await usuario.click(screen.getByRole('radio', { name: 'Todos' }))
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    expect(localizacao.history?.at(-1)).toBe('/governanca')
    expect(localizacao.history).toHaveLength(1)
  })

  it('"Carregar mais" de um filtro lê a página seguinte do mesmo filtro, e o botão é o da lista dele', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor(new RegExp(`^/v1/governanca/resumo\\?estado=aprovada&pagina=${id(98)}$`), resumo(NUMEROS_DA_ESCOLA, [item(6, 'aprovada')]))
    responderPorEstado(rede, { aprovada: resumo(NUMEROS_DA_ESCOLA, [item(2, 'aprovada'), item(4, 'aprovada')], id(98)) }, resumo(NUMEROS_DA_ESCOLA, TODAS))
    montar('/governanca?estado=aprovada')
    await waitFor(() => expect(selosDaLista()).toEqual(['aprovada', 'aprovada']))
    await usuario.click(screen.getByRole('button', { name: 'Carregar mais' }))
    await waitFor(() => expect(selosDaLista()).toHaveLength(3))
    expect(caminhosDoResumo(rede)).toContain(`/v1/governanca/resumo?estado=aprovada&pagina=${id(98)}`)
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull()
  })

  it('dois cliques seguidos em "Carregar mais" de um filtro pedem a página uma vez só', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let soltar: (resposta: FakeResponse) => void = () => undefined
    const segurada = new Promise<FakeResponse>((resolver) => {
      soltar = resolver
    })
    rede.responderPor(new RegExp(`^/v1/governanca/resumo\\?estado=aprovada&pagina=${id(98)}$`), () => segurada)
    responderPorEstado(rede, { aprovada: resumo(NUMEROS_DA_ESCOLA, [item(2, 'aprovada'), item(4, 'aprovada')], id(98)) }, resumo(NUMEROS_DA_ESCOLA, TODAS))
    montar('/governanca?estado=aprovada')
    await waitFor(() => expect(selosDaLista()).toEqual(['aprovada', 'aprovada']))
    const botao = screen.getByRole('button', { name: 'Carregar mais' })
    await usuario.click(botao)
    // A leitura está no ar: o botão diz e fica desligado, e o segundo clique não chega a pedir nada.
    expect(((await screen.findByRole('button', { name: 'Carregando…' })) as HTMLButtonElement).disabled).toBe(true)
    await usuario.click(screen.getByRole('button', { name: 'Carregando…' }))
    soltar(resumo(NUMEROS_DA_ESCOLA, [item(6, 'aprovada')]))
    await waitFor(() => expect(selosDaLista()).toHaveLength(3))
    expect(caminhosDoResumo(rede).filter((caminho) => caminho.includes('pagina='))).toEqual([`/v1/governanca/resumo?estado=aprovada&pagina=${id(98)}`])
  })

  it('o endereço com o estado abre já filtrado, e a leitura sem filtro continua dando os números', async () => {
    const rede = fakeNetwork()
    responderPorEstado(rede, { pendente: resumo(NUMEROS_DO_FILTRO, [item(1, 'pendente')]) }, resumo(NUMEROS_DA_ESCOLA, TODAS))
    montar('/governanca?estado=pendente')
    await waitFor(() => expect(selosDaLista()).toEqual(['pendente']))
    expect(screen.getByRole('radio', { name: 'Esperando o professor' }).getAttribute('aria-checked')).toBe('true')
    expect(numero('Gerado por IA')).toContain('41')
    expect(caminhosDoResumo(rede).sort()).toEqual(['/v1/governanca/resumo', '/v1/governanca/resumo?estado=pendente'])
  })

  it('estado desconhecido no endereço é ignorado: abre sem filtro e a API nunca o recebe', async () => {
    const rede = fakeNetwork()
    responderPorEstado(rede, {}, resumo(NUMEROS_DA_ESCOLA, TODAS))
    montar('/governanca?estado=todos&professor=0197a1c0-0000-7000-8000-000000000301')
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    expect(screen.getByRole('radio', { name: 'Todos' }).getAttribute('aria-checked')).toBe('true')
    expect(caminhosDoResumo(rede)).toEqual(['/v1/governanca/resumo'])
  })

  it('sem estado no endereço, a tela lê só a lista sem filtro: nenhuma leitura de estado é feita sem a pessoa escolher', async () => {
    const rede = fakeNetwork()
    responderPorEstado(rede, {}, resumo(NUMEROS_DA_ESCOLA, TODAS))
    montar()
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    expect(caminhosDoResumo(rede)).toEqual(['/v1/governanca/resumo'])
  })

  it('a resposta do filtro antigo, mesmo atrasada, não cai na lista do filtro novo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let soltar: (resposta: FakeResponse) => void = () => undefined
    const atrasada = new Promise<FakeResponse>((resolver) => (soltar = resolver))
    responderPorEstado(rede, { aprovada: () => atrasada, rejeitada: resumo(NUMEROS_DA_ESCOLA, [item(3, 'rejeitada')]) }, resumo(NUMEROS_DA_ESCOLA, TODAS))
    montar()
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    await usuario.click(screen.getByRole('radio', { name: 'Aprovados' }))
    await screen.findByText('Carregando a lista…')
    await usuario.click(screen.getByRole('radio', { name: 'Rejeitados' }))
    await waitFor(() => expect(selosDaLista()).toEqual(['rejeitada']))
    soltar(resumo(NUMEROS_DA_ESCOLA, [item(2, 'aprovada'), item(4, 'aprovada')]))
    // Dá a vez à resposta atrasada antes de olhar: a lista continua sendo a de "Rejeitados".
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(selosDaLista()).toEqual(['rejeitada'])
    expect(screen.getByRole('radio', { name: 'Rejeitados' }).getAttribute('aria-checked')).toBe('true')
  })
})

describe('Registros › IA: os números, o link e o consumo', () => {
  it('o filtro "Estado" põe as quatro opções em duas colunas no celular: "Esperando o professor" e "Rejeitados" não cabem lado a lado a 360 px', async () => {
    const rede = fakeNetwork()
    responderPorEstado(rede, {}, resumo(NUMEROS_DA_ESCOLA, TODAS))
    montar()
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    const grupo = screen.getByRole('radiogroup', { name: 'Estado' })
    expect(grupo.className).toMatch(/\bgrid-cols-2\b/)
    expect(grupo.className).toMatch(/\bmd:flex\b/)
  })

  it('os quatro números têm os rótulos e os textos de apoio de hoje, e o link leva a "Como cada IA trabalha"', async () => {
    const rede = fakeNetwork()
    responderPorEstado(rede, {}, resumo(NUMEROS_DA_ESCOLA, TODAS))
    montar()
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    expect(numero('Gerado por IA')).toContain('Atividades, planos, versões adaptadas e correções')
    expect(numero('Aprovado por gente')).toContain('Versões adaptadas e correções que um professor aprovou')
    expect(numero('Esperando o professor')).toContain('Só valem depois da decisão dele')
    expect(numero('Rejeitado')).toContain('O professor recusou, com justificativa')
    expect(screen.getByRole('link', { name: 'Como cada IA trabalha' }).getAttribute('href')).toBe('/agentes')
  })

  it('o consumo do mês por função fica depois da tabela no documento, com a frase de que a lista não mostra turma nem quem decidiu', async () => {
    const rede = fakeNetwork()
    responderPorEstado(rede, {}, resumo(NUMEROS_DA_ESCOLA, TODAS))
    montar()
    await waitFor(() => expect(selosDaLista()).toHaveLength(4))
    const tabela = screen.getByRole('region', { name: 'O que a IA gerou e quem aprovou' })
    const consumo = screen.getByRole('region', { name: 'Consumo do mês por função' })
    expect(tabela.compareDocumentPosition(consumo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(tabela).getByText(/A lista não mostra turma nem quem decidiu/)).toBeTruthy()
    expect(await within(consumo).findByText('Nenhuma função trabalhou neste mês')).toBeTruthy()
  })
})

describe('Registros › IA: o consumo do mês por função e o orçamento (camada-ia 6.0)', () => {
  const NAO_CARREGA = 'Não foi possível concluir agora. Tente de novo em instantes.'
  const doConsumo = () => screen.getByRole('region', { name: 'Consumo do mês por função' })
  /** Monta a tela com o resumo em dia e o consumo dado. */
  function montarComConsumo(consumo: FakeResponse | (() => FakeResponse | Promise<FakeResponse>)) {
    const rede = fakeNetwork()
    rede.responderPor('/v1/governanca/resumo', resumo(NUMEROS_DA_ESCOLA, TODAS))
    rede.responderPor('/v1/governanca/consumo', consumo)
    montar()
    return rede
  }

  it('o consumo por função fica depois da tabela, com a parte e as execuções escritas, e sem token nem real', async () => {
    montarComConsumo(
      consumoCom({ situacao: 'definido', porcentagem: 62, aviso: null }, [
        { funcao: 'conversa_e_ferramentas', parte: 41, execucoes: 128 },
        { funcao: 'tutor_com_o_aluno', parte: 59, execucoes: 1 },
      ]),
    )
    const consumo = await screen.findByRole('region', { name: 'Consumo do mês por função' })
    expect(await within(consumo).findByText('Assistente de ensino · Conversa e ferramentas')).toBeTruthy()
    expect(within(consumo).getByText('41% do que a IA trabalhou no mês · 128 execuções')).toBeTruthy()
    expect(within(consumo).getByText('Tutor · Tutor com o aluno')).toBeTruthy()
    expect(within(consumo).getByText('59% do que a IA trabalhou no mês · 1 execução')).toBeTruthy()
    // O traço de cada função tem o tamanho da parte dela: o enchimento é o segundo retângulo do desenho que vem logo depois da linha escrita.
    const enchimentoDe = (texto: string) => within(consumo).getByText(texto).closest('p')?.nextElementSibling?.querySelectorAll('rect')[1]?.getAttribute('width')
    expect(enchimentoDe('41% do que a IA trabalhou no mês · 128 execuções')).toBe('41%')
    expect(enchimentoDe('59% do que a IA trabalhou no mês · 1 execução')).toBe('59%')
    expect(within(consumo).getByText('IA do mês: 62% do previsto.')).toBeTruthy()
    // O pacote do Tutor segue, em trocas.
    expect(within(consumo).getByText('12 de 9.600 trocas')).toBeTruthy()
    expect(consumo.textContent).not.toMatch(/R\$|token|crédito|não é medido/i)
  })

  it('o texto de cada estado do orçamento: sem aviso a 79%, o aviso de 80, o de 100, sem previsto e sem aluno ativo', async () => {
    const casos: Array<{ orcamento: unknown; texto: string; aviso: string | null }> = [
      { orcamento: { situacao: 'definido', porcentagem: 79, aviso: null }, texto: 'IA do mês: 79% do previsto.', aviso: null },
      { orcamento: { situacao: 'definido', porcentagem: 80, aviso: 80 }, texto: 'IA do mês: 80% do previsto.', aviso: 'A escola já usou 80% do previsto para a IA neste mês. Nada é cortado.' },
      {
        orcamento: { situacao: 'definido', porcentagem: 120, aviso: 100 },
        texto: 'IA do mês: 120% do previsto.',
        aviso: 'A escola passou do previsto para a IA neste mês. Nada é cortado, e a equipe Turmma vai conversar com vocês se isso se repetir.',
      },
      { orcamento: { situacao: 'sem_orcamento', porcentagem: null, aviso: null }, texto: 'O previsto de IA da escola ainda não foi definido. A equipe Turmma define com vocês.', aviso: null },
      { orcamento: { situacao: 'sem_aluno_ativo', porcentagem: null, aviso: null }, texto: 'A porcentagem aparece quando a escola tiver aluno ativo.', aviso: null },
    ]
    for (const { orcamento, texto, aviso } of casos) {
      montarComConsumo(consumoCom(orcamento, [{ funcao: 'conversa_e_ferramentas', parte: 100, execucoes: 1 }]))
      const consumo = await screen.findByRole('region', { name: 'Consumo do mês por função' })
      expect(await within(consumo).findByText(texto), texto).toBeTruthy()
      // O aviso é texto com o glifo do alerta (não é só cor), e só aparece quando o limiar foi cruzado.
      const avisos = [...consumo.querySelectorAll('[data-aviso]')].map((caixa) => caixa.textContent)
      expect(avisos, texto).toEqual(aviso === null ? [] : [aviso])
      cleanup()
    }
  })

  it('o mês sem execução: o orçamento aparece e a lista diz que nenhuma função trabalhou, sem barra', async () => {
    montarComConsumo(consumoCom({ situacao: 'definido', porcentagem: 0, aviso: null }, []))
    const consumo = await screen.findByRole('region', { name: 'Consumo do mês por função' })
    expect(await within(consumo).findByText('Nenhuma função trabalhou neste mês')).toBeTruthy()
    expect(within(consumo).getByText('IA do mês: 0% do previsto.')).toBeTruthy()
    expect(consumo.querySelector('svg')).toBeNull()
  })

  it('carregando: só o aviso de leitura, sem o orçamento e sem o vazio', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/governanca/resumo', resumo(NUMEROS_DA_ESCOLA, TODAS))
    const lida = rede.segurar()
    montar()
    await screen.findByText('Carregando o consumo…')
    expect(screen.queryByText('Nenhuma função trabalhou neste mês')).toBeNull()
    expect(screen.queryByText(/IA do mês/)).toBeNull()
    // Carregando não é falha: a mensagem de erro e o "Tentar de novo" só vêm com o erro da leitura.
    expect(within(doConsumo()).queryByRole('alert')).toBeNull()
    expect(within(doConsumo()).queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    lida.liberar(consumoCom())
    expect(await screen.findByText('IA do mês: 0% do previsto.')).toBeTruthy()
  })

  it('erro: diz o que fazer, "Tentar de novo" lê só o consumo e o orçamento volta; nenhum vazio aparece com a leitura falha', async () => {
    const usuario = userEvent.setup()
    let leituras = 0
    const rede = montarComConsumo(() => (++leituras === 1 ? FORA : consumoCom({ situacao: 'definido', porcentagem: 62, aviso: null }, [{ funcao: 'adaptacao', parte: 100, execucoes: 3 }])))
    await within(await screen.findByRole('region', { name: 'Consumo do mês por função' })).findByRole('alert')
    expect(screen.queryByText('Nenhuma função trabalhou neste mês')).toBeNull()
    const antes = rede.chamadas.length
    await usuario.click(within(doConsumo()).getByRole('button', { name: 'Tentar de novo' }))
    expect(await within(doConsumo()).findByText('IA do mês: 62% do previsto.')).toBeTruthy()
    expect(rede.chamadas.slice(antes).map((chamada) => chamada.caminho)).toEqual(['/v1/governanca/consumo'])
  })

  it('a resposta fora do contrato (o consumo com tokens e sem orçamento, de uma API anterior): "Atualize a página", sem "Tentar de novo", que traria a mesma', async () => {
    montarComConsumo({
      status: 200,
      corpo: {
        mes: '2026-10',
        total: { execucoes: 2, tokensDeEntrada: 1000, tokensDeSaida: 500, custoMicros: 0, comEnvioExterno: 0 },
        porFuncao: [{ funcao: 'conversa_e_ferramentas', execucoes: 2, tokensDeEntrada: 1000, tokensDeSaida: 500, custoMicros: 0, comEnvioExterno: 0 }],
        tutor: { trocasNoMes: 12, pacoteDoMes: 9600, trocasPorDiaPorAluno: 60, trocasPorMesPorAluno: 300 },
      },
    })
    const consumo = await screen.findByRole('region', { name: 'Consumo do mês por função' })
    const alerta = await within(consumo).findByRole('alert')
    expect(alerta.textContent).toContain('Atualize a página')
    expect(alerta.textContent).not.toBe(NAO_CARREGA)
    expect(within(consumo).queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    // Nem o número que a API antiga mandou aparece: a tela não lê o que o contrato não reconhece.
    expect(consumo.textContent).not.toMatch(/1\.500|tokens/)
  })
})
