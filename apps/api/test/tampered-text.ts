/**
 * Troca o penúltimo caractere de um valor em base64url por outro, para o teste provar que o servidor recusa um cookie
 * adulterado. O penúltimo, e não o último: no último, parte dos bits pode ser só preenchimento, e a troca pode não
 * mudar byte nenhum. A letra nova sai do próprio penúltimo, para nunca ser a mesma.
 */
export function adulterarPenultimo(valor: string): string {
  return `${valor.slice(0, -2)}${valor.at(-2) === 'A' ? 'B' : 'A'}${valor.slice(-1)}`
}
