import { requireEscolaId as escolaDaVez, requestIdentity as quemPede, type Database } from '@educa/core'
import { aluno } from './tabelas.js'

// O alias conta: o que vale é o nome exportado.
export class ImportComAliasRepository {
  constructor(private readonly banco: Database) {}

  async daEscola() {
    return this.banco.select().from(aluno).where(escolaDaVez())
  }

  async doUsuario() {
    return this.banco.select().from(aluno).where(quemPede().usuarioId)
  }
}
