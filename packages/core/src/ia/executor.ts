import { ErrorCode } from '@educa/shared'

/** Os estados de `execucao_agente`: `pendente` e `rodando` são as abertas; `concluida` e `falhou`, as finais. */
export const ESTADOS_DA_EXECUCAO = ['pendente', 'rodando', 'concluida', 'falhou'] as const
export type EstadoDaExecucao = (typeof ESTADOS_DA_EXECUCAO)[number]

/** A execução ficou `pendente` ou `rodando` além do prazo: o processo caiu ou reiniciou no meio dela. */
export const EXECUCAO_INTERROMPIDA = ErrorCode.EXECUCAO_INTERROMPIDA
/** O que `execucao_agente.erro` guarda: um código do contrato, e mais nada. */
export type CodigoDeFalhaDaExecucao = ErrorCode
