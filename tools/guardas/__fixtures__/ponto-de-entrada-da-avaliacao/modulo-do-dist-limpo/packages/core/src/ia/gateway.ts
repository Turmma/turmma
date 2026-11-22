import type { Aluno } from '../aluno/aluno.repository.js'
import { calcula } from './calculo.js'
export type { Aluno } from '../aluno/aluno.repository.js'
export const gateway = calcula
