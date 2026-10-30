import { Public, ZodValidationPipe } from '@educa/nucleo'
import {
  abrirSalaRequestSchema,
  reivindicarSalaRequestSchema,
  type AbrirSalaRequest,
  type ReivindicarSalaRequest,
  type ReivindicacaoResponse,
  type SalaAbertaResponse,
} from '@educa/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ReivindicacaoService } from '../reivindicacao/reivindicacao.service.js'
import { SalasService } from './salas.service.js'

/**
 * `POST /v1/salas/abrir` (A1, tarefa 5.0) e `POST /v1/salas/reivindicar` (6.0): a página pública da sala, sem login.
 * Anônimas, e por isso contadas no limite por IP da rota anônima (`rl:ip`; Tech Spec da A1, 7c). O slug, o token ou o
 * código, a matrícula e a senha vêm no corpo, nunca na URL, que fica em log de borda. O corpo passa pelo contrato
 * estrito (`escolaId`, `turmaId` ou campo a mais é `ENTRADA_INVALIDA`), e a resposta sai com `no-store`. Nenhum cookie é
 * lido e nenhum registro de acesso é gravado.
 */
@Public()
@Controller('v1/salas')
export class SalasController {
  constructor(
    private readonly salas: SalasService,
    private readonly reivindicacoes: ReivindicacaoService,
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
  reivindicar(@Body(new ZodValidationPipe(reivindicarSalaRequestSchema)) pedido: ReivindicarSalaRequest): Promise<ReivindicacaoResponse> {
    return this.reivindicacoes.reivindicar(pedido)
  }
}
