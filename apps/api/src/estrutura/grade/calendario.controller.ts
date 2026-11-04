import { RequirePermissao, ZodValidationPipe } from '@educa/core'
import { calendarioQuerySchema, type CalendarioQuery, type CalendarioResponse } from '@educa/shared'
import { Controller, Get, Query } from '@nestjs/common'
import { CalendarioService } from './calendario.service.js'

/**
 * O calendário do ano (F2, 5.0; Tech Spec, seção 4): `GET /v1/calendario`, da coordenação (com `anoLetivoId` do ano planejado) e do
 * professor com vínculo confirmado (só o ano em curso). A consulta passa pelo contrato estrito de `packages/shared`: campo a mais,
 * como `escolaId`, é `ENTRADA_INVALIDA`.
 */
@Controller('v1')
export class CalendarioController {
  constructor(private readonly calendario: CalendarioService) {}

  @Get('calendario')
  @RequirePermissao('calendario', 'ler')
  ler(@Query(new ZodValidationPipe(calendarioQuerySchema)) consulta: CalendarioQuery): Promise<CalendarioResponse> {
    return this.calendario.ler(consulta)
  }
}
