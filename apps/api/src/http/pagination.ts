/**
 * Corta a página: o repository busca `limite + 1` linhas em ordem de id, e a linha a mais só diz que há próxima
 * página, que começa depois do último id devolvido.
 */
export function paginar<Linha extends { readonly id: string }>(linhas: readonly Linha[], limite: number): { itens: Linha[]; proxima?: string } {
  return paginarPor(linhas, limite, (linha) => linha.id)
}

/** O mesmo corte, para a página ordenada por outra chave (os alunos da turma vão em ordem de `usuarioId`). */
export function paginarPor<Linha>(linhas: readonly Linha[], limite: number, chave: (linha: Linha) => string): { itens: Linha[]; proxima?: string } {
  const itens = linhas.slice(0, limite)
  const ultima = itens.at(-1)
  return linhas.length > limite && ultima !== undefined ? { itens, proxima: chave(ultima) } : { itens }
}
