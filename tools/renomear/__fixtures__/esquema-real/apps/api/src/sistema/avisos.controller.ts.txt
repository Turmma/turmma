import { RotaAnonima } from '@educa/nucleo'
import { esquemaRespostaAvisos, type Aviso, type RespostaAvisos } from '@educa/shared'
import { Controller, Get, Header, Inject } from '@nestjs/common'

export const AVISOS_DO_SISTEMA = Symbol('AVISOS_DO_SISTEMA')

// Avisos públicos do sistema, lidos da configuração no boot: nada de escola, nada de pessoa.
@RotaAnonima()
@Controller('v1/sistema/avisos')
export class AvisosController {
  constructor(@Inject(AVISOS_DO_SISTEMA) private readonly avisos: readonly Aviso[]) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(): RespostaAvisos {
    return esquemaRespostaAvisos.parse({ itens: this.avisos })
  }
}
