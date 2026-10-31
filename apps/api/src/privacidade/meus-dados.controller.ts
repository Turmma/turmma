import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/core'
import { emptyBodyRequestSchema, type EmptyBodyRequest, type ArquivoResponse, type MeusDadosResponse } from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { PrivacidadeService } from './privacidade.service.js'

/**
 * `/v1/meus-dados` (F3, tarefa 13.0; Tech Spec do F3, seção 4): do **aluno** e do **professor**, só sobre si mesmos. A
 * coordenação não é titular de pedido e não tem a célula na matriz. Nada aqui recebe o id da pessoa: ele vem da sessão
 * (regra 10, item 4), e a resposta de "não é seu" é a do inexistente (regra 10, item 6).
 */
@Controller('v1/meus-dados')
export class MeusDadosController {
  constructor(private readonly privacidade: PrivacidadeService) {}

  /** Os pedidos da própria pessoa na escola ativa, com o estado e a validade do arquivo, e o que a escola guarda dela por categoria. */
  @Get()
  @RequirePermissao('meus_dados', 'listar')
  @Header('Cache-Control', 'no-store')
  meusDados(): Promise<MeusDadosResponse> {
    return this.privacidade.meusDados()
  }

  /**
   * A URL de 5 minutos da versão completa do arquivo do próprio usuário: o nome `meus-dados-AAAA-MM-DD.json`, `attachment` e
   * `no-store` assinados. O pedido do colega, o de outra escola e o inexistente respondem igual. Auditada.
   */
  @Post(':id/baixar')
  @RequirePermissao('meus_dados', 'baixar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  baixar(@Param('id', IdPipe) pedidoId: string, @Body(new ZodValidationPipe(emptyBodyRequestSchema)) _corpo: EmptyBodyRequest): Promise<ArquivoResponse> {
    return this.privacidade.baixarMeuArquivo(pedidoId)
  }
}
