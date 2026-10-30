import { RequirePermissao } from '@educa/nucleo'
import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { RegistroDeAtividade } from './atividade.service.js'

/**
 * `POST /v1/sessao/atividade`: a web avisa que houve ponteiro ou teclado, no máximo a cada 5 min. Responde 204 na hora;
 * a gravação segue depois, e a falha dela não vira erro para ninguém.
 */
@Controller('v1/sessao')
export class AtividadeController {
  constructor(private readonly atividade: RegistroDeAtividade) {}

  @Post('atividade')
  @RequirePermissao('sessao', 'registrar_atividade')
  @HttpCode(HttpStatus.NO_CONTENT)
  registrar(): void {
    void this.atividade.registrarAtividade()
  }
}
