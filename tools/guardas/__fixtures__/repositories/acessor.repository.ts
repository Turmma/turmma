import { type Database } from '@educa/core'
import { aluno } from './tabelas.js'

// O acessor (`get` e `set`) também é público.
export class AcessorRepository {
  constructor(private readonly banco: Database) {}

  get todos() { // reprova: sem-prova-de-escopo
    return this.banco.select().from(aluno)
  }

  set limite(valor: number) { // reprova: sem-prova-de-escopo
    void this.banco.update(aluno).set({ valor })
  }
}
