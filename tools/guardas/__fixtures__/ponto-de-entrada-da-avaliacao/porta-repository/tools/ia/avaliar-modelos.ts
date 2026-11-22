import { pathToFileURL } from 'node:url'
declare class AlunoRepository {}
export const repo = new AlunoRepository()
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
