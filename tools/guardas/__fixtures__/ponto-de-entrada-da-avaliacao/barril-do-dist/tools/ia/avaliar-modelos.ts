import { pathToFileURL } from 'node:url'
const importar = (caminho: string): Promise<unknown> => import(caminho)
export const nucleo = importar('packages/core/dist/index.js')
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
