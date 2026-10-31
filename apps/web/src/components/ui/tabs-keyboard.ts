/**
 * A aba para onde a tecla leva, na lista de abas (padrão de abas da WAI-ARIA): as setas andam e dão a volta, `Home` e
 * `End` vão às pontas. Qualquer outra tecla não é da lista (`undefined`), e segue para o navegador: o Tab sai da lista
 * para o painel, que é o que deixa a lista de abas custar uma parada só na ordem do teclado.
 */
export function abaDaTecla(ids: readonly string[], ativa: string, tecla: string): string | undefined {
  const atual = ids.indexOf(ativa)
  if (ids.length === 0 || atual === -1) return undefined
  if (tecla === 'ArrowRight') return ids[(atual + 1) % ids.length]
  if (tecla === 'ArrowLeft') return ids[(atual - 1 + ids.length) % ids.length]
  if (tecla === 'Home') return ids[0]
  if (tecla === 'End') return ids.at(-1)
  return undefined
}

/**
 * A aba que fica na ordem do Tab: a ativa. Com a ativa fora da lista (a aba que deixou de existir, um id que veio errado
 * do endereço), é a primeira: sem isso nenhuma aba teria parada, e a lista inteira sumiria para quem usa o teclado.
 */
export function abaNaOrdemDoTab(ids: readonly string[], ativa: string): string | undefined {
  return ids.includes(ativa) ? ativa : ids[0]
}
