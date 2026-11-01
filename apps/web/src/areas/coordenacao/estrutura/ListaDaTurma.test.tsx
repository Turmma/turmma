// @vitest-environment jsdom
import { nomeDaSerie } from '@educa/shared'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import ListaDaTurma from './ListaDaTurma'

/**
 * A lista da turma da coordenação em duas colunas (telas da coordenação, 9.0; RF16, RF22): os estados da turma e da lista, os
 * nomes em tabela com a situação em texto, os professores da turma ao lado, o foco depois de cada ação e **as leituras que a
 * tela faz** — a lista de nomes uma vez, com a finalidade, e nenhum pedido sem o clique. A rede é falsa e responde por
 * caminho; a tela, o cliente de consultas e a sessão são os da aba. O que só o navegador mede (a página que não rola, o
 * celular de 360 px, a prévia e o arquivo) é do e2e `lista-da-turma`. O `jsdom` não tem `matchMedia`, `ResizeObserver` nem o
 * `dialog` modal: o teste os põe, e são API do navegador, e não peça nossa.
 */
setupScreen()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const SERIE = { id: id(200), etapa: 'ef_anos_finais', ano: 7 } as const
const TURMA = { id: id(101), anoLetivoId: id(1), nome: '7º A', turno: 'manha', serie: SERIE }
const OUTRA_TURMA = { ...TURMA, id: id(102), nome: '7º B', turno: 'tarde' }
const TURMA_ABERTA = { id: TURMA.id, nome: TURMA.nome, serie: SERIE }
const MATEMATICA = { id: id(500), nome: 'Matemática' }
const CIENCIAS = { id: id(501), nome: 'Ciências' }
const CAMILA = { usuarioId: id(301), nome: 'Camila Sintética', estado: 'ativo' }
const PAULO = { usuarioId: id(302), nome: 'Paulo Sintético', estado: 'ativo' }
const VINCULO = (n: number, usuarioId: string, turma: { id: string; nome: string }, disciplina: { id: string; nome: string } | undefined, estado: string) => ({
  id: id(400 + n),
  usuarioId,
  papel: 'professor',
  turma: { id: turma.id, nome: turma.nome },
  ...(disciplina === undefined ? {} : { disciplina }),
  estado,
})
const NOME = (n: number, estado: 'livre' | 'reivindicado' | 'aprovado', nome: string | null = `Aluno ${String(n)}`, matricula: string | null = `90${String(n).padStart(4, '0')}`) => ({
  id: id(600 + n),
  estado,
  nome: estado === 'aprovado' ? null : nome,
  matricula: estado === 'aprovado' ? null : matricula,
})
const ERRO = (codigo: string, status: number): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } })
/** Um erro que a leitura não repete sozinha: a tela mostra o erro na hora, e não depois da nova tentativa de um segundo. */
const FALHA = ERRO('LIMITE_EXCEDIDO', 429)
const FORA = ERRO('NAO_ENCONTRADO', 404)
const ok = (itens: readonly unknown[], extra: Record<string, unknown> = {}): FakeResponse => ({ status: 200, corpo: { itens, ...extra } })
const nuncaResponde = () => new Promise<FakeResponse>(() => undefined)

type Resposta = FakeResponse | (() => FakeResponse | Promise<FakeResponse>)
interface Respostas {
  turma: Resposta
  turmas: Resposta
  lista: Resposta
  vinculos: Resposta
  professores: Resposta
}
const PADRAO: Respostas = {
  turma: { status: 200, corpo: TURMA_ABERTA },
  // A outra turma vem primeiro: o turno da turma aberta não pode ser o do primeiro da lista.
  turmas: ok([OUTRA_TURMA, TURMA]),
  lista: ok([NOME(1, 'livre'), NOME(2, 'reivindicado')]),
  vinculos: ok([VINCULO(1, CAMILA.usuarioId, TURMA, MATEMATICA, 'confirmado')]),
  professores: ok([CAMILA, PAULO]),
}

