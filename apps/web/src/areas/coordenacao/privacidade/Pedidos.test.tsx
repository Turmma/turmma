// @vitest-environment jsdom
import { focusManager, onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { prepararTela, redeFalsa, renderizarTela, type RespostaFalsa } from '../../../__fixtures__/render-screen'
import { buttonVariants } from '../../../components/ui/button-variants'
import { ROTAS_DA_COORDENACAO } from '../../../paths'
import Pedidos from './Pedidos'

/**
 * A aba "Pedidos" de Registros (telas da coordenação, 12.0; RF20 e RF22): o prazo de cada pedido na linha, o vencido em
 * texto, a linha inteira como o link do detalhe e os quatro estados da lista. A rede é falsa; a tabela, o cliente de
 * consultas e a tela são os da aba. Os caminhos de ponta a ponta (a escola de verdade, o clique que abre o detalhe, os
 * 360 px) são do e2e (`e2e/pedidos-do-titular.spec.ts`).
 */
prepararTela()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
/** O dia de hoje do teste, em São Paulo: só o `Date` é falso, e o resto do tempo corre de verdade (a consulta espera por ele). */
const AGORA = new Date('2026-10-16T15:00:00Z')

const FORA = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }
const pagina = (itens: readonly unknown[], proxima?: string): RespostaFalsa => ({ status: 200, corpo: proxima === undefined ? { itens } : { itens, proxima } })

function pedido(n: number, parcial: Record<string, unknown> = {}) {
  return { id: id(n), tipo: 'acesso', solicitante: 'titular', chegouEm: '2026-10-14', estado: 'recebido', titular: { nome: `Pessoa ${String(n)}`, turmas: ['7º A'] }, ...parcial }
}

/** Um pedido por situação do prazo, o mais recente primeiro: aberto, vence hoje, vencido, concluído e cancelado. */
const ABERTO = pedido(1, { chegouEm: '2026-10-14', tipo: 'acesso' })
const VENCE_HOJE = pedido(2, { chegouEm: '2026-10-01', tipo: 'portabilidade' })
const VENCIDO = pedido(3, { chegouEm: '2026-09-26', tipo: 'correcao' })
const CONCLUIDO = pedido(4, { chegouEm: '2026-08-01', estado: 'concluido', tipo: 'compartilhamento' })
const CANCELADO = pedido(5, { chegouEm: '2026-07-01', estado: 'cancelado', tipo: 'eliminacao' })
const DOS_CINCO = [ABERTO, VENCE_HOJE, VENCIDO, CONCLUIDO, CANCELADO]

/** O `jsdom` não tem `matchMedia` nem `ResizeObserver`: o teste os põe, que são API do navegador e não peça nossa. */
function janelaDe(largura: number): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta === '(min-width: 768px)' ? largura >= 768 : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  janelaDe(1366)
})

afterEach(() => {
  vi.useRealTimers()
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
})

function montar() {
  const localizacao = memoryLocation({ path: '/privacidade/pedidos', record: true })
  return renderizarTela(
    <Router hook={localizacao.hook}>
      <Pedidos />
    </Router>,
  )
}

/** As linhas da lista, como a tela as desenha: `tr` do corpo no computador, `li` no celular. */
const linhas = () => screen.getAllByRole('row').slice(1)
const linhaDe = (nome: string) => {
  const achada = linhas().find((linha) => within(linha).queryByRole('link', { name: new RegExp(`^${nome}`) }) !== null)
  if (achada === undefined) throw new Error(`nenhuma linha de ${nome}`)
  return achada
}

