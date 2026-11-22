import { pathToFileURL } from 'node:url'
import { repo } from '../../apps/api/src/aluno/aluno.repository.ts'
export const usa = repo
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
