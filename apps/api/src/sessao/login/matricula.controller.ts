import { extractBearerToken, isOverIpLimit, requestIp, DowngradeRateLimit, TrustedProxies, Public, ZodValidationPipe } from '@educa/core'
import {
  loginMatriculaRequestSchema,
  loginMatriculaResponseSchema,
  loginResponseSchema,
  trocarSenhaProvisoriaRequestSchema,
  type LoginMatriculaRequest,
  type LoginMatriculaResponse,
  type LoginResponse,
  type TrocarSenhaProvisoriaRequest,
  type TrocasDaProvisoriaResponse,
} from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { LoginPorMatricula } from './matricula.service.js'
import { TrocaDaProvisoria } from './troca-da-provisoria.service.js'

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
  ): Promise<LoginMatriculaResponse> {
    const { resposta: corpoDaResposta, cookies } = await this.login.entrar(pedido, {
      ip: await requestIp(requisicao, this.proxies),
      cabecalhoCookie: requisicao.headers.cookie,
      acimaDoLimiteDoIp: isOverIpLimit(requisicao),
    })
    resposta.setHeader('Set-Cookie', [...cookies])
    return loginMatriculaResponseSchema.parse(corpoDaResposta)
  }
}

/**
 * `POST /v1/sessao/matricula/trocar-senha` e `GET /v1/sessao/matricula/trocas` (acesso-e-convites, tarefa 10.0, RF13): o aluno que entrou com a senha provisória cria a senha nova e vê as
 * provisórias de antes. Anônimas para a guarda de acesso: quem autoriza é o bilhete da troca, no `Authorization`, e o token de acesso não vale aqui; o bilhete nunca vai na URL. Como no
 * segundo fator, o token é lido no handler e o corpo fora do esquema dá o 400 antes do 401, sem gastar tentativa da conta. As duas respostas saem com `no-store`.
 */
@Public()
@Controller('v1/sessao/matricula')
export class TrocaDaProvisoriaController {
  constructor(
    private readonly troca: TrocaDaProvisoria,
    private readonly proxies: TrustedProxies,
  ) {}

  @Post('trocar-senha')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async trocar(
    @Body(new ZodValidationPipe(trocarSenhaProvisoriaRequestSchema)) pedido: TrocarSenhaProvisoriaRequest,
    @Req() requisicao: IncomingMessage,
    @Res({ passthrough: true }) resposta: ServerResponse,
  ): Promise<LoginResponse> {
    const { resposta: corpoDaResposta, cookies } = await this.troca.trocar(extractBearerToken(requisicao.headers.authorization), pedido.senha, {
      ip: await requestIp(requisicao, this.proxies),
      cabecalhoCookie: requisicao.headers.cookie,
    })
    resposta.setHeader('Set-Cookie', [...cookies])
    return loginResponseSchema.parse(corpoDaResposta)
  }

  @Get('trocas')
  @Header('Cache-Control', 'no-store')
  trocas(@Req() requisicao: IncomingMessage): Promise<TrocasDaProvisoriaResponse> {
    return this.troca.trocas(extractBearerToken(requisicao.headers.authorization))
  }
}
