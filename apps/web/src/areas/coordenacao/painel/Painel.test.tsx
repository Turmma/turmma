// @vitest-environment jsdom
import { CHAVES_DE_CATEGORIA_DO_INCIDENTE, montarTime, RISCOS_DO_INCIDENTE, type ChaveDeFuncao } from '@educa/shared'
import { focusManager, onlineManager, QueryClientProvider, QueryObserver, useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { criarClienteDeConsultas } from '../../../api/query-client'
import { consultaAnosLetivos, consultaSeries } from '../../../api/estrutura'
import { consultaResumoDaGovernanca } from '../governanca/api/governanca'
import { consultaListaDaTurma } from '../estrutura/api/lista'
import { consultaMateriais } from '../material/api/material'
import { consultaPedidosDaTurma } from '../../../api/pedidos'
import { consultaPedidosDoTitular } from '../privacidade/api/privacidade'
import { prepararTela, redeFalsa, type RedeFalsa, type RespostaFalsa } from '../../../__fixtures__/render-screen'
import Painel from './Painel'

/**
 * O Painel da coordenação (telas da coordenação, 2.0; RF6, RF7 e RF22): os números da escola, o que espera por ela e o que
 * falta para terminar a escola. A rede é falsa e responde **por caminho**, porque o Painel lê em paralelo; a fila, o cliente de
 * consultas e a tela são os da aba.
 */
prepararTela()

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const ANO = { id: id(1), ano: 2026, inicio: '2026-02-02', fim: '2026-12-18', situacao: 'em_curso' }
const SERIE = { id: id(200), etapa: 'ef_anos_finais', ano: 7 }
const TURMA = { id: id(101), anoLetivoId: ANO.id, nome: '7º A', turno: null, serie: SERIE }
const OUTRA_TURMA = { ...TURMA, id: id(102), nome: '7º B' }
const MATEMATICA = { id: id(500), nome: 'Matemática', area: null }
const CAMILA = { usuarioId: id(301), nome: 'Camila Sintética', estado: 'ativo' }
const PAULO = { usuarioId: id(302), nome: 'Paulo Sintético', estado: 'vencido' }
const MARTA = { usuarioId: id(303), nome: 'Marta Sintética', estado: 'vencido' }
const VINCULO = (n: number, usuarioId: string, turma: { id: string; nome: string }, estado: string) => ({ id: id(400 + n), usuarioId, papel: 'professor', turma: { id: turma.id, nome: turma.nome }, estado })
const MATERIAL = (estado: 'processando' | 'falhou' | 'pronto') => ({
  id: id(701),
  titulo: 'Apostila sintética',
  disciplinaId: MATEMATICA.id,
  titularidade: 'escola',
  licenciante: null,
  licenca: 'autoria_da_escola',
  estado,
  falha: estado === 'falhou' ? 'sem_texto' : null,
  paginas: null,
  trechos: 0,
  enviadoEm: '2026-10-01T12:00:00.000Z',
})
const MOMENTO = '2026-10-16T12:00:00.000Z'
const INCIDENTE_SEM_CONFIRMACAO = {
  id: id(900),
  conhecidoEm: MOMENTO,
  circunstancias: 'Circunstâncias sintéticas do incidente.',
  categorias: [CHAVES_DE_CATEGORIA_DO_INCIDENTE[0]],
  titularesEstimados: 3,
  risco: RISCOS_DO_INCIDENTE[0],
  contencao: 'Contenção sintética.',
  correcao: 'Correção sintética.',
  avisadoEm: MOMENTO,
  confirmadoEm: null,
}
const CONSUMO_DO_MES = { chamadas: 2, tokensDeEntrada: 1000, tokensDeSaida: 500, custoMicros: 0, comEnvioExterno: 0 }

const ok = (itens: readonly unknown[], extra: Record<string, unknown> = {}): RespostaFalsa => ({ status: 200, corpo: { itens, ...extra } })
const FORA = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }
const nuncaResponde = () => new Promise<RespostaFalsa>(() => undefined)

const funcoes = (suspensas: readonly ChaveDeFuncao[] = []): RespostaFalsa => ({
  status: 200,
  corpo: {
    agentes: montarTime(new Set(suspensas)).agentes.map((agente) => ({
      ...agente,
      funcoes: agente.funcoes.map((funcao) => ({ ...funcao, suspensao: funcao.suspensa ? { suspensaEm: MOMENTO, motivo: null } : null })),
    })),
  },
})
const resumo = (numeros = { geradoPorIa: 7, aprovadoPorPessoa: 3, rejeitado: 0, esperando: 1 }): RespostaFalsa => ({ status: 200, corpo: { numeros, itens: [] } })
const consumo = (porFuncao: readonly unknown[] = [{ ...CONSUMO_DO_MES, funcao: 'conversa_e_ferramentas' }]): RespostaFalsa => ({
  status: 200,
  corpo: { mes: '2026-10', total: CONSUMO_DO_MES, porFuncao, tutor: { trocasNoMes: 12, pacoteDoMes: 9600, trocasPorDiaPorAluno: 60, trocasPorMesPorAluno: 300 } },
})

/** O que cada leitura do Painel responde. Cada caso muda só o que importa para ele. */
type Resposta = RespostaFalsa | (() => RespostaFalsa | Promise<RespostaFalsa>)
interface Respostas {
  anos: Resposta
  incidentes: Resposta
  professores: Resposta
  materiais: Resposta
  turmas: Resposta
  vinculos: Resposta
  series: Resposta
  disciplinas: Resposta
  resumo: Resposta
  consumo: Resposta
  funcoes: Resposta
}
/** A escola montada, sem nada esperando: a fila diz "Tudo em dia" e o roteiro, "A escola está montada". */
const TUDO_EM_DIA: Respostas = {
  anos: ok([ANO]),
  incidentes: { status: 200, corpo: { incidentes: [], prazoLegal: 'O prazo é da escola.' } },
  professores: ok([CAMILA]),
  materiais: ok([MATERIAL('pronto')]),
  turmas: ok([TURMA]),
  vinculos: ok([VINCULO(1, CAMILA.usuarioId, TURMA, 'confirmado')]),
  series: ok([SERIE]),
  disciplinas: ok([MATEMATICA]),
  resumo: resumo(),
  consumo: consumo(),
  funcoes: funcoes(),
}

