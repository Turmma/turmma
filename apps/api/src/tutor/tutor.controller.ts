import { RequirePermissao, ZodValidationPipe } from '@educa/core'
import {
  conversaDoTutorQuerySchema,
  usoDoTutorQuerySchema,
  mensagemAoTutorRequestSchema,
  type ConversaDoTutorQuery,
  type UsoDoTutorQuery,
  type MensagemAoTutorRequest,
  type ConversaDoTutorResponse,
  type ExecucaoAceitaResponse,
  type MemoriaDoTutorResponse,
  type UsoDoTutorResponse,
} from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Query } from '@nestjs/common'
import { SupervisaoDoTutorService } from './supervisao.service.js'
import { TutorService } from './tutor.service.js'

/**
 * `/v1/tutor` (MVP, A4; D8, D47). As três células do aluno são `próprio`: professor e coordenação recebem da guarda a
 * resposta do inexistente, e não existe rota que entregue a conversa ou a memória de um aluno a outra pessoa. `uso` é
 * só do professor (`turma_vinculada`): o aluno e a coordenação não leem. O corpo e a consulta passam pelo contrato
 * estrito: `escolaId`, `alunoId`, `turmaId` no envio ou qualquer campo a mais é `ENTRADA_INVALIDA`, antes de a troca ser gasta. Tudo com
 * `no-store`. A entrada passa pelo `ZodValidationPipe` no parâmetro (17.0), que nunca leva o texto da mensagem ao log nem à resposta.
 */
@Controller('v1/tutor')
export class TutorController {
  constructor(
    private readonly tutor: TutorService,
    private readonly supervisao: SupervisaoDoTutorService,
  ) {}

  @Post('mensagens')
  @RequirePermissao('tutor', 'enviar_mensagem')
  @HttpCode(HttpStatus.ACCEPTED)
  enviar(@Body(new ZodValidationPipe(mensagemAoTutorRequestSchema)) pedido: MensagemAoTutorRequest): Promise<ExecucaoAceitaResponse> {
    return this.tutor.enviar(pedido)
  }

  @Get('conversa')
  @RequirePermissao('tutor', 'ler_conversa')
  @Header('Cache-Control', 'no-store')
  conversa(@Query(new ZodValidationPipe(conversaDoTutorQuerySchema)) consulta: ConversaDoTutorQuery): Promise<ConversaDoTutorResponse> {
    return this.tutor.conversa(consulta)
  }

  @Get('memoria')
  @RequirePermissao('tutor', 'ler_memoria')
  @Header('Cache-Control', 'no-store')
  memoria(): Promise<MemoriaDoTutorResponse> {
    return this.tutor.memoria()
  }

  @Get('uso')
  @RequirePermissao('uso_do_tutor', 'ler')
  @Header('Cache-Control', 'no-store')
  uso(@Query(new ZodValidationPipe(usoDoTutorQuerySchema)) consulta: UsoDoTutorQuery): Promise<UsoDoTutorResponse> {
    return this.supervisao.uso(consulta)
  }
}
