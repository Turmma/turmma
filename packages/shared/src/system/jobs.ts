/**
 * Filas de trabalho, da mais urgente para a menos urgente. A prioridade de um job vem da fila
 * dele: interativa (alguém esperando na tela), normal, e lote (ingestão, correção em massa,
 * rotina noturna). Regra 80, item 2.
 */
export const QUEUE_NAMES = ['interativa', 'normal', 'lote'] as const
export type QueueName = (typeof QUEUE_NAMES)[number]

/**
 * Ciclo de um job registrado em `job_registro`. Toda troca é condicional à origem, então uma
 * escrita tardia nunca leva um job de volta: `concluido` e `falhou` são finais.
 */
export const JOB_STATES = ['aguardando', 'reservado', 'publicado', 'ativo', 'concluido', 'falhou'] as const
export type JobState = (typeof JOB_STATES)[number]

/**
 * Motivo tipado de um job que falhou de vez. É o que fica em `job_registro.codigo_falha`: texto
 * fixo, nunca a mensagem da exceção, que poderia carregar valor de campo.
 */
export const JobFailureCode = {
  /** O job sintético pediu para falhar (`falhar: true`). */
  FALHA_SINTETICA: 'FALHA_SINTETICA',
  /** Nenhum processador conhece o tipo do job. */
  TIPO_DESCONHECIDO: 'TIPO_DESCONHECIDO',
  /** Os dados do job não passaram na validação do processador. */
  DADOS_INVALIDOS: 'DADOS_INVALIDOS',
  /** Exceção não prevista, esgotadas as tentativas. */
  ERRO_INTERNO: 'ERRO_INTERNO',
  /** A tentativa passou do `prazoMs` do tipo (`JOB_DEFINITIONS`) e o worker a cortou. Segue a retentativa do tipo. */
  TEMPO_ESGOTADO: 'TEMPO_ESGOTADO',
  /** O worker foi desligado, a graça acabou e a última tentativa ainda rodava: o job não tem outra para repetir. */
  EXECUCAO_INTERROMPIDA: 'EXECUCAO_INTERROMPIDA',
} as const

export type JobFailureCode = (typeof JobFailureCode)[keyof typeof JobFailureCode]

export const JOB_FAILURE_CODES = Object.values(JobFailureCode) as [JobFailureCode, ...JobFailureCode[]]
