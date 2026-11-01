import { randomUUID } from 'node:crypto'
import type { Page, Route } from '@playwright/test'
import type {
  AtividadeAplicada,
  Entrega,
  MensagemDaConversa,
  ArtefatoResponse,
  CorrecaoDoLoteResponse,
  DesempenhoDaTurmaResponse,
  ExecucaoResponse,
  SinaisResponse,
  UsoDoTutorResponse,
  ResultadoDaExecucao,
} from '../../packages/shared/src/index.ts'
import type { ChaveDeFuncao } from '../../packages/shared/src/time/funcoes.ts'
import { montarTime } from '../../packages/shared/src/time/time.ts'

/**
 * A API das telas do Assistente (A2), **simulada na página** (`page.route`): time, conversa, ferramentas, artefatos,
 * entregas e execuções. As rotas de verdade são do pacote P, que nasce em paralelo; o contrato já existe
 * (`docs/mvp-contratos.md`), e é contra ele que estas respostas são escritas. O que é da A1 (a sessão, o `/v1/eu`, os
 * vínculos) continua vindo da API de verdade.
 *
 * O e2e do fluxo inteiro, contra a API real, é outro arquivo, da rodada em que o pacote P for integrado.
 */

export interface PedidoRegistrado {
  readonly metodo: string
  readonly caminho: string
  readonly corpo: unknown
}

interface Resposta {
  readonly status: number
  readonly corpo?: unknown
  /** O PDF do artefato: binário, com `Content-Disposition: attachment`. */
  readonly pdf?: string
}

type Rota =
  | 'time'
  | 'conversa'
  | 'mensagens'
  | 'execucao'
  | 'gerar'
  | 'artefatos'
  | 'artefato'
  | 'renomear'
  | 'pdf'
  | 'adaptar'
  | 'entregas'
  | 'decidir'
  | 'materiais'
  | 'aplicadas'
  | 'aplicar'
  | 'encerrar'
  | 'correcao'
  | 'abrirDestaque'
  | 'aprovarLote'
  | 'desempenho'
  | 'sinais'
  | 'uso'

const ROTAS: readonly { readonly rota: Rota; readonly metodo: string; readonly caminho: RegExp }[] = [
  { rota: 'time', metodo: 'GET', caminho: /^\/v1\/time$/ },
  { rota: 'conversa', metodo: 'GET', caminho: /^\/v1\/assistente\/conversa$/ },
  { rota: 'mensagens', metodo: 'POST', caminho: /^\/v1\/assistente\/mensagens$/ },
  { rota: 'execucao', metodo: 'GET', caminho: /^\/v1\/execucoes\/([^/]+)$/ },
  { rota: 'gerar', metodo: 'POST', caminho: /^\/v1\/ferramentas\/([^/]+)\/gerar$/ },
  { rota: 'artefatos', metodo: 'GET', caminho: /^\/v1\/artefatos$/ },
  { rota: 'pdf', metodo: 'GET', caminho: /^\/v1\/artefatos\/([^/]+)\/pdf$/ },
  { rota: 'adaptar', metodo: 'POST', caminho: /^\/v1\/artefatos\/([^/]+)\/adaptar$/ },
  { rota: 'artefato', metodo: 'GET', caminho: /^\/v1\/artefatos\/([^/]+)$/ },
  { rota: 'renomear', metodo: 'PATCH', caminho: /^\/v1\/artefatos\/([^/]+)$/ },
  { rota: 'entregas', metodo: 'GET', caminho: /^\/v1\/entregas$/ },
  { rota: 'decidir', metodo: 'POST', caminho: /^\/v1\/entregas\/([^/]+)\/decidir$/ },
  { rota: 'materiais', metodo: 'GET', caminho: /^\/v1\/materiais$/ },
  // A3 e A4: a atividade aplicada, a correção, o desempenho, os sinais e o uso do Tutor.
  { rota: 'aplicadas', metodo: 'GET', caminho: /^\/v1\/atividades-aplicadas$/ },
  { rota: 'aplicar', metodo: 'POST', caminho: /^\/v1\/atividades-aplicadas$/ },
  { rota: 'encerrar', metodo: 'POST', caminho: /^\/v1\/atividades-aplicadas\/([^/]+)\/encerrar$/ },
  { rota: 'correcao', metodo: 'GET', caminho: /^\/v1\/atividades-aplicadas\/([^/]+)\/correcao$/ },
  { rota: 'abrirDestaque', metodo: 'POST', caminho: /^\/v1\/atividades-aplicadas\/([^/]+)\/correcao\/destaques\/([^/]+)\/abrir$/ },
  { rota: 'aprovarLote', metodo: 'POST', caminho: /^\/v1\/entregas\/([^/]+)\/aprovar-lote$/ },
  { rota: 'desempenho', metodo: 'GET', caminho: /^\/v1\/turmas\/([^/]+)\/desempenho$/ },
  { rota: 'sinais', metodo: 'GET', caminho: /^\/v1\/sinais$/ },
  { rota: 'uso', metodo: 'GET', caminho: /^\/v1\/tutor\/uso$/ },
]

