import { type Database } from '@educa/nucleo'
import { aluno } from './tabelas.js'

// O nome do método pode ser texto ou calculado, e o método continua público.
export class NomeEspecialRepository {
  constructor(private readonly banco: Database) {}

  async 'listar-tudo'() { // reprova: sem-prova-de-escopo
    return this.banco.select().from(aluno)
  }

  async [Symbol.asyncIterator]() { // reprova: sem-prova-de-escopo
    return this.banco.select().from(aluno)
  }
}
