import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/core'
import { gerarAcessoRequestSchema, revogarAcessoRequestSchema, type GerarAcessoRequest, type AcessoDaTurmaResponse, type AcessoGeradoResponse } from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import type { z } from 'zod'
import { AcessoDaTurmaService } from './acesso-da-turma.service.js'

/** Revogar não tem campo: nenhum corpo vale como `{}` (o Express 5 deixa `req.body` indefinido), e qualquer campo é `ENTRADA_INVALIDA`. */
const emptyBodySchema = revogarAcessoRequestSchema.default({})
type PedidoSemCorpo = z.output<typeof emptyBodySchema>

/**
 * O acesso da turma (A1, tarefa 4.0, RF9), só do professor com vínculo confirmado na turma do ano em curso: gerar o link
 * e o código, revogar, e ler até quando valem. O corpo passa pelo contrato estrito de `packages/shared` (campo a mais,
 * como `escolaId`, é `ENTRADA_INVALIDA`); o id fora do formato de UUID responde como o inexistente. A resposta do gerar,
 * a única com o link e o código, e a leitura saem com `no-store`.
 */
@Controller('v1/turmas/:id/acesso')
export class AcessoDaTurmaController {
  constructor(private readonly acessos: AcessoDaTurmaService) {}

  @Post()
  @RequirePermissao('acesso_turma', 'gerar')
  @Header('Cache-Control', 'no-store')
  gerar(@Param('id', IdPipe) turmaId: string, @Body(new ZodValidationPipe(gerarAcessoRequestSchema)) pedido: GerarAcessoRequest): Promise<AcessoGeradoResponse> {
    return this.acessos.gerar(turmaId, pedido)
  }

  @Get()
  @RequirePermissao('acesso_turma', 'ler')
  @Header('Cache-Control', 'no-store')
  ler(@Param('id', IdPipe) turmaId: string): Promise<AcessoDaTurmaResponse> {
    return this.acessos.ler(turmaId)
  }

  @Post('revogar')
  @RequirePermissao('acesso_turma', 'revogar')
  @HttpCode(HttpStatus.NO_CONTENT)
  revogar(@Param('id', IdPipe) turmaId: string, @Body(new ZodValidationPipe(emptyBodySchema)) _corpo: PedidoSemCorpo): Promise<void> {
    return this.acessos.revogar(turmaId)
  }
}
