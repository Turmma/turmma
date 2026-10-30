import { type Database } from '@educa/nucleo'

// `*Repository` só mora em `*.repository.ts`: o analisador só lê esses, e uma classe dessas fora deles escaparia da trava.
export class XRepository { // reprova: repository-fora-do-arquivo
  constructor(private readonly banco: Database) {}

  // Fora de um *.repository.ts a classe não é analisada além do nome: este método sem prova não vira segunda acusação.
  async listar() {
    return this.banco.select()
  }
}

export class XService {
  constructor(private readonly repository: XRepository) {}
}
