import { requireEscolaId, suspensaoDeFuncao, type Database, type SuspensaoDeFuncao, type DatabaseTransaction } from '@educa/nucleo'
import type { ChaveDeFuncao } from '@educa/shared'
import { and, eq, isNull } from 'drizzle-orm'

/**
 * A porta `SuspensaoDeFuncao` sobre `suspensao_de_funcao` (D60): "esta função está suspensa nesta escola agora?".
 * Vigente é a que não foi retomada, e o índice único parcial `(escola_id, funcao)` garante no máximo uma. A escola é
 * a do contexto de quem executa (`requireEscolaId()`, lida a cada chamada): a porta não a recebe por argumento, e
 * sem escola no contexto lança antes de ler.
 *
 * Suspender **recusa execução nova** e não apaga o que a função já produziu: a entrega pendente de uma função suspensa
 * continua podendo ser aprovada ou rejeitada pelo professor, porque quem decide é a pessoa.
 */
export class SuspensaoRepository implements SuspensaoDeFuncao {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  async estaSuspensa(funcao: ChaveDeFuncao): Promise<boolean> {
    const escolaId = requireEscolaId()
    const vigentes = await this.banco
      .select({ id: suspensaoDeFuncao.id })
      .from(suspensaoDeFuncao)
      .where(and(eq(suspensaoDeFuncao.escolaId, escolaId), eq(suspensaoDeFuncao.funcao, funcao), isNull(suspensaoDeFuncao.retomadaEm)))
      .limit(1)
    return vigentes.length > 0
  }
}
