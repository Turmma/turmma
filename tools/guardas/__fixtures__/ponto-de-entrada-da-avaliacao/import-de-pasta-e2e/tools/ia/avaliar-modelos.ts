import { pathToFileURL } from 'node:url'
import { ajuda } from '../../e2e/ajuda.ts'
export const usa = ajuda
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