export function apiError(status: number, codigo: string): Resposta {
  return { status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: randomUUID() } } }
}

/** Uma porta que segura a resposta até o teste abrir: é como o teste vê o estado "carregando" e o clique duplo. */
export function gate(): { readonly aberta: Promise<void>; readonly abrir: () => void } {
  let abrir: () => void = () => undefined
  const aberta = new Promise<void>((resolver) => {
    abrir = resolver
  })
  return { aberta, abrir }
}

export const MATERIAL = randomUUID()
export const TITULO_DO_MATERIAL = 'Química 2, cap. 7 — Estequiometria'
/** A professora que decide, nas respostas simuladas: nome inventado, de ninguém. */
export const QUEM_DECIDE = { id: randomUUID(), nome: 'Camila Souza sintética' }

export class AssistenteApiMock {
  conversa: MensagemDaConversa[] = []
  /** As mensagens anteriores às de `conversa`: a API as entrega em outra página, por `?antes=`. */
  conversaAnterior: MensagemDaConversa[] = []
  /** Com ele, as listas de artefatos e de entregas saem paginadas, deste tamanho, com `proxima`. */
  porPagina: number | undefined
  /** As atividades aplicadas às turmas da professora. */
  aplicadas: AtividadeAplicada[] = []
  /** O lote de correção de cada atividade aplicada, pelo id dela. Sem lote, a rota responde como inexistente. */
  readonly correcoes = new Map<string, CorrecaoDoLoteResponse>()
  /** O lote que nasce quando a atividade encerra. Sem ele, a atividade encerra sem corrigir (função suspensa, ou ninguém respondeu). */
  loteAoEncerrar: ((aplicada: AtividadeAplicada) => CorrecaoDoLoteResponse) | undefined
  desempenho: DesempenhoDaTurmaResponse | undefined
  sinais: SinaisResponse = { itens: [], grupos: [] }
  uso: UsoDoTutorResponse | undefined
  entregas: Entrega[] = []
  artefatos: ArtefatoResponse[] = []
  suspensas = new Set<ChaveDeFuncao>()
  readonly execucoes = new Map<string, ExecucaoResponse>()
  /** Todo `POST` e `PATCH` que a tela mandou, na ordem. */
  readonly pedidos: PedidoRegistrado[] = []
  /** Quantas vezes a tela consultou cada execução. */
  readonly consultasDeExecucao: string[] = []
  private readonly trocadas = new Map<Rota, (pedido: { corpo: unknown; url: URL; ids: readonly string[] }) => Resposta | Promise<Resposta>>()

  /** Troca a resposta de uma rota: o erro, a resposta segurada. Sem função, volta a de sempre. */
  trocar(rota: Rota, resposta?: (pedido: { corpo: unknown; url: URL; ids: readonly string[] }) => Resposta | Promise<Resposta>): void {
    if (resposta === undefined) this.trocadas.delete(rota)
    else this.trocadas.set(rota, resposta)
  }

  /** Os pedidos de uma rota, pelo caminho. */
  pedidosEm(caminho: RegExp): PedidoRegistrado[] {
    return this.pedidos.filter((pedido) => caminho.test(pedido.caminho))
  }

  /** A última execução que a tela pediu. */
  ultimaExecucao(): string {
    const id = [...this.execucoes.keys()].at(-1)
    if (id === undefined) throw new Error('a tela ainda não pediu nenhuma execução')
    return id
  }

