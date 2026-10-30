import { and, between, eq, sql } from 'drizzle-orm'
import { requireEscolaId } from '../contexto/escola-do-contexto.js'
import type { Database, DatabaseTransaction } from '../db/banco.js'
import { usoInfraDiario } from '../db/schema/uso-infra-diario.js'
import { limitesDoMes } from './dia-de-uso.js'

/** Uso de uma escola num período. */
export interface UsagePeriod {
  requisicoes: number
  jobs: number
  /** No dia, o total medido no fechamento dele; no mês, o do último dia consolidado do mês. */
  bytesStorage: number
}

const SEM_USO: UsagePeriod = { requisicoes: 0, jobs: 0, bytesStorage: 0 }

/**
 * `uso_infra_diario` no escopo da escola do contexto (regra 10, item 3), em toda leitura e escrita.
 * A consolidação, que é rotina do sistema, abre o contexto de cada escola que achou nos contadores e
 * grava por aqui: não há gravação de uso com a escola vinda de argumento.
 */
export class UsageRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Grava o valor absoluto das métricas informadas no dia da escola do contexto. A métrica ausente
   * não é tocada (fica com o que já tinha, ou zero na linha nova): a medição do storage e a dos
   * contadores gravam o mesmo dia sem apagar uma à outra. Repetir a gravação com o mesmo valor não
   * muda nada.
   *
   * Requisições e jobs nunca descem: dentro do dia o contador só cresce, e um valor menor só chega
   * se a chave de um dia já consolidado renascer com um incremento atrasado. Esse incremento se
   * perde, mas o total do dia não é trocado por ele. Os bytes são a medição do momento e podem descer.
   */
  async gravarDia(dia: string, valores: Partial<UsagePeriod>): Promise<void> {
    const escolaId = requireEscolaId()
    const { requisicoes, jobs, bytesStorage } = valores
    const informados = {
      ...(requisicoes === undefined ? {} : { requisicoes }),
      ...(jobs === undefined ? {} : { jobs }),
      ...(bytesStorage === undefined ? {} : { bytesStorage }),
    }
    if (Object.keys(informados).length === 0) return
    await this.banco
      .insert(usoInfraDiario)
      .values({ escolaId, dia, ...informados })
      .onConflictDoUpdate({
        target: [usoInfraDiario.escolaId, usoInfraDiario.dia],
        set: {
          ...(requisicoes === undefined ? {} : { requisicoes: sql`greatest(${usoInfraDiario.requisicoes}, excluded.requisicoes)` }),
          ...(jobs === undefined ? {} : { jobs: sql`greatest(${usoInfraDiario.jobs}, excluded.jobs)` }),
          ...(bytesStorage === undefined ? {} : { bytesStorage }),
        },
      })
  }

  /** O uso da escola do contexto no dia. Dia sem linha é dia sem uso consolidado. */
  async doDia(dia: string): Promise<UsagePeriod> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({ requisicoes: usoInfraDiario.requisicoes, jobs: usoInfraDiario.jobs, bytesStorage: usoInfraDiario.bytesStorage })
      .from(usoInfraDiario)
      .where(and(eq(usoInfraDiario.escolaId, escolaId), eq(usoInfraDiario.dia, dia)))
    return linha ?? SEM_USO
  }

  /**
   * O uso da escola do contexto no mês `AAAA-MM`: requisições e jobs somados, e o maior total de bytes
   * medido no mês. Somar o total de cada dia contaria o mesmo arquivo trinta vezes; o pico é o que o
   * storage precisou comportar.
   */
  async doMes(mes: string): Promise<UsagePeriod> {
    const escolaId = requireEscolaId()
    const { primeiro, ultimo } = limitesDoMes(mes)
    const [linha] = await this.banco
      .select({
        requisicoes: sql<string>`coalesce(sum(${usoInfraDiario.requisicoes}), 0)`,
        jobs: sql<string>`coalesce(sum(${usoInfraDiario.jobs}), 0)`,
        bytesStorage: sql<string>`coalesce(max(${usoInfraDiario.bytesStorage}), 0)`,
      })
      .from(usoInfraDiario)
      .where(and(eq(usoInfraDiario.escolaId, escolaId), between(usoInfraDiario.dia, primeiro, ultimo)))
    return { requisicoes: Number(linha?.requisicoes ?? 0), jobs: Number(linha?.jobs ?? 0), bytesStorage: Number(linha?.bytesStorage ?? 0) }
  }
}
