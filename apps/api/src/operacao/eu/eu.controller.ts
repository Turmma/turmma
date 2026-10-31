import type { EuDoOperadorResponse } from '@educa/shared'
import { Controller, Get, Header, Inject } from '@nestjs/common'
import { EuDoOperadorService } from './eu.service.js'
import { RotaDeOperacao } from '../decorators.js'

/** `GET /v1/operacao/eu`: quem é o operador da sessão, com o apelido e o nome (Tech Spec da A0, seção 4). */
@Controller('v1/operacao/eu')
export class EuDoOperadorController {
  constructor(@Inject(EuDoOperadorService) private readonly eu: EuDoOperadorService) {}

  @Get()
  @RotaDeOperacao()
  @Header('Cache-Control', 'no-store')
  obter(): Promise<EuDoOperadorResponse> {
    return this.eu.obter()
  }
}
