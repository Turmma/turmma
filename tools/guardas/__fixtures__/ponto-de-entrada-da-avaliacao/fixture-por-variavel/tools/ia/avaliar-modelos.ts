import { pathToFileURL } from 'node:url'
const caminho = 'tools/ia/__fixtures__/dados.ts'
export const carrega = () => import(caminho)
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
