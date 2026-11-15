// Fixture da guarda do `fetch` (52.0; RF11): o `fetch` passado adiante por reexportação ou por importação com esse nome, que
// leva o contorno para fora do arquivo. Cada linha marcada é uma forma de o `fetch` sair daqui sem o prazo.

export const buscar = fetch /* reprova: no-restricted-globals */
export { fetch as buscarDeNovo } /* reprova: no-restricted-globals, no-restricted-syntax */
export { fetch } from './outro-modulo' /* reprova: no-restricted-syntax */
import { fetch as pedir } from './outro-modulo' /* reprova: no-restricted-syntax */

export const usada = () => pedir('/v1/eu')
