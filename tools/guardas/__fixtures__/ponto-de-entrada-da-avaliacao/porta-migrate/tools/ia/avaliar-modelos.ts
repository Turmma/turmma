import { pathToFileURL } from 'node:url'
declare function migrate(): void
export const rodou = migrate()
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
