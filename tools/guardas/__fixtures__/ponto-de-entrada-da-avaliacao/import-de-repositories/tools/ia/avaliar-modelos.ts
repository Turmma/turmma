import { pathToFileURL } from 'node:url'
import { repo } from '../../apps/api/src/repositories/aluno.ts'
export const usa = repo
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
