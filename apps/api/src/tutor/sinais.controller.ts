import { Permite, ZodValidationPipe } from '@educa/nucleo'
import { sinaisQuerySchema, type SinaisQuery, type SinaisResponse } from '@educa/shared'
import { Controller, Get, Header, Query } from '@nestjs/common'
import { SupervisaoDoTutorService } from './supervisao.service.js'

/**
 * `GET /v1/sinais?turmaId=` (MVP, A4; D34, D36, D57): os sinais do Tutor para o professor da turma. A célula é
 * `turma_vinculada`, só do professor: o aluno e a coordenação recebem da guarda a resposta do inexistente. A consulta é
 * estrita: não aceita aluno, tipo nem ordenação, e passa pelo `ZodValidationPipe` no parâmetro (17.0).
 */
@Controller('v1/sinais')
export class SinaisController {
  constructor(private readonly supervisao: SupervisaoDoTutorService) {}

  @Get()
  @Permite('sinal', 'ler')
  @Header('Cache-Control', 'no-store')
  listar(@Query(new ZodValidationPipe(sinaisQuerySchema)) consulta: SinaisQuery): Promise<SinaisResponse> {
    return this.supervisao.sinais(consulta)
  }
}
