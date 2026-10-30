import { InvariantException } from '@educa/shared'
/** Tamanho mínimo da justificativa: "rotina" não explica nada, uma frase explica. */
export const TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO = 30

const justificativas = new WeakMap<object, Map<string | symbol, string>>()

/**
 * Marca o método de repository que consulta sem a cláusula de escola (regra 10, item 9). Só para
 * rotina nossa, nunca para atender requisição: despachante e expurgo olham a fila inteira,
 * consolidação olha o uso de todas as escolas.
 *
 * A justificativa é obrigatória e fica consultável em `unscopedJustification`: quem lê o
 * repository vê o motivo na linha de cima, e quem revisa acha toda exceção procurando por
 * `@Unscoped`.
 */
export function Unscoped(justificativa: string): MethodDecorator {
  if (justificativa.trim().length < TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO) {
    throw new InvariantException('@SemEscopo exige justificativa escrita')
  }
  return (alvo, metodo) => {
    const doAlvo = justificativas.get(alvo) ?? new Map<string | symbol, string>()
    doAlvo.set(metodo, justificativa)
    justificativas.set(alvo, doAlvo)
  }
}

/** A justificativa registrada para o método, ou `undefined` se ele não foi marcado. */
export function unscopedJustification(classe: abstract new (...argumentos: never[]) => unknown, metodo: string): string | undefined {
  return justificativas.get(classe.prototype as object)?.get(metodo)
}
