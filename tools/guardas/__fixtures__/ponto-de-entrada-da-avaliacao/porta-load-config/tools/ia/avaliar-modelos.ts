import { pathToFileURL } from 'node:url'
declare function loadDatabaseConfig(): unknown
export const cfg = loadDatabaseConfig()
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
