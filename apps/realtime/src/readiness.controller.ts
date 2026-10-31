import { GracefulShutdown, Public } from '@educa/core'
import type { ReadinessResponse } from '@educa/shared'
import { Controller, Get, Header, Res } from '@nestjs/common'

interface RespostaHttp {
  status(codigo: number): unknown
}

/**
 * Sonda da borda. Só o estado da própria instância: não consulta o Redis, para uma lentidão dele
 * não tirar as duas instâncias do balanceamento ao mesmo tempo.
 */
@Public()
@Controller('prontidao')
export class ProntidaoController {
  constructor(private readonly drenagem: GracefulShutdown) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  obter(@Res({ passthrough: true }) resposta: RespostaHttp): ReadinessResponse {
    const { status, corpo } = this.drenagem.prontidao()
    resposta.status(status)
    return corpo
  }
}
