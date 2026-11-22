import { pathToFileURL } from 'node:url'
import { escola } from '../../packages/core/src/db/schema/escola.ts'
export const usa = escola
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
