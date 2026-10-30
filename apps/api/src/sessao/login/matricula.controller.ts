import { acimaDoLimiteDoIp, ipDaRequisicao, LimiteQueRebaixa, ProxiesConfiaveis, RotaAnonima, ZodValidationPipe } from '@educa/nucleo'
import { loginMatriculaRequestSchema, loginResponseSchema, type LoginMatriculaRequest, type LoginResponse } from '@educa/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { LoginPorMatricula } from './matricula.service.js'

/**
 * `POST /v1/sessao/matricula`: o aluno entra pelo endereço da escola com matrícula e senha. Anônima; o limite por IP dela
 * (`@LimiteQueRebaixa()`, 15.0) nunca recusa, só rebaixa a tentativa no semáforo; o que segura a senha errada é o
 * contador por escola e matrícula, no service.
 */
@RotaAnonima()
@LimiteQueRebaixa()
@Controller('v1/sessao')
export class LoginMatriculaController {
  constructor(
    private readonly login: LoginPorMatricula,
    private readonly proxies: ProxiesConfiaveis,
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
      ip: await ipDaRequisicao(requisicao, this.proxies),
      cabecalhoCookie: requisicao.headers.cookie,
      acimaDoLimiteDoIp: acimaDoLimiteDoIp(requisicao),
    })
    resposta.setHeader('Set-Cookie', [...cookies])
    return loginResponseSchema.parse(corpoDaResposta)
  }
}
