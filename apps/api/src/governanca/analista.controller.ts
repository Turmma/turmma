import { RequirePermissao, ZodValidationPipe } from '@educa/nucleo'
import {
  analistaNominalQuerySchema,
  gerarResumoDoAnalistaRequestSchema,
  type AnalistaNominalQuery,
  type GerarResumoDoAnalistaRequest,
  type AnalistaNominalResponse,
  type ExecucaoAceitaResponse,
  type ResumoDoAnalistaResponse,
} from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Query } from '@nestjs/common'
import { AnalistaService } from './analista.service.js'

/**
 * `/v1/analista` (MVP, A5): o Analista de desempenho escolar, **só da coordenação**. O resumo é agregado por série e
 * disciplina; o nominal exige a turma e a finalidade (`ENTRADA_INVALIDA` sem uma delas, antes de procurar a turma) e
 * grava auditoria a cada leitura. As respostas não ficam em cache: o nominal nomeia professores.
 */
@Controller('v1/analista')
export class AnalistaController {
  constructor(private readonly analista: AnalistaService) {}

  @Get('resumo')
  @RequirePermissao('analista', 'ler_resumo')
  @Header('Cache-Control', 'no-store')
  resumo(): Promise<ResumoDoAnalistaResponse> {
    return this.analista.resumo()
  }

  @Post('gerar')
  @RequirePermissao('analista', 'gerar')
  @HttpCode(HttpStatus.ACCEPTED)
  gerar(@Body(new ZodValidationPipe(gerarResumoDoAnalistaRequestSchema)) pedido: GerarResumoDoAnalistaRequest): Promise<ExecucaoAceitaResponse> {
    return this.analista.gerar(pedido)
  }

  @Get('nominal')
  @RequirePermissao('analista', 'ler_nominal')
  @Header('Cache-Control', 'no-store')
  nominal(@Query(new ZodValidationPipe(analistaNominalQuerySchema)) consulta: AnalistaNominalQuery): Promise<AnalistaNominalResponse> {
    return this.analista.nominal(consulta)
  }
}
