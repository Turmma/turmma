import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/nucleo'
import {
  paginationQuerySchema,
  criarDisciplinaRequestSchema,
  renomearDisciplinaRequestSchema,
  type PaginationQuery,
  type CriarDisciplinaRequest,
  type RenomearDisciplinaRequest,
  type DisciplinaResponse,
  type ListaDeDisciplinasResponse,
} from '@educa/shared'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common'
import { DisciplinaService } from './disciplina.service.js'

/**
 * `/v1/disciplinas`: a coordenação cria, lista, renomeia e exclui as disciplinas da escola da sessão. Id fora do
 * formato, de outra escola ou inexistente: o mesmo `NAO_ENCONTRADO`.
 */
@Controller('v1/disciplinas')
export class DisciplinaController {
  constructor(private readonly disciplinas: DisciplinaService) {}

  @Post()
  @RequirePermissao('disciplina', 'criar')
  criar(@Body(new ZodValidationPipe(criarDisciplinaRequestSchema)) pedido: CriarDisciplinaRequest): Promise<DisciplinaResponse> {
    return this.disciplinas.criar(pedido)
  }

  @Patch(':id')
  @RequirePermissao('disciplina', 'renomear')
  renomear(@Param('id', IdPipe) id: string, @Body(new ZodValidationPipe(renomearDisciplinaRequestSchema)) pedido: RenomearDisciplinaRequest): Promise<DisciplinaResponse> {
    return this.disciplinas.renomear(id, pedido)
  }

  @Delete(':id')
  @RequirePermissao('disciplina', 'excluir')
  @HttpCode(HttpStatus.NO_CONTENT)
  excluir(@Param('id', IdPipe) id: string): Promise<void> {
    return this.disciplinas.excluir(id)
  }

  @Get()
  @RequirePermissao('disciplina', 'ler')
  listar(@Query(new ZodValidationPipe(paginationQuerySchema)) consulta: PaginationQuery): Promise<ListaDeDisciplinasResponse> {
    return this.disciplinas.listar(consulta)
  }
}
