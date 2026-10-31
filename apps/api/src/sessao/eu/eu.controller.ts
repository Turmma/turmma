import { RequirePermissao, ZodValidationPipe } from '@educa/core'
import { emptyOrMissingBodyRequestSchema, type EmptyBodyRequest, type EuResponse, type IntroducaoResponse } from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { MeService } from './eu.service.js'

/**
 * `GET /v1/eu`: quem está na sessão, com o nome e a escola, os minutos sem uso até ela vencer e a data em que viu a
 * introdução. `POST /v1/eu/introducao`: a pessoa marca que a viu; o corpo é vazio, e a data vem do servidor.
 */
@Controller('v1/eu')
export class MeController {
  constructor(private readonly eu: MeService) {}

  @Get()
  @RequirePermissao('eu', 'ler')
  @Header('Cache-Control', 'no-store')
  obter(): Promise<EuResponse> {
    return this.eu.obter()
  }

  @Post('introducao')
  @RequirePermissao('eu', 'concluir_introducao')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  concluirIntroducao(@Body(new ZodValidationPipe(emptyOrMissingBodyRequestSchema)) _corpo: EmptyBodyRequest): Promise<IntroducaoResponse> {
    return this.eu.concluirIntroducao()
  }
}
