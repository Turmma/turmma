import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/nucleo'
import {
  paginationQuerySchema,
  vinculosQuerySchema,
  contestarVinculoRequestSchema,
  criarVinculoRequestSchema,
  encerrarVinculoRequestSchema,
  type PaginationQuery,
  type VinculosQuery,
  type ContestarVinculoRequest,
  type CriarVinculoRequest,
  type EncerrarVinculoRequest,
  type ListaDeVinculosResponse,
  type MeusVinculosResponse,
  type VinculoResponse,
  type VinculoDaCoordenacaoResponse,
} from '@educa/shared'
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { VinculoService } from './vinculo.service.js'

/**
 * `/v1/vinculos`: a coordenação cria, lista e encerra; o professor dono confirma ou contesta o próprio (RF3, RF4). Id
 * fora do formato, de outra escola, de outro professor ou inexistente: o mesmo `NAO_ENCONTRADO`.
 */
@Controller('v1/vinculos')
export class VinculoController {
  constructor(private readonly vinculos: VinculoService) {}

  @Post()
  @RequirePermissao('vinculo', 'criar')
  criar(@Body(new ZodValidationPipe(criarVinculoRequestSchema)) pedido: CriarVinculoRequest): Promise<VinculoDaCoordenacaoResponse> {
    return this.vinculos.criar(pedido)
  }

  @Get()
  @RequirePermissao('vinculo', 'ler')
  listar(@Query(new ZodValidationPipe(vinculosQuerySchema)) consulta: VinculosQuery): Promise<ListaDeVinculosResponse> {
    return this.vinculos.listar(consulta)
  }

  @Post(':id/encerrar')
  @RequirePermissao('vinculo', 'encerrar')
  @HttpCode(HttpStatus.OK)
  encerrar(@Param('id', IdPipe) id: string, @Body(new ZodValidationPipe(encerrarVinculoRequestSchema)) pedido: EncerrarVinculoRequest): Promise<VinculoDaCoordenacaoResponse> {
    return this.vinculos.encerrar(id, pedido)
  }

  @Post(':id/confirmar')
  @RequirePermissao('vinculo', 'confirmar')
  @HttpCode(HttpStatus.OK)
  confirmar(@Param('id', IdPipe) id: string): Promise<VinculoResponse> {
    return this.vinculos.confirmar(id)
  }

  @Post(':id/contestar')
  @RequirePermissao('vinculo', 'contestar')
  @HttpCode(HttpStatus.OK)
  contestar(@Param('id', IdPipe) id: string, @Body(new ZodValidationPipe(contestarVinculoRequestSchema)) pedido: ContestarVinculoRequest): Promise<VinculoResponse> {
    return this.vinculos.contestar(id, pedido)
  }
}

/** `GET /v1/meus-vinculos`: os vínculos do professor da sessão no ano em curso, para confirmar ou contestar. */
@Controller('v1/meus-vinculos')
export class MeusVinculosController {
  constructor(private readonly vinculos: VinculoService) {}

  @Get()
  @RequirePermissao('vinculo', 'ler_proprios')
  listar(@Query(new ZodValidationPipe(paginationQuerySchema)) consulta: PaginationQuery): Promise<MeusVinculosResponse> {
    return this.vinculos.meus(consulta)
  }
}
