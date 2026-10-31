import { sql } from 'drizzle-orm'
import { check, foreignKey, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { Agente } from '@educa/shared'
import { anoLetivo } from './ano-letivo.js'
import { escola } from './escola.js'
import { usuario } from './usuario.js'

/**
 * A thread de uma pessoa com um agente (glossário, "Agente"; MVP, A2). Nesta fatia só existe a do professor com o
 * Assistente de ensino: os sinais do Tutor e as entregas que "Seu time" mostra são lidos de `sinal_tutor` e de `entrega`,
 * e a conversa do aluno com o Tutor fica em `mensagem_tutor`.
 *
 * - **Só o dono lê a thread** (regra 70, item 8): a coordenação nunca alcança a conversa do professor. O dono vem da
 *   sessão, nunca de argumento.
 * - Índice único `(escola_id, ano_letivo_id, usuario_id, agente)`: uma thread por pessoa, agente e ano. As duas primeiras
 *   mensagens ao mesmo tempo criam uma thread só (`on conflict do nothing`; regra 80, item 7), e a conversa de 2026 não
 *   segue para 2027 (regra 60, item 5).
 * - O dono por FK composta com a escola, `on delete cascade`: a conversa é dele, e a eliminação a apaga de fato, com as
 *   mensagens (regra 20, item 15).
 * - `unique (escola_id, ano_letivo_id, id)` é o alvo da mensagem, que carrega o ano da thread.
 */
export const threadAgente = pgTable(
  'thread_agente',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    usuarioId: uuid().notNull(),
    agente: text().$type<Agente>().notNull(),
    criadaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique('thread_agente_escola_ano_id_unico').on(tabela.escolaId, tabela.anoLetivoId, tabela.id),
    foreignKey({ name: 'thread_agente_ano_letivo_da_escola_fk', columns: [tabela.escolaId, tabela.anoLetivoId], foreignColumns: [anoLetivo.escolaId, anoLetivo.id] }),
    foreignKey({ name: 'thread_agente_usuario_da_escola_fk', columns: [tabela.escolaId, tabela.usuarioId], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('cascade'),
    uniqueIndex('thread_agente_uma_por_pessoa').on(tabela.escolaId, tabela.anoLetivoId, tabela.usuarioId, tabela.agente),
    check('thread_agente_agente_valido', sql`${tabela.agente} in ('assistente_de_ensino', 'tutor', 'analista_de_desempenho_escolar')`),
  ],
)
