/**
 * Quanto da barra está preenchido, de 0 a 100. O valor fora da faixa não estoura a barra nem a deixa negativa: 70 de 60
 * perguntas é barra cheia, e o texto ao lado é que diz o número. Máximo zero ou inválido é barra vazia, nunca `NaN` no
 * atributo do SVG.
 */
export function preenchimentoDaBarra(valor: number, maximo = 100): number {
  if (!Number.isFinite(valor) || !Number.isFinite(maximo) || maximo <= 0) return 0
  return Math.min(100, Math.max(0, (valor / maximo) * 100))
}

/** O valor em texto quando quem usa não escreve o seu: o percentual inteiro, "72%". */
export function percentualDaBarra(valor: number, maximo = 100): string {
  return `${String(Math.round(preenchimentoDaBarra(valor, maximo)))}%`
}
