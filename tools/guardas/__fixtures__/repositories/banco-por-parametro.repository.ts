import { requireEscolaId, type DatabaseTransaction } from '@educa/core'
import { aluno } from './tabelas.js'

// O banco também chega por parâmetro (`tx: DatabaseTransaction`).
export class BancoPorParametroRepository {
  async listar(tx: DatabaseTransaction) { // reprova: sem-prova-de-escopo
    return tx.select().from(aluno)
  }

  async listarNaEscola(tx: DatabaseTransaction) {
    return tx.select().from(aluno).where(requireEscolaId())
  }
}
