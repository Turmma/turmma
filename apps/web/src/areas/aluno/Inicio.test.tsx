// @vitest-environment jsdom
import { QueryClientProvider, focusManager } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { MINHAS_ATIVIDADES_QUERY_KEY } from '../../api/chaves-do-aluno'
import { createQueryClient } from '../../api/query-client'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork } from '../../__fixtures__/render-screen'
import { AVISO_DA_AVALIACAO } from './atividades'
import Inicio from './Inicio'
import { TEXTO_DO_VAZIO, TITULO_DO_VAZIO } from './inicio'
import { TEXTO_DA_SUPERVISAO } from './tutor'

/**
 * O Início do aluno nos quatro estados (telas do aluno e primeiro acesso, 3.0; RF4, RF5, RF10, RF20): carregando, erro das
 * tarefas, vazio — só com a leitura terminada — e com dado. A saudação e a faixa de supervisão estão em **todos**, porque
 * nenhuma depende da leitura das tarefas, e a faixa não tem botão de fechar (D8). A rede é falsa; a tela, o cliente de
 * consultas e a sessão são os da aba. O Início lê `/v1/eu` e `minhas-atividades`, e **nunca** a conversa do Tutor.
 */
setupScreen()
afterEach(() => vi.useRealTimers())

const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const PAGINA_SEGUINTE = '0192a4c0-5b1e-7c3d-8e4f-0000000000aa'
const FALHA = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: REQUISICAO } } } as const
const EU = {
  usuarioId: '0192a4c0-5b1e-7c3d-8e4f-0000000000e1',
  papel: 'aluno',
  nome: 'Ana Clara Sintética',
  escola: { id: '0192a4c0-5b1e-7c3d-8e4f-0000000000e2', nome: 'Escola sintética', slug: 'escola-sintetica' },
  inatividadeMin: 20,
  introducaoVistaEm: '2026-10-01T12:00:00.000Z',
  acessos: [],
}
const atividade = (final: string, campos: Record<string, unknown> = {}) => ({
  id: `0192a4c0-5b1e-7c3d-8e4f-0000000000${final}`,
  titulo: `Lista sintética ${final}`,
  disciplina: { id: '0192a4c0-5b1e-7c3d-8e4f-0000000000ff', nome: 'Química' },
  avaliativa: false,
  situacao: 'para_fazer',
  questoes: 3,
  respondidas: 0,
  aplicadaEm: '2026-10-05T13:00:00.000Z',
  enviadaEm: null,
  ...campos,
})
const enviada = (final: string) => atividade(final, { situacao: 'enviada', respondidas: 3, enviadaEm: '2026-10-06T13:00:00.000Z' })

/** A rede de um caso: o `/v1/eu` do desvio da entrada e as tarefas dadas. */
function rede(itens: unknown[], proxima?: string): FakeNetwork {
  const falsa = fakeNetwork()
  falsa.responderPor('/v1/eu', { status: 200, corpo: EU })
  falsa.responderPor('/v1/minhas-atividades', { status: 200, corpo: { itens, ...(proxima === undefined ? {} : { proxima }) } })
  return falsa
}

/** A área do aluno monta as rotas sob `/aluno`; o `Router` com a mesma base dá aos links o endereço que o navegador teria. */
function montar() {
  return renderScreen(
    <Router base="/aluno">
      <Inicio />
    </Router>,
  )
}

/** A faixa de supervisão: o texto de hoje, uma vez só, e nada que a feche. */
function conferirAFaixa(): void {
  const faixa = document.querySelector('[data-faixa-de-supervisao]')
  expect(faixa, 'a faixa de supervisão').not.toBeNull()
  expect(faixa?.textContent).toContain(TEXTO_DA_SUPERVISAO)
  expect(screen.getAllByText(TEXTO_DA_SUPERVISAO)).toHaveLength(1)
  expect(within(faixa as HTMLElement).queryAllByRole('button')).toHaveLength(0)
}

