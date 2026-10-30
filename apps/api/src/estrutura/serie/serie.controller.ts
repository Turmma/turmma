import { Permite, ZodValidationPipe } from '@educa/nucleo'
import { paginationQuerySchema, criarSerieRequestSchema, type PaginationQuery, type CriarSerieRequest, type ListaDeSeriesResponse, type SerieResponse } from '@educa/shared'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { SerieService } from './serie.service.js'

/** `/v1/series`: a coordenação cria e lista as séries da escola da sessão. */
@Controller('v1/series')
export class SerieController {
  constructor(private readonly series: SerieService) {}

  @Post()
  @Permite('serie', 'criar')
  criar(@Body(new ZodValidationPipe(criarSerieRequestSchema)) pedido: CriarSerieRequest): Promise<SerieResponse> {
    return this.series.criar(pedido)
  }

  @Get()
  @Permite('serie', 'ler')
  listar(@Query(new ZodValidationPipe(paginationQuerySchema)) consulta: PaginationQuery): Promise<ListaDeSeriesResponse> {
    return this.series.listar(consulta)
  }
}
