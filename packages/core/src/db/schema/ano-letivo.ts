import { sql } from 'drizzle-orm'
import { check, date, pgTable, smallint, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { SITUACOES_DO_ANO_LETIVO, type SituacaoDoAnoLetivo } from '@educa/shared'
import { escola } from './escola.js'

/** As situações do contrato (`packages/shared`), as mesmas do check `ano_letivo_situacao_valida`. */
export const SITUACOES_DE_ANO_LETIVO = SITUACOES_DO_ANO_LETIVO
export type SituacaoDeAnoLetivo = SituacaoDoAnoLetivo

/**
 * O recorte anual da escola (glossário, "Ano letivo"), a segunda dimensão do escopo (regra 10, item 2): turma,
 * vínculo e nota pertencem a um ano. A coordenação cria, abre e encerra pelas rotas de `/v1/anos-letivos` (8.0).
 *
 * - `unique (escola_id, id)` é o alvo das FKs compostas de turma e vínculo, que nunca apontam para o ano de
 *   outra escola.
 * - Uma escola tem no máximo um ano `em_curso`, garantido pelo índice único parcial: a guarda de sessão lê
 *   esse ano em toda requisição.
 * - `unique (escola_id, ano)` (8.0): dois cliques em "criar 2027" não fazem dois anos 2027 na mesma escola.
 * - Sem dado de pessoa.
 */
export const anoLetivo = pgTable(
  'ano_letivo',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    ano: smallint().notNull(),
    inicio: date({ mode: 'string' }).notNull(),
    fim: date({ mode: 'string' }).notNull(),
    situacao: text().$type<SituacaoDeAnoLetivo>().notNull().default('planejado'),
  },
  (tabela) => [
    unique('ano_letivo_escola_id_unico').on(tabela.escolaId, tabela.id),
    unique('ano_letivo_escola_ano_unico').on(tabela.escolaId, tabela.ano),
    uniqueIndex('ano_letivo_um_em_curso_por_escola').on(tabela.escolaId).where(sql`situacao = 'em_curso'`),
    check('ano_letivo_situacao_valida', sql`${tabela.situacao} in ('planejado', 'em_curso', 'encerrado')`),
    check('ano_letivo_ano_valido', sql`${tabela.ano} between 2000 and 2100`),
    check('ano_letivo_periodo_valido', sql`${tabela.fim} > ${tabela.inicio}`),
  ],
)