function instalar(rede: RedeFalsa, respostas: Respostas): void {
  rede.responderPor('/v1/anos-letivos', respostas.anos)
  rede.responderPor('/v1/privacidade/incidentes', respostas.incidentes)
  rede.responderPor('/v1/professores', respostas.professores)
  rede.responderPor('/v1/materiais', respostas.materiais)
  rede.responderPor('/v1/turmas', respostas.turmas)
  rede.responderPor('/v1/vinculos', respostas.vinculos)
  rede.responderPor('/v1/series', respostas.series)
  rede.responderPor('/v1/disciplinas', respostas.disciplinas)
  rede.responderPor('/v1/governanca/resumo', respostas.resumo)
  rede.responderPor('/v1/governanca/consumo', respostas.consumo)
  rede.responderPor('/v1/governanca/funcoes', respostas.funcoes)
}

/** As onze leituras do Painel, e só elas. Os incidentes são uma leitura por sessão (o aviso da área). */
const LEITURAS_DO_PAINEL = ['/v1/anos-letivos', '/v1/professores', '/v1/materiais', '/v1/turmas', '/v1/vinculos', '/v1/series', '/v1/disciplinas', '/v1/governanca/resumo', '/v1/governanca/consumo', '/v1/governanca/funcoes']
const semConsulta = (caminho: string) => caminho.split('?')[0] ?? caminho
const caminhosDe = (rede: RedeFalsa) => rede.chamadas.map((chamada) => semConsulta(chamada.caminho))

/** A largura da janela, para a consulta `(min-width: 768px)` que o miolo lê; o `jsdom` não tem `matchMedia`. */
function janelaDe(largura: number): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta === '(min-width: 768px)' ? largura >= 768 : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

beforeEach(() => janelaDe(1366))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
})

/** O cache que guarda o dado enquanto a tela está fora (como o sino guarda a fila): o teste de frescor vê só o `staleTime`. */
function clienteQueGuarda(): QueryClient {
  const cliente = criarClienteDeConsultas()
  cliente.setDefaultOptions({ queries: { ...cliente.getDefaultOptions().queries, gcTime: Infinity } })
  return cliente
}

/** As leituras auditadas que a Estrutura e a Privacidade têm abertas, para o Painel provar que não as toca. */
function LeiturasAuditadasAbertas() {
  useInfiniteQuery(consultaListaDaTurma(TURMA.id))
  useQuery({ ...consultaPedidosDaTurma(TURMA.id, 'coordenacao'), enabled: true })
  useInfiniteQuery(consultaPedidosDoTitular)
  return null
}

function montar(opcoes: { auditadas?: boolean; cliente?: QueryClient } = {}) {
  const cliente = opcoes.cliente ?? criarClienteDeConsultas()
  const localizacao = memoryLocation({ path: '/painel', record: true })
  const { unmount } = render(
    <QueryClientProvider client={cliente}>
      <Router hook={localizacao.hook}>
        {opcoes.auditadas === true && <LeiturasAuditadasAbertas />}
        <Painel />
      </Router>
    </QueryClientProvider>,
  )
  return { cliente, desmontar: unmount, localizacao }
}

const bloco = (nome: string) => within(screen.getByRole('region', { name: nome }))
/** Espera nenhum bloco estar carregando. */
const esperarTudoLido = () => waitFor(() => expect(screen.queryAllByText(/^(Carregando|Verificando)/)).toHaveLength(0))
const REGIOES = { ia: 'A IA nesta escola', fila: 'Esperando você', escola: 'Para terminar a escola' } as const

