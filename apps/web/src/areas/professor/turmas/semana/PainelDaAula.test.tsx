// @vitest-environment jsdom
import type { AulaDaSemana, DiaDaSemana, SemanaResponse } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../../../api/query-client'
import { fakeNetwork, setupScreen, type FakeNetwork, type FakeResponse } from '../../../../__fixtures__/render-screen'
import { CONTEXTO_ESCOLHIDO } from '../../assistente/memoria-do-professor'
import { valorDoContexto } from '../../comum/turmas-da-professora'
import Semana from './Semana'
import { DICA_DO_TEXTO_DA_AULA, FRASE_DA_AULA_QUE_SAIU, FRASE_DA_FALHA_AO_SALVAR, somarDias } from './semana'

/**
 * O painel da aula, montado pela Semana de verdade (7.0; RF5, RF6, RF8, RF15): a rede é falsa, e o cliente de consultas, o endereço, o `Sheet`
 * e o `wouter` são os do navegador. O que o `e2e/professor-semana-painel.spec.ts` prova com o banco e o relógio da máquina, aqui se prova
 * com a resposta que o caso escolhe: o rótulo por data, o contador, o corpo do `PUT`, a falha, a aula que saiu da grade e o "Preparar".
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const HOJE = '2026-11-10'
const SEGUNDA = '2026-11-09'
const ANO = { inicio: '2026-02-02', fim: '2026-12-18' }
const TURMA = { id: id(101), nome: '7ºA' }
const MATEMATICA = { id: id(500), nome: 'Matemática' }
const VINCULO = id(401)

const aula = (extra: Partial<AulaDaSemana> = {}): AulaDaSemana => ({
  vinculoId: VINCULO,
  turmaId: TURMA.id,
  turma: TURMA.nome,
  disciplinaId: MATEMATICA.id,
  disciplina: MATEMATICA.nome,
  inicio: '07:30',
  fim: '08:20',
  sala: '12',
  texto: null,
  foraDaGrade: false,
  ...extra,
})
const dias = (aulas: Readonly<Record<string, readonly AulaDaSemana[]>>): DiaDaSemana[] =>
  [0, 1, 2, 3, 4].map((deslocamento) => {
    const data = somarDias(SEGUNDA, deslocamento)
    return { data, eventos: [], aulas: [...(aulas[data] ?? [])], itens: [] }
  })
const resposta = (aulas: Readonly<Record<string, readonly AulaDaSemana[]>>): SemanaResponse => ({ ano: ANO, hoje: HOJE, agora: '09:00', gradeImportada: true, calendarioImportado: true, dias: dias(aulas) })
const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo } } })

const nomeDoCartaoDeHoje = 'Terça, 7h30, 7ºA, Matemática'
const enderecoDeHoje = `${VINCULO}.${HOJE}.0730`

/** Os `PUT /v1/aulas` que saíram, com o corpo que levaram: a rede falsa guarda só o caminho, e o corpo está na chamada ao `fetch`. */
function gravacoes(): unknown[] {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([caminho, opcoes]) => caminho === '/v1/aulas' && opcoes?.method === 'PUT')
    .map(([, opcoes]) => JSON.parse(String(opcoes?.body)) as unknown)
}

function criarRede(aulas: Readonly<Record<string, readonly AulaDaSemana[]>>): FakeNetwork {
  const rede = fakeNetwork()
  rede.responderPor('/v1/sessao/renovar', () => ok({ token: 'token-renovado', expiraEm: new Date(Date.now() + 600_000).toISOString() }))
  rede.responderPor('/v1/meus-vinculos', ok({ itens: [] }))
  rede.responderPor('/v1/semana', ok(resposta(aulas)))
  return rede
}

function montar(busca = '') {
  window.history.replaceState(null, '', `/professor/turmas?ver=semana${busca}`)
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <Semana />
    </QueryClientProvider>,
  )
}

const endereco = () => window.location.pathname + window.location.search
const painel = () => screen.queryByRole('dialog')
const campo = () => within(screen.getByRole('dialog')).getByRole('textbox')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(min-width: 768px)', media: consulta, addEventListener: () => undefined, removeEventListener: () => undefined }))
  CONTEXTO_ESCOLHIDO.guardar(undefined)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

