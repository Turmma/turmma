import { rotuloDaFonte, type Citacao, type FonteDoArtefato } from '@educa/shared'

/**
 * Os textos da citação de página (`docs/interface.md` 11.3): o chip `p. 142` dentro do texto e a linha
 * "Fontes (3): Química 2, p. 142 · p. 145 · p. 151" no fim da resposta. Toda saída de IA que vem do material diz de que
 * página veio (D6; seção 6), e é por estes textos que a professora confere.
 */

/** O título de cada material, pelo id. A citação traz só o `materialId`; quem tem os títulos é a tela. */
export type TitulosDosMateriais = Readonly<Record<string, string>>

/**
 * Os títulos de um artefato aberto, tirados das `fontes` da resposta dele (ingestao-do-material, 10.0; RF11): título, edição
 * e "edição anterior" de cada material citado, no mesmo texto do PDF (`rotuloDaFonte`). Valem também para o material que a
 * troca de edição já tirou da lista, e para o que o expurgo apagou ("material da escola"): a resposta do artefato é quem diz.
 */
export function titulosDasFontes(fontes: readonly FonteDoArtefato[]): TitulosDosMateriais {
  return Object.fromEntries(fontes.map((fonte) => [fonte.materialId, rotuloDaFonte(fonte)]))
}

/**
 * O que aparece quando a tela não tem o título daquele material: a citação continua valendo, com a página. Começa com
 * maiúscula porque é o título sozinho (a conversa e a Turma hoje, que ainda leem a lista de materiais). O
 * `TITULO_DA_FONTE_SEM_LINHA` da API é o que o artefato diz quando a linha saiu, e fica em minúscula porque a API devolve o
 * texto que entra no meio do rótulo do chip e do rodapé do PDF; unificar muda o contrato (`TODO.md`).
 */
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
 * A linha que abre a lista de fontes: `Sources (3): Química 2, p. 142 · p. 145 · p. 151`. O número é o de fontes únicas,
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
