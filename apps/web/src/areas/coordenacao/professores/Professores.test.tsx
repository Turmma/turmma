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
 * Escola › Professores (telas da coordenação, 6.0; RF13 e RF22): os estados da tela, a tabela com o estado de cada convite em texto, as
 * turmas e as disciplinas dos vínculos, o painel do professor no endereço com só as ações que o estado permite, **o que a tela lê e não
 * lê** — e-mail nunca — e o foco depois de fechar o painel e de cada ação. A rede é falsa e responde por caminho; a tela, o cliente de
 * consultas e a sessão são os da aba. O que só o navegador mede (o clique em qualquer ponto da linha, a página que não rola, o celular
 * de 360 px, o link que aparece uma vez e o diálogo sobre o painel, com dois `<dialog>` empilhados) é do e2e `professores`. O `jsdom` não
 * tem `matchMedia`, `ResizeObserver` nem o `dialog` modal: o teste os põe, e são API do navegador, e não peça nossa.
 */
prepararTela()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const ANO = { id: id(1), ano: 2026, inicio: '2026-02-02', fim: '2026-12-18', situacao: 'em_curso' }
const ANO_PLANEJADO = { ...ANO, id: id(2), situacao: 'planejado' }
const T7A = { id: id(101), nome: '7ºA' }
const T7B = { id: id(102), nome: '7ºB' }
const T8A = { id: id(103), nome: '8ºA' }
const MATEMATICA = { id: id(500), nome: 'Matemática' }
const FISICA = { id: id(501), nome: 'Física' }
const professor = (n: number, nome: string, estado: string) => ({ usuarioId: id(300 + n), nome, estado })
const ANA = professor(1, 'Ana Sintética', 'aceito')
const BRUNO = professor(2, 'Bruno Sintético', 'pendente')
const CAIO = professor(3, 'Caio Sintético', 'vencido')
const DAVI = professor(4, 'Davi Sintético', 'revogado')
const ELIS = professor(5, 'Elis Sintética', 'ativo')
const FABIO = professor(6, 'Fábio Sintético', 'desativado')
const vinculo = (n: number, dono: { usuarioId: string }, turma: { id: string; nome: string }, disciplina: { id: string; nome: string }, estado: string) => ({
  id: id(400 + n),
  usuarioId: dono.usuarioId,
  papel: 'professor',
  turma,
  disciplina,
  estado,
})
/** A Ana em duas disciplinas na mesma turma; o Bruno com a turma contestada; o Caio só com vínculo encerrado; os outros sem vínculo. */
const VINCULOS = [
  vinculo(1, ANA, T7A, MATEMATICA, 'confirmado'),
  vinculo(2, ANA, T7A, FISICA, 'pendente'),
  vinculo(3, BRUNO, T7B, MATEMATICA, 'contestado'),
  vinculo(4, CAIO, T8A, FISICA, 'encerrado'),
]

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
const SERIE_7 = { id: id(207), etapa: 'ef_anos_finais', ano: 7 }
const TURMAS = [T7A, T7B, T8A].map((turma) => ({ ...turma, anoLetivoId: ANO.id, turno: null, serie: SERIE_7 }))
// Fora da ordem do nome: a tela é que põe cada professor no seu lugar.
const PADRAO: Respostas = {
  anos: ok([ANO]),
  professores: ok([FABIO, CAIO, ELIS, BRUNO, DAVI, ANA]),
  vinculos: ok(VINCULOS),
  // O painel do professor que recebe turma lê as turmas e as disciplinas da escola; o resto não as lê.
  turmas: ok(TURMAS),
  disciplinas: ok([MATEMATICA, FISICA].map((disciplina) => ({ ...disciplina, area: null }))),
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
const vezes = (rede: RedeFalsa, caminho: string) => caminhosDe(rede).filter((pedido) => pedido === caminho).length

/** A largura da janela, para a consulta `(min-width: 768px)` que a `Tabela` lê. */
function janelaDe(largura: number): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta === '(min-width: 768px)' ? largura >= 768 : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

beforeEach(() => {
  janelaDe(1366)
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

function montar(endereco = '/professores') {
  const [caminho = '/professores', busca = ''] = endereco.split('?')
  const localizacao = memoryLocation({ path: caminho, searchPath: busca, record: true })
  renderizarTela(
    <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
      <Professores />
    </Router>,
  )
  return localizacao
}

/** A tela com a tabela lida. */
async function montarEEsperar(endereco = '/professores') {
  const localizacao = montar(endereco)
  await screen.findByRole('table', { name: 'Professores da escola' })
  return localizacao
}

const tabela = () => within(screen.getByRole('table', { name: 'Professores da escola' }))
/** As linhas do corpo da tabela, na ordem da tela. */
const linhas = () => tabela().getAllByRole('row').filter((linha) => within(linha).queryAllByRole('columnheader').length === 0)
/** O que a linha do professor diz, célula por célula. */
const celulasDe = (nome: string) => {
  const linha = linhas().find((candidata) => within(candidata).queryByRole('button', { name: nome }) !== null)
  if (linha === undefined) throw new Error(`sem a linha de ${nome}`)
  return Array.from(linha.children).map((celula) => celula.textContent)
}
const botaoDe = (nome: string) => tabela().getByRole('button', { name: nome })
const painelDe = (nome: string) => screen.findByRole('dialog', { name: nome })

describe('os quatro estados da tela', () => {
  it('carregando: a leitura da lista no ar', async () => {
    instalar(redeFalsa(), { professores: nuncaResponde })
    montar()
    expect(await screen.findByText('Carregando os professores…')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    // O vazio só vem com a leitura terminada e sem erro (RF22).
    expect(screen.queryByText('Nenhum professor ainda')).toBeNull()
  })

  it('erro: a mensagem curta e "Tentar de novo", que lê só a lista de novo', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let falhar = true
    instalar(rede, { professores: () => (falhar ? FALHA : ok([ANA])) })
    montar()
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Cadastrar professor' })).toBeNull()
    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findByRole('table', { name: 'Professores da escola' })
    expect(vezes(rede, '/v1/professores')).toBe(2)
  })

  it('vazio: "Nenhum professor ainda", com "Cadastrar professor" e nenhuma tabela', async () => {
    instalar(redeFalsa(), { professores: ok([]), vinculos: ok([]) })
    montar()
    expect(await screen.findByText('Nenhum professor ainda')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Cadastrar professor' })).toHaveLength(1)
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('com dado: a tabela pelo nome, em português, e a contagem ao lado do título', async () => {
    instalar(redeFalsa())
    await montarEEsperar()
    expect(tabela().getAllByRole('columnheader').map((coluna) => coluna.textContent)).toEqual(['Nome', 'Disciplinas', 'Turmas', 'Situação'])
    expect(linhas().map((linha) => linha.children[0]?.textContent)).toEqual([ANA.nome, BRUNO.nome, CAIO.nome, DAVI.nome, ELIS.nome, FABIO.nome])
    expect(screen.getByRole('heading', { name: 'Professores da escola' })).toBeTruthy()
    expect(screen.getByText('6 professores')).toBeTruthy()
  })

  it('a contagem no singular, com um professor só', async () => {
    instalar(redeFalsa(), { professores: ok([ANA]) })
    await montarEEsperar()
    expect(screen.getByText('1 professor')).toBeTruthy()
  })

  it('a lista que passou do teto de páginas avisa que mostra só os primeiros', async () => {
    // Toda página diz que há outra: a tela lê até o teto e para.
    instalar(redeFalsa(), { professores: () => ok([ANA], { proxima: id(999) }) })
    montar()
    expect(await screen.findByText('A lista é maior do que esta tela mostra: aparecem só os primeiros.')).toBeTruthy()
  })
})

describe('a tabela', () => {
  it('cada estado do convite em texto, no selo da família dele', async () => {
    instalar(redeFalsa())
    await montarEEsperar()
    const esperado = [
      [ANA, 'ok'],
      [BRUNO, 'pendente'],
      [CAIO, 'erro'],
      [DAVI, 'info'],
      [ELIS, 'ok'],
      [FABIO, 'info'],
    ] as const
    for (const [dono, familia] of esperado) {
      const linha = linhas().find((candidata) => within(candidata).queryByRole('button', { name: dono.nome }) !== null)
      const selo = linha?.querySelector('[data-estado]')
      expect(selo?.textContent, dono.nome).toBe(TEXTO_DO_ESTADO_DO_PROFESSOR[dono.estado as keyof typeof TEXTO_DO_ESTADO_DO_PROFESSOR])
      expect(selo?.getAttribute('data-estado'), dono.nome).toBe(familia)
    }
  })

  it('as turmas e as disciplinas dos vínculos: duas disciplinas na mesma turma dão a turma uma vez; o contestado conta; o encerrado e a falta de vínculo dão o traço', async () => {
    instalar(redeFalsa())
    await montarEEsperar()
    await waitFor(() => expect(celulasDe(ANA.nome)[2]).toBe('7ºA'))
    expect(celulasDe(ANA.nome).slice(0, 3)).toEqual([`${ANA.nome}`, 'Física, Matemática', '7ºA'])
    expect(celulasDe(BRUNO.nome).slice(0, 3)).toEqual([`${BRUNO.nome}`, 'Matemática', '7ºB'])
    expect(celulasDe(CAIO.nome).slice(0, 3)).toEqual([`${CAIO.nome}`, '—', '—'])
    expect(celulasDe(ELIS.nome).slice(0, 3)).toEqual([`${ELIS.nome}`, '—', '—'])
  })

  it('sem e-mail: a tabela e o painel não o pedem à API, e a tela só lê anos, professores e vínculos — e, no painel de quem recebe turma, as turmas e as disciplinas', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede)
    await montarEEsperar()
    await usuario.click(botaoDe(BRUNO.nome))
    const painel = await painelDe(BRUNO.nome)
    // O botão só existe com as turmas e as disciplinas lidas: depois dele, as leituras do painel já saíram.
    await within(painel).findByRole('button', { name: 'Acrescentar turma' })
    // O que prova é o que a tela pede: nenhuma outra rota, e nenhuma delas traz e-mail: o esquema da lista de professores é estrito,
    // e uma resposta com `email` nem chega à tela (o contrato é o de `@educa/shared`).
    expect([...new Set(caminhosDe(rede))].sort()).toEqual(['/v1/anos-letivos', '/v1/disciplinas', '/v1/professores', '/v1/turmas', '/v1/vinculos'])
  })

  it('"Cadastrar professor" é o único botão cheio da tela, com a tabela e com o painel aberto', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    await montarEEsperar()
    const cheios = () =>
      screen
        .getAllByRole('button')
        .filter((botao) => botao.className.includes('bg-laranja'))
        .map((botao) => botao.textContent)
    expect(cheios()).toEqual(['Cadastrar professor'])
    await usuario.click(botaoDe(BRUNO.nome))
    const painel = await painelDe(BRUNO.nome)
    expect(within(painel).getAllByRole('button').filter((botao) => botao.className.includes('bg-laranja'))).toEqual([])
  })

  it('a 360 px a tabela vira lista, e o nome da pessoa continua sendo o botão que abre o painel', async () => {
    const usuario = userEvent.setup()
    janelaDe(360)
    instalar(redeFalsa())
    montar()
    const lista = await screen.findByRole('list', { name: 'Professores da escola' })
    expect(screen.queryByRole('table')).toBeNull()
    expect(within(lista).getAllByRole('listitem')).toHaveLength(6)
    const item = within(lista).getAllByRole('listitem')[0] as HTMLElement
    expect(within(item).getByText('Disciplinas')).toBeTruthy()
    // O cartão é a referência do botão que se estende pela linha toda.
    expect(item.className).toContain('relative')
    await usuario.click(within(lista).getByRole('button', { name: ANA.nome }))
    expect(await painelDe(ANA.nome)).toBeTruthy()
  })
})

describe('as turmas dos professores, lidas à parte', () => {
  it('sem ano em curso: os vínculos nem são pedidos, o traço fica nas células, e não há aviso', async () => {
    const rede = redeFalsa()
    instalar(rede, { anos: ok([ANO_PLANEJADO]) })
    await montarEEsperar()
    await waitFor(() => expect(vezes(rede, '/v1/anos-letivos')).toBe(1))
    expect(vezes(rede, '/v1/vinculos')).toBe(0)
    expect(celulasDe(ANA.nome).slice(0, 3)).toEqual([ANA.nome, '—', '—'])
    expect(screen.queryByText(/não carregaram/)).toBeNull()
  })

  it('os vínculos que falham: a tabela continua, o aviso diz por quê, e "Tentar de novo" lê só os vínculos', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let falhar = true
    instalar(rede, { vinculos: () => (falhar ? FALHA : ok(VINCULOS)) })
    await montarEEsperar()
    await screen.findByText('As turmas e as disciplinas dos professores não carregaram')
    expect(celulasDe(ANA.nome).slice(0, 3)).toEqual([ANA.nome, '—', '—'])
    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(celulasDe(ANA.nome)[2]).toBe('7ºA'))
    expect(screen.queryByText(/não carregaram/)).toBeNull()
    expect(vezes(rede, '/v1/vinculos')).toBe(2)
    expect(vezes(rede, '/v1/anos-letivos')).toBe(1)
  })

  it('os anos que falham: o mesmo aviso, e "Tentar de novo" lê os anos, que liberam os vínculos', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let falhar = true
    instalar(rede, { anos: () => (falhar ? FALHA : ok([ANO])) })
    await montarEEsperar()
    await screen.findByText('As turmas e as disciplinas dos professores não carregaram')
    expect(vezes(rede, '/v1/vinculos')).toBe(0)
    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(celulasDe(ANA.nome)[2]).toBe('7ºA'))
    expect(vezes(rede, '/v1/anos-letivos')).toBe(2)
    expect(screen.queryByText(/não carregaram/)).toBeNull()
  })

  it('a lista de professores que falha não leva o aviso das turmas: ele é de outra leitura', async () => {
    instalar(redeFalsa(), { professores: FALHA })
    montar()
    await screen.findByRole('alert')
    expect(screen.queryByText(/As turmas e as disciplinas/)).toBeNull()
  })
})