const caminhosPedidos = (falsa: FakeNetwork) => falsa.chamadas.map((chamada) => chamada.caminho.split('?')[0])
const pedidosDeTarefas = (falsa: FakeNetwork) => caminhosPedidos(falsa).filter((caminho) => caminho === '/v1/minhas-atividades')
const pedidosDoEu = (falsa: FakeNetwork) => caminhosPedidos(falsa).filter((caminho) => caminho === '/v1/eu')

describe('o Início do aluno', () => {
  it('carregando: a faixa já está na tela, o rótulo do carregamento também, e nem o vazio nem "Ver todas as tarefas" ainda', async () => {
    const falsa = fakeNetwork()
    falsa.responderPor('/v1/eu', { status: 200, corpo: EU })
    falsa.segurar()
    montar()

    expect(await screen.findByText('Carregando as suas tarefas…')).toBeTruthy()
    conferirAFaixa()
    // O vazio só vale com a leitura terminada: lista que ainda não chegou não é lista sem nada.
    expect(screen.queryByText(TITULO_DO_VAZIO)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Ver todas as tarefas' })).toBeNull()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Início')
  })

  it('com erro: o alerta com "Tentar de novo", a saudação e a faixa continuam, e nem o vazio nem a lista aparecem', async () => {
    const falsa = fakeNetwork()
    falsa.responderPor('/v1/eu', { status: 200, corpo: EU })
    falsa.responderPor('/v1/minhas-atividades', FALHA)
    montar()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(await screen.findByText('Oi, Ana.')).toBeTruthy()
    conferirAFaixa()
    expect(screen.queryByText(TITULO_DO_VAZIO)).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Ver todas as tarefas' })).toBeNull()
  })

  it('"Tentar de novo" lê as tarefas outra vez, e a lista aparece no lugar do alerta', async () => {
    const falsa = fakeNetwork()
    falsa.responderPor('/v1/eu', { status: 200, corpo: EU })
    let leituras = 0
    falsa.responderPor('/v1/minhas-atividades', () => {
      leituras += 1
      return leituras === 1 ? FALHA : { status: 200, corpo: { itens: [atividade('01')] } }
    })
    montar()

    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Lista sintética 01')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(leituras).toBe(2)
  })

  it('dois cliques seguidos em "Tentar de novo" fazem uma leitura só, e a segunda não cancela a primeira', async () => {
    const falsa = fakeNetwork()
    falsa.responderPor('/v1/eu', { status: 200, corpo: EU })
    let leituras = 0
    let liberar: (resposta: { status: number; corpo: unknown }) => void = () => undefined
    const segurada = new Promise<{ status: number; corpo: unknown }>((resolver) => (liberar = resolver))
    falsa.responderPor('/v1/minhas-atividades', () => {
      leituras += 1
      return leituras === 1 ? FALHA : segurada
    })
    montar()

    const botao = await screen.findByRole('button', { name: 'Tentar de novo' })
    fireEvent.click(botao)
    fireEvent.click(botao)
    expect(leituras).toBe(2)
    await act(async () => liberar({ status: 200, corpo: { itens: [atividade('01')] } }))
    expect(await screen.findByText('Lista sintética 01')).toBeTruthy()
    expect(leituras).toBe(2)
  })

  it('vazio, com a leitura terminada: diz que não há tarefa e que o Tutor ajuda quando houver, sem lista, e a faixa continua', async () => {
    rede([])
    montar()

    expect(await screen.findByText(TITULO_DO_VAZIO)).toBeTruthy()
    expect(screen.getByText(TEXTO_DO_VAZIO)).toBeTruthy()
    expect(screen.queryByText('Carregando as suas tarefas…')).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByRole('link', { name: 'Ver todas as tarefas' }).getAttribute('href')).toBe('/aluno/atividades')
    conferirAFaixa()
  })

  it('só com tarefa já enviada, o Início também diz que não há nada para fazer e não a lista', async () => {
    rede([enviada('01'), atividade('02', { situacao: 'com_diagnostico', respondidas: 3 })])
    montar()

    expect(await screen.findByText(TITULO_DO_VAZIO)).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByText('Lista sintética 01')).toBeNull()
  })

  it('borda: aluno sem turma no ano recebe a lista vazia, vê "Nenhuma tarefa por agora" e nenhum erro de rede', async () => {
    const falsa = rede([])
    montar()

    expect(await screen.findByText(TITULO_DO_VAZIO)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(pedidosDeTarefas(falsa)).toHaveLength(1)
  })

  it('com dado: até três tarefas na ordem da API, a enviada fica de fora, e cada uma leva ao Tutor e à própria tarefa', async () => {
    rede([enviada('01'), atividade('02'), atividade('03', { situacao: 'em_andamento', respondidas: 1 }), atividade('04'), atividade('05')])
    montar()

    const lista = await screen.findByRole('list')
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3)
    const ajuda = within(lista).getAllByRole('link', { name: 'Pedir ajuda ao Tutor' })
    expect(ajuda.map((link) => link.getAttribute('href'))).toEqual(['/aluno/tutor/0192a4c0-5b1e-7c3d-8e4f-000000000002', '/aluno/tutor/0192a4c0-5b1e-7c3d-8e4f-000000000003', '/aluno/tutor/0192a4c0-5b1e-7c3d-8e4f-000000000004'])
    const titulos = within(lista).getAllByRole('link', { name: /^Lista sintética/ })
    expect(titulos.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Lista sintética 02', '/aluno/atividades/0192a4c0-5b1e-7c3d-8e4f-000000000002'],
      ['Lista sintética 03', '/aluno/atividades/0192a4c0-5b1e-7c3d-8e4f-000000000003'],
      ['Lista sintética 04', '/aluno/atividades/0192a4c0-5b1e-7c3d-8e4f-000000000004'],
    ])
    expect(screen.queryByText('Lista sintética 01')).toBeNull()
    expect(screen.queryByText('Lista sintética 05')).toBeNull()
    expect(screen.queryByText(TITULO_DO_VAZIO)).toBeNull()
    expect(screen.getByRole('link', { name: 'Ver todas as tarefas' }).getAttribute('href')).toBe('/aluno/atividades')
    conferirAFaixa()
  })

  it('o título de cada tarefa tem altura de toque de 44 px, como o "Pedir ajuda ao Tutor" da linha', async () => {
    rede([atividade('02'), atividade('03')])
    montar()

    const titulos = within(await screen.findByRole('list')).getAllByRole('link', { name: /^Lista sintética/ })
    expect(titulos).toHaveLength(2)
    for (const titulo of titulos) {
      expect(titulo.className).toMatch(/(^|\s)min-h-11(\s|$)/)
      // O `Link` é `flex` para ter 44 px: o texto precisa estar num filho que encolhe e quebra, ou a palavra longa estoura a linha a 360 px.
      const texto = titulo.querySelector('span')
      expect(texto?.className).toMatch(/(^|\s)min-w-0(\s|$)/)
      expect(texto?.className).toMatch(/(^|\s)break-words(\s|$)/)
    }
  })

  it('só a primeira página conta, e o Início não pede a seguinte nem oferece "Ver mais"', async () => {
    const falsa = rede([atividade('01')], PAGINA_SEGUINTE)
    montar()

    expect(await screen.findByText('Lista sintética 01')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Ver mais|Carregando…/ })).toBeNull()
    expect(pedidosDeTarefas(falsa)).toHaveLength(1)
  })

  it('com as duas páginas já no cache, vindas de Tarefas, o Início mostra só as da primeira', async () => {
    const falsa = rede([])
    const cliente = createQueryClient()
    cliente.setQueryData(MINHAS_ATIVIDADES_QUERY_KEY, {
      pages: [{ itens: [atividade('01')], proxima: PAGINA_SEGUINTE }, { itens: [atividade('02'), atividade('03')] }],
      pageParams: [undefined, PAGINA_SEGUINTE],
    })
    render(
      <QueryClientProvider client={cliente}>
        <Router base="/aluno">
          <Inicio />
        </Router>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Lista sintética 01')).toBeTruthy()
    expect(screen.queryByText('Lista sintética 02')).toBeNull()
    expect(screen.queryByText('Lista sintética 03')).toBeNull()
    // O cache está fresco: o Início não relê o que acabou de receber.
    expect(pedidosDeTarefas(falsa)).toHaveLength(0)
  })

  it('uma releitura que falha não tira as tarefas da tela nem põe o alerta no lugar delas', async () => {
    const falsa = fakeNetwork()
    falsa.responderPor('/v1/eu', { status: 200, corpo: EU })
    let falhar = false
    falsa.responderPor('/v1/minhas-atividades', () => (falhar ? FALHA : { status: 200, corpo: { itens: [atividade('01')] } }))
    const cliente = createQueryClient()
    render(
      <QueryClientProvider client={cliente}>
        <Router base="/aluno">
          <Inicio />
        </Router>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Lista sintética 01')).toBeTruthy()

    falhar = true
    await act(async () => {
      await cliente.refetchQueries({ queryKey: MINHAS_ATIVIDADES_QUERY_KEY })
    })

    await waitFor(() => expect(pedidosDeTarefas(falsa)).toHaveLength(2))
    expect(cliente.getQueryState(MINHAS_ATIVIDADES_QUERY_KEY)?.status).toBe('error')
    expect(screen.getByText('Lista sintética 01')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('avaliativa aberta: a linha traz o aviso de hoje e o link "Pedir ajuda ao Tutor" continua, com o endereço do Tutor; a comum não leva o aviso', async () => {
    rede([atividade('01', { avaliativa: true }), atividade('02')])
    montar()

    const linhas = within(await screen.findByRole('list')).getAllByRole('listitem')
    expect(linhas).toHaveLength(2)
    const [aberta, comum] = linhas as [HTMLElement, HTMLElement]
    expect(aberta.textContent).toContain(AVISO_DA_AVALIACAO)
    expect(within(aberta).getByRole('link', { name: 'Pedir ajuda ao Tutor' }).getAttribute('href')).toBe('/aluno/tutor/0192a4c0-5b1e-7c3d-8e4f-000000000001')
    expect(comum.textContent).not.toContain(AVISO_DA_AVALIACAO)
    expect(within(comum).getByRole('link', { name: 'Pedir ajuda ao Tutor' })).toBeTruthy()
  })
})

describe('o que o Início lê', () => {
  it('só o /v1/eu e as tarefas: a conversa do Tutor e o uso do dia nunca são pedidos', async () => {
    const falsa = rede([atividade('01', { avaliativa: true })])
    montar()
    await screen.findByText('Lista sintética 01')

    expect([...new Set(caminhosPedidos(falsa))].sort()).toEqual(['/v1/eu', '/v1/minhas-atividades'])
    expect(falsa.chamadas.some((chamada) => chamada.caminho.includes('/tutor'))).toBe(false)
    expect(screen.queryByText(/Hoje:|de 60|perguntas/)).toBeNull()
  })

  it('ao voltar para a aba com a leitura velha, o Início não relê: uma releitura trocaria a lista debaixo do aluno', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const falsa = rede([atividade('01')])
    montar()
    await screen.findByText('Lista sintética 01')
    const antes = [pedidosDeTarefas(falsa).length, pedidosDoEu(falsa).length]

    // 61 s depois, as duas leituras já envelheceram: voltar para a aba só relê quem pede isso.
    vi.setSystemTime(Date.now() + 61_000)
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      await new Promise((resolver) => setTimeout(resolver, 30))
    })

    expect([pedidosDeTarefas(falsa).length, pedidosDoEu(falsa).length]).toEqual(antes)
    expect(antes).toEqual([1, 1])
  })

  it('reaberto antes de 60 s, o Início usa o que já leu; passados os 60 s, lê de novo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const falsa = rede([atividade('01')])
    const cliente = createQueryClient()
    const tela = () => (
      <QueryClientProvider client={cliente}>
        <Router base="/aluno">
          <Inicio />
        </Router>
      </QueryClientProvider>
    )
    const primeira = render(tela())
    await screen.findByText('Lista sintética 01')
    primeira.unmount()

    // 45 s: mais que os 30 s do padrão do cliente e menos que os 60 s do Início.
    vi.setSystemTime(Date.now() + 45_000)
    const segunda = render(tela())
    await screen.findByText('Lista sintética 01')
    await act(async () => new Promise((resolver) => setTimeout(resolver, 30)))
    expect([pedidosDeTarefas(falsa).length, pedidosDoEu(falsa).length]).toEqual([1, 1])
    segunda.unmount()

    vi.setSystemTime(Date.now() + 20_000)
    render(tela())
    await waitFor(() => expect([pedidosDeTarefas(falsa).length, pedidosDoEu(falsa).length]).toEqual([2, 2]))
  })
})

