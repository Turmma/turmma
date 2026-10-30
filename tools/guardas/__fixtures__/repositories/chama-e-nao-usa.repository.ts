import { requireEscolaId, type Database } from '@educa/nucleo'
import { aluno } from './tabelas.js'

// O limite declarado do analisador: ele vê a chamada, e não o uso do resultado. Passa. O `where` quem prova é o teste de
// isolamento de cada repository (regra 10, item 5).
export class ChamaENaoUsaRepository {
  constructor(private readonly banco: Database) {}

  async listar() {
    requireEscolaId()
    return this.banco.select().from(aluno)
  }
}
