import type { EuDoOperadorResponse } from '@educa/shared'
import { Controller, Get, Header, Inject } from '@nestjs/common'
import { OperadorMeService } from './eu.service.js'
import { OperacaoRoute } from '../decorators.js'

/** `GET /v1/operacao/eu`: quem é o operador da sessão, com o apelido e o nome (Tech Spec da A0, seção 4). */
@Controller('v1/operacao/eu')
export class OperadorMeController {
  constructor(@Inject(OperadorMeService) private readonly eu: OperadorMeService) {}

  @Get()
  @OperacaoRoute()
  @Header('Cache-Control', 'no-store')
  obter(): Promise<EuDoOperadorResponse> {
    return this.eu.obter()
  }
}