  concluir(execucaoId: string, resultado: ResultadoDaExecucao): void {
    const atual = this.execucoes.get(execucaoId)
    if (atual === undefined) throw new Error('execução desconhecida')
    this.execucoes.set(execucaoId, { ...atual, estado: 'concluida', resultado, erro: null })
  }

  falhar(execucaoId: string, erro: NonNullable<ExecucaoResponse['erro']>): void {
    const atual = this.execucoes.get(execucaoId)
    if (atual === undefined) throw new Error('execução desconhecida')
    this.execucoes.set(execucaoId, { ...atual, estado: 'falhou', resultado: null, erro })
  }

  /** Uma página da lista, como a API a entrega: `proxima` é o id do último item, e `?pagina=` continua depois dele. */
  private pagina<Item extends { readonly id: string }>(itens: readonly Item[], url: URL): { itens: Item[]; proxima?: string } {
    if (this.porPagina === undefined) return { itens: [...itens] }
    const depoisDe = url.searchParams.get('pagina')
    const inicio = depoisDe === null ? 0 : itens.findIndex((item) => item.id === depoisDe) + 1
    const fatia = itens.slice(inicio, inicio + this.porPagina)
    const ultimo = fatia.at(-1)
    return { itens: fatia, ...(inicio + this.porPagina < itens.length && ultimo !== undefined ? { proxima: ultimo.id } : {}) }
  }

  private aceitar(tarefa: ExecucaoResponse['tarefa']): Resposta {
    const id = randomUUID()
    this.execucoes.set(id, { id, tarefa, estado: 'pendente', resultado: null, erro: null })
    return { status: 202, corpo: { execucaoId: id } }
  }