describe('Pedidos: os quatro estados', () => {
  it('carregando: diz o que espera, e a tabela ainda não existe', async () => {
    const rede = redeFalsa()
    const lida = rede.segurar()
    montar()
    expect(await screen.findByText('Carregando os pedidos…')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    // O vazio só vem com a leitura terminada e sem erro (RF22).
    expect(screen.queryByText('Nenhum pedido registrado')).toBeNull()
    lida.liberar(pagina(DOS_CINCO))
    await screen.findByRole('table', { name: 'Pedidos dos titulares' })
  })

  it('erro: diz o que fazer, e "Tentar de novo" lê outra vez e mostra a lista', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let respostas = 0
    rede.responderPor('/v1/privacidade/pedidos', () => (++respostas === 1 ? FORA : pagina(DOS_CINCO)))
    montar()
    await screen.findByRole('alert')
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText('Nenhum pedido registrado')).toBeNull()
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findByRole('table', { name: 'Pedidos dos titulares' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('vazio: "Nenhum pedido registrado" é o convite, e o aviso do aluno e "Registrar pedido" continuam', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina([]))
    montar()
    expect(await screen.findByText('Nenhum pedido registrado')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('button', { name: 'Registrar pedido' })).toBeTruthy()
    expect(screen.getByText(/O aluno que ainda não reivindicou o nome não tem conta/)).toBeTruthy()
  })

  it('com dado: um vencido na lista, e a falha de "Ver mais pedidos" não apaga o que já foi lido', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    rede.responderPor(/pagina=/, FORA)
    rede.responderPor('/v1/privacidade/pedidos', pagina(DOS_CINCO, id(900)))
    montar()
    await screen.findByRole('table', { name: 'Pedidos dos titulares' })
    expect(linhas()).toHaveLength(5)
    await usuario.click(screen.getByRole('button', { name: 'Ver mais pedidos' }))
    await screen.findByRole('alert')
    expect(linhas()).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Ver mais pedidos' })).toBeTruthy()
  })
})

describe('Pedidos: o prazo de cada pedido na linha', () => {
  it('o aberto diz quantos dias faltam e até quando; o do dia diz que vence hoje; ambos pendentes', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina(DOS_CINCO))
    montar()
    await screen.findByRole('table')
    const aberto = within(linhaDe('Pessoa 1')).getByText('Faltam 13 dias, até 29/10/2026')
    expect(aberto.closest('[data-estado]')?.getAttribute('data-estado')).toBe('pendente')
    const hoje = within(linhaDe('Pessoa 2')).getByText('O prazo vence hoje, 16/10/2026')
    expect(hoje.closest('[data-estado]')?.getAttribute('data-estado')).toBe('pendente')
  })

  it('o vencido diz "vencido há N dias" em texto, na família do erro, com o ícone; o aberto de ontem não é vencido', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina([...DOS_CINCO, pedido(6, { chegouEm: '2026-10-15' })]))
    montar()
    await screen.findByRole('table')
    const texto = within(linhaDe('Pessoa 3')).getByText('Prazo vencido há 5 dias (venceu em 11/10/2026)')
    const selo = texto.closest('[data-estado]')
    expect(selo?.getAttribute('data-estado')).toBe('erro')
    expect(selo?.querySelector('svg')).not.toBeNull()
    // Só o vencido é erro na coluna do prazo: o de ontem ainda tem quase todo o prazo.
    const ontem = within(linhaDe('Pessoa 6')).getByText(/^Faltam 14 dias/)
    expect(ontem.closest('[data-estado]')?.getAttribute('data-estado')).toBe('pendente')
  })

  it('às 22h de São Paulo, já dia seguinte em UTC, o pedido que vence hoje diz "vence hoje", e não "vencido há 1 dia"', async () => {
    // 2026-10-17T01:00Z são 22h de 16/10 em São Paulo: o dia da lista é o de São Paulo, como o da API.
    vi.setSystemTime(new Date('2026-10-17T01:00:00Z'))
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina([VENCE_HOJE]))
    montar()
    await screen.findByRole('table')
    const selo = within(linhaDe('Pessoa 2')).getByText('O prazo vence hoje, 16/10/2026')
    expect(selo.closest('[data-estado]')?.getAttribute('data-estado')).toBe('pendente')
    expect(screen.queryByText(/vencido há/)).toBeNull()
  })

  it('o concluído e o cancelado não têm prazo a cumprir, por mais antigos que sejam', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina(DOS_CINCO))
    montar()
    await screen.findByRole('table')
    const concluido = within(linhaDe('Pessoa 4')).getByText('Pedido concluído: não há prazo a cumprir')
    expect(concluido.closest('[data-estado]')?.getAttribute('data-estado')).toBe('ok')
    const cancelado = within(linhaDe('Pessoa 5')).getByText('Pedido cancelado: não há prazo a cumprir')
    expect(cancelado.closest('[data-estado]')?.getAttribute('data-estado')).toBe('info')
  })

  it('a coluna "Prazo" vem antes de "Situação", e a ordem das linhas continua a da chegada', async () => {
    const rede = redeFalsa()
    // A tela ordena pela chegada, mais recente primeiro: o prazo não muda a ordem, e o vencido não sobe.
    rede.responderPor('/v1/privacidade/pedidos', pagina([CANCELADO, VENCIDO, ABERTO, CONCLUIDO, VENCE_HOJE]))
    montar()
    await screen.findByRole('table')
    expect(screen.getAllByRole('columnheader').map((cabecalho) => cabecalho.textContent)).toEqual(['Pessoa', 'Turma', 'Pedido', 'Quem pediu', 'Chegou em', 'Prazo', 'Situação'])
    const nomes = linhas().map((linha) => within(linha).getAllByRole('link')[0]?.getAttribute('aria-label'))
    expect(nomes).toEqual(['Pessoa 1, Acesso aos dados', 'Pessoa 2, Portabilidade dos dados', 'Pessoa 3, Correção de dados', 'Pessoa 4, Compartilhamento dos dados', 'Pessoa 5, Eliminação dos dados'])
  })

  it('no celular a lista diz "Prazo" ao lado do valor de cada item', async () => {
    janelaDe(360)
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina([VENCIDO]))
    montar()
    const lista = await screen.findByRole('list', { name: 'Pedidos dos titulares' })
    const item = within(lista).getAllByRole('listitem')[0] as HTMLElement
    const rotulos = [...item.querySelectorAll('dt')].map((dt) => dt.textContent)
    expect(rotulos).toContain('Prazo')
    const prazo = [...item.querySelectorAll('dd')][rotulos.indexOf('Prazo')]
    expect(prazo?.textContent).toBe('Prazo vencido há 5 dias (venceu em 11/10/2026)')
  })
})

