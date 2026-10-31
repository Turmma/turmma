import { type Database } from '@educa/core'

// O parâmetro do construtor sem modificador não vira propriedade: `this.banco` aqui é outra coisa, e não é o banco.
export class ParametroSemModificadorRepository {
  readonly banco = 'não é o banco'

  constructor(banco: Database) {
    void banco
  }

  async nome() {
    return this.banco
  }
}
