import { RequirePermissao, ZodValidationPipe } from '@educa/nucleo'
import {
  ErrorCode,
  chaveDeFuncaoSchema,
  consumoQuerySchema,
  resumoDaGovernancaQuerySchema,
  emptyBodyRequestSchema,
  suspenderFuncaoRequestSchema,
  type ChaveDeFuncao,
  type ConsumoQuery,
  type ResumoDaGovernancaQuery,
  type EmptyBodyRequest,
  type SuspenderFuncaoRequest,
  type ConsumoResponse,
  type FuncaoDaGovernancaResponse,
  type FuncoesDaGovernancaResponse,
  type ResumoDaGovernancaResponse,
} from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { GovernancaService } from './governanca.service.js'

/** A `:chave` da rota. Fora do catálogo, nenhuma função existe assim: responde como o inexistente (regra 10, item 6). */
const pipeDaChave = new ZodValidationPipe(chaveDeFuncaoSchema, { errorCode: ErrorCode.NAO_ENCONTRADO })

/**
 * `/v1/governanca` (MVP, A5): a governança de IA, **só da coordenação**. Professor, aluno e rede recebem da guarda a
 * resposta do inexistente. As consultas são estritas: não existe filtro, ordenação nem agrupamento por professor, por
 * turma ou por pessoa (D45, D64), e mandar um é `ENTRADA_INVALIDA`.
 */
@Controller('v1/governanca')
export class GovernancaController {
  constructor(private readonly governanca: GovernancaService) {}

  @Get('resumo')
  @RequirePermissao('governanca', 'ler_resumo')
  @Header('Cache-Control', 'no-store')
  resumo(@Query(new ZodValidationPipe(resumoDaGovernancaQuerySchema)) consulta: ResumoDaGovernancaQuery): Promise<ResumoDaGovernancaResponse> {
    return this.governanca.resumo(consulta)
  }

  @Get('funcoes')
  @RequirePermissao('governanca', 'ler_funcoes')
  @Header('Cache-Control', 'no-store')
  funcoes(): Promise<FuncoesDaGovernancaResponse> {
    return this.governanca.funcoes()
  }

  @Post('funcoes/:chave/suspender')
  @RequirePermissao('governanca', 'suspender_funcao')
  @HttpCode(HttpStatus.OK)
  suspender(@Param('chave', pipeDaChave) chave: ChaveDeFuncao, @Body(new ZodValidationPipe(suspenderFuncaoRequestSchema)) pedido: SuspenderFuncaoRequest): Promise<FuncaoDaGovernancaResponse> {
    return this.governanca.suspender(chave, pedido)
  }

  @Post('funcoes/:chave/retomar')
  @RequirePermissao('governanca', 'retomar_funcao')
  @HttpCode(HttpStatus.OK)
  retomar(@Param('chave', pipeDaChave) chave: ChaveDeFuncao, @Body(new ZodValidationPipe(emptyBodyRequestSchema)) _corpo: EmptyBodyRequest): Promise<FuncaoDaGovernancaResponse> {
    return this.governanca.retomar(chave)
  }

  @Get('consumo')
  @RequirePermissao('governanca', 'ler_consumo')
  @Header('Cache-Control', 'no-store')
  consumo(@Query(new ZodValidationPipe(consumoQuerySchema)) consulta: ConsumoQuery): Promise<ConsumoResponse> {
    return this.governanca.consumo(consulta)
  }
}