  private deSempre(rota: Rota, { corpo, url, ids }: { corpo: unknown; url: URL; ids: readonly string[] }): Resposta {
    const id = ids[0] ?? ''
    if (rota === 'time') return { status: 200, corpo: montarTime(this.suspensas) }
    if (rota === 'conversa') {
      if (url.searchParams.get('antes') !== null) return { status: 200, corpo: { mensagens: this.conversaAnterior } }
      const primeira = this.conversa[0]
      return { status: 200, corpo: { mensagens: this.conversa, ...(this.conversaAnterior.length > 0 && primeira !== undefined ? { anterior: primeira.id } : {}) } }
    }
    if (rota === 'mensagens') return this.aceitar('propor_ferramenta')
    if (rota === 'gerar') return this.aceitar(id === 'plano_de_aula' ? 'gerar_plano_de_aula' : 'gerar_atividade_objetiva')
    if (rota === 'adaptar') return this.aceitar('adaptar_atividade')
    if (rota === 'execucao') {
      this.consultasDeExecucao.push(id)
      const execucao = this.execucoes.get(id)
      return execucao === undefined ? apiError(404, 'NAO_ENCONTRADO') : { status: 200, corpo: execucao }
    }
    if (rota === 'artefatos') {
      // Como a API: `?turmaId=` só restringe a lista (telas do professor, 5.0). Turma que não é da professora devolve a página vazia.
      const turma = url.searchParams.get('turmaId')
      const daTurma = turma === null ? this.artefatos : this.artefatos.filter((item) => item.turmaId === turma)
      return { status: 200, corpo: this.pagina(daTurma.map(({ conteudo: _conteudo, versoesAdaptadas: _versoes, aplicacoes: _aplicacoes, ...resumido }) => resumido), url) }
    }
    if (rota === 'artefato' || rota === 'renomear' || rota === 'pdf') {
      const artefato = this.artefatos.find((item) => item.id === id)
      if (artefato === undefined) return apiError(404, 'NAO_ENCONTRADO')
      if (rota === 'pdf') return { status: 200, pdf: 'atividade-sintetica.pdf' }
      if (rota === 'artefato') return { status: 200, corpo: artefato }
      const titulo = typeof corpo === 'object' && corpo !== null && 'titulo' in corpo && typeof corpo.titulo === 'string' ? corpo.titulo : artefato.titulo
      const renomeado = { ...artefato, titulo, conteudo: { ...artefato.conteudo, titulo } }
      this.artefatos = this.artefatos.map((item) => (item.id === id ? renomeado : item))
      return { status: 200, corpo: renomeado }
    }
    if (rota === 'entregas') {
      const estado = url.searchParams.get('estado')
      const turma = url.searchParams.get('turmaId')
      const filtradas = this.entregas.filter((entrega) => (estado === null || entrega.estado === estado) && (turma === null || entrega.turmaId === turma))
      // Só a lista inteira do Seu time é paginada aqui: a de pendentes e a da turma pedem a página maior.
      return { status: 200, corpo: estado === null && turma === null ? this.pagina(filtradas, url) : { itens: filtradas } }
    }
    if (rota === 'aplicadas') return { status: 200, corpo: { itens: this.aplicadas.filter((aplicada) => aplicada.turmaId === url.searchParams.get('turmaId')) } }
    if (rota === 'aplicar') {
      const pedido = corpo as { artefatoId: string; turmaId: string; avaliativa: boolean }
      const artefato = this.artefatos.find((item) => item.id === pedido.artefatoId)
      if (artefato === undefined || artefato.conteudo.tipo !== 'atividade_objetiva') return apiError(404, 'NAO_ENCONTRADO')
      if (artefato.entrega !== null && artefato.entrega.estado !== 'aprovada') return apiError(409, 'VERSAO_ADAPTADA_NAO_APROVADA')
      if (this.aplicadas.some((aplicada) => aplicada.artefatoId === artefato.id && aplicada.estado === 'aberta')) return apiError(409, 'CONFLITO')
      const aplicada: AtividadeAplicada = {
        id: randomUUID(),
        artefatoId: artefato.id,
        turmaId: pedido.turmaId,
        titulo: artefato.titulo,
        avaliativa: pedido.avaliativa,
        estado: 'aberta',
        questoes: artefato.conteudo.questoes.length,
        aplicadaEm: new Date().toISOString(),
        encerradaEm: null,
        participacao: { alunos: 30, iniciaram: 0, enviaram: 0 },
        entrega: null,
      }
      this.aplicadas = [aplicada, ...this.aplicadas]
      return { status: 201, corpo: aplicada }
    }
    if (rota === 'encerrar') {
      const aplicada = this.aplicadas.find((item) => item.id === id)
      if (aplicada === undefined) return apiError(404, 'NAO_ENCONTRADO')
      const lote = this.loteAoEncerrar?.(aplicada)
      const encerrada: AtividadeAplicada = { ...aplicada, estado: 'encerrada', encerradaEm: aplicada.encerradaEm ?? new Date().toISOString(), entrega: lote === undefined ? null : lote.entrega }
      if (lote !== undefined) {
        this.correcoes.set(aplicada.id, lote)
        this.entregas = [entregaDoLote(lote, aplicada.turmaId), ...this.entregas.filter((entrega) => entrega.id !== lote.entrega.id)]
      }
      this.aplicadas = this.aplicadas.map((item) => (item.id === id ? encerrada : item))
      return { status: 200, corpo: { atividade: encerrada, execucaoId: null } }
    }
    if (rota === 'correcao') {
      const lote = this.correcoes.get(id)
      return lote === undefined ? apiError(404, 'NAO_ENCONTRADO') : { status: 200, corpo: lote }
    }
    if (rota === 'abrirDestaque') {
      const lote = this.correcoes.get(id)
      const destaque = lote?.destaques.find((item) => item.alunoId === ids[1])
      if (lote === undefined || destaque === undefined) return apiError(404, 'NAO_ENCONTRADO')
      if (destaque.abertoEm === null && lote.entrega.estado !== 'pendente') return apiError(409, 'ENTREGA_JA_DECIDIDA')
      // Abrir de novo devolve o mesmo, com a primeira hora.
      const aberto = { ...destaque, abertoEm: destaque.abertoEm ?? new Date().toISOString() }
      const destaques = lote.destaques.map((item) => (item.alunoId === aberto.alunoId ? aberto : item))
      const destaquesAbertos = destaques.filter((item) => item.abertoEm !== null).length
      this.correcoes.set(id, { ...lote, destaques, destaquesAbertos, podeAprovar: lote.entrega.estado === 'pendente' && destaquesAbertos === destaques.length })
      return {
        status: 200,
        corpo: {
          destaque: aberto,
          respostas: lote.resumo.porQuestao.map((questao) => ({ questao: questao.numero, alternativa: aberto.emBranco > 0 ? null : 0, gabarito: questao.gabarito, correta: aberto.emBranco === 0 && questao.gabarito === 0 })),
          historico: [{ titulo: 'Atividade de balanceamento', acertos: 4, total: 5 }],
        },
      }
    }
    if (rota === 'aprovarLote') {
      const achado = [...this.correcoes].find(([, lote]) => lote.entrega.id === id)
      if (achado === undefined) return apiError(404, 'NAO_ENCONTRADO')
      const [atividadeId, lote] = achado
      if (lote.entrega.estado !== 'pendente') return apiError(409, 'ENTREGA_JA_DECIDIDA')
      if (!lote.podeAprovar) return apiError(409, 'DESTAQUES_NAO_ABERTOS')
      const confirmadaEm = new Date().toISOString()
      const validacao = {
        id: randomUUID(),
        apresentado: { resumo: lote.resumo, destaques: lote.destaques.map((destaque) => ({ alunoId: destaque.alunoId, motivos: destaque.motivos })) },
        aberto: lote.destaques.map((destaque) => ({ alunoId: destaque.alunoId, abertoEm: destaque.abertoEm ?? confirmadaEm })),
        confirmadaPor: QUEM_DECIDE,
        confirmadaEm,
      }
      this.correcoes.set(atividadeId, { ...lote, entrega: { ...lote.entrega, estado: 'aprovada' }, podeAprovar: false, validacao })
      const anterior = this.entregas.find((entrega) => entrega.id === id)
      const aprovada: Entrega = { ...(anterior ?? entregaDoLote(lote, '')), estado: 'aprovada', decididaEm: confirmadaEm, decididaPor: QUEM_DECIDE }
      this.entregas = this.entregas.map((entrega) => (entrega.id === id ? aprovada : entrega))
      this.aplicadas = this.aplicadas.map((aplicada) => (aplicada.id === atividadeId ? { ...aplicada, entrega: { id, estado: 'aprovada' } } : aplicada))
      return { status: 200, corpo: { entrega: aprovada, validacao } }
    }
    if (rota === 'desempenho') return { status: 200, corpo: this.desempenho ?? { turmaId: id, lotesAprovados: 0, porHabilidade: [], alunos: [] } }
    if (rota === 'sinais') return { status: 200, corpo: this.sinais }
    if (rota === 'uso') return { status: 200, corpo: this.uso ?? { turmaId: url.searchParams.get('turmaId') ?? randomUUID(), limiteDoDia: 60, trocasDaTurmaNoMes: 0, pacoteDaTurmaNoMes: 9000, alunos: [] } }
    if (rota === 'decidir') {
      const entrega = this.entregas.find((item) => item.id === id)
      if (entrega === undefined) return apiError(404, 'NAO_ENCONTRADO')
      if (entrega.estado !== 'pendente') return apiError(409, 'ENTREGA_JA_DECIDIDA')
      const rejeitar = typeof corpo === 'object' && corpo !== null && 'decisao' in corpo && corpo.decisao === 'rejeitar'
      const justificativa = rejeitar && typeof corpo === 'object' && corpo !== null && 'justificativa' in corpo && typeof corpo.justificativa === 'string' ? corpo.justificativa : null
      const decidida: Entrega = { ...entrega, estado: rejeitar ? 'rejeitada' : 'aprovada', decididaEm: new Date().toISOString(), decididaPor: QUEM_DECIDE, justificativa }
      this.entregas = this.entregas.map((item) => (item.id === id ? decidida : item))
      // O lote rejeitado continua sendo o que a rota da correção mostra, agora decidido.
      for (const [atividadeId, lote] of this.correcoes) if (lote.entrega.id === id) this.correcoes.set(atividadeId, { ...lote, entrega: { ...lote.entrega, estado: decidida.estado }, podeAprovar: false })
      return { status: 200, corpo: decidida }
    }
    return {
      status: 200,
      corpo: {
        itens: [
          { id: MATERIAL, titulo: TITULO_DO_MATERIAL, disciplinaId: randomUUID(), titularidade: 'escola', licenciante: null, licenca: 'autoria_da_escola', estado: 'pronto', falha: null, paginas: 6, trechos: 6, enviadoEm: '2026-10-01T12:00:00.000Z' },
        ],
      },
    }
  }

