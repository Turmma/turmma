import { pathToFileURL } from 'node:url'
const caminho = 'packages/core/src/db/schema/escola.ts'
export const carrega = () => import(caminho)
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
