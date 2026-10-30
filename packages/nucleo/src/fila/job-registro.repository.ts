import { InvariantException, type JobFailureCode, type JobState, type QueueName } from '@educa/shared'
import { and, eq, inArray, isNull, like, notInArray, sql, type SQL } from 'drizzle-orm'
import { currentContext } from '../contexto/contexto.js'
import type { Database, DatabaseTransaction } from '../db/banco.js'
import { jobRegistro } from '../db/schema/job-registro.js'

export const PREFIXO_TIPO_SISTEMA = 'sistema.'

/** Canal do `pg_notify` que acorda o despachante logo depois do commit de quem enfileirou. */
export const CANAL_NOTIFICACAO_JOB = 'job'

export interface NewJobRow {
  tipo: string
  fila: QueueName
  prioridade: number
  dados: Record<string, unknown>
  naoUrgente: boolean
}

export interface RegisteredJobState {
  estado: JobState
  criadoEm: Date
  iniciadoEm: Date | null
  concluidoEm: Date | null
  codigoFalha: JobFailureCode | null
}

/**
 * O que `inserirUmaVez` fez com a chave: gravou o job, ou a chave já tinha um job não finalizado na escola. Na colisão,
 * `id` é o desse job, ou nulo se ele terminou entre a colisão e a leitura; quem chama trata os dois como "já enfileirado".
 */
export type IdempotencyKeyResult = { situacao: 'enfileirado'; id: string } | { situacao: 'ja_enfileirado'; id: string | null }

/** Os estados de um job que terminou: fora deles, a chave de idempotência ainda está tomada (o predicado do único parcial). */
const ESTADOS_FINAIS: JobState[] = ['concluido', 'falhou']

/** Onde o job está antes de começar: a fila e a escola da linha persistida, que definem a vaga dele. */
export interface JobToRun {
  fila: QueueName
  escolaId: string | null
  /** `concluido` ou `falhou`: não roda de novo. */
  finalizado: boolean
}

export type JobStartResult =
  | { situacao: 'iniciado'; tipo: string; dados: Record<string, unknown> }
  /** O job existe na escola, mas não está em estado de executar (já terminou): não roda de novo. */
  | { situacao: 'nao_executavel' }
  /** Id inexistente e job de outra escola caem aqui, sem distinção (regra 10, item 6). */
  | { situacao: 'nao_encontrado' }

/** Estados de onde o worker pode começar (ou recomeçar, na retentativa e no stalled). */
const ORIGENS_DO_INICIO: JobState[] = ['reservado', 'publicado', 'ativo']
/** Estados de onde um job pode falhar de vez: o que já terminou não volta. */
const ORIGENS_DA_FALHA: JobState[] = ['reservado', 'publicado', 'ativo']

/**
 * `job_registro` com o escopo da escola do contexto em toda consulta (regra 10, item 3). A escola
 * nunca chega por argumento: vem do token na API, e do job persistido no worker.
 *
 * Rotina do sistema (`sistema.*`, sem escola) só é alcançada por um contexto marcado como
 * `rotinaDoSistema`, que nenhuma requisição HTTP tem; um contexto de escola nunca a vê. As
 * consultas da fila inteira, do despachante, ficam em `DispatchRepository`, com `@Unscoped`.
 */
export class JobOutboxRepository {
  constructor(private readonly banco: Database) {}

  /**
   * Grava o job na transação de quem pediu e avisa o despachante. O `pg_notify` só é entregue no
   * commit: se a transação desfizer, nem o job nem o aviso existem.
   */
  async inserir(tx: DatabaseTransaction, linha: NewJobRow): Promise<string> {
    const contexto = currentContext()
    const doSistema = linha.tipo.startsWith(PREFIXO_TIPO_SISTEMA)
    if (!doSistema && contexto?.escolaId === undefined) throw new InvariantException('job de escola sem escola no contexto')
    if (doSistema && (contexto?.rotinaDoSistema !== true || contexto.escolaId !== undefined)) {
      throw new InvariantException('job de sistema só nasce de rotina do sistema')
    }
    const [inserida] = await tx
      .insert(jobRegistro)
      .values({ ...linha, escolaId: contexto?.escolaId ?? null, requisicaoId: contexto?.requisicaoId ?? null })
      .returning({ id: jobRegistro.id })
    if (inserida === undefined) throw new InvariantException('insert em job_registro não devolveu linha')
    await tx.execute(sql`select pg_notify(${CANAL_NOTIFICACAO_JOB}, '')`)
    return inserida.id
  }

