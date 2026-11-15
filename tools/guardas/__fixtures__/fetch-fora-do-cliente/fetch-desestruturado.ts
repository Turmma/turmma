// Fixture da guarda do `fetch` (52.0; RF11): o `fetch` tirado do objeto global por desestruturação. A linha do `const` cria uma
// variável local de nome `fetch`, e a chamada dela, mais abaixo, já não é a do escopo global: só o seletor a vê.

const { fetch } = window /* reprova: no-restricted-syntax */
const { fetch: buscar } = globalThis /* reprova: no-restricted-syntax */
const { ['fetch']: outro } = self /* reprova: no-restricted-syntax */
let guardado: typeof window.fetch
;({ fetch: guardado } = window) /* reprova: no-restricted-syntax */

export const usadas = () => [fetch('/v1/eu'), buscar('/v1/eu'), outro('/v1/eu'), guardado('/v1/eu')]
