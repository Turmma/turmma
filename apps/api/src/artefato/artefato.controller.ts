import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/core'
import {
  ErrorCode,
  artefatosQuerySchema,
  adaptarArtefatoRequestSchema,
  indiceDaQuestaoSchema,
  renomearArtefatoRequestSchema,
  trocarHabilidadeRequestSchema,
  type ArtefatosQuery,
  type AdaptarArtefatoRequest,
  type RenomearArtefatoRequest,
  type TrocarHabilidadeRequest,
  type ArtefatoResponse,
  type ExecucaoAceitaResponse,
  type ListaDeArtefatosResponse,
} from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Injectable, Param, Patch, Post, Query, StreamableFile, UseGuards, type CanActivate } from '@nestjs/common'
import { ArtefatoService } from './artefato.service.js'

/**
 * O teto das trocas de habilidade conferido **antes** de o corpo ser lido (classificacao-bncc, 11.0): 100 por hora por pessoa e 300 por escola, contados na auditoria. Mesma posição das guardas do material: depois das guardas
 * globais (a sessão e a permissão já estão no contexto) e antes do pipe que valida o corpo. Acima do teto, `LIMITE_EXCEDIDO` com `Retry-After`.
 */
@Injectable()
export class ArtefatoTrocarHabilidadeGuard implements CanActivate {
  constructor(private readonly artefatos: ArtefatoService) {}

  async canActivate(): Promise<boolean> {
    await this.artefatos.exigirTrocaDentroDosTetos()
    return true
  }
}

/**
 * `/v1/artefatos` (MVP, A2): o que as ferramentas do Assistente produziram. Todas as células são `turma_vinculada`, só
 * do professor; coordenação e aluno são recusados pela guarda. O corpo e a consulta passam pelo contrato estrito
 * (campo a mais é `ENTRADA_INVALIDA`: a Adaptação não tem onde receber texto), e o `:id` fora do formato responde como
 * o inexistente. O artefato tem o gabarito: toda leitura sai com `no-store`. A entrada passa pelo `ZodValidationPipe` e
 * pelo `IdPipe` no parâmetro (17.0).
 */
@Controller('v1/artefatos')
export class ArtefatoController {
  constructor(private readonly artefatos: ArtefatoService) {}

  @Get()
  @RequirePermissao('artefato', 'listar')
  @Header('Cache-Control', 'no-store')
  list(@Query(new ZodValidationPipe(artefatosQuerySchema)) consulta: ArtefatosQuery): Promise<ListaDeArtefatosResponse> {
    return this.artefatos.list(consulta)
  }

  @Get(':id')
  @RequirePermissao('artefato', 'ler')
  @Header('Cache-Control', 'no-store')
  read(@Param('id', IdPipe) artefatoId: string): Promise<ArtefatoResponse> {
    return this.artefatos.read(artefatoId)
  }

  @Patch(':id')
  @RequirePermissao('artefato', 'renomear')
  @Header('Cache-Control', 'no-store')
  renomear(@Param('id', IdPipe) artefatoId: string, @Body(new ZodValidationPipe(renomearArtefatoRequestSchema)) pedido: RenomearArtefatoRequest): Promise<ArtefatoResponse> {
    return this.artefatos.renomear(artefatoId, pedido)
  }

  /**
   * O professor troca a habilidade de uma questão do artefato dele, antes de aplicar (classificacao-bncc, 11.0; RF9): o `:indice` (a partir de zero) e o `:id` fora do formato respondem como o inexistente, e o corpo passa pelo contrato
   * estrito (`codigo` da BNCC ou `null`). A ordem das respostas e a trava são do service.
   */
  @Patch(':id/questoes/:indice/habilidade')
  @RequirePermissao('artefato', 'trocar_habilidade')
  @UseGuards(ArtefatoTrocarHabilidadeGuard)
  @Header('Cache-Control', 'no-store')
  trocarHabilidade(
    @Param('id', IdPipe) artefatoId: string,
    @Param('indice', new ZodValidationPipe(indiceDaQuestaoSchema, { errorCode: ErrorCode.NAO_ENCONTRADO })) indice: number,
    @Body(new ZodValidationPipe(trocarHabilidadeRequestSchema)) pedido: TrocarHabilidadeRequest,
  ): Promise<ArtefatoResponse> {
    return this.artefatos.trocarHabilidade(artefatoId, indice, pedido)
  }

  @Get(':id/pdf')
  @RequirePermissao('artefato', 'exportar')
  @Header('Cache-Control', 'no-store')
  async pdf(@Param('id', IdPipe) artefatoId: string): Promise<StreamableFile> {
    const { nome, bytes } = await this.artefatos.pdf(artefatoId)
    return new StreamableFile(bytes, { type: 'application/pdf', disposition: `attachment; filename="${nome}"`, length: bytes.length })
  }

  @Post(':id/adaptar')
  @RequirePermissao('artefato', 'adaptar')
  @HttpCode(HttpStatus.ACCEPTED)
  adaptar(@Param('id', IdPipe) artefatoId: string, @Body(new ZodValidationPipe(adaptarArtefatoRequestSchema)) pedido: AdaptarArtefatoRequest): Promise<ExecucaoAceitaResponse> {
    return this.artefatos.adaptar(artefatoId, pedido)
  }
}