  /**
   * Grava o job uma vez só por escola, tipo e chave (F3, tarefa 3.0), na transação de quem pediu. O `on conflict` usa o
   * predicado do índice único parcial `job_registro_chave_idempotencia_unica`, `do nothing`: duas gravações da mesma
   * chave ao mesmo tempo dão um job, e a segunda espera a primeira confirmar e cai na colisão. Na colisão, lê o job da
   * chave que ainda não terminou, numa instrução nova, que já vê o que a outra transação confirmou.
   *
   * A chave só existe em job de escola: a escola vem do contexto, como em `inserir`, e o job de sistema é recusado (o
   * check `job_registro_chave_so_com_escola` também o recusa no banco). O `pg_notify` só sai quando a linha entrou.
   *
   * `depoisDaColisao` é só do teste: é a janela entre a colisão e a leitura, em que o job pode terminar.
   */
  async inserirUmaVez(tx: DatabaseTransaction, linha: NewJobRow, chaveIdempotencia: string, depoisDaColisao?: () => Promise<void>): Promise<IdempotencyKeyResult> {
    const contexto = currentContext()
    const escolaId = contexto?.escolaId
    if (escolaId === undefined || linha.tipo.startsWith(PREFIXO_TIPO_SISTEMA)) throw new InvariantException('chave de idempotência só em job de escola, com a escola no contexto')
    const [inserida] = await tx
      .insert(jobRegistro)
      .values({ ...linha, escolaId, requisicaoId: contexto?.requisicaoId ?? null, chaveIdempotencia })
      .onConflictDoNothing({
        target: [jobRegistro.escolaId, jobRegistro.tipo, jobRegistro.chaveIdempotencia],
        where: sql`chave_idempotencia is not null and estado not in ('concluido', 'falhou')`,
      })
      .returning({ id: jobRegistro.id })
    if (inserida !== undefined) {
      await tx.execute(sql`select pg_notify(${CANAL_NOTIFICACAO_JOB}, '')`)
      return { situacao: 'enfileirado', id: inserida.id }
    }
    if (depoisDaColisao !== undefined) await depoisDaColisao()
    const [existente] = await tx
      .select({ id: jobRegistro.id })
      .from(jobRegistro)
      .where(
        and(
          eq(jobRegistro.escolaId, escolaId),
          eq(jobRegistro.tipo, linha.tipo),
          eq(jobRegistro.chaveIdempotencia, chaveIdempotencia),
          notInArray(jobRegistro.estado, ESTADOS_FINAIS),
        ),
      )
    return { situacao: 'ja_enfileirado', id: existente?.id ?? null }
  }

  /** O job da escola do token, ou `undefined` (inexistente ou de outra escola, sem distinção). */
  async buscarDaEscola(id: string): Promise<RegisteredJobState | undefined> {
    const escolaId = currentContext()?.escolaId
    if (escolaId === undefined) throw new InvariantException('consulta de job sem escola no contexto')
    const [linha] = await this.banco
      .select({
        estado: jobRegistro.estado,
        criadoEm: jobRegistro.criadoEm,
        iniciadoEm: jobRegistro.iniciadoEm,
        concluidoEm: jobRegistro.concluidoEm,
        codigoFalha: jobRegistro.codigoFalha,
      })
      .from(jobRegistro)
      .where(and(eq(jobRegistro.id, id), eq(jobRegistro.escolaId, escolaId)))
    if (linha === undefined) return undefined
    return { ...linha, estado: linha.estado as JobState, codigoFalha: linha.codigoFalha as JobFailureCode | null }
  }

