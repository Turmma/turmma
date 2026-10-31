import { Marcador, Outro, type Database } from '@educa/core'
import { aluno } from './tabelas.js'

// Decorator que não é o `@Unscoped` importado (com ou sem chamada) não prova nada.
export class OutrosDecoratorsRepository {
  constructor(private readonly banco: Database) {}

  @Marcador
  async semChamada() { // reprova: sem-prova-de-escopo
    return this.banco.select().from(aluno)
  }

  @Outro('um texto de mais de trinta caracteres, mas de outro decorator')
  async comOutro() { // reprova: sem-prova-de-escopo
    return this.banco.select().from(aluno)
  }
}