function instalar(rede: FakeNetwork, parcial: Partial<Respostas> = {}): void {
  const respostas = { ...PADRAO, ...parcial }
  // Só a leitura (com a consulta): a gravação é `POST` no mesmo caminho, sem consulta, e cada caso responde a ela.
  rede.responderPor(new RegExp(`^/v1/turmas/${TURMA.id}/lista\\?`), respostas.lista)
  rede.responderPor(`/v1/turmas/${TURMA.id}`, respostas.turma)
  rede.responderPor('/v1/turmas', respostas.turmas)
  rede.responderPor('/v1/vinculos', respostas.vinculos)
  rede.responderPor('/v1/professores', respostas.professores)
}

/** Os caminhos pedidos, sem a consulta, na ordem. */
const caminhosDe = (rede: FakeNetwork) => rede.chamadas.map((chamada) => chamada.caminho.split('?')[0])

/** A largura da janela, para a consulta `(min-width: 768px)` que a `Table` e o miolo leem. */
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

function montar() {
  const localizacao = memoryLocation({ path: `/estrutura/turmas/${TURMA.id}`, record: true })
  renderScreen(
    <Router hook={localizacao.hook}>
      <ListaDaTurma turmaId={TURMA.id} />
    </Router>,
  )
  return localizacao
}

/** Monta a tela e espera a turma chegar: a seção dos nomes só existe com ela, e é onde quase todo caso olha. */
async function montarEEsperar() {
  const localizacao = montar()
  await screen.findByRole('region', { name: 'Nomes da turma' })
  return localizacao
}

const nomes = () => within(screen.getByRole('region', { name: 'Nomes da turma' }))
const professores = () => within(screen.getByRole('region', { name: 'Professores da turma' }))
/** A tabela dos nomes, quando a janela é larga: as linhas do corpo, sem o cabeçalho. */
const linhasDosNomes = () => within(nomes().getByRole('table')).getAllByRole('row').slice(1)

