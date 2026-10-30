import { disciplina, requireEscolaId, type Database, type DatabaseTransaction } from '@educa/nucleo'
import type { PaginationQuery, Disciplina, CriarDisciplinaRequest } from '@educa/shared'
import { and, asc, eq, gt } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'
import { excluirSemReferencia } from '../exclusao.js'

const colunas = { id: disciplina.id, nome: disciplina.nome, area: disciplina.area }

/**
 * As disciplinas da escola do contexto, e só dela: nenhum método recebe escola (regra 10, item 3). O nome repetido,
 * sem diferenciar maiúscula, é barrado pelo banco (`disciplina_nome_na_escola_unico`).
 */
export class DisciplinaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  async criar(pedido: CriarDisciplinaRequest): Promise<Disciplina> {
    const [criada] = await this.banco
      .insert(disciplina)
      .values({ escolaId: requireEscolaId(), nome: pedido.nome, area: pedido.area ?? null })
      .returning(colunas)
    if (criada === undefined) throw new InvariantException('disciplina não criada')
    return criada
  }

  /** Uma página das disciplinas da escola, em ordem de criação, com uma linha a mais que diz se há próxima. */
  listar({ pagina, limite }: PaginationQuery): Promise<Disciplina[]> {
    return this.banco
      .select(colunas)
      .from(disciplina)
      .where(and(eq(disciplina.escolaId, requireEscolaId()), pagina === undefined ? undefined : gt(disciplina.id, pagina)))
      .orderBy(asc(disciplina.id))
      .limit(limite + 1)
  }

  /**
   * Troca o nome da disciplina da escola com esse id e devolve a disciplina renomeada; a de outra escola ou inexistente
   * não é achada (`undefined`), e nada muda. O nome de outra disciplina da escola é barrado pelo mesmo índice único do
   * criar.
   */
  async renomear(id: string, nome: string): Promise<Disciplina | undefined> {
    const [renomeada] = await this.banco
      .update(disciplina)
      .set({ nome })
      .where(and(eq(disciplina.escolaId, requireEscolaId()), eq(disciplina.id, id)))
      .returning(colunas)
    return renomeada
  }

  /**
   * Apaga a disciplina da escola com esse id, se nada aponta para ela, e diz se apagou. Com vínculo (qualquer estado,
   * de qualquer ano), a FK barra e sai `CONFLITO` (`excluirSemReferencia`); a de outra escola ou inexistente não é
   * achada (`false`).
   */
  excluir(id: string): Promise<boolean> {
    return excluirSemReferencia(async () => {
      const apagadas = await this.banco
        .delete(disciplina)
        .where(and(eq(disciplina.escolaId, requireEscolaId()), eq(disciplina.id, id)))
        .returning({ id: disciplina.id })
      return apagadas.length > 0
    })
  }

  /** A disciplina da escola com esse id; a de outra escola não é achada. */
  async porId(id: string): Promise<Disciplina | undefined> {
    const [linha] = await this.banco
      .select(colunas)
      .from(disciplina)
      .where(and(eq(disciplina.escolaId, requireEscolaId()), eq(disciplina.id, id)))
    return linha
  }
}