describe('o Painel da escola montada', () => {
  it('mostra os quatro números da escola e o consumo do mês numa linha, com o caminho até Registros', async () => {
    const rede = redeFalsa()
    instalar(rede, TUDO_EM_DIA)
    montar()
    await esperarTudoLido()
    const ia = bloco(REGIOES.ia)
    for (const [rotulo, valor] of [['Gerado por IA', '7'], ['Aprovado por gente', '3'], ['Esperando o professor', '1'], ['Rejeitado', '0']] as const) {
      expect(ia.getByText(rotulo).parentElement?.textContent).toContain(valor)
    }
    expect(ia.getByText('Consumo do mês: 1.500 tokens · 2 execuções. Trocas dos alunos com o Tutor: 12 de 9.600 trocas.')).toBeTruthy()
    expect(ia.getByRole('link', { name: 'Ver em Registros' }).getAttribute('href')).toBe('/governanca')
  })

  it('a partir de 768 px o Painel é o miolo que rola e recebe foco; abaixo disso a página rola e não há o que focar', async () => {
    const rede = redeFalsa()
    instalar(rede, TUDO_EM_DIA)
    const { desmontar } = montar()
    await esperarTudoLido()
    const miolo = () => screen.getByRole('region', { name: 'O Painel da escola' })
    expect(miolo().getAttribute('tabindex')).toBe('0')
    expect(miolo().className).toContain('overflow-y-auto')
    desmontar()
    janelaDe(360)
    montar()
    await esperarTudoLido()
    expect(miolo().hasAttribute('tabindex')).toBe(false)
  })

  it('a fila em dia diz "Tudo em dia" e o roteiro completo diz "A escola está montada"; a porta dos pedidos fica sempre, sem número', async () => {
    const rede = redeFalsa()
    instalar(rede, TUDO_EM_DIA)
    montar()
    await esperarTudoLido()
    expect(bloco(REGIOES.fila).getByText('Tudo em dia')).toBeTruthy()
    expect(bloco(REGIOES.fila).queryByRole('region', { name: 'Itens que esperam você' })).toBeNull()
    expect(bloco(REGIOES.escola).getByText('A escola está montada')).toBeTruthy()
    expect(bloco(REGIOES.escola).queryByRole('region', { name: 'Passos que faltam' })).toBeNull()
    const porta = bloco(REGIOES.fila).getByRole('link', { name: /Pedidos dos titulares/ })
    expect(porta.getAttribute('href')).toBe('/privacidade/pedidos')
    expect(porta.textContent).toContain('Os prazos aparecem ao abrir. Cada leitura fica na auditoria.')
    expect(porta.querySelector('[data-contador]')).toBeNull()
    expect(porta.textContent).not.toMatch(/\d/)
  })

  it('a função de IA suspensa vira um aviso com o caminho até Agentes; sem suspensão, nenhum aviso', async () => {
    const rede = redeFalsa()
    instalar(rede, { ...TUDO_EM_DIA, funcoes: funcoes(['correcao_de_objetiva']) })
    montar()
    const aviso = await screen.findByText(/Assistente de ensino · Correção de objetiva/)
    expect(aviso.closest('[data-aviso]')?.getAttribute('data-aviso')).toBe('atencao')
    expect(aviso.closest('[data-aviso]')?.textContent).toContain('Uma função de IA está suspensa nesta escola')
    expect(aviso.closest('[data-aviso]')?.textContent).toContain('Ela recusa pedido novo até ser retomada.')
    expect(screen.getByRole('link', { name: 'Ver como cada IA trabalha' }).getAttribute('href')).toBe('/agentes')
    cleanup()

    const semSuspensa = redeFalsa()
    instalar(semSuspensa, TUDO_EM_DIA)
    montar()
    await esperarTudoLido()
    expect(document.querySelector('[data-aviso]')).toBeNull()
  })

  it('com duas funções suspensas, o aviso nomeia as duas', async () => {
    const rede = redeFalsa()
    instalar(rede, { ...TUDO_EM_DIA, funcoes: funcoes(['correcao_de_objetiva', 'adaptacao']) })
    montar()
    const aviso = await screen.findByText(/Funções de IA estão suspensas nesta escola/)
    const texto = aviso.closest('[data-aviso]')?.textContent ?? ''
    expect(texto).toContain('Assistente de ensino · Correção de objetiva')
    expect(texto).toContain('Assistente de ensino · Adaptação')
    expect(texto).toContain('Elas recusam pedido novo até ser retomada.')
    expect(texto).not.toContain('Ela recusa')
  })

  it('a fila lista cada pendência da escola com o link da tela que a resolve, e o roteiro lista só o que falta', async () => {
    const rede = redeFalsa()
    instalar(rede, {
      ...TUDO_EM_DIA,
      professores: ok([CAMILA, PAULO]),
      materiais: ok([MATERIAL('falhou')]),
      turmas: ok([TURMA, OUTRA_TURMA]),
      disciplinas: ok([]),
    })
    montar()
    await esperarTudoLido()
    const fila = bloco(REGIOES.fila)
    expect(fila.getByRole('link', { name: /Refazer o convite de Paulo Sintético/ }).getAttribute('href')).toBe(`/professores?professor=${PAULO.usuarioId}`)
    expect(fila.getByRole('link', { name: /Apostila sintética/ }).getAttribute('href')).toBe(`/material?material=${MATERIAL('falhou').id}`)
    expect(fila.getByRole('link', { name: /Uma turma sem professor/ }).getAttribute('href')).toBe('/estrutura?situacao=sem-professor')
    expect(fila.queryByText('Tudo em dia')).toBeNull()
    // A lista rola por dentro quando passa do alto, e o teclado a alcança (RF23).
    expect(fila.getByRole('region', { name: 'Itens que esperam você' }).getAttribute('tabindex')).toBe('0')

    const escola = bloco(REGIOES.escola)
    const faltam = escola.getAllByRole('link')
    expect(faltam.map((link) => link.textContent)).toEqual([expect.stringMatching(/^Disciplinas/)])
    expect(faltam[0]?.getAttribute('href')).toBe('/estrutura?painel=ano')
    expect(faltam[0]?.textContent).toContain('Crie as disciplinas que os professores dão.')
    expect(escola.queryByText('A escola está montada')).toBeNull()
  })

  it('o incidente sem confirmação é o item urgente da fila, com o selo escrito', async () => {
    const rede = redeFalsa()
    instalar(rede, { ...TUDO_EM_DIA, incidentes: { status: 200, corpo: { incidentes: [INCIDENTE_SEM_CONFIRMACAO], prazoLegal: 'O prazo é da escola.' } } })
    montar()
    await esperarTudoLido()
    const item = bloco(REGIOES.fila).getByRole('link', { name: /Incidente de segurança sem confirmação/ })
    expect(item.getAttribute('href')).toBe('/privacidade/incidentes')
    expect(within(item).getByText('Urgente')).toBeTruthy()
  })
})

describe('nenhum número é de professor, de turma ou de pedido de titular (RF7)', () => {
  it('dois professores com pendências diferentes: o Painel tem os quatro números da escola, e nenhum número ao lado de nome de professor', async () => {
    const rede = redeFalsa()
    instalar(rede, {
      ...TUDO_EM_DIA,
      professores: ok([CAMILA, PAULO, MARTA]),
      turmas: ok([TURMA, OUTRA_TURMA]),
      // Camila contestou duas turmas, Paulo e Marta têm o convite vencido: três professores, três pendências diferentes.
      vinculos: ok([VINCULO(1, CAMILA.usuarioId, TURMA, 'contestado'), VINCULO(2, CAMILA.usuarioId, OUTRA_TURMA, 'contestado')]),
    })
    const { desmontar } = montar()
    await esperarTudoLido()
    // Os números grandes da tela são os quatro da IA, na escola toda.
    const grandes = [...document.querySelectorAll('.t-numero')].map((no) => no.textContent)
    expect(grandes).toEqual(['7', '3', '1', '0'])
    // O único contador de item é o das turmas sem professor (as duas turmas só têm vínculo contestado); nenhum item de professor tem.
    const contadores = [...document.querySelectorAll('[data-contador]')]
    expect(contadores).toHaveLength(1)
    expect(contadores[0]?.closest('a')?.textContent).toContain('Turmas sem professor')
    const itensDeProfessor = bloco(REGIOES.fila)
      .getAllByRole('link')
      .filter((link) => /Paulo|Marta|Camila/.test(link.textContent ?? ''))
    expect(itensDeProfessor).toHaveLength(4)
    for (const item of itensDeProfessor) {
      expect(item.querySelector('[data-contador]')).toBeNull()
      expect(item.querySelector('[data-estado]')).toBeNull()
      expect(item.querySelector('span.t-cartao')?.textContent).not.toMatch(/\d/)
    }
    desmontar()
  })

  it('os tipos da fila do Painel são os cinco do sino: nenhum item de uso, de entrega ou de atividade', async () => {
    const rede = redeFalsa()
    instalar(rede, { ...TUDO_EM_DIA, professores: ok([CAMILA, PAULO]), materiais: ok([MATERIAL('falhou')]), turmas: ok([TURMA, OUTRA_TURMA]) })
    montar()
    await esperarTudoLido()
    const titulos = bloco(REGIOES.fila)
      .getAllByRole('link')
      .map((link) => link.querySelector('span.t-cartao')?.textContent)
    expect(titulos).toEqual(['Refazer o convite de Paulo Sintético', 'O material "Apostila sintética" não foi lido', 'Uma turma sem professor', 'Pedidos dos titulares'])
    expect(document.body.textContent).not.toMatch(/sem chamada|provas a aprovar|não usa|adoção/i)
  })
})

