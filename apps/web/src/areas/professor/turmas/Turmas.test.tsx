// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AVISO_DO_COMPLEMENTO, EFEITO_DA_CONTESTACAO, NOME_DA_CONTESTACAO, NOME_DO_ESTADO_DE_VINCULO } from '@educa/shared'
import { createQueryClient } from '../../../api/query-client'
import { meusVinculosQueryOptions } from '../comum/api/vinculos'
import { setupScreen, fakeNetwork, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import Turmas from './Turmas'

/**
 * "Turmas" da professora, com a fila do sino de verdade (telas do professor, 9.0; RF14, RF22): os estados, a faixa "Confirme sua
 * turma", os cartões com o que espera em cada turma e a contestação no painel ao lado. A rede é falsa e responde **por caminho**;
 * a tela, a fila e o cliente de consultas são os da aba. O `jsdom` não implementa o `dialog` modal: o teste instala o
 * `showModal` e o `close`, e o Esc é o evento `cancel` que o navegador dispararia.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const TURMA_A = { id: id(101), nome: '1º A' }
const TURMA_B = { id: id(102), nome: '2º B' }
const MATEMATICA = { id: id(500), nome: 'Matemática' }
const HISTORIA = { id: id(501), nome: 'História' }
const ANA = { id: id(901), nome: 'Ana Sintética', solicitadaEm: '2026-10-02T15:00:00.000Z', teveMatriculaErrada: false }
const BRUNO = { id: id(902), nome: 'Bruno Sintético', solicitadaEm: '2026-10-02T15:00:00.000Z', teveMatriculaErrada: false }

const vinculo = (n: number, turma: { id: string; nome: string }, disciplina: { id: string; nome: string }, estado: string, extra: Record<string, unknown> = {}) => ({
  id: id(400 + n),
  turma,
  disciplina,
  estado,
  ...extra,
})
const entrega = (n: number, turmaId: string, tipo: 'lote_de_correcao' | 'versao_adaptada') => ({
  id: id(600 + n),
  tipo,
  funcao: tipo === 'lote_de_correcao' ? 'correcao_de_objetiva' : 'adaptacao',
  estado: 'pendente',
  turmaId,
  titulo: 'Atividade de estequiometria',
  artefatoId: tipo === 'versao_adaptada' ? id(800 + n) : null,
  atividadeAplicadaId: tipo === 'lote_de_correcao' ? id(700 + n) : null,
  criadaEm: '2026-10-05T09:00:00.000Z',
  decididaEm: null,
  decididaPor: null,
  justificativa: null,
})

const ok = (itens: readonly unknown[], extra: Record<string, unknown> = {}): FakeResponse => ({ status: 200, corpo: { itens, ...extra } })
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })

type Resposta = FakeResponse | (() => FakeResponse | Promise<FakeResponse>)
const reivindicacoes = (turmaId: string) => `/v1/turmas/${turmaId}/reivindicacoes`

function instalar(rede: FakeNetwork, quem: { entregas?: Resposta; vinculos?: Resposta; pedidos?: Readonly<Record<string, Resposta>> }): void {
  rede.responderPor('/v1/entregas', quem.entregas ?? ok([]))
  rede.responderPor('/v1/meus-vinculos', quem.vinculos ?? ok([]))
  for (const [turmaId, resposta] of Object.entries(quem.pedidos ?? {})) rede.responderPor(reivindicacoes(turmaId), resposta)
}

const semConsulta = (caminho: string) => caminho.split('?')[0] ?? caminho
const caminhosDe = (rede: FakeNetwork, metodo = 'GET') => rede.chamadas.filter((chamada) => chamada.metodo === metodo).map((chamada) => semConsulta(chamada.caminho))
const decisoes = (rede: FakeNetwork) => rede.chamadas.filter((chamada) => chamada.metodo === 'POST')

function montar() {
  const cliente = createQueryClient()
  const tela = render(
    <QueryClientProvider client={cliente}>
      <Turmas />
    </QueryClientProvider>,
  )
  return { cliente, ...tela }
}

const faixas = () => screen.getByRole('region', { name: 'Confirme suas turmas' })
const cartoes = () => screen.getByRole('region', { name: 'Suas turmas' })
const cartaoDe = (texto: string) => within(cartoes()).getAllByRole('listitem').find((item) => item.textContent?.includes(texto)) as HTMLElement
const faixaDe = (texto: string) => within(faixas()).getAllByRole('listitem').find((item) => item.textContent?.includes(texto)) as HTMLElement

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

afterEach(() => cleanup())

describe('Turmas: os estados', () => {
  it('carregando, com o título visível', async () => {
    const rede = fakeNetwork()
    const leitura = rede.segurar()
    instalar(rede, {})
    montar()
    expect(screen.getByRole('heading', { level: 1, name: 'Turmas' })).toBeTruthy()
    expect(await screen.findByText('Carregando as suas turmas…')).toBeTruthy()
    await act(async () => leitura.liberar(ok([])))
  })

  it('erro: a mensagem do catálogo e "Tentar de novo", que lê de novo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falha = true
    instalar(rede, { vinculos: () => (falha ? erro(503, 'INDISPONIVEL_TENTE_DE_NOVO') : ok([vinculo(1, TURMA_A, MATEMATICA, 'confirmado')])), pedidos: { [TURMA_A.id]: ok([]) } })
    montar()
    // O cliente repete uma vez, um segundo depois, antes de mostrar o erro.
    expect(await screen.findByRole('alert', {}, { timeout: 5_000 })).toBeTruthy()
    expect(screen.queryByText(/INDISPONIVEL/)).toBeNull()
    falha = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('region', { name: 'Suas turmas' })).toBeTruthy()
  })

  it('vazio: diz que quem aloca é a coordenação', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: ok([]) })
    montar()
    expect(await screen.findByText('A coordenação ainda não alocou você')).toBeTruthy()
    expect(screen.getByText(/fale com ela/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Suas turmas' })).toBeNull()
  })

  it('só pendente: a faixa de cada vínculo, "Confirme sua turma · 1º A · Matemática", e nenhum cartão', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: ok([vinculo(1, TURMA_A, MATEMATICA, 'pendente'), vinculo(2, TURMA_B, HISTORIA, 'pendente')]) })
    montar()
    const regiao = await screen.findByRole('region', { name: 'Confirme suas turmas' })
    expect(within(regiao).getAllByRole('listitem')).toHaveLength(2)
    expect(faixaDe('Matemática').textContent).toContain('Confirme sua turma · 1º A · Matemática')
    expect(within(faixaDe('Matemática')).getByRole('button', { name: 'Confirmar' })).toBeTruthy()
    expect(within(faixaDe('Matemática')).getByRole('button', { name: 'Contestar' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Suas turmas' })).toBeNull()
    // Sem turma confirmada, nada da fila é lido por turma.
    expect(caminhosDe(rede).filter((caminho) => caminho.includes('/reivindicacoes'))).toEqual([])
  })

  it('com as confirmadas: um cartão por turma e disciplina, com o nome, o estado em texto e o selo; o contestado e o encerrado ficam sem "Abrir a turma"', async () => {
    const rede = fakeNetwork()
    instalar(rede, {
      vinculos: ok([
        vinculo(1, TURMA_A, MATEMATICA, 'confirmado'),
        vinculo(2, TURMA_B, HISTORIA, 'contestado', { contestacao: 'turma_errada' }),
        vinculo(3, TURMA_A, HISTORIA, 'encerrado'),
      ]),
      // A 1º A tem uma entrega esperando: ela é da turma que a professora alcança pelo cartão confirmado, e só por ele.
      entregas: ok([entrega(1, TURMA_A.id, 'lote_de_correcao')]),
      pedidos: { [TURMA_A.id]: ok([]) },
    })
    montar()
    await screen.findByRole('region', { name: 'Suas turmas' })
    expect(screen.queryByRole('region', { name: 'Confirme suas turmas' })).toBeNull()
    expect(within(cartoes()).getAllByRole('listitem')).toHaveLength(3)

    const confirmado = cartaoDe('1º A · Matemática')
    expect(confirmado.textContent).toContain(NOME_DO_ESTADO_DE_VINCULO.confirmado)
    await waitFor(() => expect(confirmado.textContent).toContain('1 esperando você'))
    expect(within(confirmado).getByRole('link', { name: /Abrir a turma/ }).getAttribute('href')).toContain(TURMA_A.id)

    // O contestado diz o motivo em texto, não oferece decidir de novo (a coordenação corrige) e não abre a turma.
    const contestado = cartaoDe('2º B · História')
    expect(contestado.textContent).toContain(`${NOME_DO_ESTADO_DE_VINCULO.contestado} · ${NOME_DA_CONTESTACAO.turma_errada}`)
    expect(within(contestado).queryByRole('button')).toBeNull()
    expect(within(contestado).queryByRole('link')).toBeNull()
    const encerrado = cartaoDe('1º A · História')
    expect(encerrado.textContent).toContain(NOME_DO_ESTADO_DE_VINCULO.encerrado)
    expect(within(encerrado).queryByRole('link')).toBeNull()
    // O selo é só do cartão que abre a turma: o contestado e o encerrado não mostram trabalho que a professora não alcança por eles.
    for (const semSelo of [contestado, encerrado]) {
      for (const proibido of ['esperando você', 'Em dia', 'Não lida', 'Lendo o que espera']) expect(semSelo.textContent).not.toContain(proibido)
    }
    // A faixa do contestado não existe: ele espera a coordenação, e não a professora.
    expect(screen.queryByRole('region', { name: 'Confirme suas turmas' })).toBeNull()
  })
})

describe('Turmas: confirmar', () => {
  it('a faixa some e o cartão aparece em "Suas turmas", com o foco no título dele; dois cliques mandam uma decisão só', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let confirmado = false
    const resposta = vinculo(1, TURMA_A, MATEMATICA, 'confirmado')
    instalar(rede, { vinculos: () => ok([confirmado ? resposta : vinculo(1, TURMA_A, MATEMATICA, 'pendente')]), pedidos: { [TURMA_A.id]: ok([]) } })
    const segurada = rede.segurar()
    montar()
    await screen.findByRole('region', { name: 'Confirme suas turmas' })
    const botao = within(faixaDe('Matemática')).getByRole('button', { name: 'Confirmar' })
    await usuario.click(botao)
    expect(within(faixaDe('Matemática')).getByRole('button', { name: 'Confirmando…' }).hasAttribute('disabled')).toBe(true)
    // O segundo clique, no mesmo botão e no da outra ação, não decide de novo.
    fireEvent.click(within(faixaDe('Matemática')).getByRole('button', { name: 'Confirmando…' }))
    fireEvent.click(within(faixaDe('Matemática')).getByRole('button', { name: 'Contestar' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    confirmado = true
    await act(async () => segurada.liberar({ status: 200, corpo: resposta }))
    const regiao = await screen.findByRole('region', { name: 'Suas turmas' })
    expect(within(regiao).getByText('1º A · Matemática')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Confirme suas turmas' })).toBeNull()
    expect(decisoes(rede)).toHaveLength(1)
    expect(decisoes(rede)[0]?.caminho).toBe(`/v1/vinculos/${resposta.id}/confirmar`)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Suas turmas' })))
  })

  it('duas disciplinas na mesma turma: dois cartões, cada um com o seu estado, e confirmar um não muda o outro', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const matematica = vinculo(1, TURMA_A, MATEMATICA, 'confirmado')
    let confirmou = false
    instalar(rede, {
      vinculos: () => ok([confirmou ? matematica : { ...matematica, estado: 'pendente' }, vinculo(2, TURMA_A, HISTORIA, 'pendente')]),
      pedidos: { [TURMA_A.id]: ok([]) },
    })
    montar()
    await screen.findByRole('region', { name: 'Confirme suas turmas' })
    expect(within(faixas()).getAllByRole('listitem')).toHaveLength(2)

    rede.responder({ status: 200, corpo: matematica })
    confirmou = true
    await usuario.click(within(faixaDe('Matemática')).getByRole('button', { name: 'Confirmar' }))
    await screen.findByRole('region', { name: 'Suas turmas' })
    expect(within(cartoes()).getAllByRole('listitem')).toHaveLength(1)
    expect(cartaoDe('Matemática').textContent).toContain(NOME_DO_ESTADO_DE_VINCULO.confirmado)
    expect(within(faixas()).getAllByRole('listitem')).toHaveLength(1)
    expect(faixaDe('História')).toBeTruthy()
    expect(within(faixaDe('História')).getByRole('button', { name: 'Confirmar' })).toBeTruthy()
  })
})

describe('Turmas: depois de confirmar, o convite dos alunos', () => {
  it('o aviso "Turma 2º B confirmada" leva "Gerar o acesso" à aba Alunos da turma confirmada, com o diálogo pedido; antes de confirmar não há aviso, e o endereço só leva a aba e o pedido', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const confirmadaB = vinculo(2, TURMA_B, HISTORIA, 'confirmado')
    let confirmou = false
    instalar(rede, {
      vinculos: () => ok([vinculo(1, TURMA_A, MATEMATICA, 'pendente'), confirmou ? confirmadaB : { ...confirmadaB, estado: 'pendente' }]),
      pedidos: { [TURMA_A.id]: ok([]), [TURMA_B.id]: ok([]) },
    })
    montar()
    await screen.findByRole('region', { name: 'Confirme suas turmas' })
    expect(screen.queryByRole('link', { name: 'Gerar o acesso' })).toBeNull()
    expect(screen.queryByText(/confirmada$/)).toBeNull()

    // Confirma a segunda, e não a primeira: o aviso e o endereço são da turma que foi confirmada.
    rede.responder({ status: 200, corpo: confirmadaB })
    confirmou = true
    await usuario.click(within(faixaDe('História')).getByRole('button', { name: 'Confirmar' }))
    const aviso = await screen.findByText('Turma 2º B confirmada')
    expect(aviso.closest('[data-aviso="certo"]')).not.toBeNull()
    const gerar = screen.getByRole('link', { name: 'Gerar o acesso' })
    expect(gerar.getAttribute('href')).toBe(`/turmas/${TURMA_B.id}?aba=alunos&convidar=1`)
    // O aviso mora numa região viva que já existia: o leitor de tela o anuncia quando ele aparece.
    expect(aviso.closest('[role="status"]')).not.toBeNull()
    // A turma que ainda espera a decisão continua com a faixa, e não ganhou aviso.
    expect(faixaDe('Matemática')).toBeTruthy()
    expect(screen.queryByText('Turma 1º A confirmada')).toBeNull()
  })

  it('o aviso fica na página: sair de Turmas e voltar não o traz de volta, e contestar não gera aviso', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const confirmadaA = vinculo(1, TURMA_A, MATEMATICA, 'confirmado')
    let confirmou = false
    instalar(rede, { vinculos: () => ok([confirmou ? confirmadaA : { ...confirmadaA, estado: 'pendente' }]), pedidos: { [TURMA_A.id]: ok([]) } })
    const primeira = montar()
    await screen.findByRole('region', { name: 'Confirme suas turmas' })
    rede.responder({ status: 200, corpo: confirmadaA })
    confirmou = true
    await usuario.click(within(faixaDe('Matemática')).getByRole('button', { name: 'Confirmar' }))
    await screen.findByText('Turma 1º A confirmada')

    primeira.unmount()
    montar()
    await screen.findByRole('region', { name: 'Suas turmas' })
    expect(screen.queryByText('Turma 1º A confirmada')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Gerar o acesso' })).toBeNull()
  })

  it('a confirmação que falha não mostra o aviso nem o "Gerar o acesso": a faixa fica, com o erro, e o aviso só vem depois de uma confirmação que deu certo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const confirmadaA = vinculo(1, TURMA_A, MATEMATICA, 'confirmado')
    let confirmou = false
    instalar(rede, { vinculos: () => ok([confirmou ? confirmadaA : { ...confirmadaA, estado: 'pendente' }]), pedidos: { [TURMA_A.id]: ok([]) } })
    montar()
    await screen.findByRole('region', { name: 'Confirme suas turmas' })

    rede.responder(erro(409, 'CONFLITO'))
    await usuario.click(within(faixaDe('Matemática')).getByRole('button', { name: 'Confirmar' }))
    expect(await within(faixaDe('Matemática')).findByRole('alert')).toBeTruthy()
    expect(screen.queryByText(/confirmada$/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Gerar o acesso' })).toBeNull()

    // A tentativa seguinte dá certo: só então o aviso aparece.
    rede.responder({ status: 200, corpo: confirmadaA })
    confirmou = true
    await usuario.click(within(faixaDe('Matemática')).getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Turma 1º A confirmada')).toBeTruthy()
  })
})

describe('Turmas: contestar no painel ao lado', () => {
  async function comUmaPendente() {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    // A lista que a API devolve muda com a decisão: a contestação a relê, e o vínculo já vem contestado.
    let lista: unknown[] = [vinculo(1, TURMA_A, MATEMATICA, 'pendente')]
    instalar(rede, { vinculos: () => ok(lista) })
    const tela = montar()
    await screen.findByRole('region', { name: 'Confirme suas turmas' })
    const abrir = within(faixaDe('Matemática')).getByRole('button', { name: 'Contestar' })
    await usuario.click(abrir)
    return { usuario, rede, abrir, trocarALista: (nova: unknown[]) => (lista = nova), ...tela }
  }
  const painel = () => screen.getByRole('dialog', { name: 'Contestar a turma' })

  it('abre num painel com o motivo em lista fechada, o aviso de não escrever sobre aluno e o efeito, tudo antes do envio', async () => {
    await comUmaPendente()
    const dentro = within(painel())
    expect(dentro.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['nao_leciono', 'turma_errada', 'disciplina_errada', 'outro'])
    expect(dentro.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)).toBe(true)
    expect(painel().textContent).toContain(AVISO_DO_COMPLEMENTO)
    expect(painel().textContent).toContain(EFEITO_DA_CONTESTACAO)
    expect(painel().textContent).toContain('1º A · Matemática')
  })

  it('sem motivo não envia nada; com motivo envia o código e o complemento, o painel fecha e o contestado sai da faixa para um cartão sem "Abrir a turma"', async () => {
    const { usuario, rede, trocarALista } = await comUmaPendente()
    const dentro = within(painel())
    await usuario.type(dentro.getByRole('textbox'), 'Quem dá esta aula é outro professor.')
    await usuario.click(dentro.getByRole('button', { name: 'Enviar a contestação' }))
    // O `required` do grupo segura no navegador, e a página confere de novo: nenhum POST sai.
    expect(decisoes(rede)).toEqual([])
    // E a página confere de novo, sem o navegador: o envio direto do formulário também não manda nada sem o motivo.
    fireEvent.submit(painel().querySelector('form') as HTMLFormElement)
    expect(decisoes(rede)).toEqual([])
    expect(screen.queryByRole('dialog', { name: 'Contestar a turma' })).not.toBeNull()

    await usuario.click(dentro.getByRole('radio', { name: NOME_DA_CONTESTACAO.nao_leciono }))
    const contestado = vinculo(1, TURMA_A, MATEMATICA, 'contestado', { contestacao: 'nao_leciono' })
    rede.responder({ status: 200, corpo: contestado })
    trocarALista([contestado])
    await usuario.click(dentro.getByRole('button', { name: 'Enviar a contestação' }))

    await screen.findByRole('region', { name: 'Suas turmas' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Contestar a turma' })).toBeNull())
    expect(decisoes(rede)).toHaveLength(1)
    expect(decisoes(rede)[0]?.caminho).toBe(`/v1/vinculos/${contestado.id}/contestar`)
    expect(screen.queryByRole('region', { name: 'Confirme suas turmas' })).toBeNull()
    expect(cartaoDe('Matemática').textContent).toContain(`${NOME_DO_ESTADO_DE_VINCULO.contestado} · ${NOME_DA_CONTESTACAO.nao_leciono}`)
    expect(within(cartaoDe('Matemática')).queryByRole('link')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Suas turmas' })))
  })

  it('o painel só fecha com a lista já relida: enquanto a releitura não chega, o painel e a faixa ficam', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const contestado = vinculo(1, TURMA_A, MATEMATICA, 'contestado', { contestacao: 'nao_leciono' })
    let relendo = false
    let soltar: () => void = () => undefined
    instalar(rede, {
      vinculos: () => (relendo ? new Promise<FakeResponse>((resolver) => (soltar = () => resolver(ok([contestado])))) : ok([vinculo(1, TURMA_A, MATEMATICA, 'pendente')])),
    })
    montar()
    await screen.findByRole('region', { name: 'Confirme suas turmas' })
    await usuario.click(within(faixaDe('Matemática')).getByRole('button', { name: 'Contestar' }))
    const dentro = within(painel())
    await usuario.click(dentro.getByRole('radio', { name: NOME_DA_CONTESTACAO.nao_leciono }))
    rede.responder({ status: 200, corpo: contestado })
    relendo = true
    await usuario.click(dentro.getByRole('button', { name: 'Enviar a contestação' }))
    await waitFor(() => expect(decisoes(rede)).toHaveLength(1))
    // A contestação foi aceita e a lista nova ainda não chegou: o painel não fecha, e a faixa continua onde estava.
    await waitFor(() => expect(caminhosDe(rede).filter((caminho) => caminho === '/v1/meus-vinculos').length).toBeGreaterThan(1))
    expect(screen.queryByRole('dialog', { name: 'Contestar a turma' })).not.toBeNull()
    expect(screen.queryByRole('region', { name: 'Confirme suas turmas' })).not.toBeNull()
    soltar()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Contestar a turma' })).toBeNull())
    expect(screen.queryByRole('region', { name: 'Confirme suas turmas' })).toBeNull()
  })

  it('o texto sobrevive: a lista relida com o painel aberto não apaga o motivo nem o complemento', async () => {
    const { usuario, cliente } = await comUmaPendente()
    const dentro = within(painel())
    await usuario.click(dentro.getByRole('radio', { name: NOME_DA_CONTESTACAO.turma_errada }))
    await usuario.type(dentro.getByRole('textbox'), 'dou aula no 2º B')

    await act(async () => {
      await cliente.invalidateQueries({ queryKey: meusVinculosQueryOptions.queryKey })
    })
    expect((dentro.getByRole('radio', { name: NOME_DA_CONTESTACAO.turma_errada }) as HTMLInputElement).checked).toBe(true)
    expect((dentro.getByRole('textbox') as HTMLTextAreaElement).value).toBe('dou aula no 2º B')
  })

  it('Esc fecha o painel, devolve o foco ao botão "Contestar" e descarta o texto: abrir de novo começa limpo', async () => {
    const { usuario, abrir } = await comUmaPendente()
    await usuario.type(within(painel()).getByRole('textbox'), 'texto que a professora desistiu de mandar')
    // O que o navegador dispara com o Esc num `dialog` modal.
    fireEvent(painel(), new Event('cancel', { cancelable: true }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Contestar a turma' })).toBeNull())
    expect(document.activeElement).toBe(abrir)
    await usuario.click(abrir)
    expect((within(painel()).getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
  })

  it('a falha de uma contestação não vai junto para o painel do outro vínculo: o alerta da tentativa anterior sai', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, { vinculos: ok([vinculo(1, TURMA_A, MATEMATICA, 'pendente'), vinculo(2, TURMA_A, HISTORIA, 'pendente')]) })
    montar()
    await screen.findByRole('region', { name: 'Confirme suas turmas' })
    await usuario.click(within(faixaDe('Matemática')).getByRole('button', { name: 'Contestar' }))
    await usuario.click(within(painel()).getByRole('radio', { name: NOME_DA_CONTESTACAO.outro }))
    rede.responder(erro(409, 'CONFLITO'))
    await usuario.click(within(painel()).getByRole('button', { name: 'Enviar a contestação' }))
    await waitFor(() => expect(within(painel()).queryByRole('alert')).not.toBeNull())

    // Cancela e abre a contestação do outro vínculo: a falha era da primeira tentativa.
    await usuario.click(within(painel()).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Contestar a turma' })).toBeNull())
    await usuario.click(within(faixaDe('História')).getByRole('button', { name: 'Contestar' }))
    expect(painel().textContent).toContain('1º A · História')
    expect(within(painel()).queryByRole('alert')).toBeNull()
  })

  it('o clique repetido em "Enviar" manda uma contestação só', async () => {
    const { usuario, rede } = await comUmaPendente()
    const dentro = within(painel())
    await usuario.click(dentro.getByRole('radio', { name: NOME_DA_CONTESTACAO.outro }))
    const segurada = rede.segurar()
    await usuario.click(dentro.getByRole('button', { name: 'Enviar a contestação' }))
    const enviando = dentro.getByRole('button', { name: 'Enviando…' })
    expect(enviando.hasAttribute('disabled')).toBe(true)
    fireEvent.submit(painel().querySelector('form') as HTMLFormElement)
    expect(decisoes(rede)).toHaveLength(1)
    await act(async () => segurada.liberar(erro(409, 'CONFLITO')))
  })
})

describe('Turmas: o que espera em cada turma', () => {
  it('o selo soma a correção, a versão adaptada e os pedidos de nome da turma, só da turma dela; e as chamadas são as do sino, nenhuma a mais', async () => {
    const rede = fakeNetwork()
    instalar(rede, {
      entregas: ok([entrega(1, TURMA_A.id, 'lote_de_correcao'), entrega(2, TURMA_A.id, 'versao_adaptada'), entrega(3, TURMA_B.id, 'lote_de_correcao')]),
      vinculos: ok([vinculo(1, TURMA_A, MATEMATICA, 'confirmado'), vinculo(2, TURMA_B, MATEMATICA, 'confirmado')]),
      pedidos: { [TURMA_A.id]: ok([ANA, BRUNO]), [TURMA_B.id]: ok([]) },
    })
    montar()
    await screen.findByRole('region', { name: 'Suas turmas' })
    await waitFor(() => expect(cartaoDe('1º A').textContent).toContain('4 esperando você'))
    // A turma B tem só a correção dela: 1, e não a soma das duas turmas.
    await waitFor(() => expect(cartaoDe('2º B').textContent).toContain('1 esperando você'))
    expect(cartaoDe('2º B').textContent).not.toContain('4 esperando')
    expect([...new Set(caminhosDe(rede))].sort()).toEqual(['/v1/entregas', '/v1/meus-vinculos', reivindicacoes(TURMA_A.id), reivindicacoes(TURMA_B.id)].sort())
    // Uma leitura de cada coisa: a tela e a fila dividem as consultas.
    expect(caminhosDe(rede).filter((caminho) => caminho === '/v1/entregas')).toHaveLength(1)
    expect(caminhosDe(rede).filter((caminho) => caminho === '/v1/meus-vinculos')).toHaveLength(1)
  })

  it('turma sem nada esperando e lida inteira diz "Em dia"', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: ok([vinculo(1, TURMA_A, MATEMATICA, 'confirmado')]), pedidos: { [TURMA_A.id]: ok([]) } })
    montar()
    await screen.findByRole('region', { name: 'Suas turmas' })
    await waitFor(() => expect(cartaoDe('1º A').textContent).toContain('Em dia'))
  })

  it('a turma que o sino não leu diz "Não lida", nunca "Em dia": a leitura dos pedidos falhou, ou as entregas vieram truncadas', async () => {
    const rede = fakeNetwork()
    instalar(rede, { vinculos: ok([vinculo(1, TURMA_A, MATEMATICA, 'confirmado'), vinculo(2, TURMA_B, HISTORIA, 'confirmado')]), pedidos: { [TURMA_A.id]: ok([]), [TURMA_B.id]: erro(404, 'NAO_ENCONTRADO') } })
    montar()
    await screen.findByRole('region', { name: 'Suas turmas' })
    await waitFor(() => expect(cartaoDe('2º B').textContent).toContain('Não lida'))
    expect(cartaoDe('1º A').textContent).toContain('Em dia')
    expect(cartaoDe('2º B').textContent).not.toContain('Em dia')
    cleanup()

    const outra = fakeNetwork()
    instalar(outra, { entregas: ok([], { proxima: 'mais' }), vinculos: ok([vinculo(1, TURMA_A, MATEMATICA, 'confirmado')]), pedidos: { [TURMA_A.id]: ok([]) } })
    montar()
    await screen.findByRole('region', { name: 'Suas turmas' })
    await waitFor(() => expect(cartaoDe('1º A').textContent).toContain('Não lida'))
    expect(cartaoDe('1º A').textContent).not.toContain('Em dia')
  })

  it('a turma além das 12 e a que ficou sem ler depois da recusa por limite dizem "Não lida"; o número de uma turma lida pela metade é um piso', async () => {
    const rede = fakeNetwork()
    const treze = Array.from({ length: 13 }, (_, n) => ({ id: id(1000 + n), nome: `Turma ${String(n + 10)}` }))
    const pedidos: Record<string, Resposta> = {}
    for (const turma of treze) pedidos[turma.id] = ok([])
    instalar(rede, { vinculos: ok(treze.map((turma, n) => vinculo(n + 1, turma, MATEMATICA, 'confirmado'))), pedidos })
    montar()
    await screen.findByRole('region', { name: 'Suas turmas' })
    await waitFor(() => expect(cartaoDe('Turma 21').textContent).toContain('Em dia'), { timeout: 5_000 })
    // A 13ª, em ordem de nome, passa do teto de 12 e nunca é lida.
    expect(cartaoDe('Turma 22').textContent).toContain('Não lida')
    expect(cartaoDe('Turma 22').textContent).not.toContain('Em dia')
    expect(caminhosDe(rede)).not.toContain(reivindicacoes(treze[12]?.id ?? ''))
    cleanup()

    const limite = fakeNetwork()
    instalar(limite, { vinculos: ok([vinculo(1, TURMA_A, MATEMATICA, 'confirmado'), vinculo(2, TURMA_B, HISTORIA, 'confirmado')]), pedidos: { [TURMA_A.id]: erro(429, 'LIMITE_EXCEDIDO'), [TURMA_B.id]: ok([ANA]) } })
    montar()
    await screen.findByRole('region', { name: 'Suas turmas' })
    await waitFor(() => expect(cartaoDe('1º A').textContent).toContain('Não lida'))
    // Parou na recusa: a seguinte nem foi lida, e não diz "Em dia" nem soma pedido que não leu.
    expect(cartaoDe('2º B').textContent).toContain('Não lida')
    expect(caminhosDe(limite)).not.toContain(reivindicacoes(TURMA_B.id))
  })

  it('o número de uma turma que o sino leu pela metade é um piso ("ou mais"): a correção veio, os pedidos não', async () => {
    const rede = fakeNetwork()
    instalar(rede, { entregas: ok([entrega(1, TURMA_A.id, 'lote_de_correcao')]), vinculos: ok([vinculo(1, TURMA_A, MATEMATICA, 'confirmado')]), pedidos: { [TURMA_A.id]: erro(404, 'NAO_ENCONTRADO') } })
    montar()
    await screen.findByRole('region', { name: 'Suas turmas' })
    await waitFor(() => expect(cartaoDe('1º A').textContent).toContain('1 ou mais esperando você'))
  })

  it('os dois cartões da mesma turma abrem a mesma turma, e mostram a mesma espera', async () => {
    const rede = fakeNetwork()
    instalar(rede, {
      entregas: ok([entrega(1, TURMA_A.id, 'lote_de_correcao')]),
      vinculos: ok([vinculo(1, TURMA_A, MATEMATICA, 'confirmado'), vinculo(2, TURMA_A, HISTORIA, 'confirmado')]),
      pedidos: { [TURMA_A.id]: ok([]) },
    })
    montar()
    await screen.findByRole('region', { name: 'Suas turmas' })
    await waitFor(() => expect(cartaoDe('Matemática').textContent).toContain('1 esperando você'))
    expect(cartaoDe('História').textContent).toContain('1 esperando você')
    const destino = (texto: string) => within(cartaoDe(texto)).getByRole('link', { name: /Abrir a turma/ }).getAttribute('href')
    expect(destino('Matemática')).toBe(destino('História'))
    // E a turma é lida uma vez só, não uma por disciplina.
    expect(caminhosDe(rede).filter((caminho) => caminho === reivindicacoes(TURMA_A.id))).toHaveLength(1)
  })

  it('a faixa a confirmar não entra na soma do cartão da mesma turma', async () => {
    const rede = fakeNetwork()
    instalar(rede, {
      vinculos: ok([vinculo(1, TURMA_A, MATEMATICA, 'confirmado'), vinculo(2, TURMA_A, HISTORIA, 'pendente')]),
      pedidos: { [TURMA_A.id]: ok([]) },
    })
    montar()
    await screen.findByRole('region', { name: 'Suas turmas' })
    await waitFor(() => expect(cartaoDe('Matemática').textContent).toContain('Em dia'))
  })
})
