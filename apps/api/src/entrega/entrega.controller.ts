import { IdPipe, Permite, ZodValidationPipe } from '@educa/nucleo'
import {
  entregasQuerySchema,
  decidirEntregaRequestSchema,
  type EntregasQuery,
  type DecidirEntregaRequest,
  type EntregaResponse,
  type ListaDeEntregasResponse,
} from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { EntregaService } from './entrega.service.js'

/**
 * `/v1/entregas` (MVP, A2; regra 70, item 3): o que a IA produziu e espera a decisão do professor da turma. As células
 * `entrega.listar` e `entrega.decidir` são `turma_vinculada`, só do professor: coordenação e aluno são recusados pela
 * guarda. O corpo é o contrato estrito (rejeitar sem justificativa, ou aprovar com uma, é `ENTRADA_INVALIDA`), e o `:id`
 * fora do formato responde como o inexistente. A aprovação do lote de correção tem rota própria, no módulo da atividade.
 */
@Controller('v1/entregas')
export class EntregaController {
  constructor(private readonly entregas: EntregaService) {}

  @Get()
  @Permite('entrega', 'listar')
  @Header('Cache-Control', 'no-store')
  listar(@Query(new ZodValidationPipe(entregasQuerySchema)) consulta: EntregasQuery): Promise<ListaDeEntregasResponse> {
    return this.entregas.listar(consulta)
  }

  @Post(':id/decidir')
  @Permite('entrega', 'decidir')
  @HttpCode(HttpStatus.OK)
  decidir(@Param('id', IdPipe) id: string, @Body(new ZodValidationPipe(decidirEntregaRequestSchema)) pedido: DecidirEntregaRequest): Promise<EntregaResponse> {
    return this.entregas.decidir(id, pedido)
  }
}
