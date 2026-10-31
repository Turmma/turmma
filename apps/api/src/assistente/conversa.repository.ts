import { execucaoAgente, requireAnoEmCurso, requireEscolaId, mensagemAgente, requestSessao, threadAgente, type Database, type DatabaseTransaction } from '@educa/core'
import type { AutorDeMensagemDeAgente, ConteudoDaMensagemDoAgente } from '@educa/shared'
import { and, desc, eq, lt } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'

const AGENTE = 'assistente_de_ensino'

/** Uma linha de `mensagem_agente`, como o service a recebe: o `conteudo` ainda não foi validado. */
export interface MensagemGravada {
  readonly id: string
  readonly autor: AutorDeMensagemDeAgente
  readonly conteudo: unknown
  readonly turmaId: string | null
  readonly disciplinaId: string | null
  readonly criadaEm: Date
}

/** A pergunta que disparou uma execução: o texto, e a turma e a disciplina que o professor escolheu ao escrever. */
export interface PerguntaDaExecucao {
  readonly id: string
  readonly threadId: string
  readonly conteudo: unknown
  readonly turmaId: string
  readonly disciplinaId: string
}

/**
 * A conversa do professor com o Assistente de ensino (MVP, A2): a thread dele no ano em curso e as mensagens dela.
 *
 * **Só o dono lê** (regra 70, item 8). Escola, ano e dono vêm da sessão (regra 10, item 3), e toda leitura junta a
 * thread pelo `usuario_id` do contexto: a mensagem de outra pessoa, mesmo da mesma escola, não é achada por id nenhum.
 * Não existe método que leia a conversa de outro usuário, nem para a coordenação.
 *
 * O texto das mensagens nunca sai daqui para log, auditoria, execução ou consumo (regra 20, item 9).
 */
