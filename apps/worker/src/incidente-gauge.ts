import { METRICS, type CronEscolasRepository, type IncidenteDaEscolaRepository, type LoggerBase, type Meter, type Clock } from '@educa/core'
import { MedicaoPorEscola } from './escola-gauge.js'

const MS_POR_HORA = 3_600_000

export interface DependenciasDaMedicaoDoIncidente {
  escolas: Pick<CronEscolasRepository, 'listarIds'>
  repositorio: Pick<IncidenteDaEscolaRepository, 'conhecidoEmDoPendenteMaisAntigo'>
  relogio: Clock
  logger: LoggerBase
  medidor: Meter
}

/**
 * `incidente.horas_sem_confirmacao` por escola (F3, tarefa 9.0; Tech Spec do F3, seção 7c): quantas horas se passaram desde que a
 * Turmma soube do incidente mais antigo da escola que a coordenação ainda não confirmou ter recebido. O alerta "Incidente sem
 * confirmação em 24 h" dispara acima de 24 (`HORAS_PARA_A_ESCOLA_CONFIRMAR`): o prazo nosso de avisar a escola, que conta da detecção
 * (`docs/lgpd.md`, seção 8). A escola sem incidente pendente não tem série, e a série some quando a coordenação confirma.
 *
 * O laço, a lista de escolas, o contexto de cada uma e a exportação são da `MedicaoPorEscola`; aqui está só o que se mede numa
 * escola, lido pelo `IncidenteDaEscolaRepository`, com o escopo do contexto. A série traz a escola e um número: nenhum texto do
 * incidente, nenhum id dele.
 */
export class MedicaoDoIncidente extends MedicaoPorEscola {
  constructor(
    private readonly dependencias: DependenciasDaMedicaoDoIncidente,
    opcoes: { intervaloMs?: number } = {},
  ) {
    super(
      dependencias,
      {
        metrica: METRICS.horasDoIncidenteSemConfirmacao,
        descricao: 'Horas desde que a Turmma soube do incidente mais antigo da escola que ainda não foi confirmado como recebido',
        evento: 'worker.medicao_do_incidente_indisponivel',
      },
      opcoes,
    )
  }

  protected override async medirEscola(agora: Date): Promise<number | undefined> {
    const conhecidoEm = await this.dependencias.repositorio.conhecidoEmDoPendenteMaisAntigo()
    return conhecidoEm === undefined ? undefined : (agora.getTime() - conhecidoEm.getTime()) / MS_POR_HORA
  }
}