describe('o cabeçalho da turma', () => {
  it('diz a série e o turno de complemento, o link para Escola, e nenhuma ação de exportar', async () => {
    instalar(fakeNetwork())
    montar()

    expect(await screen.findByRole('heading', { level: 1, name: 'Turma 7º A' })).toBeTruthy()
    expect(await screen.findByText(`${nomeDaSerie(SERIE)} · manhã`)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar para Escola' })).toBeTruthy()
    expect(screen.queryByText(/Exportar/)).toBeNull()
  })

  it('sem o turno (a lista de turmas não o trouxe ou falhou), só a série, e a tela inteira continua', async () => {
    instalar(fakeNetwork(), { turmas: FALHA })
    await montarEEsperar()

    expect(await screen.findByText(nomeDaSerie(SERIE))).toBeTruthy()
    expect(screen.queryByText(/manhã/)).toBeNull()
    expect(await nomes().findByText('Aluno 1')).toBeTruthy()
  })

  it('a turma está na lista de turmas, mas sem turno (o dado é opcional): só a série, sem "undefined" nem separador', async () => {
    instalar(fakeNetwork(), { turmas: ok([OUTRA_TURMA, { ...TURMA, turno: null }]) })
    await montarEEsperar()

    const descricao = await screen.findByText(nomeDaSerie(SERIE))
    expect(descricao.textContent).toBe(nomeDaSerie(SERIE))
    expect(screen.queryByText(/·/)).toBeNull()
  })
})

describe('o miolo da tela', () => {
  it('a partir de 768 px o miolo que rola recebe foco, para rolar pelo teclado; abaixo disso rola a página, e não há o que focar', async () => {
    instalar(fakeNetwork())
    await montarEEsperar()
    expect(screen.getByRole('region', { name: 'Turma 7º A' }).getAttribute('tabindex')).toBe('0')
    cleanup()

    janelaDe(360)
    instalar(fakeNetwork())
    await montarEEsperar()
    expect(screen.getByRole('region', { name: 'Turma 7º A' }).hasAttribute('tabindex')).toBe(false)
  })
})

describe('os estados da turma', () => {
  it('carregando, e depois a tela com a turma', async () => {
    const rede = fakeNetwork()
    let liberar: (resposta: FakeResponse) => void = () => undefined
    instalar(rede, { turma: () => new Promise<FakeResponse>((resolver) => (liberar = resolver)) })
    montar()

    expect(await screen.findByText('Carregando a turma…')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Nomes da turma' })).toBeNull()
    // O vazio só vem com a leitura terminada e sem erro (RF22): nenhum dos três convites da turma durante a leitura.
    expect(screen.queryByText('Nenhum nome nesta turma ainda')).toBeNull()
    expect(screen.queryByText('Nenhum professor nesta turma')).toBeNull()
    expect(screen.queryByText('Nenhum pedido esperando')).toBeNull()
    liberar({ status: 200, corpo: TURMA_ABERTA })
    expect(await screen.findByRole('region', { name: 'Nomes da turma' })).toBeTruthy()
    expect(screen.queryByText('Carregando a turma…')).toBeNull()
  })

  it('o erro da leitura da turma diz o que fazer, com "Tentar de novo", e a nova tentativa traz a tela', async () => {
    const usuario = userEvent.setup()
    let falhar = true
    instalar(fakeNetwork(), { turma: () => (falhar ? FALHA : { status: 200, corpo: TURMA_ABERTA }) })
    montar()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Nomes da turma' })).toBeNull()
    // A leitura que falhou não afirma o vazio (RF22): nenhum dos três convites da turma ao lado do erro.
    expect(screen.queryByText('Nenhum nome nesta turma ainda')).toBeNull()
    expect(screen.queryByText('Nenhum professor nesta turma')).toBeNull()
    expect(screen.queryByText('Nenhum pedido esperando')).toBeNull()
    expect(screen.getByRole('link', { name: 'Voltar para Escola' })).toBeTruthy()
    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Turma 7º A' })).toBeTruthy()
    expect(await screen.findByRole('region', { name: 'Nomes da turma' })).toBeTruthy()
  })

  it('a turma que a API não acha (saiu do ano, ou foi excluída): o texto de hoje, sem a lista nem os professores', async () => {
    const rede = fakeNetwork()
    instalar(rede, { turma: FORA })
    montar()

    expect(await screen.findByText(/Esta turma não está no ano letivo em curso/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Nomes da turma' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Professores da turma' })).toBeNull()
    // Sem a turma, nada auditado é lido, e a lista de turmas, que só enfeita o título, nem é pedida.
    expect(caminhosDe(rede)).toEqual([`/v1/turmas/${TURMA.id}`])
  })
})

describe('os estados da lista de nomes', () => {
  it('carregando, e depois os nomes; a lista de nomes tem o seu estado, e não o da turma', async () => {
    let liberar: (resposta: FakeResponse) => void = () => undefined
    instalar(fakeNetwork(), { lista: () => new Promise<FakeResponse>((resolver) => (liberar = resolver)) })
    await montarEEsperar()

    expect(await screen.findByText('Carregando a lista de nomes…')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Turma 7º A' })).toBeTruthy()
    liberar(ok([NOME(1, 'livre')]))
    expect(await nomes().findByText('Aluno 1')).toBeTruthy()
    expect(screen.queryByText('Carregando a lista de nomes…')).toBeNull()
  })

  it('o erro da leitura da lista tem "Tentar de novo" na seção dela, e a nova tentativa traz os nomes', async () => {
    const usuario = userEvent.setup()
    let falhar = true
    instalar(fakeNetwork(), { lista: () => (falhar ? FALHA : ok([NOME(1, 'livre')])) })
    await montarEEsperar()

    expect(await nomes().findByRole('alert')).toBeTruthy()
    expect(nomes().queryByText('Nenhum nome nesta turma ainda')).toBeNull()
    falhar = false
    await usuario.click(nomes().getByRole('button', { name: 'Tentar de novo' }))
    expect(await nomes().findByText('Aluno 1')).toBeTruthy()
  })

  it('turma sem nenhum nome: "Nenhum nome nesta turma ainda", e só depois de a leitura terminar sem erro', async () => {
    instalar(fakeNetwork(), { lista: ok([]) })
    await montarEEsperar()

    expect(await nomes().findByText('Nenhum nome nesta turma ainda')).toBeTruthy()
    expect(nomes().queryByRole('table')).toBeNull()
  })

  it('com dado: cada nome é uma linha com a matrícula e a situação em texto, e só o nome livre tem "Retirar", com a matrícula no nome do botão', async () => {
    instalar(fakeNetwork(), { lista: ok([NOME(1, 'livre', 'Ana Souza', '2026001'), NOME(2, 'reivindicado', 'Bruno Lima', '2026002'), NOME(3, 'aprovado')]) })
    await montarEEsperar()

    expect(await nomes().findByText('Ana Souza')).toBeTruthy()
    expect(within(nomes().getByRole('table')).getAllByRole('columnheader').map((cabecalho) => cabecalho.textContent)).toEqual(['Nome', 'Matrícula', 'Situação'])
    const [ana, bruno, ...outras] = linhasDosNomes()
    expect(outras).toHaveLength(0)
    expect(ana?.textContent).toContain('2026001')
    expect(ana?.textContent).toContain('Livre: esperando o aluno pedir o nome')
    expect(bruno?.textContent).toContain('2026002')
    expect(bruno?.textContent).toContain('O aluno pediu o nome: esperando a decisão')
    expect(within(ana as HTMLElement).getByRole('button', { name: /^Retirar\s*Ana Souza, matrícula 2026001 da lista$/ })).toBeTruthy()
    expect(within(bruno as HTMLElement).queryByRole('button')).toBeNull()
    // O aprovado não tem nome nem matrícula na lista: entra na contagem, e não vira linha.
    expect(nomes().getByText(/Aprovados nesta turma: 1\./)).toBeTruthy()
    expect(nomes().getByText('3 nomes na lista')).toBeTruthy()
  })

  it('só aprovados: a contagem diz tudo, e a tabela não aparece só com o cabeçalho', async () => {
    instalar(fakeNetwork(), { lista: ok([NOME(1, 'aprovado'), NOME(2, 'aprovado')]) })
    await montarEEsperar()

    expect(await nomes().findByText(/Aprovados nesta turma: 2\./)).toBeTruthy()
    expect(nomes().queryByRole('table')).toBeNull()
  })

  it('no celular a tabela vira lista, com o nome de cada valor dito em texto', async () => {
    janelaDe(360)
    instalar(fakeNetwork(), { lista: ok([NOME(1, 'livre', 'Ana Souza', '2026001')]) })
    await montarEEsperar()

    const lista = await nomes().findByRole('list', { name: 'Cada nome com a matrícula e a situação' })
    expect(nomes().queryByRole('table')).toBeNull()
    const item = within(lista).getByRole('listitem')
    expect(item.textContent).toContain('Ana Souza')
    expect(within(item).getByText('Matrícula')).toBeTruthy()
    expect(item.textContent).toContain('2026001')
    expect(within(item).getByText('Situação')).toBeTruthy()
  })
})

describe('as leituras da tela', () => {
  it('a lista de nomes é lida uma vez ao abrir, com a finalidade; os pedidos não são lidos sem o clique; os professores da turma não fazem leitura auditada', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    rede.responderPor(`/v1/turmas/${TURMA.id}/reivindicacoes`, ok([]))
    await montarEEsperar()
    expect(await nomes().findByText('Aluno 1')).toBeTruthy()
    expect(await professores().findByText('Camila Sintética')).toBeTruthy()

    const leiturasDaLista = rede.chamadas.filter((chamada) => chamada.caminho.startsWith(`/v1/turmas/${TURMA.id}/lista`))
    expect(leiturasDaLista).toHaveLength(1)
    expect(new URL(leiturasDaLista[0]?.caminho ?? '', 'http://x').searchParams.get('finalidade')).toBe('conferencia_de_cadastro')
    expect(rede.chamadas.some((chamada) => chamada.caminho.includes('reivindicacoes'))).toBe(false)
    // O que lê os professores da turma, e só isso: nenhuma das duas leva finalidade, porque nenhuma é auditada.
    for (const chamada of rede.chamadas.filter((candidata) => ['/v1/vinculos', '/v1/professores'].includes(candidata.caminho.split('?')[0] ?? ''))) {
      expect(new URL(chamada.caminho, 'http://x').searchParams.has('finalidade')).toBe(false)
    }
    expect(new Set(caminhosDe(rede))).toEqual(new Set([`/v1/turmas/${TURMA.id}`, '/v1/turmas', `/v1/turmas/${TURMA.id}/lista`, '/v1/vinculos', '/v1/professores']))
  })

  it('os pedidos só são lidos no "Atualizar", com a finalidade', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    rede.responderPor(`/v1/turmas/${TURMA.id}/reivindicacoes`, ok([]))
    await montarEEsperar()
    expect(await nomes().findByText('Aluno 1')).toBeTruthy()

    await usuario.click(screen.getByRole('button', { name: /^Atualizar/ }))
    await waitFor(() => expect(rede.chamadas.some((chamada) => chamada.caminho.includes('reivindicacoes'))).toBe(true))
    const leitura = rede.chamadas.find((chamada) => chamada.caminho.includes('reivindicacoes'))
    expect(new URL(leitura?.caminho ?? '', 'http://x').searchParams.get('finalidade')).toBe('conferencia_de_cadastro')
  })
})

