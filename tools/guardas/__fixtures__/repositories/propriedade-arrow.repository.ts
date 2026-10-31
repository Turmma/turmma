import { requireEscolaId, type Database } from '@educa/core'
import { aluno } from './tabelas.js'

// A propriedade-função pública é método público do mesmo jeito.
export class PropriedadeArrowRepository {
  constructor(private readonly banco: Database) {}

  listar = async () => { // reprova: sem-prova-de-escopo
    return this.banco.select().from(aluno)
  }

  readonly listarNaEscola = async () => {
    return this.banco.select().from(aluno).where(requireEscolaId())
  }

  listarComFuncao = async function (this: PropriedadeArrowRepository) { // reprova: sem-prova-de-escopo
    return this.banco.select().from(aluno)
  }

  // Propriedade que não é função, com e sem inicializador, não é método.
  readonly nome = 'aluno'
  contador!: number
}
