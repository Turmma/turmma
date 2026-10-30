import { escola, requireAnoEmCurso, requireEscolaId, serie, requestSessao, turma, vinculo, type Database, type DatabaseTransaction } from '@educa/nucleo'
import type { MinhaTurmaResponse } from '@educa/shared'
import { and, desc, eq } from 'drizzle-orm'

/**
 * A turma do aluno da sessão (A1, tarefa 8.0, RF13; Tech Spec da A1, seção 6): pelo vínculo de aluno `confirmado` dele,
 * na escola e no ano em curso do contexto. Escola, ano e usuário vêm do contexto que a `SessaoGuard` gravou, nunca de
 * argumento (regra 10, item 3); sem ano em curso, `requireAnoEmCurso` falha fechado com `NAO_ENCONTRADO`. As FKs compostas
 * do vínculo prendem a turma à escola e ao ano dele.
 *
 * Só a escola, a turma e a série: nada de colega, professor ou matrícula (regra 20, item 4). Nada daqui vai a log.
 */
export class MinhaTurmaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * A turma do vínculo de aluno confirmado do usuário do contexto no ano em curso, ou `undefined`. Com mais de um (a
   * transferência de turma chega no F2), a do vínculo mais novo.
   */
  async daSessao(): Promise<MinhaTurmaResponse | undefined> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({ escolaNome: escola.nome, turmaId: turma.id, turmaNome: turma.nome, serieId: serie.id, etapa: serie.etapa, ano: serie.ano })
      .from(vinculo)
      .innerJoin(turma, and(eq(turma.escolaId, vinculo.escolaId), eq(turma.anoLetivoId, vinculo.anoLetivoId), eq(turma.id, vinculo.turmaId)))
      .innerJoin(serie, and(eq(serie.escolaId, turma.escolaId), eq(serie.id, turma.serieId)))
      .innerJoin(escola, eq(escola.id, vinculo.escolaId))
      .where(
        and(
          eq(vinculo.escolaId, escolaId),
          eq(vinculo.anoLetivoId, requireAnoEmCurso()),
          eq(vinculo.usuarioId, requestSessao().usuarioId),
          eq(vinculo.estado, 'confirmado'),
        ),
      )
      .orderBy(desc(vinculo.id))
      .limit(1)
    if (linha === undefined) return undefined
    return { escola: { nome: linha.escolaNome }, turma: { id: linha.turmaId, nome: linha.turmaNome }, serie: { id: linha.serieId, etapa: linha.etapa, ano: linha.ano } }
  }
}
