import { type Database } from '@educa/core'
import { aluno } from './tabelas.js'

// A função exportada sem nome (`export default function`) é ponto de entrada público como as outras.
export default async function (banco: Database) { // reprova: sem-prova-de-escopo
  return banco.select().from(aluno)
}
