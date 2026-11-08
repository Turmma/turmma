import { Public, requestIp, TrustedProxies, ZodValidationPipe } from '@educa/core'
import { esqueciSenhaRequestSchema, redefinirSenhaRequestSchema, type EsqueciSenhaRequest, type RedefinirSenhaRequest } from '@educa/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import type { IncomingMessage } from 'node:http'
import { SenhaService } from './senha.service.js'

/**
 * `POST /v1/senha/esqueci` e `/redefinir` (acesso-e-convites, tarefa 5.0, RF12): a equipe que perdeu a senha pede o link e troca a senha. Anônimas, e por isso limitadas
 * pelo IP da rota anônima; o "esqueci" tem ainda o balde `rl:ip:senha` e o de 3 por hora por e-mail, que nunca respondem 429 (no service). O token vem no corpo, lido pela web do
 * fragmento do link, nunca na URL (regra 20, item 8), e as respostas saem com `no-store`. Sem corpo: o 202 é igual exista ou não a conta.
 */
@Public()
@Controller('v1/senha')
export class SenhaController {
  constructor(
    private readonly senha: SenhaService,
    private readonly proxies: TrustedProxies,
  ) {}

  @Post('esqueci')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', 'no-store')
  async esqueci(@Body(new ZodValidationPipe(esqueciSenhaRequestSchema)) pedido: EsqueciSenhaRequest, @Req() requisicao: IncomingMessage): Promise<void> {
    await this.senha.esqueci(pedido, await requestIp(requisicao, this.proxies))
  }

  @Post('redefinir')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async redefinir(@Body(new ZodValidationPipe(redefinirSenhaRequestSchema)) pedido: RedefinirSenhaRequest, @Req() requisicao: IncomingMessage): Promise<void> {
    await this.senha.redefinir(pedido, await requestIp(requisicao, this.proxies))
  }
}
