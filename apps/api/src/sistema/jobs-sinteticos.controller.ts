import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/core'
import {
  syntheticJobRequestSchema,
  type SyntheticJobRequest,
  type JobStateResponse,
  type JobAcceptedResponse,
} from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { JobsSinteticosService } from './jobs-sinteticos.service.js'

/**
 * Cria job sintético, para teste e cenário de carga. Só é registrado com `ROTAS_SINTETICAS=true`
 * (sistema.module.ts) e exige token, como toda rota sem `@Public()`.
 */
@Controller('v1/sistema/jobs-sinteticos')
export class JobsSinteticosController {
  constructor(private readonly jobs: JobsSinteticosService) {}

  @Post()
  @RequirePermissao('sistema_job_sintetico', 'criar')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', 'no-store')
  criar(@Body(new ZodValidationPipe(syntheticJobRequestSchema)) pedido: SyntheticJobRequest): Promise<JobAcceptedResponse> {
    return this.jobs.enfileirar(pedido)
  }
}

/** Consulta o estado de um job da escola do token, lido de `job_registro`. */
@Controller('v1/sistema/jobs-sinteticos')
export class JobsSinteticosConsultaController {
  constructor(private readonly jobs: JobsSinteticosService) {}

  @Get(':id')
  @RequirePermissao('sistema_job_sintetico', 'ler')
  @Header('Cache-Control', 'no-store')
  consultar(@Param('id', IdPipe) id: string): Promise<JobStateResponse> {
    return this.jobs.consultar(id)
  }
}
