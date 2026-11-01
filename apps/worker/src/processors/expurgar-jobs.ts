import { currentContext, LOTE_DO_EXPURGO, type ExpurgoDeJobsRepository, type LoggerBase } from '@educa/core'
import { JobFailureCode, type TIPO_EXPURGAR_JOBS } from '@educa/shared'
import type { JobProcessor } from '../job-executor.js'
import { JobFailureError } from '../job-failure.error.js'

export interface ExpurgoDeJobsDependencies {
  repositorio: Pick<ExpurgoDeJobsRepository, 'apagarLoteVencido'>
  logger: LoggerBase
  /** Linhas por lote. Só o teste troca. */
  lote?: number
}

/**
 * `sistema.expurgar-jobs`: apaga de `job_registro` o job concluído há mais de 7 dias e o falho há mais de 30, menos o
 * falho de `titular.*`, que fica até a ação do operador (44.0); um lote de 5.000 por instrução, até sobrar lote
 * incompleto. Cada lote é uma transação curta, então o expurgo de uma noite com 100 mil linhas não segura lock que
 * atrase o despachante.
 *
 * Tolera reexecução (D49): o que já saiu não volta, e apagar de novo não apaga nada. Duas execuções ao
 * mesmo tempo pegam linhas diferentes; o lote de um worker que morreu no meio é desfeito pelo Postgres
 * e sai na execução seguinte.
 */
export function criarExpurgoDeJobs({ repositorio, logger, lote = LOTE_DO_EXPURGO }: ExpurgoDeJobsDependencies): JobProcessor<typeof TIPO_EXPURGAR_JOBS> {
  return async () => {
    if (currentContext()?.rotinaDoSistema !== true) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
    let total = 0
    let lotesTotal = 0
    for (;;) {
      const apagadas = await repositorio.apagarLoteVencido(lote)
      total += apagadas
      lotesTotal += 1
      if (apagadas < lote) break
    }
    logger.info({ evento: 'job_registro.expurgado', total, lotesTotal })
  }
}