export class ConversaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  #dono() {
    return { escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), usuarioId: requestSessao().usuarioId }
  }

  /** A thread do professor do contexto com o Assistente, neste ano, se já existe. */
  async #thread(): Promise<string | undefined> {
    const { escolaId, anoLetivoId, usuarioId } = this.#dono()
    const [linha] = await this.banco
      .select({ id: threadAgente.id })
      .from(threadAgente)
      .where(and(eq(threadAgente.escolaId, escolaId), eq(threadAgente.anoLetivoId, anoLetivoId), eq(threadAgente.usuarioId, usuarioId), eq(threadAgente.agente, AGENTE)))
    return linha?.id
  }

  /**
   * A thread do professor, criada se ainda não existe. As duas primeiras mensagens ao mesmo tempo criam uma thread só:
   * o índice único decide (`on conflict do nothing`), e a segunda lê a que a primeira gravou (regra 80, item 7).
   */
  async garantirThread(): Promise<string> {
    await this.banco
      .insert(threadAgente)
      .values({ ...this.#dono(), agente: AGENTE })
      .onConflictDoNothing()
    const thread = await this.#thread()
    if (thread === undefined) throw new InvariantException('thread do Assistente não criada')
    return thread
  }

  /** A mensagem do professor, ligada à execução que ela disparou. Roda na transação que grava a execução. */
  async gravarDoUsuario(threadId: string, execucaoId: string, mensagem: { texto: string; turmaId: string; disciplinaId: string }): Promise<void> {
    const { escolaId, anoLetivoId } = this.#dono()
    await this.banco.insert(mensagemAgente).values({
      escolaId,
      anoLetivoId,
      threadId,
      execucaoId,
      autor: 'usuario',
      conteudo: { tipo: 'texto', texto: mensagem.texto },
      turmaId: mensagem.turmaId,
      disciplinaId: mensagem.disciplinaId,
    })
  }

  /** A resposta do Assistente, ligada à execução que a produziu. Roda na transação que conclui a execução. */
  async gravarDoAgente(threadId: string, execucaoId: string, conteudo: ConteudoDaMensagemDoAgente): Promise<string> {
    const { escolaId, anoLetivoId } = this.#dono()
    const [gravada] = await this.banco.insert(mensagemAgente).values({ escolaId, anoLetivoId, threadId, execucaoId, autor: 'agente', conteudo }).returning({ id: mensagemAgente.id })
    if (gravada === undefined) throw new InvariantException('mensagem do Assistente não gravada')
    return gravada.id
  }

  /**
   * A pergunta da execução desta chave de envio, **se foi o professor do contexto que a pediu** e a mensagem está na
   * thread dele. É o que a execução relê antes de rodar: o texto que vale é o gravado, e não o do corpo de um reenvio.
   */
  async perguntaDaChave(chaveEnvio: string): Promise<PerguntaDaExecucao | undefined> {
    const { escolaId, anoLetivoId, usuarioId } = this.#dono()
    const [linha] = await this.banco
      .select({ id: mensagemAgente.id, threadId: mensagemAgente.threadId, conteudo: mensagemAgente.conteudo, turmaId: mensagemAgente.turmaId, disciplinaId: mensagemAgente.disciplinaId })
      .from(execucaoAgente)
      .innerJoin(mensagemAgente, and(eq(mensagemAgente.escolaId, execucaoAgente.escolaId), eq(mensagemAgente.anoLetivoId, execucaoAgente.anoLetivoId), eq(mensagemAgente.execucaoId, execucaoAgente.id), eq(mensagemAgente.autor, 'usuario')))
      .innerJoin(threadAgente, and(eq(threadAgente.escolaId, mensagemAgente.escolaId), eq(threadAgente.anoLetivoId, mensagemAgente.anoLetivoId), eq(threadAgente.id, mensagemAgente.threadId)))
      .where(
        and(
          eq(execucaoAgente.escolaId, escolaId),
          eq(execucaoAgente.anoLetivoId, anoLetivoId),
          eq(execucaoAgente.chaveEnvio, chaveEnvio),
          eq(execucaoAgente.solicitadaPor, usuarioId),
          eq(threadAgente.usuarioId, usuarioId),
          eq(threadAgente.agente, AGENTE),
        ),
      )
    if (linha === undefined || linha.turmaId === null || linha.disciplinaId === null) return undefined
    return { id: linha.id, threadId: linha.threadId, conteudo: linha.conteudo, turmaId: linha.turmaId, disciplinaId: linha.disciplinaId }
  }

  /**
   * As mensagens da thread do professor do contexto anteriores a `antes` (ou as mais recentes, sem ele), **da mais nova
   * para a mais antiga**, até `limite`. O id é `uuidv7`, na ordem do tempo, e o índice `(escola_id, thread_id, id)`
   * serve a página (regra 80, item 8). Thread que ainda não existe é lista vazia.
   */
  async anteriores(antes: string | undefined, limite: number): Promise<MensagemGravada[]> {
    const { escolaId, anoLetivoId, usuarioId } = this.#dono()
    return this.banco
      .select({ id: mensagemAgente.id, autor: mensagemAgente.autor, conteudo: mensagemAgente.conteudo, turmaId: mensagemAgente.turmaId, disciplinaId: mensagemAgente.disciplinaId, criadaEm: mensagemAgente.criadaEm })
      .from(mensagemAgente)
      .innerJoin(threadAgente, and(eq(threadAgente.escolaId, mensagemAgente.escolaId), eq(threadAgente.anoLetivoId, mensagemAgente.anoLetivoId), eq(threadAgente.id, mensagemAgente.threadId)))
      .where(
        and(
          eq(mensagemAgente.escolaId, escolaId),
          eq(mensagemAgente.anoLetivoId, anoLetivoId),
          eq(threadAgente.usuarioId, usuarioId),
          eq(threadAgente.agente, AGENTE),
          antes === undefined ? undefined : lt(mensagemAgente.id, antes),
        ),
      )
      .orderBy(desc(mensagemAgente.id))
      .limit(limite)
  }
}