describe('o painel do professor', () => {
  it('a linha abre o painel no endereço, com o nome no título e a situação em texto; "Fechar" tira o parâmetro sem passo novo no histórico', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    const localizacao = await montarEEsperar()
    await usuario.click(botaoDe(BRUNO.nome))
    expect(localizacao.history?.at(-1)).toBe(`/professores?professor=${BRUNO.usuarioId}`)
    const painel = await painelDe(BRUNO.nome)
    expect(within(painel).getByRole('heading', { name: 'Situação do convite' })).toBeTruthy()
    expect(within(painel).getByText(TEXTO_DO_ESTADO_DO_PROFESSOR.pendente)).toBeTruthy()
    await usuario.click(within(painel).getByRole('button', { name: 'Fechar' }))
    expect(localizacao.history?.at(-1)).toBe('/professores')
    expect(screen.queryByRole('dialog')).toBeNull()
    // Abrir é um passo no histórico; fechar troca o endereço (o do painel vira o da tela), sem passo novo: o Voltar não reabre o painel.
    expect(localizacao.history).toEqual(['/professores', '/professores'])
  })

  it('só as ações que o estado permite: o convite em aberto, pendente ou vencido, refaz e revoga; quem recebe turma tem "Acrescentar turma"; o revogado e o desativado não têm rodapé', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    await montarEEsperar()
    const acoesDo = async (dono: { nome: string }, recebeTurma: boolean) => {
      await usuario.click(botaoDe(dono.nome))
      const painel = await painelDe(dono.nome)
      // "Acrescentar turma" espera as turmas e as disciplinas da escola: quem a tem, espera por ela antes de contar os botões.
      if (recebeTurma) await within(painel).findByRole('button', { name: 'Acrescentar turma' })
      const botoes = within(painel)
        .getAllByRole('button')
        .filter((botao) => botao.getAttribute('aria-label') !== 'Fechar')
        .map((botao) => botao.textContent)
      // O rodapé é o irmão do miolo: estado sem ação não tem a barra de baixo, vazia.
      const rodape = painel.querySelector('[data-painel-miolo]')?.nextElementSibling ?? null
      await usuario.click(within(painel).getByRole('button', { name: 'Fechar' }))
      return { botoes, temRodape: rodape !== null }
    }
    expect(await acoesDo(BRUNO, true)).toEqual({ botoes: ['Refazer convite', 'Revogar convite', 'Acrescentar turma'], temRodape: true })
    // O vencido tem o convite a refazer e revogar, mas não recebe turma.
    expect(await acoesDo(CAIO, false)).toEqual({ botoes: ['Refazer convite', 'Revogar convite'], temRodape: true })
    for (const dono of [ANA, ELIS]) expect(await acoesDo(dono, true), dono.nome).toEqual({ botoes: ['Acrescentar turma'], temRodape: true })
    for (const dono of [DAVI, FABIO]) expect(await acoesDo(dono, false), dono.nome).toEqual({ botoes: [], temRodape: false })
  })

  it('pelo endereço, abre já com o painel; o id que a lista não tem, ou outro parâmetro, não abre nada', async () => {
    instalar(redeFalsa())
    await montarEEsperar(`/professores?professor=${ELIS.usuarioId}`)
    expect(await painelDe(ELIS.nome)).toBeTruthy()
    cleanup()
    for (const busca of [`professor=${id(999)}`, 'professor=', 'professor=nao-e-um-id', `painel=${ELIS.usuarioId}`]) {
      instalar(redeFalsa())
      await montarEEsperar(`/professores?${busca}`)
      expect(screen.queryByRole('dialog'), busca).toBeNull()
      cleanup()
    }
  })

  it('dois professores com o mesmo nome: cada linha abre o painel do seu usuarioId, e o endereço decide qual', async () => {
    const usuario = userEvent.setup()
    const aberto = professor(7, 'Gil Sintético', 'pendente')
    const dono = professor(8, 'Gil Sintético', 'ativo')
    instalar(redeFalsa(), { professores: ok([aberto, dono]) })
    const localizacao = await montarEEsperar()
    const botoes = tabela().getAllByRole('button', { name: 'Gil Sintético' })
    expect(botoes).toHaveLength(2)

    // A ordem entre dois nomes iguais não é de negócio (ela segue a lista): o que prova é o par endereço e situação de cada painel.
    const aoAbrir: Record<string, string> = {}
    for (const botao of botoes) {
      await usuario.click(botao)
      const painel = await painelDe('Gil Sintético')
      const enderecoAberto = localizacao.history?.at(-1) ?? ''
      const usuarioId = new URLSearchParams(enderecoAberto.split('?')[1]).get('professor') ?? ''
      aoAbrir[usuarioId] = painel.textContent ?? ''
      await usuario.click(within(painel).getByRole('button', { name: 'Fechar' }))
    }
    expect(Object.keys(aoAbrir).sort()).toEqual([aberto.usuarioId, dono.usuarioId])
    expect(aoAbrir[aberto.usuarioId]).toContain(TEXTO_DO_ESTADO_DO_PROFESSOR.pendente)
    expect(aoAbrir[aberto.usuarioId]).toContain('Refazer convite')
    expect(aoAbrir[dono.usuarioId]).toContain(TEXTO_DO_ESTADO_DO_PROFESSOR.ativo)
    expect(aoAbrir[dono.usuarioId]).not.toContain('Refazer convite')

    // Pelo endereço, é o id que escolhe, e não o nome: o painel de quem tem o mesmo nome.
    cleanup()
    instalar(redeFalsa(), { professores: ok([aberto, dono]) })
    await montarEEsperar(`/professores?professor=${dono.usuarioId}`)
    const doEndereco = await painelDe('Gil Sintético')
    expect(within(doEndereco).getByText(TEXTO_DO_ESTADO_DO_PROFESSOR.ativo)).toBeTruthy()
    expect(within(doEndereco).queryByRole('button', { name: 'Refazer convite' })).toBeNull()
  })

  it('o painel pelo endereço só desenha depois da lista: com a leitura no ar, nada dele aparece', async () => {
    instalar(redeFalsa(), { professores: nuncaResponde })
    montar(`/professores?professor=${ANA.usuarioId}`)
    await screen.findByText('Carregando os professores…')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('o professor de outra escola no endereço (a lista desta escola não o tem) não abre painel nem diz que ele existe', async () => {
    instalar(redeFalsa(), { professores: ok([ANA]) })
    await montarEEsperar(`/professores?professor=${BRUNO.usuarioId}`)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.textContent).not.toContain(BRUNO.nome)
  })
})

