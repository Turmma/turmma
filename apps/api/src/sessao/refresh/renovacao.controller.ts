import { requestIp, TrustedProxies, Public } from '@educa/core'
import { renovacaoResponseSchema, type RenovacaoResponse } from '@educa/shared'
import { Controller, Header, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { RenovacaoRecusada, RenovacaoService } from './renovacao.service.js'

/**
 * `POST /v1/sessao/renovar`: troca o cookie `educa_sessao` por um novo e devolve o token de acesso de 10 min. Anônima
 * (o token já pode ter vencido), e por isso limitada pelo IP da rota anônima; quem decide é a sessão do cookie.
 */
@Public()
@Controller('v1/sessao')
export class RenovacaoController {
  constructor(
    private readonly renovacao: RenovacaoService,
    private readonly proxies: TrustedProxies,
  ) {}

  @Post('renovar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async renovar(@Req() requisicao: IncomingMessage, @Res({ passthrough: true }) resposta: ServerResponse): Promise<RenovacaoResponse> {
    try {
      const { resposta: corpo, cookies } = await this.renovacao.renovar({
        ip: await requestIp(requisicao, this.proxies),
        cabecalhoCookie: requisicao.headers.cookie,
      })
      resposta.setHeader('Set-Cookie', [...cookies])
      return renovacaoResponseSchema.parse(corpo)
    } catch (erro) {
      // O cookie que não vale mais sai do navegador junto com o 401.
      if (erro instanceof RenovacaoRecusada) resposta.setHeader('Set-Cookie', [...erro.cookies])
      throw erro
    }
  }
}
