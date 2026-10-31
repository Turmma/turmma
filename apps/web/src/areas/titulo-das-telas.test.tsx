// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararTela, renderizarTela } from '../__fixtures__/render-screen'
import Eu from './aluno/Eu'
import InicioDoAluno from './aluno/Inicio'
import Escola from './coordenacao/Escola'
import Estrutura from './coordenacao/estrutura/Estrutura'
import ListaDaTurma from './coordenacao/estrutura/ListaDaTurma'
import Professores from './coordenacao/professores/Professores'
import TutorDoAluno from './aluno/Tutor'
import Conversa from './professor/assistente/Conversa'
import Home from './professor/inicio/Home'
import Time from './professor/assistente/Time'
import Turma from './professor/turmas/Turma'
import TutorDoProfessor from './professor/turmas/Tutor'
import Turmas from './professor/turmas/Turmas'

/**
 * O título das seis telas que escreviam o cabeçalho à mão e passaram à `Tela` (RF12; Tech Spec da X1, seção 9, "Página"):
 * cada uma, nos quatro estados — carregando, com erro, vazia e com dado —, tem **um** `h1`, com o texto de hoje, e ele
 * aparece também onde antes não havia: no carregando, no erro e no vazio. A caixa que o navegador desenha (24 px, 64 px
 * de cabeçalho) é do e2e (`e2e/titulo-da-tela.spec.ts`).
 *
 * A rede é falsa e responde pelo caminho, e não pela ordem: a `Estrutura` faz seis leituras, e uma ordem fixa
 * quebraria a cada leitura que a tela ganhasse. Caminho que o caso não nomeia responde com lista vazia.
 */
prepararTela()

// A lista da turma da coordenação lê a largura da janela (a tabela dos nomes e o miolo que rola) e a `Tabela` mede o que
// rola; o `jsdom` não tem `matchMedia` nem `ResizeObserver`. Janela larga, como a do Chromebook.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(min-width: 768px)', addEventListener: () => undefined, removeEventListener: () => undefined }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})

const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const UUID_DA_TURMA = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5'
const UUID_DA_SERIE = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f6'
const SERIE = { id: UUID_DA_SERIE, etapa: 'ef_anos_finais', ano: 7 }
const POR_EXTENSO = '7º ano do Ensino Fundamental'

type Resposta = { readonly status: number; readonly corpo?: unknown }
/** O que a rede faz com um caminho: responde, ou fica no ar (o carregando). */
type Rota = Resposta | 'segurar'

const FALHA = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: REQUISICAO } } } as const
const NAO_ACHADA = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: REQUISICAO } } } as const
const LISTA_VAZIA = { status: 200, corpo: { itens: [] } } as const

function redePorCaminho(rotas: Readonly<Record<string, Rota>>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (caminho: string) => {
      const rota = rotas[new URL(caminho, 'http://turmma.teste').pathname] ?? LISTA_VAZIA
      if (rota === 'segurar') return new Promise<Response>(() => undefined)
      return new Response(rota.corpo === undefined ? null : JSON.stringify(rota.corpo), { status: rota.status })
    }),
  )
}

const titulos = () => screen.getAllByRole('heading', { level: 1 })

/** A tela tem um `h1` só, visível (sem `sr-only`), com o texto dado. */
function conferirOTitulo(texto: string): void {
  const h1 = titulos()
  expect(h1).toHaveLength(1)
  expect(h1[0]?.textContent).toBe(texto)
  expect(h1[0]?.classList.contains('sr-only')).toBe(false)
  expect(h1[0]?.classList.contains('t-titulo')).toBe(true)
}

interface Estados {
  readonly tela: () => ReactElement
  readonly titulo: string
  /** O que cada estado põe na tela, para o caso provar que está no estado que diz. */
  readonly carregando: { readonly rotas: Record<string, Rota>; readonly aparece: () => Promise<unknown> }
  readonly erro: { readonly rotas: Record<string, Rota> }
  readonly vazio: { readonly rotas: Record<string, Rota>; readonly aparece: () => Promise<unknown>; readonly titulo?: string }
  readonly comDado: {
    readonly rotas: Record<string, Rota>
    readonly aparece: () => Promise<unknown>
    readonly titulo?: string
    /** A `section` da tela que aponta para o título por `aria-labelledby`: o `idDoTitulo` chegou ao `h1`. */
    readonly regiao?: string
  }
}

