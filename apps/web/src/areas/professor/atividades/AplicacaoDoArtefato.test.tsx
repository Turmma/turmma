// @vitest-environment jsdom
import { artefatoResponseSchema, type AtividadeAplicada } from '@educa/shared'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import { AplicacaoDoArtefato } from './AplicacaoDoArtefato'
import { MudarJanela, TEXTO_DE_NINGUEM_COMECOU, TEXTO_DO_TEMPO_ADICIONAL_JA_MARCADO } from './MudarJanela'
import { TEXTO_DO_ABRE_VAZIO, TEXTO_DO_FECHA_VAZIO, TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO } from './prova-online'

/**
 * A tela de aplicar a prova e a mudança de janela (avaliacao-e-correcao, 10.0; RF1 a RF3): os campos da avaliativa, cada um com rótulo e erro, o tempo
 * adicional por aluno sem motivo, o resumo antes de confirmar, o tempo que não cabe e o "Mudar janela" só antes do primeiro início. A rede é falsa e
 * responde por caminho; a tela, o diálogo, os campos e o cliente de consultas são os de verdade. O horário que o professor escreve é o da escola
 * (São Paulo), e o pedido sai em UTC. A jornada completa, os estados e o celular ficam no e2e (`professor-turma-atividades.spec.ts`).
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const TURMA = id(100)
const DISCIPLINA = id(200)
const MATERIAL = id(300)
const ANA = id(401)
const BIA = id(402)
const CAIO = id(403)
const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })

const ARTEFATO = artefatoResponseSchema.parse({
  id: id(1),
  tipo: 'atividade_objetiva',
  titulo: 'Atividade de estequiometria',
  turmaId: TURMA,
  disciplinaId: DISCIPLINA,
  origemId: null,
  adaptacao: null,
  entrega: null,
  criadoEm: '2026-10-05T13:00:00.000Z',
  conteudo: {
    tipo: 'atividade_objetiva',
    titulo: 'Atividade de estequiometria',
    questoes: [
      {
        enunciado: 'Qual a massa de CO₂ formada na queima completa de 24 g de carbono?',
        alternativas: ['44 g', '88 g', '24 g', '12 g'],
        gabarito: 1,
        habilidade: { codigo: 'QUI.EM.04', descricao: 'Usar a proporção da equação balanceada.' },
        citacao: { materialId: MATERIAL, pagina: 142, trecho: 'Na combustão completa, cada mol de carbono forma um mol de dióxido de carbono.' },
        explicacao: '24 g de carbono são 2 mol, que formam 2 mol de CO₂, ou 88 g.',
      },
    ],
  },
  versoesAdaptadas: [],
  aplicacoes: [],
  fontes: [{ materialId: MATERIAL, titulo: 'Química 2, cap. 7', edicao: null, substituido: false }],
  secoesDasQuestoes: [null],
  classificacaoSuspensa: false,
})

const APLICADA: AtividadeAplicada = {
  id: id(10),
  artefatoId: ARTEFATO.id,
  turmaId: TURMA,
  titulo: ARTEFATO.titulo,
  avaliativa: true,
  estado: 'aberta',
  questoes: 1,
  aplicadaEm: '2026-11-23T13:00:00.000Z',
  encerradaEm: null,
  janela: { abreEm: '2026-11-24T13:00:00.000Z', fechaEm: '2026-11-24T14:40:00.000Z' },
  duracaoMin: 40,
  embaralhar: { questoes: false, alternativas: false },
  segundaChamadaDe: null,
  comTempoAdicional: 0,
  participacao: { alunos: 3, iniciaram: 0, enviaram: 0 },
  entrega: null,
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
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

/** A rede da tela de aplicar: a lista de aplicações (vazia), os alunos da turma (Ana, Bia e Caio) e a resposta de aplicar. */
function redeDeAplicar(aplicar: FakeResponse = ok(APLICADA)): FakeNetwork {
  const rede = fakeNetwork()
  rede.responderPor('/v1/atividades-aplicadas', (caminho) => (caminho.startsWith('/v1/atividades-aplicadas?') ? ok({ itens: [] }) : aplicar))
  rede.responderPor(`/v1/turmas/${TURMA}/alunos`, ok({ itens: [{ usuarioId: CAIO, nome: 'Caio Nunes' }, { usuarioId: ANA, nome: 'Ana Souza' }, { usuarioId: BIA, nome: 'Bia Lima' }] }))
  return rede
}

