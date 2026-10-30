import { type Database } from '@educa/nucleo'
import { aluno } from './tabelas.js'

// O banco guardado numa propriedade tipada (e não recebido pelo construtor) também é o banco.
export class PropriedadeDoBancoRepository {
  private readonly banco: Database = createDatabase()
  readonly #banco: Database = createDatabase()

  async pelaPropriedade() { // reprova: sem-prova-de-escopo
    return this.banco.select().from(aluno)
  }

  async pelaPropriedadeComCerca() { // reprova: sem-prova-de-escopo
    return this.#banco.select().from(aluno)
  }
}