function provar(nome: string, estados: Estados): void {
  describe(nome, () => {
    it('carregando: o título já está na tela, e o rótulo do carregamento também', async () => {
      redePorCaminho(estados.carregando.rotas)
      renderizarTela(estados.tela())
      await estados.carregando.aparece()
      conferirOTitulo(estados.titulo)
    })

    it('com erro: o título continua, ao lado do alerta e do "Tentar de novo"', async () => {
      redePorCaminho(estados.erro.rotas)
      renderizarTela(estados.tela())
      expect(await screen.findByRole('alert')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
      conferirOTitulo(estados.titulo)
    })

    it('vazia: o título continua, ao lado do que a tela diz para esse caso', async () => {
      redePorCaminho(estados.vazio.rotas)
      renderizarTela(estados.tela())
      await estados.vazio.aparece()
      conferirOTitulo(estados.vazio.titulo ?? estados.titulo)
    })

    it('com dado: um `h1` só, com o texto de hoje', async () => {
      redePorCaminho(estados.comDado.rotas)
      renderizarTela(estados.tela())
      await estados.comDado.aparece()
      conferirOTitulo(estados.comDado.titulo ?? estados.titulo)
      // A região da tela leva o nome do título: a `section` da tela aponta para o `h1`, que está fora dela, na `Tela`.
      if (estados.comDado.regiao !== undefined) expect(screen.getByRole('region', { name: estados.comDado.regiao })).toBeTruthy()
    })
  })
}

const ANO_EM_CURSO = { id: '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4a1', ano: 2026, inicio: '2026-02-02', fim: '2026-12-18', situacao: 'em_curso' }
const PROFESSORA = { usuarioId: '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4b1', nome: 'Professora sintética', estado: 'ativo' }
const VINCULO = {
  id: '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4c1',
  turma: { id: UUID_DA_TURMA, nome: '7º A' },
  disciplina: { id: '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4d1', nome: 'Matemática' },
  estado: 'confirmado',
}
const TURMA_ABERTA = { status: 200, corpo: { id: UUID_DA_TURMA, nome: '7º A', serie: SERIE } } as const
const EU = {
  status: 200,
  corpo: { usuarioId: PROFESSORA.usuarioId, papel: 'professor', nome: PROFESSORA.nome, escola: { id: UUID_DA_SERIE, nome: 'Escola sintética', slug: 'escola-sintetica' }, inatividadeMin: 30, introducaoVistaEm: '2026-02-01T10:00:00.000Z', acessos: [] },
} as const
const CAMINHO_DA_TURMA = `/v1/turmas/${UUID_DA_TURMA}`

describe('o título das seis telas que passaram à Tela', () => {
  provar('Estrutura', {
    // X2 (3.0): a Estrutura é a aba Turmas de Escola, e o `h1` é o da moldura.
    tela: () => (
      <Escola aba="turmas">
        <Estrutura />
      </Escola>
    ),
    titulo: 'Escola',
    carregando: { rotas: { '/v1/anos-letivos': 'segurar' }, aparece: () => screen.findByText('Carregando a estrutura da escola…') },
    erro: { rotas: { '/v1/anos-letivos': FALHA } },
    vazio: { rotas: { '/v1/anos-letivos': LISTA_VAZIA }, aparece: () => screen.findByText('Comece pelo ano letivo') },
    comDado: { rotas: { '/v1/anos-letivos': { status: 200, corpo: { itens: [ANO_EM_CURSO] } } }, aparece: () => screen.findByRole('heading', { name: 'Turmas de 2026' }) },
  })

  provar('Professores', {
    tela: () => (
      <Escola aba="professores">
        <Professores />
      </Escola>
    ),
    titulo: 'Escola',
    carregando: { rotas: { '/v1/professores': 'segurar' }, aparece: () => screen.findByText('Carregando os professores…') },
    erro: { rotas: { '/v1/professores': FALHA } },
    vazio: { rotas: { '/v1/professores': LISTA_VAZIA }, aparece: () => screen.findByText('Nenhum professor ainda') },
    comDado: { rotas: { '/v1/professores': { status: 200, corpo: { itens: [PROFESSORA] } } }, aparece: () => screen.findByRole('heading', { name: 'Professores da escola' }), regiao: 'Professores' },
  })

  provar('Turmas', {
    tela: () => <Turmas />,
    titulo: 'Turmas',
    carregando: { rotas: { '/v1/meus-vinculos': 'segurar' }, aparece: () => screen.findByText('Carregando as suas turmas…') },
    erro: { rotas: { '/v1/meus-vinculos': FALHA } },
    vazio: { rotas: { '/v1/meus-vinculos': LISTA_VAZIA }, aparece: () => screen.findByText('A coordenação ainda não alocou você') },
    comDado: { rotas: { '/v1/meus-vinculos': { status: 200, corpo: { itens: [VINCULO] } } }, aparece: () => screen.findByRole('heading', { name: 'Suas turmas' }), regiao: 'Turmas' },
  })

  provar('Eu', {
    tela: () => <Eu />,
    titulo: 'Eu',
    carregando: { rotas: { '/v1/minha-turma': 'segurar' }, aparece: () => screen.findByText('Carregando a sua turma…') },
    erro: { rotas: { '/v1/minha-turma': FALHA } },
    vazio: { rotas: { '/v1/minha-turma': NAO_ACHADA }, aparece: () => screen.findByText(/não está em uma turma neste ano letivo/) },
    comDado: {
      rotas: { '/v1/minha-turma': { status: 200, corpo: { escola: { nome: 'Escola sintética' }, turma: { id: UUID_DA_TURMA, nome: '7º A' }, serie: SERIE } } },
      aparece: () => screen.findByText(/^7º A · /),
      regiao: 'Eu',
    },
  })

  provar('Turma, do professor', {
    tela: () => <Turma turmaId={UUID_DA_TURMA} />,
    // Sem a turma lida, o título é só "Turma"; com ela, leva o nome, como a aba.
    titulo: 'Turma',
    carregando: { rotas: { [CAMINHO_DA_TURMA]: 'segurar', '/v1/eu': EU }, aparece: () => screen.findByText('Carregando a turma…') },
    erro: { rotas: { [CAMINHO_DA_TURMA]: FALHA, '/v1/eu': EU } },
    vazio: { rotas: { [CAMINHO_DA_TURMA]: NAO_ACHADA, '/v1/eu': EU }, aparece: () => screen.findByText(/não está disponível para você agora/) },
    comDado: {
      rotas: { [CAMINHO_DA_TURMA]: TURMA_ABERTA, '/v1/eu': EU },
      aparece: () => screen.findByText(POR_EXTENSO),
      titulo: 'Turma 7º A',
      regiao: 'Turma 7º A',
    },
  })

  provar('Lista da turma, da coordenação', {
    tela: () => <ListaDaTurma turmaId={UUID_DA_TURMA} />,
    titulo: 'Turma',
    carregando: { rotas: { [CAMINHO_DA_TURMA]: 'segurar' }, aparece: () => screen.findByText('Carregando a turma…') },
    erro: { rotas: { [CAMINHO_DA_TURMA]: FALHA } },
    vazio: { rotas: { [CAMINHO_DA_TURMA]: NAO_ACHADA }, aparece: () => screen.findByText(/Esta turma não está no ano letivo em curso/) },
    comDado: {
      rotas: { [CAMINHO_DA_TURMA]: TURMA_ABERTA },
      aparece: () => screen.findByText(POR_EXTENSO),
      titulo: 'Turma 7º A',
      regiao: 'Turma 7º A',
    },
  })
})

describe('o título de quem recebe o foco', () => {
  it('Professores: o `h1` da moldura entra na ordem de foco por código (`tabindex` -1), que é o que o foco de reserva do diálogo usa', async () => {
    redePorCaminho({ '/v1/professores': { status: 200, corpo: { itens: [PROFESSORA] } } })
    renderizarTela(
      <Escola aba="professores">
        <Professores />
      </Escola>,
    )
    await screen.findByRole('heading', { name: 'Professores da escola' })
    expect(titulos()[0]?.getAttribute('tabindex')).toBe('-1')
  })
})

describe('a turma lida e a leitura de quem está na sessão que falha', () => {
  it('professor: o erro toma o lugar das abas, e o título continua com o nome da turma e a série', async () => {
    redePorCaminho({ [CAMINHO_DA_TURMA]: TURMA_ABERTA, '/v1/eu': FALHA })
    renderizarTela(<Turma turmaId={UUID_DA_TURMA} />)

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    conferirOTitulo('Turma 7º A')
    expect(screen.getByText(POR_EXTENSO)).toBeTruthy()
    expect(screen.queryByRole('tab')).toBeNull()
  })
})

describe('a turma que sai com a tela aberta', () => {
  it('professor: o aviso toma o lugar da turma, e o título volta a ser "Turma", sem a série', async () => {
    redePorCaminho({ [CAMINHO_DA_TURMA]: TURMA_ABERTA, '/v1/eu': EU, [`${CAMINHO_DA_TURMA}/reivindicacoes`]: NAO_ACHADA })
    renderizarTela(<Turma turmaId={UUID_DA_TURMA} />)
    await screen.findByText(POR_EXTENSO)
    conferirOTitulo('Turma 7º A')

    // A aba "Alunos" lê os pedidos da turma, e a leitura deixa de achá-la.
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Alunos' }))
    expect(await screen.findByText(/não está disponível para você agora/)).toBeTruthy()
    conferirOTitulo('Turma')
    expect(screen.queryByText(POR_EXTENSO)).toBeNull()
  })

  it('coordenação: o aviso toma o lugar da lista, e o título volta a ser "Turma"', async () => {
    redePorCaminho({ [CAMINHO_DA_TURMA]: TURMA_ABERTA, [`${CAMINHO_DA_TURMA}/reivindicacoes`]: NAO_ACHADA })
    renderizarTela(<ListaDaTurma turmaId={UUID_DA_TURMA} />)
    await screen.findByText(POR_EXTENSO)
    conferirOTitulo('Turma 7º A')

    // Na coordenação a leitura dos pedidos só sai no "Atualizar", que fica na auditoria.
    await userEvent.setup().click(await screen.findByRole('button', { name: /^Atualizar/ }))
    expect(await screen.findByText(/Esta turma não está no ano letivo em curso/)).toBeTruthy()
    conferirOTitulo('Turma')
  })
})

describe('a conversa é a exceção: o `h1` existe, escondido, com o texto de hoje', () => {
  const CONVERSAS: readonly (readonly [string, () => ReactElement, string])[] = [
    ['Início do professor', () => <Home />, 'Início'],
    ['conversa com o Assistente de ensino', () => <Conversa />, 'Conversa com o Assistente de ensino'],
    ['o que o Assistente de ensino fez', () => <Time />, 'Assistente de ensino'],
    ['o que o Tutor viu, do professor', () => <TutorDoProfessor />, 'Tutor'],
    ['Tutor do aluno', () => <TutorDoAluno />, 'Tutor'],
    ['Início do aluno', () => <InicioDoAluno />, 'Início'],
  ]

  // O `jsdom` não tem `scrollIntoView`, e a conversa o chama ao montar para levar o fim dela à vista.
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = () => undefined
  })

  it.each(CONVERSAS)('%s', (_nome, tela, texto) => {
    redePorCaminho({})
    renderizarTela(tela())
    const h1 = titulos()
    expect(h1).toHaveLength(1)
    expect(h1[0]?.textContent).toBe(texto)
    expect(h1[0]?.classList.contains('sr-only')).toBe(true)
    expect(h1[0]?.classList.contains('t-titulo')).toBe(false)
    expect(h1[0]?.closest('header')).toBeNull()
  })
})
