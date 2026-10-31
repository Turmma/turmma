// @vitest-environment jsdom
import type { AtividadeAplicada } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { consultaAtividadesAplicadas } from './api/atividades'
import { criarClienteDeConsultas } from '../../../api/query-client'
import { caminhoDaCorrecaoDoProfessor, caminhoDoArtefatoDoProfessor } from '../../../paths'
import { prepararTela, redeFalsa, type RedeFalsa, type RespostaFalsa } from '../../../__fixtures__/render-screen'
import * as textosDaTela from './aprovar'
import { AVISO_DA_AVALIATIVA_ABERTA, TEXTO_SEM_CORRECAO } from './aprovar'
import AtividadesDaTurma, {
  atividadeDoEndereco,
  enderecoComAAtividade,
  enderecoParaAplicar,
  estadoDaAtividade,
  FILTROS_DAS_ATIVIDADES,
  LIMITE_PARA_FILTRAR,
  maisNovaPrimeiro,
  oQueFazer,
  passaNoFiltro,
  SELO_DA_ATIVIDADE,
  type EstadoDaAtividade,
} from './AtividadesDaTurma'

/**
 * A aba Atividades da turma aberta (telas do professor, 11.0; RF17, RF22): uma linha por atividade com o estado em texto, o filtro
 * das listas longas e o painel ao lado, que mora no endereço. A rede é falsa e responde por caminho; a aba, o painel, o diálogo de
 * encerrar, o cliente de consultas e a rota são os de verdade. Encerrar com clique duplo, a troca de turma com a resposta
 * atrasada e a segunda pessoa na mesma aba ficam no e2e (`professor-turma-atividades.spec.ts`).
 */
prepararTela()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const TURMA = id(100)
const OUTRA_TURMA = id(101)
const SERIE = { id: id(110), etapa: 'ef_anos_finais', ano: 7 }

type Entrega = AtividadeAplicada['entrega']
const PENDENTE: Entrega = { id: id(900), estado: 'pendente' }
const APROVADA: Entrega = { id: id(901), estado: 'aprovada' }
const REJEITADA: Entrega = { id: id(902), estado: 'rejeitada' }

/** Uma atividade aplicada: `n` dá o id, o artefato e a hora (quanto maior, mais nova). */
function aplicada(n: number, campos: Partial<AtividadeAplicada> = {}): AtividadeAplicada {
  return {
    id: id(200 + n),
    artefatoId: id(300 + n),
    turmaId: TURMA,
    titulo: `Atividade ${String(n)} de estequiometria`,
    avaliativa: false,
    estado: 'encerrada',
    questoes: 5,
    aplicadaEm: `2026-10-${String(n).padStart(2, '0')}T13:00:00.000Z`,
    encerradaEm: `2026-10-${String(n).padStart(2, '0')}T13:50:00.000Z`,
    participacao: { alunos: 30, iniciaram: 28, enviaram: 26 },
    entrega: APROVADA,
    ...campos,
  }
}
/** Uma de cada situação que a lista distingue. */
const ABERTA = aplicada(1, { estado: 'aberta', encerradaEm: null, entrega: null, participacao: { alunos: 30, iniciaram: 12, enviaram: 10 } })
const AVALIATIVA = aplicada(2, { estado: 'aberta', avaliativa: true, encerradaEm: null, entrega: null, participacao: { alunos: 30, iniciaram: 0, enviaram: 0 } })
const PARA_REVISAR = aplicada(3, { entrega: PENDENTE })
const CORRIGIDA = aplicada(4, { entrega: APROVADA })
const LOTE_REJEITADO = aplicada(5, { entrega: REJEITADA })
const NINGUEM_RESPONDEU = aplicada(6, { entrega: null, participacao: { alunos: 30, iniciaram: 0, enviaram: 0 } })
const FUNCAO_SUSPENSA = aplicada(7, { entrega: null, participacao: { alunos: 30, iniciaram: 12, enviaram: 10 } })
const DAS_SITUACOES = [ABERTA, AVALIATIVA, PARA_REVISAR, CORRIGIDA, LOTE_REJEITADO, NINGUEM_RESPONDEU, FUNCAO_SUSPENSA]

const ok = (corpo: unknown): RespostaFalsa => ({ status: 200, corpo })
// Limite excedido não é repetido sozinho: o erro chega na hora, sem esperar a nova tentativa.
const FALHA: RespostaFalsa = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }
const VOCABULARIO_PROIBIDO = /\bnotas?\b|\bconceitos?\b|pontua|\bmédia\b|ranking|pódio/i

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  // O segmentado e o painel leem a largura da janela; o `jsdom` não tem `matchMedia` nem `ResizeObserver`. Janela larga, como a do Chromebook.
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(min-width: 768px)', media: consulta, addEventListener: () => undefined, removeEventListener: () => undefined }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})

interface Quem {
  /** O que a API devolve para a lista: a lista de itens, ou a resposta pronta (a falha, a leitura segurada). */
  readonly lista?: readonly AtividadeAplicada[] | ((caminho: string) => RespostaFalsa | Promise<RespostaFalsa>)
}

function instalar(rede: RedeFalsa, turma: string, { lista = [] }: Quem = {}): void {
  rede.responderPor('/v1/atividades-aplicadas', typeof lista === 'function' ? lista : () => ok({ itens: lista }))
  rede.responderPor(`/v1/turmas/${turma}`, ok({ id: turma, nome: turma === TURMA ? '7º A' : '8º B', serie: SERIE }))
}

