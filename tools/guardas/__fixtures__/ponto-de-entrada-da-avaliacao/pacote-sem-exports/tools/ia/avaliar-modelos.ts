import { pathToFileURL } from 'node:url'
import { x } from '@educa/core'
export const usa = x
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
