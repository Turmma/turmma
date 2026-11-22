import { pathToFileURL } from 'node:url'
import { gateway } from '@educa/core'
export const usa = gateway
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
