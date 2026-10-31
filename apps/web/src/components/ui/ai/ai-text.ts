/**
 * O texto que o modelo devolve vira parágrafos de **texto**. Nada aqui interpreta marcação: o que parecer HTML aparece
 * escrito, como veio (regra 30: saída de modelo é dado). O que se faz com o Markdown é o contrário de interpretá-lo:
 * **tirar a marcação comum**, para a professora não ler `**Questão 1**` nem `### Gabarito` crus.
 */

/**
 * Tira a marcação comum de Markdown, e só ela: a cerca de código, o `#` de título, o marcador de lista (cada item vira um
 * parágrafo) e os sinais de negrito e de itálico. **O asterisco e o sublinhado que são conteúdo ficam**: `2 * 3` tem
 * espaço dos dois lados, `2*3*4` e `massa_molar_do_gas` têm letra ou número colado no sinal, e nenhum deles é ênfase. A
 * lista numerada (`1.`) também fica: o número da questão é conteúdo.
 *
 * Sem `lookbehind`, que o Safari anterior ao 16.4 não entende e que derrubaria o pedaço inteiro (`vite.config.ts`): o
 * caractere de antes do sinal é capturado e devolvido.
 */
export function limparMarcacao(texto: string): string {
  return (
    texto
      .replaceAll('\r\n', '\n')
      // A cerca de código: a linha da cerca sai, o que está dentro fica.
      .replace(/^[ \t]*(?:```|~~~)[^\n]*$/gm, '')
      // O título: os `#` do começo da linha.
      .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
      // O marcador de lista: sai, e o item vira parágrafo.
      .replace(/^[ \t]*[-*+][ \t]+(.*)$/gm, '\n$1\n')
      // Negrito: `**assim**` e `__assim__`, com o sinal colado no texto de dentro e solto do de fora.
      .replace(/(^|[^\w*])\*\*(\S(?:[^\n]*?\S)?)\*\*(?![\w*])/gm, '$1$2')
      .replace(/(^|[^\w_])__(\S(?:[^\n]*?\S)?)__(?![\w_])/gm, '$1$2')
      // Itálico: `*assim*` e `_assim_`, com a mesma condição.
      .replace(/(^|[^\w*])\*(\S(?:[^*\n]*?\S)?)\*(?![\w*])/gm, '$1$2')
      .replace(/(^|[^\w_])_(\S(?:[^_\n]*?\S)?)_(?![\w_])/gm, '$1$2')
  )
}

/**
 * Os parágrafos do texto, já sem a marcação: uma linha em branco separa um do outro, e a quebra de linha simples fica
 * dentro do parágrafo (a lista numerada, as alternativas de uma questão).
 */
export function paragrafosDoTexto(texto: string): string[] {
  return limparMarcacao(texto)
    .split(/\n[ \t]*\n+/)
    .map((paragrafo) => paragrafo.trim())
    .filter((paragrafo) => paragrafo !== '')
}
