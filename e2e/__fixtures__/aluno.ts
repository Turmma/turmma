import { randomUUID } from 'node:crypto'
import type { Page, Route } from '@playwright/test'
import type { MensagemDoTutor, MensagemDoTutorAoAluno, MinhaAtividade, ConversaDoTutorResponse, ExecucaoResponse, MemoriaDoTutorResponse, MeuDiagnosticoResponse, ProvaResponse } from '../../packages/shared/src/index.ts'
import { erroDaApi, portao, type PedidoRegistrado } from './assistente.ts'

export { erroDaApi, portao }

/**
 * A API das telas do aluno (A3 e A4), **simulada na página** (`page.route`): as atividades dele, a prova, as respostas,
 * o envio, o diagnóstico, a conversa com o Tutor e as execuções. É contra o contrato (`docs/mvp-contratos.md`) que estas
 * respostas são escritas, e é com ela que o teste põe a tela em cada estado. A sessão, o `/v1/eu` e a turma continuam
 * vindo da API de verdade. O fluxo inteiro, contra a API real, está em `aluno-fluxo.spec.ts`.
 */

interface Resposta {
  readonly status: number
  readonly corpo?: unknown
}

type Rota = 'atividades' | 'prova' | 'responder' | 'enviar' | 'diagnostico' | 'conversa' | 'mensagens' | 'memoria' | 'execucao'

const ROTAS: readonly { readonly rota: Rota; readonly metodo: string; readonly caminho: RegExp }[] = [
  { rota: 'atividades', metodo: 'GET', caminho: /^\/v1\/minhas-atividades$/ },
  { rota: 'prova', metodo: 'GET', caminho: /^\/v1\/atividades-aplicadas\/([^/]+)\/prova$/ },
  { rota: 'responder', metodo: 'PUT', caminho: /^\/v1\/atividades-aplicadas\/([^/]+)\/respostas\/([^/]+)$/ },
  { rota: 'enviar', metodo: 'POST', caminho: /^\/v1\/atividades-aplicadas\/([^/]+)\/enviar$/ },
  { rota: 'diagnostico', metodo: 'GET', caminho: /^\/v1\/atividades-aplicadas\/([^/]+)\/meu-diagnostico$/ },
  { rota: 'conversa', metodo: 'GET', caminho: /^\/v1\/tutor\/conversa$/ },
  { rota: 'mensagens', metodo: 'POST', caminho: /^\/v1\/tutor\/mensagens$/ },
  { rota: 'memoria', metodo: 'GET', caminho: /^\/v1\/tutor\/memoria$/ },
  { rota: 'execucao', metodo: 'GET', caminho: /^\/v1\/execucoes\/([^/]+)$/ },
]

interface Entrada {
  readonly corpo: unknown
  readonly url: URL
  readonly ids: readonly string[]
}

export const MATERIAL = randomUUID()
/** A professora que aprova, nas respostas simuladas: nome inventado, de ninguém. */
export const QUEM_APROVA = 'Camila Souza sintética'

function campo(corpo: unknown, nome: string): unknown {
  return typeof corpo === 'object' && corpo !== null && nome in corpo ? (corpo as Record<string, unknown>)[nome] : undefined
}

export class ApiDoAluno {
  atividades: MinhaAtividade[] = []
  readonly provas = new Map<string, ProvaResponse>()
  readonly diagnosticos = new Map<string, MeuDiagnosticoResponse>()
  readonly conversas = new Map<string, MensagemDoTutor[]>()
  /** A página anterior da conversa de cada atividade: com ela, a primeira leitura diz que há mensagens antes (`anterior`). */
  readonly conversasAnteriores = new Map<string, MensagemDoTutor[]>()
  tutor: Pick<ConversaDoTutorResponse, 'estado' | 'uso' | 'avaliacaoAberta'> = { estado: 'ligado', uso: { hoje: 12, limiteDoDia: 60 }, avaliacaoAberta: null }
  readonly execucoes = new Map<string, ExecucaoResponse>()
  /**
   * O que o Tutor sabe do trabalho do aluno (`GET /v1/tutor/memoria`). Sem ela, a API responde como responde ao aluno sem turma
   * no ano: `NAO_ENCONTRADO`. Nenhuma tela do aluno lê isso ainda: Eu o tratará como "sem resultado" e não como erro quando a 7.0
   * ligar a leitura (telas do aluno e primeiro acesso, Tech Spec seção 9).
   */
  memoria: MemoriaDoTutorResponse | null = null
  /** Todo `PUT` e `POST` que a tela mandou, na ordem. */
  readonly pedidos: PedidoRegistrado[] = []
  private readonly trocadas = new Map<Rota, (entrada: Entrada) => Resposta | Promise<Resposta>>()

