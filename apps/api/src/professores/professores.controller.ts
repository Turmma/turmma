import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/core'
import {
  paginationQuerySchema,
  cadastrarProfessorRequestSchema,
  conviteDeProfessorEmptyBodyRequestSchema,
  type PaginationQuery,
  type CadastrarProfessorRequest,
  type ConviteDeProfessorResponse,
  type ListaDeProfessoresResponse,
} from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ProfessoresService } from './professores.service.js'

/** Refazer e revogar não têm corpo: nenhum corpo vale como `{}` (o Express 5 deixa `req.body` indefinido), e qualquer campo é `ENTRADA_INVALIDA`. */
const esquemaSemCorpo = conviteDeProfessorEmptyBodyRequestSchema.default({})

/**
 * `/v1/professores` (A1, tarefa 3.0, RF6), só da coordenação, na escola da sessão: cadastrar o professor (o link do
 * convite sai uma vez), listar, e refazer e revogar o convite dele pelo id do usuário. O corpo passa pelo contrato estrito
 * de `packages/shared` (campo a mais, como `escolaId`, é `ENTRADA_INVALIDA`); o `:usuarioId` fora do formato de UUID
 * responde como o inexistente. As respostas que levam o token saem com `no-store`.
 */
@Controller('v1/professores')
export class ProfessoresController {
  constructor(private readonly professores: ProfessoresService) {}

  @Post()
  @RequirePermissao('professor', 'cadastrar')
  @Header('Cache-Control', 'no-store')
  cadastrar(@Body(new ZodValidationPipe(cadastrarProfessorRequestSchema)) pedido: CadastrarProfessorRequest): Promise<ConviteDeProfessorResponse> {
    return this.professores.cadastrar(pedido)
  }

  @Get()
  @RequirePermissao('professor', 'listar')
  listar(@Query(new ZodValidationPipe(paginationQuerySchema)) consulta: PaginationQuery): Promise<ListaDeProfessoresResponse> {
    return this.professores.listar(consulta)
  }

  @Post(':usuarioId/convite/refazer')
  @RequirePermissao('professor', 'refazer_convite')
  @Header('Cache-Control', 'no-store')
  refazerConvite(@Param('usuarioId', IdPipe) usuarioId: string, @Body(new ZodValidationPipe(esquemaSemCorpo)) _corpo: Record<string, never>): Promise<ConviteDeProfessorResponse> {
    return this.professores.refazerConvite(usuarioId)
  }

  @Post(':usuarioId/convite/revogar')
  @RequirePermissao('professor', 'revogar_convite')
  @HttpCode(HttpStatus.NO_CONTENT)
  revogarConvite(@Param('usuarioId', IdPipe) usuarioId: string, @Body(new ZodValidationPipe(esquemaSemCorpo)) _corpo: Record<string, never>): Promise<void> {
    return this.professores.revogarConvite(usuarioId)
  }
}
