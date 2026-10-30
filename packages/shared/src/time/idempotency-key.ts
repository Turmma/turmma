import { z } from 'zod'

/**
 * A chave de idempotência de todo `POST` que dispara uma execução de IA (MVP, seção 4, item 1; D49): um UUID que a tela
 * sorteia a cada envio e guarda só na memória, como a `chaveEnvio` da reivindicação (A1). O reenvio com a mesma chave
 * devolve a mesma execução, sem gerar de novo nem gastar o modelo duas vezes. No banco é `execucao_agente.chave_envio`,
 * única na escola.
 */
export const idempotencyKeySchema = z.uuid()
