import { Unscoped, type Database } from '@educa/core'
import { aluno } from './tabelas.js'

export const COLUNAS = { id: 1, nome: 2 } satisfies Record<string, number>

// O parser é o do `typescript` da raiz: decorator, `satisfies` e `as const` compilam.
export class DecoratorESatisfiesRepository {
  constructor(private readonly banco: Database) {}

  @Unscoped('varredura da operação, em todas as escolas, sem devolver linha nem pessoa')
  async todas() {
    return this.banco.select().from(aluno) satisfies unknown as readonly unknown[] as const
  }
}
