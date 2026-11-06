import { METRICS, type CronEscolasRepository, type ImportacaoRepository, type LoggerBase, type Meter, type Clock } from '@educa/core'
import { EscolaGauge } from './escola-gauge.js'

const MS_POR_MINUTO = 60_000

export interface ImportacaoGaugeDependencies {
  escolas: Pick<CronEscolasRepository, 'listarIds'>
  repositorio: Pick<ImportacaoRepository, 'criadaEmDaNaFilaMaisAntiga'>
  relogio: Clock
  logger: LoggerBase
  medidor: Meter
}

/**
 * `importacao.minutos_na_fila` por escola (F2, tarefa 5.0; Tech Spec, seção 7c): há quantos minutos a importação de planilha mais
 * antiga da escola espera o job. O alerta "Importação de planilha parada na fila" dispara acima de 30. A escola sem importação
 * `na_fila` não tem série, e a série some quando o job termina ou o expurgo fecha a parada.
 *
 * O laço, a lista de escolas, o contexto de cada uma e a exportação são da `EscolaGauge`; aqui está só o que se mede numa escola,
 * lido pelo `ImportacaoRepository`, com o escopo do contexto. A série traz a escola e um número: nenhum id de importação, nenhum
 * autor.
 */
export class ImportacaoGauge extends EscolaGauge {
  constructor(
    private readonly dependencias: ImportacaoGaugeDependencies,
    opcoes: { intervaloMs?: number } = {},
  ) {
    super(
      dependencias,
      {
        metrica: METRICS.minutosDaImportacaoNaFila,
        descricao: 'Minutos que a importação de planilha mais antiga da escola espera na fila do job',
        evento: 'worker.medicao_da_importacao_indisponivel',
      },
      opcoes,
    )
  }

  protected override async medirEscola(agora: Date): Promise<number | undefined> {
    const criadaEm = await this.dependencias.repositorio.criadaEmDaNaFilaMaisAntiga()
    return criadaEm === undefined ? undefined : (agora.getTime() - criadaEm.getTime()) / MS_POR_MINUTO
  }
}
