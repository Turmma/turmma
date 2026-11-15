// Fixture da guarda do `fetch` (52.0; RF11): o `import()` de um módulo que chama `fetch`. O módulo é barrado onde chama
// (`modulo-que-chama-fetch.ts`), e quem o importa por `import()` e usa o `fetch` dele também.

export const pelaMembro = async () => (await import('./modulo-que-chama-fetch')).fetch('/v1/eu') /* reprova: no-restricted-syntax */
export const pelaDesestruturacao = async () => {
  const { fetch: buscar } = await import('./modulo-que-chama-fetch') /* reprova: no-restricted-syntax */
  return buscar('/v1/eu')
}
