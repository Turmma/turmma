import { IdPipe, RequirePermissao } from '@educa/core'
import type { AlvoDaSenhaProvisoriaResponse, SenhaProvisoriaResponse } from '@educa/shared'
import { Controller, Get, Header, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { SenhaProvisoriaService } from './senha-provisoria.service.js'

/**
 * `POST /v1/usuarios/:usuarioId/senha-provisoria` (acesso-e-convites, tarefa 9.0, RF13): a coordenação, ou o professor com vínculo confirmado na turma do aluno, gera a senha provisória dele.
 * Sem corpo: o aluno é o do caminho, e a escola e o papel de quem gera vêm da sessão. O id fora do formato de UUID responde como o aluno que não existe, e o aluno que quem pede não alcança
 * também (regra 10, item 6). A resposta, a única vez que a senha existe em claro, sai com `Cache-Control: no-store`; o 409 `ENTRA_PELA_CONTA_DA_ESCOLA` e o `CONFLITO` saem do service.
 */
@Controller('v1/usuarios')
export class SenhaProvisoriaController {
  constructor(private readonly senhas: SenhaProvisoriaService) {}

  /**
   * `GET /v1/usuarios/:usuarioId/senha-provisoria` (tarefa 17.0): o aluno que a confirmação mostra, `{ nome, turma, matricula, entraPelaContaDaEscola }`, com a mesma célula da matriz e o
   * mesmo escopo da geração. Não gasta cota nem trava a linha; sai com `no-store`, porque leva a matrícula.
   */
  @Get(':usuarioId/senha-provisoria')
  @RequirePermissao('senha_provisoria', 'gerar')
  @Header('Cache-Control', 'no-store')
  alvo(@Param('usuarioId', IdPipe) alunoId: string): Promise<AlvoDaSenhaProvisoriaResponse> {
    return this.senhas.lerAlvo(alunoId)
  }

  @Post(':usuarioId/senha-provisoria')
  @RequirePermissao('senha_provisoria', 'gerar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  gerar(@Param('usuarioId', IdPipe) alunoId: string): Promise<SenhaProvisoriaResponse> {
    return this.senhas.gerar(alunoId)
  }
}