  private async atender(route: Route): Promise<void> {
    const pedido = route.request()
    const url = new URL(pedido.url())
    const metodo = pedido.method()
    const achada = ROTAS.map((rota) => ({ ...rota, ids: rota.caminho.exec(url.pathname) })).find((rota) => rota.metodo === metodo && rota.ids !== null)
    if (achada === undefined || achada.ids === null) {
      // Rota destas telas que o teste não conhece: falha alto, em vez de bater numa API que ainda não a tem.
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(apiError(500, 'ERRO_INTERNO').corpo) })
      return
    }
    const corpo: unknown = metodo === 'GET' ? undefined : pedido.postDataJSON()
    if (metodo !== 'GET') this.pedidos.push({ metodo, caminho: url.pathname, corpo })
    const entrada = { corpo, url, ids: achada.ids.slice(1) }
    const resposta = await (this.trocadas.get(achada.rota)?.(entrada) ?? this.deSempre(achada.rota, entrada))
    if (resposta.pdf !== undefined) {
      await route.fulfill({ status: resposta.status, contentType: 'application/pdf', headers: { 'Content-Disposition': `attachment; filename="${resposta.pdf}"` }, body: '%PDF-1.7 sintetico' })
      return
    }
    await route.fulfill({ status: resposta.status, contentType: 'application/json', body: resposta.corpo === undefined ? '' : JSON.stringify(resposta.corpo) })
  }

  /** A resposta de sempre de uma rota, para o teste que troca a rota só por um tempo (segura e depois responde). */
  responder(rota: Rota, pedido: { corpo: unknown; url: URL; ids: readonly string[] }): Resposta {
    return this.deSempre(rota, pedido)
  }

  async ligar(page: Page): Promise<void> {
    await page.route(/\/v1\/(time|assistente|execucoes|ferramentas|artefatos|entregas|materiais|atividades-aplicadas|sinais|tutor\/uso)(\/|\?|$)/, (route) => this.atender(route))
    // Das turmas, só o desempenho é simulado: a turma aberta, o acesso e os pedidos são os da A1, de verdade.
    await page.route(/\/v1\/turmas\/[^/]+\/desempenho(\?|$)/, (route) => this.atender(route))
  }
}

