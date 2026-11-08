import { Public, ZodValidationPipe } from '@educa/core'
import { verificarContaRequestSchema, type VerificarContaRequest } from '@educa/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { SenhaService } from './senha.service.js'

/**
 * `POST /v1/conta/verificar` (acesso-e-convites, tarefa 7.0, RF12): a pessoa abre o link de verificar que chegou ao e-mail da conta e prova a posse dele. Anônima, e por isso
 * limitada pelo IP da rota anônima. O token vem no corpo, lido pela web do fragmento do link, nunca na URL (regra 20, item 8), e a resposta sai com `no-store`. Sem corpo: 204 para
 * o link que valia, `NAO_ENCONTRADO` igual para vencido, usado, substituído e inexistente.
 */
@Public()
@Controller('v1/conta')
export class ContaController {
  constructor(private readonly senha: SenhaService) {}

  @Post('verificar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async verificar(@Body(new ZodValidationPipe(verificarContaRequestSchema)) pedido: VerificarContaRequest): Promise<void> {
    await this.senha.verificar(pedido)
  }
}