describe('o foco depois de fechar o painel', () => {
  it('aberto pela linha, o foco volta ao botão da linha', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    await montarEEsperar()
    const botao = botaoDe(BRUNO.nome)
    await usuario.click(botao)
    const painel = await painelDe(BRUNO.nome)
    await usuario.click(within(painel).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(botao)
  })

  it('aberto já pelo endereço, sem botão que o tenha aberto, o painel fecha com o foco no título da lista', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    await montarEEsperar(`/professores?professor=${BRUNO.usuarioId}`)
    const painel = await painelDe(BRUNO.nome)
    const titulo = screen.getByRole('heading', { name: 'Professores da escola' })
    expect(document.activeElement).not.toBe(titulo)
    await usuario.click(within(painel).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(titulo)
  })

  it('a tela montada sem painel não tira o foco de ninguém', async () => {
    instalar(redeFalsa())
    await montarEEsperar()
    expect(document.activeElement).toBe(document.body)
  })
})

describe('revogar e refazer, pelo painel', () => {
  const REVOGAR = /^\/v1\/professores\/[^/]+\/convite\/revogar$/
  const REFAZER = /^\/v1\/professores\/[^/]+\/convite\/refazer$/

  /** A lista que a rede devolve, mudada pela escrita que o caso fez. */
  function comEstado(estados: Record<string, string>) {
    return () => ok([ANA, BRUNO, CAIO].map((dono) => ({ ...dono, estado: estados[dono.usuarioId] ?? dono.estado })))
  }

  it('revogar: o diálogo de confirmação abre sobre o painel; confirmado, o painel fica, diz o que aconteceu, perde o rodapé, e o foco vai à situação', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    const estados: Record<string, string> = {}
    instalar(rede, { professores: comEstado(estados) })
    rede.responderPor(REVOGAR, () => {
      estados[BRUNO.usuarioId] = 'revogado'
      return { status: 204 }
    })
    const localizacao = await montarEEsperar()
    await usuario.click(botaoDe(BRUNO.nome))
    const painel = await painelDe(BRUNO.nome)
    await usuario.click(within(painel).getByRole('button', { name: 'Revogar convite' }))
    const confirmacao = await screen.findByRole('dialog', { name: 'Revogar o convite' })
    expect(within(confirmacao).getByText(/deixa de valer na hora/)).toBeTruthy()
    await usuario.click(within(confirmacao).getByRole('button', { name: 'Revogar convite' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Revogar o convite' })).toBeNull())
    // O painel continua aberto no mesmo professor, agora sem ação, e o anúncio está nele.
    expect(localizacao.history?.at(-1)).toBe(`/professores?professor=${BRUNO.usuarioId}`)
    const depois = await painelDe(BRUNO.nome)
    expect(await within(depois).findByText(TEXTO_DO_ESTADO_DO_PROFESSOR.revogado)).toBeTruthy()
    expect(within(depois).getByRole('status').textContent).toBe(`Convite de ${BRUNO.nome} revogado.`)
    expect(within(depois).queryByRole('button', { name: 'Revogar convite' })).toBeNull()
    expect(within(depois).queryByRole('button', { name: 'Refazer convite' })).toBeNull()
    // O "Revogar" que abriu o diálogo saiu do rodapé: o foco fica no painel, e não na página inerte atrás.
    expect(document.activeElement).toBe(within(depois).getByRole('heading', { name: 'Situação do convite' }))
    expect(vezes(rede, '/v1/professores')).toBeGreaterThanOrEqual(2)
  })

  it('o anúncio é do professor que foi revogado: o painel de outro não o repete', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    const estados: Record<string, string> = {}
    instalar(rede, { professores: comEstado(estados) })
    rede.responderPor(REVOGAR, () => {
      estados[BRUNO.usuarioId] = 'revogado'
      return { status: 204 }
    })
    await montarEEsperar()
    await usuario.click(botaoDe(BRUNO.nome))
    const painel = await painelDe(BRUNO.nome)
    await usuario.click(within(painel).getByRole('button', { name: 'Revogar convite' }))
    const confirmacao = await screen.findByRole('dialog', { name: 'Revogar o convite' })
    await usuario.click(within(confirmacao).getByRole('button', { name: 'Revogar convite' }))
    await within(await painelDe(BRUNO.nome)).findByText(`Convite de ${BRUNO.nome} revogado.`)
    await usuario.click(within(await painelDe(BRUNO.nome)).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await usuario.click(botaoDe(CAIO.nome))
    const doCaio = await painelDe(CAIO.nome)
    expect(within(doCaio).getByRole('status').textContent).toBe('')
    expect(screen.queryByText(`Convite de ${BRUNO.nome} revogado.`)).toBeNull()
  })

  it('abrir outro diálogo apaga o anúncio da ação anterior', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    const estados: Record<string, string> = {}
    instalar(rede, { professores: comEstado(estados) })
    rede.responderPor(REVOGAR, () => {
      estados[BRUNO.usuarioId] = 'revogado'
      return { status: 204 }
    })
    await montarEEsperar()
    await usuario.click(botaoDe(BRUNO.nome))
    await usuario.click(within(await painelDe(BRUNO.nome)).getByRole('button', { name: 'Revogar convite' }))
    await usuario.click(within(await screen.findByRole('dialog', { name: 'Revogar o convite' })).getByRole('button', { name: 'Revogar convite' }))
    await within(await painelDe(BRUNO.nome)).findByText(`Convite de ${BRUNO.nome} revogado.`)
    await usuario.click(within(await painelDe(BRUNO.nome)).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Sem diálogo no meio, o fato continua dito no painel dele; o diálogo aberto depois, mesmo cancelado, apaga o anúncio.
    await usuario.click(botaoDe(BRUNO.nome))
    expect(within(await painelDe(BRUNO.nome)).getByRole('status').textContent).toBe(`Convite de ${BRUNO.nome} revogado.`)
    await usuario.click(within(await painelDe(BRUNO.nome)).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar professor' }))
    await usuario.click(within(await screen.findByRole('dialog', { name: 'Cadastrar professor' })).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await usuario.click(botaoDe(BRUNO.nome))
    expect(within(await painelDe(BRUNO.nome)).getByRole('status').textContent).toBe('')
  })

  it('refazer cai em CONFLITO porque outra pessoa revogou: o diálogo avisa, a lista recarrega, e fechado o foco vai à situação no painel', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    const estados: Record<string, string> = {}
    instalar(rede, { professores: comEstado(estados) })
    rede.responderPor(REFAZER, () => {
      estados[BRUNO.usuarioId] = 'revogado'
      return ERRO('CONFLITO', 409)
    })
    await montarEEsperar()
    await usuario.click(botaoDe(BRUNO.nome))
    const painel = await painelDe(BRUNO.nome)
    await usuario.click(within(painel).getByRole('button', { name: 'Refazer convite' }))
    const refazer = await screen.findByRole('dialog', { name: 'Refazer o convite' })
    await usuario.click(within(refazer).getByRole('button', { name: 'Refazer convite' }))
    expect((await within(refazer).findByRole('alert')).textContent).toBe('O convite mudou. A lista foi atualizada.')
    await usuario.click(within(refazer).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Refazer o convite' })).toBeNull())
    const depois = await painelDe(BRUNO.nome)
    expect(await within(depois).findByText(TEXTO_DO_ESTADO_DO_PROFESSOR.revogado)).toBeTruthy()
    expect(within(depois).queryByRole('button', { name: 'Refazer convite' })).toBeNull()
    expect(document.activeElement).toBe(within(depois).getByRole('heading', { name: 'Situação do convite' }))
  })

  it('"Cadastrar professor" abre o diálogo da tela, sem o painel', async () => {
    const usuario = userEvent.setup()
    instalar(redeFalsa())
    await montarEEsperar()
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar professor' }))
    expect(await screen.findByRole('dialog', { name: 'Cadastrar professor' })).toBeTruthy()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
})
