import { pathToFileURL } from 'node:url'
import type { Forma } from './ajuda.test.ts'
import type {
  Forma as Outra,
} from './ajuda.test.ts'
import type * as Tudo from './ajuda.test.ts'
import type Padrao from './ajuda.test.ts'
export type Usa = Forma
export type Todas = Outra | Tudo.Forma | Padrao
function principal(): void {}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
