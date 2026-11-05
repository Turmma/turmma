import { DomainException, GradeRepository, ImportacaoRepository, requireAnoEmCurso, requestSessao, type Database } from '@educa/core'
import { alcanceDe, ErrorCode, gradeResponseSchema, type GradeQuery, type GradeResponse } from '@educa/shared'

/**
 * A grade da turma para quem a lê (F2, 12.0; Tech Spec, seção 4; regra 60, item 8). A coordenação lê a de qualquer turma da escola: sem filtro, a do ano
 * em curso; com `anoLetivoId`, só a do ano `planejado` da escola da sessão. O professor lê a da turma em que tem vínculo `confirmado` (o alcance
 * `turma_vinculada` da matriz), no ano em curso; com filtro de ano, sem ano em curso, ou com o vínculo `pendente`, `contestado` ou `encerrado`, a
 * resposta é a do inexistente (regra 10, item 6), igual à da turma de outra escola.
 */
export class GradeService {
  constructor(private readonly banco: Database) {}

  async ler(consulta: GradeQuery): Promise<GradeResponse> {
    const grade = new GradeRepository(this.banco)
    const alcance = alcanceDe(requestSessao().papel, 'grade', 'ler')
    if (alcance === 'unidade') {
      const ano = await new ImportacaoRepository(this.banco).anoDeDestino(consulta.anoLetivoId)
      if (ano === undefined || !(await grade.turmaExiste(ano.id, consulta.turmaId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      return gradeResponseSchema.parse({ aulas: await grade.aulasDaTurma(ano.id, consulta.turmaId) })
    }
    if (alcance !== 'turma_vinculada' || consulta.anoLetivoId !== undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const anoEmCurso = requireAnoEmCurso()
    if (!(await grade.professorTemVinculoConfirmadoNaTurma(anoEmCurso, consulta.turmaId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return gradeResponseSchema.parse({ aulas: await grade.aulasDaTurma(anoEmCurso, consulta.turmaId) })
  }
}
