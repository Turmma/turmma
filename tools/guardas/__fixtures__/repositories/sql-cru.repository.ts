import { type DatabaseTransaction } from '@educa/core'
import { sql } from 'drizzle-orm'

// SQL cru pela transação também toca o banco.
export class SqlCruRepository {
  constructor(private readonly tx: DatabaseTransaction) {}

  async contar() { // reprova: sem-prova-de-escopo
    return this.tx.execute(sql`select count(*) from aluno`)
  }
}
