import { type Database } from '@educa/nucleo'
import { eq } from 'drizzle-orm'
import { aluno } from './tabelas.js'

// O cliente (ou quem chamou) escolhe a escola: é o que a regra 10, item 3, proíbe.
export class EscolaPorParametroRepository {
  constructor(private readonly banco: Database) {}

  async listar(escolaId: string, turmaId: string) { // reprova: sem-prova-de-escopo
    return this.banco.select().from(aluno).where(eq(aluno.escolaId, escolaId)).where(eq(aluno.turmaId, turmaId))
  }
}
