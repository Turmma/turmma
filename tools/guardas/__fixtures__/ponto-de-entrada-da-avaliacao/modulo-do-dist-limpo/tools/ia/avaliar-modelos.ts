import { pathToFileURL } from 'node:url'
const importar = (caminho: string): Promise<unknown> => import(caminho)
export const gateway = importar('packages/core/dist/ia/gateway.js')
export const consumo = importar('packages/core/dist/ia/tasks/index.js')
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
