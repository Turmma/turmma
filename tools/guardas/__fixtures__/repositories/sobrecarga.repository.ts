import { requireEscolaId, type Database } from '@educa/core'
import { aluno } from './tabelas.js'

// A assinatura de sobrecarga não tem corpo e não é um método à parte: só a implementação conta.
export class SobrecargaRepository {
  constructor(private readonly banco: Database) {}

  async achar(id: string): Promise<unknown>
  async achar(id: string, turmaId: string): Promise<unknown>
  async achar(id: string, turmaId?: string): Promise<unknown> {
    return this.banco.select().from(aluno).where([requireEscolaId(), id, turmaId])
  }
}

export declare function ambiente(valor: number): number

export function somar(a: number): number
export function somar(a: number, b: number): number
export function somar(a: number, b?: number): number {
  return a + (b ?? 0)
}
