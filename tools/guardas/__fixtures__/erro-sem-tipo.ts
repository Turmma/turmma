// Os jeitos de lançar sem tipo, e o motivo do InvariantException que não é texto fixo. A marca "reprova:" fica na linha do
// que é lançado (ou do `new` / `super` do motivo).
declare const valor: string
declare const motivo: string
declare const condicao: boolean
declare class InvariantException extends Error {}

export function lancamentos(): void {
  if (condicao) throw new Error('x') // reprova: guardas/erro-tipado
  if (condicao) throw Error('x') // reprova: guardas/erro-tipado
  if (condicao) throw new globalThis.Error('x') // reprova: guardas/erro-tipado
  if (condicao) throw new Error(`papel fora: ${valor}`) // reprova: guardas/erro-tipado
  if (condicao) throw 'x' // reprova: guardas/erro-tipado
  if (condicao) throw `x` // reprova: guardas/erro-tipado
  if (condicao) throw `x ${valor}` // reprova: guardas/erro-tipado
  if (condicao) throw 42 // reprova: guardas/erro-tipado
  if (condicao) throw (condicao ? new Error('x') : new InvariantException('y')) // reprova: guardas/erro-tipado
  if (condicao) throw new Error('x') as never // reprova: guardas/erro-tipado
  if (condicao) throw new Error('x')! // reprova: guardas/erro-tipado
  if (condicao) throw new Error('x') satisfies Error // reprova: guardas/erro-tipado
  if (condicao) throw (valor || new Error('x')) // reprova: guardas/erro-tipado
  if (condicao) throw (condicao ? new InvariantException('y') : new Error('x')) // reprova: guardas/erro-tipado
  if (condicao) throw (new Error('x') || valor) // reprova: guardas/erro-tipado
  if (condicao) throw new InvariantException(`papel fora: ${valor}`) // reprova: guardas/erro-tipado
  if (condicao) throw new InvariantException('papel fora: ' + valor) // reprova: guardas/erro-tipado
  if (condicao) throw new InvariantException(motivo) // reprova: guardas/erro-tipado
  if (condicao) throw new InvariantException() // reprova: guardas/erro-tipado
  if (condicao) throw new InvariantException(42 as never) // reprova: guardas/erro-tipado
  if (condicao) throw new InvariantException('motivo', 'e outro') // reprova: guardas/erro-tipado
}

export class ComMotivoMontado extends InvariantException {
  constructor(readonly campo: string) {
    super(`campo fora: ${campo}`) // reprova: guardas/erro-tipado
  }
}

export const ComMotivoMontadoSemNome = class extends InvariantException {
  constructor(readonly campo: string) {
    super(`campo fora: ${campo}`) // reprova: guardas/erro-tipado
  }
}
