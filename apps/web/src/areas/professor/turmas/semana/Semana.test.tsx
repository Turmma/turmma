// @vitest-environment jsdom
import { ROTULOS_DA_SEMANA, type AulaDaSemana, type DiaDaSemana, type ItemDoDia, type SemanaResponse } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../../../api/query-client'
import { fakeNetwork, setupScreen, type FakeNetwork, type FakeResponse } from '../../../../__fixtures__/render-screen'
import Semana from './Semana'
import { somarDias } from './semana'

/**
 * A aba Semana, com a rede falsa e a tela, o cliente de consultas e o endereço de verdade (6.0; RF1 a RF4, RF12): as colunas e o dia por vez, os
 * quatro estados, a navegação presa ao ano, o filtro e a semana fora do ano. O relógio é fixo (terça, 10/11/2026, 12h em São Paulo), só a `Date`: o
 * cliente de consultas continua com os temporizadores de verdade.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const HOJE = '2026-11-10'
const SEGUNDA = '2026-11-09'
const ANO = { inicio: '2026-02-02', fim: '2026-12-18' }
const TURMA_A = { id: id(101), nome: '7ºA' }
const MATEMATICA = { id: id(500), nome: 'Matemática' }
const HISTORIA = { id: id(501), nome: 'História' }

const aula = (extra: Partial<AulaDaSemana> = {}): AulaDaSemana => ({
  vinculoId: id(401),
  turmaId: TURMA_A.id,
  turma: TURMA_A.nome,
  disciplinaId: MATEMATICA.id,
  disciplina: MATEMATICA.nome,
  inicio: '07:30',
  fim: '08:20',
  sala: null,
  texto: null,
  foraDaGrade: false,
  ...extra,
})

const itemDoDia = (extra: Partial<ItemDoDia> = {}): ItemDoDia => ({ tipo: 'aplicada', turmaId: TURMA_A.id, disciplinaId: MATEMATICA.id, atividadeAplicadaId: id(700), titulo: 'Atividade de frações', ...extra })

/** Os cinco dias úteis da semana da segunda dada, com as aulas por data. */
const semanaDe = (segunda: string, aulas: Readonly<Record<string, readonly AulaDaSemana[]>> = {}): DiaDaSemana[] =>
  [0, 1, 2, 3, 4].map((deslocamento) => {
    const data = somarDias(segunda, deslocamento)
    return { data, eventos: [], aulas: [...(aulas[data] ?? [])], itens: [] }
  })

const resposta = (extra: Partial<SemanaResponse> = {}): SemanaResponse => ({ ano: ANO, hoje: HOJE, agora: '09:00', gradeImportada: true, calendarioImportado: true, dias: semanaDe(SEGUNDA), ...extra })
const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const vinculo = (n: number, disciplina: { id: string; nome: string }, estado: string) => ({ id: id(400 + n), turma: TURMA_A, disciplina, estado })

/** A rede falsa, já com a renovação da sessão: o relógio de mentira (10/11) passou da validade do token que `setupScreen` abriu na data de verdade. */
function criarRede(): FakeNetwork {
  const nova = fakeNetwork()
  nova.responderPor('/v1/sessao/renovar', () => ok({ token: 'token-renovado', expiraEm: new Date(Date.now() + 600_000).toISOString() }))
  return nova
}

const segundaPedida = (caminho: string) => new URL(caminho, 'http://x').searchParams.get('segunda') ?? ''
const leiturasDaSemana = (rede: FakeNetwork) => rede.chamadas.filter((chamada) => chamada.caminho.startsWith('/v1/semana')).map((chamada) => segundaPedida(chamada.caminho))

function celular(): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: false, media: consulta, addEventListener: () => undefined, removeEventListener: () => undefined }))
}
function computador(): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(min-width: 768px)', media: consulta, addEventListener: () => undefined, removeEventListener: () => undefined }))
}

