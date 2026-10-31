import { isOverIpLimit, requestIp, DowngradeRateLimit, TrustedProxies, Public, ZodValidationPipe } from '@educa/core'
import { loginMatriculaRequestSchema, loginResponseSchema, type LoginMatriculaRequest, type LoginResponse } from '@educa/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { LoginPorMatricula } from './matricula.service.js'

/**
 * `POST /v1/sessao/matricula`: o aluno entra pelo endereço da escola com matrícula e senha. Anônima; o limite por IP dela
 * (`@DowngradeRateLimit()`, 15.0) nunca recusa, só rebaixa a tentativa no semáforo; o que segura a senha errada é o
 * contador por escola e matrícula, no service.
 */
@Public()
@DowngradeRateLimit()
@Controller('v1/sessao')
export class LoginMatriculaController {
  constructor(
    private readonly login: LoginPorMatricula,
    private readonly proxies: TrustedProxies,
  ) {}

  @Post('matricula')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async entrar(
    @Body(new ZodValidationPipe(loginMatriculaRequestSchema)) pedido: LoginMatriculaRequest,
    @Req() requisicao: IncomingMessage,
    @Res({ passthrough: true }) resposta: ServerResponse,
  ): Promise<LoginResponse> {
    const { resposta: corpoDaResposta, cookies } = await this.login.entrar(pedido, {
      ip: await requestIp(requisicao, this.proxies),
      cabecalhoCookie: requisicao.headers.cookie,
      acimaDoLimiteDoIp: isOverIpLimit(requisicao),
    })
    resposta.setHeader('Set-Cookie', [...cookies])
    return loginResponseSchema.parse(corpoDaResposta)
  }
}
