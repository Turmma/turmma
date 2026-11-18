import { METRICS, ultimaNoite, type ClassificacaoAtrasadaRepository, type Clock, type CronEscolasRepository, type JanelaLetiva, type LoggerBase, type Meter, type OperationalSettings } from '@educa/core'
import { EscolaGauge } from './escola-gauge.js'

export interface ClassificacaoGaugeDependencies {
  escolas: Pick<CronEscolasRepository, 'listarIds'>
  repositorio: Pick<ClassificacaoAtrasadaRepository, 'atrasadas'>
  /** O horário letivo da escola do contexto: dele saem o fuso e os dias da noite que se mede. */
  janelaDaEscola: Pick<OperationalSettings<JanelaLetiva>, 'daEscola'>
  relogio: Clock
  logger: LoggerBase
  medidor: Meter
}

/**
 * `classificacao.execucoes_atrasadas` por escola (classificacao-bncc, tarefa 5.0; Tech Spec, seção 7c, "Alerta"): quantas execuções da classificação do material não terminaram a noite que passou, entre o fecho e a abertura da
 * janela letiva **da escola** (`ultimaNoite`, que usa o fuso, os dias e as horas dela): a `falhou` da noite e a `pendente` criada antes dela. A que está `pendente` e nasceu na própria noite é o excedente planejado do onboarding
 * e não conta. O alerta "Classificação do material atrasada" dispara acima de 0, e a medição vale o dia inteiro: na abertura seguinte, a noite que se julga é outra. A escola sem execução atrasada não tem série.
 *
 * O laço, a lista de escolas, o contexto de cada uma e a exportação são da `EscolaGauge`; aqui está só o que se mede numa escola. A série traz a escola e um número: nenhum id de execução, seção ou material.
 */
export class ClassificacaoGauge extends EscolaGauge {
  constructor(
    private readonly dependencias: ClassificacaoGaugeDependencies,
    opcoes: { intervaloMs?: number } = {},
  ) {
    super(
      dependencias,
      {
        metrica: METRICS.execucoesAtrasadasDaClassificacao,
        descricao: 'Execuções da classificação do material que não terminaram a noite que passou, por escola',
        evento: 'worker.medicao_da_classificacao_indisponivel',
      },
      opcoes,
    )
  }

  protected override async medirEscola(agora: Date): Promise<number | undefined> {
    const janela = await this.dependencias.janelaDaEscola.daEscola()
    const noite = ultimaNoite(janela, agora)
    if (noite === undefined) return undefined
    const atrasadas = await this.dependencias.repositorio.atrasadas(noite.fechouEm, noite.abriuEm)
    return atrasadas === 0 ? undefined : atrasadas
  }
}
