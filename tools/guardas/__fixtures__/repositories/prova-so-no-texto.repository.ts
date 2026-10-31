import { requireEscolaId } from '@educa/core'
import { type Database } from '@educa/core'
import { aluno } from './tabelas.js'

// A função está importada, mas a chamada só aparece em comentário e em texto: não é prova.
export class ProvaSoNoTextoRepository {
  constructor(private readonly banco: Database) {}

  async emComentario() { // reprova: sem-prova-de-escopo
    // requireEscolaId()
    /* requireEscolaId() */
    return this.banco.select().from(aluno)
  }

  async emTexto() { // reprova: sem-prova-de-escopo
    const aviso = 'requireEscolaId()'
    const modelo = `${aviso} requireEscolaId()`
    return this.banco.select().from(aluno).where(modelo)
  }
}
void requireEscolaId
