import { requestIp, DomainException, PROVEDORES_EXTERNOS, TrustedProxies, Public, ZodValidationPipe, type ProvedorExterno } from '@educa/core'
import { ErrorCode, slugDaEscolaSchema, TAMANHO_MAXIMO_CODIGO_DIGITADO, TAMANHO_MAXIMO_TOKEN_DE_CONVITE } from '@educa/shared'
import { Controller, Get, Inject, Param, Query, Req, Res } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import { ExternalLoginService, type Redirect } from './external-login.service.js'
import { SALA_PARA_A_CONTA, type SalaParaAConta } from './sala-para-a-conta.js'

/** O provedor e o slug que não têm o formato de nenhum existente respondem como o inexistente (regra 10, item 6). */
const COMO_INEXISTENTE = { errorCode: ErrorCode.NAO_ENCONTRADO }
const provedorSchema = z.enum(PROVEDORES_EXTERNOS)
/** O slug da query vem digitado na barra de endereço da escola: espaço em volta é cortado antes do formato. */
const slugDigitadoSchema = z.string().trim().pipe(slugDaEscolaSchema)

/**
 * A query do `iniciar`: o slug e, só para o pedido do nome (acesso-e-convites, 14.0), `intencao=reivindicar` com o token do link **ou**
 * o código da sala; ou, para o aluno que já entrou ligar a conta em "Eu" (15.0), `intencao=ligar`, sem token nem código. Token ou código sem
 * `intencao`, a `intencao` `reivindicar` sem um deles ou com os dois, `ligar` com um deles e qualquer outra `intencao` respondem como o
 * inexistente. Campo a mais é ignorado, como sempre foi.
 */
const consultaDoIniciarSchema = z
  .object({
    slug: slugDigitadoSchema,
    intencao: z.enum(['reivindicar', 'ligar']).optional(),
    token: z.string().min(1).max(TAMANHO_MAXIMO_TOKEN_DE_CONVITE).optional(),
    codigo: z.string().min(1).max(TAMANHO_MAXIMO_CODIGO_DIGITADO).optional(),
  })
  .refine((consulta) => (consulta.intencao === 'reivindicar' ? (consulta.token === undefined) !== (consulta.codigo === undefined) : consulta.token === undefined && consulta.codigo === undefined))

/** Responde o redirecionamento: 302, sem cache, sem `Referer` com o código do provedor. */
function redirecionar(resposta: ServerResponse, { endereco, cookies }: Redirect): void {
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
 * precisa; a regra está no `ExternalLoginService`.
 */
@Public()
@Controller('v1/sessao/externa')
export class ExternalLoginController {
  constructor(
    private readonly login: ExternalLoginService,
    private readonly proxies: TrustedProxies,
    @Inject(SALA_PARA_A_CONTA) private readonly sala: SalaParaAConta,
  ) {}

  /**
   * `GET /v1/sessao/externa/:provedor/iniciar?slug=`: vai ao provedor, ou 404 se o provedor ou o slug não têm o formato, ou se a escola não o oferece.
   * Com `&intencao=reivindicar&token=` (ou `&codigo=`), o aluno prova a conta para pedir o nome: a sala é achada aqui, pelo link ou pelo código na escola
   * do slug, e o login fica preso ao acesso dela (14.0). Com `&intencao=ligar`, o aluno que já entrou liga a conta da escola em "Eu": a sessão dele vem do cookie de renovação (15.0).
   */
  @Get(':provedor/iniciar')
  async iniciar(
    @Param('provedor', new ZodValidationPipe(provedorSchema, COMO_INEXISTENTE)) provedor: ProvedorExterno,
    @Query(new ZodValidationPipe(consultaDoIniciarSchema, COMO_INEXISTENTE)) consulta: z.infer<typeof consultaDoIniciarSchema>,
    @Req() requisicao: IncomingMessage,
    @Res() resposta: ServerResponse,
  ): Promise<void> {
    if (consulta.intencao === undefined) return redirecionar(resposta, await this.login.iniciar(provedor, consulta.slug))
    if (consulta.intencao === 'ligar') return redirecionar(resposta, await this.login.iniciarParaLigar(provedor, consulta.slug, requisicao.headers.cookie))
    const { slug, token, codigo } = consulta
    const entrada = token !== undefined ? { slug, token } : codigo !== undefined ? { slug, codigo } : undefined
    if (entrada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    redirecionar(resposta, await this.login.iniciar(provedor, slug, await this.sala.achar(entrada)))
  }

  /** `GET /v1/sessao/externa/retorno`: a volta do provedor. A escola vem do cookie `educa_oidc`, nunca da query. */
  @Get('retorno')
  async retorno(@Req() requisicao: IncomingMessage, @Res() resposta: ServerResponse): Promise<void> {
    const consulta = new URL(requisicao.url ?? '/', 'http://retorno.invalid').search
    const origem = { ip: await requestIp(requisicao, this.proxies), cabecalhoCookie: requisicao.headers.cookie }
    redirecionar(resposta, await this.login.retorno(consulta, origem))
  }
}