/** Os pedidos de escrita que a tela mandou, com o corpo lido do `fetch`: a rede falsa guarda só o caminho. */
function corposEnviados(metodo: string): unknown[] {
  const chamadas = (fetch as unknown as Mock<(caminho: string, opcoes?: RequestInit) => Promise<Response>>).mock.calls
  return chamadas.filter(([, opcoes]) => opcoes?.method === metodo).map(([, opcoes]) => JSON.parse(String(opcoes?.body)) as unknown)
}

async function abrirOAplicar(usuario: ReturnType<typeof userEvent.setup>) {
  renderScreen(<AplicacaoDoArtefato artefato={ARTEFATO} nomeDaTurma="7ºA" />)
  await usuario.click(await screen.findByRole('button', { name: 'Aplicar à turma' }))
  return screen.getByRole('alertdialog', { name: 'Aplicar à turma' })
}

const escrever = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } })

/** Escreve a janela da prova de 24/11, das 10:00 às `fecha`, com a duração dada. */
function escreverAJanela(fecha: string, duracao: string) {
  escrever('Abre em', '2026-11-24T10:00')
  escrever('Fecha em', `2026-11-24T${fecha}`)
  escrever('Duração (minutos)', duracao)
}

describe('os campos da avaliativa', () => {
  it('a prática não tem campo de prova nem lê os alunos; a avaliativa traz os seis campos pelo rótulo, o tempo adicional em +25%, +50% e +100% e nenhum campo de motivo', async () => {
    const rede = redeDeAplicar()
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É prática/ }))
    for (const rotulo of ['Abre em', 'Fecha em', 'Duração (minutos)', 'Embaralhar questões', 'Embaralhar alternativas', 'Tempo adicional']) expect(screen.queryByLabelText(rotulo), rotulo).toBeNull()
    expect(rede.chamadas.some((chamada) => chamada.caminho.startsWith(`/v1/turmas/${TURMA}/alunos`))).toBe(false)

    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    expect(screen.getByLabelText('Abre em')).toHaveProperty('type', 'datetime-local')
    expect(screen.getByLabelText('Fecha em')).toHaveProperty('type', 'datetime-local')
    expect(screen.getByLabelText('Duração (minutos)')).toHaveProperty('type', 'number')
    expect(screen.getByLabelText('Embaralhar questões')).toHaveProperty('type', 'checkbox')
    expect(screen.getByLabelText('Embaralhar alternativas')).toHaveProperty('type', 'checkbox')
    const tempoAdicional = screen.getByLabelText('Tempo adicional')
    // Sem erro, o grupo não aponta para texto de erro e traz só o título e a dica.
    expect(tempoAdicional.getAttribute('aria-describedby')).toBeNull()
    expect(tempoAdicional.querySelectorAll('p')).toHaveLength(2)
    // Um seletor por aluno, em ordem de nome, com as três opções e a de não ter.
    const ana = await within(tempoAdicional).findByRole('combobox', { name: 'Ana Souza' })
    expect(within(tempoAdicional).getAllByRole('combobox').map((campo) => (campo as HTMLSelectElement).labels?.[0]?.textContent)).toEqual(['Ana Souza', 'Bia Lima', 'Caio Nunes'])
    expect(within(ana).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual(['Sem tempo adicional', '+25%', '+50%', '+100%'])
    // Nenhum outro campo de escrita: sem motivo, sem laudo, sem observação.
    expect(within(dialogo).queryAllByRole('textbox')).toHaveLength(0)
    expect(within(dialogo).queryByLabelText(/motivo|laudo|observa/i)).toBeNull()
    expect(within(dialogo).getAllByRole('spinbutton')).toHaveLength(1)
  })

  it('sem escrever nada, confirmar mostra o erro de cada campo ligado a ele, e nenhum pedido sai', async () => {
    const rede = redeDeAplicar()
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    // Antes de tentar, nenhum erro.
    expect(within(dialogo).queryByText(TEXTO_DO_ABRE_VAZIO)).toBeNull()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar à turma' }))

    expect(screen.getByLabelText('Abre em').getAttribute('aria-invalid')).toBe('true')
    expect(within(dialogo).getByText(TEXTO_DO_ABRE_VAZIO)).toBeTruthy()
    expect(within(dialogo).getByText(TEXTO_DO_FECHA_VAZIO)).toBeTruthy()
    const descritoPor = (campo: HTMLElement) => (campo.getAttribute('aria-describedby') ?? '').split(' ').map((idDoTexto) => document.getElementById(idDoTexto)?.textContent ?? '')
    expect(descritoPor(screen.getByLabelText('Abre em'))).toContain(TEXTO_DO_ABRE_VAZIO)
    expect(descritoPor(screen.getByLabelText('Fecha em'))).toContain(TEXTO_DO_FECHA_VAZIO)
    expect(corposEnviados('POST')).toHaveLength(0)
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toHaveLength(0)
  })
})

