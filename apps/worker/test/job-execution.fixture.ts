import type { ExecucaoDoJob } from '../src/job-executor.js'

/** O prazo de uma tentativa que o teste dá ao processador chamado direto: nenhum desses testes o aplica nem o confere. */
export const PRAZO_DE_TESTE_MS = 60_000

/** A execução que o executor entregaria ao processador, para o teste que o chama sem passar por ele: a chave de idempotência é o id do job. */
export function execucaoDoJob(jobId: string, tentativa = 1): ExecucaoDoJob {
  return { jobId, tentativa, chaveIdempotencia: jobId, prazoMs: PRAZO_DE_TESTE_MS }
}
