// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { prepararTela, redeFalsa, renderizarTela, type RedeFalsa, type RespostaFalsa } from '../../../__fixtures__/render-screen'
import { TEXTO_DO_ESTADO_DO_PROFESSOR } from './convite-de-professor'
import Professores from './Professores'

/**
 * As turmas do professor e o "Acrescentar turma" no painel dele (telas da coordenação, 7.0; RF14 e RF22): os estados da seção, o
 * vínculo em texto — encerrado ao lado de aberto, contestado com o motivo —, quem recebe turma e quem vê por que não, o diálogo
 * que alocou, as falhas dele e o foco depois. O painel mora em `Professores`, e é por ela que o teste o abre, pelo endereço. A rede
 * é falsa e responde por caminho; a tela, o cliente de consultas e a sessão são os da aba. O que só o navegador mede (o clique
 * duplo no navegador real, a corrida entre duas pessoas, o recomeço com outra sessão e o celular de 360 px) é do e2e `alocacao`.
 */
prepararTela()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const ANO = { id: id(1), ano: 2026, inicio: '2026-02-02', fim: '2026-12-18', situacao: 'em_curso' }
const ANO_PLANEJADO = { ...ANO, id: id(2), situacao: 'planejado' }
const SERIE_7 = { id: id(207), etapa: 'ef_anos_finais', ano: 7 }
const SERIE_8 = { id: id(208), etapa: 'ef_anos_finais', ano: 8 }
const turma = (n: number, nome: string, serie: { id: string }) => ({ id: id(100 + n), anoLetivoId: ANO.id, nome, turno: null, serie })
const T7A = turma(1, '7ºA', SERIE_7)
const T7B = turma(2, '7ºB', SERIE_7)
const T8A = turma(3, '8ºA', SERIE_8)
const MATEMATICA = { id: id(500), nome: 'Matemática', area: null }
const FISICA = { id: id(501), nome: 'Física', area: null }
const professor = (n: number, nome: string, estado: string) => ({ usuarioId: id(300 + n), nome, estado })
const ANA = professor(1, 'Ana Sintética', 'aceito')
const BRUNO = professor(2, 'Bruno Sintético', 'pendente')
const CAIO = professor(3, 'Caio Sintético', 'vencido')
const DAVI = professor(4, 'Davi Sintético', 'revogado')
const ELIS = professor(5, 'Elis Sintética', 'ativo')
const FABIO = professor(6, 'Fábio Sintético', 'desativado')
const vinculo = (n: number, dono: { usuarioId: string }, turmaDele: { id: string; nome: string }, disciplina: { id: string; nome: string }, estado: string, extra: Record<string, unknown> = {}) => ({
  id: id(400 + n),
  usuarioId: dono.usuarioId,
  papel: 'professor',
  turma: { id: turmaDele.id, nome: turmaDele.nome },
  disciplina: { id: disciplina.id, nome: disciplina.nome },
  estado,
  ...extra,
})

const ERRO = (codigo: string, status: number): RespostaFalsa => ({
  status,
  corpo: { erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } },
})
/** Um erro que a leitura não repete sozinha: a tela mostra o erro na hora, e não depois da nova tentativa de um segundo. */
const FALHA = ERRO('LIMITE_EXCEDIDO', 429)
const ok = (itens: readonly unknown[], extra: Record<string, unknown> = {}): RespostaFalsa => ({ status: 200, corpo: { itens, ...extra } })
const nuncaResponde = () => new Promise<RespostaFalsa>(() => undefined)

type Resposta = RespostaFalsa | (() => RespostaFalsa | Promise<RespostaFalsa>)
interface Respostas {
  anos: Resposta
  professores: Resposta
  vinculos: Resposta
  turmas: Resposta
  disciplinas: Resposta
}
const TODOS = [ANA, BRUNO, CAIO, DAVI, ELIS, FABIO]
const PADRAO: Respostas = {
  anos: ok([ANO]),
  professores: ok(TODOS),
  vinculos: ok([]),
  // Fora da ordem do nome: o diálogo é que põe cada turma e cada disciplina no seu lugar.
  turmas: ok([T8A, T7B, T7A]),
  disciplinas: ok([MATEMATICA, FISICA]),
}

