import { MotorDePlanilha } from '@educa/core'
import { gravarPlanilhaResponseSchema, type GravarPlanilhaRequest, type GravarPlanilhaResponse, type PreviaDaPlanilhaRequest, type PreviaDaPlanilhaResponse, type TipoDePlanilha } from '@educa/shared'

/**
 * As planilhas da escola pela coordenação (F2, 4.0). A classificação, a trava e a gravação moram no motor de `@educa/core`, que a
 * API e o worker usam pelo mesmo caminho; aqui a rota só entrega o pedido e confere a forma da resposta. Nada disto loga: o texto
 * da planilha tem nome e matrícula, e o erro sai pelo filtro global só com id.
 */
export class ImportacaoService {
  constructor(private readonly motor: MotorDePlanilha) {}

  previa(tipo: TipoDePlanilha, pedido: PreviaDaPlanilhaRequest): Promise<PreviaDaPlanilhaResponse> {
    return this.motor.previa(tipo, pedido)
  }

  async gravar(tipo: TipoDePlanilha, pedido: GravarPlanilhaRequest): Promise<GravarPlanilhaResponse> {
    return gravarPlanilhaResponseSchema.parse(await this.motor.gravar(tipo, pedido))
  }
}
