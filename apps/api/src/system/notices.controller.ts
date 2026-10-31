import { Public } from '@educa/core'
import { avisosResponseSchema, type Aviso, type AvisosResponse } from '@educa/shared'
import { Controller, Get, Header, Inject } from '@nestjs/common'

export const SYSTEM_NOTICES = Symbol('SYSTEM_NOTICES')

// Avisos públicos do sistema, lidos da configuração no boot: nada de escola, nada de pessoa.
@Public()
@Controller('v1/sistema/avisos')
export class NoticesController {
  constructor(@Inject(SYSTEM_NOTICES) private readonly avisos: readonly Aviso[]) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(): AvisosResponse {
    return avisosResponseSchema.parse({ itens: this.avisos })
  }
}
