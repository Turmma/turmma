import { isOverIpLimit, requestIp, DowngradeRateLimit, TrustedProxies, ZodValidationPipe } from '@educa/core'
import {
  aceitarConviteDeOperadorRequestSchema,
  consultarConviteDeOperadorRequestSchema,
  aceitarConviteDeOperadorResponseSchema,
  consultarConviteDeOperadorResponseSchema,
  type AceitarConviteDeOperadorRequest,
  type ConsultarConviteDeOperadorRequest,
  type AceitarConviteDeOperadorResponse,
  type ConsultarConviteDeOperadorResponse,
} from '@educa/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common'
import type { IncomingMessage } from 'node:http'
import { ConviteDeOperadorService } from './convite-operador.service.js'
import { EntradaDeOperacao } from '../decorators.js'

/**
 * `POST /v1/operacao/convite/consultar` e `/aceitar` (Tech Spec da A0, seção 4): quem recebeu o convite do
 * `ops:operador` abre o link. Rotas de entrada, sem sessão: as guardas da escola não leem credencial nenhuma aqui, e o
 * único que abre alguma coisa é o token do convite, no corpo, conferido pelo service contra o hash no banco.
 *
 * - `consultar`: limite por IP da operação (`rl:ip:op`, balde próprio, tarefa 9.0 da A0b), que recusa com 429.
 * - `aceitar`: `@DowngradeRateLimit`, como o login por senha: acima do mesmo limite por IP da operação, o aceite vai para
 *   o fim do balde no semáforo do hash, nunca 429 (Tech Spec da A0, seção 5, "Limite").
 *
 * As duas saem com `no-store`, e o contrato estrito recusa campo a mais na entrada e não deixa sair campo a mais (C39).
 * Nenhuma rota cria convite nem operador: eles nascem só pelo `ops:operador`.
 */
@Controller('v1/operacao/convite')
export class ConviteDeOperadorController {
  constructor(
    @Inject(ConviteDeOperadorService) private readonly convites: ConviteDeOperadorService,
    @Inject(TrustedProxies) private readonly proxies: TrustedProxies,
  ) {}

  @Post('consultar')
  @EntradaDeOperacao()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async consultar(@Body(new ZodValidationPipe(consultarConviteDeOperadorRequestSchema)) pedido: ConsultarConviteDeOperadorRequest): Promise<ConsultarConviteDeOperadorResponse> {
    return consultarConviteDeOperadorResponseSchema.parse(await this.convites.consultar(pedido.token))
  }

  @Post('aceitar')
  @EntradaDeOperacao()
  @DowngradeRateLimit()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async aceitar(
    @Body(new ZodValidationPipe(aceitarConviteDeOperadorRequestSchema)) pedido: AceitarConviteDeOperadorRequest,
    @Req() requisicao: IncomingMessage,
  ): Promise<AceitarConviteDeOperadorResponse> {
    const origem = { ip: await requestIp(requisicao, this.proxies), acimaDoLimiteDoIp: isOverIpLimit(requisicao) }
    return aceitarConviteDeOperadorResponseSchema.parse(await this.convites.aceitar(pedido, origem))
  }
}
