import { Unscoped, type Database } from '@educa/core'
import { aluno } from './tabelas.js'

// A fronteira é 30 caracteres, e o texto é medido sem o espaço das pontas, como o próprio decorator faz.
export class MotivoRepository {
  constructor(private readonly banco: Database) {}

  @Unscoped('abcdefghijklmnopqrstuvwxyz012')
  async curto() { // reprova: motivo-curto
    return this.banco.select().from(aluno)
  }

  @Unscoped('abcdefghijklmnopqrstuvwxyz0123')
  async nolimite() {
    return this.banco.select().from(aluno)
  }

  @Unscoped('abcdefghijklmnopqrstuvwxyz012      ')
  async curtoComEspacoNaPonta() { // reprova: motivo-curto
    return this.banco.select().from(aluno)
  }
}
