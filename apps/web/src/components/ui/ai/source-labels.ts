import type { Citacao } from '@educa/shared'

/**
 * Os textos da citação de página (`docs/interface.md` 11.3): o chip `p. 142` dentro do texto e a linha
 * "Fontes (3): Química 2, p. 142 · p. 145 · p. 151" no fim da resposta. Toda saída de IA que vem do material diz de que
 * página veio (D6; seção 6), e é por estes textos que a professora confere.
 */

/** O título de cada material, pelo id. A citação traz só o `materialId`; quem tem os títulos é a tela. */
export type TitulosDosMateriais = Readonly<Record<string, string>>

/** O que aparece quando a tela ainda não tem o título daquele material: a citação continua valendo, com a página. */
export const MATERIAL_SEM_TITULO = 'Material da escola'

export function tituloDoMaterial(materialId: string, materiais: TitulosDosMateriais): string {
  return materiais[materialId] ?? MATERIAL_SEM_TITULO
}

/** O texto do chip: `p. 142`. */
export function textoDoChip(pagina: number): string {
  return `p. ${String(pagina)}`
}

/**
 * O nome do chip para o leitor de tela, que não vê o desenho de chip: "Fonte: Química 2, p. 142". Termina com o texto
 * que está na tela, sem trocar "p." por "página": o nome de um controle contém o que ele mostra (WCAG 2.5.3), e quem
 * usa comando de voz diz o que lê.
 */
export function nomeDoChip(citacao: Citacao, materiais: TitulosDosMateriais): string {
  return `Fonte: ${tituloDoMaterial(citacao.materialId, materiais)}, ${textoDoChip(citacao.pagina)}`
}

/**
 * As fontes de uma resposta, sem repetição: a mesma página do mesmo material citada em três questões é **uma** fonte, e
 * fica com o primeiro trecho. A ordem é a dos materiais como aparecem e, dentro de cada um, a das páginas.
 */
export function fontesUnicas(citacoes: readonly Citacao[]): Citacao[] {
  const porMaterial = new Map<string, Map<number, Citacao>>()
  for (const citacao of citacoes) {
    const paginas = porMaterial.get(citacao.materialId) ?? new Map<number, Citacao>()
    if (!paginas.has(citacao.pagina)) paginas.set(citacao.pagina, citacao)
    porMaterial.set(citacao.materialId, paginas)
  }
  return [...porMaterial.values()].flatMap((paginas) => [...paginas.values()].sort((a, b) => a.pagina - b.pagina))
}

/**
 * A linha que abre a lista de fontes: `Fontes (3): Química 2, p. 142 · p. 145 · p. 151`. O número é o de fontes únicas,
 * e o título do material aparece uma vez, antes das páginas dele.
 */
export function resumoDasFontes(citacoes: readonly Citacao[], materiais: TitulosDosMateriais): string {
  const unicas = fontesUnicas(citacoes)
  const partes: string[] = []
  let materialAnterior: string | undefined
  for (const citacao of unicas) {
    const pagina = textoDoChip(citacao.pagina)
    partes.push(citacao.materialId === materialAnterior ? pagina : `${tituloDoMaterial(citacao.materialId, materiais)}, ${pagina}`)
    materialAnterior = citacao.materialId
  }
  return `Fontes (${String(unicas.length)}): ${partes.join(' · ')}`
}
