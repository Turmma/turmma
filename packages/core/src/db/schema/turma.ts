import { sql } from 'drizzle-orm'
import { check, foreignKey, pgTable, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { Turno } from '@educa/shared'
import { anoLetivo } from './ano-letivo.js'
import { escola } from './escola.js'
import { serie } from './serie.js'

/**
 * O agrupamento de alunos dentro de uma série, num ano letivo (glossário, "Turma"; regra 60, item 5): o 2ºB de 2026
 * (tarefa 8.0; Tech Spec, seção 3).
 *
 * - FKs compostas `(escola_id, serie_id)` e `(escola_id, ano_letivo_id)`: a turma nunca aponta para a série ou o ano de
 *   outra escola, nem por um id trocado no corpo (regra 10).
 * - `unique (escola_id, ano_letivo_id, lower(nome))`: "7ºA" e "7ºa" conflitam no mesmo ano, e o "7ºA" de 2026 convive
 *   com o de 2027, que é outra turma. A virada de ano não colide.
 * - `unique (escola_id, ano_letivo_id, id)` é o alvo do vínculo (9.0), que referencia a turma pelo ano dela; o índice
 *   serve também à listagem do ano em curso, paginada por id.
 * - Sem dado de pessoa.
 */
export const turma = pgTable(
  'turma',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    serieId: uuid().notNull(),
    nome: text().notNull(),
    turno: text().$type<Turno>(),
  },
  (tabela) => [
    unique('turma_escola_id_unico').on(tabela.escolaId, tabela.id),
    unique('turma_escola_ano_id_unico').on(tabela.escolaId, tabela.anoLetivoId, tabela.id),
    uniqueIndex('turma_nome_no_ano_unico').on(tabela.escolaId, tabela.anoLetivoId, sql`lower(${tabela.nome})`),
    foreignKey({ name: 'turma_ano_letivo_da_escola_fk', columns: [tabela.escolaId, tabela.anoLetivoId], foreignColumns: [anoLetivo.escolaId, anoLetivo.id] }),
    foreignKey({ name: 'turma_serie_da_escola_fk', columns: [tabela.escolaId, tabela.serieId], foreignColumns: [serie.escolaId, serie.id] }),
    check('turma_nome_preenchido', sql`char_length(btrim(${tabela.nome})) between 1 and 40`),
    check('turma_turno_valido', sql`${tabela.turno} is null or ${tabela.turno} in ('manha', 'tarde', 'noite', 'integral')`),
  ],
)
