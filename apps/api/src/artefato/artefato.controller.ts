import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/nucleo'
import {
  artefatosQuerySchema,
  adaptarArtefatoRequestSchema,
  renomearArtefatoRequestSchema,
  type ArtefatosQuery,
  type AdaptarArtefatoRequest,
  type RenomearArtefatoRequest,
  type ArtefatoResponse,
  type ExecucaoAceitaResponse,
  type ListaDeArtefatosResponse,
} from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query, StreamableFile } from '@nestjs/common'
import { ArtefatoService } from './artefato.service.js'

/**
 * `/v1/artefatos` (MVP, A2): o que as ferramentas do Assistente produziram. Todas as células são `turma_vinculada`, só
 * do professor; coordenação e aluno são recusados pela guarda. O corpo e a consulta passam pelo contrato estrito
 * (campo a mais é `ENTRADA_INVALIDA`: a Adaptação não tem onde receber texto), e o `:id` fora do formato responde como
 * o inexistente. O artefato tem o gabarito: toda leitura sai com `no-store`. A entrada passa pelo `ZodValidationPipe` e
 * pelo `IdPipe` no parâmetro (17.0).
 */
@Controller('v1/artefatos')
export class ArtefatoController {
  constructor(private readonly artefatos: ArtefatoService) {}

  @Get()
  @RequirePermissao('artefato', 'listar')
  @Header('Cache-Control', 'no-store')
  listar(@Query(new ZodValidationPipe(artefatosQuerySchema)) consulta: ArtefatosQuery): Promise<ListaDeArtefatosResponse> {
    return this.artefatos.listar(consulta)
  }

  @Get(':id')
  @RequirePermissao('artefato', 'ler')
  @Header('Cache-Control', 'no-store')
  ler(@Param('id', IdPipe) artefatoId: string): Promise<ArtefatoResponse> {
    return this.artefatos.ler(artefatoId)
  }

  @Patch(':id')
  @RequirePermissao('artefato', 'renomear')
  @Header('Cache-Control', 'no-store')
  renomear(@Param('id', IdPipe) artefatoId: string, @Body(new ZodValidationPipe(renomearArtefatoRequestSchema)) pedido: RenomearArtefatoRequest): Promise<ArtefatoResponse> {
    return this.artefatos.renomear(artefatoId, pedido)
  }

  @Get(':id/pdf')
  @RequirePermissao('artefato', 'exportar')
  @Header('Cache-Control', 'no-store')
  async pdf(@Param('id', IdPipe) artefatoId: string): Promise<StreamableFile> {
    const { nome, bytes } = await this.artefatos.pdf(artefatoId)
    return new StreamableFile(bytes, { type: 'application/pdf', disposition: `attachment; filename="${nome}"`, length: bytes.length })
  }

  @Post(':id/adaptar')
  @RequirePermissao('artefato', 'adaptar')
  @HttpCode(HttpStatus.ACCEPTED)
  adaptar(@Param('id', IdPipe) artefatoId: string, @Body(new ZodValidationPipe(adaptarArtefatoRequestSchema)) pedido: AdaptarArtefatoRequest): Promise<ExecucaoAceitaResponse> {
    return this.artefatos.adaptar(artefatoId, pedido)
  }
}
