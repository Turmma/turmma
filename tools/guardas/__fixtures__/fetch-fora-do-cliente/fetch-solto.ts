// Fixture da guarda do `fetch` (eslint.config.mjs e tools/guardas/index.mjs, 52.0; RF11): o `fetch` do escopo global, solto, em
// arquivo da web que não é o cliente da API. Sem o prazo do `comPrazo`, a resposta pendurada trava a tela.

export const pedir = () => fetch('/v1/eu') /* reprova: no-restricted-globals */
export const comOpcoes = () => fetch('/v1/artefatos', { cache: 'no-store' }) /* reprova: no-restricted-globals */
