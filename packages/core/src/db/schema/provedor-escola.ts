import { sql } from 'drizzle-orm'
import { check, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'
import type { ProvedorExterno } from './conta-externa.js'

/**
 * O domínio Google (`hd`) ou o tenant Microsoft (`tid`) que a escola liberou para o login pela conta dela (tarefa
 * 13.0; Tech Spec, seção 3). É dado da instituição, não de pessoa. Mais de um por escola: a escola com dois domínios
 * cadastra os dois (PRD, casos de borda).
 *
 * - A linha nunca é apagada: sair da lista grava `removido_em`. Assim o id que a auditoria
 *   `escola.provedores_alterados` guarda continua dizendo qual domínio foi liberado ou retirado, e quando.
 * - `unique parcial (escola_id, provedor, valor) where removido_em is null`: o mesmo domínio não fica liberado duas
 *   vezes, e é o índice da conferência do login. Duas escolas podem cadastrar o mesmo domínio: o que separa uma da
 *   outra é a ligação da conta, que é por escola.
 * - `valor` vem minúsculo, conferido pelo contrato (`packages/shared`); o banco confere de novo.
 */
export const provedorEscola = pgTable(
  'provedor_escola',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    provedor: text().$type<ProvedorExterno>().notNull(),
    valor: text().notNull(),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    removidoEm: timestamp({ withTimezone: true }),
  },
  (tabela) => [
    unique('provedor_escola_escola_id_unico').on(tabela.escolaId, tabela.id),
    uniqueIndex('provedor_escola_valor_ativo_unico').on(tabela.escolaId, tabela.provedor, tabela.valor).where(sql`removido_em is null`),
    check('provedor_escola_provedor_valido', sql`${tabela.provedor} in ('google', 'microsoft')`),
    check('provedor_escola_valor_formato', sql`char_length(${tabela.valor}) between 1 and 253 and ${tabela.valor} = lower(btrim(${tabela.valor}))`),
  ],
)