describe('o que o Painel não lê', () => {
  it('nem a lista de nomes, nem os pedidos de nome, nem os pedidos de titular: só as onze leituras dele', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede, { ...TUDO_EM_DIA, professores: ok([CAMILA, PAULO]) })
    const { localizacao } = montar()
    await esperarTudoLido()
    // Aciona o que dá para acionar: o clique na porta dos pedidos só navega, e não lê nada.
    await usuario.click(bloco(REGIOES.fila).getByRole('link', { name: /Pedidos dos titulares/ }))
    expect(localizacao.history.at(-1)).toBe('/privacidade/pedidos')
    expect(rede.chamadas.map((chamada) => chamada.caminho).filter((caminho) => /\/lista|\/reivindicacoes|\/v1\/privacidade\/pedidos/.test(caminho))).toEqual([])
    expect([...new Set(caminhosDe(rede))].sort()).toEqual([...LEITURAS_DO_PAINEL, '/v1/privacidade/incidentes'].sort())
  })
})

describe('sem ano letivo', () => {
  it('escola sem nenhum ano: "Comece pelo ano letivo", o convite leva ao painel do ano, e a fila diz "Tudo em dia" sem chamar turmas nem vínculos', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    instalar(rede, { ...TUDO_EM_DIA, anos: ok([]), turmas: FORA, vinculos: FORA })
    const { localizacao } = montar()
    await esperarTudoLido()
    expect(bloco(REGIOES.escola).getByText('Comece pelo ano letivo')).toBeTruthy()
    expect(bloco(REGIOES.fila).getByText('Tudo em dia')).toBeTruthy()
    expect(caminhosDe(rede).filter((caminho) => caminho === '/v1/turmas' || caminho === '/v1/vinculos')).toEqual([])
    await usuario.click(bloco(REGIOES.escola).getByRole('button', { name: 'Criar o ano letivo' }))
    expect(localizacao.history.at(-1)).toBe('/estrutura?painel=ano')
  })

  it('só ano planejado ou só encerrado: "Tudo em dia" na fila, o roteiro diz que o ano letivo falta, e turmas e vínculos nem são chamados', async () => {
    for (const situacao of ['planejado', 'encerrado']) {
      const rede = redeFalsa()
      instalar(rede, { ...TUDO_EM_DIA, anos: ok([{ ...ANO, situacao }]), turmas: FORA, vinculos: FORA })
      montar()
      await esperarTudoLido()
      expect(bloco(REGIOES.fila).getByText('Tudo em dia')).toBeTruthy()
      const escola = bloco(REGIOES.escola)
      expect(escola.getAllByRole('link').map((link) => link.querySelector('span.t-cartao')?.textContent)).toEqual(['Ano letivo', 'Turmas', 'Alocação'])
      expect(escola.queryByText('A escola está montada')).toBeNull()
      expect(caminhosDe(rede).filter((caminho) => caminho === '/v1/turmas' || caminho === '/v1/vinculos')).toEqual([])
      cleanup()
    }
  })
})

describe('a fila que falha em parte nunca diz "Tudo em dia"', () => {
  it('uma consulta que falha: o Painel mostra o que leu, o aviso, e "Tentar de novo" relê só a que falhou, sem tocar nas leituras auditadas', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let professoresFora = true
    instalar(rede, { ...TUDO_EM_DIA, materiais: ok([MATERIAL('falhou')]), professores: () => (professoresFora ? FORA : ok([CAMILA])) })
    rede.responderPor(/\/v1\/turmas\/[^/]+\/lista/, ok([]))
    rede.responderPor(/\/v1\/turmas\/[^/]+\/reivindicacoes/, ok([]))
    rede.responderPor('/v1/privacidade/pedidos', ok([]))
    montar({ auditadas: true })
    await esperarTudoLido()
    const fila = bloco(REGIOES.fila)
    expect(fila.getByText('Parte da lista não carregou')).toBeTruthy()
    expect(fila.getByRole('link', { name: /Apostila sintética/ })).toBeTruthy()
    expect(fila.queryByText('Tudo em dia')).toBeNull()

    const antes = rede.chamadas.length
    professoresFora = false
    await usuario.click(fila.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(bloco(REGIOES.fila).queryByText('Parte da lista não carregou')).toBeNull())
    expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho))).toEqual(['/v1/professores'])
  })

  it('uma lista que veio truncada (`completa: false`): o aviso aparece, "turmas sem professor" não é calculada, e "Tentar de novo" relê só as turmas', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let truncada = true
    // Uma página com "há mais" depois da outra, até o teto de páginas da estrutura; depois, a lista inteira.
    instalar(rede, { ...TUDO_EM_DIA, turmas: () => (truncada ? ok([TURMA, OUTRA_TURMA], { proxima: id(999) }) : ok([TURMA])) })
    montar()
    await esperarTudoLido()
    const fila = bloco(REGIOES.fila)
    expect(fila.getByText('Parte da lista não carregou')).toBeTruthy()
    expect(fila.queryByText('Tudo em dia')).toBeNull()
    expect(fila.queryByText(/turma sem professor|Turmas sem professor/)).toBeNull()
    const antes = rede.chamadas.length
    truncada = false
    await usuario.click(fila.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(bloco(REGIOES.fila).queryByText('Parte da lista não carregou')).toBeNull())
    expect([...new Set(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho)))]).toEqual(['/v1/turmas'])
  })

  it('clique duplo em "Tentar de novo" da fila: uma leitura só, e o botão fica desligado enquanto ela corre', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let truncada = true
    let segura = false
    let liberar: () => void = () => undefined
    // A lista de turmas veio truncada: com o dado já na tela, a releitura não tira o aviso nem o botão, e é aí que o segundo clique chegaria.
    const turmas = async (): Promise<RespostaFalsa> => {
      if (segura) await new Promise<void>((resolver) => (liberar = resolver))
      return truncada ? ok([TURMA], { proxima: id(999) }) : ok([TURMA])
    }
    instalar(rede, { ...TUDO_EM_DIA, turmas })
    montar()
    await esperarTudoLido()
    expect(bloco(REGIOES.fila).getByText('Parte da lista não carregou')).toBeTruthy()

    segura = true
    const antes = rede.chamadas.length
    await usuario.dblClick(bloco(REGIOES.fila).getByRole('button', { name: 'Tentar de novo' }))
    expect(bloco(REGIOES.fila).getByRole('button', { name: 'Tentando de novo…' }).hasAttribute('disabled')).toBe(true)
    expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho))).toEqual(['/v1/turmas'])
    segura = false
    truncada = false
    liberar()
    await waitFor(() => expect(bloco(REGIOES.fila).queryByText('Parte da lista não carregou')).toBeNull())
  })

  it('a fila inteira em erro: a mensagem e "Tentar de novo", e nunca "Tudo em dia"', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let fora = true
    const aTodas = (resposta: RespostaFalsa) => () => (fora ? FORA : resposta)
    instalar(rede, {
      ...TUDO_EM_DIA,
      anos: aTodas(ok([ANO])),
      incidentes: aTodas(TUDO_EM_DIA.incidentes as RespostaFalsa),
      professores: aTodas(ok([CAMILA, PAULO])),
      materiais: aTodas(ok([])),
      turmas: aTodas(ok([TURMA])),
      vinculos: aTodas(ok([VINCULO(1, CAMILA.usuarioId, TURMA, 'confirmado')])),
    })
    montar()
    await esperarTudoLido()
    const fila = bloco(REGIOES.fila)
    expect(fila.queryByText('Tudo em dia')).toBeNull()
    expect(fila.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    fora = false
    await usuario.click(fila.getByRole('button', { name: 'Tentar de novo' }))
    expect(await bloco(REGIOES.fila).findByRole('link', { name: /Refazer o convite de Paulo/ })).toBeTruthy()
  })
})

