import { pathToFileURL } from 'node:url'
declare function createPool(url: string): unknown
export const pool = createPool('x')
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
