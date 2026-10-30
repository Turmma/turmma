import { type Database } from '@educa/nucleo'
import { eq } from 'drizzle-orm'
import { aluno } from './tabelas.js'

// Toca o banco e não prova o escopo: o `where` até filtra, mas a escola nunca sai do contexto.
export class SemProvaRepository {
  constructor(private readonly banco: Database) {}

  async listar(turmaId: string) { // reprova: sem-prova-de-escopo
    return this.banco.select().from(aluno).where(eq(aluno.turmaId, turmaId))
  }

  async apagar(turmaId: string) { // reprova: sem-prova-de-escopo
    await this.banco.delete(aluno).where(eq(aluno.turmaId, turmaId))
  }
}
