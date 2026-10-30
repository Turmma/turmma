import { RequirePermissao, ZodValidationPipe } from '@educa/nucleo'
import {
  ErrorCode,
  parametroFerramentaSchema,
  gerarComFerramentaRequestSchema,
  type ParametroFerramenta,
  type GerarComFerramentaRequest,
  type ExecucaoAceitaResponse,
} from '@educa/shared'
import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { FerramentasService } from './ferramentas.service.js'

/**
 * `POST /v1/ferramentas/:ferramenta/gerar` (MVP, A2; D18): `atividade_objetiva` ou `plano_de_aula`. Ferramenta fora da
 * lista não existe (`NAO_ENCONTRADO`, pelo `errorCode` do pipe, e não `ENTRADA_INVALIDA`: regra 10, item 6); a Adaptação
 * parte de um artefato e tem rota própria. Responde `202` com a execução, que a tela consulta em `GET /v1/execucoes/:id`.
 */
@Controller('v1/ferramentas')
export class FerramentasController {
  constructor(private readonly ferramentas: FerramentasService) {}

  @Post(':ferramenta/gerar')
  @RequirePermissao('ferramenta', 'gerar')
  @HttpCode(HttpStatus.ACCEPTED)
  gerar(
    @Param('ferramenta', new ZodValidationPipe(parametroFerramentaSchema, { errorCode: ErrorCode.NAO_ENCONTRADO })) ferramenta: ParametroFerramenta,
    @Body(new ZodValidationPipe(gerarComFerramentaRequestSchema)) pedido: GerarComFerramentaRequest,
  ): Promise<ExecucaoAceitaResponse> {
    return this.ferramentas.gerar(ferramenta, pedido)
  }
}