function instalar(rede: RedeFalsa, parcial: Partial<Respostas> = {}): void {
  const respostas = { ...PADRAO, ...parcial }
  rede.responderPor(/^\/v1\/anos-letivos\?/, respostas.anos)
  rede.responderPor('/v1/professores', respostas.professores)
  rede.responderPor('/v1/vinculos', respostas.vinculos)
  rede.responderPor(/^\/v1\/turmas\?/, respostas.turmas)
  rede.responderPor('/v1/disciplinas', respostas.disciplinas)
}

/** Os caminhos pedidos, sem a consulta, na ordem. */
const caminhosDe = (rede: RedeFalsa) => rede.chamadas.map((chamada) => chamada.caminho.split('?')[0])
const vezes = (rede: RedeFalsa, caminho: string, metodo = 'GET') => rede.chamadas.filter((chamada) => chamada.caminho.split('?')[0] === caminho && chamada.metodo === metodo).length

/**
 * A resposta de `/v1/vinculos`, que é o mesmo caminho da leitura (`GET`) e da alocação (`POST`): a lista para quem lê, e a resposta do
 * caso para quem aloca. A rede falsa responde por caminho, sem olhar o método; o último pedido registrado é o que está chegando.
 */
function porMetodo(rede: RedeFalsa, lista: () => unknown[], aoAlocar: () => RespostaFalsa | Promise<RespostaFalsa>): Resposta {
  return () => (rede.chamadas.at(-1)?.metodo === 'POST' ? aoAlocar() : ok(lista()))
}

