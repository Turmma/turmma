import './efeito.js'
import * as todas from './tabelas.js'
import padrao from './padrao.js'
import { type Database, type DatabaseTransaction } from '@educa/nucleo'

let contador: number
void todas
void padrao
void contador

// Público que não toca o banco não exige prova.
export class PublicoSemBancoRepository {
  private readonly cache: Map<string, number> = new Map()

  constructor(
    private readonly banco: Database,
    private readonly relogio: { agora(): Date },
  ) {}

  agora(): Date {
    return this.relogio.agora()
  }

  esquecer(chave: string): boolean {
    return this.cache.delete(chave)
  }

  somar(a, b) {
    return a + b
  }

  // `contexto.banco` e `opcoes.tx` são propriedades de outros objetos: nem o campo `banco` da classe, nem o parâmetro `tx`.
  async doContexto(contexto: { banco: unknown }) {
    return contexto.banco
  }

  descartar(tx: DatabaseTransaction, opcoes: { tx: number }) {
    const rotulo = 'tx'
    return `${rotulo}${opcoes.tx}`
  }

  nomeDaTabela(): string {
    return 'aluno'
  }

  async dobrar(valor: number): Promise<number> {
    return valor * 2
  }
}
