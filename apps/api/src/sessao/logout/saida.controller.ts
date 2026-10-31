import { requestIp, RequirePermissao, TrustedProxies } from '@educa/core'
import { Controller, Delete, HttpCode, HttpStatus, Req, Res } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { LogoutService } from './saida.service.js'

/** `DELETE /v1/sessao`: "Sair" em toda tela. Encerra a sessão na hora e apaga o cookie de renovação. */
@Controller('v1/sessao')
export class LogoutController {
  constructor(
    private readonly saida: LogoutService,
    private readonly proxies: TrustedProxies,
  ) {}

  @Delete()
  @RequirePermissao('sessao', 'encerrar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sair(@Req() requisicao: IncomingMessage, @Res({ passthrough: true }) resposta: ServerResponse): Promise<void> {
    const cookies = await this.saida.sair(await requestIp(requisicao, this.proxies))
    resposta.setHeader('Set-Cookie', [...cookies])
  }
}
