// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { fakeNetwork, renderScreen, setupScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import Escola from '../Escola'
import GradeECalendario from './GradeECalendario'

/**
 * Escola › Grade e calendário (F2, 14.0; RF1, RF7, RF9, RF10 e RF16), na tela e com a rede falsa: os estados de cada leitura, a grade
 * por turma (cabeçalhos, células, sala, disciplina que saiu, a troca de turma), o calendário do ano e o seletor do planejado, os
 * painéis de importação pelo endereço e o anúncio de ao terminar. O que só o navegador mede (a página que não rola a 360 px, o alvo de
 * toque, a resposta atrasada de uma turma anterior, o arquivo baixado de verdade, o axe) é do e2e `grade-e-calendario`. O `jsdom` não
 * tem `matchMedia`, `ResizeObserver` nem o `dialog` modal: o teste os põe, e são API do navegador.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const ano = (n: number, numero: number, situacao: string) => ({ id: id(n), ano: numero, inicio: `${String(numero)}-02-02`, fim: `${String(numero)}-12-18`, situacao })
const EM_CURSO = ano(10, 2026, 'em_curso')
const PLANEJADO = ano(11, 2027, 'planejado')
const ENCERRADO = ano(12, 2025, 'encerrado')

const SERIE_7 = { id: id(20), etapa: 'ef_anos_finais', ano: 7 }
const turma = (n: number, nome: string) => ({ id: id(n), anoLetivoId: EM_CURSO.id, nome, turno: null, serie: SERIE_7 })
const TURMA_A = turma(30, '7ºA')
const TURMA_B = turma(31, '7ºB')
const MATEMATICA = { id: id(40), nome: 'Matemática', area: null }
const PORTUGUES = { id: id(41), nome: 'Português', area: null }

const aula = (n: number, parte: Record<string, unknown> = {}) => ({
  id: id(n),
  turmaId: TURMA_A.id,
  disciplinaId: MATEMATICA.id,
  professor: { usuarioId: id(500), nome: 'Ana Prof' },
  diaSemana: 1,
  inicio: '07:30',
  fim: '08:20',
  sala: null,
  ...parte,
})
const evento = (n: number, parte: Record<string, unknown> = {}) => ({ id: id(n), tipo: 'feriado', inicio: '2026-09-07', fim: '2026-09-07', descricao: 'Independência', ...parte })

const ERRO = (codigo: string, status: number): FakeResponse => ({
  status,
  corpo: { erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } },
})
/** Um erro que a leitura não repete sozinha: a tela mostra o erro na hora, e não depois da nova tentativa de um segundo. */
const FALHA = ERRO('LIMITE_EXCEDIDO', 429)
const ok = (itens: readonly unknown[]): FakeResponse => ({ status: 200, corpo: { itens } })
const nuncaResponde = () => new Promise<FakeResponse>(() => undefined)

type Conteudo = FakeResponse | Promise<FakeResponse>
type Resposta = FakeResponse | (() => Conteudo)
type RespostaPorPedido<Parametro> = (parametro: Parametro) => Conteudo | (() => Conteudo)
interface Respostas {
  anos: Resposta
  turmas: Resposta
  disciplinas: Resposta
  grade: RespostaPorPedido<string>
  calendario: RespostaPorPedido<string | undefined>
}
const PADRAO: Respostas = {
  anos: ok([EM_CURSO]),
  turmas: ok([TURMA_B, TURMA_A]),
  disciplinas: ok([MATEMATICA, PORTUGUES]),
  grade: (turmaId) => ({ status: 200, corpo: { aulas: turmaId === TURMA_A.id ? [aula(60)] : [aula(61, { turmaId: TURMA_B.id, disciplinaId: PORTUGUES.id })] } }),
  calendario: () => ({ status: 200, corpo: { eventos: [evento(70)] } }),
}

function instalar(rede: FakeNetwork, parcial: Partial<Respostas> = {}): void {
  const respostas = { ...PADRAO, ...parcial }
  rede.responderPor('/v1/anos-letivos', respostas.anos)
  rede.responderPor('/v1/turmas', respostas.turmas)
  rede.responderPor('/v1/disciplinas', respostas.disciplinas)
  rede.responderPor(/^\/v1\/grade\?turmaId=/, (caminho) => {
    const resposta = respostas.grade(new URL(caminho, 'http://x').searchParams.get('turmaId') ?? '')
    return typeof resposta === 'function' ? resposta() : resposta
  })
  rede.responderPor(/^\/v1\/calendario/, (caminho) => {
    const resposta = respostas.calendario(new URL(caminho, 'http://x').searchParams.get('anoLetivoId') ?? undefined)
    return typeof resposta === 'function' ? resposta() : resposta
  })
}

