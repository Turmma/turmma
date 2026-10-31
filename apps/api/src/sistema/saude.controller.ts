import { Public } from '@educa/core'
import type { HealthResponse } from '@educa/shared'
import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common'
import { SaudeService } from './saude.service.js'

interface RespostaHttp {
  status(codigo: number): unknown
}

// A sonda do compose e do balanceador não tem token.
@Public()
@Controller('saude')
export class SaudeController {
  constructor(private readonly saude: SaudeService) {}

  /**
   * O corpo é sempre `{ ok }`, também no 503: é o contrato da sonda, e por isso não passa pelo
   * envelope de erro do filtro global.
   */
  @Get()
  @Header('Cache-Control', 'no-store')
  async obter(@Res({ passthrough: true }) resposta: RespostaHttp): Promise<HealthResponse> {
    const corpo = await this.saude.verificar()
    if (!corpo.ok) {
      resposta.status(HttpStatus.SERVICE_UNAVAILABLE)
    }
    return corpo
  }
}