/** O corpo de cada `POST` que sai, na ordem: a rede falsa guarda o caminho e o método, e não o que foi enviado. */
function gravarCorposDosPosts(): unknown[] {
  const corpos: unknown[] = []
  const rede = globalThis.fetch
  vi.stubGlobal('fetch', (caminho: string, opcoes?: RequestInit) => {
    if (opcoes?.method === 'POST' && typeof opcoes.body === 'string') corpos.push(JSON.parse(opcoes.body))
    return rede(caminho, opcoes)
  })
  return corpos
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta === '(min-width: 768px)',
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
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

/** A tela Professores aberta no painel do professor, pelo endereço. */
function abrirPainelDe(dono: { usuarioId: string }) {
  const localizacao = memoryLocation({ path: '/professores', searchPath: `professor=${dono.usuarioId}`, record: true })
  renderizarTela(
    <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
      <Professores />
    </Router>,
  )
  return localizacao
}

const painelDe = (dono: { nome: string }) => screen.findByRole('dialog', { name: dono.nome })
/** O painel aberto e as turmas dele lidas: a seção sai de "Carregando" quando as leituras terminam. */
async function painelComTurmasLidas(dono: { nome: string; usuarioId: string }) {
  abrirPainelDe(dono)
  const painel = await painelDe(dono)
  await waitFor(() => expect(within(painel).queryByText('Carregando as turmas…')).toBeNull())
  return painel
}
const secaoDasTurmas = (painel: HTMLElement) => within(painel).getByRole('region', { name: 'Turmas' })

describe('os estados da seção "Turmas"', () => {
  it('carregando: os vínculos no ar; nem "Nenhuma turma" nem o botão aparecem antes da leitura', async () => {
    instalar(redeFalsa(), { vinculos: nuncaResponde })
    abrirPainelDe(BRUNO)
    const painel = await painelDe(BRUNO)
    expect(await within(painel).findByText('Carregando as turmas…')).toBeTruthy()
    expect(within(painel).queryByText('Nenhuma turma.')).toBeNull()
    expect(within(painel).queryByRole('list', { name: 'Turmas do professor' })).toBeNull()
  })

  it('carregando os anos: a seção espera, e não afirma que não há ano em curso', async () => {
    instalar(redeFalsa(), { anos: nuncaResponde })
    abrirPainelDe(BRUNO)
    const painel = await painelDe(BRUNO)
    expect(await within(painel).findByText('Carregando as turmas…')).toBeTruthy()
    expect(within(painel).queryByText(/As turmas são do ano letivo em curso/)).toBeNull()
    expect(within(painel).queryByText('Nenhuma turma.')).toBeNull()
  })

  it('o miolo rolável do painel está no ciclo do Tab e recebe o foco inicial: quem usa teclado alcança o que rola', async () => {
    instalar(redeFalsa())
    const painel = await painelComTurmasLidas(BRUNO)
    const miolo = painel.querySelector('[data-painel-miolo]')
    expect(miolo?.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(miolo)
  })

  it('erro nos vínculos: a mensagem curta e "Tentar de novo", que lê só o que falhou', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let falhar = true
    instalar(rede, { vinculos: () => (falhar ? FALHA : ok([vinculo(1, BRUNO, T7A, MATEMATICA, 'pendente')])) })
    abrirPainelDe(BRUNO)
    const painel = await painelDe(BRUNO)
    await within(painel).findByRole('alert')
    expect(within(painel).queryByText('Nenhuma turma.')).toBeNull()
    falhar = false
    await usuario.click(within(painel).getByRole('button', { name: 'Tentar de novo' }))
    expect(await within(painel).findByText('7ºA')).toBeTruthy()
    expect(vezes(rede, '/v1/vinculos')).toBe(2)
    expect(vezes(rede, '/v1/anos-letivos')).toBe(1)
    expect(vezes(rede, '/v1/turmas')).toBe(1)
  })

  it('erro nas turmas da escola: o mesmo erro, e "Tentar de novo" lê só as turmas, que liberam o botão', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let falhar = true
    instalar(rede, { turmas: () => (falhar ? FALHA : ok([T7A])) })
    abrirPainelDe(BRUNO)
    const painel = await painelDe(BRUNO)
    await within(painel).findByRole('alert')
    expect(within(painel).queryByRole('button', { name: 'Acrescentar turma' })).toBeNull()
    falhar = false
    await usuario.click(within(painel).getByRole('button', { name: 'Tentar de novo' }))
    expect(await within(painel).findByRole('button', { name: 'Acrescentar turma' })).toBeTruthy()
    expect(vezes(rede, '/v1/turmas')).toBe(2)
    expect(vezes(rede, '/v1/vinculos')).toBe(1)
  })

  it('vazio: "Nenhuma turma." para quem não tem vínculo; a lista que passou do teto de páginas avisa e não afirma o vazio', async () => {
    instalar(redeFalsa())
    const painel = await painelComTurmasLidas(ELIS)
    expect(within(painel).getByText('Nenhuma turma.')).toBeTruthy()
    expect(within(painel).queryByRole('list', { name: 'Turmas do professor' })).toBeNull()
    cleanup()
    // Toda página diz que há outra: a tela lê até o teto e para, e o professor pode ter turma na parte que ficou de fora.
    instalar(redeFalsa(), { vinculos: () => ok([vinculo(9, ANA, T7A, MATEMATICA, 'confirmado')], { proxima: id(999) }) })
    const incompleto = await painelComTurmasLidas(ELIS)
    expect(within(incompleto).queryByText('Nenhuma turma.')).toBeNull()
    expect(within(incompleto).getByText('A lista é maior do que esta tela mostra: aparecem só os primeiros.')).toBeTruthy()
  })

  it('com dado: um item por vínculo — turma, disciplina e o estado em texto —, pela turma e pela disciplina, e só os do professor do painel', async () => {
    instalar(redeFalsa(), {
      vinculos: ok([
        vinculo(1, ANA, T8A, FISICA, 'confirmado'),
        vinculo(2, ANA, T7A, MATEMATICA, 'confirmado'),
        vinculo(3, ANA, T7A, FISICA, 'pendente'),
        vinculo(4, BRUNO, T7B, MATEMATICA, 'confirmado'),
      ]),
    })
    const painel = await painelComTurmasLidas(ANA)
    const itens = within(within(painel).getByRole('list', { name: 'Turmas do professor' })).getAllByRole('listitem')
    expect(itens.map((item) => item.textContent)).toEqual([
      '7ºAFísicaEsperando o professor confirmar',
      '7ºAMatemáticaConfirmou',
      '8ºAFísicaConfirmou',
    ])
    expect(painel.textContent).not.toContain('7ºB')
  })

  it('o vínculo sem disciplina diz "Sem disciplina", em vez de deixar a linha vazia', async () => {
    instalar(redeFalsa(), { vinculos: ok([vinculo(1, BRUNO, T7A, MATEMATICA, 'pendente', { disciplina: undefined })]) })
    const painel = await painelComTurmasLidas(BRUNO)
    const itens = within(within(painel).getByRole('list', { name: 'Turmas do professor' })).getAllByRole('listitem')
    expect(itens.map((item) => item.textContent)).toEqual(['7ºASem disciplinaEsperando o professor confirmar'])
  })

  it('o contestado diz o motivo e o complemento que o professor escreveu, e a saída é acrescentar a turma certa', async () => {
    instalar(redeFalsa(), { vinculos: ok([vinculo(1, BRUNO, T7B, MATEMATICA, 'contestado', { contestacao: 'turma_errada', complemento: 'Dou aula na 7ºA.' })]) })
    const painel = await painelComTurmasLidas(BRUNO)
    const secao = secaoDasTurmas(painel)
    expect(within(secao).getByText('Contestou')).toBeTruthy()
    expect(within(secao).getByText('Motivo: A turma está errada')).toBeTruthy()
    expect(within(secao).getByText('Explicação do professor: “Dou aula na 7ºA.”')).toBeTruthy()
    expect(within(secao).getByText('Para corrigir uma turma contestada, acrescente a turma certa.')).toBeTruthy()
  })

  it('o contestado sem complemento não inventa a linha dele; a dica de corrigir só aparece para quem ainda recebe turma', async () => {
    instalar(redeFalsa(), {
      vinculos: ok([vinculo(1, BRUNO, T7B, MATEMATICA, 'contestado', { contestacao: 'nao_leciono' }), vinculo(2, CAIO, T8A, FISICA, 'contestado', { contestacao: 'outro' })]),
    })
    const doBruno = await painelComTurmasLidas(BRUNO)
    expect(within(doBruno).getByText('Motivo: Não dou aula nesta turma')).toBeTruthy()
    expect(within(doBruno).queryByText(/Explicação do professor/)).toBeNull()
    cleanup()
    instalar(redeFalsa(), { vinculos: ok([vinculo(2, CAIO, T8A, FISICA, 'contestado', { contestacao: 'outro' })]) })
    const doCaio = await painelComTurmasLidas(CAIO)
    expect(within(doCaio).getByText('Contestou')).toBeTruthy()
    expect(within(doCaio).queryByText('Para corrigir uma turma contestada, acrescente a turma certa.')).toBeNull()
  })

  it('sem ano em curso: a seção diz que as turmas são do ano em curso, e vínculos, turmas e disciplinas nem são pedidos', async () => {
    const rede = redeFalsa()
    instalar(rede, { anos: ok([ANO_PLANEJADO]) })
    const painel = await painelComTurmasLidas(BRUNO)
    expect(within(painel).getByText('As turmas são do ano letivo em curso. Abra o ano letivo na tela Turmas.')).toBeTruthy()
    expect(within(painel).queryByRole('button', { name: 'Acrescentar turma' })).toBeNull()
    expect(caminhosDe(rede).filter((caminho) => ['/v1/vinculos', '/v1/turmas', '/v1/disciplinas'].includes(caminho ?? ''))).toEqual([])
  })
})

