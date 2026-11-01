// @vitest-environment jsdom
import { focusManager, onlineManager, QueryClientProvider, QueryObserver, type QueryClient } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { createQueryClient } from '../../../api/query-client'
import { aplicarDecisao, contagemDePedidosQueryOptions, pedidosDaTurmaQueryOptions } from '../../../api/pedidos'
import { setupScreen, fakeNetwork, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import { SinoAnchorContext } from '../../../components/sino-anchor-context'
import { ListaDePedidos } from '../../../components/pedidos/ListaDePedidos'
import Aprovar from '../atividades/Aprovar'
import SinoDoProfessor from './SinoDoProfessor'
import Turmas from '../turmas/Turmas'

/**
 * O sino da professora com a fila de verdade (telas do professor, 1.0; RF3 a RF5): o que ele lê, o que nunca guarda, quando
 * relê e o que diz quando não leu tudo. A rede é falsa e responde **por caminho**; a fila, o cliente de consultas, a peça e
 * a `ListaDePedidos` são os da aba. O `jsdom` não implementa o `dialog` modal: o teste instala o `showModal` e o `close`.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const TURMA_A = { id: id(101), nome: '1º A' }
const TURMA_B = { id: id(102), nome: '2º B' }
const ANA = { id: id(901), nome: 'Ana Sintética', solicitadaEm: '2026-10-02T15:00:00.000Z', teveMatriculaErrada: false }
const BRUNO = { id: id(902), nome: 'Bruno Sintético', solicitadaEm: '2026-10-02T15:00:00.000Z', teveMatriculaErrada: false }
const QUIMICA = { id: id(500), nome: 'Química' }
const FISICA = { id: id(501), nome: 'Física' }

const vinculo = (n: number, turma: { id: string; nome: string }, extra: Record<string, unknown> = {}) => ({ id: id(400 + n), turma, disciplina: QUIMICA, estado: 'confirmado', ...extra })
const lote = (n: number, turmaId: string) => ({
  id: id(600 + n),
  tipo: 'lote_de_correcao',
  funcao: 'correcao_de_objetiva',
  estado: 'pendente',
  turmaId,
  titulo: 'Atividade de estequiometria',
  artefatoId: null,
  atividadeAplicadaId: id(700 + n),
  criadaEm: '2026-10-05T09:00:00.000Z',
  decididaEm: null,
  decididaPor: null,
  justificativa: null,
})

const ok = (itens: readonly unknown[], extra: Record<string, unknown> = {}): FakeResponse => ({ status: 200, corpo: { itens, ...extra } })
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
const FORA = erro(404, 'NAO_ENCONTRADO')
const LIMITE = erro(429, 'LIMITE_EXCEDIDO')

type Resposta = FakeResponse | (() => FakeResponse | Promise<FakeResponse>)
const reivindicacoes = (turmaId: string) => `/v1/turmas/${turmaId}/reivindicacoes`

function instalar(rede: FakeNetwork, quem: { entregas?: Resposta; vinculos?: Resposta; pedidos?: Readonly<Record<string, Resposta>> }): void {
  rede.responderPor('/v1/entregas', quem.entregas ?? ok([]))
  rede.responderPor('/v1/meus-vinculos', quem.vinculos ?? ok([]))
  for (const [turmaId, resposta] of Object.entries(quem.pedidos ?? {})) rede.responderPor(reivindicacoes(turmaId), resposta)
}

const semConsulta = (caminho: string) => caminho.split('?')[0] ?? caminho
const caminhosDe = (rede: FakeNetwork) => rede.chamadas.map((chamada) => semConsulta(chamada.caminho))
const vezesQue = (rede: FakeNetwork, caminho: string) => caminhosDe(rede).filter((chamado) => chamado === caminho).length

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
})

function montar(opcoes: { cliente?: QueryClient; comLista?: { turmaId: string; nome: string }; aoLado?: ReactNode } = {}) {
  const cliente = opcoes.cliente ?? createQueryClient()
  const ancora = document.createElement('div')
  document.body.append(ancora)
  const localizacao = memoryLocation({ path: '/professor/nova-conversa' })
  const { unmount } = render(
    <QueryClientProvider client={cliente}>
      <Router hook={localizacao.hook}>
        <SinoAnchorContext value={{ elemento: ancora }}>
          {opcoes.comLista !== undefined && (
            <ListaDePedidos turma={{ id: opcoes.comLista.turmaId, nome: opcoes.comLista.nome }} quem="professor" vazio={{ titulo: 'Nenhum pedido', descricao: 'x' }} aoPerderATurma={() => undefined} />
          )}
          {opcoes.aoLado}
          <SinoDoProfessor />
        </SinoAnchorContext>
      </Router>
    </QueryClientProvider>,
  )
  return { cliente, ancora, desmontar: unmount }
}

const botao = (nome: string | RegExp, timeout = 5_000) => screen.findByRole('button', { name: nome }, { timeout })
const painel = () => screen.getByRole('dialog', { name: 'Esperando você' })
const pausa = (ms: number) =>
  act(async () => {
    await new Promise((resolver) => setTimeout(resolver, ms))
  })

describe('o sino da professora lê a fila', () => {
  it('desenha o sino na âncora da casca e lê as entregas, os vínculos e a contagem de pedidos de cada turma, e só isso', async () => {
    const rede = fakeNetwork()
    instalar(rede, { entregas: ok([lote(1, TURMA_A.id)]), vinculos: ok([vinculo(1, TURMA_A)]), pedidos: { [TURMA_A.id]: ok([ANA]) } })
    const { ancora } = montar()
    const sino = await botao('Esperando você, 2')
    expect(ancora.contains(sino)).toBe(true)
    expect([...new Set(caminhosDe(rede))].sort()).toEqual(['/v1/entregas', '/v1/meus-vinculos', reivindicacoes(TURMA_A.id)].sort())
  })

  it('abrir a lista não lê nada, e cada item leva à tela dele, agrupado por turma', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { entregas: ok([lote(1, TURMA_A.id)]), vinculos: ok([vinculo(1, TURMA_A), vinculo(2, TURMA_B, { estado: 'pendente' })]), pedidos: { [TURMA_A.id]: ok([ANA, BRUNO]) } })
    montar()
    await usuario.click(await botao('Esperando você, 3'))
    const antes = rede.chamadas.length
    const lista = painel()
    expect(within(lista).getByRole('region', { name: '1º A' })).toBeTruthy()
    expect(within(lista).getByRole('region', { name: '2º B' })).toBeTruthy()
    expect(within(lista).getByRole('link', { name: /Correção para revisar/ }).getAttribute('href')).toContain(id(701))
    expect(within(lista).getByRole('link', { name: /Pedidos de nome para decidir/ }).getAttribute('href')).toContain(`${TURMA_A.id}?aba=alunos`)
    expect(within(lista).getByRole('link', { name: /Confirme sua turma/ })).toBeTruthy()
    expect(rede.chamadas).toHaveLength(antes)
  })

  it('o pé leva às duas telas do time, em qualquer estado da fila, e o número do sino é só o dos itens (2.0)', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { entregas: ok([]), vinculos: ok([]) })
    montar()
    await usuario.click(await botao('Esperando você, nada'))
    const pe = within(painel()).getByRole('region', { name: 'Acompanhar a IA' })
    const links = within(pe).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([expect.stringContaining('O que o Assistente fez'), expect.stringContaining('O que o Tutor viu')])
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/time/assistente', '/time/tutor'])
    // Ver o pé não lê nada além da fila.
    expect([...new Set(caminhosDe(rede))].sort()).toEqual(['/v1/entregas', '/v1/meus-vinculos'].sort())
  })

  it('decidir um pedido relê a contagem da turma, uma vez, e o item sai do sino sem outra ação', async () => {
    const rede = fakeNetwork()
    let leituras = 0
    instalar(rede, { vinculos: ok([vinculo(1, TURMA_A)]), pedidos: { [TURMA_A.id]: () => ((leituras += 1) === 1 ? ok([ANA]) : ok([])) } })
    const { cliente } = montar()
    await botao('Esperando você, 1')
    await act(async () => {
      await aplicarDecisao(cliente, TURMA_A.id, 'professor', { resultados: [{ id: ANA.id, resultado: 'decidida' }] })
    })
    await botao('Esperando você, nada')
    expect(vezesQue(rede, reivindicacoes(TURMA_A.id))).toBe(2)
  })

  it('duas disciplinas na mesma turma: uma leitura de pedidos só', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: ok([vinculo(1, TURMA_A), vinculo(2, TURMA_A, { disciplina: FISICA })]), pedidos: { [TURMA_A.id]: ok([ANA]) } })
    montar()
    await botao('Esperando você, 1')
    expect(vezesQue(rede, reivindicacoes(TURMA_A.id))).toBe(1)
  })
})

describe('o sino não guarda nome de aluno (regra 20; D34)', () => {
  it('(a) só o sino montado: nada do cache contém o nome do aluno, e a contagem é só { quantidade, haMais }', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: ok([vinculo(1, TURMA_A)]), pedidos: { [TURMA_A.id]: ok([ANA, BRUNO]) } })
    const { cliente } = montar()
    await botao('Esperando você, 1')
    const tudo = JSON.stringify(cliente.getQueryCache().getAll().map((consulta) => ({ chave: consulta.queryKey, dado: consulta.state.data })))
    expect(tudo).not.toContain('Ana Sintética')
    expect(tudo).not.toContain('Bruno Sintético')
    expect(cliente.getQueryData(contagemDePedidosQueryOptions(TURMA_A.id).queryKey)).toEqual({ quantidade: 2, haMais: false })
  })

  it('(b) sino e ListaDePedidos juntos: a contagem é outra consulta que a lista, com a chave dela, e o dado é só o número', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: ok([vinculo(1, TURMA_A)]), pedidos: { [TURMA_A.id]: ok([ANA, BRUNO]) } })
    const { cliente } = montar({ comLista: { turmaId: TURMA_A.id, nome: TURMA_A.nome } })
    await botao('Esperando você, 1')
    await screen.findByText('2 pedidos esperando a decisão')
    const chaveDaContagem = contagemDePedidosQueryOptions(TURMA_A.id).queryKey
    const chaveDaLista = pedidosDaTurmaQueryOptions(TURMA_A.id, 'professor').queryKey
    expect(chaveDaContagem).toEqual(['pedidos-da-turma', 'contagem', TURMA_A.id])
    expect(chaveDaContagem).not.toEqual(chaveDaLista)
    expect(cliente.getQueryData(chaveDaContagem)).toEqual({ quantidade: 2, haMais: false })
    expect(JSON.stringify(cliente.getQueryData(chaveDaContagem))).not.toContain('Ana Sintética')
    expect(JSON.stringify(cliente.getQueryData(chaveDaContagem))).not.toContain('Bruno Sintético')
    expect(JSON.stringify(cliente.getQueryData(chaveDaLista))).toContain('Ana Sintética')
  })
})

describe('os estados do sino', () => {
  it('carregando enquanto alguma leitura não respondeu; "Tudo em dia" só com tudo lido e nada esperando', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let liberar: (resposta: FakeResponse) => void = () => undefined
    const lenta = new Promise<FakeResponse>((resolver) => (liberar = resolver))
    instalar(rede, { vinculos: () => lenta })
    montar()
    await botao('Esperando você, carregando')
    liberar(ok([]))
    await usuario.click(await botao('Esperando você, nada'))
    expect(within(painel()).getByText('Tudo em dia')).toBeTruthy()
    expect(within(painel()).getByText('Nada espera a sua decisão agora.')).toBeTruthy()
    expect(within(painel()).queryByRole('link', { name: /Ver o que falta para a escola/ })).toBeNull()
  })

  it('as entregas e os vínculos que falham juntos: erro, com o "Tentar de novo", e nunca "Tudo em dia"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { entregas: erro(400, 'ENTRADA_INVALIDA'), vinculos: erro(400, 'ENTRADA_INVALIDA') })
    montar()
    await usuario.click(await botao('Esperando você, não carregou'))
    expect(within(painel()).getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(within(painel()).queryByText('Tudo em dia')).toBeNull()
  })

  it('"Tentar de novo" a partir do erro: as entregas e os vínculos são relidos uma vez cada, e a fila lê as turmas e sai do erro', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhando = true
    instalar(rede, {
      entregas: () => (falhando ? erro(400, 'ENTRADA_INVALIDA') : ok([])),
      vinculos: () => (falhando ? erro(400, 'ENTRADA_INVALIDA') : ok([vinculo(1, TURMA_A)])),
      pedidos: { [TURMA_A.id]: ok([ANA]) },
    })
    montar()
    await usuario.click(await botao('Esperando você, não carregou'))
    expect(vezesQue(rede, '/v1/entregas')).toBe(1)
    expect(vezesQue(rede, '/v1/meus-vinculos')).toBe(1)
    falhando = false
    await usuario.click(within(painel()).getByRole('button', { name: 'Tentar de novo' }))
    await botao('Esperando você, 1')
    expect(vezesQue(rede, '/v1/entregas')).toBe(2)
    expect(vezesQue(rede, '/v1/meus-vinculos')).toBe(2)
    expect(vezesQue(rede, reivindicacoes(TURMA_A.id))).toBe(1)
    expect(within(painel()).queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })

  it('uma leitura que falha: a fila é parcial, com os itens das outras e o que não foi lido dito em palavras', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { entregas: erro(400, 'ENTRADA_INVALIDA'), vinculos: ok([vinculo(1, TURMA_A)]), pedidos: { [TURMA_A.id]: ok([ANA]) } })
    montar()
    await usuario.click(await botao('Esperando você, 1'))
    expect(within(painel()).getByText('Parte da lista não carregou. Não foi possível ler as correções e as versões adaptadas.')).toBeTruthy()
    expect(within(painel()).getByRole('link', { name: /Pedidos de nome para decidir/ })).toBeTruthy()
    expect(within(painel()).queryByText('Tudo em dia')).toBeNull()
  })

  const CEM_ENTREGAS = Array.from({ length: 100 }, (_, i) => lote(i + 1, TURMA_A.id))

  it('com a página de entregas cheia e outra depois, o sino diz "100 ou mais", com o aviso de que parte não carregou', async () => {
    const rede = fakeNetwork()
    instalar(rede, { entregas: ok(CEM_ENTREGAS, { proxima: id(999) }), vinculos: ok([vinculo(1, TURMA_A)]), pedidos: { [TURMA_A.id]: ok([]) } })
    montar()
    const sino = await botao('Esperando você, 100 ou mais')
    expect(sino.textContent).toContain('100+')
    fireEvent.click(sino)
    expect(within(painel()).getByText('Parte da lista não carregou. Não foi possível ler parte das correções e das versões adaptadas.')).toBeTruthy()
    expect(within(painel()).queryByText('Tudo em dia')).toBeNull()
  })

  it('o controle: as mesmas 100 entregas, sem outra página depois, são exatamente 100', async () => {
    const rede = fakeNetwork()
    instalar(rede, { entregas: ok(CEM_ENTREGAS), vinculos: ok([vinculo(1, TURMA_A)]), pedidos: { [TURMA_A.id]: ok([]) } })
    montar()
    const sino = await botao('Esperando você, 100')
    expect(sino.textContent).not.toContain('+')
  })

  it('Esc fecha a lista e devolve o foco ao sino', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, {})
    montar()
    const sino = await botao('Esperando você, nada')
    await usuario.click(sino)
    const dialogo = screen.getByRole('dialog', { name: 'Esperando você' })
    // O `jsdom` não traduz o Esc em `cancel`: o teste manda o evento que o navegador mandaria.
    fireEvent(dialogo, new Event('cancel', { cancelable: true }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Esperando você' })).toBeNull())
    expect(document.activeElement).toBe(sino)
  })

  it('sem ano letivo em curso: nenhuma turma é chamada, o sino diz que não há ano em curso e nunca "Tudo em dia"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { entregas: FORA, vinculos: FORA })
    montar()
    await usuario.click(await botao('Esperando você, parte não carregou'))
    expect(within(painel()).getByText(/Não há ano letivo em curso nesta escola/)).toBeTruthy()
    expect(within(painel()).queryByText('Tudo em dia')).toBeNull()
    expect(caminhosDe(rede).filter((caminho) => caminho.includes('/reivindicacoes'))).toEqual([])
  })
})

describe('o sino lê as turmas em série, até o teto, e para na recusa por limite', () => {
  const turmas = Array.from({ length: 14 }, (_, i) => ({ id: id(1000 + i), nome: `Turma ${String(i + 1).padStart(2, '0')}` }))

  it('14 turmas dão 12 leituras, uma de cada vez, em ordem de nome; a fila é parcial e diz o que não leu, sem "Tudo em dia"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let emVoo = 0
    let maximo = 0
    const lida: string[] = []
    const pedidos = Object.fromEntries(
      turmas.map((turma) => [
        turma.id,
        async (): Promise<FakeResponse> => {
          emVoo += 1
          maximo = Math.max(maximo, emVoo)
          lida.push(turma.id)
          await new Promise((resolver) => setTimeout(resolver, 5))
          emVoo -= 1
          return ok([])
        },
      ]),
    )
    // As turmas chegam fora de ordem: a leitura é por nome, e não pela ordem em que a API as deu.
    instalar(rede, { vinculos: ok([...turmas].reverse().map((turma, i) => vinculo(i, turma))), pedidos })
    montar()
    await usuario.click(await botao('Esperando você, parte não carregou', 10_000))
    expect(lida).toEqual(turmas.slice(0, 12).map((turma) => turma.id))
    expect(maximo).toBe(1)
    expect(within(painel()).getByText('Parte da lista não carregou. Não foi possível ler os pedidos de nome de 2 turmas.')).toBeTruthy()
    expect(within(painel()).queryByText('Tudo em dia')).toBeNull()
  })

  it('decidir na 13ª turma, além do teto, não lê a contagem dela; decidir na 1ª relê a dela uma vez', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: ok(turmas.map((turma, i) => vinculo(i, turma))), pedidos: Object.fromEntries(turmas.map((turma) => [turma.id, ok([])])) })
    const { cliente } = montar()
    await botao('Esperando você, parte não carregou', 10_000)
    const [primeira] = turmas
    const alemDoTeto = turmas.at(12)
    if (primeira === undefined || alemDoTeto === undefined) throw new Error('as 14 turmas do teste')
    await act(async () => {
      await aplicarDecisao(cliente, alemDoTeto.id, 'professor', { resultados: [{ id: ANA.id, resultado: 'decidida' }] })
      await aplicarDecisao(cliente, primeira.id, 'professor', { resultados: [{ id: ANA.id, resultado: 'decidida' }] })
    })
    // A da 1ª é o controle: prova que o teste enxerga a releitura, e só chega a 2 depois de a da 13ª ter tido a chance de sair.
    await waitFor(() => expect(vezesQue(rede, reivindicacoes(primeira.id))).toBe(2))
    expect(vezesQue(rede, reivindicacoes(alemDoTeto.id))).toBe(0)
  })

  it('a 3ª leitura recusada por limite: nada sai da 4ª em diante, os itens já lidos aparecem, e o sino diz que não leu tudo; a primeira resposta segurada prova a série', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let liberarPrimeira: (resposta: FakeResponse) => void = () => undefined
    const primeira = new Promise<FakeResponse>((resolver) => (liberarPrimeira = resolver))
    const pedidos: Record<string, Resposta> = Object.fromEntries(turmas.map((turma) => [turma.id, ok([])]))
    pedidos[turmas[0]?.id ?? ''] = () => primeira
    pedidos[turmas[1]?.id ?? ''] = ok([ANA])
    pedidos[turmas[2]?.id ?? ''] = LIMITE
    instalar(rede, { vinculos: ok(turmas.map((turma, i) => vinculo(i, turma))), pedidos })
    montar()
    await waitFor(() => expect(vezesQue(rede, reivindicacoes(turmas[0]?.id ?? ''))).toBe(1))
    // Com a primeira no ar, nenhuma outra sai: a série espera a resposta.
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 100))
    })
    expect(caminhosDe(rede).filter((caminho) => caminho.includes('/reivindicacoes'))).toHaveLength(1)
    liberarPrimeira(ok([]))
    await usuario.click(await botao('Esperando você, 1', 10_000))
    // Tempo para a 4ª leitura sair, se a parada não valesse.
    await pausa(150)
    expect(caminhosDe(rede).filter((caminho) => caminho.includes('/reivindicacoes'))).toHaveLength(3)
    expect(within(painel()).getByRole('link', { name: /Pedidos de nome para decidir/ })).toBeTruthy()
    expect(within(painel()).getByText(/Não foi possível ler os pedidos de nome de 12 turmas/)).toBeTruthy()
    expect(within(painel()).queryByText('Tudo em dia')).toBeNull()
  })
})

describe('"Atualizar" também lê em série e para na recusa por limite', () => {
  it('a segunda turma recusada por limite na releitura: a terceira não é relida, e a fila diz que não leu tudo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const turmas = [TURMA_A, TURMA_B, { id: id(103), nome: '3º C' }]
    let leiturasDaSegunda = 0
    instalar(rede, {
      vinculos: ok(turmas.map((turma, i) => vinculo(i, turma))),
      pedidos: {
        [TURMA_A.id]: ok([]),
        [TURMA_B.id]: () => ((leiturasDaSegunda += 1) === 1 ? ok([]) : LIMITE),
        [id(103)]: ok([]),
      },
    })
    montar()
    await usuario.click(await botao('Esperando você, nada'))
    await waitFor(() => expect(vezesQue(rede, reivindicacoes(id(103)))).toBe(1))
    await usuario.click(within(painel()).getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(vezesQue(rede, reivindicacoes(TURMA_B.id))).toBe(2))
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 150))
    })
    expect(vezesQue(rede, reivindicacoes(TURMA_A.id))).toBe(2)
    expect(vezesQue(rede, reivindicacoes(id(103)))).toBe(1)
    expect(await within(painel()).findByText(/Não foi possível ler os pedidos de nome de 1 turma/)).toBeTruthy()
    expect(within(painel()).queryByText('Tudo em dia')).toBeNull()
  })
})

describe('o sino não relê sozinho (RF5)', () => {
  const MIL = 1_000
  const CINCO_MINUTOS_E_UM = 5 * 60 * MIL + MIL

  async function avancar(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  async function sairEVoltar(tipo: 'foco' | 'rede'): Promise<void> {
    await act(async () => {
      if (tipo === 'foco') {
        focusManager.setFocused(false)
        focusManager.setFocused(true)
      } else {
        onlineManager.setOnline(false)
        onlineManager.setOnline(true)
      }
      await vi.advanceTimersByTimeAsync(50)
    })
  }

  const cena = () => {
    const rede = fakeNetwork()
    instalar(rede, { entregas: ok([lote(1, TURMA_A.id)]), vinculos: ok([vinculo(1, TURMA_A)]), pedidos: { [TURMA_A.id]: ok([ANA]) } })
    return rede
  }

  it('(a) cinco minutos de relógio sem tocar em nada: nenhuma leitura nova; e abrir a lista não lê', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = cena()
    montar()
    await botao('Esperando você, 2')
    const antes = rede.chamadas.length
    await avancar(CINCO_MINUTOS_E_UM)
    expect(rede.chamadas).toHaveLength(antes)
  })

  it('(b) com o dado velho, o foco sai e volta: zero chamadas', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = cena()
    montar()
    await botao('Esperando você, 2')
    const antes = rede.chamadas.length
    await avancar(CINCO_MINUTOS_E_UM)
    await sairEVoltar('foco')
    expect(rede.chamadas).toHaveLength(antes)
  })

  it('(b) com o dado velho, a rede sai e volta: zero chamadas', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = cena()
    montar()
    await botao('Esperando você, 2')
    const antes = rede.chamadas.length
    await avancar(CINCO_MINUTOS_E_UM)
    await sairEVoltar('rede')
    expect(rede.chamadas).toHaveLength(antes)
  })

  it('controle: a mesma consulta de contagem, com a opção ligada, relê na volta do foco e na da rede (o teste enxerga a leitura que o sino evita)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    for (const tipo of ['foco', 'rede'] as const) {
      const rede = cena()
      const cliente = createQueryClient()
      cliente.mount()
      const observador = new QueryObserver(cliente, { ...contagemDePedidosQueryOptions(TURMA_A.id), staleTime: 5 * 60 * MIL, refetchInterval: false, refetchOnWindowFocus: tipo === 'foco', refetchOnReconnect: tipo === 'rede' })
      const parar = observador.subscribe(() => undefined)
      await waitFor(() => expect(observador.getCurrentResult().isSuccess).toBe(true))
      const antes = rede.chamadas.length
      await avancar(CINCO_MINUTOS_E_UM)
      await sairEVoltar(tipo)
      expect(rede.chamadas.length).toBeGreaterThan(antes)
      parar()
      cliente.unmount()
    }
  })
})

describe('"Atualizar" e "Tentar de novo" releem só por chave exata, nunca a lista de nomes', () => {
  it('"Atualizar": uma leitura a mais de cada chave do sino, e nenhuma da lista nominal (o dado dela não muda)', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { vinculos: ok([vinculo(1, TURMA_A), vinculo(2, TURMA_B)]), pedidos: { [TURMA_A.id]: ok([ANA]), [TURMA_B.id]: ok([BRUNO]) } })
    const { cliente } = montar({ comLista: { turmaId: TURMA_B.id, nome: TURMA_B.nome } })
    await usuario.click(await botao('Esperando você, 2'))
    await screen.findByRole('checkbox', { name: /Bruno/ })
    const chaveDaLista = pedidosDaTurmaQueryOptions(TURMA_B.id, 'professor').queryKey
    const listaAntes = cliente.getQueryState(chaveDaLista)?.dataUpdatedAt
    // A lista nominal e a contagem da turma B leram a mesma rota uma vez cada.
    expect(vezesQue(rede, reivindicacoes(TURMA_B.id))).toBe(2)
    await usuario.click(within(painel()).getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(vezesQue(rede, '/v1/entregas')).toBe(2))
    await waitFor(() => expect(vezesQue(rede, reivindicacoes(TURMA_A.id))).toBe(2))
    await waitFor(() => expect(vezesQue(rede, reivindicacoes(TURMA_B.id))).toBe(3))
    expect(vezesQue(rede, '/v1/meus-vinculos')).toBe(2)
    expect(cliente.getQueryState(chaveDaLista)?.dataUpdatedAt).toBe(listaAntes)
  })

  it('"Tentar de novo": relê só o que falhou, e a lista nominal de outra turma não é tocada', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhando = true
    instalar(rede, {
      vinculos: ok([vinculo(1, TURMA_A), vinculo(2, TURMA_B)]),
      pedidos: { [TURMA_A.id]: () => (falhando ? FORA : ok([ANA])), [TURMA_B.id]: ok([BRUNO]) },
    })
    const { cliente } = montar({ comLista: { turmaId: TURMA_B.id, nome: TURMA_B.nome } })
    await usuario.click(await botao('Esperando você, 1'))
    await screen.findByRole('checkbox', { name: /Bruno/ })
    const chaveDaLista = pedidosDaTurmaQueryOptions(TURMA_B.id, 'professor').queryKey
    const listaAntes = cliente.getQueryState(chaveDaLista)?.dataUpdatedAt
    const entregasAntes = vezesQue(rede, '/v1/entregas')
    const vinculosAntes = vezesQue(rede, '/v1/meus-vinculos')
    const turmaBAntes = vezesQue(rede, reivindicacoes(TURMA_B.id))
    falhando = false
    await usuario.click(within(painel()).getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(vezesQue(rede, reivindicacoes(TURMA_A.id))).toBe(2))
    await botao('Esperando você, 2')
    expect(vezesQue(rede, '/v1/entregas')).toBe(entregasAntes)
    expect(vezesQue(rede, '/v1/meus-vinculos')).toBe(vinculosAntes)
    expect(vezesQue(rede, reivindicacoes(TURMA_B.id))).toBe(turmaBAntes)
    expect(cliente.getQueryState(chaveDaLista)?.dataUpdatedAt).toBe(listaAntes)
  })
})

/** As leituras de pedidos de várias turmas, com o que estava no ar ao mesmo tempo, o máximo disso e a ordem em que saíram. */
function rastrear(turmaIds: readonly string[], resposta: (turmaId: string) => FakeResponse = () => ok([])) {
  const estado = { emVoo: 0, maximo: 0, lidas: [] as string[] }
  const pedidos: Record<string, Resposta> = Object.fromEntries(
    turmaIds.map((turmaId) => [
      turmaId,
      async (): Promise<FakeResponse> => {
        estado.emVoo += 1
        estado.maximo = Math.max(estado.maximo, estado.emVoo)
        estado.lidas.push(turmaId)
        await new Promise((resolver) => setTimeout(resolver, 5))
        estado.emVoo -= 1
        return resposta(turmaId)
      },
    ]),
  )
  return { estado, pedidos }
}

const conjuntoDe = (prefixo: string, base: number) => Array.from({ length: 12 }, (_, i) => ({ id: id(base + i), nome: `${prefixo} ${String(i + 1).padStart(2, '0')}` }))

describe('a série e a parada no limite valem também quando a leitura não vem de um clique (regra 80)', () => {
  it('troca de escola com o sino montado: depois do reset, as 12 turmas da escola nova saem uma de cada vez, e nenhuma da anterior é relida', async () => {
    const rede = fakeNetwork()
    const turmasA = conjuntoDe('Escola A', 2000)
    const turmasB = conjuntoDe('Escola B', 3000)
    const rastro = rastrear([...turmasA, ...turmasB].map((turma) => turma.id))
    let escola: 'A' | 'B' = 'A'
    instalar(rede, { vinculos: () => ok((escola === 'A' ? turmasA : turmasB).map((turma, i) => vinculo(i, turma))), pedidos: rastro.pedidos })
    const { cliente } = montar()
    await botao('Esperando você, nada', 10_000)
    expect(rastro.estado.lidas).toEqual(turmasA.map((turma) => turma.id))
    expect(rastro.estado.maximo).toBe(1)

    rastro.estado.lidas.length = 0
    rastro.estado.maximo = 0
    escola = 'B'
    await act(async () => {
      await cliente.resetQueries()
    })
    await waitFor(() => expect(rastro.estado.lidas).toHaveLength(12), { timeout: 10_000 })
    await botao('Esperando você, nada', 10_000)
    await pausa(100)
    expect(rastro.estado.lidas).toEqual(turmasB.map((turma) => turma.id))
    expect(rastro.estado.maximo).toBe(1)
  })

  it('invalidação global (a API volta): as contagens já lidas não saem juntas, nem uma delas é relida', async () => {
    const rede = fakeNetwork()
    const turmas = conjuntoDe('Escola', 2000).slice(0, 3)
    const rastro = rastrear(turmas.map((turma) => turma.id))
    instalar(rede, { vinculos: ok(turmas.map((turma, i) => vinculo(i, turma))), pedidos: rastro.pedidos })
    const { cliente } = montar()
    await botao('Esperando você, nada', 10_000)
    expect(rastro.estado.lidas).toHaveLength(3)
    await act(async () => {
      await cliente.invalidateQueries()
    })
    await waitFor(() => expect(vezesQue(rede, '/v1/meus-vinculos')).toBe(2))
    await pausa(150)
    expect(vezesQue(rede, '/v1/entregas')).toBe(2)
    expect(rastro.estado.lidas).toHaveLength(3)
  })

  it('invalidação global com turmas novas: a série recomeça, e a 2ª recusada por limite impede a 3ª', async () => {
    const rede = fakeNetwork()
    const antigas = conjuntoDe('Antiga', 2000).slice(0, 3)
    const novas = conjuntoDe('Nova', 3000).slice(0, 3)
    const rastro = rastrear([...antigas, ...novas].map((turma) => turma.id), (turmaId) => (turmaId === novas[1]?.id ? LIMITE : ok([])))
    let lista = antigas
    instalar(rede, { vinculos: () => ok(lista.map((turma, i) => vinculo(i, turma))), pedidos: rastro.pedidos })
    const { cliente } = montar()
    await botao('Esperando você, nada', 10_000)
    rastro.estado.lidas.length = 0
    rastro.estado.maximo = 0
    lista = novas
    await act(async () => {
      await cliente.invalidateQueries()
    })
    await waitFor(() => expect(rastro.estado.lidas).toHaveLength(2), { timeout: 10_000 })
    await pausa(150)
    expect(rastro.estado.lidas).toEqual([novas[0]?.id, novas[1]?.id])
    expect(rastro.estado.maximo).toBe(1)
    await botao('Esperando você, parte não carregou')
  })
})

describe('a hora da leitura anterior não fica na tela quando a fila recomeça (regra 20, itens 4 e 5)', () => {
  it('depois do reset, enquanto a fila carrega não há "Atualizado às"; quando volta, é a hora da leitura nova', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(2026, 9, 17, 9, 30) })
    const rede = fakeNetwork()
    let segurada: Promise<FakeResponse> | null = null
    instalar(rede, { vinculos: () => segurada ?? ok([]) })
    const { cliente } = montar()
    fireEvent.click(await botao('Esperando você, nada'))
    expect(await within(painel()).findByText('Atualizado às 09:30')).toBeTruthy()

    vi.setSystemTime(new Date(2026, 9, 17, 11, 45))
    let liberar: (resposta: FakeResponse) => void = () => undefined
    segurada = new Promise<FakeResponse>((resolver) => (liberar = resolver))
    await act(async () => {
      void cliente.resetQueries()
    })
    expect(await within(painel()).findByText('Carregando o que espera você…')).toBeTruthy()
    expect(within(painel()).queryByText(/Atualizado às/)).toBeNull()
    liberar(ok([]))
    expect(await within(painel()).findByText('Atualizado às 11:45')).toBeTruthy()
  })
})

