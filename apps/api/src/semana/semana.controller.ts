import { RequirePermissao, ZodValidationPipe } from '@educa/core'
import { semanaQuerySchema, type SemanaQuery, type SemanaResponse } from '@educa/shared'
import { Controller, Get, Query } from '@nestjs/common'
import { SemanaService } from './semana.service.js'

/**
 * A Semana da professora (F2b, tarefa 2.0): `GET /v1/semana?segunda=`. Só o professor (`aula.ler`, alcance `proprio`); coordenação, rede e aluno
 * têm `nunca` na matriz. A consulta passa pelo contrato estrito de `packages/shared`: `segunda` que não é segunda e campo a mais são
 * `ENTRADA_INVALIDA`.
 */
@Controller('v1')
export class SemanaController {
  constructor(private readonly semana: SemanaService) {}

  @Get('semana')
  @RequirePermissao('aula', 'ler')
  ler(@Query(new ZodValidationPipe(semanaQuerySchema)) consulta: SemanaQuery): Promise<SemanaResponse> {
    return this.semana.ler(consulta)
  }
}