  /** Troca a resposta de uma rota: o erro, a resposta segurada. Sem função, volta a de sempre. */
  trocar(rota: Rota, resposta?: (entrada: Entrada) => Resposta | Promise<Resposta>): void {
    if (resposta === undefined) this.trocadas.delete(rota)
    else this.trocadas.set(rota, resposta)
  }

  pedidosEm(caminho: RegExp): PedidoRegistrado[] {
    return this.pedidos.filter((pedido) => caminho.test(pedido.caminho))
  }

  ultimaExecucao(): string {
    const id = [...this.execucoes.keys()].at(-1)
    if (id === undefined) throw new Error('a tela ainda não pediu nenhuma execução')
    return id
  }

  /** O Tutor respondeu: a execução conclui, a resposta entra na conversa e a troca conta no uso do dia. */
  responderNoTutor(atividadeAplicadaId: string, mensagem: MensagemDoTutorAoAluno): void {
    const id = this.ultimaExecucao()
    const atual = this.execucoes.get(id)
    if (atual === undefined) throw new Error('execução desconhecida')
    this.execucoes.set(id, { ...atual, estado: 'concluida', resultado: { tipo: 'mensagem_do_tutor', mensagem }, erro: null })
    this.conversas.set(atividadeAplicadaId, [...(this.conversas.get(atividadeAplicadaId) ?? []), mensagem])
    if (mensagem.tipo === 'texto') this.tutor = { ...this.tutor, uso: { ...this.tutor.uso, hoje: this.tutor.uso.hoje + 1 } }
  }

  falharNoTutor(erro: NonNullable<ExecucaoResponse['erro']>): void {
    const id = this.ultimaExecucao()
    const atual = this.execucoes.get(id)
    if (atual === undefined) throw new Error('execução desconhecida')
    this.execucoes.set(id, { ...atual, estado: 'falhou', resultado: null, erro })
  }

  /** O 202 de uma pergunta ao Tutor: a pergunta entra na conversa, e a execução nasce pendente. */
  aceitarPergunta(corpo: unknown): Resposta {
    const atividadeAplicadaId = String(campo(corpo, 'atividadeAplicadaId'))
    const pergunta: MensagemDoTutor = { id: randomUUID(), criadaEm: new Date().toISOString(), autor: 'aluno', tipo: 'texto', texto: String(campo(corpo, 'texto')) }
    this.conversas.set(atividadeAplicadaId, [...(this.conversas.get(atividadeAplicadaId) ?? []), pergunta])
    const id = randomUUID()
    this.execucoes.set(id, { id, tarefa: 'turno_do_tutor', estado: 'pendente', resultado: null, erro: null })
    return { status: 202, corpo: { execucaoId: id } }
  }