/** Liga a API simulada na página, antes de a professora entrar: nenhuma tela chega a pedir a rota que ainda não existe. */
export async function mockAssistenteApi(page: Page): Promise<AssistenteApiMock> {
  const api = new AssistenteApiMock()
  await api.ligar(page)
  return api
}

const citacao = (pagina: number, trecho: string) => ({ materialId: MATERIAL, pagina, trecho })

/** Uma atividade objetiva sintética, com a página citada em cada questão. */
export function atividadeSintetica(turmaId: string, disciplinaId: string, campos: Partial<ArtefatoResponse> = {}): ArtefatoResponse {
  const titulo = campos.titulo ?? 'Atividade de estequiometria'
  return {
    id: randomUUID(),
    tipo: 'atividade_objetiva',
    titulo,
    turmaId,
    disciplinaId,
    origemId: null,
    adaptacao: null,
    entrega: null,
    criadoEm: '2026-10-05T13:00:00.000Z',
    conteudo: {
      tipo: 'atividade_objetiva',
      titulo,
      questoes: [
        {
          enunciado: 'Qual a massa de CO₂ formada na queima completa de 24 g de carbono?',
          alternativas: ['44 g', '88 g', '24 g', '12 g'],
          gabarito: 1,
          habilidade: { codigo: 'QUI.EM.04', descricao: 'Usar a proporção da equação balanceada para calcular massa, volume ou quantidade de matéria.' },
          citacao: citacao(142, 'Na combustão completa, cada mol de carbono forma um mol de dióxido de carbono.'),
          explicacao: '24 g de carbono são 2 mol, que formam 2 mol de CO₂, ou 88 g.',
        },
        {
          enunciado: 'Em uma reação com 2 mol de H₂ e 2 mol de O₂, qual é o reagente limitante?',
          alternativas: ['O oxigênio', 'A água', 'O hidrogênio', 'Nenhum dos dois'],
          gabarito: 2,
          habilidade: { codigo: 'QUI.EM.05', descricao: 'Identificar o reagente limitante e o reagente em excesso.' },
          citacao: citacao(145, 'O reagente limitante é o que acaba primeiro e determina quanto produto se forma.'),
          explicacao: 'São precisos 2 mol de H₂ para cada mol de O₂: o hidrogênio acaba primeiro.',
        },
      ],
    },
    versoesAdaptadas: [],
    aplicacoes: [],
    ...campos,
  }
}

