import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/core'
import {
  paginationQuerySchema,
  criarAnoLetivoRequestSchema,
  type PaginationQuery,
  type CriarAnoLetivoRequest,
  type AnoLetivoResponse,
  type ListaDeAnosLetivosResponse,
} from '@educa/shared'
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { AnoLetivoService } from './ano-letivo.service.js'

/** `/v1/anos-letivos`: a coordenação cria, lista, abre e encerra o ano letivo da escola da sessão. */
@Controller('v1/anos-letivos')
export class AnoLetivoController {
  constructor(private readonly anos: AnoLetivoService) {}

  @Post()
  @RequirePermissao('ano_letivo', 'criar')
  criar(@Body(new ZodValidationPipe(criarAnoLetivoRequestSchema)) pedido: CriarAnoLetivoRequest): Promise<AnoLetivoResponse> {
    return this.anos.criar(pedido)
  }

  @Get()
  @RequirePermissao('ano_letivo', 'ler')
  listar(@Query(new ZodValidationPipe(paginationQuerySchema)) consulta: PaginationQuery): Promise<ListaDeAnosLetivosResponse> {
    return this.anos.listar(consulta)
  }

  @Post(':id/abrir')
  @RequirePermissao('ano_letivo', 'abrir')
  @HttpCode(HttpStatus.OK)
  abrir(@Param('id', IdPipe) id: string): Promise<AnoLetivoResponse> {
    return this.anos.abrir(id)
  }

  @Post(':id/encerrar')
  @RequirePermissao('ano_letivo', 'encerrar')
  @HttpCode(HttpStatus.OK)
  encerrar(@Param('id', IdPipe) id: string): Promise<AnoLetivoResponse> {
    return this.anos.encerrar(id)
  }
}
