import { type Database } from '@educa/core'
import { aluno } from './tabelas.js'

// Só o método público exige a prova: o privado e o protegido são alcançados por quem já a deu.
export class PrivadoRepository {
  constructor(private readonly banco: Database) {}

  private async lerPrivado() {
    return this.banco.select().from(aluno)
  }

  protected async lerProtegido() {
    return this.banco.select().from(aluno)
  }

  async #lerComCerca() {
    return this.banco.select().from(aluno)
  }

  private readonly lerComSeta = async () => this.banco.select().from(aluno)
}
