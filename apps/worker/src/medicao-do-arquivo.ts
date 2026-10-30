import { METRICS, type ArquivoDoTitularRepository, type CronEscolasRepository, type LoggerBase, type Meter, type Clock } from '@educa/nucleo'
import { MedicaoPorEscola } from './medicao-por-escola.js'

const MS_POR_HORA = 3_600_000

export interface DependenciasDaMedicaoDoArquivo {
  escolas: Pick<CronEscolasRepository, 'listarIds'>
  repositorio: Pick<ArquivoDoTitularRepository, 'registradoEmDoEmPreparacaoMaisAntigo'>
  relogio: Clock
  logger: LoggerBase
  medidor: Meter
}

/**
 * `arquivo.horas_em_preparacao` por escola (F3, tarefa 13.0; Tech Spec do F3, seção 7c): quantas horas o pedido de acesso ou
 * de portabilidade mais antigo da escola espera `em_preparacao`. O alerta "Arquivo do titular em preparação há mais de 2 h"
 * dispara acima de 2 (`HORAS_EM_PREPARACAO_PARA_ALERTAR`). A escola sem pedido em preparação não tem série, e a série some quando
 * o job termina e o pedido fica `pronto`.
 *
 * O laço, a lista de escolas, o contexto de cada uma e a exportação são da `MedicaoPorEscola`; aqui está só o que se mede numa
 * escola, lido pelo `ArquivoDoTitularRepository`, com o escopo do contexto. A série traz a escola e um número: nenhum id de
 * pedido, nenhum titular.
 */
export class MedicaoDoArquivo extends MedicaoPorEscola {
  constructor(
    private readonly dependencias: DependenciasDaMedicaoDoArquivo,
    opcoes: { intervaloMs?: number } = {},
  ) {
    super(
      dependencias,
      {
        metrica: METRICS.horasDoArquivoEmPreparacao,
        descricao: 'Horas que o pedido de acesso mais antigo da escola espera o arquivo do titular ficar pronto',
        evento: 'worker.medicao_do_arquivo_indisponivel',
      },
      opcoes,
    )
  }

  protected override async medirEscola(agora: Date): Promise<number | undefined> {
    const registradoEm = await this.dependencias.repositorio.registradoEmDoEmPreparacaoMaisAntigo()
    return registradoEm === undefined ? undefined : (agora.getTime() - registradoEm.getTime()) / MS_POR_HORA
  }
}
