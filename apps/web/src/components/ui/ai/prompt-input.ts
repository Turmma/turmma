/**
 * A regra da caixa de pedido (`docs/interface.md` 11.2 e 11.3): o que é enviado, quando o Enter envia e quando o botão
 * de enviar vira "Parar".
 */

/** `pronta` aceita pedido; `gerando` é a resposta chegando, e enviar vira "Parar"; `desligada` não aceita nada. */
export type EstadoDaCaixa = 'pronta' | 'gerando' | 'desligada'

/** O texto que vai no pedido: sem o espaço das pontas. Só espaço e quebra de linha não é pedido (`undefined`). */
export function textoDoPedido(valor: string): string | undefined {
  const texto = valor.trim()
  return texto === '' ? undefined : texto
}

/** Dá para enviar agora? Só com a caixa pronta e com texto: enquanto a resposta chega, um segundo pedido não sai. */
export function podeEnviar(valor: string, estado: EstadoDaCaixa): boolean {
  return estado === 'pronta' && textoDoPedido(valor) !== undefined
}

export interface TeclaDaCaixa {
  readonly key: string
  readonly shiftKey: boolean
  /** A tecla faz parte de uma composição (acento morto, teclado de outro alfabeto): o Enter confirma a letra, não envia. */
  readonly isComposing: boolean
}

/**
 * **Com teclado, Enter envia e Shift+Enter quebra a linha.** O Enter que fecha uma composição não é envio.
 *
 * **Com o dedo (`ponteiroGrosso`), o Enter nunca envia: ele quebra a linha, e o envio é o botão.** No teclado virtual
 * não existe Shift+Enter, e quem quisesse escrever a segunda linha mandaria o pedido pela metade — uma chamada de modelo
 * gasta e uma resposta ao pedido errado (regra 50, item 2a: nada que só funcione com atalho de teclado; D14).
 */
export function teclaEnvia(tecla: TeclaDaCaixa, ponteiroGrosso = false): boolean {
  return !ponteiroGrosso && tecla.key === 'Enter' && !tecla.shiftKey && !tecla.isComposing
}

/** O que a caixa diz ao leitor de tela sobre o Enter, que muda com o aparelho. */
export function dicaDoEnter(ponteiroGrosso: boolean): string {
  return ponteiroGrosso ? 'Enter quebra a linha. Para enviar, use o botão Enviar.' : 'Enter envia. Shift e Enter quebram a linha.'
}