describe('o que falta criar, só com as leituras terminadas', () => {
  it('sem turma na escola: o vazio pede a turma, e não o professor nem a disciplina; sem o botão', async () => {
    instalar(redeFalsa(), { turmas: ok([]) })
    const painel = await painelComTurmasLidas(BRUNO)
    expect(within(painel).getByText('Crie uma turma primeiro')).toBeTruthy()
    expect(within(painel).getByText('A alocação liga um professor a uma turma e a uma disciplina. Falta: uma turma.')).toBeTruthy()
    expect(within(painel).queryByRole('button', { name: 'Acrescentar turma' })).toBeNull()
    expect(within(painel).queryByRole('link', { name: 'Ir para Professores' })).toBeNull()
  })

  it('sem disciplina, e sem as duas: o título diz só o que falta', async () => {
    instalar(redeFalsa(), { disciplinas: ok([]) })
    expect(within(await painelComTurmasLidas(BRUNO)).getByText('Crie uma disciplina primeiro')).toBeTruthy()
    cleanup()
    instalar(redeFalsa(), { turmas: ok([]), disciplinas: ok([]) })
    expect(within(await painelComTurmasLidas(BRUNO)).getByText('Crie uma turma e uma disciplina primeiro')).toBeTruthy()
  })

  it('com a leitura das turmas ainda no ar, nada de vazio nem de botão: o que não foi lido não vira "falta"', async () => {
    instalar(redeFalsa(), { turmas: nuncaResponde })
    abrirPainelDe(BRUNO)
    const painel = await painelDe(BRUNO)
    expect(await within(painel).findByText('Carregando as turmas…')).toBeTruthy()
    expect(within(painel).queryByText(/Crie/)).toBeNull()
    expect(within(painel).queryByRole('button', { name: 'Acrescentar turma' })).toBeNull()
  })

  it('o vazio e o botão da escola montada não aparecem juntos: com turma e disciplina, só o botão', async () => {
    instalar(redeFalsa())
    const painel = await painelComTurmasLidas(BRUNO)
    expect(within(painel).getByRole('button', { name: 'Acrescentar turma' })).toBeTruthy()
    expect(within(painel).queryByText(/Crie/)).toBeNull()
  })
})

