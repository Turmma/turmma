import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/core'
import {
  alterarLicencaRequestSchema,
  licencasQuerySchema,
  registrarLicencaRequestSchema,
  type AlterarLicencaRequest,
  type LicencaResponse,
  type LicencasQuery,
  type ListaDeLicencasResponse,
  type RegistrarLicencaRequest,
} from '@educa/shared'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { LicencaService } from './licenca.service.js'

/**
 * `/v1/licencas` (ingestao-do-material, 5.0; Tech Spec, seção 4): a coordenação registra, lista e altera a licença do material de terceiro da escola da sessão. O professor e o aluno
 * não alcançam nenhuma rota (a guarda de permissão responde `NAO_ENCONTRADO`), e não há `DELETE`. A entrada passa pelo contrato estrito de `packages/shared` (campo a mais, como
 * `escolaId`, é `ENTRADA_INVALIDA`) e o id, pelo `IdPipe`: id fora do formato, de outra escola ou inexistente responde o mesmo `NAO_ENCONTRADO`.
 */
@Controller('v1/licencas')
export class LicencaController {
  constructor(private readonly licencas: LicencaService) {}

  @Get()
  @RequirePermissao('licenca', 'listar')
  listar(@Query(new ZodValidationPipe(licencasQuerySchema)) consulta: LicencasQuery): Promise<ListaDeLicencasResponse> {
    return this.licencas.listar(consulta)
  }

  @Post()
  @RequirePermissao('licenca', 'registrar')
  registrar(@Body(new ZodValidationPipe(registrarLicencaRequestSchema)) pedido: RegistrarLicencaRequest): Promise<LicencaResponse> {
    return this.licencas.registrar(pedido)
  }

  @Patch(':id')
  @RequirePermissao('licenca', 'alterar')
  alterar(@Param('id', IdPipe) id: string, @Body(new ZodValidationPipe(alterarLicencaRequestSchema)) pedido: AlterarLicencaRequest): Promise<LicencaResponse> {
    return this.licencas.alterar(id, pedido)
  }
}
