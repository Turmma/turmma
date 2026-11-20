import type { SecaoDaQuestao } from '@educa/shared'

/**
 * Como a tela diz o capítulo de uma habilidade (classificacao-bncc, 8.0 e 11.0): o painel do material, na coordenação, e o artefato aberto, no professor, escrevem o capítulo, as páginas e a espera do 429 do mesmo jeito. **Na tela a
 * seção é sempre "capítulo" (ou "páginas X a Y"), nunca "trecho" nem "seção".** Sem React: a peça que desenha é de quem usa.
 */

type Paginas = { readonly paginaInicial: number; readonly paginaFinal: number }
type Titulo = { readonly numero: number | null; readonly titulo: string }

/** "Páginas 12 a 20", ou "Página 12" no capítulo de uma página só. */
export function paginasDoCapitulo(capitulo: Paginas): string {
  return capitulo.paginaInicial === capitulo.paginaFinal ? `Página ${String(capitulo.paginaInicial)}` : `Páginas ${String(capitulo.paginaInicial)} a ${String(capitulo.paginaFinal)}`
}

/** O título do capítulo, com o número que o PDF escreve quando há: "Capítulo 3 · Frações". */
export function tituloDoCapitulo(capitulo: Titulo): string {
  return capitulo.numero === null ? capitulo.titulo : `Capítulo ${String(capitulo.numero)} · ${capitulo.titulo}`
}

/** O nome do capítulo: "Capítulo 3 · Frações", o título sozinho quando o PDF não o numera, e "Páginas 1 a 10" no bloco de páginas. */
export function tituloDaSecao(secao: Paginas & { readonly capitulo: Titulo | null }): string {
  return secao.capitulo === null ? paginasDoCapitulo(secao) : tituloDoCapitulo(secao.capitulo)
}

/** As páginas do capítulo, em linha própria; o bloco de páginas já as diz no nome. */
export function paginasDaSecao(secao: Paginas & { readonly capitulo: Titulo | null }): string | undefined {
  return secao.capitulo === null ? undefined : paginasDoCapitulo(secao)
}

/** O capítulo da questão numa linha só, para a linha da habilidade: "Capítulo 3 · Frações (Páginas 12 a 20)", ou "Páginas 1 a 10" no bloco de páginas. */
export function capituloDaQuestao(secao: Pick<SecaoDaQuestao, 'capitulo' | 'paginaInicial' | 'paginaFinal'>): string {
  const paginas = paginasDaSecao(secao)
  return paginas === undefined ? tituloDaSecao(secao) : `${tituloDaSecao(secao)} (${paginas})`
}

/** O 429 da correção, do reclassificar e da troca: "Tente de novo em N minutos", arredondando para cima; sem `Retry-After`, "em instantes". */
export function textoDoLimiteDeAlteracoesSeguidas(esperaSegundos: number | undefined): string {
  if (esperaSegundos === undefined) return 'Muitas alterações seguidas. Tente de novo em instantes.'
  const minutos = Math.max(1, Math.ceil(esperaSegundos / 60))
  return `Muitas alterações seguidas. Tente de novo em ${String(minutos)} ${minutos === 1 ? 'minuto' : 'minutos'}.`
}
