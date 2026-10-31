import { requestIp, DowngradeRateLimit, TrustedProxies, ZodValidationPipe } from '@educa/core'
import {
  configurarSegundoFatorDeOperadorRequestSchema,
  segundoFatorDeOperadorRequestSchema,
  configurarSegundoFatorDeOperadorResponseSchema,
  segundoFatorDeOperadorResponseSchema,
  type ConfigurarSegundoFatorDeOperadorRequest,
  type SegundoFatorDeOperadorRequest,
  type ConfigurarSegundoFatorDeOperadorResponse,
  type SegundoFatorDeOperadorResponse,
} from '@educa/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { EntradaDeOperacao } from '../marcadores.js'
import { SegundoFatorDoOperadorService } from './segundo-fator.service.js'

/**
 * `POST /v1/operacao/sessao/mfa/configurar` e `POST /v1/operacao/sessao/mfa` (Tech Spec da A0, seção 4): o operador que
 * passou pela senha configura o app autenticador e entra com o código. Rotas de entrada, sem sessão: o desafio vem no
 * corpo, e quem o confere é o service. As duas saem com `no-store` (segredo, códigos, desafio e acesso), e o contrato
 * estrito recusa campo a mais na entrada e não deixa sair campo a mais (C39).
 *
 * Limite (seção 5, "Limite"):
 * - `mfa/configurar`: o limite por IP da operação (`rl:ip:op`, balde próprio, tarefa 9.0 da A0b), que recusa com 429
 *   (C32).
 * - `mfa`: quem recusa é o contador pelo `operador.id`, no service (C34), e nunca o IP: a equipe inteira pode sair por
 *   um IP só. Por isso leva `@DowngradeRateLimit`, que conta no mesmo `rl:ip:op` e nunca responde 429; sem hash aqui, o
 *   rebaixamento não tem efeito, e cada tentativa já exige um desafio novo, que só a senha dá.
 */
@Controller('v1/operacao/sessao')
export class SegundoFatorDoOperadorController {
  constructor(
    @Inject(SegundoFatorDoOperadorService) private readonly segundoFator: SegundoFatorDoOperadorService,
    @Inject(TrustedProxies) private readonly proxies: TrustedProxies,
  ) {}

  @Post('mfa/configurar')
  @EntradaDeOperacao()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async configurar(@Body(new ZodValidationPipe(configurarSegundoFatorDeOperadorRequestSchema)) pedido: ConfigurarSegundoFatorDeOperadorRequest): Promise<ConfigurarSegundoFatorDeOperadorResponse> {
    return configurarSegundoFatorDeOperadorResponseSchema.parse(await this.segundoFator.configurar(pedido))
  }

  @Post('mfa')
  @EntradaDeOperacao()
  @DowngradeRateLimit()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async entrar(
    @Body(new ZodValidationPipe(segundoFatorDeOperadorRequestSchema)) pedido: SegundoFatorDeOperadorRequest,
    @Req() requisicao: IncomingMessage,
    @Res({ passthrough: true }) resposta: ServerResponse,
  ): Promise<SegundoFatorDeOperadorResponse> {
    const aberta = await this.segundoFator.entrar(pedido, { cabecalhoCookie: requisicao.headers.cookie, ip: await requestIp(requisicao, this.proxies) })
    const corpoDaResposta = segundoFatorDeOperadorResponseSchema.parse(aberta.resposta)
    resposta.setHeader('Set-Cookie', [...aberta.cookies])
    return corpoDaResposta
  }
}