describe('o rótulo e o contador (RF5)', () => {
  it('S14: "O que vou dar" na aula de hoje, "O que foi dado" na de ontem', async () => {
    criarRede({ [SEGUNDA]: [aula()], [HOJE]: [aula()] })
    montar()
    await userEvent.click(await screen.findByRole('button', { name: 'Terça, 7h30, 7ºA, Matemática' }))
    expect(within(screen.getByRole('dialog')).getByLabelText('O que vou dar')).toBeTruthy()
    expect(within(screen.getByRole('dialog')).queryByLabelText('O que foi dado')).toBeNull()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Segunda, 7h30, 7ºA, Matemática' }))
    expect(within(screen.getByRole('dialog')).getByLabelText('O que foi dado')).toBeTruthy()
    expect(within(screen.getByRole('dialog')).queryByLabelText('O que vou dar')).toBeNull()
  })

  it('o painel diz o dia, o horário, a turma, a disciplina e a sala, e traz o aviso de não escrever nome de aluno', async () => {
    criarRede({ [HOJE]: [aula()] })
    montar(`&aula=${enderecoDeHoje}`)
    const dialogo = await screen.findByRole('dialog', { name: 'Terça, 10 de novembro' })
    expect(within(dialogo).getByText('7h30 às 8h20')).toBeTruthy()
    expect(within(dialogo).getByText('7ºA · Matemática')).toBeTruthy()
    expect(within(dialogo).getByText('Sala 12')).toBeTruthy()
    expect(within(dialogo).getByText(DICA_DO_TEXTO_DA_AULA)).toBeTruthy()
    expect(DICA_DO_TEXTO_DA_AULA).toContain('nome de nenhum aluno')
    expect(within(dialogo).queryByText('Fora da grade')).toBeNull()
  })

  it('a aula sem sala não diz sala nenhuma', async () => {
    criarRede({ [HOJE]: [aula({ sala: null })] })
    montar(`&aula=${enderecoDeHoje}`)
    const dialogo = await screen.findByRole('dialog', { name: 'Terça, 10 de novembro' })
    expect(within(dialogo).queryByText(/^Sala/)).toBeNull()
  })

  it('o contador é uma região `aria-live="polite"`, e o 501º caractere não entra', async () => {
    criarRede({ [HOJE]: [aula()] })
    montar(`&aula=${enderecoDeHoje}`)
    await screen.findByRole('dialog')
    fireEvent.change(campo(), { target: { value: 'a'.repeat(501) } })
    expect((campo() as HTMLTextAreaElement).value).toHaveLength(500)
    const contador = within(screen.getByRole('dialog')).getByText('500 de 500', { exact: false })
    expect(contador.getAttribute('aria-live')).toBe('polite')
    expect(campo().getAttribute('aria-describedby')).toContain(contador.id)
  })
})

describe('salvar (RF5, RF15)', () => {
  it('manda um PUT com o vínculo, a data, o início e o texto; o cartão mostra o texto sem uma leitura nova; o painel fecha e o endereço perde o `?aula=`', async () => {
    const rede = criarRede({ [HOJE]: [aula()] })
    rede.responderPor('/v1/aulas', ok({ vinculoId: VINCULO, data: HOJE, inicio: '07:30', texto: 'Frações' }))
    montar(`&aula=${enderecoDeHoje}`)
    await screen.findByRole('dialog')
    await userEvent.type(campo(), '  Frações  ')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(painel()).toBeNull())
    expect(gravacoes()).toEqual([{ vinculoId: VINCULO, data: HOJE, inicio: '07:30', texto: '  Frações  ' }])
    expect(screen.getByRole('button', { name: nomeDoCartaoDeHoje }).textContent).toContain('Frações')
    expect(screen.getByRole('button', { name: nomeDoCartaoDeHoje }).textContent).not.toContain('Falta preencher')
    expect(rede.chamadas.filter((chamada) => chamada.caminho.startsWith('/v1/semana'))).toHaveLength(1)
    expect(endereco()).toBe('/professor/turmas?ver=semana')
  })

  it('RF15: o clique duplo em "Salvar" manda uma gravação só', async () => {
    const rede = criarRede({ [HOJE]: [aula()] })
    const segurada = rede.segurar()
    montar(`&aula=${enderecoDeHoje}`)
    await screen.findByRole('dialog')
    fireEvent.change(campo(), { target: { value: 'Frações' } })
    const salvar = within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' })
    fireEvent.click(salvar)
    fireEvent.click(salvar)
    await waitFor(() => expect(gravacoes()).toHaveLength(1))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvando…' }).hasAttribute('disabled')).toBe(true)
    segurada.liberar(ok({ vinculoId: VINCULO, data: HOJE, inicio: '07:30', texto: 'Frações' }))
    await waitFor(() => expect(painel()).toBeNull())
    expect(gravacoes()).toHaveLength(1)
  })

  it('a aula fora da grade que ficou sem texto some do cartão (o servidor apagou o registro, e era ele que a mantinha)', async () => {
    const rede = criarRede({ [SEGUNDA]: [aula({ foraDaGrade: true, texto: 'Frações' })] })
    rede.responderPor('/v1/aulas', ok({ vinculoId: VINCULO, data: SEGUNDA, inicio: '07:30', texto: null }))
    montar(`&aula=${VINCULO}.${SEGUNDA}.0730`)
    expect(within(await screen.findByRole('dialog')).getByText('Fora da grade')).toBeTruthy()
    fireEvent.change(campo(), { target: { value: '   ' } })
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(painel()).toBeNull())
    expect(gravacoes()).toEqual([{ vinculoId: VINCULO, data: SEGUNDA, inicio: '07:30', texto: '   ' }])
    expect(screen.queryByRole('button', { name: 'Segunda, 7h30, 7ºA, Matemática' })).toBeNull()
  })
})

