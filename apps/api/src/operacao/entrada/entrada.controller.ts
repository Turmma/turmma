import { acimaDoLimiteDoIp, ipDaRequisicao, LimiteQueRebaixa, ProxiesConfiaveis, ZodValidationPipe } from '@educa/nucleo'
import { entradaDeOperadorRequestSchema, entradaDeOperadorResponseSchema, type EntradaDeOperadorRequest, type EntradaDeOperadorResponse } from '@educa/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common'
import type { IncomingMessage } from 'node:http'
import { EntradaDoOperadorService } from './entrada.service.js'
import { EntradaDeOperacao } from '../marcadores.js'

/**
 * `POST /v1/operacao/sessao/email` (Tech Spec da A0, seção 4): o operador entra com e-mail e senha e recebe o desafio
 * do segundo fator. Rota de entrada, sem sessão, com `@LimiteQueRebaixa`: acima do limite por IP da operação
 * (`rl:ip:op`, balde próprio, tarefa 9.0 da A0b), a tentativa vai para o fim do balde no semáforo do hash, nunca 429;
 * quem recusa é o contador por conta, no service (C33). Sai com `no-store`, e o contrato estrito recusa campo a mais na
 * entrada e não deixa sair campo a mais.
 */
@Controller('v1/operacao/sessao')
export class EntradaDoOperadorController {
  constructor(
    @Inject(EntradaDoOperadorService) private readonly entrada: EntradaDoOperadorService,
    @Inject(ProxiesConfiaveis) private readonly proxies: ProxiesConfiaveis,
  ) {}

  @Post('email')
  @EntradaDeOperacao()
  @LimiteQueRebaixa()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async entrar(@Body(new ZodValidationPipe(entradaDeOperadorRequestSchema)) pedido: EntradaDeOperadorRequest, @Req() requisicao: IncomingMessage): Promise<EntradaDeOperadorResponse> {
    const origem = { ip: await ipDaRequisicao(requisicao, this.proxies), cabecalhoCookie: requisicao.headers.cookie, acimaDoLimiteDoIp: acimaDoLimiteDoIp(requisicao) }
    return entradaDeOperadorResponseSchema.parse(await this.entrada.entrar(pedido, origem))
  }
}
