import { type Database } from '@educa/core'
import { timeResponseSchema, montarTime, type TimeResponse } from '@educa/shared'
import { SuspensoesDaEscolaRepository } from './suspensoes-da-escola.repository.js'

/**
 * `GET /v1/time` (MVP, A2 e A5; D9, D32, D60; regra 70, item 5): os três agentes, as funções de cada um, a autonomia em
 * português comum e se a função está suspensa **nesta escola**. O que é fixo vem do catálogo `FUNCOES`, em código
 * (`montarTime`); do banco vem só a suspensão vigente. Professor e coordenação leem o mesmo, e nada aqui é dado de pessoa.
 *
 * É por esta rota que a tela diz, na entrega pendente de uma função suspensa, que a função está suspensa: a entrega
 * traz a `funcao`, e o time, o `suspensa` dela.
 */
export class TimeService {
  constructor(private readonly banco: Database) {}

  async ler(): Promise<TimeResponse> {
    return timeResponseSchema.parse(montarTime(new Set(await new SuspensoesDaEscolaRepository(this.banco).vigentes())))
  }
}
