import { IdPipe, Permite, ZodValidationPipe } from '@educa/nucleo'
import { emptyOrMissingBodyRequestSchema, type EmptyBodyRequest, type LoteAprovadoResponse } from '@educa/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { CorrecaoService } from './correcao.service.js'

/**
 * `POST /v1/entregas/:id/aprovar-lote` (MVP, A3; D33, D56): a aprovação do lote de correção, com o registro da
 * validação. A célula `entrega.aprovar_lote` é `turma_vinculada`, só do professor. **O corpo é vazio e estrito**:
 * `apresentado`, `aberto` ou qualquer outro campo vindo do cliente é `ENTRADA_INVALIDA`, porque o registro é montado no
 * servidor. As outras rotas de `/v1/entregas` são do módulo da entrega, que recusa aprovar lote por elas.
 */
@Controller('v1/entregas')
export class LoteController {
  constructor(private readonly correcoes: CorrecaoService) {}

  @Post(':id/aprovar-lote')
  @Permite('entrega', 'aprovar_lote')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  aprovarLote(@Param('id', IdPipe) entregaId: string, @Body(new ZodValidationPipe(emptyOrMissingBodyRequestSchema)) _corpo: EmptyBodyRequest): Promise<LoteAprovadoResponse> {
    return this.correcoes.aprovarLote(entregaId)
  }
}
