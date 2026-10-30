import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/nucleo'
import {
  listaDaTurmaQuerySchema,
  nomeAvulsoRequestSchema,
  textoDaListaRequestSchema,
  type ListaDaTurmaQuery,
  type NomeDaLista,
  type NomeAvulsoRequest,
  type TextoDaListaRequest,
  type GravacaoDaListaResponse,
  type ListaDaTurmaResponse,
  type PreviaDaListaResponse,
} from '@educa/shared'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ListaService } from './lista.service.js'

/**
 * A lista de nomes da turma (A1, tarefa 2.0, RF4 e RF5), só da coordenação, na turma do ano em curso da escola da
 * sessão: a prévia e a gravação do texto, o nome avulso, a retirada do nome livre e a leitura, com finalidade. O corpo e
 * a consulta passam pelo contrato estrito de `packages/shared` (campo a mais, como `escolaId`, é `ENTRADA_INVALIDA`); o
 * id fora do formato de UUID responde como o inexistente.
 */
@Controller('v1')
export class ListaController {
  constructor(private readonly lista: ListaService) {}

  @Post('turmas/:id/lista/previa')
  @RequirePermissao('lista_nome', 'previa')
  @HttpCode(HttpStatus.OK)
  previa(@Param('id', IdPipe) turmaId: string, @Body(new ZodValidationPipe(textoDaListaRequestSchema)) pedido: TextoDaListaRequest): Promise<PreviaDaListaResponse> {
    return this.lista.previa(turmaId, pedido)
  }

  @Post('turmas/:id/lista')
  @RequirePermissao('lista_nome', 'gravar')
  gravar(@Param('id', IdPipe) turmaId: string, @Body(new ZodValidationPipe(textoDaListaRequestSchema)) pedido: TextoDaListaRequest): Promise<GravacaoDaListaResponse> {
    return this.lista.gravar(turmaId, pedido)
  }

  @Post('turmas/:id/lista/nome')
  @RequirePermissao('lista_nome', 'acrescentar')
  acrescentar(@Param('id', IdPipe) turmaId: string, @Body(new ZodValidationPipe(nomeAvulsoRequestSchema)) pedido: NomeAvulsoRequest): Promise<NomeDaLista> {
    return this.lista.acrescentar(turmaId, pedido)
  }

  @Get('turmas/:id/lista')
  @RequirePermissao('lista_nome', 'ler')
  ler(@Param('id', IdPipe) turmaId: string, @Query(new ZodValidationPipe(listaDaTurmaQuerySchema)) consulta: ListaDaTurmaQuery): Promise<ListaDaTurmaResponse> {
    return this.lista.ler(turmaId, consulta)
  }

  @Delete('lista-nomes/:id')
  @RequirePermissao('lista_nome', 'retirar')
  @HttpCode(HttpStatus.NO_CONTENT)
  retirar(@Param('id', IdPipe) id: string): Promise<void> {
    return this.lista.retirar(id)
  }
}