  private deSempre(rota: Rota, { corpo, url, ids }: Entrada): Resposta {
    const id = ids[0] ?? ''
    if (rota === 'atividades') return { status: 200, corpo: { itens: this.atividades } }
    if (rota === 'execucao') {
      const execucao = this.execucoes.get(id)
      return execucao === undefined ? erroDaApi(404, 'NAO_ENCONTRADO') : { status: 200, corpo: execucao }
    }
    if (rota === 'memoria') return this.memoria === null ? erroDaApi(404, 'NAO_ENCONTRADO') : { status: 200, corpo: this.memoria }
    if (rota === 'conversa') {
      // Sem `atividadeAplicadaId` a resposta é o estado do Tutor e nenhuma mensagem: é o que a API devolve a quem pergunta o estado sem abrir conversa. Nenhuma tela do aluno faz essa leitura hoje (Tech Spec 7c e 12b, item 4).
      const atividade = url.searchParams.get('atividadeAplicadaId') ?? ''
      const anteriores = this.conversasAnteriores.get(atividade) ?? []
      const recentes = this.conversas.get(atividade) ?? []
      // Como a API: `?antes=` devolve a página anterior; a primeira leitura aponta para ela pelo id da mensagem mais antiga.
      if (url.searchParams.has('antes')) return { status: 200, corpo: { ...this.tutor, mensagens: anteriores } }
      const primeira = recentes[0]
      return { status: 200, corpo: { ...this.tutor, mensagens: recentes, ...(anteriores.length > 0 && primeira !== undefined ? { anterior: primeira.id } : {}) } }
    }
    if (rota === 'mensagens') {
      // Como a API: em avaliação e no limite a pergunta comum é recusada, sem gravar nada.
      if (this.tutor.estado === 'avaliacao') return erroDaApi(409, 'TUTOR_PAUSADO_EM_AVALIACAO')
      if (this.tutor.estado === 'limite') return erroDaApi(429, 'LIMITE_DIARIO_DO_TUTOR')
      return this.aceitarPergunta(corpo)
    }
    if (rota === 'diagnostico') {
      const diagnostico = this.diagnosticos.get(id)
      return diagnostico === undefined ? erroDaApi(404, 'NAO_ENCONTRADO') : { status: 200, corpo: diagnostico }
    }
    const prova = this.provas.get(id)
    if (prova === undefined) return erroDaApi(404, 'NAO_ENCONTRADO')
    if (rota === 'prova') return { status: 200, corpo: prova }
    if (prova.enviadaEm !== null || prova.estado === 'encerrada') return erroDaApi(409, 'ATIVIDADE_ENCERRADA')
    if (rota === 'enviar') {
      const enviadaEm = new Date().toISOString()
      this.provas.set(id, { ...prova, enviadaEm })
      this.atividades = this.atividades.map((atividade) => (atividade.id === id ? { ...atividade, situacao: 'enviada', enviadaEm, respondidas: prova.respostas.length } : atividade))
      return { status: 200, corpo: { enviadaEm, respondidas: prova.respostas.length, questoes: prova.questoes.length } }
    }
    const questao = Number(ids[1])
    const alternativa = Number(campo(corpo, 'alternativa'))
    const sequencia = Number(campo(corpo, 'sequencia'))
    // Como a API: só a `sequencia` maior troca a gravada, e quem perde recebe a que ficou (RF21).
    const gravada = prova.respostas.find((resposta) => resposta.questao === questao)
    if (gravada !== undefined && gravada.sequencia >= sequencia) return { status: 200, corpo: { ...gravada, respondidaEm: new Date().toISOString() } }
    this.provas.set(id, { ...prova, respostas: [...prova.respostas.filter((resposta) => resposta.questao !== questao), { questao, alternativa, sequencia }] })
    return { status: 200, corpo: { questao, alternativa, sequencia, respondidaEm: new Date().toISOString() } }
  }

  /** A resposta de sempre de uma rota, para o teste que troca a rota só por um tempo (segura e depois responde). */
  responder(rota: Rota, entrada: Entrada): Resposta {
    return this.deSempre(rota, entrada)
  }

  private async atender(route: Route): Promise<void> {
    const pedido = route.request()
    const url = new URL(pedido.url())
    const metodo = pedido.method()
    const achada = ROTAS.map((rota) => ({ ...rota, ids: rota.caminho.exec(url.pathname) })).find((rota) => rota.metodo === metodo && rota.ids !== null)
    if (achada === undefined || achada.ids === null) {
      // Rota destas telas que o teste não conhece: falha alto.
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(erroDaApi(500, 'ERRO_INTERNO').corpo) })
      return
    }
    const corpo: unknown = metodo === 'GET' ? undefined : pedido.postDataJSON()
    if (metodo !== 'GET') this.pedidos.push({ metodo, caminho: url.pathname, corpo })
    const entrada = { corpo, url, ids: achada.ids.slice(1) }
    const resposta = await (this.trocadas.get(achada.rota)?.(entrada) ?? this.deSempre(achada.rota, entrada))
    await route.fulfill({ status: resposta.status, contentType: 'application/json', body: resposta.corpo === undefined ? '' : JSON.stringify(resposta.corpo) })
  }

  async ligar(page: Page): Promise<void> {
    await page.route(/\/v1\/(minhas-atividades|atividades-aplicadas|tutor|execucoes)(\/|\?|$)/, (route) => this.atender(route))
  }
}

/** Liga a API simulada na página, antes de o aluno entrar. */
export async function simularAluno(page: Page): Promise<ApiDoAluno> {
  const api = new ApiDoAluno()
  await api.ligar(page)
  return api
}

/** Uma atividade na lista do aluno. */
export function minhaAtividade(campos: Partial<MinhaAtividade> = {}): MinhaAtividade {
  return {
    id: randomUUID(),
    titulo: 'Lista de estequiometria',
    disciplina: { id: randomUUID(), nome: 'Química' },
    avaliativa: false,
    situacao: 'para_fazer',
    questoes: 3,
    respondidas: 0,
    aplicadaEm: '2026-10-05T13:00:00.000Z',
    enviadaEm: null,
    ...campos,
  }
}

