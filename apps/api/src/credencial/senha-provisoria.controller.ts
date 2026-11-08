import { IdPipe, RequirePermissao } from '@educa/core'
import type { SenhaProvisoriaResponse } from '@educa/shared'
import { Controller, Header, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { SenhaProvisoriaService } from './senha-provisoria.service.js'

/**
 * `POST /v1/usuarios/:usuarioId/senha-provisoria` (acesso-e-convites, tarefa 9.0, RF13): a coordenação, ou o professor com vínculo confirmado na turma do aluno, gera a senha provisória dele.
 * Sem corpo: o aluno é o do caminho, e a escola e o papel de quem gera vêm da sessão. O id fora do formato de UUID responde como o aluno que não existe, e o aluno que quem pede não alcança
 * também (regra 10, item 6). A resposta, a única vez que a senha existe em claro, sai com `Cache-Control: no-store`; o 409 `ENTRA_PELA_CONTA_DA_ESCOLA` e o `CONFLITO` saem do service.
 */
@Controller('v1/usuarios')
export class SenhaProvisoriaController {
  constructor(private readonly senhas: SenhaProvisoriaService) {}

  @Post(':usuarioId/senha-provisoria')
  @RequirePermissao('senha_provisoria', 'gerar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  gerar(@Param('usuarioId', IdPipe) alunoId: string): Promise<SenhaProvisoriaResponse> {
    return this.senhas.gerar(alunoId)
  }
}
