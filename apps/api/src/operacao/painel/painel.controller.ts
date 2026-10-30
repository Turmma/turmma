import { IdPipe, ZodValidationPipe } from '@educa/nucleo'
import {
  painelQuerySchema,
  conviteDaCoordenacaoRequestSchema,
  criarEscolaRequestSchema,
  criarRedeRequestSchema,
  operadorEmptyBodyRequestSchema,
  type PainelQuery,
  type ConviteDaCoordenacaoRequest,
  type CriarEscolaRequest,
  type CriarRedeRequest,
  type OperadorEmptyBodyRequest,
  type ConviteDaCoordenacaoResponse,
  type CriadoNoPainelResponse,
  type EscolasDoPainelResponse,
  type RedesDoPainelResponse,
  type UsoDoPainelResponse,
} from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Inject, Param, Post, Query } from '@nestjs/common'
import { RotaDeOperacao } from '../marcadores.js'
import { PainelService } from './painel.service.js'

/** Refazer e revogar não têm campo: sem corpo (o Express 5 deixa `req.body` indefinido), ou `{}`. Qualquer campo é `ENTRADA_INVALIDA`. */
const esquemaSemCorpo = operadorEmptyBodyRequestSchema.default({})

/**
 * O painel da operação na API (Tech Spec da A0b, seção 4), as oito rotas: `GET /v1/operacao/redes`, `POST /v1/operacao/redes`,
 * `GET /v1/operacao/escolas`, `POST /v1/operacao/escolas`, `GET /v1/operacao/uso`,
 * `POST /v1/operacao/escolas/:id/convite-coordenacao`, `POST /v1/operacao/convites/:id/refazer` e
 * `POST /v1/operacao/convites/:id/revogar`.
 * Todas `@RotaDeOperacao` (a `GuardaDeOperador` e o limite `rl:op:{sub}`), com `no-store`, e o corpo pelo contrato estrito
 * de `packages/shared`: campo a mais, como `autor`, é `ENTRADA_INVALIDA` antes de qualquer leitura ou escrita; na lista e
 * no uso, a consulta (`pagina`, `ordem`) também é estrita. O `:id` fora do formato de UUID responde como o inexistente
 * (`NAO_ENCONTRADO`). A entrada passa pelo `ZodValidationPipe` e pelo `IdPipe` no parâmetro (16.0).
 */
@Controller('v1/operacao')
export class PainelController {
  constructor(@Inject(PainelService) private readonly painel: PainelService) {}

  @Get('redes')
  @RotaDeOperacao()
  @Header('Cache-Control', 'no-store')
  redes(): Promise<RedesDoPainelResponse> {
    return this.painel.redes()
  }

  @Get('escolas')
  @RotaDeOperacao()
  @Header('Cache-Control', 'no-store')
  escolas(@Query(new ZodValidationPipe(painelQuerySchema)) consulta: PainelQuery): Promise<EscolasDoPainelResponse> {
    return this.painel.escolas(consulta)
  }

  @Get('uso')
  @RotaDeOperacao()
  @Header('Cache-Control', 'no-store')
  uso(@Query(new ZodValidationPipe(painelQuerySchema)) consulta: PainelQuery): Promise<UsoDoPainelResponse> {
    return this.painel.uso(consulta)
  }

  @Post('redes')
  @RotaDeOperacao()
  @Header('Cache-Control', 'no-store')
  criarRede(@Body(new ZodValidationPipe(criarRedeRequestSchema)) pedido: CriarRedeRequest): Promise<CriadoNoPainelResponse> {
    return this.painel.criarRede(pedido)
  }

  @Post('escolas')
  @RotaDeOperacao()
  @Header('Cache-Control', 'no-store')
  criarEscola(@Body(new ZodValidationPipe(criarEscolaRequestSchema)) pedido: CriarEscolaRequest): Promise<CriadoNoPainelResponse> {
    return this.painel.criarEscola(pedido)
  }

  @Post('escolas/:id/convite-coordenacao')
  @RotaDeOperacao()
  @Header('Cache-Control', 'no-store')
  gerarConvite(
    @Param('id', IdPipe) escolaId: string,
    @Body(new ZodValidationPipe(conviteDaCoordenacaoRequestSchema)) pedido: ConviteDaCoordenacaoRequest,
  ): Promise<ConviteDaCoordenacaoResponse> {
    return this.painel.gerarConvite(escolaId, pedido)
  }

  @Post('convites/:id/refazer')
  @RotaDeOperacao()
  @Header('Cache-Control', 'no-store')
  refazerConvite(@Param('id', IdPipe) conviteId: string, @Body(new ZodValidationPipe(esquemaSemCorpo)) _corpo: OperadorEmptyBodyRequest): Promise<ConviteDaCoordenacaoResponse> {
    return this.painel.refazerConvite(conviteId)
  }

  @Post('convites/:id/revogar')
  @RotaDeOperacao()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  revogarConvite(@Param('id', IdPipe) conviteId: string, @Body(new ZodValidationPipe(esquemaSemCorpo)) _corpo: OperadorEmptyBodyRequest): Promise<void> {
    return this.painel.revogarConvite(conviteId)
  }
}
