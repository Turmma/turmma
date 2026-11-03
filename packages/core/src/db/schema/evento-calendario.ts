import { sql } from 'drizzle-orm'
import { check, date, foreignKey, index, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import type { TipoDeEventoDoCalendario } from '@educa/shared'
import { anoLetivo } from './ano-letivo.js'
import { escola } from './escola.js'

/**
 * Um evento do calendário escolar do ano: feriado, recesso ou evento, de uma data a outra (F2, tarefa 2.0, RF10; Tech Spec,
 * seção 3). Reimportar o calendário substitui os do ano. Quem grava é o job do calendário (4.0).
 *
 * - FK composta `(escola_id, ano_letivo_id)` com o ano: o evento nunca é do ano de outra escola.
 * - `descricao` é texto livre de até 120 caracteres, e por isso o modelo da planilha pede para não escrever nome de pessoa
 *   (`docs/lgpd.md`, "Evento do calendário"). Sem dado de pessoa por desenho.
 * - Índice `(escola_id, ano_letivo_id)` para o calendário do ano: começa pelo escopo (regra 80, item 8).
 */
export const eventoCalendario = pgTable(
  'evento_calendario',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    tipo: text().$type<TipoDeEventoDoCalendario>().notNull(),
    inicio: date({ mode: 'string' }).notNull(),
    fim: date({ mode: 'string' }).notNull(),
    descricao: text().notNull(),
  },
  (tabela) => [
    foreignKey({ name: 'evento_calendario_ano_letivo_da_escola_fk', columns: [tabela.escolaId, tabela.anoLetivoId], foreignColumns: [anoLetivo.escolaId, anoLetivo.id] }),
    index('evento_calendario_ano_idx').on(tabela.escolaId, tabela.anoLetivoId),
    check('evento_calendario_tipo_valido', sql`${tabela.tipo} in ('feriado', 'recesso', 'evento')`),
    check('evento_calendario_periodo_valido', sql`${tabela.inicio} <= ${tabela.fim}`),
    // 120 é `TAMANHO_MAXIMO_DA_DESCRICAO_DO_EVENTO` do contrato (`packages/shared`).
    check('evento_calendario_descricao_preenchida', sql`char_length(btrim(${tabela.descricao})) between 1 and 120`),
  ],
)