/** `semana` responde por segunda-feira: a que o teste não citou devolve a semana sem aula. */
function instalar(rede: FakeNetwork, porSegunda: Readonly<Record<string, SemanaResponse>> = {}, vinculos: readonly unknown[] = []): void {
  rede.responderPor('/v1/meus-vinculos', ok({ itens: vinculos }))
  rede.responderPor('/v1/semana', (caminho) => {
    const segunda = segundaPedida(caminho)
    return ok(porSegunda[segunda] ?? resposta({ dias: semanaDe(segunda) }))
  })
}

function montar() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <Semana />
    </QueryClientProvider>,
  )
}

const endereco = () => window.location.pathname + window.location.search
const diasNaTela = () => [...document.querySelectorAll('[data-dia]')].map((dia) => dia.getAttribute('data-dia'))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
  window.history.replaceState(null, '', '/professor/turmas?ver=semana')
  // O clique no cartão abre o painel da aula (7.0), um `dialog` modal que o `jsdom` não implementa.
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
  window.history.replaceState(null, '', '/')
})

describe('Semana: o computador mostra as colunas, o celular um dia por vez', () => {
  it('no computador, uma coluna por dia da semana de hoje, com "Hoje" em texto e os cartões pelo nome acessível', async () => {
    computador()
    const rede = criarRede()
    instalar(rede, { [SEGUNDA]: resposta({ dias: semanaDe(SEGUNDA, { [HOJE]: [aula()] }) }) })
    montar()
    expect(await screen.findByRole('button', { name: 'Terça, 7h30, 7ºA, Matemática' })).toBeTruthy()
    expect(diasNaTela()).toEqual(semanaDe(SEGUNDA).map((dia) => dia.data))
    expect(within(document.querySelector(`[data-dia="${HOJE}"]`) as HTMLElement).getByText('Hoje')).toBeTruthy()
    // "Hoje" é só do dia de hoje, e a primeira leitura não leva o foco a lugar nenhum: o foco só vai ao título depois do "Tentar de novo".
    expect(within(document.querySelector(`[data-dia="${SEGUNDA}"]`) as HTMLElement).queryByText('Hoje')).toBeNull()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    const titulo = screen.getByRole('heading', { level: 2, name: 'Semana de 9 a 15 de novembro' })
    expect(document.activeElement).not.toBe(titulo)
  })

  it('o cartão diz a sala, o texto, "Agora", "Fora da grade" e "Falta preencher" só onde cabem; o dia sem aula diz "Sem aulas"', async () => {
    computador()
    const rede = criarRede()
    const noAr = aula({ inicio: '08:50', fim: '09:40', sala: '12' })
    const foraDaGrade = aula({ vinculoId: id(402), disciplina: 'História', disciplinaId: id(501), inicio: '10:00', fim: '10:50', texto: 'Frações', foraDaGrade: true })
    const passada = aula({ inicio: '07:30', fim: '08:20' })
    const dias = semanaDe(SEGUNDA, { [SEGUNDA]: [passada], [HOJE]: [noAr, foraDaGrade] }).map((dia, indice) => (indice === 2 ? { ...dia, eventos: [{ tipo: 'feriado' as const, descricao: 'Finados' }] } : dia))
    instalar(rede, { [SEGUNDA]: resposta({ dias }) })
    montar()
    const agora = await screen.findByRole('button', { name: 'Terça, 8h50, 7ºA, Matemática' })
    expect(within(agora).getByText('Agora')).toBeTruthy()
    expect(within(agora).getByText('Sala 12')).toBeTruthy()
    expect(within(agora).getByText('Falta preencher')).toBeTruthy()
    expect(agora.querySelector('[data-texto-da-aula]')).toBeNull()
    const fora = screen.getByRole('button', { name: 'Terça, 10h, 7ºA, História' })
    expect(within(fora).getByText('Fora da grade')).toBeTruthy()
    expect(within(fora).queryByText('Agora')).toBeNull()
    expect(within(agora).queryByText('Fora da grade')).toBeNull()
    expect(within(fora).queryByText('Falta preencher')).toBeNull()
    expect(within(fora).queryByText(/Sala/)).toBeNull()
    expect(fora.querySelector('[data-texto-da-aula]')?.textContent).toBe('Frações')
    // A aula de ontem, sem texto: nem "Agora" nem "Falta preencher".
    const ontem = screen.getByRole('button', { name: 'Segunda, 7h30, 7ºA, Matemática' })
    expect(within(ontem).queryByText('Agora')).toBeNull()
    expect(within(ontem).queryByText('Falta preencher')).toBeNull()
    // O feriado sem aula: o tipo e a descrição, e "Sem aulas"; a quinta, sem evento nem aula, só "Sem aulas" e nenhuma lista vazia.
    const feriado = document.querySelector(`[data-dia="${somarDias(SEGUNDA, 2)}"]`) as HTMLElement
    expect(feriado.textContent).toContain('Feriado')
    expect(feriado.textContent).toContain('Finados')
    expect(within(feriado).getByText('Sem aulas')).toBeTruthy()
    const quinta = document.querySelector(`[data-dia="${somarDias(SEGUNDA, 3)}"]`) as HTMLElement
    expect(within(quinta).getByText('Sem aulas')).toBeTruthy()
    expect(within(quinta).queryByRole('list')).toBeNull()
  })

  it('sem ano letivo em curso, o vazio diz que o ano não começou, e os botões da semana não quebram', async () => {
    computador()
    const rede = criarRede()
    instalar(rede, { [SEGUNDA]: resposta({ ano: null, gradeImportada: false, calendarioImportado: false, dias: [] }) })
    montar()
    expect(await screen.findByText('O ano letivo ainda não começou')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Semana anterior' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('no celular, um dia por vez no seletor, abrindo em hoje; escolher outro dia troca o dia; a semana sem hoje abre no primeiro dia', async () => {
    celular()
    const usuario = userEvent.setup()
    const rede = criarRede()
    const seguinte = somarDias(SEGUNDA, 7)
    instalar(rede, {
      [SEGUNDA]: resposta({ dias: semanaDe(SEGUNDA, { [HOJE]: [aula()], [somarDias(HOJE, 1)]: [aula({ inicio: '08:20', fim: '09:10' })] }) }),
      [seguinte]: resposta({ dias: semanaDe(seguinte, { [seguinte]: [aula()] }) }),
    })
    montar()
    await screen.findByRole('button', { name: 'Terça, 7h30, 7ºA, Matemática' })
    expect(diasNaTela()).toEqual([HOJE])
    expect(screen.getByRole('radio', { name: 'Terça, 10 de novembro' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getAllByRole('radio')).toHaveLength(5)

    await usuario.click(screen.getByRole('radio', { name: 'Quarta, 11 de novembro' }))
    expect(diasNaTela()).toEqual([somarDias(HOJE, 1)])
    expect(screen.getByRole('button', { name: 'Quarta, 8h20, 7ºA, Matemática' })).toBeTruthy()

    await usuario.click(screen.getByRole('button', { name: 'Semana seguinte' }))
    await waitFor(() => expect(diasNaTela()).toEqual([seguinte]))
    expect(screen.getByRole('radio', { name: 'Segunda, 16 de novembro' }).getAttribute('aria-checked')).toBe('true')
  })

  it('o clique no cartão põe `?aula=<vinculoId>.<data>.<HHMM>` no endereço e mantém o resto', async () => {
    computador()
    const usuario = userEvent.setup()
    const rede = criarRede()
    instalar(rede, { [SEGUNDA]: resposta({ dias: semanaDe(SEGUNDA, { [HOJE]: [aula({ texto: 'Frações' })] }) }) })
    montar()
    await usuario.click(await screen.findByRole('button', { name: 'Terça, 7h30, 7ºA, Matemática' }))
    expect(endereco()).toBe(`/professor/turmas?ver=semana&aula=${id(401)}.${HOJE}.0730`)
    expect(endereco()).not.toContain('Fra')
  })
})

describe('Semana: os estados', () => {
  it('carregando não mostra vazio nem aviso; depois da leitura, o vazio diz por quê (sem grade)', async () => {
    computador()
    const rede = criarRede()
    rede.responderPor('/v1/meus-vinculos', ok({ itens: [] }))
    const leitura = rede.segurar()
    montar()
    expect(await screen.findByText('Carregando a semana…')).toBeTruthy()
    expect(screen.queryByText('A coordenação ainda não importou a grade')).toBeNull()
    expect(screen.queryByText('O calendário da escola ainda não foi importado')).toBeNull()
    await act(async () => leitura.liberar(ok(resposta({ gradeImportada: false, calendarioImportado: false }))))
    expect(await screen.findByText('A coordenação ainda não importou a grade')).toBeTruthy()
    expect(screen.queryByText('Carregando a semana…')).toBeNull()
  })

  it('o erro oferece "Tentar de novo", e a leitura que dá certo leva o foco ao título da semana', async () => {
    computador()
    const usuario = userEvent.setup()
    const rede = criarRede()
    let falhar = true
    rede.responderPor('/v1/meus-vinculos', ok({ itens: [] }))
    rede.responderPor('/v1/semana', () => (falhar ? { status: 503, corpo: { erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'x', requisicaoId: id(1) } } } : ok(resposta({ dias: semanaDe(SEGUNDA, { [HOJE]: [aula()] }) }))))
    montar()
    // O cliente repete uma vez, um segundo depois, antes de mostrar o erro.
    const tentar = await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 5_000 })
    falhar = false
    await usuario.click(tentar)
    await screen.findByRole('button', { name: 'Terça, 7h30, 7ºA, Matemática' })
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: /^Semana de / }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('sem filtro, o vazio da semana não oferece "Ver todas as turmas"; com filtro oferece, e ele tira o filtro do endereço', async () => {
    computador()
    const usuario = userEvent.setup()
    const rede = criarRede()
    instalar(rede, {}, [vinculo(1, MATEMATICA, 'confirmado')])
    montar()
    expect(await screen.findByText('Sem aulas nesta semana')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ver todas as turmas' })).toBeNull()

    cleanup()
    window.history.replaceState(null, '', `/professor/turmas?ver=semana&turma=${id(777)}.${id(888)}`)
    montar()
    // O filtro do endereço que não é de nenhuma turma dela aparece no seletor como "Todas as turmas".
    const seletor = screen.getByLabelText('Turma e disciplina') as HTMLSelectElement
    expect(seletor.selectedOptions[0]?.textContent).toBe('Todas as turmas')
    await usuario.click(await screen.findByRole('button', { name: 'Ver todas as turmas' }))
    expect(endereco()).toBe('/professor/turmas?ver=semana')
  })

  it('o aviso do calendário aparece com a grade importada e sem calendário, e as aulas continuam à vista', async () => {
    computador()
    const rede = criarRede()
    instalar(rede, { [SEGUNDA]: resposta({ calendarioImportado: false, dias: semanaDe(SEGUNDA, { [HOJE]: [aula()] }) }) })
    montar()
    expect(await screen.findByText('O calendário da escola ainda não foi importado')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Terça, 7h30, 7ºA, Matemática' })).toBeTruthy()
  })

  it('o feriado é mostrado com o tipo e a descrição, e a semana de recesso inteira vira o vazio do recesso', async () => {
    computador()
    const rede = criarRede()
    const recesso = semanaDe(SEGUNDA).map((dia) => ({ ...dia, eventos: [{ tipo: 'recesso' as const, descricao: 'Recesso de novembro' }] }))
    instalar(rede, { [SEGUNDA]: resposta({ dias: recesso }) })
    montar()
    expect(await screen.findByText('Semana de recesso')).toBeTruthy()
    expect(screen.getByText('Recesso de novembro: a escola está em recesso nesta semana.')).toBeTruthy()

    cleanup()
    const comFeriado = semanaDe(SEGUNDA).map((dia, indice) => (indice === 2 ? { ...dia, eventos: [{ tipo: 'feriado' as const, descricao: 'Finados' }] } : dia))
    instalar(criarRede(), { [SEGUNDA]: resposta({ dias: comFeriado }) })
    montar()
    expect(await screen.findByText(/Finados/)).toBeTruthy()
    expect(screen.getByText('Feriado')).toBeTruthy()
    expect(screen.queryByText('Semana de recesso')).toBeNull()
  })
})

describe('Semana: a navegação presa ao ano e a semana fora dele', () => {
  it('"Semana anterior" desliga na semana do começo do ano, e "Semana seguinte" na do fim', async () => {
    computador()
    const rede = criarRede()
    instalar(rede)
    window.history.replaceState(null, '', '/professor/turmas?ver=semana&semana=2026-02-02')
    montar()
    // Enquanto o ano não foi lido os dois botões estão desligados: a medida só vale depois da leitura.
    await screen.findByText('Sem aulas nesta semana')
    expect((screen.getByRole('button', { name: 'Semana anterior' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Semana seguinte' }) as HTMLButtonElement).disabled).toBe(false)

    cleanup()
    window.history.replaceState(null, '', '/professor/turmas?ver=semana&semana=2026-12-14')
    montar()
    await screen.findByText('Sem aulas nesta semana')
    expect((screen.getByRole('button', { name: 'Semana seguinte' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Semana anterior' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('com a semana nova ainda a caminho, "Semana anterior" e "Semana seguinte" continuam presas ao ano que já foi lido', async () => {
    computador()
    const usuario = userEvent.setup()
    const rede = criarRede()
    const seguinte = somarDias(SEGUNDA, 7)
    let liberar: (r: FakeResponse) => void = () => undefined
    const daSeguinte = new Promise<FakeResponse>((resolver) => (liberar = resolver))
    rede.responderPor('/v1/meus-vinculos', ok({ itens: [] }))
    rede.responderPor('/v1/semana', (caminho) => (segundaPedida(caminho) === seguinte ? daSeguinte : ok(resposta({ dias: semanaDe(SEGUNDA) }))))
    montar()
    await screen.findByText('Sem aulas nesta semana')
    await waitFor(() => expect((screen.getByRole('button', { name: 'Semana seguinte' }) as HTMLButtonElement).disabled).toBe(false))
    await usuario.click(screen.getByRole('button', { name: 'Semana seguinte' }))
    expect(await screen.findByText('Carregando a semana…')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Semana anterior' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'Semana seguinte' }) as HTMLButtonElement).disabled).toBe(false)
    await act(async () => liberar(ok(resposta({ dias: semanaDe(seguinte) }))))
  })

  it('chegar à ponta do ano com o foco no botão leva o foco ao título; chegar a ela com o foco em outro lugar não o tira de lá', async () => {
    computador()
    const usuario = userEvent.setup()
    const rede = criarRede()
    instalar(rede)
    const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement
    const titulo = () => screen.getByRole('heading', { level: 2, name: /^Semana de / })
    const irPara = async (semana: string) => {
      await act(async () => {
        window.history.pushState(null, '', `/professor/turmas?ver=semana&semana=${semana}`)
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
    }
    window.history.replaceState(null, '', '/professor/turmas?ver=semana&semana=2026-02-09')
    montar()
    await screen.findByText('Sem aulas nesta semana')
    // Na ponta do começo: "Semana anterior" desliga com o foco nela, e o foco vai ao título.
    await waitFor(() => expect(botao('Semana anterior').disabled).toBe(false))
    await usuario.click(botao('Semana anterior'))
    await waitFor(() => expect(botao('Semana anterior').disabled).toBe(true))
    expect(document.activeElement).toBe(titulo())

    // Na ponta do fim: o mesmo com "Semana seguinte".
    await irPara('2026-12-07')
    await waitFor(() => expect(botao('Semana seguinte').disabled).toBe(false))
    await usuario.click(botao('Semana seguinte'))
    await waitFor(() => expect(botao('Semana seguinte').disabled).toBe(true))
    expect(document.activeElement).toBe(titulo())

    // Com o foco no filtro, ir à ponta pelo histórico não o leva ao título.
    await irPara('2026-12-07')
    await waitFor(() => expect(botao('Semana seguinte').disabled).toBe(false))
    const filtro = screen.getByLabelText('Turma e disciplina')
    filtro.focus()
    await irPara('2026-12-14')
    await waitFor(() => expect(botao('Semana seguinte').disabled).toBe(true))
    expect(document.activeElement).toBe(filtro)
  })

  it('"Semana anterior" e "Hoje" levam a semana ao endereço, e "Hoje" a tira dele', async () => {
    computador()
    const usuario = userEvent.setup()
    const rede = criarRede()
    instalar(rede)
    montar()
    await screen.findByRole('heading', { level: 2, name: 'Semana de 9 a 15 de novembro' })
    await waitFor(() => expect((screen.getByRole('button', { name: 'Semana anterior' }) as HTMLButtonElement).disabled).toBe(false))
    await usuario.click(screen.getByRole('button', { name: 'Semana anterior' }))
    expect(endereco()).toBe('/professor/turmas?ver=semana&semana=2026-11-02')
    expect(await screen.findByRole('heading', { level: 2, name: 'Semana de 2 a 8 de novembro' })).toBeTruthy()
    await usuario.click(screen.getByRole('button', { name: 'Hoje' }))
    expect(endereco()).toBe('/professor/turmas?ver=semana')
  })

  it('a semana pedida fora do ano abre a de hoje e tira `?semana=` do endereço, sem empilhar histórico', async () => {
    computador()
    const rede = criarRede()
    instalar(rede)
    window.history.replaceState(null, '', '/professor/turmas?ver=semana&semana=2025-03-03')
    const empilhadas = window.history.length
    montar()
    await waitFor(() => expect(endereco()).toBe('/professor/turmas?ver=semana'))
    expect(window.history.length).toBe(empilhadas)
    expect(await screen.findByRole('heading', { level: 2, name: 'Semana de 9 a 15 de novembro' })).toBeTruthy()
    // A semana de fora só é lida uma vez, para saber o ano; depois vem a de hoje.
    expect(leiturasDaSemana(rede)).toEqual(['2025-03-03', SEGUNDA])
  })

  it('a semana de fora do ano não pisca o vazio dela: enquanto a de hoje não chega, a tela diz "Carregando a semana…"', async () => {
    computador()
    const rede = criarRede()
    let liberar: (r: FakeResponse) => void = () => undefined
    const deHoje = new Promise<FakeResponse>((resolver) => (liberar = resolver))
    rede.responderPor('/v1/meus-vinculos', ok({ itens: [] }))
    rede.responderPor('/v1/semana', (caminho) => (segundaPedida(caminho) === SEGUNDA ? deHoje : ok(resposta({ dias: [] }))))
    window.history.replaceState(null, '', '/professor/turmas?ver=semana&semana=2025-03-03')
    // Em nenhum momento da troca o vazio da semana de fora do ano pode ter sido desenhado.
    const visto: string[] = []
    // Lê o que ENTROU na página (os registros), e não a página de agora: a troca para a semana de hoje pode vir antes do primeiro olhar.
    new MutationObserver((registros) => {
      for (const registro of registros) for (const no of registro.addedNodes) for (const frase of ['Sem aulas nesta semana', 'O ano letivo ainda não começou']) if (no.textContent?.includes(frase) === true) visto.push(frase)
    }).observe(document.body, { subtree: true, childList: true })
    montar()
    await waitFor(() => expect(endereco()).toBe('/professor/turmas?ver=semana'))
    expect(await screen.findByText('Carregando a semana…')).toBeTruthy()
    expect(visto).toEqual([])
    await act(async () => liberar(ok(resposta({ dias: semanaDe(SEGUNDA, { [HOJE]: [aula()] }) }))))
    expect(await screen.findByRole('button', { name: 'Terça, 7h30, 7ºA, Matemática' })).toBeTruthy()
  })

  it('a data inválida em `?semana=` abre a de hoje, sem ler outra semana', async () => {
    computador()
    const rede = criarRede()
    instalar(rede)
    window.history.replaceState(null, '', '/professor/turmas?ver=semana&semana=2026-02-30')
    montar()
    expect(await screen.findByRole('heading', { level: 2, name: 'Semana de 9 a 15 de novembro' })).toBeTruthy()
    expect(leiturasDaSemana(rede)).toEqual([SEGUNDA])
  })
})

describe('Semana: o filtro por turma e disciplina', () => {
  it('as opções são "Todas as turmas" e uma por vínculo confirmado; o contestado e o pendente não entram', async () => {
    computador()
    const rede = criarRede()
    const semDisciplina = { id: id(404), turma: TURMA_A, estado: 'confirmado' }
    instalar(rede, {}, [vinculo(1, MATEMATICA, 'confirmado'), vinculo(2, HISTORIA, 'pendente'), vinculo(3, HISTORIA, 'contestado'), semDisciplina])
    montar()
    const filtro = await screen.findByLabelText('Turma e disciplina')
    await waitFor(() => expect([...(filtro as HTMLSelectElement).options].map((opcao) => opcao.textContent)).toEqual(['Todas as turmas', '7ºA · Matemática']))
  })

  it('escolher a turma põe `?turma=<turmaId>.<disciplinaId>` no endereço e corta as aulas das outras', async () => {
    computador()
    const usuario = userEvent.setup()
    const rede = criarRede()
    const historia = aula({ vinculoId: id(402), disciplinaId: HISTORIA.id, disciplina: HISTORIA.nome, inicio: '08:20', fim: '09:10' })
    instalar(rede, { [SEGUNDA]: resposta({ dias: semanaDe(SEGUNDA, { [HOJE]: [aula(), historia] }) }) }, [vinculo(1, MATEMATICA, 'confirmado'), vinculo(2, HISTORIA, 'confirmado')])
    montar()
    await screen.findByRole('button', { name: 'Terça, 8h20, 7ºA, História' })
    await waitFor(() => expect((screen.getByLabelText('Turma e disciplina') as HTMLSelectElement).options).toHaveLength(3))
    await usuario.selectOptions(screen.getByLabelText('Turma e disciplina'), '7ºA · Matemática')
    expect(endereco()).toBe(`/professor/turmas?ver=semana&turma=${TURMA_A.id}.${MATEMATICA.id}`)
    expect(screen.getByRole('button', { name: 'Terça, 7h30, 7ºA, Matemática' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Terça, 8h20, 7ºA, História' })).toBeNull()
  })
})

describe('Semana: os itens do dia (F2b, 8.0; RF7)', () => {
  const comItens = (itens: readonly ItemDoDia[], aulas: readonly AulaDaSemana[] = []) =>
    resposta({ dias: semanaDe(SEGUNDA, { [HOJE]: aulas }).map((dia) => (dia.data === HOJE ? { ...dia, itens: [...itens] } : dia)) })

  it('os itens ficam no dia deles, embaixo das aulas, e cada um é link para o lugar dele', async () => {
    computador()
    const rede = criarRede()
    const correcao = itemDoDia({ tipo: 'correcao', estado: 'pendente', atividadeAplicadaId: id(701), titulo: 'Atividade de frações' })
    instalar(rede, { [SEGUNDA]: comItens([itemDoDia(), correcao], [aula()]) })
    montar()
    const doDia = await screen.findByRole('list', { name: 'O que aconteceu neste dia' })
    const dia = document.querySelector(`[data-dia="${HOJE}"]`) as HTMLElement
    expect(dia.contains(doDia)).toBe(true)
    // Embaixo das aulas: o cartão vem antes da lista dos itens.
    expect(screen.getByRole('button', { name: 'Terça, 7h30, 7ºA, Matemática' }).compareDocumentPosition(doDia) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(doDia).getByRole('link', { name: `${ROTULOS_DA_SEMANA.item.aplicada}: Atividade de frações` }).getAttribute('href')).toBe(`/turmas/${TURMA_A.id}?aba=atividades&atividade=${id(700)}`)
    expect(within(doDia).getByRole('link', { name: `${ROTULOS_DA_SEMANA.item.correcao} · ${ROTULOS_DA_SEMANA.estado.pendente}, gerado por inteligência artificial: Atividade de frações` }).getAttribute('href')).toBe(`/aprovar/${id(701)}`)
    // Os outros dias não ganham lista.
    expect(document.querySelectorAll('ul[aria-label="O que aconteceu neste dia"]')).toHaveLength(1)
  })

  it('a semana sem aula nenhuma, mas com um item, mostra o item, e não o vazio da semana', async () => {
    computador()
    const rede = criarRede()
    instalar(rede, { [SEGUNDA]: comItens([itemDoDia()]) })
    montar()
    expect(await screen.findByRole('link', { name: `${ROTULOS_DA_SEMANA.item.aplicada}: Atividade de frações` })).toBeTruthy()
    expect(screen.queryByText('Sem aulas nesta semana')).toBeNull()
  })

  it('com `?turma=`, os itens de outra turma e de outra disciplina somem junto das aulas', async () => {
    computador()
    const rede = criarRede()
    const deHistoria = itemDoDia({ disciplinaId: HISTORIA.id, atividadeAplicadaId: id(702), titulo: 'Atividade de história' })
    const deOutraTurma = itemDoDia({ turmaId: id(102), atividadeAplicadaId: id(703), titulo: 'Atividade da outra turma' })
    instalar(rede, { [SEGUNDA]: comItens([itemDoDia(), deHistoria, deOutraTurma], [aula()]) }, [vinculo(1, MATEMATICA, 'confirmado')])
    window.history.replaceState(null, '', `/professor/turmas?ver=semana&turma=${TURMA_A.id}.${MATEMATICA.id}`)
    montar()
    expect(await screen.findByRole('link', { name: `${ROTULOS_DA_SEMANA.item.aplicada}: Atividade de frações` })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Atividade de história/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Atividade da outra turma/ })).toBeNull()
  })

  it('no celular o item aparece só no dia mostrado, e escolher outro dia troca os itens junto com as aulas', async () => {
    celular()
    const usuario = userEvent.setup()
    const rede = criarRede()
    const quarta = somarDias(HOJE, 1)
    const dias = semanaDe(SEGUNDA).map((dia) => {
      if (dia.data === HOJE) return { ...dia, itens: [itemDoDia()] }
      if (dia.data === quarta) return { ...dia, itens: [itemDoDia({ atividadeAplicadaId: id(702), titulo: 'Atividade de história' })] }
      return dia
    })
    instalar(rede, { [SEGUNDA]: resposta({ dias }) })
    montar()
    expect(await screen.findByRole('link', { name: `${ROTULOS_DA_SEMANA.item.aplicada}: Atividade de frações` })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Atividade de história/ })).toBeNull()

    await usuario.click(screen.getByRole('radio', { name: 'Quarta, 11 de novembro' }))
    expect(screen.getByRole('link', { name: `${ROTULOS_DA_SEMANA.item.aplicada}: Atividade de história` })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Atividade de frações/ })).toBeNull()
  })
})
