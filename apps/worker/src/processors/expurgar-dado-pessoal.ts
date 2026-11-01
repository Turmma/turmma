import {
  currentContext,
  runInContext,
  summarizeError,
  type Database,
  type OperationalSettings,
  type JobOutbox,
  type CronEscolasRepository,
  type JanelaLetiva,
  type LoggerBase,
  type Clock,
} from '@educa/core'
import { JobFailureCode, InvariantException, TIPO_EXPURGAR_ESCOLA, type TIPO_EXPURGAR_DADO_PESSOAL } from '@educa/shared'
import type { JobProcessor } from '../job-executor.js'
import { JobFailureError } from '../job-failure.error.js'

/** A data local de `agora` no `fuso`, `AAAA-MM-DD`: a chave de idempotência do expurgo da escola naquela noite. */
export function chaveDaNoite(fuso: string, agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
}

export interface ExpurgoRoutineDependencies {
  escolas: Pick<CronEscolasRepository, 'listarIds'>
  banco: Database
  enfileirador: Pick<JobOutbox, 'enfileirarUmaVez'>
  /** O horário letivo da escola do contexto: dele sai o fuso da data local da chave. */
  janelaDaEscola: Pick<OperationalSettings<JanelaLetiva>, 'daEscola'>
  relogio: Clock
  logger: LoggerBase
}

/**
 * `sistema.expurgar-dado-pessoal` (F3, tarefa 3.0; Tech Spec do F3, seção 5), à 1h: lista as escolas
 * (`CronEscolasRepository`, a única consulta sem escopo da rotina) e, **no contexto de cada uma**, grava um
 * `retencao.expurgar-escola` na fila de lote, não urgente, pelo `JobOutbox`, com a chave "a data local da noite" no
 * fuso da escola. Rodar duas vezes na mesma noite, ou duas réplicas ao mesmo tempo, dá um job por escola: a segunda
 * gravação colide na chave e é "já enfileirado".
 *
 * Uma escola que falha não segura as outras: a rotina segue e, no fim, falha o job, para a fila tentar de novo (as que
 * já foram enfileiradas colidem na chave). Loga só contagens, e a escola que falhou pelo id.
 */
export function criarRotinaDeExpurgo({ escolas, banco, enfileirador, janelaDaEscola, relogio, logger }: ExpurgoRoutineDependencies): JobProcessor<typeof TIPO_EXPURGAR_DADO_PESSOAL> {
  return async () => {
    const contexto = currentContext()
    if (contexto?.rotinaDoSistema !== true) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
    const agora = relogio.agora()
    const ids = await escolas.listarIds()
    let enfileiradosTotal = 0
    let jaEnfileiradosTotal = 0
    let falhasTotal = 0
    for (const escolaId of ids) {
      try {
        const resultado = await runInContext({ requisicaoId: contexto.requisicaoId, escolaId }, async () => {
          const { fuso } = await janelaDaEscola.daEscola()
          return banco.transaction((tx) => enfileirador.enfileirarUmaVez(tx, TIPO_EXPURGAR_ESCOLA, {}, chaveDaNoite(fuso, agora)))
        })
        if (resultado.situacao === 'enfileirado') enfileiradosTotal += 1
        else jaEnfileiradosTotal += 1
      } catch (erro) {
        falhasTotal += 1
        logger.warn({ evento: 'retencao.escola_nao_enfileirada', escolaId, erro: summarizeError(erro) })
      }
    }
    const escolasTotal = ids.length
    logger.info({ evento: 'retencao.rotina_disparada', escolasTotal, enfileiradosTotal, jaEnfileiradosTotal, falhasTotal })
    if (falhasTotal > 0) throw new InvariantException('expurgo não enfileirado em alguma escola')
  }
}
