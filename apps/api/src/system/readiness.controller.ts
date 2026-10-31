import { GracefulShutdown, Public, SkipRateLimit } from '@educa/core'
import type { ReadinessResponse } from '@educa/shared'
import { Controller, Get, Header, Res } from '@nestjs/common'

interface RespostaHttp {
  status(codigo: number): unknown
}

/**
 * Sonda da borda. Responde só o estado da própria instância, sem consultar banco nem Redis: se
 * consultasse, um Postgres lento tiraria as duas instâncias do balanceamento ao mesmo tempo, e o
 * Caddy trocaria o 503 tipado da API por um 502 dele. A borda não expõe esta rota ao cliente, e
 * ela fica fora do rate limit: um 429 na sonda tiraria as duas instâncias do balanceamento.
 */
@Public()
@SkipRateLimit()
@Controller('prontidao')
export class ReadinessController {
  constructor(private readonly drenagem: GracefulShutdown) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  obter(@Res({ passthrough: true }) resposta: RespostaHttp): ReadinessResponse {
    const { status, corpo } = this.drenagem.prontidao()
    resposta.status(status)
    return corpo
  }
}
