import { Public } from '@educa/core'
import type { SystemStatusResponse } from '@educa/shared'
import { Controller, Get, Header } from '@nestjs/common'
import { EstadoService } from './estado.service.js'

// A casca busca o estado antes de existir login: rota anônima, limitada por IP (regra 80, item 1).
@Public()
@Controller('v1/sistema/estado')
export class EstadoController {
  constructor(private readonly estado: EstadoService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  obter(): Promise<SystemStatusResponse> {
    return this.estado.obter()
  }
}