describe('Pedidos: a linha inteira é o link do detalhe', () => {
  it('há um link só por linha, com o nome da pessoa e o tipo do pedido, para o endereço do pedido', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina(DOS_CINCO))
    montar()
    await screen.findByRole('table')
    for (const linha of linhas()) expect(within(linha).getAllByRole('link')).toHaveLength(1)
    const link = within(linhaDe('Pessoa 3')).getByRole('link', { name: 'Pessoa 3, Correção de dados' })
    expect(link.getAttribute('href')).toBe(`/privacidade/pedidos/${id(3)}`)
    // O que se vê é só o nome; o tipo do pedido é do nome acessível, e o nome à vista abre o dele.
    expect(link.textContent).toBe('Pessoa 3')
  })

  it('o link se estende pela linha (`after:inset-0`) e a linha é o ancestral posicionado', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina([VENCIDO]))
    montar()
    await screen.findByRole('table')
    const link = within(linhaDe('Pessoa 3')).getByRole('link')
    // O jsdom não calcula posição: aqui só a classe, que é o que o e2e depende. O clique de verdade, fora do nome e com duas linhas
    // na lista, é de `e2e/pedidos-do-titular.spec.ts` (o caso "qualquer ponto da linha abre o pedido dela").
    expect(link.classList.contains('after:absolute') && link.classList.contains('after:inset-0')).toBe(true)
    expect(link.closest('tr')?.classList.contains('relative')).toBe(true)
  })

  it('uma pessoa com dois pedidos, e dois homônimos, têm cada um o nome acessível e o endereço do próprio pedido', async () => {
    const rede = redeFalsa()
    const ana = { nome: 'Ana Souza', turmas: ['7º A'] }
    rede.responderPor(
      '/v1/privacidade/pedidos',
      pagina([
        pedido(10, { tipo: 'acesso', titular: ana, chegouEm: '2026-10-14' }),
        pedido(11, { tipo: 'correcao', titular: ana, chegouEm: '2026-10-13' }),
        pedido(12, { tipo: 'acesso', titular: { nome: 'Ana Souza', turmas: ['8º B'] }, chegouEm: '2026-10-12' }),
      ]),
    )
    montar()
    await screen.findByRole('table')
    const links = screen.getAllByRole('link', { name: /^Ana Souza, / })
    expect(links.map((link) => [link.getAttribute('aria-label'), link.getAttribute('href')])).toEqual([
      ['Ana Souza, Acesso aos dados', `/privacidade/pedidos/${id(10)}`],
      ['Ana Souza, Correção de dados', `/privacidade/pedidos/${id(11)}`],
      ['Ana Souza, Acesso aos dados', `/privacidade/pedidos/${id(12)}`],
    ])
  })

  it('o titular eliminado também é uma linha com link, e o tipo do pedido está no nome', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina([pedido(7, { tipo: 'eliminacao', estado: 'concluido', titular: null })]))
    montar()
    await screen.findByRole('table')
    const link = within(linhas()[0] as HTMLElement).getByRole('link', { name: 'Titular eliminado, Eliminação dos dados' })
    expect(link.getAttribute('href')).toBe(`/privacidade/pedidos/${id(7)}`)
  })

  it('no celular o item também é o ancestral posicionado do link', async () => {
    janelaDe(360)
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina([VENCIDO]))
    montar()
    const lista = await screen.findByRole('list', { name: 'Pedidos dos titulares' })
    const link = within(lista).getByRole('link', { name: 'Pessoa 3, Correção de dados' })
    expect(link.closest('li')?.classList.contains('relative')).toBe(true)
  })

  it('"Registrar pedido" é o único botão primário da aba, com a lista cheia e "Ver mais" à mostra', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina(DOS_CINCO, id(900)))
    montar()
    await screen.findByRole('table')
    const primario = new Set(buttonVariants({ variante: 'primario' }).split(/\s+/))
    const primarios = screen.getAllByRole('button').filter((botao) => [...primario].every((classe) => botao.classList.contains(classe)))
    expect(primarios.map((botao) => botao.textContent)).toEqual(['Registrar pedido'])
    expect(screen.getByRole('button', { name: 'Ver mais pedidos' })).toBeTruthy()
  })
})

