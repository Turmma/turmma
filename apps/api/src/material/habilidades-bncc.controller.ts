import { RequirePermissao, ZodValidationPipe } from '@educa/core'
import { habilidadesBnccQuerySchema, type HabilidadesBnccQuery, type HabilidadesBnccResponse } from '@educa/shared'
import { Controller, Get, Query } from '@nestjs/common'
import { MaterialService } from './material.service.js'

/**
 * `GET /v1/habilidades-bncc` (classificacao-bncc, 7.0; Tech Spec, seção 4): as habilidades que um material, ou o artefato do professor, pode receber. A coordenação e o professor a leem (`habilidade_bncc.listar`); o aluno e a
 * rede, nunca. A consulta passa pelo contrato estrito (`materialId` ou `artefatoId`, só um); quem acha o objeto no alcance e devolve o recorte é o service.
 */
@Controller('v1/habilidades-bncc')
export class HabilidadesBnccController {
  constructor(private readonly materiais: MaterialService) {}

  @Get()
  @RequirePermissao('habilidade_bncc', 'listar')
  list(@Query(new ZodValidationPipe(habilidadesBnccQuerySchema)) consulta: HabilidadesBnccQuery): Promise<HabilidadesBnccResponse> {
    return this.materiais.listHabilidades(consulta)
  }
}
