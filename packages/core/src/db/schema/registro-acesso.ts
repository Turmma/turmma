import { sql } from 'drizzle-orm'
import { check, index, inet, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'

export const EVENTOS_DE_ACESSO = ['login', 'login_falho', 'renovacao', 'saida'] as const
export type EventoDeAcesso = (typeof EVENTOS_DE_ACESSO)[number]

/**
 * O registro de acesso à aplicação exigido pelo Marco Civil (art. 15): evento, IP, data e hora, por 6 meses
 * (`docs/lgpd.md`). Não é auditoria: não tem finalidade nem autor de ação, e tem retenção própria.
 *
 * - `escola_id` só é nulo na falha de login por e-mail sem usuário, antes de haver escola (Tech Spec, seção 6);
 *   o check garante no banco.
 * - `usuario_id` fica sem FK: o registro fica pela retenção legal mesmo depois de a escola eliminar o usuário
 *   (Tech Spec, seção 5, "Ciclo de vida").
 * - O índice `(escola_id, em)` começa pela escola (regra 80, item 8): a consulta é "a escola, num período". O
 *   `(em)` é do expurgo de 6 meses (17.0), que vale para todas as escolas e para a falha sem escola.
 */
export const registroAcesso = pgTable(
  'registro_acesso',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid().references(() => escola.id),
    usuarioId: uuid(),
    evento: text().$type<EventoDeAcesso>().notNull(),
    ip: inet().notNull(),
    em: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    index('registro_acesso_escola_em_idx').on(tabela.escolaId, tabela.em),
    index('registro_acesso_em_idx').on(tabela.em),
    // O que o arquivo do titular lê: os acessos de uma pessoa, pela escola (F3, 13.0; regra 80, item 8).
    index('registro_acesso_usuario_idx').on(tabela.escolaId, tabela.usuarioId, tabela.em),
    check('registro_acesso_evento_valido', sql`${tabela.evento} in ('login', 'login_falho', 'renovacao', 'saida')`),
    check('registro_acesso_escola_so_falta_na_falha_sem_usuario', sql`escola_id is not null or (evento = 'login_falho' and usuario_id is null)`),
  ],
)