describe('os professores da turma', () => {
  it('um item por vínculo: o professor com duas disciplinas na turma aparece duas vezes, cada uma com o estado em texto e o link para o painel dele', async () => {
    instalar(fakeNetwork(), {
      vinculos: ok([
        VINCULO(1, CAMILA.usuarioId, TURMA, MATEMATICA, 'confirmado'),
        VINCULO(2, CAMILA.usuarioId, TURMA, CIENCIAS, 'pendente'),
        VINCULO(3, PAULO.usuarioId, TURMA, undefined, 'contestado'),
        // Os vínculos de outra turma e o de outro papel não são desta turma.
        VINCULO(4, PAULO.usuarioId, OUTRA_TURMA, MATEMATICA, 'confirmado'),
        { ...VINCULO(5, CAMILA.usuarioId, TURMA, MATEMATICA, 'confirmado'), papel: 'aluno' },
      ]),
    })
    await montarEEsperar()

    const links = await professores().findAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining('Camila Sintética'),
      expect.stringContaining('Camila Sintética'),
      expect.stringContaining('Paulo Sintético'),
    ])
    expect(links[0]?.textContent).toContain('Ciências')
    expect(links[0]?.textContent).toContain('Esperando o professor confirmar')
    expect(links[1]?.textContent).toContain('Matemática')
    expect(links[1]?.textContent).toContain('Confirmado pelo professor')
    expect(links[2]?.textContent).toContain('Sem disciplina')
    expect(links[2]?.textContent).toContain('Contestado pelo professor')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([CAMILA.usuarioId, CAMILA.usuarioId, PAULO.usuarioId].map((usuario) => `/professores?professor=${usuario}`))
    // Nada de uso, de entrega nem de atividade do professor (regra 70, itens 8 e 9).
    expect(professores().queryByText(/uso|entrega|atividade|acesso/i)).toBeNull()
  })

  it('o vínculo encerrado aparece como encerrado, e o contestado não mostra o complemento do professor', async () => {
    instalar(fakeNetwork(), {
      vinculos: ok([
        VINCULO(1, CAMILA.usuarioId, TURMA, MATEMATICA, 'encerrado'),
        { ...VINCULO(2, PAULO.usuarioId, TURMA, CIENCIAS, 'contestado'), contestacao: 'outro', complemento: 'Texto livre do professor' },
      ]),
    })
    await montarEEsperar()

    expect(await professores().findByText('Encerrado')).toBeTruthy()
    expect(professores().queryByText(/Texto livre do professor/)).toBeNull()
  })

  it('o professor que a lista de professores não traz aparece como "Nome não carregado", e o vínculo continua com o estado dele', async () => {
    instalar(fakeNetwork(), { professores: ok([PAULO]), vinculos: ok([VINCULO(1, CAMILA.usuarioId, TURMA, MATEMATICA, 'confirmado')]) })
    await montarEEsperar()

    const link = await professores().findByRole('link')
    expect(link.textContent).toContain('Nome não carregado')
    expect(link.textContent).not.toContain('Camila')
    expect(link.textContent).toContain('Confirmado pelo professor')
  })

  it('turma sem professor: "Nenhum professor nesta turma", com o caminho para Professores', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { vinculos: ok([VINCULO(1, PAULO.usuarioId, OUTRA_TURMA, MATEMATICA, 'confirmado')]) })
    const localizacao = await montarEEsperar()

    expect(await professores().findByText('Nenhum professor nesta turma')).toBeTruthy()
    await usuario.click(professores().getByRole('button', { name: 'Ver os professores' }))
    expect(localizacao.history?.at(-1)).toBe('/professores')
  })

  it('a lista de vínculos que bateu no teto de páginas: o aviso, e nunca "Nenhum professor nesta turma"', async () => {
    const rede = fakeNetwork()
    // Toda página diz que há outra: a leitura para no teto e volta incompleta.
    instalar(rede, { vinculos: ok([VINCULO(1, PAULO.usuarioId, OUTRA_TURMA, MATEMATICA, 'confirmado')], { proxima: id(999) }) })
    await montarEEsperar()

    expect(await professores().findByText(/A lista é maior do que esta tela mostra/)).toBeTruthy()
    expect(professores().queryByText('Nenhum professor nesta turma')).toBeNull()
  })

  it('carregando e erro são da seção, e "Tentar de novo" relê só a leitura que falhou', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhar = true
    instalar(rede, { professores: () => (falhar ? FALHA : ok([CAMILA])) })
    await montarEEsperar()

    expect(await professores().findByRole('alert')).toBeTruthy()
    // O resto da tela não depende dela.
    expect(await nomes().findByText('Aluno 1')).toBeTruthy()
    const antes = rede.chamadas.length
    falhar = false
    await usuario.click(professores().getByRole('button', { name: 'Tentar de novo' }))
    expect(await professores().findByText('Camila Sintética')).toBeTruthy()
    expect(caminhosDe(rede).slice(antes)).toEqual(['/v1/professores'])
  })

  it('"Tentar de novo" troca o erro por "Carregando…" enquanto a releitura não volta, e a tela traz o professor quando ela volta', async () => {
    const usuario = userEvent.setup()
    let falhar = true
    let liberar: (resposta: FakeResponse) => void = () => undefined
    instalar(fakeNetwork(), {
      professores: () =>
        falhar
          ? FALHA
          : new Promise<FakeResponse>((resolver) => {
              liberar = resolver
            }),
    })
    await montarEEsperar()

    expect(await professores().findByRole('alert')).toBeTruthy()
    falhar = false
    await usuario.click(professores().getByRole('button', { name: 'Tentar de novo' }))
    // Nem o erro nem o botão ficam na tela enquanto a leitura não volta (o que a pessoa vê é a tela carregando).
    expect(await professores().findByText('Carregando os professores da turma…')).toBeTruthy()
    expect(professores().queryByRole('alert')).toBeNull()
    expect(professores().queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    liberar(ok([CAMILA]))
    expect(await professores().findByText('Camila Sintética')).toBeTruthy()
    expect(professores().queryByText('Carregando os professores da turma…')).toBeNull()
  })

  it('enquanto os professores carregam, a seção diz que carrega, e a lista de nomes aparece sem esperar', async () => {
    instalar(fakeNetwork(), { professores: nuncaResponde })
    await montarEEsperar()

    expect(await professores().findByText('Carregando os professores da turma…')).toBeTruthy()
    expect(await nomes().findByText('Aluno 1')).toBeTruthy()
  })
})