  /** A fila e a escola do job na escola do contexto, ou `undefined` (inexistente ou de outra escola, sem distinção). */
  async localizarParaExecucao(id: string): Promise<JobToRun | undefined> {
    const [linha] = await this.banco
      .select({ fila: jobRegistro.fila, escolaId: jobRegistro.escolaId, estado: jobRegistro.estado })
      .from(jobRegistro)
      .where(and(eq(jobRegistro.id, id), jobScopeInContext()))
    if (linha === undefined) return undefined
    return { fila: linha.fila as QueueName, escolaId: linha.escolaId, finalizado: linha.estado === 'concluido' || linha.estado === 'falhou' }
  }

  /**
   * Passa o job a `ativo` e devolve o que executar. A troca é condicional: um job que já concluiu
   * ou falhou não volta a `ativo` e não roda de novo, mesmo que a fila o entregue outra vez.
   */
  async iniciarExecucao(id: string): Promise<JobStartResult> {
    const escopo = jobScopeInContext()
    const [iniciada] = await this.banco
      .update(jobRegistro)
      .set({ estado: 'ativo', iniciadoEm: sql`coalesce(${jobRegistro.iniciadoEm}, now())` })
      .where(and(eq(jobRegistro.id, id), escopo, inArray(jobRegistro.estado, ORIGENS_DO_INICIO)))
      .returning({ tipo: jobRegistro.tipo, dados: jobRegistro.dados })
    if (iniciada !== undefined) return { situacao: 'iniciado', ...iniciada }
    const [existente] = await this.banco
      .select({ id: jobRegistro.id })
      .from(jobRegistro)
      .where(and(eq(jobRegistro.id, id), escopo))
    return existente === undefined ? { situacao: 'nao_encontrado' } : { situacao: 'nao_executavel' }
  }

  /** `ativo` → `concluido`. Devolve `false` se o job não estava ativo nesta escola. */
  async concluir(id: string): Promise<boolean> {
    const alteradas = await this.banco
      .update(jobRegistro)
      .set({ estado: 'concluido', concluidoEm: sql`now()`, reservadoAte: null })
      .where(and(eq(jobRegistro.id, id), jobScopeInContext(), eq(jobRegistro.estado, 'ativo')))
      .returning({ id: jobRegistro.id })
    return alteradas.length === 1
  }

  /**
   * Acorda o despachante porque uma vaga ficou livre, no mesmo canal do job novo. Sem isto, a escola no teto só
   * publica o próximo job na sondagem seguinte (até 500 ms por vaga): com cinco vagas e jobs de 100 ms, a fila
   * dela andaria a uns 10 jobs por segundo, e não a 50. Não lê nem grava linha: não tem escopo a aplicar.
   */
  async avisarVagaLivre(): Promise<void> {
    await this.banco.execute(sql`select pg_notify(${CANAL_NOTIFICACAO_JOB}, '')`)
  }

  /** Falha definitiva, com código tipado. Devolve `false` se o job já tinha terminado ou não é desta escola. */
  async registrarFalha(id: string, codigo: JobFailureCode): Promise<boolean> {
    const alteradas = await this.banco
      .update(jobRegistro)
      .set({ estado: 'falhou', codigoFalha: codigo, concluidoEm: sql`now()`, reservadoAte: null })
      .where(and(eq(jobRegistro.id, id), jobScopeInContext(), inArray(jobRegistro.estado, ORIGENS_DA_FALHA)))
      .returning({ id: jobRegistro.id })
    return alteradas.length === 1
  }
}

/**
 * Escopo de `job_registro` pelo contexto: a escola do contexto; rotina do sistema marcada, só os jobs
 * sem escola. Contexto sem escola e sem a marca (rota anônima) ou sem contexto nenhum falha fechado.
 */
export function jobScopeInContext(): SQL {
  const contexto = currentContext()
  if (contexto?.escolaId !== undefined) return eq(jobRegistro.escolaId, contexto.escolaId)
  if (contexto?.rotinaDoSistema === true) {
    return and(isNull(jobRegistro.escolaId), like(jobRegistro.tipo, `${PREFIXO_TIPO_SISTEMA}%`)) as SQL
  }
  throw new InvariantException('job_registro sem escola nem rotina do sistema no contexto não tem escopo')
}