export const QUESTOES_SINTETICAS: ProvaResponse['questoes'] = [
  { numero: 1, enunciado: 'Qual é a massa molar da água, H₂O?', alternativas: ['16 g/mol', '18 g/mol', '20 g/mol', '34 g/mol'] },
  { numero: 2, enunciado: 'Na reação N₂ + 3 H₂ → 2 NH₃, quantos mols de amônia se formam a partir de 6 mol de H₂?', alternativas: ['2 mol', '3 mol', '4 mol', '6 mol'] },
  { numero: 3, enunciado: 'Em uma reação química, o que é o reagente limitante?', alternativas: ['O que acaba primeiro', 'O que sobra no fim', 'O produto em maior quantidade', 'O de maior massa molar'] },
]

/** A prova de uma atividade da lista, como o aluno a recebe: sem gabarito. */
export function provaDa(atividade: MinhaAtividade, campos: Partial<ProvaResponse> = {}): ProvaResponse {
  return { atividadeAplicadaId: atividade.id, titulo: atividade.titulo, avaliativa: atividade.avaliativa, estado: 'aberta', adaptacao: null, questoes: QUESTOES_SINTETICAS, respostas: [], enviadaEm: atividade.enviadaEm, ...campos }
}

/** O diagnóstico aprovado da prova sintética: acertou as questões 1 e 3, e a 2 ficou para rever. */
export function diagnosticoDa(atividade: MinhaAtividade): MeuDiagnosticoResponse {
  const citacao = (pagina: number) => ({ materialId: MATERIAL, pagina, trecho: `Trecho sintético da página ${String(pagina)}.` })
  return {
    atividadeAplicadaId: atividade.id,
    titulo: atividade.titulo,
    acertos: 2,
    total: 3,
    porHabilidade: [
      { habilidade: { codigo: 'QUI.EM.05', descricao: 'Calcular a massa molar de uma substância' }, acertos: 1, total: 1 },
      { habilidade: { codigo: 'QUI.EM.06', descricao: 'Aplicar a proporção em mols da equação balanceada' }, acertos: 1, total: 2 },
    ],
    questoes: [
      { numero: 1, alternativa: 1, gabarito: 1, correta: true, explicacao: 'Dois hidrogênios e um oxigênio somam 18.', citacao: citacao(2) },
      { numero: 2, alternativa: 0, gabarito: 2, correta: false, explicacao: 'A proporção é de 3 para 2.', citacao: citacao(3) },
      { numero: 3, alternativa: 0, gabarito: 0, correta: true, explicacao: 'É a definição da página 4.', citacao: citacao(4) },
    ],
    aprovadoPor: { nome: QUEM_APROVA },
    aprovadoEm: '2026-10-05T14:00:00.000Z',
  }
}

export function perguntaDoAluno(texto: string): MensagemDoTutor {
  return { id: randomUUID(), criadaEm: new Date().toISOString(), autor: 'aluno', tipo: 'texto', texto }
}

/** Uma resposta socrática do Tutor, com a página citada. */
export function respostaDoTutor(texto: string, pagina = 142): Extract<MensagemDoTutorAoAluno, { tipo: 'texto' }> {
  return { id: randomUUID(), criadaEm: new Date().toISOString(), autor: 'tutor', tipo: 'texto', texto, citacoes: [{ materialId: MATERIAL, pagina, trecho: 'Para passar de massa para quantidade de matéria, divida a massa pela massa molar.' }] }
}

/** A mensagem fixa de assunto delicado, como a API a manda (D36). */
export const MENSAGEM_FIXA = [
  'Obrigado por me contar. Isso é importante, e eu sou uma inteligência artificial: não sou quem pode ajudar você nisso.',
  'Procure hoje seu professor ou a orientação educacional da escola. Eles podem ajudar de verdade.',
  'Se você estiver em perigo ou pensando em se machucar, ligue 188 (CVV). A ligação é gratuita e funciona a qualquer hora.',
].join('\n\n')

export function encaminhamento(texto = MENSAGEM_FIXA): Extract<MensagemDoTutorAoAluno, { tipo: 'assunto_delicado' }> {
  return { id: randomUUID(), criadaEm: new Date().toISOString(), autor: 'tutor', tipo: 'assunto_delicado', texto }
}
