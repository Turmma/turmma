import { pathToFileURL } from 'node:url'
declare function createDatabase(): unknown
export const db = createDatabase()
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