describe('a saudação do Início', () => {
  it('é "Oi, Ana." com o primeiro nome, assinada pelo Tutor com o nome da função e o selo IA', async () => {
    rede([])
    montar()

    expect(await screen.findByText('Oi, Ana.')).toBeTruthy()
    const assinatura = document.querySelector('[data-assinatura]')
    expect(assinatura, 'a assinatura do Tutor').not.toBeNull()
    expect(within(assinatura as HTMLElement).getByText('Tutor')).toBeTruthy()
    expect(assinatura?.querySelector('[data-selo-ia]')).not.toBeNull()
  })

  it('antes de o nome chegar diz só "Oi." e não fica em branco', async () => {
    const falsa = fakeNetwork()
    falsa.responderPor('/v1/eu', () => new Promise(() => undefined))
    falsa.responderPor('/v1/minhas-atividades', { status: 200, corpo: { itens: [] } })
    montar()

    expect(await screen.findByText('Oi.')).toBeTruthy()
    expect(await screen.findByText(TITULO_DO_VAZIO)).toBeTruthy()
  })
})

describe('o texto do Início', () => {
  it('varredura: nenhum "sequência", "pontos", "ranking", "meta", "colega", "média", "posição", "nota", "conceito" nem "acertos", e nada de "de volta" nem "faz tempo", com dado, vazio ou erro', async () => {
    const varrer = () => {
      const texto = document.body.textContent ?? ''
      expect(texto).not.toMatch(/\b(sequência|pontos?|ranking|metas?|colegas?|médias?|posição|posições|notas?|conceitos?|acertos?)\b/i)
      expect(texto).not.toMatch(/de volta|faz tempo/i)
    }

    rede([atividade('01', { avaliativa: true }), atividade('02', { situacao: 'em_andamento', respondidas: 2 }), enviada('03')])
    const comDado = montar()
    await screen.findByText('Lista sintética 01')
    varrer()
    comDado.unmount()

    rede([])
    const vazio = montar()
    await screen.findByText(TITULO_DO_VAZIO)
    varrer()
    vazio.unmount()

    const falsa = fakeNetwork()
    falsa.responderPor('/v1/eu', { status: 200, corpo: EU })
    falsa.responderPor('/v1/minhas-atividades', FALHA)
    montar()
    await screen.findByRole('alert')
    varrer()
  })

  it('nada promete o Tutor: nem o vazio nem o resto do Início dizem que ele está disponível ou que espera o aluno', async () => {
    rede([])
    montar()
    await screen.findByText(TITULO_DO_VAZIO)

    expect(document.body.textContent ?? '').not.toMatch(/dispon[ií]vel|sempre aqui|estou aqui|vou esperar|te espero|volto/i)
  })
})