/** A versão adaptada de uma atividade, com a entrega dela no estado dado. */
export function versaoAdaptada(origem: ArtefatoResponse, estado: Entrega['estado'] = 'pendente'): { artefato: ArtefatoResponse; entrega: Entrega } {
  const decidida = estado !== 'pendente'
  const decididaEm = decidida ? '2026-10-05T13:42:00.000Z' : null
  const entregaId = randomUUID()
  const artefato: ArtefatoResponse = {
    ...origem,
    id: randomUUID(),
    titulo: `${origem.titulo} (versão adaptada)`,
    origemId: origem.id,
    adaptacao: { tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 50 },
    entrega: { id: entregaId, estado, decididaEm },
    conteudo: origem.conteudo.tipo === 'atividade_objetiva' ? { ...origem.conteudo, titulo: `${origem.titulo} (versão adaptada)`, adaptacao: { tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 50 } } : origem.conteudo,
    versoesAdaptadas: [],
    aplicacoes: [],
  }
  const entrega: Entrega = {
    id: entregaId,
    tipo: 'versao_adaptada',
    funcao: 'adaptacao',
    estado,
    turmaId: origem.turmaId,
    // Como a API real: o título da entrega de adaptação é o da própria versão adaptada.
    titulo: artefato.titulo,
    artefatoId: artefato.id,
    atividadeAplicadaId: null,
    criadaEm: '2026-10-05T13:40:00.000Z',
    decididaEm,
    decididaPor: decidida ? QUEM_DECIDE : null,
    justificativa: estado === 'rejeitada' ? 'A questão 2 perdeu o enunciado.' : null,
  }
  return { artefato, entrega }
}

/** O resumo de um artefato, como ele aparece na lista de versões da origem. */
export function resumoDoArtefato({ conteudo: _conteudo, versoesAdaptadas: _versoes, aplicacoes: _aplicacoes, ...resumido }: ArtefatoResponse): ArtefatoResponse['versoesAdaptadas'][number] {
  return resumido
}

/** Uma mensagem da professora e a resposta do Assistente, como a conversa as devolve. */
export function mensagemDela(texto: string, turmaId: string, disciplinaId: string): MensagemDaConversa {
  return { id: randomUUID(), criadaEm: new Date().toISOString(), autor: 'usuario', tipo: 'texto', texto, turmaId, disciplinaId }
}

export function respostaComPagina(texto: string): Extract<MensagemDaConversa, { autor: 'agente'; tipo: 'texto' }> {
  return { id: randomUUID(), criadaEm: new Date().toISOString(), autor: 'agente', tipo: 'texto', texto, citacoes: [citacao(142, 'Na combustão completa, cada mol de carbono forma um mol de dióxido de carbono.')] }
}

export function propostaDeAtividade(turmaId: string, disciplinaId: string): Extract<MensagemDaConversa, { tipo: 'proposta_de_ferramenta' }> {
  return {
    id: randomUUID(),
    criadaEm: new Date().toISOString(),
    autor: 'agente',
    tipo: 'proposta_de_ferramenta',
    texto: 'Posso fazer isso com a ferramenta Atividade objetiva, ou só conversar.',
    proposta: { ferramenta: 'atividade_objetiva', parametros: { turmaId, disciplinaId, tema: 'Estequiometria', quantidade: 10 } },
  }
}

