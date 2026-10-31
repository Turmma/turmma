import { RequirePermissao } from '@educa/core'
import type { MinhaTurmaResponse } from '@educa/shared'
import { Controller, Get } from '@nestjs/common'
import { MinhaTurmaService } from './minha-turma.service.js'

/** `GET /v1/minha-turma` (A1, tarefa 8.0): a turma do aluno da sessão, pela célula `minha_turma.ler` (`proprio`). */
@Controller('v1/minha-turma')
export class MinhaTurmaController {
  constructor(private readonly minhaTurma: MinhaTurmaService) {}

  @Get()
  @RequirePermissao('minha_turma', 'ler')
  ler(): Promise<MinhaTurmaResponse> {
    return this.minhaTurma.ler()
  }
}
