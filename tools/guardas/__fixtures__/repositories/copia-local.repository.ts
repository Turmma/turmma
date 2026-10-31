import { type Database } from '@educa/core'
import { aluno } from './tabelas.js'

// A cópia local de `requireEscolaId` não é a função que lê o contexto: só a importada vale.
function requireEscolaId(): string {
  return 'qualquer-escola'
}

export class CopiaLocalRepository {
  constructor(private readonly banco: Database) {}

  async listar() { // reprova: sem-prova-de-escopo
    const escolaId = requireEscolaId()
    return this.banco.select().from(aluno).where(escolaId)
  }
}
