import { pathToFileURL } from 'node:url'
export const banco = process.env.BANCO_URL
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
