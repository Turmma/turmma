import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/core'
import {
  pedidosDaTurmaQuerySchema,
  decidirReivindicacoesRequestSchema,
  type PedidosDaTurmaQuery,
  type DecidirReivindicacoesRequest,
  type DecisaoResponse,
  type PedidosDaTurmaResponse,
} from '@educa/shared'
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { DecisaoService } from './decisao.service.js'

/**
 * Os pedidos de reivindicação (A1, tarefa 8.0, RF12): o professor com vínculo confirmado na turma e a coordenação leem os
 * pendentes da turma e decidem os selecionados. A consulta e o corpo passam pelo contrato estrito de `packages/shared`
 * (campo a mais, como `escolaId`, é `ENTRADA_INVALIDA`); o id do caminho fora do formato de UUID responde como o
 * inexistente.
 */
@Controller('v1')
export class PedidosController {
  constructor(private readonly decisoes: DecisaoService) {}

  @Get('turmas/:id/reivindicacoes')
  @RequirePermissao('reivindicacao', 'ler')
  pedidos(@Param('id', IdPipe) turmaId: string, @Query(new ZodValidationPipe(pedidosDaTurmaQuerySchema)) consulta: PedidosDaTurmaQuery): Promise<PedidosDaTurmaResponse> {
    return this.decisoes.pedidos(turmaId, consulta)
  }

  @Post('reivindicacoes/decidir')
  @RequirePermissao('reivindicacao', 'decidir')
  @HttpCode(HttpStatus.OK)
  decidir(@Body(new ZodValidationPipe(decidirReivindicacoesRequestSchema)) pedido: DecidirReivindicacoesRequest): Promise<DecisaoResponse> {
    return this.decisoes.decidir(pedido)
  }
}
