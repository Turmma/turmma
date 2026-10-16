import { ErroDeDominio, Permite } from '@educa/nucleo'
import { CodigoDeErro, esquemaConcluirIntroducao, type RespostaEu, type RespostaIntroducao } from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { EuService } from './eu.service.js'

/**
 * `GET /v1/eu`: quem está na sessão, com o nome e a escola, os minutos sem uso até ela vencer e a data em que viu a
 * introdução. `POST /v1/eu/introducao`: a pessoa marca que a viu; o corpo é vazio, e a data vem do servidor.
 */
@Controller('v1/eu')
export class EuController {
  constructor(private readonly eu: EuService) {}

  @Get()
  @Permite('eu', 'ler')
  @Header('Cache-Control', 'no-store')
  obter(): Promise<RespostaEu> {
    return this.eu.obter()
  }

  @Post('introducao')
  @Permite('eu', 'concluir_introducao')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  concluirIntroducao(@Body() corpo: unknown): Promise<RespostaIntroducao> {
    if (!esquemaConcluirIntroducao.safeParse(corpo ?? {}).success) throw new ErroDeDominio(CodigoDeErro.ENTRADA_INVALIDA)
    return this.eu.concluirIntroducao()
  }
}
