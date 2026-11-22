import { pathToFileURL } from 'node:url'
import { dados } from './__fixtures__/dados.ts'
export const usa = dados
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
