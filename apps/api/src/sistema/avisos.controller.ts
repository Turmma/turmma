import { RotaAnonima } from '@educa/nucleo'
import { avisosResponseSchema, type Aviso, type AvisosResponse } from '@educa/shared'
import { Controller, Get, Header, Inject } from '@nestjs/common'

export const AVISOS_DO_SISTEMA = Symbol('AVISOS_DO_SISTEMA')

// Avisos públicos do sistema, lidos da configuração no boot: nada de escola, nada de pessoa.
@RotaAnonima()
@Controller('v1/sistema/avisos')
export class AvisosController {
  constructor(@Inject(AVISOS_DO_SISTEMA) private readonly avisos: readonly Aviso[]) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(): AvisosResponse {
    return avisosResponseSchema.parse({ itens: this.avisos })
  }
}