describe('a lista do tempo adicional tem os quatro estados', () => {
  it('carregando: a lista diz que lê os alunos, e os campos da janela já estão na tela', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/atividades-aplicadas', ok({ itens: [] }))
    // A única chamada sem resposta preparada é a dos alunos: fica no ar até o teste liberar.
    const alunos = rede.segurar()
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    expect(await within(dialogo).findByText('Carregando os alunos da turma…')).toBeTruthy()
    expect(screen.getByLabelText('Abre em')).toBeTruthy()
    alunos.liberar(ok({ itens: [{ usuarioId: ANA, nome: 'Ana Souza' }] }))
    expect(await within(dialogo).findByRole('combobox', { name: 'Ana Souza' })).toBeTruthy()
    expect(within(dialogo).queryByText('Carregando os alunos da turma…')).toBeNull()
  })

  it('erro: diz a falha em português, com "Tentar de novo", e o novo clique lê e mostra os alunos; o pedido não é travado pela lista', async () => {
    const rede = fakeNetwork()
    let lidas = 0
    rede.responderPor('/v1/atividades-aplicadas', ok({ itens: [] }))
    rede.responderPor(`/v1/turmas/${TURMA}/alunos`, () => {
      lidas += 1
      return lidas === 1 ? erro(404, 'NAO_ENCONTRADO') : ok({ itens: [{ usuarioId: ANA, nome: 'Ana Souza' }] })
    })
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    const tentar = await within(dialogo).findByRole('button', { name: 'Tentar de novo' })
    expect(within(dialogo).getAllByRole('alert').length).toBeGreaterThan(0)
    expect(within(dialogo).queryByRole('combobox')).toBeNull()
    await usuario.click(tentar)
    expect(await within(dialogo).findByRole('combobox', { name: 'Ana Souza' })).toBeTruthy()
    expect(within(dialogo).queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })

  it('vazio: a turma sem alunos diz isso, e a prova ainda pode ser aplicada sem tempo adicional', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/atividades-aplicadas', (caminho) => (caminho.startsWith('/v1/atividades-aplicadas?') ? ok({ itens: [] }) : ok(APLICADA)))
    rede.responderPor(`/v1/turmas/${TURMA}/alunos`, ok({ itens: [] }))
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    expect(await within(dialogo).findByText('Esta turma ainda não tem alunos.')).toBeTruthy()
    escreverAJanela('11:40', '40')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar à turma' }))
    await waitFor(() => expect(corposEnviados('POST')).toHaveLength(1))
    expect(corposEnviados('POST')[0]).toMatchObject({ avaliativa: true, tempoAdicional: [] })
  })

  it('com dado e mais páginas: "Ver mais alunos" lê a próxima e junta, em ordem de nome', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/atividades-aplicadas', ok({ itens: [] }))
    rede.responderPor(`/v1/turmas/${TURMA}/alunos`, (caminho) =>
      caminho.includes('pagina=') ? ok({ itens: [{ usuarioId: ANA, nome: 'Ana Souza' }] }) : ok({ itens: [{ usuarioId: BIA, nome: 'Bia Lima' }], proxima: id(900) }),
    )
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    await within(dialogo).findByRole('combobox', { name: 'Bia Lima' })
    await usuario.click(within(dialogo).getByRole('button', { name: 'Ver mais alunos' }))
    await within(dialogo).findByRole('combobox', { name: 'Ana Souza' })
    expect(within(dialogo).getAllByRole('combobox').map((campo) => (campo as HTMLSelectElement).labels?.[0]?.textContent)).toEqual(['Ana Souza', 'Bia Lima'])
    expect(within(dialogo).queryByRole('button', { name: 'Ver mais alunos' })).toBeNull()
  })

  it('a lista vai em ordem de nome e, no mesmo nome, em ordem de id; a escolha de uma linha vai para o aluno dela, e não para o homônimo', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/atividades-aplicadas', (caminho) => (caminho.startsWith('/v1/atividades-aplicadas?') ? ok({ itens: [] }) : ok(APLICADA)))
    // A ordem de id (Zeca, Ana, Ana) não é a de nome (Ana, Ana, Zeca), e a rede devolve numa terceira ordem.
    rede.responderPor(
      `/v1/turmas/${TURMA}/alunos`,
      ok({ itens: [{ usuarioId: CAIO, nome: 'Ana Souza' }, { usuarioId: BIA, nome: 'Ana Souza' }, { usuarioId: ANA, nome: 'Zeca Dias' }] }),
    )
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    await within(dialogo).findAllByRole('combobox', { name: 'Ana Souza' })
    const seletores = within(dialogo).getAllByRole('combobox') as HTMLSelectElement[]
    expect(seletores.map((campo) => campo.labels?.[0]?.textContent)).toEqual(['Ana Souza', 'Ana Souza', 'Zeca Dias'])
    await usuario.selectOptions(seletores[0] as HTMLSelectElement, '25')
    expect(seletores.map((campo) => campo.value)).toEqual(['25', '0', '0'])
    escreverAJanela('11:40', '40')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar à turma' }))
    await waitFor(() => expect(corposEnviados('POST')).toHaveLength(1))
    // O primeiro homônimo, na ordem de id, é o BIA: é dele o tempo adicional.
    expect(corposEnviados('POST')[0]).toMatchObject({ tempoAdicional: [{ alunoId: BIA, percentual: 25 }] })
  })

  it('"Tentar de novo" volta a "Carregando os alunos…"; "Ver mais alunos" diz "Carregando…" e fica desligado enquanto lê', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/atividades-aplicadas', ok({ itens: [] }))
    let lidas = 0
    let liberarARelida: (resposta: FakeResponse) => void = () => undefined
    let liberarAProxima: (resposta: FakeResponse) => void = () => undefined
    rede.responderPor(`/v1/turmas/${TURMA}/alunos`, (caminho) => {
      lidas += 1
      if (lidas === 1) return erro(404, 'NAO_ENCONTRADO')
      if (caminho.includes('pagina=')) return new Promise<FakeResponse>((resolver) => (liberarAProxima = resolver))
      return new Promise<FakeResponse>((resolver) => (liberarARelida = resolver))
    })
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    await usuario.click(await within(dialogo).findByRole('button', { name: 'Tentar de novo' }))
    expect(await within(dialogo).findByText('Carregando os alunos da turma…')).toBeTruthy()
    liberarARelida(ok({ itens: [{ usuarioId: BIA, nome: 'Bia Lima' }], proxima: id(900) }))
    await usuario.click(await within(dialogo).findByRole('button', { name: 'Ver mais alunos' }))
    const carregando = await within(dialogo).findByRole('button', { name: 'Carregando…' })
    expect((carregando as HTMLButtonElement).disabled).toBe(true)
    liberarAProxima(ok({ itens: [{ usuarioId: ANA, nome: 'Ana Souza' }] }))
    await within(dialogo).findByRole('combobox', { name: 'Ana Souza' })
  })

  it('quem preencheu a prova e voltou a "É prática" aplica como prática: sem a prova no pedido, e sem a linha "Prova" no resumo', async () => {
    const rede = redeDeAplicar()
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    escreverAJanela('11:40', '40')
    await usuario.selectOptions(await screen.findByRole('combobox', { name: 'Ana Souza' }), '25')
    expect(within(dialogo).getByText(/^7ºA · abre 24\/11/)).toBeTruthy()
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É prática/ }))
    expect(within(dialogo).queryByText(/^7ºA · abre 24\/11/)).toBeNull()
    expect(within(dialogo).queryByText('Prova')).toBeNull()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar à turma' }))
    await waitFor(() => expect(corposEnviados('POST')).toHaveLength(1))
    expect(corposEnviados('POST')[0]).toEqual({ artefatoId: ARTEFATO.id, turmaId: TURMA, avaliativa: false })
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toHaveLength(1)
  })

  it('tempo adicional sem duração é erro do campo "Tempo adicional", e nenhum pedido sai', async () => {
    const rede = redeDeAplicar()
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    escrever('Abre em', '2026-11-24T10:00')
    escrever('Fecha em', '2026-11-24T11:40')
    await usuario.selectOptions(await screen.findByRole('combobox', { name: 'Ana Souza' }), '25')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar à turma' }))
    const grupo = screen.getByLabelText('Tempo adicional')
    expect(within(grupo).getByText(TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO)).toBeTruthy()
    expect(grupo.querySelectorAll('p')).toHaveLength(3)
    expect((grupo.getAttribute('aria-describedby') ?? '').split(' ').map((idDoTexto) => document.getElementById(idDoTexto)?.textContent)).toContain(TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO)
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toHaveLength(0)
  })
})

