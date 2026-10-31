import { requestIp, TrustedProxies, ZodValidationPipe } from '@educa/core'
import { operadorEmptyBodyRequestSchema, renovacaoDeOperadorResponseSchema, type OperadorEmptyBodyRequest, type RenovacaoDeOperadorResponse } from '@educa/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { OperacaoLoginRoute } from '../decorators.js'
import { OperadorRefreshRejectedError, SessaoDoOperadorService } from './sessao.service.js'

/** O corpo das duas rotas é vazio: sem corpo (o Express 5 deixa `req.body` indefinido), ou `{}`. Qualquer campo é `ENTRADA_INVALIDA`. */
const emptyBodySchema = operadorEmptyBodyRequestSchema.default({})

/**
 * `POST /v1/operacao/sessao/renovar` e `POST /v1/operacao/sessao/sair` (Tech Spec da A0, seção 4): as duas últimas das
 * sete rotas de entrada. Sem token de acesso (ele pode ter vencido): a credencial é o cookie `turmma_operacao`, que só
 * vai a `/v1/operacao/sessao`, e quem o confere é o service.
 *
 * Limite (seção 5, "Limite"): as duas usam o limite por IP da operação (`rl:ip:op`, com o teto do anônimo e balde
 * próprio, tarefa 9.0 da A0b), que recusa com 429 (C32), como as rotas iguais do F1 no `rl:ip`. Saem com `no-store`, e
 * o contrato estrito recusa corpo com campo e não deixa sair campo a mais (C39).
 */
@Controller('v1/operacao/sessao')
export class SessaoDoOperadorController {
  constructor(
    @Inject(SessaoDoOperadorService) private readonly sessoes: SessaoDoOperadorService,
    @Inject(TrustedProxies) private readonly proxies: TrustedProxies,
  ) {}

  @Post('renovar')
  @OperacaoLoginRoute()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async renovar(
    @Body(new ZodValidationPipe(emptyBodySchema)) _corpo: OperadorEmptyBodyRequest,
    @Req() requisicao: IncomingMessage,
    @Res({ passthrough: true }) resposta: ServerResponse,
  ): Promise<RenovacaoDeOperadorResponse> {
    try {
      const renovada = await this.sessoes.renovar({ cabecalhoCookie: requisicao.headers.cookie })
      const corpoDaResposta = renovacaoDeOperadorResponseSchema.parse(renovada.resposta)
      if (renovada.cookies.length > 0) resposta.setHeader('Set-Cookie', [...renovada.cookies])
      return corpoDaResposta
    } catch (erro) {
      // O cookie que não vale mais sai do navegador junto com o 401.
      if (erro instanceof OperadorRefreshRejectedError) resposta.setHeader('Set-Cookie', [...erro.cookies])
      throw erro
    }
  }

  @Post('sair')
  @OperacaoLoginRoute()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async sair(@Body(new ZodValidationPipe(emptyBodySchema)) _corpo: OperadorEmptyBodyRequest, @Req() requisicao: IncomingMessage, @Res({ passthrough: true }) resposta: ServerResponse): Promise<void> {
    const cookies = await this.sessoes.sair({ cabecalhoCookie: requisicao.headers.cookie, ip: await requestIp(requisicao, this.proxies) })
    resposta.setHeader('Set-Cookie', [...cookies])
  }
}
