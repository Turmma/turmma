import { Public, ZodValidationPipe } from '@educa/core'
import {
  abrirSalaRequestSchema,
  reivindicarSalaRequestSchema,
  type AbrirSalaRequest,
  type ReivindicarSalaRequest,
  type ReivindicacaoResponse,
  type SalaAbertaResponse,
} from '@educa/shared'
import { Body, Controller, Header, Headers, HttpCode, HttpStatus, Post, Res } from '@nestjs/common'
import type { ServerResponse } from 'node:http'
import { lerCookie } from '../../credencial/index.js'
import { COOKIE_CONTA_PROVADA, CookieContaProvada } from '../../sessao/index.js'
import { ReivindicacaoService } from '../reivindicacao/reivindicacao.service.js'
import { SalasService } from './salas.service.js'

/**
 * `POST /v1/salas/abrir` (A1, tarefa 5.0) e `POST /v1/salas/reivindicar` (6.0): a página pública da sala, sem login.
 * Anônimas, e por isso contadas no limite por IP da rota anônima (`rl:ip`; Tech Spec da A1, 7c). O slug, o token ou o
 * código, a matrícula e a senha vêm no corpo, nunca na URL, que fica em log de borda. A única exceção é o início do login pela
 * conta da escola (`GET /v1/sessao/externa/:provedor/iniciar?intencao=reivindicar`, 14.0), que leva o token ou o código na
 * query: a borda não grava log de acesso (`infra/Caddyfile`), mas a URL pode ficar no histórico do navegador do computador da
 * escola (`docs/lgpd.md`, linha do acesso da turma). O corpo passa pelo contrato
 * estrito (`escolaId`, `turmaId` ou campo a mais é `ENTRADA_INVALIDA`), e a resposta sai com `no-store`. Nenhum registro
 * de acesso é gravado. O único cookie lido é o `educa_conta_provada`, e só no pedido sem senha (acesso-e-convites, 14.0).
 */
@Public()
@Controller('v1/salas')
export class SalasController {
  constructor(
    private readonly salas: SalasService,
    private readonly reivindicacoes: ReivindicacaoService,
    private readonly contaProvada: CookieContaProvada,
  ) {}

  @Post('abrir')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  abrir(@Body(new ZodValidationPipe(abrirSalaRequestSchema)) pedido: AbrirSalaRequest): Promise<SalaAbertaResponse> {
    return this.salas.abrir(pedido)
  }

  @Post('reivindicar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async reivindicar(
    @Body(new ZodValidationPipe(reivindicarSalaRequestSchema)) pedido: ReivindicarSalaRequest,
    @Headers('cookie') cabecalhoCookie: string | undefined,
    @Res({ passthrough: true }) resposta: ServerResponse,
  ): Promise<ReivindicacaoResponse> {
    // Só o pedido sem senha usa o cookie da conta provada (14.0); o com senha não o lê, e o cookie de quem chama não muda nada nele.
    if (pedido.senha !== undefined) return this.reivindicacoes.reivindicar(pedido)
    const enviado = await this.reivindicacoes.reivindicar(pedido, this.contaProvada.ler(lerCookie(cabecalhoCookie, COOKIE_CONTA_PROVADA)))
    // O cookie vale para um pedido: gravado (ou reenviado) o pedido, ele sai do navegador.
    resposta.setHeader('Set-Cookie', this.contaProvada.apagar())
    return enviado
  }
}
