import { type Database } from '@educa/core'
import { aluno } from './tabelas.js'

// A classe sem nome também é lida, e o método dela reprova.
export default class {
  constructor(private readonly banco: Database) {}

  async listar() { // reprova: sem-prova-de-escopo
    return this.banco.select().from(aluno)
  }
}
