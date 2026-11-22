import { pathToFileURL } from 'node:url'
import { z } from 'zod'
export const usa = z
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