function montar(quem: Quem = {}, busca = 'aba=atividades') {
  const rede = redeFalsa()
  instalar(rede, TURMA, quem)
  const localizacao = memoryLocation({ path: `/turmas/${TURMA}`, searchPath: busca, record: true })
  const cliente = criarClienteDeConsultas()
  const arvore = (turmaId: string) => (
    <QueryClientProvider client={cliente}>
      <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
        <AtividadesDaTurma turmaId={turmaId} />
      </Router>
    </QueryClientProvider>
  )
  const tela = render(arvore(TURMA))
  return { rede, localizacao, cliente, trocarDeTurma: (turmaId: string) => tela.rerender(arvore(turmaId)), ...tela }
}

const lista = () => screen.getByRole('region', { name: 'Atividades da turma' })
const linhaDe = (titulo: string) => within(lista()).getByRole('button', { name: new RegExp(titulo) })
const titulosDaLista = () => within(lista()).getAllByRole('listitem').map((item) => within(item).getByRole('button').querySelector('[title]')?.getAttribute('title'))
const chamadasA = (rede: RedeFalsa, caminho: string) => rede.chamadas.filter((chamada) => chamada.caminho.split('?')[0] === caminho)

describe('o estado de cada linha (D46, D55)', () => {
  it.each<[string, AtividadeAplicada, EstadoDaAtividade, string]>([
    ['aberta', ABERTA, 'aberta', 'Aberta'],
    ['encerrada com a correção por revisar', PARA_REVISAR, 'para_revisar', 'Correção para revisar'],
    ['encerrada com a correção aprovada', CORRIGIDA, 'aprovada', 'Correção aprovada'],
    ['encerrada com a correção rejeitada', LOTE_REJEITADO, 'rejeitada', 'Correção rejeitada'],
    ['encerrada sem ninguém ter respondido', NINGUEM_RESPONDEU, 'sem_correcao', 'Sem correção'],
    ['encerrada com a correção suspensa pela coordenação', FUNCAO_SUSPENSA, 'sem_correcao', 'Sem correção'],
  ])('%s: o estado, o selo em texto e o que fazer', (_nome, atividade, estado, selo) => {
    expect(estadoDaAtividade(atividade)).toBe(estado)
    expect(SELO_DA_ATIVIDADE[estado].texto).toBe(selo)
    expect(oQueFazer(atividade).length).toBeGreaterThan(20)
  })

  it('cada situação diz o que fazer com as palavras dela, e as que encerraram sem correção dizem por quê', () => {
    expect(oQueFazer(ABERTA)).toContain('encerre a atividade')
    expect(oQueFazer(PARA_REVISAR)).toContain('Revise os destaques e aprove')
    expect(oQueFazer(CORRIGIDA)).toContain('Você aprovou a correção')
    expect(oQueFazer(LOTE_REJEITADO)).toBe(TEXTO_SEM_CORRECAO.lote_rejeitado)
    expect(oQueFazer(NINGUEM_RESPONDEU)).toBe(TEXTO_SEM_CORRECAO.ninguem_respondeu)
    expect(oQueFazer(FUNCAO_SUSPENSA)).toBe(TEXTO_SEM_CORRECAO.correcao_suspensa)
  })

  it('na lista, cada linha mostra o título, a situação de hoje com quantos enviaram e o selo, sem número de acerto', async () => {
    montar({ lista: DAS_SITUACOES })
    await within(await screen.findByRole('region', { name: 'Atividades da turma' })).findByRole('button', { name: /Atividade 1 /u })
    const casos: [AtividadeAplicada, string, string][] = [
      [ABERTA, 'Aberta para a turma · prática · 10 de 30 alunos enviaram', 'Aberta'],
      [AVALIATIVA, 'Aberta para a turma · avaliativa · 0 de 30 alunos enviaram', 'Aberta'],
      [PARA_REVISAR, 'Encerrada · prática · 26 de 30 alunos enviaram', 'Correção para revisar'],
      [CORRIGIDA, 'Encerrada · prática · 26 de 30 alunos enviaram', 'Correção aprovada'],
      [LOTE_REJEITADO, 'Encerrada · prática · 26 de 30 alunos enviaram', 'Correção rejeitada'],
      [NINGUEM_RESPONDEU, 'Encerrada · prática · 0 de 30 alunos enviaram', 'Sem correção'],
      [FUNCAO_SUSPENSA, 'Encerrada · prática · 10 de 30 alunos enviaram', 'Sem correção'],
    ]
    for (const [atividade, situacao, selo] of casos) {
      const item = screen.getByText(atividade.titulo).closest('li')
      expect(item?.textContent, atividade.titulo).toContain(situacao)
      expect(item?.querySelector('[data-estado]')?.textContent, atividade.titulo).toBe(selo)
    }
  })
})

