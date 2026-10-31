import { isOverIpLimit, requestIp, DowngradeRateLimit, TrustedProxies, Public, ZodValidationPipe } from '@educa/core'
import { loginEmailRequestSchema, loginResponseSchema, type LoginEmailRequest, type LoginResponse } from '@educa/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { LoginService } from './login.service.js'

/**
 * `POST /v1/sessao/email`: a equipe entra com e-mail e senha. Anônima; o limite por IP dela (`@DowngradeRateLimit()`, 15.0) nunca
 * recusa, só rebaixa a tentativa no semáforo; o que segura a senha errada é o contador por conta, no service.
 */
@Public()
@DowngradeRateLimit()
@Controller('v1/sessao')
export class LoginEmailController {
  constructor(
    private readonly login: LoginService,
    private readonly proxies: TrustedProxies,
  ) {}

  @Post('email')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async entrar(
    @Body(new ZodValidationPipe(loginEmailRequestSchema)) pedido: LoginEmailRequest,
    @Req() requisicao: IncomingMessage,
    @Res({ passthrough: true }) resposta: ServerResponse,
  ): Promise<LoginResponse> {
    const { resposta: corpoDaResposta, cookies } = await this.login.entrarPorEmail(pedido, {
      ip: await requestIp(requisicao, this.proxies),
      cabecalhoCookie: requisicao.headers.cookie,
      acimaDoLimiteDoIp: isOverIpLimit(requisicao),
    })
    resposta.setHeader('Set-Cookie', [...cookies])
    return loginResponseSchema.parse(corpoDaResposta)
  }
}
