/**
 * O teclado do menu (padrão de botão de menu da WAI-ARIA): para qual item o foco vai. As setas andam e dão a volta,
 * `Home` e `End` vão às pontas, e uma letra leva ao próximo item que começa por ela. **Item desligado é pulado**: o
 * foco nunca para num item que não faz nada.
 */
export interface ItemNavegavel {
  readonly rotulo: string
  readonly desabilitado?: boolean
}

function ligados(itens: readonly ItemNavegavel[]): number[] {
  return itens.flatMap((item, indice) => (item.desabilitado === true ? [] : [indice]))
}

/** O primeiro item que recebe foco ao abrir: o primeiro ligado, ou o último quando o menu abriu pela seta para cima. */
export function itemInicial(itens: readonly ItemNavegavel[], ponta: 'primeiro' | 'ultimo' = 'primeiro'): number | undefined {
  const indices = ligados(itens)
  return ponta === 'primeiro' ? indices[0] : indices.at(-1)
}

/**
 * O índice do item para onde a tecla leva, a partir do `atual`. `undefined`: a tecla não é de navegação do menu.
 * `comModificador` é a tecla apertada com Ctrl, Alt ou ⌘: aí a letra é atalho do navegador (Ctrl+A, Ctrl+P), e não busca.
 */
export function itemDaTecla(itens: readonly ItemNavegavel[], atual: number, tecla: string, comModificador = false): number | undefined {
  const indices = ligados(itens)
  if (indices.length === 0) return undefined
  const posicao = indices.indexOf(atual)
  if (tecla === 'ArrowDown') return indices[(posicao + 1) % indices.length]
  if (tecla === 'ArrowUp') return indices[(posicao <= 0 ? indices.length : posicao) - 1]
  if (tecla === 'Home') return indices[0]
  if (tecla === 'End') return indices.at(-1)
  // Uma letra ou um número: o próximo item que começa por ela, a partir do atual, dando a volta. Sem acento e sem caixa,
  // para "a" achar "Adaptação" e "Água".
  if (!comModificador && [...tecla].length === 1 && /[\p{L}\p{N}]/u.test(tecla)) {
    const letra = semAcento(tecla)
    const depois = [...indices.filter((indice) => indice > atual), ...indices.filter((indice) => indice <= atual)]
    return depois.find((indice) => semAcento(itens[indice]?.rotulo ?? '').startsWith(letra))
  }
  return undefined
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
}
