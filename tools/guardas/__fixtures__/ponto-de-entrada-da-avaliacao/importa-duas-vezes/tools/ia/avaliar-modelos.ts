import { pathToFileURL } from 'node:url'
import { a } from './a.ts'
import { b } from './b.ts'
export const usa = [a, b]
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
