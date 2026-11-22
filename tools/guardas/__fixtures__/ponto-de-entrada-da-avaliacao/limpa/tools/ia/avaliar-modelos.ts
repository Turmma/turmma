import { pathToFileURL } from 'node:url'
import { lerAmostras } from './amostras.ts'
export const usa = lerAmostras
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
