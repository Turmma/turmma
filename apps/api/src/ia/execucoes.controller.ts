import { IdPipe, RequirePermissao } from '@educa/core'
import type { ExecucaoResponse } from '@educa/shared'
import { Controller, Get, Header, Param } from '@nestjs/common'
import { ExecucoesService } from './execucoes.service.js'

/**
 * `GET /v1/execucoes/:id` (MVP, seção 4, item 1): a tela consulta a execução que o `POST` devolveu, até ela terminar.
 * A célula é `execucao.ler`, alcance `próprio`: coordenação, professor e aluno leem só a que pediram. O `:id` fora do
 * formato de UUID responde como o inexistente. Sem cache: o estado muda de um segundo para o outro.
 */
@Controller('v1/execucoes')
export class ExecucoesController {
  constructor(private readonly execucoes: ExecucoesService) {}

  @Get(':id')
  @RequirePermissao('execucao', 'ler')
  @Header('Cache-Control', 'no-store')
  ler(@Param('id', IdPipe) id: string): Promise<ExecucaoResponse> {
    return this.execucoes.ler(id)
  }
}
