import { pathToFileURL } from 'node:url'
import { ponte } from './ponte.ts'
export const usa = ponte
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