describe('os quatro estados de cada bloco', () => {
  it('as funções de IA: verificando, erro com "Tentar de novo" que relê só elas, e nada quando nenhuma está suspensa', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let fora = true
    instalar(rede, { ...TUDO_EM_DIA, funcoes: () => (fora ? FORA : funcoes(['adaptacao'])) })
    montar()
    await esperarTudoLido()
    const antes = rede.chamadas.length
    fora = false
    await usuario.click(screen.getAllByRole('button', { name: 'Tentar de novo' })[0] as HTMLElement)
    expect(await screen.findByText(/Assistente de ensino · Adaptação/)).toBeTruthy()
    expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho))).toEqual(['/v1/governanca/funcoes'])
    cleanup()

    const lenta = redeFalsa()
    instalar(lenta, { ...TUDO_EM_DIA, funcoes: nuncaResponde })
    montar()
    expect(await screen.findByText('Verificando se alguma IA está suspensa…')).toBeTruthy()
  })

  it('os quatro números: carregando, erro que relê só o resumo, zerados (os quatro em 0), e com dado', async () => {
    const usuario = userEvent.setup()
    const lenta = redeFalsa()
    instalar(lenta, { ...TUDO_EM_DIA, resumo: nuncaResponde })
    montar()
    expect(await bloco(REGIOES.ia).findByText('Carregando os números da IA…')).toBeTruthy()
    // Um bloco que não chegou não derruba os outros: o consumo e a fila aparecem.
    expect(await bloco(REGIOES.ia).findByText(/Consumo do mês: /)).toBeTruthy()
    cleanup()

    const rede = redeFalsa()
    let fora = true
    instalar(rede, { ...TUDO_EM_DIA, resumo: () => (fora ? FORA : resumo()) })
    montar()
    await esperarTudoLido()
    expect(bloco(REGIOES.ia).queryByText('Gerado por IA')).toBeNull()
    const antes = rede.chamadas.length
    fora = false
    await usuario.click(bloco(REGIOES.ia).getByRole('button', { name: 'Tentar de novo' }))
    expect(await bloco(REGIOES.ia).findByText('Gerado por IA')).toBeTruthy()
    expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho))).toEqual(['/v1/governanca/resumo'])
    cleanup()

    const vazia = redeFalsa()
    instalar(vazia, { ...TUDO_EM_DIA, resumo: resumo({ geradoPorIa: 0, aprovadoPorPessoa: 0, rejeitado: 0, esperando: 0 }) })
    montar()
    await esperarTudoLido()
    expect([...document.querySelectorAll('.t-numero')].map((no) => no.textContent)).toEqual(['0', '0', '0', '0'])
  })

  it('o consumo do mês: carregando, erro que relê só o consumo, vazio e com dado', async () => {
    const usuario = userEvent.setup()
    const lenta = redeFalsa()
    instalar(lenta, { ...TUDO_EM_DIA, consumo: nuncaResponde })
    montar()
    expect(await bloco(REGIOES.ia).findByText('Carregando o consumo do mês…')).toBeTruthy()
    expect(await bloco(REGIOES.ia).findByText('Gerado por IA')).toBeTruthy()
    // O vazio do consumo só vem com a leitura terminada e sem erro (RF22): carregando, nem "Nenhuma função…" nem a linha do mês.
    expect(bloco(REGIOES.ia).queryByText('Nenhuma função da IA trabalhou neste mês.')).toBeNull()
    expect(bloco(REGIOES.ia).queryByText(/Consumo do mês: /)).toBeNull()
    cleanup()

    const rede = redeFalsa()
    let fora = true
    instalar(rede, { ...TUDO_EM_DIA, consumo: () => (fora ? FORA : consumo()) })
    montar()
    await esperarTudoLido()
    // Com o erro, o consumo não afirma o vazio nem mostra a linha do mês: o alerta do bloco está na tela antes de conferir.
    await bloco(REGIOES.ia).findByRole('alert')
    expect(bloco(REGIOES.ia).queryByText('Nenhuma função da IA trabalhou neste mês.')).toBeNull()
    expect(bloco(REGIOES.ia).queryByText(/Consumo do mês: /)).toBeNull()
    const antes = rede.chamadas.length
    fora = false
    await usuario.click(bloco(REGIOES.ia).getByRole('button', { name: 'Tentar de novo' }))
    expect(await bloco(REGIOES.ia).findByText(/Consumo do mês: 1\.500 tokens/)).toBeTruthy()
    expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho))).toEqual(['/v1/governanca/consumo'])
    cleanup()

    const vazio = redeFalsa()
    instalar(vazio, { ...TUDO_EM_DIA, consumo: consumo([]) })
    montar()
    await esperarTudoLido()
    expect(bloco(REGIOES.ia).getByText('Nenhuma função da IA trabalhou neste mês.')).toBeTruthy()
    expect(bloco(REGIOES.ia).queryByText(/Consumo do mês: /)).toBeNull()
  })

  it('a fila: carregando enquanto alguma leitura não chegou, sem item (nem os das leituras que já vieram) e sem "Tudo em dia"', async () => {
    const rede = redeFalsa()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    instalar(rede, { ...TUDO_EM_DIA, professores: nuncaResponde, materiais: ok([MATERIAL('falhou')]) })
    const { cliente } = montar()
    expect(await bloco(REGIOES.fila).findByText('Carregando o que espera você…')).toBeTruthy()
    // O material que falhou já veio, e a fila espera as outras: lista pela metade não se mostra. O relógio falso deixa a
    // tela receber o que o cache já tem, sem esperar de verdade.
    await waitFor(() => expect(cliente.getQueryState(consultaMateriais.queryKey)?.status).toBe('success'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    expect(bloco(REGIOES.fila).queryByRole('link', { name: /Apostila sintética/ })).toBeNull()
    expect(bloco(REGIOES.fila).queryByText('Tudo em dia')).toBeNull()
    // A porta dos pedidos não espera leitura nenhuma.
    expect(bloco(REGIOES.fila).getByRole('link', { name: /Pedidos dos titulares/ })).toBeTruthy()
  })

  it('o roteiro: carregando, erro dos anos que relê só os anos, o que falta e "A escola está montada"', async () => {
    const usuario = userEvent.setup()
    const lenta = redeFalsa()
    instalar(lenta, { ...TUDO_EM_DIA, anos: nuncaResponde })
    montar()
    expect(await bloco(REGIOES.escola).findByText('Carregando o que falta para a escola…')).toBeTruthy()
    cleanup()

    const rede = redeFalsa()
    let fora = true
    instalar(rede, { ...TUDO_EM_DIA, anos: () => (fora ? FORA : ok([ANO])) })
    montar()
    await esperarTudoLido()
    const antes = rede.chamadas.length
    fora = false
    await usuario.click(bloco(REGIOES.escola).getByRole('button', { name: 'Tentar de novo' }))
    expect(await bloco(REGIOES.escola).findByText('A escola está montada')).toBeTruthy()
    expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho)).filter((caminho) => caminho === '/v1/anos-letivos')).toEqual(['/v1/anos-letivos'])
  })

  it('"A escola está montada" só com tudo lido e sem erro: uma leitura que falhou ou que não chegou deixa o passo sem marca, e nunca vira "falta"', async () => {
    const usuario = userEvent.setup()
    const rede = redeFalsa()
    let seriesFora = true
    instalar(rede, { ...TUDO_EM_DIA, series: () => (seriesFora ? FORA : ok([SERIE])) })
    montar()
    await esperarTudoLido()
    const escola = bloco(REGIOES.escola)
    expect(escola.queryByText('A escola está montada')).toBeNull()
    expect(escola.getByText('Parte do que falta não carregou')).toBeTruthy()
    expect(escola.queryByText('Séries')).toBeNull()
    const antes = rede.chamadas.length
    seriesFora = false
    await usuario.click(escola.getByRole('button', { name: 'Tentar de novo' }))
    expect(await bloco(REGIOES.escola).findByText('A escola está montada')).toBeTruthy()
    expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho))).toEqual(['/v1/series'])
    cleanup()

    // Uma leitura que ainda não chegou: a frase espera, e o bloco diz que carrega.
    const lenta = redeFalsa()
    instalar(lenta, { ...TUDO_EM_DIA, disciplinas: nuncaResponde })
    montar()
    expect(await bloco(REGIOES.escola).findByText('Carregando o que falta para a escola…')).toBeTruthy()
    expect(bloco(REGIOES.escola).queryByText('A escola está montada')).toBeNull()
  })

  it('cada uma das cinco leituras do roteiro que falha deixa o aviso e o passo sem marca, e "Tentar de novo" relê só ela', async () => {
    const usuario = userEvent.setup()
    const leituras = [
      ['series', '/v1/series'],
      ['disciplinas', '/v1/disciplinas'],
      ['professores', '/v1/professores'],
      ['turmas', '/v1/turmas'],
      ['vinculos', '/v1/vinculos'],
    ] as const
    for (const [chave, caminho] of leituras) {
      const rede = redeFalsa()
      let fora = true
      instalar(rede, { ...TUDO_EM_DIA, [chave]: () => (fora ? FORA : (TUDO_EM_DIA[chave] as RespostaFalsa)) })
      montar()
      await esperarTudoLido()
      const escola = bloco(REGIOES.escola)
      expect(escola.getByText('Parte do que falta não carregou'), chave).toBeTruthy()
      expect(escola.queryByText('A escola está montada'), chave).toBeNull()
      expect(escola.queryByRole('region', { name: 'Passos que faltam' }), chave).toBeNull()
      const antes = rede.chamadas.length
      fora = false
      await usuario.click(escola.getByRole('button', { name: 'Tentar de novo' }))
      expect(await bloco(REGIOES.escola).findByText('A escola está montada'), chave).toBeTruthy()
      expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho)), chave).toEqual([caminho])
      cleanup()
    }
  })

  it('cada passo que falta traz o texto do que fazer e o link da tela', async () => {
    const rede = redeFalsa()
    instalar(rede, { ...TUDO_EM_DIA, series: ok([]), disciplinas: ok([]), turmas: ok([]), professores: ok([PAULO]), vinculos: ok([]) })
    montar()
    await esperarTudoLido()
    const links = bloco(REGIOES.escola).getAllByRole('link')
    expect(links.map((link) => [link.querySelector('span.t-cartao')?.textContent, link.getAttribute('href')])).toEqual([
      ['Séries', '/estrutura?painel=ano'],
      ['Disciplinas', '/estrutura?painel=ano'],
      ['Turmas', '/estrutura'],
      ['Professores', '/professores'],
      ['Alocação', '/professores'],
    ])
    expect(links.every((link) => link.textContent?.includes('Falta'))).toBe(true)
    // Embaixo do título, a frase que fecha sozinha (a `acao`), e não a descrição longa do roteiro da Estrutura.
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining('Crie as séries que a escola tem.'),
      expect.stringContaining('Crie as disciplinas que os professores dão.'),
      expect.stringContaining('Crie as turmas do ano em curso.'),
      expect.stringContaining('Cadastre os professores e mande o convite.'),
      expect.stringContaining('Ligue cada professor à turma e à disciplina.'),
    ])
    // A lista de nomes nunca tem marca: não é passo que falta.
    expect(bloco(REGIOES.escola).queryByText('Lista de nomes')).toBeNull()
  })
})

