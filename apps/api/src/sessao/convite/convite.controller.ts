import { Public, ZodValidationPipe } from '@educa/nucleo'
import {
  aceitarConviteRequestSchema,
  consultarConviteRequestSchema,
  aceitarConviteResponseSchema,
  consultarConviteResponseSchema,
  type AceitarConviteRequest,
  type ConsultarConviteRequest,
  type AceitarConviteResponse,
  type ConsultarConviteResponse,
} from '@educa/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ConviteService } from './convite.service.js'

/**
 * `POST /v1/convites/consultar` e `/aceitar`: o coordenador convidado abre o link. Anônimas, e por isso limitadas pelo
 * IP da rota anônima; o token vem sempre no corpo, nunca na URL (regra 20, item 8), e as respostas saem com
 * `no-store`. Nenhuma rota de escola cria convite: ele nasce só pelo operador, no `ops:convite-coordenador` ou no painel
 * da operação (`@RotaDeOperacao`, A0b) (RF1).
 */
@Public()
@Controller('v1/convites')
export class ConviteController {
  constructor(private readonly convites: ConviteService) {}

  @Post('consultar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async consultar(@Body(new ZodValidationPipe(consultarConviteRequestSchema)) pedido: ConsultarConviteRequest): Promise<ConsultarConviteResponse> {
    return consultarConviteResponseSchema.parse(await this.convites.consultar(pedido.token))
  }

  @Post('aceitar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async aceitar(@Body(new ZodValidationPipe(aceitarConviteRequestSchema)) pedido: AceitarConviteRequest): Promise<AceitarConviteResponse> {
    return aceitarConviteResponseSchema.parse(await this.convites.aceitar(pedido))
  }
}
