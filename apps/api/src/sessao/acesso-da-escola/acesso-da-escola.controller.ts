import { RotaAnonima, ZodValidationPipe } from '@educa/nucleo'
import { ErrorCode, acessoDaEscolaResponseSchema, slugDaEscolaSchema, type AcessoDaEscolaResponse } from '@educa/shared'
import { Controller, Get, Param } from '@nestjs/common'
import { AcessoDaEscolaService } from './acesso-da-escola.service.js'

/**
 * `GET /v1/escolas/:slug/acesso`: o que a tela `/e/:slug` mostra antes do login. Anônima, com o limite por IP da rota
 * anônima; a saída passa pelo contrato estrito, que só tem o nome e o tipo dos provedores. O `slug` fora do formato
 * responde como o inexistente (`NAO_ENCONTRADO`, regra 10, item 6), sem ir ao banco.
 */
@RotaAnonima()
@Controller('v1/escolas')
export class AcessoDaEscolaController {
  constructor(private readonly acesso: AcessoDaEscolaService) {}

  @Get(':slug/acesso')
  async ler(@Param('slug', new ZodValidationPipe(slugDaEscolaSchema, { errorCode: ErrorCode.NAO_ENCONTRADO })) slug: string): Promise<AcessoDaEscolaResponse> {
    return acessoDaEscolaResponseSchema.parse(await this.acesso.ler(slug))
  }
}
