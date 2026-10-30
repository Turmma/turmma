import { z } from 'zod'
import { JOB_FAILURE_CODES, JOB_STATES, QUEUE_NAMES } from './jobs.js'

/** Teto do trabalho simulado por um job sintético: o bastante para o cenário de carga e para o teste de queda. */
export const CPU_MS_MAXIMO_SINTETICO = 60_000

/**
 * Corpo de `POST /v1/sistema/jobs-sinteticos`. Estrito: `tipo` e `escolaId` no corpo são
 * recusados, e não ignorados. O tipo é sempre o do job sintético, e a escola vem só do token
 * (regra 10, item 3).
 */
export const syntheticJobRequestSchema = z
  .object({
    fila: z.enum(QUEUE_NAMES),
    cpuMs: z.number().int().min(0).max(CPU_MS_MAXIMO_SINTETICO),
    naoUrgente: z.boolean(),
    falhar: z.boolean().optional(),
  })
  .strict()

export type SyntheticJobRequest = z.infer<typeof syntheticJobRequestSchema>

/**
 * Os dados do job sintético em `job_registro`: o que a API grava e o worker lê.
 *
 * `efeito` é o modo de referência da entrega pelo menos uma vez (D49): o processador grava uma linha em
 * `efeito_sintetico` com a chave de idempotência do job, e a reexecução não grava outra. A tabela não
 * tem migration: só existe no teste de integração que a cria. Por isso o modo não está no corpo do `POST`.
 *
 * Estrito, como todo `dados` de job (`definicoes-de-job.ts`): chave a mais, como `escolaId`, é recusada ao enfileirar.
 */
export const syntheticJobDataSchema = z
  .object({
    cpuMs: z.number().int().min(0).max(CPU_MS_MAXIMO_SINTETICO),
    falhar: z.boolean(),
    efeito: z.boolean().optional(),
  })
  .strict()

export type SyntheticJobData = z.infer<typeof syntheticJobDataSchema>

/** Resposta 202 do `POST`: o job foi gravado e ainda vai ser executado. */
export const jobAcceptedResponseSchema = z.object({ jobId: z.uuid() }).strict()
export type JobAcceptedResponse = z.infer<typeof jobAcceptedResponseSchema>

/**
 * Corpo de `GET /v1/sistema/jobs-sinteticos/:id`, lido de `job_registro`. Só estado e datas: nem
 * os dados do job, nem a escola, nem o motivo em texto livre.
 */
export const jobStateResponseSchema = z
  .object({
    estado: z.enum(JOB_STATES),
    criadoEm: z.iso.datetime(),
    iniciadoEm: z.iso.datetime().optional(),
    concluidoEm: z.iso.datetime().optional(),
    codigoFalha: z.enum(JOB_FAILURE_CODES).optional(),
  })
  .strict()

export type JobStateResponse = z.infer<typeof jobStateResponseSchema>
