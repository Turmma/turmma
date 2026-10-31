import { sql } from 'drizzle-orm'
import { check, pgTable, smallint, text, unique, uuid } from 'drizzle-orm/pg-core'
import type { Etapa } from '@educa/shared'
import { escola } from './escola.js'

/**
 * O ano escolar dentro do recorte (glossário, "Série"; D43), da escola: 6º ao 9º ano do Ensino Fundamental e 1º ao 3º
 * do Ensino Médio (tarefa 8.0; Tech Spec, seção 3).
 *
 * - `serie_no_recorte` garante o recorte no banco: nenhum caminho (rota, seed, importação da F2) cria "5º ano" nem
 *   "4º do Ensino Médio". Descer de faixa reabre a regra 70.
 * - `unique (escola_id, etapa, ano)`: o "8º ano" existe uma vez por escola, e dois cliques não o criam duas vezes.
 * - `unique (escola_id, id)` é o alvo da FK composta da turma, que nunca aponta para a série de outra escola.
 * - Não varia por ano letivo: a turma é que pertence ao ano. Sem dado de pessoa.
 */
export const serie = pgTable(
  'serie',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    etapa: text().$type<Etapa>().notNull(),
    ano: smallint().notNull(),
  },
  (tabela) => [
    unique('serie_escola_id_unico').on(tabela.escolaId, tabela.id),
    unique('serie_escola_etapa_ano_unico').on(tabela.escolaId, tabela.etapa, tabela.ano),
    check(
      'serie_no_recorte',
      sql`(${tabela.etapa} = 'ef_anos_finais' and ${tabela.ano} between 6 and 9) or (${tabela.etapa} = 'em' and ${tabela.ano} between 1 and 3)`,
    ),
  ],
)
