import { pathToFileURL } from 'node:url'
export * from './ponte.ts'
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
