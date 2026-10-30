import { JOB_DEFINITIONS, type JobExecutor, type JobRegistry } from '@educa/shared'
import { z } from 'zod'

/** Quanto tempo o BullMQ guarda o job terminado. É o que ainda deduplica um reenvio com o mesmo `jobId`. */
export const RETENCAO_JOB_CONCLUIDO_SEGUNDOS = 24 * 60 * 60
export const RETENCAO_JOB_FALHO_SEGUNDOS = 7 * 24 * 60 * 60

/** O que o despachante entrega ao BullMQ de cada job, além do `jobId`: a retentativa do tipo. */
export interface OpcoesDeJobPublicado {
  readonly attempts: number
  readonly backoff?: { readonly type: 'exponential'; readonly delay: number; readonly jitter: number }
}

// Os mesmos valores do registro de hoje, mas sem acompanhá-lo: o worker termina esse job na primeira tentativa, então não há
// o que sincronizar.
const OPCOES_DO_TIPO_DESCONHECIDO: OpcoesDeJobPublicado = { attempts: 5, backoff: { type: 'exponential', delay: 2_000, jitter: 0.5 } }

/**
 * As opções de retentativa de um tipo, lidas da definição dele (`JOB_DEFINITIONS`): as tentativas e o recuo exponencial. O
 * `jobId` é o id de `job_registro`, e é ele que torna o reenvio inofensivo (o despachante o acrescenta).
 *
 * Tipo que o registro não conhece (uma linha de uma versão antiga) segue com a retentativa de antes do registro, cinco
 * tentativas e recuo de 2 s: o worker o termina na primeira com `TIPO_DESCONHECIDO`, definitivo, e a publicação não pode
 * falhar por causa dele.
 */
export function opcoesDeJob(tipo: string, definicoes: JobRegistry = JOB_DEFINITIONS): OpcoesDeJobPublicado {
  const definicao = definicoes[tipo]
  if (definicao === undefined) return OPCOES_DO_TIPO_DESCONHECIDO
  const { tentativas, recuoMs, jitter } = definicao.retentativa
  return { attempts: tentativas, backoff: { type: 'exponential', delay: recuoMs, jitter } }
}

/** Quem executa o tipo, e portanto de que fila do BullMQ ele sai. O tipo desconhecido vai ao worker, que o recusa. */
export function executorDoJob(tipo: string, definicoes: JobRegistry = JOB_DEFINITIONS): JobExecutor {
  return definicoes[tipo]?.executor ?? 'worker'
}

/**
 * O que vai no `data` do job no Redis: só a escola e a requisição, copiadas da linha persistida
 * pelo despachante. Os dados do trabalho o worker lê do Postgres, dentro do escopo da escola.
 */
export const esquemaDadosDoJobNaFila = z
  .object({
    escolaId: z.uuid().nullable(),
    requisicaoId: z.uuid().nullable(),
  })
  .strict()

export type DadosDoJobNaFila = z.infer<typeof esquemaDadosDoJobNaFila>
