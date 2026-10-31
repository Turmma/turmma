import { sql } from 'drizzle-orm'
import { check, foreignKey, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'
import { usuario } from './usuario.js'

// Sem import de `@educa/shared`: o drizzle-kit carrega este arquivo com o próprio carregador para gerar a migration.
export const PROVEDORES_EXTERNOS = ['google', 'microsoft'] as const
export type ProvedorExterno = (typeof PROVEDORES_EXTERNOS)[number]

/**
 * A conta Google ou Microsoft da escola, ligada a um usuário dela (tarefa 13.0; Tech Spec, seção 3; D48). Guarda só o
 * provedor e o identificador estável que ele dá à conta, nunca o e-mail, o nome nem a foto (regra 20, item 2).
 *
 * - `sujeito` é o `sub` no Google e o `oid` na Microsoft; `tenant` é o `tid` da Microsoft, nulo no Google. A chave da
 *   Microsoft é `oid`+`tid`: o mesmo `oid` em outro tenant é outra conta.
 * - `unique (escola_id, provedor, coalesce(tenant, ''), sujeito)`: uma ligação por conta externa em cada escola, e o
 *   índice da leitura do login. A mesma conta ligada em A não entra em B: a ligação é da escola (regra 10).
 * - `unique (escola_id, usuario_id)`: uma conta externa por usuário. A segunda conta com o mesmo e-mail de um professor
 *   já ligado não liga sozinha (RF9), nem quando as duas chegam ao mesmo tempo: o banco recusa a segunda.
 * - `(escola_id, usuario_id)` é FK composta para `usuario (escola_id, id)`, e sai com ele (`on delete cascade`).
 * - Tabela que cresce com aluno: índices começam por `escola_id` (regra 80, item 8).
 */
export const contaExterna = pgTable(
  'conta_externa',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    usuarioId: uuid().notNull(),
    provedor: text().$type<ProvedorExterno>().notNull(),
    tenant: text(),
    sujeito: text().notNull(),
    ligadaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique('conta_externa_escola_id_unico').on(tabela.escolaId, tabela.id),
    unique('conta_externa_usuario_unico').on(tabela.escolaId, tabela.usuarioId),
    uniqueIndex('conta_externa_identificador_unico').on(tabela.escolaId, tabela.provedor, sql`coalesce(${tabela.tenant}, '')`, tabela.sujeito),
    foreignKey({ name: 'conta_externa_usuario_da_escola_fk', columns: [tabela.escolaId, tabela.usuarioId], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('cascade'),
    check('conta_externa_provedor_valido', sql`${tabela.provedor} in ('google', 'microsoft')`),
    // O Google não tem tenant; a Microsoft sempre tem, porque o `oid` só é único dentro do tenant.
    check('conta_externa_tenant_do_provedor', sql`(${tabela.provedor} = 'google') = (${tabela.tenant} is null)`),
    check('conta_externa_sujeito_formato', sql`char_length(${tabela.sujeito}) between 1 and 255`),
  ],
)
