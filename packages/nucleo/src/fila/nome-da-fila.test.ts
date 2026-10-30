import { QUEUE_NAMES } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { nomeDaFilaBullMQ } from './filas.js'

describe('nomeDaFilaBullMQ: a fila do BullMQ pela fila e pelo executor', () => {
  it('a do worker é o nome de hoje, o da própria fila: o job publicado antes da separação por executor segue sendo consumido', () => {
    expect(QUEUE_NAMES.map((fila) => nomeDaFilaBullMQ(fila, 'worker'))).toEqual(['interativa', 'normal', 'lote'])
  })

  it('a da API tem outro nome em cada fila, e nenhum coincide com o do worker: o worker não recebe o job de IA e de PDF', () => {
    const daApi = QUEUE_NAMES.map((fila) => nomeDaFilaBullMQ(fila, 'api'))
    const doWorker = QUEUE_NAMES.map((fila) => nomeDaFilaBullMQ(fila, 'worker'))
    expect(daApi).toEqual(['api-interativa', 'api-normal', 'api-lote'])
    expect(new Set([...daApi, ...doWorker]).size).toBe(QUEUE_NAMES.length * 2)
  })
})
