import {
  execucaoAgente,
  requireAnoEmCurso,
  requireEscolaId,
  EXECUCAO_INTERROMPIDA,
  mensagemAgente,
  mensagemTutor,
  Unscoped,
  threadAgente,
  type Database,
  type CodigoDeFalhaDaExecucao,
  type ExecucaoAgendada,
  type ExecucaoRepository as ExecucaoRepositoryPort,
  type DatabaseTransaction,
} from '@educa/nucleo'
import { resultadoGravadoSchema, FUNCAO_DA_TAREFA_DE_IA, type ErrorCode, type ExecucaoInput, type EstadoDeExecucao, type ResultadoGravado, type TarefaDeIa } from '@educa/shared'
import { and, eq, lt, or, sql } from 'drizzle-orm'
import { exigirUsuarioDoContexto } from './contexto-da-execucao.js'

/**
 * A porta `ExecucaoRepository` do `AgenteExecutor`, sobre `execucao_agente`. O executor roda **fora de
 * requisição**, sem sessão: a escola de cada método é a da própria execução agendada, que nasceu do contexto de quem
 * pediu (`ExecucaoAgendada.escolaId`), e entra em toda cláusula (regra 10, item 3). Nenhum método recebe escola do
 * cliente.
 *
 * As passagens de estado são um `update` condicional, numa instrução só: duas instâncias, ou duas chamadas com a
 * mesma chave, não rodam a mesma execução (regra 80, item 7).
 */
export class ExecucaoRepository implements ExecucaoRepositoryPort {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  async marcarRodando(execucao: ExecucaoAgendada): Promise<boolean> {
    const marcadas = await this.banco
      .update(execucaoAgente)
      .set({ estado: 'rodando', iniciadaEm: sql`now()` })
      .where(and(eq(execucaoAgente.escolaId, execucao.escolaId), eq(execucaoAgente.id, execucao.id), eq(execucaoAgente.estado, 'pendente')))
      .returning({ id: execucaoAgente.id })
    return marcadas.length > 0
  }

  async marcarConcluida(execucao: ExecucaoAgendada, resultado: unknown): Promise<void> {
    await this.concluirRodando(execucao, resultadoGravadoSchema.parse(resultado))
  }

  /**
   * `rodando` → `concluida`, com a referência ao que a execução gravou, e diz se concluiu. `false` é a execução que já
   * não estava `rodando`: o prazo ou a varredura a encerraram antes, e quem produziu desfaz a própria transação.
   */
  async concluirRodando(execucao: ExecucaoAgendada, resultado: ResultadoGravado): Promise<boolean> {
    const concluidas = await this.banco
      .update(execucaoAgente)
      .set({ estado: 'concluida', resultado, concluidaEm: sql`now()` })
      .where(and(eq(execucaoAgente.escolaId, execucao.escolaId), eq(execucaoAgente.id, execucao.id), eq(execucaoAgente.estado, 'rodando')))
      .returning({ id: execucaoAgente.id })
    return concluidas.length > 0
  }

  async marcarFalhou(execucao: ExecucaoAgendada, codigo: CodigoDeFalhaDaExecucao): Promise<void> {
    await this.banco
      .update(execucaoAgente)
      .set({ estado: 'falhou', erro: codigo, concluidaEm: sql`now()` })
      .where(and(eq(execucaoAgente.escolaId, execucao.escolaId), eq(execucaoAgente.id, execucao.id), eq(execucaoAgente.estado, 'rodando')))
  }

  @Unscoped('varredura da subida da API: encerra a execução que o processo caído deixou pendente ou rodando, em qualquer escola; grava só estado, código e data, e não lê conteúdo nem pessoa')
  async falharInterrompidas(antesDe: Date): Promise<number> {
    const encerradas = await this.banco
      .update(execucaoAgente)
      .set({ estado: 'falhou', erro: EXECUCAO_INTERROMPIDA, concluidaEm: sql`now()` })
      .where(or(and(eq(execucaoAgente.estado, 'rodando'), lt(execucaoAgente.iniciadaEm, antesDe)), and(eq(execucaoAgente.estado, 'pendente'), lt(execucaoAgente.criadaEm, antesDe))))
      .returning({ id: execucaoAgente.id })
    return encerradas.length
  }
}

export interface ExecucaoDeQuemPediu {
  readonly id: string
  readonly tarefa: TarefaDeIa
  readonly estado: EstadoDeExecucao
  readonly resultado: ResultadoGravado | null
  readonly erro: ErrorCode | null
}

export interface MensagemGravada {
  readonly id: string
  readonly criadaEm: Date
}

