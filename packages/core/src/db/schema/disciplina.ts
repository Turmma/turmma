import { sql } from 'drizzle-orm'
import { check, pgTable, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { AreaDoConhecimento } from '@educa/shared'
import { escola } from './escola.js'

/**
 * A matéria da escola (glossário, "Disciplina"): Química, História (tarefa 8.0; Tech Spec, seção 3).
 *
 * - `unique (escola_id, lower(nome))`: "Química" e "química" são a mesma disciplina na escola, e o nome se repete à
 *   vontade entre escolas.
 * - `unique (escola_id, id)` é o alvo da FK composta do vínculo (9.0).
 * - `area` é a área da BNCC, opcional. Sem dado de pessoa.
 */
export const disciplina = pgTable(
  'disciplina',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    nome: text().notNull(),
    area: text().$type<AreaDoConhecimento>(),
  },
  (tabela) => [
    unique('disciplina_escola_id_unico').on(tabela.escolaId, tabela.id),
    uniqueIndex('disciplina_nome_na_escola_unico').on(tabela.escolaId, sql`lower(${tabela.nome})`),
    check('disciplina_nome_preenchido', sql`char_length(btrim(${tabela.nome})) between 1 and 80`),
    check(
      'disciplina_area_valida',
      sql`${tabela.area} is null or ${tabela.area} in ('linguagens', 'matematica', 'ciencias_da_natureza', 'ciencias_humanas', 'ensino_religioso')`,
    ),
  ],
)
