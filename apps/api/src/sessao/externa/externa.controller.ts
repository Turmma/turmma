import { requestIp, PROVEDORES_EXTERNOS, TrustedProxies, Public, ZodValidationPipe, type ProvedorExterno } from '@educa/nucleo'
import { ErrorCode, slugDaEscolaSchema } from '@educa/shared'
import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import { LoginExterno, type Redirecionamento } from './externa.service.js'

/** O provedor e o slug que não têm o formato de nenhum existente respondem como o inexistente (regra 10, item 6). */
const COMO_INEXISTENTE = { errorCode: ErrorCode.NAO_ENCONTRADO }
const esquemaProvedor = z.enum(PROVEDORES_EXTERNOS)
/** O slug da query vem digitado na barra de endereço da escola: espaço em volta é cortado antes do formato. */
const esquemaSlugDigitado = z.string().trim().pipe(slugDaEscolaSchema)

/** Responde o redirecionamento: 302, sem cache, sem `Referer` com o código do provedor. */
function redirecionar(resposta: ServerResponse, { endereco, cookies }: Redirecionamento): void {
  resposta.statusCode = 302
  resposta.setHeader('Location', endereco)
  resposta.setHeader('Cache-Control', 'no-store')
  resposta.setHeader('Referrer-Policy', 'no-referrer')
  if (cookies.length > 0) resposta.setHeader('Set-Cookie', [...cookies])
  resposta.end()
}

/**
 * O login pela conta Google ou Microsoft da escola (13.0): as duas rotas são navegação do navegador, e respondem com
 * redirecionamento. Anônimas, com o limite por IP da rota anônima. O controller só tira da requisição o que o serviço
 * precisa; a regra está no `LoginExterno`.
 */
@Public()
@Controller('v1/sessao/externa')
export class LoginExternoController {
  constructor(
    private readonly login: LoginExterno,
    private readonly proxies: TrustedProxies,
  ) {}

  /** `GET /v1/sessao/externa/:provedor/iniciar?slug=`: vai ao provedor, ou 404 se o provedor ou o slug não têm o formato, ou se a escola não o oferece. */
  @Get(':provedor/iniciar')
  async iniciar(
    @Param('provedor', new ZodValidationPipe(esquemaProvedor, COMO_INEXISTENTE)) provedor: ProvedorExterno,
    @Query('slug', new ZodValidationPipe(esquemaSlugDigitado, COMO_INEXISTENTE)) slug: string,
    @Res() resposta: ServerResponse,
  ): Promise<void> {
    redirecionar(resposta, await this.login.iniciar(provedor, slug))
  }

  /** `GET /v1/sessao/externa/retorno`: a volta do provedor. A escola vem do cookie `educa_oidc`, nunca da query. */
  @Get('retorno')
  async retorno(@Req() requisicao: IncomingMessage, @Res() resposta: ServerResponse): Promise<void> {
    const consulta = new URL(requisicao.url ?? '/', 'http://retorno.invalid').search
    const origem = { ip: await requestIp(requisicao, this.proxies), cabecalhoCookie: requisicao.headers.cookie }
    redirecionar(resposta, await this.login.retorno(consulta, origem))
  }
}
