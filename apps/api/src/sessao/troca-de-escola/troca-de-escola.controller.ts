import { AceitaDesafio, bearerDeDesafio, extrairTokenBearer, ipDaRequisicao, Permite, ProxiesConfiaveis, ZodValidationPipe } from '@educa/nucleo'
import { trocaDeEscolaRequestSchema, loginResponseSchema, type TrocaDeEscolaRequest, type LoginResponse } from '@educa/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { TrocaDeEscolaService } from './troca-de-escola.service.js'

/**
 * `POST /v1/sessao/escola` (tarefa 12.0): com o desafio `escolher` no `Authorization`, conclui a escolha do login; com
 * o token de acesso de uma sessão de e-mail, troca de escola. O desafio passa pelas guardas como rota anônima
 * (`@AceitaDesafio`), e o service o verifica inteiro; o token segue a guarda de sessão e a célula
 * `sessao.trocar_escola` da matriz, que o aluno não tem.
 */
@Controller('v1/sessao')
export class TrocaDeEscolaController {
  constructor(
    private readonly troca: TrocaDeEscolaService,
    private readonly proxies: ProxiesConfiaveis,
  ) {}

  @Post('escola')
  @AceitaDesafio()
  @Permite('sessao', 'trocar_escola')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async trocar(
    @Body(new ZodValidationPipe(trocaDeEscolaRequestSchema)) pedido: TrocaDeEscolaRequest,
    @Req() requisicao: IncomingMessage,
    @Res({ passthrough: true }) resposta: ServerResponse,
  ): Promise<LoginResponse> {
    const origem = { ip: await ipDaRequisicao(requisicao, this.proxies), cabecalhoCookie: requisicao.headers.cookie }
    const { authorization } = requisicao.headers
    const { resposta: corpoDaResposta, cookies } = bearerDeDesafio(authorization)
      ? await this.troca.escolher(extrairTokenBearer(authorization), pedido, origem)
      : await this.troca.trocar(pedido, origem)
    resposta.setHeader('Set-Cookie', [...cookies])
    return loginResponseSchema.parse(corpoDaResposta)
  }
}
