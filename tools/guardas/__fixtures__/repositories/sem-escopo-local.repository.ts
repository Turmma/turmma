import { type Database } from '@educa/nucleo'
import { aluno } from './tabelas.js'

// O decorator tem de ser o importado: um `Unscoped` escrito aqui não registra nada.
function Unscoped(motivo: string): MethodDecorator {
  return () => void motivo
}

export class SemEscopoLocalRepository {
  constructor(private readonly banco: Database) {}

  @Unscoped('um motivo comprido o bastante, mas de um decorator que não é o importado')
  async listar() { // reprova: sem-prova-de-escopo
    return this.banco.select().from(aluno)
  }
}
