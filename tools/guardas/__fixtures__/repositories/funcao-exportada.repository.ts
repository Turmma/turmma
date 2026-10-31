import { requireEscolaId, type Database, type DatabaseTransaction } from '@educa/core'
import { aluno } from './tabelas.js'

// A função exportada do módulo é ponto de entrada público, como o método da classe.
export async function gravar(tx: DatabaseTransaction) { // reprova: sem-prova-de-escopo
  await tx.insert(aluno).values({})
}

export const gravarComSeta = async (banco: Database) => { // reprova: sem-prova-de-escopo
  await banco.insert(aluno).values({})
}

export async function gravarNaEscola(tx: DatabaseTransaction) {
  await tx.insert(aluno).values({ escolaId: requireEscolaId() })
}

export function semBanco(valor: number): number {
  return valor + 1
}

async function internaSemExportar(tx: DatabaseTransaction) {
  await tx.insert(aluno).values({})
}
void internaSemExportar

const internaDeSeta = async (banco: Database) => {
  await banco.insert(aluno).values({})
}
void internaDeSeta
