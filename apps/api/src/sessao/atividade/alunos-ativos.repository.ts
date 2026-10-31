import { requireEscolaId, usuario, type Database, type DatabaseTransaction } from '@educa/core'
import { and, count, eq, isNull } from 'drizzle-orm'

/**
 * Quantos alunos ativos a escola do contexto tem (tarefa 15.1): é o tamanho que dá o limiar de falhas por IP do login por
 * matrícula, `max(100, 25% dos alunos ativos)`. No login, o contexto é o da escola do endereço, aberto antes de ler
 * qualquer coisa dela; a contagem nunca sai de outra escola (regra 10, item 3). Devolve só o número.
 */
export class AlunosAtivosRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  async contar(): Promise<number> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({ total: count() })
      .from(usuario)
      .where(and(eq(usuario.escolaId, escolaId), eq(usuario.papel, 'aluno'), isNull(usuario.desativadoEm)))
    return linha?.total ?? 0
  }
}
