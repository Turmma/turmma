import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/core'
import {
  ErrorCode,
  minhasAtividadesQuerySchema,
  responderQuestaoRequestSchema,
  emptyOrMissingBodyRequestSchema,
  questaoDoCaminhoSchema,
  type MinhasAtividadesQuery,
  type ResponderQuestaoRequest,
  type EmptyBodyRequest,
  type AtividadeEnviadaResponse,
  type MeuDiagnosticoResponse,
  type MinhasAtividadesResponse,
  type ProvaResponse,
  type QuestaoSalvaResponse,
} from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { RotasDeProvaGuard } from '../pulso/rotas-de-prova.guard.js'
import { MinhaAtividadeService } from './minha-atividade.service.js'

/**
 * O lado do aluno na atividade (MVP, A3): `GET /v1/minhas-atividades` e, sob `/v1/atividades-aplicadas/:id`, a prova, a
 * resposta de cada questão, o envio e o diagnóstico. Todas as células são `proprio`, só do aluno: professor e
 * coordenação são recusados pela guarda. Tudo sai com `no-store`: é dado do aluno, num computador que a turma divide.
 * A entrada passa pelo `ZodValidationPipe` e pelo `IdPipe` no parâmetro (17.0); a `questao` do caminho fora do formato ou
 * do intervalo, onde nenhuma questão existe, responde como o inexistente (`NAO_ENCONTRADO`), e não como entrada inválida.
 *
 * **A prova, a resposta e o envio** são as rotas de prova de hoje: a instância que não pulsa há mais de 30 s as recusa com 503 antes de ler ou gravar (`RotasDeProvaGuard`,
 * avaliacao-e-correcao, 2.0). A lista e o diagnóstico seguem. A rota nova de prova (3.0) entra com a mesma guarda.
 *
 * O limite é o geral de requisições, por usuário e por escola, nunca por IP (regra 80, item 1): trinta e cinco alunos
 * respondem do mesmo IP.
 */
@Controller('v1')
export class MinhaAtividadeController {
  constructor(private readonly atividades: MinhaAtividadeService) {}

  @Get('minhas-atividades')
  @RequirePermissao('minha_atividade', 'listar')
  @Header('Cache-Control', 'no-store')
  list(@Query(new ZodValidationPipe(minhasAtividadesQuerySchema)) consulta: MinhasAtividadesQuery): Promise<MinhasAtividadesResponse> {
    return this.atividades.list(consulta)
  }

  @Get('atividades-aplicadas/:id/prova')
  @UseGuards(RotasDeProvaGuard)
  @RequirePermissao('minha_atividade', 'ler_prova')
  @Header('Cache-Control', 'no-store')
  prova(@Param('id', IdPipe) atividadeAplicadaId: string): Promise<ProvaResponse> {
    return this.atividades.prova(atividadeAplicadaId)
  }

  @Put('atividades-aplicadas/:id/respostas/:questao')
  @UseGuards(RotasDeProvaGuard)
  @RequirePermissao('minha_atividade', 'responder')
  @Header('Cache-Control', 'no-store')
  responder(
    @Param('id', IdPipe) atividadeAplicadaId: string,
    @Param('questao', new ZodValidationPipe(questaoDoCaminhoSchema, { errorCode: ErrorCode.NAO_ENCONTRADO })) numero: number,
    @Body(new ZodValidationPipe(responderQuestaoRequestSchema)) pedido: ResponderQuestaoRequest,
  ): Promise<QuestaoSalvaResponse> {
    return this.atividades.responder(atividadeAplicadaId, numero, pedido)
  }

  @Post('atividades-aplicadas/:id/enviar')
  @UseGuards(RotasDeProvaGuard)
  @RequirePermissao('minha_atividade', 'enviar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  send(@Param('id', IdPipe) atividadeAplicadaId: string, @Body(new ZodValidationPipe(emptyOrMissingBodyRequestSchema)) _corpo: EmptyBodyRequest): Promise<AtividadeEnviadaResponse> {
    return this.atividades.send(atividadeAplicadaId)
  }

  @Get('atividades-aplicadas/:id/meu-diagnostico')
  @RequirePermissao('minha_atividade', 'ler_diagnostico')
  @Header('Cache-Control', 'no-store')
  meuDiagnostico(@Param('id', IdPipe) atividadeAplicadaId: string): Promise<MeuDiagnosticoResponse> {
    return this.atividades.meuDiagnostico(atividadeAplicadaId)
  }
}