describe('o tempo que não cabe na janela', () => {
  it('50 min de janela com 40 de duração e um aluno com +50% recusam no campo "Fecha em", com a frase; com 30 min e +100% a frase muda os números', async () => {
    const rede = redeDeAplicar()
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    escreverAJanela('10:50', '40')
    await usuario.selectOptions(await screen.findByRole('combobox', { name: 'Ana Souza' }), '50')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar à turma' }))

    const frase = 'O tempo adicional não cabe na janela: com 40 min e +50%, a janela precisa de 60 min.'
    expect(within(dialogo).getByText(frase)).toBeTruthy()
    const campo = screen.getByLabelText('Fecha em')
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect((campo.getAttribute('aria-describedby') ?? '').split(' ').map((idDoTexto) => document.getElementById(idDoTexto)?.textContent)).toContain(frase)
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toHaveLength(0)

    // Com 30 min e o aluno em +100%, a frase diz os números novos.
    escrever('Duração (minutos)', '30')
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Ana Souza' }), '100')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar à turma' }))
    expect(within(dialogo).getByText('O tempo adicional não cabe na janela: com 30 min e +100%, a janela precisa de 60 min.')).toBeTruthy()
    expect(within(dialogo).queryByText(frase)).toBeNull()
  })
})

describe('o resumo e o pedido', () => {
  it('o resumo diz a prova no horário da escola, com a duração e quantos têm tempo adicional, sem dizer quais; a janela vai para a API em UTC', async () => {
    const rede = redeDeAplicar()
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    // Sem a prova conferida, o resumo não tem a linha da prova.
    expect(within(dialogo).queryByText('Prova')).toBeNull()
    escreverAJanela('11:40', '40')
    await usuario.selectOptions(await screen.findByRole('combobox', { name: 'Ana Souza' }), '25')
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Bia Lima' }), '100')
    await usuario.click(screen.getByLabelText('Embaralhar alternativas'))

    expect(within(dialogo).getByText('7ºA · abre 24/11 às 10:00 · fecha às 11:40 · 40 min · 2 alunos com tempo adicional')).toBeTruthy()
    expect(within(dialogo).queryByText(/Ana Souza.*\+25/)).toBeNull()
    // O resto do resumo é o de sempre: a atividade, a turma e quantas questões ela tem.
    expect(dialogo.textContent).toMatch(/Atividade de estequiometria.*7ºA.*Questões1/)

    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar à turma' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toHaveLength(1)
    expect(corposEnviados('POST')).toEqual([
      {
        artefatoId: ARTEFATO.id,
        turmaId: TURMA,
        avaliativa: true,
        janela: { abreEm: '2026-11-24T13:00:00.000Z', fechaEm: '2026-11-24T14:40:00.000Z' },
        duracaoMin: 40,
        embaralhar: { questoes: false, alternativas: true },
        tempoAdicional: [
          { alunoId: ANA, percentual: 25 },
          { alunoId: BIA, percentual: 100 },
        ],
      },
    ])
  })

  it('a prática sai como sempre saiu: sem janela, sem duração, sem embaralhar e sem tempo adicional', async () => {
    redeDeAplicar({ status: 201, corpo: { ...APLICADA, avaliativa: false, janela: null, duracaoMin: null } })
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É prática/ }))
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar à turma' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(corposEnviados('POST')).toEqual([{ artefatoId: ARTEFATO.id, turmaId: TURMA, avaliativa: false }])
  })

  it('dois cliques no mesmo instante em "Aplicar à turma" mandam um pedido só (regra 80, item 7)', async () => {
    redeDeAplicar({ status: 201, corpo: { ...APLICADA, avaliativa: false, janela: null, duracaoMin: null } })
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É prática/ }))
    // Os dois cliques caem antes de a tela desligar o botão: quem segura o segundo é a trava, e não o `disabled`.
    const confirmar = within(dialogo).getByRole('button', { name: 'Aplicar à turma' })
    act(() => {
      confirmar.click()
      confirmar.click()
    })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(corposEnviados('POST')).toHaveLength(1)
  })

  it('o aluno que perdeu o tempo adicional na lista (escolheu e voltou para "Sem tempo adicional") não vai no pedido', async () => {
    redeDeAplicar()
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    escreverAJanela('11:40', '40')
    const ana = await screen.findByRole('combobox', { name: 'Ana Souza' })
    await usuario.selectOptions(ana, '50')
    await usuario.selectOptions(ana, '0')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar à turma' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(corposEnviados('POST')[0]).toMatchObject({ tempoAdicional: [] })
  })
})