/** A entrega de um lote de correção, como o Seu time a recebe. */
export function entregaDoLote(lote: CorrecaoDoLoteResponse, turmaId: string): Entrega {
  return {
    id: lote.entrega.id,
    tipo: 'lote_de_correcao',
    funcao: 'correcao_de_objetiva',
    estado: lote.entrega.estado,
    turmaId,
    titulo: lote.titulo,
    artefatoId: null,
    atividadeAplicadaId: lote.atividadeAplicadaId,
    criadaEm: '2026-10-05T14:00:00.000Z',
    decididaEm: null,
    decididaPor: null,
    justificativa: null,
  }
}

const HABILIDADE_04 = { codigo: 'QUI.EM.04', descricao: 'Usar a proporção da equação balanceada para calcular massa, volume ou quantidade de matéria.' }
const HABILIDADE_05 = { codigo: 'QUI.EM.05', descricao: 'Identificar o reagente limitante e o reagente em excesso.' }

/** Os alunos sintéticos do lote: nomes inventados, de ninguém. */
export const ALUNOS_DO_LOTE = ['Ana Sintética', 'Bruno Sintético', 'Caio Sintético', 'Dora Sintética'].map((nome) => ({ alunoId: randomUUID(), nome }))

/**
 * O lote de correção de uma atividade de duas questões: 28 correções numa turma de 30, dois destaques fechados (um em
 * branco, um fora do histórico) e duas das outras correções. Só número e nome inventado.
 */
export function loteSintetico(aplicada: Pick<AtividadeAplicada, 'id' | 'titulo'>): CorrecaoDoLoteResponse {
  const [ana, bruno, caio, dora] = ALUNOS_DO_LOTE
  if (ana === undefined || bruno === undefined || caio === undefined || dora === undefined) throw new Error('faltou aluno sintético')
  return {
    atividadeAplicadaId: aplicada.id,
    titulo: aplicada.titulo,
    entrega: { id: randomUUID(), estado: 'pendente' },
    resumo: {
      alunosDaTurma: 30,
      corrigidos: 28,
      questoes: 2,
      mediaDeAcertos: 1.25,
      distribuicao: [
        { de: 0, ate: 0, alunos: 5 },
        { de: 1, ate: 1, alunos: 11 },
        { de: 2, ate: 2, alunos: 12 },
      ],
      porHabilidade: [
        { habilidade: HABILIDADE_04, acertos: 20, total: 28 },
        { habilidade: HABILIDADE_05, acertos: 15, total: 28 },
      ],
      porQuestao: [
        { numero: 1, habilidade: HABILIDADE_04, gabarito: 1, acertos: 20, porAlternativa: [3, 20, 2, 2], emBranco: 1 },
        { numero: 2, habilidade: HABILIDADE_05, gabarito: 2, acertos: 15, porAlternativa: [8, 2, 15, 2], emBranco: 1 },
      ],
    },
    destaques: [
      { ...ana, acertos: 0, total: 2, emBranco: 2, motivos: ['em_branco'], abertoEm: null },
      { ...bruno, acertos: 0, total: 2, emBranco: 0, motivos: ['fora_do_historico'], abertoEm: null },
    ],
    outras: [
      { ...caio, acertos: 2, total: 2, emBranco: 0 },
      { ...dora, acertos: 1, total: 2, emBranco: 0 },
    ],
    destaquesAbertos: 0,
    podeAprovar: false,
    validacao: null,
  }
}

/** O desempenho da turma depois de um lote aprovado: por habilidade e por aluno, em ordem de nome. */
export function desempenhoSintetico(turmaId: string): DesempenhoDaTurmaResponse {
  return {
    turmaId,
    lotesAprovados: 1,
    porHabilidade: [
      { habilidade: HABILIDADE_04, acertos: 20, total: 28, alunosAbaixoDaMetade: 8 },
      { habilidade: HABILIDADE_05, acertos: 15, total: 28, alunosAbaixoDaMetade: 0 },
    ],
    alunos: ALUNOS_DO_LOTE.map((aluno, indice) => ({
      alunoId: aluno.alunoId,
      nome: aluno.nome,
      acertos: indice === 3 ? 0 : indice % 3,
      total: indice === 3 ? 0 : 2,
      porHabilidade: indice === 3 ? [] : [{ habilidade: HABILIDADE_04, acertos: indice % 2, total: 1 }],
    })),
  }
}
