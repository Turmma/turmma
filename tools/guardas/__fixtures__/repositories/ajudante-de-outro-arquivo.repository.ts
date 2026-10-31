import { type Database } from '@educa/core'
import { escopoDaConsulta } from './escopo.js'
import { aluno } from './tabelas.js'

// O ajudante de outro arquivo pode até chamar `requireEscolaId`, mas a guarda não o segue.
export class AjudanteDeOutroArquivoRepository {
  constructor(private readonly banco: Database) {}

  async listar() { // reprova: sem-prova-de-escopo
    return this.banco.select().from(aluno).where(escopoDaConsulta())
  }
}