/**
 * As execuções da **pessoa da sessão**, na escola dela: quem grava é quem pede, e quem lê é quem pediu. Escola, ano
 * letivo e pessoa vêm do contexto (regra 10, item 3); nenhum método os recebe.
 */
export class ExecucaoDaSessaoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Grava a execução `pendente`, de quem está na sessão, e devolve o id. Com a chave de envio já usada na escola,
   * não grava e devolve `undefined`: o índice único decide, sem "verifica e depois grava" (regra 80, item 7).
   */
  async gravarPendente(tarefa: TarefaDeIa, chaveEnvio: string, entrada: ExecucaoInput): Promise<string | undefined> {
    const [gravada] = await this.banco
      .insert(execucaoAgente)
      .values({
        escolaId: requireEscolaId(),
        anoLetivoId: requireAnoEmCurso(),
        funcao: FUNCAO_DA_TAREFA_DE_IA[tarefa],
        tarefa,
        solicitadaPor: exigirUsuarioDoContexto(),
        chaveEnvio,
        entrada,
      })
      .onConflictDoNothing({ target: [execucaoAgente.escolaId, execucaoAgente.chaveEnvio] })
      .returning({ id: execucaoAgente.id })
    return gravada?.id
  }

  /**
   * A execução desta chave, **se foi esta pessoa que pediu, no ano letivo em curso**. A chave de outra pessoa da escola
   * não é achada, nem a de um ano anterior: a execução é do ano em que foi pedida (regra 10, item 2).
   */
  async daChave(chaveEnvio: string): Promise<{ id: string; tarefa: TarefaDeIa } | undefined> {
    const [linha] = await this.banco
      .select({ id: execucaoAgente.id, tarefa: execucaoAgente.tarefa })
      .from(execucaoAgente)
      .where(
        and(
          eq(execucaoAgente.escolaId, requireEscolaId()),
          eq(execucaoAgente.anoLetivoId, requireAnoEmCurso()),
          eq(execucaoAgente.chaveEnvio, chaveEnvio),
          eq(execucaoAgente.solicitadaPor, exigirUsuarioDoContexto()),
        ),
      )
    return linha
  }

  /**
   * A execução com esse id que esta pessoa pediu, no ano letivo em curso. A de outra pessoa, mesmo da mesma escola, a
   * de outra escola e a de outro ano letivo não são achadas.
   */
  async deQuemPediu(id: string): Promise<ExecucaoDeQuemPediu | undefined> {
    const [linha] = await this.banco
      .select({ id: execucaoAgente.id, tarefa: execucaoAgente.tarefa, estado: execucaoAgente.estado, resultado: execucaoAgente.resultado, erro: execucaoAgente.erro })
      .from(execucaoAgente)
      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.anoLetivoId, requireAnoEmCurso()), eq(execucaoAgente.id, id), eq(execucaoAgente.solicitadaPor, exigirUsuarioDoContexto())))
    return linha
  }

  /** A resposta do Assistente com esse id, na conversa desta pessoa: a thread é dela, e a mensagem é do agente. */
  async mensagemDoAssistente(id: string): Promise<(MensagemGravada & { conteudo: unknown }) | undefined> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({ id: mensagemAgente.id, criadaEm: mensagemAgente.criadaEm, conteudo: mensagemAgente.conteudo })
      .from(mensagemAgente)
      .innerJoin(threadAgente, and(eq(threadAgente.escolaId, mensagemAgente.escolaId), eq(threadAgente.anoLetivoId, mensagemAgente.anoLetivoId), eq(threadAgente.id, mensagemAgente.threadId)))
      .where(and(eq(mensagemAgente.escolaId, escolaId), eq(mensagemAgente.id, id), eq(mensagemAgente.autor, 'agente'), eq(threadAgente.usuarioId, exigirUsuarioDoContexto())))
    return linha
  }

  /** A resposta do Tutor com esse id, na conversa deste aluno. */
  async mensagemDoTutor(id: string): Promise<(MensagemGravada & { tipo: string; texto: string; citacoes: unknown }) | undefined> {
    const [linha] = await this.banco
      .select({ id: mensagemTutor.id, criadaEm: mensagemTutor.criadaEm, tipo: mensagemTutor.tipo, texto: mensagemTutor.texto, citacoes: mensagemTutor.citacoes })
      .from(mensagemTutor)
      .where(and(eq(mensagemTutor.escolaId, requireEscolaId()), eq(mensagemTutor.id, id), eq(mensagemTutor.autor, 'tutor'), eq(mensagemTutor.alunoId, exigirUsuarioDoContexto())))
    return linha
  }
}
