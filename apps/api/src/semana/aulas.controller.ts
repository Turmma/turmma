import { RequirePermissao, ZodValidationPipe } from '@educa/core'
import { gravarAulaRequestSchema, type GravarAulaRequest, type GravarAulaResponse } from '@educa/shared'
import { Body, Controller, Put } from '@nestjs/common'
import { AulasService } from './aulas.service.js'

/**
 * A professora grava o texto de uma aula (F2b, tarefa 4.0): `PUT /v1/aulas`. Só o professor (`aula.gravar`, alcance `proprio`); coordenação, rede e
 * aluno têm `nunca` na matriz. O corpo passa pelo contrato estrito de `packages/shared`: campo a mais, data inexistente, `inicio` mal formado e texto
 * acima de 500 depois de aparado são `ENTRADA_INVALIDA`. Texto vazio apaga o registro.
 */
@Controller('v1')
export class AulasController {
  constructor(private readonly aulas: AulasService) {}

  @Put('aulas')
  @RequirePermissao('aula', 'gravar')
  gravar(@Body(new ZodValidationPipe(gravarAulaRequestSchema)) corpo: GravarAulaRequest): Promise<GravarAulaResponse> {
    return this.aulas.gravar(corpo)
  }
}
