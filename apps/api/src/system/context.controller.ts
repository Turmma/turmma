import { RequirePermissao, requestSessao } from '@educa/core'
import { contextResponseSchema, type ContextResponse } from '@educa/shared'
import { Controller, Get, Header } from '@nestjs/common'

@Controller('v1/sistema/contexto')
export class ContextoController {
  /**
   * A escola, o usuário, o papel e a sessão da sessão conferida, e o ano letivo em curso da escola. Nada que o
   * cliente mande entra nesta resposta.
   */
  @Get()
  @RequirePermissao('sistema_contexto', 'ler')
  @Header('Cache-Control', 'no-store')
  obter(): ContextResponse {
    return contextResponseSchema.parse(requestSessao())
  }
}
