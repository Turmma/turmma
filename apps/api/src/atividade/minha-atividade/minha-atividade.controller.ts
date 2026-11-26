import { ComecarProvaRateLimit, IdPipe, RequirePermissao, SaidaDaAbaRateLimit, ZodValidationPipe } from '@educa/core'
import {
  ErrorCode,
  minhasAtividadesQuerySchema,
  responderQuestaoRequestSchema,
  emptyOrMissingBodyRequestSchema,
  questaoDoCaminhoSchema,
  registrarSaidaDaAbaRequestSchema,
  type MinhasAtividadesQuery,
  type RegistrarSaidaDaAbaRequest,
  type ResponderQuestaoRequest,
  type EmptyBodyRequest,
  type AtividadeEnviadaResponse,
  type MeuDiagnosticoResponse,
  type MinhasAtividadesResponse,
  type ProvaOnlineResponse,
  type QuestaoSalvaResponse,
  type TempoResponse,
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
 * **`comecar`, a prova, o tempo, a resposta, o envio e a saída da aba** são as rotas de prova: a instância que não pulsa há mais de 30 s as recusa com 503 antes de ler ou gravar
 * (`RotasDeProvaGuard`, avaliacao-e-correcao, 2.0 e 3.0). A lista e o diagnóstico seguem. `comecar` conta ainda no balde próprio de 30 por minuto por usuário (`rl:comecar-prova`), e `saidas-da-aba` no seu (`rl:saida-da-aba`, 30 por minuto).
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

  /** Começa a prova, ou devolve a que já começou: é o que cria a tentativa. Corpo vazio e estrito, 200 também na primeira vez (repetir devolve a mesma). */
  @Post('atividades-aplicadas/:id/comecar')
  @UseGuards(RotasDeProvaGuard)
  @ComecarProvaRateLimit()
  @RequirePermissao('minha_atividade', 'comecar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  comecar(@Param('id', IdPipe) atividadeAplicadaId: string, @Body(new ZodValidationPipe(emptyOrMissingBodyRequestSchema)) _corpo: EmptyBodyRequest): Promise<ProvaOnlineResponse> {
    return this.atividades.comecar(atividadeAplicadaId)
  }

  /** Antes de começar, só a janela e a duração; depois, a prova e o tempo. **Não grava**: quem cria a tentativa é `comecar`. */
  @Get('atividades-aplicadas/:id/prova')
  @UseGuards(RotasDeProvaGuard)
  @RequirePermissao('minha_atividade', 'ler_prova')
  @Header('Cache-Control', 'no-store')
  prova(@Param('id', IdPipe) atividadeAplicadaId: string): Promise<ProvaOnlineResponse> {
    return this.atividades.prova(atividadeAplicadaId)
  }

  /** O limite do aluno, o `agora` do servidor e como foi enviada: a tela o relê a cada 30 s. */
  @Get('atividades-aplicadas/:id/tempo')
  @UseGuards(RotasDeProvaGuard)
  @RequirePermissao('minha_atividade', 'ler_tempo')
  @Header('Cache-Control', 'no-store')
  tempo(@Param('id', IdPipe) atividadeAplicadaId: string): Promise<TempoResponse> {
    return this.atividades.tempo(atividadeAplicadaId)
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

  /** Uma saída da aba da prova em andamento (D70): a `chave` é um uuid v4 da tela, para o reenvio não contar duas vezes. 204 também no reenvio; fora de prova em andamento, `NAO_ENCONTRADO`. */
  @Post('atividades-aplicadas/:id/saidas-da-aba')
  @UseGuards(RotasDeProvaGuard)
  @SaidaDaAbaRateLimit()
  @RequirePermissao('minha_atividade', 'registrar_saida')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  saidaDaAba(@Param('id', IdPipe) atividadeAplicadaId: string, @Body(new ZodValidationPipe(registrarSaidaDaAbaRequestSchema)) { chave }: RegistrarSaidaDaAbaRequest): Promise<void> {
    return this.atividades.registrarSaida(atividadeAplicadaId, chave)
  }

  @Get('atividades-aplicadas/:id/meu-diagnostico')
  @RequirePermissao('minha_atividade', 'ler_diagnostico')
  @Header('Cache-Control', 'no-store')
  meuDiagnostico(@Param('id', IdPipe) atividadeAplicadaId: string): Promise<MeuDiagnosticoResponse> {
    return this.atividades.meuDiagnostico(atividadeAplicadaId)
  }
}
