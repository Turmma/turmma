import { contaDoProfessor, travarContasDoProfessor } from '@educa/core/cadastro-de-professor'
import {
  ehFalhaDeTrava,
  executarPlanilha,
  ImportacaoIlegivelError,
  ImportacaoRepository,
  METRICS,
  requireEscolaId,
  summarizeError,
  TENTATIVAS_DO_JOB,
  type Database,
  type LoggerBase,
  type Meter,
} from '@educa/core'
import { JobFailureCode, type TIPO_GRAVAR_PLANILHA } from '@educa/shared'
import { JobFailureError } from '../job-failure.error.js'
import type { JobProcessor } from '../job-executor.js'

export interface GravarPlanilhaDependencies {
  banco: Database
  logger: LoggerBase
  /** Sem ele (os testes que não olham métrica), o job não mede nada. */
  medidor?: Meter
}

/** Os limites do histograma do passo (3), em segundos: o alerta dispara acima de 1 s, e o `statement_timeout` corta em 1,5 s. */
const LIMITES_DO_PASSO_3_S = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 3]

/**
 * `estrutura.gravar-planilha` (F2, tarefa 4.0; Tech Spec, seção 5, "O job"): no contexto da escola do outbox, lê a importação
 * **dessa escola** pelo id do job, refaz a classificação e grava em três passos (`executarPlanilha`, em `@educa/core`).
 *
 * - **O passo (1) da planilha de professores acha ou cria a conta global** pelo `contaDoProfessor`, e o passo (3) trava e confere
 *   essas contas pelo `travarContasDoProfessor`; este arquivo é o único do worker a importá-los (Tech Spec, seção 6; as duas guardas
 *   de cerca): o motor, no core, recebe as duas funções e não conhece a conta global.
 * - **O job leva só o id da importação**, e a escola é a da linha do job: o id de uma importação de outra escola não é achado, e
 *   o job termina `ignorada` sem tocar nela.
 * - **A entrega é pelo menos uma vez (D49).** A segunda execução acha a importação fora de `na_fila` e sai `ignorada`, sem reler
 *   nada: o efeito é um só, pela trava `for update` e por `where estado = 'na_fila'`.
 * - **Trava esgotada ou deadlock no passo (3)** repetem com a espera crescente da fila (`nova_tentativa`); nada foi gravado, porque
 *   a transação voltou inteira. Na última tentativa, ou numa falha definitiva (a importação guardada não tem a forma do tipo), a
 *   importação sai `falhou` com o código de lista fechada, e o job falha: o alerta do job que falhou de vez a mostra.
 * - **Log**: ids, contagem de tentativa e código. Nunca a linha, o nome, a matrícula nem o e-mail (regra 20, item 9).
 */
export function criarGravacaoDaPlanilha({ banco, logger, medidor }: GravarPlanilhaDependencies): JobProcessor<typeof TIPO_GRAVAR_PLANILHA> {
  const porResultado = medidor?.createCounter(METRICS.importacaoPorResultado, { description: 'Execuções do job da planilha, por resultado' })
  const duracaoDoPasso3 = medidor?.createHistogram(METRICS.duracaoDoPasso3DaImportacao, {
    unit: 's',
    description: 'Duração do passo 3 do job da planilha',
    advice: { explicitBucketBoundaries: LIMITES_DO_PASSO_3_S },
  })
  return async ({ importacaoId }, execucao) => {
    requireEscolaId()
    try {
      const estado = await executarPlanilha(banco, importacaoId, { aoMedirOPasso3: (segundos) => duracaoDoPasso3?.record(segundos), acharConta: contaDoProfessor, travarContas: travarContasDoProfessor })
      porResultado?.add(1, { resultado: estado })
      logger.info({ evento: 'importacao.job_terminou', importacaoId, estado, tentativa: execucao.tentativa })
    } catch (erro) {
      const definitiva = erro instanceof ImportacaoIlegivelError
      const ultimaTentativa = execucao.tentativa >= TENTATIVAS_DO_JOB
      if (!definitiva && !ultimaTentativa) {
        porResultado?.add(1, { resultado: 'nova_tentativa' })
        logger.warn({ evento: 'importacao.job_repetira', importacaoId, tentativa: execucao.tentativa, erro: summarizeError(erro) })
        throw erro
      }
      const codigo = ehFalhaDeTrava(erro) ? 'trava_esgotada' : 'erro_interno'
      const fechada = await new ImportacaoRepository(banco).falhar(importacaoId, codigo)
      porResultado?.add(1, { resultado: 'falhou' })
      logger.error({ evento: 'importacao.job_falhou', importacaoId, tentativa: execucao.tentativa, codigo, estado: fechada ? 'falhou' : 'ja_fechada' })
      if (definitiva) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
      throw erro
    }
  }
}