/** Os pedidos que a tela fez, com a consulta: `GET /v1/grade?turmaId=…`. */
const pedidosDe = (rede: FakeNetwork) => rede.chamadas.map((chamada) => `${chamada.metodo} ${chamada.caminho}`)

/** O que a tela mede do navegador: o seletor de largura e o observador de tamanho, que o `jsdom` não tem. */
const observados: Element[] = []
beforeEach(() => {
  observados.length = 0
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(min-width: 768px)', addEventListener: () => undefined, removeEventListener: () => undefined }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(elemento: Element): void {
        observados.push(elemento)
      }
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

function montar(endereco = '/grade', comMoldura = false) {
  const [caminho = '/grade', busca = ''] = endereco.split('?')
  const localizacao = memoryLocation({ path: caminho, searchPath: busca, record: true })
  renderScreen(
    <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
      {comMoldura ? (
        <Escola aba="grade">
          <GradeECalendario />
        </Escola>
      ) : (
        <GradeECalendario />
      )}
    </Router>,
  )
  return localizacao
}

const secaoDaGrade = () => screen.findByRole('region', { name: 'Grade horária' })
const secaoDoCalendario = (anoDoCalendario = 2026) => screen.findByRole('region', { name: `Calendário de ${String(anoDoCalendario)}` })
/** Espera a tela fazer os pedidos e a rede falsa responder a eles: o que a tela mostra depois disso é o que ela fez com a resposta. */
async function esperarOsPedidos(rede: FakeNetwork, pedidos: readonly string[]): Promise<void> {
  await waitFor(() => expect(pedidosDe(rede)).toEqual(expect.arrayContaining(pedidos.map((pedido) => expect.stringContaining(pedido)))))
  await act(async () => {
    await new Promise((resolver) => setTimeout(resolver, 50))
  })
}
/** Clica em "Baixar modelo" do painel e devolve o nome do arquivo que o navegador receberia (um link temporário, que o teste lê). */
async function baixarPeloPainel(usuario: ReturnType<typeof userEvent.setup>, painel: ReturnType<typeof within>): Promise<string[]> {
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:modelo'), revokeObjectURL: vi.fn() })
  const clicados: string[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function clicar(this: HTMLAnchorElement) {
    clicados.push(this.download)
  })
  await usuario.click(painel.getByRole('button', { name: 'Baixar modelo' }))
  vi.unstubAllGlobals()
  return clicados
}
const seletorDeTurma = () => screen.getByLabelText('Turma', { selector: 'select' })

describe('a escola sem ano em curso e as leituras do ano', () => {
  it('carregando: a leitura dos anos no ar, e nenhuma seção de grade nem de calendário ainda', async () => {
    instalar(fakeNetwork(), { anos: nuncaResponde })
    montar()
    expect(await screen.findByText('Carregando a grade e o calendário…')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Grade horária' })).toBeNull()
    // Os modelos não dependem do ano: já estão à vista.
    expect(screen.getByRole('button', { name: 'Baixar modelo da grade' })).toBeTruthy()
  })

  it('erro: a mensagem curta e "Tentar de novo", que lê os anos de novo', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhar = true
    instalar(rede, { anos: () => (falhar ? FALHA : ok([EM_CURSO])) })
    montar()
    await screen.findByRole('alert')
    expect(screen.queryByRole('region', { name: 'Grade horária' })).toBeNull()
    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await secaoDaGrade()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('sem ano em curso, o convite é abrir o ano em Turmas, e os painéis de importar não abrem nem pelo endereço', async () => {
    instalar(fakeNetwork(), { anos: ok([PLANEJADO, ENCERRADO]) })
    montar('/grade?painel=importar-grade')
    expect(await screen.findByText('Abra o ano letivo primeiro')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir para Turmas' }).getAttribute('href')).toBe('/estrutura')
    expect(screen.queryByRole('region', { name: 'Grade horária' })).toBeNull()
    expect(screen.queryByRole('region', { name: /^Calendário de/ })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sem ano em curso, o painel do calendário também não abre pelo endereço', async () => {
    instalar(fakeNetwork(), { anos: ok([PLANEJADO]) })
    montar('/grade?painel=importar-calendario')
    expect(await screen.findByText('Abra o ano letivo primeiro')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('o painel de importar a grade abre pelo endereço, com o título dele', async () => {
    instalar(fakeNetwork())
    montar('/grade?painel=importar-grade')
    expect(await screen.findByRole('dialog', { name: 'Importar grade' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Importar calendário' })).toBeNull()
  })

  it('o painel do calendário abre pelo endereço dele e só ele', async () => {
    instalar(fakeNetwork())
    montar('/grade?painel=importar-calendario')
    expect(await screen.findByRole('dialog', { name: 'Importar calendário' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Importar grade' })).toBeNull()
  })

  it('a seção dos modelos pede, para a sala e para a descrição do evento, que não se escreva nome de pessoa', async () => {
    instalar(fakeNetwork())
    montar()
    await secaoDaGrade()
    expect(screen.getByText(/Os quatro modelos trazem só o cabeçalho\..*Na sala, escreva só o lugar.*nunca o nome de uma pessoa\. Na descrição, escreva só o que acontece.*nunca o nome de uma pessoa\./)).toBeTruthy()
  })

  it('o painel da grade diz na instrução e no vazio para não escrever nome na sala, e o "Baixar modelo" dele entrega modelo-grade.csv', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork())
    montar('/grade?painel=importar-grade')
    const painel = within(await screen.findByRole('dialog', { name: 'Importar grade' }))
    expect(painel.getByText(/e a sala, se houver\. Na sala, escreva só o lugar, como “Lab 2” ou “Sala 12”, nunca o nome de uma pessoa\. Escolha o CSV/)).toBeTruthy()
    expect(painel.getByText(/escolha o arquivo para ver a prévia\. Na sala, escreva só o lugar, como “Lab 2” ou “Sala 12”, nunca o nome de uma pessoa\./)).toBeTruthy()
    expect(await baixarPeloPainel(usuario, painel)).toEqual(['modelo-grade.csv'])
  })

  it('o painel do calendário diz na instrução e no vazio para não escrever nome na descrição, e o "Baixar modelo" dele entrega modelo-calendario.csv', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork())
    montar('/grade?painel=importar-calendario')
    const painel = within(await screen.findByRole('dialog', { name: 'Importar calendário' }))
    expect(painel.getByText(/o tipo e a descrição\. Na descrição, escreva só o que acontece, como “Feriado municipal”, nunca o nome de uma pessoa\. Escolha o CSV/)).toBeTruthy()
    expect(painel.getByText(/escolha o arquivo para ver a prévia\. Na descrição, escreva só o que acontece, como “Feriado municipal”, nunca o nome de uma pessoa\./)).toBeTruthy()
    expect(await baixarPeloPainel(usuario, painel)).toEqual(['modelo-calendario.csv'])
  })

  it.each([
    ['grade', 'Importar grade', 'O fim vem antes do início, ou no mesmo horário.'],
    ['calendario', 'Importar calendário', 'O fim vem antes do início. Confira as duas colunas: o evento de um dia só tem o mesmo dia nas duas.'],
  ] as const)('a prévia da %s diz o fim antes do início do jeito dela: o evento de um dia só é válido, a aula de zero minuto não', async (tipo, painel, frase) => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    rede.responderPor(`/v1/importacoes/${tipo}/previa`, { status: 200, corpo: { linhas: [{ linha: 2, resultado: 'erro', erro: 'fim_antes_do_inicio' }], contagens: {}, candidatos: [] } })
    montar(`/grade?painel=importar-${tipo === 'grade' ? 'grade' : 'calendario'}`)
    const dialogo = await screen.findByRole('dialog', { name: painel })
    await usuario.upload(within(dialogo).getByLabelText('Arquivo da planilha (Excel ou CSV)'), new File(['x;y\n'], `${tipo}.csv`, { type: 'text/csv' }))
    const erros = within(await within(dialogo).findByRole('region', { name: 'Linhas com erro (1)' }))
    expect(erros.getByRole('listitem').textContent).toContain(`Linha 2: ${frase}`)
  })

  it('sem o painel no endereço nenhum diálogo abre, e "Importar grade" o abre e "Fechar" o fecha', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork())
    const localizacao = montar()
    await screen.findByRole('table', { name: /Grade da turma 7ºA/ })
    expect(screen.queryByRole('dialog')).toBeNull()
    await usuario.click(screen.getByRole('button', { name: 'Importar grade' }))
    expect(await screen.findByRole('dialog', { name: 'Importar grade' })).toBeTruthy()
    expect(localizacao.history?.at(-1)).toContain('painel=importar-grade')
    await usuario.click(within(screen.getByRole('dialog', { name: 'Importar grade' })).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('a grade por turma', () => {
  it('carregando as turmas, e a falha delas com "Tentar de novo"', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhar = true
    instalar(rede, { turmas: () => (falhar ? FALHA : ok([TURMA_A])) })
    montar()
    await screen.findByRole('alert')
    expect(within(await secaoDaGrade()).queryByRole('table')).toBeNull()
    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('table', { name: /Grade da turma 7ºA/ })).toBeTruthy()
  })

  it('as turmas no ar: "Carregando as turmas…"', async () => {
    instalar(fakeNetwork(), { turmas: nuncaResponde })
    montar()
    expect(await screen.findByText('Carregando as turmas…')).toBeTruthy()
  })

  it('sem turma, o vazio convida a criar as turmas ou a importar, e "Importar grade" continua ali', async () => {
    instalar(fakeNetwork(), { turmas: ok([]) })
    montar()
    const secao = await secaoDaGrade()
    expect(await within(secao).findByText('Nenhuma turma ainda')).toBeTruthy()
    expect(within(secao).getByRole('button', { name: 'Importar grade' })).toBeTruthy()
    expect(within(secao).queryByLabelText('Turma')).toBeNull()
  })

  it('a primeira turma na ordem da escola vem aberta, com os dias úteis nas colunas e o horário nas linhas', async () => {
    instalar(fakeNetwork())
    montar()
    const tabela = await screen.findByRole('table', { name: /Grade da turma 7ºA/ })
    expect((seletorDeTurma() as HTMLSelectElement).value).toBe(TURMA_A.id)
    expect(within(tabela).getAllByRole('columnheader').map((cabecalho) => cabecalho.textContent)).toEqual(['Horário', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'])
    const linha = within(tabela).getByRole('row', { name: /07:30 – 08:20/ })
    expect(within(linha).getByRole('rowheader').textContent).toBe('07:30 – 08:20')
    expect(within(linha).getByText('Matemática')).toBeTruthy()
    expect(within(linha).getByText('Ana Prof')).toBeTruthy()
    // As quatro células sem aula dizem "Sem aula" para quem lê pela voz, e a sala só aparece onde há.
    expect(within(linha).getAllByText('Sem aula')).toHaveLength(4)
    expect(within(linha).queryByText(/^Sala/)).toBeNull()
  })

  it('a aula com sala diz a sala, e a disciplina que saiu do cadastro aparece como "Disciplina sem nome"', async () => {
    instalar(fakeNetwork(), {
      grade: () => ({ status: 200, corpo: { aulas: [aula(60, { sala: 'Lab 2' }), aula(62, { disciplinaId: null, diaSemana: 3, inicio: '08:20', fim: '09:10' })] } }),
    })
    montar()
    const tabela = await screen.findByRole('table', { name: /Grade da turma 7ºA/ })
    expect(within(tabela).getByText('Sala Lab 2')).toBeTruthy()
    expect(within(tabela).getByText('Disciplina sem nome')).toBeTruthy()
    expect(within(tabela).getAllByRole('row').filter((linha) => within(linha).queryAllByRole('columnheader').length === 0)).toHaveLength(2)
  })

  it('o sábado só aparece quando há aula nele', async () => {
    instalar(fakeNetwork(), { grade: () => ({ status: 200, corpo: { aulas: [aula(60, { diaSemana: 6 })] } }) })
    montar()
    const tabela = await screen.findByRole('table', { name: /Grade da turma 7ºA/ })
    expect(within(tabela).getAllByRole('columnheader').map((cabecalho) => cabecalho.textContent)).toEqual(['Horário', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'])
  })

  it('trocar de turma lê a grade da outra turma, e a tela mostra a dela', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByRole('table', { name: /Grade da turma 7ºA/ })
    expect(pedidosDe(rede)).toContain(`GET /v1/grade?turmaId=${TURMA_A.id}`)
    expect(pedidosDe(rede)).not.toContain(`GET /v1/grade?turmaId=${TURMA_B.id}`)
    await usuario.selectOptions(seletorDeTurma(), '7ºB')
    const tabela = await screen.findByRole('table', { name: /Grade da turma 7ºB/ })
    expect(within(tabela).getByText('Português')).toBeTruthy()
    expect(screen.queryByRole('table', { name: /Grade da turma 7ºA/ })).toBeNull()
    expect(pedidosDe(rede)).toContain(`GET /v1/grade?turmaId=${TURMA_B.id}`)
  })

  it('a turma sem aula: o vazio diz qual é a turma e "Baixar modelo" entrega o da grade', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { grade: () => ({ status: 200, corpo: { aulas: [] } }) })
    montar()
    expect(await screen.findByText('A turma 7ºA ainda não tem aula na grade')).toBeTruthy()
    expect(screen.queryByRole('table', { name: /Grade da turma/ })).toBeNull()
    // O vazio pede para não escrever nome de pessoa na sala (regra 20, item 1): o modelo só tem o cabeçalho, e o aviso é da tela.
    expect(screen.getByText(/A grade nasce da planilha: aqui você só a lê\. Na sala, escreva só o lugar, como “Lab 2” ou “Sala 12”, nunca o nome de uma pessoa\./)).toBeTruthy()
    // O navegador entrega o arquivo por um link temporário: o teste vê o nome dele. A troca do `URL` vem depois das leituras, que o usam.
    const criar = vi.fn(() => 'blob:modelo')
    vi.stubGlobal('URL', { createObjectURL: criar, revokeObjectURL: vi.fn() })
    const clicados: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function clicar(this: HTMLAnchorElement) {
      clicados.push(this.download)
    })
    await usuario.click(screen.getByRole('button', { name: 'Baixar modelo' }))
    expect(clicados).toEqual(['modelo-grade.csv'])
    vi.unstubAllGlobals()
  })

  it('a grade no ar: "Carregando a grade…" também com as disciplinas já lidas', async () => {
    const rede = fakeNetwork()
    instalar(rede, { grade: nuncaResponde })
    montar()
    expect(await screen.findByText('Carregando a grade…')).toBeTruthy()
    // As turmas e as disciplinas já voltaram: o que segura a tela é só a grade.
    await esperarOsPedidos(rede, ['GET /v1/disciplinas', `GET /v1/grade?turmaId=${TURMA_A.id}`])
    expect(screen.getByText('Carregando a grade…')).toBeTruthy()
    expect(screen.queryByRole('table', { name: /Grade da turma/ })).toBeNull()
  })

  it('a tabela só sai com as disciplinas lidas: sem os nomes ela esperaria', async () => {
    const rede = fakeNetwork()
    instalar(rede, { disciplinas: nuncaResponde })
    montar()
    expect(await screen.findByText('Carregando a grade…')).toBeTruthy()
    // A grade já voltou, e a tabela continua sem sair: ela espera os nomes das disciplinas.
    await esperarOsPedidos(rede, ['GET /v1/disciplinas', `GET /v1/grade?turmaId=${TURMA_A.id}`])
    expect(screen.getByText('Carregando a grade…')).toBeTruthy()
    expect(screen.queryByRole('table', { name: /Grade da turma/ })).toBeNull()
  })

  it('a grade que falha mostra o erro e "Tentar de novo" a lê de novo; a falha das disciplinas também', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhar = true
    instalar(rede, { grade: () => (falhar ? FALHA : { status: 200, corpo: { aulas: [aula(60)] } }) })
    montar()
    await screen.findByRole('alert')
    expect(screen.queryByRole('table', { name: /Grade da turma/ })).toBeNull()
    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('table', { name: /Grade da turma 7ºA/ })).toBeTruthy()
  })

  it('a falha das disciplinas também é erro da grade, e "Tentar de novo" lê as disciplinas', async () => {
    const usuario = userEvent.setup()
    let falhar = true
    instalar(fakeNetwork(), { disciplinas: () => (falhar ? FALHA : ok([MATEMATICA])) })
    montar()
    await screen.findByRole('alert')
    expect(screen.queryByRole('table', { name: /Grade da turma/ })).toBeNull()
    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('table', { name: /Grade da turma 7ºA/ })).toBeTruthy()
  })

  it('a região da grade só entra no Tab quando a tabela passa da largura dela', async () => {
    const largura = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
    const visivel = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    largura.mockReturnValue(700)
    visivel.mockReturnValue(320)
    instalar(fakeNetwork())
    montar()
    const comSobra = await screen.findByRole('region', { name: 'Grade da turma 7ºA' })
    await waitFor(() => expect(comSobra.getAttribute('tabindex')).toBe('0'))
    expect(observados).toContain(comSobra)
    expect(observados).toContain(comSobra.firstElementChild)
    vi.restoreAllMocks()
  })

  it('cabendo na largura, a região fica fora do Tab', async () => {
    instalar(fakeNetwork())
    montar()
    const semSobra = await screen.findByRole('region', { name: 'Grade da turma 7ºA' })
    expect(semSobra.getAttribute('tabindex')).toBeNull()
  })
})

describe('o calendário do ano', () => {
  it('lista os eventos com o período, o tipo e a descrição; um dia só diz a data, mais de um diz "de a"', async () => {
    instalar(fakeNetwork(), {
      calendario: () => ({
        status: 200,
        corpo: { eventos: [evento(70), evento(71, { tipo: 'recesso', inicio: '2026-10-12', fim: '2026-10-16', descricao: 'Semana do professor' })] },
      }),
    })
    montar()
    const tabela = within(await screen.findByRole('table', { name: 'Calendário de 2026' }))
    const linhas = tabela.getAllByRole('row').slice(1)
    expect(linhas.map((linha) => Array.from(linha.querySelectorAll('th, td')).map((celula) => celula.textContent))).toEqual([
      ['7 de setembro de 2026', 'Feriado', 'Independência'],
      ['12 de outubro de 2026 a 16 de outubro de 2026', 'Recesso', 'Semana do professor'],
    ])
  })

  it('o tipo evento tem nome de gente, e "Importar calendário" está ali no ano em curso', async () => {
    instalar(fakeNetwork(), { calendario: () => ({ status: 200, corpo: { eventos: [evento(72, { tipo: 'evento', descricao: 'Feira de ciências' })] } }) })
    montar()
    const secao = await secaoDoCalendario()
    expect(await within(secao).findByText('Evento')).toBeTruthy()
    expect(within(secao).getByRole('button', { name: 'Importar calendário' })).toBeTruthy()
  })

  it('o ano em curso pede o calendário sem consulta, e só com o em curso não há seletor', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await screen.findByRole('table', { name: 'Calendário de 2026' })
    expect(pedidosDe(rede)).toContain('GET /v1/calendario')
    expect(screen.queryByLabelText('Ano letivo')).toBeNull()
  })

  it('vazio no ano em curso: convida a baixar o modelo; a nota do planejado não aparece', async () => {
    instalar(fakeNetwork(), { calendario: () => ({ status: 200, corpo: { eventos: [] } }) })
    montar()
    const secao = await secaoDoCalendario()
    expect(await within(secao).findByText('Nenhum evento no calendário de 2026')).toBeTruthy()
    expect(within(secao).getByText(/Baixe o modelo do calendário, preencha uma linha por feriado/)).toBeTruthy()
    expect(within(secao).getByText(/use “Importar calendário”\. Na descrição, escreva só o que acontece, como “Feriado municipal”, nunca o nome de uma pessoa\./)).toBeTruthy()
    expect(within(secao).queryByText(/só para ler/)).toBeNull()
  })

  it('carregando o calendário, e a falha dele com "Tentar de novo"', async () => {
    const usuario = userEvent.setup()
    let falhar = true
    instalar(fakeNetwork(), { calendario: () => (falhar ? FALHA : { status: 200, corpo: { eventos: [evento(70)] } }) })
    montar()
    const alerta = await within(await secaoDoCalendario()).findByRole('alert')
    expect(alerta).toBeTruthy()
    falhar = false
    await usuario.click(within(await secaoDoCalendario()).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('table', { name: 'Calendário de 2026' })).toBeTruthy()
  })

  it('o calendário no ar: "Carregando o calendário…"', async () => {
    instalar(fakeNetwork(), { calendario: nuncaResponde })
    montar()
    expect(await screen.findByText('Carregando o calendário…')).toBeTruthy()
  })

  it('com o planejado, o seletor lista o em curso e o planejado, e o encerrado não é opção', async () => {
    instalar(fakeNetwork(), { anos: ok([ENCERRADO, EM_CURSO, PLANEJADO]) })
    montar()
    await screen.findByRole('table', { name: 'Calendário de 2026' })
    const seletor = screen.getByLabelText('Ano letivo') as HTMLSelectElement
    expect(Array.from(seletor.options).map((opcao) => opcao.textContent)).toEqual(['2026 (em curso)', '2027 (planejado)'])
    expect(seletor.value).toBe(EM_CURSO.id)
  })

  it('escolher o planejado pede o calendário dele, diz que é só para ler e tira "Importar calendário"; voltar ao em curso devolve o botão', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede, {
      anos: ok([EM_CURSO, PLANEJADO]),
      calendario: (anoLetivoId) => ({ status: 200, corpo: { eventos: anoLetivoId === PLANEJADO.id ? [] : [evento(70)] } }),
    })
    montar()
    await screen.findByRole('table', { name: 'Calendário de 2026' })
    expect(pedidosDe(rede).filter((pedido) => pedido.startsWith('GET /v1/calendario'))).toEqual(['GET /v1/calendario'])
    await usuario.selectOptions(screen.getByLabelText('Ano letivo'), PLANEJADO.id)
    const secao = await secaoDoCalendario(2027)
    expect(await within(secao).findByText('Nenhum evento no calendário de 2027')).toBeTruthy()
    expect(within(secao).getByText('O calendário do ano planejado ainda não foi gravado.')).toBeTruthy()
    expect(within(secao).getByText('Este é o calendário do ano planejado, só para ler. A importação grava no ano em curso.')).toBeTruthy()
    expect(within(secao).queryByRole('button', { name: 'Importar calendário' })).toBeNull()
    expect(pedidosDe(rede)).toContain(`GET /v1/calendario?anoLetivoId=${PLANEJADO.id}`)
    await usuario.selectOptions(screen.getByLabelText('Ano letivo'), EM_CURSO.id)
    expect(await screen.findByRole('table', { name: 'Calendário de 2026' })).toBeTruthy()
    expect(within(await secaoDoCalendario()).getByRole('button', { name: 'Importar calendário' })).toBeTruthy()
    expect(within(await secaoDoCalendario()).queryByText(/só para ler/)).toBeNull()
  })
})

describe('o ano planejado que some da lista', () => {
  it('o ano escolhido sai da lista depois de uma gravação que lê os anos de novo: a tela volta ao ano em curso, sem seletor e sem quebrar', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let anosAgora: FakeResponse = ok([EM_CURSO, PLANEJADO])
    instalar(rede, { anos: () => anosAgora, calendario: (anoLetivoId) => ({ status: 200, corpo: { eventos: anoLetivoId === PLANEJADO.id ? [] : [evento(70)] } }) })
    montar('/grade?painel=importar-calendario')
    await screen.findByRole('table', { name: 'Calendário de 2026' })
    await usuario.selectOptions(screen.getByLabelText('Ano letivo'), PLANEJADO.id)
    expect(await secaoDoCalendario(2027)).toBeTruthy()
    // A escola encerra o planejado com a tela aberta: a leitura seguinte dos anos já não o traz.
    anosAgora = ok([EM_CURSO])
    rede.responderPor('/v1/importacoes/calendario/previa', { status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }], contagens: { entram: 1 }, candidatos: [] } })
    rede.responderPor('/v1/importacoes/calendario', { status: 202, corpo: { id: id(900) } })
    rede.responderPor(`/v1/importacoes/${id(900)}`, { status: 200, corpo: { id: id(900), tipo: 'calendario', estado: 'concluida', resumo: { entram: 1 }, erro: null, criadoEm: '2026-11-04T10:00:00-03:00', concluidaEm: '2026-11-04T10:00:01-03:00' } })
    await usuario.upload(await screen.findByLabelText('Arquivo da planilha (Excel ou CSV)'), new File(['inicio;fim\n'], 'calendario.csv', { type: 'text/csv' }))
    await usuario.click(await screen.findByRole('button', { name: 'Gravar calendário' }))
    expect(await screen.findByRole('table', { name: 'Calendário de 2026' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Calendário de 2027' })).toBeNull()
    expect(screen.queryByLabelText('Ano letivo')).toBeNull()
  })
})

describe('o anúncio de ao terminar a importação', () => {
  const CONCLUIDA = { id: id(900), tipo: 'grade', estado: 'concluida', resumo: { aulas: 2 }, erro: null, criadoEm: '2026-11-04T10:00:00-03:00', concluidaEm: '2026-11-04T10:00:01-03:00' }

  async function gravar(usuario: ReturnType<typeof userEvent.setup>, rede: FakeNetwork, tipo: 'grade' | 'calendario', rotulo: string, csv: string): Promise<void> {
    rede.responderPor(`/v1/importacoes/${tipo}/previa`, { status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }], contagens: { entram: 1 }, candidatos: [] } })
    rede.responderPor(`/v1/importacoes/${tipo}`, { status: 202, corpo: { id: id(900) } })
    rede.responderPor(`/v1/importacoes/${id(900)}`, { status: 200, corpo: { ...CONCLUIDA, tipo, resumo: tipo === 'grade' ? { aulas: 2 } : { entram: 3 } } })
    await usuario.upload(await screen.findByLabelText('Arquivo da planilha (Excel ou CSV)'), new File([csv], `${tipo}.csv`, { type: 'text/csv' }))
    await usuario.click(await screen.findByRole('button', { name: rotulo }))
  }

  it('ao gravar a grade, o anúncio fica na seção da grade, a leitura das duas se refaz e o texto é o da grade', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    montar('/grade?painel=importar-grade')
    await screen.findByRole('table', { name: /Grade da turma 7ºA/ })
    const antes = pedidosDe(rede).filter((pedido) => pedido === `GET /v1/grade?turmaId=${TURMA_A.id}`).length
    await gravar(usuario, rede, 'grade', 'Gravar grade', 'turma;disciplina\n')
    await screen.findByRole('heading', { name: 'Planilha gravada' })
    expect(screen.getByText('2 aulas gravadas.')).toBeTruthy()
    const secaoGrade = await secaoDaGrade()
    await waitFor(() => expect(secaoGrade.textContent).toContain('Planilha gravada. A grade abaixo já está atualizada.'))
    expect(within(await secaoDoCalendario()).queryByText(/Planilha gravada/)).toBeNull()
    await waitFor(() => expect(pedidosDe(rede).filter((pedido) => pedido === `GET /v1/grade?turmaId=${TURMA_A.id}`).length).toBeGreaterThan(antes))
  })

  it('ao gravar o calendário, o anúncio fica na seção do calendário e o texto é o do calendário', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    montar('/grade?painel=importar-calendario')
    await screen.findByRole('table', { name: 'Calendário de 2026' })
    await gravar(usuario, rede, 'calendario', 'Gravar calendário', 'inicio;fim\n')
    await screen.findByRole('heading', { name: 'Planilha gravada' })
    expect(screen.getByText('3 eventos entraram no calendário.')).toBeTruthy()
    const secaoCalendario = await secaoDoCalendario()
    await waitFor(() => expect(secaoCalendario.textContent).toContain('Planilha gravada. O calendário abaixo já está atualizado.'))
    expect((await secaoDaGrade()).textContent).not.toContain('Planilha gravada')
  })

  it('abrir o painel de novo apaga o anúncio anterior', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    montar('/grade?painel=importar-grade')
    await screen.findByRole('table', { name: /Grade da turma 7ºA/ })
    await gravar(usuario, rede, 'grade', 'Gravar grade', 'turma;disciplina\n')
    await screen.findByRole('heading', { name: 'Planilha gravada' })
    await waitFor(() => expect((screen.getByRole('region', { name: 'Grade horária' })).textContent).toContain('Planilha gravada. A grade abaixo'))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Importar grade' })).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await usuario.click(screen.getByRole('button', { name: 'Importar grade' }))
    await screen.findByRole('dialog', { name: 'Importar grade' })
    expect(screen.getByRole('region', { name: 'Grade horária' }).textContent).not.toContain('Planilha gravada. A grade abaixo')
  })
})

describe('a moldura de Escola', () => {
  it('a tela abre dentro da aba "Grade e calendário", a quarta, depois de Turmas, Professores e Material', async () => {
    instalar(fakeNetwork())
    montar('/grade', true)
    await secaoDaGrade()
    expect(screen.getAllByRole('tab').map((aba) => aba.textContent)).toEqual(['Turmas', 'Professores', 'Material', 'Grade e calendário'])
    expect(screen.getByRole('tab', { name: 'Grade e calendário' }).getAttribute('aria-selected')).toBe('true')
  })
})
