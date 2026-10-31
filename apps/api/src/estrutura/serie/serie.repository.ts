import { requireEscolaId, serie, type Database, type DatabaseTransaction } from '@educa/core'
import type { PaginationQuery, CriarSerieRequest, Serie } from '@educa/shared'
import { and, asc, eq, gt } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'

const colunas = { id: serie.id, etapa: serie.etapa, ano: serie.ano }

/**
 * As séries da escola do contexto, e só dela: nenhum método recebe escola (regra 10, item 3). O recorte (D43) e a
 * série repetida são barrados pelo banco (`serie_no_recorte`, `serie_escola_etapa_ano_unico`).
 */
export class SerieRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  async criar(pedido: CriarSerieRequest): Promise<Serie> {
    const [criada] = await this.banco.insert(serie).values({ escolaId: requireEscolaId(), etapa: pedido.etapa, ano: pedido.ano }).returning(colunas)
    if (criada === undefined) throw new InvariantException('série não criada')
    return criada
  }

  /** Uma página das séries da escola, em ordem de criação, com uma linha a mais que diz se há próxima. */
  listar({ pagina, limite }: PaginationQuery): Promise<Serie[]> {
    return this.banco
      .select(colunas)
      .from(serie)
      .where(and(eq(serie.escolaId, requireEscolaId()), pagina === undefined ? undefined : gt(serie.id, pagina)))
      .orderBy(asc(serie.id))
      .limit(limite + 1)
  }

  /** A série da escola com esse id; a de outra escola não é achada. */
  async porId(id: string): Promise<Serie | undefined> {
    const [linha] = await this.banco
      .select(colunas)
      .from(serie)
      .where(and(eq(serie.escolaId, requireEscolaId()), eq(serie.id, id)))
    return linha
  }
}
