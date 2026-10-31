import { METRICS, type CronEscolasRepository, type ExpurgoDaEscolaRepository, type LoggerBase, type Meter, type Clock } from '@educa/core'
import { MedicaoPorEscola } from './medicao-por-escola.js'

const MS_POR_HORA = 3_600_000

export interface DependenciasDaMedicaoDaEliminacao {
  escolas: Pick<CronEscolasRepository, 'listarIds'>
  repositorio: Pick<ExpurgoDaEscolaRepository, 'vencimentoDoAgendadoMaisAntigo'>
  relogio: Clock
  logger: LoggerBase
  medidor: Meter
}

/**
 * `eliminacao.horas_vencida` por escola (F3, tarefa 15.0; Tech Spec do F3, seção 7c): quantas horas se passaram desde que o pedido
 * de eliminação `agendado` mais antigo da escola venceu (`eliminar_em`). O alerta "Eliminação do titular agendada há mais de 48 h
 * do prazo" dispara acima de 48 (`HORAS_AGENDADO_PARA_ALERTAR`): uma interrupção pela janela letiva é esperada e cabe nas 48 h. A
 * escola sem eliminação vencida não tem série, e a série some quando o job conclui o pedido.
 *
 * O laço, a lista de escolas, o contexto de cada uma e a exportação são da `MedicaoPorEscola`; aqui está só o que se mede numa
 * escola, lido pelo `ExpurgoDaEscolaRepository`, com o escopo do contexto. A série traz a escola e um número: nenhum id de pedido,
 * nenhum titular.
 */
export class MedicaoDaEliminacao extends MedicaoPorEscola {
  constructor(
    private readonly dependencias: DependenciasDaMedicaoDaEliminacao,
    opcoes: { intervaloMs?: number } = {},
  ) {
    super(
      dependencias,
      {
        metrica: METRICS.horasDaEliminacaoVencida,
        descricao: 'Horas desde que o pedido de eliminação agendado mais antigo da escola venceu e ainda não foi concluído',
        evento: 'worker.medicao_da_eliminacao_indisponivel',
      },
      opcoes,
    )
  }

  protected override async medirEscola(agora: Date): Promise<number | undefined> {
    const vencimento = await this.dependencias.repositorio.vencimentoDoAgendadoMaisAntigo()
    return vencimento === undefined ? undefined : Math.max(0, (agora.getTime() - vencimento.getTime()) / MS_POR_HORA)
  }
}
