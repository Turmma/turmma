/**
 * A regra do campo de várias linhas (`CampoLongo`): quantos caracteres valem, o que o contador diz, o que falta e o que
 * o campo aceita. **Uma conta só**, a da API (`z.string().trim().min().max()` nos contratos de `@educa/shared`): o texto
 * sem o espaço das pontas, medido como o JavaScript mede (`length`). O contador, o limite do campo e a mensagem do que
 * falta usam a mesma conta: oito espaços não são uma justificativa de oito caracteres, e "498 de 500" nunca trava.
 */
export interface LimitesDoTexto {
  /** O mínimo de caracteres. Sem ele, nenhum. */
  readonly minimo?: number
  readonly maximo: number
}

export function tamanhoDoTexto(valor: string): number {
  return valor.trim().length
}

/** O contador ao lado do campo: `12 de 500`. */
export function textoDoContador(valor: string, { maximo }: LimitesDoTexto): string {
  return `${String(tamanhoDoTexto(valor))} de ${String(maximo)}`
}

/** O que há de errado com o texto, dizendo o que fazer, ou `undefined` quando ele serve. */
export function problemaDoTexto(valor: string, { minimo = 0, maximo }: LimitesDoTexto): string | undefined {
  const tamanho = tamanhoDoTexto(valor)
  if (tamanho < minimo) return tamanho === 0 ? `Escreva pelo menos ${String(minimo)} caracteres.` : `Escreva pelo menos ${String(minimo)} caracteres: ${minimo - tamanho === 1 ? 'falta 1' : `faltam ${String(minimo - tamanho)}`}.`
  if (tamanho > maximo) return `Use até ${String(maximo)} caracteres.`
  return undefined
}

/**
 * O texto que o campo guarda depois de uma tecla ou de uma colagem: o que foi escrito, cortado no máximo **pela mesma
 * conta do contador**. O espaço do começo fica (não conta), e o que passa do máximo é o fim que sai. É isto no lugar do
 * `maxLength` do navegador, que conta o texto cru e pararia o campo com o contador ainda abaixo do limite.
 */
export function limitarTexto(valor: string, maximo: number): string {
  if (tamanhoDoTexto(valor) <= maximo) return valor
  const semOFim = valor.trimEnd()
  const comeco = semOFim.length - semOFim.trimStart().length
  return semOFim.slice(0, comeco + maximo)
}
