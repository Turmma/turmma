import { RequirePermissao } from '@educa/core'
import type { TimeResponse } from '@educa/shared'
import { Controller, Get, Header } from '@nestjs/common'
import { TimeService } from './time.service.js'

/** `GET /v1/time`: os agentes e as funções, com a suspensão da escola da sessão. Coordenação e professor (`time.ler`). */
@Controller('v1/time')
export class TimeController {
  constructor(private readonly time: TimeService) {}

  @Get()
  @RequirePermissao('time', 'ler')
  @Header('Cache-Control', 'no-store')
  ler(): Promise<TimeResponse> {
    return this.time.ler()
  }
}