describe('o clique duplo em "Tentar de novo" lê uma vez só (regra 80, item 7)', () => {
  // Nenhum destes botões fica desligado enquanto a leitura corre. Nos blocos sem dado (`EstadoErro`), quem segura o segundo clique é o
  // próprio TanStack, que reaproveita a leitura que corre; no aviso do roteiro, com dado de antes no cache, é o `cancelRefetch: false`.
  const tentarDeNovo = (regiao?: string) => () => (regiao === undefined ? screen.getByRole('button', { name: 'Tentar de novo' }) : bloco(regiao).getByRole('button', { name: 'Tentar de novo' }))
  const casos = [
    { nome: 'das funções de IA', chave: 'funcoes', caminho: '/v1/governanca/funcoes', botao: tentarDeNovo() },
    { nome: 'dos quatro números', chave: 'resumo', caminho: '/v1/governanca/resumo', botao: tentarDeNovo(REGIOES.ia) },
    { nome: 'do consumo do mês', chave: 'consumo', caminho: '/v1/governanca/consumo', botao: tentarDeNovo(REGIOES.ia) },
    { nome: 'dos anos letivos do roteiro', chave: 'anos', caminho: '/v1/anos-letivos', botao: tentarDeNovo(REGIOES.escola) },
  ] as const

  for (const caso of casos) {
    it(`clique duplo no Tentar de novo ${caso.nome}: uma leitura só`, async () => {
      const usuario = userEvent.setup()
      const rede = redeFalsa()
      let segura = false
      let liberar: () => void = () => undefined
      // Falha na primeira leitura; a releitura fica segurada até o teste soltá-la, e é aí que o segundo clique chega.
      const resposta = async (): Promise<RespostaFalsa> => {
        if (!segura) return FORA
        await new Promise<void>((resolver) => (liberar = resolver))
        return TUDO_EM_DIA[caso.chave] as RespostaFalsa
      }
      instalar(rede, { ...TUDO_EM_DIA, [caso.chave]: resposta })
      montar()
      await esperarTudoLido()
      const botao = caso.botao()

      segura = true
      const antes = rede.chamadas.length
      await usuario.dblClick(botao)
      expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho))).toEqual([caso.caminho])
      liberar()
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull())
    })
  }

  it('clique duplo no Tentar de novo do aviso do roteiro, com a série já no cache e a releitura que falhou: uma leitura só', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const usuario = userEvent.setup({ advanceTimers: (ms) => void vi.advanceTimersByTime(ms) })
    const rede = redeFalsa()
    let estado: 'ok' | 'fora' | 'segura' = 'ok'
    let liberar: () => void = () => undefined
    const series = async (): Promise<RespostaFalsa> => {
      if (estado === 'ok') return ok([SERIE])
      if (estado === 'fora') return FORA
      await new Promise<void>((resolver) => (liberar = resolver))
      return ok([SERIE])
    }
    instalar(rede, { ...TUDO_EM_DIA, series })
    const cliente = clienteQueGuarda()
    const { desmontar } = montar({ cliente })
    await esperarTudoLido()
    desmontar()
    // O dado de antes envelhece e a releitura ao abrir falha: a consulta fica com dado e com erro, que é onde o clique duplo cancelaria.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 1_000)
    })
    estado = 'fora'
    montar({ cliente })
    await esperarTudoLido()
    const botao = bloco(REGIOES.escola).getByRole('button', { name: 'Tentar de novo' })
    expect(cliente.getQueryData(consultaSeries.queryKey)).toBeDefined()

    estado = 'segura'
    const antes = rede.chamadas.length
    await usuario.dblClick(botao)
    expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho))).toEqual(['/v1/series'])
    liberar()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull())
  })
})