describe('recomeçar o diálogo', () => {
  it('a falha do servidor fica no diálogo; fechar e abrir de novo limpa o erro e o que foi escrito', async () => {
    redeDeAplicar(erro(503, 'INDISPONIVEL_TENTE_DE_NOVO'))
    const usuario = userEvent.setup()
    const dialogo = await abrirOAplicar(usuario)
    await usuario.click(within(dialogo).getByRole('radio', { name: /^É avaliativa/ }))
    escreverAJanela('11:40', '40')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar à turma' }))
    await waitFor(() => expect(within(dialogo).getAllByRole('alert').some((aviso) => (aviso.textContent ?? '') !== '')).toBe(true))

    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await usuario.click(screen.getByRole('button', { name: 'Aplicar à turma' }))
    const reaberto = screen.getByRole('alertdialog', { name: 'Aplicar à turma' })
    expect(within(reaberto).getAllByRole('alert').every((aviso) => (aviso.textContent ?? '') === '')).toBe(true)
    expect(within(reaberto).queryAllByRole('radio', { checked: true })).toHaveLength(0)
    await usuario.click(within(reaberto).getByRole('radio', { name: /^É avaliativa/ }))
    expect((screen.getByLabelText('Abre em') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Duração (minutos)') as HTMLInputElement).value).toBe('')
  })
})

describe('mudar a janela, só antes do primeiro início', () => {
  const montar = (aplicada: AtividadeAplicada) => renderScreen(<MudarJanela aplicada={aplicada} nomeDaTurma="7ºA" focoDeReserva={() => undefined} />)
  const patches = (rede: FakeNetwork) => rede.chamadas.filter((chamada) => chamada.metodo === 'PATCH')

  it('o botão existe na prova avaliativa aberta que ninguém começou; some com alguém começado, com a atividade encerrada, sem janela ou prática', () => {
    fakeNetwork()
    const { unmount } = montar(APLICADA)
    expect(screen.getByRole('button', { name: 'Mudar janela' })).toBeTruthy()
    // Fechado, o diálogo não existe na tela.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    unmount()
    const casos: [string, AtividadeAplicada][] = [
      ['alguém começou', { ...APLICADA, participacao: { alunos: 3, iniciaram: 1, enviaram: 0 } }],
      ['encerrada', { ...APLICADA, estado: 'encerrada', encerradaEm: '2026-11-24T14:40:00.000Z' }],
      ['sem janela (a de antes da F6)', { ...APLICADA, janela: null, duracaoMin: null }],
      ['prática', { ...APLICADA, avaliativa: false, janela: null, duracaoMin: null }],
    ]
    for (const [motivo, aplicada] of casos) {
      const { unmount: desmontar } = montar(aplicada)
      expect(screen.queryByRole('button', { name: 'Mudar janela' }), motivo).toBeNull()
      desmontar()
    }
  })

  it('o diálogo diz "Ninguém começou ainda", abre com a janela de agora no horário da escola e mostra a janela nova antes de gravar; só então o PATCH sai, em UTC', async () => {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${APLICADA.id}/janela`, ok({ ...APLICADA, janela: { abreEm: '2026-11-25T13:00:00.000Z', fechaEm: '2026-11-25T15:00:00.000Z' }, duracaoMin: 60 }))
    rede.responderPor('/v1/atividades-aplicadas', ok({ itens: [] }))
    const usuario = userEvent.setup()
    montar(APLICADA)
    await usuario.click(screen.getByRole('button', { name: 'Mudar janela' }))
    const dialogo = screen.getByRole('alertdialog', { name: 'Mudar a janela da prova' })
    expect(within(dialogo).getByText(TEXTO_DE_NINGUEM_COMECOU)).toBeTruthy()
    expect((screen.getByLabelText('Abre em') as HTMLInputElement).value).toBe('2026-11-24T10:00')
    expect((screen.getByLabelText('Fecha em') as HTMLInputElement).value).toBe('2026-11-24T11:40')
    expect((screen.getByLabelText('Duração (minutos)') as HTMLInputElement).value).toBe('40')
    expect(within(dialogo).getByText('7ºA · abre 24/11 às 10:00 · fecha às 11:40 · 40 min')).toBeTruthy()
    expect(patches(rede)).toHaveLength(0)

    escrever('Abre em', '2026-11-25T10:00')
    escrever('Fecha em', '2026-11-25T12:00')
    escrever('Duração (minutos)', '60')
    expect(within(dialogo).getByText('7ºA · abre 25/11 às 10:00 · fecha às 12:00 · 60 min')).toBeTruthy()
    expect(patches(rede)).toHaveLength(0)
    // Sem falha nenhuma, o aviso do diálogo está vazio.
    expect(within(dialogo).getAllByRole('alert').map((aviso) => aviso.textContent)).toEqual([''])

    // Dois cliques seguidos em confirmar mandam um pedido só (regra 80, item 7).
    // Os dois cliques caem antes de a tela desligar o botão: quem segura o segundo é a trava, e não o `disabled`.
    const confirmar = within(dialogo).getByRole('button', { name: 'Mudar a janela' })
    act(() => {
      confirmar.click()
      confirmar.click()
    })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(patches(rede)).toHaveLength(1)
    expect(corposEnviados('PATCH')).toEqual([{ janela: { abreEm: '2026-11-25T13:00:00.000Z', fechaEm: '2026-11-25T15:00:00.000Z' }, duracaoMin: 60 }])
  })

  it('a janela com o fim antes da abertura mostra o erro no campo e não manda pedido; a duração apagada numa prova que a tinha também', async () => {
    const rede = fakeNetwork()
    const usuario = userEvent.setup()
    montar(APLICADA)
    await usuario.click(screen.getByRole('button', { name: 'Mudar janela' }))
    const dialogo = screen.getByRole('alertdialog')
    escrever('Fecha em', '2026-11-24T09:00')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Mudar a janela' }))
    expect(within(dialogo).getByText('A prova precisa fechar depois de abrir.')).toBeTruthy()
    escrever('Fecha em', '2026-11-24T11:40')
    escrever('Duração (minutos)', '')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Mudar a janela' }))
    expect(within(dialogo).getByText('A prova já tem duração: diga a nova. Não dá para tirá-la por aqui.')).toBeTruthy()
    expect(patches(rede)).toHaveLength(0)
  })

  it('o erro de um campo só aparece depois de tentar confirmar, e reaparece limpo quando o diálogo recomeça', async () => {
    const rede = fakeNetwork()
    const usuario = userEvent.setup()
    montar(APLICADA)
    await usuario.click(screen.getByRole('button', { name: 'Mudar janela' }))
    const dialogo = screen.getByRole('alertdialog')
    const texto = 'A prova já tem duração: diga a nova. Não dá para tirá-la por aqui.'
    escrever('Duração (minutos)', '')
    expect(within(dialogo).queryByText(texto)).toBeNull()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Mudar a janela' }))
    expect(within(dialogo).getByText(texto)).toBeTruthy()
    // Fechar e abrir de novo volta ao que está gravado, sem o erro de antes.
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await usuario.click(screen.getByRole('button', { name: 'Mudar janela' }))
    expect(screen.queryByText(texto)).toBeNull()
    expect((screen.getByLabelText('Duração (minutos)') as HTMLInputElement).value).toBe('40')
    expect(patches(rede)).toHaveLength(0)
  })

  it('a prova sem duração abre com o campo vazio, e o PATCH leva só a janela', async () => {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${APLICADA.id}/janela`, ok(APLICADA))
    rede.responderPor('/v1/atividades-aplicadas', ok({ itens: [] }))
    const usuario = userEvent.setup()
    montar({ ...APLICADA, duracaoMin: null })
    await usuario.click(screen.getByRole('button', { name: 'Mudar janela' }))
    const dialogo = screen.getByRole('alertdialog')
    expect((screen.getByLabelText('Duração (minutos)') as HTMLInputElement).value).toBe('')
    expect(within(dialogo).getByText('7ºA · abre 24/11 às 10:00 · fecha às 11:40')).toBeTruthy()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Mudar a janela' }))
    await waitFor(() => expect(patches(rede)).toHaveLength(1))
    expect(corposEnviados('PATCH')).toStrictEqual([{ janela: APLICADA.janela }])
  })

  it('se alguém começou entre abrir a tela e confirmar, a resposta é PROVA_JA_COMECOU: o diálogo diz em português e fica até a pessoa fechar; a lista relida e o botão que sai são do painel (AtividadesDaTurma.test.tsx)', async () => {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${APLICADA.id}/janela`, erro(409, 'PROVA_JA_COMECOU'))
    rede.responderPor('/v1/atividades-aplicadas', ok({ itens: [{ ...APLICADA, participacao: { alunos: 3, iniciaram: 1, enviaram: 0 } }] }))
    const usuario = userEvent.setup()
    montar(APLICADA)
    await usuario.click(screen.getByRole('button', { name: 'Mudar janela' }))
    const dialogo = screen.getByRole('alertdialog')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Mudar a janela' }))
    expect(await within(dialogo).findByText(/Alguém já começou esta prova/)).toBeTruthy()
    expect(patches(rede)).toHaveLength(1)
    // O diálogo fica até a pessoa fechar, com o erro, e o código cru não aparece.
    expect(within(dialogo).queryByText(/PROVA_JA_COMECOU/)).toBeNull()
  })

  it('a janela nova que o tempo adicional já marcado não comporta é recusada pela API, e o texto diz o que fazer; sem tempo adicional, o texto é o geral', async () => {
    const rede = fakeNetwork()
    rede.responderPor(`/v1/atividades-aplicadas/${APLICADA.id}/janela`, erro(400, 'ENTRADA_INVALIDA'))
    rede.responderPor('/v1/atividades-aplicadas', ok({ itens: [] }))
    const usuario = userEvent.setup()
    const { unmount } = montar({ ...APLICADA, comTempoAdicional: 2 })
    await usuario.click(screen.getByRole('button', { name: 'Mudar janela' }))
    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Mudar a janela' }))
    expect(await screen.findByText(TEXTO_DO_TEMPO_ADICIONAL_JA_MARCADO)).toBeTruthy()
    unmount()

    montar(APLICADA)
    await usuario.click(screen.getByRole('button', { name: 'Mudar janela' }))
    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Mudar a janela' }))
    await waitFor(() => expect(patches(rede)).toHaveLength(2))
    await waitFor(() => expect(screen.getAllByRole('alert').some((aviso) => /não estão corretos/i.test(aviso.textContent ?? ''))).toBe(true))
    expect(screen.queryByText(TEXTO_DO_TEMPO_ADICIONAL_JA_MARCADO)).toBeNull()
  })
})
