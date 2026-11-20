/**
 * Os textos da cobertura da BNCC (classificacao-bncc, 13.0; `cenarios.md`, "Telas"): a seção do material é sempre "capítulo" na tela, nunca "trecho" nem "seção". Um lugar só: a tela e o teste leem daqui.
 */

/** O que o grupo diz das habilidades sem material: "3 de 12 habilidades sem material", ou que todas têm. */
export function textoDasHabilidadesSemMaterial(semMaterial: number, total: number): string {
  if (semMaterial === 0) return total === 1 ? 'A habilidade da série tem material' : `Todas as ${String(total)} habilidades têm material`
  return `${String(semMaterial)} de ${String(total)} ${total === 1 ? 'habilidade' : 'habilidades'} sem material`
}

/** Quantos capítulos ainda estão sem classificação no grupo, ou `null` quando nenhum: sem a linha. */
export function quantasSecoesSemClassificacao(secoes: number): string | null {
  if (secoes === 0) return null
  return secoes === 1 ? '1 capítulo ainda sem classificação' : `${String(secoes)} capítulos ainda sem classificação`
}
