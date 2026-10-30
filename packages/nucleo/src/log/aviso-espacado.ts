/**
 * Devolve uma função que só chama `emitir` uma vez a cada `intervaloMs`. Para aviso que se repete
 * a cada tentativa de reconexão (Redis ou Postgres fora): uma linha a cada 30 s diz o mesmo que mil.
 */
export function throttledWarn(emitir: () => void, intervaloMs = 30_000): () => void {
  let ultimoEm = Number.NEGATIVE_INFINITY
  return () => {
    if (performance.now() - ultimoEm < intervaloMs) return
    ultimoEm = performance.now()
    emitir()
  }
}
