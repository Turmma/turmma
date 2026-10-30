// O jeito certo de lançar: erro com tipo, motivo fixo, e o relançamento. Nenhuma linha aqui pode sair com guarda.
declare const condicao: boolean
declare const erro: Error
declare class InvariantException extends Error {}
declare class DomainException extends Error {
  constructor(codigo: string)
}
declare class ErroDoModulo extends Error {
  constructor(valor: string)
}
declare const valor: string

export function lancamentos(): void {
  if (condicao) throw new InvariantException('turma não criada')
  if (condicao) throw new InvariantException(`turma não criada`)
  if (condicao) throw new DomainException('NAO_ENCONTRADO')
  if (condicao) throw new ErroDoModulo(valor)
  if (condicao) throw erro
  if (condicao) throw (condicao ? new InvariantException('a') : new InvariantException('b'))
}

export class ComCampo extends InvariantException {
  constructor(readonly lista: readonly string[]) {
    super('lista com problema')
  }

  descrever(): string {
    return String(this.lista)
  }
}

export class ComOutroPai extends Error {
  constructor(valor: string) {
    super(`valor fora: ${valor}`)
  }
}