describe('o foco depois de cada ação', () => {
  /** O que está na lista no momento em que a tela a lê: o teste muda entre uma leitura e outra. */
  function listaQueMuda(rede: FakeNetwork, inicial: readonly unknown[]) {
    const estado = { itens: inicial }
    instalar(rede, { lista: () => ok(estado.itens) })
    return estado
  }

  it('gravar a lista leva o foco ao título dos nomes, com o anúncio, e os nomes gravados já na tabela', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const estado = listaQueMuda(rede, [])
    rede.responderPor(`/v1/turmas/${TURMA.id}/lista/previa`, {
      status: 200,
      corpo: { entram: 1, jaExistem: 0, comErro: 0, linhas: [{ linha: 1, nome: 'Ana Souza', matricula: '2026001', resultado: 'entra' }] },
    })
    rede.responderPor(new RegExp(`^/v1/turmas/${TURMA.id}/lista$`), () => {
      estado.itens = [NOME(1, 'livre', 'Ana Souza', '2026001')]
      return { status: 200, corpo: { gravados: 1, jaExistentes: 0 } }
    })
    await montarEEsperar()
    expect(await nomes().findByText('Nenhum nome nesta turma ainda')).toBeTruthy()

    await usuario.type(screen.getByLabelText('Lista colada'), 'Ana Souza;2026001')
    await usuario.click(screen.getByRole('button', { name: 'Ver a prévia' }))
    await usuario.click(await screen.findByRole('button', { name: 'Gravar lista' }))

    expect(await nomes().findByText('1 nome gravado na lista.')).toBeTruthy()
    expect(document.activeElement).toBe(nomes().getByRole('heading', { name: 'Nomes da turma' }))
    expect(linhasDosNomes()).toHaveLength(1)
    expect(linhasDosNomes()[0]?.textContent).toContain('Ana Souza')
    expect((screen.getByLabelText('Lista colada') as HTMLTextAreaElement).value).toBe('')
  })

  it('acrescentar um nome fecha o diálogo, anuncia na seção dos nomes e devolve o foco ao botão que o abriu', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const estado = listaQueMuda(rede, [NOME(1, 'livre', 'Ana Souza', '2026001')])
    rede.responderPor(`/v1/turmas/${TURMA.id}/lista/nome`, () => {
      estado.itens = [...estado.itens, NOME(2, 'livre', 'Bruno Lima', '2026002')]
      return { status: 200, corpo: NOME(2, 'livre', 'Bruno Lima', '2026002') }
    })
    await montarEEsperar()
    expect(await nomes().findByText('Ana Souza')).toBeTruthy()

    const abrir = nomes().getByRole('button', { name: 'Acrescentar um nome' })
    await usuario.click(abrir)
    const dialogo = await screen.findByRole('dialog', { name: 'Acrescentar um nome' })
    await usuario.type(within(dialogo).getByLabelText('Nome do aluno'), 'Bruno Lima')
    await usuario.type(within(dialogo).getByLabelText('Matrícula'), '2026002')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Acrescentar' }))

    expect(await nomes().findByText('Nome acrescentado à lista da turma.')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(abrir)
    expect(await nomes().findByText('Bruno Lima')).toBeTruthy()
  })

  it('retirar um nome livre tira a linha, anuncia, e leva o foco ao título dos nomes (a linha que abriu o diálogo saiu da tela)', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    const estado = listaQueMuda(rede, [NOME(1, 'livre', 'Ana Souza', '2026001'), NOME(2, 'livre', 'Bruno Lima', '2026002')])
    rede.responderPor(`/v1/lista-nomes/${NOME(1, 'livre').id}`, () => {
      estado.itens = estado.itens.filter((item) => (item as { id: string }).id !== NOME(1, 'livre').id)
      return { status: 204 }
    })
    await montarEEsperar()
    expect(await nomes().findByText('Ana Souza')).toBeTruthy()

    await usuario.click(nomes().getByRole('button', { name: /^Retirar\s*Ana Souza, matrícula 2026001 da lista$/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Retirar o nome da lista' })
    expect(dialogo.textContent).toContain('Ana Souza, matrícula 2026001, sai da lista desta turma')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Retirar da lista' }))

    expect(await nomes().findByText('Nome retirado da lista.')).toBeTruthy()
    await waitFor(() => expect(nomes().queryByText('Ana Souza')).toBeNull())
    expect(nomes().getByText('Bruno Lima')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(nomes().getByRole('heading', { name: 'Nomes da turma' })))
  })
})
