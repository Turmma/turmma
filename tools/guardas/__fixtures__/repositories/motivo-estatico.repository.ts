import { Unscoped, type Database } from '@educa/nucleo'
import { MOTIVO_DE_FORA } from './motivos.js'
import { aluno } from './tabelas.js'

let MOTIVO_COM_LET = 'um motivo numa let, que pode mudar antes de ser lido'
const CICLO_A = CICLO_B
const CICLO_B = CICLO_A
const MOTIVO_DO_ARQUIVO = 'este motivo mora numa const do mesmo arquivo e tem mais de trinta caracteres'
const PRIMEIRA_PARTE = 'a primeira parte do motivo, '

function motivoDeFuncao(): string {
  return 'um motivo que só se sabe executando, e que o analisador não executa'
}

// O motivo é texto que se sabe sem executar: literal, template sem substituição, `+` de literais ou const do arquivo.
export class MotivoEstaticoRepository {
  constructor(private readonly banco: Database) {}

  @Unscoped(MOTIVO_DE_FORA)
  async importado() { // reprova: motivo-nao-literal
    return this.banco.select().from(aluno)
  }

  @Unscoped(`um motivo com ${String(1)} substituição não é um texto literal`)
  async comSubstituicao() { // reprova: motivo-nao-literal
    return this.banco.select().from(aluno)
  }

  @Unscoped(motivoDeFuncao())
  async deFuncao() { // reprova: motivo-nao-literal
    return this.banco.select().from(aluno)
  }

  @Unscoped(`um motivo em template sem substituição, com mais de trinta caracteres`)
  async templateSemSubstituicao() {
    return this.banco.select().from(aluno)
  }

  @Unscoped(MOTIVO_DO_ARQUIVO)
  async constDoArquivo() {
    return this.banco.select().from(aluno)
  }

  @Unscoped(PRIMEIRA_PARTE + 'a segunda parte, que completa o motivo')
  async mais() {
    return this.banco.select().from(aluno)
  }

  @Unscoped(MOTIVO_DE_FORA + ' com a primeira parte que só se sabe importando')
  async somaComImportadoNaEsquerda() { // reprova: motivo-nao-literal
    return this.banco.select().from(aluno)
  }

  @Unscoped('com a segunda parte que só se sabe importando, ' + MOTIVO_DE_FORA)
  async somaComImportadoNaDireita() { // reprova: motivo-nao-literal
    return this.banco.select().from(aluno)
  }

  @Unscoped(PRIMEIRA_PARTE - 'uma conta que não é soma de textos, e não vale')
  async subtracao() { // reprova: motivo-nao-literal
    return this.banco.select().from(aluno)
  }

  @Unscoped(MOTIVO_COM_LET)
  async daLet() { // reprova: motivo-nao-literal
    return this.banco.select().from(aluno)
  }

  @Unscoped(CICLO_A)
  async doCiclo() { // reprova: motivo-nao-literal
    return this.banco.select().from(aluno)
  }

  @Unscoped('um motivo comprido o bastante para valer sozinho', 'e um segundo argumento que o decorator não tem')
  async comDoisArgumentos() { // reprova: motivo-nao-literal
    return this.banco.select().from(aluno)
  }

  @Unscoped()
  async semArgumento() { // reprova: motivo-nao-literal
    return this.banco.select().from(aluno)
  }
}
