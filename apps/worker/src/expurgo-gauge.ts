import {
  CATEGORIAS_DO_EXPURGO,
  METRICS,
  noitesSeguidasSemConcluir,
  type OperationalSettings,
  type CronEscolasRepository,
  type ExpurgoDaEscolaRepository,
  type JanelaLetiva,
  type LoggerBase,
  type Meter,
  type Clock,
} from '@educa/core'
import { MedicaoPorEscola } from './escola-gauge.js'

export interface DependenciasDaMedicaoDoExpurgo {
  escolas: Pick<CronEscolasRepository, 'listarIds'>
  repositorio: Pick<ExpurgoDaEscolaRepository, 'noitesDoAlerta'>
  /** O horário letivo da escola do contexto: dele sai o fuso em que a noite é contada. */
  janelaDaEscola: Pick<OperationalSettings<JanelaLetiva>, 'daEscola'>
  relogio: Clock
  logger: LoggerBase
  medidor: Meter
}

/**
 * `expurgo.noites_incompletas` por escola (F3, tarefa 3.0; Tech Spec do F3, seção 7c): de ontem para trás, quantas
 * noites seguidas o expurgo da escola não terminou todas as categorias, contadas no fuso dela. A categoria sem linha na
 * noite conta como não concluída; a noite anterior à primeira execução da escola não conta. O alerta "Expurgo incompleto
 * por duas noites numa escola" dispara em 2.
 *
 * O laço, a lista de escolas, o contexto de cada uma e a exportação são da `MedicaoPorEscola`; aqui está só o que se mede numa
 * escola. Escola que nunca rodou o expurgo não tem série.
 */
export class MedicaoDoExpurgo extends MedicaoPorEscola {
  constructor(
    private readonly dependencias: DependenciasDaMedicaoDoExpurgo,
    opcoes: { intervaloMs?: number } = {},
  ) {
    super(
      dependencias,
      {
        metrica: METRICS.noitesIncompletasDoExpurgo,
        descricao: 'Noites seguidas em que o expurgo da escola não terminou todas as categorias',
        evento: 'worker.medicao_do_expurgo_indisponivel',
      },
      opcoes,
    )
  }

  protected override async medirEscola(agora: Date): Promise<number | undefined> {
    const { fuso } = await this.dependencias.janelaDaEscola.daEscola()
    const noites = await this.dependencias.repositorio.noitesDoAlerta(fuso, agora, CATEGORIAS_DO_EXPURGO)
    return noites === undefined ? undefined : noitesSeguidasSemConcluir(noites, CATEGORIAS_DO_EXPURGO.length)
  }
}
