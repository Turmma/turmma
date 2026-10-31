import { defineJob, JOB_DEFINITIONS, TIPO_JOB_SINTETICO, TIPO_MONTAR_ARQUIVO, type JobRegistry } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { jobExecutor, jobOptions } from './publishing.js'

/** O sintético com a retentativa curta e a execução na API: um tipo que só o teste tem. */
const DEFINICOES: JobRegistry = {
  ...JOB_DEFINITIONS,
  'teste.da-api': defineJob({ ...JOB_DEFINITIONS[TIPO_JOB_SINTETICO], executor: 'api', retentativa: { tentativas: 2, recuoMs: 10, jitter: 0 } }),
}

describe('opcoesDeJob: a retentativa que o despachante publica é a do tipo', () => {
  it('cada tipo do registro de hoje publica as cinco tentativas e o recuo exponencial de 2 s com jitter de 0,5, em literal', () => {
    for (const tipo of Object.keys(JOB_DEFINITIONS)) {
      expect(jobOptions(tipo), tipo).toEqual({ attempts: 5, backoff: { type: 'exponential', delay: 2_000, jitter: 0.5 } })
    }
  })

  it('a retentativa vem da definição do tipo, e não de uma constante: com a definição injetada, são as tentativas e o recuo dela', () => {
    expect(jobOptions('teste.da-api', DEFINICOES)).toEqual({ attempts: 2, backoff: { type: 'exponential', delay: 10, jitter: 0 } })
    expect(jobOptions(TIPO_MONTAR_ARQUIVO, DEFINICOES)).toEqual({ attempts: 5, backoff: { type: 'exponential', delay: 2_000, jitter: 0.5 } })
  })

  it('o tipo que o registro não conhece segue com a retentativa de antes: a publicação não falha por causa dele', () => {
    expect(jobOptions('tipo.de-uma-versao-antiga')).toEqual({ attempts: 5, backoff: { type: 'exponential', delay: 2_000, jitter: 0.5 } })
  })
})

describe('executorDoJob: de que fila do BullMQ o tipo sai', () => {
  it('os 8 tipos de hoje são do worker, o tipo da API é da API, e o desconhecido vai ao worker, que o termina com TIPO_DESCONHECIDO', () => {
    for (const tipo of Object.keys(JOB_DEFINITIONS)) expect(jobExecutor(tipo), tipo).toBe('worker')
    expect(jobExecutor('teste.da-api', DEFINICOES)).toBe('api')
    expect(jobExecutor('tipo.de-uma-versao-antiga')).toBe('worker')
  })
})