describe('a falha (RF5; cenário T3)', () => {
  it('a falha diz a frase, guarda o texto no campo e não fecha; salvar de novo com sucesso tira a frase', async () => {
    const rede = criarRede({ [HOJE]: [aula()] })
    let falhar = true
    rede.responderPor('/v1/aulas', () => (falhar ? erro(500, 'ERRO_INTERNO') : ok({ vinculoId: VINCULO, data: HOJE, inicio: '07:30', texto: 'Frações' })))
    montar(`&aula=${enderecoDeHoje}`)
    await screen.findByRole('dialog')
    fireEvent.change(campo(), { target: { value: 'Frações' } })
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }))

    expect((await within(screen.getByRole('dialog')).findByRole('alert')).textContent).toBe(FRASE_DA_FALHA_AO_SALVAR)
    expect((campo() as HTMLTextAreaElement).value).toBe('Frações')
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }).hasAttribute('disabled')).toBe(false)

    falhar = false
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(painel()).toBeNull())
  })

  it.each([
    ['o servidor indisponível (`INDISPONIVEL_TENTE_DE_NOVO`)', () => erro(503, 'INDISPONIVEL_TENTE_DE_NOVO')],
    [
      'a queda de rede, sem resposta HTTP',
      () => {
        throw new TypeError('Failed to fetch')
      },
    ],
  ])('%s diz a frase genérica e guarda o texto no campo', async (_nome, resposta) => {
    const rede = criarRede({ [HOJE]: [aula()] })
    rede.responderPor('/v1/aulas', resposta)
    montar(`&aula=${enderecoDeHoje}`)
    await screen.findByRole('dialog')
    fireEvent.change(campo(), { target: { value: 'Frações' } })
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }))

    expect((await within(screen.getByRole('dialog')).findByRole('alert')).textContent).toBe(FRASE_DA_FALHA_AO_SALVAR)
    expect((campo() as HTMLTextAreaElement).value).toBe('Frações')
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }).hasAttribute('disabled')).toBe(false)
  })

  it('`NAO_ENCONTRADO` diz que a aula saiu da grade e que o texto não foi salvo, guarda o texto, e fechar lê a semana de novo', async () => {
    const rede = criarRede({ [HOJE]: [aula()] })
    rede.responderPor('/v1/aulas', erro(404, 'NAO_ENCONTRADO'))
    montar(`&aula=${enderecoDeHoje}`)
    await screen.findByRole('dialog')
    fireEvent.change(campo(), { target: { value: 'Frações' } })
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }))

    expect((await within(screen.getByRole('dialog')).findByRole('alert')).textContent).toBe(FRASE_DA_AULA_QUE_SAIU)
    expect(FRASE_DA_AULA_QUE_SAIU).toContain('saiu da grade')
    expect(FRASE_DA_AULA_QUE_SAIU).toContain('o texto não foi salvo')
    expect((campo() as HTMLTextAreaElement).value).toBe('Frações')
    expect(rede.chamadas.filter((chamada) => chamada.caminho.startsWith('/v1/semana'))).toHaveLength(1)

    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(rede.chamadas.filter((chamada) => chamada.caminho.startsWith('/v1/semana'))).toHaveLength(2))
    expect(endereco()).toBe('/professor/turmas?ver=semana')
  })

  it('fechar com "Fechar" sem salvar descarta o rascunho: reabrir mostra o texto gravado, e a falha de antes não volta', async () => {
    const rede = criarRede({ [HOJE]: [aula({ texto: 'Gravado' })] })
    rede.responderPor('/v1/aulas', erro(500, 'ERRO_INTERNO'))
    montar(`&aula=${enderecoDeHoje}`)
    await screen.findByRole('dialog')
    fireEvent.change(campo(), { target: { value: 'Rascunho' } })
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }))
    await within(screen.getByRole('dialog')).findByRole('alert')
    const leiturasAntes = rede.chamadas.filter((chamada) => chamada.caminho.startsWith('/v1/semana')).length
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(painel()).toBeNull())
    // Só a aula que saiu da grade (`NAO_ENCONTRADO`) pede a semana de novo ao fechar: a falha comum não lê nada.
    expect(rede.chamadas.filter((chamada) => chamada.caminho.startsWith('/v1/semana'))).toHaveLength(leiturasAntes)

    await userEvent.click(screen.getByRole('button', { name: nomeDoCartaoDeHoje }))
    expect((campo() as HTMLTextAreaElement).value).toBe('Gravado')
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).toBeNull()
  })
})