describe('o que a professora decide em outra tela tira o item do sino, na mesma aba (RF3)', () => {
  const HABILIDADE = { codigo: 'QUI.EM.04', descricao: 'Usar a proporção da equação balanceada.' }
  const ALUNO_EM_BRANCO = id(11)
  const ALUNO_FORA_DO_HISTORICO = id(12)
  const ABERTO_EM = '2026-10-05T13:38:00.000Z'
  const RESUMO = {
    alunosDaTurma: 30,
    corrigidos: 28,
    questoes: 2,
    mediaDeAcertos: 1.25,
    distribuicao: [{ de: 0, ate: 2, alunos: 28 }],
    porHabilidade: [{ habilidade: HABILIDADE, acertos: 20, total: 28 }],
    porQuestao: [{ numero: 1, habilidade: HABILIDADE, gabarito: 1, acertos: 20, porAlternativa: [3, 20, 2, 2], emBranco: 1 }],
  }

  /** A correção do lote de `lote(1, …)`, com os dois destaques já abertos: a API liga o botão de aprovar. */
  function correcaoDoLote(estado: 'pendente' | 'aprovada') {
    return {
      atividadeAplicadaId: id(701),
      titulo: 'Atividade de estequiometria',
      entrega: { id: id(601), estado },
      resumo: RESUMO,
      destaques: [
        { alunoId: ALUNO_EM_BRANCO, nome: 'Ana Sintética', acertos: 0, total: 2, emBranco: 2, motivos: ['em_branco'], abertoEm: ABERTO_EM },
        { alunoId: ALUNO_FORA_DO_HISTORICO, nome: 'Bruno Sintético', acertos: 0, total: 2, emBranco: 0, motivos: ['fora_do_historico'], abertoEm: ABERTO_EM },
      ],
      outras: [{ alunoId: id(21), nome: 'Clara Sintética', acertos: 1, total: 2, emBranco: 0 }],
      destaquesAbertos: 2,
      podeAprovar: estado === 'pendente',
      validacao: null,
    }
  }

  beforeEach(() => {
    // A tabela do lote é tabela a partir de 768 px, e a barra presa mede a si mesma: o `jsdom` não tem nenhum dos dois.
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }))
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
  })

  it('aprovar o lote tira a correção do sino, sem outra ação: as entregas são relidas e o item some da lista', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let aprovado = false
    instalar(rede, { entregas: () => ok(aprovado ? [] : [lote(1, TURMA_A.id)]), vinculos: ok([vinculo(1, TURMA_A)]), pedidos: { [TURMA_A.id]: ok([]) } })
    rede.responderPor(`/v1/atividades-aplicadas/${id(701)}/correcao`, () => ({ status: 200, corpo: correcaoDoLote(aprovado ? 'aprovada' : 'pendente') }))
    rede.responderPor(`/v1/entregas/${id(601)}/aprovar-lote`, () => {
      aprovado = true
      return {
        status: 200,
        corpo: {
          entrega: { ...lote(1, TURMA_A.id), estado: 'aprovada', decididaEm: ABERTO_EM, decididaPor: { id: id(2), nome: 'Camila Sintética' } },
          validacao: {
            id: id(3),
            apresentado: { resumo: RESUMO, destaques: [{ alunoId: ALUNO_EM_BRANCO, motivos: ['em_branco'] }, { alunoId: ALUNO_FORA_DO_HISTORICO, motivos: ['fora_do_historico'] }] },
            aberto: [
              { alunoId: ALUNO_EM_BRANCO, abertoEm: ABERTO_EM },
              { alunoId: ALUNO_FORA_DO_HISTORICO, abertoEm: ABERTO_EM },
            ],
            confirmadaPor: { id: id(2), nome: 'Camila Sintética' },
            confirmadaEm: ABERTO_EM,
          },
        },
      }
    })
    montar({ aoLado: <Aprovar atividadeAplicadaId={id(701)} /> })
    // O sino conta a correção para revisar, e a tela de revisar está ao lado, no mesmo cliente de consultas.
    await botao('Esperando você, 1')
    await usuario.click(await screen.findByRole('button', { name: 'Aprovar 28 correções' }))
    await usuario.click(within(await screen.findByRole('alertdialog', { name: 'Aprovar 28 correções' })).getByRole('button', { name: 'Aprovar 28 correções' }))
    await botao('Esperando você, nada')
    await usuario.click(await botao('Esperando você, nada'))
    expect(within(painel()).queryByRole('link', { name: /Correção para revisar/ })).toBeNull()
    expect(within(painel()).getByText('Tudo em dia')).toBeTruthy()
  })

  it('confirmar a turma tira "Confirme sua turma" do sino, sem outra ação, e a turma passa a ter os pedidos lidos', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let confirmado = false
    const pendente = vinculo(1, TURMA_A, { estado: 'pendente' })
    instalar(rede, { vinculos: () => ok([confirmado ? { ...pendente, estado: 'confirmado' } : pendente]), pedidos: { [TURMA_A.id]: ok([]) } })
    rede.responderPor(`/v1/vinculos/${pendente.id}/confirmar`, () => {
      confirmado = true
      return { status: 200, corpo: { ...pendente, estado: 'confirmado' } }
    })
    montar({ aoLado: <Turmas /> })
    await botao('Esperando você, 1')
    await usuario.click(await screen.findByRole('button', { name: 'Confirmar' }))
    await botao('Esperando você, nada')
    await usuario.click(await botao('Esperando você, nada'))
    expect(within(painel()).queryByRole('link', { name: /Confirme sua turma/ })).toBeNull()
    expect(within(painel()).getByText('Tudo em dia')).toBeTruthy()
    // A turma confirmada entra na leitura dos pedidos de nome: sem isso o "nada" seria só o item que saiu.
    expect(vezesQue(rede, reivindicacoes(TURMA_A.id))).toBe(1)
  })
})
