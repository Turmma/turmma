import { pathToFileURL } from 'node:url'
import { medir } from './golden.ts'
export const usa = medir
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
