import { METRICS, requireEscolaId, ROTULO_ESCOLA, type Clock, type CronEscolasRepository, type LoggerBase, type Meter, type OrcamentoDoMesRepository } from '@educa/core'
import { EscolaGauge } from './escola-gauge.js'

export interface OrcamentoGaugeDependencies {
  escolas: Pick<CronEscolasRepository, 'listIds'>
  /** O repository do mês, ligado ao banco: ele lê a escola do contexto de cada volta. */
  repositorio: Pick<OrcamentoDoMesRepository, 'regravarRetrato'>
  relogio: Clock
  logger: LoggerBase
  medidor: Meter
}

/**
 * O uso do orçamento de IA por escola (camada-ia, tarefa 4.0; Tech Spec, seções 5, 6 e 7c; RF8 e RF9): a cada 5 min, para cada escola, **uma soma só** do custo do mês civil de São Paulo, que regrava o retrato do mês
 * (`regravarRetrato`, `on conflict do update`) e alimenta duas séries:
 *
 * - `ia.orcamento.uso_do_mes{escola_id}`: o custo sobre o orçamento (valor por aluno × alunos ativos), 0,79 para 79%. Os alertas de 80% e de 100% leem esta.
 * - `ia.orcamento.uso_do_teto{escola_id}`: o custo sobre o teto de segurança (orçamento × teto ÷ 100). Acima de 1 o lote da escola espera, e o alerta do teto lê esta.
 *
 * A escola `sem_orcamento` ou `sem_aluno_ativo` **não tem série**: não há orçamento a dividir, e orçamento zero não é teto zero. O retrato dela é regravado do mesmo jeito. As duas séries nascem juntas e somem juntas:
 * a escola que falha na volta, e a lista de escolas que falha, ficam sem as duas. A série traz a escola e um número: nunca o valor em reais, os alunos ativos nem o custo.
 *
 * O laço, a lista de escolas, o contexto de cada uma e a exportação do `uso_do_mes` são da `EscolaGauge`; o `uso_do_teto` é a segunda série da mesma volta, guardada aqui e trocada junto com a primeira.
 */
export class OrcamentoGauge extends EscolaGauge {
  #doTeto = new Map<string, number>()
  #daVolta = new Map<string, number>()

  constructor(
    private readonly dependencias: OrcamentoGaugeDependencies,
    opcoes: { intervaloMs?: number } = {},
  ) {
    super(
      dependencias,
      {
        metrica: METRICS.usoDoOrcamentoDoMes,
        descricao: 'Fração do orçamento de IA do mês que a escola já gastou, por escola',
        evento: 'worker.medicao_do_orcamento_indisponivel',
      },
      opcoes,
    )
    const gauge = dependencias.medidor.createObservableGauge(METRICS.usoDoTetoDoOrcamento, { description: 'Fração do teto de segurança do orçamento de IA do mês que a escola já gastou, por escola' })
    gauge.addCallback((observador) => {
      for (const [escolaId, valor] of this.#doTeto) observador.observe(valor, { [ROTULO_ESCOLA]: escolaId })
    })
  }

  /** A volta inteira: as duas séries são trocadas juntas, ao fim dela. */
  override async medir(): Promise<void> {
    this.#daVolta = new Map()
    await super.medir()
    this.#doTeto = this.#daVolta
  }

  protected override async medirEscola(agora: Date): Promise<number | undefined> {
    const orcamento = await this.dependencias.repositorio.regravarRetrato(agora)
    const { orcamentoMicros, tetoPercentual, custoMicros } = orcamento
    // Sem orçamento (`sem_orcamento`, `sem_aluno_ativo`) o orçamento é nulo, e a escola fica sem série.
    if (orcamentoMicros === null || tetoPercentual === null) return undefined
    // A série é fração em ponto flutuante, para o gráfico e o alerta (`> 1`); quem decide se o lote espera é o `OrcamentoRepository`, em BigInt. No limite exato as duas podem divergir por um ulp, e o alerta só avisa, não corta.
    this.#daVolta.set(requireEscolaId(), custoMicros / ((orcamentoMicros * tetoPercentual) / 100))
    return custoMicros / orcamentoMicros
  }
}
