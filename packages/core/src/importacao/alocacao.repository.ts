import { and, asc, eq, sql } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { alocacao } from '../db/schema/alocacao.js'

/** Uma aula como está gravada: o vínculo, o dia (1 segunda a 7 domingo), o horário como `HH:MM` e a sala. */
export interface AulaGravada {
  readonly id: string
  readonly vinculoId: string
  readonly diaSemana: number
  readonly inicio: string
  readonly fim: string
  readonly sala: string | null
}

export type AulaNova = Omit<AulaGravada, 'id'>

/** O `time` do Postgres vem como `HH:MM:SS`; a grade, a planilha e o contrato falam em `HH:MM`. */
const horario = (valor: string): string => valor.slice(0, 5)

/**
 * As aulas da grade da escola do contexto (F2, 11.0; Tech Spec, seção 3): a `alocacao`. Escola vem do contexto (regra 10, item 3) e o
 * ano é o de destino da planilha, já conferido pelo motor; nenhum método recebe escola. A FK composta com o vínculo é a segunda
 * camada: a aula nunca aponta para o vínculo de outra escola nem de outro ano.
 */
export class AlocacaoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** As aulas do ano, em ordem de id: a planilha da grade compara cada linha com elas. */
  async doAno(anoLetivoId: string): Promise<AulaGravada[]> {
    const linhas = await this.banco
      .select({ id: alocacao.id, vinculoId: alocacao.vinculoId, diaSemana: alocacao.diaSemana, inicio: alocacao.inicio, fim: alocacao.fim, sala: alocacao.sala })
      .from(alocacao)
      .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId)))
      .orderBy(asc(alocacao.id))
    return linhas.map((linha) => ({ ...linha, inicio: horario(linha.inicio), fim: horario(linha.fim) }))
  }

  /**
   * Grava as aulas, em lote: a que já existe para (vínculo, dia, início) muda de fim e de sala e **mantém o id**, que a `Aula` da F2b vai
   * apontar. Devolve quantas linhas escreveu (a de `aulas` do `resumo`); a aula de outra escola, na mesma chave, não é tocada nem contada. Duas aulas de mesma chave no mesmo lote são erro de quem chama
   * (a prévia as recusa como `aula_repetida`).
   */
  async gravar(anoLetivoId: string, aulas: readonly AulaNova[]): Promise<number> {
    if (aulas.length === 0) return 0
    const escolaId = requireEscolaId()
    const gravadas = await this.banco
      .insert(alocacao)
      .values(aulas.map(({ vinculoId, diaSemana, inicio, fim, sala }) => ({ escolaId, anoLetivoId, vinculoId, diaSemana, inicio, fim, sala })))
      // O `ON CONFLICT DO UPDATE` não confere a FK composta da linha proposta: o `setWhere` é a segunda camada, e a aula de outra escola não muda.
      .onConflictDoUpdate({ target: [alocacao.vinculoId, alocacao.diaSemana, alocacao.inicio], set: { fim: sql`excluded.fim`, sala: sql`excluded.sala` }, setWhere: eq(alocacao.escolaId, escolaId) })
      .returning({ id: alocacao.id })
    return gravadas.length
  }
}