describe('o Painel não relê sozinho (regra 80)', () => {
  const MIL = 1_000
  const CINCO_MINUTOS_E_UM = 5 * 60 * MIL + MIL

  async function avancar(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  /** Foco e rede saem e voltam, pelos gerenciadores: um `focus` solto na janela nem um `online` solto fazem o TanStack reler. */
  async function sairEVoltar(tipo: 'foco' | 'rede'): Promise<void> {
    await act(async () => {
      if (tipo === 'foco') {
        focusManager.setFocused(false)
        focusManager.setFocused(true)
      } else {
        onlineManager.setOnline(false)
        onlineManager.setOnline(true)
      }
      await vi.advanceTimersByTimeAsync(50)
    })
  }

  it('abrir o Painel dentro dos 5 minutos não relê nada: o dado ainda vale', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = redeFalsa()
    instalar(rede, TUDO_EM_DIA)
    const cliente = clienteQueGuarda()
    const { desmontar } = montar({ cliente })
    await esperarTudoLido()
    desmontar()
    await avancar(2 * 60_000)
    const antes = rede.chamadas.length
    montar({ cliente })
    await esperarTudoLido()
    await avancar(500)
    expect(rede.chamadas).toHaveLength(antes)
  })

  it('abrir o Painel com a leitura de mais de 5 minutos relê as dez leituras que ficaram velhas, uma vez cada; os incidentes, que são uma leitura por sessão, não', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = redeFalsa()
    instalar(rede, TUDO_EM_DIA)
    const cliente = clienteQueGuarda()
    // O aviso de incidente da área mantém a consulta viva e fresca para sempre (`staleTime: Infinity`).
    const { consultaIncidentes } = await import('../privacidade/api/privacidade')
    const aviso = new QueryObserver(cliente, { ...consultaIncidentes, staleTime: Infinity })
    const largar = aviso.subscribe(() => undefined)
    const { desmontar } = montar({ cliente })
    await esperarTudoLido()
    desmontar()
    await avancar(CINCO_MINUTOS_E_UM)
    const antes = rede.chamadas.length
    montar({ cliente })
    await waitFor(() => expect(rede.chamadas.length - antes).toBeGreaterThanOrEqual(LEITURAS_DO_PAINEL.length))
    await esperarTudoLido()
    expect(rede.chamadas.slice(antes).map((chamada) => semConsulta(chamada.caminho)).sort()).toEqual([...LEITURAS_DO_PAINEL].sort())
    largar()
  })

  it('o resumo que a Governança paginou, velho: o Painel relê uma página só, a primeira, e deixa a chave com essa página', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = redeFalsa()
    instalar(rede, TUDO_EM_DIA)
    const cliente = clienteQueGuarda()
    // O cache como a Governança o deixa depois de três páginas "Ver mais": uma requisição por página se o Painel as relesse.
    const antigos = { geradoPorIa: 99, aprovadoPorPessoa: 99, rejeitado: 99, esperando: 99 }
    cliente.setQueryData(consultaResumoDaGovernanca.queryKey, {
      pages: [
        { numeros: antigos, itens: [], proxima: 'segunda' },
        { numeros: antigos, itens: [], proxima: 'terceira' },
        { numeros: antigos, itens: [] },
      ],
      pageParams: [undefined, 'segunda', 'terceira'],
    })
    await avancar(CINCO_MINUTOS_E_UM)
    montar({ cliente })
    await esperarTudoLido()
    const leituras = rede.chamadas.filter((chamada) => semConsulta(chamada.caminho) === '/v1/governanca/resumo')
    expect(leituras.map((chamada) => chamada.caminho)).toEqual(['/v1/governanca/resumo'])
    // Os números são os de agora, e a chave guarda a primeira página no formato da infinita, que a Governança continua lendo.
    expect(bloco(REGIOES.ia).getByText('Gerado por IA').nextElementSibling?.textContent).toBe('7')
    const guardado = cliente.getQueryData<{ pages: unknown[]; pageParams: unknown[] }>(consultaResumoDaGovernanca.queryKey)
    expect(guardado?.pages).toHaveLength(1)
    expect(guardado?.pageParams).toEqual([undefined])
  })

  it('com o dado velho (mais de 5 min), o foco sai e volta: nenhuma leitura, de nenhuma consulta', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = redeFalsa()
    instalar(rede, TUDO_EM_DIA)
    montar()
    await esperarTudoLido()
    const antes = rede.chamadas.length
    await avancar(CINCO_MINUTOS_E_UM)
    await sairEVoltar('foco')
    expect(rede.chamadas).toHaveLength(antes)
  })

  it('com o dado velho, a rede sai e volta: nenhuma leitura, de nenhuma consulta', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = redeFalsa()
    instalar(rede, TUDO_EM_DIA)
    montar()
    await esperarTudoLido()
    const antes = rede.chamadas.length
    await avancar(CINCO_MINUTOS_E_UM)
    await sairEVoltar('rede')
    expect(rede.chamadas).toHaveLength(antes)
  })

  it('com um material processando, 10 s ou mais depois: nenhuma leitura nova (o material se relê a cada 1,5 s na tela dele, e o Painel não)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rede = redeFalsa()
    instalar(rede, { ...TUDO_EM_DIA, materiais: ok([MATERIAL('processando')]) })
    montar()
    await esperarTudoLido()
    const antes = rede.chamadas.length
    await avancar(12 * MIL)
    expect(rede.chamadas).toHaveLength(antes)
  })

  it('controle: a mesma consulta de anos, com a opção ligada, relê na volta do foco e na volta da rede (o teste enxerga a leitura que o Painel evita)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    for (const tipo of ['foco', 'rede'] as const) {
      const rede = redeFalsa()
      instalar(rede, TUDO_EM_DIA)
      const cliente = criarClienteDeConsultas()
      cliente.mount()
      const observador = new QueryObserver(cliente, {
        ...consultaAnosLetivos,
        staleTime: 5 * 60 * MIL,
        refetchInterval: false,
        refetchOnWindowFocus: tipo === 'foco',
        refetchOnReconnect: tipo === 'rede',
      })
      const parar = observador.subscribe(() => undefined)
      await waitFor(() => expect(observador.getCurrentResult().isSuccess).toBe(true))
      const antes = rede.chamadas.length
      await avancar(CINCO_MINUTOS_E_UM)
      await sairEVoltar(tipo)
      expect(rede.chamadas.length).toBeGreaterThan(antes)
      parar()
      cliente.unmount()
    }
  })
})

