import { pathToFileURL } from 'node:url'
// lê DATABASE_URL? não: este comentário só o cita
/* import { x } from './__fixtures__/dados.ts' e db/schema, também só em comentário */
export const nada = 1
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
