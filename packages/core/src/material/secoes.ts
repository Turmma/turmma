/**
 * As seções do material (classificacao-bncc, tarefa 2.0; Tech Spec, seções 3 e 5, "Seções"; RF5): a unidade que a classificação pela BNCC lê. É o capítulo que a extração achou
 * ou, quando o PDF não tem capítulo, o bloco de 10 páginas. As páginas antes do primeiro capítulo não têm seção (a questão que as cita sai sem habilidade). Pura: o banco e o
 * contexto da escola ficam no `ExtracaoDoMaterialRepository`, e a migration `0061` repete a conta em SQL para os materiais que já estavam `pronto`.
 */

/** O bloco de páginas do material sem capítulo. */
export const PAGINAS_POR_BLOCO_DE_SECAO = 10

/** O capítulo como a gravação o devolve: o `id` é o que a seção guarda, e `numero` e `titulo`, o que a edição nova casa. */
export interface CapituloGravado {
  readonly id: string
  readonly ordem: number
  readonly numero: number | null
  readonly titulo: string
  readonly paginaInicial: number
  readonly paginaFinal: number
}

/** O que vai para `secao_do_material`: a ordem é a do capítulo, ou a do bloco (a partir de 1). */
export interface SecaoPlanejada {
  readonly capituloId: string | null
  readonly ordem: number
  readonly paginaInicial: number
  readonly paginaFinal: number
}

/** Uma seção por capítulo, na ordem dele; sem capítulo, um bloco por 10 páginas, o último com as que sobram. Material sem página não tem seção. */
export function planejarSecoes(paginas: number, capitulos: readonly CapituloGravado[]): SecaoPlanejada[] {
  if (capitulos.length > 0) return capitulos.map(({ id, ordem, paginaInicial, paginaFinal }) => ({ capituloId: id, ordem, paginaInicial, paginaFinal }))
  const blocos: SecaoPlanejada[] = []
  for (let inicio = 1; inicio <= paginas; inicio += PAGINAS_POR_BLOCO_DE_SECAO) {
    blocos.push({ capituloId: null, ordem: blocos.length + 1, paginaInicial: inicio, paginaFinal: Math.min(inicio + PAGINAS_POR_BLOCO_DE_SECAO - 1, paginas) })
  }
  return blocos
}

/** O título sem acento, sem caixa e com os espaços de dentro reduzidos a um: "Mol e Massa Molar" e "  mol  e massa molar " são o mesmo capítulo. */
export function chaveDoTituloDoCapitulo(titulo: string): string {
  return titulo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** O que identifica o capítulo entre duas edições: o número e o título. Capítulo sem número não casa com nenhum (`null`). */
export function chaveDoCapituloEntreEdicoes(numero: number | null, titulo: string): string | null {
  return numero === null ? null : `${String(numero)}|${chaveDoTituloDoCapitulo(titulo)}`
}