describe('quem recebe turma e quem vê por quê não', () => {
  it('o convite em aberto, o aceito e o ativo têm "Acrescentar turma" e nenhum motivo de não ter', async () => {
    for (const dono of [BRUNO, ANA, ELIS]) {
      instalar(redeFalsa())
      const painel = await painelComTurmasLidas(dono)
      expect(within(painel).getByRole('button', { name: 'Acrescentar turma' }), dono.nome).toBeTruthy()
      expect(painel.textContent, dono.nome).not.toMatch(/acrescentar uma turma/)
      cleanup()
    }
  })

  it('o convite vencido, o revogado e a conta desativada não têm o botão, veem por quê, e as turmas e as disciplinas da escola nem são lidas', async () => {
    const porque: [{ nome: string; usuarioId: string }, string][] = [
      [CAIO, 'O convite venceu. Refaça o convite para acrescentar uma turma.'],
      [DAVI, 'O convite foi revogado. Para acrescentar uma turma, cadastre o mesmo e-mail de novo.'],
      [FABIO, 'A conta foi desativada. Para acrescentar uma turma, cadastre o mesmo e-mail de novo.'],
    ]
    for (const [dono, texto] of porque) {
      const rede = redeFalsa()
      instalar(rede)
      const painel = await painelComTurmasLidas(dono)
      expect(within(painel).getByText(texto), dono.nome).toBeTruthy()
      expect(within(painel).queryByRole('button', { name: 'Acrescentar turma' }), dono.nome).toBeNull()
      expect(caminhosDe(rede).filter((caminho) => caminho === '/v1/turmas' || caminho === '/v1/disciplinas'), dono.nome).toEqual([])
      cleanup()
    }
  })

  it('o vencido ainda refaz e revoga o convite, e o painel continua dizendo a situação dele', async () => {
    instalar(redeFalsa())
    const painel = await painelComTurmasLidas(CAIO)
    expect(within(painel).getByText(TEXTO_DO_ESTADO_DO_PROFESSOR.vencido)).toBeTruthy()
    expect(within(painel).getByRole('button', { name: 'Refazer convite' })).toBeTruthy()
    expect(within(painel).getByRole('button', { name: 'Revogar convite' })).toBeTruthy()
  })
})

