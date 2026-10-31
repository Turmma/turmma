import type { Plugin } from 'vite'

/**
 * O Tailwind 4 escreve `color-mix()` dentro de `@supports (color: color-mix(...))`, com a cor fixa antes, fora do bloco:
 * o `::placeholder` do preflight e o modificador de opacidade (`bg-tinta/40`, que a guarda de `estilos.test.ts` já
 * barra no fonte). O Chrome 109 do laboratório ignora o bloco e fica com a cor fixa; o 111 em diante usa a mistura.
 *
 * O build tira o bloco inteiro, e todo navegador fica com a mesma cor fixa (`docs/interface.md` 9.9: "se o build não
 * rebaixar isso para cor fixa"). E o que sobrar de `color-mix()` ou `oklch()` fora de um bloco desses é declaração
 * que o Chrome 109 descarta: o build para, em vez de servir a tela sem cor.
 */

/** O começo de um `@supports` que só pergunta se o navegador entende `color-mix()`. */
const BLOCO_DE_COLOR_MIX = /@supports\s*\(\s*color\s*:\s*color-mix\(/g

/** Onde termina o bloco que abre na primeira `{` depois de `inicio`: a posição logo depois da `}` que o fecha. */
function fimDoBloco(css: string, inicio: number): number {
  const abertura = css.indexOf('{', inicio)
  if (abertura === -1) throw new Error('rebaixar-cor: @supports sem bloco no CSS gerado')
  let profundidade = 0
  for (let posicao = abertura; posicao < css.length; posicao++) {
    const caractere = css[posicao]
    if (caractere === '"' || caractere === "'") {
      posicao = css.indexOf(caractere, posicao + 1)
      if (posicao === -1) break
    } else if (caractere === '{') profundidade++
    else if (caractere === '}' && --profundidade === 0) return posicao + 1
  }
  throw new Error('rebaixar-cor: @supports sem fechamento no CSS gerado')
}

/** O CSS sem os blocos `@supports (color: color-mix(...))`. Reprova o `color-mix()` e o `oklch()` que sobrarem. */
export function rebaixarColorMix(css: string): string {
  let saida = ''
  let posicao = 0
  for (const encontro of css.matchAll(BLOCO_DE_COLOR_MIX)) {
    if (encontro.index < posicao) continue
    saida += css.slice(posicao, encontro.index)
    posicao = fimDoBloco(css, encontro.index)
  }
  saida += css.slice(posicao)
  for (const funcao of ['color-mix(', 'oklch(']) {
    if (saida.includes(funcao)) throw new Error(`rebaixar-cor: ${funcao}) fora de @supports no CSS gerado; o Chrome 109 descarta a declaração`)
  }
  return saida
}

/** Aplica `rebaixarColorMix` a toda folha de estilo do build. No `vite dev` não roda: o CSS servido é o do build. */
export function pluginRebaixarCor(): Plugin {
  return {
    name: 'educa:rebaixar-cor',
    apply: 'build',
    generateBundle(_opcoes, pacote) {
      for (const arquivo of Object.values(pacote)) {
        if (arquivo.type !== 'asset' || !arquivo.fileName.endsWith('.css')) continue
        arquivo.source = rebaixarColorMix(typeof arquivo.source === 'string' ? arquivo.source : new TextDecoder().decode(arquivo.source))
      }
    },
  }
}
