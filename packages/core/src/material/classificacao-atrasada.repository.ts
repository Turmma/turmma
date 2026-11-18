import { FUNCAO_DA_TAREFA_DE_IA } from '@educa/shared'
import { and, count, eq, gte, lt, or } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { execucaoAgente } from '../db/schema/execucao-agente.js'

/**
 * A medição do alerta `classificacao-atrasada` (classificacao-bncc, tarefa 5.0; Tech Spec, seção 7c, "Alerta"): quantas execuções da classificação da escola do contexto não terminaram a noite. Na abertura da janela
 * letiva da escola, conta a execução `classificar_secoes` que **`falhou` durante a noite** (`concluida_em` de quando a escola fechou até quando abriu) e a que está **`pendente` desde antes dela** (`criada_em` antes de a
 * escola fechar): a que sobrou do dia anterior. A `pendente` criada na própria noite não conta: é o excedente planejado do onboarding, que a noite seguinte termina. Só conta e datas, nunca seção, material, título nem código.
 */
export class ClassificacaoAtrasadaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  async atrasadas(fechouEm: Date, abriuEm: Date): Promise<number> {
    const [linha] = await this.banco
      .select({ total: count() })
      .from(execucaoAgente)
      .where(
        and(
          eq(execucaoAgente.escolaId, requireEscolaId()),
          eq(execucaoAgente.funcao, FUNCAO_DA_TAREFA_DE_IA.classificar_secoes),
          or(
            and(eq(execucaoAgente.estado, 'falhou'), gte(execucaoAgente.concluidaEm, fechouEm), lt(execucaoAgente.concluidaEm, abriuEm)),
            and(eq(execucaoAgente.estado, 'pendente'), lt(execucaoAgente.criadaEm, fechouEm)),
          ),
        ),
      )
    return linha?.total ?? 0
  }
}