describe('o vínculo encerrado ao lado do aberto', () => {
  const ENCERRADO = vinculo(1, ANA, T7A, MATEMATICA, 'encerrado', { motivoEncerramento: 'fim_do_ano' })
  const ABERTO = vinculo(2, ANA, T8A, FISICA, 'pendente')

  it('os dois aparecem, cada um com o estado dele, e o motivo de encerrar só no encerrado', async () => {
    instalar(redeFalsa(), { vinculos: ok([ABERTO, ENCERRADO]) })
    const painel = await painelComTurmasLidas(ANA)
    const itens = within(within(painel).getByRole('list', { name: 'Turmas do professor' })).getAllByRole('listitem')
    expect(itens.map((item) => item.textContent)).toEqual(['7ºAMatemáticaEncerradaMotivo: fim do ano letivo', '8ºAFísicaEsperando o professor confirmar'])
  })

  it('"Acrescentar turma" aceita de novo a turma e a disciplina do encerrado, e o pedido sai com o professor do painel', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede, { vinculos: porMetodo(rede, () => [ABERTO, ENCERRADO], () => ({ status: 201, corpo: vinculo(3, ANA, T7A, MATEMATICA, 'pendente') })) })
    const painel = await painelComTurmasLidas(ANA)
    const corpos = gravarCorposDosPosts()
    await usuario.click(within(painel).getByRole('button', { name: 'Acrescentar turma' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Acrescentar turma' })
    // A escolha é toda a lista da escola, pelo nome (7ºA antes de 8ºA): a turma do encerrado está nela.
    expect(within(within(dialogo).getByLabelText('Turma')).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual(['Escolha a turma', '7ºA', '7ºB', '8ºA'])
    expect(within(within(dialogo).getByLabelText('Disciplina')).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual(['Escolha a disciplina', 'Física', 'Matemática'])
    await usuario.selectOptions(within(dialogo).getByLabelText('Turma'), '7ºA')
    await usuario.selectOptions(within(dialogo).getByLabelText('Disciplina'), 'Matemática')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Acrescentar' }))
    await waitFor(() => expect(corpos).toHaveLength(1))
    expect(corpos[0]).toEqual({ usuarioId: ANA.usuarioId, turmaId: T7A.id, disciplinaId: MATEMATICA.id, papel: 'professor' })
  })
})

describe('"Acrescentar turma": o diálogo', () => {
  const NOVO = vinculo(1, BRUNO, T7A, MATEMATICA, 'pendente')

  /** A rede com os vínculos que o caso quer, e a resposta do POST da alocação; devolve a rede para o caso ler os pedidos. */
  function comAlocacao(aoAlocar: () => RespostaFalsa | Promise<RespostaFalsa>, parcial: Partial<Respostas> = {}, lista: () => unknown[] = () => []) {
    const rede = redeFalsa()
    instalar(rede, { vinculos: porMetodo(rede, lista, aoAlocar), ...parcial })
    return rede
  }
  async function abrirODialogo(painel: HTMLElement) {
    const usuario = userEvent.setup()
    await usuario.click(within(painel).getByRole('button', { name: 'Acrescentar turma' }))
    return { usuario, dialogo: await screen.findByRole('dialog', { name: 'Acrescentar turma' }) }
  }
  async function escolher({ usuario, dialogo }: Awaited<ReturnType<typeof abrirODialogo>>) {
    await usuario.selectOptions(within(dialogo).getByLabelText('Turma'), '7ºA')
    await usuario.selectOptions(within(dialogo).getByLabelText('Disciplina'), 'Matemática')
  }

  it('alocou: o vínculo entra na lista esperando a confirmação, o painel anuncia, o diálogo fecha e o foco volta ao botão que o abriu', async () => {
    const lista: unknown[] = []
    comAlocacao(
      () => {
        lista.push(NOVO)
        return { status: 201, corpo: NOVO }
      },
      {},
      () => lista,
    )
    const corpos = gravarCorposDosPosts()
    const painel = await painelComTurmasLidas(BRUNO)
    const botao = within(painel).getByRole('button', { name: 'Acrescentar turma' })
    const aberto = await abrirODialogo(painel)
    await escolher(aberto)
    await aberto.usuario.click(within(aberto.dialogo).getByRole('button', { name: 'Acrescentar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Acrescentar turma' })).toBeNull())
    const depois = await painelDe(BRUNO)
    const itens = within(within(depois).getByRole('list', { name: 'Turmas do professor' })).getAllByRole('listitem')
    expect(itens.map((item) => item.textContent)).toEqual(['7ºAMatemáticaEsperando o professor confirmar'])
    expect(within(depois).getByRole('status').textContent).toBe(`Alocação feita: ${BRUNO.nome} em 7ºA · Matemática. A turma abre depois que quem foi alocado confirmar.`)
    expect(document.activeElement).toBe(botao)
    // O pedido leva o professor do painel, a turma e a disciplina escolhidas, e o papel de professor: o vínculo é dele, e não de quem aloca.
    expect(corpos).toEqual([{ usuarioId: BRUNO.usuarioId, turmaId: T7A.id, disciplinaId: MATEMATICA.id, papel: 'professor' }])
  })

  it('sem escolher tudo, o diálogo diz o que falta e nada sai; escolhida a turma e não a disciplina, também', async () => {
    const rede = comAlocacao(() => ({ status: 201, corpo: NOVO }))
    const painel = await painelComTurmasLidas(BRUNO)
    const { usuario, dialogo } = await abrirODialogo(painel)
    await usuario.click(within(dialogo).getByRole('button', { name: 'Acrescentar' }))
    expect(within(dialogo).getByRole('alert').textContent).toBe('Escolha a turma e a disciplina.')
    await usuario.selectOptions(within(dialogo).getByLabelText('Turma'), '7ºA')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Acrescentar' }))
    expect(within(dialogo).getByRole('alert').textContent).toBe('Escolha a turma e a disciplina.')
    expect(vezes(rede, '/v1/vinculos', 'POST')).toBe(0)
  })

  it('clique duplo em "Acrescentar": um pedido só', async () => {
    let solta: (resposta: RespostaFalsa) => void = () => undefined
    const rede = comAlocacao(() => new Promise<RespostaFalsa>((resolver) => (solta = resolver)))
    const painel = await painelComTurmasLidas(BRUNO)
    const aberto = await abrirODialogo(painel)
    await escolher(aberto)
    await aberto.usuario.dblClick(within(aberto.dialogo).getByRole('button', { name: 'Acrescentar' }))
    expect(vezes(rede, '/v1/vinculos', 'POST')).toBe(1)
    solta({ status: 201, corpo: NOVO })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Acrescentar turma' })).toBeNull())
    expect(vezes(rede, '/v1/vinculos', 'POST')).toBe(1)
  })

  it('o vínculo que já existe: a API recusa com CONFLITO, o diálogo explica, fica aberto e não anuncia nada; a escolha incompleta tira o aviso', async () => {
    comAlocacao(() => ERRO('CONFLITO', 409))
    const painel = await painelComTurmasLidas(BRUNO)
    const aberto = await abrirODialogo(painel)
    const { usuario, dialogo } = aberto
    await escolher(aberto)
    await usuario.click(within(dialogo).getByRole('button', { name: 'Acrescentar' }))
    expect((await within(dialogo).findByRole('alert')).textContent).toBe('Este professor já está alocado nesta turma e nesta disciplina.')
    expect(within(painel).getByRole('status').textContent).toBe('')
    await usuario.selectOptions(within(dialogo).getByLabelText('Disciplina'), 'Escolha a disciplina')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Acrescentar' }))
    expect(within(dialogo).getByRole('alert').textContent).toBe('Escolha a turma e a disciplina.')
  })

  it('a turma excluída com o diálogo aberto: a API responde como inexistente, a turma sai da escolha, e o envio seguinte pede a escolha de novo', async () => {
    const turmas = [T8A, T7B, T7A]
    const rede = comAlocacao(() => ERRO('NAO_ENCONTRADO', 404), { turmas: () => ok(turmas) })
    const painel = await painelComTurmasLidas(BRUNO)
    const aberto = await abrirODialogo(painel)
    const { usuario, dialogo } = aberto
    await escolher(aberto)
    turmas.splice(turmas.indexOf(T7A), 1)
    await usuario.click(within(dialogo).getByRole('button', { name: 'Acrescentar' }))
    expect((await within(dialogo).findByRole('alert')).textContent).toBe('O professor, a turma ou a disciplina mudou enquanto você escolhia. A tela foi atualizada: confira e tente de novo.')
    await waitFor(() => expect(within(within(dialogo).getByLabelText('Turma')).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual(['Escolha a turma', '7ºB', '8ºA']))
    expect((within(dialogo).getByLabelText('Turma') as HTMLSelectElement).value).toBe('')
    expect((within(dialogo).getByLabelText('Disciplina') as HTMLSelectElement).value).toBe(MATEMATICA.id)
    await usuario.click(within(dialogo).getByRole('button', { name: 'Acrescentar' }))
    expect(within(dialogo).getByRole('alert').textContent).toBe('Escolha a turma e a disciplina.')
    expect(vezes(rede, '/v1/vinculos', 'POST')).toBe(1)
  })

  it('a disciplina excluída com o diálogo aberto sai da escolha do mesmo jeito', async () => {
    const disciplinas = [MATEMATICA, FISICA]
    const rede = comAlocacao(() => ERRO('NAO_ENCONTRADO', 404), { disciplinas: () => ok(disciplinas) })
    const painel = await painelComTurmasLidas(BRUNO)
    const aberto = await abrirODialogo(painel)
    const { usuario, dialogo } = aberto
    await escolher(aberto)
    disciplinas.splice(0, 1)
    await usuario.click(within(dialogo).getByRole('button', { name: 'Acrescentar' }))
    await within(dialogo).findByRole('alert')
    await waitFor(() => expect(within(within(dialogo).getByLabelText('Disciplina')).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual(['Escolha a disciplina', 'Física']))
    expect((within(dialogo).getByLabelText('Disciplina') as HTMLSelectElement).value).toBe('')
    expect((within(dialogo).getByLabelText('Turma') as HTMLSelectElement).value).toBe(T7A.id)
    // A disciplina que saiu não vai de novo à API: o envio seguinte pede a escolha, com a turma ainda escolhida.
    await usuario.click(within(dialogo).getByRole('button', { name: 'Acrescentar' }))
    expect(within(dialogo).getByRole('alert').textContent).toBe('Escolha a turma e a disciplina.')
    expect(vezes(rede, '/v1/vinculos', 'POST')).toBe(1)
  })

  it('o convite que venceu com o diálogo aberto: a API recusa, o painel perde o botão, o diálogo diz por quê e só oferece "Fechar", com o foco nas turmas', async () => {
    let situacao = 'pendente'
    const rede = comAlocacao(
      () => {
        situacao = 'vencido'
        return ERRO('NAO_ENCONTRADO', 404)
      },
      { professores: () => ok([{ ...BRUNO, estado: situacao }]) },
    )
    const painel = await painelComTurmasLidas(BRUNO)
    const aberto = await abrirODialogo(painel)
    const { usuario, dialogo } = aberto
    await escolher(aberto)
    await usuario.click(within(dialogo).getByRole('button', { name: 'Acrescentar' }))
    await waitFor(() => expect(within(dialogo).getByRole('alert').textContent).toBe('Este professor já não pode receber turma: o convite mudou. A tela foi atualizada.'))
    expect(within(dialogo).queryByRole('button', { name: 'Acrescentar' })).toBeNull()
    expect(within(painel).queryByRole('button', { name: 'Acrescentar turma' })).toBeNull()
    expect(within(painel).getByText('O convite venceu. Refaça o convite para acrescentar uma turma.')).toBeTruthy()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Acrescentar turma' })).toBeNull())
    expect(document.activeElement).toBe(within(painel).getByRole('heading', { name: 'Turmas' }))
    expect(vezes(rede, '/v1/vinculos', 'POST')).toBe(1)
  })

  it('abrir de novo com o diálogo ainda aberto é uma abertura nova: a escolha da anterior não passa para ela', async () => {
    comAlocacao(() => ERRO('NAO_ENCONTRADO', 404))
    const painel = await painelComTurmasLidas(BRUNO)
    const primeira = await abrirODialogo(painel)
    await escolher(primeira)
    await primeira.usuario.click(within(painel).getByRole('button', { name: 'Acrescentar turma' }))
    const dialogos = await screen.findAllByRole('dialog', { name: 'Acrescentar turma' })
    expect(dialogos).toHaveLength(1)
    expect((within(dialogos[0] as HTMLElement).getByLabelText('Turma') as HTMLSelectElement).value).toBe('')
    expect((within(dialogos[0] as HTMLElement).getByLabelText('Disciplina') as HTMLSelectElement).value).toBe('')
  })

  it('abrir o diálogo de novo apaga o anúncio da alocação anterior, e a abertura nova nasce sem escolha nem aviso', async () => {
    const lista: unknown[] = []
    comAlocacao(
      () => {
        lista.push(NOVO)
        return { status: 201, corpo: NOVO }
      },
      {},
      () => lista,
    )
    const painel = await painelComTurmasLidas(BRUNO)
    const primeira = await abrirODialogo(painel)
    await primeira.usuario.click(within(primeira.dialogo).getByRole('button', { name: 'Acrescentar' }))
    expect(within(primeira.dialogo).getByRole('alert').textContent).toBe('Escolha a turma e a disciplina.')
    await escolher(primeira)
    await primeira.usuario.click(within(primeira.dialogo).getByRole('button', { name: 'Acrescentar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Acrescentar turma' })).toBeNull())
    expect(within(await painelDe(BRUNO)).getByRole('status').textContent).toMatch(/^Alocação feita/)
    const segunda = await abrirODialogo(painel)
    expect(within(painel).getByRole('status').textContent).toBe('')
    expect(within(segunda.dialogo).queryByRole('alert')).toBeNull()
    expect((within(segunda.dialogo).getByLabelText('Turma') as HTMLSelectElement).value).toBe('')
    expect((within(segunda.dialogo).getByLabelText('Disciplina') as HTMLSelectElement).value).toBe('')
  })
})
