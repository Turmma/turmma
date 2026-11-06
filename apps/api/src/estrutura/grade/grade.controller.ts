import { RequirePermissao, ZodValidationPipe } from '@educa/core'
import { gradeQuerySchema, type GradeQuery, type GradeResponse } from '@educa/shared'
import { Controller, Get, Query } from '@nestjs/common'
import { GradeService } from './grade.service.js'

/**
 * A grade de uma turma (F2, 12.0; Tech Spec, seção 4): `GET /v1/grade?turmaId=`, da coordenação (com `anoLetivoId` do ano planejado) e do
 * professor com vínculo confirmado na turma (só o ano em curso). A consulta passa pelo contrato estrito de `packages/shared`: campo a mais,
 * como `escolaId`, é `ENTRADA_INVALIDA`.
 */
@Controller('v1')
export class GradeController {
  constructor(private readonly grade: GradeService) {}

  @Get('grade')
  @RequirePermissao('grade', 'ler')
  ler(@Query(new ZodValidationPipe(gradeQuerySchema)) consulta: GradeQuery): Promise<GradeResponse> {
    return this.grade.ler(consulta)
  }
}
