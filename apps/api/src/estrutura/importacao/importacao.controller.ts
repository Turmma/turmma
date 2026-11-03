import { DomainException, RequirePermissao, ZodValidationPipe } from '@educa/core'
import {
  ErrorCode,
  TIPOS_DE_PLANILHA,
  gravarPlanilhaRequestSchema,
  previaDaPlanilhaRequestSchema,
  type GravarPlanilhaRequest,
  type GravarPlanilhaResponse,
  type PreviaDaPlanilhaRequest,
  type PreviaDaPlanilhaResponse,
  type TipoDePlanilha,
} from '@educa/shared'
import { Body, Controller, HttpCode, HttpStatus, Param, Post, type PipeTransform } from '@nestjs/common'
import { ImportacaoService } from './importacao.service.js'

/**
 * O `:tipo` do caminho. Fora das quatro planilhas, nenhuma rota existe: a resposta é a do inexistente (`NAO_ENCONTRADO`), e não
 * um 400 que confirmaria o formato (regra 10, item 6). Sem `@Injectable()`, como o `IdPipe`: o Nest instancia a classe sem argumentos.
 */
class TipoDePlanilhaPipe implements PipeTransform<unknown, TipoDePlanilha> {
  transform(valor: unknown): TipoDePlanilha {
    const tipo = TIPOS_DE_PLANILHA.find((candidato) => candidato === valor)
    if (tipo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return tipo
  }
}

/**
 * As planilhas da escola (F2, 4.0; Tech Spec, seção 4), só da coordenação, na escola e no ano da sessão: a prévia, que classifica
 * na hora, e o gravar, que responde 202 e deixa o job `estrutura.gravar-planilha` gravar. O corpo passa pelo contrato estrito
 * de `packages/shared` (campo a mais, como `escolaId`, é `ENTRADA_INVALIDA`).
 */
@Controller('v1')
export class ImportacaoController {
  constructor(private readonly importacoes: ImportacaoService) {}

  @Post('importacoes/:tipo/previa')
  @RequirePermissao('importacao_planilha', 'previa')
  @HttpCode(HttpStatus.OK)
  previa(@Param('tipo', new TipoDePlanilhaPipe()) tipo: TipoDePlanilha, @Body(new ZodValidationPipe(previaDaPlanilhaRequestSchema)) pedido: PreviaDaPlanilhaRequest): Promise<PreviaDaPlanilhaResponse> {
    return this.importacoes.previa(tipo, pedido)
  }

  @Post('importacoes/:tipo')
  @RequirePermissao('importacao_planilha', 'gravar')
  @HttpCode(HttpStatus.ACCEPTED)
  gravar(@Param('tipo', new TipoDePlanilhaPipe()) tipo: TipoDePlanilha, @Body(new ZodValidationPipe(gravarPlanilhaRequestSchema)) pedido: GravarPlanilhaRequest): Promise<GravarPlanilhaResponse> {
    return this.importacoes.gravar(tipo, pedido)
  }
}
