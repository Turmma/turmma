import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { disciplina } from '../db/schema/disciplina.js'
import type { PaginationQuery, Disciplina, CriarDisciplinaRequest, ComponenteBncc } from '@educa/shared'
import { and, asc, eq, gt } from 'drizzle-orm'
import { componenteDoNomeDaDisciplina, InvariantException } from '@educa/shared'
import { deleteSemReferencia } from './exclusao.js'

const colunas = { id: disciplina.id, nome: disciplina.nome, area: disciplina.area, componenteBncc: disciplina.componenteBncc }

/**
 * As disciplinas da escola do contexto, e só dela: nenhum método recebe escola (regra 10, item 3). O nome repetido,
 * sem diferenciar maiúscula, é barrado pelo banco (`disciplina_nome_na_escola_unico`).
 *
 * **O componente da BNCC** (classificacao-bncc, 1.0): a disciplina nasce com o que o nome diz (`componenteDoNomeDaDisciplina`: "química" nasce
 * Química, "Robótica" nasce sem), renomear **não** o muda, e quem o troca é a coordenação (`definirComponente`).
 */
export class DisciplinaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  async create(pedido: CriarDisciplinaRequest): Promise<Disciplina> {
    const [criada] = await this.banco
      .insert(disciplina)
      .values({ escolaId: requireEscolaId(), nome: pedido.nome, area: pedido.area ?? null, componenteBncc: componenteDoNomeDaDisciplina(pedido.nome) })
      .returning(colunas)
    if (criada === undefined) throw new InvariantException('disciplina não criada')
    return criada
  }

  /** Uma página das disciplinas da escola, em ordem de criação, com uma linha a mais que diz se há próxima. */
  list({ pagina, limite }: PaginationQuery): Promise<Disciplina[]> {
    return this.banco
      .select(colunas)
      .from(disciplina)
      .where(and(eq(disciplina.escolaId, requireEscolaId()), pagina === undefined ? undefined : gt(disciplina.id, pagina)))
      .orderBy(asc(disciplina.id))
      .limit(limite + 1)
  }

  /** Todas as disciplinas da escola numa consulta só, em ordem de id: a planilha da grade as compara com as linhas (onboarding-por-convite, 11.0). */
  todas(): Promise<Array<{ readonly id: string; readonly nome: string }>> {
    return this.banco
      .select({ id: disciplina.id, nome: disciplina.nome })
      .from(disciplina)
      .where(eq(disciplina.escolaId, requireEscolaId()))
      .orderBy(asc(disciplina.id))
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
   * A disciplina da escola com esse id, **com a linha travada** (`for update`) até o fim da transação: quem troca o componente lê o de antes sem que outra troca passe no meio, e a auditoria
   * leva o antes e o depois certos. A de outra escola ou inexistente não é achada.
   */
  async lockPorId(id: string): Promise<Disciplina | undefined> {
    const [linha] = await this.banco
      .select(colunas)
      .from(disciplina)
      .where(and(eq(disciplina.escolaId, requireEscolaId()), eq(disciplina.id, id)))
      .for('update')
    return linha
  }

  /** Define o componente da BNCC da disciplina da escola com esse id (`null` o apaga) e devolve a disciplina; a de outra escola ou inexistente não é achada (`undefined`), e nada muda. */
  async definirComponente(id: string, componente: ComponenteBncc | null): Promise<Disciplina | undefined> {
    const [alterada] = await this.banco
      .update(disciplina)
      .set({ componenteBncc: componente })
      .where(and(eq(disciplina.escolaId, requireEscolaId()), eq(disciplina.id, id)))
      .returning(colunas)
    return alterada
  }

  /**
   * Apaga a disciplina da escola com esse id, se nada aponta para ela, e diz se apagou. Com vínculo (qualquer estado,
   * de qualquer ano), a FK barra e sai `CONFLITO` (`deleteSemReferencia`); a de outra escola ou inexistente não é
   * achada (`false`).
   */
  delete(id: string): Promise<boolean> {
    return deleteSemReferencia(async () => {
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