describe('Pedidos: o aviso do aluno e o caminho até as turmas', () => {
  it('o aviso do aluno fica, diz "Escola › Turmas", e o link diz "Ir para as turmas" no mesmo endereço', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina(DOS_CINCO))
    montar()
    await screen.findByRole('table')
    const aviso = screen.getByText(/O aluno que ainda não reivindicou o nome não tem conta/)
    expect(aviso.textContent).toContain('abra a turma em Escola › Turmas.')
    expect(aviso.textContent).not.toContain('Estrutura')
    const link = screen.getByRole('link', { name: 'Ir para as turmas' })
    expect(link.getAttribute('href')).toBe(ROTAS_DA_COORDENACAO.estrutura)
    expect(screen.queryByRole('link', { name: /Estrutura/ })).toBeNull()
  })

  it('o cabeçalho não promete o prazo no detalhe: ele já está na lista', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina(DOS_CINCO))
    montar()
    await screen.findByRole('table')
    expect(screen.queryByText(/O prazo de cada um aparece no detalhe/)).toBeNull()
  })
})

describe('Pedidos: uma leitura por abertura', () => {
  it('lê ao abrir e não relê no foco nem com a rede que volta; o prazo sai de "Chegou em", sem chamada a mais', async () => {
    const rede = redeFalsa()
    rede.responderPor('/v1/privacidade/pedidos', pagina(DOS_CINCO))
    montar()
    await screen.findByRole('table')
    expect(within(linhaDe('Pessoa 3')).getByText(/vencido há 5 dias/)).toBeTruthy()
    expect(rede.chamadas.map((chamada) => chamada.caminho)).toEqual(['/v1/privacidade/pedidos'])
    focusManager.setFocused(false)
    focusManager.setFocused(true)
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
    // A janela de uma releitura que saísse sozinha: o foco e a rede avisam o cliente, que decide na hora.
    await waitFor(() => expect(screen.getByRole('table')).toBeTruthy())
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(rede.chamadas).toHaveLength(1)
  })
})
