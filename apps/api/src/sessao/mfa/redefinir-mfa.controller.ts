import { IdPipe, Permite, ZodValidationPipe } from '@educa/nucleo'
import { redefinirMfaRequestSchema, type RedefinirMfaRequest } from '@educa/shared'
import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { RedefinicaoDeMfa } from './redefinicao-de-mfa.js'

/**
 * `POST /v1/usuarios/:id/mfa/redefinir`: a coordenação apaga o segundo fator de outro coordenador da escola, com a
 * finalidade. Responde 202 sem corpo, sempre: quem chama não fica sabendo se o id existe, se é de outra escola, nem se
 * a conta dele trabalha em outra escola (regra 10, item 6). Id fora do formato também: nenhum id existe assim, e por
 * isso o `IdPipe` devolve `undefined` em vez de lançar (`invalidAsUndefined`). O corpo fora do esquema é o único 400.
 */
@Controller('v1/usuarios')
export class RedefinirMfaController {
  constructor(private readonly redefinicao: RedefinicaoDeMfa) {}

  @Post(':id/mfa/redefinir')
  @Permite('usuario_mfa', 'redefinir')
  @HttpCode(HttpStatus.ACCEPTED)
  async redefinir(
    @Param('id', new IdPipe({ invalidAsUndefined: true })) alvo: string | undefined,
    @Body(new ZodValidationPipe(redefinirMfaRequestSchema)) pedido: RedefinirMfaRequest,
  ): Promise<void> {
    if (alvo === undefined) return
    await this.redefinicao.pelaCoordenacao(alvo, pedido.finalidade)
  }
}
