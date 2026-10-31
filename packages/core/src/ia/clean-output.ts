/**
 * O modelo local raciocina por padrão e, mesmo com o raciocínio desligado no pedido, pode devolver o bloco
 * `<think>…</think>` no texto. Raciocínio nunca é resposta: sai antes de qualquer validação e nunca é guardado.
 */
export function descartarRaciocinio(texto: string): string {
  let limpo = texto.replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/giu, '')
  // Fechamento sem abertura: o modelo cujo template abre o bloco sozinho devolve "raciocínio…</think>resposta".
  const fechamento = /<\/think\s*>/giu
  let ultimoFechamento = -1
  for (let achado = fechamento.exec(limpo); achado !== null; achado = fechamento.exec(limpo)) ultimoFechamento = achado.index + achado[0].length
  if (ultimoFechamento >= 0) limpo = limpo.slice(ultimoFechamento)
  // Abertura sem fechamento: a saída acabou no meio do raciocínio. Tudo dali em diante é raciocínio.
  const abertura = /<think\b[^>]*>/iu.exec(limpo)
  if (abertura !== null) limpo = limpo.slice(0, abertura.index)
  return limpo.trim()
}

/** Tira a cerca de código em volta do JSON (```json … ```), que modelo põe mesmo quando se pede para não pôr. */
export function tirarCercaDeCodigo(texto: string): string {
  const cerca = /^```[a-z]*\s*\n?([\s\S]*?)\n?```$/iu.exec(texto.trim())
  return (cerca?.[1] ?? texto).trim()
}

/** Raciocínio fora, cerca fora e, se sobrou prosa em volta, só o que vai da primeira chave à última. */
export function limparSaidaDoModelo(texto: string): string {
  const semCerca = tirarCercaDeCodigo(descartarRaciocinio(texto))
  if (semCerca.startsWith('{')) return semCerca
  const inicio = semCerca.indexOf('{')
  const fim = semCerca.lastIndexOf('}')
  return inicio >= 0 && fim > inicio ? semCerca.slice(inicio, fim + 1) : semCerca
}

/**
 * Tira de um texto a marcação de Markdown que modelo põe por hábito. A tela mostra o texto do modelo como texto, sem
 * interpretar marcação: `**Questão 1**` e `### Etapa` apareceriam crus para a professora e para o aluno.
 *
 * Só sai o que é marcação sem dúvida, para não estragar conteúdo que usa os mesmos sinais de verdade:
 * - negrito e itálico de asterisco, só quando o asterisco encosta na palavra e não está no meio de uma conta: `2 * 3`,
 *   `2*3*4` e `a * b` ficam;
 * - título de linha (`## Etapa`): só cerquilha no começo da linha seguida de espaço; `nº`, `#1` e `C#` ficam;
 * - crase de código em volta de uma palavra ou fórmula.
 * Sublinhado não é tocado: a lacuna das questões é `______`, e nome com sublinhado não é marcação.
 */
export function tirarMarcacao(texto: string): string {
  return texto
    .replace(/(?<![\p{L}\p{N}*])\*\*(?=[^\s*])([^\n]*?[^\s*])\*\*(?![\p{L}\p{N}*])/gu, '$1')
    .replace(/(?<![\p{L}\p{N}*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\p{L}\p{N}*])/gu, '$1')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gmu, '')
    .replace(/`([^`\n]+)`/gu, '$1')
}

/** A mesma limpeza em todo texto de um valor já lido do JSON, em qualquer profundidade. Número, booleano e chave ficam como estão. */
export function semMarcacao(valor: unknown): unknown {
  if (typeof valor === 'string') return tirarMarcacao(valor)
  if (Array.isArray(valor)) return valor.map(semMarcacao)
  if (typeof valor !== 'object' || valor === null) return valor
  return Object.fromEntries(Object.entries(valor).map(([chave, item]) => [chave, semMarcacao(item)]))
}
