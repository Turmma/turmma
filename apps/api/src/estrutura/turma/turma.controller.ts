import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/nucleo'
import {
  alunosDaTurmaQuerySchema,
  paginationQuerySchema,
  turmaQuerySchema,
  criarTurmaRequestSchema,
  renomearTurmaRequestSchema,
  type AlunosDaTurmaQuery,
  type PaginationQuery,
  type TurmaQuery,
  type CriarTurmaRequest,
  type RenomearTurmaRequest,
  type AlunosDaTurmaResponse,
  type ListaDeTurmasResponse,
  type TurmaResponse,
  type TurmaAbertaResponse,
} from '@educa/shared'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common'
import { TurmaService } from './turma.service.js'

/**
 * `/v1/turmas`: a coordenação cria, lista, renomeia e exclui as turmas do ano letivo em curso da escola da sessão (A1,
 * 1.0); a coordenação e o professor com vínculo confirmado abrem uma turma e a lista de alunos dela, do ano em curso ou,
 * com `?anoLetivoId`, de um ano encerrado da escola, só em leitura (10.0, RF16).
 */
@Controller('v1/turmas')
export class TurmaController {
  constructor(private readonly turmas: TurmaService) {}

  @Post()
  @RequirePermissao('turma', 'criar')
  criar(@Body(new ZodValidationPipe(criarTurmaRequestSchema)) pedido: CriarTurmaRequest): Promise<TurmaResponse> {
    return this.turmas.criar(pedido)
  }

  @Get()
  @RequirePermissao('turma', 'listar')
  listar(@Query(new ZodValidationPipe(paginationQuerySchema)) consulta: PaginationQuery): Promise<ListaDeTurmasResponse> {
    return this.turmas.listar(consulta)
  }

  @Get(':id')
  @RequirePermissao('turma', 'ler')
  abrir(@Param('id', IdPipe) id: string, @Query(new ZodValidationPipe(turmaQuerySchema)) consulta: TurmaQuery): Promise<TurmaAbertaResponse> {
    return this.turmas.abrir(id, consulta)
  }

  @Patch(':id')
  @RequirePermissao('turma', 'renomear')
  renomear(@Param('id', IdPipe) id: string, @Body(new ZodValidationPipe(renomearTurmaRequestSchema)) pedido: RenomearTurmaRequest): Promise<TurmaResponse> {
    return this.turmas.renomear(id, pedido)
  }

  @Delete(':id')
  @RequirePermissao('turma', 'excluir')
  @HttpCode(HttpStatus.NO_CONTENT)
  excluir(@Param('id', IdPipe) id: string): Promise<void> {
    return this.turmas.excluir(id)
  }

  @Get(':id/alunos')
  @RequirePermissao('aluno_da_turma', 'ler')
  alunos(@Param('id', IdPipe) id: string, @Query(new ZodValidationPipe(alunosDaTurmaQuerySchema)) consulta: AlunosDaTurmaQuery): Promise<AlunosDaTurmaResponse> {
    return this.turmas.alunos(id, consulta)
  }
}
