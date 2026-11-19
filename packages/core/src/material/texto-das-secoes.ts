/**
 * O que a classificação lê de uma seção do material (classificacao-bncc, tarefa 4.0; Tech Spec, seção 5, "Classificação"): o **começo** do texto (até 1.500 caracteres) e as **linhas de subtítulo** (até 500),
 * montados a partir dos trechos das páginas da seção. Pura: o banco fica no `SecoesRepository` da API. A tarefa de IA recusa o que passar dos tetos (`classificarSecoesInputSchema`); o corte é daqui, para a
 * entrada nunca ser recusada por um capítulo comprido.
 */

/** O começo do texto da seção, no máximo. Repete o teto do schema da tarefa (`CARACTERES_DO_COMECO`); o teste confere os dois. */
export const CARACTERES_DO_COMECO_DA_SECAO = 1_500
/** As linhas de subtítulo, no máximo (`CARACTERES_DOS_SUBTITULOS` da tarefa). */
export const CARACTERES_DOS_SUBTITULOS_DA_SECAO = 500
/** Quantas páginas da seção o `preparar` lê: um capítulo de 80 páginas não traz as 80 do banco para classificar (D14). Os subtítulos vêm das primeiras. */
export const PAGINAS_LIDAS_POR_SECAO = 30
/** O que o `preparar` lê de cada página: o suficiente para o começo e para os subtítulos que ficam no alto da página. */
export const CARACTERES_LIDOS_POR_PAGINA = 6_000

/** A linha de subtítulo: curta, sem ponto final nem vírgula no fim, com uma letra, e que começa em maiúscula ou algarismo ("2. A tabela periódica", "Mol e massa molar"). */
const MAXIMO_DA_LINHA_DE_SUBTITULO = 80
const MINIMO_DA_LINHA_DE_SUBTITULO = 4

const isSubtitulo = (linha: string): boolean =>
  linha.length >= MINIMO_DA_LINHA_DE_SUBTITULO &&
  linha.length <= MAXIMO_DA_LINHA_DE_SUBTITULO &&
  /\p{L}/u.test(linha) &&
  /^[\p{Lu}\d]/u.test(linha) &&
  !/[.,;:]$/.test(linha)

/** Corta em `maximo` unidades do JS sem partir um par substituto ao meio. */
export function cortarTexto(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto
  const corte = texto.charCodeAt(maximo - 1) >= 0xd800 && texto.charCodeAt(maximo - 1) <= 0xdbff ? maximo - 1 : maximo
  return texto.slice(0, corte)
}

const chaveDaLinha = (linha: string): string => linha.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export interface TextoDaSecao {
  readonly comeco: string
  readonly subtitulos: string
}

/**
 * O começo e os subtítulos da seção, das páginas dela **na ordem**. O começo é o texto corrido das primeiras páginas, com espaço único entre as palavras. Os subtítulos são as linhas curtas, sem pontuação
 * final, que aparecem no texto (o título do capítulo, que já vai à parte, e a linha que repete outra não entram), uma por linha, até o teto, sem cortar uma linha no meio.
 */
export function textoDaSecao(paginas: readonly string[], titulo: string | null): TextoDaSecao {
  const linhas = paginas.flatMap((pagina) => pagina.split(/\r?\n/)).map((linha) => linha.replace(/\s+/g, ' ').trim()).filter((linha) => linha !== '')
  const comeco = cortarTexto(linhas.join(' '), CARACTERES_DO_COMECO_DA_SECAO).trim()
  const doTitulo = titulo === null ? null : chaveDaLinha(titulo.replace(/\s+/g, ' ').trim())
  const vistas = new Set<string>()
  const escolhidas: string[] = []
  let tamanho = 0
  for (const linha of linhas) {
    if (!isSubtitulo(linha)) continue
    const chave = chaveDaLinha(linha)
    if (chave === doTitulo || vistas.has(chave)) continue
    const acrescimo = linha.length + (escolhidas.length === 0 ? 0 : 1)
    if (tamanho + acrescimo > CARACTERES_DOS_SUBTITULOS_DA_SECAO) break
    vistas.add(chave)
    escolhidas.push(linha)
    tamanho += acrescimo
  }
  return { comeco, subtitulos: escolhidas.join('\n') }
}
