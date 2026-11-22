import { pathToFileURL } from 'node:url'
export const ajuda = require('./ajuda.test.ts')
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