describe('o rascunho só em memória (regra 50, item 7)', () => {
  it('o texto digitado nunca vai a `localStorage`, `sessionStorage` nem ao endereço', async () => {
    criarRede({ [HOJE]: [aula()] })
    montar(`&aula=${enderecoDeHoje}`)
    await screen.findByRole('dialog')
    fireEvent.change(campo(), { target: { value: 'Frações com a Maria' } })
    expect(JSON.stringify({ ...localStorage })).not.toContain('Frações')
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('Frações')
    expect(endereco()).not.toContain('Fra')
  })
})

describe('o endereço da aula (RF9; regra 10, item 6)', () => {
  it('o `?aula=` que não é aula da semana lida não abre painel e sai do endereço, sem dizer nada', async () => {
    criarRede({ [HOJE]: [aula()] })
    montar(`&aula=${id(999)}.${HOJE}.0730`)
    await screen.findByRole('button', { name: nomeDoCartaoDeHoje })
    await waitFor(() => expect(endereco()).toBe('/professor/turmas?ver=semana'))
    expect(painel()).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('o `?aula=` com forma errada não abre painel e sai do endereço', async () => {
    criarRede({ [HOJE]: [aula()] })
    montar(`&aula=${VINCULO}.${HOJE}.2561`)
    await screen.findByRole('button', { name: nomeDoCartaoDeHoje })
    await waitFor(() => expect(endereco()).toBe('/professor/turmas?ver=semana'))
    expect(painel()).toBeNull()
  })

  it('sem `?aula=` o endereço não é reescrito', async () => {
    criarRede({ [HOJE]: [aula()] })
    montar('&turma=x')
    // O espião entra depois de a tela pôr o endereço do caso e antes de a semana ser lida: é a leitura que dispararia a reescrita.
    const reescritas = vi.spyOn(window.history, 'replaceState')
    await screen.findByRole('button', { name: nomeDoCartaoDeHoje })
    expect(reescritas).not.toHaveBeenCalled()
    reescritas.mockRestore()
  })

  it('a semana fora do ano com `?aula=` abre a de hoje, e o endereço perde os dois', async () => {
    criarRede({ [HOJE]: [aula()] })
    montar(`&semana=2025-01-06&aula=${enderecoDeHoje}`)
    await screen.findByRole('button', { name: nomeDoCartaoDeHoje })
    await waitFor(() => expect(endereco()).toBe('/professor/turmas?ver=semana'))
    expect(painel()).toBeNull()
  })

  it('o clique no cartão abre o painel pelo `?aula=`, e fechar tira o parâmetro do endereço e devolve o foco ao cartão', async () => {
    criarRede({ [HOJE]: [aula()] })
    montar()
    const cartao = await screen.findByRole('button', { name: nomeDoCartaoDeHoje })
    await userEvent.click(cartao)
    expect(endereco()).toBe(`/professor/turmas?ver=semana&aula=${enderecoDeHoje}`)
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(painel()).toBeNull())
    expect(endereco()).toBe('/professor/turmas?ver=semana')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: nomeDoCartaoDeHoje }))
  })

  it('aberto pelo endereço, sem cartão que o tenha aberto, fechar leva o foco ao cartão da aula', async () => {
    criarRede({ [HOJE]: [aula()] })
    montar(`&aula=${enderecoDeHoje}`)
    await screen.findByRole('dialog')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(painel()).toBeNull())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: nomeDoCartaoDeHoje }))
  })
})

describe('"Preparar esta aula" (RF8)', () => {
  it('guarda a turma e a disciplina na caixa de pedido e abre o Início, sem chamar a API nem levar o texto', async () => {
    const rede = criarRede({ [HOJE]: [aula()] })
    montar(`&aula=${enderecoDeHoje}`)
    await screen.findByRole('dialog')
    fireEvent.change(campo(), { target: { value: 'Frações' } })
    const antes = rede.chamadas.length
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Preparar esta aula' }))

    expect(CONTEXTO_ESCOLHIDO.ler()).toBe(valorDoContexto(TURMA.id, MATEMATICA.id))
    expect(window.location.pathname).toBe('/nova-conversa')
    expect(rede.chamadas.slice(antes)).toEqual([])
    expect(gravacoes()).toEqual([])
    // O que o campo tinha não foi a lugar nenhum: nem num pedido (corpo ou endereço), nem na caixa de pedido do Início, nem no armazenamento (regra 20, item 12).
    expect(JSON.stringify(vi.mocked(fetch).mock.calls)).not.toContain('Frações')
    expect(CONTEXTO_ESCOLHIDO.ler()).not.toContain('Fra')
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('Fra')
    expect(window.location.href).not.toContain('Fra')
  })
})
