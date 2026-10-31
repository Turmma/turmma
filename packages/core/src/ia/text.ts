/**
 * Ferramentas de texto das versões determinísticas e das conferências. Nada aqui chama modelo: é comparação de
 * palavra, recorte de frase e um hash estável, para a mesma entrada dar sempre a mesma saída.
 */

/** Minúsculas, sem acento e com um espaço só: é como duas escritas da mesma coisa viram iguais. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * As frases de um texto. A quebra de linha do PDF no meio da frase vira espaço antes, e a frase acaba em todo ponto
 * seguido de espaço, venha depois maiúscula ou não: a linha de fórmula que segue uma definição começa em minúscula
 * ("…multiplicada por 100. rendimento (%) = …") e não pode entrar nela. Número com ponto e sem espaço ("7.1") fica inteiro.
 */
export function frases(texto: string): string[] {
  return texto
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/u)
    .map((frase) => frase.trim())
    .filter((frase) => frase.length > 0)
}

export function palavras(texto: string): string[] {
  return texto.split(/[^\p{L}\p{N}]+/u).filter((palavra) => palavra.length > 0)
}

const PALAVRAS_VAZIAS = new Set(
  (
    'a o as os um uma uns umas de da do das dos em na no nas nos por para pra com sem que se e ou mas como mais menos ' +
    'muito pouco ao aos pela pelo pelas pelos entre sobre ate este esta esse essa isso isto aquele aquela ele ela eles ' +
    'elas eu voce voces meu minha seu sua ser sao foi era estar esta estao tem ter quando onde qual quais quem porque ' +
    'cada mesmo mesma tambem nao sim ja so apenas depois antes assim entao todo toda todos todas'
  ).split(' '),
)

/** As palavras que dizem do que o texto trata: sem artigo, preposição e afins, normalizadas, com três letras ou mais. */
export function palavrasDeConteudo(texto: string): string[] {
  return palavras(normalizar(texto)).filter((palavra) => palavra.length >= 3 && !PALAVRAS_VAZIAS.has(palavra))
}

/** Quantas palavras de conteúdo de `a` aparecem em `b`. */
export function palavrasEmComum(a: string, b: string): number {
  const deB = new Set(palavrasDeConteudo(b))
  return new Set(palavrasDeConteudo(a).filter((palavra) => deB.has(palavra))).size
}

/** FNV-1a de 32 bits: espalha bem, não depende de plataforma e não é segredo de nada. */
export function hashEstavel(texto: string): number {
  let hash = 0x811c9dc5
  for (let indice = 0; indice < texto.length; indice += 1) {
    hash ^= texto.charCodeAt(indice)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Corta em `maximo` caracteres, na última palavra inteira, com reticências. */
export function cortar(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto
  const corte = texto.slice(0, maximo - 1)
  const ultimoEspaco = corte.lastIndexOf(' ')
  return `${(ultimoEspaco > maximo / 2 ? corte.slice(0, ultimoEspaco) : corte).trimEnd()}…`
}

export function capitalizar(texto: string): string {
  return texto.length === 0 ? texto : texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
}

export function semPontoFinal(texto: string): string {
  return texto.replace(/[.!?]+$/u, '').trim()
}

/** `texto` contém `parte` como palavras inteiras, comparando sem acento nem maiúscula. */
export function contemTexto(texto: string, parte: string): boolean {
  const alvo = normalizar(semPontoFinal(parte))
  if (alvo.length === 0) return false
  const escapado = alvo.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapado}(?![\\p{L}\\p{N}])`, 'u').test(normalizar(texto))
}

/** Lista em português: "a", "a e b", "a, b e c". */
export function enumerar(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}