describe('recomeço: a pessoa seguinte e a troca de escola', () => {
  it('a sessão que troca esvazia o Painel: os números e a fila da escola A não aparecem enquanto a B carrega, nem depois', async () => {
    const rede = redeFalsa()
    let escola: 'A' | 'B' = 'A'
    let liberarB: (resposta: RespostaFalsa) => void = () => undefined
    const daB = new Promise<RespostaFalsa>((resolver) => (liberarB = resolver))
    // Depois da troca, a escola B responde devagar: o que A tinha não pode aparecer nesse meio-tempo.
    const daEscola = (deA: RespostaFalsa) => () => (escola === 'A' ? deA : nuncaResponde())
    instalar(rede, {
      ...TUDO_EM_DIA,
      professores: () => (escola === 'A' ? ok([CAMILA, PAULO]) : daB),
      resumo: daEscola(resumo({ geradoPorIa: 41, aprovadoPorPessoa: 17, rejeitado: 5, esperando: 19 })),
      consumo: daEscola(consumo()),
    })
    const { cliente } = montar()
    await esperarTudoLido()
    expect(bloco(REGIOES.fila).getByRole('link', { name: /Paulo Sintético/ })).toBeTruthy()
    expect(document.body.textContent).toContain('41')

    // É o que `main.tsx` faz em toda sessão nova: `resetQueries`. O dado de A sai de cena antes de a leitura de B voltar.
    escola = 'B'
    void cliente.resetQueries()
    expect(await bloco(REGIOES.ia).findByText('Carregando os números da IA…')).toBeTruthy()
    expect(document.body.textContent).not.toContain('Paulo Sintético')
    expect(document.body.textContent).not.toContain('41')
    liberarB(ok([CAMILA]))
    await waitFor(() => expect(document.body.textContent).not.toContain('Paulo Sintético'))
  })
})
