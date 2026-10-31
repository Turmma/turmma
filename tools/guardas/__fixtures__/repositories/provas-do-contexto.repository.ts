import { jobScopeInContext, requestIdentity, type Database } from '@educa/core'
import { job } from './tabelas.js'

// Cada uma das outras duas provas vale sozinha.
export class ProvasDoContextoRepository {
  constructor(private readonly banco: Database) {}

  async soIdentidade() {
    const { usuarioId } = requestIdentity()
    return this.banco.select().from(job).where(usuarioId)
  }

  async soEscopoDoJob() {
    return this.banco.select().from(job).where(jobScopeInContext())
  }
}
