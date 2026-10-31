import { requireEscolaId, suspensaoDeFuncao, type Database } from '@educa/core'
import { type ChaveDeFuncao } from '@educa/shared'
import { and, eq, isNull } from 'drizzle-orm'

/**
 * As funções com suspensão vigente na escola do contexto (D60): a que não foi retomada. No máximo uma linha por função
 * (índice único parcial), e no máximo seis funções: a leitura não precisa de página. A escola vem do contexto.
 */
export class SuspensoesDaEscolaRepository {
  constructor(private readonly banco: Database) {}

  async vigentes(): Promise<ChaveDeFuncao[]> {
    const linhas = await this.banco
      .select({ funcao: suspensaoDeFuncao.funcao })
      .from(suspensaoDeFuncao)
      .where(and(eq(suspensaoDeFuncao.escolaId, requireEscolaId()), isNull(suspensaoDeFuncao.retomadaEm)))
    return linhas.map((linha) => linha.funcao)
  }
}