describe('os estados da aba (regra 50, item 5)', () => {
  it('carregando: diz que está lendo, e não afirma que não há atividade nem oferece aplicar', async () => {
    montar({ lista: () => new Promise(() => undefined) })
    expect(await screen.findByText('Carregando as atividades da turma…')).toBeTruthy()
    expect(screen.queryByText('Nenhuma atividade aplicada a esta turma')).toBeNull()
    expect(screen.queryByText('Nada com este filtro')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Aplicar uma atividade' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Aplicar uma atividade' })).toBeNull()
  })

  it('erro: mostra a falha com "Tentar de novo", nunca o vazio; o novo clique lê e mostra a lista', async () => {
    const usuario = userEvent.setup()
    let falhando = true
    montar({ lista: () => (falhando ? FALHA : ok({ itens: [CORRIGIDA] })) })
    await screen.findByRole('alert')
    expect(screen.queryByText('Nenhuma atividade aplicada a esta turma')).toBeNull()
    falhando = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await within(lista()).findByRole('button', { name: /Atividade 4 / })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('vazio: diz o que aparece aqui e leva a Criados, já com a turma e o tipo no endereço, sem nome de aluno', async () => {
    const usuario = userEvent.setup()
    const { localizacao } = montar({ lista: [] })
    expect(await screen.findByText('Nenhuma atividade aplicada a esta turma')).toBeTruthy()
    expect(screen.getByText(/Abra uma atividade objetiva em Criados/)).toBeTruthy()
    // Uma ação só: o convite do vazio, e não o botão do cabeçalho junto.
    expect(screen.getAllByText('Aplicar uma atividade')).toHaveLength(1)
    expect(screen.queryByRole('radiogroup')).toBeNull()
    // Lista vazia não é filtro sem resultado: só o convite de aplicar.
    expect(screen.queryByText('Nada com este filtro')).toBeNull()
    await usuario.click(screen.getByRole('button', { name: 'Aplicar uma atividade' }))
    expect(localizacao.history.at(-1)).toBe(`/criados?tipo=atividade_objetiva&turma=${TURMA}`)
  })

  it('com dado: o cabeçalho leva a Criados com a turma e o tipo; a lista mais nova primeiro, e não pelo que os alunos enviaram', async () => {
    montar({ lista: [CORRIGIDA, ABERTA, NINGUEM_RESPONDEU, PARA_REVISAR] })
    await within(await screen.findByRole('region', { name: 'Atividades da turma' })).findByRole('button', { name: /Atividade 4 / })
    const aplicar = screen.getByRole('link', { name: 'Aplicar uma atividade' })
    expect(aplicar.getAttribute('href')).toBe(`/criados?tipo=atividade_objetiva&turma=${TURMA}`)
    // Do dia 6 ao 1. Quem enviou mais (26 de 30, nos dias 3 e 4) não vai à frente de quem enviou menos (0 de 30, no dia 6).
    expect(titulosDaLista()).toEqual(['Atividade 6 de estequiometria', 'Atividade 4 de estequiometria', 'Atividade 3 de estequiometria', 'Atividade 1 de estequiometria'])
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('o endereço de aplicar leva só ids e valor de lista fechada', () => {
    expect(enderecoParaAplicar(TURMA)).toBe(`/criados?tipo=atividade_objetiva&turma=${TURMA}`)
  })
})

describe('o filtro das listas longas', () => {
  const MUITAS = Array.from({ length: LIMITE_PARA_FILTRAR + 1 }, (_, n) => aplicada(10 + n, n % 3 === 0 ? { estado: 'aberta', encerradaEm: null, entrega: null } : { entrega: n % 3 === 1 ? PENDENTE : APROVADA }))

  it('com até oito linhas não há filtro; com mais de oito, o filtro tem as quatro opções, em ordem', async () => {
    const { unmount } = montar({ lista: MUITAS.slice(0, LIMITE_PARA_FILTRAR) })
    await within(await screen.findByRole('region', { name: 'Atividades da turma' })).findByRole('button', { name: /Atividade 10 / })
    expect(screen.queryByRole('radiogroup', { name: 'Filtrar as atividades' })).toBeNull()
    unmount()

    montar({ lista: MUITAS })
    const filtro = await screen.findByRole('radiogroup', { name: 'Filtrar as atividades' })
    expect(within(filtro).getAllByRole('radio').map((opcao) => opcao.textContent)).toEqual(['Todas', 'Abertas', 'Para revisar', 'Encerradas'])
    expect(FILTROS_DAS_ATIVIDADES.map((opcao) => opcao.rotulo)).toEqual(['Todas', 'Abertas', 'Para revisar', 'Encerradas'])
    expect(within(filtro).getByRole('radio', { name: 'Todas' }).getAttribute('aria-checked')).toBe('true')
    expect(within(lista()).getAllByRole('listitem')).toHaveLength(MUITAS.length)
  })

  it('cada opção deixa passar só o que o nome diz', async () => {
    const usuario = userEvent.setup()
    montar({ lista: MUITAS })
    const filtro = await screen.findByRole('radiogroup', { name: 'Filtrar as atividades' })
    const estados = () => within(lista()).getAllByRole('listitem').map((item) => item.getAttribute('data-estado-da-atividade'))

    await usuario.click(within(filtro).getByRole('radio', { name: 'Abertas' }))
    expect(new Set(estados())).toEqual(new Set(['aberta']))
    expect(estados()).toHaveLength(MUITAS.filter((a) => a.estado === 'aberta').length)
    await usuario.click(within(filtro).getByRole('radio', { name: 'Para revisar' }))
    expect(new Set(estados())).toEqual(new Set(['para_revisar']))
    expect(estados()).toHaveLength(MUITAS.filter((a) => a.entrega?.estado === 'pendente').length)
    await usuario.click(within(filtro).getByRole('radio', { name: 'Encerradas' }))
    expect(estados().sort()).toEqual(MUITAS.filter((a) => a.estado === 'encerrada').map((a) => estadoDaAtividade(a)).sort())
    expect(estados()).not.toContain('aberta')
    await usuario.click(within(filtro).getByRole('radio', { name: 'Todas' }))
    expect(estados()).toHaveLength(MUITAS.length)
  })

  it('filtro sem resultado diz isso, com "Limpar filtro", que devolve a lista e o foco ao filtro', async () => {
    const usuario = userEvent.setup()
    // Nove encerradas e aprovadas: "Abertas" e "Para revisar" não deixam nada passar.
    montar({ lista: Array.from({ length: LIMITE_PARA_FILTRAR + 1 }, (_, n) => aplicada(10 + n)) })
    const filtro = await screen.findByRole('radiogroup', { name: 'Filtrar as atividades' })
    await usuario.click(within(filtro).getByRole('radio', { name: 'Para revisar' }))
    expect(screen.getByText('Nada com este filtro')).toBeTruthy()
    expect(within(lista()).queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.queryByText('Nenhuma atividade aplicada a esta turma')).toBeNull()

    await usuario.click(screen.getByRole('button', { name: 'Limpar filtro' }))
    expect(screen.queryByText('Nada com este filtro')).toBeNull()
    expect(within(lista()).getAllByRole('listitem')).toHaveLength(LIMITE_PARA_FILTRAR + 1)
    expect(within(filtro).getByRole('radio', { name: 'Todas' }).getAttribute('aria-checked')).toBe('true')
    await waitFor(() => expect(document.activeElement).toBe(within(filtro).getByRole('radio', { name: 'Todas' })))
  })

  it('a lista que encolhe até o limite com um filtro escolhido volta inteira, sem o filtro na tela e sem lista presa a ele', async () => {
    const usuario = userEvent.setup()
    // Nove encerradas e aprovadas: "Abertas" não deixa nada passar.
    const nove = Array.from({ length: LIMITE_PARA_FILTRAR + 1 }, (_, n) => aplicada(10 + n))
    let itens = nove
    const { cliente } = montar({ lista: () => ok({ itens }) })
    await usuario.click(within(await screen.findByRole('radiogroup', { name: 'Filtrar as atividades' })).getByRole('radio', { name: 'Abertas' }))
    expect(screen.getByText('Nada com este filtro')).toBeTruthy()

    // A releitura traz oito: o filtro some, e as oito aparecem, mesmo com "Abertas" ainda guardado.
    itens = nove.slice(0, LIMITE_PARA_FILTRAR)
    await act(() => cliente.invalidateQueries({ queryKey: consultaAtividadesAplicadas(TURMA).queryKey }))
    await waitFor(() => expect(within(lista()).getAllByRole('listitem')).toHaveLength(LIMITE_PARA_FILTRAR))
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByText('Nada com este filtro')).toBeNull()
  })

  it('o filtro é desta aba, e não do endereço; escolher uma opção não fecha o painel aberto', async () => {
    const usuario = userEvent.setup()
    const { localizacao } = montar({ lista: MUITAS }, `aba=atividades&atividade=${MUITAS[0]?.id}`)
    const aberto = await screen.findByRole('dialog', { name: MUITAS[0]?.titulo ?? '' })
    await usuario.click(within(await screen.findByRole('radiogroup', { name: 'Filtrar as atividades', hidden: true })).getByRole('radio', { name: 'Encerradas', hidden: true }))
    expect(screen.getByRole('dialog', { name: MUITAS[0]?.titulo ?? '' })).toBe(aberto)
    expect(localizacao.history).toEqual([`/turmas/${TURMA}?aba=atividades&atividade=${MUITAS[0]?.id}`])
  })

  it('as funções do filtro: cada opção, e a lista mais nova primeiro com o id desempatando', () => {
    expect(DAS_SITUACOES.filter((a) => passaNoFiltro(a, 'todas'))).toHaveLength(7)
    expect(DAS_SITUACOES.filter((a) => passaNoFiltro(a, 'abertas')).map((a) => a.id)).toEqual([ABERTA.id, AVALIATIVA.id])
    expect(DAS_SITUACOES.filter((a) => passaNoFiltro(a, 'para_revisar')).map((a) => a.id)).toEqual([PARA_REVISAR.id])
    expect(DAS_SITUACOES.filter((a) => passaNoFiltro(a, 'encerradas'))).toHaveLength(5)
    const igual = { aplicadaEm: '2026-10-05T13:00:00.000Z' }
    const a = { id: id(1), ...igual }
    const b = { id: id(2), ...igual }
    const antiga = { id: id(3), aplicadaEm: '2026-10-04T13:00:00.000Z' }
    expect(maisNovaPrimeiro([antiga, a, b]).map((x) => x.id)).toEqual([id(2), id(1), id(3)])
  })
})

describe('o painel da atividade pelo endereço', () => {
  it('?atividade=<id> abre o painel com a situação, o que fazer e as ações; recarregar o abre de novo', async () => {
    montar({ lista: [PARA_REVISAR, CORRIGIDA] }, `aba=atividades&atividade=${PARA_REVISAR.id}`)
    const aberto = await screen.findByRole('dialog', { name: PARA_REVISAR.titulo })
    // O foco começa no miolo do painel, para quem abre ler o que há nele: nada o leva ao bloco "O que fazer" na abertura.
    expect(document.activeElement).toBe(aberto.querySelector('[data-painel-miolo]'))
    expect(aberto.textContent).toContain('Encerrada · prática · 26 de 30 alunos enviaram')
    expect(aberto.textContent).toContain('7º A · aplicada em')
    expect(within(aberto).getByText(oQueFazer(PARA_REVISAR))).toBeTruthy()
    expect(within(aberto).getByRole('link', { name: 'Abrir a atividade' }).getAttribute('href')).toBe(caminhoDoArtefatoDoProfessor(PARA_REVISAR.artefatoId))
    expect(within(aberto).getByRole('link', { name: 'Revisar a correção' }).getAttribute('href')).toBe(caminhoDaCorrecaoDoProfessor(PARA_REVISAR.id))
    // A lista segue por trás, com as duas linhas.
    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(2)
  })

  it('abrir pela linha põe o id no endereço, e a atividade de outra turma, a inexistente e o id sem sentido não abrem painel: a lista segue', async () => {
    const usuario = userEvent.setup()
    const { localizacao, unmount } = montar({ lista: [PARA_REVISAR, CORRIGIDA] })
    await usuario.click(await within(await screen.findByRole('region', { name: 'Atividades da turma' })).findByRole('button', { name: /Atividade 3 / }))
    expect(localizacao.history.at(-1)).toBe(`/turmas/${TURMA}?aba=atividades&atividade=${PARA_REVISAR.id}`)
    expect(await screen.findByRole('dialog', { name: PARA_REVISAR.titulo })).toBeTruthy()
    unmount()

    for (const alheio of [id(999), aplicada(40, { turmaId: OUTRA_TURMA }).id, 'qualquer-coisa', '']) {
      const { unmount: sair } = montar({ lista: [PARA_REVISAR, CORRIGIDA] }, `aba=atividades&atividade=${alheio}`)
      await within(await screen.findByRole('region', { name: 'Atividades da turma' })).findByRole('button', { name: /Atividade 3 / })
      expect(screen.queryByRole('dialog'), alheio).toBeNull()
      expect(within(lista()).getAllByRole('listitem')).toHaveLength(2)
      sair()
    }
  })

  it('Esc fecha o painel, tira o parâmetro do endereço sem empilhar histórico e devolve o foco à linha que o abriu', async () => {
    const usuario = userEvent.setup()
    const { localizacao } = montar({ lista: [PARA_REVISAR, CORRIGIDA] })
    const linha = await within(await screen.findByRole('region', { name: 'Atividades da turma' })).findByRole('button', { name: /Atividade 3 / })
    await usuario.click(linha)
    fireEvent(await screen.findByRole('dialog', { name: PARA_REVISAR.titulo }), new Event('cancel', { cancelable: true }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(localizacao.history.at(-1)).toBe(`/turmas/${TURMA}?aba=atividades`)
    // Abrir foi um passo (a base e o painel), e fechar trocou o painel pela base: dois passos, e não três (`replace`).
    expect(localizacao.history).toHaveLength(2)
    expect(atividadeDoEndereco(localizacao.history.at(-1)?.split('?')[1] ?? '')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(linha))
  })

  it('duas atividades com o mesmo título abrem painéis diferentes, pelo id de cada uma', async () => {
    const usuario = userEvent.setup()
    // A mesma atividade aplicada duas vezes (prática e depois avaliativa): o título é igual, a situação e o id não.
    const primeira = aplicada(5, { titulo: 'Atividade repetida', entrega: PENDENTE })
    const segunda = aplicada(6, { titulo: 'Atividade repetida', estado: 'aberta', avaliativa: true, encerradaEm: null, entrega: null })
    const { localizacao } = montar({ lista: [primeira, segunda] })
    const linhas = await within(await screen.findByRole('region', { name: 'Atividades da turma' })).findAllByRole('button', { name: /Atividade repetida/ })
    expect(linhas).toHaveLength(2)

    // A mais nova primeiro: a segunda (aberta e avaliativa) é a de cima.
    await usuario.click(linhas[1] as HTMLElement)
    const doPainel = await screen.findByRole('dialog', { name: 'Atividade repetida' })
    expect(localizacao.history.at(-1)).toContain(`atividade=${primeira.id}`)
    expect(within(doPainel).getByRole('link', { name: 'Revisar a correção' })).toBeTruthy()
    expect(within(doPainel).queryByRole('button', { name: 'Encerrar a atividade' })).toBeNull()
    await usuario.click(within(doPainel).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await usuario.click((await within(lista()).findAllByRole('button', { name: /Atividade repetida/ }))[0] as HTMLElement)
    const daSegunda = await screen.findByRole('dialog', { name: 'Atividade repetida' })
    expect(localizacao.history.at(-1)).toContain(`atividade=${segunda.id}`)
    expect(within(daSegunda).getByRole('button', { name: 'Encerrar a atividade' })).toBeTruthy()
    expect(within(daSegunda).queryByRole('link', { name: 'Revisar a correção' })).toBeNull()
  })

  it('o painel aberto pelo endereço devolve o foco à linha dele ao fechar, e não ao corpo da página', async () => {
    const usuario = userEvent.setup()
    montar({ lista: [PARA_REVISAR, CORRIGIDA] }, `aba=atividades&atividade=${CORRIGIDA.id}`)
    const aberto = await screen.findByRole('dialog', { name: CORRIGIDA.titulo })
    await usuario.click(within(aberto).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(linhaDe('Atividade 4 ')))
  })

  it('as funções do endereço: pôr e tirar o id sem mexer nos outros parâmetros', () => {
    expect(enderecoComAAtividade('/turmas/x', 'aba=atividades', id(1))).toBe(`/turmas/x?aba=atividades&atividade=${id(1)}`)
    expect(enderecoComAAtividade('/turmas/x', `aba=atividades&atividade=${id(1)}`, null)).toBe('/turmas/x?aba=atividades')
    expect(enderecoComAAtividade('/turmas/x', `aba=atividades&atividade=${id(1)}&item=a`, id(2))).toBe(`/turmas/x?aba=atividades&atividade=${id(2)}&item=a`)
    // A aba vai junto mesmo quando o endereço não a trazia: o painel pertence a Atividades.
    expect(enderecoComAAtividade('/turmas/x', '', id(1))).toBe(`/turmas/x?aba=atividades&atividade=${id(1)}`)
    expect(atividadeDoEndereco('aba=atividades')).toBeNull()
    expect(atividadeDoEndereco(`atividade=${id(1)}`)).toBe(id(1))
  })
})

describe('as ações do painel', () => {
  async function abrirPainelDe(atividade: AtividadeAplicada, outras: readonly AtividadeAplicada[] = []) {
    const montada = montar({ lista: [atividade, ...outras] }, `aba=atividades&atividade=${atividade.id}`)
    return { ...montada, aberto: await screen.findByRole('dialog', { name: atividade.titulo }) }
  }

  it('a aberta tem "Encerrar a atividade" e nada de correção; a avaliativa aberta diz que o Tutor está pausado', async () => {
    const { aberto, unmount } = await abrirPainelDe(ABERTA)
    expect(within(aberto).getByRole('button', { name: 'Encerrar a atividade' })).toBeTruthy()
    expect(within(aberto).queryByRole('link', { name: /correção/ })).toBeNull()
    expect(within(aberto).queryByRole('button', { name: 'Corrigir de novo' })).toBeNull()
    expect(within(aberto).queryByText(AVISO_DA_AVALIATIVA_ABERTA)).toBeNull()
    expect(aberto.textContent).toContain('aplicada em')
    expect(aberto.textContent).not.toContain('encerrada em')
    unmount()

    const { aberto: avaliativa } = await abrirPainelDe(AVALIATIVA)
    expect(within(avaliativa).getByText(AVISO_DA_AVALIATIVA_ABERTA)).toBeTruthy()
  })

  it('a encerrada não se encerra de novo, e a avaliativa já encerrada não fala mais do Tutor pausado', async () => {
    const { aberto } = await abrirPainelDe(aplicada(8, { avaliativa: true, entrega: PENDENTE }))
    expect(within(aberto).queryByRole('button', { name: 'Encerrar a atividade' })).toBeNull()
    expect(within(aberto).queryByText(AVISO_DA_AVALIATIVA_ABERTA)).toBeNull()
    expect(within(aberto).getByText(/encerrada em/)).toBeTruthy()
  })

  it.each<[string, AtividadeAplicada, string | null]>([
    ['com a correção por revisar: "Revisar a correção"', PARA_REVISAR, 'Revisar a correção'],
    ['com a correção aprovada: "Ver a correção"', CORRIGIDA, 'Ver a correção'],
    ['com a correção rejeitada: "Ver a correção"', LOTE_REJEITADO, 'Ver a correção'],
    ['sem correção (ninguém respondeu): nenhum link de correção', NINGUEM_RESPONDEU, null],
  ])('%s', async (_nome, atividade, rotulo) => {
    const { aberto } = await abrirPainelDe(atividade)
    const links = within(aberto).queryAllByRole('link', { name: /correção/ })
    if (rotulo === null) expect(links).toEqual([])
    else expect(links.map((link) => link.textContent)).toEqual([rotulo])
  })

  it('"Corrigir de novo" só existe quando a atividade encerrou sem correção que valha: a função suspensa e o lote rejeitado', async () => {
    for (const [atividade, tem] of [
      [FUNCAO_SUSPENSA, true],
      [LOTE_REJEITADO, true],
      [NINGUEM_RESPONDEU, false],
      [PARA_REVISAR, false],
      [CORRIGIDA, false],
      [ABERTA, false],
    ] as const) {
      const { aberto, unmount } = await abrirPainelDe(atividade)
      expect(within(aberto).queryByRole('button', { name: 'Corrigir de novo' }) !== null, atividade.titulo).toBe(tem)
      unmount()
    }
  })

  it('"Corrigir de novo" pede a correção uma vez, sem confirmação, e a professora lê no painel que ela ficou esperando', async () => {
    const usuario = userEvent.setup()
    let itens: AtividadeAplicada[] = [FUNCAO_SUSPENSA]
    const { rede } = montar({ lista: () => ok({ itens }) }, `aba=atividades&atividade=${FUNCAO_SUSPENSA.id}`)
    const aberto = await screen.findByRole('dialog', { name: FUNCAO_SUSPENSA.titulo })
    const corrigida = { ...FUNCAO_SUSPENSA, entrega: PENDENTE }
    rede.responderPor(`/v1/atividades-aplicadas/${FUNCAO_SUSPENSA.id}/encerrar`, () => {
      itens = [corrigida]
      return ok({ atividade: corrigida, execucaoId: id(700) })
    })
    await usuario.click(within(aberto).getByRole('button', { name: 'Corrigir de novo' }))

    expect(await within(aberto).findByText('Correção feita. Ela está esperando você revisar.')).toBeTruthy()
    expect(chamadasA(rede, `/v1/atividades-aplicadas/${FUNCAO_SUSPENSA.id}/encerrar`)).toHaveLength(1)
    // A lista foi relida: a linha agora é a da correção por revisar, e o painel passou a ter o link para revisá-la.
    expect(await within(aberto).findByRole('link', { name: 'Revisar a correção' })).toBeTruthy()
    expect(within(aberto).queryByRole('button', { name: 'Corrigir de novo' })).toBeNull()
    // O botão que tinha o foco saiu com a correção: o foco não se perde no corpo da página.
    await waitFor(() => expect(aberto.contains(document.activeElement)).toBe(true))
  })

  it('"Corrigir de novo" com dois cliques no mesmo instante manda um pedido só, o botão diz "Corrigindo…" enquanto o pedido está no ar, e a função ainda suspensa é dita no painel', async () => {
    const { rede } = montar({ lista: [FUNCAO_SUSPENSA] }, `aba=atividades&atividade=${FUNCAO_SUSPENSA.id}`)
    const aberto = await screen.findByRole('dialog', { name: FUNCAO_SUSPENSA.titulo })
    let liberar: (resposta: RespostaFalsa) => void = () => undefined
    rede.responderPor(`/v1/atividades-aplicadas/${FUNCAO_SUSPENSA.id}/encerrar`, () => new Promise<RespostaFalsa>((resolver) => (liberar = resolver)))
    const botao = within(aberto).getByRole('button', { name: 'Corrigir de novo' })
    // Os dois cliques no mesmo lote de atualizações: o botão ainda não desligou quando o segundo chega.
    act(() => {
      fireEvent.click(botao)
      fireEvent.click(botao)
    })
    expect(((await within(aberto).findByRole('button', { name: 'Corrigindo…' })) as HTMLButtonElement).disabled).toBe(true)
    expect(chamadasA(rede, `/v1/atividades-aplicadas/${FUNCAO_SUSPENSA.id}/encerrar`)).toHaveLength(1)

    // A coordenação ainda não retomou a função: a atividade continua sem correção, e o painel diz por quê.
    liberar(ok({ atividade: FUNCAO_SUSPENSA, execucaoId: null }))
    await waitFor(() => expect(within(aberto).getByRole('status').textContent).toBe(TEXTO_SEM_CORRECAO.correcao_suspensa))
    expect(within(aberto).getByRole('button', { name: 'Corrigir de novo' })).toBeTruthy()
  })

  it('a releitura da lista que falha com a lista na tela não a troca pelo erro', async () => {
    let falhando = false
    const { cliente } = montar({ lista: () => (falhando ? FALHA : ok({ itens: [CORRIGIDA] })) })
    await within(await screen.findByRole('region', { name: 'Atividades da turma' })).findByRole('button', { name: /Atividade 4 / })
    falhando = true
    await act(async () => {
      await cliente.invalidateQueries()
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(within(lista()).getByRole('button', { name: /Atividade 4 / })).toBeTruthy()
  })

  it('"Corrigir de novo" que falha diz a falha em português dentro do painel, e o botão volta', async () => {
    const usuario = userEvent.setup()
    const { rede, aberto } = await abrirPainelDe(LOTE_REJEITADO)
    rede.responderPor(`/v1/atividades-aplicadas/${LOTE_REJEITADO.id}/encerrar`, FALHA)
    await usuario.click(within(aberto).getByRole('button', { name: 'Corrigir de novo' }))
    expect((await within(aberto).findByRole('alert')).textContent?.length).toBeGreaterThan(10)
    expect(within(aberto).queryByText(/LIMITE_EXCEDIDO/)).toBeNull()
    expect(within(aberto).getByRole('button', { name: 'Corrigir de novo' })).toBeTruthy()
  })

  it('"Encerrar a atividade" abre a confirmação com a atividade, a turma pelo nome e quantos enviaram, e o que acontece antes; fechar não manda nada', async () => {
    const usuario = userEvent.setup()
    const { rede, aberto } = await abrirPainelDe(ABERTA)
    await usuario.click(within(aberto).getByRole('button', { name: 'Encerrar a atividade' }))
    const confirmacao = await screen.findByRole('alertdialog', { name: 'Encerrar a atividade' })
    expect(confirmacao.textContent).toContain(ABERTA.titulo)
    expect(confirmacao.textContent).toContain('7º A')
    expect(confirmacao.textContent).toContain('10 de 30 alunos')
    expect(confirmacao.textContent).toContain(textosDaTela.EFEITO_DE_ENCERRAR)
    await usuario.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(chamadasA(rede, `/v1/atividades-aplicadas/${ABERTA.id}/encerrar`)).toHaveLength(0)
  })

  it('encerrar pelo painel: o pedido sai, a lista é relida, a atividade vira "Correção para revisar" e o foco vai ao painel, e não ao corpo da página', async () => {
    const usuario = userEvent.setup()
    let itens: AtividadeAplicada[] = [ABERTA]
    const montada = montar({ lista: () => ok({ itens }) }, `aba=atividades&atividade=${ABERTA.id}`)
    const aberto = await screen.findByRole('dialog', { name: ABERTA.titulo })
    const encerrada = { ...ABERTA, estado: 'encerrada' as const, encerradaEm: '2026-10-05T13:50:00.000Z', entrega: PENDENTE }
    montada.rede.responderPor(`/v1/atividades-aplicadas/${ABERTA.id}/encerrar`, () => {
      itens = [encerrada]
      return ok({ atividade: encerrada, execucaoId: id(701) })
    })
    await usuario.click(within(aberto).getByRole('button', { name: 'Encerrar a atividade' }))
    const confirmacao = await screen.findByRole('alertdialog', { name: 'Encerrar a atividade' })
    await usuario.click(within(confirmacao).getByRole('button', { name: 'Encerrar a atividade' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(await within(aberto).findByRole('link', { name: 'Revisar a correção' })).toBeTruthy()
    expect(within(aberto).queryByRole('button', { name: 'Encerrar a atividade' })).toBeNull()
    expect(document.querySelector('[data-estado-da-atividade="para_revisar"]')).not.toBeNull()
    expect(chamadasA(montada.rede, `/v1/atividades-aplicadas/${ABERTA.id}/encerrar`)).toHaveLength(1)
    await waitFor(() => expect(aberto.contains(document.activeElement)).toBe(true))
    expect(document.activeElement).not.toBe(document.body)
  })
})

describe('trocar de turma recomeça a aba', () => {
  it('o filtro e o painel da turma anterior não passam para a seguinte, e a seguinte lê a lista dela', async () => {
    const usuario = userEvent.setup()
    const muitas = Array.from({ length: LIMITE_PARA_FILTRAR + 1 }, (_, n) => aplicada(10 + n))
    const daOutra = aplicada(30, { turmaId: OUTRA_TURMA, titulo: 'Atividade da outra turma' })
    const { rede, trocarDeTurma } = montar({ lista: (caminho) => ok({ itens: caminho.includes(`turmaId=${OUTRA_TURMA}`) ? [daOutra] : muitas }) }, `aba=atividades&atividade=${muitas[0]?.id}`)
    await screen.findByRole('dialog', { name: muitas[0]?.titulo ?? '' })
    await usuario.click(within(await screen.findByRole('radiogroup', { name: 'Filtrar as atividades', hidden: true })).getByRole('radio', { name: 'Abertas', hidden: true }))
    expect(screen.getByText('Nada com este filtro')).toBeTruthy()

    rede.responderPor(`/v1/turmas/${OUTRA_TURMA}`, ok({ id: OUTRA_TURMA, nome: '8º B', serie: SERIE }))
    trocarDeTurma(OUTRA_TURMA)

    expect(await within(lista()).findByRole('button', { name: /Atividade da outra turma/ })).toBeTruthy()
    expect(screen.queryByText('Nada com este filtro')).toBeNull()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(lista()).getAllByRole('listitem')).toHaveLength(1)

    // Voltar à turma da lista longa: o filtro que a professora deixou nela não volta, é "Todas" outra vez.
    trocarDeTurma(TURMA)
    await waitFor(() => expect(within(lista()).getAllByRole('listitem')).toHaveLength(muitas.length))
    expect(screen.queryByText('Nada com este filtro')).toBeNull()
    expect(within(screen.getByRole('radiogroup', { name: 'Filtrar as atividades' })).getByRole('radio', { name: 'Todas' }).getAttribute('aria-checked')).toBe('true')
  })
})

describe('é diagnóstico, não nota: nenhum texto da aba fala em nota, média, conceito nem pontuação, e nada ordena por acerto (D46, D55, D69)', () => {
  it('os textos fixos e os que cada situação gera', () => {
    const gerados = DAS_SITUACOES.flatMap((atividade) => [oQueFazer(atividade), SELO_DA_ATIVIDADE[estadoDaAtividade(atividade)].texto, textosDaTela.situacaoDaAplicacao(atividade)])
    const fixos = [...FILTROS_DAS_ATIVIDADES.map((opcao) => opcao.rotulo), AVISO_DA_AVALIATIVA_ABERTA, ...Object.values(TEXTO_SEM_CORRECAO)]
    expect(gerados.length).toBeGreaterThan(15)
    for (const texto of [...gerados, ...fixos]) expect(texto).not.toMatch(VOCABULARIO_PROIBIDO)
  })

  it('a lista inteira e o painel aberto, com uma atividade de cada situação, não dizem nada disso nem de discursiva', async () => {
    montar({ lista: DAS_SITUACOES }, `aba=atividades&atividade=${PARA_REVISAR.id}`)
    await screen.findByRole('dialog', { name: PARA_REVISAR.titulo })
    const texto = document.body.textContent ?? ''
    expect(texto).toContain('Correção para revisar')
    expect(texto).not.toMatch(VOCABULARIO_PROIBIDO)
    expect(texto).not.toMatch(/discursiva|redação|acerto médio|abaixo de 6|\d+%|prazo|agendada/i)
  })

  it('a lista de palavras proibidas pega cada uma delas', () => {
    for (const palavra of ['nota', 'conceito', 'pontuação', 'média', 'ranking', 'pódio']) expect(palavra).toMatch(VOCABULARIO_PROIBIDO)
  })
})
